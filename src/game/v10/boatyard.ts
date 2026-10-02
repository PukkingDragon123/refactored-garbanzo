// V10 camp boatyard: the Kitten on the dry sand between the wreck and camp, changing with every
// stage of the repair (see boat.ts), with everything the job needs on the island:
//  - the tender itself, upside down in the sand east of the wreck's torn bow (stage 0)
//  - loose planking to pry off the wreck (the galley, the torn bow) and a plank in the sand
//  - kauri gum on two old trees up the bush track, a big harakeke stand by the stream
//  - the outboard on Jenna's bench in the engine room, a jerry can of two-stroke in the locker
//  - a long straight log in the hidden cove for the ama
//  - at the boat: hand-ins with progress in the prompt, and a cutscene for each stage (Aroha's
//    gum-and-harakeke patch, her lashing lesson for the outrigger, Jenna's outboard close-up, the
//    sail she weaves overnight, rigging, and Launch Day)
// Once she floats, the Kitten is where boat trips start: "Take the Kitten out".
//
// Attached to the island story from IsleStory.enter() (one line in islestory.ts). Hooks for the camp
// module: startBoatQuest(), playBoatLaunchOut(), playBoatLanding(), boatyardX().

import { game } from '../game';
import type { IsleStory } from '../v4/islestory';
import type { Actor } from '../../world/actor';
import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { Custom } from '../../world/props';
import { local, A } from '../assets';
import { audio } from '../../core/audio';
import { clamp, rand } from '../../core/math';
import { ITEMS } from '../items';
import { add, fits } from '../inventory';
import { itemIconURL } from '../../art/itemicons';
import { groundY, WRECK } from '../../art/island4/layout';
import { questStatus, startQuest } from '../quests';
import * as Day from './day';
import { dayNumber } from './day';
import { spend } from './energy';
import * as B from './boat';
import * as K from '../../art/v10/boat10';
import { PixelBuffer } from '../../art/pixel';
import { hex, mix, shade } from '../../art/color';
import '../sites10/ocean';

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const F = (k: string) => !!game.save.flags[k];

/** where the Kitten sits: x on the walk line, d px toward the camera on the dry sand */
export const YARD = { x: 1190, d: 44 };
/** the tender as found, east of the wreck's torn bow */
export const BURIED = { x: 1078, d: 36 };
const PLANKS = [
  { id: 'galley', x: 628, inside: true, n: 2, label: 'Pry planks off the smashed galley cupboards' },
  { id: 'bow', x: 903, inside: false, n: 2, label: 'Pry splintered planking off the torn bow' },
  { id: 'sand', x: 960, inside: false, n: 1, label: 'Pull a washed-up plank out of the sand' },
];
const GUM = [{ id: 'gum1', x: 6248 }, { id: 'gum2', x: 6612 }];
const FLAX = { id: 'flax', x: 3652, n: 3 };
const LOG = { x: 5612 };
const OUTBOARD = { x: 506 };
const FUEL = { x: 578 };

export const boatyardX = () => YARD.x;
let current: Boatyard | null = null;
export const boatyard = () => current;

/** start the repair quest (the camp module can call this from its own morning beat) */
export function startBoatQuest() {
  if (questStatus('v10kitten') !== 'hidden') return;
  B.boatSave().seen['intro'] = true;
  startQuest('v10kitten');
}

interface SprF { f: Frame; s: K.Spr }

export class Boatyard {
  /** 0..1: the boat sliding down the beach into the water (launch / trip start), or up it (landing) */
  slide = 0;
  /** the boat bobbing as it floats */
  private bob = 0;
  private fr = new Map<string, SprF>();
  private nagT = 6;
  private introT = 0;
  private sparkT = 0;

  constructor(readonly st: IsleStory) {}
  get s() { return this.st.s; }

  // ---------------------------------------------------------------- frames
  private frame(key: string, gen: () => K.Spr): SprF {
    let e = this.fr.get(key);
    if (!e) { const s = gen(); e = { f: local.add('v10y:' + key, s.buf, s.ax, s.ay), s }; this.fr.set(key, e); }
    return e;
  }

  // ---------------------------------------------------------------- setup
  setup() {
    B.setBoatAway(false);
    const s = this.s;
    // the boatyard and the buried hull on the dry sand (drawn over the walk line, like the debris)
    s.main.add(new Custom(55.9, r => this.drawBand(r), dt => this.update(dt)));
    // gum on the kauri up the bush track (on the trunks, behind the cast)
    s.main.add(new Custom(-3.4, r => this.drawGum(r)));
    // the ama log in the cove, the outboard and fuel can in the wreck (inside the hull, behind the cast)
    s.main.add(new Custom(-2.2, r => this.drawFinds(r)));
    this.interactables();
    this.triggers();
  }

  private interactables() {
    const st = this.st, s = this.s, self = this;
    const started = () => questStatus('v10kitten') !== 'hidden';
    // ---- the buried tender
    st.it({ x: BURIED.x, y: groundY(BURIED.x), w: 34, label: 'Dig out the upturned hull', standX: BURIED.x - 30, quest: () => true,
      enabled: () => started() && B.boatStage() === 0 && !s.inWreck, action: () => this.digOut() } as never);
    // ---- the Kitten at the boatyard
    st.it({ x: YARD.x, y: groundY(YARD.x), w: 30, get label() { return self.boatLabel(); }, standX: YARD.x - 24,
      quest: () => this.boatQuest(), enabled: () => B.boatStage() >= 1 && !B.boatIsAway() && this.slide === 0 && !s.inWreck, action: () => this.boatAction() } as never);
    // the outboard on its sawhorse, waiting for Jenna
    st.it({ x: YARD.x + 86, y: groundY(YARD.x + 86), w: 14, label: 'Fix the outboard with Jenna', standX: YARD.x + 66, quest: () => true,
      enabled: () => B.boatStage() === 3 && B.found('outboard') && B.found('fuel') && !B.boatSave().motorFixed, action: () => this.fixMotor() } as never);
    // ---- salvage: planks in and around the wreck
    for (const p of PLANKS) {
      st.it({ x: p.x, y: p.inside ? WRECK.floor : groundY(p.x), w: 14, label: p.label, standX: p.x - 14, quest: () => this.wantPlanks(),
        enabled: () => started() && (p.inside ? s.inWreck : !s.inWreck) && this.spotFree(p.id), action: () => this.take(p.id, 'plank', p.n, p.x, p.inside ? WRECK.floor : groundY(p.x), 'pick') } as never);
    }
    // ---- kauri gum and the harakeke stand
    for (const g of GUM) {
      st.it({ x: g.x, y: groundY(g.x), w: 14, label: game.save.tools.includes('knife') ? 'Cut a lump of kauri gum' : 'Cut a lump of kauri gum <span style="opacity:0.75">(needs Pocket knife)</span>', standX: g.x - 14,
        quest: () => this.wantMat('resin'), enabled: () => started() && this.spotFree(g.id), action: () => this.take(g.id, 'resin', 1, g.x, groundY(g.x) - 12, 'kneel', 'knife') } as never);
    }
    st.it({ x: FLAX.x, y: groundY(FLAX.x), w: 16, label: 'Cut harakeke from the big flax stand', standX: FLAX.x - 16, quest: () => this.wantMat('flaxleaf'),
      enabled: () => started() && this.spotFree(FLAX.id), action: () => this.take(FLAX.id, 'flaxleaf', FLAX.n, FLAX.x, groundY(FLAX.x) - 8, 'kneel', 'knife') } as never);
    // ---- the log for the ama, the outboard, the fuel
    st.it({ x: LOG.x, y: groundY(LOG.x), w: 30, label: 'A long, straight tōtara log', standX: LOG.x - 40, quest: () => true,
      enabled: () => questStatus('v10ama') === 'active' && !B.found('log'), action: () => this.fetchLog() } as never);
    st.it({ x: OUTBOARD.x, y: WRECK.floor, w: 14, label: 'A tarp-wrapped lump on Jenna’s bench', standX: OUTBOARD.x + 14, quest: () => true,
      enabled: () => s.inWreck && questStatus('v10motor') === 'active' && !B.found('outboard'), action: () => this.findOutboard() } as never);
    st.it({ x: FUEL.x, y: WRECK.floor, w: 12, label: 'The engine room locker', standX: FUEL.x - 12, quest: () => true,
      enabled: () => s.inWreck && questStatus('v10motor') === 'active' && !B.found('fuel'), action: () => this.findFuel() } as never);
  }

  private triggers() {
    const st = this.st, s = this.s;
    const free = () => !s.cutscene && !game.ui.blocking && !s.busyAction && s.player.state === 'normal';
    const atCamp = () => s.player.x > 1250 && s.player.x < 2600 && !s.inWreck;
    // spotting the tender's keel in the sand
    st.trigger('v10:spotTender', () => free() && questStatus('v10kitten') === 'active' && !B.found('tender') && Math.abs(s.player.x - BURIED.x) < 70, async () => {
      B.setFound('tender');
      s.player.facing = BURIED.x > s.player.x ? 1 : -1;
      await st.say([
        { who: 'mori', text: 'That hump in the sand... it’s a keel. Copper rivets. Red boot stripe.', expr: 'surprised', emote: 'exclaim' },
        { who: 'mori', text: 'KITTEN! Upside down, but in one piece! Joshu was right!', expr: 'excited', react: 'jump' },
      ]);
      s.hud?.refresh(true);
    });
  }

  // ---------------------------------------------------------------- per frame
  update(dt: number) {
    const s = this.s, bs = B.boatSave();
    if (!s.cutscene && !game.ui.blocking) bs.playT += dt;
    this.bob += dt;
    this.sparkT -= dt;
    // the camp day loop's Joshu talk (flag v10:boatTalk) already told the story: just start the quest
    if (questStatus('v10kitten') === 'hidden' && F('v10:boatTalk')) { bs.seen['intro'] = true; startQuest('v10kitten'); }
    // the repair talk: Day 2 or later, daylight, at camp, a quiet moment
    if (questStatus('v10kitten') === 'hidden' && !bs.seen['intro'] && F('v4:day1') && this.daylight() && !s.cutscene && !game.ui.blocking && !s.busyAction && s.player.x > 1300 && s.player.x < 2600 && !s.inWreck) {
      this.introT += dt;
      if (this.introT > 12) void this.intro();
    } else this.introT = 0;
    // a nudge from the crew when you walk past with something to hand in
    this.nagT -= dt;
    if (this.nagT <= 0 && !s.cutscene && !game.ui.blocking && Math.abs(s.player.x - YARD.x) < 160 && B.boatStage() >= 1) {
      this.nagT = 25;
      this.crewNudge();
    }
  }
  private daylight() {
    const t = this.s.clock.t;
    return t > 0.05 && t < 2.5 && (dayNumber() >= 2 || !F('v4:day1') || t < 2.5);
  }

  // ---------------------------------------------------------------- drawing
  /** the yard on the dry sand: scale and offset of the band at depth d */
  private bandAt(x: number, d: number) { const k = 1 + d / 260; return { k, y: groundY(x) + d }; }
  private drawBand(r: Renderer) {
    const x0 = r.visibleX0(160), x1 = r.visibleX1(160);
    const stage = B.boatStage();
    if (stage === 0 && BURIED.x > x0 && BURIED.x < x1) {
      const { k, y } = this.bandAt(BURIED.x, BURIED.d);
      const e = this.frame('buried', K.buriedTender);
      r.beginShadows(); r.draw(A.shadow, BURIED.x, y + 1, 4.4 * k, 0.6 * k, 0, packColor(0, 0, 0, 0.28)); r.endShadows();
      r.draw(e.f, BURIED.x, y, k, k);
    }
    if (YARD.x < x0 - 200 || YARD.x > x1 + 200) return;
    const { k, y } = this.bandAt(YARD.x, YARD.d);
    // props around the boat
    this.drawYardProps(r, k, y);
    if (stage >= 1 && !B.boatIsAway()) this.drawBoat(r, stage, k, y);
  }

  private drawYardProps(r: Renderer, k: number, y: number) {
    const bs = B.boatSave(), stage = bs.stage;
    if (stage < 1) return;
    const prop = (key: string, gen: () => K.Spr, dx: number, dd: number, sh = 0) => {
      const e = this.frame(key, gen);
      const yy = y + dd, kk = 1 + (YARD.d + dd) / 260;
      if (sh) { r.beginShadows(); r.draw(A.shadow, YARD.x + dx * k, yy + 0.5, sh * kk / 32, 0.5 * kk, 0, packColor(0, 0, 0, 0.3)); r.endShadows(); }
      r.draw(e.f, YARD.x + dx * k, yy, kk, kk);
    };
    prop('sign', K.yardSign, -124, -6, 10);
    // materials handed in but not yet used
    const pl = (stage === 1 ? B.given('patch', 'plank') : 0) + (stage === 4 ? B.given('rig', 'plank') : 0);
    if (pl > 0) prop('planks' + pl, () => K.plankStack(pl), 88, 4, 40);
    const gum = stage === 1 ? B.given('patch', 'resin') : 0;
    if (gum > 0) prop('gum' + gum, () => K.gumLeaf(gum), 108, 10, 16);
    const fx = stage === 1 ? B.given('patch', 'flaxleaf') : stage === 2 ? B.given('ama', 'flaxleaf') : stage === 4 && !B.sailWeaving() ? B.given('sail', 'flaxleaf') : 0;
    if (fx > 0) prop('flax' + fx, () => K.flaxBundle(fx), 70, 14, 26);
    // the ama log waiting by the hull, the outboard on its sawhorse, the sail on the weaving pegs
    if (stage === 2 && bs.found['log']) {
      const e = this.frame('amalog', K.amaLog);
      r.draw(e.f, YARD.x - (K.KL / 2 + 6) * k, y + 12, k, k);
    }
    if (stage === 3 && bs.found['outboard']) prop('sawhorse', K.sawhorseMotor, 86, -2, 26);
    if (stage === 4 && B.sailWeaving() && !B.sailReady()) prop('weave', () => K.weaveMat(clamp((bs.playT - bs.sailT) / B.CURE_FALLBACK, 0.15, 0.9)), 96, 18, 44);
  }

  private drawBoat(r: Renderer, stage: number, k: number, y: number) {
    const e = this.frame('camp' + stage, () => K.kittenCamp(stage));
    // keel-on-chocks bottom (boat-local ~39) sits on the sand line; the launch slides her back down
    // the beach into the shallows (smaller, higher, behind the walk line) and she floats
    const sl = this.slide;
    const d = YARD.d - sl * 66;
    const kk = 1 + d / 260;
    const float = smoothstep(0.45, 0.8, sl);
    const bob = float * (Math.sin(this.bob * 1.6) * 1.2);
    const yy = groundY(YARD.x) + d - (39 - float * 8) * kk + bob;
    const xx = YARD.x - (K.KL / 2) * kk;
    if (sl < 0.5) { r.beginShadows(); r.draw(A.shadow, YARD.x, y + 1, 4.6 * k, 0.7 * k, 0, packColor(0, 0, 0, 0.3)); r.endShadows(); }
    r.draw(e.f, xx, yy, kk, kk, Math.sin(this.bob * 1.1) * 0.012 * float);
    // fresh gum glistens while it cures
    if (stage === 2 && !B.hullCured() && this.sparkT <= 0 && sl === 0) {
      this.sparkT = rand.range(0.3, 0.9);
      const gx = xx + rand.range(36, 92) * kk, gy = yy + rand.range(16, 26) * kk;
      this.s.main.glowParticles.spawn({ frame: A.spark, x: gx, y: gy, vx: 0, vy: 0, life: 0.6, color: [1, 0.85, 0.4], alpha: 1, alpha1: 0, size: 0.5, size1: 0.1, glow: true, intensity: 1.6 });
    }
  }
  /** behind the walk line once she is afloat (the launch / trip start draws her in the shallows) */
  private drawGum(r: Renderer) {
    const x0 = r.visibleX0(40), x1 = r.visibleX1(40);
    for (const g of GUM) {
      if (g.x < x0 || g.x > x1) continue;
      const e = this.frame('kauri', kauriBase);
      r.draw(e.f, g.x, groundY(g.x) + 2);
      if (this.spotFree(g.id) && questStatus('v10kitten') !== 'hidden') {
        const t = this.s.st.time;
        if (Math.sin(t * 1.4 + g.x) > 0.9) r.fxDraw(A.spark, g.x + 3, groundY(g.x) - 16, 0.7, 0.7, t, packColor(1, 0.85, 0.4, 1), 1.2);
      }
    }
  }
  private drawFinds(r: Renderer) {
    const s = this.s;
    const x0 = r.visibleX0(60), x1 = r.visibleX1(60);
    if (!B.found('log') && LOG.x > x0 && LOG.x < x1) {
      const e = this.frame('amalog', K.amaLog);
      r.beginShadows(); r.draw(A.shadow, LOG.x, groundY(LOG.x) + 2, 3, 0.4, 0, packColor(0, 0, 0, 0.3)); r.endShadows();
      r.draw(e.f, LOG.x - (K.AMA.x0 + K.AMA.x1) / 2, groundY(LOG.x) - 1);
    }
    if (s.inside > 0.4) {
      if (!B.found('outboard')) { const e = this.frame('tarp', tarpLump); r.draw(e.f, OUTBOARD.x, WRECK.floor - 10, 1, 1, 0, packColor(1, 1, 1, s.inside)); }
      if (!B.found('fuel')) { const e = this.frame('can', jerryCan); r.draw(e.f, FUEL.x, WRECK.floor, 1, 1, 0, packColor(1, 1, 1, s.inside)); }
    }
  }

  // ---------------------------------------------------------------- the boat's prompt and action
  boatLabel(): string {
    const st = B.boatStage(), bs = B.boatSave();
    const prog = (j: B.JobId) => `<span style="opacity:0.8">(${B.jobProgress(j)})</span>`;
    if (st === 1) return B.jobMaterialsDone('patch') ? 'Patch the hull with Aroha' : `Hand over materials for the patch ${prog('patch')}`;
    if (st === 2) {
      if (!B.hullCured()) return 'The Kitten <span style="opacity:0.8">(the gum is curing)</span>';
      if (!bs.found['log']) return 'The Kitten <span style="opacity:0.8">(needs a log for the ama)</span>';
      return B.jobMaterialsDone('ama') ? 'Lash on the outrigger with Aroha' : `Hand over materials for the outrigger ${prog('ama')}`;
    }
    if (st === 3) return bs.motorFixed ? 'Mount the outboard' : 'The Kitten <span style="opacity:0.8">(needs her outboard)</span>';
    if (st === 4) {
      if (!B.sailWeaving()) return `Give Aroha harakeke for the sail ${prog('sail')}`;
      if (!B.sailReady()) return 'The Kitten <span style="opacity:0.8">(Aroha is weaving the sail)</span>';
      return B.jobMaterialsDone('rig') ? 'Rig the Kitten' : `Hand over a mast and oars ${prog('rig')}`;
    }
    if (st === 5) return 'Launch the Kitten!';
    return 'Take the Kitten out';
  }
  private boatQuest() {
    const st = B.boatStage();
    if (st === 1) return B.jobMaterialsDone('patch') || this.carriesFor('patch');
    if (st === 2) return B.hullCured() && B.found('log') && (B.jobMaterialsDone('ama') || this.carriesFor('ama'));
    if (st === 3) return B.boatSave().motorFixed;
    if (st === 4) return !B.sailWeaving() ? this.carriesFor('sail') || B.jobMaterialsDone('sail') : B.sailReady() && (B.jobMaterialsDone('rig') || this.carriesFor('rig'));
    return st === 5;
  }
  private carriesFor(job: B.JobId) {
    return B.BOAT_JOBS[job].needs.some(([id, n]) => B.given(job, id) < n && countOf(id) > 0);
  }
  private wantMat(item: string) {
    const st = B.boatStage();
    const job: B.JobId | null = st <= 1 ? 'patch' : st === 2 ? 'ama' : st === 4 ? (B.sailWeaving() ? 'rig' : 'sail') : null;
    if (!job) return false;
    const need = B.BOAT_JOBS[job].needs.find(n => n[0] === item)?.[1] ?? 0;
    return need > 0 && B.haveFor(job, item) < need;
  }
  private wantPlanks() { return this.wantMat('plank'); }

  async boatAction() {
    const st = B.boatStage(), bs = B.boatSave();
    if (st === 1) return this.job('patch', () => this.patchScene());
    if (st === 2) {
      if (!B.hullCured()) return this.look([{ who: 'aroha', text: 'Not yet. The kāpia is still soft. By tomorrow it will be hard as bone.', expr: 'serious' }]);
      if (!bs.found['log']) return this.look([{ who: 'aroha', text: 'She needs an ama, a float. There is a straight tōtara log in the hidden cove, past the sea cave. I saw it this morning.', expr: 'neutral' }]);
      return this.job('ama', () => this.amaScene());
    }
    if (st === 3) {
      if (bs.motorFixed) return this.mountScene();
      if (!bs.found['outboard']) return this.look([{ who: 'jenna', text: 'The outboard’s in the engine room. On my bench. Under a tarp. Where Dad made me put it. Go get it!', expr: 'excited' }]);
      if (!bs.found['fuel']) return this.look([{ who: 'jenna', text: 'No fuel, no putt-putt. There’s a red jerry can in the engine room locker. Two-stroke mix.', expr: 'thinking' }]);
      return this.fixMotor();
    }
    if (st === 4) {
      if (!B.sailWeaving()) return this.job('sail', () => this.weaveScene());
      if (!B.sailReady()) return this.look([{ who: 'aroha', text: 'Weaving takes as long as it takes. Over, under, over. Go and look at your animals; I’ll be here.', expr: 'happy' }]);
      return this.job('rig', () => this.rigScene());
    }
    if (st === 5) return this.launchScene();
    const { openBoatTrips } = await import('../sites10/ocean');
    return openBoatTrips(this);
  }

  /** hand in what Mori carries toward a job; run its scene when everything is there */
  private async job(j: B.JobId, scene: () => Promise<void>) {
    const s = this.s;
    const got = B.handIn(j);
    if (got.length) {
      audio.play('collectPop', { vol: 0.5 });
      const [cx, cy] = s.css(YARD.x, groundY(YARD.x) - 20);
      got.forEach(([id, n], i) => setTimeout(() => game.ui.toast(`Handed over ${n} <img src="${itemIconURL(id, 2)}" style="width:1.4em;height:1.4em;vertical-align:-0.35em;image-rendering:pixelated"> <b>${ITEMS[id]?.name ?? id}</b>`, 'BOAT', 'teal', 2200), i * 160));
      void cx; void cy;
      s.hud?.refresh(true);
    }
    if (B.jobMaterialsDone(j)) { await scene(); return; }
    const miss = B.jobMissing(j);
    if (!got.length) audio.play('wrong', { vol: 0.35 });
    const who = j === 'patch' || j === 'ama' || j === 'sail' ? 'aroha' : 'joshu';
    s.bark(who, got.length ? `Good. Still need ${miss}.` : `We still need ${miss}.`, { expr: 'neutral' });
  }
  private async look(lines: Parameters<IsleStory['say']>[0]) { await this.st.say(lines); }

  // ---------------------------------------------------------------- salvage spots
  private spotFree(id: string) { const d = B.boatSave().salvage[id]; return d === undefined || dayNumber() > d; }
  private async take(id: string, item: string, n: number, x: number, y: number, anim: string, tool?: string) {
    const s = this.s, p = s.player;
    if (tool && !game.save.tools.includes(tool)) { audio.play('wrong', { vol: 0.45 }); s.bark('mori', 'I need a knife to cut that cleanly.', { expr: 'thinking', emote: 'question' }); return; }
    if (!fits(item, n)) { audio.play('wrong', { vol: 0.45 }); s.bark('mori', 'My backpack’s full. Time to sort it out (Tab).', { expr: 'worried', emote: 'sweat' }); return; }
    p.facing = x >= p.x ? 1 : -1;
    let sfxT = 0;
    const ok = await p.doWork(anim, item === 'plank' ? 1.6 : 1.2, () => {
      sfxT -= 1 / 60;
      if (sfxT <= 0) { sfxT = 0.45; audio.play(item === 'plank' ? 'woodCreak' : 'pluck', { vol: 0.4, pitch: 0.9 + rand.next() * 0.25 }); }
    });
    if (!ok) return;
    const got = add(item, n);
    if (got <= 0) return;
    B.boatSave().salvage[id] = Math.max(1, dayNumber());
    game.persist();
    spend(item === 'plank' ? 3 : 2, 'salvage');
    const [cx, cy] = s.css(x, y);
    s.hud?.flyItem(item, got, ITEMS[item]?.name ?? item, cx, cy);
    game.ui.toast(`+${got} <img src="${itemIconURL(item, 2)}" style="width:1.5em;height:1.5em;vertical-align:-0.35em;image-rendering:pixelated"> <b>${ITEMS[item]?.name ?? item}</b>`, 'FOUND', 'teal', 1800);
    audio.play('collectPop', { vol: 0.55 });
    p.body.react('bounce');
    const lines: Record<string, string> = {
      galley: 'The galley cupboards. Sorry, cupboards. You’re a boat now.',
      bow: 'Good seasoned planking. The Kittiwake’s still looking after us.',
      sand: 'A plank, washed up and dried out. Perfect.',
      gum1: 'Kauri gum, gold as honey. It smells like pine and lemons.',
      gum2: 'Another lump of kāpia. Aroha says it burns like a candle, too.',
      flax: 'Long harakeke leaves, from the outside of the bush. Never the heart.',
    };
    if (lines[id] && !B.boatSave().seen['said:' + id]) { B.boatSave().seen['said:' + id] = true; setTimeout(() => s.bark('mori', lines[id], { expr: 'happy' }), 400); }
    s.hud?.refresh(true);
  }

  private crewNudge() {
    const s = this.s, st = B.boatStage();
    const has = (j: B.JobId) => this.carriesFor(j);
    if (st === 1 && has('patch')) s.bark('aroha', 'Bring what you found to the Kitten. We start the patch when it is all there.', { expr: 'happy' });
    else if (st === 2 && B.hullCured() && !B.boatSave().seen['curedBark']) { B.boatSave().seen['curedBark'] = true; s.bark('aroha', 'Feel that. The kāpia set hard overnight. Now she needs an ama.', { expr: 'happy' }); }
    else if (st === 4 && B.sailReady() && !B.boatSave().seen['sailBark']) { B.boatSave().seen['sailBark'] = true; s.bark('aroha', 'Kua oti! The sail is finished. Come and see.', { expr: 'excited' }); }
  }

  // ---------------------------------------------------------------- cast helpers
  private borrow(ids: ('jenna' | 'joshu' | 'aroha')[]) {
    const s = this.s;
    const saved = ids.map(id => { const a = s.actor(id) as Actor; return { a, x: a.x, y: a.y, f: a.facing, v: a.visible, al: a.alpha, idle: a.idleAnim, walk: a.walkAnim }; });
    return () => {
      for (const o of saved) {
        o.a.stopWalk();
        o.a.x = o.x; o.a.y = o.y; o.a.facing = o.f; o.a.visible = o.v; o.a.alpha = o.al;
        o.a.idleAnim = o.idle; o.a.walkAnim = o.walk; o.a.setAnim(o.idle);
      }
    };
  }
  /** a cutscene that always hands the camera and the HUD back afterwards */
  private async cut(fn: () => Promise<void>) {
    const s = this.s;
    try { await this.st.cut(fn); } finally {
      const c = s.st.cam;
      c.locked = false;
      c.tzoom = s.zoomBase;
      s.hud?.show(true);
      s.player.poseOverride = null;
      s.hud?.refresh(true);
    }
  }
  private stand(a: Actor, x: number, f: number, anim = 'idle') { this.st.place(a, x, f, anim); }
  private async walkIn(a: Actor, from: number, to: number, f: number, anim = 'idle') {
    a.visible = true; a.alpha = 1;
    if (Math.abs(a.x - to) > 260 || !a.visible) { a.x = from; a.y = groundY(from); }
    await this.st.walkA(a, to, 70, 'walk', 2600);
    a.y = groundY(to); a.facing = f; a.idleAnim = anim; a.setAnim(anim);
  }
  private async fade(mid: () => void | Promise<void>, ms = 500) {
    await this.st.fadeOut(1.6);
    await mid();
    await wait(ms);
    await this.st.fadeIn(1.2);
  }
  private chunkGag(x: number) {
    const s = this.s, c = s.chunk;
    s.buddy.mode = 'script';
    c.visible = true;
    if (Math.abs(c.x - x) > 300) { c.x = x - 120; c.y = groundY(c.x); }
    return c.walkTo(x, 70);
  }
  private chunkFree() { this.st.chunkFollow(); }

  // ---------------------------------------------------------------- the repair talk (quest start)
  private async intro() {
    const bs = B.boatSave();
    if (bs.seen['intro']) return;
    bs.seen['intro'] = true;
    const s = this.s, st = this.st, p = s.player;
    await this.cut(async () => {
      const back = this.borrow(['joshu', 'jenna', 'aroha']);
      const x = p.x;
      this.stand(s.joshu, x + 34, -1);
      s.joshu.walkAnim = 'limp';
      this.stand(s.jenna, x + 62, -1);
      this.stand(s.aroha, x - 40, 1, 'armsCrossed');
      p.facing = 1;
      await st.say([
        { who: 'joshu', text: 'Mori, lad. A word, while the kettle boils.', expr: 'serious' },
        { who: 'joshu', text: 'The Kittiwake is finished. Back broken, engine full of sand. She’ll never float again.', expr: 'sad' },
        { who: 'jenna', text: 'Dad...', expr: 'sad' },
        { who: 'joshu', text: 'But the Kitten. Our tender. I watched the wave tear her off the stern crane and throw her clean over the wreck.', expr: 'thinking' },
        { who: 'jenna', text: 'The KITTEN! I named her! I painted the letters! I thought she was at the bottom of the sea!', expr: 'excited', react: 'jump' },
        { who: 'joshu', text: 'Clinker-built, copper-riveted, older than you. A bit of sand won’t finish her. She’s out there on the beach, upside down.', expr: 'happy' },
        { who: 'aroha', text: 'A boat...', expr: 'thinking' },
        { who: 'aroha', text: 'On clear mornings you can see Motu Ahi from the point, smoking out past the reef. My nan said the birds there are so many they darken the sky.', expr: 'serious' },
        { who: 'mori', text: 'Other islands. Other ANIMALS. Joshu, where do we start?', expr: 'excited', emote: 'sparkle' },
        { who: 'joshu', text: 'Find her first. Past the wreck, on the far side of the torn bow, I reckon.', expr: 'neutral' },
      ]);
      back();
    });
    startQuest('v10kitten');
  }

  // ---------------------------------------------------------------- stage 0 -> 1: dig her out
  private async digOut() {
    const s = this.s, st = this.st, p = s.player;
    B.setFound('tender');
    await this.cut(async () => {
      p.facing = 1;
      st.pose('dig');
      for (let i = 0; i < 3; i++) { audio.play('dig', { vol: 0.5, pitch: 0.9 + i * 0.1 }); await wait(420); }
      void this.chunkGag(BURIED.x + 26).then(() => { s.chunk.facing = -1; s.chunk.setAnim('dig'); });
      await st.say([
        { who: 'mori', text: 'Sand, sand, more sand... there’s a whole boat under here and I am digging it out with my HANDS.', expr: 'determined' },
        { who: 'chunk', text: '*digs furiously beside you, flinging sand everywhere, mostly at you*', expr: 'excited', close: false },
        { who: 'mori', text: 'Thank you, Chunk. Very helpful. Very... sandy.', expr: 'grumpy' },
      ]);
      st.pose(null);
      const back = this.borrow(['joshu', 'aroha', 'jenna']);
      await this.fade(async () => {
        // everyone heaves her over and drags her up the beach on driftwood rollers
        B.setBoatStage(1);
        p.x = YARD.x - 30; p.y = groundY(p.x); p.facing = 1;
        this.stand(s.joshu, YARD.x + 40, -1, 'injured');
        this.stand(s.aroha, YARD.x + 66, -1);
        this.stand(s.jenna, YARD.x - 62, 1);
        s.chunk.x = YARD.x + 20; s.chunk.y = groundY(s.chunk.x); s.chunk.setAnim('lie');
        s.snapCamera();
        audio.play('woodCreak', { vol: 0.6, pitch: 0.7 });
      }, 700);
      await st.say([
        { who: 'jenna', text: '*panting* That... was... the heaviest... cute thing... I have ever dragged.', expr: 'tired' },
        { who: 'joshu', text: 'Let’s have a look at you, old girl.', expr: 'neutral' },
        { who: 'joshu', text: 'Two holes and a stove-in strake. Keel’s sound. Transom’s sound. Nothing that can’t be mended.', expr: 'happy' },
        { who: 'aroha', text: 'My people patch waka like this. New wood where the old is broken, stitched in with harakeke, the seams sealed with kāpia, kauri gum.', expr: 'serious' },
        { who: 'joshu', text: 'Planks we can pull off the wreck. Gum and flax?', expr: 'thinking' },
        { who: 'aroha', text: 'The old kauri up the bush track bleed gum. Harakeke grows thick by the stream. Bring me four planks, two lumps of gum and three good leaves.', expr: 'neutral' },
        { who: 'jenna', text: 'And I’ll find out where the outboard went. I have... a theory. A theory that involves Dad being paranoid about cranes.', expr: 'teasing' },
        { who: 'joshu', text: 'I am not paranoid. I am CAREFUL.', expr: 'grumpy' },
      ]);
      back();
      this.chunkFree();
    });
    spend(6, 'boat');
  }

  // ---------------------------------------------------------------- stage 1 -> 2: the patch
  private async patchScene() {
    const s = this.s, st = this.st, p = s.player;
    await this.cut(async () => {
      const back = this.borrow(['aroha', 'joshu']);
      p.x = YARD.x - 20; p.y = groundY(p.x); p.facing = 1;
      await this.walkIn(s.aroha, YARD.x + 140, YARD.x + 22, -1);
      this.stand(s.joshu, YARD.x - 54, 1, 'injured');
      await st.say([
        { who: 'aroha', text: 'Hold the plank to the hole. I make the holes for the stitches with the knife, you pull the harakeke through. Tight.', expr: 'serious' },
      ]);
      st.pose('hammer');
      s.aroha.setAnim('build');
      for (let i = 0; i < 4; i++) { audio.play('hammer', { vol: 0.45, pitch: 0.9 + rand.next() * 0.2 }); await wait(360); }
      await this.fade(async () => {
        B.setBoatStage(2);
        B.startCure();
        st.pose('kneel');
        s.joshu.setAnim('kneel');
        audio.play('rope', { vol: 0.5 });
      }, 900);
      st.pose(null);
      s.aroha.setAnim('idle');
      s.joshu.setAnim('injured');
      await st.say([
        { who: 'mori', text: 'Planks in, stitches tight, gum in every seam. She looks like a quilt. A beautiful, waterproof quilt.', expr: 'happy' },
        { who: 'joshu', text: 'Neat work, the both of you. Neater than the yard that built her.', expr: 'happy' },
        { who: 'aroha', text: 'The kāpia has to set. One night. Nobody touch it.', expr: 'serious' },
      ]);
      // Chunk touches it
      await this.chunkGag(YARD.x + 8);
      s.chunk.facing = -1;
      s.chunk.setAnim('sniff');
      await wait(900);
      s.chunk.setAnim('stuck');
      audio.play('emoteSurprise', { vol: 0.5 });
      await st.say([
        { who: 'chunk', text: '*sniff sniff* ...*mmf* ...*MMMF*', expr: 'shocked', close: false },
        { who: 'mori', text: 'Chunk. Chunk, no. Is your nose... stuck to the boat?', expr: 'shocked' },
        { who: 'aroha', text: '...Nobody touch it, I said. Hold still, dog. Ka pai. There.', expr: 'laugh' },
        { who: 'chunk', text: '*sneezes, very offended, and trots off with a little gold dot on his nose*', expr: 'grumpy', close: false },
      ]);
      back();
      this.chunkFree();
    });
    spend(10, 'boat');
  }

  // ---------------------------------------------------------------- the ama log
  private async fetchLog() {
    const s = this.s, st = this.st, p = s.player;
    await this.cut(async () => {
      p.facing = 1;
      st.pose('kneel');
      await wait(600);
      st.pose(null);
      await st.say([
        { who: 'mori', text: 'Long, straight, light for its size. Tōtara, Aroha said. The sea has already stripped the bark for us.', expr: 'thinking' },
        { who: 'mori', text: 'And there is no way I am carrying this home on my own. ...Jenna? Come in, Jenna.', expr: 'worried' },
        st.radio('Jenna here! Is it a crab? Is it a GIANT crab?', 'excited'),
        { who: 'mori', text: 'It’s a log.', expr: 'neutral' },
        st.radio('...oh. Coming. Bringing Dad and rope. Over.', 'grumpy'),
      ]);
      await this.fade(() => {
        B.setFound('log');
        audio.play('splash', { vol: 0.4 });
      }, 900);
      await st.say([{ who: 'mori', text: 'We floated it home through the shallows on a rope. Chunk rode on it the whole way like a tiny, smug captain.', expr: 'happy' }]);
    });
    spend(12, 'log');
  }

  // ---------------------------------------------------------------- stage 2 -> 3: the outrigger
  private async amaScene() {
    const s = this.s, st = this.st, p = s.player;
    await this.cut(async () => {
      const back = this.borrow(['aroha', 'joshu']);
      p.x = YARD.x - 16; p.y = groundY(p.x); p.facing = 1;
      await this.walkIn(s.aroha, YARD.x + 140, YARD.x + 24, -1);
      this.stand(s.joshu, YARD.x - 56, 1, 'injured');
      await st.say([
        { who: 'aroha', text: 'The ama rides alongside, so she cannot roll. Two iako, the booms, across the gunwales. And every join lashed.', expr: 'serious' },
        { who: 'aroha', text: 'You remember the knot from the drying rack? Over, under, around, pull tight. Again, but this time the sea is watching.', expr: 'teasing' },
      ]);
      st.pose('build');
      const { lashingKnot } = await import('../v4/islearoha');
      const ok = await lashingKnot();
      st.pose(null);
      await this.fade(() => { B.setBoatStage(3); audio.play('rope', { vol: 0.5 }); }, 700);
      await st.say([
        { who: 'aroha', text: ok ? 'Tika. That one will outlive us both.' : 'Ugly. But it will hold. I added three more, behind your back.', expr: ok ? 'happy' : 'teasing' },
        { who: 'joshu', text: 'A tender with an outrigger. Forty years at sea and I’ve never seen the like. She looks... right, somehow.', expr: 'thinking' },
        { who: 'aroha', text: 'Half your boat, half mine. Like this camp.', expr: 'happy' },
        { who: 'jenna', text: '<i>(from the wreck)</i> FOUND IT! Mori, the outboard! It’s on my bench! I can SEE it through the hole! I just can’t... reach... it...', expr: 'excited' },
      ]);
      back();
    });
    spend(10, 'boat');
  }

  // ---------------------------------------------------------------- the outboard and the fuel
  private async findOutboard() {
    const s = this.s, st = this.st;
    await this.cut(async () => {
      st.pose('grab');
      audio.play('rustle', { vol: 0.5 });
      await wait(700);
      st.pose(null);
      B.setFound('outboard');
      await st.say([
        { who: 'mori', text: 'Under the tarp: a little outboard motor. Clamped to the bench, wrapped in an oilskin, dry as a biscuit.', expr: 'surprised' },
        st.radio('THE OUTBOARD! Don’t drop it! It’s older than me! It’s older than DAD!', 'excited'),
        st.radio('...okay it’s not older than Dad. Nothing is older than Dad. Over.', 'teasing'),
      ]);
      await this.fade(() => { audio.play('woodCreak', { vol: 0.5 }); }, 600);
      await st.say([{ who: 'mori', text: 'We lowered it out through the hole on a rope. It’s on a sawhorse at the boatyard now, and Jenna is already talking to it.', expr: 'happy' }]);
    });
    spend(6, 'outboard');
    void s;
  }
  private async findFuel() {
    const s = this.s, st = this.st;
    st.pose('kneel');
    audio.play('jarClink', { vol: 0.5 });
    await wait(700);
    st.pose(null);
    B.setFound('fuel');
    game.ui.toast('Found: <b>a jerry can of two-stroke fuel</b> (it goes straight to the boatyard)', 'BOAT', 'teal', 3000);
    await st.say([{ who: 'mori', text: 'A red jerry can, still sealed. Two-stroke mix, it says, in Jenna’s handwriting. With a skull. And a heart.', expr: 'happy' }]);
    s.hud?.refresh(true);
  }

  // ---------------------------------------------------------------- the outboard close-up (Jenna)
  async fixMotor() {
    const s = this.s, st = this.st, p = s.player;
    await this.cut(async () => {
      const back = this.borrow(['jenna']);
      p.x = YARD.x + 66; p.y = groundY(p.x); p.facing = 1;
      await this.walkIn(s.jenna, YARD.x + 170, YARD.x + 104, -1, 'wrench');
      await st.say([
        { who: 'jenna', text: 'Okay, patient. You’ve been underwater, you’ve been in a shipwreck, you’ve been in the dark for days. Nurse Jenna is here.', expr: 'serious' },
        { who: 'jenna', text: 'Mori, you’re my hands. I talk, you do. GO.', expr: 'determined' },
      ]);
      const { runOutboardRepair } = await import('./boatfix');
      await runOutboardRepair();
      B.boatSave().motorFixed = true;
      game.persist();
      s.jenna.setAnim('celebrate');
      await st.say([
        { who: 'jenna', text: 'PUTT-PUTT-PUTT! She LIVES! Listen to her! That’s the sound of FREEDOM!', expr: 'excited', style: 'shout' },
        { who: 'mori', text: 'It sounds like a lawnmower having a nice day.', expr: 'happy' },
        { who: 'jenna', text: 'A lawnmower of FREEDOM. Now bolt her on the transom.', expr: 'smug' },
      ]);
      s.jenna.setAnim('idle');
      back();
    });
    spend(8, 'outboard');
  }
  private async mountScene() {
    const s = this.s, st = this.st, p = s.player;
    await this.cut(async () => {
      const back = this.borrow(['jenna']);
      p.x = YARD.x - 60; p.y = groundY(p.x); p.facing = 1;
      this.stand(s.jenna, YARD.x - 90, 1, 'wrench');
      st.pose('grab');
      await this.fade(() => { B.setBoatStage(4); audio.play('hammer', { vol: 0.4, pitch: 1.3 }); }, 600);
      st.pose(null);
      await st.say([
        { who: 'jenna', text: 'Clamps tight, tiller on, fuel line in. Tilted up for the beach. Look at her. LOOK at her.', expr: 'excited' },
        { who: 'aroha', text: 'Motors run out of fuel. Wind does not. She still needs a sail.', expr: 'teasing' },
        { who: 'aroha', text: 'Bring me six long harakeke leaves and I will weave her one, the way my nan wove them.', expr: 'happy' },
      ]);
      back();
    });
  }

  // ---------------------------------------------------------------- stage 4: the sail, rigging
  private async weaveScene() {
    const s = this.s, st = this.st, p = s.player;
    await this.cut(async () => {
      const back = this.borrow(['aroha']);
      p.x = YARD.x + 60; p.y = groundY(p.x); p.facing = 1;
      this.stand(s.aroha, YARD.x + 96, -1, 'kneel');
      await st.say([
        { who: 'aroha', text: 'Six good leaves. Ka pai.', expr: 'happy' },
        { who: 'aroha', text: 'A rā, a sail, is woven in strips, like a mat. Then the strips are sewn together. It takes all night. My nan used to sing while she did it.', expr: 'serious' },
        { who: 'mori', text: 'Will you sing?', expr: 'happy' },
        { who: 'aroha', text: '...Maybe. If nobody is listening.', expr: 'teasing' },
      ]);
      B.startWeave();
      back();
    });
  }
  private async rigScene() {
    const s = this.s, st = this.st, p = s.player;
    await this.cut(async () => {
      const back = this.borrow(['aroha', 'joshu', 'jenna']);
      p.x = YARD.x - 20; p.y = groundY(p.x); p.facing = 1;
      this.stand(s.aroha, YARD.x + 30, -1);
      this.stand(s.joshu, YARD.x - 56, 1, 'injured');
      this.stand(s.jenna, YARD.x + 64, -1);
      await st.say([
        { who: 'aroha', text: 'Look. Kua oti, it is finished.', expr: 'happy' },
        { who: 'mori', text: 'It’s like a crab’s claw. Gold, and the weave catches the light. Aroha, it’s beautiful.', expr: 'excited', emote: 'sparkle' },
        { who: 'joshu', text: 'Driftwood mast, two planks shaved down for oars. Give me an hour and a sharp knife.', expr: 'determined' },
      ]);
      await this.fade(() => {
        B.setBoatStage(5);
        st.pose('hammer');
        s.joshu.setAnim('kneel');
        s.jenna.setAnim('wrench');
        audio.play('saw', { vol: 0.4 });
      }, 900);
      st.pose(null);
      s.joshu.setAnim('injured'); s.jenna.setAnim('idle');
      await st.say([
        { who: 'jenna', text: 'Mast stepped, sail bent on, oars aboard. And I touched up her name! And gave her a face! AND a flag!', expr: 'excited' },
        { who: 'jenna', text: 'The flag is a cat. Because she is the KITTEN. Please clap.', expr: 'smug' },
        { who: 'joshu', text: '*claps slowly* ...Tomorrow at first light we put her in the water. Everyone.', expr: 'happy' },
      ]);
      back();
    });
    spend(10, 'boat');
  }

  // ---------------------------------------------------------------- stage 5 -> 6: Launch Day
  private async launchScene() {
    const s = this.s, st = this.st, p = s.player;
    await this.cut(async () => {
      const back = this.borrow(['aroha', 'joshu', 'jenna']);
      s.hud?.show(false);
      game.ui.letterbox(true);
      p.x = YARD.x + 8; p.y = groundY(p.x); p.facing = 1;
      this.stand(s.joshu, YARD.x - 44, 1, 'injured');
      this.stand(s.aroha, YARD.x + 40, -1);
      this.stand(s.jenna, YARD.x - 16, 1, 'cheer');
      s.buddy.mode = 'script';
      st.place(s.chunk, YARD.x + 62, -1, 'sit');
      const cam = s.st.cam;
      cam.locked = true; cam.x = YARD.x; cam.y = groundY(YARD.x) - 30; cam.zoom = 1.45;
      await game.ui.titleCard('Day ' + Math.max(2, dayNumber()), 'Launch Day', 'The Kitten goes back in the water', 2400);
      await st.say([
        { who: 'jenna', text: 'Ahem. AHEM. Ladies, gentlemen, pug.', expr: 'smug', style: 'shout' },
        { who: 'jenna', text: 'She was blown off a crane, thrown over a shipwreck, buried in a beach and sat on by a dog. And she’s still here. Like us.', expr: 'happy' },
        { who: 'joshu', text: 'No bottle to break on her, I’m afraid.', expr: 'thinking' },
        { who: 'aroha', text: 'Then we do it my way.', expr: 'serious' },
        { who: 'aroha', text: '*speaks a few quiet words over the bow, for Tangaroa, who keeps the sea, and for the waka, that she brings us home*', expr: 'serious', close: false },
        { who: 'mori', text: '...', expr: 'happy', close: false, auto: 900 },
        { who: 'jenna', text: 'I name this boat... the KITTEN! AGAIN! On three: push!', expr: 'excited', style: 'shout' },
      ]);
      // everyone pushes her down the beach into the shallows
      st.pose('push'); s.joshu.setAnim('push'); s.aroha.setAnim('push'); s.jenna.setAnim('push');
      audio.play('woodCreak', { vol: 0.6, pitch: 0.7 });
      void s.chunk.walkTo(YARD.x + 30, 60).then(() => s.chunk.play('jump', 'sit').catch(() => {}));
      for (let i = 0; i <= 60; i++) { this.slide = clamp(i / 60) * 0.85; await wait(30); }
      audio.play('splashBig', { vol: 0.6 });
      s.st.shake(1.5, 0.3);
      B.setBoatStage(6);
      st.pose('cheer'); s.jenna.setAnim('celebrate'); s.aroha.setAnim('cheer'); s.joshu.setAnim('cheer');
      await st.say([
        { who: 'mori', text: 'She floats! SHE FLOATS!', expr: 'excited', style: 'shout', react: 'jump' },
        { who: 'joshu', text: 'Course she floats. She’s the Kitten.', expr: 'happy' },
        { who: 'chunk', text: '*has already jumped in and is standing proudly in the bow*', expr: 'happy', close: false },
        { who: 'aroha', text: 'Motu Ahi, the reef, the fishing grounds, the far coast. The sea is a road now.', expr: 'happy' },
      ]);
      await this.fade(() => {
        this.slide = 0;
        st.pose(null);
        game.ui.letterbox(false);
        back();
        this.chunkFree();
      }, 500);
    });
    game.ui.toast('Boat travel unlocked: take the <b>Kitten</b> out from the boatyard, or pick a place across the water on the Region Map.', 'BOAT', 'teal', 6000);
  }

  // ---------------------------------------------------------------- trips: leaving and coming home
  /** the Kitten slides down the beach and away (the trip scene takes over after the fade) */
  async launchOut() {
    const s = this.s;
    s.cutscene = true;
    audio.play('woodCreak', { vol: 0.5, pitch: 0.8 });
    for (let i = 0; i <= 40; i++) { this.slide = clamp(i / 40) * 0.9; await wait(25); }
    audio.play('splash', { vol: 0.5 });
    B.setBoatAway(true);
  }
  /** the Kitten noses up onto the sand at the boatyard (for the camp module's arrival cutscene) */
  async landing() {
    B.setBoatAway(false);
    this.slide = 0.9;
    audio.play('splash', { vol: 0.5 });
    for (let i = 40; i >= 0; i--) { this.slide = clamp(i / 40) * 0.9; await wait(30); }
    audio.play('woodCreak', { vol: 0.5, pitch: 0.7 });
    this.slide = 0;
  }
}

const countOf = (id: string) => game.save.inv.filter(st => st.id === id).reduce((a, st) => a + st.n, 0);
const smoothstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ small sprites
function outlined(b: PixelBuffer) { b.outline(c => mix(shade(c, -0.7), hex('#15100c'), 0.6)); return b; }
/** the foot of an old kauri, weeping gold gum */
function kauriBase(): K.Spr {
  const b = new PixelBuffer(30, 44);
  const bark = [hex('#4a4a46'), hex('#62625c'), hex('#7a7a72'), hex('#929288'), hex('#a8a89c')];
  for (let y = 0; y < 44; y++) for (let x = 0; x < 30; x++) {
    const w = 9 + (y > 30 ? (y - 30) * 0.9 : 0);
    const dx = Math.abs(x - 15);
    if (dx > w) continue;
    let i = Math.round(3 - (dx / w) * 2 + ((x * 3 + y) % 9 === 0 ? -1 : 0) + (x < 15 ? 0.6 : -0.4));
    if ((y + Math.floor(x / 3)) % 7 === 0) i -= 1; // hammered bark scales
    b.set(x, y, bark[Math.max(0, Math.min(4, i))]);
  }
  // gum: drips and a big lump at the wound
  for (const [gx, gy, r] of [[19, 22, 3], [12, 30, 2], [20, 34, 1.6]] as const) b.ellipseFn(gx, gy, r, r * 1.3, (x, y, nx, ny) => (nx < -0.2 && ny < -0.3 ? hex('#ffe08a') : ny > 0.4 ? hex('#b06a14') : hex('#e09a2a')));
  for (let y = 25; y < 31; y++) b.set(19, y, hex('#d08a22'));
  return { buf: outlined(b), ax: 15, ay: 43 };
}
function tarpLump(): K.Spr {
  const b = new PixelBuffer(20, 14);
  b.ellipseFn(10, 9, 9, 5.5, (x, y, nx, ny) => (ny < -0.3 ? hex('#5a8a6a') : nx > 0.4 ? hex('#2e5a40') : hex('#4a7a5a')));
  for (let x = 2; x < 18; x++) b.set(x, 13, hex('#2a3a30'));
  b.set(4, 6, hex('#e8e8e8')); b.set(5, 6, hex('#e8782e'));
  return { buf: outlined(b), ax: 10, ay: 13 };
}
function jerryCan(): K.Spr {
  const b = new PixelBuffer(10, 13);
  for (let y = 3; y < 13; y++) for (let x = 1; x < 9; x++) b.set(x, y, x === 1 ? hex('#e05a3a') : x === 8 ? hex('#8a2a1a') : (x + y) % 5 === 0 ? hex('#c8402a') : hex('#b8362a'));
  for (let x = 3; x < 7; x++) b.set(x, 2, hex('#6a6a6a'));
  b.set(2, 1, hex('#8a8a8a')); b.set(2, 2, hex('#8a8a8a'));
  for (let x = 3; x < 7; x++) b.set(x, 7, hex('#e8d8c8'));
  return { buf: outlined(b), ax: 5, ay: 12 };
}

/** attach the boatyard to the island story (called from IsleStory.enter) */
export function attachBoatyard(st: IsleStory): Boatyard {
  const y = new Boatyard(st);
  y.setup();
  current = y;
  hookArrive();
  return y;
}
// the camp day loop's arrival cutscene: home by boat, the Kitten slides up the beach (day.ts onArrive,
// looked up loosely so this file also builds against the day module's contract stub)
let arriveHooked = false;
function hookArrive() {
  if (arriveHooked) return;
  arriveHooked = true;
  const on = (Day as unknown as { onArrive?: (fn: (how: string) => void | Promise<void>) => void }).onArrive;
  on?.(how => (how === 'boat' ? playBoatLanding() : undefined));
}
/** hooks for the camp module's arrival / departure cutscenes */
export const playBoatLanding = () => current?.landing() ?? Promise.resolve();
export const playBoatLaunchOut = () => current?.launchOut() ?? Promise.resolve();

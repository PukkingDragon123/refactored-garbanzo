// V10 landings: the shared bones of the places the Kitten can be run up a beach (Motu Ahi, the far
// coast). A FieldScene with the island's continuous light (the time of day the Kitten left camp,
// creeping on toward evening), sky, clouds and the sea bands behind the walk line, ground painted in
// chunks with a wet twin that mirrors the cast, a landing cove of open water at the west end (the
// auks and dippers dive in it), the Kitten on the sand with Joshu minding her, Aroha walking with
// you and Chunk off his lead. Harvest spots refill once a day; photos of new species, landmarks and
// how far you walked go to the Region Map (discover / revealMap).
//
// Subclasses supply the geometry and art (cfg) and the dressing (dress()).

import type { Env, Frame, Renderer } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { bigFrame } from '../../gfx/atlas';
import { game } from '../game';
import { A } from '../assets';
import { FieldScene, FieldSite, SpawnV2 } from '../scenes/field';
import type { Layer } from '../../world/stage';
import type { Actor } from '../../world/actor';
import type { Interactable } from '../../world/npc';
import { Custom } from '../../world/props';
import { layerSpan } from '../../world/scenery';
import { audio, Music } from '../../core/audio';
import { clamp, damp, rand } from '../../core/math';
import type { PixelBuffer } from '../../art/pixel';
import { DayClock, envAt, lightKAt, IsleSky, CloudDeck, SeaStrip, Breakers } from '../v4/islefx';
import { layerY } from '../v4/island';
import { ChunkBuddy } from '../v4/buddy';
import * as K from '../../art/v10/boat10';
import { paintHorizonBufs } from '../../art/v10/horizon10';
import { ITEMS } from '../items';
import { add, fits } from '../inventory';
import { itemIconURL } from '../../art/itemicons';
import { boatSave } from '../v10/boat';
import { dayNumber } from '../v10/day';
import { spend } from '../v10/energy';
import { discover, revealMap } from '../v10/regions';
import type { BubbleLine } from '../../ui/bubbles';
import { SPECIES_BY_ID } from '../species';

export interface GroundChunk { x0: number; y0: number; base: PixelBuffer; wet: PixelBuffer }
export interface LandingCfg {
  /** Region Map location id */
  loc: string;
  name: string;
  /** subtitle on the arrival card */
  sub: string;
  /** what the research pages call the place on a photo */
  label: string;
  W: number;
  /** walk line on the beach (the island's is 210: the sea bands are shifted to match) */
  GY: number;
  BOT: number;
  /** open water in the landing cove, x < seaX, surface at `water` */
  seaX: number;
  water: number;
  ground(x: number): number;
  paint(x0: number, w: number): GroundChunk;
  /** the Kitten's stern sits in the shallows here; she runs up the beach to the east */
  boatX: number;
  spawnX: number;
  spawns: SpawnV2[];
  insects?: FieldSite['insects'];
  place(x: number): string;
  music: Music;
  /** said on the first landing; on later ones a single line */
  first: BubbleLine[];
  again: BubbleLine[];
}

/** a spot to gather from (refills the next day) */
export interface Harvest {
  key: string; x: number; item: string; n: number; label: string;
  anim?: string; tool?: string; line?: string; dur?: number;
  /** drawn while it's there to take */
  art?: Frame | null; artY?: number;
  enabled?: () => boolean;
}

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export abstract class LandingScene extends FieldScene {
  clock = new DayClock();
  aroha!: Actor;
  joshu!: Actor;
  chunk!: Actor;
  buddy!: ChunkBuddy;
  breakers!: Breakers;
  L!: { mid: Layer; near: Layer; back: Layer; front: Layer; far: Layer };
  /** the sea bands were laid out for the island's walk line (210); ours is lower or higher */
  readonly dy: number;
  zoomBase = 1.25;
  private placeKey = '';
  private reach = 0;
  private arohaT = 3;
  private barkT = 25;
  private fr: Record<string, Frame> = {};

  constructor(readonly cfg: LandingCfg, clockT: number) {
    let me: LandingScene | null = null;
    const t = clamp(clockT, 0, 3.3);
    const site: FieldSite = {
      id: cfg.label as never, name: cfg.name, width: cfg.W, camY: cfg.GY - 34, followY: true, minY: -160, maxY: cfg.BOT,
      spawnX: cfg.spawnX, exitX: 0, waterY: cfg.water, ambience: 'beach', music: cfg.music, ground: 'sand',
      noGuide: true, noExit: true, spawns: cfg.spawns, insects: cfg.insects, build: () => me!.buildLanding(),
    };
    super(site, t < 2.6 ? 'day' : t < 3.4 ? 'dusk' : 'night');
    me = this;
    this.dy = cfg.GY - 210;
    this.clock.set(t);
    // the afternoon wears on while you explore (about a key every four minutes)
    this.clock.rate = 0.004;
    this.clock.target = Math.min(3.5, t + 1);
    this.allowPack = true;
  }

  /** the place's own scenery: called with the layers once the sky and the sea are up */
  protected abstract dress(): void;
  /** per-frame extras */
  protected tick(dt: number): void { void dt; }
  /** Aroha's lines about where you are (a few per zone) */
  protected abstract arohaLines(x: number): [string, string][];

  hudOpts() {
    const t = this.clock.t;
    const when = t < 0.7 ? 'Morning' : t < 1.5 ? 'Midday' : t < 2.2 ? 'Afternoon' : t < 2.75 ? 'Golden hour' : t < 3.4 ? 'Dusk' : 'Night';
    return {
      place: this.cfg.place(this.player?.x ?? this.cfg.spawnX), sub: `Day ${game.save.day} · ${when}`,
      keys: '<span class="key">A</span><span class="key">D</span> move · <span class="key">Shift</span> run · <span class="key">E</span> interact · <span class="key">Q</span> camera · <span class="key">Tab</span> pack',
    };
  }

  // ---------------------------------------------------------------- building
  /** layer y for a band that sits at screen y `sy` on the island, moved to our walk line */
  ly(p: number, sy: number) { return layerY(p, sy) + this.dy * p; }

  buildLanding() {
    const st = this.st, r = game.r, c = this.clock, cfg = this.cfg;
    st.minX = 0; st.maxX = cfg.W; st.minY = -160; st.maxY = cfg.BOT;
    st.waterY = cfg.water;
    st.envHook = env => this.env(env);
    st.addScreenLayer('sky', 0.5).add(new IsleSky(c));
    const cf = st.addLayer('clouds-far', 0.015, 0, 0, 0.5, 0.01);
    cf.add(new CloudDeck(c, cf, 41, 8, 6, 86, true, layerSpan(st, 0.015, 260)));
    // home on the horizon: the castaways' island, hazy and far away
    const far = st.addLayer('far', 0.04, 0.3, 0, 0, 0.04);
    const home = paintHorizonBufs('open').home;
    const hf = bigFrame(r, home.buf, home.ax, home.ay);
    const fsp = layerSpan(st, 0.04, 60);
    far.add(new Custom(0, rr => rr.draw(hf, fsp.x0 + 150, this.ly(0.04, 125), 0.6, 0.6, 0, packColor(1, 1, 1, 0.85))));
    const cn = st.addLayer('clouds-near', 0.05, 0.1, 0, 0.5, 0.05);
    cn.add(new CloudDeck(c, cn, 63, 6, 70, 108, false, layerSpan(st, 0.05, 200)));
    const band = (name: 'horizon' | 'far' | 'mid' | 'near', p: number, sy: number, speed: number, fog: number) => {
      const l = st.addLayer('sea-' + name, p, fog, 0.4, 0, p);
      l.add(new SeaStrip(name, this.ly(p, sy), c, speed));
      return l;
    };
    band('horizon', 0.06, 124, 1.2, 0.25);
    band('far', 0.2, 138, 2.4, 0.12);
    const mid = band('mid', 0.42, 158, 4, 0.05);
    const near = band('near', 0.72, 186, 7, 0);
    this.breakers = new Breakers(this.ly(0.72, 192), this.ly(0.72, 214));
    near.add(this.breakers);
    const back = st.addLayer('back', 0.9, 0, 0.8, 0, 0.9);
    const main = st.addLayer('main', 1, 0, 1, 0);
    this.main = main;
    const front = st.addLayer('front', 1.25, 0, 0.6, 0);
    this.L = { mid, near, back, front, far };
    this.addGround();
    this.addCove();
    this.addKitten();
    this.dress();
    const pts: [number, number][] = [];
    for (let x = 0; x <= cfg.W; x += 6) pts.push([x, cfg.ground(x)]);
    st.terrain.addGround(pts, 'ground');
    this.addCrew();
  }

  private addGround() {
    const r = game.r, cfg = this.cfg;
    const CH = 880;
    for (let x0 = 0; x0 < cfg.W; x0 += CH) {
      const w = Math.min(CH, cfg.W - x0);
      const ch = cfg.paint(x0, w);
      const base = bigFrame(r, ch.base), wet = bigFrame(r, ch.wet);
      this.main.add(new Custom(-10, rr => {
        if (x0 + w < rr.visibleX0(4) || x0 > rr.visibleX1(4)) return;
        rr.draw(base, x0, ch.y0);
        rr.water(0.34, 0.7);
        rr.draw(wet, x0, ch.y0);
        rr.water(0);
      }));
    }
  }

  /** the landing cove: open water over the shelving sand at the west end */
  private addCove() {
    const cfg = this.cfg, top = cfg.water, bot = cfg.BOT;
    this.st.terrain.water.push([-60, cfg.seaX, top, bot]);
    this.main.add(new Custom(24, (rr, s) => {
      // the water's edge runs off toward the camera as the sand shelves: a wedge, fading at the edge
      rr.water(0.85, 1.2, 0.8);
      for (let x = Math.max(-60, Math.floor(rr.visibleX0(4) / 4) * 4); x < cfg.seaX; x += 4) {
        const k = clamp((cfg.seaX - x) / 60);
        const h = Math.min(bot - top, 6 + (cfg.seaX - x) * 1.6);
        rr.rect(x, top, 4, h, packColor(0.09, 0.22, 0.27, 0.5 + k * 0.38));
      }
      rr.water(0);
      // the edge of the swash, and glints
      for (let i = 0; i < 6; i++) {
        const gx = -40 + ((i * 41.3 + s.time * 6) % (cfg.seaX + 40)), a = Math.max(0, Math.sin(s.time * 1.6 + i * 2.3));
        rr.fxDraw(A.dot2, gx, top + 1, 1.6, 0.4, 0, packColor(1, 1, 0.95, 1), a * 0.6);
      }
      const lap = Math.sin(s.time * 0.9) * 3;
      rr.rect(cfg.seaX - 14 + lap, top - 1, 16, 1, packColor(0.94, 1, 1, 0.6));
    }));
    this.pois.push({ kind: 'water', x: cfg.seaX / 2, y: top, y1: bot, w: cfg.seaX / 2 });
  }

  /** the Kitten on the sand, stern in the shallows */
  private addKitten() {
    const cfg = this.cfg, r = game.r;
    const k = K.kittenBeached();
    const f = bigFrame(r, k.buf, k.ax, k.ay);
    const x = cfg.boatX, y = cfg.ground(x + K.KPIV[0]) - K.keelY(K.KPIV[0]) + 3;
    this.main.add(new Custom(20, (rr, s) => {
      rr.beginShadows();
      rr.draw(A.shadow, x + K.KL / 2, cfg.ground(x + K.KL / 2) + 1, K.KL / 32, 0.6, 0, packColor(0, 0, 0, 0.3));
      rr.endShadows();
      // a little lift and settle as the wash runs under her stern
      const lift = Math.max(0, Math.sin(s.time * 0.9)) * 0.6;
      rr.draw(f, x, y - lift, 1, 1, -0.015);
    }));
    const it: Interactable = { x: x + 64, y: cfg.ground(x + 64), w: 34, h: 30, label: 'Sail home in the Kitten', standX: x + 92, action: () => this.goHome() };
    this.interact.push(it);
  }

  private addCrew() {
    const cfg = this.cfg, g = cfg.ground;
    const jx = cfg.boatX + K.KL + 18;
    this.joshu = this.addActor('joshu', jx, g(jx), -1);
    this.joshu.z = 44;
    this.joshu.idleAnim = 'sit';
    this.joshu.setAnim('sit');
    const ax = cfg.spawnX - 46;
    this.aroha = this.addActor('aroha', ax, g(ax), 1);
    this.aroha.z = 45;
    const cx = cfg.spawnX + 30;
    this.chunk = this.addActor('chunk', cx, g(cx), 1);
    this.chunk.z = 47;
    const me = this;
    // (the player is made after the site is built: look it up when Chunk needs it)
    this.buddy = new ChunkBuddy(this.chunk, { get player() { return me.player; }, terrain: this.st.terrain, busy: () => this.cutscene });
    this.interact.push({ x: jx, y: g(jx), w: 12, h: 30, label: 'Talk to Joshu', standX: jx + 22, action: () => this.talkJoshu() });
  }

  private async talkJoshu() {
    const lines: [string, string][] = [
      ['I’ll mind the boat. Go on, take your pictures. Shout if anything with teeth turns up.', 'happy'],
      ['Tide’s on the turn. We’ve got the afternoon, then I want to be home before dark.', 'serious'],
      ['She ran up the beach like she’d done it a hundred times. Good little boat.', 'happy'],
      ['If you find anything that floats, bring it. Spare timber’s never wasted on a boat.', 'neutral'],
    ];
    const [text, expr] = rand.pick(lines);
    const ch = await this.say([{ who: 'joshu', text, expr, choices: ['Head home now', 'Keep exploring'] } as BubbleLine]);
    if (ch === 0) await this.goHome(true);
  }

  async goHome(asked = false) {
    if (this.cutscene) return;
    if (!asked) {
      const ch = await this.say([{ who: 'joshu', text: 'Ready to push off?', expr: 'neutral', choices: ['Sail home', 'Not yet'] } as BubbleLine]);
      if (ch !== 0) return;
    }
    this.cutscene = true;
    await this.say([{ who: 'joshu', text: 'Everybody in. Chunk, that means you.', expr: 'happy' } as BubbleLine]);
    audio.play('splash', { vol: 0.5 });
    await game.fadeTo(1, 1.2);
    const { sailHome } = await import('./ocean');
    await sailHome();
  }

  // ---------------------------------------------------------------- harvest spots
  private spotFree(key: string) { const d = boatSave().salvage[key]; return d === undefined || dayNumber() > d; }
  harvest(h: Harvest) {
    const id = this.cfg.loc + ':' + h.key, g = this.cfg.ground;
    const y = g(h.x);
    if (h.art) {
      const fa = h.art;
      this.main.add(new Custom(30, rr => { if (this.spotFree(id)) rr.draw(fa, h.x, (h.artY ?? y) + 1); }));
    }
    this.main.add(new Custom(61, (rr, s) => {
      if (!this.spotFree(id)) return;
      const a = 0.25 + 0.3 * Math.sin(s.time * 3 + h.x);
      rr.fxDraw(A.spark, h.x + Math.sin(s.time) * 2, (h.artY ?? y) - 8, 0.5, 0.5, s.time, packColor(1, 1, 0.85, 1), a);
    }));
    this.interact.push({
      x: h.x, y: h.artY ?? y, w: 14, h: 20, label: h.label, standX: h.x - 14,
      enabled: () => this.spotFree(id) && (h.enabled?.() ?? true),
      action: () => this.take(id, h),
    });
  }
  private async take(id: string, h: Harvest) {
    const p = this.player;
    if (h.tool && !game.save.tools.includes(h.tool)) { audio.play('wrong', { vol: 0.45 }); this.bark('mori', 'I need a knife for that.', { expr: 'thinking', emote: 'question' }); return; }
    if (!fits(h.item, h.n)) { audio.play('wrong', { vol: 0.45 }); this.bark('mori', 'My backpack’s full. Time to sort it out (Tab).', { expr: 'worried', emote: 'sweat' }); return; }
    p.facing = h.x >= p.x ? 1 : -1;
    const ok = await p.doWork(h.anim ?? 'kneel', h.dur ?? 1.2, () => {});
    if (!ok) return;
    const got = add(h.item, h.n);
    if (got <= 0) return;
    boatSave().salvage[id] = Math.max(1, dayNumber());
    spend(2, 'gather');
    const name = ITEMS[h.item]?.name ?? h.item;
    const [cx, cy] = this.css(h.x, h.artY ?? this.cfg.ground(h.x));
    this.hud?.flyItem(h.item, got, name, cx, cy);
    game.ui.toast(`+${got} <img src="${itemIconURL(h.item, 2)}" style="width:1.5em;height:1.5em;vertical-align:-0.35em;image-rendering:pixelated"> <b>${name}</b>`, 'FOUND', 'teal', 1800);
    audio.play('collectPop', { vol: 0.55 });
    p.body.react('bounce');
    const said = 'said:' + id;
    if (h.line && !boatSave().seen[said]) { boatSave().seen[said] = true; setTimeout(() => this.bark('mori', h.line!, { expr: 'happy' }), 400); }
    game.persist();
    this.hud?.refresh(true);
  }

  /** a landmark you find by walking up to it (once) */
  landmark(id: string, x: number, name: string, kind: 'landmark' | 'ecosystem' | 'cave' = 'landmark', line?: [string, string, string]) {
    const fl = `v10:${this.cfg.loc}:${id}`;
    this.interact.push({
      x, y: this.cfg.ground(x), w: 18, h: 30, label: 'Look around', standX: x,
      enabled: () => !game.save.flags[fl],
      action: async () => {
        game.save.flags[fl] = true;
        discover({ id: `${kind}:${this.cfg.loc}:${id}`, kind, name, loc: this.cfg.loc });
        audio.play('discover', { vol: 0.55 });
        game.ui.toast(`Discovered: <b>${name}</b>`, 'MAP', 'teal', 3000);
        game.persist();
        if (line) await this.say([{ who: line[0], text: line[1], expr: line[2] } as BubbleLine]);
      },
    });
  }

  // ---------------------------------------------------------------- light
  private env(env: Env) {
    const e = envAt(this.clock.t);
    Object.assign(env, e);
    env.ambientTop = [...e.ambientTop];
    env.ambientBottom = [...e.ambientBottom];
    env.fogTop = [...e.fogTop];
    env.fogBottom = [...e.fogBottom];
    const p = this.player;
    env.waterAxis = Math.round(this.cfg.ground(p ? p.x : this.cfg.spawnX)) - 1;
    this.st.preset.lightK = lightKAt(this.clock.t);
  }

  // ---------------------------------------------------------------- frame
  update(dt: number) {
    this.clock.update(dt);
    const t = this.clock.t;
    const tod = t < 2.6 ? 'day' : t < 3.4 ? 'dusk' : 'night';
    if (tod !== this.tod) { this.tod = tod; this.night = tod === 'night'; this.insects.night = this.night; audio.setAmbience('beach', this.night); }
    const cam = this.st.cam, p = this.player;
    if (!cam.locked) cam.tzoom = damp(cam.tzoom, this.zoomBase, 3, dt);
    super.update(dt);
    if (!cam.locked && !this.cam.active) cam.ty = Math.min(p.y, this.cfg.ground(p.x)) - 34;
    this.follow(dt);
    this.buddy?.update(dt);
    // the Region Map fills in as you walk
    const k = Math.floor(clamp(p.x / this.cfg.W) * 10);
    if (k > this.reach) { this.reach = k; revealMap(this.cfg.loc, 0, k / 10); }
    const ho = this.hudOpts();
    const key = ho.place + '|' + ho.sub;
    if (key !== this.placeKey) { this.placeKey = key; this.hud?.setPlace(ho.place, ho.sub); }
    // Aroha's asides, now and then
    this.barkT -= dt;
    if (this.barkT <= 0 && !this.cutscene && !game.ui.bubbles.active && !this.cam.active) {
      this.barkT = rand.range(40, 70);
      const ls = this.arohaLines(p.x);
      if (ls.length && Math.abs(this.aroha.x - p.x) < 160) { const [text, expr] = rand.pick(ls); this.bark('aroha', text, { expr }); }
    }
    this.tick(dt);
  }

  /** Aroha walks a little behind you, stops when you stop, crouches when you sneak */
  private follow(dt: number) {
    const a = this.aroha, p = this.player;
    if (!a || this.cutscene) return;
    const want = clamp(p.x - p.facing * 44, 20, this.cfg.W - 20);
    const d = want - a.x;
    const sneak = p.crouch || p.state === 'hide' || p.camera;
    this.arohaT -= dt;
    if (Math.abs(d) > 70 || (Math.abs(d) > 26 && Math.abs(p.vx) < 5 && this.arohaT <= 0)) {
      this.arohaT = 0.6;
      const run = Math.abs(d) > 150;
      if (!a.walking || Math.abs(d) > 30) void a.walkTo(want, sneak ? 28 : run ? 120 : 60, sneak ? 'crouchWalk' : run ? 'run' : 'walk');
    }
    a.idleAnim = sneak ? 'crouch' : 'idle';
    if (!a.walking && a.anim !== a.idleAnim && a.anim !== 'point' && a.anim !== 'explain') a.setAnim(a.idleAnim);
    if (!a.walking) a.faceTo(p.x + p.facing * 60);
    a.y = this.st.terrain.surfaceBelow(a.x, a.y - 14, 0)?.y ?? this.cfg.ground(a.x);
  }

  async enter() {
    await super.enter();
    // photos: the place's name on the research pages, and each new species on the map
    (this.cam as unknown as { site: string }).site = this.cfg.label;
    const prev = this.cam.onShot;
    this.cam.onShot = ph => {
      prev?.(ph);
      for (const x of ph.subjects) {
        if (x.inFrame < 0.4 || x.visible < 0.4) continue;
        const fl = `v10:photo:${this.cfg.loc}:${x.species}`;
        if (game.save.flags[fl]) continue;
        game.save.flags[fl] = true;
        discover({ id: 'species:' + x.species, kind: 'species', name: SPECIES_BY_ID[x.species]?.name ?? x.species, loc: this.cfg.loc, note: `Photographed on ${this.cfg.name}` });
      }
      game.persist();
    };
    this.st.cam.tzoom = this.st.cam.zoom = this.zoomBase;
    this.player.speedK = 0.95;
    this.player.ground = 'sand';
    this.player.minX = this.cfg.seaX - 10;
    audio.setAmbience('beach', this.night);
    const fl = `v10:landed:${this.cfg.loc}`;
    const first = !game.save.flags[fl];
    game.save.flags[fl] = true;
    discover({ id: 'location:' + this.cfg.loc, kind: 'location', name: this.cfg.name, loc: this.cfg.loc, note: 'Landed by boat' });
    game.persist();
    await wait(700);
    await game.ui.titleCard('Landfall', this.cfg.name, this.cfg.sub, 2400);
    await this.say(first ? this.cfg.first : this.cfg.again);
  }

  render(r: Renderer, dt: number) { super.render(r, dt); }
  protected frame(key: string, gen: () => { buf: PixelBuffer; ax: number; ay: number }): Frame {
    let f = this.fr[key];
    if (!f) { const s = gen(); f = this.fr[key] = bigFrame(game.r, s.buf, s.ax, s.ay); }
    return f;
  }
}

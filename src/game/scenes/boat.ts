// The prologue aboard the Kittiwake: a calm day at sea (walk the deck, talk to the crew, have
// Lou's lunch, photograph a Monarch and review the shot), then the squall: rain, lightning and a
// pitching deck while you lash the crates down, and finally the wave that puts you on the island.

import type { Renderer } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { game } from '../game';
import { FieldScene, FieldSite } from './field';
import { Prop, Custom } from '../../world/props';
import { local, A } from '../assets';
import { audio } from '../../core/audio';
import { clamp, lerp, rand, smoothstep } from '../../core/math';
import { Ocean, BAND_P, applySeaEnv, updater, Weather } from '../../world/ocean';
import type { SurfaceField } from '../../world/ocean';
import { Sky, Rain, RAIN_P } from '../../world/ocean-sky';
import { paintBoatExterior, paintBoatParts, BOAT_LAYOUT, deckY, BoatParts } from '../../art/boat';
import type { Frame } from '../../gfx/renderer';
import { rawPhotos } from '../photos';
import { PixelBuffer } from '../../art/pixel';
import { hex } from '../../art/color';
import { startQuest, questStatus } from '../quests';
import * as script from '../script';
import { goCamp } from './flow';

const PIV = BOAT_LAYOUT.pivot;
const SEA_Y = PIV[1];
const WH = BOAT_LAYOUT.rooms.wheelhouse;

type Phase = 'calm' | 'monarch' | 'storm' | 'wheelhouse' | 'climax';

const BOAT_SITE = (sc: () => BoatScene): FieldSite => ({
  id: 'boat', name: 'The Kittiwake', width: 600, camY: 140, spawnX: 150, exitX: 0, waterY: SEA_Y,
  ambience: 'boatCalm', music: 'voyage', ground: 'wood', noGuide: true, noExit: true,
  spawns: [],
  build: f => sc().buildBoat(f),
});

class GiantWave implements SurfaceField {
  x = 1100;
  h = 0;
  w = 140;
  frontK = 1;
  offset(x: number) {
    const d = (x - this.x) / this.w;
    return -this.h * Math.exp(-d * d) * (d > 0 ? 1 : 1 - Math.min(1, -d * 0.4));
  }
}

export class BoatScene extends FieldScene {
  phase: Phase = 'calm';
  weather = new Weather();
  ocean!: Ocean;
  sky!: Sky;
  parts!: BoatParts;
  rot = 0;
  bob = 0;
  private stormT = 0;
  private partFr: Record<string, Frame[]> = {};
  private crates: { x: number; lashed: boolean; off: number; fr: Frame; lf: Frame }[] = [];
  private wave = new GiantWave();
  private fin = { x: -200, on: false };
  private splashT = 0;
  private waitT = 0;

  constructor() {
    let me: BoatScene | null = null;
    super(BOAT_SITE(() => me!), 'day');
    me = this;
    this.allowPack = false;
  }

  hudOpts() {
    return {
      place: 'The Kittiwake', sub: this.phase === 'calm' || this.phase === 'monarch' ? 'Day 21 at sea' : 'Day 21 · The squall',
      keys: '<span class="key">A</span><span class="key">D</span> move · <span class="key">E</span> interact · <span class="key">Q</span> camera · <span class="key">Shift</span> hold breath · <span class="key">S</span> brace',
    };
  }

  // ---------------------------------------------------------------- building
  buildBoat(f: FieldScene) {
    const st = f.st, r = game.r;
    st.minX = -140;
    st.maxX = 740;
    st.envHook = env => applySeaEnv(env, this.weather);
    this.ocean = new Ocean({ y: SEA_Y, horizon: SEA_Y - 96, seed: 3, weather: this.weather });
    this.ocean.fields.push(this.wave);
    this.sky = new Sky({ weather: this.weather, horizon: this.ocean.horizon, horizonP: BAND_P.horizon, seed: 5 });
    this.sky.birds = true;
    this.sky.onStrike = big => {
      audio.play(big ? 'thunderClose' as never : 'thunder', { vol: big ? 0.9 : 0.5 });
      if (big) r.post.flash = 0.5;
    };
    st.addScreenLayer('sky').add(this.sky);
    for (const b of ['horizon', 'far', 'mid'] as const) st.addLayer('sea-' + b, BAND_P[b], 0, 0.6, 0).add(this.ocean.band(b));
    st.addLayer('rain-far', RAIN_P.far, 0, 0, 0).add(new Rain(this.weather, 'far', 1));
    // the fin in the storm, cutting through the mid band
    st.layer('sea-mid').add(new Custom(5, rr => {
      if (!this.fin.on) return;
      const x = this.fin.x, y = this.ocean.bandSurfaceY('mid', x);
      rr.draw(this.finFr(), x, y + 2);
      rr.rect(x - 16, y + 1, 30, 2, packColor(0.85, 0.9, 0.95, 0.8));
    }));
    // the boat plane: everything on it rocks with the hull
    const main = st.addLayer('main', 1, 0, 1, 0);
    main.xf = [PIV[0], PIV[1], 0, 0, 0];
    const ext = paintBoatExterior({ storm: false });
    const back = local.add('boat:back', ext.back, ext.ax, ext.ay);
    const front = local.add('boat:front', ext.front, ext.ax, ext.ay);
    const glow = ext.glow ? local.add('boat:glow', ext.glow, ext.ax, ext.ay) : null;
    main.add(new Prop(back, PIV[0], PIV[1], -5));
    main.add(new Prop(front, PIV[0], PIV[1], 90));
    if (glow) main.add(new Custom(91, rr => { const k = 0.25 + this.weather.storm * 0.35; rr.emissive(1); rr.draw(glow, PIV[0], PIV[1], 1, 1, 0, packColor(1, 1, 1, k)); rr.emissive(); }));
    // animated parts
    this.parts = paintBoatParts({});
    for (const k of ['wheel', 'radar', 'flag'] as const) this.partFr[k] = this.parts[k].map((s, i) => local.add(`boat:${k}${i}`, s.buf, s.ax, s.ay));
    main.add(new Custom(2, (rr, s) => {
      const M = BOAT_LAYOUT.mounts;
      const storm = this.weather.storm;
      const w = this.partFr.wheel, rd = this.partFr.radar, fl = this.partFr.flag;
      rr.draw(w[Math.floor(Math.abs(this.rot) * 60 + s.time * (1 + storm * 6)) % w.length], M.wheel[0], M.wheel[1]);
      rr.draw(rd[Math.floor(s.time * 4) % rd.length], M.radar[0], M.radar[1]);
      rr.draw(fl[Math.floor(s.time * (6 + storm * 10)) % fl.length], M.flag[0], M.flag[1]);
      // mast light and wheelhouse lamp
      rr.light(BOAT_LAYOUT.lamps[0].x, BOAT_LAYOUT.lamps[0].y, 70, 1, 0.82, 0.55, 0.4 + storm * 0.5);
      rr.light(424, 7, 30, 1, 1, 0.95, storm > 0.3 ? 2 : 0.4);
      // Lou's lunch spread on the aft hatch
      if (!game.save.flags['ate'] && this.phase === 'calm') {
        rr.rect(88, deckY(88) - 9, 26, 2, packColor(0.55, 0.38, 0.22, 1));
        rr.rect(92, deckY(88) - 7, 2, 7, packColor(0.4, 0.28, 0.16, 1));
        rr.rect(108, deckY(88) - 7, 2, 7, packColor(0.4, 0.28, 0.16, 1));
        rr.rect(95, deckY(88) - 12, 6, 3, packColor(0.85, 0.85, 0.8, 1));
        rr.rect(103, deckY(88) - 12, 5, 3, packColor(0.8, 0.55, 0.3, 1));
        for (let i = 0; i < 3; i++) rr.fxDraw(A.soft, 98 + i, deckY(88) - 15 - ((s.time * 8 + i * 5) % 12), 0.3, 0.3, 0, packColor(1, 1, 1, 1), 0.3);
      }
    }));
    // walkable decks and the wheelhouse ladder
    for (const fl of BOAT_LAYOUT.floors) if (fl.name === 'deck') st.terrain.addGround(fl.pts, 'ground');
    // the near sea and the front swell, then rain in front of everything
    st.addLayer('sea-near', BAND_P.near, 0, 0.6, 0).add(this.ocean.band('near'));
    st.addLayer('sea-front', BAND_P.front, 0, 0.5, 0).add(this.ocean.band('front'));
    st.addLayer('rain-mid', RAIN_P.mid, 0, 0, 0).add(new Rain(this.weather, 'mid', 2));
    st.addLayer('rain-near', RAIN_P.near, 0, 0, 0).add(new Rain(this.weather, 'near', 3));
    st.layer('sea-horizon').add(updater(dt => { this.weather.update(dt); this.ocean.update(dt); }));
    // loose crates (lashed in the storm)
    for (const k of ['crate1', 'crate2', 'crate3'] as const) {
      const [x] = BOAT_LAYOUT.spots[k];
      this.crates.push({ x, lashed: false, off: 0, fr: local.add('crate' + k, this.parts.crate.buf, this.parts.crate.ax, this.parts.crate.ay), lf: local.add('crateL' + k, this.parts.crateLashed.buf, this.parts.crateLashed.ax, this.parts.crateLashed.ay) });
    }
    main.add(new Custom(95, rr => {
      for (const c of this.crates) rr.draw(c.lashed ? c.lf : c.fr, c.x + c.off, deckY(c.x + c.off) + 1, 1, 1, c.lashed ? 0 : this.rot * 0.5);
    }));
    this.main = main;
    // crew
    const crowe = f.addActor('crowe', BOAT_LAYOUT.spots.helm[0], BOAT_LAYOUT.spots.helm[1], 1);
    crowe.idleAnim = 'steer'; crowe.setAnim('steer');
    const pip = f.addActor('pip', 470, deckY(470), -1);
    pip.idleAnim = 'wrench'; pip.setAnim('wrench');
    const lou = f.addActor('lou', 70, deckY(70), 1);
    lou.idleAnim = 'cook'; lou.setAnim('cook');
    this.interact.push(
      { x: crowe.x, y: crowe.y, w: 12, h: 30, label: 'Talk to Captain Crowe', standX: crowe.x - 24, enabled: () => this.phase === 'calm' || this.phase === 'monarch', action: () => this.talk('crowe') } as never,
      { x: pip.x, y: pip.y, w: 12, h: 30, label: 'Talk to Pip', standX: pip.x - 22, enabled: () => this.phase === 'calm' || this.phase === 'monarch', action: () => this.talk('pip') } as never,
      { x: lou.x, y: lou.y, w: 12, h: 30, label: 'Talk to Lou', standX: lou.x + 22, enabled: () => this.phase === 'calm' || this.phase === 'monarch', action: () => this.talk('lou') } as never,
      { x: 100, y: deckY(100), w: 16, h: 16, label: 'Sit down for lunch', standX: 118, enabled: () => !!game.save.flags['talk:lou'] && !game.save.flags['ate'], action: () => this.lunch() } as never,
    );
    this.crates.forEach((c, i) => this.interact.push({
      get x() { return c.x + c.off; }, get y() { return deckY(c.x + c.off); }, w: 14, h: 16, label: 'Lash the crate down', get standX() { return c.x + c.off - 16; },
      enabled: () => this.phase === 'storm' && !c.lashed, action: () => this.lash(i),
    } as never));
  }

  async enter() {
    await super.enter();
    this.player.ground = 'wood';
    if (questStatus('voyage') !== 'active' && questStatus('voyage') !== 'done') startQuest('voyage', true);
    this.cutscene = true;
    game.r.post.fade = 1;
    await game.ui.titleCard('Prologue', 'The Kittiwake', 'Somewhere south of anywhere', 3000);
    game.r.post.fade = 0;
    await this.say(script.PROLOGUE_OPEN);
    this.cutscene = false;
    game.ui.toast('Walk with <b>A</b>/<b>D</b>. Talk to the crew with <b>E</b>.', 'TIP', 'teal', 5000);
  }

  // ---------------------------------------------------------------- the calm
  async talk(id: string) {
    const a = this.actors.get(id)!;
    a.faceTo(this.player.x);
    this.player.body.faceTo(a.x);
    const lines = id === 'crowe' ? script.croweTalk() : id === 'pip' ? script.pipTalk() : script.louTalk();
    await this.say(lines);
    game.save.flags['talk:' + id] = true;
    game.persist();
    this.hud?.refresh(true);
    if (id === 'lou' && !game.save.flags['ate']) this.bark('lou', 'Sit! Sit! The table’s right there.', { expr: 'happy' });
  }

  async lunch() {
    this.cutscene = true;
    this.player.facing = -1;
    await this.player.doWork('eat', 3.2, () => {});
    audio.play('munch' as never, { vol: 0.6 });
    await this.say(script.LUNCH_DONE);
    game.save.flags['ate'] = true;
    game.persist();
    this.cutscene = false;
    this.startMonarch();
  }

  startMonarch() {
    if (this.phase !== 'calm') return;
    this.phase = 'monarch';
    this.spawnRule({ species: 'monarch', n: [1, 1], x: [420, 620], medium: 'air', chance: 1 }, false);
    for (const a of this.animals) if (a.species === 'monarch') { a.y = 20; a.home = [200, 700] as never; }
    setTimeout(async () => {
      if (this.phase !== 'monarch') return;
      this.cutscene = true;
      this.actors.get('crowe')?.showEmote?.('exclaim', 1.4);
      await this.say(script.MONARCH_SEEN);
      this.cutscene = false;
      game.ui.toast('Press <b>Q</b> (or hold right mouse) to raise the camera. <b>Click</b> to shoot. Hold <b>Shift</b> to steady your breath.', 'CAMERA', 'teal', 7000);
    }, 1800);
  }

  private async afterMonarchShot() {
    game.save.flags['photo:monarch'] = true;
    game.persist();
    this.cam.raise(false);
    await this.say(script.MONARCH_SHOT);
    try {
      const { openPhotoRoll } = await import('../../ui/photoreview');
      await openPhotoRoll({ standalone: true });
    } catch (e) { console.warn(e); }
    game.save.flags['reviewed:first'] = true;
    game.persist();
    this.waitT = 3;
  }

  // ---------------------------------------------------------------- the storm
  async startStorm() {
    this.phase = 'storm';
    for (const a of this.animals) if (a.species === 'monarch') a.setAct('flee', 12);
    audio.setAmbience('boatStorm', false);
    audio.setMusic('storm');
    this.cutscene = true;
    this.st.shake(3, 0.6);
    await this.say(script.STORM_START);
    this.cutscene = false;
    startQuest('storm', true);
    const lou = this.actors.get('lou');
    lou?.walkTo(250, 70).then(() => { lou.idleAnim = 'brace'; lou.setAnim('brace'); });
    const pip = this.actors.get('pip');
    if (pip) { pip.idleAnim = 'pull'; pip.setAnim('pull'); }
    game.ui.toast('The deck is pitching! Hold <b>S</b> to brace, or you’ll slide. Lash all three crates down.', 'STORM', 'coral', 6000);
  }

  async lash(i: number) {
    const c = this.crates[i];
    if (c.lashed) return;
    const ok = await this.player.doWork('pull', 1.8, () => { if (rand.chance(0.05)) audio.play('rope', { vol: 0.5 }); });
    if (!ok) return;
    c.lashed = true;
    c.off = Math.round(c.off);
    audio.play('rope', { vol: 0.7 });
    const n = this.crates.filter(k => k.lashed).length;
    game.save.vars['crates'] = n;
    this.bark('rowan', script.STORM_CRATE[Math.min(2, n - 1)], { expr: 'determined' });
    if (n >= 3) {
      await new Promise(r => setTimeout(r, 900));
      await this.say(script.STORM_ALL_TIED);
      this.phase = 'wheelhouse';
      game.ui.toast('Get to the wheelhouse!', 'STORM', 'coral', 4000);
    }
  }

  async climax() {
    this.phase = 'climax';
    this.cutscene = true;
    this.player.walkTo((WH.x0 + WH.x1) / 2 - 20, 60).catch(() => {});
    this.fin.on = true;
    this.fin.x = this.st.cam.x + 400;
    await this.say(script.STORM_CLIMAX);
    // the wave rises
    this.wave.x = 1100;
    this.sky.flash({ big: true });
    audio.play('waveCrash' as never, { vol: 1 });
    for (const [id, a] of this.actors) { void id; a.setAnim('scared'); a.showEmote?.('alarm', 2); }
    this.player.body.showEmote('shock', 2);
    await new Promise(r => setTimeout(r, 2600));
    this.sky.flash({ big: true });
    audio.play('shipCrash' as never, { vol: 1 });
    game.r.post.flash = 1;
    this.st.shake(10, 1.2);
    await new Promise(r => setTimeout(r, 500));
    game.save.flags['storm:done'] = true;
    game.save.flags['prologue'] = true;
    game.save.campTime = 'dawn';
    game.persist();
    audio.setStorm(0);
    goCamp();
  }

  // ---------------------------------------------------------------- frame
  update(dt: number) {
    const w = this.weather;
    // storm build-up
    if (this.phase === 'storm' || this.phase === 'wheelhouse' || this.phase === 'climax') {
      this.stormT += dt;
      w.storm = Math.min(1, this.stormT / 16) * (this.phase === 'climax' ? 1 : 0.92);
      audio.setStorm(w.storm);
    }
    if (this.phase === 'climax') {
      this.wave.x = Math.max(PIV[0] + 60, this.wave.x - dt * 160);
      this.wave.h = Math.min(190, this.wave.h + dt * 70);
      this.fin.x -= dt * 60;
    }
    // hull motion from the sea surface under it
    const o = this.ocean;
    if (o) {
      const hA = o.heightAt(PIV[0] - 180), hB = o.heightAt(PIV[0] + 180), hC = o.heightAt(PIV[0]);
      const pitch = Math.atan2(hB - hA, 360);
      const roll = Math.sin(this.time * 0.9) * 0.02 * w.storm;
      const target = clamp(pitch * 0.9 + roll, -0.3, 0.3);
      this.rot = lerp(this.rot, target, clamp(dt * 3));
      this.bob = lerp(this.bob, (hA + hB + hC * 2) / 4 - SEA_Y, clamp(dt * 4));
      this.main.xf = [PIV[0], PIV[1], this.rot, 0, this.bob];
      this.player.tilt = this.rot * (this.player.crouch ? 0.3 : 1);
      // bow slams throw spray over the deck
      this.splashT -= dt;
      if (w.storm > 0.4 && this.splashT <= 0) {
        this.splashT = rand.range(1.2, 3) / w.storm;
        o.splash(PIV[0] + 230, 0.6 + w.storm);
        if (w.storm > 0.7 && rand.chance(0.4)) { this.st.shake(2 + w.storm * 3, 0.4); audio.play('waveCrash' as never, { vol: 0.5 * w.storm }); }
      }
    }
    // loose crates slide with the tilt
    for (const c of this.crates) if (!c.lashed && this.phase !== 'calm' && this.phase !== 'monarch') c.off = clamp(c.off + Math.sin(this.rot) * 90 * dt, -14, 14);
    super.update(dt);
    // follow the player's real (rocked) position
    if (!this.cam.active) {
      const [wx, wy] = this.xfPoint(this.player.x, this.player.y);
      this.st.cam.tx = wx + this.player.facing * 20;
      this.st.cam.ty = Math.min(wy - 40, 150);
    }
    // story beats
    if (this.phase === 'monarch' && !game.save.flags['photo:monarch'] && !this.cutscene) {
      const shot = rawPhotos().some(p => p.site === 'sea' && p.subjects.some(s => s.species === 'monarch' && s.inFrame > 0.4));
      if (shot) { this.cutscene = true; this.afterMonarchShot().finally(() => { this.cutscene = false; }); }
    }
    if (this.phase === 'monarch' && game.save.flags['reviewed:first'] && !this.cutscene) {
      this.waitT -= dt;
      if (this.waitT <= 0) this.startStorm();
    }
    if (this.phase === 'wheelhouse' && !this.cutscene && this.player.x > WH.x0 && this.player.x < WH.x1) this.climax();
  }

  private _fin: Frame | null = null;
  finFr(): Frame {
    if (!this._fin) {
      const b = new PixelBuffer(26, 24);
      b.poly([0, 23, 16, 0, 21, 4, 25, 23], hex('#10141a'));
      b.poly([4, 23, 16, 3, 18, 6, 12, 23], hex('#1c2430'));
      this._fin = local.add('boat:fin', b, 13, 23);
    }
    return this._fin;
  }

  xfPoint(x: number, y: number): [number, number] {
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    const dx = x - PIV[0], dy = y - PIV[1];
    return [PIV[0] + c * dx - s * dy, PIV[1] + s * dx + c * dy + this.bob];
  }

  render(r: Renderer, dt: number) {
    super.render(r, dt);
    void smoothstep;
  }
}

// Inside the tent: a cosy cutaway room with the laptop, bed, specimen shelf, backpack and map.
// Sleeping here moves the story along (the first night brings a noise in the bushes).

import { packColor } from '../../gfx/renderer';
import type { Frame } from '../../gfx/renderer';
import { game } from '../game';
import { Stage } from '../../world/stage';
import { Player } from '../../world/player';
import { Prop, Custom } from '../../world/props';
import { bigFrame } from '../../gfx/atlas';
import { WorldScene } from './world';
import { audio } from '../../core/audio';
import { local, A } from '../assets';
import { openLaptop } from '../../ui/laptop';
import { openBackpack } from '../../ui/backpack';
import { questStatus, currentStep } from '../quests';
import { buildDone } from '../crafting';
import * as script from '../script';
import { goCamp } from './flow';
import { isSample } from '../items';
import type { PixelBuffer } from '../../art/pixel';

interface Sprite { buf: PixelBuffer; ax: number; ay: number; glow?: PixelBuffer }
interface InteriorArt { bg: PixelBuffer; props: Record<string, Sprite>; floorY: number; laptopScreen?: { x: number; y: number; w: number; h: number } }

let interiorFn: (() => InteriorArt) | null = null;
/** bound from src/art/castaway.ts */
export function bindTentArt(fn: (() => InteriorArt) | null) {
  interiorFn = fn;
}

const pickProp = (props: Record<string, Sprite>, ...names: string[]) => {
  for (const n of names) if (props[n]) return props[n];
  const k = Object.keys(props).find(k => names.some(n => k.toLowerCase().includes(n.toLowerCase())));
  return k ? props[k] : null;
};

export class TentScene extends WorldScene {
  lantern = true;
  private art: InteriorArt | null = null;
  floorY = 300;

  constructor(readonly nightTime: boolean) {
    super();
    this.night = nightTime;
    this.clickToWalk = true;
  }

  hudOpts() {
    return { place: 'Your tent', sub: `Day ${game.save.day}`, keys: '<span class="key">A</span><span class="key">D</span> move · <span class="key">E</span> use · <span class="key">I</span> backpack' };
  }

  build() {
    const st = (this.st = new Stage(this.night ? 'night' : 'day', { shade: 0.35 }));
    st.minX = 0;
    st.maxX = 640;
    st.minY = 0;
    st.maxY = 360;
    this.camY = 180;
    const art = (this.art = interiorFn ? interiorFn() : null);
    this.floorY = art?.floorY ?? 300;
    const back = st.addLayer('back', 1, 0, 1, 0);
    this.main = st.addLayer('main', 1, 0, 1, 0);
    const front = st.addLayer('front', 1, 0, 1, 0);
    if (art) back.add(new Prop({ ...bigFrame(game.r, art.bg), ax: 0, ay: 0 }, 0, 0, 0));
    else back.add(new Custom(0, r => { r.rect(0, 0, 640, 360, packColor(0.42, 0.38, 0.26, 1)); r.rect(0, this.floorY, 640, 60, packColor(0.28, 0.22, 0.16, 1)); }));
    st.terrain.addGround([[0, this.floorY], [640, this.floorY]]);
    // props
    const P = art?.props ?? {};
    const add = (s: Sprite | null, x: number, y = this.floorY, z = 5, layer = this.main): Frame | null => {
      if (!s) return null;
      const fr = local.add('tent:' + Math.random().toString(36).slice(2), s.buf, s.ax, s.ay);
      layer.add(new Prop(fr, x, y, z));
      if (s.glow) {
        const g = local.add('tentg:' + Math.random().toString(36).slice(2), s.glow, s.ax, s.ay);
        layer.add(new Custom(z + 0.1, r => { r.emissive(1); r.draw(g, x, y, 1, 1, 0, packColor(1, 1, 1, this.lantern || !this.night ? 1 : 0.4)); r.emissive(); }));
      }
      return fr;
    };
    const s = game.save;
    const fullness = Math.min(2, Math.floor(Object.keys(s.analyzed).length / 4));
    add(pickProp(P, 'bed', 'sleepingBag', 'bag'), 120, this.floorY, 4);
    add(pickProp(P, `shelf${fullness}`, 'shelf'), 250, this.floorY, 4);
    add(pickProp(P, 'desk', 'crateDesk'), 420, this.floorY, 4);
    add(pickProp(P, 'laptopOpen', 'laptop'), 420, this.floorY - 26, 6);
    add(pickProp(P, 'stool'), 392, this.floorY, 3);
    add(pickProp(P, 'backpack', 'pack'), 520, this.floorY, 4);
    add(pickProp(P, 'map', 'wallMap'), 330, 150, 2, back);
    add(pickProp(P, 'lantern'), 320, 40, 8, front);
    // lighting
    this.main.add(new Custom(99, r => {
      if (this.lantern) {
        const k = 0.9 + 0.1 * Math.sin(st.time * 7) * Math.sin(st.time * 2.3);
        r.light(320, 70, 300, 1, 0.78, 0.45, (this.night ? 2.4 : 1.2) * k);
        r.fxDraw(A.glow, 320, 62, 0.6, 0.6, 0, packColor(1, 0.8, 0.5, 1), 1.4 * k);
      }
      if (!this.night) r.light(320, -40, 520, 1, 0.95, 0.85, 1.1);
      // laptop screen glow
      r.light(420, this.floorY - 50, 70, 0.55, 0.85, 1, 0.8);
    }));
    // player
    this.player = new Player(560, this.floorY, st.terrain);
    this.player.minX = 40;
    this.player.maxX = 600;
    this.player.facing = -1;
    this.player.ground = 'wood';
    this.main.add(this.player);
    // interactables
    this.interact.push(
      { x: 420, y: this.floorY, w: 26, h: 26, label: 'Use the laptop', standX: 396, action: () => this.useLaptop() },
      { x: 120, y: this.floorY, w: 40, h: 16, label: 'Sleep', standX: 160, action: () => this.sleep() },
      { x: 250, y: this.floorY, w: 24, h: 30, label: 'Specimen shelf', standX: 250, action: () => this.shelf() },
      { x: 520, y: this.floorY, w: 16, h: 18, label: 'Backpack', standX: 500, action: () => this.openPack() },
      { x: 330, y: this.floorY, w: 20, h: 40, label: 'Island map', standX: 330, action: () => this.map() },
      { x: 320, y: this.floorY, w: 10, h: 60, label: 'Lantern', standX: 300, enabled: () => this.night, action: () => this.toggleLantern() },
      { x: 612, y: this.floorY, w: 16, h: 30, label: 'Go outside', standX: 600, action: () => this.goOut() },
    );
    audio.setAmbience('tent' as never, this.night);
    audio.setMusic(this.night ? 'night' : 'lab' as never);
  }

  async enter() {
    await super.enter();
    this.st.cam.locked = true;
    this.st.cam.x = 320;
    this.st.cam.y = 180;
    audio.play('zipper' as 'ui', { vol: 0.6 });
  }

  async useLaptop() {
    this.player.body.setAnim('type');
    audio.play('typing' as 'ui', { vol: 0.4 });
    await openLaptop({});
    this.player.body.setAnim('idle');
    if ((game.save.vars['analyses'] ?? 0) >= 1 && !game.save.flags['said:firstAnalysis']) {
      game.save.flags['said:firstAnalysis'] = true;
      this.bark('rowan', 'So that’s what it is. This place is incredible.', { expr: 'happy', emote: 'sparkle' });
    }
    this.hud?.refresh(true);
  }

  shelf() {
    const s = game.save;
    const n = Object.keys(s.analyzed).length;
    const inPack = s.inv.filter(x => isSample(x.id)).reduce((a, x) => a + x.n, 0);
    this.bark('rowan', n ? `${n} kinds of sample catalogued so far. ${inPack ? `${inPack} more in my pack to analyse.` : ''}` : 'Empty. For now.', { expr: 'thinking' });
  }

  map() {
    if (!game.save.flags['aroha:met']) { this.bark('rowan', 'A blank page where a map should be. We don’t even know where we are.', { expr: 'worried' }); return; }
    this.bark('rowan', 'Aroha’s map. Talk to her by the fire to head out.', { expr: 'happy' });
  }

  toggleLantern() {
    this.lantern = !this.lantern;
    audio.play('lanternOn' as 'ui', { vol: 0.5 });
  }

  async goOut() {
    audio.play('zipper' as 'ui', { vol: 0.6 });
    if (game.save.flags['noise:heard'] && !game.save.flags['noise:found']) {
      const { CampScene } = await import('./camp2');
      game.go(() => new CampScene({ noiseNight: true }), [0.01, 0.01, 0.02], 3);
      return;
    }
    goCamp(false);
  }

  async sleep() {
    const s = game.save;
    // the story night: a noise in the bushes
    const q = questStatus('castaways') === 'active' ? currentStep('castaways') : null;
    if (q && q.text.startsWith('Get some sleep')) {
      await this.nightNoise();
      return;
    }
    if (!buildDone('tent')) return;
    if (s.campTime !== 'night' && s.campTime !== 'dusk') {
      const c = await this.say([{ who: 'rowan', text: 'It’s still light out. Sleep anyway?', style: 'think', choices: ['Sleep until morning', 'Not yet'] }]);
      if (c !== 0) return;
    }
    await this.sleepToMorning();
  }

  async sleepToMorning() {
    const s = game.save;
    this.cutscene = true;
    this.player.body.setAnim('lie');
    this.player.body.setExpr('sleep');
    this.player.body.showEmote('zzz', 2.5);
    await game.fadeTo(1, 1.2);
    s.day++;
    s.campTime = 'dawn';
    s.buff = null;
    game.persist();
    await game.ui.titleCard(`Day ${s.day}`, 'Morning', '', 1800);
    goCamp(false);
  }

  /** First night: fall asleep, hear a rustle, wake, go out to investigate. */
  async nightNoise() {
    const s = game.save;
    this.cutscene = true;
    await this.player.walkTo(160, 60);
    this.player.body.setAnim('lie');
    this.player.body.setExpr('sleep');
    this.player.body.showEmote('zzz', 3);
    await game.fadeTo(1, 1);
    s.flags['slept:1'] = true;
    s.campTime = 'night';
    this.night = true;
    game.persist();
    this.lantern = false;
    audio.setMusic('spooky' as never);
    audio.setAmbience('tent' as never, true);
    await new Promise(r => setTimeout(r, 1200));
    game.fadeTo(0, 0.6);
    await new Promise(r => setTimeout(r, 1500));
    audio.play('rustleBush' as 'ui', { vol: 0.9 });
    await new Promise(r => setTimeout(r, 900));
    audio.play('rustleBush' as 'ui', { vol: 1 });
    this.player.body.play('wake', 'sitGround');
    this.player.body.setExpr('worried');
    this.player.body.showEmote('question', 1.5);
    await new Promise(r => setTimeout(r, 900));
    await this.say(script.NOISE_WAKE);
    audio.setHeartbeat(0.35);
    this.player.body.setAnim('idle');
    s.flags['noise:heard'] = true;
    game.persist();
    this.cutscene = false;
    game.ui.toast('Something is moving in the bushes outside. Go and look.', 'STORY', 'coral', 4200);
  }

  update(dt: number) {
    super.update(dt);
    this.st.cam.x = 320;
    this.st.cam.y = 180;
  }
}

export { openBackpack };

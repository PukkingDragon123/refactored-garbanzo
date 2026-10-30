// V12 The Thunderbird: the hunt. Aroha as a hunting companion in every field scene once Mori is getting
// ready (she follows, whispers tips, and can be told to wait), and the climax on the ridge top of the
// Rocky Hills: the storm front comes over the crest, rain and dithered lightning, and Te Pouākai.
//
// THE ENCOUNTER (the ridge top, x 2940..3380: the blind at 3010, the bait stone at 3130)
//   circle    it rides the storm overhead, wings across the whole sky
//   the tell  1. its SHADOW slides over the tussock and settles on Mori   (move!)
//             2. it hangs in the wind and SHRIEKS                          (last chance)
//             3. the DIVE: a folded stoop onto where he stood               (dodge it, or be hidden)
//   recover   it hits the ground hard and takes a moment to get up: sling it, photograph it
//   bait      lay the storm bait on the stone and get out of sight (the blind, or the hide cloak,
//             crouched and still): it comes down to feed, mantling, the closest it will ever be.
//             With Aroha's snare set by the bait it catches a talon: walk up and band its leg (a QTE).
//   the end   three solid hits while it is down drive it off; a band on its leg and it tears free and
//             goes home over the ridge. Nobody kills it. A photo at its closest finishes the record.
//   a hit     a dive that lands on Mori bowls him over: stunned on the ground, something dropped from
//             the pack, and hungrier for it. Three of those and Aroha calls it off for today.

import type { FieldScene } from '../../scenes/field';
import type { Renderer, Frame } from '../../../gfx/renderer';
import { packColor } from '../../../gfx/renderer';
import type { Drawable, Stage, Layer } from '../../../world/stage';
import type { Interactable } from '../../../world/npc';
import type { Env } from '../../../gfx/renderer';
import { game } from '../../game';
import { local } from '../../assets';
import { audio } from '../../../core/audio';
import { rand, clamp } from '../../../core/math';
import { floatText } from '../../../ui/v12/float';
import type { FloatStyle } from '../../../ui/v12/float';
import { count, remove } from '../../inventory';
import { addHunger } from '../hunger';
import { addShootTarget, dropSomething } from '../../v11/predators-core';
import { sfx11 } from '../../v11/predators-sfx';
import { applySeaEnv } from '../../../world/ocean';
import { qte } from '../qte';
import {
  thunderbirdFrame, thunderbirdShadow, TB_ALL, paintRain, paintSplash, paintVeil, paintBolt, paintBlind, paintBaitWorld, paintSnare, paintCloakDrape,
} from '../../../art/v12/thunderbird';
import type { TBArt, TBPose } from '../../../art/v12/thunderbird';
import { paintBoulder } from '../../../art/v11/hills/rocks';
import { tbStep, tbDone, hasCloak } from './quest';

const F = (k: string) => !!game.save.flags[k];
const pick = <T,>(a: T[]): T => a[Math.floor(rand.next() * a.length)];
const setF = (k: string) => { game.save.flags[k] = true; game.persist(); };
type GuideHolder = { guide: unknown };

// ---------------------------------------------------------------- frames (per scene atlas)
const frames = new Map<string, Frame>();
let owner: unknown = null;
function frameOf(key: string, make: () => TBArt): Frame {
  if (owner !== local) { owner = local; frames.clear(); }
  let f = frames.get(key);
  if (!f) { const a = make(); f = local.add('v12:tb:' + key, a.buf, a.ax, a.ay); frames.set(key, f); }
  return f;
}
const birdFr = (pose: TBPose, i: number) => frameOf(`${pose}${i}`, () => thunderbirdFrame(pose, i));
const buf = (b: { w: number; h: number }) => b as never;
void buf;

/** Mori under the hide cloak: crouched and still (or nearly) */
export function cloaked(f: FieldScene): boolean {
  const p = f.player;
  return hasCloak() && p.crouch && Math.abs(p.vx) < 12;
}
/** out of sight: in a hide, or cloaked */
export const hidden = (f: FieldScene) => f.player.state === 'hide' || cloaked(f);

function say(f: FieldScene, who: 'aroha' | 'mori', text: string, style: FloatStyle = 'say', ms = 2800) {
  const a = who === 'aroha' ? f.actors.get('aroha') : null;
  if (who === 'aroha' && !(a && a.visible)) return;
  void floatText(a ? { actor: a, text, style, ms } : { text, style, ms });
}

// ================================================================ Aroha, hunting companion
const HUNT_TIPS: Record<string, string[]> = {
  any: [
    'Walk soft. Everything up here is listening.',
    'If something charges, don’t run straight. Get behind a rock, or get low and still.',
    'Sling’s for the brow, Mori. A miss just makes them angry.',
  ],
  hills: [
    'Up here, keep low. Anything with wings sees you long before you see it.',
    'Feel that wind turning? The storm comes over the ridge in the afternoon. So does it.',
    'The torhoppers are jumpy. If the rams start stamping, back off.',
  ],
  falls: ['The hawks nest on the cliff. Get too close and they’ll come down on your head.'],
  fernwood: ['Bonefaces charge if you get between them and the young ones. Give them room.'],
};
class Companion implements Drawable {
  z = 0;
  waiting = false;
  private held: unknown = null;
  private it: Interactable;
  private tipT = 18;
  private far = false;
  constructor(readonly f: FieldScene, readonly loc: string) {
    this.it = {
      x: 0, y: 0, w: 18, h: 44, label: 'Tell Aroha to wait here',
      enabled: () => !!this.actor && !f.cutscene && tbStep() >= 2 && !tbDone(),
      action: () => this.toggle(),
    };
    f.interact.push(this.it);
  }
  get actor() { const a = this.f.actors.get('aroha'); return a && a.visible ? a : null; }
  toggle() {
    const a = this.actor, f = this.f as unknown as GuideHolder;
    if (!a) return;
    if (!this.waiting) {
      this.waiting = true;
      this.held = f.guide;
      f.guide = null;
      a.stopWalk();
      a.faceTo(this.f.player.x);
      a.setAnim('staff');
      say(this.f, 'aroha', pick(['I’ll wait here. Shout if it goes bad.', 'Go on, then. I’m watching your back from here.', 'Right here. Don’t do anything brave.']), 'say');
    } else {
      this.waiting = false;
      if (this.held && !f.guide) f.guide = this.held;
      this.held = null;
      say(this.f, 'aroha', pick(['Right behind you.', 'Coming.', 'Kei konei ahau. I’m here.']), 'say');
    }
    audio.play('ui', { vol: 0.3 });
  }
  update(dt: number) {
    const a = this.actor;
    this.it.label = this.waiting ? 'Aroha, come with me' : 'Tell Aroha to wait here';
    if (!a) return;
    this.it.x = a.x; this.it.y = a.y - 20;
    const p = this.f.player;
    if (this.waiting) {
      a.faceTo(p.x);
      const d = Math.abs(p.x - a.x);
      if (d > 520 && !this.far) { this.far = true; say(this.f, 'aroha', 'Far enough! I can’t cover you from here!', 'shout'); }
      if (d < 300) this.far = false;
      return;
    }
    if (tbStep() !== 3 || this.f.cutscene || game.ui.bubbles.active) return;
    this.tipT -= dt;
    if (this.tipT > 0) return;
    this.tipT = rand.range(30, 45);
    const list = [...(HUNT_TIPS[this.loc] ?? []), ...HUNT_TIPS.any];
    say(this.f, 'aroha', pick(list), 'whisper', 3400);
  }
  draw() {}
  dispose() {
    const i = this.f.interact.indexOf(this.it);
    if (i >= 0) this.f.interact.splice(i, 1);
    if (this.waiting && this.held) (this.f as unknown as GuideHolder).guide = this.held;
  }
}

// ================================================================ the storm
interface Drop { x: number; y: number; v: number; k: number }
interface Splash { x: number; y: number; t: number }
class Storm implements Drawable {
  z = 260;
  /** how far in the storm is (0..1) and where it's going */
  k = 0;
  want = 0;
  flash = 0;
  private drops: Drop[] = [];
  private splashes: Splash[] = [];
  private boltT = 6;
  private bolt: { fr: Frame; x: number; y: number; t: number } | null = null;
  private amb = false;
  private far: Layer | null = null;
  constructor(readonly f: FieldScene) {
    const st = f.st;
    const prev = st.envHook;
    st.envHook = (env: Env, dt: number) => {
      prev?.(env, dt);
      if (this.k > 0.01 || this.flash > 0.01) applySeaEnv(env, { storm: this.k * 0.85, lightning: this.flash * 0.9 } as never);
    };
    // distant strikes go on a far layer, behind the ranges in front of it
    this.far = st.layers.filter(l => !l.screen && l.p > 0.12 && l.p < 0.6).sort((a, b) => b.p - a.p)[0] ?? null;
    if (this.far) this.far.add({ z: -50, draw: (r: Renderer) => this.drawBolt(r) } as Drawable);
  }
  update(dt: number, st: Stage) {
    this.k += clamp(this.want - this.k, -dt * 0.12, dt * 0.15);
    this.flash = Math.max(0, this.flash - dt * 2.6);
    if (this.bolt) { this.bolt.t -= dt; if (this.bolt.t <= 0) this.bolt = null; }
    if (this.k > 0.35 && !this.amb) { this.amb = true; audio.setAmbience('storm', this.f.night); }
    if (this.k < 0.2 && this.amb) { this.amb = false; audio.setAmbience(this.f.site.ambience, this.f.night); }
    // rain: drops that fall slanting with the wind and burst on the ground
    const want = Math.round(170 * this.k);
    const r = game.r;
    const x0 = r.visibleX0(30), x1 = r.visibleX1(30);
    while (this.drops.length < want) this.drops.push({ x: rand.range(x0, x1), y: st.cam.y - rand.range(140, 260), v: rand.range(330, 420), k: rand.int(0, 2) });
    if (this.drops.length > want) this.drops.length = want;
    const ter = this.f.st.terrain;
    for (const d of this.drops) {
      d.y += d.v * dt;
      d.x -= d.v * 0.33 * dt;
      const gy = ter.groundY(d.x);
      if (d.y >= gy) {
        if (this.splashes.length < 60 && rand.chance(0.6)) this.splashes.push({ x: d.x, y: gy, t: 0 });
        d.x = rand.range(x0, x1 + 60); d.y = st.cam.y - rand.range(160, 240);
      }
      if (d.x < x0 - 40) d.x += x1 - x0 + 60;
    }
    for (const s of this.splashes) s.t += dt;
    this.splashes = this.splashes.filter(s => s.t < 0.16);
    // lightning
    if (this.k > 0.5) {
      this.boltT -= dt;
      if (this.boltT <= 0) this.strike(st);
    }
  }
  strike(st: Stage) {
    this.boltT = rand.range(5, 11);
    this.flash = 1;
    setTimeout(() => { this.flash = Math.max(this.flash, 0.7); }, 140);
    const v = rand.int(0, 2);
    const fr = frameOf('bolt' + v, () => paintBolt(31 + v * 17));
    if (this.far) {
      const p = this.far.p;
      this.bolt = { fr, x: st.cam.x * p + rand.range(-260, 260), y: st.cam.y * p - 280, t: 0.32 };
    }
    const close = rand.chance(0.4);
    setTimeout(() => audio.play(close ? 'thunderClose' : 'thunder', { vol: close ? 0.8 : 0.55, pitch: rand.range(0.8, 1.05) }), close ? 180 : rand.range(500, 1300));
    if (close) st.shake(1.5, 0.4);
  }
  private drawBolt(r: Renderer) {
    if (!this.bolt) return;
    const a = this.bolt.t > 0.22 || (this.bolt.t > 0.08 && this.bolt.t < 0.14) ? 1 : 0.45;
    r.draw(this.bolt.fr, Math.round(this.bolt.x), Math.round(this.bolt.y), 1, 1, 0, packColor(1, 1, 1, a));
  }
  draw(r: Renderer, st: Stage) {
    if (this.k < 0.02) return;
    const rain = [0, 1, 2].map(i => frameOf('rain' + i, () => { const b = paintRain()[i]; return { buf: b, ax: 0, ay: b.h }; }));
    const a = Math.min(1, this.k * 1.3);
    const col = packColor(1, 1, 1, a);
    for (const d of this.drops) r.draw(rain[d.k], Math.round(d.x), Math.round(d.y), 1, 1, 0, col);
    const sp = [0, 1].map(i => frameOf('splash' + i, () => { const b = paintSplash()[i]; return { buf: b, ax: 2, ay: b.h }; }));
    for (const s of this.splashes) r.draw(sp[s.t < 0.08 ? 0 : 1], Math.round(s.x), Math.round(s.y), 1, 1, 0, col);
    // the flash: an ordered-dither veil of white over the view for a couple of frames
    if (this.flash > 0.45) {
      const veil = frameOf(this.flash > 0.8 ? 'veil50' : 'veil25', () => ({ buf: paintVeil(this.flash > 0.8 ? 0.5 : 0.25), ax: 0, ay: 0 }));
      const vx0 = Math.floor(r.visibleX0(0) / 32) * 32, vx1 = r.visibleX1(32);
      const vy0 = Math.floor((st.cam.y - 240) / 32) * 32;
      for (let y = vy0; y < st.cam.y + 240; y += 32) for (let x = vx0; x < vx1; x += 32) r.draw(veil, x, y, 1, 1, 0, packColor(1, 1, 1, 0.35));
    }
  }
}

// ================================================================ Te Pouākai
type BState = 'away' | 'arrive' | 'circle' | 'shadow' | 'shriek' | 'dive' | 'recover' | 'climb' | 'landing' | 'feed' | 'snared' | 'hurt' | 'flee';
const VULNERABLE: BState[] = ['recover', 'feed', 'snared', 'hurt'];
const CLOSE: BState[] = ['recover', 'feed', 'snared', 'hurt', 'landing'];
export const ARENA = { x0: 2940, x1: 3380, blind: 3010, stone: 3130 };

class Pouakai implements Drawable {
  z = 46;
  state: BState = 'away';
  x = 3500;
  y = 0;
  facing: 1 | -1 = -1;
  pose: TBPose = 'soar';
  frame = 0;
  private t = 0;
  private st = 0;
  private animT = 0;
  private tx = 0;
  private x0 = 0;
  private y0 = 0;
  private shadowX = 0;
  hits = 0;
  downs = 0;
  private hiddenT = 0;
  private lastAttack = 0;
  private told = new Set<string>();
  private rearm = 0;
  private flinchT = 0;
  private offTarget: () => void;
  private target = { x: 0, y: 0, r: 30, hit: (pw: number) => this.pebble(pw), alive: () => this.state !== 'away' && this.state !== 'flee' };
  private tagIt: Interactable;
  baitOut = false;
  snareSet = false;
  constructor(readonly f: FieldScene, readonly storm: Storm, readonly comp: Companion | null) {
    this.offTarget = addShootTarget(this.target);
    this.tagIt = {
      x: 0, y: 0, w: 40, h: 50, label: 'Band its leg!',
      enabled: () => this.state === 'snared' && Math.abs(f.player.x - this.x) < 80,
      action: () => void this.tag(),
    };
    f.interact.push(this.tagIt);
    // the camera: a shot at its closest finishes the record
    const cam = f.cam;
    const prev = cam.onShot;
    cam.onShot = p => { prev?.(p); this.onShot(); };
  }
  get gy() { return this.f.st.terrain.groundY(this.x); }
  get present() { return this.state !== 'away'; }

  /** the storm comes over the ridge and it rides in on it */
  begin() {
    if (this.state !== 'away') return;
    setF('tb:storm');
    this.storm.want = 1;
    this.state = 'arrive';
    this.st = 0;
    this.x = this.f.player.x + 520;
    this.y = this.f.st.terrain.groundY(this.x) - 260;
    this.facing = -1;
    this.hits = 0;
    this.downs = 0;
    audio.play('thunderClose', { vol: 0.7 });
    setTimeout(() => this.f.sfx('callScreech', this.x, 1, 0.45), 900);
    void floatText({ text: 'KRRAAAAAHH!', x: this.x - 120, y: this.y, style: 'shout', ms: 1800 });
    say(this.f, 'aroha', 'There. On the storm. Don’t run. Whatever you do, don’t run.', 'whisper', 3600);
  }
  private tell(key: string, who: 'aroha' | 'mori', text: string, style: FloatStyle = 'shout') {
    if (this.told.has(key)) return;
    this.told.add(key);
    say(this.f, who, text, style, 2600);
  }
  private go(s: BState) { this.state = s; this.st = 0; }

  update(dt: number) {
    const f = this.f, p = f.player;
    this.t += dt; this.st += dt; this.animT += dt;
    this.flinchT = Math.max(0, this.flinchT - dt);
    const H = hidden(f);
    if (this.state === 'away') {
      this.rearm = Math.max(0, this.rearm - dt);
      if (this.rearm <= 0 && p.x > ARENA.x0 && tbStep() >= 3 && tbStep() <= 5 && !f.cutscene) this.begin();
      return;
    }
    // where the bait is: the stone, or a storm bait dropped with F
    const lure = f.lures.find(l => l.kind === 'tb_bait' && l.x > ARENA.x0 - 100);
    const baitX = this.baitOut ? ARENA.stone : lure ? lure.x : null;
    // Mori hidden (and well away from the bait): it starts to think about coming down
    if (H && baitX !== null && Math.abs(p.x - baitX) > 70) this.hiddenT += dt; else this.hiddenT = Math.max(0, this.hiddenT - dt * 2);
    const cx = clamp(p.x, ARENA.x0 - 40, ARENA.x1);
    switch (this.state) {
      case 'arrive': {
        this.setPose('soar', 0.4);
        this.x += (cx + 120 - this.x) * Math.min(1, dt * 0.8);
        this.y += (this.gy - 175 - this.y) * Math.min(1, dt * 0.8);
        if (this.st > 3.2) { this.go('circle'); this.lastAttack = this.t; }
        break;
      }
      case 'circle': {
        const tx = cx + Math.sin(this.t * 0.42) * 170, ty = this.gy - 168 + Math.sin(this.t * 0.9) * 14;
        const vx = (tx - this.x) * Math.min(1, dt * 1.3);
        this.x += vx; this.y += (ty - this.y) * Math.min(1, dt * 1.3);
        if (Math.abs(vx) > 0.2) this.facing = vx > 0 ? 1 : -1;
        this.setPose(Math.abs(vx) > 1.6 ? 'flap' : 'soar', Math.abs(vx) > 1.6 ? 0.11 : 0.45);
        if (baitX !== null && this.hiddenT > 2.2) {
          this.x0 = this.x; this.y0 = this.y; this.tx = baitX + (this.x > baitX ? 26 : -26);
          this.go('landing');
          this.tell('baited', 'aroha', 'It’s seen the bait... stay down. Don’t breathe.', 'whisper');
          break;
        }
        if (this.t - this.lastAttack > (H ? 9 : 4.2) && !f.cutscene) {
          this.go('shadow');
          this.shadowX = this.x;
          this.tell('shadow', 'aroha', 'Its SHADOW! Watch the ground!');
        }
        if (!this.told.has('baitTip') && this.t > 14 && !this.baitOut) this.tell('baitTip', 'aroha', 'Bait on the stone, then into the blind. Let it come down to us.', 'whisper');
        break;
      }
      case 'shadow': {
        // it climbs and its shadow slides over the tussock and settles on Mori
        this.setPose('soar', 0.4);
        this.y += (this.gy - 205 - this.y) * Math.min(1, dt * 1.5);
        this.x += (p.x - this.x) * Math.min(1, dt * 0.9);
        this.shadowX += (p.x - this.shadowX) * Math.min(1, dt * 3);
        if (this.st > 1.5) {
          // the lock: where he is now, led a little
          this.tx = clamp(p.x + p.vx * 0.25, ARENA.x0 - 60, ARENA.x1 + 20);
          this.go('shriek');
          this.f.sfx('callScreech', this.x, 1, 0.42);
          audio.play('roar', { vol: 0.35, pitch: 1.7 });
          this.f.st.shake(2.5, 0.5);
          void floatText({ text: 'KRRAAAH!', x: this.x, y: this.y - 70, style: 'shout', ms: 900 });
        }
        break;
      }
      case 'shriek': {
        // it hangs in the wind, flared, the shriek: the last moment to get out of the way
        this.setPose('shriek', 0.18);
        this.facing = this.tx >= this.x ? 1 : -1;
        this.y -= dt * 8;
        if (this.st > 0.75) {
          this.x0 = this.x; this.y0 = this.y;
          this.go('dive');
          audio.play('whoosh', { vol: 0.8, pitch: 0.6 });
          this.tell('dive', 'aroha', 'MOVE, MORI!');
        }
        break;
      }
      case 'dive': {
        const T = 0.55, k = Math.min(1, this.st / T), e = k * k;
        this.pose = 'dive'; this.frame = 0;
        this.x = this.x0 + (this.tx - this.x0) * e;
        this.y = this.y0 + (this.f.st.terrain.groundY(this.tx) - 26 - this.y0) * e;
        if (k >= 1) this.impact();
        break;
      }
      case 'recover': {
        // on the ground, wings mantled, getting its feet under it: its moment of weakness
        this.y = this.gy;
        this.setPose(this.st < 0.3 ? 'dive' : 'land', 0.5, this.st < 0.3 ? 1 : undefined);
        if (this.st < 0.3) this.y = this.gy - 26;
        this.tell('down', 'aroha', 'It’s down! Sling, NOW! Or get your shot!');
        if (this.st > 2.6) this.climb();
        break;
      }
      case 'climb': {
        this.setPose('flap', 0.1);
        this.y += (this.gy - 175 - this.y) * Math.min(1, dt * 1.4);
        this.x += this.facing * 60 * dt;
        if (this.st > 1.4) { this.go('circle'); this.lastAttack = this.t; }
        break;
      }
      case 'landing': {
        const T = 1.8, k = Math.min(1, this.st / T), e = 1 - (1 - k) * (1 - k);
        this.facing = this.tx >= this.x0 ? 1 : -1;
        this.x = this.x0 + (this.tx - this.x0) * e;
        const gy = this.f.st.terrain.groundY(this.tx);
        this.y = this.y0 + (gy - 60 - this.y0) * e;
        this.setPose('flap', 0.12);
        if (k >= 1) {
          this.y = gy;
          this.facing = baitX !== null && baitX < this.x ? -1 : 1;
          this.go('feed');
          sfx11('thud', { x: this.x, vol: 0.8, pitch: 0.6 });
          this.f.st.shake(2, 0.3);
        }
        break;
      }
      case 'feed': {
        // mantling over the bait, tearing at it: the closest it will ever be
        this.y = this.gy;
        this.setPose('land', 0.55);
        if (this.snareSet && this.st > 1.2) {
          this.go('snared');
          this.snareSet = false;
          sfx11('crack', { x: this.x, vol: 0.8 });
          this.f.sfx('callScreech', this.x, 1, 0.5);
          void floatText({ text: 'KRAAH! KRAAH!', x: this.x, y: this.y - 120, style: 'shout', ms: 1400 });
          this.tell('snared', 'aroha', 'The snare’s got its leg! Quick, the band! Go!');
          break;
        }
        const near = Math.abs(p.x - this.x) < 90 && !H;
        if (near || this.st > 8) {
          if (this.st > 8) { this.baitOut = false; const l = f.lures.indexOf(lure!); if (lure && l >= 0) f.lures.splice(l, 1); }
          if (near) this.tell('spooked', 'aroha', 'Too close! You spooked it!', 'say');
          this.climb();
        }
        break;
      }
      case 'snared': {
        this.y = this.gy;
        this.setPose(Math.floor(this.st * 3) % 2 ? 'shriek' : 'hurt', 0.2);
        if (Math.floor(this.st * 2.5) !== Math.floor((this.st - dt) * 2.5)) f.st.shake(1.2, 0.15);
        // it tears free after a while
        if (this.st > 10) { this.tell('free', 'aroha', 'It’s torn loose! Get down!'); this.climb(); }
        break;
      }
      case 'hurt': {
        this.y = this.gy;
        this.setPose('hurt', 0.2);
        if (this.st > 0.7) {
          if (this.hits >= 3) this.flee(true);
          else { this.go('recover'); this.st = 1.4; }
        }
        break;
      }
      case 'flee': {
        this.setPose('flee', 0.09);
        this.x += this.facing * 150 * dt;
        this.y -= 110 * dt;
        if (this.st > 4.5) this.leave();
        break;
      }
    }
    // the shootable body (for pebbles), the tag prompt
    const air = this.pose === 'soar' || this.pose === 'flap' || this.pose === 'flee' || this.pose === 'dive';
    this.target.x = this.x; this.target.y = air ? this.y : this.y - 52;
    this.target.r = air ? 34 : 30;
    this.tagIt.x = this.x; this.tagIt.y = this.y - 30;
    // Aroha rolls clear of a dive landing on her
    const ar = f.actors.get('aroha');
    if (ar && this.state === 'dive' && this.st > 0.3 && Math.abs(ar.x - this.tx) < 40 && ar.anim !== 'roll') ar.play('roll', ar.idleAnim).catch(() => {});
  }
  private setPose(p: TBPose, fps: number, fixed?: number) {
    if (this.pose !== p) { this.pose = p; this.animT = 0; }
    this.frame = fixed ?? Math.floor(this.animT / fps);
  }
  private impact() {
    const f = this.f, p = f.player;
    const gy = f.st.terrain.groundY(this.tx);
    this.x = this.tx; this.y = gy;
    f.st.shake(5, 0.45);
    sfx11('thud', { x: this.x, vol: 1, pitch: 0.5 });
    for (let i = 0; i < 18; i++) f.main.particles.spawn({ frame: frameOf('dust', () => ({ buf: paintSplash()[1], ax: 2, ay: 2 })), x: this.x + rand.range(-30, 30), y: gy - 2, vx: rand.range(-80, 80), vy: rand.range(-90, -20), ay: 200, life: 0.7, alpha: 0.9, alpha1: 0, floorY: gy, color: [0.7, 0.62, 0.5] } as never);
    const d = Math.abs(p.x - this.tx);
    if (d < 34 && !hidden(f) && p.state !== 'stunned') this.hitMori();
    else if (d < 34) { void floatText({ text: '?', x: this.x, y: gy - 110, style: 'shout', ms: 900 }); this.tell('hid', 'aroha', 'Ha! It lost you! It can’t see you in there!', 'say'); }
    else if (d < 90) this.tell('close', 'mori', 'That... was... TOO close.', 'scared');
    this.go('recover');
    this.lastAttack = this.t;
  }
  private hitMori() {
    const f = this.f, p = f.player;
    const dir = Math.sign(p.x - this.x) || 1;
    this.downs++;
    game.r.post.flash = Math.max(game.r.post.flash, 0.45);
    p.cancelWork();
    f.cam?.raise(false);
    p.hurtT = 1.6;
    p.state = 'stunned';
    p.vx = dir * 200; p.vy = -150; p.onGround = false;
    p.body.react('jump');
    p.body.setExpr('scared', 3.5);
    p.body.showEmote('star', 2);
    p.poseOverride = 'fallBack';
    setTimeout(() => { if (p.poseOverride === 'fallBack') p.poseOverride = 'sitShock'; }, 520);
    setTimeout(() => { if (p.poseOverride === 'sitShock' || p.poseOverride === 'fallBack') p.poseOverride = null; if (p.state === 'stunned') p.state = 'normal'; }, 1800);
    addHunger(0.12, 'predator');
    const lost = dropSomething(f, p.x + dir * 16, p.y);
    void floatText({ text: lost ? `OOF! ...I dropped ${lost}.` : 'OOF!', style: 'scared', ms: 2600 });
    say(f, 'aroha', this.downs >= 3 ? 'Enough! Mori! We’re pulling back!' : pick(['Get UP! Off the open ground!', 'Don’t stand under it! Hide!', 'Watch its shadow, not the bird!']), 'shout');
    if (this.downs >= 3) setTimeout(() => this.flee(false), 1200);
  }
  private climb() { this.go('climb'); this.facing = rand.chance(0.5) ? 1 : -1; this.lastAttack = this.t; }
  private pebble(power: number) {
    if (VULNERABLE.includes(this.state)) {
      const k = power >= 1.2 ? 1.4 : 1;
      this.hits += k;
      this.go('hurt');
      this.f.sfx('callScreech', this.x, 0.9, 0.62);
      this.f.st.shake(1.5, 0.2);
      void floatText({ text: k > 1 ? 'THWACK!' : 'thwack!', x: this.x, y: this.y - 90, style: 'shout', ms: 900 });
      if (this.hits >= 3) this.tell('driven', 'aroha', 'That’s it! It’s had enough!');
      else this.tell('hit1', 'aroha', power >= 1.2 ? 'Good shot! That band bites!' : 'Again! Hit it again!');
      return;
    }
    if (this.flinchT > 0) return;
    this.flinchT = 4;
    this.tell('air', 'aroha', 'Not in the air! It shrugs that off! Wait till it’s down!', 'say');
  }
  private async tag() {
    if (this.state !== 'snared') return;
    const f = this.f;
    f.player.facing = this.x >= f.player.x ? 1 : -1;
    const r = await qte({ kind: 'seq', label: 'BAND ITS LEG!', count: 5, difficulty: 0.45, time: 4.5, f, pose: 'kneel' });
    if (r.ok) {
      setF('tb:tagged');
      void floatText({ text: 'Band on! Number 001. Go on, go home!', style: 'happy', ms: 2800 });
      this.flee(true);
    } else {
      // the wing catches him and the snare snaps
      const p = f.player;
      p.vx = (p.x >= this.x ? 1 : -1) * 220; p.vy = -140; p.onGround = false; p.hurtT = 1.2;
      p.body.react('jump');
      addHunger(0.06, 'predator');
      f.st.shake(3, 0.3);
      say(f, 'aroha', 'The wing! Get clear!', 'shout');
      this.climb();
    }
  }
  private onShot() {
    const f = this.f, p = f.player;
    if (!this.present || F('tb:photo')) return;
    const r = game.r;
    const sx = r.projectX(this.x, 1), sy = r.projectY(this.y - 50, 1);
    const onScreen = sx > -20 && sx < r.VW + 20 && sy > -20 && sy < r.VH + 20;
    if (!onScreen) return;
    const close = CLOSE.includes(this.state) && Math.abs(p.x - this.x) < 230;
    if (!close) { this.tell('photoFar', 'mori', 'Too far, too fast. I need it CLOSE. When it comes down.', 'think'); return; }
    setF('tb:photo');
    game.save.rp += 40; game.save.totalRp += 40;
    audio.play('discover', { vol: 0.6 });
    setTimeout(() => void floatText({ text: 'GOT IT. Oh... I got it. Te Pouākai. Wings like a storm.', style: 'happy', ms: 3200 }), 500);
  }
  flee(won: boolean) {
    if (this.state === 'flee') return;
    this.go('flee');
    this.facing = 1;
    this.f.sfx('callScreech', this.x, 0.8, 0.5);
    if (won && !F('tb:tagged')) setF('tb:driven');
    if (won) setTimeout(() => say(this.f, 'aroha', F('tb:photo') ? 'Ka pai, Mori. Ka pai. Now home, before the storm decides it wants us instead.' : 'It’s gone home. ...You didn’t get your photo, did you? It’ll be back. They always come back to the bait.', 'say', 4200), 1600);
  }
  private leave() {
    this.state = 'away';
    this.x = 3600;
    if (tbDone()) { this.storm.want = 0.25; this.rearm = 9999; }
    else { this.storm.want = 0.6; this.rearm = 40; }
  }
  draw(r: Renderer) {
    if (this.state === 'away') return;
    // the shadow (the dive's first tell) on the ground
    if (this.state === 'shadow' || this.state === 'shriek') {
      const sh = frameOf('shadow', thunderbirdShadow);
      const a = this.state === 'shadow' ? clamp(this.st / 0.6, 0, 1) : 1;
      const gx = this.state === 'shadow' ? this.shadowX : this.tx;
      r.draw(sh, Math.round(gx), Math.round(this.f.st.terrain.groundY(gx) - 2), 1, 1, 0, packColor(1, 1, 1, 0.75 * a));
    }
    const fr = birdFr(this.pose, this.frame);
    r.draw(fr, Math.round(this.x), Math.round(this.y), this.facing, 1);
  }
  dispose() {
    this.offTarget();
    const i = this.f.interact.indexOf(this.tagIt);
    if (i >= 0) this.f.interact.splice(i, 1);
  }
}

// ================================================================ the hide cloak, worn
/** a crouching, cloaked Mori turns into a clump of tussock */
class CloakDrape implements Drawable {
  z = 47;
  constructor(readonly f: FieldScene) {}
  draw(r: Renderer) {
    const p = this.f.player;
    if (!hasCloak() || !p.crouch || p.state === 'hide' || p.camera) return;
    r.draw(frameOf('drape', paintCloakDrape), Math.round(p.x), Math.round(p.y + 1), p.facing, 1);
  }
}

// ================================================================ attaching to a scene
interface HuntCtl { comp: Companion | null; storm: Storm | null; bird: Pouakai | null }
const CTL = new WeakMap<FieldScene, HuntCtl>();
export const huntOf = (f: FieldScene) => CTL.get(f) ?? null;

/** called for every field scene as it opens (loc: its location id) */
export function attachHunt(f: FieldScene, loc: string | null) {
  if (!f.main || !f.player || CTL.has(f)) return;
  const ctl: HuntCtl = { comp: null, storm: null, bird: null };
  CTL.set(f, ctl);
  // the cloak works anywhere it's owned
  f.main.add(new CloakDrape(f));
  const step = tbStep();
  if (loc && loc !== 'island' && step >= 2 && !tbDone()) { ctl.comp = new Companion(f, loc); f.main.add(ctl.comp); }
  if (loc === 'hills' && step >= 2) buildArena(f, ctl);
  const ex = f.exit.bind(f);
  f.exit = () => { ctl.comp?.dispose(); ctl.bird?.dispose(); ex(); };
}

function buildArena(f: FieldScene, ctl: HuntCtl) {
  const ter = f.st.terrain;
  // the blind (a hide spot: S to crouch into it)
  const bx = ARENA.blind, by = ter.groundY(bx);
  const blind = frameOf('blind', paintBlind);
  f.main.add({ z: 49, draw: (r: Renderer) => r.draw(blind, bx, by + 3) } as Drawable);
  f.player.hides.push({ x: bx, y: by, w: 56, cover: 0.92 });
  f.pois.push({ kind: 'cover', x: bx, y: by, w: 40 } as never);
  // the bait stone, a flat slab of granite
  const sx = ARENA.stone, sy = ter.groundY(sx);
  const slab = frameOf('slab', () => { const a = paintBoulder(9133, 46, 14); return { buf: a.buf, ax: a.ax, ay: a.ay }; });
  const bait = frameOf('bait', paintBaitWorld), snare = frameOf('snare', paintSnare);
  const storm = new Storm(f);
  const bird = new Pouakai(f, storm, ctl.comp);
  ctl.storm = storm; ctl.bird = bird;
  f.main.add({ z: 20, draw: (r: Renderer) => {
    r.draw(slab, sx, sy + 3);
    if (bird.baitOut) r.draw(bait, sx, sy - 9);
    if (bird.snareSet) r.draw(snare, sx - 30, sy + 1);
  } } as Drawable);
  const layBait: Interactable = {
    x: sx, y: sy - 8, w: 26, h: 20, label: 'Lay the storm bait on the stone', standX: sx - 24,
    enabled: () => !bird.baitOut && count('tb_bait') > 0 && tbStep() >= 3 && !tbDone(),
    quest: () => tbStep() === 4 && !bird.baitOut,
    action: () => {
      if (!remove('tb_bait', 1)) return;
      bird.baitOut = true;
      f.player.body.play('kneel', 'idle').catch(() => {});
      audio.play('place' as never, { vol: 0.5 });
      say(f, 'aroha', 'Good. Now out of sight. The blind, or under your cloak. And still.', 'whisper', 3000);
    },
  };
  const setSnare: Interactable = {
    x: sx - 30, y: sy - 6, w: 22, h: 18, label: 'Set Aroha’s snare by the bait (1 rope)', standX: sx - 50,
    enabled: () => bird.baitOut && !bird.snareSet && count('rope') > 0 && !tbDone(),
    action: () => {
      if (!remove('rope', 1)) return;
      bird.snareSet = true;
      f.player.body.play('kneel', 'idle').catch(() => {});
      audio.play('rope' as never, { vol: 0.5 });
      say(f, 'aroha', 'A running noose, pegged deep. When it steps in, you’ll have a few seconds. No more.', 'whisper', 3200);
    },
  };
  f.interact.push(layBait, setSnare);
  f.main.add(storm);
  f.main.add(bird);
  // the storm builds as you climb toward the ridge on the hunt
  f.main.add({ z: 0, draw() {}, update: () => {
    if (bird.state === 'away' && tbStep() === 3) storm.want = clamp((f.player.x - 2300) / 700, 0, 0.7);
  } } as Drawable);
  // its frames are painted a few at a time during the walk up
  let wi = 0;
  f.main.add({ z: 0, draw() {}, update: () => { if (wi < TB_ALL.length) { const [p, i] = TB_ALL[wi++]; birdFr(p, i); } } } as Drawable);
}

/** the dev panel / tests: start the encounter now (opts: the bird already down on the bait) */
export function startEncounter(f: FieldScene, o: { feeding?: boolean } = {}) {
  const ctl = CTL.get(f);
  const b = ctl?.bird;
  if (!b) return false;
  for (const [p, i] of TB_ALL) birdFr(p, i);
  b.begin();
  if (o.feeding) {
    b.baitOut = true;
    b.state = 'feed';
    b.x = ARENA.stone + 34;
    b.y = f.st.terrain.groundY(b.x);
    b.facing = -1;
    if (ctl.storm) ctl.storm.k = 0.85;
  }
  return true;
}

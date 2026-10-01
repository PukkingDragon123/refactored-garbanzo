// V4/V9 island: the Corvex Seal. Asleep on the seal rocks like a black boulder with a red face; in
// its sleep it scratches at the crown leeches in its neck folds, flicks wet sand over its back and
// yawns its raven-beak wide. Woken (by Chunk, naturally) it heaves up, shakes out its mane (and the
// odd leech), rears up with its throat sac ballooned and roars, then gallops after Mori in heaving
// bounds with the odd lunge. It is all sprint and no stamina: a few hundred metres on it flops down,
// pants with its tongue out, and falls straight back to sleep. If it catches you it just... lies on you.
//
// The story (islestory.ts) drives it through set(state); the crown leeches on its neck are their
// own camera subject, photographable from close up while the seal lies still.

import type { Renderer } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Drawable, Stage } from '../../world/stage';
import { A } from '../assets';
import { audio } from '../../core/audio';
import { rand } from '../../core/math';
import { groundY } from '../../art/island4/layout';
import type { Animal } from '../wild/animal';
import { gframe, animInfo, GF, ShoreBeast } from './shorelife';
import type { IslandScene4 } from './island';

export type SealState = 'sleep' | 'wake' | 'roar' | 'chase' | 'lunge' | 'pin' | 'tired' | 'asleep';

const ID = 'corvexseal';
const WARM = ['sleep', 'idle', 'scratch', 'flick', 'yawn', 'wake', 'roar', 'gallop', 'lunge', 'pin', 'tired'];

export class CorvexSeal implements Drawable {
  species = ID;
  z = 35;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  p = 1;
  facing = 1;
  dead = false;
  gone = false;
  hidden = 0;
  speed = 0;
  eco = { attacksPlayer: 0, aggro: 0 };
  anger = 0;
  act = 'idle';
  state: SealState = 'sleep';
  t = 0;
  private st = 0;
  private zT = 0;
  /** world x where it runs out of steam */
  tireX = 5000;
  onCatch: (() => void) | null = null;
  onTired: (() => void) | null = null;
  private lungeT = 2.5;
  /** seconds spent chasing (it runs out of steam either way) */
  chaseT = 0;
  /** what it is doing in its sleep: the idle sub-behaviour and how long it lasts */
  private nap: 'sleep' | 'scratch' | 'flick' | 'yawn' | 'stir' = 'sleep';
  private napT = rand.range(5, 9);
  private anim = 'sleep';
  private animT = 0;
  private warmI = 1;
  private warmT = 0;
  private dropped = false;
  readonly leeches: CrownLeechCluster;
  body = {
    bounds: () => this.box(),
    points: () => this.pts(),
  };

  constructor(readonly s: IslandScene4, x: number) {
    this.x = x;
    this.y = groundY(x) + 1;
    gframe(ID, 'sleep', 0);
    this.leeches = new CrownLeechCluster(this);
    s.animals.push(this.leeches as unknown as Animal);
  }

  get behavior() {
    switch (this.state) {
      case 'chase': case 'lunge': return 'charging';
      case 'roar': case 'wake': return 'roaring';
      case 'tired': return 'exhausted';
      case 'pin': return 'pinning';
      default: return this.nap === 'scratch' ? 'scratching' : this.nap === 'flick' ? 'flicking' : this.nap === 'yawn' ? 'yawning' : 'sleeping';
    }
  }
  get noticed() { return this.state !== 'sleep' && this.state !== 'asleep' && this.state !== 'tired'; }
  /** lying still (sleeping, dozing, exhausted, pinning): the leeches open their crowns */
  get lying() { return this.state === 'sleep' || this.state === 'asleep' || this.state === 'tired' || this.state === 'pin'; }

  private frame(): GF {
    const a = animInfo(ID, this.anim);
    let i: number;
    if (this.anim === 'gallop') i = Math.floor(((this.t * 9) / (Math.PI * 2) + 0.25) * a.frames); // synced to the surge
    else i = Math.floor(this.animT * a.fps);
    i = a.loop ? ((i % a.frames) + a.frames) % a.frames : Math.min(a.frames - 1, i);
    return gframe(ID, this.anim, i);
  }
  private box() {
    const f = this.frame();
    const x0 = this.facing > 0 ? this.x - f.ax : this.x - (f.w - f.ax);
    return { x0, y0: this.y - f.ay, x1: x0 + f.w, y1: this.y - f.ay + f.h };
  }
  private pts(): [number, number][] {
    return this.frame().pts.map(([px, py]) => [this.x + px * this.facing, this.y + py] as [number, number]);
  }
  /** world position of the neck crease where the crown leeches sit (behind the skull) */
  crease(): [number, number] {
    const f = this.frame();
    return [this.x + (f.head[0] - 13) * this.facing, this.y + f.head[1] + 19];
  }
  photoInfo() {
    return { species: ID, behavior: this.behavior, box: this.box(), pts: this.pts(), speed: this.speed, facing: this.facing, noticed: this.noticed, juvenile: false, p: 1, hidden: 0 };
  }

  private play(a: string, restart = false) {
    if (a !== this.anim || restart) { this.anim = a; this.animT = 0; }
  }

  set(state: SealState) {
    this.state = state;
    this.st = 0;
    this.act = state === 'chase' || state === 'lunge' ? 'attack' : 'idle';
    this.eco.attacksPlayer = state === 'chase' || state === 'lunge' ? 1 : 0;
    this.anger = this.eco.attacksPlayer;
    this.nap = 'sleep';
    this.napT = rand.range(6, 11);
    if (state !== 'pin' && this.z !== 35) { this.z = 35; this.s.main.markDirty(); }
    switch (state) {
      case 'sleep': case 'asleep': this.play('sleep'); break;
      case 'wake': this.play('wake', true); this.dropped = false; audio.play('callGrunt', { vol: 0.6, pitch: 0.4 }); break;
      case 'roar':
        this.play('roar', true);
        audio.play('roar', { vol: 0.8, pitch: 0.7 });
        audio.play('callGrunt', { vol: 0.9, pitch: 0.45 });
        this.s.st.shake(5, 0.8);
        break;
      case 'chase': this.play('gallop'); break;
      case 'lunge': this.play('lunge', true); break;
      case 'pin':
        // it flops down right on top of you
        this.play('pin', true);
        this.z = 56;
        this.s.main.markDirty();
        break;
      case 'tired': this.play('tired', true); break;
    }
  }

  update(dt: number, st: Stage) {
    this.t += dt;
    this.st += dt;
    this.animT += dt;
    const p = this.s.player;
    this.y = groundY(this.x) + 1;
    this.vx = 0;
    this.leeches.refresh();
    // pre-render one more animation strip every so often while nothing is happening
    this.warmT -= dt;
    if (this.warmI < WARM.length && this.warmT <= 0 && (this.state === 'sleep' || this.state === 'asleep')) {
      gframe(ID, WARM[this.warmI++], 0);
      this.warmT = 0.6;
    }
    switch (this.state) {
      case 'sleep':
      case 'asleep':
        this.speed = 0;
        this.doze(dt);
        break;
      case 'wake':
        // the shake throws a crown leech or two off the neck onto the sand
        if (!this.dropped && this.animT > 0.42) {
          this.dropped = true;
          const n = 1 + (rand.chance(0.5) ? 1 : 0);
          for (let i = 0; i < n; i++) {
            const [cx, cy] = this.crease();
            this.s.main.add(new CrownLeech(this.s, this, cx + rand.range(-4, 4), cy, rand.range(-30, 30)));
          }
        }
        if (this.st > 0.9) this.set('roar');
        break;
      case 'roar':
        this.speed = 0;
        if (this.st > 1.6) this.set('chase');
        break;
      case 'chase':
      case 'lunge': {
        const d = p.x - this.x;
        this.facing = d >= 0 ? 1 : -1;
        this.lungeT -= dt;
        if (this.state === 'chase' && this.lungeT <= 0 && Math.abs(d) < 150) { this.set('lunge'); this.lungeT = rand.range(1.8, 3); this.s.sfx('callGrunt', this.x, 0.7, 0.5); }
        if (this.state === 'lunge' && this.st > 0.45) this.set('chase');
        const v = this.state === 'lunge' ? 150 : 86;
        // a heaving gallop: surges on the push stroke
        const surge = 0.65 + 0.55 * Math.max(0, Math.sin(this.t * 9));
        this.speed = v * surge;
        this.vx = this.facing * this.speed;
        this.x += this.vx * dt;
        if (Math.abs(d) < 34 && p.y > groundY(p.x) - 20) { this.set('pin'); this.onCatch?.(); }
        this.chaseT += dt;
        if (this.x > this.tireX || this.chaseT > 9) { this.set('tired'); this.onTired?.(); }
        // every landing thumps the beach and kicks up sand
        if (Math.sin(this.t * 9) > 0.95 && Math.sin((this.t - dt) * 9) <= 0.95) { st.shake(1.4, 0.12); this.s.sfx('land', this.x, 0.35, 0.45); }
        if (rand.chance(dt * 7)) this.s.main.particles.spawn({ frame: A.dot2, x: this.x - 20 * this.facing + rand.range(-24, 24), y: this.y - 1, vx: -this.facing * rand.range(20, 60), vy: rand.range(-50, -20), ay: 200, life: 0.6, color: [0.92, 0.84, 0.64], alpha: 0.9, alpha1: 0, floorY: this.y + 2 });
        break;
      }
      case 'pin':
        this.speed = 0;
        break;
      case 'tired':
        this.speed = 0;
        if (rand.chance(dt * 2.5)) this.s.sfx('callGrunt', this.x, 0.18, 0.75);
        if (this.st > 5) this.set('asleep');
        break;
    }
  }

  /** asleep: snoring, with the odd scratch, sand flick, yawn, or a stir when you are noisy nearby */
  private doze(dt: number) {
    const p = this.s.player;
    this.napT -= dt;
    this.zT -= dt;
    if (this.nap === 'sleep') {
      this.play('sleep');
      if (this.zT <= 0) {
        this.zT = 1.4;
        const [hx, hy] = this.crease();
        this.s.main.particles.spawn({ frame: A.dot2, x: hx + 30 * this.facing, y: hy - 14, vx: 8 * this.facing, vy: -14, life: 2.2, color: [0.95, 0.95, 1], alpha: 0.8, alpha1: 0, size: 1.4, size1: 2.4 });
      }
      if (rand.chance(dt * 0.3)) this.s.sfx('callGrunt', this.x, 0.2, 0.4);
      // footsteps close by make it stir (lift its head, look, settle again)
      const loud = Math.abs(p.x - this.x) < 150 && p.noise > 0.5;
      if (loud && rand.chance(dt * 1.5)) { this.nap = 'stir'; this.napT = 2.4; this.play('idle', true); this.s.sfx('callGrunt', this.x, 0.35, 0.5); }
      else if (this.napT <= 0) {
        const r = rand.next();
        this.nap = r < 0.4 ? 'scratch' : r < 0.75 ? 'flick' : 'yawn';
        this.napT = this.nap === 'scratch' ? 2.6 : this.nap === 'flick' ? 1.5 : 1.3;
        this.play(this.nap, true);
        if (this.nap === 'yawn') this.s.sfx('callGrunt', this.x, 0.25, 0.55);
        if (this.nap === 'flick') this.s.sfx('rustle', this.x, 0.2, 0.7);
      }
    } else if (this.napT <= 0) {
      this.nap = 'sleep';
      this.napT = rand.range(7, 14);
      this.play('sleep');
    }
  }

  draw(r: Renderer) {
    const f = this.frame();
    r.beginShadows();
    r.draw(A.shadow, this.x, this.y, 2.6, 0.8, 0, packColor(0, 0, 0, 0.4));
    r.endShadows();
    r.draw(f.fr, this.x, this.y, this.facing, 1);
  }
}

/** the crown leeches in the seal's neck crease, as one camera subject (only from close up) */
class CrownLeechCluster {
  species = 'crownleech';
  z = 0;
  p = 1;
  vx = 0;
  vy = 0;
  dead = false;
  gone = false;
  hidden = 1;
  eco = { attacksPlayer: 0, aggro: 0 };
  anger = 0;
  act = 'idle';
  noticed = false;
  get x() { return this.seal.crease()[0]; }
  get y() { return this.seal.crease()[1]; }
  body = {
    bounds: () => { const [x, y] = this.seal.crease(); return { x0: x - 6, y0: y - 12, x1: x + 6, y1: y + 12 }; },
    points: (): [number, number][] => { const [x, y] = this.seal.crease(); return [[x, y - 8], [x - 1, y - 3], [x + 1, y + 2], [x, y + 7]]; },
  };
  constructor(readonly seal: CorvexSeal) {}
  get behavior() { return this.seal.state === 'sleep' || this.seal.state === 'asleep' ? 'crowning' : 'clinging'; }
  /** too small to make out unless you are close and the seal is lying still */
  refresh() {
    const near = Math.abs(this.seal.s.player.x - this.x) < 120;
    this.hidden = this.seal.lying && near ? 0 : 1;
  }
  photoInfo() {
    this.refresh();
    return { species: 'crownleech', behavior: this.behavior, box: this.body.bounds(), pts: this.body.points(), speed: 0, facing: this.seal.facing, noticed: false, juvenile: false, p: 1, hidden: this.hidden };
  }
}

/** a crown leech shaken off onto the sand: it loops back toward its seal like an inchworm */
class CrownLeech extends ShoreBeast {
  private life = rand.range(40, 70);
  private quest = rand.range(3, 6);
  private fall = true;
  constructor(s: IslandScene4, readonly seal: CorvexSeal, x: number, y: number, vx: number) {
    super('crownleech', s, x, y);
    this.vx = vx;
    this.vy = -40;
    this.play('curl');
    this.z = 36;
    s.animals.push(this as unknown as Animal);
  }
  protected think(dt: number) {
    const gy = groundY(this.x) + 2;
    this.life -= dt;
    if (this.fall) {
      this.vy += 260 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.behavior = 'inching';
      if (this.y >= gy) { this.y = gy; this.fall = false; this.vx = 0; this.vy = 0; this.st = 0; }
      return;
    }
    this.y = gy;
    this.shadowY = NaN;
    this.quest -= dt;
    const dx = this.seal.x - this.x;
    if (this.quest <= 0 && this.anim !== 'rear') { this.play('rear', true); this.st = 0; }
    if (this.anim === 'rear') {
      // reared up, crown open, tasting the air for its seal
      this.behavior = 'questing';
      this.facing = Math.sign(dx) || 1;
      if (this.st > 2) { this.play('inch'); this.quest = rand.range(4, 8); }
    } else {
      this.play('inch');
      this.behavior = 'inching';
      this.facing = Math.sign(dx) || 1;
      // the loop gait: only moves while the body stretches out
      const a = animInfo('crownleech', 'inch');
      const fi = Math.floor(this.animT * a.fps) % a.frames;
      if (fi >= 3) { this.x += this.facing * 7 * dt; this.vx = this.facing * 7; } else this.vx = 0;
    }
    // back on the seal (it climbs up into the folds), or dried out on the sand
    if (Math.abs(dx) < 30 && this.seal.lying) this.gone = true;
    if (this.life <= 0) { this.play('curl'); this.alpha -= dt * 0.5; if (this.alpha <= 0) this.gone = true; }
    if (this.gone) this.dead = true;
  }
}

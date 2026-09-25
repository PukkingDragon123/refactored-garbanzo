// Birds of Zealandia: perch / walk / fly / glide / dive / swim behaviours on pre-rendered frames.

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Stage } from '../../world/stage';
import { Creature, Ctx, Box, eatLure } from './creature';
import { birds, A } from '../assets';
import { audio } from '../../core/audio';
import { clamp, damp, lerp, rand } from '../../core/math';
import type { SerpentBase } from './serpents';

export type Perch = { x: number; y: number; kind?: 'nest' | 'rock' | 'tree' | 'ledge' };

export abstract class Bird extends Creature {
  frames: Record<string, Frame[]>;
  anim = 'stand';
  vx = 0;
  vy = 0;
  fly = false;
  target: [number, number] | null = null;
  perches: Perch[];
  perch: Perch | null = null;
  scale = 1;
  carrying: SerpentBase | null = null;
  constructor(id: string, x: number, y: number, perches: Perch[]) {
    super(id, x, y);
    this.frames = birds[id];
    this.perches = perches;
    this.sight = 160;
    this.eats = ['fish'];
  }
  bounds(): Box {
    const f = this.frames.stand[0];
    const w = f.w * 0.55 * this.scale, h = f.h * (this.fly ? 0.5 : 0.7) * this.scale;
    const cy = this.fly ? this.y - f.h * 0.45 : this.y - h / 2;
    return { x0: this.x - w / 2, y0: cy - h / 2, x1: this.x + w / 2, y1: cy + h / 2 };
  }
  head(): [number, number] {
    const b = this.bounds();
    return [this.x + this.facing * (b.x1 - b.x0) * 0.4, b.y0 + 2];
  }
  /** steer flight toward target; returns true on arrival */
  flyTo(tx: number, ty: number, dt: number, speed: number, accel = 3) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    const want = Math.min(speed, d * 2.2);
    this.vx = damp(this.vx, (dx / (d || 1)) * want, accel, dt);
    this.vy = damp(this.vy, (dy / (d || 1)) * want, accel, dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (Math.abs(this.vx) > 3) this.facing = Math.sign(this.vx);
    this.fly = true;
    this.anim = this.vy > 30 && Math.abs(this.vx) < 60 ? 'glide' : 'fly';
    return d < 4;
  }
  land(p: Perch) {
    this.x = p.x;
    this.y = p.y;
    this.vx = this.vy = 0;
    this.fly = false;
    this.perch = p;
    this.anim = 'stand';
  }
  onAlert(ctx: Ctx) {
    this.fleeing = true;
    this.perch = null;
    const dir = Math.sign(this.x - ctx.player.x) || 1;
    this.target = [this.x + dir * 700, this.y - 260];
    this.setState('flee', 'flying');
    audio.play('wingFlap', { vol: 0.6 });
    audio.play('birdCall', { vol: 0.4, pitch: 1.3 });
  }
  startle(fromX: number) {
    this.fleeing = true;
    this.target = [this.x + Math.sign(this.x - fromX || 1) * 600, this.y - 220];
    this.setState('flee', 'flying');
  }
  commonFlee(dt: number) {
    if (this.state === 'flee' && this.target) {
      this.flyTo(this.target[0], this.target[1], dt, 170, 2.5);
      return true;
    }
    return false;
  }
  draw(r: Renderer, st: Stage) {
    const fr = this.frames[this.anim] ?? this.frames.stand;
    const fps = this.anim === 'fly' ? 12 : this.anim === 'walk' ? 8 : this.anim === 'display' || this.anim === 'call' ? 4 : 1.5;
    const f = fr[Math.floor(this.t * fps) % fr.length];
    const flyOff = this.fly ? f.h * 0.45 : 0;
    if (!this.fly && this.anim !== 'swim') {
      r.beginShadows();
      r.draw(A.shadow, this.x, this.y + 1, 0.4 * this.scale, 0.6, 0, packColor(0, 0, 0, 0.35));
      r.endShadows();
    }
    let rot = 0;
    if (this.anim === 'dive') rot = this.facing * 1.1;
    r.draw(f, this.x, this.y + flyOff, this.facing * this.scale, this.scale, rot);
    void st;
  }
}

// ------------------------------------------------------------------ GALE HAWK
export class GaleHawk extends Bird {
  prey: SerpentBase | null = null;
  cd = 8;
  circleA = rand.next() * 6;
  constructor(x: number, y: number, perches: Perch[]) {
    super('galehawk', x, y, perches);
    this.sight = 200;
    this.wary = 0.7;
    this.scale = 1;
    const p = perches.length ? rand.pick(perches) : null;
    if (p) this.land(p);
    this.setState('perch', 'perched');
  }
  think(dt: number, ctx: Ctx) {
    this.cd -= dt;
    if (this.commonFlee(dt)) return;
    switch (this.state) {
      case 'perch':
        this.anim = this.stateT % 5 < 0.6 ? 'call' : 'stand';
        if (this.stateT % 5 < dt) audio.play('birdCall', { vol: 0.25, pitch: 0.7 });
        if (this.stateT > 9) this.setState('soar', 'soaring');
        break;
      case 'soar': {
        this.circleA += dt * 0.5;
        const cx = clamp(ctx.player.x + Math.sin(this.circleA * 0.3) * 220, ctx.worldMinX, ctx.worldMaxX);
        this.flyTo(cx + Math.cos(this.circleA) * 120, 40 + Math.sin(this.circleA) * 25, dt, 70, 1.5);
        this.anim = Math.sin(this.t * 0.8) > 0.3 ? 'fly' : 'glide';
        // spot a gliding Skyribbon
        if (this.cd <= 0) {
          const s = ctx.creatures.find(c => c.id === 'skyribbon' && c.state === 'glide') as SerpentBase | undefined;
          if (s) { this.prey = s; this.setState('dive', 'diving'); audio.play('whoosh', { vol: 0.6, pitch: 0.8 }); }
          else if (this.stateT > 14 && rand.chance(dt * 0.3)) {
            const p = rand.pick(this.perches);
            if (p) { this.target = [p.x, p.y]; this.setState('toPerch', 'soaring'); }
          }
        }
        break;
      }
      case 'toPerch':
        if (this.target && this.flyTo(this.target[0], this.target[1], dt, 90)) {
          const p = this.perches.find(pp => Math.abs(pp.x - this.target![0]) < 2);
          if (p) this.land(p);
          this.setState('perch', 'perched');
        }
        break;
      case 'dive': {
        const s = this.prey;
        if (!s || s.dead || s.state !== 'glide') { this.setState('soar', 'soaring'); this.cd = 6; break; }
        this.anim = 'dive';
        const [hx, hy] = s.head();
        this.flyTo(hx, hy - 4, dt, 260, 6);
        this.anim = 'dive';
        if (Math.hypot(hx - this.x, hy - this.y) < 10) {
          this.carrying = s;
          s.setState('carried', null);
          s.fleeing = true;
          this.target = [this.x + this.facing * 800, -200];
          this.setState('carry', 'carrying');
          audio.play('birdCall', { vol: 0.6, pitch: 0.8 });
        }
        break;
      }
      case 'carry': {
        this.flyTo(this.target![0], this.target![1], dt, 80, 1.5);
        const s = this.carrying;
        if (s) {
          s.moveHead(this.x + this.facing * 2, this.y + 6);
          for (let i = 1; i < s.pts.length; i++) s.pts[i][1] = lerp(s.pts[i][1], s.pts[i - 1][1] + 1.2, 0.3);
          s.flatten = 0;
        }
        if (this.y < -150) { this.dead = true; if (s) s.dead = true; }
        break;
      }
    }
  }
}

// ------------------------------------------------------------------ CRAG AUK
export class CragAuk extends Bird {
  home: Perch;
  constructor(x: number, y: number, perches: Perch[], home: Perch) {
    super('cragauk', x, y, perches);
    this.home = home;
    this.sight = 120;
    this.land(home);
    this.setState('nest', 'nesting');
  }
  think(dt: number, ctx: Ctx) {
    if (this.commonFlee(dt)) {
      if (this.y < this.home.y - 150 && this.stateT > 6) { this.fleeing = false; this.target = [this.home.x, this.home.y]; this.setState('return', 'flying'); }
      return;
    }
    const wy = ctx.waterY ?? 240;
    switch (this.state) {
      case 'nest':
        this.anim = 'stand';
        if (this.stateT > 4 && rand.chance(dt * 0.25)) this.setState('display', 'display');
        if (this.stateT > 10 && rand.chance(dt * 0.15)) { this.target = [this.x + rand.range(-160, 160), wy - 30]; this.setState('fishFly', 'flying'); }
        break;
      case 'display':
        this.anim = 'display';
        if (this.stateT < dt * 2) audio.play('birdCall', { vol: 0.35, pitch: 1.5 });
        if (this.stateT > 2.5) this.setState('nest', 'nesting');
        break;
      case 'fishFly':
        if (this.flyTo(this.target![0], this.target![1], dt, 110)) this.setState('dive', 'diving');
        break;
      case 'dive':
        this.anim = 'dive';
        this.fly = true;
        this.y += 160 * dt;
        this.x += this.facing * 30 * dt;
        if (this.y >= wy) { ctx.splash(this.x, wy, 0.7); this.y = wy; this.setState('swim', 'diving'); }
        break;
      case 'swim':
        this.fly = false;
        this.anim = 'swim';
        this.y = wy + 1;
        this.x += this.facing * 8 * dt;
        if (this.lureTarget) eatLure(this, dt);
        if (this.stateT > 3) { this.target = [this.home.x, this.home.y]; this.setState('return', 'flying'); ctx.splash(this.x, wy, 0.4); }
        break;
      case 'return':
        if (this.flyTo(this.home.x, this.home.y, dt, 120)) { this.land(this.home); this.setState('nest', 'nesting'); }
        break;
    }
  }
}

// ------------------------------------------------------------------ TORRENT DIPPER
export class TorrentDipper extends Bird {
  constructor(x: number, y: number, perches: Perch[]) {
    super('torrentdipper', x, y, perches);
    this.sight = 110;
    const p = rand.pick(perches);
    if (p) this.land(p);
    this.setState('bob', 'bobbing');
  }
  think(dt: number, ctx: Ctx) {
    if (this.commonFlee(dt)) return;
    const wy = ctx.waterY ?? 240;
    switch (this.state) {
      case 'bob':
        this.anim = Math.sin(this.t * 7) > 0 ? 'stand' : 'peck';
        if (this.stateT > 6 && rand.chance(dt * 0.4)) this.setState('dive', 'diving');
        if (this.stateT > 9 && rand.chance(dt * 0.3)) { const p = rand.pick(this.perches); this.target = [p.x, p.y]; this.setState('hop', 'flying'); }
        break;
      case 'dive':
        this.anim = 'swim';
        this.submerged = this.stateT > 0.4 && this.stateT < 3;
        this.hiddenFromCamera = this.submerged;
        if (this.stateT < 0.4) this.y = lerp(this.y, wy + 1, 0.2);
        if (Math.abs(this.stateT - 0.4) < dt) ctx.splash(this.x, wy, 0.4);
        if (this.stateT > 3) { this.submerged = false; this.hiddenFromCamera = false; const p = rand.pick(this.perches); this.target = [p.x, p.y]; this.setState('hop', 'flying'); ctx.splash(this.x, wy, 0.3); }
        break;
      case 'hop':
        if (this.flyTo(this.target![0], this.target![1], dt, 110)) {
          const p = this.perches.find(pp => Math.abs(pp.x - this.target![0]) < 2);
          if (p) this.land(p);
          this.setState('bob', 'bobbing');
        }
        break;
    }
  }
  draw(r: Renderer, st: Stage) {
    if (this.submerged) return;
    super.draw(r, st);
  }
}

// ------------------------------------------------------------------ SERPENT STORK
export class SerpentStork extends Bird {
  tx: number;
  holding = false;
  constructor(x: number, y: number, perches: Perch[]) {
    super('snakestork', x, y, perches);
    this.tx = x;
    this.sight = 150;
    this.fly = false;
    this.setState('stalk', 'stalking');
  }
  think(dt: number, ctx: Ctx) {
    if (this.commonFlee(dt)) return;
    const gy = Math.min(ctx.terrain.groundY(this.x), (ctx.waterY ?? 1e4) + 6);
    this.y = damp(this.y, gy, 10, dt);
    switch (this.state) {
      case 'stalk': {
        this.anim = Math.floor(this.stateT * 1.2) % 3 === 2 ? 'stand' : 'walk';
        if (this.anim === 'walk') this.moveToward(this.tx, 9, dt);
        if (Math.abs(this.tx - this.x) < 3) this.tx = clamp(this.x + rand.range(-120, 120), ctx.worldMinX + 50, ctx.worldMaxX - 50);
        const prey = ctx.creatures.find(c => c.id === 'mudribbon' && !c.fleeing && Math.abs(c.x - this.x) < 90);
        if (prey && this.stateT > 3) { this.tx = prey.x; this.setState('strike', 'stalking'); this.prey = prey; }
        if (this.stateT > 20 && rand.chance(dt * 0.2)) this.setState('display', 'display');
        break;
      }
      case 'strike': {
        const p = this.prey;
        if (!p || p.dead) { this.setState('stalk', 'stalking'); break; }
        this.anim = 'walk';
        if (this.moveToward(p.x, 18, dt) || Math.abs(p.x - this.x) < 12) {
          this.anim = 'peck';
          this.setState('catch', 'catching');
          ctx.splash(this.x + this.facing * 10, (ctx.waterY ?? this.y), 0.6);
          p.dead = true;
          this.holding = true;
        }
        break;
      }
      case 'catch':
        this.anim = this.stateT < 1.2 ? 'peck' : 'call';
        if (this.stateT > 4) { this.holding = false; this.setState('stalk', 'stalking'); }
        break;
      case 'display':
        this.anim = 'display';
        if (Math.floor(this.stateT * 6) !== Math.floor((this.stateT - dt) * 6)) audio.play('chirp', { vol: 0.35, pitch: 0.5 });
        if (this.stateT > 3) this.setState('stalk', 'stalking');
        break;
    }
    if (this.lureTarget && this.state === 'stalk') this.tx = this.lureTarget.x;
  }
  prey: Creature | null = null;
  draw(r: Renderer, st: Stage) {
    super.draw(r, st);
    if (this.holding) {
      // wriggling mudribbon in the bill
      const bx = this.x + this.facing * 22, by = this.y - 34;
      for (let i = 0; i < 10; i++) r.rect(bx + this.facing * i * 0.6 + Math.sin(this.t * 12 + i) * 1.5, by + i * 1.4, 2, 2, packColor(0.45, 0.35, 0.2, 1));
    }
  }
}

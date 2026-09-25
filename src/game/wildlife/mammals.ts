// Mammals of Zealandia: armour, quills, burrows, gliding membranes and extreme agility.

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Stage } from '../../world/stage';
import { Terrain, Surface } from '../../world/terrain';
import { Creature, Ctx, Box, eatLure } from './creature';
import { mammals, A } from '../assets';
import { audio } from '../../core/audio';
import { clamp, damp, lerp, rand } from '../../core/math';

export abstract class Mammal extends Creature {
  frames: Record<string, Frame[]>;
  anim = 'stand';
  tx: number;
  speed = 20;
  vy = 0;
  airborne = false;
  surface: Surface | null = null;
  scale = 1;
  clipTop = 0; // for burrow peeking: hide bottom portion
  constructor(id: string, x: number, y: number) {
    super(id, x, y);
    this.frames = mammals[id];
    this.tx = x;
  }
  bounds(): Box {
    const f = this.frames.stand[0];
    const w = f.w * 0.5, h = f.h * 0.55;
    return { x0: this.x - w / 2, y0: this.y - h - (this.clipTop ? -this.clipTop : 0), x1: this.x + w / 2, y1: this.y };
  }
  head(): [number, number] {
    const f = this.frames.stand[0];
    return [this.x + this.facing * f.w * 0.22, this.y - f.h * 0.45];
  }
  groundY(ctx: Ctx, x = this.x) {
    if (this.surface) {
      const y = Terrain.yAt(this.surface, x);
      if (y !== null) return y;
    }
    const s = ctx.terrain.surfaceBelow(x, this.y - 8, 0, false);
    return s ? s.y : ctx.terrain.groundY(x);
  }
  walk(ctx: Ctx, dt: number, speed = this.speed) {
    const arrived = this.moveToward(this.tx, speed, dt);
    this.y = damp(this.y, this.groundY(ctx), 20, dt);
    this.anim = arrived ? 'stand' : speed > 40 ? 'run' : 'walk';
    return arrived;
  }
  startle(fromX: number) {
    if (this.fleeing) return;
    this.fleeing = true;
    this.tx = this.x + Math.sign(this.x - fromX || 1) * 900;
    this.setState('flee', null);
  }
  onAlert(ctx: Ctx) {
    this.startle(ctx.player.x);
  }
  draw(r: Renderer, st: Stage) {
    const fr = this.frames[this.anim] ?? this.frames.stand;
    const fps = this.anim === 'run' ? 12 : this.anim === 'walk' ? 7 : 2;
    const f = fr[Math.floor(this.t * fps) % fr.length];
    if (!this.airborne && !this.clipTop) {
      r.beginShadows();
      r.draw(A.shadow, this.x, this.y + 1, 0.45 * this.scale, 0.6, 0, packColor(0, 0, 0, 0.35));
      r.endShadows();
    }
    if (this.clipTop > 0) {
      // peeking out of a burrow: draw only the top part above the ground
      const vis = Math.max(0, f.h - this.clipTop);
      if (vis > 0) r.drawSub(f, 0, 0, f.w, vis, this.facing > 0 ? this.x - f.ax : this.x + f.ax, this.y - f.h + this.clipTop, this.facing, 1);
      return;
    }
    r.draw(f, this.x, this.y, this.facing * this.scale, this.scale, this.anim === 'glide' ? -this.facing * 0.15 : 0);
    void st;
  }
}

// ------------------------------------------------------------------ SHIELDBACK
export class Shieldback extends Mammal {
  constructor(x: number, y: number) {
    super('shieldback', x, y);
    this.speed = 14;
    this.sight = 90;
    this.eats = ['fruit', 'grub'];
    this.setState('forage', 'foraging');
  }
  onAlert() {
    this.setState('ball', 'rolled');
    audio.play('rustle', { vol: 0.4, pitch: 0.7 });
  }
  startle() {
    this.setState('ball', 'rolled');
  }
  think(dt: number, ctx: Ctx) {
    // a serpent nearby makes it roll up
    if (this.state !== 'ball') for (const c of ctx.creatures) if ((c.id === 'strider' || c.id === 'sprinter') && Math.abs(c.x - this.x) < 50) { this.setState('ball', 'rolled'); break; }
    switch (this.state) {
      case 'forage':
        if (this.lureTarget) this.tx = this.lureTarget.x - 10;
        if (this.walk(ctx, dt)) {
          if (this.lureTarget) { this.anim = 'eat'; eatLure(this, dt); this.behavior = 'foraging'; }
          else if (rand.chance(0.5)) this.setState('dig', 'digging');
          else this.tx = clamp(this.x + rand.range(-140, 140), ctx.worldMinX + 30, ctx.worldMaxX - 30);
        } else this.anim = Math.floor(this.t * 0.7) % 3 === 0 ? 'eat' : 'walk';
        break;
      case 'dig':
        this.anim = 'dig';
        if (rand.chance(dt * 10)) ctx.main.particles.spawn({ frame: A.dot, x: this.x + this.facing * 8, y: this.y - 1, vx: -this.facing * rand.range(10, 40), vy: rand.range(-40, -10), ay: 160, life: 0.6, color: [0.35, 0.25, 0.16], alpha: 1, alpha1: 1 });
        if (this.stateT > 4) this.setState('forage', 'foraging');
        break;
      case 'ball':
        this.anim = 'ball';
        if (this.stateT > 6 && this.aware < 0.5) this.setState('forage', 'foraging');
        break;
    }
    this.y = damp(this.y, this.groundY(ctx), 20, dt);
  }
}

// ------------------------------------------------------------------ QUILLHOG
export class Quillhog extends Mammal {
  constructor(x: number, y: number) {
    super('quillhog', x, y);
    this.speed = 16;
    this.sight = 80;
    this.eats = ['fruit'];
    this.setState('forage', 'foraging');
  }
  onAlert() {
    this.setState('quill', 'quills');
    audio.play('rustle', { vol: 0.6, pitch: 1.6 });
  }
  think(dt: number, ctx: Ctx) {
    if (this.state !== 'quill') for (const c of ctx.creatures) if ((c.id === 'sprinter' || c.id === 'strider') && Math.abs(c.x - this.x) < 60) { this.setState('quill', 'quills'); break; }
    if (this.fleeing) { this.walk(ctx, dt, 45); return; }
    switch (this.state) {
      case 'forage':
        if (this.lureTarget) {
          this.tx = this.lureTarget.x - 10;
          if (this.walk(ctx, dt)) this.setState('eat', 'eating');
        } else if (this.walk(ctx, dt)) {
          if (rand.chance(0.4)) this.setState('snuffle', 'foraging');
          this.tx = clamp(this.x + rand.range(-150, 150), ctx.worldMinX + 30, ctx.worldMaxX - 30);
        }
        break;
      case 'snuffle':
        this.anim = 'eat';
        if (this.stateT > 3) this.setState('forage', 'foraging');
        break;
      case 'eat':
        this.anim = 'eat';
        eatLure(this, dt);
        if (!this.lureTarget || this.stateT > 12) this.setState('forage', 'foraging');
        break;
      case 'quill':
        this.anim = 'quill';
        this.facing = Math.sign(ctx.player.x - this.x) || this.facing;
        if (this.stateT > 4) { if (this.aware > 0.8) this.startle(ctx.player.x); else this.setState('forage', 'foraging'); }
        break;
    }
  }
}

// ------------------------------------------------------------------ TUNNEL DELVER
export class Delver extends Mammal {
  holes: number[];
  hole: number;
  hideT = 0;
  constructor(x: number, y: number, holes: number[]) {
    super('delver', x, y);
    this.holes = holes;
    this.hole = x;
    this.speed = 18;
    this.sight = 130;
    this.wary = 1.3;
    this.eats = ['fruit'];
    this.clipTop = 10;
    this.setState('peek', 'peeking');
  }
  onAlert() {
    this.setState('hide', null);
    audio.play('chirp', { vol: 0.4, pitch: 2 });
  }
  startle() {
    this.setState('hide', null);
  }
  think(dt: number, ctx: Ctx) {
    this.y = this.groundY(ctx, this.hole);
    switch (this.state) {
      case 'peek':
        this.x = this.hole;
        this.clipTop = damp(this.clipTop, 5, 6, dt);
        this.anim = this.stateT % 3 < 1.5 ? 'rear' : 'stand';
        this.facing = Math.sin(this.t * 0.4) > 0 ? 1 : -1;
        if (this.stateT > 5) this.setState(rand.chance(0.6) ? 'out' : 'peek', rand.chance(0.6) ? 'eating' : 'peeking');
        break;
      case 'out':
        this.clipTop = damp(this.clipTop, 0, 8, dt);
        if (this.clipTop < 0.5) this.clipTop = 0;
        this.tx = this.lureTarget ? this.lureTarget.x : this.hole + Math.sin(this.stateT * 0.5) * 24;
        if (this.walk(ctx, dt)) { this.anim = this.lureTarget ? 'eat' : 'dig'; this.behavior = this.lureTarget ? 'eating' : 'digging'; if (this.lureTarget) eatLure(this, dt); }
        this.y = this.groundY(ctx);
        if (this.stateT > 10) { this.setState('return', null); }
        break;
      case 'return':
        this.tx = this.hole;
        if (this.walk(ctx, dt, 30)) this.setState('peek', 'peeking');
        this.y = this.groundY(ctx);
        break;
      case 'hide':
        this.tx = this.hole;
        if (Math.abs(this.x - this.hole) > 2) { this.walk(ctx, dt, 60); this.y = this.groundY(ctx); }
        else {
          this.clipTop = damp(this.clipTop, 30, 10, dt);
          this.hideT += dt;
          if (this.stateT > 6 && this.aware < 0.4) {
            this.hole = rand.pick(this.holes);
            this.x = this.hole;
            this.setState('peek', 'peeking');
          }
        }
        break;
    }
    this.hiddenFromCamera = this.clipTop > 18;
  }
}

// ------------------------------------------------------------------ SAIL POSSUM (glider)
export class SailPossum extends Mammal {
  flowers: [number, number][];
  glide: { x0: number; y0: number; x1: number; y1: number; t: number; T: number; s: Surface } | null = null;
  constructor(x: number, y: number, flowers: [number, number][]) {
    super('sailglider', x, y);
    this.flowers = flowers;
    this.speed = 22;
    this.sight = 110;
    this.setState('run', null);
  }
  launch(ctx: Ctx) {
    const cand = ctx.terrain.surfaces.filter(s => s.oneWay && s !== this.surface);
    const opts = cand.filter(s => {
      const cx = (s.pts[0][0] + s.pts[s.pts.length - 1][0]) / 2;
      return Math.abs(cx - this.x) > 70 && Math.abs(cx - this.x) < 320 && (Terrain.yAt(s, cx) ?? 0) > this.y - 10;
    });
    if (!opts.length) return false;
    const s = rand.pick(opts);
    const x1 = clamp(this.x + Math.sign(((s.pts[0][0] + s.pts[s.pts.length - 1][0]) / 2) - this.x) * rand.range(80, 180), s.pts[0][0] + 6, s.pts[s.pts.length - 1][0] - 6);
    const y1 = Terrain.yAt(s, x1) ?? this.y;
    this.glide = { x0: this.x, y0: this.y, x1, y1, t: 0, T: Math.abs(x1 - this.x) / 80 + 0.5, s };
    this.facing = Math.sign(x1 - this.x) || 1;
    this.setState('glide', 'gliding');
    return true;
  }
  onAlert(ctx: Ctx) {
    if (!this.launch(ctx)) this.startle(ctx.player.x);
  }
  startle(fromX: number) {
    this.aware = 1;
    this.fleeing = true;
    this.tx = this.x + Math.sign(this.x - fromX || 1) * 400;
    this.setState('run', null);
  }
  think(dt: number, ctx: Ctx) {
    if (!this.surface && this.state !== 'glide') this.surface = ctx.terrain.surfaceBelow(this.x, this.y - 6, 4, false)?.s ?? null;
    switch (this.state) {
      case 'run': {
        const s = this.surface;
        if (s) this.tx = clamp(this.tx, s.pts[0][0] + 4, s.pts[s.pts.length - 1][0] - 4);
        if (this.walk(ctx, dt, this.fleeing ? 50 : 22)) {
          const fl = this.flowers.find(f => Math.abs(f[0] - this.x) < 30 && Math.abs(f[1] - this.y) < 30);
          if (fl && rand.chance(0.6)) this.setState('feed', 'feeding');
          else if (rand.chance(0.35)) this.setState('groom', 'grooming');
          else if (rand.chance(0.5) && this.launch(ctx)) { /* gliding */ }
          else if (s) this.tx = rand.range(s.pts[0][0], s.pts[s.pts.length - 1][0]);
        }
        break;
      }
      case 'feed':
        this.anim = 'rear';
        if (this.stateT > 5) this.setState('run', null);
        break;
      case 'groom':
        this.anim = this.stateT % 1 < 0.5 ? 'eat' : 'stand';
        if (this.stateT > 4) this.setState('run', null);
        break;
      case 'glide': {
        const g = this.glide!;
        g.t += dt;
        const k = clamp(g.t / g.T);
        this.x = lerp(g.x0, g.x1, k);
        this.y = lerp(g.y0, g.y1, k) + Math.sin(k * Math.PI) * 26;
        this.anim = k < 0.08 || k > 0.92 ? 'leap' : 'glide';
        this.airborne = true;
        if (k >= 1) {
          this.airborne = false;
          this.surface = g.s;
          this.glide = null;
          this.tx = this.x + this.facing * 20;
          this.setState('run', null);
          this.fleeing = false;
          this.aware *= 0.4;
        }
        break;
      }
    }
  }
}

// ------------------------------------------------------------------ FLICKER MARTEN
export class FlickerMarten extends Mammal {
  jump: { x0: number; y0: number; x1: number; y1: number; t: number; T: number } | null = null;
  target: Creature | null = null;
  fightT = 0;
  constructor(x: number, y: number) {
    super('flicker', x, y);
    this.speed = 45;
    this.sight = 170;
    this.wary = 0.9;
    this.setState('run', null);
  }
  onAlert() {
    this.setState('alert', 'alert');
  }
  leapTo(x1: number, y1: number) {
    this.jump = { x0: this.x, y0: this.y, x1, y1, t: 0, T: 0.45 + Math.abs(x1 - this.x) / 400 };
    this.facing = Math.sign(x1 - this.x) || this.facing;
    this.setState('leap', 'leaping');
  }
  think(dt: number, ctx: Ctx) {
    switch (this.state) {
      case 'run':
        if (this.walk(ctx, dt, this.speed)) {
          if (rand.chance(0.5)) this.leapTo(this.x + rand.sign() * rand.range(40, 90), this.groundY(ctx, this.x) - 0);
          else this.tx = clamp(this.x + rand.range(-250, 250), ctx.worldMinX + 30, ctx.worldMaxX - 30);
        }
        {
          const prey = ctx.creatures.find(c => (c.id === 'strider' || c.id === 'skyribbon' || c.id === 'cragviper') && Math.abs(c.x - this.x) < 140 && !c.fleeing && Math.abs(c.y - this.y) < 40);
          if (prey && this.stateT > 2) { this.target = prey; this.setState('fight', 'fighting'); this.fightT = 0; }
        }
        break;
      case 'leap': {
        const j = this.jump!;
        j.t += dt;
        const k = clamp(j.t / j.T);
        this.x = lerp(j.x0, j.x1, k);
        this.y = lerp(j.y0, j.y1, k) - Math.sin(k * Math.PI) * (26 + Math.abs(j.x1 - j.x0) * 0.2);
        this.anim = 'leap';
        this.airborne = true;
        if (k >= 1) { this.airborne = false; this.jump = null; this.setState('run', null); this.tx = this.x + this.facing * 60; }
        break;
      }
      case 'fight': {
        const t = this.target;
        if (!t || t.dead || this.stateT > 7) { this.setState('run', null); break; }
        this.fightT += dt;
        // dart in and out around the serpent, leaping over strikes
        const side = Math.sin(this.fightT * 2.2) > 0 ? 1 : -1;
        this.tx = t.x + side * 22;
        this.walk(ctx, dt, 90);
        this.anim = Math.sin(this.fightT * 9) > 0.6 ? 'leap' : Math.sin(this.fightT * 3) > 0 ? 'rear' : 'run';
        this.y = this.groundY(ctx) - (this.anim === 'leap' ? 8 : 0);
        this.facing = Math.sign(t.x - this.x) || 1;
        const s = t as Creature & { jaw?: number };
        if (s.jaw !== undefined) s.jaw = Math.max(0, Math.sin(this.fightT * 9 + 1)) * 0.9;
        if (Math.floor(this.fightT * 3) !== Math.floor((this.fightT - dt) * 3)) audio.play('hiss', { vol: 0.3, pitch: 1.3 });
        if (this.stateT > 6.5) { (t as Creature & { startle?: (x: number) => void }).startle?.(this.x); t.fleeing = true; t.setState(t.state, t.behavior); this.setState('run', null); }
        break;
      }
      case 'alert':
        this.anim = 'rear';
        this.facing = Math.sign(ctx.player.x - this.x) || 1;
        if (this.stateT > 1.2) { this.leapTo(this.x - this.facing * 120, this.groundY(ctx, this.x - this.facing * 120)); this.fleeing = true; this.tx = this.x - this.facing * 900; }
        break;
    }
    if (this.fleeing && this.state === 'run') this.walk(ctx, dt, 80);
  }
}

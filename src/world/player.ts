// Rowan Ellis: side-scrolling controller with walk/run/crouch/jump/climb/hide/swim, scripted moves,
// timed work actions (collecting, building) and deck sliding. Rendered through an Actor so any
// expression, emote or cartoon reaction works on the player too.

import type { Renderer } from '../gfx/renderer';
import type { Drawable, Stage } from './stage';
import type { Surface, Climb } from './terrain';
import { Terrain } from './terrain';
import { Actor } from './actor';
import { game } from '../game/game';
import { audio } from '../core/audio';
import { approach, clamp } from '../core/math';
import { perks } from '../game/skills';

export type PState = 'normal' | 'climb' | 'hide' | 'swim' | 'script' | 'stunned' | 'work';

export interface HideSpot {
  x: number;
  w: number;
  y: number;
  cover: number; // 0..1 how well it hides
}

export class Player implements Drawable {
  z = 50;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  facing = 1;
  onGround = true;
  crouch = false;
  running = false;
  state: PState = 'normal';
  anim = 'idle';
  t = 0;
  camera = false;
  surface: Surface | null = null;
  climb: Climb | null = null;
  hideSpot: HideSpot | null = null;
  hides: HideSpot[] = [];
  dropT = 0;
  /** scripted ladder climb direction (+1 down, -1 up), set by scenes for click/tap climbing */
  autoClimb = 0;
  noise = 0;
  visibility = 1;
  swimming = false;
  scriptTarget: number | null = null;
  scriptDone: (() => void) | null = null;
  scriptSpeed = 60;
  control = true;
  minX = 10;
  maxX = 1000;
  stepT = 0;
  hurtT = 0;
  alpha = 1;
  poseOverride: string | null = null;
  frozen = false;
  underwater = false;
  /** deck tilt in radians (boat scenes): makes the player slide */
  tilt = 0;
  /** footstep surface for sfx */
  ground: 'sand' | 'wood' | 'leaves' | 'grass' = 'leaves';
  /** timed work (collecting, building) */
  private work: { anim: string; t: number; dur: number; res: (ok: boolean) => void; onTick?: (k: number) => void } | null = null;
  /** seconds since the player last ran hard (drives camera breathlessness) */
  sinceRun = 99;
  readonly body: Actor;

  constructor(x: number, y: number, readonly terrain: Terrain) {
    this.x = x;
    this.y = y;
    this.body = new Actor('rowan', x, y, 1);
    this.body.fidget = true;
  }

  walkTo(x: number, speed = 60): Promise<void> {
    this.state = 'script';
    this.scriptTarget = x;
    this.scriptSpeed = speed;
    return new Promise(res => (this.scriptDone = res));
  }

  private finishScript() {
    this.state = 'normal';
    this.scriptTarget = null;
    const d = this.scriptDone;
    this.scriptDone = null;
    d?.();
  }

  /**
   * Do timed work with an animation (collecting, hammering). Resolves true when finished,
   * false if interrupted by moving away.
   */
  doWork(anim: string, dur: number, onTick?: (k: number) => void): Promise<boolean> {
    this.work?.res(false);
    this.state = 'work';
    this.vx = 0;
    return new Promise(res => {
      this.work = { anim, t: 0, dur, res, onTick };
    });
  }
  cancelWork() {
    if (!this.work) return;
    const w = this.work;
    this.work = null;
    this.state = 'normal';
    w.res(false);
  }

  get height() {
    return this.crouch || this.state === 'hide' || this.state === 'work' ? 48 : 72;
  }
  get headY() {
    return this.y - this.height;
  }
  get eyeY() {
    return this.y - this.height + 12;
  }

  update(dt: number, st: Stage) {
    this.t += dt;
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.dropT = Math.max(0, this.dropT - dt);
    this.sinceRun += dt;
    const inp = game.input;
    const canControl = this.control && !this.frozen && !game.ui.blocking && this.state !== 'script' && this.state !== 'work';
    let ax = canControl ? inp.axisX() : 0;
    if (this.state === 'script' && this.scriptTarget !== null) {
      const d = this.scriptTarget - this.x;
      if (Math.abs(d) < 2) {
        this.vx = 0;
        this.x = this.scriptTarget;
        this.finishScript();
      } else ax = Math.sign(d);
    }
    if (this.state === 'stunned') ax = 0;

    // timed work
    if (this.state === 'work' && this.work) {
      const w = this.work;
      this.anim = w.anim;
      this.vx = 0;
      this.noise = 0.15;
      this.visibility = 0.8 * perks.visibility();
      w.t += dt;
      w.onTick?.(Math.min(1, w.t / w.dur));
      // walking away cancels
      if (!game.ui.blocking && inp.axisX() !== 0 && w.t > 0.15) { this.cancelWork(); return; }
      if (w.t >= w.dur) {
        this.work = null;
        this.state = 'normal';
        w.res(true);
      }
      this.syncBody(dt);
      return;
    }

    if (this.underwater) {
      this.updateSwim(dt, canControl);
      this.syncBody(dt);
      return;
    }

    if (this.state === 'climb' && this.climb) {
      const c = this.climb;
      let ay = 0;
      if (canControl) ay = (inp.down('down') ? 1 : 0) - (inp.down('up') ? 1 : 0);
      if (this.autoClimb) {
        ay = this.autoClimb;
        if ((ay > 0 && this.y >= c.y1 - 0.5) || (ay < 0 && this.y <= c.y0 + 0.5)) {
          this.y = ay > 0 ? c.y1 : c.y0;
          this.autoClimb = 0;
          this.state = 'normal';
          this.climb = null;
          this.onGround = true;
          this.syncBody(dt);
          return;
        }
      }
      this.y = clamp(this.y + ay * (this.autoClimb ? 70 : 44) * dt, c.y0, c.y1);
      this.x = approach(this.x, c.x, 80 * dt);
      this.anim = ay ? 'climb' : 'climbIdle';
      if (ay) {
        this.stepT += dt;
        if (this.stepT > 0.28) { this.stepT = 0; audio.play((c.kind === 'ladder' ? 'stepWood' : 'rustle') as 'rustle', { vol: 0.25 }); }
      }
      if (canControl && (inp.hit('jump') || (ax !== 0 && this.y <= c.y0 + 1) || (ay > 0 && this.y >= c.y1))) {
        this.state = 'normal';
        this.climb = null;
        if (inp.hit('jump')) { this.vy = -100; this.vx = ax * 60; }
        this.onGround = false;
      }
      this.noise = ay ? 0.3 : 0.05;
      this.visibility = 0.9;
      this.syncBody(dt);
      return;
    }

    if (this.state === 'hide') {
      this.anim = 'crouch';
      this.noise = 0;
      this.visibility = (1 - (this.hideSpot?.cover ?? 0.8)) * perks.visibility();
      if (canControl && (ax !== 0 || inp.hit('up') || inp.hit('jump'))) {
        this.state = 'normal';
        this.hideSpot = null;
        audio.play('rustle', { vol: 0.5 });
      }
      this.syncBody(dt);
      return;
    }

    // crouch / hide
    this.crouch = canControl && inp.down('down') && this.onGround;
    if (canControl && inp.hit('down') && this.onGround) {
      const h = this.hides.find(h => Math.abs(h.x - this.x) < h.w / 2 + 4 && Math.abs(h.y - this.y) < 20);
      if (h) {
        this.state = 'hide';
        this.hideSpot = h;
        this.vx = 0;
        audio.play('rustle', { vol: 0.6 });
        return;
      }
    }
    this.running = canControl && inp.down('run') && !this.crouch && !this.camera;
    if (this.running && Math.abs(this.vx) > 80) this.sinceRun = 0;
    const speed = this.state === 'script' ? this.scriptSpeed : this.camera ? 28 : this.crouch ? 26 : this.running ? 118 : 60;
    const target = ax * speed;
    this.vx = approach(this.vx, target, (this.onGround ? 640 : 280) * dt);
    // sliding on a tilted deck
    if (this.onGround && Math.abs(this.tilt) > 0.03) this.vx += Math.sin(this.tilt) * 520 * dt * (this.crouch ? 0.35 : 1);
    if (ax !== 0 && !this.camera) this.facing = ax;

    // climbing grab (down from the top of a ladder / hatch)
    if (canControl && inp.hit('down') && this.onGround && !this.camera) {
      const c = this.terrain.climbAt(this.x, this.y + 6);
      if (c && c.y0 >= this.y - 8) {
        this.state = 'climb';
        this.climb = c;
        this.vx = this.vy = 0;
        this.y += 2;
        return;
      }
    }
    // climbing grab
    if (canControl && inp.down('up') && !this.camera) {
      const c = this.terrain.climbAt(this.x, this.y - 4);
      if (c) {
        this.state = 'climb';
        this.climb = c;
        this.vx = this.vy = 0;
        return;
      }
    }
    // jump / drop through
    if (canControl && inp.hit('jump') && this.onGround && !this.camera) {
      if (this.crouch && this.surface?.oneWay) {
        this.dropT = 0.35;
        this.onGround = false;
        this.y += 2;
      } else {
        this.vy = -138;
        this.onGround = false;
        this.body.react('stretch');
        audio.play('jump', { vol: 0.5 });
      }
    }

    // integrate
    const nx = clamp(this.x + this.vx * dt, this.minX, this.maxX);
    if (nx === this.minX || nx === this.maxX) this.vx = 0;
    if (this.onGround && this.surface) {
      const sy = Terrain.yAt(this.surface, nx);
      if (sy !== null && Math.abs(sy - this.y) < 8) {
        this.x = nx;
        this.y = sy;
      } else {
        const s = this.terrain.surfaceBelow(nx, this.y - 7, 0, this.dropT > 0);
        if (s && s.y - this.y < 8) {
          this.x = nx;
          this.y = s.y;
          this.surface = s.s;
        } else {
          this.x = nx;
          this.onGround = false;
        }
      }
    } else {
      this.x = nx;
      this.vy = Math.min(this.vy + 400 * dt, 280);
      const ny = this.y + this.vy * dt;
      if (this.vy >= 0) {
        const s = this.terrain.surfaceBelow(this.x, this.y - 2, 0, this.dropT > 0);
        if (s && ny >= s.y) {
          this.y = s.y;
          if (this.vy > 150) { audio.play('land', { vol: 0.6 }); st.shake(1, 0.15); this.body.react('land'); }
          this.vy = 0;
          this.onGround = true;
          this.surface = s.s;
        } else this.y = ny;
      } else this.y = ny;
    }
    if (this.y > 2000) { this.y = this.terrain.groundY(this.x); this.vy = 0; }

    // animation & noise
    const moving = Math.abs(this.vx) > 4;
    const steep = Math.abs(this.tilt) > 0.12;
    if (!this.onGround) this.anim = this.vy < 0 ? 'jump' : 'fall';
    else if (this.camera) this.anim = this.crouch ? 'cameraCrouch' : 'camera';
    else if (steep && Math.abs(this.vx) > 30 && Math.sign(this.vx) === Math.sign(this.tilt) && ax === 0) this.anim = 'slip';
    else if (steep && !moving) this.anim = 'brace';
    else if (this.crouch) this.anim = moving ? 'crouchWalk' : 'crouch';
    else if (moving) this.anim = Math.abs(this.vx) > 85 ? 'run' : 'walk';
    else this.anim = 'idle';
    if (this.poseOverride) this.anim = this.poseOverride;
    this.noise = (!moving ? 0 : this.crouch ? 0.12 : this.running ? 1 : this.camera ? 0.15 : 0.4) * perks.noise();
    this.visibility = (this.crouch ? 0.6 : 1) * perks.visibility() * (perks.stillness() && !moving && this.crouch ? 0.6 : 1);
    if (moving && this.onGround) {
      this.stepT += dt * Math.abs(this.vx) / 60;
      if (this.stepT > 0.36) {
        this.stepT = 0;
        const s = this.ground === 'sand' ? 'stepSand' : this.ground === 'wood' ? 'stepWood' : this.ground === 'leaves' ? 'stepLeaves' : 'step';
        audio.play((this.crouch ? 'stepSoft' : s) as 'step', { vol: this.running ? 0.55 : 0.3, pitch: 0.9 + Math.random() * 0.2 });
      }
    }
    this.syncBody(dt);
  }

  private updateSwim(dt: number, canControl: boolean) {
    const inp = game.input;
    const ax = canControl ? inp.axisX() : 0;
    const ay = canControl ? (inp.down('down') ? 1 : 0) - (inp.down('up') || inp.down('jump') ? 1 : 0) : 0;
    const sp = inp.down('run') ? 72 : 44;
    this.vx = approach(this.vx, ax * sp, 90 * dt);
    this.vy = approach(this.vy, ay * sp + 4, 90 * dt);
    this.x = clamp(this.x + this.vx * dt, this.minX, this.maxX);
    const floor = this.terrain.groundY(this.x);
    this.y = Math.min(this.y + this.vy * dt, floor);
    if (ax !== 0 && !this.camera) this.facing = ax;
    this.anim = 'swim';
    this.noise = Math.hypot(this.vx, this.vy) > 50 ? 0.6 : 0.2;
    this.visibility = 0.9;
  }

  private syncBody(dt: number) {
    const b = this.body;
    b.x = this.x;
    b.y = this.y;
    b.facing = this.facing;
    let a = this.anim;
    if (a === 'climbIdle') { a = 'climb'; b.holdFrame = 0; } else if (b.holdFrame !== null && a !== 'climb') b.holdFrame = null;
    if (b.anim !== a && !b.walking) b.setAnim(a);
    b.alpha = (this.state === 'hide' ? 0.6 : 1) * this.alpha * (this.hurtT > 0 && Math.floor(this.hurtT * 12) % 2 === 0 ? 0.35 : 1);
    b.shadow = !this.underwater && this.onGround;
    b.update(dt);
  }

  draw(r: Renderer, st: Stage) {
    this.body.oy = this.underwater ? 18 : 0;
    this.body.draw(r, st);
  }
}

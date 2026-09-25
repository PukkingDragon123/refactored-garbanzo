// Otis Finch: side-scrolling controller with walk/run/crouch/jump/climb/hide/swim and scripted moves.

import type { Renderer } from '../gfx/renderer';
import { packColor } from '../gfx/renderer';
import type { Drawable, Stage } from './stage';
import type { Surface, Climb } from './terrain';
import { Terrain } from './terrain';
import { chars, A } from '../game/assets';
import { game } from '../game/game';
import { audio } from '../core/audio';
import { approach, clamp } from '../core/math';

export type PState = 'normal' | 'climb' | 'hide' | 'swim' | 'script' | 'stunned';

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
  /** optional hook to block movement (dialogue, menus) */
  frozen = false;
  underwater = false;

  constructor(x: number, y: number, readonly terrain: Terrain) {
    this.x = x;
    this.y = y;
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

  get headY() {
    return this.y - (this.crouch || this.state === 'hide' ? 26 : 40);
  }
  get eyeY() {
    return this.y - (this.crouch || this.state === 'hide' ? 20 : 31);
  }

  update(dt: number, st: Stage) {
    this.t += dt;
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.dropT = Math.max(0, this.dropT - dt);
    const inp = game.input;
    const canControl = this.control && !this.frozen && !game.ui.blocking && this.state !== 'script';
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

    // swimming (underwater dive section)
    if (this.underwater) {
      this.updateSwim(dt, canControl);
      return;
    }

    if (this.state === 'climb' && this.climb) {
      const c = this.climb;
      let ay = 0;
      if (canControl) ay = (inp.down('down') ? 1 : 0) - (inp.down('up') ? 1 : 0);
      this.y = clamp(this.y + ay * 38 * dt, c.y0, c.y1);
      this.x = approach(this.x, c.x, 80 * dt);
      this.anim = ay ? 'climb' : 'climbIdle';
      if (ay) {
        this.stepT += dt;
        if (this.stepT > 0.28) { this.stepT = 0; audio.play('rustle', { vol: 0.25 }); }
      }
      // leave at top onto a platform, at bottom onto ground, or by jumping sideways
      if (canControl && (inp.hit('jump') || (ax !== 0 && this.y <= c.y0 + 1) || (ay > 0 && this.y >= c.y1))) {
        this.state = 'normal';
        this.climb = null;
        if (inp.hit('jump')) { this.vy = -90; this.vx = ax * 60; }
        this.onGround = false;
      }
      this.noise = ay ? 0.3 : 0.05;
      this.visibility = 0.9;
      return;
    }

    if (this.state === 'hide') {
      this.anim = 'crouch';
      this.noise = 0;
      this.visibility = (1 - (this.hideSpot?.cover ?? 0.8)) * (game.save.upgrades.ghillie ? 0.5 : 1);
      if (canControl && (ax !== 0 || inp.hit('up') || inp.hit('jump'))) {
        this.state = 'normal';
        this.hideSpot = null;
        audio.play('rustle', { vol: 0.5 });
      }
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
    const speed = this.state === 'script' ? this.scriptSpeed : this.camera ? 30 : this.crouch ? 26 : this.running ? 110 : 58;
    const target = ax * speed;
    this.vx = approach(this.vx, target, (this.onGround ? 600 : 260) * dt);
    if (ax !== 0 && !this.camera) this.facing = ax;

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
        this.vy = -128;
        this.onGround = false;
        audio.play('jump', { vol: 0.5 });
      }
    }

    // integrate
    const nx = clamp(this.x + this.vx * dt, this.minX, this.maxX);
    if (this.onGround && this.surface) {
      const sy = Terrain.yAt(this.surface, nx);
      if (sy !== null && Math.abs(sy - this.y) < 7) {
        this.x = nx;
        this.y = sy;
      } else {
        // walked off the edge (or onto another surface)
        const s = this.terrain.surfaceBelow(nx, this.y - 6, 0, this.dropT > 0);
        if (s && s.y - this.y < 7) {
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
      this.vy = Math.min(this.vy + 380 * dt, 260);
      const ny = this.y + this.vy * dt;
      if (this.vy >= 0) {
        const s = this.terrain.surfaceBelow(this.x, this.y - 2, 0, this.dropT > 0);
        if (s && ny >= s.y) {
          this.y = s.y;
          if (this.vy > 150) { audio.play('land', { vol: 0.6 }); st.shake(1, 0.15); }
          this.vy = 0;
          this.onGround = true;
          this.surface = s.s;
        } else this.y = ny;
      } else this.y = ny;
    }
    if (this.y > 2000) { this.y = this.terrain.groundY(this.x); this.vy = 0; }

    // animation & noise
    const moving = Math.abs(this.vx) > 4;
    if (!this.onGround) this.anim = this.vy < 0 ? 'jump' : 'fall';
    else if (this.camera) this.anim = this.crouch ? 'camCrouch' : 'cam';
    else if (this.crouch) this.anim = moving ? 'crouchWalk' : 'crouch';
    else if (moving) this.anim = Math.abs(this.vx) > 80 ? 'run' : 'walk';
    else this.anim = 'idle';
    if (this.poseOverride) this.anim = this.poseOverride;
    this.noise = !moving ? 0 : this.crouch ? 0.12 : this.running ? 1 : this.camera ? 0.15 : 0.4;
    this.visibility = (this.crouch ? 0.6 : 1) * (game.save.upgrades.ghillie ? 0.7 : 1);
    if (moving && this.onGround) {
      this.stepT += dt * Math.abs(this.vx) / 58;
      if (this.stepT > 0.34) {
        this.stepT = 0;
        audio.play(this.crouch ? 'stepSoft' : 'step', { vol: this.running ? 0.55 : 0.3, pitch: 0.9 + Math.random() * 0.2 });
      }
    }
  }

  private updateSwim(dt: number, canControl: boolean) {
    const inp = game.input;
    const ax = canControl ? inp.axisX() : 0;
    const ay = canControl ? (inp.down('down') ? 1 : 0) - (inp.down('up') || inp.down('jump') ? 1 : 0) : 0;
    const sp = inp.down('run') ? 70 : 42;
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

  draw(r: Renderer, st: Stage) {
    const set = chars.otis;
    let frames = set[this.anim] ?? set.idle;
    let fps = this.anim === 'run' ? 14 : this.anim === 'walk' ? 10 : this.anim === 'crouchWalk' ? 8 : this.anim === 'climb' ? 6 : 3;
    if (this.anim === 'climbIdle') { frames = set.climb; fps = 0; }
    const f = frames[Math.floor(this.t * fps) % frames.length];
    const hidden = this.state === 'hide';
    // blob shadow
    if (!this.underwater && this.onGround) {
      r.beginShadows();
      r.draw(A.shadow, this.x, this.y, 0.7, 0.8, 0, packColor(0, 0, 0, 0.45));
      r.endShadows();
    }
    const blinkA = this.hurtT > 0 && Math.floor(this.hurtT * 12) % 2 === 0 ? 0.3 : 1;
    const a = (hidden ? 0.55 : 1) * blinkA * this.alpha;
    const rot = this.underwater ? (Math.abs(this.vx) > 10 ? -this.facing * 1.2 : -this.facing * 0.2) : 0;
    const oy = this.underwater ? 18 : 0;
    r.draw(f, this.x, this.y + oy, this.facing, 1, rot, packColor(1, 1, 1, a));
    void st;
  }
}

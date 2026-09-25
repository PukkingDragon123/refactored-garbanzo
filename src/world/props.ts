// Generic drawables: static/swaying sprite props, animated props, lights and flickering fires.

import type { Frame, Renderer } from '../gfx/renderer';
import { packColor, WHITE } from '../gfx/renderer';
import type { Drawable, Stage } from './stage';
import { rand } from '../core/math';

export interface PropOpts {
  sx?: number;
  sy?: number;
  flip?: boolean;
  sway?: number;
  swaySpeed?: number;
  tint?: number;
  emissive?: number;
  rot?: number;
}

export class Prop implements Drawable {
  sx: number;
  sy: number;
  sway: number;
  swaySpeed: number;
  phase = rand.next() * 10;
  tint: number;
  emissive?: number;
  rot: number;
  hidden = false;
  constructor(public frame: Frame, public x: number, public y: number, public z = 0, o: PropOpts = {}) {
    this.sx = (o.sx ?? 1) * (o.flip ? -1 : 1);
    this.sy = o.sy ?? 1;
    this.sway = o.sway ?? 0;
    this.swaySpeed = o.swaySpeed ?? 1.3;
    this.tint = o.tint ?? WHITE;
    this.emissive = o.emissive;
    this.rot = o.rot ?? 0;
  }
  draw(r: Renderer, st: Stage) {
    if (this.hidden) return;
    if (this.emissive !== undefined) r.emissive(this.emissive);
    if (this.sway) {
      const w = st.wind;
      const s = (Math.sin(st.time * this.swaySpeed + this.phase) * 0.7 + Math.sin(st.time * this.swaySpeed * 2.3 + this.phase * 1.7) * 0.3) * this.sway * (0.4 + w);
      r.drawSway(this.frame, this.x, this.y, this.sx, this.sy, s, this.tint);
    } else r.draw(this.frame, this.x, this.y, this.sx, this.sy, this.rot, this.tint);
    if (this.emissive !== undefined) r.emissive();
  }
}

export class AnimProp implements Drawable {
  t = rand.next() * 10;
  constructor(public frames: Frame[], public x: number, public y: number, public z = 0, public fps = 8, public o: PropOpts = {}) {}
  update(dt: number) {
    this.t += dt;
  }
  draw(r: Renderer) {
    const f = this.frames[Math.floor(this.t * this.fps) % this.frames.length];
    if (this.o.emissive !== undefined) r.emissive(this.o.emissive);
    r.draw(f, this.x, this.y, (this.o.sx ?? 1) * (this.o.flip ? -1 : 1), this.o.sy ?? 1, 0, this.o.tint ?? WHITE);
    if (this.o.emissive !== undefined) r.emissive();
  }
}

/** Point light with optional flicker and an additive glow sprite. */
export class LightSource implements Drawable {
  t = rand.next() * 10;
  on = true;
  constructor(
    public x: number, public y: number, public radius: number,
    public color: [number, number, number], public intensity = 1,
    public z = 100, public glow: Frame | null = null, public glowSize = 1,
    public flicker = 0, public core = 0.3,
  ) {}
  update(dt: number) {
    this.t += dt;
  }
  draw(r: Renderer, st: Stage) {
    if (!this.on) return;
    let k = 1;
    if (this.flicker) k = 1 + (Math.sin(this.t * 13.7) * 0.5 + Math.sin(this.t * 7.1 + 1.3) * 0.35 + Math.sin(this.t * 23.3) * 0.15) * this.flicker;
    const I = this.intensity * k * st.preset.lightK;
    r.light(this.x, this.y, this.radius * (0.97 + k * 0.03), this.color[0], this.color[1], this.color[2], I, this.core);
    if (this.glow) r.fxDraw(this.glow, this.x, this.y, this.glowSize * k, this.glowSize * k, 0, packColor(this.color[0], this.color[1], this.color[2], 1), I * 0.35);
  }
}

/** Arbitrary draw callback as a drawable. */
export class Custom implements Drawable {
  constructor(public z: number, public fn: (r: Renderer, st: Stage) => void, public upd?: (dt: number, st: Stage) => void) {}
  draw(r: Renderer, st: Stage) {
    this.fn(r, st);
  }
  update(dt: number, st: Stage) {
    this.upd?.(dt, st);
  }
}

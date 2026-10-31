// Generic drawables: static/swaying sprite props, animated props, lights and flickering fires.

import type { Frame, Renderer } from '../gfx/renderer';
import { packColor, WHITE } from '../gfx/renderer';
import type { Drawable, Stage } from './stage';
import { rand } from '../core/math';
import { plantFor, swayAmp, windBend } from './foliage';
import type { FoliageKind, Plant } from './foliage';

export interface PropOpts {
  sx?: number;
  sy?: number;
  flip?: boolean;
  sway?: number;
  swaySpeed?: number;
  tint?: number;
  emissive?: number;
  rot?: number;
  /**
   * plant physics: the kind of foliage this is (pushed by Mori and animals, leaves fly when you jump
   * in), false to only sway; left out, a small swaying prop on the gameplay plane is a 'plant'
   */
  foliage?: FoliageKind | false;
  /** hangs from its anchor (vines, moss): the free end is the bottom */
  hang?: boolean;
  /** colours of the leaves / petals it throws */
  bits?: [number, number, number][];
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
  /** the plant's spring (undefined until first drawn, null when it only sways) */
  plant: Plant | null | undefined;
  private fol: FoliageKind | false | undefined;
  private bits?: [number, number, number][];
  readonly hang: boolean;
  private amp = -1;
  constructor(public frame: Frame, public x: number, public y: number, public z = 0, o: PropOpts = {}) {
    this.sx = (o.sx ?? 1) * (o.flip ? -1 : 1);
    this.sy = o.sy ?? 1;
    this.sway = o.sway ?? 0;
    this.swaySpeed = o.swaySpeed ?? 1.3;
    this.tint = o.tint ?? WHITE;
    this.emissive = o.emissive;
    this.rot = o.rot ?? 0;
    this.fol = o.foliage;
    this.bits = o.bits;
    this.hang = o.hang ?? this.frame.ay < this.frame.h * 0.35;
    if (o.foliage === false) this.plant = null;
  }
  /** the wind's bend at the free end (world px); see world/foliage.ts */
  windBend(r: Renderer, st: Stage): number {
    if (this.amp < 0) this.amp = swayAmp(this.sway, this.frame, this.sy, this.hang);
    return windBend(r, st, this.x, this.amp, this.swaySpeed, this.phase);
  }
  draw(r: Renderer, st: Stage) {
    if (this.hidden) return;
    if (this.emissive !== undefined) r.emissive(this.emissive);
    if (this.sway || this.fol) {
      if (this.plant === undefined) this.plant = plantFor(this.fol, this.frame, this.sx, this.sy, this.sway, this.hang, this.phase, r, this.bits);
      const pl = this.plant;
      const b = (this.sway ? this.windBend(r, st) : 0) + (pl ? pl.push(r, st, this.x, this.y) : 0);
      r.drawBend(this.frame, this.x, this.y, this.sx, this.sy, this.hang ? -b : b, this.tint, pl?.curve ?? 1.6);
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

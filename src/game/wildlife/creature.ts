// Creature base: awareness of the player, reactions, photo bounds and the expedition context.

import type { Renderer } from '../../gfx/renderer';
import type { Drawable, Stage, Layer } from '../../world/stage';
import type { Terrain } from '../../world/terrain';
import type { Player } from '../../world/player';
import type { TimeOfDay } from '../../world/timeofday';
import { SPECIES_BY_ID, Species } from '../species';
import { clamp, rand } from '../../core/math';

export interface Lure {
  kind: string;
  x: number;
  y: number;
  life: number;
  eaten: number;
  claimed: Creature | null;
}

export interface Ctx {
  st: Stage;
  terrain: Terrain;
  player: Player;
  creatures: Creature[];
  lures: Lure[];
  tod: TimeOfDay;
  main: Layer;
  waterY: number | null;
  /** player got caught by a dangerous animal */
  caught(c: Creature, severity: number): void;
  splash(x: number, y: number, k?: number): void;
  spawn(c: Creature): void;
  worldMinX: number;
  worldMaxX: number;
}

export type Reaction = 'flee' | 'freeze' | 'curious' | 'threat' | 'ignore' | 'hide';

export interface Box { x0: number; y0: number; x1: number; y1: number }

export abstract class Creature implements Drawable {
  z = 30;
  readonly sp: Species;
  x: number;
  y: number;
  facing = 1;
  state = 'idle';
  stateT = 0;
  t = rand.next() * 10;
  behavior: string | null = null;
  aware = 0;
  alerted = false;
  fleeing = false;
  dead = false;
  /** sight range in px at full player visibility */
  sight = 150;
  /** awareness gain rate */
  wary = 1;
  reaction: Reaction = 'flee';
  /** 0..1, how unaware of the player the creature currently is */
  get natural() {
    return 1 - this.aware;
  }
  /** depth used by autofocus/DOF (gameplay plane = 0.5) */
  depth = 0.5;
  inLight = false;
  lureTarget: Lure | null = null;
  lastLureCheck = 0;
  eats: string[] = [];
  offscreenT = 0;
  hiddenFromCamera = false;
  submerged = false;

  constructor(readonly id: string, x: number, y: number) {
    this.sp = SPECIES_BY_ID[id];
    this.x = x;
    this.y = y;
  }

  setState(s: string, behavior: string | null = this.behavior) {
    if (this.state !== s) this.stateT = 0;
    this.state = s;
    this.behavior = behavior;
  }

  abstract bounds(): Box;
  /** head position (for "subject facing/visible" checks) */
  abstract head(): [number, number];
  abstract think(dt: number, ctx: Ctx): void;
  abstract draw(r: Renderer, st: Stage): void;

  /** called when awareness reaches 1 */
  onAlert(_ctx: Ctx) {}

  updateAwareness(dt: number, ctx: Ctx) {
    const p = ctx.player;
    const [hx, hy] = this.head();
    const dx = p.x - hx, dy = p.eyeY - hy;
    const d = Math.hypot(dx, dy * 1.3);
    const faceing = Math.sign(dx) === this.facing ? 1 : 0.55;
    const R = this.sight * p.visibility * faceing * (ctx.tod === 'night' ? 0.7 : 1);
    const noiseR = p.noise * 150;
    let gain = 0;
    if (d < R) gain += (1 - d / R) * 1.6;
    if (d < noiseR) gain += (1 - d / noiseR) * 2.2 * p.noise;
    if (p.camera && d < R * 0.5) gain *= 0.8;
    if (gain > 0) this.aware = clamp(this.aware + gain * dt * this.wary, 0, 1);
    else this.aware = clamp(this.aware - dt * 0.12, 0, 1);
    if (this.aware >= 1 && !this.alerted) {
      this.alerted = true;
      this.onAlert(ctx);
    }
    if (this.alerted && this.aware < 0.35) this.alerted = false;
  }

  update(dt: number, st: Stage) {
    const ctx = (st as unknown as { ctx: Ctx }).ctx;
    this.t += dt;
    this.stateT += dt;
    if (!ctx) return;
    if (this.reaction !== 'ignore') this.updateAwareness(dt, ctx);
    // lure attraction
    this.lastLureCheck -= dt;
    if (!this.lureTarget && !this.fleeing && this.lastLureCheck <= 0 && this.eats.length) {
      this.lastLureCheck = 1.5;
      let best: Lure | null = null, bd = 420;
      for (const l of ctx.lures) {
        if (l.claimed || !this.eats.includes(l.kind)) continue;
        const d = Math.abs(l.x - this.x);
        if (d < bd) { bd = d; best = l; }
      }
      if (best) { this.lureTarget = best; best.claimed = this; }
    }
    if (this.lureTarget && this.lureTarget.life <= 0) this.lureTarget = null;
    this.think(dt, ctx);
    // despawn when far off the world bounds after fleeing
    if ((this.x < ctx.worldMinX - 150 || this.x > ctx.worldMaxX + 150 || this.y < -400) && (this.fleeing || this.stateT > 1)) this.dead = true;
  }

  /** helper for walkers: move toward x at speed, returns true when arrived */
  moveToward(tx: number, speed: number, dt: number) {
    const d = tx - this.x;
    if (Math.abs(d) < 2) return true;
    this.facing = Math.sign(d);
    this.x += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
    return false;
  }
}

export function eatLure(c: Creature, dt: number) {
  const l = c.lureTarget;
  if (!l) return;
  l.eaten += dt;
  if (l.eaten > 14) {
    l.life = 0;
    c.lureTarget = null;
  }
}

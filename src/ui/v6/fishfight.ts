// V9 fishing fight, played out in the wide scene view (see ../v4/fishing.ts): the hooked fish is a
// shadow under the water off the stern, the line runs from Mori's rod tip into the sea and down to
// its mouth, and you wind it in on the on-screen reel (../v9/reel.ts). This module is the fight's
// physics, independent of drawing:
//
//  - the fish rests (a slow pull away, tiring as you reel) and, now and then, after a tell (a head
//    shake: the rod tip twitches, the reel rattles), makes a run: away from the boat, down for the
//    sinkers, up for the floaters (who sometimes leap clear of the water), fast and short for the
//    darters, long for the smooth ones, any of these for the mixed
//  - line tension comes from the fish's pull and how fast you crank against it: wind steadily while
//    it rests, ease off while it runs (the drag pays out line instead). Crank into a run, or spin
//    the reel madly, and the tension goes red and the line snaps
//  - reeling pulls the fish toward the rod tip; it comes up to the surface under the stern and is
//    landed. Let it take all the line and it's gone; leave the line idle too long and it spits the hook
//  - stamina drains as it fights, so its runs weaken and the tired fish comes in easily

import type { FishDef, Temper } from '../v4/fishing';

export type FightEnd = 'caught' | 'snap' | 'lost' | 'slip' | 'cancel';
export type FightEvent = 'tell' | 'run' | 'runEnd' | 'leap' | 'splash' | 'strain' | 'idle' | 'snap' | 'lost' | 'slip' | 'landed';

/** px per metre on the boat plane (Mori is 62 px, 1.8 m) */
export const PX_M = 34.4;
/** line wound in per turn of the handle, metres */
export const REEL_M = 1.1;
/** line on the reel, metres */
export const LINE_MAX = 22;

export interface FightWorld {
  /** rod tip, world px */
  tip: [number, number];
  /** sea surface y at x */
  surface(x: number): number;
  /** seabed y at x */
  bed(x: number): number;
  /** furthest the fish can go (left edge of the view, with a margin) */
  minX: number;
  maxX: number;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export class FightSim {
  /** the fish's mouth (where the line is tied), world px */
  x: number; y: number;
  vx = 0; vy = 0;
  /** -1 / +1 swim direction (for the shadow) */
  face = -1;
  /** 0..1.4 line tension */
  ten = 0.2;
  /** 0..1 how much fight is left */
  stam = 1;
  /** seconds left in the current run / tell */
  run = 0; tell = 0;
  kind: Temper = 'smooth';
  runPow = 0;
  runDir: [number, number] = [-1, 0];
  /** the fish is in the air (leap), 0..1 progress */
  leap = -1;
  leapFrom: [number, number] = [0, 0];
  leapTo: [number, number] = [0, 0];
  /** turns/s the drag is paying out (reel buzz) */
  drag = 0;
  /** seconds above the snap threshold, idle seconds */
  over = 0; idle = 0;
  end: FightEnd | null = null;
  t = 0;
  private nextRun: number;
  private d: number;
  private warned = false;

  constructor(readonly fish: FishDef, x: number, y: number, public world: FightWorld) {
    this.x = x; this.y = y;
    this.d = fish.diff / 100;
    this.nextRun = 0.9 + Math.random() * 0.8;
    // it bolts the moment the hook goes in
    this.startTell(0.25);
  }

  /** line out, metres */
  get lineOut() { return Math.hypot(this.x - this.world.tip[0], this.y - this.world.tip[1]) / PX_M; }
  get running() { return this.run > 0 && this.leap < 0; }

  private startTell(t = 0.3 + Math.random() * 0.25) {
    const f = this.fish;
    this.kind = f.temper === 'mixed' ? (['smooth', 'dart', 'sinker', 'floater'] as Temper[])[Math.floor(Math.random() * 4)] : f.temper;
    this.tell = this.kind === 'dart' ? t * 0.75 : t;
    // runs weaken as the fish tires
    this.runPow = (0.42 + this.d * 0.62) * (0.45 + 0.55 * this.stam) * (0.85 + Math.random() * 0.3) * (this.kind === 'dart' ? 1.12 : this.kind === 'floater' ? 0.82 : this.kind === 'smooth' ? 0.92 : 1);
    // away from the boat, then down (sinkers) / up (floaters) / level (darters) / diagonal (smooth)
    const away = this.x > this.world.tip[0] - 60 ? -1 : Math.random() < 0.8 ? -1 : 1;
    const vy = this.kind === 'sinker' ? 0.75 : this.kind === 'floater' ? -0.6 : this.kind === 'dart' ? (Math.random() - 0.5) * 0.5 : 0.35;
    const l = Math.hypot(1, vy);
    this.runDir = [away / l, vy / l];
  }

  /** one step: crank = reel speed in turns per second. Returns the events that happened. */
  step(dt: number, crank: number): FightEvent[] {
    const ev: FightEvent[] = [];
    if (this.end) return ev;
    this.t += dt;
    const W = this.world, f = this.fish, d = this.d;
    // ---------------------------------------------------------------- temper: tells, runs, rests
    if (this.leap >= 0) {
      // in the air: a ballistic hop along an arc, splash back in
      this.leap += dt / 0.75;
      const k = Math.min(1, this.leap);
      this.x = this.leapFrom[0] + (this.leapTo[0] - this.leapFrom[0]) * k;
      const sy = this.leapFrom[1] + (this.leapTo[1] - this.leapFrom[1]) * k;
      this.y = sy - Math.sin(k * Math.PI) * (28 + this.runPow * 30);
      if (k >= 1) { this.leap = -1; ev.push('splash'); }
    } else if (this.tell > 0) {
      this.tell -= dt;
      if (this.tell <= 0) {
        this.run = (0.9 + d * 1.3 + Math.random() * 0.9) * (this.kind === 'dart' ? 0.6 : this.kind === 'smooth' ? 1.3 : 1) * (0.5 + 0.5 * this.stam);
        ev.push('run');
        // surface fish sometimes jump clear of the water at the start of a run
        const surf = W.surface(this.x);
        if ((this.kind === 'floater' || f.id === 'spinnaker') && f.id !== 'bubblepuffer' && this.y < surf + 60 && Math.random() < 0.55) {
          this.leap = 0;
          this.leapFrom = [this.x, surf];
          this.leapTo = [this.x + this.runDir[0] * (40 + this.runPow * 40), surf];
          this.y = surf;
          ev.push('leap');
        }
      }
    } else if (this.run > 0) {
      this.run -= dt;
      if (this.run <= 0) {
        ev.push('runEnd');
        this.nextRun = (3.6 - d * 2 + Math.random() * (2.4 - d)) * (this.kind === 'dart' ? 0.7 : this.kind === 'smooth' ? 1.25 : 1) * (1.6 - this.stam * 0.6);
      }
    } else if (this.stam > 0.12) {
      this.nextRun -= dt;
      if (this.nextRun <= 0) { this.startTell(); ev.push('tell'); }
    }
    const running = this.running;
    // ---------------------------------------------------------------- tension
    const k = crank / 1.35;
    const P = running ? this.runPow : (0.1 + 0.26 * this.stam) * (0.85 + 0.15 * Math.sin(this.t * 2.3));
    let target = this.leap >= 0 ? 0.08 : P * (0.42 + 0.58 * Math.min(k, 1.6)) + 0.34 * k * (running ? 1 : 0.9) + (this.tell > 0 ? 0.06 : 0);
    if (f.id === 'bubblepuffer') target *= 0.8;
    this.ten += (target - this.ten) * (1 - Math.exp(-dt * (target > this.ten ? 5.5 : 3.5)));
    if (this.ten > 0.8 && !this.warned) { this.warned = true; ev.push('strain'); }
    if (this.ten < 0.55) this.warned = false;
    if (this.ten >= 1) {
      this.over += dt * (this.ten >= 1.22 ? 3 : 1);
      if (this.over > 0.38) { this.end = 'snap'; ev.push('snap'); return ev; }
    } else this.over = Math.max(0, this.over - dt * 2);
    // ---------------------------------------------------------------- motion
    if (this.leap < 0) {
      const [tx, ty] = W.tip;
      const dx = tx - this.x, dy = ty - this.y, dl = Math.hypot(dx, dy) || 1;
      // the fish's own swimming
      let sx: number, sy: number;
      if (running) {
        const v = 30 + 70 * this.runPow;
        sx = this.runDir[0] * v; sy = this.runDir[1] * v;
      } else {
        // resting: nosing slowly away and down, less as it tires
        const v = 3 + 10 * this.stam;
        sx = -dx / dl * v * 0.9 + Math.sin(this.t * 0.9) * 6; sy = 4 * this.stam + Math.sin(this.t * 1.3) * 5;
      }
      // the reel: each turn winds in ~1 m; hardly any gain against a run
      const vin = crank * PX_M * REEL_M * (running ? 0.12 : 1) * (1 - 0.3 * P);
      sx += dx / dl * vin; sy += dy / dl * vin;
      // the drag pays out while it runs and you're not winding
      this.drag = running ? Math.max(0, (Math.hypot(sx, sy) - vin) / (PX_M * REEL_M)) : 0;
      this.vx += (sx - this.vx) * Math.min(1, dt * 5);
      this.vy += (sy - this.vy) * Math.min(1, dt * 5);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const surf = W.surface(this.x), bed = W.bed(this.x);
      this.y = clamp(this.y, surf + 5, bed - 3);
      // runs bounce off the bottom, the surface and the edges of the view
      if (running && ((this.y >= bed - 3.5 && this.runDir[1] > 0) || (this.y <= surf + 5.5 && this.runDir[1] < 0))) this.runDir[1] *= -0.4;
      if (this.x < W.minX) { this.x = W.minX; if (running) this.runDir[0] = Math.abs(this.runDir[0]) * 0.3; }
      if (this.x > W.maxX) { this.x = W.maxX; if (running) this.runDir[0] = -Math.abs(this.runDir[0]); }
      if (Math.abs(this.vx) > 4) this.face = this.vx < 0 ? -1 : 1;
    }
    // ---------------------------------------------------------------- stamina, idle line, the end
    this.stam = Math.max(0, this.stam - dt * (running ? 0.05 + 0.06 * this.runPow : 0.012 + 0.03 * this.ten) / (0.55 + d));
    if (crank < 0.08 && !running && this.tell <= 0 && this.leap < 0) {
      this.idle += dt;
      if (this.idle > 3 && this.idle - dt <= 3) ev.push('idle');
      if (this.idle > 6.5) { this.end = 'slip'; ev.push('slip'); return ev; }
    } else this.idle = Math.max(0, this.idle - dt * 3);
    if (this.lineOut > LINE_MAX) { this.end = 'lost'; ev.push('lost'); return ev; }
    const [tx, ty] = W.tip;
    const surf = W.surface(this.x);
    // landed: wound right in under the rod tip, up at the surface
    const near = Math.hypot(this.x - tx, this.y - ty) < Math.max(0, surf - ty) + 30;
    if (this.leap < 0 && near && this.y < surf + 26) {
      this.end = 'caught';
      ev.push('landed');
    }
    return ev;
  }
}

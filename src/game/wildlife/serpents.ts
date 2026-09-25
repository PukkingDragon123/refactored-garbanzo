// Serpents of Zealandia (and the Ironjaw crocodile): spine creatures with species behaviour.

import type { Renderer } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Stage } from '../../world/stage';
import { Terrain, Surface } from '../../world/terrain';
import { DynamicSprite } from '../../gfx/atlas';
import { SerpentPainter, followSpine, makeSpine, SerpentState } from '../../art/serpent';
import { SERPENT_LOOKS } from '../../art/fauna';
import { Creature, Ctx, Box, eatLure } from './creature';
import { game } from '../game';
import { A } from '../assets';
import { audio } from '../../core/audio';
import { clamp, damp, lerp, rand, TAU } from '../../core/math';

type Pt = [number, number];

export abstract class SerpentBase extends Creature {
  painter: SerpentPainter;
  spr: DynamicSprite;
  pts: Pt[];
  spacing: number;
  legPhase = 0;
  legLift = 1;
  jaw = 0;
  tongue = 0;
  tongueT = 0;
  flatten = 0;
  grounded = true;
  swell: { at: number; k: number } | undefined;
  submergeY: number | undefined;
  headLift = 3;
  speed = 30;
  bufOX = 0;
  bufOY = 0;
  visibleLast = false;
  wavePhase = 0;
  waveAmp = 1;
  blinkT = 3;
  lureGlow = 0;

  constructor(id: string, x: number, y: number, facing = 1, bufW?: number, bufH?: number) {
    super(id, x, y);
    const look = SERPENT_LOOKS[id];
    this.painter = new SerpentPainter(look);
    this.spacing = look.length > 200 ? 3 : 1.5;
    this.facing = facing;
    this.pts = makeSpine(x, y, facing, look.length, this.spacing);
    const pad = look.radius * 4 + (look.legs ? 20 : 8) + (look.dorsalFin ? look.dorsalFin.h + 6 : 0) + 20;
    const w = bufW ?? Math.ceil(look.length * 1.05 + pad * 2);
    const h = bufH ?? Math.ceil(Math.max(look.radius * 6 + pad * 2, look.length * 0.75));
    this.spr = new DynamicSprite(game.r, w, h, 0, 0);
  }

  get look() {
    return this.painter.look;
  }
  get hx() {
    return this.pts[0][0];
  }
  get hy() {
    return this.pts[0][1];
  }
  head(): [number, number] {
    return [this.pts[0][0], this.pts[0][1]];
  }
  bounds(): Box {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const r = this.look.radius;
    for (let i = 0; i < this.pts.length; i += 3) {
      const p = this.pts[i];
      if (p[0] < x0) x0 = p[0];
      if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[1] > y1) y1 = p[1];
    }
    return { x0: x0 - r, y0: y0 - r * 1.3, x1: x1 + r, y1: y1 + r };
  }

  /** Move the head, then drag the body along. */
  moveHead(x: number, y: number) {
    const d = Math.hypot(x - this.pts[0][0], y - this.pts[0][1]);
    this.pts[0][0] = x;
    this.pts[0][1] = y;
    this.legPhase += d * 0.22;
    this.wavePhase += d * 0.12;
    followSpine(this.pts, this.spacing, 0.15);
  }

  /** Settle body points onto a surface function (ground/branch/water). */
  settle(surfY: (x: number) => number, k = 0.55, lift?: (i: number, n: number) => number) {
    const n = this.pts.length;
    for (let i = 1; i < n; i++) {
      const p = this.pts[i];
      const u = i / n;
      const rr = this.painter.radiusAt(u);
      let ty = surfY(p[0]) - rr * 0.85 - (lift ? lift(i, n) : 0);
      ty += Math.sin(this.wavePhase - i * 0.35) * this.waveAmp * Math.sin(u * Math.PI);
      p[1] = lerp(p[1], ty, k);
    }
    followSpine(this.pts, this.spacing, 0);
  }

  groundAt(ctx: Ctx) {
    return (x: number) => {
      const s = ctx.terrain.surfaceBelow(x, this.hy - 30, 0, false);
      return s ? s.y : ctx.terrain.groundY(x);
    };
  }

  /** slither along the ground toward tx; returns true when arrived */
  slither(ctx: Ctx, tx: number, dt: number, speed = this.speed, lift = this.headLift) {
    const d = tx - this.hx;
    const g = this.groundAt(ctx);
    let arrived = false;
    if (Math.abs(d) > 2) {
      this.facing = Math.sign(d);
      const nx = this.hx + Math.sign(d) * Math.min(Math.abs(d), speed * dt);
      this.moveHead(nx, damp(this.hy, g(nx) - this.look.radius * 0.9 - lift, 12, dt));
    } else {
      arrived = true;
      this.moveHead(this.hx, damp(this.hy, g(this.hx) - this.look.radius * 0.9 - lift, 8, dt));
    }
    this.settle(g, 0.5, (i) => (i < 5 ? (5 - i) * lift * 0.2 : 0));
    return arrived;
  }

  flick(dt: number, rate = 0.5) {
    this.tongueT -= dt;
    if (this.tongueT < 0 && rand.chance(rate * dt * 4)) this.tongueT = 0.35;
    this.tongue = this.tongueT > 0 ? Math.sin((this.tongueT / 0.35) * Math.PI) : 0;
  }

  draw(r: Renderer, st: Stage) {
    const b = this.bounds();
    const margin = 30;
    const vx0 = r.visibleX0(60), vx1 = r.visibleX1(60);
    if (b.x1 < vx0 || b.x0 > vx1) { this.visibleLast = false; return; }
    this.visibleLast = true;
    const buf = this.spr.buf;
    const ox = Math.floor((b.x0 + b.x1) / 2 - buf.w / 2), oy = Math.floor((b.y0 + b.y1) / 2 - buf.h / 2);
    void margin;
    this.bufOX = ox;
    this.bufOY = oy;
    this.blinkT -= 1 / 60;
    if (this.blinkT < -0.15) this.blinkT = 2 + rand.next() * 4;
    const state: SerpentState = {
      pts: this.pts, facing: this.facing, jaw: this.jaw, tongue: this.tongue, legPhase: this.legPhase, legLift: this.legLift,
      grounded: this.grounded, groundY: (x: number) => {
        const s = (st as unknown as { ctx: Ctx }).ctx?.terrain.surfaceBelow(x, this.hy - 20, 0, false);
        return s ? s.y : this.hy + 20;
      }, flatten: this.flatten, swell: this.swell, blink: this.blinkT < 0, submerge: this.submergeY,
    };
    this.painter.paint(buf, state, ox, oy, this.t);
    this.spr.upload();
    // ground shadow for grounded snakes
    if (this.grounded && !this.submergeY) {
      r.beginShadows();
      const w = (b.x1 - b.x0) / 32;
      r.draw(A.shadow, (b.x0 + b.x1) / 2, b.y1 + 1, Math.max(0.5, w), 0.8, 0, packColor(0, 0, 0, 0.35));
      r.endShadows();
    }
    r.draw(this.spr.frame, ox, oy);
    if (this.look.lure && this.lureGlow > 0) {
      const tip = this.pts[this.pts.length - 1];
      const k = this.lureGlow * (0.8 + 0.2 * Math.sin(this.t * 6));
      r.fxDraw(A.glow, tip[0], tip[1], 0.5, 0.5, 0, packColor(0.7, 1, 0.8, 1), 3 * k);
      r.light(tip[0], tip[1], 55, 0.6, 1, 0.8, 1.4 * k);
    }
  }
}

// ------------------------------------------------------------------ STRIDER (legged, forest floor)
export class Strider extends SerpentBase {
  targetX: number;
  constructor(x: number, y: number, facing = 1) {
    super('strider', x, y, facing);
    this.speed = 22;
    this.targetX = x + facing * 80;
    this.sight = 110;
    this.reaction = 'curious';
    this.eats = ['grub'];
    this.headLift = 4;
    this.setState('walk', 'foraging');
  }
  onAlert() {
    this.setState('look', 'scenting');
    audio.play('hiss', { vol: 0.25, pitch: 1.4 });
  }
  think(dt: number, ctx: Ctx) {
    this.flick(dt, this.state === 'look' ? 2 : 0.6);
    this.legLift = this.state === 'walk' || this.state === 'toLure' ? 1 : 0;
    if (this.lureTarget && this.state !== 'dig' && this.state !== 'look') this.setState('toLure', 'foraging');
    switch (this.state) {
      case 'walk': {
        if (this.slither(ctx, this.targetX, dt)) {
          const r = rand.next();
          if (r < 0.35) this.setState('dig', 'digging');
          else if (r < 0.55 && this.inLight) this.setState('bask', 'basking');
          else if (r < 0.75) this.setState('look', 'scenting');
          else this.targetX = clamp(this.x + rand.range(-160, 160), ctx.worldMinX + 40, ctx.worldMaxX - 40);
        }
        break;
      }
      case 'toLure': {
        const l = this.lureTarget;
        if (!l) { this.setState('walk', 'foraging'); break; }
        if (this.slither(ctx, l.x - this.facing * 8, dt, 28)) this.setState('dig', 'digging');
        break;
      }
      case 'dig': {
        this.slither(ctx, this.hx, dt, 0, -2);
        this.jaw = Math.max(0, Math.sin(this.stateT * 9)) * 0.4;
        if (rand.chance(dt * 8)) ctx.main.particles.spawn({ frame: A.dot, x: this.hx + this.facing * 3, y: this.hy + 3, vx: rand.range(-20, 20), vy: rand.range(-40, -15), ay: 160, life: 0.6, color: [0.35, 0.25, 0.16], alpha: 1, alpha1: 1 });
        if (this.lureTarget) eatLure(this, dt);
        if (this.stateT > 5 && !this.lureTarget) { this.jaw = 0; this.setState('walk', 'foraging'); this.targetX = this.x + rand.range(-150, 150); }
        break;
      }
      case 'bask':
        this.slither(ctx, this.hx, dt, 0, 1);
        if (this.stateT > 7) this.setState('walk', 'foraging');
        break;
      case 'look':
        this.slither(ctx, this.hx, dt, 0, 9);
        if (this.stateT > 3) {
          if (this.aware > 0.8) { this.targetX = this.x - Math.sign(ctx.player.x - this.x) * 200; this.speed = 40; }
          this.setState('walk', 'foraging');
        }
        break;
    }
    this.x = this.hx;
    this.y = this.hy;
  }
}

// ------------------------------------------------------------------ SPRINT VIPER (bipedal)
export class Sprinter extends SerpentBase {
  targetX: number;
  cooldown = 0;
  constructor(x: number, y: number, facing = 1) {
    super('sprinter', x, y, facing);
    this.speed = 30;
    this.targetX = x + facing * 120;
    this.sight = 170;
    this.wary = 1.2;
    this.reaction = 'threat';
    this.eats = ['grub'];
    this.headLift = 14;
    this.setState('walk', null);
  }
  onAlert() {
    this.setState('threat', 'threat');
    audio.play('hiss', { vol: 0.6, pitch: 0.9 });
  }
  think(dt: number, ctx: Ctx) {
    this.cooldown -= dt;
    this.flick(dt, 1);
    this.legLift = 1;
    const lift = (i: number, n: number) => {
      // body held horizontal at hip height, tail sloping down
      const u = i / n;
      return u < 0.35 ? 12 : u < 0.8 ? 12 * (1 - (u - 0.35) / 0.45) : 0;
    };
    const run = (tx: number, sp: number) => {
      const g = this.groundAt(ctx);
      const d = tx - this.hx;
      const nx = this.hx + Math.sign(d) * Math.min(Math.abs(d), sp * dt);
      if (Math.abs(d) > 2) this.facing = Math.sign(d);
      this.moveHead(nx, damp(this.hy, g(nx) - 16 - Math.abs(Math.sin(this.t * 14)) * (sp > 60 ? 2 : 0.5), 14, dt));
      this.settle(g, 0.6, lift);
      return Math.abs(d) <= 2;
    };
    switch (this.state) {
      case 'walk':
        if (run(this.targetX, this.speed)) {
          if (rand.chance(0.35)) { this.setState('sprint', 'running'); this.targetX = clamp(this.x + rand.sign() * rand.range(250, 400), ctx.worldMinX, ctx.worldMaxX); }
          else if (rand.chance(0.4)) this.setState('rest', 'resting');
          else this.targetX = clamp(this.x + rand.range(-180, 180), ctx.worldMinX + 30, ctx.worldMaxX - 30);
        }
        // hunt small mammals
        for (const c of ctx.creatures) {
          if ((c.id === 'delver' || c.id === 'shieldback') && Math.abs(c.x - this.x) < 160 && !c.fleeing && this.cooldown <= 0) {
            this.setState('hunt', 'hunting');
            this.huntTarget = c;
            this.cooldown = 12;
          }
        }
        break;
      case 'sprint':
        if (run(this.targetX, 150)) this.setState('walk', null);
        break;
      case 'hunt': {
        const c = this.huntTarget;
        if (!c || c.dead || this.stateT > 6) { this.setState('walk', null); break; }
        this.jaw = 0.5;
        if (run(c.x, 120)) {
          (c as Creature & { startle?: (x: number) => void }).startle?.(this.x);
          this.jaw = 0;
          this.setState('walk', null);
        }
        break;
      }
      case 'rest':
        run(this.hx, 0);
        if (this.stateT > 6) this.setState('walk', null);
        break;
      case 'threat': {
        run(this.hx, 0);
        this.facing = Math.sign(ctx.player.x - this.x) || 1;
        this.jaw = 0.6 + Math.sin(this.stateT * 20) * 0.1;
        if (this.stateT > 1.6) {
          const d = Math.abs(ctx.player.x - this.x);
          if (d < 120 && ctx.player.state !== 'hide') this.setState('charge', 'running');
          else { this.jaw = 0; this.setState('walk', null); this.targetX = this.x - Math.sign(ctx.player.x - this.x) * 200; }
        }
        break;
      }
      case 'charge': {
        this.jaw = 0.8;
        if (ctx.player.state === 'hide') { this.jaw = 0; this.setState('walk', null); break; }
        run(ctx.player.x, 140);
        if (Math.abs(ctx.player.x - this.hx) < 10 && Math.abs(ctx.player.y - this.hy) < 30) {
          ctx.caught(this, 1);
          this.jaw = 0;
          this.aware = 0;
          this.setState('sprint', 'running');
          this.targetX = this.x + this.facing * 400;
        }
        if (this.stateT > 3) { this.jaw = 0; this.setState('walk', null); }
        break;
      }
    }
    this.x = this.hx;
    this.y = this.hy;
  }
  huntTarget: Creature | null = null;
}

// ------------------------------------------------------------------ branch-dwellers
function surfaceY(s: Surface, x: number) {
  return Terrain.yAt(s, x) ?? s.pts[0][1];
}

// ------------------------------------------------------------------ SKYRIBBON (glider)
export class Skyribbon extends SerpentBase {
  branch: Surface | null = null;
  targetX = 0;
  glide: { x0: number; y0: number; x1: number; y1: number; t: number; T: number; to: Surface } | null = null;
  constructor(x: number, y: number, facing = 1) {
    super('skyribbon', x, y, facing);
    this.speed = 26;
    this.sight = 120;
    this.headLift = 2;
    this.setState('crawl', null);
  }
  pickBranch(ctx: Ctx) {
    const s = ctx.terrain.surfaceBelow(this.hx, this.hy - 10, 6, false);
    this.branch = s?.s ?? null;
  }
  onAlert(ctx: Ctx) {
    if (this.state !== 'glide') this.launch(ctx, true);
  }
  launch(ctx: Ctx, flee: boolean) {
    const others = ctx.terrain.surfaces.filter(s => s.oneWay && s !== this.branch && s.kind === 'branch');
    const cand = others.filter(s => {
      const cx = (s.pts[0][0] + s.pts[s.pts.length - 1][0]) / 2;
      const d = cx - this.hx;
      return Math.abs(d) > 80 && Math.abs(d) < 360 && surfaceY(s, cx) > this.hy - 20 && (!flee || Math.sign(d) !== Math.sign(ctx.player.x - this.hx));
    });
    if (!cand.length) return;
    const to = rand.pick(cand);
    const tx = clamp(this.hx + Math.sign((to.pts[0][0] + to.pts[to.pts.length - 1][0]) / 2 - this.hx) * rand.range(80, 200), to.pts[0][0] + 10, to.pts[to.pts.length - 1][0] - 10);
    const ty = surfaceY(to, tx) - 3;
    this.facing = Math.sign(tx - this.hx) || 1;
    this.glide = { x0: this.hx, y0: this.hy, x1: tx, y1: ty, t: 0, T: Math.abs(tx - this.hx) / 95 + 0.6, to };
    this.setState('glide', 'gliding');
    audio.play('whoosh', { vol: 0.35, pitch: 1.3 });
  }
  think(dt: number, ctx: Ctx) {
    if (!this.branch && this.state !== 'glide') this.pickBranch(ctx);
    this.flick(dt, 0.8);
    this.grounded = false;
    this.legLift = 0;
    const br = this.branch;
    const onBranch = (tx: number, sp: number) => {
      if (!br) return true;
      const x0 = br.pts[0][0] + 6, x1 = br.pts[br.pts.length - 1][0] - 6;
      tx = clamp(tx, x0, x1);
      const d = tx - this.hx;
      if (Math.abs(d) > 1) this.facing = Math.sign(d);
      const nx = this.hx + Math.sign(d) * Math.min(Math.abs(d), sp * dt);
      this.moveHead(nx, damp(this.hy, surfaceY(br, nx) - 3 - this.headLift, 10, dt));
      this.settle(x => (x >= br.pts[0][0] && x <= br.pts[br.pts.length - 1][0] ? surfaceY(br, x) : this.hy + 30), 0.4);
      return Math.abs(d) <= 1;
    };
    switch (this.state) {
      case 'crawl':
        this.flatten = damp(this.flatten, 0, 4, dt);
        if (onBranch(this.targetX, this.speed)) {
          const r = rand.next();
          if (r < 0.3) this.setState('coil', 'coiled');
          else if (r < 0.55) this.setState('hunt', 'hunting');
          else if (r < 0.8) this.launch(ctx, false);
          else if (br) this.targetX = rand.range(br.pts[0][0], br.pts[br.pts.length - 1][0]);
        }
        break;
      case 'coil': {
        onBranch(this.hx, 0);
        // drape loops below the branch
        const n = this.pts.length;
        for (let i = 6; i < n; i++) {
          const u = (i - 6) / (n - 6);
          const p = this.pts[i];
          p[1] = lerp(p[1], p[1] + Math.sin(u * TAU * 1.5) * 4 + u * 6, 0.05);
        }
        if (this.stateT > 8) this.setState('crawl', null);
        break;
      }
      case 'hunt':
        onBranch(this.hx, 0);
        this.headLift = 2 + Math.max(0, Math.sin(this.stateT * 3)) * 10;
        this.jaw = this.stateT % 2.2 > 1.9 ? 0.7 : 0;
        if (this.stateT > 5) { this.headLift = 2; this.jaw = 0; this.setState('crawl', null); }
        break;
      case 'glide': {
        const g = this.glide!;
        g.t += dt;
        const k = clamp(g.t / g.T, 0, 1);
        const x = lerp(g.x0, g.x1, k);
        const y = lerp(g.y0, g.y1, k) + Math.sin(k * Math.PI) * 22 - (k < 0.15 ? k * 30 : 0);
        this.flatten = damp(this.flatten, 1, 8, dt);
        this.moveHead(x, y);
        // aerial undulation
        const n = this.pts.length;
        for (let i = 2; i < n; i++) this.pts[i][1] += Math.sin(this.t * 9 - i * 0.3) * 0.9;
        if (k >= 1) {
          this.branch = g.to;
          this.glide = null;
          this.targetX = this.hx + this.facing * 30;
          this.setState('crawl', null);
          this.aware *= 0.3;
        }
        break;
      }
      case 'carried':
        break;
    }
    this.x = this.hx;
    this.y = this.hy;
  }
}

// ------------------------------------------------------------------ LANTERN LURE-VIPER
export class LureViper extends SerpentBase {
  branch: Surface | null = null;
  constructor(x: number, y: number, facing = 1) {
    super('lurevip', x, y, facing);
    this.sight = 90;
    this.reaction = 'freeze';
    this.headLift = 1;
    this.setState('coil', 'coiled');
  }
  think(dt: number, ctx: Ctx) {
    if (!this.branch) this.branch = ctx.terrain.surfaceBelow(this.hx, this.hy - 10, 6, false)?.s ?? null;
    const br = this.branch;
    this.grounded = false;
    this.flick(dt, 0.5);
    const night = ctx.tod === 'night' || ctx.tod === 'dusk';
    if (br) {
      this.moveHead(this.hx, damp(this.hy, surfaceY(br, this.hx) - 3 - this.headLift, 8, dt));
      // body along the branch then the tail dangles down with the lure
      const n = this.pts.length;
      for (let i = 1; i < n; i++) {
        const u = i / n;
        const p = this.pts[i];
        const bx = this.hx - this.facing * i * this.spacing * (u < 0.6 ? 1 : 0.6);
        if (u < 0.6) {
          p[0] = lerp(p[0], bx, 0.3);
          p[1] = lerp(p[1], surfaceY(br, bx) - 3, 0.3);
        } else {
          const k = (u - 0.6) / 0.4;
          const sway = this.state === 'lure' ? Math.sin(this.t * 2.2) * 6 * k : 0;
          p[0] = lerp(p[0], bx + sway, 0.2);
          p[1] = lerp(p[1], surfaceY(br, bx) - 3 + k * 28, 0.2);
        }
      }
      followSpine(this.pts, this.spacing);
    }
    this.lureGlow = damp(this.lureGlow, night ? (this.state === 'lure' ? 1 : 0.35) : 0, 2, dt);
    switch (this.state) {
      case 'coil':
        if (night && this.stateT > 3) this.setState('lure', 'luring');
        break;
      case 'lure':
        if (!night) this.setState('coil', 'coiled');
        for (const c of ctx.creatures) {
          if (c.id === 'sailglider' && Math.abs(c.x - this.x) < 60 && Math.abs(c.y - this.y) < 60 && this.stateT > 4) {
            this.setState('strike', 'striking');
            (c as Creature & { startle?: (x: number) => void }).startle?.(this.x);
          }
        }
        if (this.stateT > 14 && rand.chance(dt * 0.2)) this.setState('strike', 'striking');
        break;
      case 'strike':
        this.headLift = Math.sin(clamp(this.stateT / 0.5) * Math.PI) * 16;
        this.jaw = this.stateT < 0.5 ? 1 : 0;
        if (this.stateT > 1.4) { this.headLift = 1; this.setState('lure', 'luring'); }
        break;
    }
    this.x = this.hx;
    this.y = this.hy;
  }
}

// ------------------------------------------------------------------ swimmers helpers
function swimTo(s: SerpentBase, tx: number, ty: number, dt: number, speed: number, amp: number) {
  const dx = tx - s.hx, dy = ty - s.hy;
  const d = Math.hypot(dx, dy);
  if (d < 2) return true;
  if (Math.abs(dx) > 1) s.facing = Math.sign(dx);
  const step = Math.min(d, speed * dt);
  s.moveHead(s.hx + (dx / d) * step, s.hy + (dy / d) * step);
  const n = s.pts.length;
  for (let i = 1; i < n; i++) s.pts[i][1] += Math.sin(s.wavePhase * 0.8 - i * 0.18) * amp * 0.08 * Math.sin((i / n) * Math.PI);
  return false;
}

// ------------------------------------------------------------------ MUDRIBBON
export class Mudribbon extends SerpentBase {
  tx: number;
  constructor(x: number, y: number, facing = 1) {
    super('mudribbon', x, y, facing);
    this.tx = x + facing * 150;
    this.sight = 110;
    this.eats = ['fish'];
    this.setState('swim', 'swimming');
  }
  think(dt: number, ctx: Ctx) {
    const wy = ctx.waterY ?? this.hy;
    this.grounded = false;
    this.submergeY = wy + 1;
    this.flick(dt, 0.4);
    if (this.lureTarget && this.state === 'swim') this.tx = this.lureTarget.x;
    switch (this.state) {
      case 'swim':
        if (swimTo(this, this.tx, wy - 1, dt, 26, 10)) {
          if (this.lureTarget || rand.chance(0.45)) this.setState('fish', 'fishing');
          else this.tx = clamp(this.hx + rand.range(-220, 220), ctx.worldMinX + 40, ctx.worldMaxX - 40);
        }
        for (let i = 1; i < this.pts.length; i++) this.pts[i][1] = lerp(this.pts[i][1], wy, 0.2);
        break;
      case 'fish':
        this.moveHead(this.hx + this.facing * 0.2, wy + Math.sin(this.stateT * 4) * 5 + 3);
        if (Math.floor(this.stateT * 2) !== Math.floor((this.stateT - dt) * 2) && rand.chance(0.4)) ctx.splash(this.hx, wy, 0.4);
        if (this.lureTarget) eatLure(this, dt);
        if (this.stateT > 4) { this.setState('swim', 'swimming'); this.tx = this.hx + rand.range(-200, 200); }
        break;
    }
    if (this.alerted && !this.fleeing) {
      this.fleeing = true;
      this.tx = this.hx + Math.sign(this.hx - ctx.player.x) * 600;
      this.setState('swim', 'swimming');
      ctx.splash(this.hx, wy, 0.6);
    }
    this.x = this.hx;
    this.y = this.hy;
  }
}

// ------------------------------------------------------------------ CRAG VIPER (cliff climber)
export class CragViper extends SerpentBase {
  path: Pt[] = [];
  pathT = 0;
  dir = 1;
  constructor(x: number, y: number, path: Pt[]) {
    super('cragviper', x, y, 1);
    this.path = path;
    this.sight = 120;
    this.reaction = 'freeze';
    this.setState('climb', 'climbing');
    this.pts = makeSpine(path[0][0], path[0][1], 1, this.look.length, this.spacing);
  }
  pointAt(t: number): Pt {
    const P = this.path;
    const f = clamp(t, 0, 1) * (P.length - 1);
    const i = Math.min(P.length - 2, Math.floor(f));
    const k = f - i;
    return [lerp(P[i][0], P[i + 1][0], k), lerp(P[i][1], P[i + 1][1], k)];
  }
  think(dt: number, ctx: Ctx) {
    this.grounded = false;
    this.flick(dt, 0.7);
    switch (this.state) {
      case 'climb': {
        this.pathT = clamp(this.pathT + this.dir * dt * 0.03, 0, 1);
        const [x, y] = this.pointAt(this.pathT);
        this.moveHead(x + Math.sin(this.t * 3) * 1.5, y);
        if (this.pathT >= 1 || this.pathT <= 0) {
          this.setState(this.pathT >= 1 ? 'raid' : 'bask', this.pathT >= 1 ? 'raiding' : 'basking');
        }
        break;
      }
      case 'raid':
        this.jaw = Math.max(0, Math.sin(this.stateT * 5)) * 0.8;
        this.moveHead(this.hx + Math.sin(this.stateT * 2) * 0.3, this.hy);
        if (this.stateT > 6) { this.jaw = 0; this.dir = -1; this.setState('climb', 'climbing'); }
        break;
      case 'bask':
        this.moveHead(this.hx, this.hy);
        if (this.stateT > 8) { this.dir = 1; this.setState('climb', 'climbing'); }
        break;
    }
    if (this.alerted && this.state === 'climb') this.pathT -= this.dir * dt * 0.015; // freeze-ish
    void ctx;
    this.x = this.hx;
    this.y = this.hy;
  }
}

// ------------------------------------------------------------------ IRONJAW CROCODILE
export class Ironjaw extends SerpentBase {
  tx: number;
  bankX: number;
  lungeCD = 3;
  constructor(x: number, y: number, bankX: number) {
    super('ironjaw', x, y, 1);
    this.tx = x;
    this.bankX = bankX;
    this.sight = 150;
    this.reaction = 'threat';
    this.eats = ['fish'];
    this.spacing = 2;
    this.headLift = 0;
    this.setState('lurk', 'lurking');
  }
  think(dt: number, ctx: Ctx) {
    const wy = ctx.waterY ?? this.hy;
    this.lungeCD -= dt;
    const p = ctx.player;
    switch (this.state) {
      case 'lurk': {
        this.grounded = false;
        this.legLift = 0;
        this.submergeY = wy - 2;
        swimTo(this, this.tx, wy + 3, dt, 12, 3);
        for (let i = 1; i < this.pts.length; i++) this.pts[i][1] = lerp(this.pts[i][1], wy + 4, 0.1);
        if (this.stateT > 12) {
          if (rand.chance(0.5)) { this.setState('toBank', 'swimming'); }
          else this.tx = clamp(this.hx + rand.range(-200, 200), ctx.worldMinX + 60, ctx.worldMaxX - 60);
          this.stateT = rand.range(0, 4);
        }
        // lunge at anything at the water's edge
        const nearEdge = Math.abs(p.x - this.hx) < 70 && p.y > wy - 26 && p.state !== 'hide';
        if (nearEdge && this.lungeCD <= 0 && this.aware > 0.5) this.setState('lunge', 'lunging');
        for (const c of ctx.creatures) if (c.id === 'snakestork' && Math.abs(c.x - this.hx) < 50 && this.lungeCD <= 0 && c.y > wy - 20) {
          this.setState('lunge', 'lunging');
          (c as Creature & { startle?: (x: number) => void }).startle?.(this.x);
        }
        break;
      }
      case 'toBank': {
        this.submergeY = wy + 1;
        const g = this.groundAt(ctx);
        const arrived = swimTo(this, this.bankX, Math.min(g(this.bankX) - 7, wy + 1), dt, 18, 4);
        this.grounded = g(this.hx) < wy + 2;
        this.legLift = this.grounded ? 1 : 0;
        if (this.grounded) this.settle(x => Math.min(g(x), wy + 6), 0.3);
        if (arrived) this.setState('bask', 'basking');
        break;
      }
      case 'bask': {
        this.submergeY = wy + 2;
        this.grounded = true;
        this.legLift = 0;
        const g = this.groundAt(ctx);
        this.settle(x => Math.min(g(x), wy + 6), 0.2);
        this.jaw = damp(this.jaw, this.stateT > 1 && this.stateT < 14 ? 0.85 : 0, 2, dt);
        if (this.stateT > 16 || (this.alerted && Math.abs(p.x - this.hx) < 110)) {
          this.jaw = 0;
          this.tx = this.hx - this.facing * rand.range(120, 220);
          this.setState('lurk', 'lurking');
          ctx.splash(this.hx, wy, 1);
        }
        break;
      }
      case 'lunge': {
        const k = this.stateT;
        this.submergeY = wy + 1;
        this.jaw = k < 0.6 ? 1 : 0;
        const target = p;
        if (k < 0.1) { audio.play('croc', { vol: 0.8 }); ctx.splash(this.hx, wy, 1.4); ctx.st.shake(2, 0.3); }
        if (k < 0.5) {
          this.facing = Math.sign(target.x - this.hx) || this.facing;
          this.moveHead(this.hx + this.facing * 150 * dt, damp(this.hy, wy - 10, 10, dt));
          if (Math.abs(p.x - this.hx) < 16 && p.y > wy - 30 && p.state !== 'hide') ctx.caught(this, 2);
        } else swimTo(this, this.hx - this.facing * 20, wy + 3, dt, 30, 4);
        if (k > 1.6) { this.lungeCD = 8; this.setState('lurk', 'lurking'); }
        break;
      }
    }
    this.x = this.hx;
    this.y = this.hy;
  }
}

// ------------------------------------------------------------------ TITAN CONSTRICTOR
export class Titan extends SerpentBase {
  tx: number;
  strikeCD = 4;
  scripted = false;
  constructor(x: number, y: number, facing = 1) {
    super('titan', x, y, facing, 620, 190);
    this.tx = x;
    this.sight = 190;
    this.wary = 0.7;
    this.reaction = 'threat';
    this.depth = 0.5;
    this.waveAmp = 2;
    this.setState('ambush', 'ambush');
  }
  think(dt: number, ctx: Ctx) {
    if (this.scripted) return;
    const wy = ctx.waterY ?? this.hy;
    this.strikeCD -= dt;
    this.grounded = false;
    this.flick(dt, 0.3);
    const p = ctx.player;
    switch (this.state) {
      case 'ambush':
        this.submergeY = wy + 2;
        swimTo(this, this.tx, wy + 4, dt, 4, 2);
        for (let i = 1; i < this.pts.length; i++) this.pts[i][1] = lerp(this.pts[i][1], wy + 8 + Math.sin(i * 0.05) * 4, 0.05);
        if (this.stateT > 18) { this.setState('swim', 'swimming'); this.tx = clamp(this.hx + rand.range(-300, 300), ctx.worldMinX + 100, ctx.worldMaxX - 100); }
        break;
      case 'swim':
        this.submergeY = wy + 1;
        if (swimTo(this, this.tx, wy - 2, dt, 20, 16)) this.setState(rand.chance(0.5) ? 'ambush' : 'swim', rand.chance(0.5) ? 'ambush' : 'swimming');
        for (let i = 1; i < this.pts.length; i++) this.pts[i][1] = lerp(this.pts[i][1], wy + Math.sin(this.t * 1.5 - i * 0.08) * 4, 0.1);
        if (this.state === 'swim' && this.stateT > 0.1) this.tx = this.tx;
        break;
      case 'rear': {
        // raises its head high out of the water toward the player
        this.submergeY = wy + 2;
        const k = clamp(this.stateT / 1.2);
        this.facing = Math.sign(p.x - this.hx) || this.facing;
        this.moveHead(lerp(this.hx, this.hx + this.facing * 0.5, k), lerp(this.hy, wy - 60, k * 0.1));
        this.jaw = this.stateT > 1 ? 0.6 : 0;
        if (this.stateT > 2.2) {
          if (p.state === 'hide' || Math.abs(p.x - this.hx) > 200) { this.jaw = 0; this.setState('swim', 'swimming'); this.aware = 0.2; this.alerted = false; }
          else this.setState('strike', 'hunting');
        }
        break;
      }
      case 'strike': {
        const k = this.stateT;
        this.jaw = 1;
        if (k < 0.12) { audio.play('roar', { vol: 1 }); ctx.st.shake(4, 0.6); }
        this.moveHead(this.hx + this.facing * 260 * dt, damp(this.hy, p.y - 20, 8, dt));
        if (Math.abs(p.x - this.hx) < 22 && p.state !== 'hide') { ctx.caught(this, 3); this.setState('swim', 'swimming'); this.jaw = 0; this.tx = this.hx - this.facing * 300; this.strikeCD = 10; }
        if (k > 0.8) { this.jaw = 0; this.setState('swim', 'swimming'); this.tx = this.hx - this.facing * 200; this.strikeCD = 10; }
        break;
      }
      case 'digest':
        this.swell = { at: 0.45, k: 0.9 };
        this.submergeY = undefined;
        this.grounded = true;
        if (this.stateT > 30) { this.swell = undefined; this.setState('swim', 'swimming'); }
        break;
    }
    if (this.alerted && this.strikeCD <= 0 && (this.state === 'ambush' || this.state === 'swim') && Math.abs(p.x - this.hx) < 180) {
      this.setState('rear', 'hunting');
      audio.play('hiss', { vol: 0.9, pitch: 0.5 });
      this.strikeCD = 6;
    }
    this.x = this.hx;
    this.y = this.hy;
  }
}

// ------------------------------------------------------------------ FINNED LEVIATHAN (underwater)
export class Leviathan extends SerpentBase {
  tx: number;
  ty: number;
  constructor(x: number, y: number, facing = -1) {
    super('leviathan', x, y, facing, 820, 280);
    this.tx = x;
    this.ty = y;
    this.sight = 200;
    this.reaction = 'curious';
    this.wary = 0.4;
    this.grounded = false;
    this.spacing = 3;
    this.pts = makeSpine(x, y, facing, this.look.length, this.spacing);
    this.setState('cruise', 'hunting');
  }
  think(dt: number, ctx: Ctx) {
    const surf = ctx.waterY ?? 40;
    const floor = ctx.terrain.groundY(this.hx);
    switch (this.state) {
      case 'cruise':
        if (swimTo(this, this.tx, this.ty, dt, 34, 30)) {
          const r = rand.next();
          if (r < 0.3) { this.setState('surface', 'surfacing'); this.tx = this.hx + this.facing * 200; this.ty = surf - 18; }
          else if (r < 0.6) { this.setState('rest', 'breathing'); }
          else { this.tx = clamp(this.hx + rand.range(-500, 500), ctx.worldMinX + 50, ctx.worldMaxX - 50); this.ty = rand.range(surf + 60, floor - 50); this.setState('cruise', 'hunting'); }
        }
        break;
      case 'surface':
        if (swimTo(this, this.tx, this.ty, dt, 40, 20) || this.stateT > 8) {
          ctx.splash(this.hx, surf, 2);
          this.ty = surf + 80;
          this.tx = this.hx + this.facing * 200;
          this.setState('cruise', 'hunting');
        }
        break;
      case 'rest':
        swimTo(this, this.hx + this.facing * 4, this.hy + Math.sin(this.stateT) * 0.3, dt, 6, 8);
        if (this.stateT > 9) { this.tx = this.hx + this.facing * 300; this.setState('cruise', 'hunting'); }
        break;
    }
    // keep under the surface / above the floor
    for (const p of this.pts) p[1] = clamp(p[1], surf - 30, ctx.terrain.groundY(p[0]) - 12);
    this.x = this.hx;
    this.y = this.hy;
  }
}

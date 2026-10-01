// V9 Trycop crabs in the world: a live rig (src/art/v9/wild/trycop.ts) re-rasterised every frame it
// is on screen, driven by a small behaviour machine. It forages on the rocks (the fork picks algae
// and feeds the mouth, the cutter scrapes, the eyes swivel), scuttles sideways to new spots on a
// real tetrapod gait, rears up in a claws-high threat display when you come close (creep up
// crouched and it keeps eating), snaps if you push in, and when harassed it runs for its crevice
// and backs in until only the eye stalks peek over the lip. Chunk gets the same treatment.
// "Examine the Trycop crab" opens the full-screen close-up.

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Drawable } from '../../world/stage';
import { DynamicSprite } from '../../gfx/atlas';
import { Sk } from '../../art/beasts-core';
import { drawTrycop, trycopRest, trycopCanvas, TrycopPose } from '../../art/v9/wild/trycop';
import { creviceRock, trycopMoult } from '../../art/v9/wild/rocks';
import { Custom } from '../../world/props';
import { local, A } from '../assets';
import { game } from '../game';
import { audio } from '../../core/audio';
import { add } from '../inventory';
import { ITEMS } from '../items';
import { clamp, damp, rand } from '../../core/math';
import { groundY } from '../../art/island4/layout';
import type { IslandScene4 } from '../v4/island';

type TState = 'forage' | 'scuttle' | 'threat' | 'snap' | 'retreat' | 'hide' | 'emerge';

export interface TrycopSpec {
  x: number;
  /** the crevice it runs to */
  crevice: number;
  /** forage range */
  range: [number, number];
  /** scale (1 = the standard 40 px crab) */
  k: number;
  hue: number;
  parasite: boolean;
  seed: number;
}

/** sprites made for this scene (disposed when the next island scene starts) */
const sprites: DynamicSprite[] = [];
export function disposeTrycopSprites() {
  for (const s of sprites.splice(0)) s.dispose();
}

export class TrycopCrab implements Drawable {
  readonly species = 'trycop';
  z = 31;
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
  act = 'forage';
  state: TState = 'forage';
  behavior = 'foraging';
  readonly P: TrycopPose = trycopRest();
  readonly k: number;
  private t = rand.next() * 10;
  private st = 0;
  private tx: number;
  private nextMove = rand.range(3, 7);
  private feedPh = rand.next();
  private feedOn = true;
  private scrapeT = rand.range(3, 8);
  private eyeT = 0;
  private eyeTg: [number, number] = [0, 0];
  private shuffleT = 1;
  private shuffleLeg = -1;
  private calmT = 0;
  private pushT = 0;
  private snapCool = 0;
  private dogCool = 0;
  private spr: DynamicSprite;
  private cv: { w: number; h: number; ox: number; oy: number };
  private lastOut: { eyes: [number, number][]; crush: [number, number]; cut: [number, number]; sac: [number, number] | null } | null = null;
  private rockBack: Frame;
  private rockLip: Frame;
  private lipY: number;
  body: { bounds: (a: TrycopCrab) => { x0: number; y0: number; x1: number; y1: number }; points: (a: TrycopCrab) => [number, number][] };

  constructor(readonly s: IslandScene4, readonly spec: TrycopSpec) {
    this.k = spec.k;
    this.x = spec.x;
    this.tx = spec.x;
    this.y = groundY(spec.x) + 2;
    this.cv = trycopCanvas(this.k);
    this.spr = new DynamicSprite(game.r, this.cv.w, this.cv.h, this.cv.ox, this.cv.oy);
    sprites.push(this.spr);
    const rock = creviceRock(spec.seed);
    this.rockBack = local.add(`v9:crev:${spec.seed}`, rock.back.buf, rock.back.ax, rock.back.ay);
    this.rockLip = local.add(`v9:crevlip:${spec.seed}`, rock.lip.buf, rock.lip.ax, rock.lip.ay);
    this.lipY = rock.lipY;
    // the crevice boulder sits behind the crab, its front lip in front of it
    const rx = spec.crevice, ry = groundY(rx) + 3;
    s.main.add(new Custom(this.z - 0.5, rr => { if (this.onScreen(rr, 60)) rr.draw(this.rockBack, rx, ry); }));
    s.main.add(new Custom(this.z + 0.5, rr => { if (this.onScreen(rr, 60) && (this.P.sink > 0.02 || Math.abs(this.x - rx) < 30)) rr.draw(this.rockLip, rx, ry); }));
    this.body = {
      bounds: a => {
        const k = a.k, rear = a.P.rear, sink = a.P.sink;
        if (sink > 0.6) return { x0: a.x - 6 * k, y0: a.y - 17 * k, x1: a.x + 6 * k, y1: a.y - 9 * k };
        return { x0: a.x - 19 * k, y0: a.y - (13 + rear * 13) * k, x1: a.x + 19 * k, y1: a.y + 3 * k };
      },
      points: a => {
        const k = a.k, h = (10 + a.P.rear * 8) * k;
        if (a.P.sink > 0.6) return [[a.x - 2.5 * k, a.y - 13 * k], [a.x + 2.5 * k, a.y - 13 * k]];
        return [[a.x, a.y - h * 0.55], [a.x - 8 * k, a.y - h * 0.5], [a.x + 8 * k, a.y - h * 0.5], [a.x, a.y - h * 0.95], [a.x - 15 * k, a.y - 2 * k], [a.x + 15 * k, a.y - 2 * k], [a.x - 5 * k, a.y - 2], [a.x + 5 * k, a.y - 2]];
      },
    };
  }

  photoInfo() {
    return { species: this.species, behavior: this.behavior, box: this.body.bounds(this), pts: this.body.points(this), speed: this.speed, facing: 1, noticed: this.state === 'threat' || this.state === 'snap' || this.state === 'retreat', juvenile: false, p: this.p, hidden: this.hidden };
  }

  /** the parasite shows as its own photo subject while the crab rears (see wildlife.ts) */
  sacPoint(): [number, number] | null {
    const o = this.lastOut;
    if (!o?.sac || this.P.rear < 0.5) return null;
    return [this.x + o.sac[0], this.y + o.sac[1]];
  }

  private onScreen(r: Renderer, m: number) {
    const sx = r.projectX(this.x, 1);
    return sx > -m * 2 && sx < r.VW + m * 2;
  }

  private go(st: TState) {
    this.state = st;
    this.st = 0;
  }

  /** is something (Mori, Chunk) crowding the crab? returns the signed distance to the nearest */
  private threatDist(): { d: number; who: 'mori' | 'chunk' | null; run: boolean } {
    const p = this.s.player;
    let d = Infinity, who: 'mori' | 'chunk' | null = null, run = false;
    if (Math.abs(p.y - this.y) < 50) {
      const run0 = Math.abs(p.vx) > 75, sneak = p.crouch || (p.camera && Math.abs(p.vx) < 30) || p.state === 'hide';
      const r = (run0 ? 1.7 : sneak ? 0.5 : 1) * Math.abs(p.x - this.x);
      d = r; who = 'mori'; run = run0;
    }
    const c = this.s.chunk;
    if (c?.visible && Math.abs(c.y - this.y) < 40) {
      const r = Math.abs(c.x - this.x) * 1.15;
      if (r < d) { d = r; who = 'chunk'; run = Math.abs(c.vx) > 90; }
    }
    return { d, who, run };
  }

  update(dt: number) {
    const cam = this.s.st.cam;
    if (Math.abs(cam.x - this.x) > 900) return;
    this.t += dt;
    this.st += dt;
    this.snapCool -= dt;
    this.dogCool -= dt;
    const P = this.P, k = this.k;
    P.t = this.t;
    const th = this.threatDist();
    const alertR = 72 * k, snapR = 24 * k;
    let move = 0;
    // targets for the smoothly damped pose channels
    let rear = 0, low = 0.3, cr = 0, cu = 0, co = 0.15, uo = 0.1, reach = 0, sink = 0;
    let fext = 0, flift = 0, fopen = 0.2, mouth = 0.15 + Math.sin(this.t * 1.7) * 0.1;
    switch (this.state) {
      case 'forage': {
        this.behavior = 'foraging';
        this.act = 'forage';
        low = 0.45;
        // the fork routine: reach down, pinch, lift to the mouth, chew
        if (this.feedOn) {
          this.feedPh += dt / 2.3;
          const f = this.feedPh % 1;
          fext = f < 0.85 ? 1 : 1 - (f - 0.85) / 0.15;
          fopen = f < 0.28 ? 1 : f < 0.4 ? 1 - (f - 0.28) / 0.12 : 0.05;
          flift = f < 0.4 ? 0 : f < 0.7 ? (f - 0.4) / 0.3 : 1;
          if (f > 0.66) mouth = 0.55 + Math.sin(this.t * 17) * 0.45;
          if (this.feedPh > 3 + rand.next() * 0.02 && rand.chance(dt * 0.3)) { this.feedOn = false; this.feedPh = 0; }
        } else if (rand.chance(dt * 0.6)) this.feedOn = true;
        // the cutter scrapes algae now and then
        this.scrapeT -= dt;
        if (this.scrapeT < 0) { cu = -0.45; uo = 0.5 + Math.sin(this.t * 14) * 0.4; if (this.scrapeT < -1.1) this.scrapeT = rand.range(4, 9); }
        this.nextMove -= dt;
        if (this.nextMove <= 0) {
          this.nextMove = rand.range(5, 12);
          const [a, b] = this.spec.range;
          this.tx = clamp(this.x + rand.range(18, 48) * rand.sign(), a, b);
          this.go('scuttle');
        }
        if (th.d < alertR) this.startThreat(th.who);
        break;
      }
      case 'scuttle': {
        this.behavior = 'scuttling';
        this.act = 'wander';
        move = Math.sign(this.tx - this.x) * 24 * k;
        cr = 0.14; cu = 0.12;
        if (Math.abs(this.tx - this.x) < 2) { this.go('forage'); this.feedOn = true; }
        if (th.d < alertR) this.startThreat(th.who);
        break;
      }
      case 'threat': {
        this.behavior = 'threat';
        this.act = 'display';
        rear = 0.88 + Math.sin(this.t * 3.1) * 0.06;
        low = 0;
        cr = 1; cu = 0.95;
        co = 0.78 + Math.sin(this.t * 7.3) * 0.22;
        uo = 0.8 + Math.sin(this.t * 6.1 + 1) * 0.2;
        mouth = 0.5 + Math.sin(this.t * 11) * 0.3;
        // edge away from the intruder
        const p = this.s.player;
        const away = th.who === 'chunk' ? Math.sign(this.x - this.s.chunk.x) : Math.sign(this.x - p.x);
        move = away * 5 * k * (Math.sin(this.t * 1.3) > 0 ? 1 : 0);
        if (th.d > alertR + 26 * k) { this.calmT += dt; if (this.calmT > 1.4) { this.go('forage'); this.feedOn = false; } }
        else this.calmT = 0;
        if (th.d < alertR) this.pushT += dt * (th.run ? 3 : 1);
        if (th.d < snapR && this.snapCool <= 0) { this.go('snap'); this.snapCool = 1.6; }
        else if (this.pushT > 3.2 || (th.run && th.d < alertR * 0.8)) this.go('retreat');
        break;
      }
      case 'snap': {
        this.behavior = 'snapping';
        this.act = 'display';
        rear = 0.5; cu = 0.8; uo = 0.9;
        const q = this.st / 0.42;
        cr = 0.3;
        reach = q < 0.3 ? q / 0.3 : q < 0.6 ? 1 : 1 - (q - 0.6) / 0.4;
        co = q < 0.28 ? 1 : 0;
        if (this.st - dt < 0.12 && this.st >= 0.12) this.clack();
        if (q >= 1) { this.go('threat'); this.pushT += 0.8; }
        break;
      }
      case 'retreat': {
        this.behavior = 'scuttling';
        this.act = 'flee';
        cr = 0.45; cu = 0.4; rear = 0.15;
        const d = this.spec.crevice - this.x;
        move = Math.sign(d) * 72 * k;
        if (Math.abs(d) < 3) { this.x = this.spec.crevice; this.go('hide'); audio.play('rustle', { vol: 0.12, pitch: 1.6 }); }
        break;
      }
      case 'hide': {
        this.behavior = 'hiding';
        this.act = 'hide';
        sink = 1; low = 1; cr = -0.2; cu = -0.2;
        if (th.d > 110 * k) this.calmT += dt; else this.calmT = 0;
        if (this.calmT > 4 && this.st > 3) { this.go('emerge'); this.calmT = 0; }
        break;
      }
      case 'emerge': {
        this.behavior = 'hiding';
        this.act = 'forage';
        sink = 0; low = 0.6;
        if (this.st > 1.3) { this.go('forage'); this.pushT = 0; this.feedOn = true; this.nextMove = rand.range(2, 5); }
        if (th.d < alertR * 0.8 && this.st > 0.4) this.go('hide');
        break;
      }
    }
    // ---- motion: sideways scuttle with the gait advanced by distance (planted feet never skate)
    this.vx = damp(this.vx, move, 10, dt);
    const [a0, b0] = this.spec.range;
    const nx = this.state === 'retreat' || this.state === 'hide' ? this.x + this.vx * dt : clamp(this.x + this.vx * dt, Math.min(a0, this.spec.crevice), Math.max(b0, this.spec.crevice));
    const dist = nx - this.x;
    this.x = nx;
    this.y = groundY(this.x) + 2;
    this.speed = Math.abs(this.vx);
    const moving = Math.abs(this.vx) > 1.5;
    P.gait += Math.abs(dist) / (9.3 * k);
    P.step = damp(P.step, moving ? 1 : 0, 8, dt);
    if (moving) P.dir = Math.sign(this.vx);
    const gp = P.gait * Math.PI * 4;
    P.bob = moving ? Math.cos(gp) * 0.35 : Math.sin(this.t * 1.6) * 0.18;
    P.roll = moving ? Math.sin(P.gait * Math.PI * 2) * 0.04 : damp(P.roll, 0, 3, dt);
    // ---- the damped channels
    const lam = this.state === 'snap' ? 30 : 7;
    P.rear = damp(P.rear, rear, 6, dt);
    P.low = damp(P.low, low, 4, dt);
    P.sink = damp(P.sink, sink, this.state === 'hide' ? 5 : 3, dt);
    P.crush.raise = damp(P.crush.raise, cr, lam, dt);
    P.crush.open = damp(P.crush.open, co, lam * 1.5, dt);
    P.crush.reach = damp(P.crush.reach, reach, 30, dt);
    P.cut.raise = damp(P.cut.raise, cu, 7, dt);
    P.cut.open = damp(P.cut.open, uo, 10, dt);
    P.fork.ext = damp(P.fork.ext, fext, 9, dt);
    P.fork.lift = damp(P.fork.lift, flift, 9, dt);
    P.fork.open = damp(P.fork.open, fopen, 14, dt);
    P.fork.side = damp(P.fork.side, Math.sin(this.t * 0.37) * 0.6, 2, dt);
    P.mouth = damp(P.mouth, clamp(mouth), 14, dt);
    P.flick += dt * (3 + Math.sin(this.t * 0.7) * 2);
    // eyes: glance about; in threat and hiding they lock onto the intruder
    this.eyeT -= dt;
    if (this.eyeT <= 0) {
      this.eyeT = rand.range(0.7, 2.6);
      this.eyeTg = [rand.range(-0.7, 0.7), rand.range(-0.7, 0.7)];
      if (rand.chance(0.35)) this.eyeTg[1] = this.eyeTg[0];
    }
    const look = this.state === 'threat' || this.state === 'snap' || this.state === 'hide' ? clamp((this.s.player.x - this.x) / 60, -0.8, 0.8) : null;
    for (let i = 0; i < 2; i++) {
      const e = P.eyes[i];
      e.sw = damp(e.sw, look ?? this.eyeTg[i], 9, dt);
      const fold = this.state === 'hide' ? (i ? 0.1 : 0.25) : this.state === 'retreat' ? 0.4 : 0;
      e.fold = damp(e.fold, fold, 8, dt);
    }
    // idle leg shuffles: one leg lifts and resettles
    this.shuffleT -= dt;
    if (this.shuffleT <= 0) { this.shuffleT = rand.range(0.8, 3); this.shuffleLeg = moving ? -1 : rand.int(0, 7); }
    for (let i = 0; i < 8; i++) P.shuffle[i] = damp(P.shuffle[i], i === this.shuffleLeg && this.shuffleT > 0.55 ? 1.3 : 0, 14, dt);
    this.hidden = P.sink > 0.6 ? 0.82 : 0;
  }

  private startThreat(who: 'mori' | 'chunk' | null) {
    this.go('threat');
    this.pushT = 0;
    this.calmT = 0;
    audio.play('rustle', { vol: 0.14, pitch: 1.8 });
    if (who === 'chunk' && this.dogCool <= 0) {
      this.dogCool = 12;
      const c = this.s.chunk;
      c.showEmote('exclaim', 1.2);
      c.react('jump');
      if (!game.ui.bubbles.active) game.ui.bubbles.bark('chunk', rand.pick(['Boof?!', 'Wuf!', 'Hrrf...']), { expr: 'surprised' });
    }
  }

  /** the claw strike: a loud clack, a puff of grit, and Mori flinches if he was that close */
  private clack() {
    const k = this.k;
    const tip = this.lastOut?.crush ?? [-6 * k, -2 * k];
    const tx = this.x + tip[0], ty = this.y + tip[1];
    this.s.sfx('callClick', this.x, 0.7, 0.55);
    this.s.sfx('hammer', this.x, 0.22, 2.2);
    const lp = this.s.main.particles;
    for (let i = 0; i < 8; i++) lp.spawn({ frame: A.dot2, x: tx, y: ty, vx: rand.range(-50, 50), vy: rand.range(-70, -10), ay: 240, life: 0.5, color: [0.85, 0.8, 0.7], alpha: 0.9, alpha1: 0, floorY: this.y + 2 });
    const p = this.s.player;
    if (Math.abs(p.x - this.x) < 30 * k && Math.abs(p.y - this.y) < 30) {
      p.body.react('recoil');
      p.body.setExpr('surprised', 1.4);
      p.vx = Math.sign(p.x - this.x || 1) * 60;
      if (!game.ui.bubbles.active && rand.chance(0.6)) game.ui.bubbles.bark('mori', rand.pick(['Whoa! Okay! Okay!', 'Yikes. Noted.', 'That claw could crack a coconut.', 'I respect your boundaries!']), { expr: 'scared' });
    }
  }

  private raster() {
    const k = this.k;
    const sk = new Sk(this.cv.w, this.cv.h, this.cv.ox, this.cv.oy);
    // sinking into the crevice: everything below the rock's lip is hidden behind it
    if (this.P.sink > 0.02) sk.clipY = this.lipY + 1 + (1 - this.P.sink) * 12;
    const o = drawTrycop(sk, this.P, { k, detail: 0, parasite: this.spec.parasite, hue: this.spec.hue });
    const buf = sk.resolve({ rim: 0.06, bounce: 0.04 });
    this.spr.buf.data.set(buf.data);
    this.spr.upload();
    this.lastOut = { eyes: [[o.eyes[0][0], o.eyes[0][1]], [o.eyes[1][0], o.eyes[1][1]]], crush: [o.crushTip[0], o.crushTip[1]], cut: [o.cutTip[0], o.cutTip[1]], sac: o.sac ? [o.sac[0], o.sac[1]] : null };
  }

  draw(r: Renderer) {
    if (!this.onScreen(r, 40)) return;
    this.raster();
    if (this.P.sink < 0.5) {
      r.beginShadows();
      r.draw(A.shadow, this.x, this.y + 1, 1.25 * this.k, 0.5, 0, packColor(0, 0, 0, 0.32));
      r.endShadows();
    }
    r.draw(this.spr.frame, Math.round(this.x), Math.round(this.y));
  }
}

/** the one-off moult on the rocks near the big crab (Trycop moult item) */
export function placeMoult(s: IslandScene4, x: number) {
  if (game.save.flags['v9:moult']) return;
  const m = trycopMoult();
  const f = local.add('v9:moult', m.buf, m.ax, m.ay);
  const y = groundY(x) + 5;
  const d = new Custom(-2.4, rr => { if (!game.save.flags['v9:moult']) rr.draw(f, x, y); });
  s.main.add(d);
  s.interact.push({
    x, y: y - 2, w: 12, h: 12, label: 'Pick up the Trycop moult',
    enabled: () => !game.save.flags['v9:moult'] && !s.cutscene,
    action: () => {
      if (add('shell_trycop', 1) <= 0) { audio.play('wrong', { vol: 0.5 }); s.bark('mori', 'My pack is full. I am NOT leaving that behind, though.', { expr: 'worried' }); return; }
      game.save.flags['v9:moult'] = true;
      game.persist();
      audio.play('collectPop' as 'ui', { vol: 0.6 });
      const [cx, cy] = s.css(x, y - 10);
      s.hud?.flyItem('shell_trycop', 1, ITEMS.shell_trycop?.name ?? 'Trycop moult', cx, cy);
      s.player.body.react('bounce');
      game.ui.toast('<b>Trycop moult</b>: a whole shed crusher claw, empty and paper-light. The lab will love this.', 'FOUND', 'teal', 4200);
      s.bark('mori', 'A moult! It crawled right out of its own armour and left it here. Spots and all.', { expr: 'excited' });
      s.hud?.refresh(true);
    },
  });
}

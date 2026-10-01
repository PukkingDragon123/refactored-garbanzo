// V9 island shore life (replacing the V4 sketches): every animal is painted with the beasts core
// (src/art/v9/shore) and lives its own little life on the shoreline:
//
//   glass crabs      feed on the film the backwash leaves, wave their big claw at neighbours, bolt for
//                    their burrow and dig in, then peek out on their eyestalks when it is quiet again
//   swashrunners     a flock that chases each wave down the wet sand and sprints back up ahead of the
//                    next, and lifts off together when you come too close
//   shellwrenches    work the wrack line probing for mussels, twist them open with their crossed
//                    bills, pipe at each other over territory, alarm-call and fly off down the beach
//   kelp skinks      bask with their kelp flaps spread, stalk and pounce on sand-hoppers, dash into
//                    the drift and lie there looking like seaweed
//   duskwaddlers     only at dusk: up out of the wash, shake off, waddle in single file up the beach
//                    and dig into the dunes; at night they bray from their burrows
//   periscope octopus raises its eyestalks out of the west rock pool, peeks over the rim, hunts crabs
//                    with one long arm, flashes blue rings when cornered and sinks into "a rock"
//   twinfan          follows you through the bush, fanning its two tails to flush insects and
//                    hawking the ones your footsteps stir up
//   starweb weavers  the glowing fisher-grub colony on the sea cave roof: lines of glowing beads,
//                    synchronised pulses, a grub reeling up a caught midge, the colony dimming when
//                    something loud comes through
//
// Everything speaks the field camera's subject interface (photoInfo / body.bounds / body.points)
// with a behaviour id matching its field-guide entry, and first photos of each species are counted
// for the story (flags 'v4:photo:<id>', var 'v4:islePhotos').

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Drawable } from '../../world/stage';
import { local, A } from '../assets';
import { game } from '../game';
import { audio } from '../../core/audio';
import { clamp, rand, smoothstep } from '../../core/math';
import { shoreFrame, shoreAnims } from '../../art/v9/shore';
import { paintTwig } from '../../art/v9/shore/birds';
import type { BeastEye } from '../../art/beasts';
import { groundY } from '../../art/island4/layout';
import type { Animal } from '../wild/animal';
import type { IslandScene4 } from './island';

export const ISLAND_SPECIES = ['corvexseal', 'crownleech', 'glasscrab', 'swashrunner', 'shellwrench', 'kelpskink', 'duskwaddler', 'starweb', 'twinfan', 'periscope'];

// ------------------------------------------------------------------ frames
/** a shore sprite frame uploaded to the scene atlas, with silhouette points for the camera */
export interface GF { fr: Frame; glow: Frame | null; ax: number; ay: number; w: number; h: number; head: [number, number]; pts: [number, number][] }
let owner: unknown = null;
const cache = new Map<string, GF>();
export function gframe(id: string, anim: string, f: number, eye?: BeastEye): GF {
  if (owner !== local) { cache.clear(); owner = local; }
  const key = `${id}.${anim}.${f}.${eye ?? ''}`;
  let c = cache.get(key);
  if (!c) {
    const o = shoreFrame(id, anim, f, eye);
    const b = o.buf, step = Math.max(2, Math.floor(Math.min(b.w, b.h) / 5));
    const pts: [number, number][] = [];
    for (let y = 1; y < b.h; y += step) for (let x = 1; x < b.w; x += step) if (b.data[y * b.w + x] >>> 24 > 100) pts.push([x - o.ax, y - o.ay]);
    if (!pts.length) pts.push([0, -b.h / 2]);
    c = {
      fr: local.add('shore:' + key, b, o.ax, o.ay), glow: o.glowBuf ? local.add('shoreg:' + key, o.glowBuf, o.ax, o.ay) : null,
      ax: o.ax, ay: o.ay, w: b.w, h: b.h, head: [o.head[0] - o.ax, o.head[1] - o.ay], pts,
    };
    cache.set(key, c);
  }
  return c;
}
export function animInfo(id: string, anim: string) {
  const t = shoreAnims(id);
  return t[anim] ?? t.idle ?? Object.values(t)[0];
}

/** the front of the latest swash sheet: px below the walk line it reaches, and which way it moves */
export function swashFront(s: IslandScene4) {
  const sh = s.swash?.sheets[s.swash.sheets.length - 1];
  if (!sh) return { edge: -3, adv: false, ret: false };
  const t = sh.t;
  const k = t < 1.1 ? smoothstep(0, 1.1, t) : t < 2 ? 1 : 1 - smoothstep(2, 4.6, t);
  return { edge: sh.reach * k - 2, adv: t < 1.1, ret: t > 2 && t < 4.6 };
}

// ------------------------------------------------------------------ base
/** a shore animal on the gameplay plane: animation, perception of the player, camera subject */
export abstract class ShoreBeast implements Drawable {
  z = 30;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  p = 1;
  facing = 1;
  dead = false;
  gone = false;
  /** 0 visible .. 1 gone from view (burrowed, at sea) */
  hidden = 0;
  speed = 0;
  noticed = false;
  juvenile = false;
  eco = { attacksPlayer: 0, aggro: 0 };
  anger = 0;
  act = 'idle';
  behavior = 'idle';
  anim = 'idle';
  animT = 0;
  rev = false;
  eye: BeastEye | undefined;
  alpha = 1;
  /** world y of the ground the shadow falls on (NaN: no shadow) and its size */
  shadowY = NaN;
  shadowK = 1;
  /** world y of a surface line: below it the sprite is cut off (burrow) or tinted (water) */
  surface = Infinity;
  water = false;
  t = rand.next() * 10;
  st = 0;
  body = { bounds: () => this.box(), points: () => this.pts() };

  constructor(readonly species: string, readonly s: IslandScene4, x: number, y: number) {
    this.x = x;
    this.y = y;
    this.facing = rand.chance(0.5) ? 1 : -1;
  }

  play(anim: string, restart = false, rev = false) {
    if (anim !== this.anim || restart || rev !== this.rev) { this.anim = anim; this.animT = 0; this.rev = rev; }
  }
  get animDone() {
    const a = animInfo(this.species, this.anim);
    return !a.loop && this.animT * a.fps >= a.frames;
  }
  frame(): GF {
    const a = animInfo(this.species, this.anim);
    let i = Math.floor(this.animT * a.fps);
    i = a.loop ? i % a.frames : Math.min(a.frames - 1, i);
    if (this.rev) i = a.frames - 1 - i;
    return gframe(this.species, this.anim, i, this.eye);
  }
  box() {
    const f = this.frame();
    const x0 = this.facing > 0 ? this.x - f.ax : this.x - (f.w - f.ax);
    const y0 = this.y - f.ay;
    return { x0, y0, x1: x0 + f.w, y1: Math.min(y0 + f.h, this.water ? Infinity : this.surface) };
  }
  pts(): [number, number][] {
    const f = this.frame();
    const out: [number, number][] = [];
    for (const [px, py] of f.pts) {
      const wy = this.y + py;
      if (!this.water && wy > this.surface) continue;
      out.push([this.x + px * this.facing, wy]);
    }
    return out.length ? out : [[this.x, this.y - 2]];
  }
  photoInfo() {
    return { species: this.species, behavior: this.behavior, box: this.box(), pts: this.pts(), speed: this.speed, facing: this.facing, noticed: this.noticed, juvenile: this.juvenile, p: this.p, hidden: this.hidden };
  }
  /**
   * How frightening the player is right now, 0 (calm) .. 1 (on top of it). `base` is the flight
   * distance at a walk; running, noise and heading straight at it stretch it, creeping shrinks it.
   */
  scare(base: number): number {
    const p = this.s.player;
    const dx = this.x - p.x, dy = (this.y - p.y) * 1.4;
    const d = Math.hypot(dx, dy);
    const v = Math.abs(p.vx);
    const toward = Math.sign(p.vx) === Math.sign(dx) && v > 5 ? 1.25 : 1;
    const fd = base * (0.45 + Math.min(1.2, v / 90) * 0.8 + p.noise * 0.35) * toward * (p.crouch ? 0.6 : 1) * (p.state === 'hide' ? 0.4 : 1) * (p.camera ? 0.85 : 1);
    return d < fd ? 1 - d / fd : 0;
  }
  /** horizontal distance to the player */
  get pd() { return Math.abs(this.s.player.x - this.x); }
  setZ(z: number) {
    if (this.z !== z) { this.z = z; this.s.main.markDirty(); }
  }
  sfx(name: string, vol = 0.3, pitch = 1) { this.s.sfx(name, this.x, vol, pitch); }
  /** move toward x at up to `v` px/s; returns true on arrival */
  stepTo(tx: number, v: number, dt: number) {
    const d = tx - this.x;
    if (Math.abs(d) < 0.8) { this.vx = 0; return true; }
    const s = Math.sign(d) * Math.min(Math.abs(d), v * dt);
    this.x += s;
    this.vx = s / Math.max(dt, 1e-4);
    this.facing = Math.sign(d);
    return false;
  }

  update(dt: number) {
    this.t += dt;
    this.st += dt;
    this.animT += dt;
    this.think(dt);
    this.speed = Math.hypot(this.vx, this.vy);
  }
  protected abstract think(dt: number): void;

  draw(r: Renderer) {
    if (this.hidden >= 0.99 || this.gone || this.alpha <= 0.01) return;
    const f = this.frame();
    if (!isNaN(this.shadowY)) {
      r.beginShadows();
      r.draw(A.shadow, this.x, this.shadowY, Math.max(0.2, (f.w / 40) * this.shadowK), 0.6, 0, packColor(0, 0, 0, 0.3 * this.alpha));
      r.endShadows();
    }
    const col = this.alpha < 1 ? packColor(1, 1, 1, this.alpha) : packColor(1, 1, 1, 1);
    const top = this.y - f.ay;
    const cut = Math.round(this.surface - top);
    if (cut < f.h) {
      // cut at the surface: dry part above, the rest tinted under water or hidden in the ground
      const left = this.x - f.ax * this.facing;
      if (cut > 0) r.drawSub(f.fr, 0, 0, f.w, cut, left, top, this.facing, 1, col);
      if (this.water) r.drawSub(f.fr, 0, Math.max(0, cut), f.w, f.h - Math.max(0, cut), left, top + Math.max(0, cut), this.facing, 1, packColor(0.42, 0.62, 0.7, 0.5 * this.alpha));
    } else r.draw(f.fr, this.x, this.y, this.facing, 1, 0, col);
    if (f.glow) this.drawGlow(r, f);
  }
  protected drawGlow(r: Renderer, f: GF) {
    r.fxDraw(f.glow!, this.x, this.y, this.facing, 1, 0, packColor(1, 1, 1, 1), 1.6);
  }
}

// ------------------------------------------------------------------ glass crab
class GlassCrab extends ShoreBeast {
  private state: 'forage' | 'feed' | 'wave' | 'alert' | 'bolt' | 'dig' | 'under' | 'peek' | 'emerge' = 'forage';
  private tx: number;
  private timer = rand.range(0.5, 2);
  private readonly burrow: number;
  private readonly d: number; // depth below the walk line (on the wet sand)
  constructor(s: IslandScene4, x: number, readonly range: [number, number]) {
    super('glasscrab', s, x, groundY(x) + 6);
    this.burrow = x;
    this.tx = x;
    this.d = rand.range(4, 17);
    this.juvenile = rand.chance(0.25);
  }
  protected think(dt: number) {
    const sc = this.scare(46);
    const gy = groundY(this.x);
    this.y = gy + this.d;
    this.shadowY = this.y;
    this.shadowK = 0.6;
    this.setZ(this.d > 8 ? 52 : 31);
    const sw = swashFront(this.s);
    const awash = sw.edge > this.d + 1;
    this.timer -= dt;
    this.vx = 0;
    switch (this.state) {
      case 'forage':
      case 'feed':
      case 'wave':
        if (sc > 0.55 || (sc > 0.15 && this.state !== 'forage')) { this.state = sc > 0.55 ? 'bolt' : 'alert'; this.timer = 0.5; break; }
        if (awash && sw.adv) { this.state = 'dig'; this.play('burrow', true); break; }
        if (this.state === 'forage') {
          // sideways scuttles between feeding stops; the backwash leaves fresh food
          if (this.stepTo(this.tx, 34, dt)) {
            if (this.timer <= 0) {
              const near = this.s.animals.some(a => a !== (this as unknown as Animal) && a.species === 'glasscrab' && Math.abs(a.x - this.x) < 50 && a.hidden < 0.5);
              if (near && rand.chance(0.3)) { this.state = 'wave'; this.timer = rand.range(1.5, 3); }
              else if (rand.chance(0.6)) { this.state = 'feed'; this.timer = rand.range(1.5, 3.5); }
              else { this.tx = clamp(this.burrow + rand.range(-32, 32), this.range[0], this.range[1]); this.timer = rand.range(0.4, 1.2); }
            } else this.play('idle');
          } else this.play('scuttle');
        } else if (this.timer <= 0) { this.state = 'forage'; this.timer = rand.range(0.5, 1.5); }
        if (this.state === 'feed') this.play('feed');
        if (this.state === 'wave') { this.play('wave'); this.facing = 1; }
        this.behavior = this.state === 'feed' || (sw.ret && this.state === 'forage' && !this.vx) ? 'feeding' : this.state === 'wave' ? 'waving' : 'scuttling';
        this.noticed = false;
        break;
      case 'alert':
        this.play('alert');
        this.noticed = true;
        this.behavior = 'scuttling';
        if (sc > 0.4 || this.timer <= 0 && sc > 0.1) { this.state = 'bolt'; break; }
        if (this.timer <= 0) { this.state = 'forage'; this.timer = 1; }
        break;
      case 'bolt':
        // sprint sideways for the burrow
        this.play('scuttle');
        this.animT += dt * 0.8;
        this.behavior = 'scuttling';
        if (this.stepTo(this.burrow, 95, dt)) { this.state = 'dig'; this.play('burrow', true); this.sfx('rustle', 0.12, 1.8); }
        break;
      case 'dig':
        this.behavior = 'burrowing';
        if (this.animDone) { this.state = 'under'; this.hidden = 1; this.timer = rand.range(3, 7); }
        break;
      case 'under':
        this.hidden = 1;
        if (sc > 0.08 || awash) this.timer = Math.max(this.timer, 2);
        if (this.timer <= 0) { this.state = 'peek'; this.hidden = 0.55; this.play('peek'); this.timer = rand.range(2, 4); }
        break;
      case 'peek':
        // only the eyestalks above the sand, swivelling
        this.behavior = 'peeking';
        this.hidden = 0.55;
        if (sc > 0.2 || awash) { this.state = 'under'; this.hidden = 1; this.timer = rand.range(3, 6); break; }
        if (this.timer <= 0) { this.state = 'emerge'; this.hidden = 0; this.play('burrow', true, true); }
        break;
      case 'emerge':
        this.behavior = 'burrowing';
        if (this.animDone) { this.state = 'forage'; this.timer = 0.5; }
        break;
    }
  }
}

// ------------------------------------------------------------------ swashrunner flock
class SwashFlock implements Drawable {
  z = 0;
  birds: Swashrunner[] = [];
  state: 'feed' | 'fly' = 'feed';
  cx: number;
  flyTo = 0;
  flyT = 0;
  constructor(readonly s: IslandScene4, readonly range: [number, number]) { this.cx = rand.range(range[0], range[1]); }
  update(dt: number) {
    if (this.state === 'feed') {
      // the flock drifts along the tideline; anyone spooked spooks everyone
      this.cx = clamp(this.cx + Math.sin(this.s.st.time * 0.13 + this.range[0]) * dt * 6, this.range[0] + 20, this.range[1] - 20);
      const fear = Math.max(...this.birds.map(b => b.scare(58)));
      if (fear > 0.3) {
        this.state = 'fly';
        this.flyT = 0;
        const away = Math.sign(this.cx - this.s.player.x) || 1;
        let to = this.cx + away * rand.range(160, 260);
        if (to < this.range[0] - 120 || to > this.range[1] + 120) to = this.cx - away * rand.range(200, 300);
        this.flyTo = to;
        this.s.sfx('callTrill', this.cx, 0.4, 2.3);
        this.s.sfx('wingFlap', this.cx, 0.3, 1.8);
      }
    } else {
      this.flyT += dt;
      if (this.birds.every(b => b.landed)) { this.state = 'feed'; this.cx = this.flyTo; }
    }
  }
  draw() {}
}
class Swashrunner extends ShoreBeast {
  landed = true;
  private mode: 'ground' | 'takeoff' | 'fly' | 'land' = 'ground';
  private alt = 0;
  private rest = 0;
  private off: number;
  private dy: number;
  private feedT = 0;
  constructor(s: IslandScene4, readonly flock: SwashFlock, i: number) {
    super('swashrunner', s, flock.cx + (i - 2) * 9, groundY(flock.cx));
    this.off = (i - 2) * 9 + rand.range(-4, 4);
    this.dy = rand.range(1, 6);
  }
  protected think(dt: number) {
    const F = this.flock, gy = groundY(this.x);
    if (F.state === 'fly' && this.mode === 'ground') { this.mode = 'takeoff'; this.play('takeoff', true); this.landed = false; }
    this.noticed = F.state === 'fly';
    switch (this.mode) {
      case 'ground': {
        // follow the swash: sprint up ahead of an advancing wave, chase the backwash down
        const sw = swashFront(this.s);
        const tgtD = sw.adv ? Math.max(4, sw.edge + 5) : sw.ret ? Math.max(2, sw.edge + 1.5) : 6 + this.dy;
        let d = this.y - gy;
        const dv = clamp(tgtD - d, -60 * dt, 60 * dt);
        d += dv;
        this.y = gy + d;
        const tx = F.cx + this.off + Math.sin(this.t * 0.7 + this.off) * 6;
        const moving = !this.stepTo(tx, 70, dt) || Math.abs(dv) > 15 * dt;
        this.feedT -= dt;
        this.rest -= dt;
        if (moving) { this.play('run'); this.behavior = 'running'; }
        else if (this.rest > 0) { this.play('rest'); this.behavior = 'resting'; }
        else {
          this.play('feed');
          this.behavior = 'feeding';
          if (this.feedT <= 0) { this.feedT = rand.range(1, 3); if (rand.chance(0.05) && !sw.adv) this.rest = rand.range(4, 9); }
        }
        if (sw.adv && this.rest > 0) this.rest = 0;
        this.shadowY = this.y;
        this.setZ(d > 9 ? 52 : 31);
        break;
      }
      case 'takeoff':
        this.behavior = 'flying';
        if (this.animDone) { this.mode = 'fly'; this.play('fly'); this.alt = 2; }
        break;
      case 'fly': {
        // low and fast over the water's edge, the whole flock together
        this.behavior = 'flying';
        this.alt = Math.min(22 + this.dy * 2, this.alt + dt * 40);
        const tx = F.flyTo + this.off;
        const arrived = this.stepTo(tx, 120, dt);
        this.y = groundY(this.x) + 6 + this.dy - this.alt + Math.sin(this.t * 3 + this.off) * 2;
        this.shadowY = groundY(this.x) + 6 + this.dy;
        this.shadowK = 0.5;
        if (arrived || Math.abs(tx - this.x) < 30) { this.mode = 'land'; this.play('land', true); }
        break;
      }
      case 'land':
        this.behavior = 'flying';
        this.alt = Math.max(0, this.alt - dt * 50);
        this.y = groundY(this.x) + 6 + this.dy - this.alt;
        this.stepTo(F.flyTo + this.off, 40, dt);
        if (this.alt <= 0 && this.animDone) { this.mode = 'ground'; this.landed = true; this.shadowK = 1; }
        break;
    }
  }
}

// ------------------------------------------------------------------ pied shellwrench
class Shellwrench extends ShoreBeast {
  private state: 'walk' | 'probe' | 'pry' | 'eat' | 'pipe' | 'alert' | 'run' | 'takeoff' | 'fly' | 'land' = 'walk';
  private timer = rand.range(1, 3);
  private tx: number;
  private alt = 0;
  private flyTo = 0;
  private home: [number, number];
  constructor(s: IslandScene4, x: number, home: [number, number]) {
    super('shellwrench', s, x, groundY(x) + 27);
    this.tx = x;
    this.home = home;
  }
  get onGround() { return this.state !== 'takeoff' && this.state !== 'fly' && this.state !== 'land'; }
  protected think(dt: number) {
    const gy = groundY(this.x) + 27;
    const sc = this.onGround ? this.scare(70) : 0;
    this.timer -= dt;
    this.vx = 0;
    if (this.onGround) { this.y = gy; this.shadowY = gy; this.setZ(52); }
    if (this.onGround && this.state !== 'run' && this.state !== 'alert' && sc > 0.2) {
      this.state = sc > 0.55 ? 'run' : 'alert';
      this.timer = sc > 0.55 ? 0.45 : rand.range(1.5, 2.5);
      this.sfx('callSqueak', 0.35, 1.7);
    }
    this.noticed = this.state === 'alert' || !this.onGround || this.state === 'run';
    switch (this.state) {
      case 'walk':
        this.behavior = 'probing';
        if (this.stepTo(this.tx, 16, dt)) {
          this.play('idle');
          if (this.timer <= 0) { this.state = 'probe'; this.timer = rand.range(1.2, 2.6); }
        } else this.play('walk');
        break;
      case 'probe':
        // stabbing into the wrack: sometimes a mussel comes up
        this.play('probe');
        this.behavior = 'probing';
        if (this.timer <= 0) {
          const rival = this.s.animals.find(a => a !== (this as unknown as Animal) && a.species === 'shellwrench' && Math.abs(a.x - this.x) < 90 && (a as unknown as Shellwrench).onGround);
          if (rival && rand.chance(0.35)) { this.state = 'pipe'; this.timer = rand.range(2.2, 3.4); (rival as unknown as Shellwrench).pipeAt(this.x); this.facing = Math.sign(rival.x - this.x) || 1; }
          else if (rand.chance(0.4)) { this.state = 'pry'; this.timer = rand.range(2.2, 3.2); this.play('pry', true); }
          else { this.state = 'walk'; this.tx = clamp(this.x + rand.range(-50, 50), this.home[0], this.home[1]); this.timer = rand.range(0.5, 2); }
        }
        break;
      case 'pry':
        // the crossed tips jammed in the gape, twisting it open
        this.play('pry');
        this.behavior = 'prying';
        if (Math.floor(this.animT * 6) % 2 === 0 && rand.chance(dt * 6)) this.sfx('callClick', 0.12, 2.2);
        if (this.timer <= 0) { this.state = 'eat'; this.timer = 1.2; this.play('eat', true); }
        break;
      case 'eat':
        this.behavior = 'prying';
        if (this.timer <= 0) { this.state = 'walk'; this.tx = clamp(this.x + rand.range(-40, 40), this.home[0], this.home[1]); this.timer = rand.range(1, 3); }
        break;
      case 'pipe':
        // hunched, bill down, piping and running side by side with a rival
        this.play('pipe');
        this.behavior = 'piping';
        this.x += this.facing * 6 * dt;
        if (rand.chance(dt * 5)) this.sfx('callTrill', 0.3, 1.25 + rand.range(0, 0.15));
        if (this.timer <= 0) { this.state = 'walk'; this.tx = clamp(this.x + rand.range(-60, 60), this.home[0], this.home[1]); this.timer = rand.range(1, 3); }
        break;
      case 'alert':
        this.play('alert');
        this.behavior = 'alarm';
        this.facing = Math.sign(this.s.player.x - this.x) || 1;
        if (rand.chance(dt * 1.5)) this.sfx('callSqueak', 0.3, 1.7);
        if (sc > 0.55) { this.state = 'run'; this.timer = 0.4; }
        else if (this.timer <= 0 && sc < 0.1) { this.state = 'walk'; this.timer = 1; }
        break;
      case 'run': {
        const away = Math.sign(this.x - this.s.player.x) || 1;
        this.play('run');
        this.behavior = 'alarm';
        this.stepTo(this.x + away * 20, 70, dt);
        if (this.timer <= 0) {
          this.state = 'takeoff'; this.play('takeoff', true);
          let to = this.x + away * rand.range(170, 260);
          if (to < this.home[0] - 200 || to > this.home[1] + 200) to = this.x - away * rand.range(220, 300);
          this.flyTo = to;
          this.sfx('wingFlap', 0.35, 1.2);
        }
        break;
      }
      case 'takeoff':
        this.behavior = 'flying';
        if (this.animDone) { this.state = 'fly'; this.play('fly'); this.alt = 4; }
        break;
      case 'fly': {
        this.behavior = 'flying';
        this.alt = Math.min(46, this.alt + dt * 45);
        const arrived = this.stepTo(this.flyTo, 115, dt);
        this.y = gy - this.alt + Math.sin(this.t * 2.5) * 2;
        this.shadowY = gy;
        this.shadowK = 0.5;
        this.setZ(52);
        if (rand.chance(dt * 0.8)) this.sfx('callSqueak', 0.25, 1.6);
        if (arrived || Math.abs(this.flyTo - this.x) < 45) { this.state = 'land'; this.play('land', true); }
        break;
      }
      case 'land':
        this.behavior = 'flying';
        this.alt = Math.max(0, this.alt - dt * 60);
        this.y = gy - this.alt;
        this.stepTo(this.flyTo, 50, dt);
        if (this.alt <= 0 && this.animDone) {
          this.state = 'walk'; this.shadowK = 1;
          this.home = [this.x - 90, this.x + 90];
          this.tx = this.x; this.timer = rand.range(1, 2);
        }
        break;
    }
  }
  /** a rival started piping at us: join in, running alongside */
  pipeAt(x: number) {
    if (!this.onGround || this.state === 'alert' || this.state === 'run') return;
    this.state = 'pipe';
    this.timer = rand.range(2.2, 3.4);
    this.facing = Math.sign(x - this.x) || 1;
  }
}

// ------------------------------------------------------------------ kelp skink
class KelpSkink extends ShoreBeast {
  private state: 'bask' | 'stalk' | 'pounce' | 'eat' | 'display' | 'dash' | 'hide' = 'bask';
  private timer = rand.range(3, 8);
  private tx = 0;
  private readonly hx: number;
  constructor(s: IslandScene4, x: number, readonly dy: number) {
    super('kelpskink', s, x, groundY(x) + dy);
    this.hx = x;
  }
  protected think(dt: number) {
    this.y = groundY(this.x) + this.dy;
    this.shadowY = this.y;
    this.shadowK = 0.7;
    this.setZ(this.dy > 8 ? 52 : 31);
    const sc = this.scare(40);
    const sunny = this.s.clock.t < 2.6;
    this.timer -= dt;
    this.vx = 0;
    if (sc > 0.4 && this.state !== 'dash' && this.state !== 'hide') {
      this.state = 'dash'; this.timer = rand.range(0.4, 0.7);
      this.facing = Math.sign(this.x - this.s.player.x) || 1;
      this.sfx('rustle', 0.15, 2);
    }
    this.noticed = this.state === 'dash' || this.state === 'hide';
    switch (this.state) {
      case 'bask':
        // flat on the warm drift with the kelp flaps spread to the sun
        this.play(sunny ? 'idle' : 'hide');
        this.behavior = sunny ? 'basking' : 'hiding';
        this.hidden = sunny ? 0 : 0.4;
        if (this.timer <= 0 && sunny) {
          if (rand.chance(0.25)) { this.state = 'display'; this.timer = rand.range(1.5, 2.5); }
          else { this.state = 'stalk'; this.tx = clamp(this.x + rand.sign() * rand.range(10, 24), this.hx - 40, this.hx + 40); this.timer = 4; }
        }
        break;
      case 'stalk':
        // creeps toward a sand-hopper in the wrack
        this.play('walk');
        this.animT -= dt * 0.5;
        this.behavior = 'hunting';
        if (this.stepTo(this.tx, 9, dt) || this.timer <= 0) { this.state = 'pounce'; this.play('pounce', true); this.sfx('callClick', 0.1, 2.6); }
        break;
      case 'pounce':
        this.behavior = 'hunting';
        if (this.animT < 0.2) this.x += this.facing * 30 * dt;
        if (this.animDone) { this.state = 'eat'; this.timer = 1.2; this.play('eat', true); }
        break;
      case 'eat':
        this.behavior = 'hunting';
        if (this.timer <= 0) { this.state = 'bask'; this.timer = rand.range(5, 10); }
        break;
      case 'display':
        // head-bobbing with the orange throat flared
        this.play('display');
        this.behavior = 'displaying';
        if (this.timer <= 0) { this.state = 'bask'; this.timer = rand.range(5, 10); }
        break;
      case 'dash':
        this.play('dash');
        this.behavior = 'hiding';
        this.x += this.facing * 85 * dt;
        this.vx = this.facing * 85;
        if (this.timer <= 0) { this.state = 'hide'; this.timer = rand.range(5, 9); }
        break;
      case 'hide':
        // pressed into the drift, flaps down: one more strand of kelp
        this.play('hide');
        this.behavior = 'hiding';
        this.hidden = 0.45;
        if (sc > 0.15) this.timer = Math.max(this.timer, 2);
        if (this.timer <= 0) { this.state = 'bask'; this.hidden = 0; this.timer = rand.range(4, 9); }
        break;
    }
  }
}

// ------------------------------------------------------------------ duskwaddlers
class DuskGroup implements Drawable {
  z = 0;
  birds: Duskwaddler[] = [];
  constructor(readonly s: IslandScene4, readonly x: number, readonly start: number) {}
  update() {}
  draw() {}
}
class Duskwaddler extends ShoreBeast {
  private state: 'sea' | 'surf' | 'shake' | 'waddle' | 'pause' | 'freeze' | 'dig' | 'enter' | 'den' | 'call' = 'sea';
  private timer = 0;
  private bx: number;
  private by: number;
  constructor(s: IslandScene4, readonly g: DuskGroup, readonly i: number) {
    super('duskwaddler', s, g.x + i * 7, groundY(g.x));
    this.bx = g.x + 12 + i * 10 + rand.range(-4, 4);
    this.by = rand.range(56, 66);
    this.hidden = 1;
    this.facing = 1;
  }
  protected think(dt: number) {
    const clock = this.s.clock.t;
    const gy = groundY(this.x);
    this.timer -= dt;
    this.vx = this.vy = 0;
    if (clock < 2.7 && this.state !== 'sea') { this.state = 'sea'; this.hidden = 1; }
    const d = this.y - gy;
    this.setZ(d > 6 ? 54 : 31);
    this.shadowY = this.water ? NaN : this.y;
    const sc = this.hidden < 1 ? this.scare(44) : 0;
    this.noticed = this.state === 'freeze';
    switch (this.state) {
      case 'sea':
        this.hidden = 1;
        this.water = false;
        if (clock > this.g.start + this.i * 0.02) {
          // in through the surf at the water's edge, one after another
          this.state = 'surf';
          this.x = this.g.x - 20 + this.i * 8;
          this.y = gy - 1;
          this.hidden = 0;
          this.timer = 2.2 + this.i * 0.5;
          this.play('swim');
          this.water = true;
          this.surface = this.y - 1;
        }
        break;
      case 'surf':
        this.behavior = 'landing';
        this.y = gy - 1 + Math.max(0, this.timer) * 0.3;
        this.surface = gy - 1.5;
        this.stepTo(this.g.x + this.i * 7, 8, dt);
        if (this.timer <= 0) { this.state = 'shake'; this.water = false; this.surface = Infinity; this.timer = 0.9; this.play('shake', true); this.sfx('splash', 0.12, 2); }
        break;
      case 'shake':
        this.behavior = 'landing';
        if (this.timer <= 0) { this.state = 'waddle'; }
        break;
      case 'waddle':
      case 'pause': {
        // single file up the beach to the burrow in the dunes
        if (sc > 0.3) { this.state = 'freeze'; this.timer = rand.range(1.2, 2.5); break; }
        if (this.state === 'pause') {
          this.behavior = 'preening';
          this.play('preen');
          if (this.timer <= 0) this.state = 'waddle';
          break;
        }
        this.behavior = 'waddling';
        this.play('waddle');
        const ty = groundY(this.bx) + this.by;
        const ax = this.bx - this.x, ay = ty - this.y;
        const L = Math.hypot(ax, ay);
        const v = sc > 0.1 ? 16 : 7;
        if (L < 1.5) { this.state = 'dig'; this.timer = rand.range(2, 3.2); this.play('dig'); this.facing = 1; break; }
        this.x += ax / L * v * dt;
        this.y += ay / L * v * dt;
        this.vx = ax / L * v;
        this.facing = ax >= 0 ? 1 : -1;
        if (rand.chance(dt * 0.12)) { this.state = 'pause'; this.timer = rand.range(1, 2.2); }
        break;
      }
      case 'freeze':
        this.behavior = 'waddling';
        this.play('alert');
        if (sc > 0.6) { this.state = 'waddle'; break; } // scurry on regardless
        if (this.timer <= 0 && sc < 0.25) this.state = 'waddle';
        break;
      case 'dig':
        this.behavior = 'digging';
        if (Math.floor(this.animT * 10) % 3 === 0 && rand.chance(dt * 8)) this.sfx('dig', 0.08, 1.8);
        if (this.timer <= 0) { this.state = 'enter'; this.play('burrow', true); }
        break;
      case 'enter':
        this.behavior = 'digging';
        if (this.animDone) { this.state = 'den'; this.hidden = 1; this.timer = rand.range(6, 14); }
        break;
      case 'den':
        this.hidden = 1;
        // after dark they bray from their burrows: head and shoulders poke out to call
        if (this.timer <= 0 && clock > 3.1) { this.state = 'call'; this.timer = rand.range(2, 3); this.hidden = 0.3; this.play('call', true); this.surface = this.y - 6; this.sfx('callHonk', 0.3, 1.6); }
        else if (this.timer <= 0) this.timer = rand.range(4, 8);
        break;
      case 'call':
        this.behavior = 'calling';
        this.hidden = 0.3;
        if (rand.chance(dt * 1.2)) this.sfx('callHonk', 0.25, 1.5 + rand.range(0, 0.3));
        if (this.timer <= 0 || sc > 0.3) { this.state = 'den'; this.hidden = 1; this.surface = Infinity; this.timer = rand.range(8, 16); }
        break;
    }
  }
}

// ------------------------------------------------------------------ periscope octopus
class Periscope extends ShoreBeast {
  private state: 'hide' | 'periscope' | 'peek' | 'reach' | 'flash' = 'hide';
  private timer = rand.range(1, 3);
  constructor(s: IslandScene4, x: number, y: number) {
    super('periscope', s, x, y);
    this.facing = 1;
    this.water = true;
    this.surface = y;
    this.z = 54;
  }
  protected think(dt: number) {
    const sc = this.scare(60);
    this.timer -= dt;
    const calm = sc < 0.12;
    this.noticed = this.state === 'flash';
    switch (this.state) {
      case 'hide':
        // pulled down into its pool: the armoured mantle is just another crusted rock
        this.play('hide');
        this.behavior = 'hiding';
        this.hidden = 0.35;
        if (!calm) this.timer = Math.max(this.timer, 2.5);
        if (this.timer <= 0) { this.state = 'periscope'; this.timer = rand.range(2.5, 4); }
        break;
      case 'periscope':
        // only the eyes up, turning this way and that
        this.play('periscope');
        this.behavior = 'periscoping';
        this.hidden = 0.2;
        if (sc > 0.35) { this.sink(); break; }
        if (this.timer <= 0) { this.state = calm ? 'peek' : 'periscope'; this.timer = rand.range(4, 7); }
        break;
      case 'peek':
        this.play('peek');
        this.behavior = 'peeking';
        this.hidden = 0;
        if (sc > 0.5) { this.sink(); break; }
        if (sc > 0.2) { this.state = 'flash'; this.timer = 1.6; this.sfx('splash', 0.08, 2.2); break; }
        if (this.timer <= 0) {
          // a glass crab on the rim? one long arm snakes out for it
          this.state = 'reach'; this.play('reach', true);
        }
        break;
      case 'reach':
        this.behavior = 'hunting';
        if (sc > 0.45) { this.sink(); break; }
        if (this.animT > 0.9) { this.state = 'peek'; this.timer = rand.range(4, 8); }
        break;
      case 'flash':
        // threat display: rings of electric blue flicker across the skin
        this.play('flash');
        this.behavior = 'flashing';
        if (this.timer <= 0) this.sink();
        break;
    }
  }
  private sink() {
    this.state = 'hide';
    this.timer = rand.range(4, 8);
    this.sfx('splash', 0.15, 1.9);
    for (let i = 0; i < 5; i++) this.s.main.particles.spawn({ frame: A.dot2, x: this.x + rand.range(-6, 6), y: this.y - 1, vx: rand.range(-20, 20), vy: rand.range(-40, -15), ay: 160, life: 0.5, color: [0.8, 0.92, 1], alpha: 0.8, alpha1: 0, floorY: this.y + 1 });
  }
}

// ------------------------------------------------------------------ twinfan
interface Perch { x: number; y: number; fr: Frame }
class Twinfan extends ShoreBeast {
  private mode: 'perch' | 'fly' | 'hawk' = 'perch';
  private perch: Perch;
  private target: Perch | null = null;
  private timer = rand.range(1, 3);
  private bug: { x: number; y: number; dead: boolean } | null = null;
  private fanT = 0;
  constructor(s: IslandScene4, readonly perches: Perch[], start: Perch) {
    super('twinfan', s, start.x, start.y);
    this.perch = start;
  }
  protected think(dt: number) {
    const p = this.s.player;
    const inBush = p.x > 5920 && p.x < 6920;
    this.timer -= dt;
    this.fanT -= dt;
    this.vx = this.vy = 0;
    this.setZ(33);
    this.noticed = inBush && this.pd < 140;
    // footsteps in the bush flush moths from the undergrowth
    if (inBush && Math.abs(p.vx) > 20 && rand.chance(dt * 0.35)) this.s.insects.spawn('skymoth', p.x + p.facing * 10, p.y - 10, 1, 8);
    switch (this.mode) {
      case 'perch': {
        this.x = this.perch.x; this.y = this.perch.y;
        this.shadowY = NaN;
        // fan display flushes insects out of the leaves round the perch
        if (this.fanT > 0) { this.play('fan'); this.behavior = 'fanning'; }
        else if (rand.chance(dt * 0.25)) { this.play('call', true); this.behavior = 'calling'; this.sfx('callChirp', 0.25, 2.1); }
        else if (this.anim !== 'call' || this.animT > 0.6) { this.play('idle'); this.behavior = inBush ? 'following' : 'calling'; }
        this.facing = Math.sign(p.x - this.x) || this.facing;
        if (this.fanT <= 0 && rand.chance(dt * 0.3)) {
          this.fanT = 1.4;
          if (rand.chance(0.5)) this.s.insects.spawn('skymoth', this.x + rand.range(-14, 14), this.y + rand.range(2, 12), 1, 4);
        }
        // a moth nearby? sally out after it
        const bug = this.s.insects.bugs.find(b => !b.dead && (b.kind === 'skymoth' || b.kind === 'butterfly') && Math.abs(b.x - this.x) < 90 && Math.abs(b.y - this.y) < 60);
        if (bug && this.timer <= 0) { this.mode = 'hawk'; this.bug = bug; this.timer = 2.5; this.play('hawk'); break; }
        // keep close to the walker: hop ahead to a perch near them
        if (inBush && this.timer <= 0 && (this.pd > 60 || rand.chance(0.15))) {
          const ahead = p.x + p.facing * rand.range(20, 70);
          const c = this.perches.filter(q => q !== this.perch && Math.abs(q.x - ahead) < 50);
          if (c.length) { this.target = c[Math.floor(rand.next() * c.length)]; this.mode = 'fly'; this.play('fly'); }
          this.timer = rand.range(1.5, 3.5);
        }
        break;
      }
      case 'fly': {
        const T = this.target!;
        this.behavior = 'following';
        const dx = T.x - this.x, dy = T.y - this.y, L = Math.hypot(dx, dy);
        const v = 110;
        if (L < 3) { this.perch = T; this.mode = 'perch'; this.timer = rand.range(1, 2.5); break; }
        this.x += dx / L * Math.min(L, v * dt);
        this.y += dy / L * Math.min(L, v * dt) + Math.sin(this.t * 14) * 0.3;
        this.vx = dx / L * v; this.vy = dy / L * v;
        this.facing = dx >= 0 ? 1 : -1;
        this.shadowY = groundY(this.x); this.shadowK = 0.3;
        break;
      }
      case 'hawk': {
        // flies at the moth with both fans flared as air brakes, snaps it out of the air
        this.behavior = 'hawking';
        const b = this.bug;
        if (!b || b.dead || this.timer <= 0) { this.returnToPerch(); break; }
        const dx = b.x - this.x, dy = b.y - this.y, L = Math.hypot(dx, dy);
        if (L < 5) {
          if (this.s.insects.catch(b.x, b.y, 6)) this.sfx('callClick', 0.25, 2.4);
          this.returnToPerch();
          break;
        }
        const v = 130;
        this.x += dx / L * Math.min(L, v * dt);
        this.y += dy / L * Math.min(L, v * dt);
        this.vx = dx / L * v; this.vy = dy / L * v;
        this.facing = dx >= 0 ? 1 : -1;
        this.shadowY = groundY(this.x); this.shadowK = 0.3;
        break;
      }
    }
  }
  private returnToPerch() {
    let best = this.perch, bd = Infinity;
    for (const q of this.perches) { const d = Math.hypot(q.x - this.x, q.y - this.y) + Math.abs(q.x - this.s.player.x) * 0.3; if (d < bd) { bd = d; best = q; } }
    this.target = best; this.mode = 'fly'; this.play('fly'); this.timer = rand.range(1, 2); this.bug = null;
  }
}
/** twigs the twinfan perches on (drawn on the gameplay plane behind the walker) */
class Twigs implements Drawable {
  z = 29;
  constructor(readonly list: Perch[]) {}
  draw(r: Renderer) {
    const x0 = r.visibleX0(30), x1 = r.visibleX1(30);
    for (const q of this.list) {
      if (q.x < x0 || q.x > x1) continue;
      // a sapling: a thin stem from the forest floor up to the perching twig
      const gy = groundY(q.x - 9);
      r.rect(q.x - 10, q.y + 2, 1, gy - q.y - 1, packColor(0.27, 0.21, 0.15, 1));
      r.rect(q.x - 9, q.y + 6, 1, gy - q.y - 6, packColor(0.2, 0.16, 0.11, 1));
      r.draw(q.fr, q.x, q.y + 0.5);
    }
  }
}

// ------------------------------------------------------------------ starweb colony
interface Line { dx: number; len: number; ph: number }
interface Cluster { x: number; y: number; lines: Line[]; state: 'glow' | 'haul' | 'eat'; t: number; prey: Line | null; subj: StarwebSubject }
/** a starweb colony cluster as a camera subject */
class StarwebSubject {
  species = 'starweb';
  z = 0;
  p = 1;
  vx = 0;
  vy = 0;
  dead = false;
  gone = false;
  hidden = 0;
  noticed = false;
  eco = { attacksPlayer: 0, aggro: 0 };
  anger = 0;
  act = 'idle';
  behavior = 'glowing';
  x: number;
  y: number;
  body = { bounds: () => ({ x0: this.x - 14, y0: this.y - 6, x1: this.x + 16, y1: this.y + 30 }), points: (): [number, number][] => [[this.x, this.y + 3], [this.x - 8, this.y + 12], [this.x + 8, this.y + 14], [this.x + 2, this.y + 22], [this.x - 4, this.y + 6]] };
  constructor(x: number, y: number) { this.x = x; this.y = y; }
  photoInfo() { return { species: 'starweb', behavior: this.behavior, box: this.body.bounds(), pts: this.body.points(), speed: 0, facing: 1, noticed: false, juvenile: false, p: 1, hidden: 0 }; }
}
class StarwebColony implements Drawable {
  z = 29;
  clusters: Cluster[] = [];
  /** 0 glowing .. 1 lights out (something loud came through) */
  dim = 0;
  private dimHold = 0;
  constructor(readonly s: IslandScene4, spots: [number, number][]) {
    for (const [x, y] of spots) {
      const lines: Line[] = [];
      const n = 9 + Math.floor(rand.next() * 6);
      for (let i = 0; i < n; i++) lines.push({ dx: (i - n / 2) * 2.4 + rand.range(-0.8, 0.8), len: rand.range(10, 38) * (1 - Math.abs(i - n / 2) / n * 0.8), ph: rand.next() * 10 });
      const subj = new StarwebSubject(x, y);
      this.clusters.push({ x, y, lines, state: 'glow', t: rand.range(4, 12), prey: null, subj });
    }
  }
  update(dt: number) {
    const p = this.s.player;
    const inCave = p.x > 5060 && p.x < 5440;
    // a running walker, splashing or the camera's shutter: the whole colony switches its lights off
    const loud = inCave && (Math.abs(p.vx) > 85 || this.s.sounds.some(q => (q.kind === 'shutter' || q.kind === 'splash') && Math.abs(q.x - p.x) < 200 && this.s.time - q.t < 0.2 && q.x > 5000 && q.x < 5500));
    if (loud) this.dimHold = 4;
    this.dimHold -= dt;
    this.dim = this.dimHold > 0 ? Math.min(1, this.dim + dt * 3) : Math.max(0, this.dim - dt * 0.12);
    for (const c of this.clusters) {
      c.t -= dt;
      if (c.state === 'glow' && c.t <= 0) {
        // a midge blundered into a line: reel it in
        c.prey = c.lines[Math.floor(rand.next() * c.lines.length)];
        c.state = 'haul'; c.t = rand.range(2.5, 4);
      } else if (c.state === 'haul' && c.t <= 0) { c.state = 'eat'; c.t = 1.6; }
      else if (c.state === 'eat' && c.t <= 0) { c.state = 'glow'; c.t = rand.range(8, 18); c.prey = null; }
      c.subj.behavior = this.dim > 0.5 ? 'dimmed' : c.state === 'glow' ? 'glowing' : 'fishing';
    }
  }
  draw(r: Renderer, st: { time: number }) {
    const x0 = r.visibleX0(40), x1 = r.visibleX1(40);
    const T = st.time;
    for (const c of this.clusters) {
      if (c.x < x0 || c.x > x1) continue;
      // synchronised pulse: a slow wave rolls along the colony
      const pulse = (0.6 + 0.4 * Math.sin(T * 0.9 - c.x / 45)) * (1 - this.dim * 0.92);
      // guy lines up to the roof
      r.rect(c.x - 6, c.y - 40, 1, 40, packColor(0.7, 0.8, 0.78, 0.18));
      r.rect(c.x + 7, c.y - 40, 1, 39, packColor(0.7, 0.8, 0.78, 0.18));
      // the fishing lines: faint silk, beaded with droplets that catch the glow
      for (const L of c.lines) {
        const sway = Math.sin(T * 0.6 + L.ph) * 1.2;
        let len = L.len;
        if (L === c.prey && c.state === 'haul') len *= clamp(c.t / 4);
        if (L === c.prey && c.state === 'eat') len = 2;
        const lx = c.x + L.dx + 1;
        r.rect(lx + sway * 0.5, c.y + 5, 1, len, packColor(0.75, 0.88, 0.86, 0.22));
        for (let yy = 4; yy < len; yy += 3.5) {
          const tw = 0.55 + 0.45 * Math.sin(T * 2 + L.ph + yy);
          r.fxDraw(A.dot, lx + sway * (yy / Math.max(1, len)), c.y + 5 + yy, 1, 1, 0, packColor(0.5, 1, 0.92, 1), 1.4 * pulse * tw);
        }
        if (L === c.prey && c.state === 'haul') r.rect(lx + sway + (Math.sin(T * 30) > 0 ? 1 : -1) * 0.6, c.y + 5 + len, 1, 1, packColor(0.15, 0.13, 0.12, 1));
      }
      // the grub in its hammock, and its lantern
      const anim = this.dim > 0.5 ? 'dim' : c.state === 'haul' ? 'haul' : c.state === 'eat' ? 'eat' : 'idle';
      const a = animInfo('starweb', anim);
      const f = gframe('starweb', anim, Math.floor(T * a.fps + c.x) % a.frames);
      r.draw(f.fr, c.x, c.y);
      if (f.glow) r.fxDraw(f.glow, c.x, c.y, 1, 1, 0, packColor(1, 1, 1, 1), 2.2 * pulse);
      r.fxDraw(A.glow, c.x - 2, c.y + 4, 0.35, 0.3, 0, packColor(0.35, 1, 0.85, 1), 0.7 * pulse);
      r.light(c.x, c.y + 8, 30, 0.4, 1, 0.9, 0.8 * pulse);
    }
  }
}

// ------------------------------------------------------------------ spawning
/** spawn the island's shore life and count first photos of each species */
export function startShoreLife(s: IslandScene4) {
  const addA = (c: ShoreBeast | StarwebSubject) => s.animals.push(c as unknown as Animal);
  const add = <T extends ShoreBeast>(c: T): T => { s.main.add(c); addA(c); return c; };
  // glass crabs on the wet sand
  for (const [x0, x1] of [[1500, 1900], [2200, 2700], [3300, 3700], [4000, 4200]] as const) for (let i = 0; i < 3; i++) add(new GlassCrab(s, rand.range(x0, x1), [x0, x1]));
  // swashrunner flocks along the tideline
  for (const [x0, x1] of [[1900, 2400], [2900, 3400], [4600, 4950], [5500, 5850]] as const) {
    const F = new SwashFlock(s, [x0, x1]);
    s.main.add(F);
    const n = 3 + Math.floor(rand.next() * 3);
    for (let i = 0; i < n; i++) F.birds.push(add(new Swashrunner(s, F, i)));
  }
  // shellwrenches on the wrack line
  for (const x of [2500, 3150, 3950, 4150]) add(new Shellwrench(s, x, [x - 90, x + 90]));
  // kelp skinks: the west point rocks, the drift by the seal rocks, the cove
  for (const [x, dy] of [[380, 10], [4260, 26], [4700, 26], [5600, 24]] as const) add(new KelpSkink(s, x, dy));
  // duskwaddler groups come ashore one after another as the light goes
  for (const [x, start] of [[1640, 2.72], [2240, 2.8], [3560, 2.88]] as const) {
    const g = new DuskGroup(s, x, start);
    const n = 2 + Math.floor(rand.next() * 3);
    for (let i = 0; i < n; i++) g.birds.push(add(new Duskwaddler(s, g, i)));
  }
  // the periscope octopus in the big west rock pool
  add(new Periscope(s, 200, Math.round(groundY(200)) + 56));
  // the twinfan and its perches along the bush track
  const perches: Perch[] = [];
  for (let x = 5960; x < 6880; x += rand.range(38, 70)) {
    const v = perches.length % 4;
    const tw = paintTwig(v * 7 + 3);
    const fr = local.has(`shore:twig${v}`) ? local.get(`shore:twig${v}`) : local.add(`shore:twig${v}`, tw.buf, tw.ax, tw.ay);
    perches.push({ x, y: groundY(x) - rand.range(26, 64), fr });
  }
  s.main.add(new Twigs(perches));
  add(new Twinfan(s, perches, perches[Math.min(perches.length - 1, 4)]));
  // the starweb colony on the sea cave roof
  const colony = new StarwebColony(s, [[5122, 104], [5178, 98], [5236, 108], [5298, 100], [5362, 106]]);
  s.main.add(colony);
  for (const c of colony.clusters) addA(c.subj);
  // pre-render the animation strips a few at a time (the seal warms its own while it sleeps)
  const queue: [string, string][] = [];
  for (const id of ['glasscrab', 'swashrunner', 'shellwrench', 'kelpskink', 'twinfan', 'periscope', 'starweb', 'crownleech', 'duskwaddler']) for (const a of Object.keys(shoreAnims(id))) queue.push([id, a]);
  s.main.add({ z: 0, dead: false, draw() {}, update(this: Drawable) { const q = queue.shift(); if (q) gframe(q[0], q[1], 0); else this.dead = true; } } as Drawable);
  // first photos of each species
  const prev = s.cam.onShot;
  s.cam.onShot = ph => {
    prev?.(ph);
    const seen = new Set(ph.subjects.filter(x => x.inFrame > 0.3 && x.visible > 0.3).map(x => x.species));
    let fresh = 0;
    for (const sp of seen) {
      if (!ISLAND_SPECIES.includes(sp) || game.save.flags['v4:photo:' + sp]) continue;
      game.save.flags['v4:photo:' + sp] = true;
      game.save.vars['v4:islePhotos'] = (game.save.vars['v4:islePhotos'] ?? 0) + 1;
      fresh++;
      s.onNewSpecies?.(sp);
    }
    if (fresh) { audio.play('discover', { vol: 0.5 }); game.persist(); s.hud?.refresh(true); }
  };
}

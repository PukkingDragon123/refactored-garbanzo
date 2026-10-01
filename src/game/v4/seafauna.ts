// Ocean life around the Kittiwake for the afternoon on deck (V9). Six invented species of these
// seas, painted with the beasts core (src/art/v9/sea): the Fluting Vanebill soaring round the
// mast, Sackjaw Gulls hanging over the stern to beg, perch, squabble and steal bait, a flock of
// Scythewing Petrels slicing the wave tops, a pod of Moonfin Porpoises riding the bow wave,
// Whiptail Kitefish bursting out of the swell (the vanebill snatches them), and a Reefback, a
// colossal grazer with a living reef on its back, surfacing on the horizon and now and then off
// the bow, with its parasites (crown lice, pennant leeches) riding along.
//
// Every critter speaks the camera's subject interface (photoInfo, body.bounds/points, p, z) so a
// photo records the species and the behaviour on show. Critters live on their own layers: behind
// the ship, in front of it (under the near sea band, which hides whatever is below the surface),
// a translucent "under the surface" pass, and the far / mid sea bands with parallax.

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor, REF_Y } from '../../gfx/renderer';
import type { Drawable, Layer } from '../../world/stage';
import { local } from '../assets';
import { clamp, rand, damp } from '../../core/math';
import type { Animal } from '../wild/animal';
import type { ShipScene4 } from './ship';
import { game } from '../game';
import { audio } from '../../core/audio';
import { deckY } from '../../art/boat';
import { renderAny, BEAST_ANIMS } from '../../art/beasts';
import { VANEBILL_BANK, SCYTHE_BANK, MOONFIN_LEAP, MOONFIN_GLOW, reefbackSpots, REEFBACK_K } from '../../art/v9/sea';

export type SeaId = 'vanebill' | 'sackjaw' | 'scythewing' | 'moonfin' | 'kitefish' | 'reefback' | 'crownlouse' | 'pennantleech';
export const SEA_IDS: SeaId[] = ['vanebill', 'sackjaw', 'scythewing', 'moonfin', 'kitefish', 'reefback', 'crownlouse', 'pennantleech'];

type Box = { x0: number; y0: number; x1: number; y1: number };
type V2 = [number, number];

// ------------------------------------------------------------------ frames
interface SeaFrame { fr: Frame; glow: Frame | null; w: number; h: number; ax: number; ay: number; head: V2; pts: V2[] }
const cache = new Map<string, SeaFrame>();
let owner: unknown = null;
const GLOW = new Set(MOONFIN_GLOW);

function frameOf(art: string, anim: string, i: number): SeaFrame {
  if (owner !== local) { cache.clear(); owner = local; }
  const info = BEAST_ANIMS[art as keyof typeof BEAST_ANIMS]?.[anim];
  const n = info?.frames ?? 1;
  const f = ((Math.floor(i) % n) + n) % n;
  const key = art + '.' + anim + '.' + f;
  let c = cache.get(key);
  if (c) return c;
  const o = renderAny(art, anim, f);
  const b = o.buf;
  // silhouette sample points (anchor-relative) for the camera's occlusion / framing tests
  const pts: V2[] = [];
  const step = Math.max(2, Math.floor(Math.min(b.w, b.h) / 5));
  for (let y = 1; y < b.h; y += step) for (let x = 1; x < b.w; x += step) if (b.data[y * b.w + x] >>> 24 > 128) pts.push([x - o.ax, y - o.ay]);
  if (!pts.length) pts.push([0, 0]);
  // the moonfin's photophores glow: pull their pixels into an emissive overlay
  let glow: Frame | null = null;
  if (art === 'moonfin') {
    const g = b.clone();
    let any = false;
    for (let j = 0; j < g.data.length; j++) { if (GLOW.has(g.data[j])) any = true; else g.data[j] = 0; }
    if (any) glow = local.add('seaG:' + key, g, o.ax, o.ay);
  }
  c = { fr: local.add('sea:' + key, b, o.ax, o.ay), glow, w: b.w, h: b.h, ax: o.ax, ay: o.ay, head: [o.head[0] - o.ax, o.head[1] - o.ay], pts };
  cache.set(key, c);
  return c;
}

/** pre-render strips a little at a time so the deck never hitches */
const warmQueue: [string, string][] = [];
function warmStep(budgetMs: number) {
  const t0 = performance.now();
  while (warmQueue.length && performance.now() - t0 < budgetMs) {
    const [art, anim] = warmQueue.shift()!;
    const n = BEAST_ANIMS[art as keyof typeof BEAST_ANIMS]?.[anim]?.frames ?? 1;
    for (let i = 0; i < n; i++) frameOf(art, anim, i);
  }
}

// ------------------------------------------------------------------ critter base
type Pass = 'back' | 'front' | 'under' | 'top';

abstract class Critter implements Drawable {
  z = 50;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  /** parallax plane (and the layer's vertical parallax, which the camera needs matched) */
  p = 1;
  py = 1;
  facing = 1;
  dead = false;
  gone = false;
  hidden = 0;
  noticed = false;
  act = 'idle';
  juvenile = false;
  scale = 1;
  speed = 0;
  eco = { attacksPlayer: 0, aggro: 0 };
  behavior = '';
  anim = 'idle';
  fi = 0;
  t = rand.next() * 10;
  /** drawn behind the ship this frame */
  back = false;
  rot = 0;
  body: { bounds: (a: Critter) => Box; points: (a: Critter) => V2[]; head: (a: Critter) => V2 };

  constructor(readonly species: SeaId, readonly s: ShipScene4) {
    // fully hidden (underwater, deep): nowhere the camera can frame it
    this.body = {
      bounds: a => (a.hidden >= 0.99 ? a.offstage().box : a.box()),
      points: a => (a.hidden >= 0.99 ? a.offstage().pts : a.pts()),
      head: a => a.headPt(),
    };
  }
  offstage(): { box: Box; pts: V2[] } { return { box: { x0: -1e5, y0: -1e5, x1: -1e5 + 1, y1: -1e5 + 1 }, pts: [[-1e5, -1e5]] }; }
  /** art id in the beast registry */
  get art(): string { return this.species; }
  frame(): SeaFrame { return frameOf(this.art, this.anim, this.fi); }
  /** camera y correction for layers whose vertical parallax differs from the horizontal */
  protected dyCam() { return this.p === this.py ? 0 : (game.r.view.y - REF_Y) * (this.py - this.p); }
  box(): Box {
    const f = this.frame(), s = this.scale, dy = this.dyCam();
    const l = -f.ax * s, r = (f.w - f.ax) * s;
    return {
      x0: this.facing > 0 ? this.x + l : this.x - r, x1: this.facing > 0 ? this.x + r : this.x - l,
      y0: this.y - f.ay * s - dy, y1: this.y + (f.h - f.ay) * s - dy,
    };
  }
  pts(): V2[] {
    const f = this.frame(), s = this.scale, dy = this.dyCam();
    return f.pts.map(([x, y]) => [this.x + x * this.facing * s, this.y + y * s - dy] as V2);
  }
  headPt(): V2 { const f = this.frame(); return [this.x + f.head[0] * this.facing, this.y + f.head[1]]; }
  photoInfo() {
    if (this.hidden >= 0.99) return { ...this.offstage(), species: this.species, behavior: null, speed: 0, facing: 0, noticed: false, juvenile: false, p: this.p, hidden: 1 };
    return { species: this.species, behavior: this.behavior || null, box: this.body.bounds(this), pts: this.body.points(this), speed: this.speed, facing: 1, noticed: this.noticed, juvenile: false, p: this.p, hidden: this.hidden };
  }
  setAnim(a: string) { if (this.anim !== a) { this.anim = a; this.fi = 0; this.at = 0; } }
  protected at = 0;
  /** advance the current anim at its own fps; returns true once a non-looping anim has finished */
  protected play(dt: number, fpsK = 1): boolean {
    const info = BEAST_ANIMS[this.art as keyof typeof BEAST_ANIMS]?.[this.anim];
    if (!info) return true;
    this.at += dt * info.fps * fpsK;
    if (info.loop) { this.fi = Math.floor(this.at) % info.frames; return false; }
    this.fi = Math.min(info.frames - 1, Math.floor(this.at));
    return this.at >= info.frames;
  }
  sea(x = this.x) { return this.s.seaY(x); }
  /** world x on the gameplay plane that sounds the same as this critter (for pan / falloff) */
  sfx(name: string, vol: number, pitch = 1) {
    const xe = this.p >= 1 ? this.x : this.x + this.s.st.cam.x * (1 - this.p);
    this.s.sfx(name, xe, vol * (this.p >= 1 ? 1 : 0.55 + this.p * 0.5), pitch);
  }
  /** the player's world position (the deck rocks) and eye height */
  player(): { x: number; y: number; eye: number; vx: number } {
    const p = this.s.player;
    const [x, y] = this.s.shipToWorld(p.x, p.y);
    return { x, y, eye: y - p.height + 7, vx: p.vx };
  }
  /** a camera shutter or a splash went off near here recently */
  heard(kind: string, radius: number) {
    const now = this.s.time;
    return this.s.sounds.some(q => q.kind === kind && now - q.t < 0.25 && Math.hypot(q.x - this.x, q.y - this.y) < radius);
  }
  abstract update(dt: number): void;
  /** the critter's own layer (in front of the ship) */
  draw(r: Renderer) { this.pass(r, 'front'); }
  /** draw for one of the layer passes: front / back of the ship, under the surface, over the sea band */
  pass(r: Renderer, which: Pass) {
    if (which !== (this.back ? 'back' : 'front') || this.hidden >= 0.99) return;
    const f = this.frame();
    r.draw(f.fr, this.x, this.y, this.facing * this.scale, this.scale, this.rot);
  }
}

/** a stand-in drawable that draws a critter on another layer */
class Proxy implements Drawable {
  constructor(readonly c: Critter, readonly which: Pass, public z: number) {}
  get dead() { return this.c.dead; }
  draw(r: Renderer) { this.c.pass(r, this.which); }
}

// ------------------------------------------------------------------ scene geometry
const BOW = 552;            // stem at the waterline (world x)
const MAST: V2 = [424, 4];  // masthead
const sheer = (x: number) => deckY(x) - 13;
/** gull perches, ship-local (they rock with the boat) */
const PERCHES: V2[] = [[34, sheer(34)], [52, sheer(52)], [238, 16], [262, 16], [312, 16], [544, sheer(544) - 1]];

// ------------------------------------------------------------------ Fluting Vanebill
class Vanebill extends Critter {
  mode: 'soar' | 'snatch' | 'land' | 'sit' | 'display' | 'takeoff' | 'leave' = 'soar';
  ph = rand.range(0, Math.PI * 2);
  w = (Math.PI * 2) / 32;
  cx = 380; A = 430; ymid = 72; H = 100;
  mt = 0;
  landT = rand.range(70, 110);
  fluteT = rand.range(8, 16);
  prey: Kitefish | null = null;
  bank = 0;
  constructor(s: ShipScene4) {
    super('vanebill', s);
    this.anim = 'bank';
    const [tx, ty] = this.path();
    this.x = tx; this.y = ty;
  }
  private path(): [number, number, number] {
    const ph = this.ph;
    return [this.cx + this.A * Math.cos(ph), this.ymid - this.H * Math.cos(ph) + Math.sin(ph * 3 + 1) * 10, -Math.sin(ph)];
  }
  update(dt: number) {
    this.t += dt; this.mt += dt;
    const s = this.s;
    if (this.gone && this.mode !== 'leave') { this.mode = 'leave'; this.mt = 0; }
    const pl = this.player();
    switch (this.mode) {
      case 'soar': case 'snatch': case 'leave': {
        if (this.mode !== 'snatch') this.ph += this.w * dt * (0.85 + 0.3 * Math.abs(Math.sin(this.ph)));
        let [tx, ty, d] = this.path();
        if (this.mode === 'leave') { tx = this.x + this.facing * 400; ty = -200; }
        if (this.mode === 'snatch' && this.prey) {
          const q = this.prey;
          tx = q.x + q.vx * 0.15; ty = q.y - 2; d = 1;
          if (q.mode !== 'glide' && q.mode !== 'skip') { this.prey = null; this.mode = 'soar'; this.resync(); }
          else if (Math.hypot(q.x - this.x, q.y - this.y) < 9) {
            q.caught(); this.prey = null;
            this.setAnim('snatch'); this.mt = 0;
            this.sfx('splash', 0.25, 1.4);
            this.behavior = 'snatching';
          }
          if (this.mt > 4) { this.prey = null; this.mode = 'soar'; this.resync(); }
        }
        const k = this.mode === 'snatch' ? 3.4 : 1.6;
        this.vx += ((tx - this.x) * k - this.vx * 1.8) * dt;
        this.vy += ((ty - this.y) * k - this.vy * 1.8) * dt;
        this.x += this.vx * dt; this.y += this.vy * dt;
        if (Math.abs(this.vx) > 6) this.facing = Math.sign(this.vx);
        this.back = d < -0.15;
        this.z = this.back ? -12 : 40;
        // roll: underside when above the watcher, back when below; harder in the turns
        const base = clamp((this.y - pl.eye) / 120, -1, 1) * 0.72;
        const turn = 0.42 * Math.cos(this.ph) ** 2 * (base >= 0 ? 1 : -1);
        this.bank = damp(this.bank, clamp(base + turn, -1.05, 1.05), 3, dt);
        if (this.anim === 'snatch') { if (this.play(dt)) this.setAnim('bank'); }
        else if (this.anim === 'flute') { if (this.mt > 1.6) { this.setAnim('bank'); } else this.play(dt); }
        else this.setAnim('bank');
        if (this.anim === 'bank') this.fi = Math.round((this.bank + 1.05) / 2.1 * (VANEBILL_BANK - 1));
        if (this.anim !== 'snatch' && this.anim !== 'flute') this.behavior = 'soaring';
        // flute into the wind at the top of the climb (heading +x into the head wind)
        this.fluteT -= dt;
        if (this.mode === 'soar' && this.fluteT <= 0 && this.vx > 20 && this.y < 70) {
          this.fluteT = rand.range(9, 18);
          this.setAnim('flute'); this.mt = 0; this.behavior = 'fluting';
          this.sfx('callHoot', 0.4, rand.range(2.6, 3.3));
        }
        // hunt kitefish in the air below
        if (this.mode === 'soar' && this.y > 90) {
          for (const q of KITES) if ((q.mode === 'glide' || q.mode === 'skip') && Math.abs(q.x - this.x) < 140 && Math.sign(q.x - this.x) === this.facing) { this.prey = q; this.mode = 'snatch'; this.mt = 0; break; }
        }
        // settle on the water now and then, ahead of the boat
        this.landT -= dt;
        if (this.mode === 'soar' && this.landT <= 0 && !this.back && this.y > 120 && this.x > 60 && this.x < 760) { this.mode = 'land'; this.mt = 0; this.setAnim('land'); }
        if (this.mode === 'leave' && (this.y < -160 || this.mt > 8)) this.dead = true;
        this.speed = Math.hypot(this.vx, this.vy);
        break;
      }
      case 'land': {
        const sea = this.sea();
        this.vx = damp(this.vx, this.facing * 25, 2, dt);
        this.vy = damp(this.vy, (sea - 4 - this.y) * 2.5, 4, dt);
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.play(dt);
        this.behavior = 'soaring';
        if (this.y > sea - 6 || this.mt > 3) {
          this.mode = 'sit'; this.mt = 0; this.setAnim('sit');
          this.sfx('splash', 0.35, 0.8);
          s.ocean?.splash(this.x, 0.18);
        }
        break;
      }
      case 'sit': case 'display': {
        // drifting astern with the water
        this.x -= (s.weather?.cruise ?? 18) * dt;
        this.y = this.sea() + 1;
        this.vx = -18; this.vy = 0;
        this.play(dt);
        this.behavior = this.mode === 'display' ? 'skypointing' : 'resting';
        if (this.mode === 'sit' && this.mt > rand.range(8, 9) && this.anim === 'sit' && rand.next() < dt * 0.3) {
          this.mode = 'display'; this.mt = 0; this.setAnim('display');
          this.sfx('callHoot', 0.45, rand.range(2.2, 2.7));
        }
        if (this.mode === 'display' && this.mt > 3.2) { this.mode = 'sit'; this.mt = -6; this.setAnim('sit'); }
        // a person leaning on the rail right above it, the shutter, or time: run off across the water
        const near = Math.abs(pl.x - this.x) < 70 && Math.abs(pl.vx) > 20;
        if (near) this.noticed = true;
        if (near || this.heard('shutter', 120) || this.mt > 22 || this.x < -150 || this.gone) {
          this.mode = 'takeoff'; this.mt = 0; this.setAnim('takeoff'); this.facing = 1;
          this.sfx('wingFlap', 0.5, 0.6);
        }
        this.speed = 18;
        break;
      }
      case 'takeoff': {
        this.vx = damp(this.vx, 70, 1.2, dt);
        this.x += this.vx * dt;
        const lift = clamp((this.mt - 1.2) / 1.6);
        this.y = this.sea() - 3 - lift * lift * 40;
        this.play(dt);
        this.behavior = 'takeoff';
        if (this.mt < 1.6 && rand.next() < dt * 8) s.ocean?.spray(this.x - 2, this.sea(), 0.02, -20, -1);
        if (Math.floor(this.mt * 1.4) !== Math.floor((this.mt - dt) * 1.4)) this.sfx('wingFlap', 0.35, 0.55);
        if (this.mt > 2.8) { this.mode = this.gone ? 'leave' : 'soar'; this.mt = 0; this.landT = rand.range(80, 140); this.noticed = false; this.resync(); }
        this.speed = Math.abs(this.vx);
        break;
      }
    }
  }
  /** pick the loop phase nearest to where we are now */
  private resync() {
    let best = this.ph, bd = Infinity;
    for (let i = 0; i < 64; i++) {
      const ph = (i / 64) * Math.PI * 2;
      const x = this.cx + this.A * Math.cos(ph), y = this.ymid - this.H * Math.cos(ph);
      const d = Math.hypot(x - this.x, y - this.y) + (Math.sign(-Math.sin(ph) * this.A) !== Math.sign(this.vx || 1) ? 200 : 0);
      if (d < bd) { bd = d; best = ph; }
    }
    this.ph = best;
  }
}

// ------------------------------------------------------------------ Sackjaw Gulls
const GULLS: Sackjaw[] = [];
class Sackjaw extends Critter {
  mode: 'hover' | 'beg' | 'perch' | 'display' | 'swim' | 'steal' | 'carry' | 'flee' | 'fly' | 'leave' = 'hover';
  hx = rand.range(20, 200);
  hy = rand.range(30, 80);
  mt = 0;
  next = rand.range(4, 9);
  perch: V2 | null = null;
  stealCd = rand.range(10, 20);
  callT = rand.range(2, 6);
  goal: V2 = [0, 0];
  constructor(s: ShipScene4, x: number, y: number) {
    super('sackjaw', s);
    this.x = x; this.y = y;
    this.anim = 'hover';
    GULLS.push(this);
  }
  private go(m: Sackjaw['mode']) { this.mode = m; this.mt = 0; }
  update(dt: number) {
    this.t += dt; this.mt += dt;
    const s = this.s, pl = this.player();
    if (this.gone && this.mode !== 'leave') { this.go('leave'); this.perch = null; }
    const atStern = s.player.y < 130 && s.player.x < 150;
    const bob = s.bobber;
    this.stealCd -= dt;
    // startle: someone walks right up to it, or the shutter clicks close by
    if (this.mode !== 'flee' && this.mode !== 'leave' && this.mode !== 'carry') {
      const dist = Math.hypot(pl.x - this.x, pl.eye - this.y);
      if ((dist < 26 && (this.mode === 'perch' || this.mode === 'display')) || (dist < 60 && this.heard('shutter', 60))) {
        this.perch = null; this.go('flee'); this.noticed = true;
        this.goal = [this.x + (this.x > pl.x ? 1 : -1) * 120, this.y - 60];
        this.sfx('wingFlap', 0.4, 1.4);
        this.sfx('callScreech', 0.3, rand.range(1.4, 1.7));
      }
    }
    let fly = true;
    let tx = this.x, ty = this.y, k = 1.6;
    switch (this.mode) {
      case 'hover': {
        tx = this.hx + Math.sin(this.t * 0.37) * 18; ty = this.hy + Math.sin(this.t * 0.9) * 6;
        this.behavior = 'hovering';
        if (this.mt > this.next) this.decide(atStern, bob);
        break;
      }
      case 'beg': {
        tx = pl.x + (this.hx > 100 ? 26 : -22) + Math.sin(this.t * 1.3) * 8;
        ty = pl.eye - 22 + Math.sin(this.t * 2.1) * 4;
        this.behavior = 'begging';
        this.noticed = true;
        this.callT -= dt;
        if (this.callT <= 0) { this.callT = rand.range(1.6, 3.5); this.sfx('callScreech', 0.32, rand.range(1.3, 1.6)); }
        if (!atStern || this.mt > 14) { this.noticed = false; this.go('hover'); this.next = rand.range(4, 8); }
        break;
      }
      case 'steal': {
        if (!bob) { this.go('hover'); break; }
        tx = bob.x; ty = bob.y - 5; k = 3.2;
        this.behavior = 'stealing';
        if (Math.hypot(bob.x - this.x, bob.y - 5 - this.y) < 7 || this.mt > 5) {
          this.go('carry'); this.goal = [bob.x - 160, 30];
          s.ocean?.splash(bob.x, 0.08);
          this.sfx('splash', 0.25, 1.6);
          this.sfx('callScreech', 0.3, 1.5);
        }
        break;
      }
      case 'carry': case 'flee': case 'fly': {
        [tx, ty] = this.goal; k = 1.4;
        this.behavior = this.mode === 'carry' ? 'stealing' : 'flying';
        if (Math.hypot(tx - this.x, ty - this.y) < 14 || this.mt > 7) {
          if (this.mode === 'fly' && this.perch) { this.go('perch'); this.setAnim('idle'); this.sfx('wingFlap', 0.3, 1.5); }
          else { this.go('hover'); this.noticed = false; this.next = rand.range(3, 7); }
        }
        break;
      }
      case 'perch': case 'display': {
        fly = false;
        const [wx, wy] = s.shipToWorld(this.perch![0], this.perch![1]);
        this.x = wx; this.y = wy; this.vx = this.vy = 0;
        this.behavior = this.mode === 'display' ? 'displaying' : 'perched';
        // a neighbour too close on the rail: blow up the sack and shout
        const rival = GULLS.find(g => g !== this && (g.mode === 'perch' || g.mode === 'display') && Math.abs(g.x - this.x) < 30 && Math.abs(g.y - this.y) < 8);
        if (this.mode === 'perch' && rival && this.mt > 1.2) {
          this.go('display'); this.setAnim('display'); this.facing = rival.x > this.x ? 1 : -1;
          this.sfx('callHonk', 0.35, rand.range(1.2, 1.5));
        }
        if (this.mode === 'display' && this.mt > 2.6) {
          if (rival && rival.mode === 'display' && this.t % 2 > 1) { this.perch = null; this.go('flee'); this.goal = [this.x - 100, this.y - 40]; }
          else { this.go('perch'); this.setAnim('idle'); }
        }
        if (this.mode === 'perch') {
          if (this.anim === 'call') { if (this.play(dt) || this.mt > 1.4) this.setAnim('idle'); }
          else { this.play(dt); if (rand.next() < dt * 0.15) { this.setAnim('call'); this.sfx('callScreech', 0.25, rand.range(1.2, 1.5)); } }
          if (this.mt > rand.range(14, 16) && rand.next() < dt * 0.2) { this.perch = null; this.go('hover'); this.sfx('wingFlap', 0.3, 1.5); }
          if (atStern && rand.next() < dt * 0.2) { this.perch = null; this.go('beg'); }
          if (bob && this.stealCd <= 0 && rand.next() < dt * 0.3) { this.perch = null; this.stealCd = rand.range(25, 45); this.go('steal'); }
        } else this.play(dt);
        break;
      }
      case 'swim': {
        fly = false;
        this.x -= (s.weather?.cruise ?? 18) * dt;
        this.y = this.sea() + 0.5;
        this.vx = -18; this.vy = 0;
        this.behavior = 'swimming';
        this.setAnim('swim'); this.play(dt);
        if (this.mt > 12 || this.x < -200 || this.heard('shutter', 80)) { this.go('fly'); this.perch = null; this.goal = [rand.range(20, 160), rand.range(40, 80)]; this.sfx('wingFlap', 0.3, 1.4); }
        break;
      }
      case 'leave': {
        tx = this.x - 400; ty = -150; k = 1.2;
        this.behavior = 'flying';
        if (this.mt > 7) this.dead = true;
        break;
      }
    }
    if (fly) {
      this.vx += ((tx - this.x) * k - this.vx * 2.2) * dt;
      this.vy += ((ty - this.y) * k - this.vy * 2.2) * dt;
      // the head wind holds a kiting gull in place: little forward speed needed
      this.x += this.vx * dt; this.y += this.vy * dt;
      const sp = Math.hypot(this.vx, this.vy);
      if (Math.abs(this.vx) > 8) this.facing = Math.sign(this.vx);
      else if (this.mode === 'beg' || this.mode === 'hover') this.facing = pl.x > this.x ? 1 : -1;
      const want = this.mode === 'carry' ? 'carry' : this.mode === 'steal' ? (Math.hypot(tx - this.x, ty - this.y) < 30 ? 'grab' : 'swoop') : this.mode === 'beg' ? 'beg' : sp > 45 ? 'fly' : sp > 22 ? 'glide' : 'hover';
      this.setAnim(want);
      this.play(dt, want === 'fly' ? 0.8 + sp / 160 : 1);
      // perched gulls land on the rails, the roof and the pulpit; the wheelhouse is behind its rail
      this.back = false;
    }
    this.z = 46 + (this.y % 3);
    this.speed = Math.hypot(this.vx, this.vy);
  }
  private decide(atStern: boolean, bob: ShipScene4['bobber']) {
    this.next = rand.range(4, 9);
    if (atStern && rand.next() < 0.7) { this.go('beg'); return; }
    if (bob && this.stealCd <= 0) { this.stealCd = rand.range(25, 45); this.go('steal'); return; }
    const r = rand.next();
    if (r < 0.45) {
      const free = PERCHES.filter(pp => !GULLS.some(g => g.perch === pp));
      if (free.length) {
        this.perch = rand.pick(free);
        const [wx, wy] = this.s.shipToWorld(this.perch[0], this.perch[1]);
        this.goal = [wx, wy];
        this.go('fly');
        return;
      }
    }
    if (r < 0.62) { this.go('swim'); this.y = this.sea(); this.x = Math.min(this.x, 10); this.s.ocean?.splash(this.x, 0.08); return; }
    this.hx = rand.range(-20, 220); this.hy = rand.range(25, 85);
  }
}

// ------------------------------------------------------------------ Scythewing Petrels
class Flock {
  cx = -180;
  dir = 1;
  mode: 'skim' | 'wheel' | 'patter' | 'raft' | 'flush' = 'skim';
  mt = 0;
  side: 'front' | 'back' = 'front';
  next = rand.range(14, 24);
  members: Scythewing[] = [];
  constructor(readonly s: ShipScene4) {}
  update(dt: number) {
    this.mt += dt;
    const cr = this.s.weather?.cruise ?? 18;
    if (this.mode === 'skim') {
      this.cx += this.dir * 72 * dt;
      this.next -= dt;
      if ((this.dir > 0 && this.cx > 820) || (this.dir < 0 && this.cx < -220)) { this.mode = 'wheel'; this.mt = 0; }
      else if (this.next <= 0 && this.cx > -120 && this.cx < 720) {
        this.next = rand.range(16, 28);
        this.mode = rand.next() < 0.72 ? 'patter' : 'raft'; this.mt = 0;
      }
    } else if (this.mode === 'wheel') {
      this.cx += this.dir * 72 * dt * Math.cos(this.mt * 2.4);
      if (this.mt > 1.3) {
        this.dir = -this.dir; this.mode = 'skim'; this.mt = 0;
        // swing round the far side of the boat now and then
        if (rand.next() < 0.45) this.side = this.side === 'front' ? 'back' : 'front';
      }
    } else if (this.mode === 'patter') {
      this.cx -= cr * 0.2 * dt;
      if (this.mt > 5) { this.mode = 'skim'; this.mt = 0; }
    } else if (this.mode === 'raft') {
      this.cx -= cr * dt;
      if (this.mt > 10) { this.mode = 'flush'; this.mt = 0; this.s.sfx('wingFlap', this.cx, 0.3, 2.2); }
    } else if (this.mode === 'flush') {
      this.cx += this.dir * 90 * dt;
      if (this.mt > 1.2) { this.mode = 'skim'; this.mt = 0; }
    }
    if (rand.next() < dt * 0.4) this.s.sfx('callChirp', this.cx, 0.12, rand.range(1.7, 2.1));
  }
}
class Scythewing extends Critter {
  off: V2;
  h = rand.range(4, 16);
  lag = rand.range(0, 0.5);
  sprayT = rand.range(1, 4);
  constructor(s: ShipScene4, readonly F: Flock, i: number) {
    super('scythewing', s);
    // a loose, ragged line: the leaders low over the water, stragglers higher and behind
    this.off = [i * 21 - 95 + rand.range(-9, 9), 0];
    this.h = 4 + Math.abs(i - 4.5) * 1.6 + rand.range(0, 6);
    this.x = F.cx + this.off[0]; this.y = this.sea() - this.h;
    this.anim = 'skim';
    F.members.push(this);
  }
  update(dt: number) {
    this.t += dt;
    const F = this.F;
    if (F.members[0] === this) F.update(dt);
    if (this.gone) {
      this.vy -= 60 * dt; this.x += F.dir * 110 * dt; this.y += this.vy * dt;
      this.setAnim('flap'); this.play(dt);
      if (this.y < -100) this.dead = true;
      return;
    }
    const sea = this.sea();
    let tx = F.cx + this.off[0] * F.dir, ty = sea - this.h + Math.sin(this.t * 2.3) * 1.5;
    if (F.mode === 'patter') ty = sea - 4;
    if (F.mode === 'raft') ty = sea;
    // separation from flock mates
    let sx = 0;
    for (const o of F.members) if (o !== this && Math.abs(o.x - this.x) < 7 && Math.abs(o.y - this.y) < 5) sx += Math.sign(this.x - o.x || 1) * 18;
    const k = F.mode === 'raft' ? 2 : 3;
    this.vx += ((tx - this.x) * k + sx - this.vx * 2.4) * dt;
    this.x += this.vx * dt;
    this.y = damp(this.y, ty, F.mode === 'raft' ? 6 : 9, dt);
    this.vy = 0;
    if (Math.abs(this.vx) > 10) this.facing = Math.sign(this.vx);
    this.back = F.side === 'back';
    this.z = this.back ? -14 : 44 + (this.off[1] > 0 ? 1 : 0);
    this.speed = Math.abs(this.vx);
    if (F.mode === 'wheel' || F.mode === 'flush') {
      // the whole flock rolls over at once: white undersides flash
      const u = clamp((F.mt - this.lag * 0.4) / 1.0);
      this.setAnim(F.mode === 'flush' ? 'flap' : 'bank');
      if (this.anim === 'bank') this.fi = Math.round(Math.sin(u * Math.PI) * (SCYTHE_BANK - 1));
      else this.play(dt);
      this.behavior = 'wheeling';
    } else if (F.mode === 'patter') {
      this.setAnim('patter'); this.play(dt);
      this.behavior = 'pattering';
      if (rand.next() < dt * 1.5) this.s.ocean?.spray(this.x, sea, 0, 0, -1);
    } else if (F.mode === 'raft') {
      this.setAnim('raft'); this.play(dt);
      this.behavior = 'rafting';
      this.speed = 18;
    } else {
      this.setAnim(Math.sin(this.t * 0.7 + this.lag * 9) > 0.85 ? 'flap' : 'skim'); this.play(dt);
      this.behavior = 'skimming';
      // the stiff blade slices a crest: a thin line of spray
      this.sprayT -= dt;
      if (this.sprayT <= 0 && !this.back) { this.sprayT = rand.range(2, 5); this.s.ocean?.spray(this.x - this.facing * 5, sea, 0, -this.facing * 40, -0.6); }
    }
  }
}

// ------------------------------------------------------------------ Moonfin Porpoises
const POD: Moonfin[] = [];
class Moonfin extends Critter {
  mode: 'bowride' | 'under' | 'leap' | 'breach' | 'slap' | 'leave' = 'bowride';
  mt = 0;
  next = rand.range(2, 6);
  jump = { x0: 0, vx: 0, vy: 0, t: 0 };
  constructor(s: ShipScene4, readonly slot: number) {
    super('moonfin', s);
    this.x = BOW + 30 + slot * 18; this.y = this.sea() + 6;
    this.anim = 'bowride';
    this.z = 30 + slot;
    POD.push(this);
  }
  private go(m: Moonfin['mode']) { this.mode = m; this.mt = 0; }
  update(dt: number) {
    this.t += dt; this.mt += dt;
    const s = this.s;
    if (this.gone && this.mode !== 'leave' && this.mode !== 'leap' && this.mode !== 'breach') this.go('leave');
    const sea = this.sea();
    const moving = s.engineOn !== false;
    const pl = this.player();
    this.noticed = pl.x > 470 && s.player.y < 130;
    switch (this.mode) {
      case 'bowride': case 'under': {
        // riding the pressure wave just ahead of the stem (curious ones come in when someone's at the bow)
        const base = moving ? BOW + 18 + this.slot * 16 - (this.noticed ? 6 : 0) : 420 + this.slot * 70;
        const tx = base + Math.sin(this.t * 0.6 + this.slot * 2) * (moving ? 8 : 60);
        this.vx = damp(this.vx, (tx - this.x) * 1.5, 2, dt);
        this.x += this.vx * dt;
        const depth = this.mode === 'under' ? 16 : 5.5 + Math.sin(this.t * 1.7 + this.slot) * 1.2;
        this.y = damp(this.y, sea + depth, 3, dt);
        this.vy = 0;
        this.facing = moving ? 1 : this.vx >= 0 ? 1 : -1;
        this.setAnim(this.mode === 'under' || !moving ? 'swim' : 'bowride'); this.play(dt);
        this.hidden = this.mode === 'under' ? 1 : 0.35;
        this.behavior = this.mode === 'under' ? 'swimming' : moving ? 'bowriding' : 'swimming';
        this.speed = moving ? (s.weather?.cruise ?? 18) : Math.abs(this.vx);
        this.next -= dt;
        if (this.next <= 0) {
          this.next = rand.range(3, 7);
          const r = rand.next();
          if (r < 0.12) this.startJump(true);
          else if (r < 0.22 && this.mode !== 'under') { this.go('slap'); this.setAnim('tailslap'); }
          else if (r < 0.4) this.go(this.mode === 'under' ? 'bowride' : 'under');
          else this.startJump(false);
        }
        break;
      }
      case 'leap': case 'breach': {
        const J = this.jump;
        J.t += dt;
        J.vy += 330 * dt;
        this.x += J.vx * dt;
        this.y += J.vy * dt;
        this.vx = J.vx; this.vy = J.vy;
        this.hidden = 0;
        if (this.mode === 'leap') {
          const pitch = Math.atan2(-J.vy, Math.abs(J.vx) + 30);
          this.fi = clamp(Math.round((0.95 - pitch) / 1.9 * (MOONFIN_LEAP - 1)), 0, MOONFIN_LEAP - 1);
          this.behavior = 'porpoising';
        } else { this.play(dt, 0.75); this.behavior = 'breaching'; }
        if (J.vy > 0 && this.y > sea + 4) {
          s.ocean?.splash(this.x, this.mode === 'breach' ? 0.7 : 0.22);
          this.sfx(this.mode === 'breach' ? 'splashBig' : 'splash', this.mode === 'breach' ? 0.5 : 0.25, this.mode === 'breach' ? 0.9 : 1.3);
          if (this.mode === 'breach') s.sounds.push({ x: this.x, y: sea, kind: 'splash', src: null, species: null, radius: 220, t: s.time + 0.0001 });
          this.y = sea + 8;
          this.go(this.gone ? 'leave' : 'bowride');
        }
        this.speed = Math.hypot(J.vx, J.vy);
        break;
      }
      case 'slap': {
        this.y = damp(this.y, sea + 3, 4, dt);
        this.x += (moving ? 0 : 5) * dt;
        this.behavior = 'tailslapping';
        this.hidden = 0.2;
        if (this.play(dt)) { this.go('bowride'); }
        if (this.fi === 3 && this.at < 3.2) { s.ocean?.splash(this.x - this.facing * 16, 0.3); this.sfx('splash', 0.3, 1.1); this.at = 3.2; }
        break;
      }
      case 'leave': {
        this.y = damp(this.y, sea + 30, 1.5, dt);
        this.x += 60 * dt;
        this.hidden = 1;
        this.setAnim('swim'); this.play(dt);
        if (this.mt > 4) this.dead = true;
        break;
      }
    }
    this.back = false;
  }
  private startJump(big: boolean) {
    const s = this.s;
    this.go(big ? 'breach' : 'leap');
    this.setAnim(big ? 'breach' : 'leap');
    const moving = s.engineOn !== false;
    this.jump = { x0: this.x, vx: (moving ? 34 : this.facing * 50) + rand.range(-6, 8), vy: big ? -175 : -rand.range(100, 135), t: 0 };
    this.y = this.sea() + 2;
    s.ocean?.splash(this.x, big ? 0.35 : 0.12);
    this.sfx('callClick', 0.22, rand.range(1.1, 1.4));
    // the blow as it breaks the surface
    s.ocean?.spray(this.x + 6, this.sea() - 2, 0, 0, -1);
  }
  pass(r: Renderer, which: Pass) {
    if (which === 'under') {
      // seen through the surface: a dark translucent shape, the glow lines still faintly showing
      if (this.hidden <= 0.05) return;
      const f = this.frame();
      r.draw(f.fr, this.x, this.y, this.facing, 1, 0, packColor(0.15, 0.32, 0.4, 0.28 * this.hidden + 0.08));
      if (f.glow) { r.emissive(1); r.draw(f.glow, this.x, this.y, this.facing, 1, 0, packColor(0.6, 1, 0.9, 0.35)); r.emissive(); }
      return;
    }
    if (which === 'front' && this.hidden < 0.99) {
      const f = this.frame();
      r.draw(f.fr, this.x, this.y, this.facing, 1);
      if (f.glow) { r.emissive(1); r.draw(f.glow, this.x, this.y, this.facing, 1, 0, packColor(1, 1, 1, 0.85)); r.emissive(); }
    }
  }
  /** what shows above the water: points under the surface don't count */
  pts(): V2[] {
    const sea = this.sea();
    const all = super.pts();
    const up = all.filter(q => q[1] < sea + 1);
    return up.length ? up : all.slice(0, 1);
  }
  box(): Box {
    const b = super.box();
    return { ...b, y1: Math.min(b.y1, this.sea() + 2) };
  }
}

// ------------------------------------------------------------------ Whiptail Kitefish
const KITES: Kitefish[] = [];
class Kitefish extends Critter {
  mode: 'hidden' | 'launch' | 'glide' | 'skip' | 'dive' = 'hidden';
  mt = 0;
  cd = rand.range(3, 12);
  skips = 0;
  h = 10;
  glideT = 1;
  constructor(s: ShipScene4) {
    super('kitefish', s);
    this.hidden = 1;
    this.anim = 'glide';
    KITES.push(this);
  }
  private go(m: Kitefish['mode']) { this.mode = m; this.mt = 0; }
  caught() { this.go('hidden'); this.hidden = 1; this.cd = rand.range(15, 30); }
  update(dt: number) {
    this.t += dt; this.mt += dt;
    const s = this.s;
    switch (this.mode) {
      case 'hidden':
        this.hidden = 1;
        this.cd -= dt;
        if (this.gone) { this.dead = true; return; }
        if (this.cd <= 0) {
          // flushed by the bow most often, sometimes alongside or by the hunting pod
          const r = rand.next();
          this.x = r < 0.6 ? BOW + rand.range(20, 140) : r < 0.85 ? rand.range(200, 520) : rand.range(-140, 0);
          this.facing = r < 0.6 ? 1 : rand.pick([-1, 1]);
          this.vx = this.facing * rand.range(105, 150);
          this.y = this.sea() + 4;
          this.skips = rand.pick([0, 1, 1, 2]);
          this.h = rand.range(8, 15);
          this.glideT = rand.range(0.8, 1.8);
          this.go('launch'); this.setAnim('launch');
          s.ocean?.splash(this.x, 0.1);
          this.sfx('splash', 0.2, 1.7);
          // a school bursts out together
          for (const q of KITES) if (q !== this && q.mode === 'hidden' && q.cd > 0 && rand.next() < 0.5) q.cd = rand.range(0.1, 0.6);
        }
        break;
      case 'launch':
        this.hidden = 0;
        this.x += this.vx * dt;
        this.y = damp(this.y, this.sea() - this.h * 0.6, 8, dt);
        this.behavior = 'launching';
        if (this.play(dt)) { this.go('glide'); this.setAnim('glide'); }
        break;
      case 'glide':
        this.x += this.vx * dt;
        this.vx *= 1 - dt * 0.12;
        this.y = damp(this.y, this.sea() - this.h * (1 - this.mt / (this.glideT * 1.6)), 6, dt);
        this.play(dt);
        this.behavior = 'gliding';
        if (this.mt > this.glideT) {
          if (this.skips > 0) { this.skips--; this.go('skip'); this.setAnim('skip'); s.ocean?.spray(this.x - this.facing * 10, this.sea(), 0, -this.facing * 30, -1); this.sfx('splash', 0.12, 2); }
          else { this.go('dive'); this.setAnim('dive'); }
        }
        break;
      case 'skip':
        // whip dipped into the crest: sculling back up for another glide
        this.x += this.vx * dt;
        this.vx = this.facing * Math.max(Math.abs(this.vx), 120);
        this.y = damp(this.y, this.sea() - 5, 10, dt);
        this.behavior = 'skipping';
        if (this.play(dt) || this.mt > 0.5) { this.go('glide'); this.setAnim('glide'); this.glideT = rand.range(0.6, 1.3); }
        break;
      case 'dive':
        this.x += this.vx * dt * 0.7;
        this.y = damp(this.y, this.sea() + 6, 7, dt);
        this.behavior = 'gliding';
        this.play(dt);
        if (this.mt > 0.3) {
          s.ocean?.splash(this.x, 0.08); this.sfx('splash', 0.15, 1.9);
          this.go('hidden'); this.hidden = 1; this.cd = rand.range(6, 16);
        }
        break;
    }
    this.speed = Math.abs(this.vx);
    this.vy = 0;
    this.z = 42;
  }
}

// ------------------------------------------------------------------ Reefback and its parasites
type Band = 'far' | 'mid';
class Reefback extends Critter {
  band: Band = 'far';
  mode: 'deep' | 'rise' | 'bask' | 'roll' | 'fluke' | 'dive' | 'leave' = 'deep';
  mt = 0;
  deepT = rand.range(8, 14);
  sink = 40;
  blowT = 0;
  blows = 0;
  spoutT = -1;
  far = 0;
  layers: Record<Band, Layer>;
  proxy: Proxy;
  constructor(s: ShipScene4) {
    super('reefback', s);
    this.layers = { far: s.st.layer('sea-far'), mid: s.st.layer('sea-mid') };
    this.z = -1;
    this.hidden = 1;
    this.anim = 'bask';
    this.proxy = new Proxy(this, 'top', 1);
    this.setBand('far');
  }
  get art() { return this.band === 'far' ? 'reefback-far' : 'reefback'; }
  get k() { return this.band === 'far' ? REEFBACK_K.far : REEFBACK_K.mid; }
  private setBand(b: Band) {
    this.layers[this.band].remove(this); this.layers[this.band].remove(this.proxy);
    this.band = b;
    this.layers[b].add(this); this.layers[b].add(this.proxy);
    this.p = b === 'far' ? 0.3 : 0.6;
    this.py = this.layers[b].py;
  }
  private go(m: Reefback['mode']) { this.mode = m; this.mt = 0; }
  surface() { return this.s.ocean ? this.s.ocean.bandSurfaceY(this.band, this.x) : (this.band === 'far' ? 122 : 158); }
  update(dt: number) {
    this.t += dt; this.mt += dt;
    if (this.gone && this.mode !== 'leave' && this.mode !== 'deep') { this.go('fluke'); this.setAnim('fluke'); this.mode = 'leave'; }
    const k = this.k;
    switch (this.mode) {
      case 'deep': {
        this.hidden = 1;
        if (this.gone) { this.dead = true; return; }
        this.deepT -= dt;
        if (this.deepT <= 0) {
          // mostly on the horizon; every so often it comes up close, off the bow
          const close = this.far >= 2 || rand.next() < 0.3;
          this.setBand(close ? 'mid' : 'far');
          this.far = close ? 0 : this.far + 1;
          this.x = close ? rand.range(560, 640) : rand.range(120, 520);
          this.facing = rand.pick([-1, 1]);
          this.sink = 34;
          this.go('rise'); this.setAnim('surface');
          this.sfx('splashBig', 0.4, 0.5);
          this.sfx('callWhale', 0.35, rand.range(0.45, 0.6));
        }
        break;
      }
      case 'rise':
        this.hidden = 0;
        this.sink = damp(this.sink, 0, 1.2, dt);
        this.play(dt);
        this.behavior = 'surfacing';
        if (this.mt > 3.2) { this.go('bask'); this.setAnim('bask'); this.blowT = 0.8; this.blows = 0; }
        break;
      case 'bask': {
        this.sink = damp(this.sink, 0, 2, dt);
        this.play(dt);
        this.blowT -= dt;
        this.behavior = this.spoutT >= 0 ? 'spouting' : 'basking';
        if (this.blowT <= 0) {
          this.blowT = rand.range(5, 8); this.blows++;
          this.spoutT = 0;
          this.sfx('gust', 0.4, 0.5);
          if (rand.next() < 0.4) this.sfx('callWhale', 0.3, rand.range(0.4, 0.55));
        }
        const stay = this.band === 'mid' ? 26 : 16;
        if (this.band === 'mid' && this.mt > 9 && this.mt < 9 + dt * 1.5 && rand.next() < 0.6) { this.go('roll'); this.setAnim('roll'); }
        else if (this.mt > stay) { this.go('fluke'); this.setAnim('fluke'); }
        break;
      }
      case 'roll':
        this.behavior = 'rolling';
        if (this.play(dt, 0.6) && this.mt > 6) { this.go('bask'); this.mt = 12; this.setAnim('bask'); }
        break;
      case 'fluke': case 'leave': {
        this.behavior = 'fluking';
        const done = this.play(dt);
        if (this.fi >= 4) this.sink = damp(this.sink, 26, 0.7, dt);
        if (this.fi === 6 && this.at < 6.5) { this.sfx('splashBig', 0.45, 0.55); this.at = 6.5; }
        if (done && this.mt > 2.4) { this.go('deep'); this.deepT = rand.range(22, 40); this.hidden = 1; }
        break;
      }
    }
    // the blow
    if (this.spoutT >= 0) { this.spoutT += dt; if (this.spoutT > 1.3) this.spoutT = -1; }
    this.y = this.surface() + this.sink * k;
    this.hidden = this.mode === 'deep' ? 1 : clamp(this.sink / 34) * 0.8;
    this.speed = 3;
  }
  pass(r: Renderer, which: Pass) {
    if (this.mode === 'deep') return;
    if (which === 'top') {
      if (this.spoutT < 0) return;
      const f = this.frame();
      const sp = frameOf(this.art, 'spout', Math.min(5, Math.floor(this.spoutT / 1.3 * 6)));
      r.draw(sp.fr, this.x + f.head[0] * this.facing, this.y + f.head[1], this.facing, 1);
      return;
    }
    if (which !== 'front') return;
    r.draw(this.frame().fr, this.x, this.y, this.facing, 1);
  }
  /** only what's above the band's surface counts for the camera */
  box(): Box {
    const b = super.box(), surf = this.surface() - this.dyCam();
    return { ...b, y1: Math.min(b.y1, surf + 1) };
  }
  pts(): V2[] {
    const surf = this.surface() - this.dyCam();
    const up = super.pts().filter(q => q[1] < surf);
    return up.length ? up : [[this.x, surf]];
  }
}

/** a parasite riding on the Reefback: its own camera subject over the spot it lives on */
class Rider extends Critter {
  constructor(s: ShipScene4, readonly host: Reefback, sp: 'crownlouse' | 'pennantleech') {
    super(sp, s);
    this.hidden = 1;
  }
  private spot(): [number, number, number, number] | null {
    const h = this.host;
    if (h.mode === 'deep' || h.dead) return null;
    const sp = reefbackSpots(h.anim, h.fi, h.k);
    return this.species === 'crownlouse' ? sp.lice : sp.leech;
  }
  update(dt: number) {
    this.t += dt;
    const h = this.host;
    this.p = h.p; this.py = h.py; this.x = h.x; this.y = h.y; this.facing = h.facing;
    const b = this.spot();
    this.hidden = b ? h.hidden : 1;
    this.behavior = this.species === 'crownlouse' ? 'swarming' : h.anim === 'fluke' || h.anim === 'roll' ? 'dangling' : 'trailing';
    if (h.dead) this.dead = true;
    if (h.gone) this.gone = true;
  }
  box(): Box {
    const b = this.spot() ?? [0, 0, 1, 1];
    const dy = this.dyCam(), f = this.facing;
    const xa = this.x + b[0] * f, xb = this.x + b[2] * f;
    return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: this.y + b[1] - dy, y1: this.y + b[3] - dy };
  }
  pts(): V2[] {
    const b = this.box();
    const out: V2[] = [];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) out.push([b.x0 + (b.x1 - b.x0) * (0.2 + i * 0.3), b.y0 + (b.y1 - b.y0) * (0.2 + j * 0.3)]);
    return out;
  }
  headPt(): V2 { const b = this.box(); return [(b.x0 + b.x1) / 2, b.y0]; }
  pass() {}
}

// ------------------------------------------------------------------ setup
/** add a p = 1 layer right before / after another one */
function lifeLayer(s: ShipScene4, name: string, anchor: string, after: boolean): Layer {
  const st = s.st;
  if (st.hasLayer(name)) return st.layer(name);
  const l = st.addLayer(name, 1, 0, 1, 0, 1);
  st.layers.splice(st.layers.indexOf(l), 1);
  const j = st.layers.findIndex(x => x.name === anchor);
  st.layers.splice(after ? j + 1 : j, 0, l);
  return l;
}

/** spawn the afternoon's wildlife and hook up photo counting */
export function startDeckLife(s: ShipScene4) {
  if ((s as unknown as { _deckLife?: boolean })._deckLife) return;
  (s as unknown as { _deckLife?: boolean })._deckLife = true;
  GULLS.length = 0; POD.length = 0; KITES.length = 0;
  const back = lifeLayer(s, 'life-back', 'main', false);
  const front = lifeLayer(s, 'life-front', 'sea-near', false);
  const under = lifeLayer(s, 'life-under', 'sea-near', true);
  const add = (c: Critter) => {
    front.add(c);
    back.add(new Proxy(c, 'back', c.z));
    if (c instanceof Moonfin) under.add(new Proxy(c, 'under', c.z));
    s.animals.push(c as unknown as Animal);
  };
  add(new Vanebill(s));
  for (let i = 0; i < 4; i++) add(new Sackjaw(s, rand.range(-40, 220), rand.range(30, 90)));
  const flock = new Flock(s);
  for (let i = 0; i < 10; i++) add(new Scythewing(s, flock, i));
  for (let i = 0; i < 3; i++) add(new Moonfin(s, i));
  for (let i = 0; i < 5; i++) add(new Kitefish(s));
  const whale = new Reefback(s);
  s.animals.push(whale as unknown as Animal);
  for (const sp of ['crownlouse', 'pennantleech'] as const) {
    const r = new Rider(s, whale, sp);
    s.st.layer('sea-mid').add(r);
    s.animals.push(r as unknown as Animal);
  }
  // warm the frames a strip at a time, the ones seen first first
  warmQueue.length = 0;
  const strips: [string, string][] = [];
  for (const id of ['vanebill', 'sackjaw', 'scythewing', 'moonfin', 'kitefish', 'reefback-far', 'reefback']) for (const a of Object.keys(BEAST_ANIMS[id as keyof typeof BEAST_ANIMS] ?? {})) if (a !== 'idle') strips.push([id, a]);
  warmQueue.push(...strips);
  s.st.layer('sea-horizon').add({ z: -1e9, draw() {}, update: () => warmStep(4), get dead() { return !warmQueue.length; } } as Drawable);
  // photo counting: each species once
  const prev = s.cam.onShot;
  s.cam.onShot = ph => {
    prev?.(ph);
    const seen = new Set(ph.subjects.filter(x => x.inFrame > 0.4 && x.visible > 0.4).map(x => x.species));
    let fresh = 0;
    for (const sp of seen) {
      if (!(SEA_IDS as string[]).includes(sp)) continue;
      if (game.save.flags['v4:photo:' + sp]) continue;
      game.save.flags['v4:photo:' + sp] = true;
      game.save.vars['v4:photoSpecies'] = (game.save.vars['v4:photoSpecies'] ?? 0) + 1;
      fresh++;
    }
    if (fresh) { audio.play('discover', { vol: 0.5 }); game.persist(); s.hud?.refresh(true); }
  };
}

/** debug: the live critters (for tests and the console) */
export function seaCritters(s: ShipScene4) {
  return s.animals.filter(a => (SEA_IDS as string[]).includes(a.species));
}

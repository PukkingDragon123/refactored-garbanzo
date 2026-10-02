// V10 sea life around the Kitten: the open-ocean animals from the Kittiwake's deck (V9, art in
// src/art/v9/sea, field guide in ../v9/species-sea.ts) re-staged around a small boat: the Fluting
// Vanebill looping round the mast, Sackjaw Gulls hanging over the transom and stealing bait, a flock
// of Scythewing Petrels skimming the swell, a pod of Moonfin Porpoises riding the bow wave, Whiptail
// Kitefish bursting out of the sea, and the Reefback with its crown lice and pennant leeches rising
// out of the deep. The trip scene cues them (cue('reefback') brings it up close off the bow).
//
// Every critter speaks the camera's subject interface (photoInfo, body.bounds / points, p, z), so
// photos record the species and the behaviour on show; the research pipeline is the island's.

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor, REF_Y } from '../../gfx/renderer';
import type { Drawable, Layer, Stage } from '../../world/stage';
import type { Ocean, Weather } from '../../world/ocean';
import type { Animal } from '../wild/animal';
import type { Sound } from '../wild/world';
import { local } from '../assets';
import { game } from '../game';
import { clamp, damp, rand } from '../../core/math';
import { renderAny, BEAST_ANIMS } from '../../art/beasts';
import { VANEBILL_BANK, SCYTHE_BANK, MOONFIN_LEAP, MOONFIN_GLOW, reefbackSpots, REEFBACK_K } from '../../art/v9/sea';

export type SeaId = 'vanebill' | 'sackjaw' | 'scythewing' | 'moonfin' | 'kitefish' | 'reefback' | 'crownlouse' | 'pennantleech';
export const SEA_IDS: SeaId[] = ['vanebill', 'sackjaw', 'scythewing', 'moonfin', 'kitefish', 'reefback', 'crownlouse', 'pennantleech'];

/** what the critters need from the scene */
export interface LifeHost {
  st: Stage;
  time: number;
  sounds: Sound[];
  animals: Animal[];
  ocean: Ocean;
  weather: Weather;
  seaY(x: number): number;
  sfx(name: string, x: number, vol?: number, pitch?: number): void;
  /** the player's eye in world space, and how fast they move */
  eye(): { x: number; y: number; vx: number };
  /** the boat: stern (transom) and bow x on the water, gunwale y, perch points (world) */
  boat(): { stern: number; bow: number; gunwale: number; perches: [number, number][] };
  /** the fishing float, if a line is out */
  bobber: { x: number; y: number } | null;
  /** under way (the bow wave is up) */
  moving(): boolean;
}

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
  const pts: V2[] = [];
  const step = Math.max(2, Math.floor(Math.min(b.w, b.h) / 5));
  for (let y = 1; y < b.h; y += step) for (let x = 1; x < b.w; x += step) if (b.data[y * b.w + x] >>> 24 > 128) pts.push([x - o.ax, y - o.ay]);
  if (!pts.length) pts.push([0, 0]);
  let glow: Frame | null = null;
  if (art === 'moonfin') {
    const g = b.clone();
    let any = false;
    for (let j = 0; j < g.data.length; j++) { if (GLOW.has(g.data[j])) any = true; else g.data[j] = 0; }
    if (any) glow = local.add('v10seaG:' + key, g, o.ax, o.ay);
  }
  c = { fr: local.add('v10sea:' + key, b, o.ax, o.ay), glow, w: b.w, h: b.h, ax: o.ax, ay: o.ay, head: [o.head[0] - o.ax, o.head[1] - o.ay], pts };
  cache.set(key, c);
  return c;
}
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
  z = 50; x = 0; y = 0; vx = 0; vy = 0;
  p = 1; py = 1; facing = 1;
  dead = false; gone = false; hidden = 0; noticed = false;
  act = 'idle'; juvenile = false; scale = 1; speed = 0;
  eco = { attacksPlayer: 0, aggro: 0 };
  behavior = ''; anim = 'idle'; fi = 0; t = rand.next() * 10;
  back = false; rot = 0;
  protected at = 0;
  body: { bounds: (a: Critter) => Box; points: (a: Critter) => V2[]; head: (a: Critter) => V2 };
  constructor(readonly species: SeaId, readonly s: LifeHost) {
    this.body = {
      bounds: a => (a.hidden >= 0.99 ? OFF.box : a.box()),
      points: a => (a.hidden >= 0.99 ? OFF.pts : a.pts()),
      head: a => a.headPt(),
    };
  }
  get art(): string { return this.species; }
  frame(): SeaFrame { return frameOf(this.art, this.anim, this.fi); }
  protected dyCam() { return this.p === this.py ? 0 : (game.r.view.y - REF_Y) * (this.py - this.p); }
  box(): Box {
    const f = this.frame(), s = this.scale, dy = this.dyCam();
    const l = -f.ax * s, r = (f.w - f.ax) * s;
    return { x0: this.facing > 0 ? this.x + l : this.x - r, x1: this.facing > 0 ? this.x + r : this.x - l, y0: this.y - f.ay * s - dy, y1: this.y + (f.h - f.ay) * s - dy };
  }
  pts(): V2[] { const f = this.frame(), s = this.scale, dy = this.dyCam(); return f.pts.map(([x, y]) => [this.x + x * this.facing * s, this.y + y * s - dy] as V2); }
  headPt(): V2 { const f = this.frame(); return [this.x + f.head[0] * this.facing, this.y + f.head[1]]; }
  photoInfo() {
    if (this.hidden >= 0.99) return { ...OFF, species: this.species, behavior: null, speed: 0, facing: 0, noticed: false, juvenile: false, p: this.p, hidden: 1 };
    return { species: this.species, behavior: this.behavior || null, box: this.body.bounds(this), pts: this.body.points(this), speed: this.speed, facing: 1, noticed: this.noticed, juvenile: false, p: this.p, hidden: this.hidden };
  }
  setAnim(a: string) { if (this.anim !== a) { this.anim = a; this.fi = 0; this.at = 0; } }
  protected play(dt: number, fpsK = 1): boolean {
    const info = BEAST_ANIMS[this.art as keyof typeof BEAST_ANIMS]?.[this.anim];
    if (!info) return true;
    this.at += dt * info.fps * fpsK;
    if (info.loop) { this.fi = Math.floor(this.at) % info.frames; return false; }
    this.fi = Math.min(info.frames - 1, Math.floor(this.at));
    return this.at >= info.frames;
  }
  sea(x = this.x) { return this.s.seaY(x); }
  sfx(name: string, vol: number, pitch = 1) {
    const xe = this.p >= 1 ? this.x : this.x + this.s.st.cam.x * (1 - this.p);
    this.s.sfx(name, xe, vol * (this.p >= 1 ? 1 : 0.55 + this.p * 0.5), pitch);
  }
  heard(kind: string, radius: number) {
    const now = this.s.time;
    return this.s.sounds.some(q => q.kind === kind && now - q.t < 0.25 && Math.hypot(q.x - this.x, q.y - this.y) < radius);
  }
  abstract update(dt: number): void;
  draw(r: Renderer) { this.pass(r, 'front'); }
  pass(r: Renderer, which: Pass) {
    if (which !== (this.back ? 'back' : 'front') || this.hidden >= 0.99) return;
    r.draw(this.frame().fr, this.x, this.y, this.facing * this.scale, this.scale, this.rot);
  }
}
const OFF = { box: { x0: -1e5, y0: -1e5, x1: -1e5 + 1, y1: -1e5 + 1 }, pts: [[-1e5, -1e5]] as V2[] };
class Proxy implements Drawable {
  constructor(readonly c: Critter, readonly which: Pass, public z: number) {}
  get dead() { return this.c.dead; }
  draw(r: Renderer) { this.c.pass(r, this.which); }
}

// ------------------------------------------------------------------ Fluting Vanebill
const KITES: Kitefish[] = [];
class Vanebill extends Critter {
  mode: 'soar' | 'snatch' | 'land' | 'sit' | 'display' | 'takeoff' | 'swoop' = 'soar';
  ph = rand.range(0, Math.PI * 2);
  w = (Math.PI * 2) / 30;
  A = 300; ymid = 86; H = 80;
  mt = 0;
  landT = rand.range(60, 100);
  fluteT = rand.range(8, 16);
  prey: Kitefish | null = null;
  bank = 0;
  constructor(s: LifeHost) {
    super('vanebill', s);
    this.anim = 'bank';
    const [tx, ty] = this.path();
    this.x = tx; this.y = ty;
  }
  private cx() { const b = this.s.boat(); return (b.stern + b.bow) / 2; }
  private path(): [number, number, number] {
    const ph = this.ph;
    return [this.cx() + this.A * Math.cos(ph), this.ymid - this.H * Math.cos(ph) + Math.sin(ph * 3 + 1) * 10, -Math.sin(ph)];
  }
  /** swing in low past the boat (a cue) */
  swoop() { if (this.mode === 'soar') { this.mode = 'swoop'; this.mt = 0; } }
  update(dt: number) {
    this.t += dt; this.mt += dt;
    const s = this.s, pl = s.eye();
    switch (this.mode) {
      case 'soar': case 'snatch': case 'swoop': {
        if (this.mode !== 'snatch') this.ph += this.w * dt * (0.85 + 0.3 * Math.abs(Math.sin(this.ph)));
        let [tx, ty, d] = this.path();
        if (this.mode === 'swoop') {
          // down along the wave tops, right past the boat
          const b = s.boat();
          tx = b.bow + 260 - this.mt * 120; ty = this.sea(tx) - 12 - Math.sin(Math.min(1, this.mt / 4) * Math.PI) * 6; d = 1;
          this.behavior = 'soaring';
          if (this.mt > 5.5) { this.mode = 'soar'; this.resync(); }
        }
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
        const k = this.mode === 'snatch' ? 3.4 : this.mode === 'swoop' ? 2.4 : 1.6;
        this.vx += ((tx - this.x) * k - this.vx * 1.8) * dt;
        this.vy += ((ty - this.y) * k - this.vy * 1.8) * dt;
        this.x += this.vx * dt; this.y += this.vy * dt;
        if (Math.abs(this.vx) > 6) this.facing = Math.sign(this.vx);
        this.back = d < -0.15;
        this.z = this.back ? -12 : 40;
        const base = clamp((this.y - pl.y) / 120, -1, 1) * 0.72;
        const turn = 0.42 * Math.cos(this.ph) ** 2 * (base >= 0 ? 1 : -1);
        this.bank = damp(this.bank, clamp(base + turn, -1.05, 1.05), 3, dt);
        if (this.anim === 'snatch') { if (this.play(dt)) this.setAnim('bank'); }
        else if (this.anim === 'flute') { if (this.mt > 1.6) this.setAnim('bank'); else this.play(dt); }
        else this.setAnim('bank');
        if (this.anim === 'bank') this.fi = Math.round((this.bank + 1.05) / 2.1 * (VANEBILL_BANK - 1));
        if (this.anim !== 'snatch' && this.anim !== 'flute') this.behavior = 'soaring';
        this.fluteT -= dt;
        if (this.mode === 'soar' && this.fluteT <= 0 && this.vx > 20 && this.y < 90) {
          this.fluteT = rand.range(9, 18);
          this.setAnim('flute'); this.mt = 0; this.behavior = 'fluting';
          this.sfx('callHoot', 0.4, rand.range(2.6, 3.3));
        }
        if (this.mode === 'soar' && this.y > 110) {
          for (const q of KITES) if ((q.mode === 'glide' || q.mode === 'skip') && Math.abs(q.x - this.x) < 140 && Math.sign(q.x - this.x) === this.facing) { this.prey = q; this.mode = 'snatch'; this.mt = 0; break; }
        }
        this.landT -= dt;
        const b = s.boat();
        if (this.mode === 'soar' && this.landT <= 0 && !this.back && this.y > 130 && this.x > b.bow + 40 && this.x < b.bow + 320) { this.mode = 'land'; this.mt = 0; this.setAnim('land'); }
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
        if (this.y > sea - 6 || this.mt > 3) { this.mode = 'sit'; this.mt = 0; this.setAnim('sit'); this.sfx('splash', 0.35, 0.8); s.ocean.splash(this.x, 0.18); }
        break;
      }
      case 'sit': case 'display': {
        this.x -= s.weather.cruise * dt;
        this.y = this.sea() + 1;
        this.vx = -s.weather.cruise; this.vy = 0;
        this.play(dt);
        this.behavior = this.mode === 'display' ? 'skypointing' : 'resting';
        if (this.mode === 'sit' && this.mt > 8 && this.anim === 'sit' && rand.next() < dt * 0.3) { this.mode = 'display'; this.mt = 0; this.setAnim('display'); this.sfx('callHoot', 0.45, rand.range(2.2, 2.7)); }
        if (this.mode === 'display' && this.mt > 3.2) { this.mode = 'sit'; this.mt = -6; this.setAnim('sit'); }
        const near = Math.abs(pl.x - this.x) < 50 && Math.abs(pl.vx) > 20;
        if (near) this.noticed = true;
        if (near || this.heard('shutter', 90) || this.mt > 22 || this.x < s.boat().stern - 260) { this.mode = 'takeoff'; this.mt = 0; this.setAnim('takeoff'); this.facing = 1; this.sfx('wingFlap', 0.5, 0.6); }
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
        if (this.mt < 1.6 && rand.next() < dt * 8) s.ocean.spray(this.x - 2, this.sea(), 0.02, -20, -1);
        if (Math.floor(this.mt * 1.4) !== Math.floor((this.mt - dt) * 1.4)) this.sfx('wingFlap', 0.35, 0.55);
        if (this.mt > 2.8) { this.mode = 'soar'; this.mt = 0; this.landT = rand.range(80, 140); this.noticed = false; this.resync(); }
        this.speed = Math.abs(this.vx);
        break;
      }
    }
  }
  private resync() {
    let best = this.ph, bd = Infinity;
    for (let i = 0; i < 64; i++) {
      const ph = (i / 64) * Math.PI * 2;
      const x = this.cx() + this.A * Math.cos(ph), y = this.ymid - this.H * Math.cos(ph);
      const d = Math.hypot(x - this.x, y - this.y) + (Math.sign(-Math.sin(ph) * this.A) !== Math.sign(this.vx || 1) ? 200 : 0);
      if (d < bd) { bd = d; best = ph; }
    }
    this.ph = best;
  }
}

// ------------------------------------------------------------------ Sackjaw Gulls
const GULLS: Sackjaw[] = [];
class Sackjaw extends Critter {
  mode: 'hover' | 'beg' | 'perch' | 'display' | 'swim' | 'steal' | 'carry' | 'flee' | 'fly' | 'away' = 'away';
  hx = 0; hy = 0;
  mt = 0;
  next = rand.range(4, 9);
  perch: number | null = null;
  stealCd = rand.range(10, 20);
  callT = rand.range(2, 6);
  goal: V2 = [0, 0];
  constructor(s: LifeHost) {
    super('sackjaw', s);
    this.anim = 'hover';
    this.hidden = 1;
    this.x = -400; this.y = 60;
    GULLS.push(this);
  }
  private go(m: Sackjaw['mode']) { this.mode = m; this.mt = 0; }
  /** fly in from astern (a cue) */
  arrive() {
    if (this.mode !== 'away') return;
    const b = this.s.boat();
    this.x = b.stern - rand.range(220, 320); this.y = rand.range(70, 120);
    this.hidden = 0;
    this.newHover();
    this.go('hover');
  }
  private newHover() { const b = this.s.boat(); this.hx = b.stern - rand.range(10, 120); this.hy = rand.range(96, 150); }
  update(dt: number) {
    this.t += dt; this.mt += dt;
    if (this.mode === 'away') { this.hidden = 1; return; }
    const s = this.s, pl = s.eye(), b = s.boat();
    const fishing = !!s.bobber;
    this.stealCd -= dt;
    if (this.mode !== 'flee' && this.mode !== 'carry') {
      const dist = Math.hypot(pl.x - this.x, pl.y - this.y);
      if ((dist < 22 && (this.mode === 'perch' || this.mode === 'display')) || (dist < 60 && this.heard('shutter', 60))) {
        this.perch = null; this.go('flee'); this.noticed = true;
        this.goal = [this.x + (this.x > pl.x ? 1 : -1) * 120, this.y - 60];
        this.sfx('wingFlap', 0.4, 1.4); this.sfx('callScreech', 0.3, rand.range(1.4, 1.7));
      }
    }
    let fly = true, tx = this.x, ty = this.y, k = 1.6;
    switch (this.mode) {
      case 'hover':
        tx = this.hx + Math.sin(this.t * 0.37) * 18; ty = this.hy + Math.sin(this.t * 0.9) * 6;
        this.behavior = 'hovering';
        if (this.mt > this.next) this.decide(fishing);
        break;
      case 'beg':
        tx = pl.x + (this.hx > pl.x ? 26 : -22) + Math.sin(this.t * 1.3) * 8;
        ty = pl.y - 22 + Math.sin(this.t * 2.1) * 4;
        this.behavior = 'begging'; this.noticed = true;
        this.callT -= dt;
        if (this.callT <= 0) { this.callT = rand.range(1.6, 3.5); this.sfx('callScreech', 0.32, rand.range(1.3, 1.6)); }
        if (s.bobber && this.stealCd <= 0 && !GULLS.some(g => g.mode === 'steal' || g.mode === 'carry')) { this.stealCd = rand.range(25, 45); this.go('steal'); break; }
        if (this.mt > 12) { this.noticed = false; this.go('hover'); this.next = rand.range(4, 8); this.newHover(); }
        break;
      case 'steal': {
        const bob = s.bobber;
        if (!bob) { this.go('hover'); break; }
        tx = bob.x; ty = bob.y - 5; k = 3.2;
        this.behavior = 'stealing';
        if (Math.hypot(bob.x - this.x, bob.y - 5 - this.y) < 7 || this.mt > 5) {
          this.go('carry'); this.goal = [bob.x - 160, 60];
          s.ocean.splash(bob.x, 0.08);
          this.sfx('splash', 0.25, 1.6); this.sfx('callScreech', 0.3, 1.5);
        }
        break;
      }
      case 'carry': case 'flee': case 'fly':
        [tx, ty] = this.goal; k = 1.4;
        this.behavior = this.mode === 'carry' ? 'stealing' : 'flying';
        if (Math.hypot(tx - this.x, ty - this.y) < 12 || this.mt > 7) {
          if (this.mode === 'fly' && this.perch !== null) { this.go('perch'); this.setAnim('idle'); this.sfx('wingFlap', 0.3, 1.5); }
          else { this.go('hover'); this.noticed = false; this.next = rand.range(3, 7); this.newHover(); }
        }
        break;
      case 'perch': case 'display': {
        fly = false;
        const pp = b.perches[this.perch ?? 0];
        if (!pp) { this.go('hover'); break; }
        this.x = pp[0]; this.y = pp[1]; this.vx = this.vy = 0;
        this.behavior = this.mode === 'display' ? 'displaying' : 'perched';
        const rival = GULLS.find(g => g !== this && (g.mode === 'perch' || g.mode === 'display') && Math.abs(g.x - this.x) < 24);
        if (this.mode === 'perch' && rival && this.mt > 1.2) { this.go('display'); this.setAnim('display'); this.facing = rival.x > this.x ? 1 : -1; this.sfx('callHonk', 0.35, rand.range(1.2, 1.5)); }
        if (this.mode === 'display' && this.mt > 2.6) {
          if (rival && rival.mode === 'display' && this.t % 2 > 1) { this.perch = null; this.go('flee'); this.goal = [this.x - 100, this.y - 40]; }
          else { this.go('perch'); this.setAnim('idle'); }
        }
        if (this.mode === 'perch') {
          if (this.anim === 'call') { if (this.play(dt) || this.mt > 1.4) this.setAnim('idle'); }
          else { this.play(dt); if (rand.next() < dt * 0.15) { this.setAnim('call'); this.sfx('callScreech', 0.25, rand.range(1.2, 1.5)); } }
          if (this.mt > 12 && rand.next() < dt * 0.2) { this.perch = null; this.go('hover'); this.newHover(); this.sfx('wingFlap', 0.3, 1.5); }
          if (fishing && rand.next() < dt * 0.2) { this.perch = null; this.go('beg'); }
        } else this.play(dt);
        break;
      }
      case 'swim':
        fly = false;
        this.x -= s.weather.cruise * dt;
        this.y = this.sea() + 0.5;
        this.vx = -s.weather.cruise; this.vy = 0;
        this.behavior = 'swimming';
        this.setAnim('swim'); this.play(dt);
        if (this.mt > 12 || this.x < b.stern - 300 || this.heard('shutter', 80)) { this.go('fly'); this.perch = null; this.newHover(); this.goal = [this.hx, this.hy]; this.sfx('wingFlap', 0.3, 1.4); }
        break;
    }
    if (fly) {
      this.vx += ((tx - this.x) * k - this.vx * 2.2) * dt;
      this.vy += ((ty - this.y) * k - this.vy * 2.2) * dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      const sp = Math.hypot(this.vx, this.vy);
      if (Math.abs(this.vx) > 8) this.facing = Math.sign(this.vx);
      else if (this.mode === 'beg' || this.mode === 'hover') this.facing = pl.x > this.x ? 1 : -1;
      const want = this.mode === 'carry' ? 'carry' : this.mode === 'steal' ? (Math.hypot(tx - this.x, ty - this.y) < 30 ? 'grab' : 'swoop') : this.mode === 'beg' ? 'beg' : sp > 45 ? 'fly' : sp > 22 ? 'glide' : 'hover';
      this.setAnim(want);
      this.play(dt, want === 'fly' ? 0.8 + sp / 160 : 1);
      this.back = false;
    }
    this.z = 46 + (this.y % 3);
    this.speed = Math.hypot(this.vx, this.vy);
  }
  private decide(fishing: boolean) {
    this.next = rand.range(4, 9);
    if (fishing && rand.next() < 0.6) { this.go('beg'); return; }
    if (this.s.bobber && this.stealCd <= 0) { this.stealCd = rand.range(25, 45); this.go('steal'); return; }
    const r = rand.next();
    const P = this.s.boat().perches;
    if (r < 0.4 && P.length) {
      const free = P.map((_, i) => i).filter(i => !GULLS.some(g => g.perch === i));
      if (free.length) { this.perch = rand.pick(free); this.goal = [...P[this.perch]] as V2; this.go('fly'); return; }
    }
    if (r < 0.58) { this.go('swim'); this.y = this.sea(); this.s.ocean.splash(this.x, 0.08); return; }
    this.newHover();
  }
}

// ------------------------------------------------------------------ Scythewing Petrels
class Flock {
  cx = -400; dir = 1;
  mode: 'away' | 'skim' | 'wheel' | 'patter' | 'raft' | 'flush' = 'away';
  mt = 0; side: 'front' | 'back' = 'front';
  next = rand.range(14, 24);
  members: Scythewing[] = [];
  passes = 0;
  constructor(readonly s: LifeHost) {}
  /** sweep in past the boat (a cue) */
  come() { if (this.mode !== 'away') return; const b = this.s.boat(); this.cx = b.stern - 520; this.dir = 1; this.mode = 'skim'; this.mt = 0; this.passes = 0; this.side = 'front'; }
  update(dt: number) {
    this.mt += dt;
    if (this.mode === 'away') return;
    const cr = this.s.weather.cruise, b = this.s.boat();
    const lo = b.stern - 480, hi = b.bow + 420;
    if (this.mode === 'skim') {
      this.cx += this.dir * 72 * dt;
      this.next -= dt;
      if ((this.dir > 0 && this.cx > hi) || (this.dir < 0 && this.cx < lo)) { this.passes++; if (this.passes >= 4) { this.mode = 'away'; this.cx = -2000; } else { this.mode = 'wheel'; this.mt = 0; } }
      else if (this.next <= 0 && this.cx > lo + 100 && this.cx < hi - 100) { this.next = rand.range(16, 28); this.mode = rand.next() < 0.72 ? 'patter' : 'raft'; this.mt = 0; }
    } else if (this.mode === 'wheel') {
      this.cx += this.dir * 72 * dt * Math.cos(this.mt * 2.4);
      if (this.mt > 1.3) { this.dir = -this.dir; this.mode = 'skim'; this.mt = 0; if (rand.next() < 0.45) this.side = this.side === 'front' ? 'back' : 'front'; }
    } else if (this.mode === 'patter') { this.cx -= cr * 0.2 * dt; if (this.mt > 5) { this.mode = 'skim'; this.mt = 0; } }
    else if (this.mode === 'raft') { this.cx -= cr * dt; if (this.mt > 10) { this.mode = 'flush'; this.mt = 0; this.s.sfx('wingFlap', this.cx, 0.3, 2.2); } }
    else if (this.mode === 'flush') { this.cx += this.dir * 90 * dt; if (this.mt > 1.2) { this.mode = 'skim'; this.mt = 0; } }
    if (rand.next() < dt * 0.4) this.s.sfx('callChirp', this.cx, 0.12, rand.range(1.7, 2.1));
  }
}
class Scythewing extends Critter {
  off: V2; h: number; lag = rand.range(0, 0.5); sprayT = rand.range(1, 4);
  constructor(s: LifeHost, readonly F: Flock, i: number) {
    super('scythewing', s);
    this.off = [i * 21 - 95 + rand.range(-9, 9), 0];
    this.h = 4 + Math.abs(i - 4.5) * 1.6 + rand.range(0, 6);
    this.x = F.cx + this.off[0]; this.y = 200 - this.h;
    this.anim = 'skim';
    this.hidden = 1;
    F.members.push(this);
  }
  update(dt: number) {
    this.t += dt;
    const F = this.F;
    if (F.members[0] === this) F.update(dt);
    if (F.mode === 'away') { this.hidden = 1; this.x = F.cx + this.off[0]; return; }
    this.hidden = 0;
    const sea = this.sea();
    let tx = F.cx + this.off[0] * F.dir, ty = sea - this.h + Math.sin(this.t * 2.3) * 1.5;
    if (F.mode === 'patter') ty = sea - 4;
    if (F.mode === 'raft') ty = sea;
    let sx = 0;
    for (const o of F.members) if (o !== this && Math.abs(o.x - this.x) < 7 && Math.abs(o.y - this.y) < 5) sx += Math.sign(this.x - o.x || 1) * 18;
    const k = F.mode === 'raft' ? 2 : 3;
    this.vx += ((tx - this.x) * k + sx - this.vx * 2.4) * dt;
    this.x += this.vx * dt;
    this.y = damp(this.y, ty, F.mode === 'raft' ? 6 : 9, dt);
    this.vy = 0;
    if (Math.abs(this.vx) > 10) this.facing = Math.sign(this.vx);
    this.back = F.side === 'back';
    this.z = this.back ? -14 : 44;
    this.speed = Math.abs(this.vx);
    if (F.mode === 'wheel' || F.mode === 'flush') {
      const u = clamp((F.mt - this.lag * 0.4) / 1.0);
      this.setAnim(F.mode === 'flush' ? 'flap' : 'bank');
      if (this.anim === 'bank') this.fi = Math.round(Math.sin(u * Math.PI) * (SCYTHE_BANK - 1)); else this.play(dt);
      this.behavior = 'wheeling';
    } else if (F.mode === 'patter') {
      this.setAnim('patter'); this.play(dt); this.behavior = 'pattering';
      if (rand.next() < dt * 1.5) this.s.ocean.spray(this.x, sea, 0, 0, -1);
    } else if (F.mode === 'raft') { this.setAnim('raft'); this.play(dt); this.behavior = 'rafting'; this.speed = 18; }
    else {
      this.setAnim(Math.sin(this.t * 0.7 + this.lag * 9) > 0.85 ? 'flap' : 'skim'); this.play(dt);
      this.behavior = 'skimming';
      this.sprayT -= dt;
      if (this.sprayT <= 0 && !this.back) { this.sprayT = rand.range(2, 5); this.s.ocean.spray(this.x - this.facing * 5, sea, 0, -this.facing * 40, -0.6); }
    }
  }
}

// ------------------------------------------------------------------ Moonfin Porpoises
class Moonfin extends Critter {
  mode: 'away' | 'bowride' | 'under' | 'leap' | 'breach' | 'slap' | 'leave' = 'away';
  mt = 0; next = rand.range(2, 6);
  jump = { vx: 0, vy: 0 };
  stay = 0;
  constructor(s: LifeHost, readonly slot: number) {
    super('moonfin', s);
    this.anim = 'bowride';
    this.z = 30 + slot;
    this.hidden = 1;
    this.x = -500;
  }
  private go(m: Moonfin['mode']) { this.mode = m; this.mt = 0; }
  /** join the bow wave (a cue): they come in from ahead and stay a while */
  come(stay = 40) { if (this.mode !== 'away') return; const b = this.s.boat(); this.x = b.bow + 160 + this.slot * 30; this.y = this.sea() + 16; this.stay = stay; this.go('under'); }
  update(dt: number) {
    this.t += dt; this.mt += dt;
    if (this.mode === 'away') { this.hidden = 1; return; }
    const s = this.s, b = s.boat();
    this.stay -= dt;
    if (this.stay <= 0 && this.mode !== 'leave' && this.mode !== 'leap' && this.mode !== 'breach') this.go('leave');
    const sea = this.sea();
    const moving = s.moving();
    const pl = s.eye();
    this.noticed = pl.x > b.bow - 30;
    switch (this.mode) {
      case 'bowride': case 'under': {
        const base = moving ? b.bow + 14 + this.slot * 14 : b.bow - 40 + this.slot * 50;
        const tx = base + Math.sin(this.t * 0.6 + this.slot * 2) * (moving ? 7 : 50);
        this.vx = damp(this.vx, (tx - this.x) * 1.5, 2, dt);
        this.x += this.vx * dt;
        const depth = this.mode === 'under' ? 16 : 5.5 + Math.sin(this.t * 1.7 + this.slot) * 1.2;
        this.y = damp(this.y, sea + depth, 3, dt);
        this.vy = 0;
        this.facing = moving ? 1 : this.vx >= 0 ? 1 : -1;
        this.setAnim(this.mode === 'under' || !moving ? 'swim' : 'bowride'); this.play(dt);
        this.hidden = this.mode === 'under' ? 1 : 0.35;
        this.behavior = this.mode === 'under' ? 'swimming' : moving ? 'bowriding' : 'swimming';
        this.speed = moving ? s.weather.cruise : Math.abs(this.vx);
        this.next -= dt;
        if (this.next <= 0) {
          this.next = rand.range(3, 7);
          const r = rand.next();
          if (r < 0.14) this.startJump(true);
          else if (r < 0.24 && this.mode !== 'under') { this.go('slap'); this.setAnim('tailslap'); }
          else if (r < 0.4) this.go(this.mode === 'under' ? 'bowride' : 'under');
          else this.startJump(false);
        }
        break;
      }
      case 'leap': case 'breach': {
        const J = this.jump;
        J.vy += 330 * dt;
        this.x += J.vx * dt; this.y += J.vy * dt;
        this.vx = J.vx; this.vy = J.vy;
        this.hidden = 0;
        if (this.mode === 'leap') {
          const pitch = Math.atan2(-J.vy, Math.abs(J.vx) + 30);
          this.fi = clamp(Math.round((0.95 - pitch) / 1.9 * (MOONFIN_LEAP - 1)), 0, MOONFIN_LEAP - 1);
          this.behavior = 'porpoising';
        } else { this.play(dt, 0.75); this.behavior = 'breaching'; }
        if (J.vy > 0 && this.y > sea + 4) {
          s.ocean.splash(this.x, this.mode === 'breach' ? 0.7 : 0.22);
          this.sfx(this.mode === 'breach' ? 'splashBig' : 'splash', this.mode === 'breach' ? 0.5 : 0.25, this.mode === 'breach' ? 0.9 : 1.3);
          if (this.mode === 'breach') s.sounds.push({ x: this.x, y: sea, kind: 'splash', src: null, species: null, radius: 220, t: s.time + 0.0001 });
          this.y = sea + 8;
          this.go(this.stay <= 0 ? 'leave' : 'bowride');
        }
        this.speed = Math.hypot(J.vx, J.vy);
        break;
      }
      case 'slap':
        this.y = damp(this.y, sea + 3, 4, dt);
        this.behavior = 'tailslapping';
        this.hidden = 0.2;
        if (this.play(dt)) this.go('bowride');
        if (this.fi === 3 && this.at < 3.2) { s.ocean.splash(this.x - this.facing * 16, 0.3); this.sfx('splash', 0.3, 1.1); this.at = 3.2; }
        break;
      case 'leave':
        this.y = damp(this.y, sea + 30, 1.5, dt);
        this.x += 60 * dt;
        this.hidden = 1;
        this.setAnim('swim'); this.play(dt);
        if (this.mt > 4) { this.go('away'); this.x = -500; }
        break;
    }
    this.back = false;
  }
  private startJump(big: boolean) {
    const s = this.s;
    this.go(big ? 'breach' : 'leap');
    this.setAnim(big ? 'breach' : 'leap');
    const moving = s.moving();
    this.jump = { vx: (moving ? 34 : this.facing * 50) + rand.range(-6, 8), vy: big ? -175 : -rand.range(100, 135) };
    this.y = this.sea() + 2;
    s.ocean.splash(this.x, big ? 0.35 : 0.12);
    this.sfx('callClick', 0.22, rand.range(1.1, 1.4));
    s.ocean.spray(this.x + 6, this.sea() - 2, 0, 0, -1);
  }
  pass(r: Renderer, which: Pass) {
    if (which === 'under') {
      if (this.hidden <= 0.05 || this.mode === 'away') return;
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
  pts(): V2[] { const sea = this.sea(); const all = super.pts(); const up = all.filter(q => q[1] < sea + 1); return up.length ? up : all.slice(0, 1); }
  box(): Box { const b = super.box(); return { ...b, y1: Math.min(b.y1, this.sea() + 2) }; }
}

// ------------------------------------------------------------------ Whiptail Kitefish
class Kitefish extends Critter {
  mode: 'hidden' | 'launch' | 'glide' | 'skip' | 'dive' = 'hidden';
  mt = 0; cd = rand.range(6, 18); skips = 0; h = 10; glideT = 1;
  constructor(s: LifeHost) {
    super('kitefish', s);
    this.hidden = 1;
    this.anim = 'glide';
    KITES.push(this);
  }
  private go(m: Kitefish['mode']) { this.mode = m; this.mt = 0; }
  caught() { this.go('hidden'); this.hidden = 1; this.cd = rand.range(15, 30); }
  /** burst out of the bow wave now (a cue) */
  burst() { if (this.mode === 'hidden') this.cd = rand.range(0.05, 0.8); }
  update(dt: number) {
    this.t += dt; this.mt += dt;
    const s = this.s, b = s.boat();
    switch (this.mode) {
      case 'hidden':
        this.hidden = 1;
        this.cd -= dt;
        if (this.cd <= 0) {
          const r = rand.next();
          this.x = r < 0.65 ? b.bow + rand.range(20, 140) : r < 0.88 ? b.stern - rand.range(40, 240) : b.bow + rand.range(160, 300);
          this.facing = r < 0.65 ? 1 : rand.pick([-1, 1]);
          this.vx = this.facing * rand.range(105, 150);
          this.y = this.sea() + 4;
          this.skips = rand.pick([0, 1, 1, 2]);
          this.h = rand.range(8, 15);
          this.glideT = rand.range(0.8, 1.8);
          this.go('launch'); this.setAnim('launch');
          s.ocean.splash(this.x, 0.1);
          this.sfx('splash', 0.2, 1.7);
          for (const q of KITES) if (q !== this && q.mode === 'hidden' && q.cd > 0 && rand.next() < 0.5) q.cd = rand.range(0.1, 0.6);
          if (!s.moving()) this.cd = rand.range(10, 20);
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
          if (this.skips > 0) { this.skips--; this.go('skip'); this.setAnim('skip'); s.ocean.spray(this.x - this.facing * 10, this.sea(), 0, -this.facing * 30, -1); this.sfx('splash', 0.12, 2); }
          else { this.go('dive'); this.setAnim('dive'); }
        }
        break;
      case 'skip':
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
        if (this.mt > 0.3) { s.ocean.splash(this.x, 0.08); this.sfx('splash', 0.15, 1.9); this.go('hidden'); this.hidden = 1; this.cd = rand.range(10, 26); }
        break;
    }
    this.speed = Math.abs(this.vx);
    this.vy = 0;
    this.z = 42;
  }
}

// ------------------------------------------------------------------ the Reefback and its parasites
type Band = 'far' | 'mid';
class Reefback extends Critter {
  band: Band = 'far';
  mode: 'deep' | 'rise' | 'bask' | 'roll' | 'fluke' = 'deep';
  mt = 0; deepT = rand.range(30, 50); sink = 40; blowT = 0; spoutT = -1;
  layers: Record<Band, Layer>;
  proxy: Proxy;
  /** set by a cue: come up close off the bow next time */
  close = false;
  onSurface: ((close: boolean) => void) | null = null;
  constructor(s: LifeHost) {
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
  /** surface close to the boat as soon as possible (a cue) */
  rise() { this.close = true; if (this.mode === 'deep') this.deepT = Math.min(this.deepT, 0.5); }
  surface() { return this.s.ocean.bandSurfaceY(this.band, this.x); }
  update(dt: number) {
    this.t += dt; this.mt += dt;
    const k = this.k;
    switch (this.mode) {
      case 'deep': {
        this.hidden = 1;
        this.deepT -= dt;
        if (this.deepT <= 0) {
          const close = this.close;
          this.close = false;
          this.setBand(close ? 'mid' : 'far');
          // in the band's own coordinates: ahead off the bow (mid) or anywhere on the horizon (far)
          const cx = this.s.st.cam.x * this.p;
          const b = this.s.boat();
          this.x = close ? cx + ((b.bow - this.s.st.cam.x) + rand.range(20, 70)) * 0.6 : cx + rand.range(-260, 260);
          this.facing = close ? -1 : rand.pick([-1, 1]);
          this.sink = 34;
          this.go('rise'); this.setAnim('surface');
          this.sfx('splashBig', 0.4, 0.5);
          this.sfx('callWhale', 0.35, rand.range(0.45, 0.6));
          this.onSurface?.(close);
        }
        break;
      }
      case 'rise':
        this.hidden = 0;
        this.sink = damp(this.sink, 0, 1.2, dt);
        this.play(dt);
        this.behavior = 'surfacing';
        if (this.mt > 3.2) { this.go('bask'); this.setAnim('bask'); this.blowT = 0.8; }
        break;
      case 'bask': {
        this.sink = damp(this.sink, 0, 2, dt);
        this.play(dt);
        this.blowT -= dt;
        this.behavior = this.spoutT >= 0 ? 'spouting' : 'basking';
        if (this.blowT <= 0) { this.blowT = rand.range(5, 8); this.spoutT = 0; this.sfx('gust', 0.4, 0.5); if (rand.next() < 0.4) this.sfx('callWhale', 0.3, rand.range(0.4, 0.55)); }
        const stay = this.band === 'mid' ? 26 : 16;
        if (this.band === 'mid' && this.mt > 9 && this.mt < 9 + dt * 1.5 && rand.next() < 0.6) { this.go('roll'); this.setAnim('roll'); }
        else if (this.mt > stay) { this.go('fluke'); this.setAnim('fluke'); }
        // the boat sails on past it: it drifts astern
        this.x -= this.s.weather.cruise * this.p * dt * 0.6;
        break;
      }
      case 'roll':
        this.behavior = 'rolling';
        this.x -= this.s.weather.cruise * this.p * dt * 0.6;
        if (this.play(dt, 0.6) && this.mt > 6) { this.go('bask'); this.mt = 12; this.setAnim('bask'); }
        break;
      case 'fluke': {
        this.behavior = 'fluking';
        const done = this.play(dt);
        if (this.fi >= 4) this.sink = damp(this.sink, 26, 0.7, dt);
        if (this.fi === 6 && this.at < 6.5) { this.sfx('splashBig', 0.45, 0.55); this.at = 6.5; }
        if (done && this.mt > 2.4) { this.go('deep'); this.deepT = rand.range(40, 70); this.hidden = 1; }
        break;
      }
    }
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
  box(): Box { const b = super.box(), surf = this.surface() - this.dyCam(); return { ...b, y1: Math.min(b.y1, surf + 1) }; }
  pts(): V2[] { const surf = this.surface() - this.dyCam(); const up = super.pts().filter(q => q[1] < surf); return up.length ? up : [[this.x, surf]]; }
}
class Rider extends Critter {
  constructor(s: LifeHost, readonly host: Reefback, sp: 'crownlouse' | 'pennantleech') { super(sp, s); this.hidden = 1; }
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
    this.hidden = this.spot() ? h.hidden : 1;
    this.behavior = this.species === 'crownlouse' ? 'swarming' : h.anim === 'fluke' || h.anim === 'roll' ? 'dangling' : 'trailing';
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
function lifeLayer(st: Stage, name: string, anchor: string, after: boolean): Layer {
  if (st.hasLayer(name)) return st.layer(name);
  const l = st.addLayer(name, 1, 0, 1, 0, 1);
  st.layers.splice(st.layers.indexOf(l), 1);
  const j = st.layers.findIndex(x => x.name === anchor);
  st.layers.splice(after ? j + 1 : j, 0, l);
  return l;
}

export interface SeaLife {
  cue(kind: 'pod' | 'kites' | 'reefback' | 'flock' | 'gulls' | 'vanebill'): void;
  reefback: Reefback;
  critters: Critter[];
}

/** spawn the sea life around the Kitten; the scene must have 'main', 'sea-near', 'sea-far' and 'sea-mid' layers */
export function startBoatLife(s: LifeHost): SeaLife {
  GULLS.length = 0; KITES.length = 0;
  const st = s.st;
  const back = lifeLayer(st, 'life-back', 'main', false);
  const front = lifeLayer(st, 'life-front', 'sea-near', false);
  const under = lifeLayer(st, 'life-under', 'sea-near', true);
  const all: Critter[] = [];
  const add = (c: Critter) => {
    front.add(c);
    back.add(new Proxy(c, 'back', c.z));
    if (c instanceof Moonfin) under.add(new Proxy(c, 'under', c.z));
    s.animals.push(c as unknown as Animal);
    all.push(c);
    return c;
  };
  const vane = add(new Vanebill(s)) as Vanebill;
  const gulls = [0, 1, 2].map(() => add(new Sackjaw(s)) as Sackjaw);
  const flock = new Flock(s);
  for (let i = 0; i < 10; i++) add(new Scythewing(s, flock, i));
  const pod = [0, 1, 2].map(i => add(new Moonfin(s, i)) as Moonfin);
  const kites = [0, 1, 2, 3, 4].map(() => add(new Kitefish(s)) as Kitefish);
  const whale = new Reefback(s);
  s.animals.push(whale as unknown as Animal);
  for (const sp of ['crownlouse', 'pennantleech'] as const) {
    const r = new Rider(s, whale, sp);
    st.layer('sea-mid').add(r);
    s.animals.push(r as unknown as Animal);
  }
  warmQueue.length = 0;
  for (const id of ['vanebill', 'moonfin', 'kitefish', 'sackjaw', 'scythewing', 'reefback-far', 'reefback']) for (const a of Object.keys(BEAST_ANIMS[id as keyof typeof BEAST_ANIMS] ?? {})) if (a !== 'idle') warmQueue.push([id, a]);
  st.layer('sea-horizon').add({ z: -1e9, draw() {}, update: () => warmStep(4), get dead() { return !warmQueue.length; } } as Drawable);
  return {
    reefback: whale,
    critters: all,
    cue(kind) {
      if (kind === 'pod') for (const m of pod) m.come(45);
      else if (kind === 'kites') for (const k of kites) k.burst();
      else if (kind === 'reefback') whale.rise();
      else if (kind === 'flock') flock.come();
      else if (kind === 'gulls') for (const g of gulls) g.arrive();
      else if (kind === 'vanebill') vane.swoop();
    },
  };
}

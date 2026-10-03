// V11 predators: projectiles and effects. Slingshot pebbles (Mori's and Aroha's), Aroha's improvised
// grenades (kawakawa smoke balls, horopito pepper bombs, firestone crackers and the pepper-smoke
// "combo" she opened the forest's account with) and the clouds, flashes, sparks and mud they leave.
// One instance per scene, drawn on the gameplay layer in front of everyone (see predators-scene.ts).

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Drawable } from '../../world/stage';
import type { FieldScene } from '../scenes/field';
import type { Animal } from '../wild/animal';
import { PixelBuffer } from '../../art/pixel';
import { hex } from '../../art/color';
import { local, A } from '../assets';
import { rand, clamp } from '../../core/math';
import { deter, deterArea, isPredator, shootTargets, emitPred, predState } from './predators-core';
import { sfx11 } from './predators-sfx';

// ------------------------------------------------------------------ sprites (scene-local atlas)
export interface Fr11 {
  pebble: Frame; pebbleS: Frame; grenade: Frame[]; puff: Frame[]; pepper: Frame[]; clod: Frame[]; drop: Frame; star: Frame; shard: Frame;
}
let owner: unknown = null;
let FR: Fr11 | null = null;

function puffBuf(r: number, seed: number, light: string, mid: string, dark: string): PixelBuffer {
  const s = Math.ceil(r * 2 + 2);
  const b = new PixelBuffer(s, s);
  const cL = hex(light), cM = hex(mid), cD = hex(dark);
  const c = s / 2;
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const dx = x + 0.5 - c, dy = y + 0.5 - c;
      // a lumpy cauliflower edge
      const ang = Math.atan2(dy, dx);
      const rr = r * (0.86 + 0.14 * Math.sin(ang * 5 + seed) * Math.sin(ang * 3 - seed * 2));
      const d = Math.hypot(dx, dy) / rr;
      if (d > 1) continue;
      // dithered edge
      const bay = ((x * 7 + y * 13 + seed * 5) % 16) / 16;
      if (d > 0.82 && bay < (d - 0.82) / 0.18) continue;
      const l = -(dx * 0.55 + dy * 0.75) / rr;
      b.set(x, y, l > 0.25 ? cL : l > -0.35 ? cM : cD);
    }
  return b;
}

export function fx11Frames(): Fr11 {
  if (FR && owner === local) return FR;
  owner = local;
  const add = (n: string, b: PixelBuffer, ax = b.w / 2, ay = b.h / 2) => local.add('v11:' + n, b, ax, ay);
  const peb = new PixelBuffer(3, 3);
  peb.set(1, 0, hex('#c8c2b4')); peb.set(0, 1, hex('#8f897c')); peb.set(1, 1, hex('#b0a998')); peb.set(2, 1, hex('#5e594f')); peb.set(1, 2, hex('#4a463e'));
  const pebS = new PixelBuffer(2, 2);
  pebS.set(0, 0, hex('#b9b2a2')); pebS.set(1, 0, hex('#8a8476')); pebS.set(0, 1, hex('#77716a')); pebS.set(1, 1, hex('#4e4a42'));
  // the grenade: a fist-sized ball of flax wrapped round crushed leaves and firestone powder, two frames of spin
  const gren: PixelBuffer[] = [];
  for (let f = 0; f < 2; f++) {
    const g = new PixelBuffer(7, 7);
    g.shadedEllipse(3.5, 3.8, 3, 2.8, [hex('#3c3a1c'), hex('#5a5a2a'), hex('#7a7a3a'), hex('#9a9650')]);
    for (let i = 0; i < 7; i++) {
      const k = (i + f * 2) % 7;
      g.set(k, (i * 2 + f) % 7, hex('#cbb27a'));
    }
    g.set(3, 0, hex('#d8c08a')); g.set(4, 0, hex('#8a6a3a'));
    g.outline(hex('#1c1a10'));
    gren.push(g);
  }
  // smoke puffs (kawakawa smoke: grey with a green cast), pepper dust (horopito: orange-red)
  const puffs = [6, 9, 13, 7, 10, 12].map((r, i) => puffBuf(r, i * 1.7 + 1, '#e4e6d8', '#b6baa8', '#848a7a'));
  const pep = [5, 7, 9].map((r, i) => puffBuf(r, i * 2.3 + 4, '#f0a060', '#d06a34', '#9a3a22'));
  const clods = [0, 1, 2].map(i => {
    const c = new PixelBuffer(4, 3);
    c.set(1, 0, hex('#6a5038')); c.set(2, 0, hex('#5a4430')); c.set(0, 1, hex('#4a3826')); c.set(1, 1, hex('#5a4430')); c.set(2, 1, hex('#3a2a1c')); c.set(3, 1, i % 2 ? hex('#3a2a1c') : 0);
    c.set(1, 2, hex('#2e2216')); c.set(2, 2, i === 2 ? hex('#2e2216') : 0);
    return c;
  });
  const drop = new PixelBuffer(1, 2);
  drop.set(0, 0, hex('#4a3624')); drop.set(0, 1, hex('#2e2014'));
  // a little 5px hit star and a stone shard
  const star = new PixelBuffer(5, 5);
  for (const [x, y] of [[2, 0], [2, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [2, 3], [2, 4]] as [number, number][]) star.set(x, y, x === 2 && y === 2 ? hex('#ffffff') : hex('#fff0b0'));
  const shard = new PixelBuffer(2, 1);
  shard.set(0, 0, hex('#a8a292')); shard.set(1, 0, hex('#6e695e'));
  FR = {
    pebble: add('peb', peb), pebbleS: add('pebS', pebS), grenade: gren.map((g, i) => add('gren' + i, g)),
    puff: puffs.map((p, i) => add('puff' + i, p)), pepper: pep.map((p, i) => add('pep' + i, p)),
    clod: clods.map((c, i) => add('clod' + i, c)), drop: add('drop', drop), star: add('star', star), shard: add('shard', shard),
  };
  return FR;
}

// ------------------------------------------------------------------ projectiles and clouds
export type GrenadeKind = 'smoke' | 'pepper' | 'cracker' | 'combo';
interface Pebble { x: number; y: number; vx: number; vy: number; t: number; owner: string; trail: [number, number][]; bounced: number; dead: boolean; power: number }
interface Grenade { x: number; y: number; vx: number; vy: number; t: number; kind: GrenadeKind; owner: string; spin: number; dead: boolean; fuse: number }
interface Puff { dx: number; dy: number; s: number; vx: number; vy: number; f: number; ph: number }
interface Cloud { x: number; y: number; r: number; kind: 'smoke' | 'pepper'; t: number; life: number; puffs: Puff[]; hit: Set<Animal> }
interface Flash { x: number; y: number; t: number; life: number; k: number }

export const G_PEBBLE = 330;
const G_GREN = 380;

export class PredFx implements Drawable {
  z = 96;
  pebbles: Pebble[] = [];
  grenades: Grenade[] = [];
  clouds: Cloud[] = [];
  flashes: Flash[] = [];
  /** hooks the scene controller fills in (hit-stop, Aroha's commentary) */
  onPebbleHit: ((a: Animal, head: boolean, owner: string) => void) | null = null;
  onPlink: ((a: Animal, owner: string) => void) | null = null;
  private t = 0;
  constructor(readonly s: FieldScene) {}

  private get fr() { return fx11Frames(); }

  firePebble(x: number, y: number, vx: number, vy: number, owner: string, power = 1) {
    this.pebbles.push({ x, y, vx, vy, t: 0, owner, trail: [], bounced: 0, dead: false, power });
    sfx11('whiz', { x, vol: 0.8, pitch: 0.9 + rand.next() * 0.25 });
  }

  throwGrenade(x: number, y: number, vx: number, vy: number, kind: GrenadeKind, owner = 'aroha') {
    this.grenades.push({ x, y, vx, vy, t: 0, kind, owner, spin: 0, dead: false, fuse: 1.7 });
    sfx11('fizz', { x, vol: 0.9 });
  }

  // ---------------------------------------------------------------- update
  update(dt: number) {
    this.t += dt;
    if (dt <= 0) return;
    const s = this.s;
    for (const p of this.pebbles) {
      if (p.dead) continue;
      p.t += dt;
      const n = 3;
      for (let i = 0; i < n && !p.dead; i++) {
        const h = dt / n;
        p.vy += G_PEBBLE * h;
        p.x += p.vx * h;
        p.y += p.vy * h;
        this.collidePebble(p);
      }
      p.trail.push([p.x, p.y]);
      if (p.trail.length > 4) p.trail.shift();
      if (p.t > 4 || p.x < s.minX - 200 || p.x > s.maxX + 200 || p.y > 2000) p.dead = true;
    }
    this.pebbles = this.pebbles.filter(p => !p.dead);
    for (const g of this.grenades) {
      if (g.dead) continue;
      g.t += dt;
      g.spin += dt * 14;
      g.vy += G_GREN * dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      // fuse sparks
      if (rand.next() < dt * 40) s.main.glowParticles.spawn({ frame: A.dot, x: g.x + rand.range(-1, 1), y: g.y - 3, vx: rand.range(-20, 20), vy: rand.range(-40, -10), ay: 60, life: 0.3, color: [1, 0.8, 0.3], glow: true, intensity: 2.5, alpha: 1, alpha1: 0 });
      let burst = g.t > g.fuse;
      const gy = s.st.terrain.groundY(g.x);
      if (g.y >= gy - 2) burst = true;
      for (const a of s.animals) {
        if (!isPredator(a) || a.hidden > 0.9) continue;
        const b = a.body.bounds(a);
        if (g.x > b.x0 + 6 && g.x < b.x1 - 6 && g.y > b.y0 + 4 && g.y < b.y1) burst = true;
      }
      if (burst) { g.dead = true; this.burst(g.kind, g.x, Math.min(g.y, gy - 3)); }
    }
    this.grenades = this.grenades.filter(g => !g.dead);
    for (const c of this.clouds) this.updateCloud(c, dt);
    this.clouds = this.clouds.filter(c => c.t < c.life);
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter(f => f.t < f.life);
  }

  private collidePebble(p: Pebble) {
    const s = this.s;
    // predators (the brow and the snout count double)
    for (const a of s.animals) {
      if (a.dead || a.gone || a.hidden > 0.9 || !a.body) continue;
      const b = a.body.bounds(a);
      const w = b.x1 - b.x0, h = b.y1 - b.y0;
      if (p.x < b.x0 + w * 0.12 || p.x > b.x1 - w * 0.12 || p.y < b.y0 + h * 0.08 || p.y > b.y1 - h * 0.05) continue;
      if (!this.solidAt(a, p.x, p.y)) continue;
      p.dead = true;
      if (isPredator(a)) {
        const [hx, hy] = a.body.head(a);
        const head = Math.abs(p.x - hx) < 16 && Math.abs(p.y - (hy + 10)) < 13;
        deter(s, a, 'pebble', p.power * (head ? 1.6 : 1), { x: p.x, head });
        this.sparks(p.x, p.y, head ? 1.4 : 1, p.vx);
        sfx11('thwack', { x: p.x, vol: head ? 1 : 0.8, pitch: head ? 1.15 : 0.95 });
        this.onPebbleHit?.(a, head, p.owner);
      } else {
        // a harmless animal: it gets a fright and bolts
        a.fear = Math.max(a.fear, 0.95);
        a.aw = Math.max(a.aw, 1);
        a.threat = { kind: 'point', x: p.x - Math.sign(p.vx) * 60, y: p.y };
        a.showEmote('alarm', 1, true);
        this.sparks(p.x, p.y, 0.5, p.vx);
        sfx11('tick', { x: p.x, pitch: 0.7 });
        emitPred('plinked', { a, who: p.owner });
        this.onPlink?.(a, p.owner);
      }
      return;
    }
    for (const t of shootTargets()) {
      if (Math.hypot(t.x - p.x, t.y - p.y) > t.r) continue;
      p.dead = true;
      t.hit(p.power, p.x, p.y);
      this.sparks(p.x, p.y, 0.6, p.vx);
      sfx11('tick', { x: p.x });
      return;
    }
    // the ground: a click, a puff of dust, one skip and it's gone
    const s2 = s.st.terrain.surfaceBelow(p.x, p.y - 6, 0);
    const gy = s2 ? s2.y : s.st.terrain.groundY(p.x);
    if (p.vy > 0 && p.y >= gy) {
      p.y = gy;
      sfx11('tick', { x: p.x, vol: p.bounced ? 0.4 : 0.8 });
      for (let i = 0; i < 4; i++) s.main.particles.spawn({ frame: A.dot2, x: p.x, y: gy - 1, vx: rand.range(-30, 30), vy: rand.range(-50, -15), ay: 200, life: 0.4, color: [0.55, 0.45, 0.33], alpha: 0.9, alpha1: 0, floorY: gy });
      if (p.bounced >= 1 || Math.abs(p.vy) < 60) { p.dead = true; return; }
      p.bounced++;
      p.vy = -p.vy * 0.3;
      p.vx *= 0.45;
    }
  }

  /** is the sprite opaque at this world point? (a quick test against the silhouette points) */
  private solidAt(a: Animal, x: number, y: number): boolean {
    const pts = a.body.points(a);
    for (const [px, py] of pts) if (Math.abs(px - x) < 7 && Math.abs(py - y) < 7) return true;
    return pts.length < 3;
  }

  /** hit sparks: a white star, stone chips and dust */
  sparks(x: number, y: number, k = 1, vx = 0) {
    const s = this.s, fr = this.fr;
    const back = -Math.sign(vx || 1);
    s.main.glowParticles.spawn({ frame: fr.star, x, y, life: 0.12, size: 1.6 * k, size1: 0.6, color: [1, 0.97, 0.8], glow: true, intensity: 3, alpha: 1, alpha1: 0, fadeIn: 0 });
    for (let i = 0; i < 6 * k; i++) s.main.glowParticles.spawn({ frame: A.dot, x, y, vx: back * rand.range(20, 120) + rand.range(-40, 40), vy: rand.range(-110, -10), ay: 300, life: rand.range(0.18, 0.35), color: [1, 0.9, 0.55], glow: true, intensity: 2.2, alpha: 1, alpha1: 0 });
    for (let i = 0; i < 3 * k; i++) s.main.particles.spawn({ frame: fr.shard, x, y, vx: back * rand.range(30, 90), vy: rand.range(-90, -20), ay: 380, life: 0.6, vrot: rand.range(-20, 20), alpha: 1, alpha1: 0.4, floorY: s.st.terrain.groundY(x) });
    s.main.particles.spawn({ frame: A.soft, x, y, vx: back * 10, vy: -8, life: 0.45, size: 0.35 * k, size1: 0.7 * k, color: [0.85, 0.82, 0.74], alpha: 0.5, alpha1: 0 });
  }

  // ---------------------------------------------------------------- grenades
  burst(kind: GrenadeKind, x: number, y: number) {
    const s = this.s;
    s.st.shake(kind === 'cracker' || kind === 'combo' ? 3 : 1.5, 0.3);
    if (kind === 'cracker' || kind === 'combo') {
      sfx11('flashBang', { x });
      this.flashes.push({ x, y: y - 8, t: 0, life: 0.6, k: 1 });
      for (let i = 0; i < 6; i++) this.flashes.push({ x: x + rand.range(-26, 26), y: y - rand.range(2, 22), t: -i * 0.08 - rand.next() * 0.05, life: 0.14, k: 0.6 });
      for (let i = 0; i < 26; i++) s.main.glowParticles.spawn({ frame: A.dot, x, y: y - 6, vx: rand.range(-150, 150), vy: rand.range(-200, -30), ay: 300, life: rand.range(0.3, 0.7), color: [1, rand.range(0.6, 0.95), 0.35], glow: true, intensity: 2.6, alpha: 1, alpha1: 0, lightR: 18 });
      deterArea(s, x, y - 14, 64, 'flash', 1);
    }
    if (kind === 'smoke' || kind === 'combo') {
      sfx11('poof', { x });
      this.clouds.push(this.cloud(x, y - 10, kind === 'combo' ? 54 : 48, 'smoke', kind === 'combo' ? 6.5 : 7));
      deterArea(s, x, y - 14, 56, 'smoke', 1);
    }
    if (kind === 'pepper' || kind === 'combo') {
      sfx11('pepper', { x, delay: 0.05 });
      this.clouds.push(this.cloud(x, y - 14, kind === 'combo' ? 40 : 46, 'pepper', 4.5));
    }
  }

  private cloud(x: number, y: number, r: number, kind: 'smoke' | 'pepper', life: number): Cloud {
    const puffs: Puff[] = [];
    const n = kind === 'smoke' ? 22 : 16;
    for (let i = 0; i < n; i++) {
      const a = rand.next() * Math.PI * 2, d = Math.sqrt(rand.next());
      puffs.push({ dx: Math.cos(a) * d, dy: Math.sin(a) * d * 0.55 - 0.15, s: rand.range(0.6, 1.2), vx: rand.range(-6, 10), vy: rand.range(-10, -3), f: Math.floor(rand.next() * 6), ph: rand.next() * 6 });
    }
    return { x, y, r, kind, t: 0, life, puffs, hit: new Set() };
  }

  private updateCloud(c: Cloud, dt: number) {
    c.t += dt;
    const s = this.s;
    const grow = clamp(c.t / 0.45);
    const R = c.r * (0.35 + 0.65 * Math.sqrt(grow));
    for (const p of c.puffs) { p.dx += (p.vx / Math.max(20, R)) * dt; p.dy += (p.vy / Math.max(20, R)) * dt * 0.6; }
    c.x += 5 * dt;
    // predators inside: smoke blinds them, pepper stings once and makes them sneeze
    for (const a of s.animals) {
      if (!isPredator(a)) continue;
      const b = a.body.bounds(a);
      const hx = (b.x0 + b.x1) / 2, hy = (b.y0 + b.y1) / 2;
      if (Math.abs(hx - c.x) > R + (b.x1 - b.x0) * 0.35 || Math.abs(hy - c.y) > R * 0.7 + 20) continue;
      const st = predState(a);
      if (c.kind === 'smoke') st.blind = Math.max(st.blind, 0.8);
      else if (!c.hit.has(a)) { c.hit.add(a); deter(s, a, 'pepper', 1, { x: c.x }); }
    }
    // pepper dust drifting down
    if (c.kind === 'pepper' && c.t < c.life * 0.7 && rand.next() < dt * 30) {
      const fr = this.fr;
      s.main.particles.spawn({ frame: fr.drop, x: c.x + rand.range(-R, R), y: c.y + rand.range(-R * 0.5, R * 0.3), vx: rand.range(-8, 8), vy: rand.range(4, 18), life: 1.2, color: [1, 0.55, 0.3], alpha: 0.9, alpha1: 0 });
    }
  }

  // ---------------------------------------------------------------- draw
  draw(r: Renderer) {
    const fr = this.fr;
    // clouds behind the projectiles
    for (const c of this.clouds) {
      const grow = clamp(c.t / 0.45);
      const R = c.r * (0.35 + 0.65 * Math.sqrt(grow));
      const fade = c.t > c.life * 0.55 ? 1 - (c.t - c.life * 0.55) / (c.life * 0.45) : 1;
      const set = c.kind === 'smoke' ? fr.puff : fr.pepper;
      for (const p of c.puffs) {
        const x = c.x + p.dx * R, y = c.y + p.dy * R + Math.sin(this.t * 1.3 + p.ph) * 1.5;
        const sc = p.s * (0.6 + grow * 0.5 + c.t * 0.05);
        const a = clamp(fade * (c.kind === 'smoke' ? 0.92 : 0.8));
        const col = c.kind === 'smoke' ? packColor(1, 1, 1, a) : packColor(1, 0.95, 0.9, a);
        r.draw(set[p.f % set.length], x, y, sc, sc, 0, col);
      }
    }
    for (const g of this.grenades) {
      r.draw(fr.grenade[Math.floor(g.spin) % 2], g.x, g.y, 1, 1, g.spin * 0.3);
      r.fxDraw(A.glow, g.x, g.y - 3, 0.12, 0.12, 0, packColor(1, 0.8, 0.4, 1), 2.4);
      r.light(g.x, g.y - 3, 22, 1, 0.75, 0.4, 0.8);
    }
    for (const p of this.pebbles) {
      if (p.dead) continue;
      // a faint motion trail
      for (let i = 0; i < p.trail.length - 1; i++) {
        const [tx, ty] = p.trail[i];
        r.fxDraw(A.dot, tx, ty, 1, 1, 0, packColor(0.9, 0.88, 0.8, 1), 0.25 + i * 0.12, false);
      }
      r.draw(p.owner === 'aroha' ? fr.pebble : fr.pebble, p.x, p.y, 1, 1);
    }
    for (const f of this.flashes) {
      if (f.t < 0) continue;
      const k = 1 - f.t / f.life;
      r.fxDraw(A.glow, f.x, f.y, 1.2 * f.k * (1 + f.t * 3), 1.2 * f.k * (1 + f.t * 3), 0, packColor(1, 0.92, 0.7, 1), 3.5 * k * f.k);
      r.light(f.x, f.y, 120 * f.k, 1, 0.9, 0.7, 2.5 * k * f.k);
    }
  }

  get busy() { return this.pebbles.length > 0 || this.grenades.length > 0; }
}

// V9 jewel hornets: colourful fruit-eating hornets that nest underground, ant-style, beneath ember
// bushes. Harvesting berries over a nest can set the colony off.
//
// Contract used by the foraging code (src/game/v9/forage.ts):
//   nestUnder(x)          is there a hornet nest under the bush at world x?
//   hornetAmbush(s, x, y) the colony bursts out of the ground at (x, y) and chases the player;
//                         resolves when the encounter is over.
//
// The ember bushes live here too: "Pick emberberries" plucks the clusters one by one (each regrows
// after a while). Over a nest the ground sometimes starts to hum and a scout comes up to look at
// you: keep picking and the colony erupts. A swarm of boids then chases Mori; outrun it (Shift),
// splash into the stream or the creek, or crouch into the flax beside the nest (S). If they catch
// him he is stung (a flash, a yelp, a swollen welt on his cheek, some berries dropped) and they fly
// home. Chunk flees, loudly. Between ambushes the hornets go about their business: foragers fly
// out of the holes to chew berries and visit flowers, guards hover over the entrances.

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor, WHITE } from '../../gfx/renderer';
import type { IslandScene4 } from '../v4/island';
import { Custom } from '../../world/props';
import { local, A } from '../assets';
import { game } from '../game';
import { audio } from '../../core/audio';
import { add, fits, remove, count } from '../inventory';
import { ITEMS } from '../items';
import { clamp, damp, rand } from '../../core/math';
import { SPOT, groundY } from '../../art/island4/layout';
import { emberBush, berryCluster, nestMound, flowerClump, EmberBushArt } from '../../art/v9/wild/ember';
import { hornetFrame } from '../../art/v9/wild/hornet';
import { sprite } from '../sites2/common';
import { plant } from '../../art/jungle-plants';
import { PixelBuffer } from '../../art/pixel';
import { hex } from '../../art/color';
import { Buzz } from './buzz';

export type AmbushEnd = 'escaped' | 'stung';

// ------------------------------------------------------------------ placement
const BUSHES: { x: number; nest: boolean; seed: number }[] = [
  // the landing beach, past the camp
  { x: 2410, nest: true, seed: 5 }, { x: 2545, nest: false, seed: 6 },
  // the palm grove
  { x: 2705, nest: false, seed: 7 }, { x: 2880, nest: true, seed: 8 }, { x: 3095, nest: false, seed: 9 }, { x: 3240, nest: true, seed: 10 },
  // up the bush track
  { x: 6045, nest: false, seed: 11 }, { x: 6290, nest: true, seed: 12 }, { x: 6470, nest: false, seed: 13 }, { x: 6790, nest: true, seed: 14 },
];
/** extra flower clumps (also used by the beetles and the lantern moths) */
const FLOWERS: [number, 'gold' | 'pink' | 'white'][] = [[2455, 'gold'], [2650, 'pink'], [2930, 'white'], [3150, 'gold'], [5985, 'pink'], [6160, 'white'], [6380, 'gold'], [6620, 'pink'], [6860, 'white']];

/** flower heads in world coordinates for whoever visits flowers */
export const flowerHeads: [number, number][] = [];

// ------------------------------------------------------------------ frames
let owner: unknown = null;
const FR: Record<string, Frame> = {};
function fr(): Record<string, Frame> {
  if (owner === local && FR.up) return FR;
  owner = local;
  for (const p of ['up', 'down', 'perch', 'chew'] as const) { const h = hornetFrame(p); FR[p] = local.add('v9:hor:' + p, h.buf, h.ax, h.ay); }
  for (let v = 0; v < 3; v++) { const c = berryCluster(v); FR['berry' + v] = local.add('v9:berry' + v, c.buf, c.ax, c.ay); }
  // the welt on a stung cheek
  const w = new PixelBuffer(5, 4);
  const px = [[1, 0, '#e86a6a'], [2, 0, '#f08a7a'], [3, 0, '#e86a6a'], [0, 1, '#c84a52'], [1, 1, '#f49a88'], [2, 1, '#ffd0c0'], [3, 1, '#f08a7a'], [4, 1, '#c84a52'], [0, 2, '#b8384a'], [1, 2, '#e8707a'], [2, 2, '#f08a7a'], [3, 2, '#e8707a'], [4, 2, '#b8384a'], [1, 3, '#a02c40'], [2, 3, '#b8384a'], [3, 3, '#a02c40']] as const;
  for (const [x, y, c] of px) w.set(x, y, hex(c));
  FR.welt = local.add('v9:welt', w, 2.5, 2);
  return FR;
}

// ------------------------------------------------------------------ bushes
export class EmberBush {
  readonly art: EmberBushArt;
  bushF: Frame;
  nestF: Frame | null = null;
  burstF: Frame | null = null;
  holes: [number, number][] = [];
  /** which berry spots carry a cluster right now */
  has: boolean[];
  regrowT = rand.range(40, 70);
  tremble = 0;
  burstT = 0;
  readonly y: number;
  private ph = rand.next() * 10;
  constructor(readonly s: IslandScene4, readonly x: number, readonly nest: boolean, readonly seed: number) {
    this.y = groundY(x) + 1;
    this.art = emberBush(seed);
    this.bushF = local.add('v9:bush' + seed, this.art.bush.buf, this.art.bush.ax, this.art.bush.ay);
    this.has = this.art.spots.map(() => true);
    if (nest) {
      const n = nestMound(seed), b = nestMound(seed, true);
      this.nestF = local.add('v9:nest' + seed, n.spr.buf, n.spr.ax, n.spr.ay);
      this.burstF = local.add('v9:burst' + seed, b.spr.buf, b.spr.ax, b.spr.ay);
      this.holes = n.holes.map(([hx, hy]) => [this.x + hx, this.y + 4 + hy] as [number, number]);
    }
  }
  count() { return this.has.filter(Boolean).length; }
  /** world position of a cluster spot (follows the sway) */
  spot(i: number, sway: number): [number, number] {
    const [dx, dy] = this.art.spots[i];
    return [this.x + dx + sway * (-dy / this.art.bush.ay), this.y + dy];
  }
  sway(time: number) {
    const w = this.s.st.wind;
    return ((Math.sin(time * 1.3 + this.ph) * 0.7 + Math.sin(time * 3 + this.ph * 1.7) * 0.3) * 0.6 * (0.4 + w)) + (this.tremble > 0 ? Math.sin(time * 40) * this.tremble * 1.2 : 0);
  }
  pluck(): [number, number] | null {
    const left = this.has.map((h, i) => (h ? i : -1)).filter(i => i >= 0);
    if (!left.length) return null;
    const i = rand.pick(left);
    this.has[i] = false;
    return this.spot(i, 0);
  }
  update(dt: number) {
    this.tremble = Math.max(0, this.tremble - dt * 0.6);
    this.burstT = Math.max(0, this.burstT - dt);
    if (this.has.some(h => !h)) {
      this.regrowT -= dt;
      if (this.regrowT <= 0) {
        this.regrowT = rand.range(45, 80);
        const i = this.has.findIndex(h => !h);
        if (i >= 0) this.has[i] = true;
      }
    }
  }
  draw(r: Renderer, time: number) {
    const x0 = r.visibleX0(60), x1 = r.visibleX1(60);
    if (this.x < x0 || this.x > x1) return;
    const sw = this.sway(time);
    r.beginShadows();
    r.draw(A.shadow, this.x, this.y + 1, 1.6, 0.6, 0, packColor(0, 0, 0, 0.28));
    r.endShadows();
    r.drawSway(this.bushF, this.x, this.y, 1, 1, sw);
    const f = fr();
    this.has.forEach((h, i) => { if (!h) return; const [bx, by] = this.spot(i, sw); r.draw(f['berry' + (i % 3)], bx, by); });
    if (this.nest) r.draw(this.burstT > 0 ? this.burstF! : this.nestF!, this.x, this.y + 4);
  }
}

// ------------------------------------------------------------------ hornets
type HMode = 'den' | 'out' | 'fly' | 'feed' | 'home' | 'guard' | 'scout' | 'swarm' | 'search' | 'return' | 'chunk';

export class Hornet {
  readonly species = 'jewelhornet';
  z = 55;
  p = 1;
  vx = 0;
  vy = 0;
  facing = 1;
  dead = false;
  gone = false;
  hidden = 0;
  eco = { attacksPlayer: 0, aggro: 0 };
  anger = 0;
  act = 'forage';
  mode: HMode = 'den';
  t = rand.next() * 10;
  timer = rand.range(0.5, 6);
  tx = 0;
  ty = 0;
  /** feeding on bush b, spot i (or a flower) */
  feedAt: { b: EmberBush | null; i: number; fx: number; fy: number } | null = null;
  orbit = rand.next() * Math.PI * 2;
  orad = rand.range(10, 24);
  constructor(public x: number, public y: number, readonly home: EmberBush, public ambient: boolean) {}
  body = {
    bounds: (a: Hornet) => ({ x0: a.x - 5, y0: a.y - 4.5, x1: a.x + 5, y1: a.y + 3.5 }),
    points: (a: Hornet): [number, number][] => [[a.x, a.y], [a.x - 3, a.y], [a.x + 3, a.y - 1]],
  };
  get behavior() {
    return this.mode === 'swarm' || this.mode === 'search' || this.mode === 'chunk' ? 'swarming' : this.mode === 'guard' || this.mode === 'out' || this.mode === 'home' || this.mode === 'scout' ? 'nesting' : 'foraging';
  }
  photoInfo() {
    return { species: this.species, behavior: this.behavior, box: this.body.bounds(this), pts: this.body.points(this), speed: Math.hypot(this.vx, this.vy), facing: 0.8, noticed: this.mode === 'swarm' || this.mode === 'scout', juvenile: false, p: 1, hidden: this.hidden };
  }
  get front() { return !this.ambient || this.mode === 'scout'; }
  /** steer toward (tx, ty) at speed, with a little wander */
  steer(dt: number, sp: number, acc = 200) {
    const dx = this.tx - this.x, dy = this.ty - this.y, d = Math.hypot(dx, dy) || 1;
    const want = Math.min(sp, d * 4);
    this.vx += ((dx / d) * want - this.vx) * Math.min(1, dt * acc / 60);
    this.vy += ((dy / d) * want - this.vy) * Math.min(1, dt * acc / 60);
    this.vx += Math.sin(this.t * 7.3 + this.orbit) * 40 * dt;
    this.vy += Math.cos(this.t * 6.1 + this.orbit) * 40 * dt;
    return d;
  }
}

interface Ambush {
  bush: EmberBush;
  x: number;
  y: number;
  t: number;
  phase: 'chase' | 'search' | 'over';
  sting: number;
  stung: boolean;
  lostT: number;
  lx: number;
  ly: number;
  res: (e: AmbushEnd) => void;
  chunkMode: string | null;
}

class HornetSystem {
  hornets: Hornet[] = [];
  amb: Ambush | null = null;
  bushes: EmberBush[] = [];
  welt = 0;
  readonly swarmBuzz = new Buzz(205, 4);
  readonly nestBuzz = new Buzz(240, 2);
  scoutLevel = 0;
  constructor(readonly s: IslandScene4) {}

  addHornet(h: Hornet) {
    this.hornets.push(h);
    this.s.animals.push(h as never);
  }

  /** the nearest ripe cluster within range (own bush first) */
  private food(h: Hornet): Hornet['feedAt'] {
    const own = h.home;
    const bushes = this.bushes.filter(b => Math.abs(b.x - own.x) < 260 && b.count() > 0);
    if (bushes.length && rand.chance(0.75)) {
      const b = rand.chance(0.6) && own.count() ? own : rand.pick(bushes);
      const spots = b.has.map((x, i) => (x ? i : -1)).filter(i => i >= 0);
      if (spots.length) { const i = rand.pick(spots); const [fx, fy] = b.spot(i, 0); return { b, i, fx, fy }; }
    }
    const fl = flowerHeads.filter(([fx]) => Math.abs(fx - own.x) < 320);
    if (fl.length) { const [fx, fy] = rand.pick(fl); return { b: null, i: -1, fx, fy: fy - 1 }; }
    return null;
  }

  private hole(h: Hornet): [number, number] {
    const hs = h.home.holes;
    return hs.length ? hs[Math.floor(Math.abs(h.orbit * 10)) % hs.length] : [h.home.x, h.home.y];
  }

  update(dt: number) {
    const s = this.s, p = s.player, camX = s.st.cam.x;
    for (const b of this.bushes) b.update(dt);
    this.welt = Math.max(0, this.welt - dt);
    if (this.amb) this.updateAmbush(dt);
    let nearNest = 0;
    for (const b of this.bushes) if (b.nest) nearNest = Math.max(nearNest, 1 - Math.abs(b.x - p.x) / 110);
    for (const h of this.hornets) {
      if (h.gone) continue;
      if (h.ambient && Math.abs(h.x - camX) > 760) continue;
      h.t += dt;
      h.timer -= dt;
      switch (h.mode) {
        case 'den': {
          h.hidden = 1;
          if (h.timer <= 0 && !this.amb) {
            const [hx, hy] = this.hole(h);
            h.x = hx; h.y = hy; h.vx = 0; h.vy = -20;
            h.mode = 'out'; h.timer = 0.6; h.hidden = 0;
          }
          break;
        }
        case 'out': {
          h.vy -= 30 * dt; h.vx += Math.sin(h.t * 9) * 30 * dt;
          if (h.timer <= 0) {
            if (h.orbit > 5.2) { h.mode = 'guard'; h.timer = rand.range(8, 16); }
            else { h.feedAt = this.food(h); if (h.feedAt) { h.mode = 'fly'; } else { h.mode = 'guard'; h.timer = 6; } }
          }
          break;
        }
        case 'fly': {
          const f = h.feedAt!;
          if (f.b && !f.b.has[f.i]) { h.feedAt = this.food(h); if (!h.feedAt) { h.mode = 'home'; } break; }
          if (f.b) [f.fx, f.fy] = f.b.spot(f.i, f.b.sway(s.st.time));
          h.tx = f.fx; h.ty = f.fy - 2;
          if (h.steer(dt, 44) < 2.5) { h.mode = 'feed'; h.timer = rand.range(3, 7); h.vx = h.vy = 0; }
          break;
        }
        case 'feed': {
          const f = h.feedAt!;
          if (f.b) [f.fx, f.fy] = f.b.spot(f.i, f.b.sway(s.st.time));
          h.x = f.fx + 1; h.y = f.fy - 2;
          h.vx = h.vy = 0;
          h.facing = -1;
          // disturbed: someone walks right through the bush
          const bump = Math.abs(p.x - h.x) < 14 && Math.abs(p.vx) > 30 && Math.abs(p.y - 30 - h.y) < 35;
          if (h.timer <= 0 || bump || (f.b && !f.b.has[f.i])) { h.mode = 'home'; h.vy = -40; }
          break;
        }
        case 'home': {
          const [hx, hy] = this.hole(h);
          h.tx = hx; h.ty = hy - 1;
          if (h.steer(dt, 46) < 2) { h.mode = 'den'; h.timer = rand.range(2, 7); h.hidden = 1; }
          break;
        }
        case 'guard': {
          const [hx, hy] = this.hole(h);
          h.tx = hx + Math.sin(h.t * 1.7 + h.orbit) * 9; h.ty = hy - 7 + Math.sin(h.t * 3.1) * 3;
          h.steer(dt, 26);
          if (h.timer <= 0) { h.mode = 'home'; }
          break;
        }
        case 'scout': {
          // hovers in front of Mori's face, sizing him up
          h.tx = p.x + p.facing * 12 + Math.sin(h.t * 2.3) * 6; h.ty = p.y - 52 + Math.sin(h.t * 3.7) * 4;
          h.steer(dt, 40);
          h.facing = p.x > h.x ? 1 : -1;
          break;
        }
        case 'swarm': case 'search': case 'chunk': this.boid(h, dt); break;
        case 'return': {
          const [hx, hy] = this.hole(h);
          h.tx = hx; h.ty = hy;
          if (h.steer(dt, 70) < 3) { h.gone = true; h.dead = true; }
          break;
        }
      }
      if (h.mode !== 'feed' && h.mode !== 'den') {
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        // never below the sand
        const g = groundY(h.x) - 2;
        if (h.y > g + 6 && h.mode !== 'home' && h.mode !== 'return') { h.y = g + 6; h.vy = -Math.abs(h.vy) * 0.5; }
        if (Math.abs(h.vx) > 4) h.facing = Math.sign(h.vx);
      }
    }
    if (this.hornets.some(h => h.gone)) this.hornets = this.hornets.filter(h => !h.gone);
    // the buzz: a soft hum at the nests, the scout's whine, the swarm's roar
    const sw = this.hornets.filter(h => !h.ambient && !h.gone);
    if (sw.length) {
      let cx = 0, cy = 0, n = 0, vx = 0;
      for (const h of sw) { cx += h.x; cy += h.y; vx += h.vx; n++; }
      cx /= n; cy /= n; vx /= n;
      const d = Math.hypot(cx - camX, cy - p.y);
      const lvl = clamp(n / 26) * clamp(1.2 - d / 420);
      this.swarmBuzz.set(lvl, (cx - camX) / 260, 1 + clamp(-vx * Math.sign(cx - camX) / 400, -0.15, 0.15), clamp(n / 30));
    } else if (this.swarmBuzz.on) this.swarmBuzz.stop();
    this.nestBuzz.set(Math.max(nearNest * 0.08, this.scoutLevel), 0, 1 + this.scoutLevel * 0.3, 0.3 + this.scoutLevel);
  }

  /** flocking: separation, cohesion, alignment, and seeking the target with an orbit offset */
  private boid(h: Hornet, dt: number) {
    const s = this.s, p = s.player, a = this.amb;
    let tx: number, ty: number;
    if (h.mode === 'chunk') { const c = s.chunk; tx = c.x; ty = c.y - 14; if (h.timer <= 0) h.mode = a && a.phase === 'chase' ? 'swarm' : 'return'; }
    else if (h.mode === 'search' || !a || a.phase !== 'chase') { tx = a ? a.lx : h.home.x; ty = a ? a.ly : h.home.y - 30; }
    else if (a.t < 1.1) { tx = a.x; ty = a.y - 34; }
    else { tx = p.x; ty = p.y - 44; }
    h.orbit += dt * (2.2 + (h.orad % 3));
    tx += Math.cos(h.orbit) * h.orad;
    ty += Math.sin(h.orbit * 1.3) * h.orad * 0.6;
    let sx = 0, sy = 0, ax = 0, ay = 0, n = 0;
    for (const o of this.hornets) {
      if (o === h || o.ambient || o.gone) continue;
      const dx = h.x - o.x, dy = h.y - o.y, d2 = dx * dx + dy * dy;
      if (d2 > 900) continue;
      if (d2 < 49) { sx += dx / (d2 + 1); sy += dy / (d2 + 1); }
      ax += o.vx; ay += o.vy; n++;
    }
    const dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy) || 1;
    const max = h.mode === 'search' ? 50 : 96;
    let fx = (dx / d) * max - h.vx, fy = (dy / d) * max - h.vy;
    if (n) { fx += (ax / n - h.vx) * 0.25; fy += (ay / n - h.vy) * 0.25; }
    fx += sx * 900; fy += sy * 900;
    h.vx += clamp(fx, -400, 400) * dt * 2.6;
    h.vy += clamp(fy, -400, 400) * dt * 2.6;
    h.vx += (Math.random() - 0.5) * 260 * dt;
    h.vy += (Math.random() - 0.5) * 260 * dt;
    const sp = Math.hypot(h.vx, h.vy);
    if (sp > max * 1.15) { h.vx *= max * 1.15 / sp; h.vy *= max * 1.15 / sp; }
  }

  private updateAmbush(dt: number) {
    const a = this.amb!, s = this.s, p = s.player;
    a.t += dt;
    const sw = this.hornets.filter(h => !h.ambient && (h.mode === 'swarm' || h.mode === 'search' || h.mode === 'chunk'));
    if (a.phase === 'chase') {
      a.lx = p.x; a.ly = p.y - 46;
      // ways out: water, cover, distance, or they lose interest
      const inWater = Math.abs(p.x - SPOT.stream) < 46 || Math.abs(p.x - SPOT.creek) < 36;
      const covered = p.state === 'hide' || s.inWreck || s.caveK > 0.5;
      let cx = a.x;
      if (sw.length) cx = sw.reduce((q, h) => q + h.x, 0) / sw.length;
      const far = Math.abs(p.x - a.x) > 300 && Math.abs(p.x - cx) > 110;
      if (inWater || covered || far || a.t > 15) {
        a.lostT += dt;
        if (a.lostT > (far ? 1.2 : 0.5) || a.t > 15) {
          a.phase = 'search';
          for (const h of sw) if (h.mode !== 'chunk') h.mode = 'search';
          const how = inWater ? 'You splashed into the water and the swarm lost you.' : covered ? 'You hid and the swarm lost you.' : a.t > 15 ? 'The hornets gave up the chase.' : 'You outran the swarm!';
          game.ui.toast(how, 'ESCAPED', 'teal', 3400);
          s.bark('mori', inWater ? '...blub. Are they gone? Tell me they’re gone.' : covered ? 'Shhh. I am a plant. I am a very quiet plant.' : 'I think I lost them. I THINK.', { expr: 'worried' });
          this.endAmbush('escaped');
        }
      } else a.lostT = 0;
      // stings: a knot of hornets on his head and shoulders
      let onHim = 0;
      for (const h of sw) {
        if (h.mode !== 'swarm') continue;
        if (Math.abs(h.x - p.x) < 9 && h.y > p.y - 64 && h.y < p.y - 16) onHim++;
      }
      a.sting = onHim >= 6 && a.t > 1.6 ? a.sting + dt : Math.max(0, a.sting - dt * 0.5);
      if (a.sting > 0.6 && a.phase === 'chase') this.sting();
    } else if (a.phase === 'search' && a.t > 2.5 + a.lostT) {
      for (const h of this.hornets) if (!h.ambient) h.mode = 'return';
      a.phase = 'over';
    }
    if (a.phase === 'over' && !this.hornets.some(h => !h.ambient)) this.amb = null;
  }

  private sting() {
    const a = this.amb!, s = this.s, p = s.player;
    a.stung = true;
    a.phase = 'search';
    a.lostT = 0.8;
    for (const h of this.hornets) if (!h.ambient && h.mode === 'swarm') h.mode = 'search';
    game.r.post.flash = 0.45;
    s.st.shake(3, 0.35);
    audio.play('alert', { vol: 0.6 });
    audio.play('emoteSurprise', { vol: 0.5, pitch: 1.3 });
    p.hurtT = 1.4;
    p.cancelWork();
    p.vx = -p.facing * 90;
    p.body.react('jump');
    p.body.setExpr('injured', 4);
    p.body.showEmote('anger', 2);
    this.welt = 32;
    // drop some berries in the scramble
    const lost = Math.min(count('berry_ember'), 1 + Math.floor(rand.next() * 3));
    if (lost) {
      remove('berry_ember', lost);
      const f = fr();
      for (let i = 0; i < lost * 2; i++) s.main.particles.spawn({ frame: f.berry0, x: p.x, y: p.y - 30, vx: rand.range(-60, 60), vy: rand.range(-110, -40), ay: 320, life: 1.6, alpha: 1, alpha1: 0.8, vrot: rand.range(-8, 8), floorY: groundY(p.x) + 2, onFloor: 'bounce' });
    }
    game.ui.toast(`Stung! ${lost ? `You dropped ${lost} emberberr${lost > 1 ? 'ies' : 'y'} in the scramble. ` : ''}The hornets made their point and head home.`, 'OUCH', 'coral', 4200);
    setTimeout(() => s.bark('mori', rand.pick(['OW! OW OW OW! My FACE!', 'AAH! Why is it always the face?!', 'OWWW. Okay. Okay. Message received!']), { expr: 'injured' }), 120);
    setTimeout(() => { if (!game.ui.bubbles.active) s.bark('mori', 'My cheek is swelling up like a puffer fish. Great. Very dignified.', { expr: 'grumpy' }); }, 5200);
    this.endAmbush('stung');
  }

  private endAmbush(e: AmbushEnd) {
    const a = this.amb!;
    const c = this.s.chunk, b = this.s.buddy;
    if (a.chunkMode !== null && b) setTimeout(() => { if (b.mode === 'script') { b.mode = a.chunkMode as 'follow'; b.reset(); } }, 1800);
    const r = a.res;
    a.res = () => {};
    void c;
    r(e);
  }

  /** the colony erupts from the nest at (x, y) */
  start(bush: EmberBush, x: number, y: number): Promise<AmbushEnd> {
    const s = this.s, p = s.player;
    this.scoutLevel = 0;
    for (const h of this.hornets) if (h.mode === 'scout') { h.mode = 'swarm'; h.ambient = false; }
    return new Promise<AmbushEnd>(res => {
      this.amb = { bush, x, y, t: 0, phase: 'chase', sting: 0, stung: false, lostT: 0, lx: p.x, ly: p.y, res, chunkMode: null };
      bush.burstT = 40;
      bush.tremble = 1;
      // the ground bursts: clods, dust, a jolt
      s.st.shake(4.5, 0.8);
      audio.play('dig', { vol: 0.9, pitch: 0.6 });
      audio.play('jumpscare', { vol: 0.35 });
      audio.play('rustleBush', { vol: 0.8 });
      const lp = s.main.particles;
      for (let i = 0; i < 34; i++) lp.spawn({ frame: A.dot2, x: x + rand.range(-14, 14), y: y + 2, vx: rand.range(-90, 90), vy: rand.range(-190, -60), ay: 420, life: rand.range(0.7, 1.3), color: rand.chance(0.5) ? [0.45, 0.3, 0.18] : [0.6, 0.42, 0.26], alpha: 1, alpha1: 0.6, size: rand.range(0.8, 1.8), floorY: groundY(x) + rand.range(2, 9), onFloor: 'stop' });
      for (let i = 0; i < 12; i++) lp.spawn({ frame: A.soft, x: x + rand.range(-16, 16), y: y - 2, vx: rand.range(-30, 30), vy: rand.range(-30, -8), life: rand.range(1, 1.8), size: 0.3, size1: 1.1, color: [0.75, 0.62, 0.48], alpha: 0.5, alpha1: 0 });
      // the swarm pours out of the holes
      const n = 26 + Math.floor(rand.next() * 9);
      for (let i = 0; i < n; i++) {
        setTimeout(() => {
          if (!this.amb) return;
          const [hx, hy] = bush.holes.length ? bush.holes[i % bush.holes.length] : [x, y];
          const h = new Hornet(hx, hy, bush, false);
          h.mode = i % 9 === 4 && s.chunk.visible ? 'chunk' : 'swarm';
          h.timer = 2.2;
          h.anger = 0.6;
          h.vx = rand.range(-60, 60);
          h.vy = rand.range(-160, -60);
          this.addHornet(h);
        }, i * 38);
      }
      // Mori's reaction
      p.cancelWork();
      p.body.react('jump');
      p.body.setExpr('shocked', 2.5);
      p.body.showEmote('alarm', 1.6);
      s.bark('mori', rand.pick(['HORNETS! RUN!', 'NOPE! Nope nope nope!', 'THE GROUND IS ANGRY! RUN!']), { expr: 'shocked' });
      game.ui.toast('Jewel hornets! <b>Run</b> (hold Shift), splash into the <b>stream</b> or <b>creek</b>, or crouch into the <b>flax</b> (S) to lose them.', 'AMBUSH', 'coral', 6000);
      // Chunk: barks, then legs it the other way
      const c = s.chunk, b = s.buddy;
      if (c?.visible && b && Math.abs(c.x - x) < 420) {
        this.amb.chunkMode = b.mode;
        b.mode = 'script';
        c.showEmote('alarm', 1.4);
        c.react('jump');
        audio.play('callBark', { vol: 0.5, pitch: 0.8 });
        setTimeout(() => s.bark('chunk', rand.pick(['BOOF! BOOF BOOF!', 'YIP! YIPYIPYIP!', 'BWOOF?!']), { expr: 'scared' }), 300);
        const away = Math.sign(c.x - x || -p.facing);
        c.walkTo(clamp(c.x + away * 240, 40, 6860), 150, 'run');
      }
    });
  }

  drawPass(r: Renderer, front: boolean) {
    const f = fr();
    const x0 = r.visibleX0(20), x1 = r.visibleX1(20);
    for (const h of this.hornets) {
      if (h.hidden >= 1 || h.gone || h.front !== front || h.x < x0 || h.x > x1) continue;
      if (h.mode === 'feed') { r.draw(Math.floor(h.t * 5) % 2 ? f.chew : f.perch, h.x, h.y, h.facing, 1); continue; }
      // wingbeat: the current frame solid, the other as a motion ghost
      const ph = Math.floor(h.t * 32 + h.orbit * 3) % 2;
      r.draw(ph ? f.up : f.down, h.x, h.y, h.facing, 1, 0, packColor(1, 1, 1, 0.42));
      r.draw(ph ? f.down : f.up, h.x, h.y, h.facing, 1);
    }
    if (front && this.welt > 0) {
      // the welt on Mori's cheek, throbbing
      const p = this.s.player, [hx, hy] = p.body.headTop();
      const k = 1 + Math.sin(game.r.time * 6) * 0.08 + Math.min(1, (32 - this.welt) * 2) * 0.1;
      r.draw(f.welt, hx + p.facing * 3, hy + 9, k * p.facing, k, 0, this.welt < 3 ? packColor(1, 1, 1, this.welt / 3) : WHITE);
    }
  }
}

let sys: HornetSystem | null = null;
let busy = false;

export function nestUnder(x: number): boolean {
  return !!sys?.bushes.some(b => b.nest && Math.abs(b.x - x) < 34);
}

export async function hornetAmbush(s: IslandScene4, x: number, y: number): Promise<AmbushEnd> {
  if (!sys || sys.s !== s) startHornets(s);
  const S = sys!;
  if (S.amb) return 'escaped';
  const bush = S.bushes.filter(b => b.nest).sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
  const holeY = bush && Math.abs(bush.x - x) < 80 ? bush.y + 3 : y;
  return S.start(bush && Math.abs(bush.x - x) < 80 ? bush : (bush ?? S.bushes[0]), bush && Math.abs(bush.x - x) < 80 ? bush.x : x, holeY);
}

/** debug: an ambush at the nearest nest (zl.ambush) */
export async function debugAmbush(s: IslandScene4): Promise<AmbushEnd> {
  if (!sys || sys.s !== s) startHornets(s);
  const b = sys!.bushes.filter(q => q.nest).sort((a, q) => Math.abs(a.x - s.player.x) - Math.abs(q.x - s.player.x))[0];
  if (b && Math.abs(b.x - s.player.x) > 120) { s.player.x = b.x - 22; s.player.y = groundY(s.player.x); s.snapCamera(); }
  return hornetAmbush(s, b ? b.x : s.player.x, b ? b.y : s.player.y);
}

// ------------------------------------------------------------------ the harvest
async function harvest(s: IslandScene4, b: EmberBush) {
  const S = sys!;
  if (busy || S.amb) return;
  if (!b.count()) { s.bark('mori', 'Picked clean. They’ll ripen again in a while.', { expr: 'neutral' }); return; }
  if (!fits('berry_ember', 3)) { audio.play('wrong', { vol: 0.5 }); s.bark('mori', 'My pack is full. Time to eat some evidence.', { expr: 'worried', emote: 'sweat' }); return; }
  busy = true;
  const p = s.player;
  const vars = game.save.vars;
  const recent = s.st.time - (vars['v9:lastAmbushT'] ?? -999) < 90 && (vars['v9:lastAmbushT'] ?? 0) < s.st.time;
  const armed = b.nest && !recent && ((vars['v9:hornetPity'] ?? 0) >= 2 || rand.chance(0.45));
  if (b.nest && !armed) vars['v9:hornetPity'] = (vars['v9:hornetPity'] ?? 0) + 1;
  let got = 0, picks = 0, scout: Hornet | null = null;
  try {
    const n = Math.min(b.count(), armed ? 3 : 2 + Math.floor(rand.next() * 2));
    for (let i = 0; i < n; i++) {
      p.facing = b.x >= p.x ? 1 : -1;
      p.body.setAnim('idle');
      let rustle = 0;
      const ok = await p.doWork('pick', 0.62, () => {
        rustle -= 1 / 60;
        if (rustle <= 0) { rustle = 0.3; b.tremble = Math.max(b.tremble, 0.35); audio.play('rustleBush' as 'ui', { vol: 0.25, pitch: 1.1 + rand.next() * 0.2 }); }
        if (armed && i > 0) {
          // dirt trickles out of the holes as the colony stirs
          if (rand.chance(0.25)) { const [hx, hy] = b.holes[Math.floor(rand.next() * b.holes.length)]; s.main.particles.spawn({ frame: A.dot, x: hx + rand.range(-1, 1), y: hy, vx: rand.range(-8, 8), vy: rand.range(-30, -10), ay: 200, life: 0.6, color: [0.5, 0.34, 0.2], alpha: 1, alpha1: 0.5, floorY: hy + 2 }); }
        }
      });
      if (!ok) break;
      const at = b.pluck();
      if (!at) break;
      picks++;
      got += 2 + Math.floor(rand.next() * 2);
      audio.play('pluck' as 'ui', { vol: 0.5, pitch: 1 + rand.next() * 0.3 });
      for (let q = 0; q < 6; q++) s.main.particles.spawn({ frame: A.leaves[q % A.leaves.length], x: at[0], y: at[1], vx: rand.range(-30, 30), vy: rand.range(-40, -10), ay: 120, life: 0.9, color: [0.5, 0.8, 0.4], alpha: 1, alpha1: 0, vrot: rand.range(-5, 5), flutter: 1, floorY: b.y + 2 });
      if (armed && i === 0) {
        // the telegraph: a hum from the ground, a scout comes up to look at you
        S.scoutLevel = 0.18;
        b.tremble = 0.8;
        const [hx, hy] = b.holes[0];
        scout = new Hornet(hx, hy, b, true);
        scout.mode = 'scout';
        scout.vy = -50;
        S.addHornet(scout);
        s.bark('mori', '...is the ground humming?', { expr: 'thinking', emote: 'question' });
        await new Promise(r => setTimeout(r, 650));
      } else if (armed && i === 1) {
        S.scoutLevel = 0.36;
        b.tremble = 1;
        s.st.shake(1, 0.4);
        s.bark('mori', 'Okay. That is DEFINITELY humming.', { expr: 'worried', emote: 'sweat' });
        await new Promise(r => setTimeout(r, 450));
        break;
      }
    }
    if (got) {
      const gave = add('berry_ember', got);
      const [cx, cy] = s.css(b.x, b.y - 24);
      if (gave) s.hud?.flyItem('berry_ember', gave, ITEMS.berry_ember?.name ?? 'Emberberries', cx, cy);
      audio.play('collectPop' as 'ui', { vol: 0.5 });
      if (!game.save.flags['v9:firstBerries']) {
        game.save.flags['v9:firstBerries'] = true;
        game.ui.toast('<b>Emberberries</b>: sweet and a little fizzy. Something has been nibbling the skins...', 'FORAGE', 'teal', 4200);
      }
      game.persist();
      s.hud?.refresh(true);
    }
    if (armed && picks >= 2) {
      vars['v9:hornetPity'] = 0;
      vars['v9:lastAmbushT'] = s.st.time;
      busy = false;
      await hornetAmbush(s, b.x, b.y + 3);
    } else if (armed) {
      // walked away in time: the scout goes home, the hum fades
      if (scout) scout.mode = 'home';
      S.scoutLevel = 0;
      if (scout) setTimeout(() => s.bark('mori', 'Backing away from the humming bush. Slowly. Respectfully.', { expr: 'worried' }), 300);
    }
  } finally {
    busy = false;
    if (!S.amb) { S.scoutLevel = 0; if (scout && scout.mode === 'scout') scout.mode = 'home'; }
  }
}

// ------------------------------------------------------------------ setup
export function startHornets(s: IslandScene4) {
  sys?.swarmBuzz.stop();
  sys?.nestBuzz.stop();
  const S = new HornetSystem(s);
  sys = S;
  busy = false;
  flowerHeads.length = 0;
  // flower clumps first (behind the bushes)
  for (const [x, kind] of FLOWERS) {
    const fc = flowerClump(Math.round(x), kind);
    const f = local.add(`v9:flw:${x}`, fc.spr.buf, fc.spr.ax, fc.spr.ay);
    const y = groundY(x) + 2;
    for (const [hx, hy] of fc.heads) flowerHeads.push([x + hx, y + hy]);
    s.main.add(new Custom(-2.55, (rr, st) => { if (x > rr.visibleX0(30) && x < rr.visibleX1(30)) rr.drawSway(f, x, y, 1, 1, Math.sin(st.time * 1.6 + x) * 0.6); }));
  }
  for (const d of BUSHES) {
    const b = new EmberBush(s, d.x, d.nest, d.seed);
    S.bushes.push(b);
    s.interact.push({
      x: b.x, get y() { return b.y; }, w: 22, h: 26, standX: b.x - 20,
      get label() { return b.count() ? 'Pick emberberries' : 'Ember bush (picked clean)'; },
      enabled: () => !s.cutscene && !S.amb,
      action: () => harvest(s, b),
    } as never);
    if (d.nest) {
      // ambient colony: foragers cycling in and out, one guard over the entrances
      for (let i = 0; i < 4; i++) {
        const h = new Hornet(b.x, b.y, b, true);
        h.orbit = i === 3 ? 5.6 : i * 1.3;
        h.timer = rand.range(0.2, 5);
        S.addHornet(h);
      }
      // a clump of flax to crouch into, a little way off
      const hx = d.x + (d.seed % 2 ? 92 : -92);
      const fl = sprite(`v9:hideflax:${d.seed}`, () => plant('flax', 970 + d.seed, 44));
      if (fl) { const fy = groundY(hx) + 3; s.main.add(new Custom(52, rr => { if (hx > rr.visibleX0(40) && hx < rr.visibleX1(40)) rr.drawSway(fl.f, hx, fy, 1, 1, Math.sin(game.r.time * 1.2 + hx) * 0.8); })); }
      s.player.hides.push({ x: hx, w: 30, y: groundY(hx), cover: 0.9 });
    }
  }
  // drawing: bushes and ambient hornets on the walk line, the swarm and the scout in front of Mori
  s.main.add(new Custom(-2.45, (rr, st) => { for (const b of S.bushes) b.draw(rr, st.time); S.drawPass(rr, false); }, dt => S.update(dt)));
  s.main.add(new Custom(56, rr => S.drawPass(rr, true)));
}

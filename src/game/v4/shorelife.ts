// V4 island wildlife on the shore: glass crabs that bolt into their burrows, swashrunners chasing the
// backwash, tōrea probing the wrack line, kelp skinks basking on warm rocks, kororā waddling home at
// dusk, the wheke peeking out of its rock pool, a pīwakawaka that follows you through the bush and the
// titiwai glowing in the sea cave. Every critter speaks the camera's subject interface; photos of new
// species are counted for the story.

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Drawable } from '../../world/stage';
import { local, A } from '../assets';
import { game } from '../game';
import { audio } from '../../core/audio';
import { clamp, rand } from '../../core/math';
import { CRITTER_FRAMES } from '../../art/island4/creatures';
import { ISL, groundY } from '../../art/island4/layout';
import type { Animal } from '../wild/animal';
import type { IslandScene4 } from './island';

export type ShoreKind = 'glasscrab' | 'swashrunner' | 'torea' | 'kelpskink' | 'korora' | 'wheke' | 'piwakawaka';
export const ISLAND_SPECIES = ['corvexseal', 'glasscrab', 'swashrunner', 'torea', 'kelpskink', 'korora', 'titiwai', 'piwakawaka', 'wheke'];

let frames: Record<string, Frame[]> | null = null;
function F(): Record<string, Frame[]> {
  if (frames && frames.glasscrab?.[0]?.tex) return frames;
  frames = {};
  for (const [k, fn] of Object.entries(CRITTER_FRAMES)) frames[k] = fn().map((b, i) => local.add(`shore:${k}${i}`, b, b.w / 2, b.h - 1));
  return frames;
}

/** a small animal living on the gameplay plane (camera subject) */
export class ShoreCritter implements Drawable {
  z = 30;
  x: number;
  y: number;
  vx = 0;
  p = 1;
  facing = 1;
  dead = false;
  gone = false;
  hidden = 0;
  speed = 0;
  eco = { attacksPlayer: 0, aggro: 0 };
  anger = 0;
  act = 'idle';
  behavior: string;
  t = rand.next() * 10;
  private timer = rand.range(1, 3);
  private hx: number;
  private hy = 0;
  private f = 0;
  body: { bounds: (a: ShoreCritter) => { x0: number; y0: number; x1: number; y1: number }; points: (a: ShoreCritter) => [number, number][] };

  constructor(readonly species: ShoreKind, readonly s: IslandScene4, x: number, readonly home: [number, number], y?: number) {
    this.x = x;
    this.hx = x;
    this.y = y ?? groundY(x);
    this.behavior = { glasscrab: 'scuttling', swashrunner: 'running', torea: 'probing', kelpskink: 'basking', korora: 'waddling', wheke: 'peeking', piwakawaka: 'flitting' }[species];
    const size = (): [number, number] => { const fr = F()[this.species]?.[0]; return fr ? [fr.w * 0.5, fr.h] : [5, 6]; };
    this.body = {
      bounds: a => { const [hw, h] = size(); return { x0: a.x - hw, y0: a.y - h, x1: a.x + hw, y1: a.y }; },
      points: a => { const [hw, h] = size(); return [[a.x, a.y - h * 0.5], [a.x - hw * 0.6, a.y - h * 0.4], [a.x + hw * 0.6, a.y - h * 0.4], [a.x, a.y - h * 0.85]]; },
    };
  }

  photoInfo() {
    return { species: this.species, behavior: this.behavior, box: this.body.bounds(this), pts: this.body.points(this), speed: this.speed, facing: this.facing, noticed: false, juvenile: false, p: this.p, hidden: this.hidden };
  }

  private near(r: number) {
    const p = this.s.player;
    return Math.abs(p.x - this.x) < r && Math.abs(p.y - this.y) < 40;
  }

  update(dt: number) {
    this.t += dt;
    this.timer -= dt;
    const p = this.s.player;
    const run = Math.abs(p.vx) > 70;
    switch (this.species) {
      case 'glasscrab': {
        // skitter about; bolt for the burrow when you come close (less if you creep)
        if (this.hidden > 0) {
          this.hidden = this.near(50) ? 1 : Math.max(0, this.hidden - dt * 0.25);
          this.behavior = 'burrowing';
          break;
        }
        if (this.near(run ? 90 : p.crouch ? 26 : 50)) { this.hidden = 1; this.s.sfx('rustle', this.x, 0.15, 1.4); break; }
        if (this.timer <= 0) { this.timer = rand.range(0.6, 2.4); this.vx = rand.chance(0.4) ? 0 : rand.range(-30, 30); }
        this.x = clamp(this.x + this.vx * dt, this.home[0], this.home[1]);
        this.y = groundY(this.x) + 4 + Math.sin(this.t * 0.3 + this.hx) * 3;
        this.f = this.vx ? Math.floor(this.t * 12) % 2 : 2 * (Math.sin(this.t) > 0.9 ? 1 : 0);
        this.behavior = 'scuttling';
        this.speed = Math.abs(this.vx);
        break;
      }
      case 'swashrunner': {
        // chase the backwash down, sprint back up ahead of the next wave
        const sw = this.s.swash.sheets[this.s.swash.sheets.length - 1];
        const back = sw ? sw.t > 2.2 && sw.t < 4.2 : true;
        const target = back ? 16 : 1;
        this.hy += (target - this.hy) * Math.min(1, dt * 3);
        if (this.timer <= 0) { this.timer = rand.range(0.8, 2); this.vx = rand.range(-50, 50); }
        if (this.near(run ? 110 : 60)) this.vx = Math.sign(this.x - p.x || 1) * 90;
        this.x = clamp(this.x + this.vx * dt, this.home[0], this.home[1]);
        this.vx *= 1 - dt * 1.5;
        this.y = groundY(this.x) + this.hy;
        this.speed = Math.abs(this.vx);
        this.f = this.speed > 12 ? Math.floor(this.t * 14) % 2 : Math.sin(this.t * 3 + this.hx) > 0.6 ? 2 : 0;
        this.behavior = this.speed > 12 ? 'running' : 'feeding';
        if (Math.abs(this.vx) > 4) this.facing = Math.sign(this.vx);
        break;
      }
      case 'torea': {
        if (this.near(run ? 120 : 55) && this.act !== 'flee') { this.act = 'flee'; this.vx = Math.sign(this.x - p.x || 1) * 110; this.s.sfx('birdCall', this.x, 0.35, 1.3); this.behavior = 'calling'; }
        if (this.act === 'flee') {
          this.x += this.vx * dt;
          this.hy = Math.min(40, this.hy + dt * 30);
          if (Math.abs(this.x - this.hx) > 160) { this.act = 'idle'; this.hx = this.x; this.hy = 0; }
        } else {
          if (this.timer <= 0) { this.timer = rand.range(1.5, 3.5); this.vx = rand.chance(0.5) ? 0 : rand.range(-14, 14); }
          this.x = clamp(this.x + this.vx * dt, this.home[0], this.home[1]);
          this.hy = Math.max(0, this.hy - dt * 40);
          this.behavior = this.vx ? 'probing' : Math.sin(this.t * 0.7) > 0.8 ? 'calling' : 'probing';
          if (Math.sin(this.t * 0.9 + this.hx) > 0.97 && rand.chance(dt * 4)) this.s.sfx('birdCall', this.x, 0.2, 1.3);
        }
        this.y = groundY(this.x) + 26 - this.hy;
        this.f = this.vx ? Math.floor(this.t * 6) % 2 : Math.sin(this.t * 2) > 0.3 ? 2 : 0;
        if (Math.abs(this.vx) > 2) this.facing = Math.sign(this.vx);
        this.speed = Math.abs(this.vx);
        break;
      }
      case 'kelpskink': {
        if (this.near(run ? 80 : 36) && this.act !== 'dart') { this.act = 'dart'; this.timer = 1.2; this.vx = Math.sign(this.x - p.x || 1) * 90; }
        if (this.act === 'dart') {
          this.x += this.vx * dt;
          this.behavior = 'hunting';
          if (this.timer <= 0) { this.act = 'idle'; this.vx = 0; this.hidden = 1; this.timer = rand.range(6, 10); }
        } else if (this.hidden > 0) {
          if (this.timer <= 0) { this.hidden = 0; this.x = this.hx; }
        } else this.behavior = 'basking';
        this.f = this.act === 'dart' ? Math.floor(this.t * 16) % 2 : 0;
        if (this.vx) this.facing = Math.sign(this.vx);
        this.speed = Math.abs(this.vx);
        break;
      }
      case 'korora': {
        // only at dusk: up out of the water, a waddle across the sand, gone into the dunes
        const dusk = this.s.clock.t > 2.7;
        if (!dusk) { this.hidden = 1; break; }
        if (this.hy === 0 && this.hidden >= 1) { this.hidden = 0; this.hy = 0.01; }
        this.hy += dt * (this.near(40) ? 0 : 3.2);
        if (this.hy > 70) { this.hidden = 1; this.hy = -9999; }
        this.x = this.hx + Math.sin(this.hy * 0.08) * 3;
        this.y = groundY(this.x) - 2 + Math.max(0, this.hy);
        this.f = Math.floor(this.t * 5) % 2;
        this.speed = 8;
        break;
      }
      case 'wheke': {
        // hides when you are close and fidgety, peeks out when things are calm
        const calm = !this.near(p.crouch ? 20 : 60) || Math.abs(p.vx) < 5;
        this.hidden = clamp(this.hidden + (calm ? -dt * 0.6 : dt * 2));
        this.behavior = this.hidden > 0.5 ? 'hiding' : 'peeking';
        this.f = Math.floor(this.t * 1.5) % 2;
        break;
      }
      case 'piwakawaka': {
        // flits around your head in the bush, snapping at the insects you stir up
        const tx = p.x + Math.sin(this.t * 1.3) * 34 + (p.facing * 10), ty = p.y - 50 + Math.sin(this.t * 2.1) * 14;
        if (Math.abs(p.x - this.hx) < 700) {
          this.x += (tx - this.x) * Math.min(1, dt * 2.5);
          this.y += (ty - this.y) * Math.min(1, dt * 2.5);
        }
        this.facing = tx > this.x ? 1 : -1;
        this.f = Math.floor(this.t * 10) % 2;
        this.speed = 30;
        if (rand.chance(dt * 0.15)) this.s.sfx('birdCall', this.x, 0.25, 1.35);
        break;
      }
    }
  }

  draw(r: Renderer) {
    if (this.hidden >= 1 && this.species !== 'wheke') return;
    const list = F()[this.species];
    if (!list) return;
    const f = list[Math.max(0, Math.min(list.length - 1, this.f))];
    if (this.species === 'wheke') {
      const k = 1 - this.hidden;
      if (k < 0.05) return;
      r.drawSub(f, 0, 0, f.w, Math.max(1, Math.round(f.h * k)), this.x - f.w / 2, this.y - f.h * k);
      return;
    }
    r.beginShadows();
    r.draw(A.shadow, this.x, this.y, 0.25, 0.25, 0, packColor(0, 0, 0, 0.35));
    r.endShadows();
    r.draw(f, this.x, this.y, this.facing, 1);
  }
}

/** the titiwai in the sea cave, as one photo subject */
export class TitiwaiSubject {
  species = 'titiwai';
  x = 5250;
  y = 90;
  p = 1;
  z = 30;
  dead = false;
  gone = false;
  hidden = 0;
  eco = { attacksPlayer: 0, aggro: 0 };
  anger = 0;
  act = 'idle';
  body = {
    bounds: () => ({ x0: 5100, y0: 66, x1: 5400, y1: 110 }),
    points: (): [number, number][] => [[5140, 80], [5200, 90], [5250, 84], [5300, 92], [5360, 86]],
  };
  photoInfo() { return { species: 'titiwai', behavior: 'glowing', box: this.body.bounds(), pts: this.body.points(), speed: 0, facing: 1, noticed: false, juvenile: false, p: 1, hidden: 0 }; }
  update() {}
  draw() {}
}

/** spawn the island's shore life and count first photos of each species */
export function startShoreLife(s: IslandScene4) {
  const add = (c: ShoreCritter | TitiwaiSubject) => {
    if (c instanceof ShoreCritter) s.main.add(c);
    s.animals.push(c as unknown as Animal);
  };
  for (const [x0, x1] of [[1500, 1900], [2200, 2700], [3300, 3700], [4000, 4200]] as const) for (let i = 0; i < 3; i++) add(new ShoreCritter('glasscrab', s, rand.range(x0, x1), [x0, x1]));
  for (const [x0, x1] of [[1900, 2400], [2900, 3400], [4600, 4950], [5500, 5850]] as const) for (let i = 0; i < 3; i++) add(new ShoreCritter('swashrunner', s, rand.range(x0, x1), [x0, x1]));
  for (const x of [2500, 3150, 3950, 4150]) add(new ShoreCritter('torea', s, x, [x - 90, x + 90]));
  for (const x of [380, 4260, 4700, 5600]) add(new ShoreCritter('kelpskink', s, x, [x - 20, x + 20], groundY(x) - 6));
  for (const x of [1640, 2240, 3560]) add(new ShoreCritter('korora', s, x, [x, x]));
  add(new ShoreCritter('wheke', s, 200, [200, 200], ISL.GY + 52));
  add(new ShoreCritter('piwakawaka', s, 6200, [5950, 6900], groundY(6200) - 50));
  add(new TitiwaiSubject());
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

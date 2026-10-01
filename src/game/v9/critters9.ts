// V9 strange island animals and parasites, and the small ambient life that fills every zone.
// Every critter here is a camera subject (the ShoreCritter interface: photoInfo, body.bounds/points,
// x, y, vx, vy, dead, gone, hidden, eco, anger, act) and updates only near the camera:
//  - amber snails grazing low in the litter, and the ones carrying the puppeteer fluke, which climb
//    to the tops of stems in the open with a fat banded eye stalk throbbing like a caterpillar
//  - tin-can hermits wearing Kittiwake rubbish near the wreck (they duck inside when you come close)
//  - periscope sand eel colonies standing out of the wet sand, snapping back one after another as
//    you approach and rising again when everything is still
//  - wrack piles on the walk line: walk (or let Chunk trot) through and the sand hoppers spray up
//  - leaf-veil mantises swaying on twigs, striking at flies
//  - lantern moths flashing round the flowers at dusk; mudskip gobies on the stream-mouth mud,
//    flaring their sails and skipping away; jewel beetles on the flowers
//  - zombie-cap fungus: dead jewel hornets clamped to twigs on the bush track, puffing spores
//  - ambient: flies over the wrack, midge clouds over the water, water striders, ants on the track

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Drawable } from '../../world/stage';
import type { IslandScene4 } from '../v4/island';
import type { Animal } from '../wild/animal';
import { local, A } from '../assets';
import { audio } from '../../core/audio';
import { clamp, damp, rand } from '../../core/math';
import { SPOT, groundY } from '../../art/island4/layout';
import { CRIT, wrackPile, hopper, HermitHome, bake } from '../../art/v9/wild/critters';
import { hornetFrame } from '../../art/v9/wild/hornet';
import type { Sprite } from '../../art/v9/wild/rocks';
import { Sk, rmp } from '../../art/beasts-core';
import { flowerHeads } from './hornets';

// ------------------------------------------------------------------ frames (scene-local atlas)
let owner: unknown = null;
const frames = new Map<string, Frame>();
function F(key: string, make: () => Sprite): Frame {
  if (owner !== local) { frames.clear(); owner = local; }
  let f = frames.get(key);
  if (!f) { const s = make(); f = local.add('v9c:' + key, s.buf, s.ax, s.ay); frames.set(key, f); }
  return f;
}

type Box = { x0: number; y0: number; x1: number; y1: number };

/** the shared camera-subject plumbing */
abstract class Crit implements Drawable {
  z = 30;
  p = 1;
  vx = 0;
  vy = 0;
  facing = 1;
  dead = false;
  gone = false;
  hidden = 0;
  eco = { attacksPlayer: 0, aggro: 0 };
  anger = 0;
  act = 'idle';
  behavior = 'idle';
  t = rand.next() * 10;
  noticed = false;
  abstract species: string;
  constructor(readonly s: IslandScene4, public x: number, public y: number) {}
  abstract box(): Box;
  body = {
    bounds: (a: Crit) => a.box(),
    points: (a: Crit): [number, number][] => { const b = a.box(); const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2; return [[cx, cy], [b.x0 + (cx - b.x0) * 0.4, cy], [b.x1 - (b.x1 - cx) * 0.4, cy], [cx, b.y0 + (cy - b.y0) * 0.5]]; },
  };
  photoInfo() {
    return { species: this.species, behavior: this.behavior, box: this.box(), pts: this.body.points(this), speed: Math.hypot(this.vx, this.vy), facing: 1, noticed: this.noticed, juvenile: false, p: 1, hidden: this.hidden };
  }
  near(): boolean { return Math.abs(this.s.st.cam.x - this.x) < 720; }
  /** how disturbing the nearest walker is: 0 far .. 1 on top of it (running counts double, creeping half) */
  disturb(r: number): number {
    const p = this.s.player;
    let k = 0;
    if (Math.abs(p.y - this.y) < 60) {
      const mv = Math.abs(p.vx);
      const mul = mv > 75 ? 1.8 : p.crouch || p.state === 'hide' ? 0.45 : mv < 4 ? 0.6 : 1;
      k = clamp(1 - Math.abs(p.x - this.x) / (r * mul));
    }
    const c = this.s.chunk;
    if (c?.visible && Math.abs(c.y - this.y) < 50) k = Math.max(k, clamp(1 - Math.abs(c.x - this.x) / (r * 1.2)));
    return k;
  }
  onScreen(r: Renderer, m = 30) { return this.x > r.visibleX0(m) && this.x < r.visibleX1(m); }
  abstract update(dt: number): void;
  abstract draw(r: Renderer): void;
}

// ------------------------------------------------------------------ snails and the puppeteer fluke
const stemSprite = (h: number) => bake('stem' + h, 16, h + 6, 6, h + 2, sk => {
  const g = sk.m(rmp('#4a7a2a', { n: 4, dark: 0.6, light: 0.4 }), { edge: 1 });
  sk.np();
  sk.tube([[0, 0], [0.8, -h * 0.5], [0.3, -h]], t => 0.8 - t * 0.3, g, { z: 0 });
  sk.np();
  sk.blade(0.3, -h + 1, 6, -h - 2, s => Math.sin(s * Math.PI) * 1.8 + 0.3, g, { z0: 1, z1: 1 });
});

class Snail extends Crit {
  species: string;
  private f = 0;
  private walkT = rand.range(2, 5);
  private tuck = 0;
  /** climbing: 0 at the foot of the stem .. 1 at the top */
  private climb = 0;
  private stemH = 30;
  constructor(s: IslandScene4, x: number, readonly infected: boolean) {
    super(s, x, groundY(x) + 1);
    this.species = infected ? 'puppetfluke' : 'ambersnail';
    this.z = infected ? -2.3 : -2.2;
    this.climb = infected ? rand.range(0, 0.5) : 0;
  }
  box(): Box {
    if (this.infected && this.climb > 0.05) { const y = this.y - this.stemH * this.climb; return { x0: this.x - 6, y0: y - 9, x1: this.x + 8, y1: y + 1 }; }
    return { x0: this.x - 6, y0: this.y - 9, x1: this.x + 8, y1: this.y };
  }
  update(dt: number) {
    if (!this.near()) return;
    this.t += dt;
    if (this.infected) {
      // the fluke drives its host up into the light, where the birds are
      this.climb = Math.min(1, this.climb + dt / 90);
      this.behavior = this.climb < 1 ? 'climbing' : 'pulsing';
      this.f = Math.floor(this.t * 2) % 4;
      return;
    }
    const d = this.disturb(28);
    this.tuck = damp(this.tuck, d > 0.3 ? 1 : 0, d > 0.3 ? 12 : 0.5, dt);
    this.hidden = this.tuck > 0.5 ? 0.3 : 0;
    this.behavior = this.tuck > 0.5 ? 'hiding' : 'grazing';
    this.noticed = this.tuck > 0.5;
    if (this.tuck < 0.1) {
      this.walkT -= dt;
      if (this.walkT < 0) { this.walkT = rand.range(3, 7); this.facing = rand.sign(); }
      this.x += this.facing * 1.2 * dt;
      this.vx = this.facing * 1.2;
      this.y = groundY(this.x) + 1;
      this.f = Math.floor(this.t * 1.5) % 4;
    } else this.vx = 0;
  }
  draw(r: Renderer) {
    if (!this.onScreen(r)) return;
    if (this.infected) {
      const st = F('stem' + this.stemH, () => stemSprite(this.stemH));
      r.draw(st, this.x, this.y);
      const pulse = Math.floor(this.t * 5) % 4;
      const fr = F(`sn:1:${pulse}`, () => CRIT.snail(2, true, pulse, false));
      if (this.climb < 1) r.draw(fr, this.x + 1, this.y - this.stemH * this.climb, 1, 1, -Math.PI / 2);
      else r.draw(fr, this.x + 3, this.y - this.stemH - 1);
      return;
    }
    const fr = F(`sn:0:${this.tuck > 0.5 ? 't' : this.f}`, () => CRIT.snail(this.f, false, 0, this.tuck > 0.5));
    r.draw(fr, this.x, this.y, this.facing, 1);
  }
}

// ------------------------------------------------------------------ tin-can hermits
class Hermit extends Crit {
  species = 'canhermit';
  private f = 0;
  private walkT = rand.range(1, 3);
  private inT = 0;
  constructor(s: IslandScene4, x: number, readonly home: HermitHome, readonly range: [number, number]) {
    super(s, x, groundY(x) + 3);
    this.z = 48;
  }
  box(): Box { const w = this.home === 'can' ? 9 : 6; return { x0: this.x - w, y0: this.y - (this.home === 'can' ? 9 : 6), x1: this.x + w, y1: this.y }; }
  update(dt: number) {
    if (!this.near()) return;
    this.t += dt;
    const d = this.disturb(34);
    if (d > 0.25) this.inT = rand.range(3, 6);
    this.inT -= dt;
    const inside = this.inT > 0;
    this.behavior = inside ? 'hiding' : 'wandering';
    this.noticed = inside;
    if (!inside) {
      this.walkT -= dt;
      if (this.walkT < 0) { this.walkT = rand.range(1.5, 4); this.vx = rand.chance(0.3) ? 0 : rand.sign() * rand.range(5, 9); }
      this.x = clamp(this.x + this.vx * dt, this.range[0], this.range[1]);
      if (this.x <= this.range[0] || this.x >= this.range[1]) this.vx = -this.vx;
      if (Math.abs(this.vx) > 1) this.facing = Math.sign(this.vx);
      this.f = this.vx ? Math.floor(this.t * 6) % 4 : 0;
      // the tin scrapes on the sand
      if (this.vx && rand.chance(dt * 0.4)) this.s.sfx('rustle', this.x, 0.08, 2.4);
    } else this.vx = 0;
    this.y = groundY(this.x) + 3;
  }
  draw(r: Renderer) {
    if (!this.onScreen(r)) return;
    const inside = this.inT > 0;
    const f = F(`hm:${this.home}:${inside ? 'in' : this.f}`, () => CRIT.hermit(this.home, this.f, inside));
    r.beginShadows();
    r.draw(A.shadow, this.x, this.y + 1, 0.4, 0.3, 0, packColor(0, 0, 0, 0.3));
    r.endShadows();
    r.draw(f, Math.round(this.x), this.y, this.facing, 1);
  }
}

// ------------------------------------------------------------------ periscope sand eels
const holeSprite = () => bake('eelhole', 6, 4, 3, 2, sk => {
  // a little dimple in the wet sand with a darker pinhole
  const rim = sk.m(rmp('#7a6a50', { n: 2, dark: 0.3, light: 0.2 }), { edge: 0, noRim: true });
  const m = sk.m(rmp('#3a3226', { n: 2, dark: 0.3, light: 0.2 }), { edge: 0, noRim: true });
  sk.ell(0, 0, 1.4, 0.7, rim);
  sk.dot(0, 0, m, 0.5, 2);
}, 0, false);
class Eel extends Crit {
  species = 'periscopeeel';
  private h = rand.range(0, 3);
  private mouthT = 0;
  private puff = 0;
  constructor(s: IslandScene4, x: number, y: number) {
    super(s, x, y);
    this.z = 52;
  }
  box(): Box { const L = 2 + (this.h / 3) * 11; return { x0: this.x - 3, y0: this.y - L - 2, x1: this.x + 4, y1: this.y }; }
  update(dt: number) {
    if (!this.near()) return;
    this.t += dt;
    const d = this.disturb(48);
    if (d > 0.05) {
      if (this.h > 0.5) { this.puff = 0.4; if (rand.chance(0.4)) this.s.sfx('rustle', this.x, 0.06, 2.8); }
      this.h = Math.max(0, this.h - dt * 24);
    } else this.h = Math.min(3, this.h + dt * 0.6);
    this.puff = Math.max(0, this.puff - dt);
    this.hidden = this.h < 0.6 ? 1 : 0;
    this.mouthT -= dt;
    if (this.mouthT < -0.15) this.mouthT = rand.range(0.4, 2.2);
    this.behavior = this.h < 0.6 ? 'hiding' : this.mouthT < 0 ? 'feeding' : 'peeking';
  }
  draw(r: Renderer) {
    if (!this.onScreen(r)) return;
    r.draw(F('eelhole', holeSprite), this.x, this.y);
    if (this.puff > 0) for (let i = 0; i < 3; i++) r.draw(A.dot2, this.x + (i - 1) * 2 * (1.4 - this.puff), this.y - 1 - (0.4 - this.puff) * 8, 0.6, 0.6, 0, packColor(0.75, 0.68, 0.55, this.puff * 2));
    const lv = Math.round(this.h);
    if (lv < 1) return;
    const sway = Math.round(Math.sin(this.t * 1.3 + this.x) + 1);
    const m = this.mouthT < 0 ? 1 : 0;
    r.draw(F(`eel${lv}${sway}${m}`, () => CRIT.eel(lv, sway, m)), this.x, this.y);
  }
}

// ------------------------------------------------------------------ wrack piles and sand hoppers
interface Hop { x: number; y: number; vx: number; vy: number; t: number; air: boolean }
class Wrack extends Crit {
  species = 'wrackhopper';
  private hops: Hop[] = [];
  private cool = 0;
  private flies: { a: number; r: number; s: number }[] = [];
  constructor(s: IslandScene4, x: number, readonly seed: number) {
    super(s, x, groundY(x) + 2);
    this.z = 46;
    for (let i = 0; i < 16; i++) this.hops.push({ x: this.x + rand.range(-14, 14), y: this.y, vx: 0, vy: 0, t: 0, air: false });
    for (let i = 0; i < 4; i++) this.flies.push({ a: rand.next() * 6, r: rand.range(4, 12), s: rand.range(3, 7) * rand.sign() });
  }
  box(): Box {
    const air = this.hops.filter(h => h.air);
    if (!air.length) return { x0: this.x - 10, y0: this.y - 6, x1: this.x + 10, y1: this.y };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const h of air) { x0 = Math.min(x0, h.x); y0 = Math.min(y0, h.y); x1 = Math.max(x1, h.x); y1 = Math.max(y1, h.y); }
    return { x0: x0 - 3, y0: y0 - 3, x1: x1 + 3, y1: Math.max(y1, y0 + 6) + 1 };
  }
  update(dt: number) {
    if (!this.near()) return;
    this.t += dt;
    this.cool -= dt;
    const d = this.disturb(18);
    if (d > 0.2 && this.cool <= 0) {
      this.cool = 2.5;
      for (const h of this.hops) { h.air = true; h.vx = rand.range(-55, 55); h.vy = rand.range(-120, -50); h.x = this.x + rand.range(-14, 14); h.y = this.y - 1; }
      this.s.sfx('rustle', this.x, 0.18, 2.6);
    } else if (rand.chance(dt * 0.25)) {
      const h = rand.pick(this.hops);
      if (!h.air) { h.air = true; h.vx = rand.range(-25, 25); h.vy = rand.range(-70, -35); }
    }
    let any = false;
    for (const h of this.hops) {
      if (!h.air) continue;
      any = true;
      h.vy += 380 * dt;
      h.x += h.vx * dt; h.y += h.vy * dt;
      h.t += dt;
      if (h.y >= this.y && h.vy > 0) {
        // bounce once or twice, then dig back in under the kelp
        if (Math.abs(h.vy) > 60 && rand.chance(0.6)) { h.vy *= -0.45; h.vx *= 0.6; h.y = this.y; }
        else { h.air = false; h.x = this.x + rand.range(-14, 14); h.y = this.y; }
      }
    }
    this.hidden = any ? 0 : 1;
    this.behavior = 'leaping';
    this.vx = any ? 30 : 0;
  }
  draw(r: Renderer) {
    if (!this.onScreen(r, 40)) return;
    r.draw(F('wrack' + this.seed, () => wrackPile(this.seed)), this.x, this.y + 1);
    const f0 = F('hop0', () => hopper(0)), f1 = F('hop1', () => hopper(1));
    for (const h of this.hops) if (h.air) r.draw(h.vy < 0 ? f1 : f0, h.x, h.y, h.vx < 0 ? -1 : 1, 1);
    // a few kelp flies hanging over the pile
    for (const fl of this.flies) {
      const a = fl.a + this.t * fl.s;
      r.rect(this.x + Math.cos(a) * fl.r, this.y - 6 - Math.sin(a * 1.7) * 3 - fl.r * 0.3, 1, 1, packColor(0.12, 0.12, 0.14, 1));
    }
  }
}

// ------------------------------------------------------------------ leaf-veil mantis
class Mantis extends Crit {
  species = 'leafmantis';
  private strikeT = 0;
  private fly = { x: 0, y: 0, on: false, t: 0 };
  private flyT = rand.range(3, 8);
  constructor(s: IslandScene4, x: number, y: number) {
    super(s, x, y);
    this.z = -2.1;
    this.hidden = 0.3;
  }
  box(): Box { return { x0: this.x - 9, y0: this.y - 10, x1: this.x + 7, y1: this.y + 2 }; }
  update(dt: number) {
    if (!this.near()) return;
    this.t += dt;
    this.strikeT = Math.max(0, this.strikeT - dt);
    this.flyT -= dt;
    if (!this.fly.on && this.flyT < 0) { this.fly = { x: this.x + 40, y: this.y - 12, on: true, t: 0 }; }
    if (this.fly.on) {
      const f = this.fly;
      f.t += dt;
      f.x += (this.x + 9 - f.x) * dt * 0.8 + Math.sin(f.t * 13) * 18 * dt;
      f.y = this.y - 6 + Math.sin(f.t * 9) * 5;
      if (Math.abs(f.x - this.x - 9) < 3 && this.strikeT <= 0) { this.strikeT = 0.35; f.on = false; this.flyT = rand.range(5, 11); }
    }
    this.behavior = this.strikeT > 0 ? 'striking' : 'swaying';
  }
  draw(r: Renderer) {
    if (!this.onScreen(r)) return;
    const f = Math.floor(this.t * 1.6 * (0.6 + this.s.st.wind)) % 4;
    const strike = this.strikeT > 0;
    r.draw(F(`mt${strike ? 's' : f}`, () => CRIT.mantis(f, strike)), this.x, this.y);
    if (this.fly.on) r.rect(this.fly.x, this.fly.y, 1, 1, packColor(0.1, 0.1, 0.1, 1));
  }
}

// ------------------------------------------------------------------ lantern moths (dusk and night)
class Moth extends Crit {
  species = 'lanternmoth';
  private hx: number;
  private hy: number;
  private restT = 0;
  private flash = rand.next() * 6;
  constructor(s: IslandScene4, x: number, y: number) {
    super(s, x, y);
    this.hx = x; this.hy = y;
    this.z = 57;
  }
  box(): Box { return { x0: this.x - 7, y0: this.y - 6, x1: this.x + 7, y1: this.y + 5 }; }
  get dusk() { return this.s.clock.t > 2.7; }
  update(dt: number) {
    if (!this.near()) return;
    this.t += dt;
    if (!this.dusk) { this.hidden = 1; return; }
    this.hidden = 0;
    this.restT -= dt;
    if (this.restT < -6 && rand.chance(dt * 0.2)) this.restT = rand.range(2, 5);
    if (this.restT > 0) { this.vx = this.vy = 0; this.behavior = 'resting'; return; }
    // flutter about the flowers; dodge a moving camera-holder
    const tx = this.hx + Math.sin(this.t * 0.7) * 26, ty = this.hy + Math.sin(this.t * 1.3) * 10;
    this.vx += ((tx - this.x) * 1.4 + rand.range(-90, 90)) * dt;
    this.vy += ((ty - this.y) * 1.4 + rand.range(-110, 110)) * dt;
    this.vx *= 0.95; this.vy *= 0.95;
    if (this.disturb(26) > 0.4) { this.vx += Math.sign(this.x - this.s.player.x) * 300 * dt; this.vy -= 200 * dt; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (Math.abs(this.vx) > 3) this.facing = Math.sign(this.vx);
    this.behavior = 'flying';
  }
  draw(r: Renderer) {
    if (this.hidden >= 1 || !this.onScreen(r)) return;
    const flying = this.restT <= 0;
    const f = flying ? Math.floor(this.t * 12) % 4 : 3;
    r.draw(F('moth' + f, () => CRIT.moth(f)), this.x, this.y, this.facing, 1);
    // the spots glow only in flight: a slow pulse with quick flashes
    if (flying) {
      this.flash += 0.016;
      const k = 0.55 + 0.45 * Math.max(0, Math.sin(this.t * 3.1 + this.x)) ** 4;
      r.fxDraw(A.glow, this.x + this.facing * 1, this.y - 2, 0.16, 0.16, 0, packColor(1, 0.95, 0.55, 1), 2.6 * k);
      r.light(this.x, this.y - 2, 22, 1, 0.92, 0.55, 0.5 * k);
    }
  }
}

// ------------------------------------------------------------------ mudskip gobies
class Goby extends Crit {
  species = 'skipgoby';
  private skipN = 0;
  private air = 0;
  private displayT = rand.range(3, 9);
  private f = 0;
  constructor(s: IslandScene4, x: number, readonly range: [number, number]) {
    super(s, x, groundY(x) + 6);
    this.z = 51;
  }
  box(): Box { return { x0: this.x - 6, y0: this.y - 7 - this.air, x1: this.x + 6, y1: this.y - this.air }; }
  update(dt: number) {
    if (!this.near()) return;
    this.t += dt;
    const d = this.disturb(40);
    if (d > 0.1 && this.skipN === 0 && this.air === 0) { this.skipN = 3; this.facing = Math.sign(this.x - this.s.player.x) || 1; }
    if (this.skipN > 0) {
      // a run of skips: each a little parabola, splashing at the stream
      this.vy += 400 * dt;
      this.air = Math.max(0, this.air - this.vy * dt);
      this.x = clamp(this.x + this.facing * 70 * dt, this.range[0], this.range[1]);
      if (this.x <= this.range[0] || this.x >= this.range[1]) this.facing = -this.facing;
      if (this.air <= 0 && this.vy > 0) {
        this.skipN--;
        if (Math.abs(this.x - SPOT.stream) < 40) this.s.splash(this.x, groundY(this.x) + 4, 0.25);
        if (this.skipN > 0) { this.vy = -110; this.air = 0.01; }
      }
      this.behavior = 'skipping';
      this.noticed = true;
      this.vx = this.facing * 70;
    } else {
      this.vx = 0; this.air = 0; this.vy = -110;
      this.noticed = false;
      this.displayT -= dt;
      if (this.displayT < -2.2) this.displayT = rand.range(5, 12);
      this.behavior = this.displayT < 0 ? 'display' : 'basking';
      this.f = Math.floor(this.t * 2) % 2;
    }
    this.y = groundY(this.x) + 6;
  }
  draw(r: Renderer) {
    if (!this.onScreen(r)) return;
    const pose = this.skipN > 0 ? 2 : this.displayT < 0 ? 1 : 0;
    r.draw(F(`gb${pose}${this.f}`, () => CRIT.goby(pose, this.f)), this.x, this.y - this.air, this.facing, 1);
  }
}

// ------------------------------------------------------------------ jewel beetles on the flowers
class Beetle extends Crit {
  species = 'jewelbeetle';
  private on: [number, number] | null = null;
  private stay = rand.range(4, 9);
  constructor(s: IslandScene4, x: number, y: number) {
    super(s, x, y);
    this.on = [x, y];
    this.z = -2.2;
  }
  box(): Box { return { x0: this.x - 3.5, y0: this.y - 3, x1: this.x + 3.5, y1: this.y + 2 }; }
  update(dt: number) {
    if (!this.near()) return;
    this.t += dt;
    this.stay -= dt;
    if (this.on && (this.stay < 0 || this.disturb(16) > 0.3)) {
      const opts = flowerHeads.filter(([fx]) => Math.abs(fx - this.x) < 120 && Math.abs(fx - this.x) > 3);
      if (opts.length) { this.on = null; const [tx, ty] = rand.pick(opts); this.vx = tx; this.vy = ty; }
      else this.stay = 5;
    }
    if (!this.on) {
      // fly: tx/ty parked in vx/vy while airborne
      const tx = this.vx, ty = this.vy - 1;
      this.x += clamp(tx - this.x, -40 * dt, 40 * dt);
      this.y += clamp(ty - this.y, -30 * dt, 30 * dt) + Math.sin(this.t * 9) * 0.3;
      this.facing = tx > this.x ? 1 : -1;
      if (Math.abs(tx - this.x) < 1 && Math.abs(ty - this.y) < 1) { this.on = [tx, ty]; this.stay = rand.range(5, 12); }
      this.behavior = 'flying';
      this.z = 57;
    } else { this.behavior = 'feeding'; this.z = -2.2; }
  }
  photoInfo() {
    const o = super.photoInfo();
    if (!this.on) { o.speed = 40; }
    return o;
  }
  draw(r: Renderer) {
    if (!this.onScreen(r)) return;
    const fl = !this.on;
    const f = fl ? Math.floor(this.t * 24) % 2 : Math.floor(this.t * 2) % 2;
    r.draw(F(`bt${f}${fl ? 1 : 0}`, () => CRIT.beetle(f, fl)), this.x, this.y, this.facing, 1);
  }
}

// ------------------------------------------------------------------ the zombie-cap fungus on dead hornets
class ZombieCap extends Crit {
  species = 'hornetcap';
  private puffT = rand.range(1, 4);
  constructor(s: IslandScene4, x: number, y: number) {
    super(s, x, y);
    this.z = -2.1;
    this.behavior = 'sporing';
  }
  box(): Box { return { x0: this.x - 7, y0: this.y - 9, x1: this.x + 7, y1: this.y + 3 }; }
  update(dt: number) {
    if (!this.near()) return;
    this.t += dt;
    this.puffT -= dt;
    if (this.puffT < 0) {
      this.puffT = rand.range(2.5, 6);
      for (let i = 0; i < 7; i++) this.s.main.glowParticles.spawn({ frame: A.dot, x: this.x + 0.3, y: this.y - 6, vx: rand.range(-8, 8), vy: rand.range(-10, -3), life: rand.range(1.5, 2.6), color: [1, 0.85, 0.6], alpha: 0.8, alpha1: 0, intensity: 0.6 });
    }
  }
  draw(r: Renderer) {
    if (!this.onScreen(r)) return;
    r.draw(F('zcap', () => hornetFrame('dead')), this.x, this.y);
  }
}

// ------------------------------------------------------------------ ambient: midges and water striders
class Ambient implements Drawable {
  z = 53;
  private t = 0;
  constructor(readonly s: IslandScene4, readonly clouds: [number, number][], readonly striders: [number, number][]) {}
  update(dt: number) { this.t += dt; }
  draw(r: Renderer) {
    const x0 = r.visibleX0(20), x1 = r.visibleX1(20);
    const dusk = this.s.clock.t > 2.3;
    for (const [cx, cy] of this.clouds) {
      if (cx < x0 || cx > x1) continue;
      for (let i = 0; i < (dusk ? 22 : 12); i++) {
        const a = this.t * (1.5 + (i % 5) * 0.4) + i * 2.3;
        r.rect(cx + Math.sin(a) * (6 + (i % 4) * 3), cy + Math.cos(a * 1.3) * 4 - (i % 3) * 2, 1, 1, packColor(0.15, 0.15, 0.13, 0.9));
      }
    }
    for (const [sx, sy] of this.striders) {
      if (sx < x0 || sx > x1) continue;
      for (let i = 0; i < 3; i++) {
        const ph = this.t * 0.4 + i * 2.1;
        const x = sx + Math.sin(ph) * 22 + Math.sin(ph * 3.1) * 4, y = sy + i * 3;
        r.rect(x - 1.5, y, 3, 1, packColor(0.1, 0.12, 0.12, 1));
        r.rect(x - 2.5, y + 1, 1, 1, packColor(0.1, 0.12, 0.12, 0.8)); r.rect(x + 1.5, y + 1, 1, 1, packColor(0.1, 0.12, 0.12, 0.8));
        const rk = (this.t * 1.5 + i) % 1;
        r.fxDraw(A.ring, x, y + 1.5, 0.25 + rk * 0.5, 0.1 + rk * 0.15, 0, packColor(0.85, 0.95, 1, 1), 0.35 * (1 - rk));
      }
    }
  }
}

/** spawn it all */
export function startCritters9(s: IslandScene4) {
  const put = (c: Crit) => { s.main.add(c); s.animals.push(c as unknown as Animal); };
  // snails at the bush edge and the grove; three carry the fluke and climb the stems
  for (const x of [5930, 6015, 2765, 3150]) put(new Snail(s, x, false));
  for (const x of [5968, 6125, 2995]) put(new Snail(s, x, true));
  // tin-can hermits round the wreck and the top of the landing beach
  put(new Hermit(s, 1080, 'can', [1020, 1180]));
  put(new Hermit(s, 1250, 'cap', [1200, 1320]));
  put(new Hermit(s, 1420, 'jar', [1380, 1450]));
  put(new Hermit(s, 940, 'cap', [900, 1000]));
  // periscope eel colonies in the wet sand
  for (const [x0, n] of [[1585, 6], [3430, 7], [4880, 5], [5520, 6]] as const)
    for (let i = 0; i < n; i++) put(new Eel(s, x0 + i * 7 + rand.range(-2, 2), groundY(x0 + i * 7) + 9 + rand.range(0, 7)));
  // wrack piles on the walk line
  [1440, 2470, 3350, 3640, 4065, 4420, 5610, 5840].forEach((x, i) => put(new Wrack(s, x, i + 3)));
  // leaf-veil mantises on twigs in the grove and the bush
  for (const x of [2790, 3185, 6205, 6600]) put(new Mantis(s, x, groundY(x) - 22));
  // lantern moths (dusk), round the flowers and the bush track
  for (const [x, y] of flowerHeads.filter((_, i) => i % 4 === 0)) put(new Moth(s, x, y - 14));
  for (const x of [5960, 6250, 6520, 6820]) put(new Moth(s, x, groundY(x) - 30));
  // mudskip gobies on the stream-mouth mud
  for (const x of [3712, 3740, 3820, 3850, 3878]) put(new Goby(s, x, [3690, 3900]));
  // jewel beetles on the flowers
  flowerHeads.forEach(([x, y], i) => { if (i % 6 === 2) put(new Beetle(s, x, y - 1)); });
  // zombie-cap hornets on twigs up the bush track
  for (const x of [6150, 6425, 6705]) put(new ZombieCap(s, x, groundY(x) - 26));
  // ambient: midges over the water, striders on the stream and the creek, ants on the track
  const amb = new Ambient(s, [[SPOT.stream - 20, groundY(SPOT.stream) - 30], [SPOT.creek, groundY(SPOT.creek) - 28], [5070, 150], [2300, 180]],
    [[SPOT.stream, groundY(SPOT.stream) + 14], [SPOT.creek, groundY(SPOT.creek) + 3]]);
  s.main.add(amb);
  for (const x of [5990, 6330, 6690]) for (let i = 0; i < 6; i++) s.insects.spawn('ant', x + i * 7, groundY(x + i * 7) + 1, 1, 0);
  void audio;
}

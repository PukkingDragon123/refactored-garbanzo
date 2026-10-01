// V9 environmental life for the east half of the island:
//   CaveDrips    water gathering on the cave roof and falling: a drop stretches, lets go, streaks down
//                and plinks into the pool (rings, a tiny splash, an echoing drip) or the wet floor;
//   CliffBirds   seabirds wheeling off the nesting ledges of the cliffs and settling again;
//   SeaSpray     waves bursting white over the outer seal rocks, the spray hanging and drifting;
//   Drifters     airborne bits by place: pollen and thistle seeds over the stream banks, salt haze
//                under the cliffs, dust motes in the cave's shafts, spores and petals in the bush;
//   GroundMist   low mist pooling in the forest hollows at dawn and dusk.
// Everything culls to the visible range and reuses fixed records (no per-frame allocation).

import type { Renderer } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Drawable, Stage, Layer } from '../../world/stage';
import { A } from '../assets';
import { Rng, clamp, hash2, rand } from '../../core/math';
import { groundY } from '../../art/island4/layout';
import { CAVE_POOL, baseTop, cavePoolHw } from '../../art/v9/eastgeo';
import type { DayClock } from '../v4/islefx';
import type { PoolRings } from './streamfx';

interface Drop { x: number; y0: number; floor: number; pool: boolean; t: number; grow: number; vy: number; y: number; falling: boolean }

/** drips from the cave roof (sources at world (x, y)) into the pool or onto the floor */
export class CaveDrips implements Drawable {
  z = 31;
  private d: Drop[] = [];
  constructor(srcs: [number, number][], readonly rings: PoolRings, readonly layer: Layer, readonly sfx: (x: number) => void) {
    for (const [x, y] of srcs) {
      const dd = 2 + ((x * 7) % 18);
      const pool = Math.abs(x - CAVE_POOL.x) < cavePoolHw(dd) * 0.9;
      const floor = pool ? baseTop(x) + dd : groundY(x) + 1 + ((x * 3) % 10);
      this.d.push({ x, y0: y, floor, pool, t: rand.range(0, 3), grow: rand.range(1.6, 4.5), vy: 0, y, falling: false });
    }
  }
  update(dt: number) {
    for (const q of this.d) {
      if (!q.falling) {
        q.t += dt;
        if (q.t > q.grow) { q.falling = true; q.vy = 0; q.y = q.y0 + 1; }
        continue;
      }
      q.vy += 380 * dt;
      q.y += q.vy * dt;
      if (q.y >= q.floor) {
        q.falling = false; q.t = 0; q.grow = rand.range(1.6, 4.8);
        if (q.pool) { this.rings.add(q.x, q.floor, 9 + rand.range(0, 5), 1.6); this.sfx(q.x); }
        for (let i = 0; i < 3; i++) this.layer.particles.spawn({ frame: A.dot, x: q.x, y: q.floor - 1, vx: rand.range(-14, 14), vy: -rand.range(14, 30), ay: 260, life: 0.3, color: [0.75, 0.9, 0.95], alpha: 0.9, alpha1: 0.3, floorY: q.floor });
      }
    }
  }
  draw(r: Renderer) {
    const x0 = r.visibleX0(4), x1 = r.visibleX1(4);
    for (const q of this.d) {
      if (q.x < x0 || q.x > x1) continue;
      if (!q.falling) {
        // the drop swelling at the tip
        const k = q.t / q.grow;
        if (k > 0.4) r.rect(q.x, q.y0, 1, 1 + (k > 0.85 ? 1 : 0), packColor(0.72, 0.86, 0.9, 0.5 + k * 0.4));
      } else r.draw(A.drop, q.x, q.y, 1, 1 + Math.min(1.5, q.vy / 160), 0, packColor(0.8, 0.92, 0.96, 0.9));
    }
  }
}

interface Bird { x: number; y: number; vx: number; vy: number; ph: number; home: [number, number, number]; t: number; perched: boolean }

/** seabirds lifting off the cliff ledges (ledges in layer coords of a layer at parallax p) */
export class CliffBirds implements Drawable {
  z = 3;
  private b: Bird[] = [];
  constructor(ledges: [number, number, number][], n: number, readonly clock: DayClock, seed = 7) {
    const rng = new Rng(seed);
    for (let i = 0; i < n && ledges.length; i++) {
      const l = ledges[rng.int(0, ledges.length - 1)];
      const x = rng.range(l[0], l[1]);
      this.b.push({ x, y: l[2] - 2, vx: 0, vy: 0, ph: rng.range(0, 6), home: l, t: rng.range(2, 12), perched: rng.chance(0.4) });
    }
  }
  update(dt: number) {
    const night = this.clock.night;
    for (const q of this.b) {
      q.t -= dt;
      q.ph += dt * (q.perched ? 1 : 9);
      if (q.perched) {
        if (q.t < 0 && night < 0.6) { q.perched = false; q.t = rand.range(6, 16); q.vx = rand.range(-18, 18); q.vy = -rand.range(8, 16); }
        continue;
      }
      // wheel about the ledge on the sea wind, then glide home
      const [l0, l1, ly] = q.home;
      const hx = (l0 + l1) / 2, hy = ly - 30;
      const home = q.t < 0 || night > 0.6;
      const tx = home ? clamp(q.x, l0, l1) : hx + Math.sin(q.ph * 0.07) * 70, ty = home ? ly - 2 : hy + Math.cos(q.ph * 0.05) * 22;
      q.vx += (tx - q.x) * dt * 0.8 - q.vx * dt * 0.4;
      q.vy += (ty - q.y) * dt * 0.8 - q.vy * dt * 0.5;
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (home && Math.abs(q.x - tx) < 2 && Math.abs(q.y - ty) < 2) { q.perched = true; q.t = rand.range(5, 20); q.y = ly - 2; }
    }
  }
  draw(r: Renderer) {
    const x0 = r.visibleX0(10), x1 = r.visibleX1(10);
    const body = packColor(0.95, 0.95, 0.92, 1), wing = packColor(0.32, 0.32, 0.36, 1);
    for (const q of this.b) {
      if (q.x < x0 || q.x > x1) continue;
      const x = Math.round(q.x), y = Math.round(q.y);
      if (q.perched) { r.rect(x, y - 1, 1, 2, body); continue; }
      // a gull's flicking M of wings
      const up = Math.sin(q.ph) > 0;
      r.rect(x, y, 1, 1, body);
      r.rect(x - 2, y + (up ? -1 : 0), 2, 1, wing);
      r.rect(x + 1, y + (up ? -1 : 0), 2, 1, wing);
      if (!up) { r.rect(x - 3, y + 1, 1, 1, wing); r.rect(x + 3, y + 1, 1, 1, wing); }
    }
  }
}

/** spray bursting over rocks out in the near sea (positions in that layer's coords) */
export class SeaSpray implements Drawable {
  z = 6;
  private t: number[];
  constructor(readonly rocks: [number, number, number][], readonly layer: Layer, readonly clock: DayClock) {
    this.t = rocks.map((_, i) => 1 + i * 1.7);
  }
  update(dt: number) {
    for (let i = 0; i < this.rocks.length; i++) {
      this.t[i] -= dt;
      if (this.t[i] > 0) continue;
      this.t[i] = rand.range(3.5, 8);
      const [x, y, w] = this.rocks[i];
      const P = this.layer.particles, k = rand.range(0.7, 1.3);
      for (let j = 0; j < 26 * k; j++) P.spawn({ frame: rand.chance(0.3) ? A.dot2 : A.dot, x: x + rand.range(-w / 2, w / 2), y: y - 2, vx: rand.range(-24, 24), vy: -rand.range(30, 85) * k, ay: 140, drag: 0.6, life: rand.range(0.8, 1.5), color: [0.95, 1, 1], alpha: 0.95, alpha1: 0, floorY: y + 2 });
      for (let j = 0; j < 4; j++) P.spawn({ frame: A.soft, x: x + rand.range(-w / 3, w / 3), y: y - 10 * k, vx: rand.range(4, 14), vy: -rand.range(2, 8), life: rand.range(1.8, 2.8), size: 0.5, size1: 1.6, color: [0.95, 0.98, 1], alpha: 0.4, alpha1: 0, fadeIn: 0.15 });
    }
  }
  draw() {}
}

export type DriftKind = 'pollen' | 'seed' | 'salt' | 'mote' | 'spore';
interface Mote { x: number; y: number; ph: number; sp: number; k: DriftKind }

/** small things hanging in the air over a stretch (x0..x1, y0..y1) of the gameplay plane */
export class Drifters implements Drawable {
  z = 70;
  private m: Mote[] = [];
  constructor(readonly x0: number, readonly x1: number, readonly y0: number, readonly y1: number, n: number, readonly kind: DriftKind, readonly clock: DayClock, readonly light?: (x: number) => number) {
    const rng = new Rng(Math.round(x0));
    for (let i = 0; i < n; i++) this.m.push({ x: rng.range(x0, x1), y: rng.range(y0, y1), ph: rng.range(0, 99), sp: rng.range(0.6, 1.4), k: kind });
  }
  draw(r: Renderer, st: Stage) {
    const vx0 = r.visibleX0(10), vx1 = r.visibleX1(10);
    if (this.x1 < vx0 || this.x0 > vx1) return;
    const t = st.time, w = this.x1 - this.x0, wind = st.wind;
    const day = 1 - this.clock.night * 0.8;
    for (const q of this.m) {
      const drift = this.kind === 'seed' ? t * 9 * q.sp * wind : this.kind === 'salt' ? t * 5 * q.sp : t * 1.6 * q.sp;
      let x = this.x0 + ((((q.x - this.x0 + drift) % w) + w) % w);
      const y = q.y + Math.sin(t * 0.7 * q.sp + q.ph) * 5 + (this.kind === 'seed' ? Math.sin(t * 2.3 + q.ph) * 2 : 0);
      x += Math.sin(t * 0.5 + q.ph) * 4;
      if (x < vx0 || x > vx1) continue;
      const tw = 0.5 + 0.5 * Math.sin(t * 2 * q.sp + q.ph * 3);
      switch (this.kind) {
        case 'pollen': r.fxDraw(A.dot, x, y, 1, 1, 0, packColor(1, 0.95, 0.6, 1), (0.6 + tw * 0.8) * day); break;
        case 'seed':
          r.rect(Math.round(x), Math.round(y), 1, 1, packColor(0.96, 0.94, 0.88, 0.9));
          if (tw > 0.4) r.rect(Math.round(x) - 1, Math.round(y) - 1, 3, 1, packColor(0.96, 0.94, 0.88, 0.4));
          break;
        case 'salt': r.fxDraw(A.dot, x, y, 1, 1, 0, packColor(0.9, 0.96, 1, 1), 0.35 * tw * day); break;
        case 'mote': {
          const L = this.light ? this.light(x) : 1;
          if (L > 0.05) r.fxDraw(A.dot, x, y, 1, 1, 0, packColor(1, 0.95, 0.8, 1), 1.6 * tw * L * day);
          break;
        }
        case 'spore': r.fxDraw(A.dot, x, y, 1, 1, 0, packColor(0.75, 1, 0.8, 1), 0.7 * tw * (0.3 + this.clock.night * 1.2)); break;
      }
    }
  }
}

/** low mist lying in the forest hollows and over the creek, thickest at dawn, dusk and night */
export class GroundMist implements Drawable {
  z = 66;
  constructor(readonly x0: number, readonly x1: number, readonly clock: DayClock) {}
  draw(r: Renderer, st: Stage) {
    const k = clamp(this.clock.morning * 0.8 + this.clock.dusk * 0.6 + this.clock.night * 0.5) * 0.22 + 0.05;
    const vx0 = r.visibleX0(40), vx1 = r.visibleX1(40);
    const t = st.time;
    for (let i = 0; i < 26; i++) {
      const base = this.x0 + (i / 26) * (this.x1 - this.x0);
      const x = base + ((t * (2 + hash2(i, 1, 4) * 3)) % 140) - 70;
      if (x < vx0 || x > vx1) continue;
      const y = groundY(x) - 4 + hash2(i, 2, 4) * 18;
      r.fxDraw(A.soft, x, y, 3.5 + hash2(i, 3, 4) * 2, 0.9, 0, packColor(0.86, 0.92, 0.9, k * (0.6 + 0.4 * Math.sin(t * 0.3 + i))), 1, false);
    }
  }
}

// V9 island ambience for the west half: the small moving things that make the shore feel alive.
// Spray bursting up off the rock shelf when a breaker comes in, glints and wind ripples on the rock
// pools (with anemones and darting shrimp), flies buzzing and sand hoppers springing over the kelp on
// the wrack line, and thistledown and seeds drifting off the dunes in the wind. Everything is culled
// to the visible range and allocation-free per frame (particles come from the layer pools).

import type { Renderer } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Drawable, Stage } from '../../world/stage';
import { A } from '../assets';
import { hash2, rand } from '../../core/math';
import { groundY } from '../../art/island4/layout';
import { shelfPixel } from '../../art/v9/sand';
import type { IslandScene4 } from '../v4/island';

export class BeachAmbience implements Drawable {
  z = -2.9;
  /** rock-pool water pixels [x, y] (world), found from the ground painter */
  private pool: number[] = [];
  private anem: [number, number, number][] = [];
  /** kelp heaps on the wrack line [x, y] */
  kelp: [number, number][] = [];
  private seedT = 0;
  constructor(readonly s: IslandScene4) {
    for (let x = 4; x < 470; x += 3) {
      const gy = Math.round(groundY(x));
      for (let d = 10; d < 140; d += 2) {
        const p = shelfPixel(x, gy + d, d);
        if (!p || !p[1]) continue;
        this.pool.push(x, gy + d);
        // anemones and weed tufts round the rims
        if (hash2(x, d, 5) < 0.05 && !shelfPixel(x, gy + d - 2, d - 2)?.[1]) this.anem.push([x, gy + d - 1, hash2(x, d, 6)]);
      }
    }
  }

  /** a breaker came in: spray off the edge of the rock shelf */
  spray() {
    const st = this.s.st, L = this.s.main.particles;
    const x0 = st.cam.x - 380;
    for (let i = 0; i < 26; i++) {
      const x = Math.max(0, x0) + rand.range(0, 760);
      if (x > 440) continue;
      const y = groundY(x) - 1;
      L.spawn({ frame: A.dot2, x, y, vx: rand.range(-14, 22), vy: -rand.range(30, 90), ay: 140, drag: 0.6, life: rand.range(0.6, 1.4), color: [0.92, 0.98, 1], alpha: 0.85, alpha1: 0, size: rand.range(0.6, 1.4), floorY: y + rand.range(0, 4), onFloor: 'die' });
    }
  }

  update(dt: number, st: Stage) {
    // seeds and thistledown lifting off the dunes in the wind
    this.seedT -= dt;
    if (this.seedT <= 0) {
      this.seedT = 0.6 / (0.4 + st.wind);
      const x = st.cam.x + rand.range(-420, 200);
      if (x > 440 && x < 3300) {
        const y = groundY(x) + rand.range(60, 110);
        this.s.main.particles.spawn({ frame: A.dot, x, y, vx: 14 + st.wind * 30, vy: -rand.range(4, 12), ay: -1, life: rand.range(5, 9), color: [1, 0.98, 0.92], alpha: 0.9, alpha1: 0, fadeIn: 0.2, wobble: 4, wobbleF: 1.4 });
      }
    }
  }

  draw(r: Renderer, st: Stage) {
    const x0 = r.visibleX0(10), x1 = r.visibleX1(10), t = st.time;
    // rock pools: anemones, sky glints twinkling on the water, a shrimp darting now and then
    if (x0 < 480) {
      for (const [x, y, k] of this.anem) {
        if (x < x0 || x > x1) continue;
        const c = k < 0.5 ? packColor(0.82, 0.18, 0.22, 1) : k < 0.8 ? packColor(0.3, 0.62, 0.36, 1) : packColor(0.9, 0.5, 0.2, 1);
        const sw = Math.sin(t * 1.6 + x) * 0.5;
        r.rect(x - 1 + sw, y - 1, 1, 1, c); r.rect(x + sw, y - 1.5, 1, 1, c); r.rect(x + 1 + sw, y - 1, 1, 1, c);
        r.rect(x, y, 1, 1, packColor(0.4, 0.12, 0.14, 1));
      }
      const day = Math.max(0.15, 1 - this.s.clock.night);
      for (let i = 0; i < this.pool.length; i += 2) {
        const x = this.pool[i];
        if (x < x0 || x > x1) continue;
        const h = hash2(x, this.pool[i + 1], 9);
        if (h > 0.06) continue;
        const tw = Math.sin(t * (1.5 + h * 30) + h * 100);
        if (tw > 0.85) r.fxDraw(A.dot, x, this.pool[i + 1], 1.4, 0.6, 0, packColor(1, 1, 0.95, 1), (tw - 0.85) * 8 * day);
        if (h < 0.004 && Math.sin(t * 0.7 + h * 900) > 0.97) r.rect(x + Math.sin(t * 9) * 3, this.pool[i + 1], 2, 1, packColor(0.7, 0.55, 0.45, 0.9));
      }
    }
    // the wrack line: flies circling over the kelp, sand hoppers springing about
    for (const [kx, ky] of this.kelp) {
      if (kx < x0 || kx > x1) continue;
      for (let i = 0; i < 4; i++) {
        const a = t * (2.6 + i * 0.7) + kx + i * 1.9;
        r.rect(kx + Math.cos(a) * (5 + i * 3), ky - 8 - i * 2 + Math.sin(a * 1.7) * 3, 1, 1, packColor(0.06, 0.06, 0.08, 0.9));
      }
      for (let i = 0; i < 3; i++) {
        const ph = (t * 1.1 + i * 0.41 + kx * 0.01) % 1;
        if (ph > 0.5) continue;
        const hx = kx - 10 + i * 9 + ph * 16, hy = ky + 1 - Math.sin(ph * 2 * Math.PI) * 5;
        r.rect(hx, hy, 1, 1, packColor(0.62, 0.52, 0.4, 1));
      }
    }
  }
}

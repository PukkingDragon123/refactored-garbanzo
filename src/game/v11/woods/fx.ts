// V11 woods effects: the Te Wao Nui effects (src/game/v11/forest/fx.ts) with the geometry passed in
// (walk line, canopy cover, streams) instead of the forest's layout: god rays through the canopy gaps
// with dust motes, leaves and spores drifting down, dappled shade (which also tints the people), and
// glints running down the streams toward the camera.

import type { Renderer, Frame } from '../../../gfx/renderer';
import { packColor } from '../../../gfx/renderer';
import { bigFrame } from '../../../gfx/atlas';
import type { Drawable, Stage, Layer } from '../../../world/stage';
import { game } from '../../game';
import { A } from '../../assets';
import { paintLeafShadow } from '../../../art/island4/scenery';
import type { DayClock } from '../../v4/islefx';
import { sunAt } from '../../v4/islefx';
import { Rng, noise1, rand } from '../../../core/math';
import type { Channel } from '../../../art/v11/woods/floor';
import { wpersp, wrowOf } from '../../../art/v11/woods/floor';

type Fn = (x: number) => number;

/** slanted sunbeams through the canopy gaps, dust motes turning in them */
export class WoodsRays implements Drawable {
  z = 190;
  private rays: { x: number; w: number; a: number; ph: number; k: number }[] = [];
  constructor(readonly clock: DayClock, readonly layer: Layer, gaps: [number, number, number][], readonly ground: Fn, seed = 4) {
    const rng = new Rng(seed);
    for (const [x, w, k] of gaps) for (let i = 0; i < Math.max(1, Math.round(w / 30)); i++) this.rays.push({ x: x + rng.range(-w * 0.4, w * 0.4), w: rng.range(10, 30) * (0.6 + k * 0.5), a: rng.range(0.2, 0.34), ph: rng.range(0, 10), k });
  }
  draw(r: Renderer, st: Stage) {
    const s = sunAt(this.clock.t);
    const k0 = (1 - this.clock.night) * (s.moon ? 0 : 1) * (0.7 + this.clock.golden * 0.5);
    if (k0 < 0.04) return;
    const [cr, cg, cb] = s.c;
    const x0 = r.visibleX0(120), x1 = r.visibleX1(120);
    for (const ry of this.rays) {
      if (ry.x < x0 || ry.x > x1) continue;
      const k = (0.55 + 0.45 * Math.sin(st.time * 0.3 + ry.ph)) * k0 * ry.k;
      const top = this.ground(ry.x) - 300;
      const col = packColor(cr, cg * 0.98, cb * 0.82, 1);
      r.fxDraw(A.shaft, ry.x, top, ry.w / 48, 320 / 256, ry.a, col, 0.3 * k);
      r.lightTex(A.shaft, ry.x, top, ry.w / 48, 320 / 256, ry.a, col, 1.0 * k);
      if (rand.chance(0.05 * k)) {
        const t = rand.next(), y = top + 40 + t * 250;
        this.layer.glowParticles.spawn({ frame: A.dot, x: ry.x - Math.sin(ry.a) * (y - top) + rand.range(-ry.w * 0.3, ry.w * 0.3), y, vx: rand.range(-2, 2), vy: rand.range(-1, 2), life: rand.range(3, 6), color: [1, 0.95, 0.8], alpha: 0.85, alpha1: 0, fadeIn: 0.3, glow: true, intensity: 1.5, wobble: 3, wobbleF: 0.8 });
      }
    }
  }
}

/** leaves twirling down, spores and seeds floating in the still air */
export class WoodsAir implements Drawable {
  z = 0;
  private t = 0;
  private sporeT = 0;
  constructor(readonly layer: Layer, readonly clock: DayClock, readonly canopy: Fn, readonly ground: Fn) {}
  update(dt: number, st: Stage) {
    this.t -= dt;
    this.sporeT -= dt;
    const cx = st.cam.x;
    if (this.t <= 0 && A.leaves.length) {
      this.t = rand.range(0.25, 0.6);
      const x = cx + rand.range(-380, 380);
      const gy = this.ground(x);
      if (rand.chance(this.canopy(x))) {
        const autumn = rand.chance(0.3);
        this.layer.particles.spawn({ frame: A.leaves[Math.floor(rand.next() * A.leaves.length)], x, y: st.cam.y - 200 - rand.range(0, 40), vx: 6 + st.wind * 10, vy: rand.range(12, 20), life: 14, color: autumn ? [0.85, 0.6, 0.3] : [0.75, 0.85, 0.55], alpha: 1, alpha1: 0.7, vrot: rand.range(1, 3), flutter: 1, floorY: gy + rand.range(2, 30), onFloor: 'stop' });
      }
    }
    if (this.sporeT <= 0) {
      this.sporeT = rand.range(0.12, 0.3);
      const x = cx + rand.range(-340, 340);
      const y = this.ground(x) - rand.range(10, 150);
      const night = this.clock.night;
      this.layer.glowParticles.spawn({ frame: A.dot, x, y, vx: rand.range(-3, 3) + st.wind * 2, vy: rand.range(-3, 1), life: rand.range(4, 8), color: night > 0.5 ? [0.6, 1, 0.8] : [1, 0.97, 0.85], alpha: 0.7, alpha1: 0, fadeIn: 0.4, glow: true, intensity: night > 0.5 ? 1.8 : 0.9, wobble: 4, wobbleF: 0.6 });
    }
  }
  draw() {}
}

/** dappled leaf shade on the floor; sample() tints the people walking through it */
export class WoodsShade implements Drawable {
  z = -8;
  private f: Frame[];
  constructor(readonly clock: DayClock, readonly canopy: Fn, readonly ground: Fn) {
    this.f = [bigFrame(game.r, paintLeafShadow(256, 140, 5)), bigFrame(game.r, paintLeafShadow(256, 140, 11))];
  }
  sample(x: number, t: number) {
    const c = this.canopy(x);
    const n = noise1((x - t * 5) / 20, 13) * 0.6 + noise1((x + t * 3) / 12, 17) * 0.4;
    return c * (n > 0.48 ? 1 : 0.35) * (1 - this.clock.night * 0.85);
  }
  draw(r: Renderer, st: Stage) {
    const x0 = r.visibleX0(10), x1 = r.visibleX1(10);
    const dayK = (1 - this.clock.night) * 0.85;
    if (dayK < 0.05) return;
    r.beginShadows();
    for (let i = 0; i < 2; i++) {
      const scroll = st.time * (i ? -3 : 5);
      for (let x = Math.floor((x0 - scroll) / 256) * 256 + scroll; x < x1; x += 256) {
        for (let sx = 0; sx < 256; sx += 64) {
          const wx = x + sx + 32;
          const c = this.canopy(wx);
          if (c < 0.05) continue;
          r.drawSub(this.f[i], sx, 0, 64, 140, x + sx, this.ground(wx) - 2, 1, 1, packColor(1, 1, 1, c * 0.3 * dayK));
        }
      }
    }
    r.endShadows();
  }
}

/** glints running down the streams toward the camera */
export class WoodsWater implements Drawable {
  z = -9;
  private g: { e: number; ph: number; s: number }[] = [];
  constructor(readonly channels: Channel[], readonly base: Fn) {
    const rng = new Rng(77);
    for (let i = 0; i < 70; i++) this.g.push({ e: rng.range(-0.8, 0.8), ph: rng.next(), s: rng.range(0.7, 1.3) });
  }
  draw(r: Renderer, st: Stage) {
    const x0 = r.visibleX0(60), x1 = r.visibleX1(60);
    for (const ch of this.channels) {
      if (ch.x < x0 - 200 || ch.x > x1 + 200) continue;
      const wl = this.base(ch.x);
      for (let i = 0; i < 60; i++) {
        const q = this.g[i];
        const z = (st.time * 0.07 * q.s + q.ph) % 1;
        const dd = wrowOf(z * 0.72);
        if (dd > 200) continue;
        const [cx, hw] = ch.at(dd);
        const x = cx + q.e * hw * 0.85, y = wl + dd;
        const a = Math.sin(z * Math.PI) * 0.6;
        r.fxDraw(A.dot2, x, y, wpersp(dd) * 0.8, 0.4, 0, packColor(0.85, 1, 0.95, 1), a);
      }
    }
  }
}

// V11 Te Wao Nui effects: god rays slanting down through the canopy gaps with dust motes turning in
// them, drifting mist banks between the ranks of giants, leaves and spores falling and floating,
// dappled leaf shade on the floor (and on everyone walking through it), the ground cover that bends
// away and springs back as people push through it, the stream and the creek running toward the camera,
// and the mud wallows breathing bubbles.

import type { Renderer, Frame } from '../../../gfx/renderer';
import { packColor } from '../../../gfx/renderer';
import { bigFrame } from '../../../gfx/atlas';
import type { Drawable, Stage, Layer } from '../../../world/stage';
import { game } from '../../game';
import { A } from '../../assets';
import * as L from '../../../art/landscape';
import { hex } from '../../../art/color';
import { paintLeafShadow } from '../../../art/island4/scenery';
import type { DayClock } from '../../v4/islefx';
import { sunAt } from '../../v4/islefx';
import { Rng, clamp, noise1, rand } from '../../../core/math';
import { audio } from '../../../core/audio';
import { FORD, GULLY, MUD, canopyAt, fgroundY, baseY, rowOf, fordAt, creekAt, persp } from './layout';
import { mudPoolAt } from '../../../art/v11/forest/ground';

// ------------------------------------------------------------------ light

/** slanted sunbeams through the canopy gaps, dust motes turning in them */
export class ForestRays implements Drawable {
  z = 190;
  private rays: { x: number; w: number; a: number; ph: number; k: number }[] = [];
  constructor(readonly clock: DayClock, readonly layer: Layer, gaps: [number, number, number][], seed = 4) {
    const rng = new Rng(seed);
    // each gap: centre x, width, strength; a few beams of different widths fan out of it
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
      const top = fgroundY(ry.x) - 300;
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

/** a drifting mist band (tiled), its density following the time of day (thick at dawn, at dusk) */
export class ForestMist implements Drawable {
  private f: Frame;
  constructor(public z: number, readonly y: number, readonly speed: number, readonly clock: DayClock, readonly base: number, seed = 3, w = 640, h = 90, c = '#cfe2d4') {
    this.f = bigFrame(game.r, L.paintMist(w, h, hex(c), seed, 0.75));
  }
  draw(r: Renderer, st: Stage) {
    const t = this.clock.t;
    const a = clamp(this.base * (0.75 + this.clock.morning * 0.7 + this.clock.dusk * 0.4 - this.clock.night * 0.3));
    if (a < 0.02) return;
    const x0 = r.visibleX0(10), x1 = r.visibleX1(10), w = this.f.w;
    const scroll = st.time * this.speed;
    for (let x = Math.floor((x0 - scroll) / w) * w + scroll; x < x1; x += w) r.draw(this.f, x, this.y, 1, 1, 0, packColor(1, 1, 1, a));
    void t;
  }
}

/** leaves twirling down, spores and seeds floating in the still air (glinting in the light) */
export class ForestAir implements Drawable {
  z = 0;
  private t = 0;
  private sporeT = 0;
  constructor(readonly layer: Layer, readonly clock: DayClock) {}
  update(dt: number, st: Stage) {
    this.t -= dt;
    this.sporeT -= dt;
    const cx = st.cam.x;
    if (this.t <= 0 && A.leaves.length) {
      this.t = rand.range(0.25, 0.6);
      const x = cx + rand.range(-380, 380);
      const gy = fgroundY(x);
      if (rand.chance(canopyAt(x))) {
        const autumn = rand.chance(0.3);
        this.layer.particles.spawn({ frame: A.leaves[Math.floor(rand.next() * A.leaves.length)], x, y: st.cam.y - 200 - rand.range(0, 40), vx: 6 + st.wind * 10, vy: rand.range(12, 20), life: 14, color: autumn ? [0.85, 0.6, 0.3] : [0.75, 0.85, 0.55], alpha: 1, alpha1: 0.7, vrot: rand.range(1, 3), flutter: 1, floorY: gy + rand.range(2, 30), onFloor: 'stop' });
      }
    }
    if (this.sporeT <= 0) {
      this.sporeT = rand.range(0.12, 0.3);
      const x = cx + rand.range(-340, 340);
      const y = fgroundY(x) - rand.range(10, 150);
      const night = this.clock.night;
      this.layer.glowParticles.spawn({ frame: A.dot, x, y, vx: rand.range(-3, 3) + st.wind * 2, vy: rand.range(-3, 1), life: rand.range(4, 8), color: night > 0.5 ? [0.6, 1, 0.8] : [1, 0.97, 0.85], alpha: 0.7, alpha1: 0, fadeIn: 0.4, glow: true, intensity: night > 0.5 ? 1.8 : 0.9, wobble: 4, wobbleF: 0.6 });
    }
  }
  draw() {}
}

/** dappled leaf shade on the forest floor; sample() tints the people walking through it */
export class ForestShade implements Drawable {
  z = -8;
  private f: Frame[];
  constructor(readonly clock: DayClock) {
    this.f = [bigFrame(game.r, paintLeafShadow(256, 140, 5)), bigFrame(game.r, paintLeafShadow(256, 140, 11))];
  }
  sample(x: number, t: number) {
    const c = canopyAt(x);
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
          const c = canopyAt(wx);
          if (c < 0.05) continue;
          r.drawSub(this.f[i], sx, 0, 64, 140, x + sx, fgroundY(wx) - 2, 1, 1, packColor(1, 1, 1, c * 0.3 * dayK));
        }
      }
    }
    r.endShadows();
  }
}

// ------------------------------------------------------------------ the ground cover

export interface Mover { x: number; y: number; vx: number }
interface Tuft { f: Frame; x: number; y: number; sx: number; h: number; bend: number; vel: number; ph: number; tint: number }

/**
 * Ferns, sedges and seedlings along the walk line that bend away from whoever pushes through them
 * and spring back (a damped spring per tuft, driven by the movers near it, plus the wind).
 */
export class GroundCover implements Drawable {
  private list: Tuft[] = [];
  private sorted = false;
  private rustleT = 0;
  constructor(public z: number, readonly movers: () => Mover[], readonly player: () => Mover | null) {}
  add(f: Frame, x: number, y: number, flip: boolean, tint = 0xffffffff) {
    this.list.push({ f, x, y, sx: flip ? -1 : 1, h: f.h, bend: 0, vel: 0, ph: rand.range(0, 10), tint });
    this.sorted = false;
  }
  update(dt: number, st: Stage) {
    if (!this.sorted) { this.list.sort((a, b) => a.x - b.x); this.sorted = true; }
    const cx = st.cam.x, x0 = cx - 420, x1 = cx + 420;
    const ms = this.movers();
    const p = this.player();
    let touched = 0;
    // binary search for the first visible tuft
    let lo = 0, hi = this.list.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (this.list[m].x < x0) lo = m + 1; else hi = m; }
    for (let i = lo; i < this.list.length; i++) {
      const t = this.list[i];
      if (t.x > x1) break;
      const R = Math.max(8, t.f.w * 0.45);
      let push = 0;
      for (const m of ms) {
        const dx = t.x - m.x;
        if (Math.abs(dx) > R + 4 || Math.abs(m.y - t.y) > 26) continue;
        const k = 1 - Math.abs(dx) / (R + 4);
        push += Math.sign(dx || 1) * k * Math.min(10, t.h * 0.3) + m.vx * 0.02 * k;
        if (m === p && Math.abs(m.vx) > 20) touched++;
      }
      const wind = Math.sin(st.time * 1.3 + t.ph) * (0.4 + st.wind) * t.h * 0.03;
      // (sub-stepped so long frames can't blow the spring up)
      const n = Math.min(8, Math.ceil(dt / 0.02)), h = dt / n, tgt = push + wind;
      for (let s = 0; s < n; s++) {
        t.vel += (tgt - t.bend) * 38 * h - t.vel * 5.5 * h;
        t.bend += t.vel * h;
      }
      if (!(Math.abs(t.bend) < 24)) { t.bend = Math.max(-24, Math.min(24, t.bend || 0)); t.vel = 0; }
    }
    this.rustleT -= dt;
    if (touched > 0 && this.rustleT <= 0 && p) { this.rustleT = rand.range(0.35, 0.7); audio.play('rustleBush', { vol: Math.min(0.35, 0.12 + touched * 0.05), pitch: rand.range(0.9, 1.2) }); }
  }
  draw(r: Renderer) {
    const x0 = r.visibleX0(40), x1 = r.visibleX1(40);
    let lo = 0, hi = this.list.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (this.list[m].x < x0) lo = m + 1; else hi = m; }
    for (let i = lo; i < this.list.length; i++) {
      const t = this.list[i];
      if (t.x > x1) break;
      r.drawSway(t.f, t.x, t.y, t.sx, 1, t.bend, t.tint);
    }
  }
}

// ------------------------------------------------------------------ water and mud

/** glints running down the stream and the creek toward the camera, rings where drips fall */
export class ForestWater implements Drawable {
  z = -9;
  private g: { e: number; ph: number; s: number }[] = [];
  constructor() {
    const rng = new Rng(77);
    for (let i = 0; i < 70; i++) this.g.push({ e: rng.range(-0.8, 0.8), ph: rng.next(), s: rng.range(0.7, 1.3) });
  }
  draw(r: Renderer, st: Stage) {
    const x0 = r.visibleX0(60), x1 = r.visibleX1(60);
    for (const [xc, at, flow, n] of [[FORD.x, fordAt, FORD.flow, 70], [GULLY.x, creekAt, GULLY.flow, 50]] as const) {
      if (xc < x0 - 200 || xc > x1 + 200) continue;
      const wl = baseY(xc);
      for (let i = 0; i < n; i++) {
        const q = this.g[i];
        const z = (st.time * flow * q.s + q.ph) % 1;
        const dd = rowOf(z * 0.72);
        if (dd > 200) continue;
        const [cx, hw] = at(dd);
        const x = cx + q.e * hw * 0.85, y = wl + dd;
        const a = Math.sin(z * Math.PI) * 0.6;
        r.fxDraw(A.dot2, x, y, persp(dd) * 0.8, 0.4, 0, packColor(0.85, 1, 0.95, 1), a);
      }
    }
  }
}

/** mud pools breathing: a bubble now and then, swelling and popping */
export class MudBubbles implements Drawable {
  z = -8.5;
  private b: { x: number; y: number; t: number; d: number }[] = [];
  private spawnT = 0;
  draw(r: Renderer) {
    for (const q of this.b) {
      const k = q.t / q.d;
      const rr = 0.4 + k * 1.2;
      r.rect(q.x - rr, q.y - rr * 0.6, rr * 2, rr * 1.2, packColor(0.2, 0.15, 0.1, 0.9));
      r.rect(q.x - rr * 0.4, q.y - rr * 0.6, rr * 0.6, 1, packColor(0.6, 0.6, 0.55, 0.8));
    }
  }
  update(dt: number, st: Stage) {
    for (const q of this.b) q.t += dt;
    this.b = this.b.filter(q => q.t < q.d);
    this.spawnT -= dt;
    const cx = st.cam.x;
    if (this.spawnT > 0 || cx < MUD.x0 - 400 || cx > MUD.x1 + 400) return;
    this.spawnT = rand.range(0.4, 1.2);
    for (let tries = 0; tries < 6; tries++) {
      const x = rand.range(Math.max(MUD.x0, cx - 300), Math.min(MUD.x1, cx + 300)), dd = rand.range(6, 90);
      if (mudPoolAt(x, dd) > 0.03) { this.b.push({ x, y: baseY(x) + dd, t: 0, d: rand.range(0.8, 1.6) }); if (Math.abs(x - cx) < 200 && rand.chance(0.4)) audio.play('bubble', { vol: 0.08, pitch: rand.range(0.5, 0.8) }); break; }
    }
  }
}

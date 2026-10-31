// V11 Rocky Hills effects: the wind (gusts that come in waves, the tussock and everything with sway
// bending to them, a moan and a buffet when a big one hits), streaks of wind flying across the view,
// tussock seed and thistledown blowing past, mist banks streaming over the ridge and pouring down its
// lee, cloud shadows racing over the slopes, the tarn's glints.

import type { Renderer, Frame } from '../../../gfx/renderer';
import { packColor } from '../../../gfx/renderer';
import { bigFrame } from '../../../gfx/atlas';
import type { Drawable, Stage, Layer } from '../../../world/stage';
import { game } from '../../game';
import { A } from '../../assets';
import * as L from '../../../art/landscape';
import { hex } from '../../../art/color';
import { Rng, clamp, noise1, rand, smoothstep } from '../../../core/math';
import { audio } from '../../../core/audio';
import { hgroundY, windAt, TARN, persp } from './layout';
import { Prop } from '../../../world/props';
import type { PropOpts } from '../../../world/props';

/** the scene's wind (read by the tussock) */
let GUST_NOW: Gusts | null = null;

/** the wind: gust strength 0..1, rolling in waves; drives st.wind (sway) */
export class Gusts implements Drawable {
  z = -100;
  k = 0;
  private sfxT = 3;
  constructor(readonly base = 0.7) { GUST_NOW = this; }
  update(dt: number, st: Stage) {
    const t = st.time;
    const g = clamp((noise1(t * 0.18, 901) - 0.42) * 2.4 + (noise1(t * 0.9, 902) - 0.5) * 0.5, 0, 1);
    this.k = g;
    const exp = windAt(st.cam.x);
    st.wind = (this.base + g * 1.9) * exp;
    this.sfxT -= dt;
    if (this.sfxT <= 0 && g > 0.6) {
      this.sfxT = rand.range(5, 11);
      audio.play('gust', { vol: 0.18 + 0.25 * g * exp, pitch: rand.range(0.7, 1.05) });
    }
  }
  draw() {}
}

/**
 * Tussock (or any grass) that leans downwind and rolls with the gusts: each gust runs across the
 * slope as a wave from west to east, so a whole stand flattens in a sweep and springs back up behind
 * it, with a quick flutter in the blades on top. wx: the world x the wind is read at (for a parallax
 * layer, its gameplay-plane x).
 */
export class WindProp extends Prop {
  readonly wx: number;
  constructor(frame: Frame, x: number, y: number, z = 0, o: PropOpts & { wx?: number } = {}) {
    super(frame, x, y, z, o);
    this.wx = o.wx ?? x;
  }
  windBend(_r: Renderer, st: Stage) {
    const g = GUST_NOW?.k ?? 0, e = windAt(this.wx), t = st.time;
    const wave = Math.max(0, Math.sin(this.wx * 0.0065 - t * 2.2 + this.phase * 0.08)) ** 2;
    const lean = (0.25 + 0.75 * g * wave) * e * 1.6;
    const flutter = Math.sin(t * this.swaySpeed * 2.6 + this.phase) * (0.25 + 0.35 * g) + Math.sin(t * 7.1 + this.phase * 3) * 0.14 * g * wave;
    return this.sway * (lean * 2.2 + flutter);
  }
}

/** thin bright streaks of wind flying across the view (strongest in the gusts) */
export class WindStreaks implements Drawable {
  z = 200;
  private s: { x: number; y: number; len: number; v: number; ph: number }[] = [];
  constructor(readonly gust: Gusts, n = 26, seed = 7) {
    const rng = new Rng(seed);
    for (let i = 0; i < n; i++) this.s.push({ x: rng.range(0, 1), y: rng.range(0, 1), len: rng.range(18, 60), v: rng.range(0.6, 1.2), ph: rng.range(0, 10) });
  }
  draw(r: Renderer, st: Stage) {
    const k = this.gust.k * windAt(st.cam.x);
    if (k < 0.08) return;
    const x0 = r.visibleX0(80), x1 = r.visibleX1(80), w = x1 - x0;
    const y0 = st.cam.y - 190, h = 300;
    for (const q of this.s) {
      const x = x0 + ((((q.x * w + st.time * 420 * q.v) % w) + w) % w);
      const y = y0 + q.y * h + Math.sin(st.time * 1.3 + q.ph) * 6;
      const a = k * 0.22 * (0.5 + 0.5 * Math.sin(st.time * 0.7 + q.ph));
      if (a < 0.02) continue;
      const c = packColor(0.95, 0.97, 1, 1);
      r.fxDraw(A.dot2, x, y, q.len / 2, 0.22, -0.04, c, a);
      r.fxDraw(A.dot2, x - q.len * 0.6, y + 0.3, q.len / 5, 0.18, -0.04, c, a * 0.5);
    }
  }
}

/** tussock seed and thistledown blowing past, a few grass blades torn off in the gusts */
export class SeedDrift implements Drawable {
  z = 0;
  private t = 0;
  constructor(readonly layer: Layer, readonly gust: Gusts) {}
  update(dt: number, st: Stage) {
    this.t -= dt;
    if (this.t > 0) return;
    const k = this.gust.k;
    this.t = rand.range(0.05, 0.16) / (0.4 + k);
    const x = st.cam.x - 380, gy = hgroundY(st.cam.x);
    const y = gy - rand.range(0, 160);
    const fluff = rand.chance(0.7);
    this.layer.glowParticles.spawn({ frame: A.dot, x: x + rand.range(-40, 40), y, vx: 70 + st.wind * 70 + rand.range(-10, 20), vy: rand.range(-8, 6), life: rand.range(5, 9), color: fluff ? [1, 0.98, 0.9] : [0.95, 0.82, 0.5], alpha: 0.55, alpha1: 0, fadeIn: 0.2, glow: true, intensity: 0.6, wobble: 6, wobbleF: 1.4, size: fluff ? 0.7 : 1 });
  }
  draw() {}
}

/**
 * Mist banks streaming over the ridge: tiled mist bands drifting downwind on a far layer, thick at
 * dawn and dusk and in the east (where the cloud comes over the tops), with gaps the sun comes through.
 */
export class MistBank implements Drawable {
  private f: Frame;
  constructor(public z: number, readonly y: number, readonly speed: number, readonly alpha: number, readonly east: number, seed = 3, w = 720, h = 110, c = '#dfe8ee', readonly fade?: (x: number) => number) {
    this.f = bigFrame(game.r, L.paintMist(w, h, hex(c), seed, 0.7));
  }
  draw(r: Renderer, st: Stage) {
    const tod = st.tod;
    const base = this.alpha * (tod === 'dawn' ? 1.5 : tod === 'dusk' ? 1.25 : tod === 'night' ? 0.7 : 1);
    const x0 = r.visibleX0(10), x1 = r.visibleX1(10), w = this.f.w;
    const scroll = st.time * this.speed;
    for (let x = Math.floor((x0 - scroll) / w) * w + scroll; x < x1; x += w) {
      const cx = x + w / 2;
      const a = clamp(base * (this.fade ? this.fade(cx) : 1) * (0.7 + 0.3 * Math.sin(st.time * 0.1 + x * 0.001)));
      if (a < 0.02) continue;
      r.draw(this.f, x, this.y + Math.sin(st.time * 0.07 + x * 0.002) * 6, 1, 1, 0, packColor(1, 1, 1, a));
    }
  }
}

/** cloud pouring over the ridge crest and down its lee in slow waterfalls of mist (main plane, behind) */
export class RidgePour implements Drawable {
  private f: Frame[];
  private puffs: { x: number; t: number; d: number; s: number }[] = [];
  private spawnT = 0;
  constructor(public z: number, readonly x0: number, readonly x1: number) {
    this.f = [0, 1, 2].map(i => bigFrame(game.r, L.paintMist(140, 70, hex('#e8eef2'), 31 + i, 0.8)));
    for (let i = 0; i < 10; i++) this.puffs.push({ x: rand.range(x0, x1), t: rand.range(0, 14), d: rand.range(12, 18), s: rand.range(0.8, 1.3) });
  }
  update(dt: number, st: Stage) {
    for (const p of this.puffs) p.t += dt;
    this.puffs = this.puffs.filter(p => p.t < p.d);
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawnT = rand.range(1.2, 2.4) / (st.tod === 'dawn' || st.tod === 'dusk' ? 1.6 : 1); this.puffs.push({ x: rand.range(this.x0, this.x1), t: 0, d: rand.range(12, 18), s: rand.range(0.8, 1.3) }); }
  }
  draw(r: Renderer, st: Stage) {
    if (r.visibleX1(200) < this.x0 - 300 || r.visibleX0(200) > this.x1 + 300) return;
    for (let i = 0; i < this.puffs.length; i++) {
      const p = this.puffs[i];
      const k = p.t / p.d;
      // over the crest from the east, then sliding down and west, thinning as it goes
      const x = p.x - k * 260 * p.s, gy = hgroundY(x);
      const y = gy - 150 + k * 120 + Math.sin(p.t * 0.6 + i) * 4;
      const a = Math.sin(k * Math.PI) * 0.42;
      r.draw(this.f[i % 3], x - 70 * p.s, y, p.s * (1 + k * 0.6), p.s * (1 + k * 0.3), 0, packColor(1, 1, 1, a));
    }
    void st;
  }
}

/** cloud shadows racing over the slopes (dark soft blobs on the gameplay plane's ground) */
export class CloudShadows implements Drawable {
  z = -8;
  draw(r: Renderer, st: Stage) {
    if (st.tod === 'night') return;
    const x0 = r.visibleX0(100), x1 = r.visibleX1(100);
    r.beginShadows();
    for (let i = 0; i < 4; i++) {
      const span = 1800;
      const x = Math.floor(x0 / span) * span + ((i * 517 + st.time * (18 + st.wind * 8)) % span);
      for (const xx of [x - span, x, x + span]) {
        if (xx < x0 - 300 || xx > x1 + 300) continue;
        const gy = hgroundY(xx);
        r.draw(A.shadow, xx, gy + 60, 16, 10, 0, packColor(0, 0, 0, 0.16));
      }
    }
    r.endShadows();
  }
}

/** the tarn: glints running across it with the wind, the occasional ring */
export class TarnGlints implements Drawable {
  z = -9;
  private g: { u: number; v: number; ph: number }[] = [];
  constructor() {
    const rng = new Rng(55);
    for (let i = 0; i < 60; i++) this.g.push({ u: rng.range(-1, 1), v: rng.range(-1, 1), ph: rng.range(0, 10) });
  }
  draw(r: Renderer, st: Stage) {
    if (r.visibleX1(200) < TARN.x - TARN.rx || r.visibleX0(200) > TARN.x + TARN.rx) return;
    const wl = hgroundY(TARN.x);
    for (const q of this.g) {
      if (q.u * q.u + q.v * q.v > 0.7) continue;
      const dd = TARN.dd + q.v * TARN.rdd;
      const x = TARN.x + ((q.u * TARN.rx + st.time * 14 * (0.5 + st.wind * 0.3)) % TARN.rx);
      const a = Math.max(0, Math.sin(st.time * 2.2 + q.ph)) * 0.5;
      r.fxDraw(A.dot2, x, wl + dd, persp(dd) * 0.9, 0.35, 0, packColor(0.95, 1, 1, 1), a);
    }
    void smoothstep;
  }
}

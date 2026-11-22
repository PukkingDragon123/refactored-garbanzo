// V12 Te Tuawhenua effects: the wind (gust fronts rolling over the open country, the ridge top
// windiest, the gully still), the air (kānuka seed and pollen in the scrub, ash flakes tumbling off
// the burnt ridge, spores and motes under the gully's ferns, tussock fluff, grit in the gorge), the
// Hot Valley's steam rising beyond the gorge's end, the little cascade down the gorge's side notch, and
// a strip that draws only the props in view (the map is 14,000 px long: thousands of props).

import type { Renderer, Frame } from '../../../gfx/renderer';
import { packColor } from '../../../gfx/renderer';
import { bigFrame } from '../../../gfx/atlas';
import type { Drawable, Stage, Layer } from '../../../world/stage';
import type { Prop } from '../../../world/props';
import { game } from '../../game';
import { A } from '../../assets';
import * as L from '../../../art/landscape';
import { hex } from '../../../art/color';
import { Rng, clamp, noise1, rand } from '../../../core/math';
import { audio } from '../../../core/audio';
import { bioW, tuaGround, tuaWind, TUA_W } from './gen';

/** the wind: gust fronts in waves, scaled by how exposed the walk line is; drives st.wind */
export class TuaGusts implements Drawable {
  z = -100;
  k = 0;
  private sfxT = 4;
  update(dt: number, st: Stage) {
    const t = st.time;
    const g = clamp((noise1(t * 0.16, 911) - 0.42) * 2.3 + (noise1(t * 0.8, 912) - 0.5) * 0.5, 0, 1);
    this.k = g;
    const exp = tuaWind(st.cam.x);
    st.wind = (0.4 + g * 1.5) * exp;
    this.sfxT -= dt;
    if (this.sfxT <= 0 && g > 0.62 && exp > 0.7) {
      this.sfxT = rand.range(6, 12);
      audio.play('gust', { vol: 0.12 + 0.2 * g * exp, pitch: rand.range(0.7, 1.05) });
    }
  }
  draw() {}
}

/** what's in the air, by stretch (spawned upwind of the view, carried on the wind) */
export class TuaAir implements Drawable {
  z = 0;
  private t = 0;
  constructor(readonly layer: Layer, readonly gust: TuaGusts, readonly night: () => number) {}
  update(dt: number, st: Stage) {
    this.t -= dt;
    if (this.t > 0) return;
    const x0 = st.cam.x, k = this.gust.k;
    this.t = rand.range(0.06, 0.18) / (0.5 + k);
    const ash = bioW(x0, 'burnt'), gul = bioW(x0, 'boa'), tus = bioW(x0, 'tussock') + bioW(x0, 'scrub') * 0.6, grit = bioW(x0, 'gorge');
    const r = rand.next() * (ash + gul + tus + grit + 0.4);
    const gy = tuaGround(x0);
    const n = this.night();
    if (r < ash) {
      // ash flakes and the odd charred leaf, tumbling
      this.layer.particles.spawn({ frame: A.dot2, x: x0 - 360 + rand.range(-40, 40), y: gy - rand.range(10, 170), vx: 40 + st.wind * 50 + rand.range(-10, 20), vy: rand.range(-6, 10), life: rand.range(5, 9), color: rand.chance(0.7) ? [0.62, 0.6, 0.57] : [0.16, 0.14, 0.13], alpha: 0.8, alpha1: 0, wobble: 8, wobbleF: 2.2, size: rand.range(0.5, 0.9) });
    } else if (r < ash + gul) {
      // spores and motes in the green light (fireflies do the night: the site's insects)
      if (n > 0.6) return;
      this.layer.glowParticles.spawn({ frame: A.dot, x: x0 + rand.range(-330, 330), y: gy - rand.range(10, 150), vx: rand.range(-4, 4) + st.wind * 3, vy: rand.range(-4, 2), life: rand.range(4, 8), color: [0.9, 1, 0.8], alpha: 0.4, alpha1: 0, fadeIn: 0.3, glow: true, intensity: 0.4, wobble: 4, wobbleF: 0.8, size: 0.5 });
    } else if (r < ash + gul + tus) {
      const fluff = rand.chance(0.7);
      this.layer.glowParticles.spawn({ frame: A.dot, x: x0 - 360 + rand.range(-40, 40), y: gy - rand.range(0, 160), vx: 60 + st.wind * 70 + rand.range(-10, 20), vy: rand.range(-8, 6), life: rand.range(5, 9), color: fluff ? [1, 0.98, 0.9] : [0.95, 0.82, 0.5], alpha: 0.5 * (1 - n * 0.7), alpha1: 0, fadeIn: 0.2, glow: true, intensity: 0.5, wobble: 6, wobbleF: 1.4, size: fluff ? 0.7 : 1 });
    } else if (r < ash + gul + tus + grit && k > 0.4) {
      this.layer.particles.spawn({ frame: A.dot2, x: x0 - 340, y: gy - rand.range(0, 60), vx: 90 + st.wind * 60, vy: rand.range(-10, 4), life: rand.range(2, 4), color: [0.58, 0.54, 0.48], alpha: 0.55, alpha1: 0, size: 0.5 });
    }
  }
  draw() {}
}

/** the Hot Valley's steam: columns of pixel cloud rising beyond the end of the gorge (a far layer) */
export class SteamPlumes implements Drawable {
  z = 3;
  private f: Frame[];
  private puffs: { x: number; y: number; ph: number; v: number; s: number; f: number }[] = [];
  constructor(readonly p: number, baseY: number, seed: number, readonly clockNight: () => number) {
    const ramp = ['#9aa0a6', '#b8bec4', '#d4d8dc', '#e8ebee', '#f6f7f8'].map(h => hex(h));
    this.f = [0, 1, 2].map(i => bigFrame(game.r, L.paintCloud(seed + i * 5, 30 + i * 8, 14 + i * 3, ramp, 1)));
    const rng = new Rng(seed);
    // the vents: beyond the gorge's east end and a little to either side
    for (let i = 0; i < 5; i++) {
      const wx = TUA_W - 900 + i * 380 + rng.range(-80, 80);
      for (let k = 0; k < 6; k++) this.puffs.push({ x: wx * p, y: baseY + rng.range(-4, 4), ph: k / 6 + rng.range(0, 0.1), v: rng.range(0.035, 0.06), s: rng.range(0.8, 1.2), f: rng.int(0, 2) });
    }
  }
  draw(r: Renderer, st: Stage) {
    const n = this.clockNight();
    for (const q of this.puffs) {
      const t = (st.time * q.v + q.ph) % 1;
      const fr = this.f[q.f];
      const sc = q.s * (1 + Math.floor(t * 3) * 0.5);
      const x = q.x + t * 60 * (0.4 + st.wind * 0.5) + Math.sin(st.time * 0.3 + q.ph * 9) * 4;
      const y = q.y - t * 120;
      const a = Math.sin(t * Math.PI) * 0.55 * (1 - n * 0.5);
      if (a < 0.03) continue;
      r.draw(fr, x - (fr.w * sc) / 2, y - fr.h * sc, sc, sc, 0, packColor(1, 1, 1, a));
    }
  }
}

/** a thin fall of water down the notch in the gorge wall, foaming where it lands */
export class Cascade implements Drawable {
  constructor(public z: number, readonly x: number, readonly top: number, readonly bot: number, readonly w: number) {}
  draw(r: Renderer, st: Stage) {
    if (this.x < r.visibleX0(40) || this.x > r.visibleX1(40)) return;
    for (let i = -this.w; i <= this.w; i++) {
      const ph = Math.sin(i * 1.7) * 3;
      for (let y = this.top; y < this.bot; y += 2) {
        const k = ((y + st.time * 70 + ph * 10) % 12) / 12;
        r.rect(this.x + i + Math.round(Math.sin(y * 0.05) * 1), y, 1, 2, packColor(0.76, 0.9, 0.92, 0.3 + 0.45 * (k < 0.3 ? 1 : 0)));
      }
    }
    for (let i = 0; i < 6; i++) r.rect(this.x - this.w - 2 + i * (this.w * 0.5 + 1), this.bot - 1 + Math.sin(st.time * 6 + i) * 0.8, 3, 1, packColor(0.92, 0.97, 0.98, 0.7));
  }
}

/**
 * A strip of props on one layer that only draws (and only runs the plant physics of) the props in
 * view: sorted by x once, a binary search for the first one in view each frame, the visible few
 * sorted by their own z. `pad` is how far a prop can reach from its anchor (a wide crown).
 */
export class Strip implements Drawable {
  private list: Prop[] = [];
  private sorted = false;
  private vis: Prop[] = [];
  constructor(public z: number, readonly pad = 200) {}
  add(p: Prop): Prop { this.list.push(p); this.sorted = false; return p; }
  get size() { return this.list.length; }
  draw(r: Renderer, st: Stage) {
    if (!this.sorted) { this.list.sort((a, b) => a.x - b.x); this.sorted = true; }
    const x0 = r.visibleX0(this.pad), x1 = r.visibleX1(this.pad);
    let lo = 0, hi = this.list.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (this.list[m].x < x0) lo = m + 1; else hi = m; }
    const v = this.vis;
    v.length = 0;
    for (let i = lo; i < this.list.length; i++) { const p = this.list[i]; if (p.x > x1) break; v.push(p); }
    v.sort((a, b) => a.z - b.z);
    for (const p of v) p.draw(r, st);
  }
}

/**
 * A bank of mist drifting along a layer, its density following the country it lies over: drawn in
 * 16 px strips, each with its own strength, so where the mist thins out it does so gradually (one
 * strength per whole tile would show the tiles' edges as hard vertical seams).
 */
export class TuaMist implements Drawable {
  private f: Frame;
  constructor(public z: number, readonly y: number, readonly speed: number, readonly alpha: number, seed: number, w: number, h: number, c: string, readonly fade: (x: number) => number) {
    this.f = bigFrame(game.r, L.paintMist(w, h, hex(c), seed, 0.7));
  }
  draw(r: Renderer, st: Stage) {
    const tod = st.tod;
    const base = this.alpha * (tod === 'dawn' ? 1.5 : tod === 'dusk' ? 1.25 : tod === 'night' ? 0.7 : 1);
    const x0 = r.visibleX0(10), x1 = r.visibleX1(10), w = this.f.w, S = 16;
    const scroll = st.time * this.speed;
    for (let x = Math.floor((x0 - scroll) / w) * w + scroll; x < x1; x += w) {
      const yy = this.y + Math.sin(st.time * 0.07 + x * 0.002) * 6;
      for (let sx = 0; sx < w; sx += S) {
        const wx = x + sx;
        if (wx + S < x0 || wx > x1) continue;
        const a = clamp(base * this.fade(wx + S / 2) * (0.7 + 0.3 * Math.sin(st.time * 0.1 + wx * 0.001)));
        if (a < 0.02) continue;
        r.drawSub(this.f, sx, 0, S, this.f.h, wx, yy, 1, 1, packColor(1, 1, 1, a));
      }
    }
  }
}

// V4 island effects: a continuous time of day (morning -> midday -> golden hour -> dusk -> night)
// that blends lighting, sky, clouds and the sea; the sky with sun, moon, stars and the morning
// rainbow; tiled sea bands with sun glitter; rolling breakers and the swash sliding up the wet sand;
// dappled leaf shadows, forest god rays, drifting mist, blowing sand and the cave's glowworms.

import type { Renderer, Frame, Env, RGB } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { bigFrame } from '../../gfx/atlas';
import type { Drawable, Stage, Layer } from '../../world/stage';
import { timePreset } from '../../world/timeofday';
import { local, A } from '../assets';
import { game } from '../game';
import * as L from '../../art/landscape';
import { hex, mix } from '../../art/color';
import { PixelBuffer } from '../../art/pixel';
import { SKY_KEYS, SkyKey, paintSkyKey, paintSeaBand, SEA, SeaBand, paintLeafShadow } from '../../art/island4/scenery';
import { WRAP } from '../../art/ocean';
import { ISL, groundY, canopyAt, wetAt } from '../../art/island4/layout';
import { Rng, clamp, hash2, lerp, noise1, rand, smoothstep } from '../../core/math';

// ------------------------------------------------------------------ the clock

/** 0 morning · 1 midday · 2 golden hour · 3 dusk · 4 night */
export class DayClock {
  t = 0;
  target = 0;
  /** key units per second while easing toward the target */
  rate = 0.05;
  update(dt: number) {
    if (this.t < this.target) this.t = Math.min(this.target, this.t + this.rate * dt);
    else if (this.t > this.target) this.t = Math.max(this.target, this.t - this.rate * dt);
  }
  /** jump straight to a time (scene rebuilds, debug) */
  set(t: number) { this.t = this.target = t; }
  pair(): [SkyKey, SkyKey, number] {
    const t = clamp(this.t, 0, 4);
    const i = Math.min(3, Math.floor(t));
    return [SKY_KEYS[i], SKY_KEYS[i + 1], t - i];
  }
  get night() { return smoothstep(3.1, 3.8, this.t); }
  get dusk() { return clamp(1 - Math.abs(this.t - 3) / 1.1); }
  get golden() { return clamp(1 - Math.abs(this.t - 2.1) / 1.1); }
  get morning() { return clamp(1 - this.t / 0.9); }
}

const lerp3 = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function mixEnv(a: Env, b: Env, t: number): Env {
  return {
    ambientTop: lerp3(a.ambientTop, b.ambientTop, t), ambientBottom: lerp3(a.ambientBottom, b.ambientBottom, t),
    fogTop: lerp3(a.fogTop, b.fogTop, t), fogBottom: lerp3(a.fogBottom, b.fogBottom, t),
    exposure: lerp(a.exposure, b.exposure, t), bloom: lerp(a.bloom, b.bloom, t), bloomThreshold: lerp(a.bloomThreshold, b.bloomThreshold, t),
    saturation: lerp(a.saturation, b.saturation, t), contrast: lerp(a.contrast, b.contrast, t),
    lift: lerp3(a.lift, b.lift, t), gamma: lerp3(a.gamma, b.gamma, t), gain: lerp3(a.gain, b.gain, t),
    vignette: lerp(a.vignette, b.vignette, t), grain: lerp(a.grain, b.grain, t), waterAxis: a.waterAxis, waterTint: lerp3(a.waterTint, b.waterTint, t),
  };
}

let envKeys: Record<SkyKey, Env> | null = null;
function keyEnvs(): Record<SkyKey, Env> {
  if (envKeys) return envKeys;
  const dawn = timePreset('dawn').env, day = timePreset('day').env, dusk = timePreset('dusk').env, night = timePreset('night').env;
  const morning = mixEnv(dawn, day, 0.62);
  morning.bloom = 0.42;
  const golden = mixEnv(day, dusk, 0.6);
  golden.ambientTop = [1.12, 0.92, 0.7];
  envKeys = { morning, day, golden, dusk, night };
  return envKeys;
}

/** lighting for a continuous time of day */
export function envAt(t: number): Env {
  const E = keyEnvs();
  const tt = clamp(t, 0, 4);
  const i = Math.min(3, Math.floor(tt));
  return mixEnv(E[SKY_KEYS[i]], E[SKY_KEYS[i + 1]], tt - i);
}
const KEY_LIGHTK = [0.3, 0.18, 0.42, 0.62, 1.05];
export function lightKAt(t: number) {
  const tt = clamp(t, 0, 4), i = Math.min(3, Math.floor(tt));
  return lerp(KEY_LIGHTK[i], KEY_LIGHTK[i + 1], tt - i);
}
/** sun (or moon, at night) screen position as a fraction of the view, and its colour */
export function sunAt(t: number): { x: number; y: number; c: RGB; moon: boolean } {
  const pts: [number, number, RGB][] = [[0.22, 0.26, [1, 0.94, 0.82]], [0.36, 0.1, [1, 0.97, 0.88]], [0.7, 0.4, [1, 0.8, 0.5]], [0.82, 0.76, [1, 0.56, 0.3]], [0.84, 0.98, [1, 0.4, 0.2]]];
  const tt = clamp(t, 0, 4), i = Math.min(3, Math.floor(tt)), k = tt - i;
  if (t > 3.6) return { x: 0.24, y: 0.16, c: [0.76, 0.86, 1], moon: true };
  const a = pts[i], b = pts[i + 1];
  return { x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k), c: lerp3(a[2], b[2], k), moon: false };
}
/** multiplier for cloud / far-scenery colour at a time of day */
export function skyTintAt(t: number): RGB {
  const keys: RGB[] = [[1, 0.97, 0.95], [1, 1, 1], [1, 0.84, 0.7], [0.92, 0.6, 0.62], [0.22, 0.26, 0.42]];
  const tt = clamp(t, 0, 4), i = Math.min(3, Math.floor(tt));
  return lerp3(keys[i], keys[i + 1], tt - i);
}

// ------------------------------------------------------------------ sky

const SKY_W = 860, SKY_H = 250, SKY_HORIZON = 124;

function paintRainbow(r: number): PixelBuffer {
  const w = r * 2 + 4, h = r + 4;
  const b = new PixelBuffer(w, h);
  const bands = ['#ff5a5a', '#ffa04a', '#ffe060', '#7ae070', '#5aa8ff', '#8a6aff'];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot(x - w / 2, h - y);
    const k = (r - d) / 9;
    if (k < 0 || k >= 1) continue;
    const i = Math.floor(k * bands.length);
    b.data[y * w + x] = hex(bands[i], Math.round(120 * Math.sin(k * Math.PI)));
  }
  return b;
}

export class IsleSky implements Drawable {
  z = 0;
  private skies: Frame[] = [];
  private sun: Frame;
  private moon: Frame;
  private rainbow: Frame;
  private stars = L.starField(SKY_W, 170, 7, 150);
  constructor(readonly clock: DayClock) {
    const r = game.r;
    for (const k of SKY_KEYS) this.skies.push(bigFrame(r, paintSkyKey(k, SKY_W, SKY_H)));
    this.sun = local.add('isle:sun', L.paintSun(9, hex('#fffaf0'), hex('#fff0c0')), 10, 10);
    this.moon = local.add('isle:moon', L.paintMoon(8, hex('#eef2f6'), hex('#bcc6d4'), hex('#8e98aa'), 0.25), 9, 9);
    this.rainbow = bigFrame(r, paintRainbow(150), 154, 154);
  }
  draw(r: Renderer, st: Stage) {
    const c = this.clock;
    const par = -(st.cam.y - 180) * 0.05;
    const hy = SKY_HORIZON + par, top = hy - (SKY_H - 6);
    const [a, b, k] = c.pair();
    const ia = SKY_KEYS.indexOf(a), ib = SKY_KEYS.indexOf(b);
    const w = Math.min(SKY_W, r.VW + 2);
    r.drawSub(this.skies[ia], 0, 0, w, SKY_H, 0, top);
    if (k > 0.01) r.drawSub(this.skies[ib], 0, 0, w, SKY_H, 0, top, 1, 1, packColor(1, 1, 1, k));
    // stars fade in with the night
    const nk = c.night;
    if (nk > 0.02) for (const s of this.stars) {
      if (s.x > r.VW) continue;
      const tw = 0.55 + 0.45 * Math.sin(st.time * s.tw + s.x);
      r.fxDraw(s.big ? A.spark : A.dot, s.x, s.y + par - 6, s.big ? 0.6 : 1, s.big ? 0.6 : 1, 0, s.c | 0, s.b * tw * 1.4 * nk, true);
    }
    // the morning rainbow after the storm
    const rk = c.morning * 0.55;
    if (rk > 0.02) r.fxDraw(this.rainbow, r.VW * 0.72, hy + 4, 1, 1, 0, packColor(1, 1, 1, 1), rk);
    // sun / moon
    const s = sunAt(c.t);
    const sx = s.x * r.VW, sy = s.y * SKY_HORIZON * 1.25 + par;
    const [cr, cg, cb] = s.c;
    if (s.moon) {
      r.draw(this.moon, sx, sy);
      r.fxDraw(A.glow, sx, sy, 2.4, 2.4, 0, packColor(0.7, 0.8, 1, 1), 0.45 * nk);
    } else {
      const low = smoothstep(0.35, 0.95, s.y);
      r.emissive(1);
      r.draw(this.sun, sx, sy, 1 + low * 0.5, 1 + low * 0.5, 0, packColor(1, 1 - low * 0.25, 1 - low * 0.5, 1));
      r.emissive();
      r.fxDraw(A.glow, sx, sy, 1.8, 1.8, 0, packColor(cr, cg, cb, 1), 0.9);
      r.fxDraw(A.glow, sx, sy, 6 + low * 4, 3.5 + low * 2, 0, packColor(cr, cg * 0.9, cb * 0.8, 1), 0.14 + low * 0.2);
      // god-ray fan at golden hour
      const gk = Math.max(c.golden, c.dusk) * 0.5;
      if (gk > 0.05) for (let i = 0; i < 7; i++) {
        const ang = -1.2 + i * 0.38 + Math.sin(st.time * 0.05 + i) * 0.04;
        r.fxDraw(A.shaft, sx, sy, 0.9 + (i % 3) * 0.3, 1.3, ang, packColor(cr, cg * 0.85, cb * 0.7, 1), gk * (0.25 + (i % 2) * 0.15));
      }
    }
  }
}

// ------------------------------------------------------------------ clouds

export class CloudDeck implements Drawable {
  z = 0;
  private fr: Frame[] = [];
  private items: { f: number; x: number; y: number; v: number; k: number }[] = [];
  constructor(readonly clock: DayClock, readonly layer: Layer, seed: number, n: number, y0: number, y1: number, big: boolean, span: { x0: number; w: number }) {
    const ramp = ['#8a94a8', '#a8b4c8', '#ccd6e2', '#e8eef4', '#ffffff'].map(h => hex(h));
    const rng = new Rng(seed);
    for (let i = 0; i < 5; i++) this.fr.push(bigFrame(game.r, L.paintCloud(seed + i * 7, big ? rng.int(120, 200) : rng.int(60, 110), big ? rng.int(40, 60) : rng.int(22, 34), ramp, 1)));
    for (let i = 0; i < n; i++) this.items.push({ f: rng.int(0, 4), x: rng.range(span.x0, span.x0 + span.w), y: rng.range(y0, y1), v: rng.range(1.5, 4) * (big ? 0.6 : 1), k: rng.range(0.8, 1) });
    this.span = span;
  }
  private span: { x0: number; w: number };
  draw(r: Renderer, st: Stage) {
    const [cr, cg, cb] = skyTintAt(this.clock.t);
    for (const c of this.items) {
      const f = this.fr[c.f];
      const x = this.span.x0 + ((((c.x + st.time * c.v - this.span.x0) % this.span.w) + this.span.w) % this.span.w);
      r.draw(f, x - f.w / 2, c.y, 1, 1, 0, packColor(cr * c.k, cg * c.k, cb * c.k, 0.96));
    }
  }
}

// ------------------------------------------------------------------ sea

/** one tiled band of sea on its own parallax layer, with drifting shimmer and sun glitter */
export class SeaStrip implements Drawable {
  z = 0;
  private f: Frame;
  private texW: number;
  constructor(readonly band: SeaBand, readonly y: number, readonly clock: DayClock, readonly speed: number) {
    const buf = paintSeaBand(band, 7 + band.length);
    this.f = bigFrame(game.r, buf);
    this.texW = SEA[band].texW;
  }
  draw(r: Renderer, st: Stage) {
    const x0 = r.visibleX0(8), x1 = r.visibleX1(8);
    const tw = this.texW;
    const scroll = st.time * this.speed;
    const H = this.f.h;
    const bob = Math.sin(st.time * 0.8 + this.y) * 0.5;
    let x = Math.floor((x0 - scroll) / tw) * tw + scroll;
    // the band's lowest rows stretched on downward underneath the next band: when the camera rises
    // or zooms out the bands part (each has its own parallax), and this keeps sea in the gap
    for (; x < x1; x += tw) { r.drawSub(this.f, 0, H - 3, tw, 3, x, this.y + bob + H - 3, 1, 8); r.drawSub(this.f, 0, 0, tw, H, x, this.y + bob); }
    // counter-drifting shimmer copy
    const s2 = -st.time * this.speed * 0.6 + 37;
    x = Math.floor((x0 - s2) / tw) * tw + s2;
    for (; x < x1; x += tw) r.drawSub(this.f, 0, 2, tw, H - 2, x, this.y + 2 + bob, 1, 1, packColor(1, 1, 1, 0.22));
    // sun / moon glitter path
    const s = sunAt(this.clock.t);
    const nightK = this.clock.night;
    const p = SEA[this.band].p;
    const sxw = r.wx(s.x * r.VW);
    const spread = 40 + p * 160;
    const [cr, cg, cb] = s.c;
    const k = s.moon ? 0.5 * nightK : 1 - nightK;
    if (k > 0.03) for (let i = 0; i < 26; i++) {
      const gx = sxw + (hash2(i, 1, this.y) - 0.5) * spread * 2, gy = this.y + 1 + hash2(i, 2, this.y) * (H - 3);
      const tw2 = Math.max(0, Math.sin(st.time * (2 + hash2(i, 3, 5) * 3) + i * 1.7));
      const fall = Math.exp(-(((gx - sxw) / spread) ** 2) * 2);
      if (tw2 * fall < 0.1) continue;
      r.fxDraw(A.dot2, gx, gy, 1.6, 0.5, 0, packColor(cr, cg, cb, 1), tw2 * fall * 1.4 * k);
    }
  }
}

/** rolling lines of surf in the near band: swell, curl, break, spread; each break sends a swash up the sand */
export class Breakers implements Drawable {
  z = 5;
  rows = [0, 0.34, 0.68];
  onBreak: ((i: number) => void) | null = null;
  constructor(readonly yFar: number, readonly yNear: number, readonly period = 7.5) {}
  update(dt: number) {
    for (let i = 0; i < this.rows.length; i++) {
      const prev = this.rows[i];
      this.rows[i] = (prev + dt / this.period) % 1;
      if (prev < 0.8 && this.rows[i] >= 0.8) this.onBreak?.(i);
    }
  }
  draw(r: Renderer, st: Stage) {
    const x0 = Math.floor(r.visibleX0(6) / 3) * 3, x1 = r.visibleX1(6);
    const face = packColor(0.16, 0.5, 0.6, 1), faceLit = packColor(0.5, 0.86, 0.86, 1), foam = packColor(0.96, 1, 1, 1);
    for (let i = 0; i < this.rows.length; i++) {
      const ph = this.rows[i];
      const yBase = lerp(this.yFar, this.yNear, smoothstep(0, 1, ph));
      for (let x = x0; x < x1; x += 3) {
        const q = ph + (noise1(x / 70 + i * 13, 5) - 0.5) * 0.16;
        const y = yBase + (noise1(x / 40 + i * 7, 6) - 0.5) * 2;
        if (q < 0.05 || q > 1.05) continue;
        if (q < 0.62) {
          // swell rising: a darker face with a sunlit top line
          const hh = 1 + q * 5;
          r.rect(x, y - hh, 3, hh, face);
          r.rect(x, y - hh - 1, 3, 1, faceLit);
        } else if (q < 0.8) {
          // curling lip turning white, spray
          const hh = 4 + (0.8 - q) * 8;
          r.rect(x, y - hh, 3, hh * 0.6, face);
          r.rect(x, y - hh - 1, 3, 2, foam);
          if (hash2(x, Math.floor(st.time * 8), i) < 0.12) r.rect(x + 1, y - hh - 3, 1, 1, foam);
        } else {
          // spreading foam band
          const k = (q - 0.8) / 0.25;
          const th = 1 + k * 3;
          r.rect(x, y - th, 3, th, packColor(0.94, 1, 1, clamp(1 - k * 0.8)));
          if (hash2(x, i, 9) < 0.5) r.rect(x, y + 1, 2, 1, packColor(0.9, 1, 1, clamp(0.6 - k * 0.5)));
        }
      }
    }
  }
}

/** the swash: thin sheets of water sliding up the wet sand and back (drawn under the actors) */
export class Swash implements Drawable {
  z = -9;
  sheets: { t: number; reach: number; seed: number }[] = [];
  update(dt: number) {
    for (const s of this.sheets) s.t += dt;
    this.sheets = this.sheets.filter(s => s.t < 5);
  }
  push(reach = rand.range(12, 22)) { this.sheets.push({ t: 0, reach, seed: rand.int(0, 999) }); }
  /** 0..1: how much a sheet of water is covering the walk line at x right now (wading, splashes) */
  coverAt(x: number): number {
    if (wetAt(x) < 0.5) return 0;
    let c = 0;
    for (const s of this.sheets) {
      const t = s.t;
      const k = t < 1.1 ? smoothstep(0, 1.1, t) : t < 2 ? 1 : 1 - smoothstep(2, 4.6, t);
      const edge = (s.reach + (noise1(x / 18 + s.seed, 3) - 0.5) * 8) * k;
      if (edge > 3) c = Math.max(c, Math.min(1, edge / 10) * (t < 2.6 ? 1 : 1 - smoothstep(2.6, 4.8, t)));
    }
    return c;
  }
  draw(r: Renderer) {
    const x0 = Math.floor(r.visibleX0(4) / 2) * 2, x1 = r.visibleX1(4);
    for (const s of this.sheets) {
      // run up fast, linger, slide back
      const t = s.t;
      const k = t < 1.1 ? smoothstep(0, 1.1, t) : t < 2 ? 1 : 1 - smoothstep(2, 4.6, t);
      const alpha = t < 2.6 ? 0.55 : 0.55 * (1 - smoothstep(2.6, 4.8, t));
      if (alpha < 0.02) continue;
      r.water(0.55, 0.8);
      for (let x = x0; x < x1; x += 2) {
        const w = wetAt(x);
        if (w < 0.5) continue;
        const gy = groundY(x) - 2;
        const edge = (s.reach + (noise1(x / 18 + s.seed, 3) - 0.5) * 8) * k;
        if (edge < 1) continue;
        r.rect(x, gy, 2, edge, packColor(0.62, 0.84, 0.86, alpha * 0.7));
      }
      r.water(0);
      for (let x = x0; x < x1; x += 2) {
        if (wetAt(x) < 0.5) continue;
        const gy = groundY(x) - 2;
        const edge = (s.reach + (noise1(x / 18 + s.seed, 3) - 0.5) * 8) * k;
        if (edge < 1) continue;
        const lace = noise1(x / 5 + s.seed, 4) > 0.35;
        r.rect(x, gy + edge - 1, 2, lace ? 2 : 1, packColor(0.97, 1, 1, alpha * (t < 2 ? 1 : 0.6)));
        if (lace && hash2(x, s.seed, 2) < 0.3) r.rect(x, gy + edge - 3, 1, 1, packColor(1, 1, 1, alpha * 0.8));
      }
    }
  }
}

// ------------------------------------------------------------------ light through the leaves

/** dappled canopy shadow on the ground wherever canopyAt(x) > 0, drifting with the wind */
export class LeafShadows implements Drawable {
  z = -8;
  private f: Frame[];
  constructor(readonly clock: DayClock) {
    this.f = [bigFrame(game.r, paintLeafShadow(256, 110, 3)), bigFrame(game.r, paintLeafShadow(256, 110, 9))];
  }
  /** shadow density at x (0..1) for tinting the actors that walk through it */
  sample(x: number, t: number) {
    const c = canopyAt(x);
    if (c <= 0) return 0;
    const n = noise1((x - t * 6) / 22, 3) * 0.6 + noise1((x + t * 3.5) / 13, 5) * 0.4;
    return c * (n > 0.5 ? 1 : 0.25) * (1 - this.clock.night * 0.8);
  }
  draw(r: Renderer, st: Stage) {
    const x0 = r.visibleX0(10), x1 = r.visibleX1(10);
    const dayK = (1 - this.clock.night) * 0.8;
    if (dayK < 0.05) return;
    r.beginShadows();
    for (let i = 0; i < 2; i++) {
      const scroll = st.time * (i ? -3.5 : 6);
      for (let x = Math.floor((x0 - scroll) / 256) * 256 + scroll; x < x1; x += 256) {
        // fade by canopy cover, per 64px slice
        for (let sx = 0; sx < 256; sx += 64) {
          const wx = x + sx + 32;
          const c = canopyAt(wx);
          if (c < 0.05) continue;
          const gy = groundY(wx) - 1;
          r.drawSub(this.f[i], sx, 0, 64, 110, x + sx, gy, 1, 1, packColor(1, 1, 1, c * 0.34 * dayK));
        }
      }
    }
    r.endShadows();
  }
}

/** slanted sunbeams through the canopy with drifting dust motes (forest and grove) */
export class GodRays implements Drawable {
  z = 190;
  private rays: { x: number; w: number; a: number; ph: number }[] = [];
  constructor(readonly clock: DayClock, readonly layer: Layer, xs: [number, number][], seed = 4) {
    const rng = new Rng(seed);
    for (const [a, b] of xs) for (let x = a; x < b; x += rng.range(50, 120)) this.rays.push({ x, w: rng.range(14, 34), a: rng.range(0.18, 0.34), ph: rng.range(0, 10) });
  }
  draw(r: Renderer, st: Stage) {
    const s = sunAt(this.clock.t);
    const k0 = (1 - this.clock.night) * (s.moon ? 0 : 1);
    if (k0 < 0.05) return;
    const [cr, cg, cb] = s.c;
    const x0 = r.visibleX0(80), x1 = r.visibleX1(80);
    for (const ry of this.rays) {
      if (ry.x < x0 || ry.x > x1) continue;
      const c = canopyAt(ry.x);
      if (c < 0.2) continue;
      const k = (0.55 + 0.45 * Math.sin(st.time * 0.35 + ry.ph)) * k0 * c;
      const top = groundY(ry.x) - 190;
      const col = packColor(cr, cg * 0.97, cb * 0.85, 1);
      r.fxDraw(A.shaft, ry.x, top, ry.w / 48, 210 / 256, ry.a, col, 0.34 * k);
      r.lightTex(A.shaft, ry.x, top, ry.w / 48, 210 / 256, ry.a, col, 0.9 * k);
      if (rand.chance(0.03 * k)) {
        const t = rand.next();
        const y = top + t * 190;
        this.layer.glowParticles.spawn({ frame: A.dot, x: ry.x - Math.sin(ry.a) * (y - top) + rand.range(-ry.w * 0.3, ry.w * 0.3), y, vx: rand.range(-2, 2), vy: rand.range(-1, 2), life: rand.range(3, 6), color: [1, 0.95, 0.8], alpha: 0.8, alpha1: 0, fadeIn: 0.3, glow: true, intensity: 1.4, wobble: 3, wobbleF: 0.8 });
      }
    }
  }
}

// ------------------------------------------------------------------ air

/** a drifting bank of mist (tiled), fading with a callback-driven amount */
export class MistBank implements Drawable {
  z = 50;
  private f: Frame;
  constructor(readonly y: number, readonly speed: number, readonly amount: () => number, seed = 3, w = 512, h = 60, c = '#e8f0f4') {
    this.f = bigFrame(game.r, L.paintMist(w, h, hex(c), seed, 0.7));
  }
  draw(r: Renderer, st: Stage) {
    const a = this.amount();
    if (a < 0.02) return;
    const x0 = r.visibleX0(10), x1 = r.visibleX1(10);
    const w = this.f.w;
    const scroll = st.time * this.speed;
    for (let x = Math.floor((x0 - scroll) / w) * w + scroll; x < x1; x += w) r.draw(this.f, x, this.y, 1, 1, 0, packColor(1, 1, 1, a));
  }
}

/** wind: gusts that send sand skittering along the beach */
export class BlowingSand implements Drawable {
  z = 60;
  private gust = 0;
  private t = 4;
  constructor(readonly layer: Layer) {}
  update(dt: number, st: Stage) {
    this.t -= dt;
    if (this.t <= 0) { this.t = rand.range(6, 14); this.gust = rand.range(1.5, 3); }
    this.gust = Math.max(0, this.gust - dt);
    st.wind = 0.5 + Math.min(1, this.gust) * 0.6;
    if (this.gust > 0) {
      const cx = st.cam.x;
      for (let i = 0; i < 3; i++) {
        const x = cx + rand.range(-360, 300);
        const z = x > 5000 && x < 5460 ? 'cave' : '';
        if (z || canopyAt(x) > 0.6 || wetAt(x) < 0.5) continue;
        const y = groundY(x) + rand.range(-1, 26);
        this.layer.particles.spawn({ frame: A.dot, x, y, vx: rand.range(90, 170), vy: rand.range(-8, 2), life: rand.range(0.5, 1.3), color: [0.92, 0.82, 0.62], alpha: 0.85, alpha1: 0, ay: 8 });
      }
    }
  }
  draw() {}
}

/** glowworms: blue-green pinpricks on silk threads under the cave ceiling */
export class Glowworms implements Drawable {
  z = 30;
  private w: { x: number; y: number; len: number; ph: number }[] = [];
  constructor(x0: number, x1: number, yTop: number, seed = 5) {
    const rng = new Rng(seed);
    for (let i = 0; i < 90; i++) this.w.push({ x: rng.range(x0, x1), y: yTop + rng.range(0, 30), len: rng.range(4, 16), ph: rng.range(0, 10) });
  }
  draw(r: Renderer, st: Stage) {
    for (const g of this.w) {
      const k = 0.6 + 0.4 * Math.sin(st.time * 0.7 + g.ph);
      r.rect(g.x, g.y, 1, g.len, packColor(0.5, 0.7, 0.72, 0.18));
      r.fxDraw(A.dot, g.x, g.y + g.len, 1, 1, 0, packColor(0.45, 1, 0.9, 1), 2.4 * k);
      r.fxDraw(A.glow, g.x, g.y + g.len, 0.08, 0.08, 0, packColor(0.3, 1, 0.85, 1), 0.5 * k);
    }
  }
}

export { mix, ISL };

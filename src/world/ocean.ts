// world/ocean.ts: the living prologue sea. Animated depth bands of textured water, swell physics
// for the boat, spray, sun glitter and rain ripples, all driven by one `storm` level 0..1.
//
// API (everything a scene needs is re-exported from this file)
//   export class Weather                         (world/ocean-kit.ts) shared storm/wind/lightning state
//   export class Ocean
//     constructor(o: { y: number; horizon?: number; seed?: number; weather?: Weather })
//        y: mean sea level in world y on the boat plane (p = 1); horizon: world y of the horizon (default y - 80)
//     weather: Weather; storm: number (get/set, proxies weather.storm); wind: number (get/set)
//     update(dt: number): void                   // advance swell, spray, glints (call once per frame)
//     drawBand(r: Renderer, band: BandName): void // draw one band on the CURRENT layer (see BAND_P)
//     band(name: BandName, z?: number): Drawable  // stage drawable wrapper for drawBand
//     heightAt(x: number): number                // world y of the surface at world x on the boat plane
//     slopeAt(x: number): number                 // dy/dx of that surface (y down)
//     bandSurfaceY(name, x): number              // same, for any band (in that band's layer coords)
//     spray(x, y, amount, vx?, vy?): void         // burst of spray + foam at a world point (boat plane)
//     splash(x, amount): void                    // spray burst at the surface at x (e.g. bow slam)
//     setMask(pts: [number, number][] | null)    // near band: never draw above this world polyline
//                                                // (cutaway hull: pass the transformed BOAT_LAYOUT.cutLine)
//     fields: SurfaceField[]                     // extra height fields (the giant wave adds itself)
//   export const BAND_P: Record<BandName, number> // parallax each band's stage layer must use
//   export function applySeaEnv(env: Env, w: Weather, base?: Env): void   // storm/lightning lighting & grade
//   export function addSeaLayers(st, parts, opts?) // one-call stage assembly, see bottom of file
//
// Band layers, back to front: sky (screen) -> horizon p .06 -> far p .3 -> mid p .6 ->
// boat plane p 1 (hull back, actors, hull front) -> near p 1 -> front p 1.3 -> rain (front).

import type { Env, Frame, Renderer, RGB } from '../gfx/renderer';
import { WHITE } from '../gfx/renderer';
import type { Drawable, Stage } from './stage';
import * as O from '../art/ocean';
import type { BandName, BandSpec } from '../art/ocean';
import { Sheet, Spray, Weather, col } from './ocean-kit';
import { Rng, clamp, hash2, lerp, smoothstep } from '../core/math';

export { Weather } from './ocean-kit';
export type { BandName } from '../art/ocean';

export const BAND_P: Record<BandName, number> = {
  horizon: O.BAND_SPECS.horizon.p,
  far: O.BAND_SPECS.far.p,
  mid: O.BAND_SPECS.mid.p,
  near: O.BAND_SPECS.near.p,
  front: O.BAND_SPECS.front.p,
};

/** Extra height contribution on the boat plane (world y offset, negative = up). */
export interface SurfaceField {
  offset(x: number): number;
  /** how much of the field shows on the front band (0..1) */
  frontK?: number;
  /** optional custom drawing for columns the field raises (giant wave face) */
  drawColumn?(r: Renderer, x: number, top: number, w: number, bottom: number): boolean;
}

interface WaveC {
  k: number;
  a0: number;
  a1: number;
  c: number;
  ph: number;
  q: number;
}

interface Band {
  spec: BandSpec;
  name: BandName;
  surf: number;
  calm: Frame;
  storm: Frame;
  glowCalm: Frame;
  glowStorm: Frame;
  cap: Frame | null;
  trail: Frame | null;
  fillCalm: RGB;
  fillStorm: RGB;
  waves: WaveC[];
  amp: Float32Array; // live amplitudes
  ampSum: number;
  scroll: number;
  seed: number;
}

// Boat-plane swell components: wavelength, phase speed, calm amp, storm amp, steepness.
const SWELL: [number, number, number, number, number][] = [
  [620, 70, 1.0, 25, 0.55],
  [330, 50, 2.0, 12.5, 0.6],
  [180, 38, 1.5, 6.5, 0.6],
  [96, 27, 0.8, 3.2, 0.5],
  [50, 19, 0.45, 1.4, 0.4],
];

const EMISSIVE_CALM = 0.14;
const EMISSIVE_STORM = 0.22;

export class Ocean {
  readonly weather: Weather;
  readonly y: number;
  readonly horizon: number;
  readonly seed: number;
  fields: SurfaceField[] = [];
  /** reflection strength of the near/front water in calm weather (renderer water material) */
  reflect = 0.22;
  /** set false to skip the (additive) sun glitter */
  glitter = true;
  private sheet = new Sheet();
  private bands = {} as Record<BandName, Band>;
  private glints: Frame[];
  private drops: Frame[];
  private puffs: Frame[];
  private shade: Frame;
  private ripple: Frame[];
  private sprayP = new Spray(700);
  private mask: { x: Float32Array; y: Float32Array } | null = null;
  private time = 0;
  private rng: Rng;

  constructor(o: { y: number; horizon?: number; seed?: number; weather?: Weather }) {
    this.weather = o.weather ?? new Weather();
    this.y = o.y;
    this.horizon = o.horizon ?? o.y - 80;
    this.seed = o.seed ?? 1;
    this.rng = new Rng(this.seed * 977 + 13);
    const sh = this.sheet;
    let bi = 0;
    for (const name of O.BAND_NAMES) {
      const spec = O.BAND_SPECS[name];
      const pc = O.bandPalette(O.CALM, spec.p), ps = O.bandPalette(O.STORM, spec.p);
      const seed = this.seed * 31 + bi * 7;
      const calmBuf = O.paintBandStrip(spec, pc, false, seed);
      const stormBuf = O.paintBandStrip(spec, ps, true, seed + 3);
      const rngB = new Rng(seed * 13 + 5);
      const waves: WaveC[] = SWELL.map(([lam, c, a0, a1, q]) => {
        const L = lam * spec.p * rngB.range(0.85, 1.15);
        return { k: (Math.PI * 2) / L, a0: a0 * spec.ampK, a1: a1 * spec.ampK, c: c * spec.p * rngB.range(0.9, 1.1), ph: rngB.range(0, Math.PI * 2), q };
      });
      const hasCap = spec.p >= 0.5;
      this.bands[name] = {
        spec, name,
        surf: this.horizon + (this.y - this.horizon) * spec.p,
        calm: sh.add(calmBuf), storm: sh.add(stormBuf),
        glowCalm: sh.add(O.paintCrestGlow(spec, pc, seed + 1)),
        glowStorm: sh.add(O.paintCrestGlow(spec, ps, seed + 2)),
        cap: hasCap ? sh.add(O.paintWhitecap(spec, seed + 4)) : null,
        trail: hasCap ? sh.add(O.paintFoamTrail(spec, seed + 6)) : null,
        fillCalm: O.rowColor(calmBuf, spec.texH - 2, spec.texH),
        fillStorm: O.rowColor(stormBuf, spec.texH - 2, spec.texH),
        waves,
        amp: new Float32Array(waves.length),
        ampSum: 1,
        scroll: rngB.range(0, spec.texW),
        seed,
      };
      bi++;
    }
    this.glints = O.paintGlints().map(b => sh.add(b, (b.w - 1) / 2 + 0.5, (b.h - 1) / 2 + 0.5));
    this.drops = O.paintSprayDrops().map(b => sh.add(b, b.w / 2, b.h / 2));
    this.puffs = O.paintFoamPuffs().map(b => sh.add(b, b.w / 2, b.h / 2));
    this.ripple = O.paintRipple().map(b => sh.add(b, 3.5, 3));
    this.shade = sh.add(O.paintFaceShade(28), 0, 0);
    this.updateAmps();
  }

  get storm() {
    return this.weather.storm;
  }
  set storm(v: number) {
    this.weather.storm = clamp(v);
  }
  get wind() {
    return this.weather.wind;
  }
  set wind(v: number) {
    this.weather.wind = v;
  }

  private updateAmps() {
    const s = this.weather.storm;
    const k = Math.pow(s, 1.25);
    for (const name of O.BAND_NAMES) {
      const B = this.bands[name];
      let sum = 0;
      for (let i = 0; i < B.waves.length; i++) {
        const w = B.waves[i];
        const a = lerp(w.a0, w.a1, k);
        B.amp[i] = a;
        sum += a;
      }
      B.ampSum = Math.max(0.5, sum);
    }
  }

  update(dt: number) {
    const w = this.weather;
    this.time += dt;
    this.updateAmps();
    const drift = w.cruise + Math.max(0, -w.windSpeed) * 0.12;
    for (const name of O.BAND_NAMES) {
      const B = this.bands[name];
      B.scroll += drift * B.spec.p * dt;
      if (B.scroll > B.spec.texW * 64) B.scroll -= B.spec.texW * 64;
    }
    this.sprayP.update(dt, 260, 1.6, w.windSpeed * 0.9);
    this.windSpray(dt);
  }

  /** Raw swell elevation (up = +) of a band at layer-world x (Gerstner with fixed-point inversion). */
  private elev(B: Band, x: number) {
    const t = this.time + this.weather.cruise * 0; // phase time
    const cr = this.weather.cruise;
    const W = B.waves, A = B.amp;
    let x0 = x;
    for (let it = 0; it < 3; it++) {
      let d = 0;
      for (let i = 0; i < W.length; i++) {
        const w = W[i];
        d += w.q * A[i] * Math.sin(w.k * (x0 + (w.c + cr * B.spec.p) * t) + w.ph);
      }
      x0 = x + d;
    }
    let y = 0;
    for (let i = 0; i < W.length; i++) {
      const w = W[i];
      y += A[i] * Math.cos(w.k * (x0 + (w.c + cr * B.spec.p) * t) + w.ph);
    }
    return y;
  }

  private fieldOffset(x: number, front = false) {
    let o = 0;
    for (const f of this.fields) o += f.offset(x) * (front ? f.frontK ?? 0.25 : 1);
    return o;
  }

  /** World y of the water surface on the boat plane (p = 1). */
  heightAt(x: number): number {
    return this.bands.near.surf - this.elev(this.bands.near, x) + this.fieldOffset(x);
  }
  slopeAt(x: number): number {
    return (this.heightAt(x + 3) - this.heightAt(x - 3)) / 6;
  }
  /** Surface y of any band at x in that band's own layer coordinates. */
  bandSurfaceY(name: BandName, x: number) {
    const B = this.bands[name];
    let y = B.surf - this.elev(B, x);
    if (name === 'near') y += this.fieldOffset(x);
    else if (name === 'front') y += this.fieldOffset(x / B.spec.p, true);
    return y;
  }

  /** Hide the near band above a world-space polyline (sorted by x), e.g. the cutaway hull. */
  setMask(pts: [number, number][] | null) {
    if (!pts || pts.length < 2) {
      this.mask = null;
      return;
    }
    const s = [...pts].sort((a, b) => a[0] - b[0]);
    this.mask = { x: Float32Array.from(s.map(p => p[0])), y: Float32Array.from(s.map(p => p[1])) };
  }
  private maskAt(x: number): number {
    const m = this.mask;
    if (!m) return -Infinity;
    const n = m.x.length;
    if (x < m.x[0] || x > m.x[n - 1]) return -Infinity;
    let i = 1;
    while (i < n - 1 && m.x[i] < x) i++;
    const t = (x - m.x[i - 1]) / Math.max(1e-6, m.x[i] - m.x[i - 1]);
    return m.y[i - 1] + (m.y[i] - m.y[i - 1]) * t;
  }

  // ---------------------------------------------------------------- spray

  /** Burst of spray at a world point on the boat plane. amount ~ 0..1 (1 = big bow slam). */
  spray(x: number, y: number, amount: number, vx = 0, vy = -1) {
    const n = Math.round(10 + amount * 70);
    const P = this.sprayP, g = this.rng;
    const wind = this.weather.windSpeed;
    for (let i = 0; i < n; i++) {
      const sp = (60 + g.next() * 160) * (0.4 + amount * 0.8);
      const a = Math.atan2(vy, vx) + g.range(-0.9, 0.9);
      P.spawn(x + g.range(-6, 6) * (1 + amount), y + g.range(-3, 3), Math.cos(a) * sp + wind * 0.3, Math.sin(a) * sp, g.range(0.5, 1.2), 1, g.chance(0.25) ? 3 : g.int(0, 2));
    }
    const nf = Math.round(3 + amount * 12);
    for (let i = 0; i < nf; i++) {
      P.spawn(x + g.range(-14, 14) * (0.5 + amount), y + g.range(-4, 2), g.range(-30, 30) + wind * 0.2, g.range(-60, -10) * amount, g.range(0.6, 1.4), g.range(0.6, 1.3), 2);
    }
  }
  /** Spray burst right at the water surface at x. */
  splash(x: number, amount: number) {
    this.spray(x, this.heightAt(x), amount);
  }

  private windSpray(dt: number) {
    const s = this.weather.storm;
    if (s < 0.35) return;
    const B = this.bands.near;
    const wind = this.weather.windSpeed;
    const rate = smoothstep(0.35, 1, s) * 120; // attempts per second across ~900 px
    const g = this.rng;
    const cx = this.camX;
    let n = rate * dt;
    while (n > 0) {
      if (g.next() > n) break;
      n -= 1;
      const x = cx + g.range(-520, 520);
      const e = this.elev(B, x) / B.ampSum;
      if (e < 0.45) continue;
      const y = B.surf - this.elev(B, x) + this.fieldOffset(x);
      const k = (e - 0.45) / 0.55;
      const cnt = 2 + Math.round(k * 5);
      for (let i = 0; i < cnt; i++)
        this.sprayP.spawn(x + g.range(-5, 5), y + g.range(-1, 2), wind * g.range(0.5, 1.1), -g.range(20, 70) * (0.5 + k), g.range(0.4, 1.0), 1, g.chance(0.5) ? 3 : g.chance(0.5) ? 4 : g.int(0, 1));
      if (g.chance(0.4)) this.sprayP.spawn(x, y - 1, wind * 0.5, -g.range(8, 30), g.range(0.5, 1.1), g.range(0.5, 0.9), 2);
    }
  }
  private camX = 0;

  // ---------------------------------------------------------------- drawing

  band(name: BandName, z = 0): Drawable {
    return { z, draw: (r: Renderer) => this.drawBand(r, name) };
  }

  drawBand(r: Renderer, name: BandName) {
    this.sheet.upload(r);
    const B = this.bands[name];
    const spec = B.spec;
    const w = this.weather;
    const s = w.storm;
    const cw = spec.col;
    const texW = spec.texW, texH = spec.texH;
    if (name === 'near') this.camX = r.view.x;
    const x0 = Math.floor(r.visibleX0(cw * 2) / cw) * cw;
    const x1 = r.visibleX1(cw * 2);
    const bottom = r.wy(r.VH) + 4;
    const e = lerp(EMISSIVE_CALM, EMISSIVE_STORM, s) + w.lightning * 0.1;
    r.emissive(e);
    const isNear = name === 'near', isFront = name === 'front';
    const refl = (isNear || isFront) ? this.reflect * (1 - smoothstep(0.1, 0.5, s)) : 0;
    // deep filler below the strips
    const fc = B.fillCalm, fs = B.fillStorm;
    const sb = smoothstep(0.05, 0.9, s);
    const fillC = col(lerp(fc[0], fs[0], sb), lerp(fc[1], fs[1], sb), lerp(fc[2], fs[2], sb));
    const fillTop = B.surf + B.ampSum * 1.05 + texH - 3;
    if (bottom > fillTop) {
      if (refl > 0) r.water(refl, 1.2);
      r.rect(x0 - cw, Math.floor(fillTop), x1 - x0 + cw * 3, bottom - fillTop + 2, fillC);
    }
    const scroll = B.scroll;
    const cols = Math.ceil((x1 - x0) / cw) + 1;
    const hs = this.colH.length >= cols + 2 ? this.colH : (this.colH = new Float32Array(cols + 8));
    const es = this.colE.length >= cols + 2 ? this.colE : (this.colE = new Float32Array(cols + 8));
    for (let i = 0; i <= cols + 1; i++) {
      const x = x0 + (i - 0.5) * cw;
      const el = this.elev(B, x);
      es[i] = el / B.ampSum;
      let y = B.surf - el;
      if (isNear) y += this.fieldOffset(x);
      else if (isFront) y += this.fieldOffset(x / spec.p, true);
      hs[i] = Math.round(y);
    }
    if (refl > 0) r.water(refl, 1.2);
    const sBlend = smoothstep(0.05, 0.9, s);
    const calmA = sBlend < 0.995, stormA = sBlend > 0.005;
    const stormC = col(1, 1, 1, sBlend);
    for (let i = 1; i <= cols; i++) {
      const x = x0 + (i - 1) * cw;
      let y = hs[i];
      let srcY = 0;
      if (isNear && this.mask) {
        const m = this.maskAt(x + cw / 2);
        if (m > y) {
          srcY = Math.min(texH, Math.round(m - y));
          y += srcY;
        }
      }
      const u = (((Math.floor(x + scroll) % texW) + texW) % texW);
      const hh = texH - srcY;
      if (hh <= 0) continue;
      // column raised far above the strip (giant wave): extend with filler
      const extra = y + hh < fillTop ? fillTop - (y + hh) + 1 : 0;
      let custom = false;
      for (const f of this.fields) if (f.drawColumn && isNear && f.drawColumn(r, x, y, cw, y + hh + extra)) custom = true;
      if (custom) continue;
      if (calmA) r.drawSub(B.calm, u, srcY, cw, hh, x, y, 1, 1, WHITE);
      if (stormA) r.drawSub(B.storm, u, srcY, cw, hh, x, y, 1, 1, sBlend >= 0.995 ? WHITE : stormC);
      if (extra > 0) r.rect(x, y + hh - 1, cw, extra + 1, fillC);
    }
    r.water(0);
    // lee faces of big waves (away from the key light) sit in shade
    const shadeK = smoothstep(0.25, 0.8, s) * (0.5 + spec.p * 0.5);
    if (shadeK > 0.01) {
      for (let i = 1; i <= cols; i++) {
        const slope = (hs[i + 2 < hs.length ? i + 2 : i + 1] - hs[i - 1]) / (3 * cw);
        if (slope <= 0.08) continue;
        const x = x0 + (i - 1) * cw;
        const y = hs[i];
        if (isNear && this.mask && this.maskAt(x + cw / 2) > y) continue;
        const a = clamp(smoothstep(0.08, 0.7, slope) * shadeK);
        r.draw(this.shade, x, y + 1, cw, 1 + spec.detail * 0.6, 0, col(1, 1, 1, a));
      }
    }
    // overlays: crest glow, whitecaps and trailing foam
    const glowK = lerp(0.5, 0.4, s) + w.lightning * 0.9;
    const capK = smoothstep(0.2, 0.75, s);
    for (let i = 1; i <= cols; i++) {
      const c = es[i];
      if (c < 0.2) continue;
      const x = x0 + (i - 1) * cw;
      const y = hs[i];
      if (isNear && this.mask && this.maskAt(x + cw / 2) > y) continue;
      const u = (((Math.floor(x + scroll * 1.07) % texW) + texW) % texW);
      const crest = smoothstep(0.2, 0.95, c);
      const ga = clamp(crest * glowK);
      if (ga > 0.02) {
        if (s < 0.98) r.drawSub(B.glowCalm, u, 0, cw, B.glowCalm.h, x, y + 1, 1, 1, col(1, 1, 1, ga * (1 - s)));
        if (s > 0.02) r.drawSub(B.glowStorm, u, 0, cw, B.glowStorm.h, x, y + 1, 1, 1, col(1, 1, 1, ga * s));
      }
      if (B.cap && capK > 0.01) {
        const slope = (hs[i + 1] - hs[i - 1]) / (2 * cw);
        const lee = clamp(-slope * 1.4);
        const ca = clamp(smoothstep(0.42, 0.9, c) * (0.65 + lee * 0.6) * capK);
        if (ca > 0.02) r.drawSub(B.cap, u, 0, cw, B.cap.h, x, y, 1, 1, col(1, 1, 1, ca));
      }
    }
    if (B.trail && capK > 0.01) {
      for (let i = 1; i <= cols; i++) {
        const slope = (hs[i + 1] - hs[i - 1]) / (2 * cw);
        if (slope <= 0.05) continue;
        const c = es[i];
        const ta = clamp(smoothstep(0.05, 0.5, slope) * smoothstep(-0.6, 0.5, c) * capK * 0.8);
        if (ta < 0.03) continue;
        const x = x0 + (i - 1) * cw;
        const y = hs[i];
        if (isNear && this.mask && this.maskAt(x + cw / 2) > y) continue;
        const u = (((Math.floor(x + scroll * 0.93) % texW) + texW) % texW);
        r.drawSub(B.trail, u, 0, cw, B.trail.h, x, y + 2, 1, 1, col(1, 1, 1, ta));
      }
    }
    r.emissive();
    if (this.glitter && s < 0.6) this.drawGlitter(r, B, x0, x1, cw, hs);
    if (isNear) {
      this.drawRain(r, B, x0, x1, cw, hs);
      this.drawSpray(r);
    }
  }
  private colH = new Float32Array(0);
  private colE = new Float32Array(0);

  /** Sun glitter: twinkling glints stuck to the moving texture, dense under the sun. */
  private drawGlitter(r: Renderer, B: Band, x0: number, x1: number, cw: number, hs: Float32Array) {
    const w = this.weather;
    const k = 1 - smoothstep(0.05, 0.55, w.storm);
    if (k <= 0) return;
    const spec = B.spec;
    const sunSx = w.sunX * r.VW;
    const texW = spec.texW;
    const n = Math.round(spec.texW / 7);
    const t = this.time;
    const base = Math.floor((x0 + B.scroll) / texW) * texW;
    for (let rep = 0; rep < 3; rep++) {
      const off = base + rep * texW - B.scroll;
      if (off > x1) break;
      for (let i = 0; i < n; i++) {
        const u = hash2(i, 7, B.seed) * texW;
        const x = off + u;
        if (x < x0 || x > x1) continue;
        const sx = r.sx(x);
        const dsun = Math.abs(sx - sunSx) / (60 + spec.p * 90);
        const path = Math.exp(-dsun * dsun);
        const ph = hash2(i, 9, B.seed) * 6.283, fq = 1.5 + hash2(i, 11, B.seed) * 3.5;
        let tw = Math.sin(t * fq + ph);
        if (tw < 0.6) continue;
        tw = (tw - 0.6) / 0.4;
        const chance = 0.18 + path * 0.82;
        if (hash2(i, 13, B.seed) > chance) continue;
        const ci = Math.min(hs.length - 2, Math.max(1, Math.floor((x - x0) / cw) + 1));
        const depth = Math.pow(hash2(i, 17, B.seed), 1.6) * (spec.texH * (0.25 + path * 0.35));
        const y = hs[ci] + 1 + depth;
        const big = path > 0.5 && hash2(i, 19, B.seed) > 0.7 ? (spec.p >= 0.9 ? 3 : 2) : hash2(i, 23, B.seed) > 0.75 ? 1 : 0;
        const inten = (0.6 + path * 1.8) * tw * k * (0.55 + spec.p * 0.45);
        r.fxDraw(this.glints[big], x, y, 1, 1, 0, col(1, 0.97, 0.86, 1), inten, true);
      }
    }
  }

  /** Raindrop ripples on the boat-plane water. */
  private drawRain(r: Renderer, B: Band, x0: number, x1: number, cw: number, hs: Float32Array) {
    const s = this.weather.storm;
    const k = smoothstep(0.35, 0.9, s);
    if (k <= 0) return;
    const n = Math.round(90 * k);
    const t = this.time;
    for (let i = 0; i < n; i++) {
      const life = 0.3;
      const cyc = t / life + hash2(i, 3, 5);
      const gen = Math.floor(cyc);
      const f = cyc - gen;
      const x = x0 + hash2(i, gen, 7) * (x1 - x0);
      const ci = Math.min(hs.length - 2, Math.max(1, Math.floor((x - x0) / cw) + 1));
      if (this.mask && this.maskAt(x) > hs[ci]) continue;
      const y = hs[ci] + 1 + hash2(i, gen, 9) * 14;
      r.fxDraw(this.ripple[Math.min(2, Math.floor(f * 3))], x, y, 1, 1, 0, col(0.78, 0.84, 0.86, 0.8), 0.9, false);
    }
    void x1;
  }

  private drawSpray(r: Renderer) {
    const P = this.sprayP;
    const light = 0.62 + this.weather.lightning * 0.6;
    const cool = col(0.86 * light, 0.93 * light, 0.95 * light, 1);
    for (let i = 0; i < P.count; i++) {
      const k = P.t[i] / P.life[i];
      const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      if (a <= 0.02) continue;
      const kind = P.kind[i];
      if (kind === 2) {
        const sz = P.size[i] * (0.7 + k * 0.8);
        const fr = this.puffs[sz > 1.1 ? 2 : sz > 0.8 ? 1 : 0];
        r.fxDraw(fr, P.x[i], P.y[i], sz, sz, 0, col(0.86 * light, 0.93 * light, 0.95 * light, a * 0.85), 1, false);
      } else {
        const fr = this.drops[kind === 3 ? 3 : kind === 4 ? 4 : kind];
        const flip = P.vx[i] < 0 ? 1 : -1;
        r.fxDraw(fr, P.x[i], P.y[i], flip, 1, 0, cool, a * 1.1, false);
      }
    }
    void WHITE;
  }
}

// ------------------------------------------------------------------ environment

const STORM_ENV = {
  ambientTop: [0.42, 0.47, 0.52] as RGB,
  ambientBottom: [0.3, 0.35, 0.38] as RGB,
  fogTop: [0.12, 0.15, 0.17] as RGB,
  fogBottom: [0.15, 0.19, 0.2] as RGB,
  saturation: 0.78,
  contrast: 1.08,
  bloom: 0.55,
  bloomThreshold: 0.78,
  vignette: 0.55,
  lift: [0.01, 0.02, 0.03] as RGB,
  gain: [0.96, 1.0, 1.03] as RGB,
  waterTint: [0.5, 0.58, 0.6] as RGB,
};

const mixRGB = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/**
 * Drive the lighting/grade from the weather. Call from `stage.envHook` every frame:
 *   st.envHook = env => applySeaEnv(env, weather)
 * `env` should hold the calm 'day' preset (the Stage copies its preset in before the hook runs).
 */
export function applySeaEnv(env: Env, w: Weather) {
  const s = smoothstep(0, 1, w.storm);
  env.ambientTop = mixRGB(env.ambientTop, STORM_ENV.ambientTop, s);
  env.ambientBottom = mixRGB(env.ambientBottom, STORM_ENV.ambientBottom, s);
  env.fogTop = mixRGB(env.fogTop, STORM_ENV.fogTop, s);
  env.fogBottom = mixRGB(env.fogBottom, STORM_ENV.fogBottom, s);
  env.saturation = lerp(env.saturation, STORM_ENV.saturation, s);
  env.contrast = lerp(env.contrast, STORM_ENV.contrast, s);
  env.bloom = lerp(env.bloom, STORM_ENV.bloom, s);
  env.bloomThreshold = lerp(env.bloomThreshold, STORM_ENV.bloomThreshold, s);
  env.vignette = lerp(env.vignette, STORM_ENV.vignette, s);
  env.lift = mixRGB(env.lift, STORM_ENV.lift, s);
  env.gain = mixRGB(env.gain, STORM_ENV.gain, s);
  env.waterTint = mixRGB(env.waterTint, STORM_ENV.waterTint, s);
  const f = w.lightning;
  if (f > 0) {
    env.ambientTop = [env.ambientTop[0] + f * 1.1, env.ambientTop[1] + f * 1.15, env.ambientTop[2] + f * 1.35];
    env.ambientBottom = [env.ambientBottom[0] + f * 0.7, env.ambientBottom[1] + f * 0.75, env.ambientBottom[2] + f * 0.9];
    env.exposure = env.exposure * (1 + f * 0.18);
    env.saturation *= 1 - f * 0.3;
  }
}

/** Drawable that just runs a callback each frame (for update-only helpers). */
export function updater(fn: (dt: number, st: Stage) => void): Drawable {
  return { z: -1e9, draw() {}, update: fn };
}

// V4 island effects: a continuous time of day (morning -> midday -> golden hour -> dusk -> night)
// that blends lighting, sky, clouds and the sea; the sky with sun, moon, stars and the morning
// rainbow; (the sea itself is beachsea.ts) rolling breakers and the swash sliding up the wet sand;
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
import { SKY_KEYS, SkyKey, paintSkyKey, paintLeafShadow } from '../../art/island4/scenery';
import { paintIsleSun, paintRainbowLeg, paintIsleCloud } from '../../art/island4/seascape';
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

export class IsleSky implements Drawable {
  z = 0;
  private skies: Frame[] = [];
  private sun: Frame;
  private halo: Frame;
  private moon: Frame;
  private rainbow: Frame;
  private stars = L.starField(SKY_W, 170, 7, 150);
  constructor(readonly clock: DayClock) {
    const r = game.r;
    for (const k of SKY_KEYS) this.skies.push(bigFrame(r, paintSkyKey(k, SKY_W, SKY_H)));
    this.sun = local.add('isle:sun2', paintIsleSun(), 26, 26);
    this.halo = local.add('isle:sunhalo', paintIsleSun(true), 26, 26);
    this.moon = local.add('isle:moon', L.paintMoon(8, hex('#eef2f6'), hex('#bcc6d4'), hex('#8e98aa'), 0.25), 9, 9);
    this.rainbow = bigFrame(r, paintRainbowLeg(150));
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
    // the morning rainbow after the storm: one faint, broken leg rising out of the sea
    const rk = c.morning * 0.8;
    if (rk > 0.02) r.draw(this.rainbow, Math.round(r.VW * 0.86 - this.rainbow.w * 0.94), Math.round(hy - this.rainbow.h + 3), 1, 1, 0, packColor(1, 1, 1, rk));
    // sun / moon
    const s = sunAt(c.t);
    const sx = s.x * r.VW, sy = s.y * SKY_HORIZON * 1.25 + par;
    const [cr, cg, cb] = s.c;
    if (s.moon) {
      r.draw(this.moon, sx, sy);
      r.fxDraw(A.glow, sx, sy, 2.4, 2.4, 0, packColor(0.7, 0.8, 1, 1), 0.45 * nk);
    } else {
      // a crisp painted disc and its stepped, dithered halo (no smooth glow sprites)
      const low = smoothstep(0.35, 0.95, s.y);
      const tint = packColor(1, 1 - low * 0.25, 1 - low * 0.5, 1);
      r.draw(this.halo, Math.round(sx), Math.round(sy), 1, 1, 0, tint);
      r.emissive(1);
      r.draw(this.sun, Math.round(sx), Math.round(sy), 1, 1, 0, tint);
      r.emissive();
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
    const ramp = ['#9aa6bc', '#c4d0de', '#e8eef4', '#ffffff'].map(h => hex(h));
    const rng = new Rng(seed);
    for (let i = 0; i < 5; i++) this.fr.push(bigFrame(game.r, paintIsleCloud(seed + i * 7, big ? rng.int(120, 200) : rng.int(60, 110), big ? rng.int(40, 60) : rng.int(24, 36), ramp)));
    for (let i = 0; i < n; i++) this.items.push({ f: rng.int(0, 4), x: rng.range(span.x0, span.x0 + span.w), y: rng.range(y0, y1), v: rng.range(1.5, 4) * (big ? 0.6 : 1), k: rng.range(0.8, 1) });
    this.span = span;
  }
  private span: { x0: number; w: number };
  draw(r: Renderer, st: Stage) {
    const [cr, cg, cb] = skyTintAt(this.clock.t);
    for (const c of this.items) {
      const f = this.fr[c.f];
      const x = this.span.x0 + ((((c.x + st.time * c.v - this.span.x0) % this.span.w) + this.span.w) % this.span.w);
      r.draw(f, Math.round(x - f.w / 2), Math.round(c.y), 1, 1, 0, packColor(cr * c.k, cg * c.k, cb * c.k, 1));
    }
  }
}

// ------------------------------------------------------------------ sea

/**
 * Batches 1px pixel columns into runs: each column puts up to SLOTS vertical spans; a slot whose span
 * matches the previous column's (same top, height and colour) just grows, so a crest drawn per pixel
 * column costs a few dozen rects, not hundreds.
 */
class SpanBatch {
  private x0 = new Int32Array(6);
  private y = new Int32Array(6);
  private h = new Int32Array(6);
  private c = new Uint32Array(6);
  private open = new Uint8Array(6);
  private hit = new Uint8Array(6);
  constructor(private r: Renderer | null = null) {}
  begin(r: Renderer) { this.r = r; this.open.fill(0); }
  put(slot: number, x: number, y: number, h: number, c: number) {
    if (h <= 0) return;
    this.hit[slot] = 1;
    if (this.open[slot] && this.y[slot] === y && this.h[slot] === h && this.c[slot] === c) return;
    this.emit(slot, x);
    this.open[slot] = 1; this.x0[slot] = x; this.y[slot] = y; this.h[slot] = h; this.c[slot] = c;
  }
  /** end of column x: close every slot that wasn't put this column */
  col(x: number) {
    for (let k = 0; k < 6; k++) { if (!this.hit[k]) this.emit(k, x); this.hit[k] = 0; }
  }
  /** emit slot k's open run, which ended just before column x */
  private emit(k: number, x: number) {
    if (!this.open[k]) return;
    this.open[k] = 0;
    this.r!.rect(this.x0[k], this.y[k], x - this.x0[k], this.h[k], this.c[k]);
  }
  end(x: number) { for (let k = 0; k < 6; k++) this.emit(k, x); }
}

const SURF = {
  face: packColor(0.12, 0.45, 0.56, 1), face2: packColor(0.15, 0.53, 0.62, 1), glass: packColor(0.25, 0.68, 0.72, 1),
  lit: packColor(0.5, 0.82, 0.8, 1), foamHi: packColor(0.97, 1, 0.99, 1), foam: packColor(0.86, 0.96, 0.94, 1),
  foamSh: packColor(0.36, 0.72, 0.73, 0.85), spray: packColor(1, 1, 1, 0.9),
};

/**
 * Rolling lines of surf in the near band: a swell lifts (a dark face with a broken lit crest), steepens
 * (a glassy translucent top over the dark face, the lip whitening in clots that peel along the line,
 * spray thrown off it), breaks, and spreads as a white-water band that tears into lace as it runs in.
 * Every break sends a swash up the sand. Drawn per pixel column in merged runs.
 */
export class Breakers implements Drawable {
  z = 5;
  rows = [0, 0.34, 0.68];
  onBreak: ((i: number) => void) | null = null;
  private sb = new SpanBatch();
  constructor(readonly yFar: number, readonly yNear: number, readonly period = 7.5) {}
  update(dt: number) {
    for (let i = 0; i < this.rows.length; i++) {
      const prev = this.rows[i];
      this.rows[i] = (prev + dt / this.period) % 1;
      if (prev < 0.8 && this.rows[i] >= 0.8) this.onBreak?.(i);
    }
  }
  draw(r: Renderer, st: Stage) {
    const x0 = Math.floor(r.visibleX0(4)), x1 = Math.ceil(r.visibleX1(4));
    const tick = Math.floor(st.time * 8);
    const sb = this.sb;
    for (let i = 0; i < this.rows.length; i++) {
      const ph = this.rows[i];
      const yBase = lerp(this.yFar, this.yNear, smoothstep(0, 1, ph));
      sb.begin(r);
      for (let x = x0; x < x1; x++) {
        // the line breaks earlier in some places than others, so the break peels along the beach
        const q = ph + (noise1(x / 90 + i * 13, 5) - 0.5) * 0.18 + (noise1(x / 21 + i * 3, 8) - 0.5) * 0.05;
        const y = Math.round(yBase + (noise1(x / 47 + i * 7, 6) - 0.5) * 3 + (noise1(x / 13 + i * 5, 14) - 0.5) * 1.6);
        if (q >= 0.04 && q <= 1.08) {
          if (q < 0.5) {
            const a = smoothstep(0.04, 0.5, q);
            const hh = 1 + Math.round(a * 3);
            sb.put(0, x, y - hh, hh, a > 0.5 ? SURF.face : SURF.face2);
            // the crest catches the sky only in stretches
            if (noise1(x / 7 + i * 5, 9) > 0.62 - a * 0.25) sb.put(1, x, y - hh - 1, 1, SURF.lit);
          } else if (q < 0.78) {
            const a = (q - 0.5) / 0.28;
            const hh = 4 + Math.round(a * 4);
            const glass = Math.max(1, Math.round(hh * 0.45));
            sb.put(0, x, y - hh + glass, hh - glass, SURF.face);
            sb.put(1, x, y - hh, glass, SURF.glass);
            const fh = Math.round(clamp((q - 0.6) * 12 + (noise1(x / 5 + i * 11, 10) - 0.5) * 2.4, 0, 3));
            sb.put(2, x, y - hh - 1, fh || 1, fh ? SURF.foamHi : SURF.lit);
            // spray off the lip in little clusters, re-thrown eight times a second
            if (q > 0.66 && hash2(Math.floor(x / 3), tick, i) < 0.2) sb.put(3, x, y - hh - 2 - (hash2(x, tick, i + 1) < 0.5 ? 1 : 2), 1, SURF.spray);
          } else {
            // white water spreading in, tearing into lace as it goes
            const k = (q - 0.78) / 0.3;
            const lace = noise1(x / 3.2 + i * 31, 12) * 0.7 + noise1(x / 9 + i * 17, 13) * 0.3;
            // a lumpy top: clots heaped up where the lace is thickest
            const fh = Math.max(1, Math.round(lerp(5, 1, k) * (0.45 + lace * 0.9)));
            if (lace > lerp(0.12, 0.66, k)) {
              sb.put(0, x, y - fh, fh, k < 0.35 && lace > 0.4 ? SURF.foamHi : SURF.foam);
              sb.put(1, x, y, 1, SURF.foamSh);
              if (k < 0.5 && lace > 0.7) sb.put(2, x, y - fh - 1, 1, SURF.foam);
            }
          }
        }
        sb.col(x);
      }
      sb.end(x1);
    }
  }
}

/**
 * The swash: a thin sheet of water sliding up the wet sand behind a lace of foam, lingering, then
 * draining back; the foam it leaves at the high-water mark thins into a broken line and the sand it
 * wetted stays dark for a while behind it (drawn under the actors).
 */
export class Swash implements Drawable {
  z = -9;
  sheets: { t: number; reach: number; seed: number }[] = [];
  private sb = new SpanBatch();
  update(dt: number) {
    for (const s of this.sheets) s.t += dt;
    this.sheets = this.sheets.filter(s => s.t < 9);
  }
  push(reach = rand.range(12, 22)) { this.sheets.push({ t: 0, reach, seed: rand.int(0, 999) }); }
  private static runK(t: number) { return t < 1.1 ? smoothstep(0, 1.1, t) : t < 2 ? 1 : 1 - smoothstep(2, 4.6, t); }
  private static full(s: { reach: number; seed: number }, x: number) { return s.reach + (noise1(x / 18 + s.seed, 3) - 0.5) * 8 + (noise1(x / 5 + s.seed, 7) - 0.5) * 2; }
  /** 0..1: how much a sheet of water is covering the walk line at x right now (wading, splashes) */
  coverAt(x: number): number {
    if (wetAt(x) < 0.5) return 0;
    let c = 0;
    for (const s of this.sheets) {
      const t = s.t;
      if (t > 4.8) continue;
      const edge = Swash.full(s, x) * Swash.runK(t);
      if (edge > 3) c = Math.max(c, Math.min(1, edge / 10) * (t < 2.6 ? 1 : 1 - smoothstep(2.6, 4.8, t)));
    }
    return c;
  }
  draw(r: Renderer) {
    const x0 = Math.floor(r.visibleX0(4)), x1 = Math.ceil(r.visibleX1(4));
    const sb = this.sb;
    // the sand the water just left stays dark and glossy, drying from the top down
    r.beginShadows();
    for (const s of this.sheets) {
      if (s.t < 1.1) continue;
      const dk = 1 - smoothstep(2.4, 8.8, s.t);
      if (dk < 0.03) continue;
      const k = Swash.runK(s.t);
      const a = packColor(1, 1, 1, 0.2 * dk), a2 = packColor(1, 1, 1, 0.12 * dk);
      sb.begin(r);
      for (let x = x0; x < x1; x++) {
        if (wetAt(x) >= 0.5) {
          const gy = Math.round(groundY(x)) - 2;
          const full = Math.round(Swash.full(s, x)), cur = Math.round(full * k);
          // drying: the top of the wet patch goes first
          const dry = Math.round((full - 2) * smoothstep(4, 8.8, s.t));
          const top = Math.max(cur, dry);
          if (full - top > 0) sb.put(0, x, gy + top, full - top, a);
          if (full - top > 1) sb.put(1, x, gy + full - 1, 1, a2);
        }
        sb.col(x);
      }
      sb.end(x1);
    }
    r.endShadows();
    for (const s of this.sheets) {
      const t = s.t;
      if (t > 7.5) continue;
      const k = Swash.runK(t);
      const alpha = t < 2.6 ? 0.55 : 0.55 * (1 - smoothstep(2.6, 4.8, t));
      // the water sheet (a mirror, so it reflects like the wet sand)
      if (alpha > 0.02) {
        r.water(0.55, 0.8);
        const sheet = packColor(0.6, 0.83, 0.85, alpha * 0.7);
        sb.begin(r);
        for (let x = x0; x < x1; x++) {
          if (wetAt(x) >= 0.5) {
            const gy = Math.round(groundY(x)) - 2;
            const e = Math.round(Swash.full(s, x) * k);
            if (e >= 1) sb.put(0, x, gy, e, sheet);
          }
          sb.col(x);
        }
        sb.end(x1);
        r.water(0);
      }
      // the foam: a lace edge riding the sheet (clots and gaps, a bubble line behind it), then a
      // broken scum line left at the high-water mark that thins out and pops
      const back = t > 2;
      const fa = back ? 1 - smoothstep(2.6, 7.5, t) : 1;
      if (fa < 0.03) continue;
      const fHi = packColor(0.98, 1, 1, 0.95 * fa), fLo = packColor(0.85, 0.95, 0.94, 0.8 * fa), bub = packColor(1, 1, 1, 0.7 * fa);
      const thin = back ? smoothstep(2.2, 7, t) : 0;
      sb.begin(r);
      for (let x = x0; x < x1; x++) {
        if (wetAt(x) >= 0.5) {
          const gy = Math.round(groundY(x)) - 2;
          const full = Swash.full(s, x);
          const e = Math.round(back ? full : full * k);
          if (e >= 1) {
            const clot = noise1(x / 6 + s.seed, 4);
            const holes = noise1(x / 2.3 + s.seed * 0.7, 5);
            if (holes > 0.18 + thin * 0.6) {
              const th = clot > 0.62 && !back ? 2 : 1;
              sb.put(0, x, gy + e - th, th, clot > 0.4 ? fHi : fLo);
              if (!back && clot > 0.55 && hash2(Math.floor(x / 2), s.seed, 2) < 0.5) sb.put(1, x, gy + e - th - 2, 1, bub);
            }
            // the sheet draining back past it trails a thinner second line
            if (back && t < 4.6) {
              const cur = Math.round(full * k);
              if (cur >= 1 && cur < e - 2 && holes > 0.45) sb.put(2, x, gy + cur, 1, fLo);
            }
          }
        }
        sb.col(x);
      }
      sb.end(x1);
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

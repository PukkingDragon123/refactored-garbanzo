// world/ocean-sky.ts: the prologue sky (calm cumulus to churning storm deck), lightning and rain.
//
// API
//   export class Sky implements Drawable       // put on a SCREEN layer (st.addScreenLayer('sky'))
//     constructor(o: { weather: Weather; horizon: number; horizonP?: number; seed?: number })
//        horizon: world y of the sea horizon on the horizon band (use ocean.horizon, p = BAND_P.horizon)
//     weather: Weather; storm (get/set -> weather.storm)
//     auto: boolean                            // random lightning when storm > 0.55 (default true)
//     onStrike?: (big: boolean, screenX: number) => void   // hook for thunder audio / r.post.flash
//     flash(o?: { x?: number; big?: boolean; delay?: number }): void  // trigger a strike (x = screen x)
//     readonly lightning: number               // current flash brightness (also written to weather.lightning)
//     birds: boolean                           // distant seabirds (calm only)
//     update(dt); draw(r)
//   export class Rain implements Drawable      // one per depth; put on a layer with the matching parallax
//     constructor(weather: Weather, depth: 'far' | 'mid' | 'near', seed?: number)
//     density: number                          // multiplier (default 1)
//   export const RAIN_P = { far: 0.5, mid: 1, near: 1.35 }

import type { Frame, Renderer } from '../gfx/renderer';
import { REF_Y } from '../gfx/renderer';
import type { Drawable } from './stage';
import * as SA from '../art/ocean-sky';
import { glowSprite, softBar } from '../art/ocean';
import { Sheet, Weather, col } from './ocean-kit';
import { Rng, clamp, lerp, smoothstep } from '../core/math';

interface CloudSprite {
  f: Frame;
  lit?: Frame;
  x: number;
  y: number;
  p: number;
  v: number;
}

interface Strike {
  t: number;
  x: number;
  bolt: number;
  big: boolean;
  env: number[]; // [time, value] pairs
  dur: number;
}

const GRAD_H = 240;

export class Sky implements Drawable {
  z = 0;
  readonly weather: Weather;
  horizon: number;
  horizonP: number;
  auto = true;
  birds = true;
  onStrike?: (big: boolean, screenX: number) => void;
  private sheet = new Sheet();
  private gCalm: Frame; private gStorm: Frame;
  private sun: Frame; private sunGlow: Frame; private glow: Frame; private bar: Frame;
  private cumulus: CloudSprite[] = [];
  private cirrus: CloudSprite[] = [];
  private bankCalm: Frame; private bankStorm: Frame;
  private decks: { f: Frame; lit: Frame }[] = [];
  private towers: CloudSprite[] = [];
  private scud: CloudSprite[] = [];
  private curtain: Frame;
  private bolts: Frame[] = [];
  private birdF: Frame[];
  private birdList: { x: number; y: number; v: number; ph: number; p: number }[] = [];
  private strikes: Strike[] = [];
  private nextAuto = 4;
  private rng: Rng;
  private time = 0;
  private drift = { calm: 0, storm: 0, scud: 0, deckA: 0, deckB: 0, curtain: 0 };
  private _lightning = 0;
  private lastStrikeX = 0.5;

  constructor(o: { weather: Weather; horizon: number; horizonP?: number; seed?: number }) {
    this.weather = o.weather;
    this.horizon = o.horizon;
    this.horizonP = o.horizonP ?? 0.06;
    const seed = o.seed ?? 3;
    this.rng = new Rng(seed * 7 + 1);
    const sh = this.sheet;
    this.gCalm = sh.add(SA.paintSkyGradient(GRAD_H, false));
    this.gStorm = sh.add(SA.paintSkyGradient(GRAD_H, true));
    const sun = SA.paintSun();
    this.sun = sh.add(sun, sun.w / 2, sun.h / 2);
    const sg = SA.paintSunGlow(210, 150);
    this.sunGlow = sh.add(sg, sg.w / 2, sg.h / 2);
    this.glow = sh.add(glowSprite(64, 2.2), 32, 32);
    this.bar = sh.add(softBar(64, 8), 32, 4);
    const rng = new Rng(seed * 31 + 9);
    const cu: [number, number, number, number, number][] = [
      // w, h, y (from horizon, negative = above), parallax, speed
      [210, 78, -150, 0.06, 1.0], [170, 64, -128, 0.055, 1.1], [130, 50, -96, 0.045, 0.9],
      [96, 38, -70, 0.035, 0.8], [80, 32, -56, 0.03, 0.7], [120, 44, -84, 0.04, 0.85], [64, 26, -44, 0.025, 0.6],
    ];
    let cx = 0;
    for (const [w, hh, y, p, v] of cu) {
      const buf = SA.paintCumulus(seed + cx, w, hh, { flat: rng.range(0.74, 0.86) });
      this.cumulus.push({ f: sh.add(buf), x: rng.range(0, 900), y, p, v });
      cx++;
    }
    for (let i = 0; i < 3; i++) {
      const w = rng.int(120, 200);
      this.cirrus.push({ f: sh.add(SA.paintCirrus(seed + 40 + i, w, rng.int(8, 13))), x: rng.range(0, 900), y: rng.range(-205, -170), p: 0.01, v: 0.4 });
    }
    this.bankCalm = sh.add(SA.paintCloudBank(seed + 50, 512, 30, false));
    this.bankStorm = sh.add(SA.paintCloudBank(seed + 51, 512, 44, true));
    for (let i = 0; i < 2; i++) {
      const d = SA.paintStormDeck(seed + 60 + i, 512, 120);
      this.decks.push({ f: sh.add(d.base), lit: sh.add(d.lit) });
    }
    for (let i = 0; i < 4; i++) {
      const w = rng.int(220, 320), hh = rng.int(100, 130);
      const t = SA.paintStormTower(seed + 70 + i, w, hh);
      this.towers.push({ f: sh.add(t.base), lit: sh.add(t.lit), x: i * 260 + rng.range(-40, 40), y: -hh + 12, p: 0.03, v: 1 });
    }
    for (let i = 0; i < 9; i++) {
      const w = rng.int(80, 170), hh = rng.int(14, 26);
      this.scud.push({ f: sh.add(SA.paintScud(seed + 80 + i, w, hh)), x: rng.range(0, 1100), y: rng.range(-150, -50), p: rng.range(0.08, 0.2), v: rng.range(0.7, 1.3) });
    }
    this.curtain = sh.add(SA.paintRainCurtain(seed + 90, 256, 170));
    for (let i = 0; i < 6; i++) {
      const b = SA.paintBolt(seed + 100 + i, 130 + i * 22, i % 3 === 0 ? 1.6 : 1);
      this.bolts.push(sh.add(b.buf, b.ax, b.ay));
    }
    this.birdF = SA.paintBirds().map(b => sh.add(b, 3.5, 1.5));
    for (let i = 0; i < 7; i++) this.birdList.push({ x: rng.range(0, 800), y: rng.range(-150, -60), v: rng.range(6, 14), ph: rng.range(0, 10), p: rng.range(0.1, 0.3) });
  }

  get storm() {
    return this.weather.storm;
  }
  set storm(v: number) {
    this.weather.storm = clamp(v);
  }
  get lightning() {
    return this._lightning;
  }

  /** Trigger a lightning strike. x: screen x (0..VW) or fraction when <= 1.5; big = close and bright. */
  flash(o: { x?: number; big?: boolean; delay?: number } = {}) {
    const g = this.rng;
    const big = o.big ?? g.chance(0.35);
    const x = o.x ?? g.range(0.08, 0.92);
    // multi-stroke envelope: leader, return strokes, afterglow
    const env: number[] = [0, 0];
    let t = 0.0;
    const strokes = big ? g.int(2, 4) : g.int(1, 3);
    for (let i = 0; i < strokes; i++) {
      t += i === 0 ? 0.02 : g.range(0.05, 0.12);
      const v = (i === 0 ? 1 : g.range(0.45, 0.9)) * (big ? 1.25 : 0.7);
      env.push(t, v, t + 0.035, v * 0.35);
    }
    env.push(t + 0.25, big ? 0.18 : 0.08, t + 0.7, 0);
    this.strikes.push({ t: -(o.delay ?? 0), x, bolt: g.int(0, this.bolts.length - 1), big, env, dur: t + 0.7 });
    this.lastStrikeX = x;
  }

  private envAt(s: Strike) {
    const e = s.env, t = s.t;
    if (t < 0) return 0;
    for (let i = 2; i < e.length; i += 2) {
      if (t <= e[i]) {
        const k = (t - e[i - 2]) / Math.max(1e-4, e[i] - e[i - 2]);
        return lerp(e[i - 1], e[i + 1], k);
      }
    }
    return 0;
  }

  update(dt: number) {
    const w = this.weather;
    this.time += dt;
    const ws = w.windSpeed;
    this.drift.calm += ws * 0.05 * dt;
    this.drift.storm += ws * 0.08 * dt;
    this.drift.scud += ws * 0.55 * dt;
    this.drift.deckA += ws * 0.06 * dt;
    this.drift.deckB += ws * 0.11 * dt;
    this.drift.curtain += ws * 0.18 * dt;
    if (this.auto && w.storm > 0.55) {
      this.nextAuto -= dt * (0.4 + w.storm);
      if (this.nextAuto <= 0) {
        this.flash();
        this.nextAuto = this.rng.range(2.5, 8);
      }
    }
    let L = 0;
    for (const s of this.strikes) {
      const before = s.t;
      s.t += dt;
      if (before < 0.02 && s.t >= 0.02) this.onStrike?.(s.big, s.x);
      L = Math.max(L, this.envAt(s));
    }
    this.strikes = this.strikes.filter(s => s.t < s.dur);
    this._lightning = L;
    w.lightning = L;
  }

  /** Screen y of the horizon for the current view. */
  horizonScreenY(r: Renderer) {
    return r.projectY(this.horizon, this.horizonP);
  }

  draw(r: Renderer) {
    this.sheet.upload(r);
    const w = this.weather;
    const s = w.storm;
    const VW = r.VW, VH = r.VH;
    const hy = Math.round(this.horizonScreenY(r));
    const vx = r.view.x, vy = r.view.y - REF_Y;
    const ks = smoothstep(0.1, 0.85, s);
    const kc = 1 - smoothstep(0.25, 0.65, s);
    const L = this._lightning;
    // 1. gradients
    const gy = hy + 10 - GRAD_H;
    if (gy > 0) {
      r.rect(0, 0, VW, gy + 1, s < 0.5 ? col(0.165, 0.45, 0.77) : col(0.047, 0.067, 0.078));
    }
    if (ks < 0.999) r.drawSub(this.gCalm, 0, 0, Math.min(VW + 2, SA.SKY_W), GRAD_H, 0, gy);
    if (ks > 0.001) r.drawSub(this.gStorm, 0, 0, Math.min(VW + 2, SA.SKY_W), GRAD_H, 0, gy, 1, 1, col(1, 1, 1, ks));
    // 2. sun
    const sx = w.sunX * VW, sy = w.sunY * VH;
    const ksun = 1 - smoothstep(0.15, 0.42, s);
    if (ksun > 0.01) {
      r.draw(this.sunGlow, sx, sy, 1, 1, 0, col(1, 1, 1, ksun * 0.9));
      r.emissive(1);
      r.draw(this.sun, sx, sy, 1, 1, 0, col(1, 1, 1, ksun));
      r.emissive();
      r.fxDraw(this.glow, sx, sy, 1.4, 1.4, 0, col(1, 0.97, 0.88), 1.1 * ksun, true);
      r.fxDraw(this.glow, sx, sy, 4.5, 3.5, 0, col(1, 0.93, 0.8), 0.22 * ksun, true);
      r.fxDraw(this.bar, sx, sy, 3.5, 0.5, 0, col(1, 0.95, 0.85), 0.35 * ksun, true);
    }
    // 3. calm clouds
    const grey = lerp(1, 0.5, smoothstep(0, 0.6, s));
    if (kc > 0.01) {
      const cc = col(grey, grey, grey * 1.02, kc);
      for (const c of this.cirrus) this.drawWrapped(r, c.f, c.x - vx * c.p + this.drift.calm * 0.3, hy + c.y - vy * c.p, VW, cc);
      this.tile(r, this.bankCalm, -vx * 0.02 + this.drift.calm * 0.4, hy - this.bankCalm.h + 3, VW, cc);
      for (const c of this.cumulus) this.drawWrapped(r, c.f, c.x - vx * c.p + this.drift.calm * c.v, hy + c.y - vy * c.p, VW, cc);
    }
    // 4. storm clouds
    if (ks > 0.01) {
      const k = ks;
      const kt = smoothstep(0.12, 0.55, s);
      this.tile(r, this.bankStorm, -vx * 0.02 + this.drift.storm * 0.4, hy - this.bankStorm.h + 4, VW, col(1, 1, 1, kt));
      const strikeSx = this.lastStrikeX <= 1.5 ? this.lastStrikeX * VW : this.lastStrikeX;
      for (const t of this.towers) {
        const x = this.wrapX(t.x - vx * t.p + this.drift.storm, t.f.w, VW);
        r.draw(t.f, x, hy + t.y - vy * t.p, 1, 1, 0, col(1, 1, 1, kt));
        if (L > 0.02 && t.lit) {
          const fall = Math.exp(-Math.pow((x + t.f.w / 2 - strikeSx) / 260, 2));
          r.fxDraw(t.lit, x, hy + t.y - vy * t.p, 1, 1, 0, col(0.7, 0.75, 1), L * (0.35 + fall * 1.1) * k, true);
        }
      }
      // rain curtains under the towers
      const ca = k * smoothstep(0.35, 0.9, s);
      if (ca > 0.01) {
        const cw = this.curtain.w;
        const ox = ((this.drift.curtain - vx * 0.03) % cw + cw) % cw;
        for (let x = -cw + ox; x < VW; x += cw) {
          r.drawSub(this.curtain, 0, 0, cw, this.curtain.h, x, hy - this.curtain.h + 6, 1, 1, col(0.55, 0.62, 0.66, ca * 0.55));
        }
      }
      // bolts behind the deck
      for (const st of this.strikes) {
        const v = this.envAt(st);
        if (v <= 0.01) continue;
        const bf = this.bolts[st.bolt];
        const bx = st.x <= 1.5 ? st.x * VW : st.x;
        const topY = 40 + (st.big ? 0 : 24);
        const scale = st.big ? (hy - topY + 6) / bf.h : (hy - topY - 10) / bf.h;
        r.emissive(1);
        r.draw(bf, bx, topY, 1, scale, 0, col(1, 1, 1, clamp(v * 1.4)));
        r.emissive();
        r.fxDraw(this.glow, bx, topY + bf.h * scale * 0.4, 1.5, 3.2, 0, col(0.62, 0.66, 1), v * 1.2, true);
      }
      // the deck: two churning layers sliding in from above as the storm builds
      const drop = lerp(-130, 0, smoothstep(0.2, 0.8, s));
      const kd = smoothstep(0.2, 0.65, s);
      const dB = this.decks[1], dA = this.decks[0];
      this.tile(r, dB.f, this.drift.deckB - vx * 0.035, drop + 16 - vy * 0.02, VW, col(1, 1, 1, kd));
      if (L > 0.02) this.tileFx(r, dB.lit, this.drift.deckB - vx * 0.035, drop + 16 - vy * 0.02, VW, strikeSx, L * k);
      this.tile(r, dA.f, this.drift.deckA - vx * 0.02, drop - 18 - vy * 0.015, VW, col(1, 1, 1, kd));
      if (L > 0.02) this.tileFx(r, dA.lit, this.drift.deckA - vx * 0.02, drop - 18 - vy * 0.015, VW, strikeSx, L * k * 0.8);
      if (drop - 18 > 0) r.rect(0, 0, VW, drop - 17, col(0.04, 0.055, 0.066, kd));
      // racing scud
      const sa = smoothstep(0.4, 0.85, s);
      if (sa > 0.01) {
        const lit = 1 + L * 1.8;
        for (const c of this.scud) this.drawWrapped(r, c.f, c.x - vx * c.p + this.drift.scud * c.v, hy + c.y - vy * c.p, VW, col(Math.min(1, 0.9 * lit), Math.min(1, 0.95 * lit), Math.min(1, lit), sa));
      }
    }
    // 5. seabirds
    if (this.birds && kc > 0.05) {
      for (const b of this.birdList) {
        const x = this.wrapX(b.x - vx * b.p + this.time * b.v * (w.wind < 0 ? 1 : -1) * 0.7, 8, VW);
        const y = hy + b.y + Math.sin(this.time * 0.4 + b.ph) * 6;
        const flap = Math.sin(this.time * 7 + b.ph * 3);
        const glide = Math.sin(this.time * 0.5 + b.ph) > 0.3;
        const fi = glide ? 1 : flap > 0.3 ? 0 : flap < -0.3 ? 2 : 1;
        r.draw(this.birdF[fi], x, y, w.wind < 0 ? -1 : 1, 1, 0, col(1, 1, 1, kc));
      }
    }
    // 6. flash: the whole sky lights up
    if (L > 0.01) {
      r.fxDraw(this.glow, this.lastStrikeX <= 1.5 ? this.lastStrikeX * VW : this.lastStrikeX, hy * 0.45, 9, 5, 0, col(0.72, 0.78, 1), L * 0.45, true);
      r.fxDraw(r.white, 0, 0, VW, hy + 4, 0, col(0.55, 0.6, 0.75), L * 0.12, true);
    }
  }

  private wrapX(x: number, fw: number, VW: number) {
    const span = VW + fw + 200;
    return ((((x + fw + 100) % span) + span) % span) - fw - 100;
  }
  private drawWrapped(r: Renderer, f: Frame, x: number, y: number, VW: number, c: number) {
    r.draw(f, this.wrapX(x, f.w, VW), y, 1, 1, 0, c);
  }
  /** Horizontally tiled strip across the view. */
  private tile(r: Renderer, f: Frame, off: number, y: number, VW: number, c: number) {
    const w = f.w;
    const o = ((off % w) + w) % w;
    for (let x = o - w; x < VW; x += w) r.draw(f, x, y, 1, 1, 0, c);
  }
  private tileFx(r: Renderer, f: Frame, off: number, y: number, VW: number, focusX: number, k: number) {
    const w = f.w;
    const o = ((off % w) + w) % w;
    for (let x = o - w; x < VW; x += w) {
      const fall = 0.35 + Math.exp(-Math.pow((x + w / 2 - focusX) / 300, 2)) * 0.9;
      r.fxDraw(f, x, y, 1, 1, 0, col(0.7, 0.76, 1), k * fall, true);
    }
  }
}

// ------------------------------------------------------------------ rain

export const RAIN_P = { far: 0.5, mid: 1, near: 1.35 };

interface RainDepth {
  n: number;
  len: number; // streak length index
  speed: number;
  bright: number;
  windK: number;
}
const DEPTHS: Record<'far' | 'mid' | 'near', RainDepth> = {
  far: { n: 260, len: 0, speed: 260, bright: 0.28, windK: 0.7 },
  mid: { n: 200, len: 1, speed: 420, bright: 0.34, windK: 1 },
  near: { n: 90, len: 3, speed: 620, bright: 0.42, windK: 1.25 },
};

let rainArt: ReturnType<typeof SA.paintRainStreaks> | null = null;

/** Angled rain streaks for one depth. Put it on a layer with parallax RAIN_P[depth]. */
export class Rain implements Drawable {
  z = 1000;
  density = 1;
  private sheet = new Sheet();
  private frames: Frame[][];
  private x: Float32Array;
  private y: Float32Array;
  private sp: Float32Array;
  private L: RainDepth;
  private t = 0;
  constructor(readonly weather: Weather, readonly depth: 'far' | 'mid' | 'near', seed = 5) {
    this.L = DEPTHS[depth];
    rainArt ??= SA.paintRainStreaks();
    this.frames = rainArt.bufs.map(row => row.map(b => this.sheet.add(b, b.w - 1, b.h - 1)));
    const n = this.L.n;
    const g = new Rng(seed * 17 + n);
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.sp = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.x[i] = g.range(0, 2000);
      this.y[i] = g.range(0, 600);
      this.sp[i] = g.range(0.8, 1.2);
    }
  }
  update(dt: number) {
    this.t += dt;
    const w = this.weather;
    const vx = w.windSpeed * 1.4 * this.L.windK;
    for (let i = 0; i < this.x.length; i++) {
      this.y[i] += this.L.speed * this.sp[i] * dt;
      this.x[i] += vx * this.sp[i] * dt;
    }
  }
  draw(r: Renderer) {
    const w = this.weather;
    const k = smoothstep(0.3, 0.95, w.storm) * this.density;
    if (k <= 0.01) return;
    this.sheet.upload(r);
    const n = Math.min(this.x.length, Math.round(this.x.length * k));
    const x0 = r.visibleX0(30), x1 = r.visibleX1(30);
    const y0 = r.wy(-30), y1 = r.wy(r.VH + 10);
    const W = x1 - x0, H = y1 - y0;
    const vx = w.windSpeed * 1.4 * this.L.windK;
    const ang = Math.atan2(Math.abs(vx), this.L.speed);
    const ai = clamp(Math.round(ang / 0.1), 0, this.frames.length - 1);
    const flip = vx < 0 ? 1 : -1;
    const fr = this.frames[ai][this.L.len];
    const fr2 = this.frames[ai][Math.max(0, this.L.len - 1)];
    const L = w.lightning;
    const b = this.L.bright * (1 + L * 2.5);
    const c = col(0.72, 0.8, 0.86, 1);
    for (let i = 0; i < n; i++) {
      const x = x0 + ((((this.x[i] - x0) % W) + W) % W);
      const y = y0 + ((((this.y[i] - y0) % H) + H) % H);
      r.fxDraw(i & 1 ? fr : fr2, x, y, flip, 1, 0, c, b * (0.7 + this.sp[i] * 0.3), true);
    }
  }
}

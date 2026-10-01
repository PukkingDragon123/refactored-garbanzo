// V9 running water on the island: everything that moves on the stream mouth and the forest creek.
// The painted ground (art/v9/eastground.ts) holds the bed, the banks and the water's base tones; these
// drawables sit just above it on the gameplay plane and animate the surface:
//   flow ripples: short crest highlights riding the current, stretched and sped up by the perspective
//     (so they race along near the camera and crawl as they recede toward the sea);
//   foam flecks and scum lines that gather behind the stones;
//   standing waves: a bright pillow on the upstream face of each stone and a flickering V wake;
//   caustic light cookies wobbling over the shallows near the camera;
//   sun / moon glitter on the far water and the delta;
//   the delta's threads pulsing into the surf, with a foam line where the fresh water meets the swash;
//   the creek's cascade: falling strands, the white churn at its foot, rings spreading over the pool.
// No allocation per frame: every moving thing is a fixed record advanced parametrically from time.

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Drawable, Stage } from '../../world/stage';
import { bigFrame } from '../../gfx/atlas';
import { game } from '../game';
import { A } from '../assets';
import { PixelBuffer } from '../../art/pixel';
import { rgba } from '../../art/color';
import { Rng, clamp, fbm2, hash2, smoothstep } from '../../core/math';
import {
  MOUTH, CREEK, MOUTH_STONES, CREEK_STONES, DELTA_THREADS, Stone, baseTop, persp, realZ, rowOf, mouthAt, creekAt,
  stoneAt, creekStoneAt, threadE,
} from '../../art/v9/eastgeo';
import type { DayClock } from '../v4/islefx';
import { sunAt } from '../v4/islefx';

interface Ripple { e: number; ph: number; sp: number; len: number; k: number; dark: boolean }
interface Fleck { e: number; ph: number; sp: number; wob: number; big: boolean }

/** caustic net cookie: bright wavy lines inside a soft ellipse (light pass, linear filtered) */
function causticCookie(seed: number, w = 96, h = 40): PixelBuffer {
  const b = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = (x + 0.5 - w / 2) / (w / 2), ny = (y + 0.5 - h / 2) / (h / 2);
    const m = clamp(1 - (nx * nx + ny * ny));
    if (m <= 0) continue;
    const n = fbm2(x / 9, y / 4.5, 3, seed);
    const v = clamp(1 - Math.abs(n - 0.5) * 9) * m * m;
    b.data[y * w + x] = rgba(255, 255, 255, v * 255);
  }
  return b;
}

/** how much daylight there is (1 day .. 0 night) and the sun's colour, for glitter */
function sunK(clock: DayClock): { k: number; r: number; g: number; b: number; moon: boolean } {
  const s = sunAt(clock.t);
  const k = s.moon ? 0.45 * clock.night : 1 - clock.night * 0.9;
  return { k, r: s.c[0], g: s.c[1], b: s.c[2], moon: s.moon };
}

/** which way a channel runs on screen: the stream mouth flows up toward the sea, the creek down */
interface Channel {
  at(dd: number): [number, number];
  stones: Stone[];
  stoneAt(s: Stone): [number, number, number];
  /** realZ range the current covers */
  z0: number;
  z1: number;
  flow: number;
  /** +1: toward the camera (the creek), -1: away (the stream mouth) */
  dir: number;
  x: number;
  /** half extent in x for culling */
  span: number;
}

const MOUTH_CH: Channel = { at: mouthAt, stones: MOUTH_STONES, stoneAt, z0: 0.02, z1: 0.7, flow: MOUTH.flow, dir: -1, x: MOUTH.x - 70, span: 200 };
const CREEK_CH: Channel = { at: creekAt, stones: CREEK_STONES, stoneAt: creekStoneAt, z0: 0.06, z1: 0.7, flow: CREEK.flow, dir: 1, x: CREEK.x + 40, span: 170 };

/** the animated surface of one channel (flow ripples, flecks, stones' standing waves, caustics, glitter) */
export class ChannelFx implements Drawable {
  z = -9.4;
  private rip: Ripple[] = [];
  private fleck: Fleck[] = [];
  private cook: Frame[] = [];
  constructor(readonly ch: Channel, readonly clock: DayClock, seed: number, readonly stoneFrames: Frame[]) {
    const rng = new Rng(seed);
    for (let i = 0; i < 150; i++) this.rip.push({ e: rng.range(-0.92, 0.92), ph: rng.next(), sp: rng.range(0.75, 1.3), len: rng.range(1.6, 3.8), k: rng.range(0.35, 1), dark: rng.chance(0.28) });
    for (let i = 0; i < 46; i++) this.fleck.push({ e: rng.range(-0.8, 0.8), ph: rng.next(), sp: rng.range(0.8, 1.15), wob: rng.range(0, 6.3), big: rng.chance(0.25) });
    for (let i = 0; i < 3; i++) this.cook.push(bigFrame(game.r, causticCookie(seed + i * 7), 48, 20));
  }

  /** position on the channel for a realZ and cross position; returns the row too */
  private put(z: number, e: number, out: number[]) {
    const dd = rowOf(z);
    const [cx, hw] = this.ch.at(dd);
    const x = cx + e * hw;
    out[0] = x; out[1] = baseTop(x) + dd; out[2] = dd; out[3] = hw;
  }
  private tmp = [0, 0, 0, 0];

  draw(r: Renderer, st: Stage) {
    const ch = this.ch;
    const vx0 = r.visibleX0(20), vx1 = r.visibleX1(20);
    if (ch.x + ch.span < vx0 || ch.x - ch.span > vx1) return;
    const t = st.time;
    const sun = sunK(this.clock);
    const day = 1 - this.clock.night * 0.75;
    const zr = ch.z1 - ch.z0;
    const P = this.tmp;
    // ---- caustics on the shallows near the camera (light cookies wobbling downstream)
    if (sun.k > 0.1 && !sun.moon) {
      for (let i = 0; i < 3; i++) {
        const z = 0.44 + i * 0.09;
        this.put(z, Math.sin(t * 0.3 + i * 2) * 0.12, P);
        const k = 0.5 + 0.5 * Math.sin(t * 1.3 + i * 2.1);
        const sx = (P[3] * 1.7) / 96, sy = persp(P[2]) * 0.5;
        for (let j = 0; j < 2; j++) {
          const f = this.cook[(i + j) % 3], a = j ? k : 1 - k;
          r.lightTex(f, P[0] + Math.sin(t * 0.7 + i) * 2, P[1], sx * (1 + j * 0.1), sy, Math.sin(t * 0.2 + i) * 0.05, packColor(sun.r, sun.g, sun.b * 0.95, 1), 0.55 * a * sun.k);
        }
      }
    }
    // ---- flow ripples: crest highlights (and a few dark troughs) riding the current
    const lit = packColor(0.82, 0.95, 0.96, 1);
    for (const q of this.rip) {
      const ph = (q.ph + t * ch.flow * q.sp / zr) % 1;
      const z = ch.dir < 0 ? ch.z1 - ph * zr : ch.z0 + ph * zr;
      const fade = Math.min(1, ph * 6, (1 - ph) * 6);
      this.put(z, q.e + Math.sin(t * 0.9 + q.ph * 20) * 0.03, P);
      if (P[0] < vx0 || P[0] > vx1) continue;
      const Pk = persp(P[2]);
      const w = Math.max(1, Math.round(q.len * Pk * (1 - Math.abs(q.e) * 0.4)));
      // shimmer: each crest flickers as it rolls
      const fl = 0.55 + 0.45 * Math.sin(t * (5 + q.sp * 3) + q.ph * 40);
      const a = fade * q.k * fl * (0.45 + day * 0.5);
      if (a < 0.05) continue;
      if (q.dark) r.rect(Math.round(P[0] - w / 2), Math.round(P[1]), w, 1, packColor(0.1, 0.24, 0.28, a * 0.55));
      else r.rect(Math.round(P[0] - w / 2), Math.round(P[1]), w, 1, lit & 0x00ffffff | (Math.round(a * 0.8 * 255) << 24) >>> 0);
    }
    // ---- stones: the V wake downstream and the pillow of white water on the upstream face
    const foam = packColor(0.94, 0.98, 1, 1);
    for (let i = 0; i < ch.stones.length; i++) {
      const s = ch.stones[i];
      const [sx, sd, rad] = ch.stoneAt(s);
      if (sx < vx0 || sx > vx1) continue;
      const sy = baseTop(sx) + sd;
      const Pk = persp(sd);
      const down = ch.dir; // +1: downstream is toward the camera (down the screen)
      // V wake: two arms trailing downstream, segments flickering along them
      for (let arm = -1; arm <= 1; arm += 2) for (let k = 0; k < 7; k++) {
        const f = k / 7;
        const flick = Math.sin(t * 7 + k * 1.9 + i * 3 + arm) > -0.2 ? 1 : 0;
        if (!flick) continue;
        const ax = sx + arm * (rad * 0.9 + f * rad * 1.6), ay = sy + down * (f * rad * 1.8 + 1) * 0.55;
        r.rect(Math.round(ax), Math.round(ay), Math.max(1, Math.round(Pk * 0.8)), 1, packColor(0.9, 0.97, 1, (0.75 - f * 0.6) * day + 0.1));
      }
      // the pillow: churning white against the stone's upstream side
      for (let k = 0; k < 5; k++) {
        const px = sx + (k - 2) * rad * 0.42 + Math.sin(t * 9 + k + i) * 0.6;
        const py = sy - down * (0.5 + (k % 2)) * 0.8 + (down < 0 ? 1 : -1);
        r.rect(Math.round(px), Math.round(py), Math.max(1, Math.round(Pk * 0.6)), 1, foam);
      }
      // the stone itself, over its own wake
      const f = this.stoneFrames[i % this.stoneFrames.length];
      const sc = (rad * 2.2) / f.w;
      r.draw(f, sx, sy + 1, sc, sc);
    }
    // ---- foam flecks: drift with the current, gathering along the eddy lines behind the stones
    for (const q of this.fleck) {
      const ph = (q.ph + t * ch.flow * q.sp * 0.85 / zr) % 1;
      const z = ch.dir < 0 ? ch.z1 - ph * zr : ch.z0 + ph * zr;
      const fade = Math.min(1, ph * 5, (1 - ph) * 5);
      this.put(z, q.e + Math.sin(t * 0.6 + q.wob) * 0.12, P);
      if (P[0] < vx0 || P[0] > vx1) continue;
      const Pk = persp(P[2]);
      const s = q.big && Pk > 1.6 ? 2 : 1;
      r.rect(Math.round(P[0]), Math.round(P[1]), s, 1, packColor(0.96, 1, 1, fade * (0.5 + day * 0.4)));
      if (q.big && Pk > 2) r.rect(Math.round(P[0] + 2), Math.round(P[1] + 1), 1, 1, packColor(0.9, 0.96, 0.96, fade * 0.6));
    }
    // ---- glitter: the sun (or moon) sparkling on the water
    if (sun.k > 0.05) {
      const col = packColor(sun.r, sun.g, sun.b, 1);
      for (let i = 0; i < 40; i++) {
        const z = ch.z0 + hash2(i, 3, 17) * zr * 0.75;
        const e = (hash2(i, 5, 17) - 0.5) * 1.7;
        const tw = Math.sin(t * (3 + hash2(i, 7, 17) * 4) + i * 2.3);
        if (tw < 0.55) continue;
        this.put(z, e, P);
        if (P[0] < vx0 || P[0] > vx1) continue;
        r.fxDraw(tw > 0.93 ? A.spark : A.dot, P[0], P[1], tw > 0.93 ? 0.45 : 1, tw > 0.93 ? 0.45 : 1, 0, col, (tw - 0.55) * 3.2 * sun.k * (1 - realZ(P[2]) * 0.6), true);
      }
    }
  }
}

/** the stream mouth's delta: current pulsing down the threads into the surf, the foam line at the sea */
export class DeltaFx implements Drawable {
  z = -9.35;
  constructor(readonly clock: DayClock) {}
  draw(r: Renderer, st: Stage) {
    const x0 = MOUTH.x - 90, x1 = MOUTH.x + 90;
    if (x1 < r.visibleX0(10) || x0 > r.visibleX1(10)) return;
    const t = st.time;
    const day = 1 - this.clock.night * 0.75;
    // pulses of current running out along each thread toward the walk line
    for (let k = 0; k < DELTA_THREADS.length; k++) {
      const th = DELTA_THREADS[k];
      for (let j = 0; j < 5; j++) {
        const ph = (t * 0.35 + j / 5 + k * 0.13) % 1;
        const dd = MOUTH.delta * (1 - ph);
        const [cx, hw] = mouthAt(dd);
        const x = cx + threadE(th, dd) * hw;
        const y = baseTop(x) + dd;
        const a = Math.min(1, ph * 4, (1 - ph) * 3) * (0.35 + day * 0.4);
        r.rect(Math.round(x - 1), Math.round(y), 3, 1, packColor(0.82, 0.95, 0.94, a));
      }
    }
    // the foam line where the stream meets the sea: bubbles winking along the walk line
    for (let i = 0; i < 44; i++) {
      const x = MOUTH.x - 62 + i * 2.9 + Math.sin(t * 0.8 + i) * 1.2;
      const k = Math.sin(t * 4 + i * 1.7) * 0.5 + 0.5;
      if (k < 0.3) continue;
      const y = baseTop(x) + ((i * 7) % 3) - 1;
      r.rect(Math.round(x), Math.round(y), hash2(i, 1, 3) < 0.4 ? 2 : 1, 1, packColor(0.96, 1, 1, k * 0.9));
    }
  }
}

/** the creek's little cascade behind the walk line: falling strands, churn, mist and pool rings */
export class CascadeFx implements Drawable {
  z = -3.9;
  mistT = 0;
  constructor(readonly clock: DayClock, readonly layer: { particles: { spawn(o: object): void } }) {}
  update(dt: number) {
    this.mistT -= dt;
  }
  draw(r: Renderer, st: Stage) {
    const x = CREEK.x;
    if (x + 60 < r.visibleX0(10) || x - 60 > r.visibleX1(10)) return;
    const t = st.time;
    const top = baseTop(x) - CREEK.fall, bot = baseTop(x) - 1;
    const day = 1 - this.clock.night * 0.7;
    const W = CREEK.fallW;
    // the sheet: vertical strands in three tones, each with bright blobs racing down
    for (let i = -W; i <= W; i++) {
      const edge = Math.abs(i) / W;
      const bow = (1 - edge * edge) * 1.5; // the water bulges out over the lip
      const base = hash2(i, 1, 9);
      const tone = base < 0.3 ? packColor(0.5, 0.7, 0.72, 0.85) : base < 0.7 ? packColor(0.66, 0.84, 0.86, 0.8) : packColor(0.84, 0.94, 0.95, 0.8);
      const y0 = top + edge * 2 - bow;
      r.rect(x + i, y0, 1, bot - y0, tone);
      for (let k = 0; k < 3; k++) {
        const ph = (t * (1.6 + base * 0.8) + k / 3 + base) % 1;
        const yy = y0 + ph * ph * (bot - y0);
        r.rect(x + i, Math.round(yy), 1, 2 + Math.round(ph * 3), packColor(0.95, 1, 1, (0.5 + base * 0.4) * day + 0.2));
      }
    }
    // the lip: a bright rolling edge
    for (let i = -W; i <= W; i++) if (Math.sin(t * 6 + i * 1.3) > -0.3) r.rect(x + i, top - 1 + Math.abs(i) / W * 2, 1, 1, packColor(0.95, 1, 1, 0.9));
    // churn at the foot: white water boiling up
    for (let i = 0; i < 26; i++) {
      const a = hash2(i, 2, 9) * 6.28;
      const rr = W * (0.6 + hash2(i, 3, 9) * 0.9);
      const k = Math.sin(t * (5 + hash2(i, 4, 9) * 4) + i) * 0.5 + 0.5;
      const px = x + Math.cos(a + t * 0.8) * rr, py = bot + Math.abs(Math.sin(a)) * 3 - k * 2;
      r.rect(Math.round(px), Math.round(py), 1 + (i % 3 === 0 ? 1 : 0), 1, packColor(0.97, 1, 1, 0.5 + k * 0.5));
    }
    // mist drifting off the fall
    if (this.mistT <= 0) {
      this.mistT = 0.18;
      this.layer.particles.spawn({ frame: A.soft, x: x + (Math.random() - 0.5) * W * 2, y: bot - 2, vx: (Math.random() - 0.5) * 6, vy: -5 - Math.random() * 5, life: 2.4, size: 0.45, size1: 1.1, color: [0.9, 0.96, 1], alpha: 0.18 * day + 0.05, alpha1: 0, fadeIn: 0.25 });
    }
  }
}

/** rings spreading over a pool from a point source (the cascade's foot, drips in the cave) */
export class PoolRings implements Drawable {
  z = -9.3;
  private rings: { x: number; y: number; t: number; life: number; r: number }[] = [];
  constructor(readonly rate: number, readonly src: () => [number, number] | null, readonly maxR = 16) {}
  private acc = 0;
  update(dt: number) {
    for (const g of this.rings) g.t += dt;
    for (let i = this.rings.length - 1; i >= 0; i--) if (this.rings[i].t > this.rings[i].life) this.rings.splice(i, 1);
    if (this.rate <= 0) return;
    this.acc += dt * this.rate;
    while (this.acc >= 1) {
      this.acc -= 1;
      const p = this.src();
      if (p && this.rings.length < 24) this.rings.push({ x: p[0], y: p[1], t: 0, life: 1.6 + Math.random() * 0.8, r: this.maxR * (0.7 + Math.random() * 0.5) });
    }
  }
  /** add one ring now (a drip landing, a stone plopping in) */
  add(x: number, y: number, r = this.maxR, life = 1.8) {
    if (this.rings.length < 32) this.rings.push({ x, y, t: 0, life, r });
  }
  draw(r: Renderer) {
    const vx0 = r.visibleX0(20), vx1 = r.visibleX1(20);
    for (const g of this.rings) {
      if (g.x < vx0 || g.x > vx1) continue;
      drawRing(r, g.x, g.y, g.r * smoothstep(0, 1, g.t / g.life + 0.08), (1 - g.t / g.life) * 0.7);
    }
  }
}

/** a flat ellipse of pale pixels on a water surface (rx wide, rx * 0.28 deep in perspective) */
export function drawRing(r: Renderer, x: number, y: number, rx: number, a: number) {
  if (a < 0.03 || rx < 0.5) return;
  const ry = Math.max(0.6, rx * 0.28);
  const n = Math.max(8, Math.round(rx * 2.4));
  const c = packColor(0.9, 0.98, 1, a);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    // the near half of the ring catches more light than the far half
    const near = Math.sin(ang) > 0;
    if (!near && i % 2) continue;
    r.rect(Math.round(x + Math.cos(ang) * rx), Math.round(y + Math.sin(ang) * ry), 1, 1, near ? c : packColor(0.9, 0.98, 1, a * 0.6));
  }
}

export { MOUTH_CH, CREEK_CH };

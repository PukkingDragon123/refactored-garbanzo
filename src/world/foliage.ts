// Shared plant physics and wind for every scene built on a Stage.
//
// Wind (st.windField): the scene's base strength is st.wind (each scene sets it; 0.6 is a breeze),
// and on top of it gust fronts roll across the scene in world x, downwind, at `speed` px/s, with a
// ripple running through the grass between them. Every swaying Prop reads it at its own x, so a stand
// of grass leans in sequence as each gust goes through. Other systems read st.windField.at(x),
// .gustAt(x) or .gust (the gust at the camera) for blown seeds, streaks and sounds.
//
// Plants (Plant): a Prop with `sway` bends from its base, the top rows more than the bottom ones, in
// whole art pixels (Renderer.drawBend). A Prop with `foliage: kind` (or a small swaying prop on the
// gameplay plane, picked up automatically) is also pushed by movers: when Mori or an animal walks
// through, the plant bends away along their direction of travel and springs back with a damped
// overshoot; landing in it shakes it and throws leaves or petals; brushing through rustles.
// Only plants on screen are drawn, and a plant at rest with nobody near it costs one bounds check.
//
// Opting in: new Prop(frame, x, y, z, { sway: 0.8, foliage: 'grass' }) (kinds below; `bits` for the
// colours of what flies off; `hang` for vines and moss hanging from their anchor). A custom drawable
// can own a Plant and call plant.push(r, st, x, y) + windBend(...) itself. Each frame the scene lists
// its movers with st.foliage.begin() / .add(...) (FieldScene does this for Mori, animals and actors).

import type { Frame, Renderer } from '../gfx/renderer';
import type { Stage, Layer } from './stage';
import { clamp, noise1, rand } from '../core/math';
import { audio } from '../core/audio';

export type FoliageKind = 'grass' | 'fern' | 'bush' | 'reed' | 'flower' | 'vine' | 'plant' | 'tree';
type RGB = [number, number, number];

/** the scene's wind: base strength plus gust fronts rolling across in world x */
export class Wind {
  /** +1 blows toward +x */
  dir = 1;
  /** strength of the gust fronts on top of the base (0 = a steady breeze) */
  gustiness = 1;
  /** world px per second the gust fronts travel downwind */
  speed = 85;
  /** this frame's base strength (the stage's st.wind) */
  base = 0.6;
  /** gust 0..1 at the camera this frame */
  gust = 0;
  private t = 0;
  update(st: Stage) {
    this.t = st.time;
    this.base = st.wind;
    this.gust = this.gustAt(st.cam.x);
  }
  /** gust 0..1 at world x on the gameplay plane */
  gustAt(x: number): number {
    const u = x * this.dir - this.speed * this.t;
    const front = clamp((noise1(u / 320, 71) - 0.45) * 2.2 + (noise1(u / 95, 72) - 0.5) * 0.45);
    const ripple = Math.max(0, Math.sin(u * 0.021)) ** 4 * 0.3;
    return clamp(front * this.gustiness + ripple);
  }
  /** signed lean at world x: the base plus the gust passing there */
  at(x: number): number {
    return this.dir * this.base * (0.4 + 1.1 * this.gustAt(x));
  }
}

/**
 * The wind bend (world px at the free end) of a plant at layer x: a lean downwind that follows the
 * gust waves, and a flutter that quickens in the gusts. amp: the plant's sway times its size factor.
 */
export function windBend(r: Renderer, st: Stage, x: number, amp: number, speed: number, phase: number): number {
  if (!amp) return 0;
  const W = st.windField, lp = r.layerP, t = st.time;
  const g = W.gustAt(lp > 0.05 ? x / lp : st.cam.x);
  const lean = W.dir * W.base * (0.4 + 1.1 * g);
  const fl = (Math.sin(t * speed + phase) * 0.6 + Math.sin(t * speed * 2.7 + phase * 1.7) * 0.4) * (0.3 + 0.35 * W.base + 0.8 * g);
  return amp * (lean * 1.5 + fl * 0.75);
}

/** a size factor for the sway: tall plants swing further at the tip (capped) */
export function swayAmp(sway: number, frame: Frame, sy: number, hang: boolean): number {
  const h = (hang ? frame.h - frame.ay : frame.ay) * Math.abs(sy);
  return Math.min(sway * (1 + h / 40), 6);
}

interface KindSpec { k: number; c: number; push: number; curve: number; snd: number; bits: RGB[] }
const GREEN: RGB[] = [[0.42, 0.62, 0.28], [0.3, 0.5, 0.22], [0.55, 0.7, 0.32]];
const KIND: Record<FoliageKind, KindSpec> = {
  grass: { k: 70, c: 4.2, push: 0.55, curve: 1.4, snd: 0.7, bits: [[0.78, 0.74, 0.42], [0.55, 0.68, 0.3], [0.9, 0.86, 0.6]] },
  fern: { k: 80, c: 4.4, push: 0.42, curve: 1.5, snd: 0.8, bits: GREEN },
  bush: { k: 125, c: 5.6, push: 0.2, curve: 1.3, snd: 1, bits: [[0.36, 0.56, 0.24], [0.26, 0.44, 0.2], [0.5, 0.66, 0.3]] },
  reed: { k: 60, c: 3.6, push: 0.5, curve: 1.5, snd: 0.8, bits: [[0.82, 0.74, 0.52], [0.66, 0.6, 0.4]] },
  flower: { k: 85, c: 4.4, push: 0.42, curve: 1.4, snd: 0.6, bits: [[0.96, 0.82, 0.9], [1, 0.95, 0.7], [0.98, 0.98, 0.92], [0.5, 0.68, 0.3]] },
  vine: { k: 42, c: 2.3, push: 0.45, curve: 1.2, snd: 0.6, bits: GREEN },
  plant: { k: 90, c: 4.8, push: 0.35, curve: 1.5, snd: 0.7, bits: GREEN },
  tree: { k: 200, c: 9, push: 0.03, curve: 1.8, snd: 0, bits: GREEN },
};

/** one plant's spring: the push from movers, the shake, and its contact state */
export class Plant {
  readonly k: number;
  readonly c: number;
  readonly curve: number;
  /** half width and how far it reaches above / below its anchor (world px) */
  readonly hw: number;
  readonly up: number;
  readonly down: number;
  /** tip travel when fully pushed (world px) */
  readonly max: number;
  readonly bits: RGB[];
  pb = 0;
  pv = 0;
  shk = 0;
  touch = false;
  rest = true;
  private t = -1;
  constructor(readonly kind: FoliageKind, frame: Frame, sx: number, sy: number, readonly hang: boolean, readonly phase: number, bits?: RGB[]) {
    const S = KIND[kind];
    this.k = S.k;
    this.c = S.c;
    this.curve = S.curve;
    const ax = Math.abs(sx), ay = Math.abs(sy);
    this.hw = Math.max(3, frame.w * ax * 0.42);
    this.up = frame.ay * ay;
    this.down = (frame.h - frame.ay) * ay;
    // (tall reeds part, they don't lie flat: the travel is capped for big plants)
    const h = hang ? this.down : this.up;
    this.max = Math.min(S.push * h, 6 + h * 0.22);
    this.bits = bits ?? S.bits;
  }
  /** the push bend (world px at the free end) for a plant anchored at x, y this frame */
  push(r: Renderer, st: Stage, x: number, y: number): number {
    const now = st.time;
    let dt = now - this.t;
    this.t = now;
    const F = st.foliage;
    // far from the camera and at rest: nothing to simulate
    if (this.rest && Math.abs(x - st.cam.x) > 640) return 0;
    if (!(dt > 0) || !F) return this.rest ? 0 : this.pb + this.shk * Math.sin(now * 43 + this.phase);
    if (dt > 0.05) dt = 0.05;
    let push = 0, hit: Mover | null = null;
    if (F.movers.length && Math.abs(r.layerP - 1) < 0.01) {
      const top = y - this.up, bot = y + this.down;
      for (const m of F.movers) {
        const dx = x - m.x, reach = this.hw + m.r;
        if (dx > reach || dx < -reach || top > m.y + 18 || bot < m.y - m.h) continue;
        const sp = Math.abs(m.vx);
        const dir = sp > 6 ? (m.vx > 0 ? 1 : -1) : dx >= 0 ? 1 : -1;
        const q = dir * this.max * Math.min(1, (1 - Math.abs(dx) / reach) * 1.8) * (0.5 + 0.5 * Math.min(1, sp / 110));
        if (Math.abs(q) >= Math.abs(push)) { push = q; hit = m; }
      }
    }
    if (!hit && this.rest) return 0;
    if (hit && (!this.touch || hit.landed)) F.enter(this, x, y, hit, st);
    this.touch = !!hit;
    // a damped spring toward the push: it gives way, then springs back past upright and settles
    const n = dt > 1 / 50 ? 2 : 1, h = dt / n;
    for (let i = 0; i < n; i++) {
      this.pv += (this.k * (push - this.pb) - this.c * this.pv) * h;
      this.pb += this.pv * h;
    }
    this.shk *= Math.exp(-5.5 * dt);
    if (!hit && Math.abs(this.pb) < 0.1 && Math.abs(this.pv) < 0.4 && this.shk < 0.15) {
      this.rest = true;
      this.pb = this.pv = this.shk = 0;
      return 0;
    }
    this.rest = false;
    return this.pb + this.shk * Math.sin(now * 43 + this.phase);
  }
}

/** something that pushes plants this frame (feet at x, y) */
export interface Mover {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** half width and height (world px) */
  r: number;
  h: number;
  air: boolean;
  /** touched down this frame */
  landed: boolean;
}
export interface MoverSrc { x: number; y: number; vx?: number; vy?: number; onGround?: boolean }

/** the stage's plant-physics state: this frame's movers, where leaves fly, the rustle sounds */
export class Foliage {
  movers: Mover[] = [];
  /** the layer thrown leaves and petals fly on (the gameplay plane) */
  fx: Layer | null = null;
  /** leaf particle frames, and plain specks for petals and seed */
  bits: Frame[] = [];
  dots: Frame[] = [];
  private track = new WeakMap<object, { x: number; y: number; air: boolean }>();
  private sndT = 0;
  private n = 0;
  begin() {
    this.n = 0;
  }
  /** list a mover for this frame (velocity from its motion when it carries none, or `derive`) */
  add(o: MoverSrc, r: number, h: number, dt: number, derive = false) {
    const tr = this.track.get(o);
    const air = o.onGround === undefined ? false : !o.onGround;
    let vx = o.vx, vy = o.vy;
    if (derive || vx === undefined || vy === undefined) {
      vx = tr && dt > 0 ? (o.x - tr.x) / dt : 0;
      vy = tr && dt > 0 ? (o.y - tr.y) / dt : 0;
    }
    const landed = !!tr && tr.air && !air;
    if (tr) { tr.x = o.x; tr.y = o.y; tr.air = air; } else this.track.set(o, { x: o.x, y: o.y, air });
    let m = this.movers[this.n];
    if (!m) this.movers.push(m = { x: 0, y: 0, vx: 0, vy: 0, r: 0, h: 0, air: false, landed: false });
    m.x = o.x; m.y = o.y; m.vx = vx; m.vy = vy; m.r = r; m.h = h; m.air = air; m.landed = landed;
    this.n++;
  }
  /** close this frame's list */
  end() {
    this.movers.length = this.n;
  }
  /** a mover came into a plant: a rustle, a nudge, and leaves flying if it jumped or ran in */
  enter(p: Plant, x: number, y: number, m: Mover, st: Stage) {
    const sp = Math.abs(m.vx), S = KIND[p.kind];
    const dir = m.vx > 0 ? 1 : m.vx < 0 ? -1 : x >= m.x ? 1 : -1;
    if ((m.air && m.vy > 40) || m.landed) {
      p.shk = Math.min(6, p.max * 0.5 + 1.5);
      p.pv += dir * 30;
      this.burst(p, x, y, m, 5 + rand.int(0, 5));
      this.sound(st, x, p.kind === 'grass' || p.kind === 'reed' ? 'rustle' : 'rustleBush', 0.4 * (S.snd || 0.5));
      return;
    }
    if (sp < 18) return;
    p.pv += dir * Math.min(sp, 160) * 0.12;
    if (sp > 95) {
      p.shk = Math.max(p.shk, 0.8);
      if (p.kind !== 'grass' && rand.chance(0.5)) this.burst(p, x, y, m, rand.int(1, 2));
    }
    if (S.snd) this.sound(st, x, p.kind === 'bush' ? 'rustleBush' : 'rustle', S.snd * clamp(sp / 150, 0.25, 1) * 0.22);
  }
  private sound(st: Stage, x: number, s: 'rustle' | 'rustleBush', vol: number) {
    if (st.time - this.sndT < 0.11) return;
    this.sndT = st.time;
    audio.play(s, { vol, pitch: rand.range(0.85, 1.2), pan: clamp((x - st.cam.x) / 320, -1, 1) });
  }
  private burst(p: Plant, x: number, y: number, m: Mover, n: number) {
    const L = this.fx;
    if (!L || !this.bits.length) return;
    const specks = (p.kind === 'flower' || p.kind === 'grass' || p.kind === 'reed') && this.dots.length > 0;
    for (let i = 0; i < n; i++) {
      const c = p.bits[rand.int(0, p.bits.length - 1)];
      const fr = specks && (p.kind !== 'flower' || c[1] < 0.9 || rand.chance(0.7)) ? this.dots[rand.int(0, this.dots.length - 1)] : this.bits[rand.int(0, this.bits.length - 1)];
      const by = p.hang ? y + p.down * rand.range(0.3, 1) : y - p.up * rand.range(0.45, 1);
      L.particles.spawn({
        frame: fr, x: x + rand.range(-p.hw, p.hw), y: by,
        vx: m.vx * 0.35 + rand.range(-28, 28), vy: rand.range(-75, -25), ay: 95, life: rand.range(1.8, 3.2),
        color: c, alpha: 1, alpha1: 0.5, rot: rand.range(0, 6.28), vrot: rand.range(-5, 5), flutter: 1,
        size: rand.range(0.55, 0.9), floorY: y + rand.range(0, 5), onFloor: 'stop',
      });
    }
  }
}

/** opts a prop into the plant physics: an explicit kind, or (auto) a small swaying prop on the gameplay plane */
export function plantFor(
  kind: FoliageKind | false | undefined, frame: Frame, sx: number, sy: number, sway: number, hang: boolean, phase: number, r: Renderer, bits?: RGB[],
): Plant | null {
  if (kind === false) return null;
  if (!kind) {
    if (sway < 0.4 || hang || Math.abs(r.layerP - 1) > 0.01 || frame.ay * Math.abs(sy) > 110 || frame.w * Math.abs(sx) > 160) return null;
    kind = 'plant';
  }
  return new Plant(kind, frame, sx, sy, hang, phase, bits);
}

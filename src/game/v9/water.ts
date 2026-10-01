// V9 water physics on the island: anyone wading (Mori, Chunk, Jenna, Joshu, Aroha) through the stream
// ford, the creek pool, the cave pool or the swash kicks up splashes on every step, trails a wake and
// rings, sinks to the ankles under a moving water line, slows down (the player) and squelches; out of
// the water they leave dark wet footprints that dry off. Leaves, twigs and pōhutukawa stamens float
// down the stream mouth to the surf and down the creek toward the camera.
//
// API (for creatures, the story, anything that needs to know about the water):
//   waterAt(x)          static depth (px) at the walk line, 0 when dry (art/v9/eastgeo walkWater)
//   isleWater?.depthAt(x)  live depth including the swash sheets
//   isleWater?.kindAt(x)   'stream' | 'creek' | 'pool' | 'swash' | null
//   isleWater?.surfaceAt(x)  world y of the water surface at the walk line
//   isleWater?.splash(x, y, k)  a splash with droplets, a ring and a sound (k ~ 0.5 .. 2)

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Drawable, Stage } from '../../world/stage';
import type { Actor } from '../../world/actor';
import { Custom } from '../../world/props';
import { local, A } from '../assets';
import { PixelBuffer } from '../../art/pixel';
import { hex } from '../../art/color';
import { clamp, damp, rand, smoothstep } from '../../core/math';
import { groundY } from '../../art/island4/layout';
import {
  WaterKind, MOUTH, CREEK, baseTop, walkWater, walkWaterKind, persp, rowOf, mouthAt, creekAt,
} from '../../art/v9/eastgeo';
import { drawRing } from './streamfx';
import type { IslandScene4 } from '../v4/island';

/** static water depth (px) at the walk line (no swash) */
export const waterAt = walkWater;

/** the live water system of the current island scene (null outside the island) */
export let isleWater: IsleWater | null = null;

interface Wader {
  who: Actor | null;
  /** player when who is null */
  dog: boolean;
  lastX: number;
  dist: number;
  depth: number;
  /** 0..1 how wet their feet still are after leaving the water */
  wet: number;
  ringT: number;
  side: number;
  inWater: boolean;
}

interface Floater { z: number; e: number; sp: number; rot: number; vr: number; f: number; stream: boolean; alive: boolean; wait: number }

const PRINTS = 90;

/** water tints for the band over wading feet, by kind (lit by the scene like everything else) */
const TINT: Record<WaterKind, [number, number, number]> = {
  stream: [0.5, 0.76, 0.78], creek: [0.34, 0.52, 0.5], pool: [0.12, 0.2, 0.24], swash: [0.66, 0.88, 0.9],
};

function twig(): PixelBuffer {
  const b = new PixelBuffer(9, 4);
  const c = [hex('#4a3422'), hex('#6e5034'), hex('#8a6a46')];
  for (let x = 0; x < 9; x++) b.set(x, 1 + (x > 5 ? 1 : 0), c[x % 3 === 0 ? 2 : 1]);
  b.set(3, 0, c[0]); b.set(7, 3, c[0]);
  return b;
}

export class IsleWater implements Drawable {
  z = 56;
  private waders: Wader[] = [];
  private px = new Float32Array(PRINTS);
  private py = new Float32Array(PRINTS);
  private pt = new Float32Array(PRINTS).fill(-999);
  private pa = new Float32Array(PRINTS);
  private pn = 0;
  private float: Floater[] = [];
  private twigF: Frame;
  private rings: { x: number; y: number; t: number; life: number; r: number }[] = [];
  private prevGround: 'sand' | 'wood' | 'leaves' | 'grass' | 'water' = 'sand';
  private trickleT = 0;

  constructor(readonly s: IslandScene4) {
    isleWater = this;
    this.twigF = local.add('v9:twig', twig(), 4.5, 2);
    // wet footprints (under everything on the walk line) and floating debris (on the water)
    s.main.add(new Custom(-9.45, rr => this.drawPrints(rr)));
    s.main.add(new Custom(-9.32, (rr, st) => this.drawFloaters(rr, st)));
    for (let i = 0; i < 8; i++) this.float.push({ z: 0, e: 0, sp: 1, rot: 0, vr: 0, f: 0, stream: true, alive: false, wait: i * 2.2 });
    for (let i = 0; i < 5; i++) this.float.push({ z: 0, e: 0, sp: 1, rot: 0, vr: 0, f: 0, stream: false, alive: false, wait: i * 2.8 });
  }

  /** the player and the cast join once the scene has made them (after the island is built) */
  private hookWaders() {
    const s = this.s, p = s.player;
    if (!this.waders.length) {
      this.waders.push({ who: null, dog: false, lastX: p.x, dist: 0, depth: 0, wet: 0, ringT: 0, side: 1, inWater: false });
      p.onStep = () => this.step(this.waders[0], p.x, p.running ? 1.4 : 1);
    }
    for (const a of s.actors.values()) {
      if (this.waders.some(w => w.who === a)) continue;
      this.waders.push({ who: a, dog: a.id === 'chunk', lastX: a.x, dist: 0, depth: 0, wet: 0, ringT: 0, side: 1, inWater: false });
    }
    this.nActors = s.actors.size;
  }
  private nActors = -1;

  /** live depth (px) at the walk line at x, the swash included */
  depthAt(x: number): number {
    const d = walkWater(x);
    const sw = this.s.swash?.coverAt(x) ?? 0;
    return Math.max(d, sw * 1.2);
  }
  kindAt(x: number): WaterKind | null {
    const k = walkWaterKind(x);
    if (k) return k;
    return (this.s.swash?.coverAt(x) ?? 0) > 0.2 ? 'swash' : null;
  }
  surfaceAt(x: number): number { return baseTop(x); }

  /** droplets flying up, a ring spreading and a slosh */
  splash(x: number, y: number, k = 1, sound = true) {
    const P = this.s.main.particles;
    const kind = this.kindAt(x) ?? 'swash';
    const [tr, tg, tb] = TINT[kind];
    const n = Math.round(7 + 9 * k);
    for (let i = 0; i < n; i++) {
      const up = rand.range(35, 90) * (0.7 + k * 0.35);
      P.spawn({ frame: rand.chance(0.3) ? A.dot2 : A.dot, x: x + rand.range(-4, 4), y: y - 1, vx: rand.range(-42, 42) * (0.6 + k * 0.4), vy: -up, ay: 330, life: rand.range(0.35, 0.65), color: rand.chance(0.6) ? [0.92, 0.98, 1] : [tr + 0.3, tg + 0.22, tb + 0.18], alpha: 1, alpha1: 0.4, floorY: y + 1 });
    }
    // a little crown of spray right at the foot
    for (let i = 0; i < 4; i++) P.spawn({ frame: A.dot, x: x + (i - 1.5) * 2, y: y - 1, vx: (i - 1.5) * 6, vy: -rand.range(20, 34), ay: 200, life: 0.25, color: [1, 1, 1], alpha: 1, alpha1: 0.5, floorY: y });
    if (k > 1.2) for (let i = 0; i < 3; i++) P.spawn({ frame: A.soft, x: x + rand.range(-4, 4), y: y - 2, vx: rand.range(-10, 10), vy: -rand.range(4, 12), life: 0.6, size: 0.25, size1: 0.6, color: [0.95, 1, 1], alpha: 0.35, alpha1: 0 });
    this.ring(x, y, 7 + k * 5, 1 + k * 0.4);
    if (sound) this.s.sfx('stepWater', x, 0.22 + k * 0.15, 0.9 + rand.next() * 0.25);
  }
  ring(x: number, y: number, r: number, life = 1.4) {
    if (this.rings.length < 40) this.rings.push({ x, y, t: 0, life, r });
  }

  private step(w: Wader, x: number, k: number) {
    if (w.inWater) {
      this.splash(x, this.surfaceAt(x), k * (0.55 + Math.min(1, w.depth / 5) * 0.6), w.who !== null);
    } else if (w.wet > 0.05) {
      // a wet print on the sand, alternate feet
      w.side = -w.side;
      const i = this.pn++ % PRINTS;
      this.px[i] = x + w.side * 1.5;
      this.py[i] = groundY(x) + 1 + (w.side > 0 ? 1 : 0);
      this.pt[i] = this.s.st.time;
      this.pa[i] = w.wet * (w.dog ? 0.7 : 1);
      w.wet = Math.max(0, w.wet - 0.07);
    }
  }

  update(dt: number, st: Stage) {
    const s = this.s, p = s.player;
    if (!p) return;
    if (s.actors.size !== this.nActors) this.hookWaders();
    for (const w of this.waders) {
      const a = w.who;
      const x = a ? a.x : p.x, y = a ? a.y : p.y;
      const visible = a ? a.visible && a.alpha > 0.1 : true;
      const onFloor = Math.abs(y - groundY(x)) < 3;
      const d = visible && onFloor ? this.depthAt(x) : 0;
      w.depth = damp(w.depth, d, 10, dt);
      const was = w.inWater;
      w.inWater = d > 0.6;
      if (w.inWater) w.wet = 1;
      else if (was) w.wet = 1;
      w.wet = Math.max(0, w.wet - dt * 0.03);
      const moved = Math.abs(x - w.lastX);
      w.lastX = x;
      // companions: steps by distance (the player's come from the controller's own footsteps)
      if (a && visible && moved < 20) {
        w.dist += moved;
        const stepLen = w.dog ? 7 : 12;
        if (w.dist > stepLen) { w.dist = 0; this.step(w, x, moved / dt > 90 ? 1.3 : 0.8); }
      }
      // rings around the legs: frequent while moving, a lazy one standing still
      w.ringT -= dt;
      if (w.inWater && w.ringT <= 0) {
        const mv = moved / Math.max(1e-3, dt);
        w.ringT = mv > 8 ? 0.28 : 1.3;
        this.ring(x, this.surfaceAt(x), (w.dog ? 7 : 8) + Math.min(6, mv * 0.05), mv > 8 ? 1 : 1.6);
      }
    }
    // the player wades slower through deep water, and splashes instead of crunching sand
    const pw = this.waders[0];
    p.wadeK = damp(p.wadeK, 1 - clamp(pw.depth / 8) * 0.48, 8, dt);
    if (pw.inWater && p.ground !== 'water') { this.prevGround = p.ground; p.ground = 'water'; }
    else if (!pw.inWater && p.ground === 'water') p.ground = this.prevGround;
    // rings age
    for (const g of this.rings) g.t += dt;
    for (let i = this.rings.length - 1; i >= 0; i--) if (this.rings[i].t > this.rings[i].life) { this.rings[i] = this.rings[this.rings.length - 1]; this.rings.pop(); }
    // floating debris
    for (const f of this.float) {
      if (!f.alive) {
        f.wait -= dt;
        if (f.wait > 0) continue;
        f.alive = true;
        f.z = f.stream ? 0.72 : 0.04;
        f.e = rand.range(-0.6, 0.6);
        f.sp = rand.range(0.8, 1.25);
        f.rot = rand.range(0, 6.28);
        f.vr = rand.range(-0.8, 0.8);
        f.f = rand.int(0, A.leaves.length + 2);
      }
      const flow = (f.stream ? MOUTH.flow : CREEK.flow) * f.sp;
      f.z += (f.stream ? -1 : 1) * flow * dt;
      f.rot += f.vr * dt;
      f.e = clamp(f.e + Math.sin(st.time * 0.4 + f.sp * 10) * dt * 0.05, -0.85, 0.85);
      if ((f.stream && f.z < 0.015) || (!f.stream && f.z > 0.72)) { f.alive = false; f.wait = rand.range(1.5, 6); }
    }
    // the babble of running water near the stream and the creek (and the cascade)
    this.trickleT -= dt;
    if (this.trickleT <= 0) {
      this.trickleT = rand.range(0.35, 0.8);
      const cx = s.st.cam.x;
      if (Math.abs(cx - MOUTH.x) < 420) s.sfx('trickle', MOUTH.x - 20, 0.22, rand.range(0.9, 1.2));
      if (Math.abs(cx - CREEK.x) < 380) s.sfx('trickle', CREEK.x, 0.3, rand.range(1.1, 1.4));
    }
  }

  // ---------------------------------------------------------------- drawing

  private drawPrints(r: Renderer) {
    const x0 = r.visibleX0(8), x1 = r.visibleX1(8), now = this.s.st.time;
    r.beginShadows();
    for (let i = 0; i < PRINTS; i++) {
      const age = now - this.pt[i];
      if (age > 40 || this.px[i] < x0 || this.px[i] > x1) continue;
      const a = this.pa[i] * (1 - smoothstep(12, 40, age)) * 0.36;
      if (a < 0.02) continue;
      r.draw(A.shadow, this.px[i], this.py[i], 0.12, 0.11, 0, packColor(0, 0, 0, a));
    }
    r.endShadows();
  }

  private drawFloaters(r: Renderer, st: Stage) {
    const x0 = r.visibleX0(10), x1 = r.visibleX1(10);
    void st;
    for (const f of this.float) {
      if (!f.alive) continue;
      const dd = rowOf(f.z);
      const [cx, hw] = f.stream ? mouthAt(dd) : creekAt(dd);
      const x = cx + f.e * hw;
      if (x < x0 || x > x1) continue;
      const y = baseTop(x) + dd;
      const k = clamp(persp(dd) * 0.8, 1, 2.2);
      const fade = f.stream ? Math.min(1, (f.z - 0.015) * 30) : Math.min(1, (0.72 - f.z) * 20, (f.z - 0.04) * 30);
      const fr = f.f < A.leaves.length ? A.leaves[f.f] : f.f === A.leaves.length ? this.twigF : A.petals[f.f % A.petals.length];
      const col = f.f < A.leaves.length ? packColor(0.85, 0.8, 0.55, fade) : packColor(1, 1, 1, fade);
      r.draw(fr, x, y, k, k * 0.7, f.rot, col);
    }
  }

  draw(r: Renderer, st: Stage) {
    const s = this.s, p = s.player;
    if (!p) return;
    const t = st.time;
    // spreading rings (on the water surface, over the wading legs)
    for (const g of this.rings) drawRing(r, g.x, g.y, g.r * smoothstep(0, 1, g.t / g.life + 0.1), (1 - g.t / g.life) * 0.6);
    // the water line over wading feet: a band of water with a bright surface edge, and a wake
    for (const w of this.waders) {
      if (w.depth < 0.35) continue;
      const a = w.who;
      if (a && (!a.visible || a.alpha < 0.1)) continue;
      const x = a ? a.x : p.x;
      const kind = this.kindAt(x) ?? 'swash';
      const [tr, tg, tb] = TINT[kind];
      const top = this.surfaceAt(x);
      const deep = Math.min(w.depth, groundY(x) - top + 1);
      // the legs below the surface: tinted and darkened by the water (just the legs' width, so the
      // water around them isn't stained), under a bright bobbing water line a little wider
      const legs = w.dog ? 6 : 4, line = w.dog ? 9 : 7;
      const vx = a ? a.vx : p.vx;
      for (let i = -legs; i <= legs; i++) {
        const edge = Math.abs(i) / (legs + 0.5);
        const h = Math.round(Math.max(1, deep));
        r.rect(x + i, top + 1, 1, h, packColor(tr * 0.55, tg * 0.62, tb * 0.66, 0.62 * (1 - edge * edge)));
      }
      for (let i = -line; i <= line; i++) {
        const edge = Math.abs(i) / line;
        const bob = Math.sin(t * 7 + i * 0.9) > 0.6 ? -1 : 0;
        r.rect(x + i, top + bob, 1, 1, packColor(0.94, 1, 1, 0.95 * (1 - edge * edge)));
        if (edge < 0.6 && Math.sin(t * 5 + i * 1.7) > 0.2) r.rect(x + i, top + 1, 1, 1, packColor(tr + 0.25, tg + 0.18, tb + 0.15, 0.5));
      }
      // a V wake trailing behind anyone moving through the water
      const sp = Math.abs(vx);
      if (sp > 10) {
        const dir = Math.sign(vx);
        const k = Math.min(1, sp / 60);
        for (let j = 1; j < 9; j++) for (const arm of [-1, 1]) {
          const wx = x - dir * (line * 0.6 + j * 2.2), wy = top + (arm > 0 ? j * 0.35 : -j * 0.12);
          if (Math.sin(t * 9 + j * 1.3 + arm) < -0.4) continue;
          r.rect(Math.round(wx), Math.round(wy), 2, 1, packColor(0.9, 0.98, 1, (0.7 - j * 0.07) * k));
        }
      }
    }
  }
}

export { rowOf };

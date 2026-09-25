// CPU particle system. Particles live on a parallax layer and are drawn either lit (scene pass)
// or glowing (additive FX pass).

import type { Frame, Renderer } from '../gfx/renderer';
import { packColor } from '../gfx/renderer';
import { rand } from '../core/math';

export interface PSpec {
  frame: Frame;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  ax?: number;
  ay?: number;
  drag?: number;
  life: number;
  size?: number;
  size1?: number;
  rot?: number;
  vrot?: number;
  color?: [number, number, number];
  color1?: [number, number, number];
  alpha?: number;
  alpha1?: number;
  glow?: boolean;
  intensity?: number;
  /** fade in over the first fraction of life */
  fadeIn?: number;
  wobble?: number;
  wobbleF?: number;
  /** leaves: sway side to side while falling */
  flutter?: number;
  floorY?: number;
  onFloor?: 'die' | 'stop' | 'bounce';
  lightR?: number;
}

interface P extends Required<Omit<PSpec, 'frame' | 'color1' | 'floorY' | 'onFloor' | 'lightR'>> {
  frame: Frame;
  color1: [number, number, number] | null;
  t: number;
  seed: number;
  floorY: number;
  onFloor: 'die' | 'stop' | 'bounce';
  lightR: number;
  alive: boolean;
}

export class Particles {
  private list: P[] = [];
  private pool: P[] = [];
  constructor(public max = 1500) {}

  get count() {
    return this.list.length;
  }

  spawn(s: PSpec) {
    if (this.list.length >= this.max) return;
    const p = this.pool.pop() ?? ({} as P);
    p.frame = s.frame;
    p.x = s.x; p.y = s.y;
    p.vx = s.vx ?? 0; p.vy = s.vy ?? 0;
    p.ax = s.ax ?? 0; p.ay = s.ay ?? 0;
    p.drag = s.drag ?? 0;
    p.life = s.life;
    p.size = s.size ?? 1;
    p.size1 = s.size1 ?? p.size;
    p.rot = s.rot ?? 0;
    p.vrot = s.vrot ?? 0;
    p.color = s.color ?? [1, 1, 1];
    p.color1 = s.color1 ?? null;
    p.alpha = s.alpha ?? 1;
    p.alpha1 = s.alpha1 ?? 0;
    p.glow = s.glow ?? false;
    p.intensity = s.intensity ?? 1;
    p.fadeIn = s.fadeIn ?? 0.1;
    p.wobble = s.wobble ?? 0;
    p.wobbleF = s.wobbleF ?? 1;
    p.flutter = s.flutter ?? 0;
    p.floorY = s.floorY ?? Infinity;
    p.onFloor = s.onFloor ?? 'die';
    p.lightR = s.lightR ?? 0;
    p.t = 0;
    p.seed = rand.next() * 100;
    p.alive = true;
    this.list.push(p);
  }

  update(dt: number) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.t += dt;
      if (p.t >= p.life) {
        L[i] = L[L.length - 1];
        L.pop();
        this.pool.push(p);
        continue;
      }
      p.vx += p.ax * dt;
      p.vy += p.ay * dt;
      if (p.drag) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      let wx = 0;
      if (p.wobble) wx = Math.sin(p.t * p.wobbleF + p.seed) * p.wobble;
      if (p.flutter) wx += Math.sin(p.t * 2.6 + p.seed) * p.flutter;
      p.x += (p.vx + wx) * dt;
      p.y += (p.vy + (p.wobble ? Math.cos(p.t * p.wobbleF * 0.7 + p.seed) * p.wobble * 0.6 : 0)) * dt;
      p.rot += p.vrot * dt;
      if (p.flutter) p.rot = Math.sin(p.t * 2.6 + p.seed) * 0.8;
      if (p.y > p.floorY) {
        if (p.onFloor === 'die') p.t = p.life;
        else if (p.onFloor === 'stop') {
          p.y = p.floorY;
          p.vx = p.vy = p.ax = p.ay = 0;
          p.flutter = 0;
          p.wobble = 0;
        } else {
          p.y = p.floorY;
          p.vy *= -0.35;
          p.vx *= 0.6;
        }
      }
    }
  }

  private colorOf(p: P, k: number, a: number) {
    const c = p.color, c1 = p.color1;
    if (c1) return packColor(c[0] + (c1[0] - c[0]) * k, c[1] + (c1[1] - c[1]) * k, c[2] + (c1[2] - c[2]) * k, a);
    return packColor(c[0], c[1], c[2], a);
  }

  /** Draw on the renderer's current layer. */
  draw(r: Renderer, lights = true) {
    for (const p of this.list) {
      const k = p.t / p.life;
      let a = p.alpha + (p.alpha1 - p.alpha) * k;
      if (p.fadeIn > 0 && k < p.fadeIn) a *= k / p.fadeIn;
      if (a <= 0.003) continue;
      const s = p.size + (p.size1 - p.size) * k;
      const col = this.colorOf(p, k, Math.min(1, a));
      if (p.glow) {
        r.fxDraw(p.frame, p.x, p.y, s, s, p.rot, col, p.intensity, true);
        if (lights && p.lightR > 0) r.light(p.x, p.y, p.lightR, p.color[0], p.color[1], p.color[2], p.intensity * a * 0.35);
      } else r.draw(p.frame, p.x, p.y, s, s, p.rot, col);
    }
  }

  clear() {
    for (const p of this.list) this.pool.push(p);
    this.list.length = 0;
  }
}

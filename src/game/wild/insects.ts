// Insects: the small life of the ecosystem. Moths flutter toward light, fireflies blink in the
// dusk, dragonflies dart and hover over water, bees work the flowers, butterflies drift through
// sunbeams. They scatter from the player, and insect-eaters really catch them.

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Drawable } from '../../world/stage';
import type { PixelBuffer } from '../../art/pixel';
import { A, local } from '../assets';
import { rand } from '../../core/math';

export type InsectKind = 'lanternbeetle' | 'skymoth' | 'dragonfly' | 'weta' | 'mantis' | 'cicada' | 'bee' | 'butterfly' | 'ant' | 'firefly';

export interface InsectArt {
  INSECT_INFO: Record<string, { frames: number; fps: number; glow?: [number, number, number] }>;
  renderInsect(kind: string, frame: number): { buf: PixelBuffer; ax: number; ay: number; glow?: PixelBuffer };
}
let art: InsectArt | null = null;
export function bindInsectArt(a: InsectArt | null) {
  art = a;
}

interface Bug {
  kind: InsectKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hx: number;
  hy: number;
  t: number;
  rest: number;
  glow: number;
  dead: boolean;
  facing: number;
}

interface LightSrc { x: number; y: number; k: number }

let owner: unknown = null;
const frames = new Map<string, Frame[]>();
function bugFrames(kind: InsectKind): Frame[] {
  if (owner !== local) { frames.clear(); owner = local; }
  let f = frames.get(kind);
  if (!f) {
    f = [];
    if (art?.INSECT_INFO[kind]) for (let i = 0; i < art.INSECT_INFO[kind].frames; i++) {
      const o = art.renderInsect(kind, i);
      f.push(local.add(`bug:${kind}#${i}`, o.buf, o.ax, o.ay));
    }
    frames.set(kind, f);
  }
  return f;
}

export class Insects implements Drawable {
  z = 60;
  bugs: Bug[] = [];
  /** light sources that attract moths (lamps, lure-viper tails, the headlamp) */
  lights: LightSrc[] = [];
  flowers: [number, number][] = [];
  waterY: number | null = null;
  player: { x: number; y: number; vx: number } | null = null;
  night = false;

  spawn(kind: InsectKind, x: number, y: number, n = 1, spread = 40) {
    for (let i = 0; i < n; i++) {
      const bx = x + rand.range(-spread, spread), by = y + rand.range(-spread * 0.5, spread * 0.5);
      this.bugs.push({ kind, x: bx, y: by, vx: 0, vy: 0, hx: bx, hy: by, t: rand.next() * 10, rest: 0, glow: rand.next(), dead: false, facing: 1 });
    }
  }

  /** an insectivore snaps at (x, y); returns true if it caught something */
  catch(x: number, y: number, r: number): boolean {
    for (const b of this.bugs) {
      if (b.dead || b.kind === 'ant' || b.kind === 'cicada') continue;
      if (Math.abs(b.x - x) < r && Math.abs(b.y - y) < r) {
        b.dead = true;
        return true;
      }
    }
    return false;
  }

  update(dt: number) {
    const p = this.player;
    for (const b of this.bugs) {
      if (b.dead) continue;
      b.t += dt;
      // scatter from a moving player
      const flee = p && Math.abs(p.x - b.x) < 30 && Math.abs(p.y - 30 - b.y) < 40 && Math.abs(p.vx) > 20;
      switch (b.kind) {
        case 'skymoth':
        case 'butterfly': {
          let tx = b.hx + Math.sin(b.t * 0.7) * 50, ty = b.hy + Math.sin(b.t * 1.3) * 20;
          if (this.night && b.kind === 'skymoth') {
            let best: LightSrc | null = null, bd = 260;
            for (const l of this.lights) { const d = Math.hypot(l.x - b.x, l.y - b.y) / l.k; if (d < bd) { bd = d; best = l; } }
            if (best) { tx = best.x + Math.cos(b.t * 3) * 14; ty = best.y + Math.sin(b.t * 4) * 10; }
          } else if (this.flowers.length && b.rest <= 0 && rand.next() < dt * 0.1) {
            const f = this.flowers[Math.floor(rand.next() * this.flowers.length)];
            b.hx = f[0];
            b.hy = f[1] - 4;
          }
          const ax = (tx - b.x) * 1.2 + rand.range(-120, 120), ay = (ty - b.y) * 1.2 + rand.range(-160, 160);
          b.vx += ax * dt;
          b.vy += ay * dt;
          b.vx *= 0.96;
          b.vy *= 0.96;
          break;
        }
        case 'firefly':
        case 'lanternbeetle': {
          const tx = b.hx + Math.sin(b.t * 0.4 + b.glow * 6) * 60, ty = b.hy + Math.cos(b.t * 0.55) * 26;
          b.vx += ((tx - b.x) * 0.5 + rand.range(-20, 20)) * dt;
          b.vy += ((ty - b.y) * 0.5 + rand.range(-20, 20)) * dt;
          b.vx *= 0.97;
          b.vy *= 0.97;
          break;
        }
        case 'dragonfly': {
          // darts: hover, then zip to a new spot
          b.rest -= dt;
          if (b.rest <= 0) {
            b.rest = rand.range(0.6, 2.2);
            const wy = this.waterY ?? b.hy;
            const nx = b.hx + rand.range(-90, 90), ny = wy - rand.range(8, 50);
            b.vx = (nx - b.x) * 2.5;
            b.vy = (ny - b.y) * 2.5;
          }
          b.vx *= 0.9;
          b.vy *= 0.9;
          break;
        }
        case 'bee': {
          if (this.flowers.length && (b.rest <= 0)) {
            b.rest = rand.range(2, 5);
            const f = this.flowers[Math.floor(rand.next() * this.flowers.length)];
            b.hx = f[0] + rand.range(-4, 4);
            b.hy = f[1] - 3;
          }
          b.rest -= dt;
          b.vx += ((b.hx - b.x) * 3 + rand.range(-60, 60)) * dt;
          b.vy += ((b.hy - b.y) * 3 + rand.range(-60, 60)) * dt;
          b.vx *= 0.9;
          b.vy *= 0.9;
          break;
        }
        default:
          // crawlers: ants march, wētā creep, mantis sway, cicadas sit
          if (b.kind === 'ant') { b.vx = 8 * b.facing; b.vy = 0; if (Math.abs(b.x - b.hx) > 60) b.facing = -b.facing; }
          else if (b.kind === 'weta') { b.vx = Math.sin(b.t * 0.3) * 4; b.vy = Math.cos(b.t * 0.21) * 3; }
          else { b.vx = 0; b.vy = 0; }
      }
      if (flee && b.kind !== 'ant' && b.kind !== 'cicada' && b.kind !== 'weta') {
        b.vx += Math.sign(b.x - p!.x) * 200 * dt * 10;
        b.vy -= 120 * dt * 5;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (Math.abs(b.vx) > 3) b.facing = Math.sign(b.vx);
    }
    if (this.bugs.length > 20 && this.bugs.some(b => b.dead)) this.bugs = this.bugs.filter(b => !b.dead);
  }

  draw(r: Renderer) {
    const x0 = r.visibleX0(20), x1 = r.visibleX1(20);
    for (const b of this.bugs) {
      if (b.dead || b.x < x0 || b.x > x1) continue;
      const fr = bugFrames(b.kind);
      const info = art?.INSECT_INFO[b.kind];
      if (fr.length) {
        const i = Math.floor(b.t * (info?.fps ?? 8)) % fr.length;
        r.draw(fr[i], b.x, b.y, b.facing, 1);
      } else {
        r.rect(b.x, b.y, 1, 1, packColor(0.2, 0.2, 0.2, 1));
      }
      if (b.kind === 'firefly' || b.kind === 'lanternbeetle') {
        const on = 0.5 + 0.5 * Math.sin(b.t * (b.kind === 'firefly' ? 3.1 : 1.7) + b.glow * 9);
        const k = Math.pow(on, 3) * (this.night ? 1 : 0.25);
        if (k > 0.05) {
          const c = b.kind === 'firefly' ? [1, 0.95, 0.5] : [0.55, 1, 0.75];
          r.fxDraw(A.glow, b.x, b.y, 0.14, 0.14, 0, packColor(c[0], c[1], c[2], 1), 2.4 * k);
          if (k > 0.5) r.light(b.x, b.y, 18, c[0], c[1], c[2], 0.5 * k);
        }
      }
    }
  }
}

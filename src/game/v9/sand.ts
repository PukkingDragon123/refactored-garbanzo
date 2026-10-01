// V9 sand interaction on the island beach. Everyone who walks the sand leaves prints: Mori's and the
// cast's feet are stamped where each foot plants (read from their distance-driven walk / run clips),
// Chunk leaves little paw prints. Prints on the wet sand at the water's edge are dark and glossy and
// get washed away by the swash; up on the firmer berm of the landing beach they are crisp dents that
// soften and fade over a minute or so. Each step kicks up a puff of sand (or droplets in the swash),
// running throws more, stopping from a run skids and sprays. Gusts blow streamers of sand along the
// beach and roll loose spinifex seed heads past the camera.

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Drawable, Stage } from '../../world/stage';
import type { Actor } from '../../world/actor';
import { animInfo } from '../../world/actor';
import { PixelBuffer } from '../../art/pixel';
import { hex } from '../../art/color';
import { local, A } from '../assets';
import { clamp, hash2, noise1, rand, smoothstep } from '../../core/math';
import { ISL, groundY, zoneAt } from '../../art/island4/layout';
import { sandCol } from '../../art/v9/sand';
import { spinBall } from '../../art/v9/beach-flora';
import type { IslandScene4 } from '../v4/island';

/** 0 dry berm .. 1 glassy swash zone, for the walk line at x (the landing beach has a firmer berm) */
export function sandWet(x: number): number {
  const berm = smoothstep(1420, 1560, x) * (1 - smoothstep(2300, 2460, x));
  return clamp(0.9 - berm * 0.75 + (noise1(x / 90, 7) - 0.5) * 0.3);
}
/** can prints be left at x (sand, not rock, water or the wreck's floor)? */
export function sandy(x: number): boolean {
  if (x < 430) return false;
  const z = zoneAt(x);
  if (z === 'cave' || z === 'forest' || z === 'cliffs') return false;
  if (Math.abs(x - 3780) < 70) return false; // the stream ford
  return true;
}

/** kind: 0 dry foot, 1 wet foot, 2 paw, 3 skid streak */
interface Print { x: number; y: number; t: number; life: number; kind: 0 | 1 | 2 | 3; flip: boolean; wet: number; a: number; deep: number }
interface Walker { a: Actor; frame: number; dist: number; lastX: number; foot: number; peak: number; paw: boolean; gait: string }

let frames: Frame[] | null = null;
/** print stamps: [0] dry foot dent, [1] wet foot, [2] paw, [3] skid streak */
function stamps(): Frame[] {
  if (frames && frames[0].tex) return frames;
  const mk = (w: number, h: number, rows: string[], pal: Record<string, number>, key: string) => {
    const b = new PixelBuffer(w, h);
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) b.data[y * w + x] = pal[ch]; }));
    return local.add(key, b, w / 2, h / 2);
  };
  // dents lit from the upper left: the far wall in shadow, the near lip catching the light
  const dry = { d: hex('#8e6e44'), m: hex('#b0905e'), l: hex('#fbeec8') };
  const wet = { d: hex('#2e2a22'), m: hex('#463f32'), l: hex('#9a9282') };
  frames = [
    mk(8, 4, ['..dddm..', '.dmmmmm.', 'ddmm.mml', '.llllll.'], dry, 'v9:print:dry'),
    mk(8, 4, ['..dddm..', '.dmmmmm.', 'ddmm.mml', '..mmmm..'], wet, 'v9:print:wet'),
    mk(5, 3, ['d.d.d', '.ddd.', '.lll.'], { d: hex('#7a5e3e'), m: hex('#9a7c54'), l: hex('#f4e4bc') }, 'v9:print:paw'),
    mk(12, 3, ['..ddddmmm...', '.dmmmmmmmmm.', 'llllllllll..'], dry, 'v9:print:skid'),
  ];
  return frames;
}

export class SandFX implements Drawable {
  z = -9.5;
  prints: Print[] = [];
  private walkers = new Map<Actor, Walker>();
  private balls: { x: number; y: number; vx: number; rot: number; life: number; d: number }[] = [];
  private ballF: Frame | null = null;
  private gustT = 0;
  private sheetSeen = new WeakSet<object>();
  constructor(readonly s: IslandScene4) {}

  private track(a: Actor, paw: boolean) {
    let w = this.walkers.get(a);
    if (!w) { w = { a, frame: a.currentFrame(), dist: 0, lastX: a.x, foot: 0, peak: 0, paw, gait: '' }; this.walkers.set(a, w); }
    return w;
  }

  private stamp(x: number, y: number, kind: 0 | 1 | 2, flip: boolean, deep: number) {
    const wet = sandWet(x);
    const p: Print = { x, y, t: 0, life: kind === 2 ? 40 : wet > 0.5 ? 26 : 70, kind, flip, wet, a: 1, deep };
    this.prints.push(p);
    if (this.prints.length > 420) this.prints.splice(0, this.prints.length - 420);
  }

  /** a puff of sand (or a spatter of water) at a foot */
  private puff(x: number, y: number, n: number, dir: number, hard = 1) {
    const L = this.s.main.particles;
    const wet = sandWet(x) > 0.55;
    for (let i = 0; i < n; i++) {
      const c: [number, number, number] = wet ? (rand.chance(0.5) ? [0.86, 0.94, 0.96] : [0.6, 0.55, 0.45]) : rand.chance(0.5) ? [0.95, 0.85, 0.64] : [0.85, 0.72, 0.5];
      L.spawn({ frame: A.dot, x: x + rand.range(-2, 2), y: y - 0.5, vx: dir * rand.range(4, 22) * hard + rand.range(-6, 6), vy: -rand.range(8, 26) * hard, ay: 120, drag: 1.5, life: rand.range(0.3, 0.7), color: c, alpha: 0.9, alpha1: 0, floorY: y + rand.range(0, 2), onFloor: 'die' });
    }
  }

  update(dt: number, st: Stage) {
    const s = this.s, p = s.player;
    if (!p) return;
    // ---- feet: every actor on the sand
    const list: [Actor, boolean][] = [[p.body, false]];
    for (const [id, a] of s.actors) if (a.visible && a.alpha > 0.5) list.push([a, id === 'chunk']);
    for (const [a, paw] of list) {
      const w = this.track(a, paw);
      const dx = a.x - w.lastX;
      w.lastX = a.x;
      const vx = Math.abs(dx) / Math.max(dt, 1e-3);
      w.peak = Math.max(w.peak * Math.exp(-dt * 1.2), vx);
      const onSand = sandy(a.x) && Math.abs(a.y - groundY(a.x)) < 3;
      if (!onSand || Math.abs(dx) > 30) { w.frame = a.currentFrame(); continue; }
      const gy = groundY(a.x);
      const dir = Math.sign(dx) || a.facing;
      const info = animInfo(a.anim, a.id) as { frames: number; dist?: number };
      if (!paw && info.dist && (a.anim === 'walk' || a.anim === 'run')) {
        // a foot plants every half cycle of the distance-driven gait. The clip itself advances by
        // distance, so counting distance here stays in step with it at any frame rate; the phase is
        // picked up from the clip's frame whenever the gait changes.
        const half = info.dist / 2, run = a.anim === 'run';
        if (w.gait !== a.anim) { w.gait = a.anim; w.dist = ((a.currentFrame() % (info.frames / 2)) / (info.frames / 2)) * half; }
        w.dist += Math.abs(dx);
        while (w.dist >= half) {
          w.dist -= half;
          const fx = a.x - dir * w.dist + dir * info.dist * (run ? 0.18 : 0.3);
          w.foot ^= 1;
          this.stamp(fx, gy + (w.foot ? 0.6 : 2), sandWet(fx) > 0.5 ? 1 : 0, dir < 0, run ? 1 : 0.7);
          this.puff(fx, gy + 1, run ? rand.int(3, 6) : rand.int(1, 2), -dir, run ? 1.3 : 0.6);
        }
      } else if (Math.abs(dx) > 0.01) {
        // paws (and anyone without a gait clip): a print every few px, alternating sides
        w.dist += Math.abs(dx);
        const step = paw ? 5 : 9;
        if (w.dist > step) {
          w.dist = 0;
          w.foot ^= 1;
          this.stamp(a.x + dir * 2, gy + (w.foot ? 0.5 : 1.8), paw ? 2 : 0, dir < 0, 0.6);
          if (rand.chance(paw ? 0.35 : 0.6)) this.puff(a.x, gy + 1, 1, -dir, paw ? 0.5 : 0.7);
        }
      } else w.gait = '';
      // skidding to a stop from a run: a streak and a spray of sand forward
      if (w.peak > 85 && vx < 20 && !paw) {
        w.peak = 0;
        this.prints.push({ x: a.x + a.facing * 4, y: gy + 1.4, t: 0, life: 45, kind: 3, flip: a.facing < 0, wet: sandWet(a.x), a: 1, deep: 1 });
        this.puff(a.x + a.facing * 6, gy + 1, 9, a.facing, 1.6);
      }
    }
    // ---- age the prints; the swash washes the waterline ones away as each sheet runs up
    for (const pr of this.prints) {
      pr.t += dt;
      pr.a = clamp(1 - smoothstep(pr.life * 0.5, pr.life, pr.t)) * pr.a;
    }
    for (const sh of s.swash.sheets) {
      if (sh.t < 1 || this.sheetSeen.has(sh)) continue;
      this.sheetSeen.add(sh);
      for (const pr of this.prints) {
        const k = smoothstep(0.45, 0.95, pr.wet) * (sh.reach > 18 ? 0.8 : 0.45) * (0.6 + hash2(Math.round(pr.x), sh.seed, 3) * 0.6);
        pr.a *= 1 - clamp(k);
      }
    }
    this.prints = this.prints.filter(pr => pr.a > 0.03);
    // ---- wind: streamers of sand low over the beach and the odd rolling spinifex head in a gust
    const gust = clamp((st.wind - 0.55) / 0.5);
    this.gustT -= dt;
    if (gust > 0.2 && this.gustT <= 0) {
      this.gustT = 0.05;
      const L = s.main.particles;
      for (let i = 0; i < 2; i++) {
        const x = st.cam.x + rand.range(-420, 360);
        if (!sandy(x) || x > 3300 && x < 4000) continue;
        const d = rand.range(sandCol(x).wet + 6, 110);
        L.spawn({ frame: A.dot, x, y: groundY(x) + d, vx: rand.range(70, 140) * gust, vy: rand.range(-3, 1), life: rand.range(0.6, 1.6), color: [0.94, 0.84, 0.64], alpha: 0.75, alpha1: 0, wobble: 1.5, wobbleF: 6 });
      }
      if (rand.chance(0.012 * gust) && this.balls.length < 3) {
        const x = st.cam.x - 380;
        if (sandy(x + 200)) this.balls.push({ x, y: 0, vx: rand.range(40, 70), rot: 0, life: 14, d: rand.range(34, 100) });
      }
    }
    for (const b of this.balls) {
      b.life -= dt;
      b.vx += ((60 + gust * 60) - b.vx) * dt * 0.8;
      b.x += b.vx * dt;
      b.rot += b.vx * dt / 4;
      b.y = groundY(b.x) + b.d - Math.abs(Math.sin(b.rot * 0.9)) * 2.5;
    }
    this.balls = this.balls.filter(b => b.life > 0);
  }

  draw(r: Renderer) {
    const fr = stamps();
    const x0 = r.visibleX0(10), x1 = r.visibleX1(10);
    for (const pr of this.prints) {
      if (pr.x < x0 || pr.x > x1) continue;
      const f = pr.kind === 3 ? fr[3] : pr.kind === 2 ? fr[2] : pr.wet > 0.5 ? fr[1] : fr[0];
      const a = pr.a * (0.55 + pr.deep * 0.45);
      r.draw(f, pr.x, pr.y, pr.flip ? -1 : 1, 1, 0, packColor(1, 1, 1, a));
      // water seeping into the fresh wet prints mirrors the sky
      if (pr.wet > 0.5 && pr.kind < 2 && pr.t < 12) {
        r.water(0.5, 0.4);
        r.rect(pr.x - 1.5, pr.y - 0.5, 3, 1, packColor(0.55, 0.62, 0.6, a * 0.6 * (1 - pr.t / 12)));
        r.water(0);
      }
    }
    if (this.balls.length) {
      if (!this.ballF || !this.ballF.tex) { const b = spinBall(5, 5); this.ballF = local.add('v9:spinball', b.buf, b.ax, b.ay); }
      for (const b of this.balls) {
        r.beginShadows();
        r.draw(A.shadow, b.x, groundY(b.x) + b.d + 1, 0.3, 0.4, 0, packColor(0, 0, 0, 0.3));
        r.endShadows();
        r.draw(this.ballF, b.x, b.y - 5, 1.2, 1.2, b.rot, packColor(1, 1, 1, clamp(b.life)));
      }
    }
  }
}

export { ISL };

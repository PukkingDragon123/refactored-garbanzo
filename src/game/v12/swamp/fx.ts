// V12 Te Repo Raupō, the swamp's moving parts: crisp pixel ripple rings (rain, wading, a toad going
// under), the peat water over a wader's legs, the swamp's own weather (showers that come and go, and
// the evening rain the giant toad sings in), marsh gas bubbling up out of the mud, mosquitoes round
// Mori's head at dusk, and the pale marsh lights that drift over the water at night.

import type { Renderer } from '../../../gfx/renderer';
import { packColor } from '../../../gfx/renderer';
import type { Drawable, Stage } from '../../../world/stage';
import { audio } from '../../../core/audio';
import { bayer, clamp, hash2, rand, smoothstep } from '../../../core/math';
import type { DayClock } from '../../v4/islefx';
import { game } from '../../game';
import { swBase, swDepth, swWet, SW } from './layout';

// ---------------------------------------------------------------- ripples
interface Ring { x: number; y: number; t: number; d: number; r: number; a: number }
/** expanding rings on the water, drawn pixel by pixel (squashed: we look down the water's skin) */
export class Ripples implements Drawable {
  z = -8.6;
  private list: Ring[] = [];
  add(x: number, y: number, r = 6, d = 0.9, a = 0.55) { if (this.list.length < 260) this.list.push({ x, y, t: 0, d, r, a }); }
  update(dt: number) {
    for (const q of this.list) q.t += dt;
    if (this.list.some(q => q.t >= q.d)) this.list = this.list.filter(q => q.t < q.d);
  }
  draw(r: Renderer) {
    const x0 = r.visibleX0(20), x1 = r.visibleX1(20);
    for (const q of this.list) {
      if (q.x < x0 || q.x > x1) continue;
      const k = q.t / q.d, rx = 1 + k * q.r, ry = Math.max(0.5, rx * 0.3);
      const n = Math.max(6, Math.round(rx * 2.4));
      const col = packColor(0.62, 0.72, 0.68, q.a * (1 - k));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        // (the near half of the ring catches the light; the far half is fainter)
        if (Math.sin(a) < 0 && i % 2) continue;
        r.rect(Math.round(q.x + Math.cos(a) * rx), Math.round(q.y + Math.sin(a) * ry), 1, 1, col);
      }
    }
  }
}

// ---------------------------------------------------------------- the water over a wader's legs
/** the peat water's skin in front of anything standing in it: everything below the surface is seen
 *  through dark tea (Mori's legs, the giant toad's belly, the boardwalk piles) */
export class FrontWater implements Drawable {
  z = 62;
  /** [x, half width] of everyone who might be standing in the water (only there is the skin drawn) */
  constructor(readonly who: () => [number, number][]) {}
  draw(r: Renderer, st: Stage) {
    const x0 = r.visibleX0(4), x1 = Math.min(SW.W, r.visibleX1(4));
    const body = packColor(0.05, 0.065, 0.05, 0.8), skin = packColor(0.5, 0.6, 0.56, 0.55), skin2 = packColor(0.3, 0.38, 0.34, 0.6);
    for (const [cx, half] of this.who()) {
      if (cx < x0 - 60 || cx > x1 + 60) continue;
      for (let x = Math.round(cx) - half; x <= Math.round(cx) + half; x++) {
        const d = swDepth(x);
        if (d < 1.2) continue;
        // the edges of the patch dissolve in a dither, so it never reads as a box
        const e = clamp((half - Math.abs(x - cx)) / 6);
        const y = Math.round(swBase(x)), h = Math.ceil(d) + 5;
        if (e >= 1) r.rect(x, y + 1, 1, h, body);
        else for (let yy = 1; yy <= h; yy++) if (bayer(x, y + yy) < e) r.rect(x, y + yy, 1, 1, body);
        if (e > 0.3) r.rect(x, y, 1, 1, Math.sin(st.time * 2.1 + x * 0.21) > 0.4 ? skin : skin2);
      }
    }
  }
}

// ---------------------------------------------------------------- the swamp's weather
/** rain where Mori is: showers pass now and then by day; most evenings it sets in at dusk (the giant
 *  toad's weather). Deterministic by day and hour, so the notebook can say "it rained on Day 4". */
export function swampRainAt(day: number, clockT: number): number {
  if (game.save?.flags?.['dev:swampRain']) return 1;
  if (game.save?.flags?.['dev:swampDry']) return 0;
  const evening = hash2(day, 3, 71) < 0.62;
  const eve = evening ? smoothstep(2.55, 2.85, clockT) * (1 - smoothstep(3.95, 4, clockT) * 0.3) : 0;
  // a passing shower: a slot of the day picked by the day's hash
  const slot = Math.floor(clockT * 5);
  const shower = hash2(day, slot, 72) < 0.22 ? Math.sin(((clockT * 5) % 1) * Math.PI) : 0;
  return clamp(Math.max(eve, shower), 0, 1);
}

interface Drop { x: number; y: number; v: number; floor: number }
/** the rain: thin slanted streaks falling past the camera, rings where they land on the water */
export class SwampRain implements Drawable {
  z = 63;
  k = 0;
  private drops: Drop[] = [];
  constructor(readonly clock: DayClock, readonly ripples: Ripples) {}
  target() { return swampRainAt(game.save?.day ?? 1, this.clock.t); }
  update(dt: number, st: Stage) {
    const want = this.target();
    this.k += (want - this.k) * Math.min(1, dt * 0.35);
    const n = Math.round(this.k * 170);
    const cx = st.cam.x, cy = st.cam.y;
    while (this.drops.length < n) this.drops.push({ x: cx + rand.range(-330, 330), y: cy + rand.range(-220, 150), v: rand.range(260, 340), floor: 0 });
    if (this.drops.length > n) this.drops.length = n;
    for (const d of this.drops) {
      d.y += d.v * dt; d.x -= d.v * 0.18 * dt;
      if (!d.floor) d.floor = swBase(d.x) + rand.range(-2, 90);
      if (d.y > d.floor) {
        if (swWet(d.x) > 0.4 && rand.chance(0.7)) this.ripples.add(d.x, d.floor, rand.range(3, 6), rand.range(0.5, 0.9), 0.45);
        d.x = cx + rand.range(-330, 330); d.y = cy - rand.range(160, 230); d.floor = 0;
      }
      if (d.x < cx - 360) d.x += 700;
    }
    audio.setStorm(Math.min(0.24, this.k * 0.24));
  }
  draw(r: Renderer) {
    if (this.k < 0.02) return;
    const c1 = packColor(0.74, 0.82, 0.86, 0.45 * clamp(this.k * 1.4)), c2 = packColor(0.88, 0.93, 0.97, 0.6 * clamp(this.k * 1.4));
    for (const d of this.drops) {
      const x = Math.round(d.x), y = Math.round(d.y);
      r.rect(x + 1, y - 3, 1, 3, c1);
      r.rect(x, y, 1, 3, c2);
    }
  }
}

// ---------------------------------------------------------------- marsh gas
/** bubbles of marsh gas welling up out of the mud: a dome swells on the water and pops, a ring spreads */
export class MarshBubbles implements Drawable {
  z = -8.5;
  private b: { x: number; y: number; t: number; d: number; s: number }[] = [];
  private spawnT = 0;
  constructor(readonly ripples: Ripples) {}
  update(dt: number, st: Stage) {
    for (const q of this.b) {
      q.t += dt;
      if (q.t >= q.d) { this.ripples.add(q.x, q.y, 3 + q.s * 3, 0.7, 0.5); if (Math.abs(q.x - st.cam.x) < 200 && rand.chance(0.35)) audio.play('bubble', { vol: 0.07, pitch: rand.range(0.4, 0.7) }); }
    }
    this.b = this.b.filter(q => q.t < q.d);
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    this.spawnT = rand.range(0.25, 0.8);
    const cx = st.cam.x;
    for (let tries = 0; tries < 5; tries++) {
      const x = cx + rand.range(-300, 300), dd = rand.range(4, 100);
      if (swWet(x) < 0.55) continue;
      // a cluster: one big, two little
      const y = swBase(x) + dd;
      const s = rand.next();
      this.b.push({ x, y, t: 0, d: rand.range(0.7, 1.5), s });
      if (rand.chance(0.5)) this.b.push({ x: x + rand.range(-4, 4), y: y + rand.range(-1, 1), t: -rand.range(0.2, 0.6), d: 0.6, s: 0 });
      break;
    }
  }
  draw(r: Renderer) {
    const dark = packColor(0.1, 0.12, 0.09, 0.95), lit = packColor(0.7, 0.78, 0.72, 0.9);
    for (const q of this.b) {
      if (q.t < 0) continue;
      const k = q.t / q.d, w = Math.round(1 + k * (1.5 + q.s * 2));
      r.rect(Math.round(q.x - w / 2), Math.round(q.y - 1), w, 1, dark);
      r.rect(Math.round(q.x - w / 2), Math.round(q.y - 2), 1, 1, lit);
      if (w > 2) r.rect(Math.round(q.x - w / 2) + 1, Math.round(q.y - 2), w - 2, 1, dark);
    }
  }
}

// ---------------------------------------------------------------- mosquitoes and marsh lights
/** a whining little cloud round Mori's head at dusk in the wet (they never bother anyone else) */
export class Mosquitoes implements Drawable {
  z = 64;
  private m = Array.from({ length: 9 }, (_, i) => ({ ph: i * 1.7, r: 6 + (i % 3) * 3, s: 1.5 + (i % 4) * 0.6 }));
  private k = 0;
  constructor(readonly clock: DayClock, readonly who: () => { x: number; y: number } | null, readonly onBite: () => void) {}
  private biteT = 14;
  update(dt: number) {
    const p = this.who();
    const t = this.clock.t;
    const want = p && (t > 2.5 || t < 0.4) && swWet(p.x) > 0.5 ? 1 : 0;
    this.k += (want - this.k) * Math.min(1, dt * 0.6);
    if (this.k > 0.6) { this.biteT -= dt; if (this.biteT <= 0) { this.biteT = rand.range(30, 60); this.onBite(); } }
  }
  draw(r: Renderer, st: Stage) {
    const p = this.who();
    if (!p || this.k < 0.05) return;
    const n = Math.round(this.m.length * this.k);
    const c = packColor(0.08, 0.08, 0.07, 0.9);
    for (let i = 0; i < n; i++) {
      const q = this.m[i], a = st.time * q.s * 3 + q.ph;
      r.rect(Math.round(p.x + Math.cos(a) * q.r + Math.sin(a * 2.3) * 2), Math.round(p.y - 36 + Math.sin(a * 1.3) * q.r * 0.6), 1, 1, c);
    }
  }
}

/** pale marsh lights drifting low over the open water at night: a greenish core and a soft halo */
export class MarshLights implements Drawable {
  z = 61;
  private q = Array.from({ length: 5 }, (_, i) => ({ x: 900 + i * 1900 + rand.range(-200, 200), ph: rand.range(0, 9), s: rand.range(0.4, 0.8) }));
  constructor(readonly clock: DayClock) {}
  draw(r: Renderer, st: Stage) {
    const night = this.clock.night;
    if (night < 0.05) return;
    const x0 = r.visibleX0(60), x1 = r.visibleX1(60);
    for (const w of this.q) {
      const x = w.x + Math.sin(st.time * 0.13 * w.s + w.ph) * 120;
      if (x < x0 || x > x1 || swWet(x) < 0.5) continue;
      const pulse = 0.5 + 0.5 * Math.sin(st.time * 1.7 + w.ph);
      const y = swBase(x) - 10 + Math.sin(st.time * 0.9 + w.ph) * 4;
      r.light(x, y, 40, 0.6, 1, 0.75, 0.55 * night * (0.5 + pulse * 0.5), 0.1);
      r.emissive(1);
      r.rect(Math.round(x), Math.round(y), 2, 2, packColor(0.75, 1, 0.8, 0.8 * night * (0.4 + pulse * 0.6)));
      r.rect(Math.round(x) - 1, Math.round(y) + 1, 1, 1, packColor(0.6, 0.9, 0.7, 0.5 * night));
      r.emissive();
    }
  }
}

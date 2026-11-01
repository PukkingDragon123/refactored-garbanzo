// V12 Te Rua Pōuri, the water and the small lights: the underground waterfall (streaks of falling water
// at their own speeds, a churn of foam in the plunge pool, spray specks), the pools in the stream bed
// and the black lake (still water with a lit rim, its surface glinting with the glowworm sky; ripple
// rings and bubbles that the Ghost Gulper sends up), and the glowworms themselves: a larva's light at
// the top of each silk thread, the sticky beads down it catching the light. Everything is drawn in
// whole pixels.

import type { Renderer } from '../../../gfx/renderer';
import { packColor } from '../../../gfx/renderer';
import { A } from '../../assets';
import { Rng, rand } from '../../../core/math';
import type { FieldScene } from '../../scenes/field';
import type { CaveLight } from './dark';
import { FALLS, LAKE, POOLS, floorOf, poolTop } from './layout';

const P = packColor;

// ------------------------------------------------------------------ the waterfall
export class Waterfall {
  z = -2;
  private cols: { x: number; sp: number; ph: number; len: number; c: number }[] = [];
  private t = 0;
  constructor(readonly f: FieldScene) {
    const r = new Rng(77);
    for (let i = 0; i < FALLS.w; i++) this.cols.push({ x: FALLS.x - FALLS.w / 2 + i, sp: r.range(210, 270), ph: r.range(0, 100), len: r.range(6, 16), c: r.int(0, 2) });
  }
  update(dt: number) {
    this.t += dt;
    const lp = this.f.main.particles;
    // spray off the plunge pool
    if (rand.chance(dt * 26)) lp.spawn({ frame: A.dot2, x: FALLS.x + rand.range(-14, 14), y: FALLS.bottom - 2, vx: rand.range(-50, 50), vy: rand.range(-80, -30), ay: 220, life: rand.range(0.4, 0.8), color: [0.75, 0.86, 0.92], alpha: 0.9, alpha1: 0.1, size: 0.5, size1: 0.4, floorY: FALLS.bottom });
  }
  draw(r: Renderer) {
    const { top, bottom } = FALLS;
    if (r.wy(r.VH) < top - 20 || r.wy(0) > bottom + 20) return;
    const cols = [P(0.78, 0.88, 0.94, 0.95), P(0.48, 0.62, 0.72, 0.9), P(0.22, 0.32, 0.4, 0.85)];
    const y0v = Math.max(top, r.wy(0) - 20), y1v = Math.min(bottom, r.wy(r.VH) + 20);
    for (const c of this.cols) {
      // the lip: out of the crack the water arcs a little before it drops
      const dx = (y: number) => Math.round(Math.min(1, (y - top) / 26) * 5);
      // the body, darkest at its edges
      const edge = c.x === this.cols[0].x || c.x === this.cols[this.cols.length - 1].x;
      r.rect(c.x + dx(y0v), y0v, 1, y1v - y0v, edge ? cols[2] : P(0.3, 0.42, 0.5, 0.7));
      // streaks running down it
      const period = 26;
      const off = ((this.t * c.sp + c.ph) % period);
      for (let y = top - period + off; y < bottom; y += period) {
        if (y + c.len < y0v || y > y1v) continue;
        const ya = Math.max(top, y), yb = Math.min(bottom, y + c.len);
        if (yb > ya) r.rect(c.x + dx(ya), ya, 1, yb - ya, cols[(c.c + Math.floor(y / period)) % 3]);
      }
    }
    // the foam where it lands: a churn of white pixels
    for (let i = 0; i < 26; i++) {
      const fx = FALLS.x - 16 + ((i * 7.3 + this.t * 40 * ((i % 3) - 1)) % 32 + 32) % 32;
      const fy = bottom - 2 - Math.abs(Math.sin(this.t * 7 + i * 1.7)) * 4;
      r.rect(Math.round(fx), Math.round(fy), i % 4 ? 1 : 2, 1, i % 3 ? P(0.86, 0.94, 0.98, 1) : P(0.6, 0.74, 0.82, 1));
    }
  }
}

// ------------------------------------------------------------------ pools and the lake
export interface Ring { x: number; y: number; r: number; t: number; life: number; k: number; inward?: boolean }
export class CaveWater {
  z = -3;
  rings: Ring[] = [];
  bubbles: { x: number; y: number; vy: number; s: number; top: number }[] = [];
  private t = 0;
  private pools = POOLS.map(p => ({ ...p, top: poolTop(p) }));
  constructor(readonly f: FieldScene) {}
  /** a ring spreading on the surface (inward: closing in on the point: the Gulper's tell) */
  ring(x: number, y: number, r: number, life = 1.4, k = 0.8, inward = false) { this.rings.push({ x, y, r, t: 0, life, k, inward }); }
  bubble(x: number, y: number, top: number, s = 1) { this.bubbles.push({ x, y, vy: -rand.range(18, 34), s, top }); }
  update(dt: number) {
    this.t += dt;
    for (const g of this.rings) g.t += dt;
    this.rings = this.rings.filter(g => g.t < g.life);
    for (const b of this.bubbles) { b.y += b.vy * dt; b.x += Math.sin(this.t * 6 + b.s * 9) * 6 * dt; }
    const popped = this.bubbles.filter(b => b.y <= b.top);
    for (const b of popped) { this.ring(b.x, b.top, 3 + b.s * 3, 0.7, 0.7); if (b.s > 1.2) this.f.sfx('bubble', b.x, 0.25, 0.6); }
    this.bubbles = this.bubbles.filter(b => b.y > b.top);
  }
  /** the back of the water: dark, reflective */
  draw(r: Renderer) {
    const vx0 = r.wx(0) - 4, vx1 = r.wx(r.VW) + 4, vy0 = r.wy(0) - 4, vy1 = r.wy(r.VH) + 4;
    r.water(0.7, 0.4, 0.6);
    for (const p of this.pools) {
      if (p.x1 < vx0 || p.x0 > vx1 || p.top > vy1 || p.top + 20 < vy0) continue;
      for (let x = p.x0; x < p.x1; x++) { const b = floorOf(p.tier, x); if (b > p.top + 1) r.rect(x, p.top, 1, b - p.top + 1, P(0.04, 0.07, 0.09, 1)); }
    }
    if (LAKE.top < vy1 && LAKE.top + 200 > vy0) {
      for (let x = Math.max(LAKE.x0, Math.floor(vx0 / 2) * 2); x < Math.min(LAKE.x1, vx1); x += 2) r.rect(x, LAKE.top, 2, LAKE.bed(x) - LAKE.top + 2, P(0.02, 0.04, 0.06, 1));
    }
    r.water(0);
  }
  /** in front of the swimmers: the translucent body, the lit rim, the glints, the rings and bubbles */
  front(r: Renderer, time: number) {
    const vx0 = r.wx(0) - 4, vx1 = r.wx(r.VW) + 4, vy0 = r.wy(0) - 4, vy1 = r.wy(r.VH) + 4;
    for (const p of this.pools) {
      if (p.x1 < vx0 || p.x0 > vx1 || p.top > vy1 || p.top + 20 < vy0) continue;
      let a = -1;
      for (let x = p.x0; x < p.x1; x++) {
        const b = floorOf(p.tier, x);
        if (b > p.top + 1) { r.rect(x, p.top + 1, 1, b - p.top, P(0.05, 0.12, 0.15, 0.42)); if (a < 0) a = x; }
        else if (a >= 0) { r.rect(a, p.top, x - a, 1, P(0.42, 0.56, 0.62, 0.7)); a = -1; }
      }
      if (a >= 0) r.rect(a, p.top, p.x1 - a, 1, P(0.42, 0.56, 0.62, 0.7));
    }
    if (LAKE.top < vy1 && LAKE.top + 200 > vy0) {
      const x0 = Math.max(LAKE.x0, Math.floor(vx0 / 2) * 2), x1 = Math.min(LAKE.x1, vx1);
      for (let x = x0; x < x1; x += 2) r.rect(x, LAKE.top + 1, 2, LAKE.bed(x) - LAKE.top, P(0.06, 0.14, 0.18, 0.62));
      r.rect(x0, LAKE.top, x1 - x0, 1, P(0.36, 0.5, 0.58, 0.85));
      // the glowworm sky glinting on the surface (whole pixels, a slow shimmer)
      for (let x = x0 - (x0 % 5); x < x1; x += 5) {
        const k = Math.sin(time * 1.3 + x * 0.37) * Math.sin(time * 0.7 + x * 0.11);
        if (k > 0.55) r.fxRect(x, LAKE.top, 1, 1, P(0.55, 0.95, 1, 1), 0.9 * k, true);
      }
    }
    // the rings: pixel ovals flattened onto the surface, spreading (or closing in), fading
    for (const g of this.rings) {
      const u = g.t / g.life;
      const rad = g.inward ? g.r * (1 - u) + 2 : g.r * (0.2 + u);
      const a = g.k * (1 - u * (g.inward ? 0.3 : 1));
      const n = Math.max(8, Math.round(rad * 1.6));
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2;
        const x = Math.round(g.x + Math.cos(ang) * rad), y = Math.round(g.y + Math.sin(ang) * rad * 0.18);
        if (y < g.y - 2) continue;
        r.fxRect(x, y, 1, 1, P(0.62, 0.86, 0.95, 1), 0.85 * a, true);
      }
    }
    for (const b of this.bubbles) {
      r.rect(Math.round(b.x), Math.round(b.y), b.s > 1.2 ? 2 : 1, b.s > 1.2 ? 2 : 1, P(0.7, 0.86, 0.92, 0.85));
      r.fxRect(Math.round(b.x), Math.round(b.y), 1, 1, P(0.6, 0.9, 1, 1), 0.5, true);
    }
  }
}

// ------------------------------------------------------------------ glowworms
interface Worm { dx: number; len: number; ph: number }
export interface GlowCluster { x: number; y: number; worms: Worm[]; light: CaveLight }
/** colonies of glowworms on the roof: the silk threads, the beads on them, the larvae's blue-green light */
export class Glowworms {
  z = -4;
  clusters: GlowCluster[] = [];
  private t = 0;
  add(x: number, y: number, n: number, seed: number, spread = 18): GlowCluster {
    const r = new Rng(seed);
    const worms: Worm[] = Array.from({ length: n }, () => ({ dx: r.range(-spread, spread), len: r.range(4, 18), ph: r.range(0, 6.28) }));
    const c: GlowCluster = { x, y, worms, light: { x, y: y + 8, r: 22 + spread * 0.9, k: 0.46 } };
    this.clusters.push(c);
    return c;
  }
  update(dt: number) { this.t += dt; }
  draw(r: Renderer) {
    const vx0 = r.wx(0) - 30, vx1 = r.wx(r.VW) + 30, vy0 = r.wy(0) - 30, vy1 = r.wy(r.VH) + 30;
    const silk = P(0.62, 0.7, 0.74, 0.32);
    for (const c of this.clusters) {
      if (c.x < vx0 || c.x > vx1 || c.y < vy0 || c.y > vy1) continue;
      for (const w of c.worms) {
        const x = Math.round(c.x + w.dx), sway = Math.round(Math.sin(this.t * 0.6 + w.ph) * 0.6);
        r.rect(x + sway, c.y + 2, 1, w.len, silk);
        // the beads of glue down the thread catch the light
        for (let y = 3 + (Math.round(w.ph * 3) % 3); y < w.len; y += 4) r.fxRect(x + sway, c.y + 2 + y, 1, 1, P(0.5, 0.85, 1, 1), 0.22 + 0.12 * Math.sin(this.t * 2 + w.ph + y), true);
        // the larva at the top: the light
        const k = 0.75 + 0.25 * Math.sin(this.t * 0.9 + w.ph);
        r.fxRect(x, c.y + 1, 1, 1, P(0.45, 1, 0.9, 1), 2.4 * k, true);
        if (w.len > 12) r.fxRect(x, c.y, 1, 1, P(0.3, 0.8, 0.8, 1), 0.9 * k, true);
      }
      r.light(c.x, c.y + 6, 40, 0.3, 0.9, 0.85, 0.35, 0.05);
    }
  }
}

/** Mori's breath smoking in the cold, deep down */
export function breathPuff(f: FieldScene, x: number, y: number, dir: number) {
  const lp = f.main.particles;
  for (let i = 0; i < 3; i++) lp.spawn({ frame: A.dot2, x: x + dir * (3 + i), y: y + rand.range(-1, 1), vx: dir * rand.range(8, 16), vy: rand.range(-8, -3), life: rand.range(0.7, 1.2), color: [0.86, 0.9, 0.94], alpha: 0.55, alpha1: 0, size: 0.6, size1: 1.1 });
}

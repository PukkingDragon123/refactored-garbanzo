// V12 Te Rua Pōuri, the swarms: the small life that fills the dark (the photographable and dangerous
// ones are animals: ./species.ts). Cave wētā crowd the walls in their dozens, antennae waving, and
// scatter from a bright lantern; harvestmen hang in clumps and all bob together when lit; little
// centipedes run the floors and dive into cracks from the light; moths flutter at the mouth and come
// to the lantern; springtails hop on the skin of the pools; bats hang from the roof at the mouth and
// one drops off now and then for a loop. (The glowworms are ./fx.ts.)

import type { Renderer, Frame } from '../../../gfx/renderer';
import { WHITE, packColor } from '../../../gfx/renderer';
import type { FieldScene } from '../../scenes/field';
import { local } from '../../assets';
import { renderAny } from '../../../art/beasts';
import { Rng, rand, clamp } from '../../../core/math';
import { MOTH_FRAMES, BAT_HANG, BAT_FLY, CENTI_FRAMES, HARV_FRAMES } from '../../../art/v12/cave/bugs';
import { TIER, TIERS, POOLS, floorOf, poolTop } from './layout';
import { WETA_ID } from './species';

interface Weta { hx: number; hy: number; x: number; y: number; f: number; face: number; run: number; vx: number; vy: number }
interface Clump { x: number; y: number; n: number; ph: number; bob: number }
interface Centi { x: number; tier: string; vx: number; face: number; t: number; gone: number }
interface Moth { x: number; y: number; vx: number; vy: number; ph: number; hx: number; hy: number }
interface Spring { x: number; y: number; vy: number; hop: number; top: number; x0: number; x1: number }
interface Bat { hx: number; hy: number; x: number; y: number; fly: number; t: number }

let fr: { weta: Frame[]; moth: Frame[]; batHang: Frame; batFly: Frame[]; centi: Frame[]; harv: Frame[]; owner: unknown } | null = null;
function frames() {
  if (fr && fr.owner === local) return fr;
  const weta = [0, 1, 2, 3].map(i => { const b = renderAny(WETA_ID, 'idle', i, 'open', 'juvenile'); return local.add('dc:wj:' + i, b.buf, b.ax, b.ay); });
  fr = {
    weta,
    moth: MOTH_FRAMES.map((m, i) => local.add('dc:moth:' + i, m.buf, m.ax, m.ay)),
    batHang: local.add('dc:batH', BAT_HANG.buf, BAT_HANG.ax, BAT_HANG.ay),
    batFly: BAT_FLY.map((m, i) => local.add('dc:batF:' + i, m.buf, m.ax, m.ay)),
    centi: CENTI_FRAMES.map((m, i) => local.add('dc:cen:' + i, m.buf, m.ax, m.ay)),
    harv: HARV_FRAMES.map((m, i) => local.add('dc:harv:' + i, m.buf, m.ax, m.ay)),
    owner: local,
  };
  return fr;
}

export class CaveBugs {
  z = -3.5;
  weta: Weta[] = [];
  clumps: Clump[] = [];
  centi: Centi[] = [];
  moths: Moth[] = [];
  springs: Spring[] = [];
  bats: Bat[] = [];
  private t = 0;
  constructor(readonly f: FieldScene, readonly lit: (x: number, y: number) => number, readonly lantern: () => [number, number] | null) {
    const r = new Rng(7071);
    // ---- wētā crowding the walls, in colonies, thickest in the wētā hall and the mouth
    const colony = (tier: string, x: number, n: number, spread: number) => {
      const t = TIER[tier];
      const fl = t.floor(x), top = fl - t.height(x);
      for (let i = 0; i < n; i++) {
        const hx = x + r.range(-spread, spread), hy = clamp(r.range(top + 10, fl - 14), top + 8, fl - 10);
        this.weta.push({ hx, hy, x: hx, y: hy, f: r.int(0, 3), face: r.chance(0.5) ? 1 : -1, run: 0, vx: 0, vy: 0 });
      }
    };
    for (const x of [380, 640, 1180, 1420]) colony('t0', x, 10 + r.int(0, 8), 60);
    for (let x = 620; x < 1900; x += r.range(110, 190)) colony('t1', x, 14 + r.int(0, 12), 70);
    for (const x of [300, 900, 1650, 1950]) colony('t2', x, 8 + r.int(0, 6), 50);
    for (const x of [1000, 1700, 2150]) colony('t3', x, 8, 50);
    // ---- harvestmen in clumps on the roofs of the middle halls
    for (const [tier, x] of [['t1', 860], ['t1', 1520], ['t2', 1050], ['t2', 1780], ['t3', 1380], ['g', 1450]] as const) {
      const t = TIER[tier];
      this.clumps.push({ x, y: t.floor(x) - t.height(x) + 10, n: 5 + r.int(0, 5), ph: r.range(0, 6), bob: 0 });
    }
    // ---- little centipedes running the floors
    for (const [tier, x] of [['t1', 900], ['t1', 1700], ['t2', 1200], ['t2', 1900], ['t3', 1100], ['t3', 1800], ['g', 1400], ['t4', 300]] as const) this.centi.push({ x, tier, vx: 0, face: 1, t: r.range(0, 3), gone: 0 });
    // ---- moths at the mouth
    for (let i = 0; i < 14; i++) { const x = r.range(40, 520), y = TIER.t0.floor(x) - r.range(30, 110); this.moths.push({ x, y, vx: 0, vy: 0, ph: r.range(0, 6), hx: x, hy: y }); }
    // ---- springtails on every pool
    for (const p of POOLS) { const top = poolTop(p); for (let i = 0; i < 10; i++) { const x = r.range(p.x0 + 6, p.x1 - 6); this.springs.push({ x, y: top, vy: 0, hop: r.range(0, 2), top, x0: p.x0 + 4, x1: p.x1 - 4 }); } }
    // ---- bats roosting over the guano at the mouth
    for (let i = 0; i < 9; i++) { const x = 880 + r.range(-40, 100), y = TIER.t0.floor(x) - TIER.t0.height(x) + 2; this.bats.push({ hx: x, hy: y, x, y, fly: 0, t: r.range(4, 20) }); }
  }

  update(dt: number) {
    this.t += dt;
    const p = this.f.player;
    if (!p || !(dt > 0)) return;
    const st = this.f.st, cx = st.cam.x, cy = st.cam.y;
    const near = (x: number, y: number) => Math.abs(x - cx) < 520 && Math.abs(y - cy) < 340;
    const L = this.lantern();
    for (const w of this.weta) {
      if (!near(w.hx, w.hy)) continue;
      if (w.run > 0) {
        w.run -= dt; w.x += w.vx * dt; w.y += w.vy * dt;
        if (w.run <= 0) { w.vx = w.vy = 0; }
        continue;
      }
      const l = this.lit(w.x, w.y);
      if (l > 0.55 && L && rand.chance(dt * 4)) {
        // scatter from the light
        const dx = w.x - L[0], dy = w.y - L[1], d = Math.hypot(dx, dy) || 1;
        w.vx = (dx / d) * rand.range(24, 46); w.vy = (dy / d) * rand.range(10, 26); w.run = rand.range(0.4, 1.1); w.face = w.vx > 0 ? 1 : -1;
      } else if (l < 0.2 && (Math.abs(w.x - w.hx) > 2 || Math.abs(w.y - w.hy) > 2) && rand.chance(dt * 0.6)) {
        // creep back home in the dark
        const dx = w.hx - w.x, dy = w.hy - w.y, d = Math.hypot(dx, dy) || 1;
        w.vx = (dx / d) * 8; w.vy = (dy / d) * 8; w.run = Math.min(2, d / 8); w.face = dx > 0 ? 1 : -1;
      } else if (rand.chance(dt * 0.25)) w.face = -w.face;
    }
    for (const c of this.clumps) { const l = this.lit(c.x, c.y); c.bob = l > 0.45 ? Math.min(1, c.bob + dt * 3) : Math.max(0, c.bob - dt * 0.6); }
    for (const c of this.centi) {
      const t = TIER[c.tier];
      if (!near(c.x, t.floor(c.x))) continue;
      if (c.gone > 0) { c.gone -= dt; if (c.gone <= 0) c.x = clamp(c.x + rand.range(-120, 120), t.x0 + 20, t.x1 - 20); continue; }
      c.t -= dt;
      const y = floorOf(c.tier, c.x);
      const l = this.lit(c.x, y - 2);
      if (l > 0.45 && L) {
        // away from the light, fast, and down a crack
        c.vx = (c.x > L[0] ? 1 : -1) * 70; c.face = c.vx > 0 ? 1 : -1;
        if (rand.chance(dt * 1.2)) c.gone = rand.range(6, 14);
      } else if (c.t <= 0) { c.t = rand.range(1, 4); c.vx = rand.chance(0.35) ? 0 : (rand.chance(0.5) ? 1 : -1) * rand.range(12, 26); if (c.vx) c.face = c.vx > 0 ? 1 : -1; }
      c.x = clamp(c.x + c.vx * dt, t.x0 + 10, t.x1 - 10);
    }
    for (const m of this.moths) {
      if (!near(m.x, m.y)) continue;
      // to the lantern when it's bright and close; otherwise wandering in the twilight
      let tx = m.hx + Math.sin(this.t * 0.4 + m.ph) * 30, ty = m.hy + Math.cos(this.t * 0.5 + m.ph) * 16;
      if (L && this.lit(m.x, m.y) > 0.05 && Math.hypot(L[0] - m.x, L[1] - m.y) < 160) { tx = L[0] + Math.cos(this.t * 3 + m.ph) * 14; ty = L[1] - 4 + Math.sin(this.t * 4.3 + m.ph) * 10; }
      m.vx += clamp((tx - m.x) * 2 - m.vx, -160, 160) * dt + rand.range(-60, 60) * dt;
      m.vy += clamp((ty - m.y) * 2 - m.vy, -160, 160) * dt + rand.range(-60, 60) * dt;
      m.x += m.vx * dt; m.y += m.vy * dt;
    }
    for (const s of this.springs) {
      if (!near(s.x, s.top)) continue;
      s.hop -= dt;
      const stirred = Math.abs(p.x - s.x) < 30 && Math.abs(p.y - s.top) < 30 && Math.abs(p.vx) > 8;
      if (s.y >= s.top && (s.hop <= 0 || stirred)) { s.vy = -rand.range(30, stirred ? 90 : 55); s.hop = rand.range(0.6, 3); }
      if (s.y < s.top || s.vy < 0) { s.vy += 300 * dt; s.y += s.vy * dt; s.x = clamp(s.x + (rand.next() - 0.5) * 30 * dt, s.x0, s.x1); if (s.y >= s.top) { s.y = s.top; s.vy = 0; } }
    }
    for (const b of this.bats) {
      if (!near(b.hx, b.hy)) continue;
      b.t -= dt;
      if (b.fly > 0) {
        b.fly -= dt;
        const k = 1 - b.fly / 4;
        b.x = b.hx + Math.sin(k * Math.PI * 2) * 90; b.y = b.hy + Math.sin(k * Math.PI) * 50 + Math.sin(this.t * 9) * 2;
        if (b.fly <= 0) { b.x = b.hx; b.y = b.hy; }
      } else if (b.t <= 0 || (this.lit(b.hx, b.hy + 4) > 0.6 && rand.chance(dt * 0.5))) { b.fly = 4; b.t = rand.range(12, 30); this.f.sfx('wingFlap', b.hx, 0.2, 1.6); }
    }
  }

  draw(r: Renderer) {
    const F = frames();
    const vx0 = r.wx(0) - 30, vx1 = r.wx(r.VW) + 30, vy0 = r.wy(0) - 30, vy1 = r.wy(r.VH) + 30;
    const vis = (x: number, y: number) => x > vx0 && x < vx1 && y > vy0 && y < vy1;
    const t = this.t;
    for (const w of this.weta) {
      if (!vis(w.x, w.y)) continue;
      const i = w.run > 0 ? Math.floor(t * 10) % 4 : (w.f + Math.floor(t * 2.2 + w.hx)) % 4;
      r.draw(F.weta[i], Math.round(w.x), Math.round(w.y), w.face, 1, 0, WHITE);
    }
    for (const c of this.clumps) {
      if (!vis(c.x, c.y)) continue;
      for (let i = 0; i < c.n; i++) {
        const x = c.x + (i - c.n / 2) * 7 + Math.sin(i * 2.1) * 3, y = c.y + Math.cos(i * 1.7) * 3 + (c.bob > 0.05 ? Math.round(Math.sin(t * 38 + i) * 1.5 * c.bob) : 0);
        r.draw(F.harv[(i + Math.floor(t * 1.5)) % 2], Math.round(x), Math.round(y) + 6, 1, -1, 0, WHITE);
      }
    }
    for (const c of this.centi) {
      if (c.gone > 0) continue;
      const y = floorOf(c.tier, c.x);
      if (!vis(c.x, y)) continue;
      r.draw(F.centi[Math.abs(c.vx) > 1 ? Math.floor(t * 14) % 2 : 0], Math.round(c.x), y, c.face, 1, 0, WHITE);
    }
    for (const m of this.moths) {
      if (!vis(m.x, m.y)) continue;
      r.draw(F.moth[Math.floor(t * 18 + m.ph * 3) % 3], Math.round(m.x), Math.round(m.y), 1, 1, 0, WHITE);
    }
    const sc = packColor(0.82, 0.86, 0.9, 1);
    for (const s of this.springs) { if (vis(s.x, s.top)) r.rect(Math.round(s.x), Math.round(s.y) - 1, 1, 1, sc); }
    for (const b of this.bats) {
      if (!vis(b.x, b.y)) continue;
      if (b.fly > 0) r.draw(F.batFly[Math.floor(t * 12) % 2], Math.round(b.x), Math.round(b.y), 1, 1, 0, WHITE);
      else r.draw(F.batHang, Math.round(b.hx), Math.round(b.hy), 1, 1, 0, WHITE);
    }
  }
}
void TIERS;

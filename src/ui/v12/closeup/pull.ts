// V12 pull close-up: down at ground level by a flax bush (or whatever plant it is), the soil cut away
// so the roots show. Grab the base (press on it, or hold Space), then pull up (drag up, or hold W):
// the roots let go one by one while the pull is firm. Yank too hard and the leaves strain white, the
// soil heaves, the fibres creak, and it snaps. Wiggling side to side (drag left-right, or A / D)
// loosens the roots so a gentler pull will do. The pocket watch shows how long Mori can keep at it.

import { PAL } from '../../../art/palettes';
import { paintRock, paintGrassTuft } from '../../../art/flora';
import { ITEMS } from '../../../game/items';
import { runCloseup } from './stage';
import type { Closeup, SetScene, CloseupResult } from './stage';
import { PixelBuffer, hex, rd, ramp, dith, hash, vnoise, clamp, clamp01, lerp, blit, itemSprite, shadowOval, pmap, up, area, line, dot, Z } from './kit';
import { drawHand } from './hands';

export interface PullOpts { item?: string; flax?: boolean; difficulty?: number; world?: [number, number] }

const SKY = ramp('#5a86b0', '#78a2c8', '#9abcd8', '#c0d6e4', '#e2ecec');
const SOIL = ramp('#1a100a', '#2a1a10', '#3c2818', '#523822', '#6a4a2e', '#80603c');
const LEAF = ramp('#0e2410', '#1a3a18', '#2a5422', '#3e6e2a', '#5a8a34', '#80a844', '#b0c862');
const ROOT = ramp('#3a2a18', '#6a5032', '#9a7a52', '#c8a878', '#e8d0a0');
const WORM = pmap([
  '.oo......',
  'oppo.....',
  'opppoooo.',
  '.oppppppo',
  '..ooooppo',
  '......oo.',
], { o: '#4a1a1a', p: '#d07a7a' });

interface Root { pts: [number, number][]; thr: number; snapped: boolean }
interface Blade { a: number; len: number; w: number; curl: number; seed: number }

export class PullSet implements SetScene {
  intro = { text: 'PULL IT UP!', style: 'shout' as const };
  canAbort = true;
  bg!: PixelBuffer;
  gy = 104; bx = 160;
  roots: Root[] = [];
  blades: Blade[] = [];
  plant: PixelBuffer | null = null;
  // the pull
  grip = false; gy0 = 0; T = 0; strain = 0; maxStrain = 0; P = 0; loose = 0; lastDir = 0; t = 0; limit = 14;
  out = -1; snapped = false; creakT = 0; heave = 0;
  hx = 0; hy = 0;
  constructor(readonly o: PullOpts) {
    this.limit = 15 - (o.difficulty ?? 0.4) * 5;

  }

  layout(c: Closeup) {
    const W = c.W, H = c.H;
    if (!this.o.flax && this.o.item) this.plant = itemSprite(this.o.item, 54);
    this.gy = Math.round(H * 0.58); this.bx = Math.round(W * 0.5);
    if (!this.roots.length) {
      // the roots: a fibrous mat, a few long anchor roots each letting go at its own pull
      for (let i = 0; i < 9; i++) {
        const ang = Math.PI * (0.15 + 0.7 * (i / 8)) + (hash(i, 1, 2) - 0.5) * 0.2;
        const len = 26 + hash(i, 2, 2) * 34;
        const pts: [number, number][] = [];
        let x = 0, y = 0, a = ang;
        for (let k = 0; k < len; k += 2) { a += (hash(i, k, 3) - 0.5) * 0.5; x += Math.cos(a) * 2; y += Math.sin(a) * 2 * 0.8; pts.push([x, y]); }
        this.roots.push({ pts, thr: (i + 1) / 10 + (hash(i, 4, 2) - 0.5) * 0.06, snapped: false });
      }
      this.roots.sort((a, b) => a.thr - b.thr);
      for (let i = 0; i < 11; i++) this.blades.push({ a: -Math.PI / 2 + (i - 5) * 0.16 + (hash(i, 1, 9) - 0.5) * 0.1, len: 50 + hash(i, 2, 9) * 30 - Math.abs(i - 5) * 3, w: 6.5 + (i % 3 === 0 ? 1.5 : 0), curl: (i - 5) * 0.01 + (hash(i, 3, 9) - 0.5) * 0.01, seed: i });
    }
    this.hx = this.bx; this.hy = this.gy - 16;
    this.paintBg(W, H);
  }
  private paintBg(W: number, H: number) {
    const bg = new PixelBuffer(W * Z, H * Z);
    this.bg = bg;
    const gy = this.gy;
    area(bg, 0, 0, W, H, (u, v, x, y) => {
      if (v < gy - 40) {
        // sky, banded and dithered, a few soft cloud rows
        const cl = vnoise(u * 0.03, v * 0.12, 1) + vnoise(u * 0.08, v * 0.2, 2) * 0.5;
        return rd(SKY, 0.92 - v / (gy - 40) * 0.7 + (cl > 1.05 && v < 34 ? (cl - 1.05) * 1.4 : 0), x, y);
      }
      if (v < gy) {
        // the wetland behind: the far bush line, reeds, a glint of water
        const far = v < gy - 26 + Math.sin(u * 0.05) * 6 + Math.sin(u * 0.17) * 2 + vnoise(u * 0.3, 0, 3) * 3;
        if (far) return rd(PAL.leafOlive, 0.22 + (v - gy + 40) / 40 * 0.22 + vnoise(u * 0.5, v * 0.5, 3) * 0.16, x, y);
        if (v > gy - 9 && v < gy - 6 + vnoise(u * 0.1, 1, 9) * 2 && vnoise(u * 0.06, 2, 8) > 0.55) return rd(PAL.water, 0.5 + (Math.sin(u * 1.3 + v * 2) > 0.85 ? 0.35 : 0), x, y);
        const reed = Math.sin(u * 1.3 + vnoise(u * 0.2, v * 0.1, 4) * 3);
        return rd(PAL.moss, 0.32 + vnoise(u * 0.9, v * 0.4, 4) * 0.25 + (reed > 0.5 ? 0.22 : 0), x, y);
      }
      // the cut-away soil: dark bands, a stony layer, pale specks and fibres
      const band = Math.sin(v * 0.35 + Math.sin(u * 0.04) * 1.5);
      let k = 0.55 - (v - gy) / (H - gy) * 0.35 + band * 0.06 + (vnoise(u * 0.7, v * 0.7, 5) - 0.5) * 0.24;
      if (v < gy + 3) k = 0.7 - (v - gy) * 0.1;
      if (hash(Math.floor(u * 1.5), Math.floor(v * 1.5), 8) < 0.025) k += 0.3;
      return rd(SOIL, k, x, y);
    });
    // the grass lip along the cut, and stones in the soil
    for (let x = 0; x < W; x += 9) { const g = paintGrassTuft(30 + x, (10 + (x % 5)) * Z, PAL.moss, 9).buf; blit(bg, g, x - 4, gy - g.h / Z + 2); }
    for (let i = 0; i < 9; i++) { const w = 8 + (i % 4) * 3, h = 6 + (i % 3) * 2; blit(bg, paintRock(200 + i, w * Z, h * Z, PAL.stoneWarm, 0).buf, hash(i, 1, 6) * W, gy + 12 + hash(i, 2, 6) * (H - gy - 18)); }
    // the cut edge of the soil (a dark line with crumbs)
    area(bg, 0, gy + 0.6, W, gy + 2.2, (_u, v, x) => (v < gy + 1.4 ? SOIL[1] : hash(x >> 1, 0, 1) < 0.3 ? SOIL[4] : -1));
  }

  update(c: Closeup, dt: number) {
    this.t += dt;
    if (this.out >= 0) { this.out += dt; if (this.out > 1.2) this.end(c); return; }
    if (this.snapped) return;
    const base: [number, number] = [this.bx, this.gy - 14 - this.P * 14];
    const near = Math.abs(c.ptr.x - base[0]) < 36 && c.ptr.y > base[1] - 46 && c.ptr.y < this.gy + 20;
    const keyGrip = c.key('Space') || c.key('KeyE');
    // grabbing
    if (!this.grip && ((c.ptr.pressed && near) || keyGrip)) { this.grip = true; this.gy0 = c.ptr.y; c.sfx('rustle', { vol: 0.3, pitch: 0.8 }); }
    if (this.grip && !c.ptr.down && !keyGrip) { this.grip = false; c.sfx('rustle', { vol: 0.15, pitch: 1.2 }); }
    // the pull: how far up the pointer has gone since the grab (or W held)
    let want = 0;
    if (this.grip) {
      if (keyGrip && !c.ptr.down) { const up = c.key('KeyW') || c.key('ArrowUp'); want = clamp01(this.T + (up ? 0.85 : -1.4) * dt); }
      else want = clamp((this.gy0 - c.ptr.y) / 46, 0, 1.25);
      // wiggling loosens it
      const dir = c.ptr.down ? Math.sign(Math.round(c.ptr.vx / 40)) : (c.key('KeyA') || c.key('ArrowLeft') ? -1 : c.key('KeyD') || c.key('ArrowRight') ? 1 : 0);
      if (dir && dir !== this.lastDir) { this.loose = Math.min(1, this.loose + 0.07); this.lastDir = dir; c.sfx('rustle', { vol: 0.12, pitch: 1.5 }); c.parts.burst('crumb', this.bx - this.cam(), this.gy, 3, 25, { c: SOIL[4], g: 200, life: 0.4 }); }
    }
    this.T = lerp(this.T, want, 1 - Math.exp(-dt * 10));
    // strain: past the safe pull it builds fast, and it eases off when the pull does
    const safe = 0.82;
    if (this.T > safe) this.strain += (this.T - safe) * dt * 7; else this.strain = Math.max(0, this.strain - dt * 0.35);
    this.maxStrain = Math.max(this.maxStrain, this.strain);
    this.heave = lerp(this.heave, this.grip ? this.T : 0, dt * 8);
    if (this.T > 0.6) {
      this.creakT -= dt;
      if (this.creakT <= 0) { this.creakT = 0.35 - this.T * 0.2; c.sfx('rope', { vol: 0.1 + this.strain * 0.3, pitch: 0.7 + this.T * 0.6 + this.strain * 0.5 }); }
    }
    if (this.strain > 0.55) { c.say('EASY! It’ll tear!', this.bx, 24, { style: 'scared', ms: 700, color: '#ffb0a0' }); c.shake(1, 0.1); }
    if (this.strain >= 1) { this.snap(c); return; }
    // the roots give: only while the pull is firm, quicker once it's loosened
    const lo = 0.38 - this.loose * 0.16;
    if (this.grip && this.T > lo) {
      this.P += dt * (this.T - lo + 0.12) * (0.4 + this.loose * 0.45);
      for (const r of this.roots) if (!r.snapped && this.P >= r.thr) {
        r.snapped = true;
        c.sfx('pluck', { vol: 0.3, pitch: 0.7 + Math.random() * 0.4 });
        const e = r.pts[r.pts.length - 1];
        c.parts.burst('crumb', this.bx + e[0] - this.cam(), this.gy + 4 + e[1], 5, 30, { c: [SOIL[4], ROOT[3]], g: 160, life: 0.5 });
      }
    }
    c.watch = { t01: 1 - this.t / this.limit, x: c.W - 24, y: 26, size: 28, secs: Math.round(this.limit) };
    if (this.P >= 1) {
      this.out = 0; this.grip = false;
      c.sfx('rustleBush', { vol: 0.45 }); c.sfx('collectPop', { vol: 0.5 });
      c.shake(2, 0.2);
      c.parts.burst('crumb', this.bx, this.gy, 26, 90, { c: [SOIL[3], SOIL[4], SOIL[5]], g: 300, life: 0.9, s: 2 });
      c.say('Out it comes!', this.bx, 24, { style: 'happy', ms: 1200 });
    } else if (this.t >= this.limit) c.finish(this.P > 0.75 ? 'rough' : 'fail', this.P * 0.5, { word: this.P > 0.75 ? undefined : 'TOO TIRED' });
    // the hand follows the grip point
    const tx = this.grip ? this.bx + Math.round(clamp(c.ptr.x - this.bx, -6, 6)) : clamp(c.ptr.x, 20, c.W - 20);
    const ty = this.grip ? this.gy - 16 - this.P * 14 - this.T * 9 : Math.min(this.gy - 10, c.ptr.y);
    this.hx = lerp(this.hx, tx, 1 - Math.exp(-dt * 16)); this.hy = lerp(this.hy, ty, 1 - Math.exp(-dt * 16));
  }
  private cam() { return 0; }
  private snap(c: Closeup) {
    this.snapped = true; this.grip = false;
    c.sfx('wrong', { vol: 0.4 }); c.sfx('rustleBush', { vol: 0.5, pitch: 1.4 });
    c.shake(4, 0.3);
    c.parts.burst('leaf', this.bx, this.gy - 20, 18, 120, { c: [LEAF[4], LEAF[5], LEAF[3]], g: 200, life: 1, s: 2 });
    c.finish('fail', this.P * 0.3, { word: this.o.flax ? 'SNAPPED' : 'TORN' });
  }
  private end(c: Closeup) {
    const quick = this.t < this.limit * 0.6;
    const grade = this.maxStrain < 0.25 && quick ? 'perfect' : this.maxStrain < 0.6 ? 'good' : 'rough';
    c.finish(grade, clamp01(1 - this.maxStrain * 0.5 - (quick ? 0 : 0.1)));
  }
  trophy() {
    const b = new PixelBuffer(70 * Z, 60 * Z);
    this.drawPlant(b, 35, 40, 0, true);
    const name = this.o.item ? ITEMS[this.o.item]?.name ?? 'Flax' : 'Flax';
    return { img: b, name: name.length > 18 ? name.slice(0, 17) + '.' : name, sub: this.maxStrain < 0.25 ? 'ROOTS AND ALL' : 'A BIT FRAYED' };
  }

  draw(c: Closeup, px: PixelBuffer) {
    px.data.set(this.bg.data.subarray(0, px.data.length));
    const t = this.t;
    const lift = this.out >= 0 ? Math.min(30, this.out * 60) : 0;
    const rise = this.P * 14 + lift;
    // the soil heaves round the base as it's pulled, cracks radiating out
    const hv = this.heave;
    area(px, this.bx - 30, this.gy - 8, this.bx + 30, this.gy + 1, (u, v, x, y) => {
      const k = 1 - Math.abs(u - this.bx) / 30;
      const top = this.gy - (k * k * hv * 5 + (this.P > 0.3 ? k * this.P * 3 : 0));
      if (v < top) return -1;
      if (v < top + 0.6) return SOIL[5];
      if (hv > 0.5 && k > 0.2 && Math.abs(Math.sin(u * 1.7) * 2 + (v - top) - 1) < 0.4) return SOIL[0];
      return rd(SOIL, 0.62 + (v - top) * 0.05, x, y);
    });
    // the worm minding its own business, until the roots tear past it
    const wx = this.bx + 44 + (this.P > 0.4 ? (this.P - 0.4) * 60 : Math.sin(t) * 2), wy = this.gy + 30;
    blit(px, up(WORM, Z), wx, wy, { fx: this.P > 0.4 });
    // the roots under the soil: tapering, pale tips, the strained ones going white
    for (const r of this.roots) {
      const n = r.pts.length;
      const keep = r.snapped ? Math.floor(n * 0.45) : n;
      const strained = !r.snapped && this.grip && this.T > 0.5;
      let px0 = this.bx, py0 = this.gy + 4 - rise;
      for (let i = 0; i < keep; i++) {
        const [x, y] = r.pts[i];
        const X = this.bx + x, Y = this.gy + 4 + y - rise * (1 - i / n);
        const w = Math.max(1, Math.round(Z * (1.3 - i / n)));
        line(px, px0, py0, X, Y, (_tt, fx, fy, sd) => (strained && i > n * 0.6 ? ROOT[4] : rd(ROOT, 0.6 - i / n * 0.3 - sd * 0.2, fx, fy)), w);
        px0 = X; py0 = Y;
      }
      // a torn end left behind in the ground
      if (r.snapped) for (let i = keep; i < n; i++) { const [x, y] = r.pts[i]; if (i % 2) dot(px, this.bx + x, this.gy + 4 + y, SOIL[1]); }
    }
    this.drawPlant(px, this.bx, this.gy, rise, false);
    // the hand
    if (this.out < 0 && !this.snapped) {
      if (this.grip) drawHand(px, 'grip', this.hx, this.hy, { rot: 3, from: [this.hx + 70, -30] });
      else drawHand(px, 'open', this.hx, this.hy - 8, { from: [this.hx + 60, -40], rot: 2 });
    } else if (this.out >= 0) drawHand(px, 'grip', this.bx, this.gy - 16 - rise, { rot: 3, from: [this.bx + 70, -30] });
    if (this.out < 0 && !this.snapped) {
      if (!this.grip) c.prompt(px, this.P > 0 ? 'GRAB IT AGAIN' : 'GRAB THE BASE', this.bx, this.gy - 86, 'SPACE');
      else if (this.t < 8 && this.P < 0.3) c.prompt(px, c.touch ? 'DRAG UP, WIGGLE' : 'PULL UP, WIGGLE', this.bx, this.gy - 86, c.touch ? 'mouse' : 'W');
      // the strain shows as pale fibre lines on the leaves by the grip
      if (this.T > 0.7) for (let i = 0; i < 8; i++) { const y = this.gy - 20 - rise - i * 2.2 - this.T * 9; if (dith(i, Math.floor(t * 20)) < this.strain + 0.3) line(px, this.bx - 3 + (i % 3) * 2.5, y, this.bx - 3 + (i % 3) * 2.5, y + 1.4, hex('#f4f4d8'), 1); }
    }
  }
  /** the plant with its base at (x, y) raised by `rise` (units) */
  private drawPlant(px: PixelBuffer, x: number, y: number, rise: number, trophy: boolean) {
    const by = y - rise;
    const trophyRoots = () => { for (const r of this.roots) { let a = x, b = by + 2; for (let i = 0; i < r.pts.length * 0.5; i++) { const nx = x + r.pts[i][0] * 0.5, ny = by + 2 + r.pts[i][1] * 0.5; line(px, a, b, nx, ny, ROOT[3], 1); a = nx; b = ny; } } };
    if (this.plant) {
      const sp = this.plant, w = sp.w / Z, h = sp.h / Z;
      shadowOval(px, x, y, w * 0.4, 3, 0.6);
      blit(px, sp, x - w / 2, by - h + 6);
      if (trophy) trophyRoots();
      return;
    }
    // harakeke: a fan of strap leaves, each folded along its keel, with the orange edge flax has
    const pinch = this.grip ? this.T * 0.45 : 0;
    const order = this.blades.map(b => b).sort((p, q) => Math.abs(q.a + Math.PI / 2) - Math.abs(p.a + Math.PI / 2));
    const step = 1 / Z;
    for (const b of order) {
      let a = b.a + (b.a + Math.PI / 2) * -pinch;
      let cx = x, cy = by;
      const back = Math.abs(b.a + Math.PI / 2) > 0.5;
      for (let s = 0; s < b.len; s += step) {
        a += b.curl * (1 + s * 0.03) * (1 - pinch) * step;
        cx += Math.cos(a) * step; cy += Math.sin(a) * step;
        const w = Math.max(0.6, b.w * (1 - s / b.len * 0.75));
        const nx = -Math.sin(a), ny = Math.cos(a);
        for (let k = -w / 2; k <= w / 2; k += step) {
          const X = Math.round((cx + nx * k) * Z), Y = Math.round((cy + ny * k) * Z);
          // a split, frayed tip
          if (s > b.len - 4 && Math.abs(k) < 0.4) continue;
          const keel = Math.abs(k) < step * 1.2;
          let v = 0.55 + k / w * 0.35 - (back ? 0.2 : 0) + (keel ? 0.22 : 0) + (vnoise(s * 0.3, b.seed, 6) - 0.5) * 0.12;
          if (s < 10 && this.grip && this.T > 0.7) v += (this.T - 0.7) * 1.2;
          let col = rd(LEAF, v, X, Y);
          if (k > w / 2 - step * 1.5 && s > 4 && s < b.len - 3) col = hex(back ? '#7a3418' : '#c8582e');
          px.set(X, Y, col);
        }
      }
    }
    // the base: the leaves fanned out of the ground, darker
    area(px, x - 5.5, by - 6, x + 5.5, by + 0.5, (u, v, X, Y) => (Math.abs(u - x) > 5 - (by - v) / 2 ? -1 : rd(LEAF, 0.22 + (u - x + 5) / 22 + (Math.sin(u * 3) > 0.7 ? 0.1 : 0), X, Y)));
    if (trophy) trophyRoots();
  }
}

/** pull a plant up; resolves with ok / score / perfect */
export function runPull(o: PullOpts): Promise<CloseupResult> { return runCloseup(new PullSet(o), { world: o.world }); }

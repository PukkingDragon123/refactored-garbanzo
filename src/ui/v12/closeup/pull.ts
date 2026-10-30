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
import { PixelBuffer, hex, mix, rd, ramp, dith, hash, clamp, clamp01, lerp, blit, itemSprite, shadowOval, pmap } from './kit';
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
    if (!o.flax && o.item) this.plant = itemSprite(o.item, 24);
  }

  layout(c: Closeup) {
    const W = c.W, H = c.H;
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
      for (let i = 0; i < 11; i++) this.blades.push({ a: -Math.PI / 2 + (i - 5) * 0.16 + (hash(i, 1, 9) - 0.5) * 0.1, len: 50 + hash(i, 2, 9) * 30 - Math.abs(i - 5) * 3, w: 4 + (i % 3 === 0 ? 1 : 0), curl: (i - 5) * 0.012 + (hash(i, 3, 9) - 0.5) * 0.01, seed: i });
    }
    this.hx = this.bx; this.hy = this.gy - 16;
    this.paintBg(W, H);
  }
  private paintBg(W: number, H: number) {
    const bg = new PixelBuffer(W, H);
    this.bg = bg;
    const gy = this.gy;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let col: number;
      if (y < gy - 40) {
        // sky, banded and dithered, a few cloud rows
        const cl = Math.sin(x * 0.03 + y * 0.2) + Math.sin(x * 0.011 - y * 0.05);
        col = rd(SKY, 0.9 - y / (gy - 40) * 0.7 + (cl > 1.3 && y < 30 ? 0.3 : 0), x, y);
      } else if (y < gy) {
        // the wetland behind: far bush, reeds, a glint of water
        const far = y < gy - 26 + Math.sin(x * 0.05) * 6 + Math.sin(x * 0.17) * 2;
        col = far ? rd(PAL.leafOlive, 0.25 + (y - gy + 40) / 40 * 0.2 + hash(x >> 1, y >> 1, 3) * 0.1, x, y)
          : y > gy - 10 && Math.sin(x * 0.2) > 0.6 ? rd(PAL.water, 0.6, x, y) : rd(PAL.moss, 0.35 + hash(x, y, 4) * 0.25 + (Math.sin(x * 1.3) > 0.5 ? 0.2 : 0), x, y);
      } else {
        // the cut-away soil: dark bands, a stony layer, lighter specks
        const band = Math.sin(y * 0.35 + Math.sin(x * 0.04) * 1.5);
        let k = 0.55 - (y - gy) / (H - gy) * 0.35 + band * 0.06 + (hash(x, y, 5) - 0.5) * 0.18;
        if (y < gy + 3) k = 0.7 - (y - gy) * 0.1;
        col = rd(SOIL, k, x, y);
        if (hash(x >> 1, y >> 1, 8) < 0.025) col = SOIL[5];
      }
      bg.set(x, y, col);
    }
    // the grass lip along the cut, and stones in the soil
    for (let x = 0; x < W; x += 9) { const g = paintGrassTuft(30 + x, 10 + (x % 5), PAL.moss, 6).buf; blit(bg, g, x - 4, gy - g.h + 2); }
    for (let i = 0; i < 9; i++) { const r = paintRock(200 + i, 8 + (i % 4) * 3, 6 + (i % 3) * 2, PAL.stoneWarm, 0).buf; blit(bg, r, Math.round(hash(i, 1, 6) * W), Math.round(gy + 12 + hash(i, 2, 6) * (H - gy - 18))); }
    // the cut edge of the soil (a dark line with crumbs)
    for (let x = 0; x < W; x++) { bg.set(x, gy + 1, SOIL[1]); if (hash(x, 0, 1) < 0.3) bg.set(x, gy + 2, SOIL[4]); }
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
    const b = new PixelBuffer(70, 60);
    this.drawPlant(b, 35, 40, 0, true);
    const name = this.o.item ? ITEMS[this.o.item]?.name ?? 'Flax' : 'Flax';
    return { img: b, name: name.length > 18 ? name.slice(0, 17) + '.' : name, sub: this.maxStrain < 0.25 ? 'ROOTS AND ALL' : 'A BIT FRAYED' };
  }

  draw(c: Closeup, px: PixelBuffer) {
    px.data.set(this.bg.data.subarray(0, px.data.length));
    const t = this.t;
    const lift = this.out >= 0 ? Math.min(30, this.out * 60) : 0;
    const rise = this.P * 14 + lift;
    // the soil heaves round the base as it's pulled (cracks radiate out)
    const hv = this.heave;
    for (let x = this.bx - 30; x <= this.bx + 30; x++) {
      const k = 1 - Math.abs(x - this.bx) / 30;
      const up = Math.round(k * k * hv * 5 + (this.P > 0.3 ? k * this.P * 3 : 0));
      for (let j = 0; j < up; j++) px.set(x, this.gy - j, rd(SOIL, 0.6 + j * 0.1, x, this.gy - j));
      if (hv > 0.5 && k > 0.2 && hash(x, 1, 3) < hv * 0.35) px.set(x, this.gy - up + 1, SOIL[0]);
    }
    // the worm minding its own business, until the roots tear past it
    const wx = Math.round(this.bx + 44 + (this.P > 0.4 ? (this.P - 0.4) * 60 : Math.sin(t) * 2)), wy = this.gy + 30;
    blit(px, WORM, wx, wy, { fx: this.P > 0.4 });
    // the roots under the soil
    for (const r of this.roots) {
      const n = r.pts.length;
      const keep = r.snapped ? Math.floor(n * 0.45) : n;
      for (let i = 0; i < n; i++) {
        const [x, y] = r.pts[i];
        const attached = i < keep;
        const X = Math.round(this.bx + x * (attached ? 1 : 1)), Y = Math.round(this.gy + 4 + y - (attached ? rise : 0) * (1 - i / n) - (r.snapped ? 0 : 0));
        if (!attached) { if (dith(X, Y) < 0.6) px.set(X, Y + rise * 0, SOIL[1]); continue; }
        const strained = !r.snapped && this.grip && this.T > 0.5;
        px.set(X, Y, strained && i > n * 0.6 ? ROOT[4] : rd(ROOT, 0.55 - i / n * 0.3, X, Y));
        if (i < n * 0.3) px.set(X + 1, Y, ROOT[1]);
      }
    }
    this.drawPlant(px, this.bx, this.gy, rise, false);
    // the hand
    if (this.out < 0 && !this.snapped) {
      const hx = Math.round(this.hx), hy = Math.round(this.hy);
      if (this.grip) drawHand(px, 'grip', hx, hy, { rot: 3, from: [hx + 70, -30] });
      else drawHand(px, 'open', hx, hy - 8, { from: [hx + 60, -40], rot: 2 });
    } else if (this.out >= 0) drawHand(px, 'grip', this.bx, Math.round(this.gy - 16 - rise), { rot: 3, from: [this.bx + 70, -30] });
    // the pull, read off the plant itself: a little spring balance hooked on as a gauge would be a
    // panel, so the cues are the bending leaves, the heaving soil and the strain lines; and a hint
    if (this.out < 0 && !this.snapped) {
      if (!this.grip) c.prompt(px, this.P > 0 ? 'GRAB IT AGAIN' : 'GRAB THE BASE', this.bx, this.gy - 86, 'SPACE');
      else if (this.t < 8 && this.P < 0.3) c.prompt(px, c.touch ? 'DRAG UP, WIGGLE' : 'PULL UP, WIGGLE', this.bx, this.gy - 86, c.touch ? 'mouse' : 'W');
      // the strain shows as pale fibre lines on the leaves near the grip
      if (this.T > 0.7) for (let i = 0; i < 6; i++) { const y = Math.round(this.gy - 20 - rise - i * 3 - this.T * 9); if (dith(i, Math.floor(t * 20)) < this.strain + 0.3) px.set(this.bx - 2 + (i % 3) * 2, y, hex('#f0f0d0')); }
    }
  }
  /** the plant with its base at (x, y) raised by `rise` */
  private drawPlant(px: PixelBuffer, x: number, y: number, rise: number, trophy: boolean) {
    const by = y - rise;
    if (this.plant) {
      const sp = this.plant, k = 3;
      shadowOval(px, x, y, sp.w * 1.2, 3, 0.6);
      blit(px, sp, x - Math.round(sp.w * k / 2), Math.round(by - sp.h * k + 6), { k });
      if (trophy) for (const r of this.roots) for (let i = 0; i < r.pts.length * 0.5; i++) px.set(Math.round(x + r.pts[i][0] * 0.5), Math.round(by + 2 + r.pts[i][1] * 0.5), ROOT[3]);
      return;
    }
    // harakeke: a fan of strap leaves, each folded along its keel with the orange edge flax has
    const pinch = this.grip ? this.T * 0.45 : 0;
    const order = this.blades.map((b, i) => ({ b, i })).sort((p, q) => Math.abs(q.b.a + Math.PI / 2) - Math.abs(p.b.a + Math.PI / 2));
    for (const { b } of order) {
      let a = b.a + (b.a + Math.PI / 2) * -pinch;
      let cx = x, cy = by;
      const back = Math.abs(b.a + Math.PI / 2) > 0.5;
      for (let s = 0; s < b.len; s++) {
        a += b.curl * (1 + s * 0.03) * (1 - pinch);
        cx += Math.cos(a); cy += Math.sin(a);
        const w = Math.max(1, Math.round(b.w * (1 - s / b.len * 0.75)));
        const nx = -Math.sin(a), ny = Math.cos(a);
        for (let k = -w / 2; k <= w / 2; k++) {
          const X = Math.round(cx + nx * k), Y = Math.round(cy + ny * k);
          const edge = k >= w / 2 - 0.5;
          const keel = Math.abs(k) < 0.6;
          let v = 0.55 + k / w * 0.3 - (back ? 0.2 : 0) + (keel ? 0.2 : 0);
          if (s < 10 && this.grip && this.T > 0.7) v += (this.T - 0.7) * 1.2;
          let col = rd(LEAF, v, X, Y);
          if (edge && s > 4 && s < b.len - 3) col = hex(back ? '#7a3418' : '#c8582e');
          // a split, frayed tip
          if (s > b.len - 4 && (Math.round(k) === 0)) continue;
          px.set(X, Y, col);
        }
      }
    }
    // the base: the leaves fanned out of the ground, darker
    for (let j = 0; j < 6; j++) for (let i = -5 + j / 2; i <= 5 - j / 2; i++) px.set(Math.round(x + i), Math.round(by - j), rd(LEAF, 0.25 + (i + 5) / 20, x + i, by - j));
    if (trophy) for (const r of this.roots) for (let i = 0; i < r.pts.length * 0.5; i++) px.set(Math.round(x + r.pts[i][0] * 0.5), Math.round(by + 2 + r.pts[i][1] * 0.5), ROOT[3]);
    void mix;
  }
}

/** pull a plant up; resolves with ok / score / perfect */
export function runPull(o: PullOpts): Promise<CloseupResult> { return runCloseup(new PullSet(o), { world: o.world }); }

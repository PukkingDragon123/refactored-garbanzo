// V12 catch close-up: looking down at the ground (leaf litter, a mossy bank or a rock pool), where a
// beetle, a frog or a crab goes about its business. Mori's cupped hand hovers over it: its shadow is
// where it will land. Move slowly; a hand swooping about or a shadow sliding over it puts the critter
// on edge, and on edge it darts off (a frog hops, a crab scuttles sideways). Cup it (tap / click /
// Space) when the shadow is right over it. Three tries before it's gone for good.

import { PAL } from '../../../art/palettes';
import { paintRock, paintGroundFern } from '../../../art/flora';
import { ITEMS } from '../../../game/items';
import { runCloseup } from './stage';
import type { Closeup, SetScene, CloseupResult } from './stage';
import { PixelBuffer, hex, mix, rd, ramp, dith, hash, clamp, clamp01, lerp, blit, shadowOval, pmap } from './kit';
import { drawHand } from './hands';
import { BEETLE, BEETLE_PAL, FROG, FROG_PAL, CRAB, CRAB_PAL } from './sprites';

export type Critter = 'beetle' | 'frog' | 'crab';
export interface CatchOpts { critter: Critter; item?: string; difficulty?: number; world?: [number, number] }

const LITTER = [ramp('#3a1a0a', '#6a3414', '#9a5422', '#c47a34'), ramp('#2a2a0a', '#5a5414', '#8a7a24', '#b8a040'), ramp('#1a2a10', '#2e4a1a', '#4a6a24', '#6a8a34')];

export function critterFor(item?: string, itemKind?: string): Critter {
  const id = (item ?? '').toLowerCase();
  if (/crab|shell|pipi|mussel|whelk/.test(id) || itemKind === 'shell') return 'crab';
  if (/frog|newt|lizard|skink|gecko/.test(id) || itemKind === 'animal') return 'frog';
  return 'beetle';
}

export class CatchSet implements SetScene {
  intro = { text: 'SHHH... CATCH IT!', style: 'whisper' as const };
  canAbort = true;
  bg!: PixelBuffer;
  frames: PixelBuffer[];
  // the critter
  cx = 160; cy = 100; dirX = 1; dirY = 0; face = 0; state: 'idle' | 'walk' | 'dart' | 'hop' | 'caught' = 'idle'; st = 1; alert = 0; vx = 0; vy = 0; hopH = 0; legT = 0;
  // the hand: its shadow (target) and how high it is
  sx = 160; sy = 110; psx = 160; psy = 110; drop = 0; cupping = false; tries = 0; maxAlert = 0;
  t = 0; limit = 16; done = -1;
  constructor(readonly o: CatchOpts) {
    const sets = { beetle: [BEETLE, BEETLE_PAL], frog: [FROG, FROG_PAL], crab: [CRAB, CRAB_PAL] } as const;
    const [fr, pal] = sets[o.critter];
    this.frames = fr.map(rows => { const b = pmap(rows as unknown as string[], pal as unknown as Record<string, string>); return b; });
    this.limit = 18 - (o.difficulty ?? 0.5) * 5;
  }

  layout(c: Closeup) {
    const W = c.W, H = c.H;
    if (this.t === 0) { this.cx = W * 0.6; this.cy = H * 0.55; this.sx = this.psx = W * 0.3; this.sy = this.psy = H * 0.7; c.ptr.x = this.sx; c.ptr.y = this.sy; }
    this.paintBg(W, H);
  }
  private paintBg(W: number, H: number) {
    const bg = new PixelBuffer(W, H);
    this.bg = bg;
    const k = this.o.critter;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let col: number;
      // dappled light through the canopy, quantised into soft dithered pools
      const dapple = Math.sin(x * 0.045 + Math.sin(y * 0.06) * 2) * Math.sin(y * 0.05 - x * 0.02) * 0.5 + 0.5;
      if (k === 'crab') {
        const rip = Math.sin(y * 0.55 + Math.sin(x * 0.06) * 2.2);
        col = rd(PAL.sand, 0.45 + (rip > 0.6 ? 0.18 : rip < -0.7 ? -0.12 : 0) + (hash(x >> 1, y >> 1, 2) - 0.5) * 0.12, x, y);
        // the pool along the top: water over sand
        const shore = 34 + Math.sin(x * 0.05) * 8 + Math.sin(x * 0.13) * 3;
        if (y < shore) col = rd(PAL.water, 0.55 + (shore - y) / 80 + (Math.sin(x * 0.3 + y * 0.8) > 0.8 ? 0.25 : 0), x, y);
        else if (y < shore + 2) col = hex('#f0f0e0');
      } else if (k === 'frog') {
        col = rd(PAL.moss, 0.3 + dapple * 0.4 + (hash(x, y, 3) - 0.5) * 0.25, x, y);
        if (hash(x, y, 6) < 0.006) col = hex('#e8f4ff');
      } else {
        col = rd(PAL.soil, 0.35 + dapple * 0.35 + (hash(x, y, 3) - 0.5) * 0.2, x, y);
      }
      bg.set(x, y, col);
    }
    if (k === 'beetle' || k === 'frog') {
      // fallen leaves (each placed by hand-ish rules: a pointed outline, a midrib, a bite or two)
      const n = k === 'beetle' ? 70 : 22;
      for (let i = 0; i < n; i++) {
        const lx = hash(i, 1, 4) * W, ly = hash(i, 2, 4) * H, a = hash(i, 3, 4) * Math.PI, len = 7 + hash(i, 4, 4) * 9;
        const R = LITTER[k === 'frog' ? 2 : Math.floor(hash(i, 5, 4) * 3)];
        const ca = Math.cos(a), sa = Math.sin(a);
        for (let v = -len; v <= len; v++) {
          const half = Math.sin((v + len) / (2 * len) * Math.PI) * len * 0.42;
          for (let u = -half; u <= half; u++) {
            const X = Math.round(lx + ca * v - sa * u), Y = Math.round(ly + sa * v + ca * u);
            if (hash(i, Math.round(v), 9) < 0.06 && Math.abs(u) > half - 2) continue;
            const rib = Math.abs(u) < 0.6;
            bg.set(X, Y, rib ? R[3] : rd(R, 0.35 + u / (half + 1) * 0.3 + (v / len) * 0.1, X, Y));
          }
        }
      }
    }
    // stones / ferns round the edge
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2, x = Math.round(W / 2 + Math.cos(a) * (W / 2 - 10)), y = Math.round(H / 2 + Math.sin(a) * (H / 2 - 8));
      if (k === 'frog' && i % 2) { const f = paintGroundFern(70 + i, 14, PAL.fern).buf; blit(bg, f, x - f.w / 2, y - f.h / 2); }
      else { const r = paintRock(140 + i, 12 + (i % 3) * 5, 8 + (i % 2) * 3, k === 'crab' ? PAL.stone : PAL.stoneWarm, k === 'crab' ? 0 : 0.5).buf; shadowOval(bg, x + r.w / 2 + 2, y + r.h, r.w / 2, 2); blit(bg, r, x, y); }
    }
    if (k === 'crab') for (let i = 0; i < 8; i++) {
      // strands of kelp washed up
      let x = hash(i, 1, 8) * W, y = 40 + hash(i, 2, 8) * (H - 50), a = hash(i, 3, 8) * 6;
      for (let s = 0; s < 18; s++) { a += Math.sin(s * 0.5 + i) * 0.3; x += Math.cos(a); y += Math.sin(a) * 0.6; bg.set(Math.round(x), Math.round(y), s % 4 ? hex('#3a4a1a') : hex('#5a6a24')); }
    }
  }

  private spook(c: Closeup, hard = false) {
    const W = c.W, H = c.H;
    // away from the hand, staying on the ground
    let ax = this.cx - this.sx, ay = this.cy - this.sy;
    const L = Math.hypot(ax, ay) || 1;
    ax /= L; ay /= L;
    const ang = Math.atan2(ay, ax) + (Math.random() - 0.5) * 1.2;
    const dist = (this.o.critter === 'frog' ? 46 : 38) + Math.random() * 22 + (hard ? 14 : 0);
    let tx = this.cx + Math.cos(ang) * dist, ty = this.cy + Math.sin(ang) * dist;
    tx = clamp(tx, 24, W - 24); ty = clamp(ty, 30, H - 20);
    if (this.o.critter === 'crab') ty = lerp(this.cy, ty, 0.35);
    const T = this.o.critter === 'frog' ? 0.42 : 0.32;
    this.vx = (tx - this.cx) / T; this.vy = (ty - this.cy) / T;
    this.state = this.o.critter === 'frog' ? 'hop' : 'dart';
    this.st = T;
    this.alert = 0.35;
    c.sfx(this.o.critter === 'frog' ? 'callCroak' : this.o.critter === 'crab' ? 'rustle' : 'callClick', { vol: 0.3, pitch: this.o.critter === 'frog' ? 1.6 : 2 });
    c.parts.burst('dust', this.cx, this.cy + 4, 5, 25, { c: this.o.critter === 'crab' ? '#e8d29b' : '#7a5a3a', life: 0.4 });
  }

  update(c: Closeup, dt: number) {
    this.t += dt;
    this.legT += dt;
    const W = c.W, H = c.H;
    if (this.done >= 0) { this.done += dt; if (this.done > 1) this.end(c); return; }
    // the hand's shadow follows the pointer (or the arrows, slow and careful)
    const [ax, ay] = c.axis();
    if (ax || ay) { c.ptr.x = clamp(c.ptr.x + ax * dt * 55, 0, W); c.ptr.y = clamp(c.ptr.y + ay * dt * 55, 0, H); }
    this.psx = this.sx; this.psy = this.sy;
    this.sx = lerp(this.sx, c.ptr.x, 1 - Math.exp(-dt * 14)); this.sy = lerp(this.sy, c.ptr.y, 1 - Math.exp(-dt * 14));
    const hs = Math.hypot(this.sx - this.psx, this.sy - this.psy) / Math.max(dt, 1e-3);
    const d = Math.hypot(this.sx - this.cx, this.sy - this.cy);
    // what puts it on edge: a fast hand nearby, the shadow creeping over it
    if (this.state !== 'dart' && this.state !== 'hop') {
      const fast = d < 70 ? Math.max(0, hs - 45) / 140 : 0;
      const shade = d < 14 ? 0.25 : 0;
      this.alert = clamp01(this.alert + (fast + shade) * dt * 3 - dt * 0.12);
      this.maxAlert = Math.max(this.maxAlert, this.alert);
      if (this.alert >= 1) this.spook(c);
    }
    // its own little life
    this.st -= dt;
    if (this.state === 'dart' || this.state === 'hop') {
      this.cx += this.vx * dt; this.cy += this.vy * dt;
      this.hopH = this.state === 'hop' ? Math.sin(clamp01(1 - this.st / 0.42) * Math.PI) * 10 : 0;
      this.face = Math.atan2(this.vy, this.vx);
      if (this.st <= 0) { this.state = 'idle'; this.st = 0.6 + Math.random() * 1.2; this.hopH = 0; }
    } else if (this.state === 'walk') {
      const sp = this.o.critter === 'beetle' ? 18 : this.o.critter === 'crab' ? 14 : 0;
      this.cx = clamp(this.cx + this.dirX * sp * dt, 24, W - 24); this.cy = clamp(this.cy + this.dirY * sp * dt, 30, H - 20);
      if (this.st <= 0) { this.state = 'idle'; this.st = 0.5 + Math.random() * 1.5; }
    } else if (this.state === 'idle' && this.st <= 0) {
      const a = Math.random() * Math.PI * 2;
      this.dirX = Math.cos(a); this.dirY = this.o.critter === 'crab' ? Math.sin(a) * 0.3 : Math.sin(a);
      if (this.o.critter === 'crab') this.dirX = Math.sign(this.dirX) || 1;
      this.face = this.o.critter === 'crab' ? 0 : Math.atan2(this.dirY, this.dirX);
      if (this.o.critter === 'frog') { if (Math.random() < 0.35) { this.vx = this.dirX * 50; this.vy = this.dirY * 50; this.state = 'hop'; this.st = 0.42; } else this.st = 1 + Math.random(); }
      else { this.state = 'walk'; this.st = 0.6 + Math.random() * 1.4; }
    }
    // the cup
    if (this.cupping) {
      this.drop += dt / 0.13;
      if (this.drop >= 1) {
        this.cupping = false;
        this.tries++;
        const hit = Math.hypot(this.sx - this.cx, this.sy - this.cy + this.hopH) < (this.o.critter === 'frog' ? 9 : 8) && this.hopH < 4;
        c.sfx('netSwish', { vol: 0.4, pitch: 1.3 });
        c.shake(2, 0.12);
        c.parts.burst('dust', this.sx, this.sy + 6, 8, 40, { c: this.o.critter === 'crab' ? '#e8d29b' : '#6a5a3a', life: 0.5 });
        if (hit) {
          this.state = 'caught'; this.done = 0;
          c.sfx('jarClink', { vol: 0.5 }); c.sfx('collectPop', { vol: 0.4 });
          c.say('Got you!', this.sx, this.sy - 40, { style: 'happy', ms: 1000 });
        } else {
          c.say(this.tries >= 3 ? 'Gone...' : 'Missed!', this.sx, this.sy - 40, { style: 'scared', ms: 900, color: '#ffb0a0' });
          if (this.tries >= 3) { c.finish('fail', 0, { word: 'GOT AWAY' }); return; }
          this.spook(c, true);
        }
      }
    } else if (this.drop > 0) this.drop = Math.max(0, this.drop - dt * 4);
    else if (c.act()) { this.cupping = true; this.drop = 0; }
    c.watch = { t01: 1 - this.t / this.limit, x: W - 24, y: 26, size: 28, secs: Math.round(this.limit) };
    if (this.t >= this.limit && this.done < 0) c.finish('fail', 0, { word: 'GOT AWAY' });
  }
  private end(c: Closeup) {
    const grade = this.tries === 1 && this.maxAlert < 0.6 ? 'perfect' : this.tries <= 2 ? 'good' : 'rough';
    c.finish(grade, clamp01(1 - (this.tries - 1) * 0.3 - this.maxAlert * 0.2));
  }
  trophy() {
    const f = this.frames[0];
    const b = new PixelBuffer(f.w * 2, f.h * 2);
    blit(b, f, 0, 0, { k: 2 });
    const name = this.o.item ? ITEMS[this.o.item]?.name ?? 'A critter' : this.o.critter === 'frog' ? 'A frog' : this.o.critter === 'crab' ? 'A crab' : 'A beetle';
    return { img: b, name: name.length > 18 ? name.slice(0, 17) + '.' : name, sub: this.tries === 1 ? 'FIRST TRY' : `${this.tries} TRIES` };
  }

  draw(c: Closeup, px: PixelBuffer) {
    px.data.set(this.bg.data.subarray(0, px.data.length));
    const t = this.t;
    // the critter (under the hand once caught)
    if (this.state !== 'caught') {
      const moving = this.state !== 'idle';
      const fr = this.frames[moving ? Math.floor(this.legT * (this.state === 'dart' ? 18 : 8)) % 2 : 0];
      const x = Math.round(this.cx - fr.w / 2), y = Math.round(this.cy - fr.h / 2 - this.hopH);
      shadowOval(px, this.cx, this.cy + fr.h / 2 - 2, fr.w / 2, 2, this.hopH > 0 ? 0.5 : 0.8);
      // turned to where it's going: a quarter-turn sprite set (the art faces up)
      const q = this.o.critter === 'crab' ? 0 : ((Math.round((this.face + Math.PI / 2) / (Math.PI / 2)) % 4) + 4) % 4;
      blitQ(px, fr, x, y, q);
      // on edge: it freezes and a little mark pops over it
      if (this.alert > 0.55) {
        const ex = Math.round(this.cx), ey = Math.round(this.cy - fr.h / 2 - this.hopH - 8 + Math.sin(t * 20));
        for (let j = 0; j < 4; j++) px.set(ex, ey + j, hex('#ffe680'));
        px.set(ex, ey + 5, hex('#ffe680'));
        px.set(ex + 1, ey, hex('#1e1008')); px.set(ex + 1, ey + 5, hex('#1e1008'));
      }
    }
    // the hand: high up it's off to the side of its shadow, cupping it drops right onto it
    const k = this.cupping ? clamp01(this.drop) : this.done >= 0 ? 1 : 1 - this.drop * 0;
    const lift = this.done >= 0 ? 0 : this.cupping ? 1 - k : 1;
    const sh = Math.round(4 + lift * 8);
    // the shadow: dithered, tighter as the hand comes down
    for (let y = -sh; y <= sh; y++) for (let x = -sh - 3; x <= sh + 3; x++) {
      const nx = x / (sh + 3), ny = y / sh;
      if (nx * nx + ny * ny > 1) continue;
      const X = Math.round(this.sx + x), Y = Math.round(this.sy + y);
      if (dith(X, Y) < 0.55 - lift * 0.25) px.set(X, Y, mix(px.get(X, Y), hex('#0a0604'), 0.55));
    }
    const hx = Math.round(this.sx - lift * 10), hy = Math.round(this.sy - lift * 22 + (this.done >= 0 ? Math.round(Math.sin(t * 30) * (this.done < 0.6 ? 1 : 0)) : 0));
    drawHand(px, 'open', hx, hy, { from: [hx + 40, c.H + 50] });
    if (this.done >= 0 && Math.sin(t * 14) > 0) {
      // something wriggling under the glove
      px.set(hx - 9, hy + 6, hex('#1e1008')); px.set(hx + 11, hy + 8, hex('#1e1008'));
    }
    if (this.done < 0 && this.t < 5) c.prompt(px, c.touch ? 'SLOWLY... TAP TO CUP IT' : 'MOVE SLOWLY, CLICK TO CUP', Math.round(c.W / 2), c.H - 14, c.touch ? 'mouse' : 'SPACE');
    // the tries left: three little jars by the watch
    for (let i = 0; i < 3; i++) {
      const x = c.W - 40 + i * 9, y = 46, used = i < this.tries;
      for (let j = 0; j < 6; j++) for (let ii = 0; ii < 5; ii++) px.set(x + ii, y + j, ii === 0 || ii === 4 || j === 5 ? hex('#1e1008') : used ? hex('#5a4a3a') : j === 0 ? hex('#c8b890') : hex('#a8d0d8'));
    }
  }
}
/** a sprite turned by quarter turns (exact) */
function blitQ(px: PixelBuffer, s: PixelBuffer, x: number, y: number, q: number) {
  for (let v = 0; v < s.h; v++) for (let u = 0; u < s.w; u++) {
    const c = s.data[v * s.w + u];
    if (c >>> 24 < 128) continue;
    let X = u, Y = v;
    if (q === 1) { X = s.h - 1 - v; Y = u; } else if (q === 2) { X = s.w - 1 - u; Y = s.h - 1 - v; } else if (q === 3) { X = v; Y = s.w - 1 - u; }
    px.set(x + X, y + Y, c);
  }
}

/** catch a critter; resolves with ok / score / perfect */
export function runCatch(o: CatchOpts): Promise<CloseupResult> { return runCloseup(new CatchSet(o), { world: o.world }); }

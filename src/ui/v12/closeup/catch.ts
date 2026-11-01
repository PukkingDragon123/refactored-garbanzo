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
import { PixelBuffer, hex, mix, rd, ramp, dith, hash, vnoise, clamp, clamp01, lerp, blit, shadowOval, pmap, up, area, ellipse, line, dot, Z } from './kit';
import { drawHand } from './hands';
import { BEETLE, BEETLE_PAL, FROG, FROG_PAL, CRAB, CRAB_PAL, TOAD_PAL, SAL, SAL_PAL } from './sprites';

export type Critter = 'beetle' | 'frog' | 'crab' | 'toad' | 'sal';
export interface CatchOpts { critter: Critter; item?: string; difficulty?: number; world?: [number, number] }

const LITTER = [ramp('#3a1a0a', '#6a3414', '#9a5422', '#c47a34'), ramp('#2a2a0a', '#5a5414', '#8a7a24', '#b8a040'), ramp('#1a2a10', '#2e4a1a', '#4a6a24', '#6a8a34')];

export function critterFor(item?: string, itemKind?: string): Critter {
  const id = (item ?? '').toLowerCase();
  if (/crab|shell|pipi|mussel|whelk/.test(id) || itemKind === 'shell') return 'crab';
  if (/toad|embertox/.test(id)) return 'toad';
  if (/salswab|blindsal|salamander/.test(id)) return 'sal';
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
  /** the set is the bed of a cave pool (the blind salamander) */
  cave = false;
  constructor(readonly o: CatchOpts) {
    const sets = { beetle: [BEETLE, BEETLE_PAL], frog: [FROG, FROG_PAL], crab: [CRAB, CRAB_PAL], toad: [FROG, TOAD_PAL], sal: [SAL, SAL_PAL] } as const;
    const [fr, pal] = sets[o.critter];
    this.frames = fr.map(rows => { const b = pmap(rows as unknown as string[], pal as unknown as Record<string, string>); return b; });
    // (V12 the ember toad: a frog in warning colours, and it behaves like one)
    if (o.critter === 'toad') this.o = { ...o, critter: 'frog' };
    // (V12 the blind salamander: on the bed of a cave pool, creeping and darting like a beetle)
    this.cave = o.critter === 'sal';
    if (o.critter === 'sal') this.o = { ...o, critter: 'beetle' };
    this.limit = 18 - (o.difficulty ?? 0.5) * 5;
  }

  layout(c: Closeup) {
    const W = c.W, H = c.H;
    if (this.t === 0) { this.cx = W * 0.6; this.cy = H * 0.55; this.sx = this.psx = W * 0.3; this.sy = this.psy = H * 0.7; c.ptr.x = this.sx; c.ptr.y = this.sy; }
    this.paintBg(W, H);
  }
  private paintBg(W: number, H: number) {
    const bg = new PixelBuffer(W * Z, H * Z);
    this.bg = bg;
    const k = this.o.critter;
    area(bg, 0, 0, W, H, (u, v, x, y) => {
      // dappled light through the canopy, pooled in soft dithered patches
      const dapple = vnoise(u * 0.035, v * 0.05, 1);
      if (this.cave) {
        // the bed of a cave pool under the lantern: wet limestone pebbles, silt, the water's ripple light
        const peb = vnoise(u * 0.32, v * 0.32, 8), rip = Math.sin(u * 0.21 + Math.sin(v * 0.17) * 2.6 + vnoise(u * 0.05, v * 0.05, 2) * 4);
        const lamp = Math.max(0, 1 - Math.hypot(u - W * 0.45, v - H * 0.4) / (W * 0.62));
        return rd(PAL.stone, 0.08 + lamp * 0.5 + (peb > 0.62 ? 0.16 : peb < 0.3 ? -0.08 : 0) + (rip > 0.86 ? 0.12 : 0), x, y);
      }
      if (k === 'crab') {
        // the pool along the top, a foam line, then wet sand rippled by the tide
        const shore = 34 + Math.sin(u * 0.05) * 8 + Math.sin(u * 0.13) * 3 + vnoise(u * 0.2, 0, 2) * 2;
        if (v < shore) return rd(PAL.water, 0.5 + (shore - v) / 80 + (vnoise(u * 0.3, v * 0.9, 3) > 0.7 ? 0.25 : 0), x, y);
        if (v < shore + 1.4) return dith(x, y) < 0.8 ? hex('#f4f4e8') : hex('#c8d8d8');
        const rip = Math.sin(v * 0.55 + Math.sin(u * 0.06) * 2.2 + vnoise(u * 0.1, v * 0.1, 4) * 2);
        return rd(PAL.sand, 0.45 + (rip > 0.6 ? 0.18 : rip < -0.7 ? -0.12 : 0) + (vnoise(u, v, 5) - 0.5) * 0.14 - Math.max(0, 1 - (v - shore) / 14) * 0.15, x, y);
      }
      if (k === 'frog') {
        // a carpet of moss: tiny fronds catching the light, beads of water
        const fr = vnoise(u * 1.6, v * 1.6, 6);
        if (hash(x >> 1, y >> 1, 6) < 0.004) return hex('#e8f4ff');
        return rd(PAL.moss, 0.25 + dapple * 0.45 + (fr - 0.5) * 0.35, x, y);
      }
      return rd(PAL.soil, 0.32 + dapple * 0.4 + (vnoise(u * 1.1, v * 1.1, 7) - 0.5) * 0.25, x, y);
    });
    if ((k === 'beetle' || k === 'frog') && !this.cave) {
      // fallen leaves: a pointed outline, a midrib and veins, a bite or two, curled edges
      const n = k === 'beetle' ? 70 : 22;
      for (let i = 0; i < n; i++) {
        const lx = hash(i, 1, 4) * W, ly = hash(i, 2, 4) * H, a = hash(i, 3, 4) * Math.PI, len = 7 + hash(i, 4, 4) * 9;
        const R = LITTER[k === 'frog' ? 2 : Math.floor(hash(i, 5, 4) * 3)];
        const ca = Math.cos(a), sa = Math.sin(a);
        area(bg, lx - len - 1, ly - len - 1, lx + len + 1, ly + len + 1, (u, v, x, y) => {
          const du = u - lx, dv = v - ly;
          const along = du * ca + dv * sa, across = -du * sa + dv * ca;
          if (Math.abs(along) > len) return -1;
          const half = Math.sin((along + len) / (2 * len) * Math.PI) * len * 0.42;
          if (Math.abs(across) > half) return -1;
          if (Math.abs(across) > half - 1.4 && vnoise(along * 0.8, i, 9) > 0.72) return -1;
          if (Math.abs(across) < 0.3) return R[3];
          const vein = Math.sin(along * 1.6 - Math.abs(across) * 1.6);
          return rd(R, 0.38 + across / (half + 1) * 0.28 + along / len * 0.1 + (vein > 0.9 ? 0.15 : 0) - (Math.abs(across) > half - 0.6 ? 0.15 : 0), x, y);
        });
      }
    }
    // stones and ferns round the edge
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2, x = W / 2 + Math.cos(a) * (W / 2 - 10), y = H / 2 + Math.sin(a) * (H / 2 - 8);
      if (k === 'frog' && i % 2 && !this.cave) { const f = paintGroundFern(70 + i, 14 * Z, PAL.fern).buf; blit(bg, f, x - f.w / Z / 2, y - f.h / Z / 2); }
      else { const w = 12 + (i % 3) * 5, h = 8 + (i % 2) * 3; shadowOval(bg, x + w / 2 + 2, y + h, w / 2, 2); blit(bg, paintRock(140 + i, w * Z, h * Z, k === 'crab' ? PAL.stone : PAL.stoneWarm, k === 'crab' ? 0 : 0.5).buf, x, y); }
    }
    if (k === 'crab') for (let i = 0; i < 8; i++) {
      // strands of kelp washed up, glossy
      let x = hash(i, 1, 8) * W, y = 40 + hash(i, 2, 8) * (H - 50), a = hash(i, 3, 8) * 6;
      for (let s = 0; s < 18; s++) { const na = a + Math.sin(s * 0.5 + i) * 0.3, nx = x + Math.cos(na), ny = y + Math.sin(na) * 0.6; line(bg, x, y, nx, ny, (_t, fx, fy, sd) => (sd < -0.3 ? hex('#7a8a34') : hex('#34441a')), Math.max(2, Z)); x = nx; y = ny; a = na; }
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
    const b = up(this.frames[0], Z * 2);
    const name = this.o.item ? ITEMS[this.o.item]?.name ?? 'A critter' : this.o.critter === 'frog' ? 'A frog' : this.o.critter === 'crab' ? 'A crab' : 'A beetle';
    return { img: b, name: name.length > 18 ? name.slice(0, 17) + '.' : name, sub: this.tries === 1 ? 'FIRST TRY' : `${this.tries} TRIES` };
  }

  draw(c: Closeup, px: PixelBuffer) {
    px.data.set(this.bg.data.subarray(0, px.data.length));
    const t = this.t;
    // the critter (under the hand once caught)
    if (this.state !== 'caught') {
      const moving = this.state !== 'idle';
      const fi = moving ? Math.floor(this.legT * (this.state === 'dart' ? 18 : 8)) % 2 : 0;
      // turned to where it's going: quarter turns of the hand-drawn map, then up to the fine grid
      const q = this.o.critter === 'crab' ? 0 : ((Math.round((this.face + Math.PI / 2) / (Math.PI / 2)) % 4) + 4) % 4;
      const fr = up(turned(this.frames[fi], q), Z);
      const w = fr.w / Z, h = fr.h / Z;
      shadowOval(px, this.cx, this.cy + h / 2 - 1, w / 2, 2, this.hopH > 0 ? 0.5 : 0.8);
      blit(px, fr, this.cx - w / 2, this.cy - h / 2 - this.hopH);
      // on edge: it freezes and a little mark pops over it
      if (this.alert > 0.55) {
        const ex = this.cx, ey = this.cy - h / 2 - this.hopH - 9 + Math.sin(t * 20) * 0.5;
        line(px, ex, ey, ex, ey + 3.5, hex('#ffe680'), Math.max(2, Math.round(Z * 0.7)));
        dot(px, ex, ey + 5, hex('#ffe680'), Math.max(1, Math.round(Z * 0.4)));
      }
    }
    // the hand: high up it's off to the side of its shadow; cupping, it drops right onto it
    const k = this.cupping ? clamp01(this.drop) : 1;
    const lift = this.done >= 0 ? 0 : this.cupping ? 1 - k : 1;
    const sh = 4 + lift * 8;
    ellipse(px, this.sx, this.sy, sh + 3, sh, (nx, ny, _u, _v, fx, fy) => (dith(fx, fy) < (0.55 - lift * 0.25) * (1 - (nx * nx + ny * ny) * 0.4) ? mix(px.data[fy * px.w + fx], hex('#0a0604'), 0.55) : -1));
    const wig = this.done >= 0 && this.done < 0.6 ? Math.sin(t * 30) * 0.5 : 0;
    const hx = this.sx - lift * 10 + wig, hy = this.sy - lift * 22;
    drawHand(px, this.cupping ? 'cup' : 'open', hx, hy, { from: [hx + 40, c.H + 50] });
    if (this.done < 0 && this.t < 5) c.prompt(px, c.touch ? 'SLOWLY... TAP TO CUP IT' : 'MOVE SLOWLY, CLICK TO CUP', c.W / 2, c.H - 14, c.touch ? 'mouse' : 'SPACE');
    // the tries left: three little glass jars by the watch
    for (let i = 0; i < 3; i++) {
      const x = c.W - 40 + i * 9, used = i < this.tries;
      area(px, x, 44, x + 6, 52, (u, v, fx, fy) => {
        const lx = u - x, ly = v - 44;
        if (ly < 1.6) return lx > 0.6 && lx < 5.4 ? rd(ramp('#5a4a2a', '#a8946e', '#d8c49a'), 0.6 - ly * 0.2, fx, fy) : -1;
        if (lx < 0.5 || lx > 5.5 || ly > 7.5) return hex('#1e1008');
        if (used) return rd(ramp('#2a2420', '#4a4038', '#6a5a4a'), 0.5 - lx * 0.05, fx, fy);
        return lx < 1.6 ? hex('#e8f8ff') : rd(ramp('#5a8a98', '#8ab8c8', '#bce0e8'), 0.6 - lx * 0.06, fx, fy);
      });
    }
  }
}
/** a hand-drawn map turned by quarter turns (exact; cached) */
const turnCache = new Map<PixelBuffer, PixelBuffer[]>();
function turned(s: PixelBuffer, q: number): PixelBuffer {
  if (!q) return s;
  let arr = turnCache.get(s);
  if (!arr) { arr = []; turnCache.set(s, arr); }
  if (arr[q]) return arr[q];
  const o = q % 2 ? new PixelBuffer(s.h, s.w) : new PixelBuffer(s.w, s.h);
  for (let v = 0; v < s.h; v++) for (let u = 0; u < s.w; u++) {
    let X = u, Y = v;
    if (q === 1) { X = s.h - 1 - v; Y = u; } else if (q === 2) { X = s.w - 1 - u; Y = s.h - 1 - v; } else if (q === 3) { X = v; Y = s.w - 1 - u; }
    o.set(X, Y, s.data[v * s.w + u]);
  }
  arr[q] = o;
  return o;
}

/** catch a critter; resolves with ok / score / perfect */
export function runCatch(o: CatchOpts): Promise<CloseupResult> { return runCloseup(new CatchSet(o), { world: o.world }); }

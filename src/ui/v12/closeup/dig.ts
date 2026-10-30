// V12 dig close-up: looking straight down into a strung dig square. Something is buried under three
// layers (loose topsoil, stiff clay, fine silt right over it). The trowel takes the dirt off fast but
// it chips whatever is underneath when it's scraped hard over it; the brush only sweeps silt and
// never hurts anything. Swap tools by tapping the one lying on the cloth (or Q). Three chips and it
// cracks for good. Uncover nearly all of it before the pocket watch runs down and Mori lifts it out.
//   fossil: a serpent's spine and ribs, or an ammonite; root: a tuber in dark soil; anything else is
//   the find's own painted art, big. The depth map is kept per fine pixel, so the cut walls are crisp.

import { PAL } from '../../../art/palettes';
import { paintRock, paintGrassTuft, paintGroundFern } from '../../../art/flora';
import { ITEMS } from '../../../game/items';
import { runCloseup } from './stage';
import type { Closeup, SetScene, CloseupResult } from './stage';
import { PixelBuffer, hex, mix, rd, ramp, dith, hash, vnoise, clamp, clamp01, lerp, blit, itemSprite, shadowOval, pmap, up, area, ellipse, line, Z } from './kit';
import { drawHand } from './hands';
import { VERTEBRA, VERT_PAL } from './sprites';

export type Buried = 'fossil' | 'ammonite' | 'root' | 'find';
export interface DigOpts { buried: Buried; item?: string; difficulty?: number; world?: [number, number] }

const TOP = ramp('#1a120c', '#2a1c12', '#3c2a1a', '#503824', '#644830', '#7a5a3a');
const CLAY = ramp('#4a2412', '#6a3a1c', '#8a4e26', '#a46232', '#bc7a42', '#d0924e');
const SILT = ramp('#6a5c44', '#8a7a5a', '#a8966e', '#c4b088', '#dccaa2', '#ece0bc');
const ROCK = ramp('#2e2e34', '#46464c', '#5e5e64', '#7a7a7c', '#9a9894', '#b8b6b0');
const BONE = ramp('#3a2a18', '#6a5034', '#a48a62', '#cdb48a', '#ece0bc', '#fff6e0');
const PEG = pmap([
  '.oo.',
  'ohdo',
  'ohdo',
  'ohdo',
  'ohdo',
  'ohdo',
  '.od.',
  '.o..',
], { o: '#2a1a0c', h: '#c89a5a', d: '#7a5428' });

/** the buried thing, painted big at the fine grid */
function paintBuried(b: Buried, item?: string): PixelBuffer {
  if (b === 'fossil') {
    // a serpent's spine: hand-drawn vertebrae along a gentle curve, ribs curving off them
    const W = 120, H = 58, o = new PixelBuffer(W * Z, H * Z);
    const v = up(pmap(VERTEBRA, VERT_PAL), Z), vf = up(pmap(VERTEBRA.map(r => [...r].reverse().join('')), VERT_PAL), Z);
    for (let i = 0; i < 8; i++) {
      const x = 6 + i * 13, y = 18 + Math.sin(i * 0.7) * 5;
      // ribs first (behind): thin bones curving down and back, round and lit on top
      for (const side of [-1, 1]) {
        let rx = x + 6.5, ry = y + (side > 0 ? 10 : 2);
        const n = 16 - Math.abs(i - 4);
        for (let k = 0; k < n; k++) {
          const nx = rx + (side > 0 ? -0.35 + k * 0.05 : 0.3 - k * 0.03), ny = ry + side * (1 - k * 0.04);
          if (ny < 0.5 || ny > H - 0.5) break;
          line(o, rx, ry, nx, ny, (_t, fx, fy, sd) => (sd < -0.3 ? BONE[4] : sd > 0.4 ? BONE[1] : rd(BONE, 0.62 - k / n * 0.2, fx, fy)), Math.max(2, Math.round(Z * (1.2 - k / n * 0.5))));
          rx = nx; ry = ny;
        }
      }
      blit(o, i % 2 ? vf : v, x, y);
    }
    return o;
  }
  if (b === 'ammonite') {
    // a coiled shell: whorls on a log spiral, ribs across each whorl, a chunk bitten off the rim
    const R = 26, W = R * 2 + 2, o = new PixelBuffer(W * Z, W * Z);
    const k = 0.22, c = R + 1;
    area(o, 0, 0, W, W, (u, v, x, y) => {
      const dx = u - c, dy = v - c, r = Math.hypot(dx, dy);
      if (r > R || r < 1.2) return -1;
      if (Math.hypot(dx - 17, dy + 14) < 7 + vnoise(u, v, 3) * 1.5) return -1;
      const th = Math.atan2(dy, dx);
      const ph = (Math.log(r / 1.5) / k - th) / (Math.PI * 2);
      const f = ph - Math.floor(ph);
      const rib = Math.sin((th + Math.log(r) * 0.6) * 22);
      let t = 0.6 - (dx + dy) / R * 0.22 + (rib > 0.4 ? 0.12 : rib < -0.6 ? -0.12 : 0) + Math.sin(f * Math.PI) * 0.2 - 0.1 + (vnoise(u * 0.8, v * 0.8, 5) - 0.5) * 0.1;
      if (f < 0.05 || f > 0.96) t = 0.06;
      if (r > R - 0.6) t = 0.04;
      return rd(BONE, t, x, y);
    });
    return o;
  }
  return itemSprite(item ?? 'fos_vertebra', 64);
}

export class DigSet implements SetScene {
  intro: { text: string; style: 'shout' };
  canAbort = true;
  // the square, in units; the depth map is per fine pixel
  sx = 0; sy = 0; sw = 210; sh = 112; FW = 0; FH = 0;
  D!: Float32Array; tex!: Float32Array; mask!: Uint8Array; maskN = 1;
  obj!: PixelBuffer; ox = 0; oy = 0;
  bg!: PixelBuffer;
  tool: 'trowel' | 'brush' = 'trowel';
  tx = 0; ty = 0; ptx = 0; pty = 0;
  working = false;
  cracks: { x: number; y: number; seed: number }[] = [];
  crackCool = 0;
  exposed = 0;
  t = 0; limit = 24;
  lift = -1;
  sfxT = 0;
  hinted: Record<string, boolean> = {};
  constructor(readonly o: DigOpts) {
    this.intro = { text: o.buried === 'root' ? 'DIG IT OUT!' : 'EXCAVATE!', style: 'shout' };
    this.limit = 30 - (o.difficulty ?? 0.5) * 8;
  }

  layout(c: Closeup) {
    const W = c.W, H = c.H;
    this.sw = Math.min(W - 70, 230); this.sh = Math.min(H - 56, 118);
    this.sx = Math.round((W - this.sw) / 2) + 8; this.sy = Math.round((H - this.sh) / 2) + 8;
    if (!this.obj) this.obj = paintBuried(this.o.buried, this.o.item);
    const ob = this.obj;
    this.ox = this.sx + Math.round((this.sw - ob.w / Z) / 2); this.oy = this.sy + Math.round((this.sh - ob.h / Z) / 2) + 4;
    const FW = this.sw * Z, FH = this.sh * Z;
    if (!this.D || this.FW !== FW || this.FH !== FH) {
      this.FW = FW; this.FH = FH;
      const n = FW * FH;
      this.D = new Float32Array(n); this.tex = new Float32Array(n); this.mask = new Uint8Array(n);
      const ofx = (this.ox - this.sx) * Z, ofy = (this.oy - this.sy) * Z;
      for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
        const i = y * FW + x, u = x / Z, v = y / Z;
        this.D[i] = 3 + Math.sin(u * 0.07) * 0.2 + Math.sin(v * 0.11 + 1) * 0.15 + vnoise(u * 0.25, v * 0.25, 3) * 0.2;
        this.tex[i] = vnoise(u * 1.4, v * 1.4, 7) * 0.6 + hash(x, y, 7) * 0.4;
        const bx = x - ofx, by = y - ofy;
        if (bx >= 0 && by >= 0 && bx < ob.w && by < ob.h && ob.data[by * ob.w + bx] >>> 24 > 128) this.mask[i] = 1;
      }
      this.maskN = Math.max(1, this.mask.reduce((a, b) => a + b, 0));
      this.tx = this.sx + this.sw / 2; this.ty = this.sy + this.sh / 2;
      c.ptr.x = this.tx; c.ptr.y = this.ty;
    }
    this.paintBg(W, H);
  }
  private paintBg(W: number, H: number) {
    const bg = new PixelBuffer(W * Z, H * Z);
    this.bg = bg;
    const root = this.o.buried === 'root';
    // the ground round the square, seen from above: mottled, gritty, mossy in places
    area(bg, 0, 0, W, H, (u, v, x, y) => {
      const m = vnoise(u * 0.08, v * 0.1, 2), n = vnoise(u * 0.9, v * 0.9, 4);
      if (!root && vnoise(u * 0.15, v * 0.15, 12) > 0.66 && n > 0.45) return rd(PAL.moss, 0.3 + n * 0.5, x, y);
      let k = 0.3 + m * 0.3 + (n - 0.5) * 0.25;
      if (hash(Math.floor(u * 1.5), Math.floor(v * 1.5), 11) < 0.03) k -= 0.25;
      return rd(root ? PAL.soil : PAL.stoneWarm, k, x, y);
    });
    // stones, tufts and ferns at the edges
    for (let i = 0; i < 16; i++) {
      const ang = i / 16 * Math.PI * 2;
      const x = W / 2 + Math.cos(ang) * (W / 2 - 14) + (hash(i, 1, 1) - 0.5) * 20, y = H / 2 + Math.sin(ang) * (H / 2 - 8) + (hash(i, 2, 1) - 0.5) * 10;
      if (i % 3 === 0) { const w = 14 + (i % 4) * 3, h = 9 + (i % 3) * 2; const r = paintRock(60 + i, w * Z, h * Z, PAL.stone, 0.6).buf; shadowOval(bg, x + w / 2 + 2, y + h, w / 2, 2); blit(bg, r, x, y); }
      else if (i % 3 === 1) { const g = paintGrassTuft(80 + i, 12 * Z, PAL.moss, 9).buf; blit(bg, g, x, y - g.h / Z + 4); }
      else { const f = paintGroundFern(90 + i, 12 * Z, PAL.fern).buf; blit(bg, f, x - f.w / Z / 2, y - f.h / Z / 2); }
    }
    // the canvas cloth the tools rest on, to the left
    const cx = 6, cy = H / 2 - 28;
    area(bg, cx, cy, cx + 34, cy + 56, (u, v, x, y) => {
      const lu = u - cx, lv = v - cy;
      if ((lu < 1 || lu > 33) && hash(x, y >> 1, 3) < 0.4) return -1;
      const fold = Math.sin(lv * 0.4 + lu * 0.1);
      return rd(PAL.canvas, 0.58 - lv / 120 + (fold > 0.85 ? -0.16 : fold > 0.7 ? 0.06 : 0) + (vnoise(u * 2, v * 0.5, 5) - 0.5) * 0.1, x, y);
    });
    // the square's dark cut rim
    area(bg, this.sx - 3, this.sy - 3, this.sx + this.sw + 3, this.sy + this.sh + 3, (_u, _v, x, y) => (dith(x, y) < 0.5 ? mix(bg.data[y * bg.w + x], hex('#0c0806'), 0.5) : -1));
  }

  private toolBox(which: 'trowel' | 'brush'): [number, number] { return [23, Math.round(this.bg.h / Z / 2) + (which === 'trowel' ? -14 : 14)]; }

  update(c: Closeup, dt: number) {
    this.t += dt;
    this.crackCool -= dt;
    this.sfxT -= dt;
    if (this.lift >= 0) { this.lift += dt; if (this.lift > 1.3) this.end(c); return; }
    // swap tools: tap the one on the cloth, or Q / 1 / 2
    const other = this.tool === 'trowel' ? 'brush' : 'trowel';
    const ob = this.toolBox(other);
    if ((c.ptr.pressed && Math.abs(c.ptr.x - ob[0]) < 16 && Math.abs(c.ptr.y - ob[1]) < 12) || c.hit('KeyQ') || c.hit(this.tool === 'trowel' ? 'Digit2' : 'Digit1')) {
      this.tool = other; c.sfx('place', { vol: 0.35, pitch: other === 'brush' ? 1.3 : 0.9 }); c.ptr.pressed = false;
      return;
    }
    // the tool follows the pointer, or the arrows
    const [axx, ayy] = c.axis();
    if (axx || ayy) { this.tx += axx * dt * 90; this.ty += ayy * dt * 70; c.ptr.x = this.tx; c.ptr.y = this.ty; }
    else { this.tx = lerp(this.tx, c.ptr.x, 1 - Math.exp(-dt * 20)); this.ty = lerp(this.ty, c.ptr.y, 1 - Math.exp(-dt * 20)); }
    this.tx = clamp(this.tx, this.sx - 6, this.sx + this.sw + 6); this.ty = clamp(this.ty, this.sy - 6, this.sy + this.sh + 6);
    const speed = Math.hypot(this.tx - this.ptx, this.ty - this.pty) / Math.max(dt, 1e-3);
    this.ptx = this.tx; this.pty = this.ty;
    const inside = this.tx >= this.sx && this.ty >= this.sy && this.tx < this.sx + this.sw && this.ty < this.sy + this.sh;
    this.working = (c.ptr.down || c.key('Space') || c.key('KeyE')) && inside;
    if (this.working) this.work(c, dt, speed);
    if (c.over) return;
    let ex = 0;
    const D = this.D, M = this.mask;
    for (let i = 0; i < D.length; i++) if (M[i] && D[i] <= 0.05) ex++;
    this.exposed = ex / this.maskN;
    c.watch = { t01: 1 - this.t / this.limit, x: c.W - 24, y: 26, size: 28, secs: Math.round(this.limit) };
    if (!this.hinted.brush && this.exposed > 0.08 && this.tool === 'trowel') { this.hinted.brush = true; c.say(this.o.buried === 'root' ? 'Easy round the root...' : 'Bone! Brush the last of it, gently.', c.W / 2, 22, { style: 'whisper', ms: 2600 }); }
    if (this.exposed >= 0.85) {
      this.lift = 0;
      c.sfx('discover', { vol: 0.5 });
      c.say(this.o.buried === 'root' ? 'Got it!' : 'There it is!', c.W / 2, 20, { style: 'happy', ms: 1300 });
      for (let i = 0; i < 20; i++) c.parts.add('dust', this.ox + Math.random() * this.obj.w / Z, this.oy + Math.random() * this.obj.h / Z, (Math.random() - 0.5) * 20, -10 - Math.random() * 20, { c: '#c4b088', life: 0.9 });
    } else if (this.t >= this.limit) {
      const ok = this.exposed >= 0.6 && this.cracks.length < 3;
      c.finish(ok ? 'rough' : 'fail', this.exposed * 0.6, { word: ok ? undefined : 'OUT OF TIME' });
    }
  }
  private work(c: Closeup, dt: number, speed: number) {
    const trowel = this.tool === 'trowel';
    const r = trowel ? 9 : 10, R = r * Z;
    const moving = speed > 6 || c.key('Space');
    const cx = Math.round((this.tx - this.sx) * Z), cy = Math.round((this.ty - this.sy) * Z);
    let hitBone = false, removed = 0;
    const FW = this.FW, FH = this.FH, D = this.D, M = this.mask, core = 2.4 * Z;
    for (let y = Math.max(0, cy - R); y <= Math.min(FH - 1, cy + R); y++) for (let x = Math.max(0, cx - R); x <= Math.min(FW - 1, cx + R); x++) {
      const dd = (x - cx) ** 2 + (y - cy) ** 2;
      if (dd > R * R) continue;
      const i = y * FW + x, d = D[i];
      if (d <= 0) { if (M[i] && trowel && dd < core * core) hitBone = true; continue; }
      const fall = 1 - dd / (R * R + 1);
      // the trowel cuts through anything; the brush sweeps silt fast and the rest hardly at all
      const rate = trowel ? (d > 2.4 ? 40 : d > 1 ? 20 : 14) : (d <= 1.05 ? 28 : d <= 2.4 ? 3 : 6);
      const take = rate * fall * dt * (moving ? 1 : 0.35) * (0.85 + this.tex[i] * 0.3);
      D[i] = Math.max(0, d - take);
      removed += take;
      if (M[i] && trowel && D[i] < 0.5 && dd < core * core) hitBone = true;
    }
    removed /= Z * Z;
    // scraped hard over the find, the trowel chips it
    if (hitBone && speed > 70 && this.crackCool <= 0) {
      this.crackCool = 0.6;
      this.cracks.push({ x: this.tx, y: this.ty, seed: this.cracks.length * 13 + 5 });
      c.shake(3, 0.2);
      c.sfx('hammer', { vol: 0.5, pitch: 1.6 }); c.sfx('wrong', { vol: 0.3 });
      c.parts.burst('chip', this.tx, this.ty, 8, 70, { c: ['#ece0bc', '#a48a62'], g: 200, life: 0.5 });
      const left = 3 - this.cracks.length;
      c.say(left <= 0 ? (this.o.buried === 'root' ? 'Snapped...' : 'No! It cracked right through...') : left === 1 ? 'CAREFUL! One more and it breaks!' : 'Careful! The brush, near the bone!', this.tx, this.ty - 26, { style: 'shout', ms: 1400, color: '#ffb0a0' });
      if (left <= 0) { c.finish('fail', this.exposed * 0.3, { word: this.o.buried === 'root' ? 'SNAPPED' : 'CRACKED' }); return; }
    }
    if (removed > 0.02) {
      const here = D[Math.max(0, Math.min(D.length - 1, cy * FW + cx))];
      const col = here > 2.4 ? TOP[3] : here > 1 ? CLAY[3] : SILT[3];
      if (trowel && Math.random() < dt * 24) c.parts.add('crumb', this.tx, this.ty, (Math.random() - 0.5) * 60, -40 - Math.random() * 30, { c: col, g: 260, life: 0.5, s: 1.5 + Math.random() });
      if (!trowel && Math.random() < dt * 34) c.parts.add('dust', this.tx + (Math.random() - 0.5) * 10, this.ty, (Math.random() - 0.5) * 30, -15, { c: SILT[4], life: 0.7 });
      if (this.sfxT <= 0) { this.sfxT = trowel ? 0.22 : 0.16; c.sfx(trowel ? 'dig' : 'rustle', { vol: trowel ? 0.3 : 0.18, pitch: trowel ? 0.9 + Math.random() * 0.3 : 1.8 }); }
    }
  }
  private end(c: Closeup) {
    const n = this.cracks.length;
    const quick = this.t < this.limit * 0.7;
    c.finish(n === 0 && quick ? 'perfect' : n <= 1 ? 'good' : 'rough', clamp01(this.exposed * (1 - n * 0.25) + (quick ? 0.05 : 0)));
  }
  trophy() {
    const name = this.o.item ? ITEMS[this.o.item]?.name ?? 'A find' : this.o.buried === 'root' ? 'A root' : 'A fossil';
    const img = this.obj.clone();
    for (const k of this.cracks) this.crackOn(img, (k.x - this.ox) * Z, (k.y - this.oy) * Z, k.seed);
    return { img, name: name.length > 18 ? name.slice(0, 17) + '.' : name, sub: this.cracks.length ? `${this.cracks.length} CHIP${this.cracks.length > 1 ? 'S' : ''}` : 'NOT A SCRATCH' };
  }
  /** a jagged crack from the chip, branching once (fine coords) */
  private crackOn(b: PixelBuffer, x: number, y: number, seed: number) {
    for (const dir of [0, 1]) {
      let cx = x, cy = y, a = hash(seed, dir, 3) * Math.PI * 2;
      for (let i = 0; i < 9 * Z; i++) {
        a += (hash(seed, i + dir * 40, 4) - 0.5) * 0.9;
        cx += Math.cos(a); cy += Math.sin(a);
        const X = Math.round(cx), Y = Math.round(cy);
        if (b.get(X, Y) >>> 24 > 128) { b.set(X, Y, hex('#2a1a0e')); if (b.get(X + 1, Y + 1) >>> 24 > 128) b.set(X + 1, Y + 1, hex('#fff6e0')); }
      }
    }
  }

  draw(c: Closeup, px: PixelBuffer) {
    px.data.set(this.bg.data.subarray(0, px.data.length));
    const FW = this.FW, FH = this.FH, D = this.D, ob = this.obj;
    const lifting = this.lift >= 0 ? clamp01(this.lift / 0.8) : 0;
    const X0 = this.sx * Z, Y0 = this.sy * Z, OX = this.ox * Z - X0, OY = this.oy * Z - Y0, W = px.w;
    const root = this.o.buried === 'root';
    // the dig: each layer its own colour, the cut walls shaded, the find showing where it's bare
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const i = y * FW + x, d = D[i], gx = x + X0, gy = y + Y0;
      let col: number;
      if (d <= 0.05) {
        const u = x - OX, v = y - OY;
        const o = this.mask[i] && lifting <= 0 ? ob.data[v * ob.w + u] : 0;
        if (o) col = o;
        else col = rd(root ? CLAY : ROCK, 0.38 + (Math.sin(gy / Z * 0.9 + vnoise(gx / Z * 0.05, gy / Z * 0.05, 2) * 6) > 0.8 ? -0.1 : 0) + (vnoise(gx / Z * 0.3, gy / Z * 0.3, 4) - 0.5) * 0.18 + (this.tex[i] - 0.5) * 0.15 - (this.mask[i] && lifting > 0 ? 0.25 : 0), gx, gy);
      } else {
        const tx = this.tex[i];
        const R = d > 2.4 ? TOP : d > 1 ? CLAY : SILT;
        let k = 0.55 + (tx - 0.5) * 0.45;
        // the wall of a step: lit facing the light (top left), dark facing away
        const s = Z;
        const upv = y >= s && x >= s ? D[i - s * FW - s] : d;
        const dn = y < FH - s && x < FW - s ? D[i + s * FW + s] : d;
        if (upv - d > 0.3) k -= 0.32; else if (dn - d > 0.3) k += 0.28;
        col = rd(R, k, gx, gy);
        // topsoil: leaf bits and rootlets; clay: iron streaks
        if (R === TOP && tx > 0.86) col = tx > 0.93 ? hex('#5a6a2a') : hex('#8a6a3a');
        if (R === CLAY && tx < 0.06) col = hex('#d8a060');
      }
      px.data[gy * W + gx] = col;
    }
    for (const k of this.cracks) this.crackOn(px, k.x * Z, k.y * Z, k.seed);
    // the string round the square and the pegs at the corners
    const S = hex('#e8dcb8'), Sd = hex('#2a1a0c');
    for (const [a, b2, e, f] of [[this.sx - 2, this.sy - 2, this.sx + this.sw + 1, this.sy - 2], [this.sx - 2, this.sy + this.sh + 1, this.sx + this.sw + 1, this.sy + this.sh + 1], [this.sx - 2, this.sy - 2, this.sx - 2, this.sy + this.sh + 1], [this.sx + this.sw + 1, this.sy - 2, this.sx + this.sw + 1, this.sy + this.sh + 1]]) {
      line(px, a + 1, b2 + 1.2, e + 1, f + 1.2, (_t, fx, fy) => (dith(fx, fy) < 0.6 ? Sd : -1), Math.max(1, Math.round(Z * 0.5)));
      line(px, a, b2, e, f, (_t, fx, fy) => ((fx + fy) % 4 === 0 ? hex('#b8a880') : S), Math.max(1, Math.round(Z * 0.5)));
    }
    const peg = up(PEG, Z);
    for (const [x, y] of [[this.sx - 4, this.sy - 7], [this.sx + this.sw - 1, this.sy - 7], [this.sx - 4, this.sy + this.sh - 4], [this.sx + this.sw - 1, this.sy + this.sh - 4]]) blit(px, peg, x, y);
    // the find lifting out (its shadow grows)
    if (lifting > 0) {
      const upn = lifting * 10;
      shadowOval(px, this.ox + ob.w / Z / 2 + upn / 2, this.oy + ob.h / Z / 2 + upn / 2, ob.w / Z / 2, ob.h / Z / 2, 0.6);
      blit(px, ob, this.ox, this.oy - upn);
      for (const k of this.cracks) this.crackOn(px, k.x * Z, (k.y - upn) * Z, k.seed);
    }
    // the spare tool on its cloth, the hand with the other
    const spare = this.tool === 'trowel' ? 'brush' : 'trowel', sb = this.toolBox(spare);
    this.drawTool(px, spare, sb[0], sb[1], true);
    if (lifting <= 0) {
      const press = this.working ? 1 : 0;
      this.drawTool(px, this.tool, this.tx, this.ty + press, false);
      drawHand(px, 'grip', this.tx, this.ty + 22 + press, { rot: 3, from: [this.tx + 50, c.H + 40] });
    } else drawHand(px, 'open', this.ox + ob.w / Z / 2, this.oy + ob.h / Z / 2 - lifting * 10 + 2, { from: [this.ox + ob.w / Z / 2 + 30, c.H + 40] });
    // prompts, and the find's progress as little bone pips under the watch
    if (this.lift < 0) {
      if (this.t < 5) c.prompt(px, c.touch ? 'DRAG TO SCRAPE' : 'HOLD AND DRAG', c.W / 2, c.H - 14, 'mouse');
      c.prompt(px, spare === 'brush' ? 'BRUSH' : 'TROWEL', sb[0] + 4, sb[1] + 12, 'Q');
      const pips = 10, got = Math.floor(this.exposed / 0.85 * pips);
      for (let i = 0; i < pips; i++) ellipse(px, c.W - 43 + i * 4, 47, 1.4, 1, (nx, ny, _u, _v, fx, fy) => (i < got ? rd(BONE, 0.75 - ny * 0.3 - nx * 0.1, fx, fy) : rd(ramp('#1a0e06', '#3a2a18'), 0.5 - ny * 0.4, fx, fy)));
    }
  }
  private drawTool(px: PixelBuffer, tool: 'trowel' | 'brush', x: number, y: number, resting: boolean) {
    const oy = resting ? -4 : 0;
    if (resting) shadowOval(px, x + 2, y + 2, 10, 3, 0.6);
    if (tool === 'trowel') {
      // a pointed masonry trowel: the leaf-shaped blade with its shine, the neck, the wooden handle
      const STEEL = ramp('#2a3036', '#4e5860', '#7e8a92', '#b4c0c6', '#e4ecee', '#ffffff');
      area(px, x - 6, y - 8 + oy, x + 6, y + 8 + oy, (u, v, fx, fy) => {
        const j = v - (y - 8 + oy), half = Math.min(j, 16 - j) * 0.55 + (j > 8 ? 1 : 0);
        const i = u - x;
        if (Math.abs(i) > half) return -1;
        if (Math.abs(i) > half - 0.5) return STEEL[0];
        // a raised spine down the middle, worn bright, scratches across
        let k = 0.5 - i / Math.max(1, half) * 0.3 + (Math.abs(i) < 0.5 ? 0.3 : 0);
        if (vnoise(u * 3, v * 0.5, 9) > 0.78) k += 0.12;
        return rd(STEEL, k, fx, fy);
      });
      line(px, x, y + 8 + oy, x, y + 12 + oy, hex('#3a3a3a'), Math.max(2, Math.round(Z * 0.6)));
      line(px, x, y + 12 + oy, x, y + 24 + oy, (_t, fx, fy, sd) => rd(ramp('#3a1a0a', '#7a3e1a', '#a05a2a', '#c87a3a'), 0.55 - sd * 0.45, fx, fy), Math.max(3, Math.round(Z * 1.6)));
    } else {
      // a soft paintbrush: a fan of bristles, a tin ferrule, the blue handle
      area(px, x - 4.5, y - 6 + oy, x + 4.5, y + 3 + oy, (u, v, fx, fy) => {
        const j = v - (y - 6 + oy), i = u - x;
        if (j < 1.5 && hash(Math.floor(u * 3), 0, 3) < 0.5) return -1;
        const strand = Math.sin(i * 7 + hash(Math.floor(u * 3), 1, 4) * 3);
        return rd(ramp('#5a3a1a', '#a07a40', '#c8a060', '#e8c888'), 0.6 - j * 0.04 + (strand > 0.6 ? 0.15 : strand < -0.6 ? -0.2 : 0), fx, fy);
      });
      area(px, x - 4.5, y + 3 + oy, x + 4.5, y + 7 + oy, (u, v, fx, fy) => rd(ramp('#3a4248', '#8a949c', '#d8e0e4', '#ffffff'), 0.7 - (u - x) * 0.08 - Math.abs(v - (y + 4.5 + oy)) * 0.15, fx, fy));
      line(px, x, y + 7 + oy, x, y + 21 + oy, (_t, fx, fy, sd) => rd(ramp('#0e2a4a', '#1a3a5a', '#2a5a8a', '#5a8ab0'), 0.55 - sd * 0.45, fx, fy), Math.max(3, Math.round(Z * 1.6)));
    }
  }
}

/** dig something out; resolves with the result (ok / score / perfect) */
export function runDig(o: DigOpts): Promise<CloseupResult> { return runCloseup(new DigSet(o), { world: o.world }); }

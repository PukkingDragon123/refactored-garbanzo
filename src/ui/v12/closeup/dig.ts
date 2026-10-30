// V12 dig close-up: looking straight down into a strung dig square. Something is buried under three
// layers (loose topsoil, stiff clay, fine silt right over it). The trowel takes the dirt off fast but
// it chips whatever is underneath when it's scraped hard over it; the brush only sweeps silt and
// never hurts anything. Swap tools by tapping the one lying on the cloth (or Q). Three chips and it
// cracks for good. Uncover nearly all of it before the pocket watch runs down and Mori lifts it out.
//   fossil: a serpent's spine and ribs, or an ammonite; root: a tuber in dark soil; anything else is
//   the find's own painted art, three times as big.

import { PAL } from '../../../art/palettes';
import { paintRock, paintGrassTuft, paintGroundFern } from '../../../art/flora';
import { ITEMS } from '../../../game/items';
import { runCloseup } from './stage';
import type { Closeup, SetScene, CloseupResult } from './stage';
import { PixelBuffer, hex, mix, rd, ramp, dith, hash, clamp, clamp01, lerp, blit, itemSprite, shadowOval, pmap } from './kit';
import { drawHand } from './hands';
import { VERTEBRA, VERT_PAL } from './sprites';

export type Buried = 'fossil' | 'ammonite' | 'root' | 'find';
export interface DigOpts { buried: Buried; item?: string; difficulty?: number; world?: [number, number] }

const TOP = ramp('#1a120c', '#2a1c12', '#3c2a1a', '#503824', '#644830');
const CLAY = ramp('#4a2412', '#6a3a1c', '#8a4e26', '#a46232', '#bc7a42');
const SILT = ramp('#6a5c44', '#8a7a5a', '#a8966e', '#c4b088', '#dccaa2');
const ROCK = ramp('#2e2e34', '#46464c', '#5e5e64', '#7a7a7c', '#9a9894');
const BONE = ramp('#3a2a18', '#6a5034', '#a48a62', '#cdb48a', '#ece0bc');
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

/** the buried thing, painted big, and its mask */
function paintBuried(b: Buried, item?: string): PixelBuffer {
  if (b === 'fossil') {
    // a serpent's spine: hand-drawn vertebrae along a gentle curve, ribs curving off them
    const W = 120, H = 58, o = new PixelBuffer(W, H);
    const v = pmap(VERTEBRA, VERT_PAL);
    const n = 8;
    for (let i = 0; i < n; i++) {
      const x = 6 + i * 13, y = 18 + Math.round(Math.sin(i * 0.7) * 5);
      // ribs first (behind): thin bones curving down and back
      for (const side of [-1, 1]) {
        let rx = x + 6, ry = y + (side > 0 ? 10 : 2);
        for (let k = 0; k < 16 - Math.abs(i - 4); k++) {
          rx += side > 0 ? -0.35 + k * 0.05 : 0.3 - k * 0.03; ry += side * (1 - k * 0.04);
          const X = Math.round(rx), Y = Math.round(ry);
          if (Y < 0 || Y >= H) break;
          o.set(X, Y, BONE[3]); o.set(X + 1, Y, BONE[1]);
          if (k % 5 === 2) o.set(X, Y, BONE[4]);
        }
      }
      blit(o, v, x, y, { fx: i % 2 === 1 });
    }
    return o;
  }
  if (b === 'ammonite') {
    // a coiled shell: whorls on a log spiral, ribs across each whorl, a chunk bitten off the rim
    const R = 26, W = R * 2 + 2, o = new PixelBuffer(W, W);
    const k = 0.22;
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - R - 1, dy = y + 0.5 - R - 1, r = Math.hypot(dx, dy);
      if (r > R || r < 1.5) continue;
      if (Math.hypot(dx - 17, dy + 14) < 7) continue;
      const th = Math.atan2(dy, dx);
      const ph = (Math.log(r / 1.5) / k - th) / (Math.PI * 2);
      const f = ph - Math.floor(ph);
      const rib = Math.sin((th + Math.log(r) * 0.6) * 22);
      let v = 0.62 - (dx + dy) / R * 0.22 + (rib > 0.4 ? 0.12 : rib < -0.6 ? -0.12 : 0);
      v += Math.sin(f * Math.PI) * 0.18 - 0.09;
      if (f < 0.08 || f > 0.95) v = 0.08;
      if (r > R - 1.2) v = 0.05;
      o.set(x, y, rd(BONE, v, x, y));
    }
    return o;
  }
  const sp = itemSprite(item ?? 'fos_vertebra', 24);
  const kk = 3;
  const o = new PixelBuffer(sp.w * kk, sp.h * kk);
  blit(o, sp, 0, 0, { k: kk });
  return o;
}

export class DigSet implements SetScene {
  intro: { text: string; style: 'shout' };
  canAbort = true;
  // the square
  sx = 0; sy = 0; sw = 210; sh = 112;
  D!: Float32Array;
  tex!: Float32Array;
  obj!: PixelBuffer; ox = 0; oy = 0; mask!: Uint8Array; maskN = 1;
  bg!: PixelBuffer;
  tool: 'trowel' | 'brush' = 'trowel';
  tx = 0; ty = 0; ptx = 0; pty = 0;
  working = false; workT = 0;
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
    this.ox = this.sx + Math.round((this.sw - ob.w) / 2); this.oy = this.sy + Math.round((this.sh - ob.h) / 2) + 4;
    const n = this.sw * this.sh;
    if (!this.D || this.D.length !== n) {
      this.D = new Float32Array(n); this.tex = new Float32Array(n); this.mask = new Uint8Array(n);
      for (let y = 0; y < this.sh; y++) for (let x = 0; x < this.sw; x++) {
        const i = y * this.sw + x;
        this.D[i] = 3 + Math.sin(x * 0.07) * 0.2 + Math.sin(y * 0.11 + 1) * 0.15 + hash(x >> 2, y >> 2, 3) * 0.15;
        this.tex[i] = hash(x, y, 7);
        const u = x + this.sx - this.ox, v = y + this.sy - this.oy;
        if (u >= 0 && v >= 0 && u < ob.w && v < ob.h && ob.data[v * ob.w + u] >>> 24 > 128) this.mask[i] = 1;
      }
      this.maskN = Math.max(1, this.mask.reduce((a, b) => a + b, 0));
      this.tx = this.sx + this.sw / 2; this.ty = this.sy + this.sh / 2;
      c.ptr.x = this.tx; c.ptr.y = this.ty;
    }
    this.paintBg(W, H);
  }
  private paintBg(W: number, H: number) {
    const bg = new PixelBuffer(W, H);
    this.bg = bg;
    const root = this.o.buried === 'root';
    // the forest floor round the square, seen from above
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n = hash(x >> 1, y >> 1, 2), m = Math.sin(x * 0.05 + Math.sin(y * 0.07) * 2) * 0.5 + 0.5;
      let col = rd(root ? PAL.soil : PAL.stoneWarm, 0.3 + m * 0.25 + (n - 0.5) * 0.2, x, y);
      if (!root && hash(x, y, 9) < 0.04) col = PAL.moss[2 + Math.floor(hash(x, y, 4) * 3)];
      if (hash(x >> 1, y >> 1, 11) < 0.03) col = PAL.soil[1];
      bg.set(x, y, col);
    }
    // stones, tufts and ferns at the edges
    for (let i = 0; i < 16; i++) {
      const ang = i / 16 * Math.PI * 2;
      const x = Math.round(W / 2 + Math.cos(ang) * (W / 2 - 14) + (hash(i, 1, 1) - 0.5) * 20), y = Math.round(H / 2 + Math.sin(ang) * (H / 2 - 8) + (hash(i, 2, 1) - 0.5) * 10);
      if (i % 3 === 0) { const r = paintRock(60 + i, 14 + (i % 4) * 3, 9 + (i % 3) * 2, PAL.stone, 0.6).buf; shadowOval(bg, x + r.w / 2 + 2, y + r.h, r.w / 2, 2); blit(bg, r, x, y); }
      else if (i % 3 === 1) { const g = paintGrassTuft(80 + i, 12, PAL.moss, 7).buf; blit(bg, g, x, y - g.h + 4); }
      else { const f = paintGroundFern(90 + i, 12, PAL.fern).buf; blit(bg, f, x - f.w / 2, y - f.h / 2); }
    }
    // the cloth the tools rest on, to the left
    const cx = 6, cy = Math.round(H / 2 - 28);
    for (let y = 0; y < 56; y++) for (let x = 0; x < 34; x++) {
      const fold = Math.sin(y * 0.4 + x * 0.1) > 0.85;
      bg.set(cx + x, cy + y, rd(PAL.canvas, 0.55 - y / 120 + (fold ? -0.15 : 0) + (hash(x, y, 5) - 0.5) * 0.08, cx + x, cy + y));
    }
    for (let x = 0; x < 34; x += 2) { bg.set(cx + x, cy + 56, PAL.canvas[1]); bg.set(cx + x + 1, cy - 1, PAL.canvas[2]); }
    // the square's shadowed rim
    for (let y = this.sy - 3; y < this.sy + this.sh + 3; y++) for (let x = this.sx - 3; x < this.sx + this.sw + 3; x++) if (dith(x, y) < 0.5) bg.set(x, y, mix(bg.get(x, y), hex('#0c0806'), 0.5));
  }

  private at(x: number, y: number) { const u = Math.floor(x - this.sx), v = Math.floor(y - this.sy); return u >= 0 && v >= 0 && u < this.sw && v < this.sh ? v * this.sw + u : -1; }
  private toolBox(which: 'trowel' | 'brush'): [number, number] { return [23, Math.round(this.bg.h / 2) + (which === 'trowel' ? -14 : 14)]; }

  update(c: Closeup, dt: number) {
    this.t += dt;
    this.crackCool -= dt;
    this.sfxT -= dt;
    if (this.lift >= 0) {
      this.lift += dt;
      if (this.lift > 1.3) this.end(c);
      return;
    }
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
    this.working = (c.ptr.down || c.key('Space') || c.key('KeyE')) && this.at(this.tx, this.ty) >= 0;
    if (this.working) this.work(c, dt, speed);
    // how much is showing
    let ex = 0;
    for (let i = 0; i < this.D.length; i++) if (this.mask[i] && this.D[i] <= 0.05) ex++;
    this.exposed = ex / this.maskN;
    c.watch = { t01: 1 - this.t / this.limit, x: c.W - 24, y: 26, size: 28, secs: Math.round(this.limit) };
    if (!this.hinted.brush && this.exposed > 0.08 && this.tool === 'trowel') { this.hinted.brush = true; c.say(this.o.buried === 'root' ? 'Easy round the root...' : 'Bone! Brush the last of it, gently.', c.W / 2, 22, { style: 'whisper', ms: 2600 }); }
    if (this.exposed >= 0.85) {
      this.lift = 0;
      c.sfx('discover', { vol: 0.5 });
      c.say(this.o.buried === 'root' ? 'Got it!' : 'There it is!', c.W / 2, 20, { style: 'happy', ms: 1300 });
      for (let i = 0; i < 20; i++) c.parts.add('dust', this.ox + Math.random() * this.obj.w, this.oy + Math.random() * this.obj.h, (Math.random() - 0.5) * 20, -10 - Math.random() * 20, { c: '#c4b088', life: 0.9 });
    } else if (this.t >= this.limit) {
      const ok = this.exposed >= 0.6 && this.cracks.length < 3;
      c.finish(ok ? 'rough' : 'fail', this.exposed * 0.6, { word: ok ? undefined : 'OUT OF TIME' });
    }
  }
  private work(c: Closeup, dt: number, speed: number) {
    const trowel = this.tool === 'trowel';
    const r = trowel ? 9 : 10;
    const moving = speed > 6 || c.key('Space');
    let hitBone = false, removed = 0;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      const i = this.at(this.tx + x, this.ty + y);
      if (i < 0) continue;
      const d = this.D[i];
      if (d <= 0) { if (this.mask[i] && trowel && x * x + y * y < 6) hitBone = true; continue; }
      const fall = 1 - (x * x + y * y) / (r * r + 1);
      // the trowel cuts through anything; the brush sweeps silt fast and the rest hardly at all
      const rate = trowel ? (d > 2.4 ? 40 : d > 1 ? 20 : 14) : (d <= 1.05 ? 28 : d <= 2.4 ? 3 : 6);
      const take = rate * fall * dt * (moving ? 1 : 0.35);
      this.D[i] = Math.max(0, d - take);
      removed += take;
      if (this.mask[i] && trowel && this.D[i] < 0.5 && x * x + y * y < 6) hitBone = true;
    }
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
      const col = this.D[this.at(this.tx, this.ty)] > 2 ? TOP[3] : this.D[this.at(this.tx, this.ty)] > 1 ? CLAY[3] : SILT[3];
      if (trowel && Math.random() < dt * 20) c.parts.add('crumb', this.tx, this.ty, (Math.random() - 0.5) * 60, -40 - Math.random() * 30, { c: col, g: 260, life: 0.5, s: 2 });
      if (!trowel && Math.random() < dt * 30) c.parts.add('dust', this.tx + (Math.random() - 0.5) * 10, this.ty, (Math.random() - 0.5) * 30, -15, { c: SILT[4], life: 0.7 });
      if (this.sfxT <= 0) { this.sfxT = trowel ? 0.22 : 0.16; c.sfx(trowel ? 'dig' : 'rustle', { vol: trowel ? 0.3 : 0.18, pitch: trowel ? 0.9 + Math.random() * 0.3 : 1.8 }); }
    }
  }
  private end(c: Closeup) {
    const n = this.cracks.length;
    const quick = this.t < this.limit * 0.7;
    const grade = n === 0 && quick ? 'perfect' : n <= 1 ? 'good' : 'rough';
    c.finish(grade, clamp01(this.exposed * (1 - n * 0.25) + (quick ? 0.05 : 0)));
  }
  trophy() {
    const name = this.o.item ? ITEMS[this.o.item]?.name ?? 'A find' : this.o.buried === 'root' ? 'A root' : 'A fossil';
    const img = this.obj.clone();
    for (const k of this.cracks) this.crackOn(img, k.x - this.ox, k.y - this.oy, k.seed);
    return { img, name: name.length > 18 ? name.slice(0, 17) + '.' : name, sub: this.cracks.length ? `${this.cracks.length} CHIP${this.cracks.length > 1 ? 'S' : ''}` : 'NOT A SCRATCH' };
  }
  private crackOn(b: PixelBuffer, x: number, y: number, seed: number) {
    // a jagged crack from the chip, branching once
    for (const dir of [0, 1]) {
      let cx = x, cy = y, a = hash(seed, dir, 3) * Math.PI * 2;
      for (let i = 0; i < 9; i++) {
        a += (hash(seed, i + dir * 10, 4) - 0.5) * 1.4;
        cx += Math.cos(a) * 1.2; cy += Math.sin(a) * 1.2;
        const X = Math.round(cx), Y = Math.round(cy);
        if (b.get(X, Y) >>> 24 > 128) b.set(X, Y, hex('#2a1a0e'));
      }
    }
  }

  draw(c: Closeup, px: PixelBuffer) {
    px.data.set(this.bg.data.subarray(0, px.data.length));
    const W = this.sw, D = this.D, ob = this.obj;
    const lifting = this.lift >= 0 ? clamp01(this.lift / 0.8) : 0;
    // the dig: each layer its own colour, the cut walls shaded, the find showing where it's bare
    for (let y = 0; y < this.sh; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, d = D[i], X = x + this.sx, Y = y + this.sy;
      let col: number;
      if (d <= 0.05) {
        const u = X - this.ox, v = Y - this.oy;
        const o = this.mask[i] && lifting <= 0 ? ob.data[v * ob.w + u] : 0;
        if (o) col = o;
        else col = rd(this.o.buried === 'root' ? CLAY : ROCK, 0.35 + Math.sin(Y * 0.5 + Math.sin(X * 0.04) * 3) * 0.12 + (this.tex[i] - 0.5) * 0.15 - (this.mask[i] && lifting > 0 ? 0.2 : 0), X, Y);
      } else {
        const tx = this.tex[i];
        const R = d > 2 ? TOP : d > 1 ? CLAY : SILT;
        let k = 0.55 + (tx - 0.5) * 0.35;
        // the wall of a step: lit facing the light (top left), dark facing away
        const up = y > 0 && x > 0 ? D[i - W - 1] : d;
        const dn = y < this.sh - 1 && x < W - 1 ? D[i + W + 1] : d;
        if (up - d > 0.3) k -= 0.3; else if (dn - d > 0.3) k += 0.25;
        col = rd(R, k, X, Y);
        // topsoil: leaf bits and rootlets
        if (R === TOP && tx > 0.965) col = tx > 0.985 ? hex('#5a6a2a') : hex('#8a6a3a');
        if (R === CLAY && tx < 0.02) col = hex('#d8a060');
      }
      px.set(X, Y, col);
    }
    for (const k of this.cracks) this.crackOn(px, k.x, k.y, k.seed);
    // the string round the square and the pegs at the corners
    const S = hex('#e8dcb8'), Sd = hex('#2a1a0c');
    for (let x = this.sx - 2; x < this.sx + W + 2; x++) { for (const y of [this.sy - 2, this.sy + this.sh + 1]) { px.set(x, y, S); if (dith(x, y + 1) < 0.6) px.set(x + 1, y + 2, Sd); } }
    for (let y = this.sy - 2; y < this.sy + this.sh + 2; y++) { for (const x of [this.sx - 2, this.sx + W + 1]) { px.set(x, y, S); if (dith(x + 1, y) < 0.6) px.set(x + 2, y + 1, Sd); } }
    for (const [x, y] of [[this.sx - 4, this.sy - 7], [this.sx + W - 1, this.sy - 7], [this.sx - 4, this.sy + this.sh - 4], [this.sx + W - 1, this.sy + this.sh - 4]]) blit(px, PEG, x, y);
    // the find lifting out (its shadow grows)
    if (lifting > 0) {
      const up = Math.round(lifting * 10);
      shadowOval(px, this.ox + ob.w / 2 + up / 2, this.oy + ob.h / 2 + up / 2, ob.w / 2, ob.h / 2, 0.6);
      blit(px, ob, this.ox, this.oy - up);
      for (const k of this.cracks) this.crackOn(px, k.x, k.y - up, k.seed);
    }
    // the spare tool on its cloth, the hand with the other
    this.drawTool(px, this.tool === 'trowel' ? 'brush' : 'trowel', ...this.toolBox(this.tool === 'trowel' ? 'brush' : 'trowel'), true);
    if (lifting <= 0) {
      const tx = Math.round(this.tx), ty = Math.round(this.ty);
      const press = this.working ? 1 : 0;
      this.drawTool(px, this.tool, tx, ty + press, false);
      drawHand(px, 'grip', tx, ty + 22 + press, { rot: 3, from: [tx + 50, px.h + 40] });
    } else drawHand(px, 'open', this.ox + ob.w / 2, this.oy + ob.h / 2 - Math.round(lifting * 10) + 2, { from: [this.ox + ob.w / 2 + 30, px.h + 40] });
    // prompts
    if (this.lift < 0) {
      if (this.t < 5) c.prompt(px, c.touch ? 'DRAG TO SCRAPE' : 'HOLD AND DRAG', Math.round(c.W / 2), c.H - 14, c.touch ? 'mouse' : 'mouse');
      const ob2 = this.toolBox(this.tool === 'trowel' ? 'brush' : 'trowel');
      c.prompt(px, this.tool === 'trowel' ? 'BRUSH' : 'TROWEL', ob2[0] + 4, ob2[1] + 12, 'Q');
      // a progress bar of sorts: little bone pips by the watch
      const pips = 10, got = Math.floor(this.exposed / 0.85 * pips);
      for (let i = 0; i < pips; i++) { const x = c.W - 44 + i * 4, y = 46; px.set(x, y, i < got ? hex('#ece0bc') : hex('#3a2a18')); px.set(x + 1, y, i < got ? hex('#cdb48a') : hex('#2a1a0e')); px.set(x, y + 1, hex('#1a0e06')); }
    }
  }
  private drawTool(px: PixelBuffer, tool: 'trowel' | 'brush', x: number, y: number, resting: boolean) {
    if (resting) { shadowOval(px, x + 2, y + 2, 10, 3, 0.6); }
    if (tool === 'trowel') {
      // a pointed masonry trowel: the leaf-shaped blade, its shine, the neck and the wooden handle
      const STEEL = ramp('#2a3036', '#4e5860', '#7e8a92', '#b4c0c6', '#e4ecee');
      for (let j = 0; j < 16; j++) {
        const w = Math.round(Math.min(j, 16 - j) * 0.55 + (j > 8 ? 1 : 0));
        for (let i = -w; i <= w; i++) {
          const v = 0.5 + i / Math.max(1, w) * -0.3 + (i === 0 ? 0.25 : 0);
          px.set(x + i, y - 8 + j - (resting ? 4 : 0), Math.abs(i) === w ? STEEL[0] : rd(STEEL, v, x + i, y + j));
        }
      }
      for (let j = 0; j < 4; j++) px.set(x, y + 8 + j - (resting ? 4 : 0), hex('#3a3a3a'));
      for (let j = 0; j < 12; j++) for (let i = -1; i <= 1; i++) px.set(x + i, y + 12 + j - (resting ? 4 : 0), i === -1 ? hex('#3a1a0a') : i === 1 ? hex('#a05a2a') : hex('#7a3e1a'));
    } else {
      // a soft paintbrush: a fan of bristles, a tin ferrule, the handle
      for (let j = 0; j < 9; j++) for (let i = -4; i <= 4; i++) {
        if (j < 2 && (i + j) % 2) continue;
        px.set(x + i, y - 6 + j - (resting ? 4 : 0), hash(i, j, 3) < 0.3 ? hex('#5a3a1a') : j < 3 ? hex('#c8a060') : hex('#a07a40'));
      }
      for (let j = 0; j < 4; j++) for (let i = -4; i <= 4; i++) px.set(x + i, y + 3 + j - (resting ? 4 : 0), Math.abs(i) === 4 ? hex('#3a4248') : j === 1 ? hex('#d8e0e4') : hex('#8a949c'));
      for (let j = 0; j < 14; j++) for (let i = -1; i <= 1; i++) px.set(x + i, y + 7 + j - (resting ? 4 : 0), i === -1 ? hex('#1a3a5a') : i === 1 ? hex('#5a8ab0') : hex('#2a5a8a'));
    }
  }
}

/** dig something out; resolves with the result (ok / score / perfect) */
export function runDig(o: DigOpts): Promise<CloseupResult> { return runCloseup(new DigSet(o), { world: o.world }); }

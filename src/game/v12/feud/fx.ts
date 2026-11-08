// V12 The Claw and the Plume: the small hand-placed pixel art the feud throws about (fur torn from the
// Bearer, feathers shaken out of the boa's ruff, dust and turned earth) and the Bearer's food cache: a
// mound of scraped-up earth, sticks and fern over a buried kill.

import type { Renderer, Frame } from '../../../gfx/renderer';
import type { Drawable } from '../../../world/stage';
import type { FieldScene } from '../../scenes/field';
import { PixelBuffer } from '../../../art/pixel';
import { hex, C } from '../../../art/color';
import { local } from '../../assets';
import { rand } from '../../../core/math';
import { hh } from '../../../art/beasts-core';
import { fx11Frames } from '../../v11/predators-fx';

interface FeudFx { fur: Frame[]; feather: Frame[]; dust: Frame[]; dirt: Frame[]; spark: Frame }
let FR: FeudFx | null = null;
let owner: unknown = null;

const px = (b: PixelBuffer, pts: [number, number, string][]) => { for (const [x, y, c] of pts) b.set(x, y, hex(c)); };

/** the frames, baked into the scene atlas once per scene */
export function feudFx(): FeudFx {
  if (FR && owner === local) return FR;
  owner = local;
  const add = (n: string, b: PixelBuffer) => local.add('v12:feud:' + n, b, b.w / 2, b.h / 2);
  // tufts of torn fur: dark brown hanks with frosted ends
  const fur = [0, 1, 2].map(i => {
    const b = new PixelBuffer(6, 4);
    const D = '#241710', M = '#3e281a', L = '#5a3c26', F = '#a8927a';
    if (i === 0) px(b, [[0, 1, D], [1, 1, M], [2, 0, M], [2, 1, L], [3, 1, M], [4, 2, F], [1, 2, D], [3, 0, F]]);
    else if (i === 1) px(b, [[0, 2, D], [1, 2, M], [1, 1, M], [2, 1, L], [3, 1, M], [3, 2, D], [4, 1, F], [5, 0, F], [2, 2, D]]);
    else px(b, [[1, 0, F], [1, 1, M], [2, 1, L], [2, 2, M], [3, 2, M], [4, 3, D], [0, 1, D], [3, 1, F]]);
    return add('fur' + i, b);
  });
  // small feathers: a pale shaft, the vane barred or flashing gold / crimson at the base, a dark tip
  const feather = [0, 1, 2, 3].map(i => {
    const b = new PixelBuffer(8, 4);
    const vane = ['#2e7e56', '#2a8aa0', '#927232', '#4a9a60'][i], vane2 = ['#1a4838', '#1e5a6a', '#58401c', '#226248'][i];
    const base = i === 1 ? '#f0b638' : i === 2 ? '#c8302c' : vane;
    px(b, [
      [0, 2, '#c8b47e'], [1, 2, '#c8b47e'], [2, 2, '#c8b47e'], [3, 2, '#c8b47e'], [4, 2, '#a8946a'], [5, 2, '#a8946a'],
      [1, 1, base], [2, 1, base], [3, 1, vane], [4, 1, vane], [5, 1, vane2], [6, 1, '#140a12'],
      [2, 3, vane2], [3, 3, vane], [4, 3, vane2], [5, 3, vane], [6, 2, '#140a12'], [7, 2, '#140a12'],
      [4, 0, vane2], [5, 0, vane],
    ]);
    return add('feather' + i, b);
  });
  // dust: ragged pixel puffs in three tones, edges broken up (no soft gradients)
  const dust = [5, 7, 9].map((r, i) => {
    const b = new PixelBuffer(r * 2 + 2, r * 2 + 2);
    const cols: C[] = [hex('#d8c8a8'), hex('#b8a888'), hex('#8e8068')];
    for (let y = 0; y < b.h; y++)
      for (let x = 0; x < b.w; x++) {
        const dx = x + 0.5 - b.w / 2, dy = (y + 0.5 - b.h / 2) * 1.15;
        const d = Math.hypot(dx, dy) / r + (hh(x, y, 31 + i) - 0.5) * 0.45;
        if (d > 1) continue;
        if (d > 0.8 && (x + y) % 2) continue;
        b.set(x, y, cols[d < 0.45 && dy < 0 ? 0 : d < 0.8 ? 1 : 2]);
      }
    return local.add('v12:feud:dust' + i, b, b.w / 2, b.h / 2);
  });
  const dirt = fx11Frames().clod;
  const sp = new PixelBuffer(5, 5);
  for (const [x, y] of [[2, 0], [2, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [2, 3], [2, 4]] as [number, number][]) sp.set(x, y, x === 2 && y === 2 ? hex('#ffffff') : hex('#fff0b0'));
  FR = { fur, feather, dust, dirt, spark: add('spark', sp) };
  return FR;
}

/** fur torn out of the Bearer at (x, y), thrown away from `dir` */
export function furBurst(f: FieldScene, x: number, y: number, dir: number, n = 8) {
  const F = feudFx(), gy = f.st.terrain.groundY(x);
  for (let i = 0; i < n; i++) f.main.particles.spawn({
    frame: F.fur[i % 3], x: x + rand.range(-6, 6), y: y + rand.range(-6, 6), vx: dir * rand.range(20, 110) + rand.range(-30, 30), vy: rand.range(-120, -30),
    ay: 160, drag: 1.4, life: rand.range(1.2, 2.2), vrot: rand.range(-8, 8), flutter: 14, alpha: 1, alpha1: 0.7, floorY: gy, onFloor: 'stop',
  });
}
/** feathers shaken out of the boa's ruff and back */
export function featherBurst(f: FieldScene, x: number, y: number, dir: number, n = 8) {
  const F = feudFx(), gy = f.st.terrain.groundY(x);
  for (let i = 0; i < n; i++) f.main.particles.spawn({
    frame: F.feather[Math.floor(rand.next() * 4)], x: x + rand.range(-8, 8), y: y + rand.range(-8, 6), vx: dir * rand.range(10, 90) + rand.range(-40, 40), vy: rand.range(-130, -40),
    ay: 90, drag: 2, life: rand.range(1.8, 3), flutter: 22, alpha: 1, alpha1: 0.8, floorY: gy, onFloor: 'stop',
  });
}
/** dust kicked up at the feet */
export function dustBurst(f: FieldScene, x: number, y: number, dir: number, n = 4, big = false) {
  const F = feudFx();
  for (let i = 0; i < n; i++) f.main.particles.spawn({
    frame: F.dust[big ? 1 + (i % 2) : i % 2], x: x + rand.range(-10, 10), y: y - rand.range(1, 5), vx: dir * rand.range(10, 50) + rand.range(-20, 20), vy: rand.range(-30, -6),
    drag: 1.5, life: rand.range(0.6, 1.1), size: big ? 1.2 : 1, size1: big ? 1.8 : 1.4, alpha: 0.85, alpha1: 0,
  });
}
/** earth thrown up by digging */
export function dirtBurst(f: FieldScene, x: number, y: number, dir: number, n = 6) {
  const F = feudFx(), gy = f.st.terrain.groundY(x);
  for (let i = 0; i < n; i++) f.main.particles.spawn({
    frame: F.dirt[i % 3], x: x + rand.range(-5, 5), y: y - 2, vx: dir * rand.range(30, 120), vy: rand.range(-170, -70),
    ay: 460, life: 1, vrot: rand.range(-12, 12), alpha: 1, alpha1: 1, floorY: gy + 1, onFloor: 'stop',
  });
}
/** a heavy blow on the ground: a ring of dust, clods, a shake */
export function slam(f: FieldScene, x: number, k = 1) {
  const gy = f.st.terrain.groundY(x);
  dustBurst(f, x - 8, gy, -1, Math.round(4 * k), true);
  dustBurst(f, x + 8, gy, 1, Math.round(4 * k), true);
  dirtBurst(f, x, gy, -1, Math.round(3 * k));
  dirtBurst(f, x, gy, 1, Math.round(3 * k));
  f.st.shake(2 + 2.5 * k, 0.35);
}

// ------------------------------------------------------------------ the cache
/** paint the cache mound: 0 a scraped hollow, 1 a heaped mound over a kill, 2 dug open (earth thrown about) */
function paintCache(state: number, seed: number): PixelBuffer {
  const W = 78, H = 26;
  const b = new PixelBuffer(W, H);
  const soil = ['#2a1d14', '#3a2a1c', '#4e3a26', '#644c32', '#7c6242'].map(c => hex(c));
  const fern = ['#1e2a14', '#2e4020', '#44582c'].map(c => hex(c));
  const stick = ['#3a2a1a', '#5a4430', '#7a6448'].map(c => hex(c));
  const base = H - 3;
  const heap = state === 1 ? 15 : state === 2 ? 7 : 3;
  for (let x = 0; x < W; x++) {
    const u = (x + 0.5 - W / 2) / (W / 2 - 3);
    if (Math.abs(u) >= 1) continue;
    // an irregular heap: lumpy, steeper on the side it was scraped from
    let top = heap * Math.pow(1 - u * u, 0.8) * (1 + (hh(x >> 2, 1, seed) - 0.5) * 0.35) + (hh(x >> 1, 2, seed) - 0.5) * 1.6;
    if (state === 2 && Math.abs(u) < 0.35) top -= 5 * (1 - Math.abs(u) / 0.35);
    const yTop = Math.round(base - Math.max(1, top));
    for (let y = yTop; y < H - 1; y++) {
      const dd = y - yTop;
      let c = dd === 0 ? soil[4] : dd < 2 ? soil[3] : dd < 5 ? soil[2] : soil[1];
      // clods and stones catch the light, shadowed underneath
      const h = hh(x, y, seed + 5);
      if (h < 0.08) c = soil[4]; else if (h > 0.93) c = soil[0];
      if (state === 2 && Math.abs(u) < 0.3 && dd > 1) c = soil[0];
      b.set(x, y, c);
    }
  }
  // sticks and torn fern over a buried kill
  if (state === 1) {
    for (let i = 0; i < 5; i++) {
      const x0 = 12 + hh(i, 3, seed) * 50, len = 10 + hh(i, 4, seed) * 14, a = -0.5 + hh(i, 5, seed) * 1;
      for (let s = 0; s < len; s++) {
        const x = Math.round(x0 + Math.cos(a) * s), y = Math.round(base - 9 + Math.sin(a) * s + hh(i, 6, seed) * 5 - Math.sin((x / W) * Math.PI) * 4);
        if (b.get(x, y) >>> 24) { b.set(x, y, stick[s % 4 === 0 ? 2 : 1]); b.set(x, y + 1, stick[0]); }
      }
    }
    for (let i = 0; i < 6; i++) {
      const cx = 10 + hh(i, 8, seed) * 58, cy = base - 6 - hh(i, 9, seed) * 6;
      for (let s = 0; s < 9; s++) {
        const x = Math.round(cx + s * (hh(i, 10, seed) < 0.5 ? 1 : -1)), y = Math.round(cy - Math.sin(s * 0.35) * 3);
        if (!(b.get(x, y) >>> 24)) continue;
        b.set(x, y, fern[1]);
        if (s % 2 === 0) { b.set(x, y - 1, fern[2]); b.set(x, y + 1, fern[0]); }
      }
    }
    // a hoof sticking out of the earth
    b.set(57, base - 9, hex('#2a2420')); b.set(58, base - 10, hex('#4a3e34')); b.set(58, base - 9, hex('#3a3028')); b.set(59, base - 11, hex('#2a2420'));
  }
  b.outline(hex('#1a120c'));
  return b;
}

/** the Bearer's food cache: a heaped mound over a kill it has buried for later */
export class Cache implements Drawable {
  z = 26;
  dead = false;
  /** a buried kill: its species (null: empty) */
  kill: string | null = null;
  /** 0..1 dug open (the boa raiding it, or the Bearer coming back to eat) */
  open = 0;
  private fr: Frame[] = [];
  private frOwner: unknown = null;
  readonly y: number;
  constructor(readonly f: FieldScene, readonly x: number) {
    this.y = f.st.terrain.groundY(x) + 3;
  }
  private frames(): Frame[] {
    if (this.frOwner !== local || !this.fr.length) {
      this.frOwner = local;
      const seed = Math.round(this.x) % 997;
      this.fr = [0, 1, 2].map(i => local.add(`v12:feud:cache:${seed}:${i}`, paintCache(i, seed), 39, 25));
    }
    return this.fr;
  }
  draw(r: Renderer) {
    const F = this.frames();
    const st = this.kill ? (this.open > 0.5 ? 2 : 1) : this.open > 0.5 ? 2 : 0;
    r.draw(F[st], Math.round(this.x), Math.round(this.y));
  }
}

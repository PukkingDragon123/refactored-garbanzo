// The game's name as a cloud formation: pixel-art cumulus billowing in the shape of the letters, lit
// by the low sun. Each letter is a cluster of billows (puffs) on a 5 x 7 letter grid, with bigger
// billows heaped on the tops of the strokes; the whole thing is rasterised as one height field (the
// union of the puffs' domes), so it shades as one cloud: sun-gold on the faces turned to the sun, rose
// in the middle tones, violet in the creases and on the shadow side, a bright rim where the edge
// faces the sun, the tones quantised with ordered dither (no smooth gradients).
//
// It forms on the wind: the puffs stream in from the right, small and thin (dithered), and swell
// into place letter by letter. Formed, the billows breathe and churn a little, and wisps tear off the
// downwind (left) edges and drift away, thinning out. The cloud is re-rasterised a dozen times a
// second into a streamed texture.
//
//   const c = new CloudTitle('ZEALANDIA', { cell: 7 })
//   c.update(dt); c.draw(r, x, y)          x, y: the top-left of its buffer (screen layer px)
//   c.finish()                             skip the forming

import type { Frame, Renderer } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { PixelBuffer } from '../../art/pixel';
import { hex } from '../../art/color';
import { bigFrame } from '../../gfx/atlas';
import { Rng, bayer } from '../../core/math';

// 5 x 7 cloud letters (a little rounder than the bitmap font, so the billows read as letters)
const LETTERS: Record<string, string[]> = {
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  E: ['####', '#...', '#...', '###.', '#...', '#...', '####'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  L: ['#...', '#...', '#...', '#...', '#...', '#...', '####'],
  N: ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  J: ['..###', '....#', '....#', '....#', '#...#', '#...#', '.###.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
};

/** golden-hour cloud ramp, shadow to sun */
const RAMP_HEX = ['#3a3462', '#56497e', '#7e6094', '#ac7896', '#d8948e', '#f2b48a', '#ffd298', '#ffe9bc', '#fff8e4'];

interface Puff {
  x: number; y: number;
  rx: number; ry: number;
  /** height bias (billows on top stand proud of the body) */
  z: number;
  birth: number;
  ph: number;
  /** wisps: drifting, thinning, then gone (and re-spawned) */
  wisp?: { vx: number; life: number; max: number };
}

export interface CloudOpts {
  /** px per letter grid cell (default 7) */
  cell?: number;
  /** billow radius as a fraction of the cell (default 0.78) */
  puff?: number;
  seed?: number;
  /** cells between letters (default 1.6) */
  gap?: number;
  /** seconds before the first puff arrives, and how long the whole word takes to form */
  delay?: number;
  spread?: number;
  /** thin and high (cirrus): smaller billows, no heaped tops, paler */
  cirrus?: boolean;
  /** wisps torn off per second when formed */
  wisps?: number;
}

export class CloudTitle {
  readonly w: number;
  readonly h: number;
  private buf: PixelBuffer;
  private frame: Frame | null = null;
  private puffs: Puff[] = [];
  private wisps: Puff[] = [];
  /** letter-edge spots wisps tear off from */
  private edges: [number, number][] = [];
  private hz: Float32Array;
  private own: Int32Array;
  private fa: Float32Array;
  private fb: Float32Array;
  private ramp: number[];
  private rng: Rng;
  private acc = 1;
  private uploaded = false;
  private wispAcc = 0;
  t = 0;
  readonly o: Required<CloudOpts>;
  /** when the last puff has formed */
  readonly done: number;

  constructor(readonly text: string, o: CloudOpts = {}) {
    this.o = { cell: 7, puff: 0.86, seed: 7, gap: 1.8, delay: 0.3, spread: 2.6, cirrus: false, wisps: 1.2, ...o };
    const C = this.o.cell;
    this.rng = new Rng(this.o.seed * 31 + 7);
    const rng = this.rng;
    // lay the letters out on the grid
    const cells: [number, number][] = [];
    let gx = 0;
    for (const ch of text) {
      const L = LETTERS[ch];
      if (!L) { gx += 3; continue; }
      L.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') cells.push([gx + i, j]); });
      gx += L[0].length + this.o.gap;
    }
    const gw = gx - this.o.gap;
    const ML = Math.round(C * 7), MR = Math.round(C * 2), MT = Math.round(C * 2.4), MB = Math.round(C * 1.6);
    this.w = Math.ceil(gw * C + ML + MR);
    this.h = Math.ceil(7 * C + MT + MB);
    this.buf = new PixelBuffer(this.w, this.h);
    this.hz = new Float32Array(this.w * this.h);
    this.own = new Int32Array(this.w * this.h);
    this.fa = new Float32Array(this.w * this.h);
    this.fb = new Float32Array(this.w * this.h);
    this.ramp = RAMP_HEX.map(h => hex(h));
    if (this.o.cirrus) this.ramp = ['#7a6a96', '#9a84a8', '#c49cb0', '#e6b4ac', '#f8d0b0', '#ffe4c4', '#fff6e4'].map(h => hex(h));
    const has = new Set(cells.map(([x, y]) => x + ',' + y));
    const on = (x: number, y: number) => has.has(x + ',' + y);
    const R = C * this.o.puff;
    const cx = (x: number) => ML + (x + 0.5) * C, cy = (y: number) => MT + (y + 0.5) * C;
    const birthAt = (x: number) => this.o.delay + (x / Math.max(1, this.w)) * this.o.spread + rng.range(0, 0.6);
    const add = (x: number, y: number, r: number, z: number, sq = 1) => {
      this.puffs.push({ x, y, rx: r, ry: r * sq, z, birth: birthAt(x), ph: rng.range(0, 6.28) });
    };
    for (const [x, y] of cells) {
      // the body: a billow on every cell
      add(cx(x) + rng.range(-0.7, 0.7), cy(y) + rng.range(-0.7, 0.7), R * rng.range(0.92, 1.12), 0);
      // between neighbours (orthogonal and diagonal), so the strokes run on without waists
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]] as const) {
        if (!on(x + dx, y + dy)) continue;
        if (dx !== 0 && dy !== 0 && (on(x + dx, y) || on(x, y + dy))) continue;
        add((cx(x) + cx(x + dx)) / 2 + rng.range(-0.5, 0.5), (cy(y) + cy(y + dy)) / 2 + rng.range(-0.5, 0.5), R * rng.range(0.8, 0.95), -0.5);
      }
      // cumulus tops: heaped billows where a stroke has open sky above it
      if (!this.o.cirrus && !on(x, y - 1)) {
        add(cx(x) + rng.range(-1.2, 1.2), cy(y) - C * 0.38, R * rng.range(1.05, 1.35), 1.6);
        if (rng.next() < 0.6) add(cx(x) + rng.range(-0.5, 0.5) * C, cy(y) - C * rng.range(0.55, 0.8), R * rng.range(0.6, 0.85), 2.4);
      }
      // a flatter, darker base under strokes with open sky below
      if (!this.o.cirrus && !on(x, y + 1)) add(cx(x) + rng.range(-1, 1), cy(y) + C * 0.3, R * 1.12, -1.5, 0.55);
      // wisps tear off the downwind (left) edge
      if (!on(x - 1, y)) this.edges.push([cx(x) - C * 0.4, cy(y)]);
    }
    // a few long thin strands under the word, like the stretched base of a real cloud bank
    if (!this.o.cirrus) {
      for (let i = 0; i < 5; i++) {
        const x = ML + rng.range(0.05, 0.95) * gw * C, y = MT + 7 * C + rng.range(-1, C * 0.9);
        this.puffs.push({ x, y, rx: rng.range(C * 1.6, C * 3.6), ry: rng.range(1.1, 1.8), z: -4, birth: birthAt(x) + 0.8, ph: rng.range(0, 6.28) });
      }
    }
    // back to front: lower billows first, the heaped tops last
    this.puffs.sort((a, b) => a.z - b.z);
    let last = 0;
    for (const p of this.puffs) last = Math.max(last, p.birth);
    this.done = last + 1.6;
  }

  /** skip the forming (keeps the breathing) */
  finish() {
    if (this.t < this.done) this.t = this.done;
    this.acc = 1;
  }
  /** 0..1 how formed it is */
  get formed() {
    return Math.min(1, this.t / this.done);
  }

  update(dt: number) {
    this.t += dt;
    this.acc += dt;
    // wisps: torn off the left edges once the word stands, drifting away downwind and thinning
    if (this.t > this.done - 1) {
      this.wispAcc += dt * this.o.wisps;
      while (this.wispAcc >= 1 && this.edges.length) {
        this.wispAcc--;
        const [x, y] = this.edges[Math.floor(this.rng.next() * this.edges.length)];
        const C = this.o.cell;
        this.wisps.push({ x: x + this.rng.range(-1, 1), y: y + this.rng.range(-C * 0.4, C * 0.4), rx: this.rng.range(C * 0.35, C * 0.6), ry: this.rng.range(C * 0.2, C * 0.35), z: -2, birth: this.t, ph: this.rng.range(0, 6), wisp: { vx: -this.rng.range(3, 7), life: 0, max: this.rng.range(3.5, 6.5) } });
      }
    }
    for (let i = this.wisps.length - 1; i >= 0; i--) {
      const w = this.wisps[i], s = w.wisp!;
      s.life += dt;
      w.x += s.vx * dt * (0.6 + s.life * 0.25);
      w.y += Math.sin(this.t * 0.7 + w.ph) * dt * 0.8;
      if (s.life >= s.max || w.x < 2) this.wisps.splice(i, 1);
    }
  }

  /** current geometry of a puff: centre, radii, coverage (forming / thinning) */
  private geo(p: Puff, t: number): [number, number, number, number, number] {
    if (p.wisp) {
      const s = p.wisp, k = s.life / s.max;
      const a = Math.min(1, s.life * 2) * (1 - k) * 0.85;
      // stretched out as it goes: longer and thinner
      return [p.x, p.y, p.rx * (1 + k * 1.6), p.ry * (1 - k * 0.55), a];
    }
    const k = Math.max(0, Math.min(1, (t - p.birth) / 1.6));
    if (k <= 0) return [0, 0, 0, 0, 0];
    const e = 1 - (1 - k) * (1 - k) * (1 - k);
    const breathe = 1 + Math.sin(t * 0.55 + p.ph) * 0.045;
    const r = (0.3 + 0.7 * e) * breathe;
    const x = p.x + (1 - e) * 34 + Math.sin(t * 0.31 + p.ph) * 0.45;
    const y = p.y - (1 - e) * 3 + Math.cos(t * 0.27 + p.ph * 1.3) * 0.35;
    return [x, y, p.rx * r, p.ry * r, Math.min(1, k * 1.7)];
  }

  private raster() {
    const W = this.w, H = this.h, hz = this.hz, own = this.own;
    hz.fill(-1e9);
    const t = this.t;
    const all = this.wisps.length ? [...this.wisps, ...this.puffs] : this.puffs;
    for (let i = 0; i < all.length; i++) {
      const p = all[i];
      const [cx, cy, rx, ry, a] = this.geo(p, t);
      if (rx < 0.6 || ry < 0.5 || a <= 0.02) continue;
      const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(W - 1, Math.ceil(cx + rx));
      const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(H - 1, Math.ceil(cy + ry));
      const rr = Math.min(rx, ry);
      for (let y = y0; y <= y1; y++) {
        const v = (y + 0.5 - cy) / ry;
        for (let x = x0; x <= x1; x++) {
          const u = (x + 0.5 - cx) / rx;
          const d2 = u * u + v * v;
          if (d2 >= 1) continue;
          if (a < 1 && bayer(x, y) >= a) continue;
          const h = Math.sqrt(1 - d2) * rr + p.z;
          const k = y * W + x;
          if (h > hz[k]) { hz[k] = h; own[k] = i; }
        }
      }
    }
    // the cloud as one body: the billows' heights, softened (two box blurs), give the surface its
    // slope, so neighbouring billows merge into one mass with bulges and creases
    const fa = this.fa, fb = this.fb;
    for (let k = 0; k < W * H; k++) fa[k] = hz[k] > -1e8 ? hz[k] + 3 : 0;
    const R = 2, n = R * 2 + 1;
    for (let y = 0; y < H; y++) {
      let acc = 0;
      const row = y * W;
      for (let x = -R; x <= R; x++) acc += x >= 0 && x < W ? fa[row + x] : 0;
      for (let x = 0; x < W; x++) {
        fb[row + x] = acc / n;
        const xo = x - R, xi = x + R + 1;
        if (xo >= 0) acc -= fa[row + xo];
        if (xi < W) acc += fa[row + xi];
      }
    }
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let y = -R; y <= R; y++) acc += y >= 0 && y < H ? fb[y * W + x] : 0;
      for (let y = 0; y < H; y++) {
        fa[y * W + x] = acc / n;
        const yo = y - R, yi = y + R + 1;
        if (yo >= 0) acc -= fb[yo * W + x];
        if (yi < H) acc += fb[yi * W + x];
      }
    }
    // shade: the sun low on the right (and a little below the cloud), the sky's light from above
    const Lx = 0.72, Ly = 0.12, Lz = 0.68;
    const d = this.buf.data, ramp = this.ramp, top = ramp.length - 1;
    const B = fa;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x;
      const h = hz[k];
      if (h < -1e8) { d[k] = 0; continue; }
      const bl = x > 0 ? B[k - 1] : 0, br = x + 1 < W ? B[k + 1] : 0, bu = y > 0 ? B[k - W] : 0, bd = y + 1 < H ? B[k + W] : 0;
      const gx = (br - bl) * 0.5, gy = (bd - bu) * 0.5;
      let nx = -gx * 0.55, ny = -gy * 0.55, nz = 1;
      const il = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= il; ny *= il; nz *= il;
      const lam = Math.max(0, nx * Lx + ny * Ly + nz * Lz);
      let val = lam * 0.9 + Math.max(0, -ny) * 0.16 - 0.06;
      // creases between billows (where the softened surface folds inward)
      const lap = bl + br + bu + bd - 4 * B[k];
      if (lap > 0.6) val -= Math.min(0.2, lap * 0.1);
      // billows nearer the sun shade this one
      const s1 = x + 3 < W ? hz[k + 3] : -1e9;
      if (s1 > h + 2.6) val -= 0.16;
      // a bright rim where the edge faces the sun
      if ((x + 1 >= W || hz[k + 1] < -1e8) && nx > 0) val = Math.max(val, 0.95);
      if (this.o.cirrus) val = 0.32 + val * 0.68;
      void own;
      const q = val * top + (bayer(x, y) - 0.5) * 0.55;
      d[k] = ramp[Math.max(0, Math.min(top, Math.round(q)))];
    }
  }

  draw(r: Renderer, x: number, y: number, alpha = 1) {
    if (this.acc >= 1 / 12) {
      this.acc = 0;
      this.raster();
      if (!this.frame) this.frame = bigFrame(r, this.buf);
      else this.frame.tex.subImage(0, 0, this.w, this.h, this.buf.bytes);
      this.uploaded = true;
    }
    if (!this.uploaded || !this.frame) return;
    r.draw(this.frame, Math.round(x), Math.round(y), 1, 1, 0, alpha >= 1 ? 0xffffffff : packColor(1, 1, 1, alpha));
  }
}

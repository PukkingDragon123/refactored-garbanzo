// world/ocean-kit.ts: shared runtime plumbing for the prologue sea drawables.
//
// API
//   export class Sheet            // packs many small PixelBuffers into a few GPU textures (freed on scene change)
//     add(buf, ax?, ay?): Frame   // frame is usable after upload(r)
//     upload(r): void             // idempotent; call before drawing (the drawables do it lazily)
//     readonly ready: boolean
//   export class Weather          // one shared state object for ocean, sky, rain and the giant wave
//     storm: number               // 0 calm .. 1 full storm
//     wind: number                // -1 blows toward -x (bow at +x means a head wind), +1 toward +x
//     lightning: number           // current flash brightness 0..~1.3 (driven by Sky)
//     time: number
//     sunX / sunY                 // sun position as a fraction of the view (screen space)
//     gust: number                // slow 0..1 gust noise
//     get windSpeed(): number     // signed px/s at the boat plane
//     update(dt)
//   export class Spray            // struct-of-arrays particle pool for spray / foam / splashes
//   export const col(r,g,b,a)     // packColor clamped

import type { Frame, Renderer } from '../gfx/renderer';
import { packColor } from '../gfx/renderer';
import { bigFrame } from '../gfx/atlas';
import { PixelBuffer } from '../art/pixel';
import { clamp, fbm1 } from '../core/math';

export const col = (r: number, g: number, b: number, a = 1) =>
  packColor(clamp(r), clamp(g), clamp(b), clamp(a));

const PAGE = 2048;
const PAD = 2;

interface Pending {
  buf: PixelBuffer;
  frame: Frame;
  page: number;
  x: number;
  y: number;
}

/** Shelf packer that turns sprite buffers into frames on a handful of big textures. */
export class Sheet {
  private items: Pending[] = [];
  private pages: { x: number; y: number; shelf: number }[] = [];
  ready = false;

  add(buf: PixelBuffer, ax = 0, ay = 0): Frame {
    const fr = { tex: null as unknown as Frame['tex'], u0: 0, v0: 0, u1: 1, v1: 1, w: buf.w, h: buf.h, ax, ay } as Frame;
    if (buf.w + PAD * 2 > PAGE || buf.h + PAD * 2 > PAGE) {
      this.items.push({ buf, frame: fr, page: -1, x: 0, y: 0 });
      return fr;
    }
    let pi = this.pages.length - 1;
    let p = this.pages[pi];
    if (!p) { p = { x: PAD, y: PAD, shelf: 0 }; this.pages.push(p); pi = 0; }
    if (p.x + buf.w + PAD > PAGE) { p.x = PAD; p.y += p.shelf + PAD; p.shelf = 0; }
    if (p.y + buf.h + PAD > PAGE) { p = { x: PAD, y: PAD, shelf: 0 }; this.pages.push(p); pi = this.pages.length - 1; }
    this.items.push({ buf, frame: fr, page: pi, x: p.x, y: p.y });
    p.x += buf.w + PAD;
    p.shelf = Math.max(p.shelf, buf.h);
    this.ready = false;
    return fr;
  }

  upload(r: Renderer) {
    if (this.ready) return;
    const n = this.pages.length;
    for (let pi = 0; pi < n; pi++) {
      const its = this.items.filter(it => it.page === pi && !it.frame.tex);
      if (!its.length) continue;
      const used = this.pages[pi];
      const H = Math.min(PAGE, used.y + used.shelf + PAD);
      const buf = new PixelBuffer(PAGE, H);
      for (const it of its) buf.blit(it.buf, it.x, it.y, false, false);
      const f = bigFrame(r, buf);
      for (const it of its) {
        const fr = it.frame;
        fr.tex = f.tex;
        fr.u0 = it.x / PAGE;
        fr.v0 = it.y / H;
        fr.u1 = (it.x + it.buf.w) / PAGE;
        fr.v1 = (it.y + it.buf.h) / H;
      }
    }
    for (const it of this.items) {
      if (it.page !== -1 || it.frame.tex) continue;
      const f = bigFrame(r, it.buf);
      it.frame.tex = f.tex;
    }
    // everything in pages already uploaded: start a fresh page for later additions
    if (this.pages.length) this.pages.push({ x: PAD, y: PAD, shelf: 0 });
    this.ready = true;
  }
}

/** Shared weather state. Scenes set `storm` (and optionally `wind`); everything else derives from it. */
export class Weather {
  storm = 0;
  wind = -1;
  time = 0;
  lightning = 0;
  /** screen-space sun position (fraction of VW, VH) */
  sunX = 0.72;
  sunY = 0.16;
  gust = 0;
  /** forward speed of the boat through the water, px/s at the boat plane (drives texture scroll) */
  cruise = 18;

  /** Signed wind speed in px/s at the boat plane. */
  get windSpeed() {
    const s = this.storm;
    return this.wind * (14 + s * s * 170) * (0.75 + this.gust * 0.5);
  }

  update(dt: number) {
    this.time += dt;
    this.gust = clamp(fbm1(this.time * 0.35, 3, 91) * 1.6 - 0.3);
  }
}

/** Compact particle pool (struct of arrays) for spray, foam flecks and splashes. */
export class Spray {
  readonly n: number;
  count = 0;
  x: Float32Array; y: Float32Array; vx: Float32Array; vy: Float32Array;
  t: Float32Array; life: Float32Array; size: Float32Array; kind: Uint8Array; rot: Float32Array;
  constructor(n = 600) {
    this.n = n;
    this.x = new Float32Array(n); this.y = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n);
    this.t = new Float32Array(n); this.life = new Float32Array(n);
    this.size = new Float32Array(n); this.kind = new Uint8Array(n); this.rot = new Float32Array(n);
  }
  spawn(x: number, y: number, vx: number, vy: number, life: number, size: number, kind: number) {
    if (this.count >= this.n) return;
    const i = this.count++;
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.t[i] = 0; this.life[i] = life; this.size[i] = size; this.kind[i] = kind; this.rot[i] = 0;
  }
  update(dt: number, gravity: number, drag: number, windX: number) {
    const k = Math.exp(-drag * dt);
    for (let i = this.count - 1; i >= 0; i--) {
      this.t[i] += dt;
      if (this.t[i] >= this.life[i]) {
        const j = --this.count;
        this.x[i] = this.x[j]; this.y[i] = this.y[j]; this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j];
        this.t[i] = this.t[j]; this.life[i] = this.life[j]; this.size[i] = this.size[j]; this.kind[i] = this.kind[j]; this.rot[i] = this.rot[j];
        continue;
      }
      // drag pulls velocity toward the wind
      this.vx[i] = windX + (this.vx[i] - windX) * k;
      this.vy[i] = this.vy[i] * k + gravity * dt * (this.kind[i] === 2 ? 0.15 : 1);
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
    }
  }
  clear() {
    this.count = 0;
  }
}

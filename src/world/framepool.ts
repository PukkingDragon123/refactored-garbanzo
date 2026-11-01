// A bounded store for sprite frames rendered on the fly (the live player's body, src/world/livebody.ts):
// frames are shelf-packed into a small ring of texture pages. When the ring is full, the oldest page is
// wiped and reused and the frames on it are forgotten (drawn again if they come back), so the memory
// stays fixed however many poses the motion visits.

import type { Frame, Renderer } from '../gfx/renderer';
import type { Texture } from '../gfx/gl';
import { PixelBuffer } from '../art/pixel';

interface Page { tex: Texture; buf: PixelBuffer; x: number; y: number; shelfH: number; keys: string[] }
const PAD = 2;

export class FramePool {
  private pages: Page[] = [];
  private cur = 0;
  private frames = new Map<string, Frame>();
  /** frames rendered since the pool was made, and pages recycled (for the debug readout) */
  added = 0;
  recycled = 0;

  constructor(private r: Renderer, readonly size = 1024, readonly count = 4) {}

  get(key: string): Frame | undefined { return this.frames.get(key); }
  /** frames held right now */
  get stored(): number { return this.frames.size; }

  /** store a frame (anchor ax, ay); null when it is too big for a page (the caller keeps it elsewhere) */
  add(key: string, src: PixelBuffer, ax: number, ay: number): Frame | null {
    if (src.w + PAD * 2 > this.size || src.h + PAD * 2 > this.size) return null;
    let p = this.page(this.cur);
    if (p.x + src.w + PAD > this.size) { p.x = PAD; p.y += p.shelfH + PAD; p.shelfH = 0; }
    if (p.y + src.h + PAD > this.size) {
      this.cur = (this.cur + 1) % this.count;
      p = this.page(this.cur);
      if (p.keys.length || p.y > PAD) this.wipe(p);
    }
    const x = p.x, y = p.y;
    p.buf.blit(src, x, y, false, false);
    // the frame and a clear ring round it (whatever an old frame left there never bleeds in)
    const x0 = x - 1, y0 = y - 1;
    p.tex.subImageFrom(x0, y0, src.w + 2, src.h + 2, p.buf.bytes, this.size);
    p.x += src.w + PAD;
    p.shelfH = Math.max(p.shelfH, src.h);
    const S = this.size;
    const f: Frame = { tex: p.tex, u0: x / S, v0: y / S, u1: (x + src.w) / S, v1: (y + src.h) / S, w: src.w, h: src.h, ax, ay };
    this.frames.set(key, f);
    p.keys.push(key);
    this.added++;
    return f;
  }

  private page(i: number): Page {
    let p = this.pages[i];
    if (!p) {
      const buf = new PixelBuffer(this.size, this.size);
      p = { tex: this.r.texture(this.size, this.size, buf.bytes), buf, x: PAD, y: PAD, shelfH: 0, keys: [] };
      this.pages[i] = p;
    }
    return p;
  }

  private wipe(p: Page) {
    for (const k of p.keys) this.frames.delete(k);
    p.keys = [];
    p.buf.clear(0);
    p.tex.subImage(0, 0, this.size, this.size, p.buf.bytes);
    p.x = PAD; p.y = PAD; p.shelfH = 0;
    this.recycled++;
  }
}

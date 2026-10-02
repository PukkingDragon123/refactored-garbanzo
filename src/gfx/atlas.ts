// Shelf-packed texture atlas for procedurally generated sprites.

import { PixelBuffer } from '../art/pixel';
import type { Frame, Renderer } from './renderer';
import { Texture } from './gl';

interface Page {
  tex: Texture;
  buf: PixelBuffer;
  x: number;
  y: number;
  shelfH: number;
  dirty: boolean;
  /** dirty rectangle (x0, y0, x1, y1) since the last upload */
  d: [number, number, number, number];
}

const PAD = 2;

export class Atlas {
  private pages: Page[] = [];
  private frames = new Map<string, Frame>();
  private anims = new Map<string, Frame[]>();

  constructor(readonly r: Renderer, readonly size = 2048) {}

  private newPage(): Page {
    const buf = new PixelBuffer(this.size, this.size);
    const tex = this.r.texture(this.size, this.size, null);
    const p: Page = { tex, buf, x: PAD, y: PAD, shelfH: 0, dirty: true, d: [0, 0, this.size, this.size] };
    this.pages.push(p);
    return p;
  }

  /** Add a sprite; (ax, ay) is its anchor/pivot in pixels. */
  add(name: string, src: PixelBuffer, ax = src.w / 2, ay = src.h): Frame {
    if (src.w + PAD * 2 > this.size || src.h + PAD * 2 > this.size) {
      // oversize: give it its own texture
      const tex = this.r.texture(src.w, src.h, src.bytes);
      const f: Frame = { tex, u0: 0, v0: 0, u1: 1, v1: 1, w: src.w, h: src.h, ax, ay };
      this.frames.set(name, f);
      return f;
    }
    let page = this.pages[this.pages.length - 1] ?? this.newPage();
    if (page.x + src.w + PAD > this.size) {
      page.x = PAD;
      page.y += page.shelfH + PAD;
      page.shelfH = 0;
    }
    if (page.y + src.h + PAD > this.size) {
      page = this.newPage();
    }
    const x = page.x, y = page.y;
    page.buf.blit(src, x, y, false, false);
    page.x += src.w + PAD;
    page.shelfH = Math.max(page.shelfH, src.h);
    const d = page.d;
    if (!page.dirty) { d[0] = x; d[1] = y; d[2] = x + src.w; d[3] = y + src.h; }
    else { d[0] = Math.min(d[0], x); d[1] = Math.min(d[1], y); d[2] = Math.max(d[2], x + src.w); d[3] = Math.max(d[3], y + src.h); }
    page.dirty = true;
    const S = this.size;
    const f: Frame = { tex: page.tex, u0: x / S, v0: y / S, u1: (x + src.w) / S, v1: (y + src.h) / S, w: src.w, h: src.h, ax, ay };
    this.frames.set(name, f);
    return f;
  }

  addAnim(name: string, srcs: PixelBuffer[], ax?: number, ay?: number): Frame[] {
    const out = srcs.map((s, i) => this.add(`${name}#${i}`, s, ax ?? s.w / 2, ay ?? s.h));
    this.anims.set(name, out);
    return out;
  }

  get(name: string): Frame {
    const f = this.frames.get(name);
    if (!f) throw new Error('Missing atlas frame: ' + name);
    return f;
  }
  has(name: string) {
    return this.frames.has(name);
  }
  anim(name: string): Frame[] {
    const a = this.anims.get(name);
    if (!a) throw new Error('Missing atlas anim: ' + name);
    return a;
  }

  upload() {
    for (const p of this.pages) {
      if (!p.dirty) continue;
      const [x0, y0, x1, y1] = p.d;
      if (x0 === 0 && y0 === 0 && x1 >= this.size && y1 >= this.size) p.tex.subImage(0, 0, this.size, this.size, p.buf.bytes);
      else p.tex.subImageFrom(x0, y0, x1 - x0, y1 - y0, p.buf.bytes, this.size);
      p.dirty = false;
    }
  }

  dispose() {
    for (const p of this.pages) p.tex.dispose();
    this.pages.length = 0;
    this.frames.clear();
    this.anims.clear();
  }
}

/** A sprite whose pixels are re-rasterised at runtime (procedural creatures). */
export class DynamicSprite {
  readonly buf: PixelBuffer;
  readonly tex: Texture;
  readonly frame: Frame;
  constructor(r: Renderer, w: number, h: number, ax = w / 2, ay = h / 2) {
    this.buf = new PixelBuffer(w, h);
    this.tex = r.texture(w, h, null);
    this.frame = { tex: this.tex, u0: 0, v0: 0, u1: 1, v1: 1, w, h, ax, ay };
  }
  upload() {
    this.tex.subImage(0, 0, this.buf.w, this.buf.h, this.buf.bytes);
  }
  dispose() {
    this.tex.dispose();
  }
}

const sceneTextures: Texture[] = [];
export function disposeSceneTextures() {
  for (const t of sceneTextures) t.dispose();
  sceneTextures.length = 0;
}

/** Free this texture on the next scene change (with the scene's other textures). */
export function trackSceneTexture(t: Texture) {
  sceneTextures.push(t);
  return t;
}

/** Upload a big standalone image (background layer) as a texture frame (freed on scene change). */
export function bigFrame(r: Renderer, buf: PixelBuffer, ax = 0, ay = 0): Frame {
  const tex = r.texture(buf.w, buf.h, buf.bytes);
  sceneTextures.push(tex);
  return { tex, u0: 0, v0: 0, u1: 1, v1: 1, w: buf.w, h: buf.h, ax, ay };
}

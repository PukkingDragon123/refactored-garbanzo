// PixelBuffer: a tiny software rasterizer for authoring pixel art procedurally.
// Everything is drawn without anti-aliasing so the result reads as hand-placed pixels.

import { A, B, C, G, R, rgba, shade } from './color';
import { bayer } from '../core/math';

export class PixelBuffer {
  readonly data: Uint32Array;
  readonly bytes: Uint8Array;

  readonly w: number;
  readonly h: number;
  constructor(w: number, h: number) {
    this.w = Math.max(1, Math.ceil(w));
    this.h = Math.max(1, Math.ceil(h));
    w = this.w;
    h = this.h;
    this.bytes = new Uint8Array(w * h * 4);
    this.data = new Uint32Array(this.bytes.buffer);
  }

  clone() {
    const p = new PixelBuffer(this.w, this.h);
    p.data.set(this.data);
    return p;
  }
  clear(c: C = 0) {
    this.data.fill(c);
  }
  inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  get(x: number, y: number): C {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[y * this.w + x];
  }
  set(x: number, y: number, c: C) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = c;
  }
  /** alpha-over blend */
  blend(x: number, y: number, c: C) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const a = A(c);
    if (a === 0) return;
    const i = y * this.w + x;
    if (a === 255) {
      this.data[i] = c;
      return;
    }
    const d = this.data[i];
    const da = A(d);
    const t = a / 255;
    const oa = a + da * (1 - t);
    if (oa <= 0) return;
    const k = da * (1 - t) / oa;
    const kt = a / oa;
    this.data[i] = rgba(R(c) * kt + R(d) * k, G(c) * kt + G(d) * k, B(c) * kt + B(d) * k, oa);
  }
  /** set only where the destination is already opaque (for painting details inside shapes) */
  paint(x: number, y: number, c: C) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (A(this.data[i]) > 0) this.data[i] = c;
  }
  opaque(x: number, y: number) {
    return A(this.get(x, y)) > 0;
  }

  rect(x: number, y: number, w: number, h: number, c: C) {
    const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.floor(x + w)), y1 = Math.min(this.h, Math.floor(y + h));
    for (let yy = y0; yy < y1; yy++) this.data.fill(c, yy * this.w + x0, yy * this.w + x1);
  }
  rectFn(x: number, y: number, w: number, h: number, fn: (x: number, y: number) => C | -1) {
    const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.floor(x + w)), y1 = Math.min(this.h, Math.floor(y + h));
    for (let yy = y0; yy < y1; yy++)
      for (let xx = x0; xx < x1; xx++) {
        const c = fn(xx, yy);
        if (c !== -1) this.data[yy * this.w + xx] = c;
      }
  }

  hline(x0: number, x1: number, y: number, c: C) {
    if (y < 0 || y >= this.h) return;
    const a = Math.max(0, Math.floor(Math.min(x0, x1))), b = Math.min(this.w - 1, Math.floor(Math.max(x0, x1)));
    if (b < a) return;
    this.data.fill(c, y * this.w + a, y * this.w + b + 1);
  }

  /** Filled disc; fn receives normalised offsets (-1..1) for shading. */
  discFn(cx: number, cy: number, r: number, fn: (x: number, y: number, nx: number, ny: number) => C | -1) {
    const r2 = r * r;
    const x0 = Math.floor(cx - r), x1 = Math.ceil(cx + r), y0 = Math.floor(cy - r), y1 = Math.ceil(cy + r);
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        if (dx * dx + dy * dy <= r2) {
          const c = fn(x, y, dx / r, dy / r);
          if (c !== -1) this.set(x, y, c);
        }
      }
    }
  }
  disc(cx: number, cy: number, r: number, c: C) {
    if (r < 0.75) {
      this.set(cx, cy, c);
      return;
    }
    this.discFn(cx, cy, r, () => c);
  }
  ellipseFn(cx: number, cy: number, rx: number, ry: number, fn: (x: number, y: number, nx: number, ny: number) => C | -1) {
    const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx), y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      const ny = (y + 0.5 - cy) / ry;
      for (let x = x0; x <= x1; x++) {
        const nx = (x + 0.5 - cx) / rx;
        if (nx * nx + ny * ny <= 1) {
          const c = fn(x, y, nx, ny);
          if (c !== -1) this.set(x, y, c);
        }
      }
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: C) {
    this.ellipseFn(cx, cy, rx, ry, () => c);
  }

  /**
   * Sphere-shaded disc using a colour ramp (dark -> light), light from upper-left by default,
   * with ordered dithering between bands.
   */
  shadedEllipse(cx: number, cy: number, rx: number, ry: number, ramp: C[], lx = -0.55, ly = -0.65, dither = true, bias = 0) {
    const lz = Math.sqrt(Math.max(0, 1 - lx * lx - ly * ly));
    const n = ramp.length;
    this.ellipseFn(cx, cy, rx, ry, (x, y, nx, ny) => {
      const d2 = nx * nx + ny * ny;
      const nz = Math.sqrt(Math.max(0, 1 - d2));
      let l = nx * lx + ny * ly + nz * lz;
      l = l * 0.5 + 0.5 + bias;
      let f = l * (n - 1);
      if (dither) f += (bayer(x, y) - 0.5) * 0.9;
      const i = Math.max(0, Math.min(n - 1, Math.round(f)));
      return ramp[i];
    });
  }

  line(x0: number, y0: number, x1: number, y1: number, c: C) {
    x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.floor(x1); y1 = Math.floor(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 10000; guard++) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  thickLine(x0: number, y0: number, x1: number, y1: number, r: number, c: C) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(len * 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, c);
    }
  }
  /** Tapered stroke along a polyline; r(t) gives radius, col(t) colour. */
  stroke(pts: [number, number][], r: (t: number) => number, col: (t: number, x: number, y: number) => C) {
    let total = 0;
    const seg: number[] = [0];
    for (let i = 1; i < pts.length; i++) {
      total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      seg.push(total);
    }
    if (total === 0) return;
    const steps = Math.ceil(total * 2);
    let j = 1;
    for (let s = 0; s <= steps; s++) {
      const d = (s / steps) * total;
      while (j < pts.length - 1 && seg[j] < d) j++;
      const k = (d - seg[j - 1]) / Math.max(1e-6, seg[j] - seg[j - 1]);
      const x = pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * k;
      const y = pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * k;
      const t = d / total;
      const rr = r(t);
      if (rr < 0.6) this.set(x, y, col(t, x, y));
      else this.discFn(x, y, rr, (px, py) => col(t, px, py));
    }
  }

  /** Scanline polygon fill (even-odd). pts = [x0,y0,x1,y1,...] */
  polyFn(pts: number[], fn: (x: number, y: number) => C | -1) {
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < pts.length; i += 2) {
      minY = Math.min(minY, pts[i]);
      maxY = Math.max(maxY, pts[i]);
    }
    const n = pts.length / 2;
    const xs: number[] = [];
    for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(this.h - 1, Math.ceil(maxY)); y++) {
      const sy = y + 0.5;
      xs.length = 0;
      for (let i = 0; i < n; i++) {
        const ax = pts[i * 2], ay = pts[i * 2 + 1];
        const bx = pts[((i + 1) % n) * 2], by = pts[((i + 1) % n) * 2 + 1];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) {
          xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const x0 = Math.max(0, Math.round(xs[k])), x1 = Math.min(this.w - 1, Math.round(xs[k + 1]) - 1);
        for (let x = x0; x <= x1; x++) {
          const c = fn(x, y);
          if (c !== -1) this.data[y * this.w + x] = c;
        }
      }
    }
  }
  poly(pts: number[], c: C) {
    this.polyFn(pts, () => c);
  }

  /** Add a 1px outline on transparent pixels bordering opaque ones. */
  outline(c: C | ((inner: C) => C), diagonal = false) {
    const w = this.w, h = this.h, d = this.data;
    const src = d.slice();
    const op = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] >>> 24 > 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (src[y * w + x] >>> 24 > 0) continue;
        let nb = -1;
        if (op(x - 1, y)) nb = (y * w + x - 1);
        else if (op(x + 1, y)) nb = (y * w + x + 1);
        else if (op(x, y - 1)) nb = ((y - 1) * w + x);
        else if (op(x, y + 1)) nb = ((y + 1) * w + x);
        else if (diagonal) {
          if (op(x - 1, y - 1)) nb = (y - 1) * w + x - 1;
          else if (op(x + 1, y - 1)) nb = (y - 1) * w + x + 1;
          else if (op(x - 1, y + 1)) nb = (y + 1) * w + x - 1;
          else if (op(x + 1, y + 1)) nb = (y + 1) * w + x + 1;
        }
        if (nb >= 0) d[y * w + x] = typeof c === 'function' ? c(src[nb]) : c;
      }
  }
  /** Darken the outermost opaque pixels (selective inner outline). */
  innerEdge(fn: (c: C, x: number, y: number, side: number) => C) {
    const w = this.w, h = this.h, d = this.data;
    const src = d.slice();
    const tr = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h || src[y * w + x] >>> 24 === 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const c = src[y * w + x];
        if (c >>> 24 === 0) continue;
        // side: bit0 top, bit1 bottom, bit2 left, bit3 right exposed
        const side = (tr(x, y - 1) ? 1 : 0) | (tr(x, y + 1) ? 2 : 0) | (tr(x - 1, y) ? 4 : 0) | (tr(x + 1, y) ? 8 : 0);
        if (side) d[y * w + x] = fn(c, x, y, side);
      }
  }
  /** Light the top/left exposed edges and darken bottom/right ones: cheap rim shading. */
  rim(light = 0.25, dark = -0.25) {
    this.innerEdge((c, _x, _y, side) => {
      if (side & 1) return shade(c, light);
      if (side & 2) return shade(c, dark);
      return c;
    });
  }

  blit(src: PixelBuffer, dx: number, dy: number, flipX = false, alphaBlend = true) {
    dx = Math.floor(dx); dy = Math.floor(dy);
    for (let y = 0; y < src.h; y++) {
      const ty = dy + y;
      if (ty < 0 || ty >= this.h) continue;
      for (let x = 0; x < src.w; x++) {
        const tx = dx + x;
        if (tx < 0 || tx >= this.w) continue;
        const c = src.data[y * src.w + (flipX ? src.w - 1 - x : x)];
        if (c >>> 24 === 0) continue;
        if (alphaBlend) this.blend(tx, ty, c);
        else this.data[ty * this.w + tx] = c;
      }
    }
  }

  /** Apply fn to every opaque pixel. */
  map(fn: (c: C, x: number, y: number) => C) {
    const w = this.w, d = this.data;
    for (let i = 0; i < d.length; i++) {
      const c = d[i];
      if (c >>> 24 === 0) continue;
      d[i] = fn(c, i % w, (i / w) | 0);
    }
  }

  /** Trim transparent borders; returns new buffer plus the offset of the crop. */
  trim(pad = 0): { buf: PixelBuffer; ox: number; oy: number } {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (this.data[y * this.w + x] >>> 24) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    if (x1 < 0) return { buf: new PixelBuffer(1, 1), ox: 0, oy: 0 };
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
    x1 = Math.min(this.w - 1, x1 + pad); y1 = Math.min(this.h - 1, y1 + pad);
    const out = new PixelBuffer(x1 - x0 + 1, y1 - y0 + 1);
    for (let y = y0; y <= y1; y++) out.data.set(this.data.subarray(y * this.w + x0, y * this.w + x1 + 1), (y - y0) * out.w);
    return { buf: out, ox: x0, oy: y0 };
  }

  toCanvas(scale = 1): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w * scale;
    c.height = this.h * scale;
    const ctx = c.getContext('2d')!;
    const arr = new Uint8ClampedArray(this.w * this.h * 4);
    arr.set(this.bytes);
    const id = new ImageData(arr, this.w, this.h);
    if (scale === 1) ctx.putImageData(id, 0, 0);
    else {
      const t = document.createElement('canvas');
      t.width = this.w;
      t.height = this.h;
      t.getContext('2d')!.putImageData(id, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(t, 0, 0, c.width, c.height);
    }
    return c;
  }
  toDataURL(scale = 1) {
    return this.toCanvas(scale).toDataURL('image/png');
  }
}

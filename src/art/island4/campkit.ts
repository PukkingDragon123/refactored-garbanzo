// Camp art kit: the painter behind the island camp props (src/art/island4/camp.ts and the V10 additions
// in src/game/v10/campart.ts). Every prop is painted at full res into a canvas with generous margins,
// lit by a key light from the sun's side of the sky (painted twice, sun in the east and sun in the
// west, so the island's clock can cross-fade between them), with hue-shifted ramps, ordered-dither
// transitions, ambient occlusion where it meets the sand, a rim on the sunlit edge and a selective
// outline (dark on the shadow side, soft on the lit side) like the V9 beach props. Cloth, rope ends
// and anything hanging is painted for a short cycle of wind phases (calm and gusting) so the props
// ripple with the island's wind by flipping cached frames: no per-frame repaints.

import { PixelBuffer } from '../pixel';
import { C, hex, mix, shade, withAlpha } from '../color';
import { bayer, clamp, hash2, noise1, noise2 } from '../../core/math';

export type Ramp = C[];
export const ramp = (...h: string[]): Ramp => h.map(x => hex(x));

/** a camp prop: the frame, its anchor (ground contact), optional emissive layer, wind frames, the
 *  west-lit twin and the contact shadow it casts on the sand */
export interface CampSprite {
  buf: PixelBuffer; ax: number; ay: number; glow?: PixelBuffer;
  /** wind cycle in light air / in a gust (same size and anchor as buf) */
  wind?: PixelBuffer[]; gust?: PixelBuffer[];
  /** the same prop with the sun on the right (afternoon and dusk) */
  alt?: { buf: PixelBuffer; wind?: PixelBuffer[]; gust?: PixelBuffer[] };
  /** soft contact shadow under it: width in px (and optional depth / strength / x offset) */
  shadow?: { w: number; h?: number; a?: number; dx?: number };
}

/** how one frame is painted: the sun's side (-1 east/left, 1 west/right), the wind phase (0..1 of a
 *  ripple cycle) and the wind strength (0 still .. 1 gusting) */
export interface Look { lx: number; ph: number; amp: number }

// ------------------------------------------------------------------ palettes (dark -> light, hue-shifted)

export const RP = {
  /** the Kittiwake's spare mainsail: rust-red sailcloth */
  sail: ramp('#2a1016', '#43171b', '#62211f', '#842e25', '#a33e2b', '#bd5233', '#d46d43', '#e8925e', '#f4b98a'),
  /** Jenna and Joshu's dome tent */
  dome: ramp('#121836', '#1a2650', '#22366e', '#2c4a8e', '#3a60aa', '#4c78c2', '#6894d4', '#90b4e4', '#c2d8f2'),
  /** high-vis orange (the dome's fly band, Mori's sleeping bag, floats) */
  orange: ramp('#3e1408', '#6a220c', '#9a3410', '#c84c18', '#e46826', '#f48a40', '#fcae68', '#ffd4a0'),
  /** the green deck tarp over the stores */
  tarp: ramp('#0e1c1a', '#162c26', '#204032', '#2c5640', '#3a6c4e', '#4c845e', '#66a072', '#8cbc8c'),
  /** bleached driftwood */
  drift: ramp('#2a2420', '#433b34', '#605548', '#7e705f', '#9c8d79', '#b8aa94', '#d0c4ae', '#e6dece'),
  /** sawn crate pine and hatch boards */
  wood: ramp('#1e140c', '#311f12', '#47301b', '#5f4125', '#7a5532', '#946b42', '#ae8556', '#c8a274'),
  /** dark ship's timber */
  teak: ramp('#160d0a', '#251510', '#381f16', '#4c2b1d', '#623a27', '#7a4c33', '#946242'),
  /** bark on the log seats */
  bark: ramp('#1e1611', '#33261c', '#4a3828', '#624c36', '#7a6146', '#937a5a', '#ac9470'),
  rope: ramp('#33261a', '#523e28', '#755a38', '#987848', '#b8975e', '#d4b47c', '#ead2a2'),
  steel: ramp('#15191e', '#232a31', '#353f47', '#4c5860', '#66737b', '#86939a', '#a8b4ba', '#d2dade', '#f2f6f8'),
  /** sooted cast iron and blackened pots */
  iron: ramp('#0e0c0e', '#1a1719', '#272224', '#363032', '#474043', '#5c5456', '#787073'),
  stone: ramp('#1f1d1d', '#34302e', '#4b4642', '#625c56', '#7a736b', '#948c83', '#aea69c', '#c8c2b8'),
  /** harakeke (flax), green to dry gold */
  flax: ramp('#141c0c', '#212e12', '#314218', '#42571d', '#556c22', '#6b8229', '#839835', '#a2ae48', '#c4c466'),
  flaxDry: ramp('#2e2410', '#4a3a18', '#6a5422', '#8a6e2e', '#a8883c', '#c4a452', '#dcc070', '#eedc9a'),
  paper: ramp('#5a5244', '#857b66', '#ada38a', '#cbc2a6', '#e2dac0', '#f2ecd8', '#fbf8ee'),
  cream: ramp('#4e4a42', '#76705f', '#9e9783', '#c2bba5', '#ddd7c4', '#efeadc', '#fbf8f0'),
  /** the white chilly bin and plastic */
  white: ramp('#4c5052', '#6e7476', '#949a9a', '#b8bcba', '#d4d6d2', '#e8e9e4', '#f8f8f4'),
  fish: ramp('#232e34', '#3a4a52', '#566a72', '#7a9096', '#a2b6b8', '#c8d8d8', '#eef6f4'),
  blue: ramp('#0c1a32', '#14284c', '#1e3c6c', '#2a548e', '#3a6cae', '#5288c8', '#76a6dc', '#a4c6ec'),
  red: ramp('#2c0c0c', '#4a1412', '#6e1e18', '#962a20', '#b83a2a', '#d4523a', '#e8765a'),
  olive: ramp('#151a0c', '#232b14', '#33401c', '#465626', '#5a6c32', '#73853f', '#90a050'),
  brass: ramp('#2e1e08', '#4e3410', '#74501a', '#9a6e26', '#c08e34', '#dcb04c', '#f0d47a', '#fff0b8'),
  glass: ramp('#14262e', '#1e3a46', '#2c5462', '#3e7080', '#5a8e9c', '#80aeb8', '#b0d0d4', '#e2f2f2'),
  black: ramp('#0e0d12', '#18161e', '#24212a', '#322e38', '#433e48', '#57525c', '#6e6a74'),
  ash: ramp('#1a1614', '#2c2622', '#403834', '#58504a', '#726a62', '#8e867e', '#aaa49c'),
  sand: ramp('#5e4c34', '#7a6446', '#967e5a', '#ae966c', '#c4ac80', '#d6c092', '#e4d0a6'),
};

export const OUTLINE = hex('#140e12');

// ------------------------------------------------------------------ the canvas

export class Cv {
  readonly b: PixelBuffer;
  /** normalized key light (x right, y down, z toward the camera) */
  readonly L: [number, number, number];
  constructor(readonly w: number, readonly h: number, readonly k: Look) {
    this.b = new PixelBuffer(w, h);
    const l = [k.lx * 0.62, -0.74, 0.38], m = Math.hypot(l[0], l[1], l[2]);
    this.L = [l[0] / m, l[1] / m, l[2] / m];
  }
  get lx() { return this.k.lx; }
  /** wind displacement helper: a travelling wave (to the right, the way the wind blows) */
  wave(u: number, freq = 1, speed = 1) { return Math.sin((this.k.ph * speed - u * freq) * Math.PI * 2); }
  set(x: number, y: number, c: C) { this.b.set(x, y, c); }
  get(x: number, y: number) { return this.b.get(x, y); }
  op(x: number, y: number) { return (this.b.get(x, y) >>> 24) > 0; }
  /** light from a surface normal (not necessarily unit), 0..1 with ambient */
  lam(nx: number, ny: number, nz: number, amb = 0.26) {
    const m = Math.hypot(nx, ny, nz) || 1;
    const d = (nx * this.L[0] + ny * this.L[1] + nz * this.L[2]) / m;
    return amb + Math.max(0, d) * (1 - amb) + Math.min(0, d) * amb * 0.5;
  }
  /** light for a surface given as a height field z(x, y) toward the camera */
  field(z: (x: number, y: number) => number, x: number, y: number, k = 1, amb = 0.26) {
    const gx = (z(x + 0.5, y) - z(x - 0.5, y)) * k, gy = (z(x, y + 0.5) - z(x, y - 0.5)) * k;
    return this.lam(-gx, -gy, 1, amb);
  }
  tone(rp: Ramp, l: number, x: number, y: number, dither = 0.55): C {
    return rp[clamp(Math.round(l * (rp.length - 1) + (bayer(x, y) - 0.5) * dither), 0, rp.length - 1)];
  }
  t(x: number, y: number, rp: Ramp, l: number, dither = 0.55) { this.set(x, y, this.tone(rp, l, x, y, dither)); }
  rect(x: number, y: number, w: number, h: number, fn: C | ((x: number, y: number, u: number, v: number) => C | -1)) {
    for (let j = Math.floor(y); j < Math.floor(y + h); j++) for (let i = Math.floor(x); i < Math.floor(x + w); i++) {
      const c = typeof fn === 'function' ? fn(i, j, (i - x) / Math.max(1, w - 1), (j - y) / Math.max(1, h - 1)) : fn;
      if (c !== -1) this.set(i, j, c);
    }
  }
  poly(pts: number[], fn: C | ((x: number, y: number) => C | -1)) {
    let y0 = 1e9, y1 = -1e9;
    for (let i = 1; i < pts.length; i += 2) { y0 = Math.min(y0, pts[i]); y1 = Math.max(y1, pts[i]); }
    const n = pts.length / 2;
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const sy = y + 0.5, xs: number[] = [];
      for (let i = 0; i < n; i++) {
        const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[((i + 1) % n) * 2], by = pts[((i + 1) % n) * 2 + 1];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let q = 0; q + 1 < xs.length; q += 2)
        for (let x = Math.round(xs[q]); x < Math.round(xs[q + 1]); x++) {
          const c = typeof fn === 'function' ? fn(x, y) : fn;
          if (c !== -1) this.set(x, y, c);
        }
    }
  }
  ell(cx: number, cy: number, rx: number, ry: number, fn: C | ((nx: number, ny: number, x: number, y: number) => C | -1)) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const c = typeof fn === 'function' ? fn(nx, ny, x, y) : fn;
      if (c !== -1) this.set(x, y, c);
    }
  }
  /** a shaded ball / lump (stones, sacks, floats): sphere normals, optional flattening of the base */
  ball(cx: number, cy: number, rx: number, ry: number, rp: Ramp, o: { flat?: number; tex?: (x: number, y: number) => number; dither?: number } = {}) {
    this.ell(cx, cy, rx, ry, (nx, ny, x, y) => {
      const q = 1 - nx * nx - ny * ny, nz = Math.sqrt(Math.max(0, q));
      let l = this.lam(nx, ny * (o.flat && ny > 0 ? 1 + o.flat : 1), nz + 0.15);
      l += (o.tex?.(x, y) ?? 0);
      if (ny > 0.55) l -= (ny - 0.55) * 0.5; // the underside, in its own shadow
      return this.tone(rp, l, x, y, o.dither ?? 0.6);
    });
  }
  /** pixel line with a per-pixel colour callback (t = 0..1 along it) */
  line(x0: number, y0: number, x1: number, y1: number, fn: C | ((t: number, x: number, y: number) => C | -1)) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
      const c = typeof fn === 'function' ? fn(t, x, y) : fn;
      if (c !== -1) this.set(x, y, c);
    }
  }
  /** a rope along a polyline: the lay of the strands shows as alternating light and dark pixels */
  rope(pts: [number, number][], rp: Ramp = RP.rope, l = 0.6, thick = 1) {
    let s = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
      for (let j = 0; j <= n; j++, s++) {
        const t = j / n, x = Math.round(ax + (bx - ax) * t), y = Math.round(ay + (by - ay) * t);
        const lay = s % 3 === 0 ? -0.18 : s % 3 === 1 ? 0.1 : 0;
        this.set(x, y, this.tone(rp, l + lay, x, y, 0.2));
        if (thick > 1) this.set(x, y + 1, this.tone(rp, l - 0.25 + lay * 0.5, x, y + 1, 0.2));
      }
    }
  }
  /** a thin taut cord (guy line) for after the outline: dark enough to read on sand, lighter where lit */
  cord(x0: number, y0: number, x1: number, y1: number, sag = 0) {
    const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag);
      this.set(x, y, i % 3 === 0 ? RP.rope[2] : RP.rope[1]);
    }
  }
  /** a sagging line between two points (rope, wire, washing line): points along a parabola */
  sagPts(x0: number, y0: number, x1: number, y1: number, sag: number, n = 12): [number, number][] {
    const out: [number, number][] = [];
    for (let i = 0; i <= n; i++) { const t = i / n; out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag]); }
    return out;
  }
  /** a round pole / log from (x0,y0) to (x1,y1) of radius r, shaded across its girth, with grain */
  cyl(x0: number, y0: number, x1: number, y1: number, r: number, rp: Ramp, o: { grain?: number; seed?: number; knots?: number; lift?: number } = {}) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, px = -uy, py = ux; // across-axis (perp) unit
    const minX = Math.floor(Math.min(x0, x1) - r - 1), maxX = Math.ceil(Math.max(x0, x1) + r + 1);
    const minY = Math.floor(Math.min(y0, y1) - r - 1), maxY = Math.ceil(Math.max(y0, y1) + r + 1);
    const seed = o.seed ?? 3;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const rx = x + 0.5 - x0, ry = y + 0.5 - y0;
      const s = rx * ux + ry * uy, v = rx * px + ry * py;
      if (s < -0.5 || s > len + 0.5 || Math.abs(v) > r) continue;
      const q = v / r, nz = Math.sqrt(Math.max(0, 1 - q * q));
      // normal across the girth (perp direction in screen), toward the camera at the middle
      let l = this.lam(px * q, py * q, nz) + (o.lift ?? 0);
      if (o.grain) l += (noise2(s * 0.12, v * 0.9 + 3, seed) - 0.5) * o.grain + (hash2(Math.floor(s / 2), Math.round(v), seed) < 0.08 ? -0.12 : 0);
      if (o.knots && hash2(Math.floor(s / 7), 0, seed + 9) < o.knots && Math.abs((s % 7) - 3.5) < 1 && Math.abs(q) < 0.6) l -= 0.25;
      this.t(x, y, rp, l, 0.5);
    }
  }
  /** a lashing: tight turns of rope wrapped round a joint at (x, y), n turns, slanted */
  lash(x: number, y: number, n = 3, w = 3, slant = 1) {
    for (let i = 0; i < n; i++) for (let k = -w; k <= w; k++) {
      const yy = y - n + i * 2 + Math.round(k * 0.3 * slant);
      this.set(x + k, yy, this.tone(RP.rope, 0.72 - Math.abs(k) / w * 0.3 + (k * this.lx > 0 ? 0.1 : 0), x + k, yy, 0.2));
      this.set(x + k, yy + 1, this.tone(RP.rope, 0.35, x + k, yy + 1, 0.2));
    }
  }
  /** something hanging from (x0, y0), swung by `ang` radians toward +x: fn(u along 0..1, v across -1..1)
   *  paints it; hw(u) is its half width in px */
  hang(x0: number, y0: number, len: number, ang: number, hw: (u: number) => number, fn: (u: number, v: number, x: number, y: number) => C | -1) {
    const sa = Math.sin(ang), ca = Math.cos(ang), R = len + 6;
    for (let y = Math.floor(y0 - 2); y <= Math.ceil(y0 + R); y++) for (let x = Math.floor(x0 - R); x <= Math.ceil(x0 + R); x++) {
      const dx = x + 0.5 - x0, dy = y + 0.5 - y0;
      const a = dx * sa + dy * ca, c = dx * ca - dy * sa;
      const u = a / len;
      if (u < 0 || u > 1) continue;
      const w = hw(u);
      if (w <= 0 || Math.abs(c) > w) continue;
      const col = fn(u, c / w, x, y);
      if (col !== -1) this.set(x, y, col);
    }
  }
  /** a strip of cloth streaming downwind (+x) from (x0, y0): a pennant, a rag, a ribbon. It ripples with
   *  the frame's wind phase; w0/w1 = width at the hoist / the tail; droop = how far the tail sags (px) */
  streamer(x0: number, y0: number, len: number, w0: number, w1: number, rp: Ramp, o: { droop?: number; flap?: number; seed?: number; stripe?: (u: number, v: number) => number } = {}) {
    const amp = this.k.amp, droop = (o.droop ?? 4) * (1.25 - amp * 0.75), flap = (o.flap ?? 2.2) * (0.4 + amp);
    const L = len * (0.8 + amp * 0.2);
    const yc = (u: number) => y0 + u * u * droop + this.wave(u, 1.1, 1) * flap * u;
    for (let i = 0; i <= L * 2; i++) {
      const u = i / (L * 2), x = x0 + u * L;
      const w = w0 + (w1 - w0) * u, c = yc(u), slope = (yc(u + 0.02) - yc(u - 0.02)) / 0.04 / L;
      for (let v = -w / 2; v <= w / 2; v += 0.5) {
        const px = Math.round(x), py = Math.round(c + v);
        let l = 0.55 - slope * 1.6 * -this.lx * 0.5 - slope * 0.9 + (v < 0 ? 0.08 : -0.06);
        if (o.stripe) { const s = o.stripe(u, v / Math.max(0.5, w / 2)); if (s > 4) { this.set(px, py, s as C); continue; } l += s; }
        this.t(px, py, rp, l, 0.4);
      }
    }
  }
  /** a nail head */
  nail(x: number, y: number) { this.set(x, y, RP.steel[5]); this.set(x + (this.lx > 0 ? -1 : 1), y + 1, RP.steel[1]); }
  /** a tent peg driven into the sand, slanted away from the tent; returns the head position */
  peg(x: number, y: number, dir: number): [number, number] {
    for (let i = 0; i < 5; i++) this.set(x - dir * Math.floor(i / 2), y - 4 + i, this.tone(RP.wood, i < 2 ? 0.8 : 0.5, x, y + i, 0.2));
    this.set(x + dir, y - 4, RP.wood[6]);
    return [x, y - 4];
  }
  /** ambient occlusion at the foot of the prop: darken opaque pixels just above the ground line, dithered */
  ao(gy: number, h = 4, k = 0.32, x0 = 0, x1 = this.w) {
    for (let y = Math.floor(gy - h); y <= gy; y++) for (let x = x0; x < x1; x++) {
      const c = this.get(x, y);
      if (!(c >>> 24)) continue;
      const t = clamp(1 - (gy - y) / h);
      if (t * t + (bayer(x, y) - 0.5) * 0.35 > 0.12) this.set(x, y, shade(c, -k * t));
    }
  }
  /** darken whatever is painted inside a soft ellipse (shade under an overhang, a crate's shadow on the next) */
  occlude(cx: number, cy: number, rx: number, ry: number, k = 0.3) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const c = this.get(x, y);
      if (!(c >>> 24)) continue;
      const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (q > 1) continue;
      const t = 1 - q;
      if (t + (bayer(x, y) - 0.5) * 0.4 > 0.15) this.set(x, y, shade(c, -k * Math.min(1, t * 1.6)));
    }
  }
  /** an alpha-dithered contact shadow on the sand (only into empty pixels, darkest at the foot) */
  contact(cx: number, gy: number, rx: number, ry = 2.2, a = 120) {
    for (let y = Math.floor(gy - 1); y <= gy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (this.op(x, y)) continue;
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - gy) / ry, q = nx * nx + Math.max(0, ny) ** 2;
      if (q > 1) continue;
      const t = 1 - q;
      if (bayer(x, y) < t * 1.4) this.set(x, y, withAlpha(hex('#1a120c'), Math.round(a * Math.min(1, t * 1.3))));
    }
  }
  /** a rim of light along the sunlit outer edge, and a little sky light on the tops */
  rim(k = 0.16, warm = hex('#fff2d6')) {
    const W = this.w, H = this.h, src = this.b.data.slice();
    const op = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && (src[y * W + x] >>> 24) > 200;
    const sx = this.lx < 0 ? -1 : 1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = src[y * W + x];
      if ((c >>> 24) <= 200) continue;
      const side = !op(x + sx, y), top = !op(x, y - 1);
      if (side && top) this.b.data[y * W + x] = mix(c, warm, k * 1.5);
      else if (side) this.b.data[y * W + x] = mix(c, warm, k);
      else if (top) this.b.data[y * W + x] = mix(c, warm, k * 0.6);
    }
  }
  /** selective outline: dark on the shadow side and underneath, a soft darkened edge on the lit side */
  outline(dark = 0.62, lit = 0.34) {
    const W = this.w, H = this.h, d = this.b.data, src = d.slice();
    const op = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && (src[y * W + x] >>> 24) > 160;
    const sx = this.lx < 0 ? 1 : -1; // the shadow side
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if ((src[y * W + x] >>> 24) > 160) continue;
      // neighbour on the lit side or above = this pixel lies on the shadow side / below the shape
      let nb = -1, sh = false;
      if (op(x, y - 1)) { nb = (y - 1) * W + x; sh = true; }
      else if (op(x - sx, y)) { nb = y * W + x - sx; sh = true; }
      else if (op(x + sx, y)) nb = y * W + x + sx;
      else if (op(x, y + 1)) nb = (y + 1) * W + x;
      if (nb < 0) continue;
      const c = src[nb] | 0xff000000;
      d[y * W + x] = sh ? mix(shade(c, -0.7), OUTLINE, dark) : mix(shade(c, -0.45), OUTLINE, lit);
    }
  }
}

/** the finished painting of one frame (anchor in canvas pixels) */
export interface Raw { cv: Cv; ax: number; ay: number; glow?: PixelBuffer; noRim?: boolean; /** fine detail painted after the outline (thin guy lines) */ post?: (cv: Cv) => void }

/** paint a prop for both suns (and a wind cycle when it has cloth): returns a ready CampSprite with every
 *  frame trimmed to their common bounds so they share one anchor. The contact shadow width is optional. */
export function build(paint: (k: Look) => Raw, o: { frames?: number; shadow?: CampSprite['shadow']; still?: boolean } = {}): CampSprite {
  const n = o.frames ?? 0;
  const finish = (r: Raw) => { if (!r.noRim) r.cv.rim(); r.cv.outline(); r.post?.(r.cv); return r; };
  const side = (lx: number) => {
    if (!n) { const r = finish(paint({ lx, ph: 0, amp: o.still ? 0 : 0.35 })); return { base: r, wind: undefined as Raw[] | undefined, gust: undefined as Raw[] | undefined }; }
    const wind = Array.from({ length: n }, (_, i) => finish(paint({ lx, ph: i / n, amp: 0.45 })));
    const gust = Array.from({ length: n }, (_, i) => finish(paint({ lx, ph: i / n, amp: 1 })));
    return { base: wind[0], wind, gust };
  };
  const E = side(-1), W = side(1);
  // common bounds
  const all = [E.base, W.base, ...(E.wind ?? []), ...(E.gust ?? []), ...(W.wind ?? []), ...(W.gust ?? [])];
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (const r of all) {
    const b = r.cv.b;
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (b.data[y * b.w + x] >>> 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 0; }
  x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1);
  const ref = E.base.cv.b;
  x1 = Math.min(ref.w - 1, x1 + 1); y1 = Math.min(ref.h - 1, y1 + 1);
  const crop = (b: PixelBuffer) => {
    const out = new PixelBuffer(x1 - x0 + 1, y1 - y0 + 1);
    for (let y = y0; y <= y1; y++) out.data.set(b.data.subarray(y * b.w + x0, y * b.w + x1 + 1), (y - y0) * out.w);
    return out;
  };
  const cl = (rs?: Raw[]) => rs?.map(r => crop(r.cv.b));
  return {
    buf: crop(E.base.cv.b), ax: Math.round(E.base.ax) - x0, ay: Math.round(E.base.ay) - y0,
    glow: E.base.glow ? crop(E.base.glow) : undefined,
    wind: cl(E.wind), gust: cl(E.gust),
    alt: { buf: crop(W.base.cv.b), wind: cl(W.wind), gust: cl(W.gust) },
    shadow: o.shadow,
  };
}

/** painters are deterministic: paint each prop once per session (the island rebuilds on every visit) */
const CACHE = new Map<string, unknown>();
export function cached<A extends unknown[], R>(name: string, f: (...a: A) => R): (...a: A) => R {
  return (...a: A) => {
    const key = name + JSON.stringify(a);
    let v = CACHE.get(key) as R | undefined;
    if (v === undefined) { v = f(...a); CACHE.set(key, v); }
    return v;
  };
}

// ------------------------------------------------------------------ materials

/** sawn wood: grain streaks along u, with the odd knot; returns a lightness offset */
export function grain(u: number, v: number, seed: number, k = 1) {
  const g = noise2(u * 0.09, v * 0.75 + seed, seed) - 0.5;
  const streak = Math.abs(((v + noise1(u * 0.06, seed + 4) * 2.4) % 2.2 + 2.2) % 2.2 - 1.1) < 0.28 ? -0.09 : 0;
  return (g * 0.18 + streak) * k;
}

/** a painted stencil from a little bitmap of '#' (pixel-art labels and icons, no text) */
export function stencil(cv: Cv, x: number, y: number, rows: string[], c: C, worn = 0.15, seed = 1) {
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#' && hash2(x + i, y + j, seed) > worn) cv.set(x + i, y + j, mix(cv.get(x + i, y + j) | 0xff000000, c, 0.75)); });
}

/** an oblique box (crate / chest): front face w x h at (x, y top-left of the front), depth d going up-right.
 *  face(face, u, v, px, py) gives a lightness offset or a colour; returns the front's corners. */
export function obox(cv: Cv, x: number, y: number, w: number, h: number, d: number, rp: Ramp,
  o: { planks?: number; seed?: number; tex?: (face: 'front' | 'top' | 'side', u: number, v: number, px: number, py: number) => number | C | null } = {}) {
  const ox = Math.round(d * 0.7), oy = Math.round(d * 0.55);
  const seed = o.seed ?? 5;
  const lF = cv.lam(0, 0, 1), lT = cv.lam(0, -1, 0.15), lS = cv.lam(1, 0, 0.15);
  const pk = o.planks ?? 0;
  const paint = (face: 'front' | 'top' | 'side', u: number, v: number, px: number, py: number, base: number) => {
    const r = o.tex?.(face, u, v, px, py);
    if (typeof r === 'number' && r > 4) { cv.set(px, py, r as C); return; }
    let l = base + (typeof r === 'number' ? r : 0);
    l += grain(face === 'side' ? v * 8 : u * 8, face === 'top' ? v * 4 : v * h, seed + (face === 'top' ? 7 : face === 'side' ? 13 : 0), 1);
    cv.t(px, py, rp, l, 0.45);
  };
  // top (between the front top edge and the back), skewed right
  for (let j = 0; j < oy; j++) for (let i = 0; i < w; i++) {
    const px = x + i + Math.round((oy - j) * (ox / Math.max(1, oy))), py = y - oy + j;
    let l = lT;
    if (pk && i % pk === pk - 1) l -= 0.18;
    if (j === oy - 1) l += 0.06;
    paint('top', i / w, j / Math.max(1, oy), px, py, l);
  }
  // right side
  for (let i = 0; i < ox; i++) for (let j = 0; j < h; j++) {
    const px = x + w + i, py = y + j - Math.round((i + 1) * (oy / Math.max(1, ox)));
    let l = lS;
    if (pk && j % pk === pk - 1) l -= 0.16;
    paint('side', i / Math.max(1, ox), j / h, px, py, l);
  }
  // front: horizontal planks with gaps
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let l = lF;
    if (pk && j % pk === pk - 1) l -= 0.22;
    if (pk && j % pk === 0) l += 0.05;
    if (i === 0) l += cv.lx < 0 ? 0.08 : -0.06;
    if (i === w - 1) l += cv.lx < 0 ? -0.08 : 0.08;
    paint('front', i / w, j / h, x + i, y + j, l);
  }
  return { ox, oy };
}

/** a soft ripple / fold height field for cloth: k = fold strength, λ = wavelength */
export function folds(x: number, y: number, seed: number, k = 1, lam = 9) {
  return (Math.sin(x / lam * 6.28 + noise1(y * 0.15, seed) * 3) * 0.6 + (noise2(x * 0.18, y * 0.12, seed + 2) - 0.5) * 1.4) * k;
}

export { hex, mix, shade, withAlpha, clamp, hash2, noise1, noise2, bayer };
export type { C };

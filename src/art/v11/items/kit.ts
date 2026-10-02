// V11 illustrated item art: the painting kit behind every item picture (src/art/v11/items/*).
//
// Each item is painted at the size of its Backpack footprint (ITEM_CELL = 24 px per grid cell at 1x)
// with the light-aware primitives of the old 24 px icons (src/art/icons/pen.ts: shaded balls, tubes,
// bevelled slabs, puffs, hue-shifted ramps) plus what the bigger canvas needs: height-field relief
// shading for organic and carved forms, material textures (grain, weave, brushed metal, glass, wet
// shine, translucent leaves, polished stone), then one finishing pass shared by every item:
//   1. everything is clipped to the footprint's filled cells (L-shapes stay L-shaped),
//   2. a warm rim light on the top-left edge of the silhouette,
//   3. a hue-tinted selective outline: deep on the shadow side (bottom / right), soft on the lit side,
//   4. a soft two-step drop shadow down-right, under the object (it reads on any Backpack background),
//   5. the emissive layer (glows, steam, sparkles) blended on top, un-outlined.
// The light is the icons' key light: top-left, toward the viewer. Painting is lazy: artGroup() only
// stores the painter; itemArtCanvas() (src/art/v11/itemart.ts) paints on first use and caches.

import { Pen, RAMP, rp, H, hash, alpha, tone, clamp, mix } from '../../icons/pen';
import type { Ramp, Mask, Pt, Shade } from '../../icons/pen';
import { frame, curve, bez, lens, ring, halo, sparkle, wisp } from '../../icons/parts';
import { PixelBuffer } from '../../pixel';
import { hex, shade, withAlpha, A as AL } from '../../color';
import type { C } from '../../color';
import { bayer, noise2, fbm2, noise1 } from '../../../core/math';
import { ITEM_CELL, registerItemArt } from '../itemart';
import type { Footprint } from '../../../game/v11/footprints';

export { Pen, RAMP, rp, H, hash, alpha, tone, clamp, mix, frame, curve, bez, lens, ring, halo, sparkle, wisp, hex, shade, withAlpha, bayer, noise2, fbm2, noise1 };
export type { Ramp, Mask, Pt, Shade, C, Footprint };

/** the key light (same as the icon pen): top-left, toward the viewer */
const LV = (() => { const l = Math.hypot(-0.52, -0.64, 0.58); return [-0.52 / l, -0.64 / l, 0.58 / l] as const; })();
/** outline ink: a deep plum black every outline is mixed toward */
export const INK = hex('#120a16');
/** the drop shadow colour (alpha set per pixel) */
const SHADOW = hex('#0c0612');

// ------------------------------------------------------------------ extra ramps (dark -> light, last = glint)
export const RP = {
  ...RAMP,
  pounamu: rp('#04211a', '#0a3a28', '#105a3a', '#1c7e4e', '#3aa66c', '#a6ecc2'),
  basalt: rp('#0c0e12', '#191d25', '#282e38', '#3e4652', '#5e6874', '#a2acb6'),
  ivory: rp('#4a3a28', '#7a6448', '#a8906a', '#cfba92', '#ece0be', '#fffaea'),
  paper: rp('#4e4636', '#7a705a', '#a89e84', '#cec6aa', '#ebe4cc', '#fffcf0'),
  canvas: rp('#2a2618', '#4a4428', '#6e663e', '#948a58', '#b8ae78', '#e2dcae'),
  oilskin: rp('#2e1c04', '#5a3a08', '#8a5c0e', '#b88418', '#e0ac2c', '#fff0a0'),
  flax: rp('#151c0b', '#253212', '#3a4c1a', '#546a22', '#73882e', '#b6c25e'),
  flaxDry: rp('#2e2410', '#4e3e1a', '#725c26', '#9a7e36', '#c2a24c', '#ecd690'),
  driftwood: rp('#2a2420', '#463c34', '#665a4c', '#8a7c68', '#b0a28a', '#ddd2bc'),
  bark: rp('#1c120c', '#322016', '#4c3222', '#684830', '#866240', '#b48c62'),
  charcoal: rp('#0e0c0e', '#1c191c', '#2c282b', '#403a3c', '#5a5254', '#8a8284'),
  aluminium: rp('#262c36', '#46505e', '#6e7a88', '#9caab6', '#c8d4dc', '#f6fcff'),
  fishBlue: rp('#0e1a2c', '#1c3248', '#2e5068', '#4a7a8e', '#86b0b8', '#e6f6f2'),
  coral: rp('#3a0e1c', '#701e2e', '#aa3a44', '#dc6a62', '#f6a28c', '#ffe2cc'),
  rose: rp('#3a0e16', '#6e1a24', '#a42c30', '#d4483e', '#f07a5c', '#ffc6a0'),
  sulfur: rp('#4a3a06', '#86700c', '#c0a816', '#e8d42c', '#f8f070', '#ffffd8'),
  terracotta: rp('#2e1008', '#5a2210', '#86381a', '#b0562a', '#d27e44', '#f2b47a'),
  bread: rp('#3a1a08', '#6e3410', '#a0561c', '#c8802e', '#e4ac54', '#f8dc98'),
  crumb: rp('#7a6040', '#a0845a', '#c4a87a', '#dcc89a', '#f0e2bc', '#fffaea'),
  kumara: rp('#2a0c14', '#521a22', '#7c2c2e', '#a2443a', '#c4644a', '#e4946a'),
  kumaraFlesh: rp('#7a3208', '#b4520e', '#dc7a1c', '#f4a034', '#fcc864', '#fff0b8'),
  enamel: rp('#16284a', '#24407a', '#3462a8', '#5088cc', '#8ab6e6', '#e2f2ff'),
  tin: rp('#2a2e34', '#4a525a', '#707a82', '#9aa4aa', '#c6ced0', '#f6fafa'),
  gourd: rp('#3a1e08', '#6a3a10', '#9a5e1c', '#c2862c', '#e2b04c', '#faea9c'),
  mud: rp('#08070a', '#121014', '#1c181c', '#282226', '#3a3236', '#7a7276'),
  ochre: rp('#3a1a0a', '#6a3412', '#9a5422', '#c47a36', '#e0a056', '#f6cc8a'),
  ash: rp('#3a140c', '#6a2614', '#96401e', '#b85e30', '#d48452', '#f0b88a'),
  lime: rp('#4a4436', '#6e6650', '#968c70', '#bcb292', '#dcd4b6', '#f6f0dc'),
  water: rp('#0a2a3a', '#14465e', '#226a86', '#3a90aa', '#6ab8c8', '#d4f6f8'),
  quartz: rp('#2a3a3a', '#4a6062', '#748c8c', '#a2bab6', '#d0e4de', '#ffffff'),
  obsidian: rp('#050608', '#0c0e14', '#161a24', '#242a38', '#3a4458', '#b6c8e4'),
  pumice: rp('#4a463e', '#6e685c', '#928a7c', '#b4ac9c', '#d4cebe', '#f4f0e4'),
  flint: rp('#141418', '#24242a', '#38383e', '#505056', '#706e72', '#b8b4b4'),
  clayGrey: rp('#25252c', '#3e3d47', '#5c5a63', '#7c7880', '#a09a9a', '#d0cac4'),
  helix: rp('#4a3004', '#8a5e08', '#c8920e', '#ecbe22', '#fae25a', '#fffbd0'),
  red: RAMP.red,
  cap: rp('#2a0806', '#561210', '#8a2018', '#b83224', '#dc5a3c', '#ffb08a'),
  denim: rp('#0c1424', '#18263e', '#26395a', '#365078', '#4e6c96', '#8aa6c6'),
  moss: rp('#15260e', '#284214', '#446a1e', '#6a9428', '#9cbe3c', '#d2e870'),
  fern: rp('#0a2118', '#13392a', '#1e5a36', '#2f7c3c', '#56a448', '#a8d878'),
  silverfern: rp('#2e3a3c', '#4e5e60', '#748484', '#9eacaa', '#cad6d2', '#f6fffa'),
  ghost: rp('#4a5250', '#6e7876', '#949e9a', '#bcc4be', '#dde4dc', '#ffffff'),
  chitin: rp('#0c0808', '#1e1210', '#36201a', '#583428', '#7e4e3a', '#d8a888'),
  wingGlass: rp('#2e3a44', '#4a5e6a', '#6e8a94', '#9ab8bc', '#cce4e2', '#ffffff'),
};

// ------------------------------------------------------------------ the item pen

export class IP extends Pen {
  /** emissive / post layer: glows, steam, sparkles; blended over the finished art, never outlined */
  readonly fx: Pen;
  constructor(w: number, h: number) {
    super(w, h);
    this.fx = new Pen(w, h);
  }

  /** diffuse light 0..1 for a normal under the key light */
  lum(nx: number, ny: number, nz: number): number {
    const l = Math.hypot(nx, ny, nz) || 1;
    const d = (nx * LV[0] + ny * LV[1] + nz * LV[2]) / l;
    return clamp((d + 0.32) / 1.32, 0, 1);
  }
  /** the ramp tone for a light value 0..1 (over the diffuse tones; the last tone is kept for glints) */
  tn(r: Ramp, l: number, x = 0, y = 0, d = 0): C {
    const top = r.length - 2;
    return r[clamp(Math.round(l * top + (d ? (bayer(x, y) - 0.5) * d : 0)), 0, top)];
  }

  /** fill a mask with one ramp from a per-pixel light value (0..1), with a little ordered dither */
  lit(m: Mask, r: Ramp, l: (x: number, y: number) => number, d = 0.5): Mask {
    this.fill(m, (x, y) => this.tn(r, l(x, y), x, y, d));
    return m;
  }
  /** light across a cylinder lying along x (ny = -1 top .. 1 bottom) */
  cylL(ny: number): number { return this.lum(0, ny, Math.sqrt(Math.max(0, 1 - ny * ny))); }
  /** light across a cylinder standing along y (nx = -1 left .. 1 right) */
  cylV(nx: number): number { return this.lum(nx, 0, Math.sqrt(Math.max(0, 1 - nx * nx))); }
  /** shade a mask from a height field z(x, y) (toward the viewer). slope scales the bumps, dither blends
   *  neighbouring tones with an ordered pattern. Everything else as the pen's Shade options. */
  relief(m: Mask, r: Ramp, z: (x: number, y: number) => number, o: Shade & { slope?: number; dither?: number } = {}): Mask {
    const k = o.slope ?? 1, d = o.dither ?? 0, tex = o.tex;
    const oo: Shade = { ...o, tex: (x, y) => (tex ? tex(x, y) : 0) + (d ? (bayer(x, y) - 0.5) * d : 0) };
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (!m[y * this.w + x]) continue;
        if (o.clip && !o.clip(x, y)) continue;
        const gx = (z(x + 1, y) - z(x - 1, y)) * 0.5 * k, gy = (z(x, y + 1) - z(x, y - 1)) * 0.5 * k;
        const l = Math.hypot(gx, gy, 1);
        this.b.set(x, y, r[this.idx(r.length, -gx / l, -gy / l, 1 / l, x, y, oo)]);
      }
    return m;
  }
  /** the rounded "pillow" height of a mask: rises over r px from its edge to a plateau of r */
  dome(m: Mask, r = 4, power = 0.5): (x: number, y: number) => number {
    const d = this.dist(m, r + 1);
    const hh = new Float32Array(m.length);
    for (let i = 0; i < m.length; i++) {
      if (!m[i]) continue;
      const t = Math.min(d[i], r) / r;
      hh[i] = r * Math.pow(Math.max(0, 1 - (1 - t) * (1 - t)), power);
    }
    return (x, y) => (this.at(m, x, y) ? hh[y * this.w + x] : 0);
  }
  /** a band of half-width w(t) along a curve (t = 0..1 of its length) */
  band(c: Curve, w: (t: number) => number, t0 = 0, t1 = 1): Mask {
    return this.maskFn((x, y) => {
      const q = c.loc(x, y);
      return q.t >= t0 && q.t <= t1 && Math.abs(q.v) <= w(clamp(q.t, 0, 1));
    });
  }
  /** an irregular lump (pebble, nodule, clod): an ellipse with a noisy rim */
  lump(cx: number, cy: number, rx: number, ry: number, seed = 1, rough = 0.14, ang = 0): Mask {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    return this.maskFn((x, y) => {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry;
      const a = Math.atan2(v, u);
      const n = noise2(Math.cos(a) * 1.3 + 5, Math.sin(a) * 1.3 + 5, seed) - 0.5;
      const n2 = noise2(Math.cos(a) * 3.1 + 9, Math.sin(a) * 3.1 + 9, seed + 3) - 0.5;
      const r = 1 + n * 2 * rough + n2 * rough * 0.8;
      return u * u + v * v <= r * r;
    });
  }
  /** set a pixel only inside a mask */
  inm(m: Mask, x: number, y: number, c: C) { if (this.at(m, Math.floor(x), Math.floor(y))) this.px(x, y, c); }
  /** recolour the painted pixels of a mask with fn(old colour) */
  recolor(m: Mask, fn: (c: C, x: number, y: number) => C | -1) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (!m[y * this.w + x]) continue;
        const c = this.b.get(x, y);
        if (!AL(c)) continue;
        const v = fn(c, x, y);
        if (v !== -1) this.b.set(x, y, v);
      }
  }
  /** darken (k < 0) or lighten the painted pixels of a mask by a per-pixel amount */
  tint(m: Mask, k: (x: number, y: number) => number) {
    this.recolor(m, (c, x, y) => { const v = k(x, y); return v ? tone(c, v) : -1; });
  }
  /** soft occlusion inside an ellipse: darkens what is painted, strongest in the middle */
  occlude(cx: number, cy: number, rx: number, ry: number, k = 0.3, m?: Mask) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (m && !this.at(m, x, y)) continue;
        const c = this.b.get(x, y);
        if (!AL(c)) continue;
        const q = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
        if (q > 1) continue;
        const t = 1 - q;
        if (t + (bayer(x, y) - 0.5) * 0.35 > 0.18) this.b.set(x, y, tone(c, -k * Math.min(1, t * 1.6)));
      }
  }
  /** a specular glint: a bright pixel with a softer cross (main layer, so it is outlined if on the edge) */
  glint(x: number, y: number, c: C = H('#ffffff'), cross = 0) {
    this.px(x, y, c);
    if (cross > 0) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.has(x + dx, y + dy)) this.px(x + dx, y + dy, mix(this.get(x + dx, y + dy), c, cross));
  }
  /** a water droplet: dark rim below, light body, white glint top-left */
  droplet(x: number, y: number, big = false) {
    const w = H('#e8fbff', 230), d = H('#3a6a7a', 200), g = H('#ffffff');
    if (big) {
      this.blend(x, y + 1, d); this.blend(x + 1, y + 1, d); this.blend(x + 1, y, w); this.px(x, y, g);
    } else { this.px(x, y, g); this.blend(x, y + 1, d); }
  }
  /** a line of "handwriting": a wobbly ink scribble from x0 to x1 at row y */
  scribble(x0: number, x1: number, y: number, ink: C, seed = 1, m?: Mask) {
    for (let x = x0; x <= x1; x++) {
      const h = hash(x, y, seed);
      if (h < 0.18) continue; // gaps between words
      const yy = y + (h > 0.8 ? -1 : 0);
      if (m && !this.at(m, x, yy)) continue;
      this.px(x, yy, ink);
    }
  }
  /** a sparkle on the emissive layer */
  spark(x: number, y: number, col = '#fffbe0', big = false) { sparkle(this.fx, x, y, col, big); }
  /** a soft glow halo on the emissive layer */
  glow(cx: number, cy: number, r: number, col: string, a = 90) { halo(this.fx, cx, cy, r, col, a); }
  /** steam / scent wisp on the emissive layer */
  steam(x: number, y: number, h: number, col = '#ffffff', a = 150, dir = 1) { wisp(this.fx, x, y, h, col, a, dir); }
}

export type Curve = ReturnType<typeof curve>;

// ------------------------------------------------------------------ textures (tone offsets for Shade.tex)

/** wood grain along a direction: long streaks, the odd dark line */
export const grainTex = (ux: number, uy: number, seed = 1, k = 1) => (x: number, y: number) => {
  const a = x * ux + y * uy, b = -x * uy + y * ux;
  const n = noise2(a * 0.08, b * 0.9, seed) - 0.5;
  const streak = hash(Math.floor(a / 5), Math.round(b), seed) > 0.86 ? -0.9 : 0;
  return (n * 1.4 + streak) * k;
};
/** mottled stone: a soft blotch plus pepper speckles */
export const stoneTex = (seed = 1, k = 1, speck = 0.12) => (x: number, y: number) => {
  const n = fbm2(x * 0.22, y * 0.22, 3, seed) - 0.5;
  const s = hash(x, y, seed + 11);
  return (n * 1.6 + (s < speck ? -0.9 : s > 1 - speck * 0.6 ? 0.7 : 0)) * k;
};
/** a basket / fabric weave: alternating over-under cells */
export const weaveTex = (cw = 2, ch = 2, k = 1) => (x: number, y: number) => {
  const cx = Math.floor(x / cw), cy = Math.floor(y / ch);
  const over = (cx + cy) & 1;
  const inX = x - cx * cw, inY = y - cy * ch;
  const e = over ? (inX === 0 ? -0.7 : 0.25) : (inY === 0 ? -0.7 : -0.15);
  return e * k;
};
/** ordered-dither noise offset (painterly blending between bands) */
export const ditherTex = (d = 0.6) => (x: number, y: number) => (bayer(x, y) - 0.5) * d;
/** combine textures */
export const texSum = (...t: ((x: number, y: number) => number)[]) => (x: number, y: number) => t.reduce((s, f) => s + f(x, y), 0);

// ------------------------------------------------------------------ shared material helpers

/** a leaf blade along a curve: a midrib fold (the half facing the light is brighter), paired side veins,
 *  a lighter translucent rim, an optional glossy streak and insect holes */
export function leafBlade(p: IP, pts: Pt[], w: (t: number) => number, r: Ramp, o: {
  fold?: number; veins?: number; veinSlant?: number; rib?: C | null; vein?: C | null; gloss?: boolean; rim?: C | null;
  bulge?: number; clip?: (x: number, y: number) => boolean; spec?: number; lift?: number;
} = {}): { m: Mask; c: Curve } {
  const c = curve(pts);
  const m = p.band(c, w);
  if (o.clip) for (let i = 0; i < m.length; i++) if (m[i] && !o.clip(i % p.w, Math.floor(i / p.w))) m[i] = 0;
  const fold = o.fold ?? 2.2, bulge = o.bulge ?? 1.6, vp = o.veins ?? 3.2, slant = o.veinSlant ?? 0.9;
  const z = (x: number, y: number) => {
    if (!p.at(m, x, y)) return 0;
    const q = c.loc(x, y);
    const ww = Math.max(0.6, w(clamp(q.t, 0, 1)));
    const a = Math.min(1, Math.abs(q.v) / ww);
    const vein = vp > 0 ? Math.abs(((q.u - Math.abs(q.v) * slant) % vp + vp) % vp - vp / 2) / (vp / 2) : 1;
    return fold * (1 - a) + bulge * Math.sqrt(1 - a * a) - (vein < 0.28 ? 0.45 : 0);
  };
  p.relief(m, r, z, { spec: o.spec ?? (o.gloss ? 0.965 : 1), slope: 1, lift: o.lift ?? 0.2 });
  p.fill(m, (x, y) => {
    const q = c.loc(x, y);
    const ww = Math.max(0.6, w(clamp(q.t, 0, 1)));
    const a = Math.abs(q.v) / ww;
    if (o.rib !== null && Math.abs(q.v) < 0.55 && q.t > 0.02 && q.t < 0.96) return o.rib ?? r[r.length - 2];
    if (vp > 0 && o.vein !== null) {
      const vein = Math.abs(((q.u - Math.abs(q.v) * slant) % vp + vp) % vp - vp / 2) / (vp / 2);
      if (vein < 0.2 && a > 0.18 && a < 0.82) return o.vein ?? tone(p.get(x, y), 0.25);
    }
    if (o.rim !== null && a > 0.86) return o.rim ?? tone(p.get(x, y), 0.18);
    return -1;
  });
  return { m, c };
}

/** an oblique box in 3/4 view: the front face x..x+w-1, y..y+h-1 and the depth (dx, dy) receding
 *  (dy < 0: we see the top; dx < 0: the left side, dx > 0: the right side). Returns the face masks. */
export function box3(p: IP, x: number, y: number, w: number, h: number, dx: number, dy: number, cut = 0) {
  const front = p.maskBox(x, y, w, h, cut);
  const top = p.maskPoly([x, y + 0.01, x + w, y + 0.01, x + w + dx, y + dy, x + dx, y + dy]);
  const side = dx < 0
    ? p.maskPoly([x, y, x + dx, y + dy, x + dx, y + h + dy, x, y + h])
    : p.maskPoly([x + w, y, x + w + dx, y + dy, x + w + dx, y + h + dy, x + w, y + h]);
  return { front, top: Pen.sub(top, front), side: Pen.sub(Pen.sub(side, front), top) };
}

/** a ring of ridges (knurling) inside a mask: every other step round (cx, cy) gets darker */
export function knurl(p: IP, m: Mask, cx: number, cy: number, n = 10, k = -0.35) {
  p.fill(m, (x, y) => ((Math.round(Math.atan2(y + 0.5 - cy, x + 0.5 - cx) * n / Math.PI) & 1) ? tone(p.get(x, y), k) : -1));
}

const LENS = rp('#05060f', '#0b1028', '#16204a', '#26387a', '#4c6cb8', '#a8d0f4');
/** a big lens: deep blue-black glass with violet and green coating reflections, a crescent of sky on the
 *  top-left inner rim and two glints */
export function glassLens(p: IP, cx: number, cy: number, r: number, g: Ramp = LENS) {
  const m = p.maskDisc(cx, cy, r);
  p.fill(m, (x, y) => {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy) / r;
    const cr = Math.hypot(dx + r * 0.32, dy + r * 0.32) / r;
    if (d > 0.48 && d < 0.95 && cr < 0.7 && dx + dy < -r * 0.28) return d > 0.8 ? g[3] : g[4];
    if (Math.abs(d - 0.64) < 0.08 && dx + dy > r * 0.25) return H('#5a3496');
    if (Math.abs(d - 0.36) < 0.09 && dx > -r * 0.1 && dy > -r * 0.05) return H('#226a64');
    return d > 0.82 ? g[2] : d > 0.5 ? g[1] : g[0];
  });
  const gx = Math.floor(cx - r * 0.42), gy = Math.floor(cy - r * 0.42);
  p.px(gx, gy, H('#ffffff'));
  if (r >= 4) { p.px(gx + 1, gy, g[5]); p.px(gx, gy + 1, g[5]); }
  if (r >= 6) p.px(Math.floor(cx + r * 0.3), Math.floor(cy + r * 0.28), H('#c8e0ff'));
  return m;
}

/** an inset glass reflection: a vertical streak (alpha) inside a mask column range */
export function glassStreak(p: IP, m: Mask, x: number, y0: number, y1: number, a = 220, c = '#ffffff') {
  for (let y = y0; y <= y1; y++) if (p.at(m, x, y)) p.blend(x, y, H(c, a));
}

/** a glass specimen jar at (x, y) of size w x h: screw lid, rounded shoulders, contents painted by
 *  `fill` into the inner mask up to `level`, a paper label, and the glass highlights over the top */
export function jar(p: IP, x: number, y: number, w: number, h: number, o: {
  lid?: Ramp; cork?: boolean; level?: number; fill?: (inner: Mask, top: number) => void; label?: { y: number; h: number; ink?: C; col?: Ramp } | null;
  glass?: string;
} = {}) {
  // fill(inner, top): paint the contents into the jar's inner mask; `top` is the row of the fill level
  const lidH = Math.max(3, Math.round(h * 0.2));
  const by = y + lidH; // top of the glass (the rim)
  const bh = y + h - by;
  const body = p.maskFn((px, py) => {
    if (px < x || px >= x + w || py < by || py >= by + bh) return false;
    const ix = Math.min(px - x, x + w - 1 - px), iy = py - by, jy = by + bh - 1 - py;
    // a short neck, then rounded shoulders and a rounded foot
    if (iy < 1) return ix >= 1;
    if (iy < 2) return ix >= 0;
    if (jy < 1) return ix >= 2;
    if (jy < 2) return ix >= 1;
    return true;
  });
  const inner = p.maskFn((px, py) => p.at(body, px, py) && p.at(body, px - 1, py) && p.at(body, px + 1, py) && p.at(body, px, py - 1) && p.at(body, px, py + 1) && py > by + 1);
  // the empty glass: faint, a touch of the backdrop showing through
  const gtint = o.glass ?? '#9fd8d4';
  p.fill(body, (px) => H(gtint, px - x < w * 0.35 ? 70 : 110));
  // contents
  const lvl = o.level ?? 0.7;
  const top = Math.round(by + 2 + (bh - 3) * (1 - lvl));
  if (o.fill) o.fill(inner, top);
  // the glass walls: darker edges and a thick bottom
  const G = RP.glass;
  p.fill(body, (px, py) => {
    const edge = !p.at(body, px - 1, py) || !p.at(body, px + 1, py);
    const foot = !p.at(body, px, py + 1) || !p.at(body, px, py + 2);
    const c = p.get(px, py);
    if (foot) return mix(c | 0xff000000, G[px - x < w / 2 ? 3 : 2], 0.6);
    if (edge) return px - x < w / 2 ? H('#cdeee8', 200) : H('#3c6a72', 220);
    return -1;
  });
  // the rim of the mouth
  for (let px = x + 1; px < x + w - 1; px++) p.px(px, by, px - x < w * 0.5 ? G[4] : G[3]);
  // label
  if (o.label !== null) {
    const lb = o.label ?? { y: Math.round(by + bh * 0.42), h: Math.max(3, Math.round(bh * 0.3)) };
    const col = lb.col ?? RP.paper;
    const lm = Pen.and(body, p.maskFn((px, py) => py >= lb.y && py < lb.y + lb.h && px > x && px < x + w - 1));
    p.fill(lm, (px, py) => {
      const t = (px - x) / w;
      const i = t < 0.25 ? 4 : t < 0.7 ? 3 : 2;
      return col[py === lb.y ? Math.min(5, i + 1) : py === lb.y + lb.h - 1 ? i - 1 : i];
    });
    const ink = lb.ink ?? H('#3a2a20');
    for (let ly = lb.y + 1; ly < lb.y + lb.h - 1; ly += 2) p.scribble(x + 2, x + w - 4, ly, ink, ly * 7 + x, lm);
  }
  // highlights: a long streak on the lit side, a short one on the right
  glassStreak(p, body, x + 1, by + 2, by + bh - 4, 235);
  glassStreak(p, body, x + 2, by + 3, by + Math.round(bh * 0.45), 150);
  glassStreak(p, body, x + w - 3, by + 3, by + Math.round(bh * 0.35), 120, '#e8fff8');
  // lid
  if (o.cork) {
    const cm = p.maskBox(x + 2, y + 1, w - 4, lidH + 1, 1);
    p.relief(cm, RP.pale, p.dome(cm, 2), { tex: stoneTex(4, 0.6, 0.2) });
  } else {
    const L = o.lid ?? RP.tin;
    const lm = p.maskBox(x, y, w, lidH, 1);
    p.fill(lm, (px, py) => {
      const t = (px - x) / (w - 1);
      const band = t < 0.18 ? 4 : t < 0.45 ? 3 : t < 0.8 ? 2 : 1;
      const ridge = (px - x) % 2 === 1 ? -1 : 0;
      const i = py === y ? Math.min(5, band + 1) : py === y + lidH - 1 ? Math.max(0, band - 1) : band + ridge;
      return L[clamp(i, 0, 5)];
    });
    p.px(x + 1, y, L[5]);
    p.px(x + 2, y, L[5]);
  }
  return { body, inner, top, by, bh };
}

/** a little paper tag on a string, hanging from (x0, y0) to a tag at (x, y) */
export function tag(p: IP, x0: number, y0: number, x: number, y: number, w = 5, h = 4, col: Ramp = RP.paper, ink: C = H('#5a3a20')) {
  p.line(x0, y0, x + 1, y + 1, H('#c8b48a'));
  const m = p.maskPoly([x + 1, y, x + w, y, x + w, y + h, x, y + h, x, y + 1]);
  p.slab(m, col, 3);
  p.px(x + 1, y + 1, H('#3a2a1a'));
  if (w > 4) p.scribble(x + 2, x + w - 2, y + 2, ink, x + y);
}

/** stitch / lashing turns of cord across a rod at (x, y): n turns, half-width hw, slant in px per turn */
export function lashing(p: IP, x: number, y: number, n: number, hw: number, r: Ramp = RP.flaxDry, vertical = false) {
  for (let i = 0; i < n; i++)
    for (let k = -hw; k <= hw; k++) {
      const a = Math.abs(k) / (hw + 0.5);
      const t = 3 - a * 1.6 + (k < 0 ? 0.6 : -0.3);
      const c = r[clamp(Math.round(t), 0, 4)];
      if (vertical) { p.px(x + i * 2, y + k, c); p.px(x + i * 2 + 1, y + k, r[1]); }
      else { p.px(x + k, y + i * 2, c); p.px(x + k, y + i * 2 + 1, r[1]); }
    }
}

/** a twisted rope / cord along a polyline of radius r: strands as slanted light and dark bands */
export function rope(p: IP, pts: Pt[], r: number, R: Ramp = RP.flaxDry, o: { period?: number; lift?: number; spec?: number } = {}) {
  const c = curve(pts);
  const per = o.period ?? 2.6;
  return p.tube(pts, r, R, {
    spec: o.spec ?? 1, lift: o.lift ?? 0.2,
    tex: (x, y) => {
      const q = c.loc(x, y);
      const s = ((q.u + q.v * 1.1) % per + per) % per / per;
      return s < 0.3 ? -1.1 : s > 0.75 ? 0.5 : 0;
    },
  });
}

// ------------------------------------------------------------------ finishing

export interface ArtOpts {
  /** the soft drop shadow down-right of the object: false for none; dx / dy offset, a = alpha 0..255 */
  shadow?: false | { dx?: number; dy?: number; a?: number };
  /** warm rim light on the top-left silhouette edge (0 = off, default 0.16) */
  rim?: number;
  /** selective outline strength (0 = no outline, default 1) */
  ol?: number;
}

function cellTest(fp: Footprint) {
  if (!fp.mask) return () => true;
  const m = fp.mask;
  return (x: number, y: number) => m[Math.floor(y / ITEM_CELL)]?.[Math.floor(x / ITEM_CELL)] === '#';
}

function rimLight(b: PixelBuffer, k: number) {
  const W = b.w, Hh = b.h, src = b.data.slice();
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < Hh && (src[y * W + x] >>> 24) > 150;
  const warm = hex('#fff0cc');
  for (let y = 0; y < Hh; y++)
    for (let x = 0; x < W; x++) {
      const c = src[y * W + x];
      if ((c >>> 24) <= 200) continue;
      // already-bright pixels keep their colour (no chalky edges on pale things)
      if ((c & 255) + ((c >>> 8) & 255) + ((c >>> 16) & 255) > 600) continue;
      const top = !op(x, y - 1), left = !op(x - 1, y);
      if (top && left) b.data[y * W + x] = mix(c, warm, k * 1.5);
      else if (top || left) b.data[y * W + x] = mix(c, warm, k);
    }
}

function selOutline(b: PixelBuffer, s: number, ok: (x: number, y: number) => boolean) {
  const W = b.w, Hh = b.h, d = b.data, src = d.slice();
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < Hh && (src[y * W + x] >>> 24) > 90;
  for (let y = 0; y < Hh; y++)
    for (let x = 0; x < W; x++) {
      // only fully empty pixels become outline (gauze, glass and smoke stay see-through)
      if ((src[y * W + x] >>> 24) > 0 || !ok(x, y)) continue;
      // the shape above or to the left: this pixel is on the shadow side
      let nb = -1, dark = false;
      if (op(x, y - 1)) { nb = (y - 1) * W + x; dark = true; }
      else if (op(x - 1, y)) { nb = y * W + x - 1; dark = true; }
      else if (op(x + 1, y)) nb = y * W + x + 1;
      else if (op(x, y + 1)) nb = (y + 1) * W + x;
      if (nb < 0) continue;
      const c = (src[nb] | 0xff000000) >>> 0;
      const col = dark ? mix(shade(c, -0.8), INK, 0.58) : mix(shade(c, -0.56), INK, 0.3);
      d[y * W + x] = s >= 1 ? col : withAlpha(col, Math.round(255 * s));
    }
}

function dropShadow(out: PixelBuffer, b: PixelBuffer, ok: (x: number, y: number) => boolean, dx: number, dy: number, a: number) {
  const W = b.w, Hh = b.h;
  const S = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < Hh && (b.data[y * W + x] >>> 24) > 40;
  for (let y = 0; y < Hh; y++)
    for (let x = 0; x < W; x++) {
      if (S(x, y) || !ok(x, y)) continue;
      let n = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (S(x - dx + i, y - dy + j)) n++;
      if (!n) continue;
      const k = n >= 7 ? 1 : n >= 4 ? 0.62 : 0.3;
      out.set(x, y, withAlpha(SHADOW, Math.round(a * k)));
    }
}

/** paint one item picture: footprint-sized canvas, draw, then the shared finishing pass */
export function paintArt(fp: Footprint, draw: (p: IP) => void, o: ArtOpts = {}): PixelBuffer {
  const W = fp.w * ITEM_CELL, Hh = fp.h * ITEM_CELL;
  const p = new IP(W, Hh);
  draw(p);
  const ok = cellTest(fp);
  const b = p.b, fx = p.fx.b;
  if (fp.mask) for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) if (!ok(x, y)) { b.data[y * W + x] = 0; fx.data[y * W + x] = 0; }
  const rim = o.rim ?? 0.12;
  if (rim > 0) rimLight(b, rim);
  const ol = o.ol ?? 1;
  if (ol > 0) selOutline(b, ol, ok);
  const out = new PixelBuffer(W, Hh);
  if (o.shadow !== false) {
    const big = fp.w * fp.h > 1;
    const sh = o.shadow ?? {};
    dropShadow(out, b, ok, sh.dx ?? (big ? 2 : 1), sh.dy ?? (big ? 3 : 2), sh.a ?? 96);
  }
  out.blit(b, 0, 0, false, true);
  for (let i = 0; i < fx.data.length; i++) {
    const c = fx.data[i];
    if (c >>> 24) out.blend(i % W, Math.floor(i / W), c);
  }
  return out;
}

// ------------------------------------------------------------------ registration

export interface ArtEntry { id: string; group: string; fp: Footprint }
const LIST: ArtEntry[] = [];
/** the registered pictures in paint order, by group (for galleries) */
export const artList = (): readonly ArtEntry[] => LIST;
/** a footprint: w x h cells, optional mask rows of '#' / '.' */
export const fp = (w: number, h: number, ...mask: string[]): Footprint => (mask.length ? { w, h, mask } : { w, h });
/** a registrar for one group of items: art(id, footprint, draw, options) */
export function artGroup(group: string) {
  return (id: string, f: Footprint, draw: (p: IP) => void, o?: ArtOpts) => {
    LIST.push({ id, group, fp: f });
    registerItemArt(id, () => paintArt(f, draw, o).toCanvas(1), f);
  };
}

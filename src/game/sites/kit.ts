// Reusable environment builders for expedition sites.

import type { Renderer } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { bigFrame } from '../../gfx/atlas';
import { PixelBuffer } from '../../art/pixel';
import * as F from '../../art/flora';
import { C, hex, mix, shade, withAlpha } from '../../art/color';
import { PAL } from '../../art/palettes';
import type { Stage, Layer } from '../../world/stage';
import { Prop, Custom } from '../../world/props';
import { layerSpan } from '../../world/scenery';
import { atlas, A } from '../assets';
import { Rng, bayer, clamp, fbm1, fbm2, noise1, rand } from '../../core/math';

let uid = 0;
export const aid = (p: string) => `${p}_${uid++}`;

/** Far forest layer: hazy trunk silhouettes, fern crowns and vines in a single tint ramp. */
export function paintTrunkLayer(w: number, h: number, seed: number, ramp: C[], density: number, trunkW: [number, number], opts: { ferns?: number; vines?: number; canopy?: boolean; groundY?: number } = {}) {
  const rng = new Rng(seed);
  const b = new PixelBuffer(w, h);
  const gy = opts.groundY ?? h;
  // ground band
  for (let x = 0; x < w; x++) {
    const top = gy - 6 - Math.round(fbm1(x * 0.03, 2, seed) * 10);
    for (let y = top; y < h; y++) b.data[y * w + x] = y === top ? ramp[2] : ramp[0];
  }
  for (let x = rng.range(0, 30); x < w; x += rng.range(30, 90) / density) {
    const tw = rng.range(trunkW[0], trunkW[1]);
    const lean = rng.range(-0.04, 0.04);
    for (let y = 0; y < gy; y++) {
      const flare = Math.max(0, (y - gy + 20) / 20) * tw * 0.6;
      const cx = x + (gy - y) * lean;
      for (let dx = -tw / 2 - flare; dx <= tw / 2 + flare; dx++) {
        const nx = dx / (tw / 2 + flare);
        const c = nx < -0.5 ? ramp[2] : nx > 0.5 ? ramp[0] : ramp[1];
        b.set(cx + dx, y, c);
      }
    }
    if (opts.vines && rng.chance(opts.vines)) {
      const vx = x + rng.range(-tw, tw);
      const len = rng.range(40, gy * 0.8);
      for (let y = 0; y < len; y++) b.set(vx + Math.sin(y * 0.07 + x) * 2, y, ramp[1]);
    }
  }
  if (opts.ferns) {
    for (let x = rng.range(0, 40); x < w; x += rng.range(40, 110)) {
      if (!rng.chance(opts.ferns)) continue;
      const fy = gy - rng.range(30, 70);
      for (let y = fy; y < gy; y++) b.set(x, y, ramp[1]);
      for (let f = 0; f < 9; f++) {
        const a = -Math.PI / 2 + (f / 8 - 0.5) * 3;
        const len = rng.range(16, 26);
        for (let s = 0; s < len; s += 0.5) {
          const t = s / len;
          b.set(x + Math.cos(a) * s, fy + Math.sin(a) * s + t * t * len * 0.6, t > 0.6 ? ramp[2] : ramp[1]);
        }
      }
    }
  }
  if (opts.canopy) {
    for (let x = -20; x < w + 20; x += rng.range(10, 22)) {
      const r = rng.range(14, 30);
      b.discFn(x, rng.range(-8, 18), r, (px, py, nx, ny) => (Math.hypot(nx, ny) + (fbm2(px * 0.2, py * 0.2, 2, seed) - 0.5) * 0.4 > 1 ? -1 : ny < -0.3 ? ramp[2] : ramp[1]));
    }
  }
  return b;
}

export function addTrunkLayer(st: Stage, r: Renderer, name: string, p: number, fog: number, y: number, h: number, seed: number, ramp: string[], density: number, trunkW: [number, number], opts: Parameters<typeof paintTrunkLayer>[6] = {}, receive = 0.15) {
  const span = layerSpan(st, p);
  const buf = paintTrunkLayer(span.w, h, seed, ramp.map(c => hex(c)), density, trunkW, opts);
  const l = st.addLayer(name, p, fog, receive, 0);
  l.add(new Prop({ ...bigFrame(r, buf), ax: 0, ay: 0 }, span.x0, y));
  return l;
}

/** Dense foliage ceiling across the top of the view with gaps (for forest-floor sites). */
export function addCanopyCeiling(st: Stage, r: Renderer, p: number, gaps: number[], y = -20, h = 70, ramp: C[] = PAL.leafDeep) {
  const span = layerSpan(st, p, 60);
  const b = new PixelBuffer(span.w, h);
  const rng = new Rng(77);
  for (let x = 0; x < span.w; x += 6) {
    const wx = span.x0 + x;
    const inGap = gaps.some(g => Math.abs(g * p - wx) < 26);
    const depth = inGap ? rng.range(6, 18) : rng.range(h * 0.55, h * 0.9);
    F.foliage(b, x, depth * 0.5, rng.range(8, 16), depth * 0.5, ramp.slice(0, 5), rng, 2.2, 0.9, -0.3, -0.35);
  }
  // hanging vines
  for (let i = 0; i < span.w / 40; i++) {
    const x = rng.range(0, span.w), len = rng.range(20, 60);
    for (let yy = 20; yy < 20 + len; yy++) b.set(x + Math.sin(yy * 0.1 + i) * 1.5, yy, ramp[1]);
  }
  const l = st.addLayer('ceiling', p, 0.02, 0.3, 0);
  l.add(new Prop({ ...bigFrame(r, b), ax: 0, ay: 0 }, span.x0, y));
  return l;
}

export interface Shaft { x: number; w: number; a: number; phase: number }

/** Volumetric light shafts (additive + into the light map) with drifting dust motes. */
export function addShafts(st: Stage, layer: Layer, shafts: Shaft[], color: [number, number, number], topY = -20, len = 290, intensity = 1) {
  layer.add(new Custom(200, (r, s) => {
    for (const sh of shafts) {
      const k = (0.75 + 0.25 * Math.sin(s.time * 0.4 + sh.phase)) * intensity;
      const col = packColor(color[0], color[1], color[2], 1);
      r.fxDraw(A.shaft, sh.x, topY, sh.w / 48, len / 256, sh.a, col, 0.55 * k);
      r.lightTex(A.shaft, sh.x, topY, sh.w / 48, len / 256, sh.a, col, 1.3 * k);
    }
  }, (dt, s) => {
    for (const sh of shafts) {
      if (rand.chance(dt * 2.5 * intensity)) {
        const t = rand.next();
        const y = topY + t * len * 0.95;
        const x = sh.x - Math.sin(sh.a) * (y - topY) + rand.range(-sh.w * 0.3, sh.w * 0.3);
        layer.glowParticles.spawn({ frame: A.dot, x, y, vx: rand.range(-2, 2), vy: rand.range(-1, 2), life: rand.range(3, 6), color: [1, 0.95, 0.8], alpha: 0.9, alpha1: 0, fadeIn: 0.3, glow: true, intensity: 1.6, wobble: 3, wobbleF: 0.8 });
      }
    }
    void s;
  }));
}

export function inShaft(shafts: Shaft[], x: number, y: number, topY = -20) {
  return shafts.some(sh => Math.abs(sh.x - Math.sin(sh.a) * (y - topY) - x) < sh.w * 0.35);
}

/** Scatter props from a list of generators along a strip of a layer. */
export function scatter(layer: Layer, x0: number, x1: number, step: [number, number], seed: number, yAt: (x: number) => number, gen: (rng: Rng, x: number) => { buf: PixelBuffer; ax: number; ay: number } | null, sway = 0.8, zBase = 0) {
  const rng = new Rng(seed);
  for (let x = x0; x < x1; x += rng.range(step[0], step[1])) {
    const o = gen(rng, x);
    if (!o) continue;
    layer.add(new Prop(atlas.add(aid('sc'), o.buf, o.ax, o.ay), x, yAt(x) + 1, zBase + rng.next(), { sway }));
  }
}

/** Bioluminescent fungi / glow flecks that light up at night. */
export function addGlowFungi(layer: Layer, spots: [number, number][], night: boolean) {
  const frame = atlas.has('mushGlow') ? atlas.get('mushGlow') : atlas.add('mushGlow', F.paintMushrooms(17, true).buf, 9, 12);
  const frame2 = atlas.has('mush') ? atlas.get('mush') : atlas.add('mush', F.paintMushrooms(16, false).buf, 9, 12);
  for (const [x, y] of spots) {
    layer.add(new Custom(8, (r, s) => {
      if (night) {
        r.emissive(1);
        r.draw(frame, x, y + 1);
        r.emissive();
        const k = 0.8 + 0.2 * Math.sin(s.time * 1.3 + x);
        r.light(x, y - 4, 36, 0.3, 1, 0.9, 1.1 * k);
        r.fxDraw(A.glow, x, y - 4, 0.5, 0.35, 0, packColor(0.4, 1, 0.9, 1), 0.7 * k);
      } else r.draw(frame2, x, y + 1);
    }));
  }
}

/** A clue sparkle marker. */
export function sparkle(r: Renderer, x: number, y: number, t: number) {
  const k = 0.5 + 0.5 * Math.sin(t * 4);
  r.fxDraw(A.spark, x, y - 3 - k * 2, 0.8 + k * 0.4, 0.8 + k * 0.4, t, packColor(1, 0.95, 0.7, 1), 2 + k * 2);
}

export { mix, shade, withAlpha, clamp, bayer, noise1, fbm1 };

// Shared scenery builders: sky, celestial bodies, stars, clouds, far layers, ground strips.

import type { Frame, Renderer } from '../gfx/renderer';
import { packColor } from '../gfx/renderer';
import { bigFrame } from '../gfx/atlas';
import { PixelBuffer } from '../art/pixel';
import * as L from '../art/landscape';
import { C, hex, mix, shade, withAlpha } from '../art/color';
import { PAL } from '../art/palettes';
import type { Stage, Layer } from './stage';
import { Custom, Prop } from './props';
import { A } from '../game/assets';
import { Rng, bayer, clamp, fbm1, fbm2, noise1 } from '../core/math';

const HALF = 440;

/** Required width & origin for a layer image so it covers the camera range at parallax p. */
export function layerSpan(st: Stage, p: number, margin = 40) {
  const x0 = (st.minX + HALF) * p - HALF - margin;
  const x1 = (st.maxX - HALF) * p + HALF + margin;
  return { x0: Math.floor(x0), w: Math.ceil(Math.max(x1 - x0, 2 * HALF + 2 * margin)) };
}

export function addSky(st: Stage, r: Renderer, opts: { glowK?: number } = {}) {
  const pr = st.preset;
  const W = 640, H = 320;
  const sun = { x: pr.sunPos[0] * W, y: pr.sunPos[1] * 270 };
  const glowC = hex(pr.glowColor);
  const sky = L.paintSky(W, H, pr.sky.map(s => ({ t: s.t * (270 / H), c: s.c })), 30, pr.moon ? { x: sun.x, y: sun.y, r: 70, c: mix(pr.sky[pr.sky.length - 1].c, hex('#6f86b8'), 0.5), k: 0.5 } : { x: sun.x, y: sun.y, r: st.tod === 'day' ? 90 : 150, c: glowC, k: opts.glowK ?? (st.tod === 'day' ? 0.3 : 0.6) });
  const skyF = bigFrame(r, sky);
  const layer = st.addScreenLayer('sky', 0.5);
  const stars = L.starField(W, 200, 7, pr.stars);
  const moonF = pr.moon ? bigFrame(r, L.paintMoon(9, hex('#eef2f6'), hex('#bcc6d4'), hex('#8e98aa'))) : null;
  const sunF = !pr.moon ? bigFrame(r, L.paintSun(st.tod === 'day' ? 8 : 11, hex('#fffaf0'), hex(st.tod === 'day' ? '#fff3c4' : '#ffd08a'))) : null;
  layer.add(new Custom(0, (rr, s) => {
    const oy = -(s.cam.y - 180) * 0.04 - 10;
    rr.drawSub(skyF, 0, 0, Math.min(W, rr.VW + 2), H, 0, oy);
    if (rr.VW > W) rr.drawSub(skyF, W - 2, 0, 2, H, W - 1, oy, (rr.VW - W + 2) / 2, 1);
    // stars
    for (const sp of stars) {
      if (sp.x > rr.VW) continue;
      const tw = 0.55 + 0.45 * Math.sin(s.time * sp.tw + sp.x);
      const a = sp.b * tw;
      rr.fxDraw(sp.big ? A.spark : A.dot, sp.x, sp.y + oy, sp.big ? 0.6 : 1, sp.big ? 0.6 : 1, 0, sp.c | 0, a * 1.4, true);
    }
    const sx = pr.sunPos[0] * rr.VW, sy = sun.y + oy;
    if (moonF) {
      rr.draw(moonF, sx - moonF.w / 2, sy - moonF.h / 2);
      rr.fxDraw(A.glow, sx, sy, 2.2, 2.2, 0, packColor(0.7, 0.8, 1, 1), 0.5);
    } else if (sunF) {
      rr.emissive(1);
      rr.draw(sunF, sx - sunF.w / 2, sy - sunF.h / 2);
      rr.emissive();
      const [cr, cg, cb] = pr.sunColor;
      rr.fxDraw(A.glow, sx, sy, 1.6, 1.6, 0, packColor(cr, cg, cb, 1), st.tod === 'day' ? 0.8 : 1.1);
      rr.fxDraw(A.glow, sx, sy, 5, 5, 0, packColor(cr, cg * 0.9, cb * 0.8, 1), st.tod === 'day' ? 0.12 : 0.16);
    }
  }));
  return layer;
}

/** Drifting cloud layer. */
export function addClouds(st: Stage, r: Renderer, p: number, y0: number, y1: number, n: number, seed: number, fog = 0.1) {
  const pr = st.preset;
  const ramp = pr.cloudRamp.map(h => hex(h));
  const layer = st.addLayer('clouds' + seed, p, fog, 0, 0.5, p * 0.5);
  const rng = new Rng(seed);
  const frames: Frame[] = [];
  for (let i = 0; i < 4; i++) frames.push(bigFrame(r, L.paintCloud(seed + i, rng.int(60, 120), rng.int(22, 34), ramp, pr.sunPos[0] > 0.5 ? 1 : -1)));
  const streaks: Frame[] = [];
  if (st.tod === 'dusk' || st.tod === 'dawn') for (let i = 0; i < 3; i++) streaks.push(bigFrame(r, L.paintStreak(seed + 10 + i, rng.int(90, 180), rng.int(3, 6), ramp[2], ramp[3])));
  const span = layerSpan(st, p, 200);
  const items = Array.from({ length: n }, () => ({ f: rng.pick(frames), x: rng.range(span.x0, span.x0 + span.w), y: rng.range(y0, y1), v: rng.range(1, 3) }));
  const sitems = streaks.map(f => ({ f, x: rng.range(span.x0, span.x0 + span.w), y: rng.range(y0 + 20, y1 + 30), v: rng.range(0.5, 1.5) }));
  layer.add(new Custom(0, (rr, s) => {
    for (const c of [...sitems, ...items]) {
      const x = span.x0 + ((((c.x + s.time * c.v - span.x0) % span.w) + span.w) % span.w);
      rr.draw(c.f, x - c.f.w / 2, c.y);
    }
  }));
  return layer;
}

/** A static far layer image (ridge / treeline / etc) placed to cover the camera span. */
export function addFarImage(st: Stage, r: Renderer, name: string, p: number, fog: number, painter: (w: number) => PixelBuffer, y: number, receive = 0, py = p) {
  const layer = st.addLayer(name, p, fog, receive, 0, py);
  const span = layerSpan(st, p);
  const buf = painter(span.w);
  const f = bigFrame(r, buf);
  layer.add(new Prop({ ...f, ax: 0, ay: 0 }, span.x0, y, 0));
  return { layer, span };
}

export interface GroundStyle {
  top: C[];     // grass / moss ramp dark->light
  soil: C[];    // soil ramp dark->light
  stones?: C[];
  roots?: boolean;
  litter?: C[];
  sand?: boolean;
}

/** Paint a ground strip following heights(x) (world y of the surface) between yTop..yTop+h. */
export function paintGround(w: number, h: number, yTop: number, height: (x: number) => number, g: GroundStyle, seed = 3) {
  const buf = new PixelBuffer(w, h);
  const rng = new Rng(seed);
  const S = g.soil, T = g.top;
  for (let x = 0; x < w; x++) {
    const surf = Math.round(height(x) - yTop);
    const grassH = 3 + Math.round(noise1(x * 0.3, seed) * 3);
    for (let y = Math.max(0, surf - 2); y < h; y++) {
      const d = y - surf;
      let c: C;
      if (d < 0) {
        // grass blades sticking up
        const blade = noise1(x * 1.7, seed + 2) > 0.62 && d >= -2;
        if (!blade || g.sand) continue;
        c = T[T.length - 1];
      } else if (d < grassH && !g.sand) {
        const k = d / grassH;
        c = T[clamp(Math.round((1 - k) * (T.length - 2) + (bayer(x, y) - 0.5) * 1.2), 0, T.length - 1)];
      } else {
        const depth = (d - grassH) / (h - surf);
        const n = fbm2(x * 0.08, y * 0.12, 3, seed);
        let l = 0.75 - depth * 1.6 + (n - 0.5) * 0.7 + (bayer(x, y) - 0.5) * 0.35;
        if (g.sand) l += 0.3;
        c = S[clamp(Math.round(l * (S.length - 1)), 0, S.length - 1)];
      }
      buf.data[y * w + x] = c;
    }
  }
  // stones
  if (g.stones) {
    for (let i = 0; i < w / 30; i++) {
      const x = rng.range(0, w);
      const surf = height(x) - yTop;
      const y = surf + rng.range(8, h * 0.7);
      const rr = rng.range(1, 2.6);
      buf.discFn(x, y, rr, (px, py, nx, ny) => (buf.opaque(px, py) ? g.stones![clamp(Math.round((-nx * 0.4 - ny * 0.6) * 1.2 + 1 + (bayer(px, py) - 0.5)), 0, 3)] : -1));
    }
  }
  if (g.roots) {
    for (let i = 0; i < w / 60; i++) {
      let x = rng.range(0, w), y = height(x) - yTop + rng.range(4, 10);
      const dir = rng.sign();
      for (let s = 0; s < rng.range(20, 60); s++) {
        buf.paint(x, y, S[S.length - 1]);
        buf.paint(x, y + 1, S[1]);
        x += dir;
        y += rng.range(-0.3, 0.6);
      }
    }
  }
  if (g.litter) {
    for (let i = 0; i < w * 1.2; i++) {
      const x = rng.range(0, w);
      const y = height(x) - yTop + rng.range(0, 4);
      buf.paint(x, y, rng.pick(g.litter));
    }
  }
  // highlight top edge
  for (let x = 0; x < w; x++) {
    const y = Math.round(height(x) - yTop);
    if (buf.opaque(x, y) && !g.sand) buf.set(x, y, shade(T[T.length - 1], 0.15));
    else if (g.sand) buf.set(x, y, shade(S[S.length - 1], 0.2));
  }
  return buf;
}

/** Add a ground strip image as chunked props (keeps textures reasonably sized). */
export function addGroundStrip(layer: Layer, r: Renderer, x0: number, w: number, yTop: number, h: number, height: (x: number) => number, g: GroundStyle, z = 0, seed = 3) {
  const CH = 1024;
  for (let cx = 0; cx < w; cx += CH) {
    const cw = Math.min(CH, w - cx);
    const buf = paintGround(cw, h, yTop, x => height(x0 + cx + x), g, seed + cx);
    const f = bigFrame(r, buf);
    layer.add(new Prop({ ...f, ax: 0, ay: 0 }, x0 + cx, yTop, z));
  }
}

export function fillRectLayer(layer: Layer, x: number, y: number, w: number, h: number, color: number, z = -1) {
  layer.add(new Custom(z, rr => rr.rect(x, y, w, h, color)));
}

export { withAlpha, fbm1, PAL };

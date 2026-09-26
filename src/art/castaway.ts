// Castaway camp art: the beach and volcano backdrops, every construction stage you build yourself
// (tent, campfire, workbench, radio mast), camp furniture, and the explorable tent interior with
// the sticker-covered laptop.

import { PixelBuffer } from './pixel';
import { C, hex, mix, shade, withAlpha } from './color';
import { PAL, OUTLINE } from './palettes';
import { Rng, bayer, clamp, fbm2, noise1 } from '../core/math';
import type { Sprite } from './jungle-core';
import { trimSprite } from './jungle-core';

const O = OUTLINE;
const lvl = (ramp: C[], l: number) => ramp[clamp(Math.round((l * 0.5 + 0.5) * (ramp.length - 1)), 0, ramp.length - 1)];

/** polygon with fabric weave + dither shading */
function fabric(buf: PixelBuffer, pts: number[], ramp: C[], light: number, seed: number, folds = 0, sag = 0) {
  buf.polyFn(pts, (x, y) => {
    let l = light + (fbm2(x * 0.3, y * 0.3, 2, seed) - 0.5) * 0.25 + (bayer(x, y) - 0.5) * 0.3;
    if (folds) l += Math.sin(x * folds + y * 0.2) * 0.12;
    if (sag) l += Math.sin(y * 0.5 + x * 0.1) * sag;
    return lvl(ramp, l);
  });
}
function wood(buf: PixelBuffer, x: number, y: number, w: number, h: number, seed: number, light = 0.1, ramp = PAL.bark) {
  buf.rectFn(x, y, w, h, (xx, yy) => {
    let l = light + (noise1(xx * 0.35 + (w > h ? yy * 5 : 0), seed) - 0.5) * 0.5 + (bayer(xx, yy) - 0.5) * 0.2;
    if (w > h ? yy === y : xx === x) l += 0.35;
    if (w > h ? yy === y + h - 1 : xx === x + w - 1) l -= 0.4;
    return lvl(ramp, l);
  });
}
function rope(buf: PixelBuffer, x0: number, y0: number, x1: number, y1: number, sag = 2, c: C = PAL.canvas[5]) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    buf.set(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag, c);
  }
}
function pole(buf: PixelBuffer, x0: number, y0: number, x1: number, y1: number, ramp = PAL.metal) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    buf.set(x, y, ramp[5]);
    buf.set(x + 1, y, ramp[3]);
  }
}
function peg(buf: PixelBuffer, x: number, y: number) {
  buf.set(x, y - 2, PAL.bark[6]);
  buf.set(x, y - 1, PAL.bark[4]);
  buf.set(x, y, PAL.bark[3]);
  buf.set(x + 1, y - 2, PAL.bark[5]);
}
function stones(buf: PixelBuffer, rng: Rng, cx: number, cy: number, rx: number, ry: number, n: number) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    const r = rng.range(2, 3.2);
    buf.shadedEllipse(x, y, r * 1.2, r * 0.9, PAL.stone.slice(2), -0.5, -0.7, true, a > 0 && a < Math.PI ? 0.1 : -0.1);
  }
}
function done(buf: PixelBuffer, ax: number, ay: number, glow?: PixelBuffer, outline = true): Sprite {
  if (outline) buf.outline(O);
  return trimSprite({ buf, ax, ay, glow });
}
function glowDisc(g: PixelBuffer, cx: number, cy: number, r: number, c: [number, number, number], k = 1) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d = Math.hypot(x - cx, y - cy) / r;
      if (d > 1) continue;
      const a = Math.round((1 - d) * (1 - d) * 255 * k);
      const prev = g.get(x, y) >>> 24;
      if (a > prev) g.set(x, y, withAlpha(hex(rgbHex(c)), a));
    }
}
const rgbHex = (c: [number, number, number]) => '#' + c.map(v => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join('');

// tiny 3x5 font for stencils and signs
const FONT: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', K: '101101110101101', L: '100100100100111', M: '101111111101101',
  N: '110101101101101', O: '010101101101010', P: '110101110100100', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', Y: '101101010010010', Z: '111001010100111', '!': '010010010000010', ' ': '000000000000000',
};
function text(buf: PixelBuffer, x: number, y: number, s: string, c: C) {
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch] ?? FONT[' '];
    for (let i = 0; i < 15; i++) if (g[i] === '1') buf.set(x + (i % 3), y + Math.floor(i / 3), c);
    x += 4;
  }
}

// ------------------------------------------------------------------ backdrops
/** Distant volcano with a smoke plume and forested ridges (w × 190, transparent sky). */
export function volcanoStrip(w: number, seed = 7): PixelBuffer {
  const H = 190;
  const buf = new PixelBuffer(w, H);
  const cx = w * 0.72;
  const ridge = PAL.blue.map(c => mix(c, hex('#8ea2c0'), 0.45));
  for (let x = 0; x < w; x++) {
    const d = Math.abs(x - cx);
    const cone = d < 30 ? 38 + d * 0.15 : 38 + 4.5 + (d - 30) * 0.95;
    const hills = 120 + fbm2(x * 0.008, 1, 4, seed) * 50 - 25;
    const top = Math.min(cone, hills);
    for (let y = Math.max(0, Math.floor(top)); y < H; y++) {
      const isCone = cone <= hills;
      let l = -0.1 + (fbm2(x * 0.05, y * 0.05, 3, seed + 2) - 0.5) * 0.4 + (bayer(x, y) - 0.5) * 0.25;
      if (isCone) {
        l += (x < cx ? 0.25 : -0.2);
        // lava gullies and dark ash streaks
        if (Math.abs(Math.sin((x - cx) * 0.18 + y * 0.02)) < 0.12 && y > top + 6) l -= 0.35;
      }
      l -= (y - top) * 0.004;
      let c = lvl(ridge, l);
      if (!isCone && y < top + 6 && fbm2(x * 0.2, y * 0.2, 2, seed) > 0.45) c = mix(c, hex('#4c6a64'), 0.5);
      buf.set(x, y, c);
    }
  }
  // glowing crater lip
  for (let x = -8; x <= 8; x++) buf.set(cx + x, 38 + Math.abs(x) * 0.15, x % 3 ? hex('#e8a060') : hex('#f4d08a'));
  // smoke plume drifting right
  const rng = new Rng(seed);
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    const px = cx + t * 90 + Math.sin(t * 5) * 6, py = 34 - t * 32;
    const r = 5 + t * 12;
    buf.shadedEllipse(px + rng.range(-3, 3), py, r, r * 0.7, [hex('#8a8e98'), hex('#a8acb4'), hex('#c4c6cc'), hex('#dcdde0')], -0.5, -0.7, true);
  }
  return buf;
}

/** Tileable beach ground texture (w × 90): wet sand, shells, pebbles, kelp wrack. */
export function beachStrip(w: number, seed = 3): PixelBuffer {
  const H = 90, buf = new PixelBuffer(w, H);
  const rng = new Rng(seed);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < w; x++) {
      let l = 0.25 - y * 0.012 + (fbm2(x * 0.08, y * 0.2, 3, seed) - 0.5) * 0.5 + (bayer(x, y) - 0.5) * 0.25;
      if (y < 3) l += 0.2;
      // wind ripples
      l += Math.sin(x * 0.45 + Math.sin(y * 0.6) * 2) * 0.08;
      buf.set(x, y, lvl(PAL.sand, l));
    }
  for (let i = 0; i < w / 6; i++) {
    const x = rng.int(0, w - 1), y = rng.int(2, 40);
    const k = rng.next();
    if (k < 0.4) buf.set(x, y, PAL.stone[rng.int(3, 6)]);
    else if (k < 0.6) { buf.set(x, y, hex('#f4ece0')); buf.set(x + 1, y, hex('#d8c8b8')); }
    else if (k < 0.7) { buf.set(x, y, hex('#e89a8a')); }
    else if (k < 0.8) for (let j = 0; j < 5; j++) buf.set(x + j, y + (j % 2), PAL.olive[rng.int(2, 4)]);
  }
  return buf;
}

// ------------------------------------------------------------------ tent (4 build stages)
/** stage 0: bundle waiting · 1: pegs & string · 2: poles · 3: canvas thrown over · 4: finished, guyed. */
export function tentStage(stage: number, o: { open?: boolean; night?: boolean } = {}): Sprite {
  const W = 120, H = 76, ax = 56, ay = 72;
  const buf = new PixelBuffer(W, H);
  const g = new PixelBuffer(W, H);
  const rng = new Rng(12);
  const G = ay; // ground line
  // footprint (3/4 view): front triangle base 16..76, ridge runs back-right to 104
  const apex: [number, number] = [46, 14], back: [number, number] = [92, 8];
  if (stage === 0) {
    // canvas bundle and poles lying on the sand
    buf.shadedEllipse(40, G - 5, 14, 5, PAL.canvas, -0.5, -0.7);
    rope(buf, 30, G - 8, 50, G - 8, 1, PAL.canvas[1]);
    for (let i = 0; i < 4; i++) pole(buf, 52 + i * 2, G - 2 - i, 86 + i * 2, G - 2 - i);
    return done(buf, ax, ay);
  }
  // pegs + marking string
  const pegs: [number, number][] = [[14, G], [78, G], [100, G - 6], [42, G - 8]];
  pegs.forEach(([x, y]) => peg(buf, x, y));
  if (stage === 1) {
    rope(buf, 14, G - 1, 78, G - 1, 0, PAL.white[4]);
    rope(buf, 78, G - 1, 100, G - 7, 0, PAL.white[4]);
    rope(buf, 14, G - 1, 42, G - 9, 0, PAL.white[3]);
    rope(buf, 42, G - 9, 100, G - 7, 0, PAL.white[3]);
    buf.shadedEllipse(60, G - 4, 10, 4, PAL.canvas, -0.5, -0.7);
    return done(buf, ax, ay);
  }
  if (stage === 2) {
    pole(buf, 16, G, apex[0], apex[1]);
    pole(buf, 76, G, apex[0], apex[1]);
    pole(buf, 60, G - 8, back[0], back[1]);
    pole(buf, 104, G - 6, back[0], back[1]);
    pole(buf, apex[0], apex[1], back[0], back[1], PAL.metal);
    buf.shadedEllipse(38, G - 4, 12, 4, PAL.canvas, -0.5, -0.7);
    return done(buf, ax, ay);
  }
  const loose = stage === 3;
  const sag = loose ? 3 : 0;
  // far side roof (visible between ridge and the back-right eave)
  fabric(buf, [apex[0], apex[1], back[0], back[1], 106, G - 6 + sag, 76, G], PAL.canvas, -0.15, 3, loose ? 0.5 : 0.25, loose ? 0.15 : 0);
  // seams on the roof
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    const x0 = apex[0] + (back[0] - apex[0]) * t, y0 = apex[1] + (back[1] - apex[1]) * t;
    const x1 = 76 + (106 - 76) * t, y1 = G + (G - 6 - G) * t;
    rope(buf, x0, y0, x1, y1, loose ? 1.5 : 0, PAL.canvas[2]);
  }
  // front triangle
  fabric(buf, [apex[0], apex[1], 76, G, 16, G], PAL.canvas, 0.2, 5, loose ? 0.6 : 0, loose ? 0.12 : 0);
  if (!loose) {
    // flysheet eave shadow & ridge highlight
    rope(buf, apex[0], apex[1], back[0], back[1], 0, PAL.canvas[6]);
    rope(buf, apex[0], apex[1] + 1, 16, G, 0, PAL.canvas[5]);
  }
  // door
  if (o.open && !loose) {
    buf.polyFn([apex[0], apex[1] + 8, 60, G, 32, G], (x, y) => (bayer(x, y) < 0.2 ? PAL.canvas[1] : PAL.canvas[0]));
    // tied-back flaps
    fabric(buf, [apex[0], apex[1] + 8, 34, G, 26, G - 2, 30, G - 16], PAL.canvas, 0.35, 7, 0.4);
    fabric(buf, [apex[0], apex[1] + 8, 58, G, 66, G - 2, 62, G - 16], PAL.canvas, 0.0, 8, 0.4);
    rope(buf, 26, G - 12, 32, G - 11, 0, PAL.red[4]);
    rope(buf, 60, G - 11, 66, G - 12, 0, PAL.red[4]);
    // warm lamplight from inside at night
    for (let y = apex[1] + 12; y < G; y++)
      for (let x = 30; x < 64; x++) if (buf.get(x, y) === PAL.canvas[0] || buf.get(x, y) === PAL.canvas[1]) g.set(x, y, withAlpha(hex('#ffb060'), 150));
  } else {
    rope(buf, apex[0], apex[1] + 6, apex[0], G, 0, PAL.canvas[2]);
    for (let y = apex[1] + 10; y < G; y += 3) buf.set(apex[0] + 1, y, PAL.metal[6]);
  }
  if (!loose) {
    // guy ropes to the pegs and a patch + name on the flysheet
    rope(buf, apex[0], apex[1], 4, G, 3, PAL.canvas[6]);
    rope(buf, back[0], back[1], 116, G - 4, 3, PAL.canvas[6]);
    rope(buf, 76, G - 2, 86, G, 0, PAL.canvas[6]);
    peg(buf, 4, G); peg(buf, 116, G - 4); peg(buf, 86, G);
    fabric(buf, [86, 34, 96, 30, 98, 38, 88, 42], PAL.olive, 0.1, 9);
    text(buf, 70, 44, 'RV', PAL.canvas[2]);
  } else {
    // loose canvas corners flapping on the sand
    fabric(buf, [16, G, 8, G + 0, 12, G - 5], PAL.canvas, 0.1, 11);
    rng.next();
  }
  return done(buf, ax, ay, o.open && !loose ? g : undefined);
}

// ------------------------------------------------------------------ campfire
/** 0: stone ring · 1: wood stacked · 2: lit (embers; flames are particles). pot adds Lou's tripod. */
export function campfire(level: number, o: { pot?: boolean } = {}): Sprite {
  const W = 56, H = 56, ax = 28, ay = 50;
  const buf = new PixelBuffer(W, H), g = new PixelBuffer(W, H);
  const rng = new Rng(4);
  if (level >= 2) {
    // ash bed
    buf.shadedEllipse(ax, ay - 3, 11, 3.5, [hex('#2a2422'), hex('#3a3230'), hex('#5a504a')], -0.4, -0.8);
  }
  stones(buf, rng, ax, ay - 3, 13, 4.2, 11);
  if (level >= 1) {
    if (level === 1) {
      // teepee of sticks
      for (let i = 0; i < 7; i++) {
        const bx = ax - 9 + i * 3;
        pole(buf, bx, ay - 3, ax + (i - 3) * 0.6, ay - 22, PAL.bark);
      }
      buf.shadedEllipse(ax - 13, ay - 4, 4, 2, PAL.bark.slice(2), -0.5, -0.7);
    } else {
      // charred crossed logs with glowing cracks
      for (const [x0, y0, x1, y1] of [[ax - 10, ay - 3, ax + 6, ay - 10], [ax + 10, ay - 3, ax - 5, ay - 11], [ax - 4, ay - 2, ax + 5, ay - 12]]) {
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
        for (let i = 0; i <= n; i++) {
          const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
          buf.set(x, y, hex('#2a1a12')); buf.set(x, y + 1, hex('#1a100a'));
          if (rng.chance(0.35)) { buf.set(x, y, hex('#f08030')); g.set(x, y, withAlpha(hex('#ff9040'), 255)); }
        }
      }
      for (let i = 0; i < 10; i++) { const x = ax + rng.range(-8, 8), y = ay - 3 - rng.range(0, 2); buf.set(x, y, hex('#ffb050')); g.set(x, y, withAlpha(hex('#ffa040'), 255)); }
      glowDisc(g, ax, ay - 6, 10, [1, 0.55, 0.2], 0.55);
    }
  }
  if (o.pot) {
    // tripod + billy pot
    pole(buf, ax - 14, ay - 1, ax, ay - 40, PAL.bark);
    pole(buf, ax + 14, ay - 1, ax, ay - 40, PAL.bark);
    pole(buf, ax + 2, ay - 5, ax, ay - 40, PAL.bark);
    rope(buf, ax, ay - 40, ax, ay - 28, 0, PAL.metal[4]);
    buf.shadedEllipse(ax, ay - 23, 6, 5, PAL.metal.slice(1), -0.5, -0.7);
    buf.rect(ax - 6, ay - 28, 12, 2, PAL.metal[6]);
  }
  return done(buf, ax, ay, level >= 2 ? g : undefined);
}

// ------------------------------------------------------------------ workbench
/** 0: planks on the ground · 1: two trestles · 2: finished bench with vice, tools and jars. */
export function workbench(level: number): Sprite {
  const W = 70, H = 50, ax = 35, ay = 46;
  const buf = new PixelBuffer(W, H);
  if (level <= 0) {
    for (let i = 0; i < 3; i++) wood(buf, 14 + i * 2, ay - 3 - i * 2, 40, 2, i + 3, 0.1);
    return done(buf, ax, ay);
  }
  // trestles (A-shaped sawhorses)
  for (const x of [16, 52]) {
    pole(buf, x - 5, ay, x, ay - 20, PAL.bark);
    pole(buf, x + 5, ay, x, ay - 20, PAL.bark);
    wood(buf, x - 4, ay - 21, 9, 2, x, 0.1);
  }
  if (level >= 2) {
    wood(buf, 6, ay - 25, 58, 4, 9, 0.2);
    wood(buf, 6, ay - 21, 58, 1, 10, -0.4);
    // vice
    buf.rect(56, ay - 30, 6, 5, PAL.metal[4]); buf.rect(56, ay - 30, 6, 1, PAL.metal[6]); buf.rect(62, ay - 28, 3, 1, PAL.metal[5]);
    // tools: hammer, saw, jars of lure bait, a lantern hook
    buf.rect(10, ay - 27, 9, 1, PAL.bark[5]); buf.rect(17, ay - 29, 3, 3, PAL.metal[5]);
    for (let i = 0; i < 3; i++) {
      const jx = 26 + i * 6;
      buf.rect(jx, ay - 32, 4, 7, [hex('#b8d8c8'), hex('#e8c860'), hex('#c88070')][i]);
      buf.rect(jx, ay - 33, 4, 1, PAL.metal[5]);
      buf.set(jx + 1, ay - 31, hex('#ffffff'));
    }
    buf.poly([44, ay - 25, 52, ay - 25, 51, ay - 28, 45, ay - 29], PAL.metal[6]);
    // rope coil under the bench
    buf.shadedEllipse(34, ay - 3, 6, 2.5, PAL.canvas, -0.5, -0.7);
    buf.shadedEllipse(34, ay - 3, 3, 1, PAL.canvas.slice(0, 3), -0.5, -0.7);
  } else {
    // loose plank resting across
    wood(buf, 10, ay - 23, 50, 2, 8, 0.15);
  }
  return done(buf, ax, ay);
}

// ------------------------------------------------------------------ radio mast
/** 0: parts crate · 1: mast raised and guyed · 2: transmitter wired, lamp blinking. */
export function radioStation(level: number): Sprite {
  const W = 70, H = 150, ax = 30, ay = 146;
  const buf = new PixelBuffer(W, H), g = new PixelBuffer(W, H);
  // parts crate
  wood(buf, 18, ay - 12, 22, 12, 2, 0.1);
  text(buf, 20, ay - 9, 'RADIO', PAL.white[5]);
  if (level <= 0) {
    for (let i = 0; i < 3; i++) pole(buf, 42 + i, ay - 1, 64, ay - 2 - i, PAL.metal);
    return done(buf, ax, ay);
  }
  // lashed pipe mast
  const top = ay - 128;
  pole(buf, 29, ay - 12, 30, top, PAL.metal);
  for (let y = ay - 20; y > top + 8; y -= 22) { rope(buf, 27, y, 33, y + 2, 0, PAL.canvas[5]); rope(buf, 27, y + 2, 33, y, 0, PAL.canvas[4]); }
  // cross arm + dipole wires
  pole(buf, 20, top + 8, 40, top + 8);
  rope(buf, 30, top, 2, ay - 2, 6, PAL.canvas[5]);
  rope(buf, 30, top, 64, ay - 2, 6, PAL.canvas[5]);
  rope(buf, 30, top + 40, 10, ay - 2, 3, PAL.canvas[4]);
  peg(buf, 2, ay); peg(buf, 64, ay); peg(buf, 10, ay);
  // flag rag on top
  fabric(buf, [31, top, 42, top + 2, 40, top + 7, 31, top + 6], PAL.red, 0.2, 5);
  if (level >= 2) {
    // transmitter box on the crate with dials and a blinking lamp
    buf.rect(20, ay - 22, 16, 10, PAL.olive[3]);
    buf.rect(20, ay - 22, 16, 1, PAL.olive[5]);
    buf.disc(24, ay - 17, 1.5, PAL.metal[6]); buf.disc(30, ay - 17, 1.5, PAL.metal[6]);
    buf.rect(33, ay - 20, 2, 2, hex('#ff5040'));
    g.set(33, ay - 20, withAlpha(hex('#ff5040'), 255)); g.set(34, ay - 20, withAlpha(hex('#ff5040'), 255));
    glowDisc(g, 34, ay - 19, 4, [1, 0.3, 0.2], 0.6);
    // wires snaking up the mast
    for (let y = ay - 22; y > top + 10; y -= 1) buf.set(31 + Math.round(Math.sin(y * 0.3)), y, hex('#2a2a2a'));
    // headphones & battery
    buf.rect(40, ay - 8, 7, 8, PAL.yellow[4]); buf.rect(40, ay - 8, 7, 2, PAL.metal[2]);
  }
  return done(buf, ax, ay, level >= 2 ? g : undefined);
}

// ------------------------------------------------------------------ camp furniture
export function logBench(): Sprite {
  const buf = new PixelBuffer(48, 16);
  buf.shadedEllipse(24, 9, 22, 5, PAL.bark.slice(1), -0.5, -0.7);
  buf.shadedEllipse(3, 9, 2.5, 4.5, PAL.bark.slice(4), -0.5, -0.7);
  for (let i = 0; i < 6; i++) buf.set(8 + i * 6, 6, PAL.bark[6]);
  buf.shadedEllipse(3, 9, 1.2, 2.5, PAL.canvas.slice(3), -0.5, -0.7);
  return done(buf, 24, 14);
}

export function flagpole(): Sprite {
  const buf = new PixelBuffer(30, 90);
  pole(buf, 8, 88, 8, 4, PAL.bark);
  // Rowan's spare shirt as a flag
  fabric(buf, [9, 6, 27, 8, 26, 20, 9, 18], PAL.blue, 0.2, 3, 0.8);
  for (let x = 12; x < 25; x += 4) buf.set(x, 12, PAL.white[5]);
  stones(buf, new Rng(2), 8, 86, 5, 2, 6);
  return done(buf, 8, 88);
}

export function sign(): Sprite {
  const buf = new PixelBuffer(46, 44);
  pole(buf, 10, 43, 10, 16, PAL.bark);
  pole(buf, 36, 43, 36, 16, PAL.bark);
  wood(buf, 2, 8, 42, 16, 5, 0.15);
  text(buf, 5, 10, 'CAMP', PAL.white[6]);
  text(buf, 5, 17, 'KITTIWAKE', PAL.white[5]);
  // hand-drawn map pinned below
  buf.rect(14, 26, 18, 12, hex('#e8dcb8'));
  for (let i = 0; i < 16; i++) buf.set(15 + i, 32 + Math.round(Math.sin(i * 0.6) * 2), hex('#5a88b0'));
  buf.set(20, 29, hex('#c83030')); buf.set(21, 29, hex('#c83030'));
  return done(buf, 23, 43);
}

export function kitchen(): Sprite {
  const buf = new PixelBuffer(60, 50);
  // crate table + tarp awning
  wood(buf, 8, 28, 40, 4, 3, 0.2);
  wood(buf, 10, 32, 6, 16, 4, 0);
  wood(buf, 40, 32, 6, 16, 5, 0);
  pole(buf, 4, 48, 4, 6, PAL.bark);
  pole(buf, 54, 48, 54, 10, PAL.bark);
  fabric(buf, [2, 6, 58, 10, 56, 16, 4, 12], PAL.blue, 0.1, 5, 0.6);
  // pots, pans, hanging ladle, fish on a line
  buf.shadedEllipse(18, 24, 5, 4, PAL.metal.slice(1), -0.5, -0.7);
  buf.rect(24, 22, 8, 5, PAL.metal[4]); buf.rect(32, 23, 4, 1, PAL.metal[3]);
  pole(buf, 42, 14, 42, 22, PAL.metal);
  buf.disc(42, 23, 1.5, PAL.metal[5]);
  for (let i = 0; i < 3; i++) { rope(buf, 10 + i * 5, 13, 10 + i * 5, 16, 0, PAL.canvas[3]); buf.ellipse(10 + i * 5, 18, 1.3, 2.5, hex('#8aa8b0')); }
  buf.rect(36, 24, 6, 4, hex('#e8c878'));
  return done(buf, 30, 48);
}

// ------------------------------------------------------------------ tent interior
export interface InteriorArt { bg: PixelBuffer; props: Record<string, Sprite>; floorY: number; laptopScreen?: { x: number; y: number; w: number; h: number } }

export function tentInterior(): InteriorArt {
  const W = 640, H = 360, FY = 300;
  const bg = new PixelBuffer(W, H);
  // canvas walls seen from inside: light glows through the fabric, seams and ridge pole
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = (x - W / 2) / (W / 2);
      const roof = 40 + Math.abs(dx) * 10;
      if (y < FY) {
        let l = 0.25 - Math.abs(dx) * 0.35 - (y / FY) * 0.25 + (fbm2(x * 0.02, y * 0.02, 3, 4) - 0.5) * 0.3 + (bayer(x, y) - 0.5) * 0.18;
        // seams
        if (Math.abs(((x - W / 2) % 80)) < 1.2) l -= 0.3;
        // slope bands
        if (y < roof + 8 && y > roof) l += 0.1;
        // light through the fabric: warm glow center-top
        l += Math.max(0, 1 - Math.hypot(dx, (y - 60) / 200)) * 0.2;
        bg.set(x, y, lvl(PAL.canvas, l));
      } else {
        // groundsheet over sand, rugs
        let l = -0.1 + (fbm2(x * 0.05, y * 0.1, 2, 5) - 0.5) * 0.3 + (bayer(x, y) - 0.5) * 0.2 - (y - FY) * 0.01;
        let c = lvl(PAL.olive, l);
        if (x > 60 && x < 200 && y > FY + 6 && y < FY + 30) c = lvl(PAL.red, l + 0.1 + (((x >> 2) + (y >> 2)) % 2 ? 0.1 : -0.1));
        bg.set(x, y, c);
      }
    }
  // ridge pole and uprights
  for (let x = 0; x < W; x++) { bg.set(x, 36, PAL.metal[5]); bg.set(x, 37, PAL.metal[3]); }
  for (const x of [40, 600]) for (let y = 36; y < FY; y++) { bg.set(x, y, PAL.metal[5]); bg.set(x + 1, y, PAL.metal[3]); }
  // door flap on the right, a sliver of beach outside
  for (let y = 150; y < FY; y++) for (let x = 606; x < 634; x++) {
    const inDoor = x - 606 > (y - 150) * 0.1;
    if (inDoor) bg.set(x, y, y > 270 ? PAL.sand[5] : mix(hex('#bcd8e4'), hex('#e8f0f0'), (y - 150) / 150));
  }
  // clothesline with socks and a notebook page pinned
  rope(bg, 60, 70, 280, 78, 10, PAL.canvas[1]);
  for (const [x, c] of [[100, PAL.red[4]], [130, PAL.white[5]], [200, PAL.blue[4]], [240, PAL.yellow[5]]] as const) bg.rect(x, 78 + Math.round(Math.sin((x - 60) / 220 * Math.PI) * 10) - 2, 5, 9, c);

  const props: Record<string, Sprite> = {};
  // sleeping bag on a foam mat
  {
    const b = new PixelBuffer(90, 22);
    b.rect(0, 16, 90, 5, hex('#3a6a8a'));
    b.shadedEllipse(44, 12, 40, 7, PAL.red.slice(1), -0.5, -0.7);
    for (let x = 10; x < 80; x += 8) b.set(x, 8, PAL.red[6]);
    b.shadedEllipse(12, 10, 9, 6, PAL.white.slice(2), -0.5, -0.7);
    props.bed = done(b, 45, 21);
  }
  // specimen shelf: three fullness states
  for (let f = 0; f < 3; f++) {
    const b = new PixelBuffer(46, 64);
    for (const y of [4, 24, 44]) wood(b, 2, y, 42, 3, y, 0.1);
    wood(b, 2, 4, 3, 60, 1, 0); wood(b, 41, 4, 3, 60, 2, 0);
    const rng = new Rng(f + 3);
    const n = 3 + f * 4;
    for (let i = 0; i < n; i++) {
      const row = i % 3, col = Math.floor(i / 3);
      const x = 7 + col * 7 + (row % 2) * 2, y = [4, 24, 44][row];
      const col2 = [hex('#b8d8c8'), hex('#e8c860'), hex('#c88070'), hex('#9ac870'), hex('#b0a0e0')][rng.int(0, 4)];
      b.rect(x, y - 8, 5, 8, col2); b.rect(x, y - 9, 5, 1, PAL.metal[5]); b.set(x + 1, y - 7, hex('#ffffff'));
      if (rng.chance(0.5)) b.set(x + 2, y - 4, PAL.bark[2]);
    }
    // a skull, a feather in a jar, labels
    if (f >= 1) b.shadedEllipse(34, 40, 4, 3, PAL.white.slice(3), -0.5, -0.7);
    if (f >= 2) { b.rect(33, 12, 1, 12, hex('#6a8ab0')); b.rect(32, 13, 3, 2, hex('#8aa8d0')); }
    props['shelf' + f] = done(b, 23, 63);
  }
  // crate desk + stool
  {
    const b = new PixelBuffer(56, 30);
    wood(b, 0, 0, 56, 4, 3, 0.25);
    wood(b, 2, 4, 22, 26, 4, 0); wood(b, 32, 4, 22, 26, 5, 0);
    text(b, 6, 14, 'FRAGILE', PAL.red[4]);
    // field notebook and pen on the desk edge
    props.desk = done(b, 28, 30);
    const s = new PixelBuffer(16, 16);
    wood(s, 0, 0, 16, 3, 6, 0.2); pole(s, 2, 15, 3, 3, PAL.bark); pole(s, 13, 15, 12, 3, PAL.bark);
    props.stool = done(s, 8, 16);
  }
  // THE laptop: seen from the back-3/4 so the sticker-covered lid faces the room
  {
    const b = new PixelBuffer(40, 30);
    // base
    b.poly([2, 26, 36, 26, 38, 29, 0, 29], PAL.metal[3]);
    b.rect(2, 26, 34, 1, PAL.metal[5]);
    // lid (back), slight tilt
    b.polyFn([6, 2, 34, 1, 36, 26, 4, 26], (x, y) => lvl(PAL.metal, 0.1 - y * 0.012 + (bayer(x, y) - 0.5) * 0.1));
    // stickers: fern koru, kiwi, "NZ", a monarch silhouette, a hazard stripe, a coffee ring
    const st = (x: number, y: number, rows: string[], pal: Record<string, C>) => rows.forEach((r, j) => [...r].forEach((ch, i) => { if (pal[ch] !== undefined) b.set(x + i, y + j, pal[ch]); }));
    st(9, 5, ['.ggg.', 'gg.gg', 'g.g.g', 'gg.g.', '.gg..'], { g: hex('#5ac05a') });
    st(22, 4, ['.bb..', 'bbbbb', '.bbb.', '.l.l.'], { b: hex('#8a5a34'), l: hex('#e8c060') });
    st(27, 12, ['wwwww', 'wrwrw', 'wwwww'], { w: hex('#f4f0e0'), r: hex('#c02a2a') });
    st(8, 14, ['k...k', 'kk.kk', '.kkk.', '..k..'], { k: hex('#1a1a20') });
    st(14, 20, ['yky', 'kyk', 'yky', 'kyk'], { y: hex('#f0c030'), k: hex('#1a1a20') });
    st(24, 19, ['.oo.', 'o..o', 'o..o', '.oo.'], { o: hex('#8a6a4a') });
    b.rect(16, 10, 4, 3, hex('#e86aa0'));
    // screen light spilling past the lid edges
    const g = new PixelBuffer(40, 30);
    for (let y = 2; y < 26; y++) { g.set(5, y, withAlpha(hex('#9ad0ff'), 160)); g.set(35, y, withAlpha(hex('#9ad0ff'), 160)); }
    props.laptopOpen = done(b, 20, 29, g);
  }
  // backpack
  {
    const b = new PixelBuffer(22, 26);
    b.shadedEllipse(11, 14, 9, 11, PAL.olive.slice(1), -0.5, -0.7);
    b.rect(4, 16, 14, 7, PAL.olive[3]); b.rect(4, 16, 14, 1, PAL.olive[5]);
    b.rect(10, 3, 2, 4, PAL.bark[3]);
    b.rect(14, 18, 3, 3, PAL.red[4]);
    props.backpack = done(b, 11, 25);
  }
  // wall map with pins and string
  {
    const b = new PixelBuffer(60, 42);
    b.rectFn(0, 0, 60, 42, (x, y) => lvl([hex('#b8a878'), hex('#d0c090'), hex('#e8dcb0'), hex('#f4ecd0')], 0.3 + (fbm2(x * 0.1, y * 0.1, 2, 3) - 0.5) * 0.6));
    // island outline with a volcano and rivers
    b.ellipseFn(30, 22, 22, 14, (x, y) => (fbm2(x * 0.2, y * 0.2, 2, 9) > 0.3 ? hex('#8ab070') : hex('#a8c888')));
    b.disc(38, 16, 3, hex('#8a6a58'));
    for (let i = 0; i < 18; i++) b.set(20 + i, 22 + Math.round(Math.sin(i * 0.5) * 2), hex('#4a78b0'));
    for (const [x, y, c] of [[16, 26, '#e03030'], [28, 14, '#3080e0'], [42, 24, '#e0c030'], [34, 30, '#30b050']] as const) { b.set(x, y, hex(c)); b.set(x, y - 1, hex(c)); }
    rope(b, 16, 26, 28, 14, 0, hex('#c02020')); rope(b, 28, 14, 42, 24, 0, hex('#c02020'));
    props.map = done(b, 30, 42);
  }
  // hanging lantern (anchor = hook at the top)
  {
    const b = new PixelBuffer(14, 26), g = new PixelBuffer(14, 26);
    b.rect(6, 0, 2, 6, PAL.metal[4]);
    b.rect(3, 6, 8, 2, PAL.metal[5]);
    b.rect(3, 8, 8, 12, hex('#f8d890')); b.rect(3, 8, 1, 12, PAL.metal[4]); b.rect(10, 8, 1, 12, PAL.metal[3]);
    b.rect(3, 20, 8, 3, PAL.metal[4]);
    b.rect(6, 11, 2, 6, hex('#fff4d0'));
    for (let y = 8; y < 20; y++) for (let x = 4; x < 10; x++) g.set(x, y, withAlpha(hex('#ffd080'), 255));
    props.lantern = done(b, 7, 0, g);
  }
  return { bg, props, floorY: FY, laptopScreen: { x: 400, y: FY - 54, w: 40, h: 26 } };
}

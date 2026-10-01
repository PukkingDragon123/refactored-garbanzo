// V9 island art: the dune and coastal plants. Silvery spinifex with its spiky seed heads (and loose
// heads for the wind to roll), golden pīngao in tight spirals, marram, pōhuehue (beach morning glory)
// and horokaka (ice plant) creeping over the sand, glossy taupata shrubs with orange berries, harakeke
// (flax) fans with their tall flower stalks, and toetoe tussocks with drooping cream plumes. Sizes are
// in px of plant height; every sprite is anchored at the middle of its base and fully contained.

import { blade, leafStamp, drawStamp, tube, P } from '../jungle-core';
import { clamp, hash2, noise1, noise2 } from '../../core/math';
import { Bed, Sprite, Rng, canvas, done, sandLip, tone, ramp, hex, mix } from './kit';

const SPIN = ramp('#2e3a2c', '#44543e', '#5e6e54', '#7a8a6c', '#98a888', '#b6c4a6', '#d2dcc4', '#eaf0e0');
const STRAW = ramp('#5a4a2a', '#7e6a3e', '#a28c54', '#c4ae70', '#e0cc92', '#f2e4b4');
const PINGAO = ramp('#3e3a14', '#5e561c', '#86761e', '#aa8a22', '#c89c2a', '#e0b23a', '#f0ca5a', '#f8e08a');
const MARRAM = ramp('#2e3a28', '#445238', '#5c6c48', '#76865a', '#92a06c', '#b0ba84');
const GLOSS = ramp('#0c2014', '#12301c', '#1a4424', '#245a2c', '#307236', '#428c40', '#5caa4c', '#8acc6a', '#c8eca0');
const FLAX = ramp('#10160c', '#1b2512', '#283618', '#37481c', '#475b20', '#5a6d25', '#6f802b', '#899534');
const FLAXEDGE = hex('#9a4a1e');
const TOE = ramp('#26301c', '#384626', '#4c5c30', '#62723c', '#7c8a4a', '#98a45c');
const PLUME = ramp('#8a7a58', '#a8966c', '#c4b288', '#dccca4', '#ece0c0', '#f8f0dc');
const ICE = ramp('#1c3a1c', '#2a5424', '#3c702c', '#548c36', '#72a844');
const MAGENTA = ramp('#6a0a3a', '#a01a5a', '#d0307a', '#ec5a9a', '#fa8abc');
const GLORY = ramp('#6a3a5a', '#a86a8a', '#d89ab4', '#f4c4d4', '#fce8ee');

/** spinifex: arching silver-green leaves, sometimes a spiky seed head or two */
export function spinifex(seed: number, size = 22, bed: Bed = 'dry', heads = 1): Sprite {
  const rng = new Rng(seed * 163 + 33);
  const W = size * 2.6, H = size * 1.3;
  const { buf, o } = canvas(W, H, Math.ceil(size * 0.6));
  const cx = o + W / 2, gy = o + H;
  const n = rng.int(12, 18);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    const a = -Math.PI / 2 + t * 2.6 + rng.range(-0.15, 0.15);
    blade(buf, { x: cx + t * size * 0.5, y: gy, ang: a, len: size * rng.range(0.7, 1.15), droop: 0.5 + Math.abs(t) * 1.6, w0: 2.2, ramp: SPIN, base: 3 + (i % 3) });
  }
  // runners creeping off along the sand with a little tuft at a node
  for (const s of [-1, 1]) {
    if (rng.chance(0.4)) continue;
    const L = size * rng.range(0.8, 1.6);
    for (let k = 0; k < L; k++) buf.set(cx + s * (size * 0.3 + k), gy - 0.5 + Math.sin(k * 0.3) * 0.4, SPIN[k % 5 ? 3 : 5]);
    const nx = cx + s * (size * 0.3 + L * 0.8);
    for (let j = 0; j < 4; j++) blade(buf, { x: nx, y: gy, ang: -Math.PI / 2 + (j - 1.5) * 0.5, len: size * 0.35, droop: 0.8, w0: 1.6, ramp: SPIN, base: 4 });
  }
  // seed heads: bursts of stiff spokes on short stalks
  for (let k = 0; k < heads; k++) {
    const hx = cx + rng.range(-size * 0.4, size * 0.4), hy = gy - size * rng.range(0.7, 1.1), r = size * rng.range(0.22, 0.32);
    for (let s = 0; s < gy - hy; s++) buf.set(hx + s * 0.1, gy - s, STRAW[2]);
    for (let j = 0; j < 14; j++) {
      const a = (j / 14) * Math.PI * 2 + rng.range(-0.1, 0.1);
      for (let q = 1; q < r; q++) buf.set(hx + Math.cos(a) * q, hy + Math.sin(a) * q * 0.9, q > r - 1.5 ? STRAW[5] : STRAW[3 + (j & 1)]);
    }
    buf.set(hx, hy, STRAW[1]);
  }
  sandLip(buf, cx - size * 0.8, cx + size * 0.8, gy + 0.5, 2.2, bed, seed + 3);
  return done(buf, cx, gy, 0.35);
}

/** a loose spinifex seed head (the wind rolls these along the beach) */
export function spinBall(seed: number, r = 5): Sprite {
  const rng = new Rng(seed * 167 + 35);
  const { buf, o } = canvas(r * 2 + 2, r * 2 + 2, 2);
  const cx = o + r + 1, cy = o + r + 1;
  for (let j = 0; j < 18; j++) {
    const a = (j / 18) * Math.PI * 2 + rng.range(-0.12, 0.12);
    for (let q = 0; q < r; q++) buf.set(cx + Math.cos(a) * q, cy + Math.sin(a) * q, q > r - 1.5 ? STRAW[5] : STRAW[2 + (j % 3)]);
  }
  buf.set(cx, cy, STRAW[0]);
  return done(buf, cx, cy, 0);
}

/** pīngao: a tight golden sedge tuft, blades curling outward */
export function pingao(seed: number, size = 18, bed: Bed = 'dry'): Sprite {
  const rng = new Rng(seed * 173 + 37);
  const { buf, o } = canvas(size * 2.4, size * 1.2, Math.ceil(size * 0.5));
  const cx = o + size * 1.2, gy = o + size * 1.2;
  const n = rng.int(14, 22);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    const a = -Math.PI / 2 + t * 2.4 + rng.range(-0.1, 0.1);
    blade(buf, { x: cx + t * 4, y: gy, ang: a, len: size * rng.range(0.6, 1.05), droop: 0.3 + Math.abs(t) * 2.2, w0: 2.4, ramp: PINGAO, base: 3 + rng.int(0, 3), curl: 0.6 });
  }
  // the green heart of the tuft
  for (let k = 0; k < 5; k++) blade(buf, { x: cx + rng.range(-2, 2), y: gy, ang: -Math.PI / 2 + rng.range(-0.3, 0.3), len: size * 0.45, droop: 0.2, w0: 2, ramp: MARRAM, base: 3 });
  sandLip(buf, cx - size * 0.6, cx + size * 0.6, gy + 0.5, 2.2, bed, seed + 3);
  return done(buf, cx, gy, 0.35);
}

/** marram: stiff upright grey-green blades, a few dead straw ones and a seed spike */
export function marram(seed: number, size = 26, bed: Bed = 'dry'): Sprite {
  const rng = new Rng(seed * 179 + 39);
  const { buf, o } = canvas(size * 1.6, size * 1.3, Math.ceil(size * 0.4));
  const cx = o + size * 0.8, gy = o + size * 1.3;
  const n = rng.int(16, 24);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    const dead = rng.chance(0.25);
    blade(buf, { x: cx + t * size * 0.4, y: gy, ang: -Math.PI / 2 + t * 1.2 + rng.range(-0.12, 0.12), len: size * rng.range(0.6, 1.1), droop: 0.08 + Math.abs(t) * 0.5, w0: 1.8, ramp: dead ? STRAW : MARRAM, base: dead ? 3 : 2 + (i % 3) });
  }
  if (rng.chance(0.6)) {
    const sx = cx + rng.range(-3, 3), top = gy - size * 1.2;
    for (let y = gy - size * 0.5; y > top; y--) buf.set(sx + (gy - y) * 0.05, y, y < top + size * 0.25 ? STRAW[4] : STRAW[2]);
  }
  sandLip(buf, cx - size * 0.45, cx + size * 0.45, gy + 0.5, 2.4, bed, seed + 3);
  return done(buf, cx, gy, 0.35);
}

/** horokaka (ice plant): a succulent mat with magenta daisies */
export function icePlant(seed: number, w = 40, bed: Bed = 'dry'): Sprite {
  const rng = new Rng(seed * 181 + 41);
  const H = 7;
  const { buf, o } = canvas(w, H + 6, 6);
  const gy = o + H + 3;
  for (let k = 0; k < w * 1.4; k++) {
    const x = o + rng.range(0, w), u = (x - o) / w;
    const y = gy - rng.range(0, H * Math.sin(u * Math.PI) + 1);
    const a = rng.range(-Math.PI, 0);
    for (let s = 0; s < rng.range(3, 5); s++) {
      const px = x + Math.cos(a) * s, py = y + Math.sin(a) * s * 0.6;
      buf.set(px, py, s > 2.5 ? hex('#c84a3a') : tone(ICE, 0.55 - Math.sin(a) * 0.2 + (noise2(px / 3, py / 3, seed) - 0.5) * 0.4, px, py));
    }
  }
  for (let k = 0; k < rng.int(2, 5); k++) {
    const fx = o + rng.range(w * 0.1, w * 0.9), fy = gy - rng.range(2, H), r = rng.range(2, 3.2);
    for (let j = 0; j < 12; j++) { const a = (j / 12) * Math.PI * 2; for (let q = 1; q <= r; q++) buf.set(fx + Math.cos(a) * q, fy + Math.sin(a) * q * 0.7, MAGENTA[q > r - 1 ? 4 : 2 + (j & 1)]); }
    buf.set(fx, fy, hex('#f4d04a'));
  }
  sandLip(buf, o - 2, o + w + 2, gy + 0.5, 1.2, bed, seed + 3, 1.6);
  return done(buf, o + w / 2, gy, 0.3);
}

/** pōhuehue (beach morning glory): runners with kidney leaves and pale pink trumpets */
export function morningGlory(seed: number, w = 50, bed: Bed = 'dry'): Sprite {
  const rng = new Rng(seed * 191 + 43);
  const { buf, o } = canvas(w, 10, 6);
  const gy = o + 9;
  for (let r = 0; r < 3; r++) {
    let x = o + rng.range(0, w * 0.3), y = gy - rng.range(0, 3);
    const L = w * rng.range(0.5, 0.9);
    for (let s = 0; s < L; s++) {
      x += 1; y += Math.sin(s * 0.15 + r) * 0.25;
      buf.set(x, y, hex('#4a6a2a'));
      if (s % 6 === 2) {
        // a kidney leaf on a short stalk
        const lx = x + rng.range(-1, 1), ly = y - rng.range(1.5, 3);
        for (let dy = -2; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy * 1.6 <= 5 && !(dy === 1 && dx === 0)) buf.set(lx + dx, ly + dy, GLOSS[clamp(5 - dy - (dx > 0 ? 1 : 0), 2, 8)]);
      }
      if (s % 13 === 9 && rng.chance(0.8)) {
        // a trumpet flower facing up
        const fx = x, fy = y - 3.5;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy * 2 <= 5) buf.set(fx + dx, fy + dy, GLORY[clamp(3 - dy + (Math.abs(dx) === 2 ? -1 : 0), 1, 4)]);
        buf.set(fx, fy, hex('#fff4c8')); buf.set(fx, fy + 1, GLORY[0]);
      }
    }
  }
  sandLip(buf, o, o + w, gy + 0.5, 0.8, bed, seed + 3, 1.8);
  return done(buf, o + w / 2, gy, 0.3);
}

/** taupata: a rounded coastal shrub of glossy leaves with orange berries */
export function taupata(seed: number, size = 30, bed: Bed = 'dry'): Sprite {
  const rng = new Rng(seed * 193 + 45);
  const W = size * 1.5, H = size;
  const { buf, o } = canvas(W, H, 8);
  const cx = o + W / 2, gy = o + H;
  // woody stems
  for (let k = 0; k < 4; k++) tube(buf, [[cx + rng.range(-3, 3), gy + 1], [cx + rng.range(-W * 0.3, W * 0.3), gy - H * rng.range(0.4, 0.7)]], t => 1.6 - t, ramp('#1e140c', '#33241a', '#4a3626', '#634a34'), 2, { spread: 1.2 });
  // leaf clusters: overlapping rounded masses of glossy leaves, lit from the upper left
  const blobs: [number, number, number][] = [];
  for (let k = 0; k < 7; k++) blobs.push([cx + rng.range(-W * 0.32, W * 0.32), gy - H * rng.range(0.35, 0.75), size * rng.range(0.22, 0.34)]);
  blobs.sort((a, b) => b[1] - a[1]);
  for (const [bx, by, r] of blobs) {
    for (let k = 0; k < r * r * 1.1; k++) {
      const a = rng.range(0, Math.PI * 2), d = Math.sqrt(rng.next()) * r;
      const x = bx + Math.cos(a) * d * 1.2, y = by + Math.sin(a) * d;
      const lit = clamp(0.62 - (x - bx) / r * 0.25 - (y - by) / r * 0.35 + rng.range(-0.15, 0.15));
      drawStamp(buf, leafStamp('oval', rng.range(3.5, 5.5), rng.range(2.4, 3.4), rng.range(0, Math.PI)), x, y, GLOSS, Math.round(1 + lit * 6));
    }
  }
  // wet-look glints and berries
  for (let k = 0; k < size * 0.6; k++) {
    const x = cx + rng.range(-W * 0.45, W * 0.45), y = gy - rng.range(H * 0.2, H);
    if (buf.opaque(x, y) && !buf.opaque(x, y - 1)) buf.set(x, y, GLOSS[8]);
  }
  for (let k = 0; k < rng.int(4, 9); k++) {
    const x = cx + rng.range(-W * 0.35, W * 0.35), y = gy - rng.range(H * 0.3, H * 0.8);
    if (!buf.opaque(x, y)) continue;
    buf.set(x, y, hex('#f07a1e')); buf.set(x + 1, y, hex('#c85a14')); buf.set(x, y - 1, hex('#ffb05a'));
  }
  sandLip(buf, cx - W * 0.4, cx + W * 0.4, gy + 0.5, 2.2, bed, seed + 3);
  return done(buf, cx, gy, 0.45);
}

/** harakeke: a flax fan, with tall flower stalks (red-orange flowers or black seed pods) */
export function harakeke(seed: number, size = 40, bed: Bed = 'dry', stalks = 1, pods = false): Sprite {
  const rng = new Rng(seed * 197 + 47);
  const { buf, o } = canvas(size * 1.8, size * 2.2, Math.ceil(size * 0.5));
  const cx = o + size * 0.9, gy = o + size * 2.2;
  // flower stalks first (they rise from the heart of the fan, behind the front blades)
  for (let k = 0; k < stalks; k++) {
    const sx = cx + rng.range(-size * 0.12, size * 0.12), top = gy - size * rng.range(1.5, 2.1), lean = rng.range(-0.12, 0.12);
    const pts: P[] = [[sx, gy], [sx + lean * size, (gy + top) / 2], [sx + lean * size * 2.2, top]];
    tube(buf, pts, t => 1.4 - t * 0.6, ramp('#1a0e08', '#2e1a0e', '#4a2c16', '#6a4222'), 2, { spread: 1.2 });
    for (let j = 0; j < 7; j++) {
      const t = 0.45 + j * 0.08, px = sx + lean * size * 2.2 * t, py = gy + (top - gy) * t;
      const side = j & 1 ? 1 : -1;
      for (let q = 1; q < 5; q++) {
        buf.set(px + side * q * 0.8, py - q * 0.9, pods ? hex('#1a1414') : q > 2 ? hex('#e04a1e') : hex('#9a2a14'));
        if (pods && q > 2) buf.set(px + side * q * 0.8 + side, py - q * 0.9, hex('#2e2622'));
      }
    }
  }
  const n = rng.int(9, 13);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    blade(buf, { x: cx + t * size * 0.35, y: gy + 1, ang: -Math.PI / 2 + t * 1.5 + rng.range(-0.1, 0.1), len: size * rng.range(0.8, 1.15), droop: rng.range(0.1, 0.4) + Math.abs(t) * 0.9, w0: size * 0.08 + 2, ramp: FLAX, base: 3 + (i % 3), edge: FLAXEDGE });
  }
  sandLip(buf, cx - size * 0.35, cx + size * 0.35, gy + 0.5, 2.6, bed, seed + 3);
  return done(buf, cx, gy, 0.45);
}

/** toetoe: a tussock of arching blades with tall stems of drooping cream plumes */
export function toetoe(seed: number, size = 40, bed: Bed = 'dry', plumes = 3): Sprite {
  const rng = new Rng(seed * 199 + 49);
  const { buf, o } = canvas(size * 2.2, size * 2, Math.ceil(size * 0.6));
  const cx = o + size * 1.1, gy = o + size * 2;
  const dir = rng.sign();
  for (let k = 0; k < plumes; k++) {
    const sx = cx + rng.range(-size * 0.15, size * 0.15), h = size * rng.range(1.35, 1.9), lean = dir * rng.range(0.05, 0.25);
    const top: P = [sx + lean * h, gy - h];
    for (let t = 0; t < 1; t += 0.01) buf.set(sx + lean * h * t * t, gy - h * t, t > 0.7 ? PLUME[1] : TOE[3]);
    // the plume: a feathery drooping panicle, lit on its upper side
    const L = size * rng.range(0.32, 0.46);
    for (let s = 0; s < L; s++) {
      const u = s / L;
      const px = top[0] + dir * s * (0.7 - u * 0.4), py = top[1] + s * 0.55 + u * u * L * 0.5;
      const wdt = 1.5 + Math.sin(Math.min(1, u * 1.4) * Math.PI * 0.8) * 4;
      for (let v = -wdt; v <= wdt; v += 0.5) {
        if (hash2(Math.round(px + v), Math.round(py), seed + k) < 0.25 && Math.abs(v) > wdt * 0.6) continue;
        buf.set(px + v * 0.8, py - v * 0.4, PLUME[clamp(Math.round(3 + (v < 0 ? 1.5 : -0.5) - u * 0.8 + (noise1(s / 2 + v, seed) - 0.5) * 2), 0, 5)]);
      }
    }
  }
  const n = rng.int(18, 26);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    blade(buf, { x: cx + t * size * 0.3, y: gy + 1, ang: -Math.PI / 2 + t * 2 + rng.range(-0.1, 0.1), len: size * rng.range(0.7, 1.1), droop: 0.4 + Math.abs(t) * 1.8, w0: 2.2, ramp: TOE, base: 2 + (i % 3) });
  }
  sandLip(buf, cx - size * 0.35, cx + size * 0.35, gy + 0.5, 2.6, bed, seed + 3);
  return done(buf, cx, gy, 0.4);
}

export { mix, noise1 };

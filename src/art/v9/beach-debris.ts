// V9 island art: driftwood and what the sea took off the Kittiwake. Bleached drift logs with root
// plates and splintered ends, forked branches, broken hull and deck planks, the stern name board, a
// split crate spilling tins, a blue drum, fishing floats on a line, a tangle of net, trailing rope, a
// torn tarp and the deck awning, the life ring, the chilly bin, bottles (one with a message), a jerry
// can and an oar. Everything is anchored at its ground contact and half-buried in the sand it lies in.

import { PixelBuffer } from '../pixel';
import { text, tube, along, P } from '../jungle-core';
import { clamp, fbm1, hash2, noise1, noise2, smoothstep } from '../../core/math';
import { Bed, Sprite, Rng, C, canvas, done, sandLip, tone, ramp, hex, mix, shade } from './kit';

const BLEACH = ramp('#2c2722', '#48413a', '#686055', '#8a8072', '#aa9f90', '#c6bdad', '#ddd6c8', '#efebe0');
const WOOD = ramp('#24180f', '#382617', '#4e3620', '#664a2c', '#80603a', '#9a784c', '#b49262');
const CREAM = ramp('#5e584c', '#8a826e', '#b2aa94', '#d2cab4', '#e8e2d0', '#f4f0e4');
const RED = ramp('#4a1410', '#72201a', '#9a3022', '#c0442e', '#dc6448');
const TARP = ramp('#10244a', '#183466', '#224a88', '#3062a8', '#4a80c4', '#76a2d8', '#a8c8ea');
const SAIL = ramp('#4e4a3e', '#76705e', '#9c957e', '#bdb69c', '#d8d2b8', '#ece6d0', '#f8f4e6');
const ROPE = ramp('#3e3020', '#624c30', '#8a6c44', '#b0905c', '#d0b27a', '#e6cc98');
const ORANGE = ramp('#5a1c08', '#94300c', '#d04e16', '#f07a30', '#ffaa5e', '#ffd49a');
const BLUE = ramp('#0e2440', '#18386a', '#245298', '#3a70c0', '#5c92da', '#8ab4ea');
const WHITE = ramp('#5a5a5c', '#8a8a8a', '#b4b2ae', '#d6d4ce', '#eeece6', '#fbfaf6');
const GOLD = ramp('#5a3e0c', '#8e6418', '#c4922a', '#e8bc4a', '#ffe28e');
const NET = ramp('#10261c', '#1c4230', '#2c6246', '#46845e', '#6aa67a');
const KELPC = ramp('#1a180a', '#2c2812', '#403a18', '#58501f', '#726628', '#8e8034');

/**
 * A board lying flat on the sand: a strip along an axis from (x0, y0) at angle `ang`, `wid` px deep on
 * screen (its width is foreshortened). fn gets s along the board and v down across it (0 = far edge).
 */
function board(b: PixelBuffer, x0: number, y0: number, len: number, wid: number, ang: number, fn: (s: number, v: number, x: number, y: number) => C | -1) {
  const dx = Math.cos(ang), slope = Math.tan(ang);
  const x1 = x0 + dx * len;
  const minY = Math.floor(Math.min(y0, y0 + slope * dx * len) - 2), maxY = Math.ceil(Math.max(y0, y0 + slope * dx * len) + wid + 2);
  for (let y = minY; y <= maxY; y++) for (let x = Math.floor(x0) - 1; x <= Math.ceil(x1) + 1; x++) {
    const px = x + 0.5 - x0;
    const s = px / dx, v = y + 0.5 - y0 - px * slope;
    if (s < 0 || s > len || v < 0 || v >= wid) continue;
    const c = fn(s, v, x, y);
    if (c !== -1) b.set(x, y, c);
  }
}

// ------------------------------------------------------------------ driftwood

/** a bleached drift log: root plate at one end, splintered at the other, grain and checks, half-buried */
export function driftLog(seed: number, len = 90, bed: Bed = 'dry'): Sprite {
  const rng = new Rng(seed * 97 + 5);
  const r = clamp(len * 0.075, 3.5, 9) * rng.range(0.85, 1.15);
  const { buf, o } = canvas(len + r * 8, r * 5 + 8, 10);
  const gy = o + r * 5 + 4;
  const flip = rng.chance(0.5);
  const x0 = o + r * 3.5, x1 = x0 + len;
  const lift = rng.range(-1, 1) * r * 0.6;
  const pts: P[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    pts.push([x0 + (x1 - x0) * t, gy - r * 0.75 + lift * (t - 0.5) + Math.sin(t * Math.PI) * rng.range(-1, 1) - (1 - t) * r * 0.25]);
  }
  const grain = (x: number, y: number) => (noise2(x / 16, y * 0.8, seed) - 0.5) * 0.9 + (noise2(x / 3, y * 1.6, seed + 1) - 0.5) * 0.3;
  // the root plate: twisted stubs radiating from the thick end
  const [rx, ry] = pts[0];
  for (let k = 0; k < rng.int(5, 8); k++) {
    const a = Math.PI + rng.range(-1.3, 1.3), L = r * rng.range(1.4, 3.6);
    const mid: P = [rx + Math.cos(a) * L * 0.5 + rng.range(-2, 2), ry + Math.sin(a) * L * 0.5 + rng.range(-2, 2)];
    const end: P = [rx + Math.cos(a + rng.range(-0.4, 0.4)) * L, Math.min(gy + 1, ry + Math.sin(a) * L)];
    tube(buf, [[rx + 1, ry], mid, end], t => r * (0.42 - t * 0.3) + 0.6, BLEACH, 4, { spread: 2, texture: grain });
  }
  tube(buf, pts, t => r * (1.08 - t * 0.32) + (t < 0.08 ? r * 0.3 * (1 - t / 0.08) : 0), BLEACH, 4.4, { spread: 2.3, texture: grain });
  // splintered broken end: pale inner wood and spikes
  const [ex, ey] = pts[16];
  const er = r * 0.76;
  for (let y = Math.floor(ey - er); y <= ey + er; y++) for (let x = Math.floor(ex - 2); x <= ex + 1; x++) {
    if (!buf.opaque(x, y) && x < ex) continue;
    const q = ((y - ey) / er) ** 2;
    if (q > 1) continue;
    buf.set(x, y, q > 0.6 ? BLEACH[3] : hash2(x, y, seed) < 0.5 ? hex('#d8c8a8') : hex('#c0ae8c'));
  }
  for (let k = 0; k < rng.int(2, 4); k++) {
    const yy = ey + rng.range(-er * 0.8, er * 0.8), L = rng.range(2, 6);
    for (let s = 0; s < L; s++) buf.set(ex + 1 + s, yy - s * rng.range(-0.3, 0.3), s > L - 2 ? BLEACH[4] : BLEACH[6]);
  }
  // knots and long checks (cracks) along the grain
  for (let k = 0; k < rng.int(1, 3); k++) {
    const p = along(pts, rng.range(0.25, 0.8));
    const ky = p.y + rng.range(-r * 0.5, r * 0.2);
    for (let y = Math.floor(ky - 1.5); y <= ky + 1.5; y++) for (let x = Math.floor(p.x - 2.5); x <= p.x + 2.5; x++) {
      const q = ((x - p.x) / 2.5) ** 2 + ((y - ky) / 1.5) ** 2;
      if (q < 1 && buf.opaque(x, y)) buf.set(x, y, q < 0.35 ? BLEACH[1] : BLEACH[3]);
    }
  }
  for (let k = 0; k < rng.int(2, 4); k++) {
    const t0 = rng.range(0.1, 0.6), t1 = t0 + rng.range(0.15, 0.35), off = rng.range(-0.6, 0.1);
    for (let t = t0; t < Math.min(0.97, t1); t += 0.004) {
      const p = along(pts, t);
      const y = p.y + off * r + Math.sin(t * 40) * 0.4;
      if (buf.opaque(p.x, y)) { buf.set(p.x, y, BLEACH[1]); if (buf.opaque(p.x, y - 1)) buf.set(p.x, y - 1, BLEACH[6]); }
    }
  }
  // a strand of kelp caught over it now and then
  if (rng.chance(0.4)) {
    const p = along(pts, rng.range(0.3, 0.7));
    for (let s = 0; s < r * 3; s++) buf.set(p.x + s * 0.5 + Math.sin(s * 0.7) * 1.2, p.y - r * 0.9 + s * 0.8, s % 3 ? KELPC[2] : KELPC[4]);
  }
  sandLip(buf, x0 - r * 1.5, x1 + r * 0.8, gy, r * 0.8, bed, seed + 2);
  const s = done(buf, (x0 + x1) / 2, gy, 0.35);
  if (flip) return mirror(s);
  return s;
}

/** a thinner forked drift branch lying flat */
export function driftBranch(seed: number, len = 50, bed: Bed = 'dry'): Sprite {
  const rng = new Rng(seed * 101 + 9);
  const { buf, o } = canvas(len + 20, 26, 8);
  const gy = o + 22;
  const x0 = o + 8, pts: P[] = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([x0 + len * t, gy - 2.5 - Math.sin(t * Math.PI) * rng.range(0, 3) + (noise1(t * 4, seed) - 0.5) * 3]); }
  const grain = (x: number, y: number) => (noise2(x / 9, y, seed) - 0.5) * 0.6;
  for (let k = 0; k < rng.int(2, 4); k++) {
    const p = along(pts, rng.range(0.2, 0.85));
    const a = p.a + rng.sign() * rng.range(0.4, 0.9) - (rng.chance(0.6) ? 0.6 : 0);
    const L = len * rng.range(0.18, 0.4);
    const e: P = [p.x + Math.cos(a) * L, Math.min(gy, p.y + Math.sin(a) * L)];
    tube(buf, [[p.x, p.y], [(p.x + e[0]) / 2 + rng.range(-2, 2), (p.y + e[1]) / 2], e], t => 1.4 - t * 0.8, BLEACH, 4.5, { spread: 1.6, texture: grain });
  }
  tube(buf, pts, t => 2.8 - t * 1.4, BLEACH, 4.4, { spread: 2, texture: grain });
  sandLip(buf, x0 - 2, x0 + len + 2, gy, 1.6, bed, seed + 2, 1.4);
  return done(buf, x0 + len / 2, gy, 0.3);
}

function mirror(s: Sprite): Sprite {
  const b = s.buf, m = new PixelBuffer(b.w, b.h);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) m.data[y * b.w + x] = b.data[y * b.w + (b.w - 1 - x)];
  return { buf: m, ax: b.w - 1 - s.ax, ay: s.ay };
}

// ------------------------------------------------------------------ the Kittiwake in pieces

export type PlankKind = 'hull' | 'deck' | 'grey' | 'red';
/** a broken plank lying on the sand (a flat strip seen from above, its near edge showing) */
export function plank(seed: number, len = 56, kind: PlankKind = 'hull', bed: Bed = 'dry', ang = 0): Sprite {
  const rng = new Rng(seed * 103 + 11);
  const wid = kind === 'deck' ? 4 : 5, th = 2;
  const { buf, o } = canvas(len + 12, wid + th + 12 + Math.abs(Math.sin(ang)) * len, 8);
  const x0 = o + 4, y0 = o + 4 + Math.max(0, -Math.sin(ang) * len);
  const brokenAt = (v: number) => len - Math.abs(noise1(v * 1.3, seed) - 0.5) * 14 - (hash2(Math.floor(v), 1, seed) < 0.3 ? 4 : 0);
  board(buf, x0, y0, len, wid + th, ang, (s, v, x, y) => {
    if (s > brokenAt(v)) return -1;
    if (s < 0) return -1;
    const edge = v >= wid; // the plank's thickness, facing the camera
    const g = (noise2(s / 12, v * 1.2, seed) - 0.5) * 0.5;
    if (kind === 'deck') {
      if (edge) return tone(WOOD, 0.25 + g * 0.3, x, y);
      if (v < 1) return hex('#1a1410'); // caulking seam
      return tone(WOOD, 0.62 + g + (s % 17 < 1 ? -0.3 : 0), x, y);
    }
    if (kind === 'grey') return tone(BLEACH, (edge ? 0.3 : 0.64) + g, x, y);
    // painted strakes: cream (or the red boot-top), peeling to grey wood
    const peel = noise2(s / 7, v / 2, seed + 3) > 0.62;
    const rp = kind === 'red' ? RED : CREAM;
    if (edge) return peel ? BLEACH[2] : rp[1];
    if (peel) return tone(BLEACH, 0.5 + g, x, y);
    if (kind === 'red' && v > wid - 1.5) return hex('#3e5a2a'); // antifouling along its lower edge
    return tone(rp, 0.72 + g * 0.6 - (v < 1 ? 0.25 : 0), x, y);
  });
  // splinters at the broken end, nail holes weeping rust
  const dx = Math.cos(ang), dy = Math.sin(ang);
  for (let k = 0; k < rng.int(2, 4); k++) {
    const v = rng.range(0.5, wid - 0.5), s0 = brokenAt(v) - 1, L = rng.range(2, 6);
    for (let s = 0; s < L; s++) buf.set(x0 + dx * (s0 + s), y0 + dy * (s0 + s) + v - s * 0.15, kind === 'deck' ? WOOD[5] : BLEACH[5]);
  }
  for (let s = 5; s < len - 12; s += rng.range(10, 18)) {
    const nx = x0 + dx * s, ny = y0 + dy * s + wid * 0.5;
    buf.set(nx, ny, hex('#2a1a12'));
    for (let k = 1; k < 3; k++) if (buf.opaque(nx + k, ny + k * 0.3)) buf.set(nx + k, ny + k * 0.3, mix(buf.get(nx + k, ny + k * 0.3), hex('#8a4a2a'), 0.5));
  }
  const gy = y0 + dy * len * 0.5 + wid + th;
  sandLip(buf, x0 - 3, x0 + dx * len * 0.9, gy + 0.5, 1.6, bed, seed + 4, 1.5);
  return done(buf, x0 + dx * len * 0.5, gy, 0.35);
}

/** the stern name board, torn off the transom: gold letters on dark varnish, one end split */
export function nameBoard(bed: Bed = 'dry', name = 'KITTIWAKE'): Sprite {
  const L = name.length * 4 + 14, H = 10;
  const { buf, o } = canvas(L + 8, H + 8, 8);
  const x0 = o + 2, y0 = o + 3;
  const VARN = ramp('#1e120a', '#301c10', '#472a16', '#5e3a1e', '#7a4e2a', '#96663a');
  for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) {
    // gently bowed board with a split, splintered right end
    const endX = L - 3 - Math.abs(noise1(y * 0.9, 21) - 0.5) * 10;
    if (x > endX) continue;
    const bow = Math.round(Math.sin((x / L) * Math.PI) * -1.2);
    const edge = y >= H - 2;
    const g = (noise2(x / 9, y * 1.1, 22) - 0.5) * 0.5;
    let c = edge ? VARN[1] : tone(VARN, 0.58 + g - (y < 1 ? 0.2 : 0) + (y === 1 ? 0.25 : 0), x, y, 0.5);
    if (!edge && noise2(x / 5, y / 3, 23) > 0.74) c = mix(c, hex('#9a8a70'), 0.4); // varnish flaked off
    buf.set(x0 + x, y0 + y + bow, c);
  }
  // raised gilt letters with a dark drop shadow, a bead moulding along the top
  const tx = x0 + 7, ty = y0 + 2;
  text(buf, tx + 1, ty + 1, name, hex('#140a06'), 3);
  text(buf, tx, ty, name, GOLD[3], 3);
  for (let x = tx; x < tx + name.length * 4; x++) for (let y = ty; y < ty + 5; y++) {
    const c = buf.get(x, y);
    if (c === GOLD[3] && buf.get(x, y - 1) !== GOLD[3]) buf.set(x, y, GOLD[4]);
    else if (c === GOLD[3] && hash2(x, y, 24) < 0.25) buf.set(x, y, GOLD[2]);
  }
  for (let x = 2; x < L - 8; x++) if (x % 3) buf.set(x0 + x, y0 + 1 + Math.round(Math.sin((x / L) * Math.PI) * -1.2), GOLD[1]);
  // a scrap of rope still through the fixing hole
  for (let k = 0; k < 9; k++) buf.set(x0 + 2 - k * 0.8, y0 + 4 + k * 0.6 + Math.sin(k) * 0.6, k % 2 ? ROPE[3] : ROPE[2]);
  const gy = y0 + H + 1;
  sandLip(buf, x0 + L * 0.35, x0 + L + 2, gy, 3.2, bed, 25);
  return done(buf, x0 + L / 2, gy, 0.4);
}

/** a slatted crate on its side, one end stove in and spilling tins */
export function crate(seed: number, bed: Bed = 'dry', w = 24, h = 16): Sprite {
  const rng = new Rng(seed * 107 + 13);
  const T = 6;
  const { buf, o } = canvas(w + T + 26, h + T + 6, 8);
  const x0 = o + 4, y0 = o + T;
  const PL = ramp('#2e1e12', '#4a321e', '#664a2c', '#80603a', '#9a784c', '#b8945e');
  const broken = (x: number, y: number) => x > w * 0.62 && y < h * 0.55 + noise1(x / 2, seed) * 5 - (x - w * 0.62) * 0.2;
  // top face (skewed back)
  for (let y = 0; y < T; y++) for (let x = 0; x < w; x++) {
    const X = x0 + x + (T - y) * 0.8, Y = y0 - T + y;
    if (broken(x, 0) && x > w * 0.7) continue;
    buf.set(X, Y, x % 8 === 0 ? PL[2] : tone(PL, 0.8 - (y === 0 ? 0.3 : 0), X, Y, 0.4));
  }
  // front face: slats, cross brace, dark inside where it's stove in
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = x0 + x, Y = y0 + y;
    if (broken(x, y)) { if (x < w - 1 && y > 2) buf.set(X, Y, hex('#140c08')); continue; }
    const slat = y % 5 === 4;
    const brace = Math.abs(x - y * (w / h)) < 1.3;
    const edge = x === 0 || x === w - 1 || y === h - 1;
    buf.set(X, Y, edge ? PL[1] : slat ? PL[1] : brace ? PL[4] : tone(PL, 0.5 + (noise2(x / 6, y, seed) - 0.5) * 0.4, X, Y, 0.5));
  }
  // stencilled paw (Chunky Chow) and splintered slat ends
  for (const [dx, dy] of [[4, 6], [5, 6], [7, 5], [8, 5], [10, 6], [11, 6]]) buf.set(x0 + dx, y0 + dy, PL[0]);
  for (let j = 0; j < 3; j++) for (let i = 5; i < 11; i++) buf.set(x0 + i, y0 + 8 + j, PL[0]);
  for (let k = 0; k < 4; k++) { const sy = y0 + 1 + k * 3; for (let s = 0; s < 4; s++) buf.set(x0 + w * 0.62 + s, sy - s * 0.4, PL[5]); }
  // tins rolled out onto the sand
  const tin = (cx: number, cy: number, lying: boolean) => {
    const tw = lying ? 7 : 5, tt = lying ? 5 : 6;
    for (let y = 0; y < tt; y++) for (let x = 0; x < tw; x++) {
      const u = lying ? y / tt : x / tw;
      const rim = lying ? x === 0 || x === tw - 1 : y === 0 || y === tt - 1;
      buf.set(cx + x, cy + y, rim ? (u < 0.4 ? hex('#e8ecf0') : hex('#8a9098')) : u < 0.3 ? hex('#f4cc50') : u < 0.75 ? hex('#d49a2a') : hex('#8a5e18'));
    }
    buf.set(cx + Math.floor(tw / 2), cy + Math.floor(tt / 2), hex('#c8402e'));
  };
  const gy = y0 + h;
  tin(x0 + w + 3, gy - 5, true);
  if (rng.chance(0.7)) tin(x0 + w + 12, gy - 6, false);
  tin(x0 + w * 0.7, gy - 4, true);
  sandLip(buf, x0 - 6, x0 + w * 0.5, gy + 0.5, 5, bed, seed + 5);
  sandLip(buf, x0 + w - 2, x0 + w + 20, gy + 0.5, 2, bed, seed + 6);
  return done(buf, x0 + w / 2, gy, 0.45);
}

/** a blue plastic drum lying on its side */
export function drum(seed: number, bed: Bed = 'dry'): Sprite {
  const L = 26, R = 8;
  const { buf, o } = canvas(L + 8, R * 2 + 4, 8);
  const x0 = o + 4, cy = o + R;
  for (let y = -R; y <= R; y++) for (let x = 0; x < L; x++) {
    const v = y / R;
    if (Math.abs(v) > 1) continue;
    const hoop = x === 7 || x === 8 || x === L - 9 || x === L - 8;
    let l = 0.62 - v * 0.38 + (1 - Math.abs(v)) * 0.1 + (hoop ? 0.1 : 0);
    if (v > 0.7) l -= 0.2;
    buf.set(x0 + x, cy + y, tone(BLUE, l, x, y, 0.6));
  }
  // the end cap facing us (left), with the bung
  for (let y = -R; y <= R; y++) for (let x = -3; x <= 3; x++) {
    const q = (x / 3) ** 2 + (y / R) ** 2;
    if (q > 1) continue;
    buf.set(x0 + x, cy + y, q > 0.7 ? BLUE[1] : tone(BLUE, 0.45 - y / R * 0.2, x, y, 0.5));
  }
  buf.set(x0, cy - 4, WHITE[4]); buf.set(x0 + 1, cy - 4, WHITE[3]);
  for (let x = 3; x < L - 3; x += 1) if (hash2(x, 3, seed) < 0.3) buf.set(x0 + x, cy - R + 2, BLUE[5]); // wet glints
  const gy = cy + R;
  sandLip(buf, x0 - 5, x0 + L + 3, gy + 0.5, 5, bed, seed + 1);
  return done(buf, x0 + L / 2, gy, 0.45);
}

/** fishing floats strung on a length of line, one sunk in the sand */
export function floats(seed: number, bed: Bed = 'dry'): Sprite {
  const rng = new Rng(seed * 109 + 15);
  const { buf, o } = canvas(44, 14, 8);
  const gy = o + 12;
  const balls: [number, number, number, boolean][] = [[o + 6, 4.2, 0, true], [o + 17, 3.6, 1, false], [o + 27, 3.2, 0, true]];
  // the line between them
  for (let x = o; x < o + 40; x++) {
    const y = gy - 2 - Math.sin(x * 0.3 + seed) * 1.2;
    buf.set(x, y, (x & 1) ? ROPE[2] : ROPE[3]);
  }
  for (const [cx, r, kind, hi] of balls) {
    const cy = gy - r + (rng.chance(0.3) ? 2 : 0);
    const rp = kind ? WHITE : ORANGE;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const nx = (x + 0.5 - cx) / r, ny = (y + 0.5 - cy) / r, q = nx * nx + ny * ny;
      if (q > 1) continue;
      const l = 0.55 - nx * 0.3 - ny * 0.45 + Math.sqrt(1 - q) * 0.15;
      buf.set(x, y, tone(rp, l, x, y, 0.6));
    }
    if (hi) buf.set(cx - r * 0.4, cy - r * 0.45, hex('#ffffff'));
    for (let x = Math.floor(cx - r); x <= cx + r; x++) buf.set(x, cy, (x & 1) ? ROPE[1] : ROPE[2]); // the lashing round its middle
  }
  sandLip(buf, o + 20, o + 34, gy + 0.5, 3.4, bed, seed + 2);
  sandLip(buf, o, o + 12, gy + 0.5, 1.6, bed, seed + 3);
  return done(buf, o + 20, gy, 0.4);
}

/** a tangle of green net with a float and weed caught in it (the mesh shows the sand through) */
export function net(seed: number, w = 40, bed: Bed = 'dry'): Sprite {
  const rng = new Rng(seed * 113 + 17);
  const H = 10;
  const { buf, o } = canvas(w + 8, H + 8, 8);
  const gy = o + H + 2;
  const hAt = (x: number) => (Math.sin(((x - o) / w) * Math.PI) * H * (0.7 + noise1(x / 7, seed) * 0.5));
  for (let x = o; x < o + w; x++) {
    const hh = hAt(x);
    for (let y = Math.floor(gy - hh); y < gy; y++) {
      const u = x + y * 0.7, v = x - y * 0.7;
      const k = (y - (gy - hh)) / Math.max(1, hh);
      const strand = Math.abs(((u % 4) + 4) % 4 - 2) < 0.6 || Math.abs(((v % 4) + 4) % 4 - 2) < 0.6;
      if (!strand && noise2(x / 3, y / 2, seed) < 0.72) continue; // open mesh, bunched in places
      buf.set(x, y, tone(NET, 0.7 - k * 0.5 + (noise2(x / 5, y / 3, seed + 1) - 0.5) * 0.4, x, y, 0.5));
    }
  }
  // the float line along its top, a float and a twist of kelp
  for (let x = o + 2; x < o + w - 2; x++) buf.set(x, gy - hAt(x) - 1, (x & 1) ? ROPE[2] : ROPE[3]);
  const fx = o + w * rng.range(0.3, 0.7), fy = gy - hAt(fx) - 1;
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 9) buf.set(fx + x, fy + y, tone(ORANGE, 0.6 - (x + y) * 0.08, x, y));
  for (let s = 0; s < w * 0.6; s++) buf.set(o + w * 0.2 + s, gy - 2 - Math.sin(s * 0.4) * 2, s % 3 ? KELPC[3] : KELPC[5]);
  sandLip(buf, o - 2, o + w + 2, gy + 0.5, 2.2, bed, seed + 2, 1.4);
  return done(buf, o + w / 2, gy, 0.3);
}

/** a length of rope snaking over the sand, diving under it in places */
export function rope(seed: number, len = 110, bed: Bed = 'dry'): Sprite {
  const rng = new Rng(seed * 127 + 19);
  const { buf, o } = canvas(len + 10, 22, 8);
  const gy = o + 18;
  let prevBuried = false;
  for (let s = 0; s < len; s += 0.5) {
    const x = o + 4 + s, y = gy - 3 - Math.sin(s * 0.06 + seed) * 5 - Math.sin(s * 0.17) * 1.5;
    const buried = noise1(s / 14, seed) > 0.7;
    if (buried) { if (!prevBuried) sandLip(buf, x - 3, x + 3, y + 2, 2, bed, seed + Math.floor(s)); prevBuried = true; continue; }
    prevBuried = false;
    const tw = Math.floor(s * 1.5) % 3;
    buf.set(x, y, tw === 0 ? ROPE[4] : ROPE[3]);
    buf.set(x, y + 1, tw === 2 ? ROPE[1] : ROPE[2]);
  }
  // the frayed end
  for (let k = 0; k < 4; k++) buf.set(o + 4 + len + k, gy - 3 + rng.range(-1.5, 1.5), ROPE[4]);
  return done(buf, o + 4 + len / 2, gy, 0.3);
}

/** a torn sheet lying crumpled on the sand: the blue deck tarp or the striped awning */
export function tarp(seed: number, w = 70, kind: 'tarp' | 'sail' = 'tarp', bed: Bed = 'dry'): Sprite {
  const rng = new Rng(seed * 131 + 21);
  const H = Math.round(w * 0.24);
  const { buf, o } = canvas(w + 20, H + 14, 10);
  const x0 = o + 6, gy = o + H + 8;
  const rp = kind === 'tarp' ? TARP : SAIL;
  // outline: a skewed quad with torn, fringed edges; folds as a height field
  const topAt = (x: number) => gy - H + (x - x0) * 0.08 + (noise1(x / 9, seed) - 0.5) * 4;
  const botAt = (x: number) => gy - (noise1(x / 11, seed + 1) - 0.5) * 3;
  const fold = (x: number, y: number) => Math.sin((x - x0) * 0.16 + Math.sin(y * 0.3) * 1.5 + seed) * 0.6 + Math.sin((x - x0) * 0.05 - y * 0.2) * 0.4 + (fbm1(x / 20, 2, seed + 2) - 0.5);
  const xEnd = x0 + w;
  for (let x = Math.floor(x0); x < xEnd; x++) {
    const t0 = topAt(x), t1 = botAt(x);
    const u = (x - x0) / w;
    // ragged torn end on the right
    if (u > 0.85 && noise1(x / 2 + seed, 3) < (u - 0.85) * 6) continue;
    for (let y = Math.floor(t0); y <= t1; y++) {
      const gx = fold(x + 1, y) - fold(x - 1, y), gyy = fold(x, y + 1) - fold(x, y - 1);
      let l = 0.55 + gx * 1.4 + gyy * 1.1 - (y - t0) / (t1 - t0) * 0.1;
      // the corner folded back shows the paler underside
      const corner = x < x0 + w * 0.2 && y < t0 + (x0 + w * 0.2 - x) * 0.45;
      if (corner) l += 0.2;
      let c = tone(rp, l, x, y, 0.6);
      if (kind === 'sail' && Math.abs(y - (t1 - 3)) < 1.2) c = RED[3]; // the awning's red hem stripe
      if (kind === 'tarp' && (Math.floor((x - x0) / 12) % 2) && y > t1 - 2) c = rp[1];
      // wet dark patches and sand drifted into the hollows
      if (noise2(x / 10, y / 4, seed + 4) > 0.7) c = mix(c, rp[1], 0.5);
      if (fold(x, y) < -0.55 && noise2(x / 4, y / 2, seed + 5) > 0.4) c = hash2(x, y, seed) < 0.5 ? hex('#d8bc88') : hex('#c8a878');
      buf.set(x, y, c);
    }
    if (x % 9 === 3) { buf.set(x, t0 + 1, hex('#c8ccd0')); buf.set(x, t0 + 2, hex('#6a7078')); } // eyelets along the hem
  }
  // a guy rope from the near corner, trailing off
  for (let s = 0; s < 20; s++) buf.set(x0 - s * 0.9, gy - 1 + Math.sin(s * 0.5) * 1, (s & 1) ? ROPE[2] : ROPE[3]);
  sandLip(buf, xEnd - w * 0.3, xEnd + 4, gy + 0.5, 3, bed, seed + 6);
  sandLip(buf, x0 + w * 0.3, x0 + w * 0.5, gy + 0.5, 2, bed, seed + 7);
  void rng;
  return done(buf, x0 + w / 2, gy, 0.35);
}

/** the life ring, stood up half-buried in the sand, its grab line looped round */
export function lifeRing(bed: Bed = 'dry'): Sprite {
  const R = 10, r0 = 5;
  const { buf, o } = canvas(R * 2 + 6, R * 2 + 4, 8);
  const cx = o + R + 3, cy = o + R + 1;
  for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
    const nx = (x + 0.5 - cx) / R, ny = (y + 0.5 - cy) / R, d = Math.hypot(nx, ny);
    if (d > 1 || d < r0 / R) continue;
    const a = Math.atan2(ny, nx);
    const seg = Math.floor(((a + Math.PI) / (Math.PI / 2)) + 0.5) % 2;
    // tube shading: lit on the upper-left of the torus section
    const m = (d - r0 / R) / (1 - r0 / R) - 0.5;
    const l = 0.6 - m * 0.5 * (ny > 0 ? 1 : -1) * 0.6 - ny * 0.25 - nx * 0.15;
    buf.set(x, y, tone(seg ? RED : WHITE, l, x, y, 0.5));
  }
  // grab line looped between four points
  for (let k = 0; k < 4; k++) {
    const a0 = k * Math.PI / 2 + 0.3, a1 = a0 + Math.PI / 2 - 0.6;
    for (let t = 0; t <= 1; t += 0.05) {
      const a = a0 + (a1 - a0) * t, rr = R + 0.8 + Math.sin(t * Math.PI) * 1.6;
      buf.set(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, t % 0.1 < 0.05 ? ROPE[2] : ROPE[4]);
    }
  }
  const gy = cy + R * 0.45;
  // the lower part is buried: cut it off and drift sand over the line
  for (let y = Math.ceil(gy) + 1; y < buf.h; y++) for (let x = 0; x < buf.w; x++) buf.set(x, y, 0);
  sandLip(buf, cx - R - 5, cx + R + 5, gy + 1, 4.5, bed, 31);
  return done(buf, cx, gy + 1, 0.45);
}

/** the chilly bin, tipped over with its lid sprung */
export function cooler(bed: Bed = 'dry'): Sprite {
  const W = 22, H = 12, T = 4;
  const { buf, o } = canvas(W + T + 10, H + T + 8, 8);
  const x0 = o + 3, y0 = o + T + 3;
  for (let y = 0; y < T; y++) for (let x = 0; x < W; x++) buf.set(x0 + x + (T - y) * 0.7, y0 - T + y, tone(WHITE, 0.82 - (y === 0 ? 0.25 : 0), x, y, 0.3));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const edge = x === 0 || x === W - 1 || y === H - 1;
    const band = y < 3;
    let c = band ? tone(WHITE, 0.7 - y * 0.08, x, y, 0.3) : edge ? BLUE[1] : tone(BLUE, 0.55 + (x < 3 ? 0.15 : 0) - y * 0.015, x, y, 0.4);
    if (!band && y > 4 && y < 7 && x > 7 && x < 14) c = WHITE[4]; // the handle recess
    buf.set(x0 + x, y0 + y, c);
  }
  // the sprung lid leaning off the back
  for (let k = 0; k < W - 4; k++) for (let j = 0; j < 3; j++) buf.set(x0 + 4 + k, y0 - T - 3 - j + k * 0.1, j === 0 ? WHITE[5] : WHITE[3]);
  const gy = y0 + H;
  sandLip(buf, x0 - 4, x0 + W * 0.45, gy + 0.5, 4, bed, 33);
  return done(buf, x0 + W / 2, gy, 0.45);
}

/** a bottle lying in the sand: 'green' (with a rolled message inside), 'brown' or 'plastic' */
export function bottle(kind: 'green' | 'brown' | 'plastic', bed: Bed = 'dry'): Sprite {
  const { buf, o } = canvas(14, 6, 6);
  const x0 = o, cy = o + 2;
  const G = kind === 'green' ? ramp('#0e2a18', '#18462a', '#28683e', '#4c9464', '#a8e0bc') : kind === 'brown' ? ramp('#200e04', '#3e1c08', '#643010', '#94501e', '#e0a868') : ramp('#6a8a9a', '#8aaabb', '#b0ccd8', '#d4e8ee', '#ffffff');
  for (let x = 0; x < 13; x++) {
    const neck = x > 8, r = neck ? 1 : 2;
    for (let y = -r; y <= r; y++) buf.set(x0 + x, cy + y, G[clamp(2 - y + (neck ? 0 : 1), 0, 4)]);
  }
  buf.set(x0 + 13, cy, kind === 'plastic' ? hex('#3a78c0') : hex('#8a6a40'));
  buf.set(x0 + 3, cy - 1, G[4]); buf.set(x0 + 4, cy - 1, G[4]);
  if (kind === 'green') for (let x = 2; x < 7; x++) buf.set(x0 + x, cy + 1, hex('#e8dcb8'));
  const gy = cy + 3;
  sandLip(buf, x0 - 2, x0 + 7, gy, 1.6, bed, 35);
  return done(buf, x0 + 6, gy, 0.4);
}

/** a red jerry can, knocked on its side */
export function jerryCan(bed: Bed = 'dry'): Sprite {
  const W = 16, H = 11;
  const { buf, o } = canvas(W + 6, H + 6, 8);
  const x0 = o + 2, y0 = o + 3;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const X = (x - W / 2) / (W / 2), Y = (y - H / 2) / (H / 2);
    const cross = Math.abs(Math.abs(X) - Math.abs(Y)) < 0.14 && Math.abs(X) < 0.8;
    buf.set(x0 + x, y0 + y, tone(RED, 0.62 - Y * 0.3 - X * 0.1 + (cross ? 0.18 : 0), x, y, 0.5));
  }
  for (let x = 2; x < 7; x++) buf.set(x0 + x, y0 - 1, RED[1]);
  buf.set(x0 + W, y0 + 2, hex('#e8b840')); buf.set(x0 + W + 1, y0 + 2, hex('#e8b840'));
  const gy = y0 + H;
  sandLip(buf, x0 + W * 0.5, x0 + W + 4, gy + 0.5, 3.5, bed, 37);
  return done(buf, x0 + W / 2, gy, 0.45);
}

/** a wooden oar, blade tipped red */
export function oar(len = 58, bed: Bed = 'dry'): Sprite {
  const { buf, o } = canvas(len + 6, 12, 8);
  const x0 = o + 2, y0 = o + 8;
  for (let s = 0; s < len; s++) {
    const blade = s > len * 0.68;
    const hw = blade ? 1.5 + Math.sin(((s - len * 0.68) / (len * 0.32)) * Math.PI * 0.9) * 2.4 : 0.9;
    const y = y0 - s * 0.1;
    for (let v = -hw; v <= hw; v += 0.5) buf.set(x0 + s, y + v, blade && s > len * 0.92 ? RED[3] : tone(WOOD, 0.62 - v / hw * 0.25, s, v));
  }
  for (let v = -1; v <= 1; v++) buf.set(x0, y0 + v, WOOD[1]);
  const gy = y0 + 3;
  sandLip(buf, x0 + len * 0.72, x0 + len + 3, gy, 2.4, bed, 39);
  return done(buf, x0 + len / 2, gy, 0.35);
}

export { smoothstep };

// The Hot Valley's ground, painted pixel by pixel: silica terraces (each tread a shallow turquoise
// rimstone pool, each riser hung with cream flowstone curtains, streaked down their faces with mats
// of microbes in temperature bands: green and yellow near the hot water, orange, then rust), boiling
// mud pools in a cracked crust, fumaroles crusted with sulfur crystals, rainbow microbe mats, and an
// old stair of worn, chipped, moss-jointed stones going down into the steam.

import { PixelBuffer } from './pixel';
import type { C } from './color';
import { hex, mix } from './color';
import { Rng, bayer, clamp, fbm1, fbm2, hash2 } from '../core/math';

const r = (...h: string[]): C[] => h.map(x => hex(x));
export const SINTER = r('#6e6450', '#8e8268', '#ada086', '#c8bca2', '#ddd3bc', '#ece5d2', '#f8f4ea');
const WATER = r('#1e6a78', '#2a8a98', '#46aab2', '#72c8c8', '#a6e2dc');
const MAT = { green: hex('#6e9a3a'), yellow: hex('#d8b030'), orange: hex('#e07828'), rust: hex('#9a4424'), brown: hex('#6a3a20') };
const MUD = r('#2e2a28', '#3e3a36', '#524c46', '#68625a', '#7e776e', '#958e84');
const CRUST = r('#3a2a1c', '#5a4028', '#7a5834', '#9a7444', '#b8925a', '#d2b07a');
const SULFUR = r('#6a5a10', '#9a8418', '#c8b022', '#e8d040', '#f8ec88');
const STONE = r('#2a2420', '#3e3630', '#544a40', '#6c6052', '#857866', '#9e9280', '#b8ac98');
const MOSS = r('#1e2a14', '#2e4018', '#42581e', '#5a7228');
const hp = (x: number, y: number, s: number) => hash2(Math.floor(x), Math.floor(y), s);
const pick = (ramp: C[], v: number) => ramp[clamp(Math.round(v), 0, ramp.length - 1)];

/**
 * The silica terraces (anchor bottom left). top(x): the walk line's row in the buffer at column x;
 * steps: how many treads; the higher treads are nearer the spring, so hotter (greener mats).
 */
export function paintSinterTerraces(w: number, h: number, top: (x: number) => number, steps: number, seed: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const sw = w / steps;
  for (let x = 0; x < w; x++) {
    const t = top(x), i = Math.floor(x / sw), fr = (x - i * sw) / sw;
    const hot = i / (steps - 1);
    // the flowstone curtains hanging off this tread's lip, in groups of 2-4 columns
    const grp = Math.floor((x + hp(i, 0, seed) * 4) / 3);
    const cl = 5 + hp(grp, 1, seed) * 12 + (fbm1(x * 0.08, 2, seed) - 0.5) * 6;
    const lead = (x + hp(i, 0, seed) * 4) % 3 < 1;
    // the sinter is a crust over the ground, not a block: its foot is ragged
    const foot = 22 + fbm1(x * 0.05, 2, seed + 7) * 22 + (hp(x >> 1, 9, seed) < 0.3 ? 2 : 0);
    for (let y = Math.max(0, Math.round(t)); y < h; y++) {
      const d = y - t;
      if (d > foot) break;
      let c: C;
      const pool = fr > 0.08 && fr < 0.8;
      if (pool && d < 3) c = pick(WATER, 4 - d * 1.4 + (d < 1 && hp(x, 0, seed + 1) < 0.2 ? 0.6 : 0));
      else if (d < 2) c = pick(SINTER, 6 - d);
      else if (d < cl) {
        // a curtain: lit on its leading column, rounded drips at its foot
        c = pick(SINTER, 4.6 + (lead ? 1 : 0) - d * 0.06 + (bayer(x, y) - 0.5) * 0.7);
        if (d > cl - 1.5) c = pick(SINTER, 3.4);
      } else if (d < cl + 1.2) c = pick(SINTER, 1.4);
      else {
        // older deposits down the face, darker, in thin growth lines
        c = pick(SINTER, 3.2 - (d - cl) * 0.04 + (Math.floor(y + x * 0.1) % 3 === 0 ? -0.8 : 0) + (bayer(x, y) - 0.5) * 0.8);
      }
      // microbe mats in streams down the face, banded by temperature
      if (d >= 2 || !pool) {
        const stream = fbm2(x * 0.16, y * 0.025, 2, seed + 3);
        if (stream > 0.56) {
          const k = d < 6 ? (hot > 0.5 ? MAT.green : MAT.yellow) : d < 16 ? (hot > 0.3 ? MAT.yellow : MAT.orange) : d < 30 ? MAT.orange : MAT.rust;
          c = mix(c, k, stream > 0.66 ? 0.62 : 0.4);
        }
      }
      b.data[y * w + x] = c;
    }
  }
  b.outline(hex('#2a2018'));
  return b;
}

/** a boiling mud pool in its cracked crust (anchor: x0 = left edge, y = the surface row, at buf row 4) */
export function paintMudPool(w: number, seed: number): { buf: PixelBuffer; ax: number; ay: number } {
  const H = 16, b = new PixelBuffer(w, H), S = 4;
  for (let x = 0; x < w; x++) {
    const u = x / (w - 1), e = Math.min(x, w - 1 - x);
    // raised crusty lips at both ends, the surface between
    const lip = e < 10 ? Math.round((1 - e / 10) * 4 + hp(x, 1, seed) * 1.5) : 0;
    const top = S - lip + (e >= 10 ? 0 : 0);
    for (let y = top; y < H; y++) {
      let c: C;
      if (e < 10 && y < S + 3) {
        // crust, cracked into plates, lit along their tops
        const plate = hp(Math.floor((x + y) / 4), Math.floor(y / 3), seed + 2);
        c = pick(CRUST, 2.6 + plate * 2 + (y === top ? 1.4 : 0) - (y % 3 === 2 ? 1.2 : 0) + (bayer(x, y) - 0.5) * 0.6);
      } else {
        // the mud: concentric ripples spreading from the boil, a sheen on top
        const rr = Math.abs(x - w * (0.35 + 0.3 * hp(0, 3, seed))) * 0.6 + (y - S) * 2;
        let l = 2.6 - (y - S) * 0.25 + (Math.floor(rr) % 5 === 0 ? 0.9 : 0) + (bayer(x, y) - 0.5) * 0.6;
        if (y === S) l += 1.4;
        c = pick(MUD, l);
      }
      b.data[y * w + x] = c;
    }
    void u;
  }
  b.outline(hex('#1a1410'));
  return { buf: b, ax: 0, ay: S };
}

/** a fumarole: a crusted mound with a black throat and sulfur crystals round it (anchor bottom centre) */
export function paintFumarole(seed: number, w = 34, h = 20): { buf: PixelBuffer; ax: number; ay: number } {
  const rng = new Rng(seed * 11 + 5);
  const b = new PixelBuffer(w, h + 2);
  const cx = w / 2 + rng.range(-2, 2), mouth = 3 + rng.range(0, 2);
  const tops = new Int16Array(w);
  for (let x = 0; x < w; x++) {
    const u = (x - cx) / (w / 2);
    const cone = (1 - Math.min(1, Math.abs(u))) ** 1.25 * h;
    const crater = Math.abs(x - cx) < mouth ? (mouth - Math.abs(x - cx)) * 1.2 : 0;
    tops[x] = Math.round(h + 1 - cone + crater + (fbm1(x * 0.3, 2, seed) - 0.5) * 3);
  }
  for (let x = 0; x < w; x++) for (let y = tops[x]; y <= h + 1; y++) {
    const d = y - tops[x], u = (x - cx) / (w / 2);
    let c = pick(CRUST, 3.4 - u * 1.6 - d * 0.08 + (d === 0 ? 1.2 : 0) + (bayer(x, y) - 0.5) * 0.8);
    // white silica and orange iron crusts streaking down
    const st = fbm2(x * 0.3, y * 0.05, 2, seed + 1);
    if (st > 0.66) c = pick(SINTER, 3 + (d < 2 ? 2 : 0));
    else if (st < 0.3) c = mix(c, MAT.orange, 0.4);
    // the throat: black, with a warm glow deep inside
    if (Math.abs(x - cx) < mouth - 0.5 && d < 3) c = d < 2 ? hex('#100c0a') : hex('#3a1c10');
    b.set(x, y, c);
  }
  b.outline(hex('#1a1210'));
  // sulfur crystals: little spiky clusters round the mouth, lit on their left facets
  for (let i = 0; i < 9; i++) {
    const x = Math.round(cx + (i % 2 ? 1 : -1) * (mouth + 1 + rng.range(0, 6)));
    if (x < 1 || x >= w - 1) continue;
    const y = tops[x], hh = rng.int(1, 4);
    for (let k = 0; k < hh; k++) { b.set(x, y - k, pick(SULFUR, 4 - k * 0.5)); if (k < hh - 1) b.set(x + 1, y - k, pick(SULFUR, 2)); }
    b.set(x - 1, y, pick(SULFUR, 3));
  }
  return { buf: b, ax: Math.round(cx), ay: h + 1 };
}

/** a mat of microbes on wet ground at a spring's edge: bands of colour, bubbly (anchor bottom left) */
export function paintMicrobeMat(w: number, seed: number, flip: boolean): PixelBuffer {
  const H = 5, b = new PixelBuffer(w, H);
  const bands = [MAT.green, MAT.yellow, MAT.orange, MAT.rust, MAT.brown];
  for (let x = 0; x < w; x++) {
    const u = flip ? 1 - x / w : x / w;
    const len = Math.round((1 - u) * 4 + 1);
    for (let y = H - len; y < H; y++) {
      const band = clamp(Math.floor(u * 5 + (fbm1(x * 0.3, 1, seed) - 0.5) * 1.4 + (y - (H - len)) * 0.3), 0, 4);
      let c = bands[band];
      if (hp(x, y, seed) < 0.12) c = mix(c, hex('#ffffff'), 0.35);
      else if (bayer(x, y) < 0.3) c = mix(c, hex('#000000'), 0.15);
      b.set(x, y, c);
    }
  }
  return b;
}

/** the old stair: worn, chipped stones laid in steps, moss in the joints, sinter on the lower ones (anchor top left) */
export function paintOldStair(w: number, h: number, steps: number, tread: number, rise: number, seed: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  for (let i = 0; i < steps; i++) {
    const x0 = i * tread, y0 = i * rise;
    // each step's riser: a course of stones of different widths
    let sx = x0;
    let k = 0;
    while (sx < w) {
      const sw = 10 + Math.floor(hp(i, k, seed) * 16);
      const ex = Math.min(w, sx + sw);
      for (let x = sx; x < ex; x++) for (let y = y0; y < Math.min(h, y0 + rise); y++) {
        const lx = x - sx, ly = y - y0, rx = ex - 1 - x, by = rise - 1 - ly;
        // chipped corners
        if ((lx + ly < 2 && hp(i, k, seed + 1) < 0.7) || (rx + ly < 2 && hp(i, k, seed + 2) < 0.6) || (rx + by < 1)) continue;
        // the tread: worn into a shallow dip in the middle, lit; the face below it shaded
        const worn = ly === 0 && x > x0 + 3 && x < Math.min(w, x0 + tread * 2) && hp(x >> 2, i, seed + 3) < 0.5;
        let l = ly === 0 ? 5.6 : ly === 1 ? 4.6 : 3.4 - ly * 0.12 - lx / Math.max(1, sw) * 0.8;
        if (worn) l -= 0.8;
        if (lx === 0 && ly > 0) l += 0.8;
        if (rx === 0) l -= 1;
        if (hp(x, y, seed + 4) < 0.05) l -= 1.4;
        let c = pick(STONE, l + (bayer(x, y) - 0.5) * 0.7);
        // sinter crust on the steps going down into the steam; moss in the joints
        if (i > steps * 0.5 && fbm2(x * 0.15, y * 0.2, 2, seed + 5) > 0.62) c = pick(SINTER, 3 + (ly === 0 ? 2 : 0));
        if ((lx < 1 || rx < 1 || by < 1) && hp(x, y, seed + 6) < 0.5) c = pick(MOSS, 1 + (ly === 0 ? 2 : 0) + hp(x, y, seed + 7) * 1.5);
        b.data[y * w + x] = c;
      }
      sx = ex + (hp(i, k, seed + 8) < 0.3 ? 1 : 0);
      k++;
    }
  }
  // ferns and moss tufts sprouting from the joints along the treads
  for (let i = 0; i < steps; i++) for (let x = i * tread; x < w; x += 3) {
    if (hp(x, i, seed + 9) > 0.12) continue;
    const y = i * rise;
    for (let k = 1; k <= 2 + Math.floor(hp(x, i, seed + 10) * 3); k++) b.set(x + (k > 2 ? 1 : 0), y - k, pick(MOSS, 3 - k * 0.4));
  }
  b.outline(hex('#1a1410'));
  return b;
}

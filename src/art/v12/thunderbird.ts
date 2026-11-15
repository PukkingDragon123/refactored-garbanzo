// V12 the Thunderbird (Te Pouākai): the legendary storm eagle of the Rocky Hills, painted pixel by pixel.
//
// Two views, like a bird book's plates:
//   from below   soar / flap / flee: the wings spread right across the sky (about 330 px tip to tip), the
//                body seen from underneath, the head turned to look down at you
//   in profile   dive (the folded stoop, then the strike: wings swept up and back, talons thrown
//                forward), land (wings raised over the bait), shriek (wings flared, head thrown up, beak
//                open), hurt (a wing dropped, feathers torn loose)
//
// The bird itself (every wing, the bodies, head, legs and feet) is painted by ./tb-bird.ts: one
// continuous contour per mass through anatomical landmarks, the wing a single structure from the
// shoulder to the slotted fingertips with its feather tracts stepping down in value, a keeled breast,
// barred trousers and feathered boots, huge talons, a flat brow shelf over a gold eye and a deep hooked
// beak with its cere. The storm-white lightning zigzag across the primaries is its mark.
//
// Also here: the signs it leaves (a giant shed primary, talon gouges raked into a boulder, a kill
// site), the storm's pixels (rain streaks, splashes, a dithered flash veil, a forked lightning bolt),
// a paper-wasp nest and its wasps, and the backpack art for the hide cloak and the bait bundle.

import { PixelBuffer } from '../pixel';
import type { C } from '../color';
import { hex, mix, shade } from '../color';
import { Rng, bayer, hash2 } from '../../core/math';
import { tbUnder, tbProfile, tbWing } from './tb-bird';

// ---------------------------------------------------------------- palette
const H = (s: string) => hex(s);
const OUT = H('#07060a');
/** storm-dark plumage, deepest to lightest */
const PLUME: C[] = ['#0d0b12', '#19151f', '#26202c', '#362d3a', '#4a3f4e', '#62566a'].map(H);
/** blue storm sheen on the leading edges */
const SHEEN: C[] = ['#2c3a56', '#40567a', '#6684ac'].map(H);
/** pale barring on the flight and tail feathers */
const BAR: C[] = ['#5a5058', '#7e7276', '#a89c98'].map(H);
const FLASH: C[] = ['#9ec4ec', '#d8ecff', '#ffffff'].map(H);

const dz = (x: number, y: number) => bayer(x, y);
/** a ramp tone for light l (0..1), dithered between steps */
function tone(r: C[], l: number, x: number, y: number): C {
  const f = Math.max(0, Math.min(0.999, l)) * (r.length - 1);
  const i = Math.floor(f);
  return f - i > dz(x, y) ? r[Math.min(r.length - 1, i + 1)] : r[i];
}
const hsh = (x: number, y: number, s = 0) => hash2(x, y, s) / 4294967296 + 0.5 - Math.floor(hash2(x, y, s) / 4294967296 + 0.5);

// ---------------------------------------------------------------- pixel maps (hand-placed)
type PMap = { rows: string[]; pal: Record<string, C> };
function stamp(b: PixelBuffer, m: PMap, x0: number, y0: number, flip = false) {
  const w = m.rows[0].length;
  m.rows.forEach((row, y) => {
    for (let i = 0; i < w; i++) {
      const c = m.pal[row[i]];
      if (c === undefined) continue;
      b.set(Math.round(x0 + (flip ? w - 1 - i : i)), Math.round(y0 + y), c);
    }
  });
}

// ---------------------------------------------------------------- one flight feather
interface FeatherO {
  ramp: C[];
  /** base light 0..1 */
  light: number;
  /** pale bars along it (count) */
  bars?: number;
  seed: number;
  /** the lightning streak crosses it at this fraction along (or none) */
  flash?: number;
  /** how ragged the tip is 0..1 */
  rag?: number;
  /** a narrowed outer half (the "fingers" at the wingtip) */
  notch?: boolean;
  sheen?: boolean;
}
/**
 * A tapered feather from (x0, y0) to (x1, y1), w0 wide at the base, w1 at the tip; its tip is
 * rounded and split, a light shaft runs up it, the leading vane (left of the shaft, looking from base
 * to tip) is lighter, pale bars cross it, and a dark seam rims it so the next feather reads.
 */
function feather(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, o: FeatherO) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const half = (u: number) => {
    let w = (w0 + (w1 - w0) * u) / 2;
    if (o.notch && u > 0.45) w *= 0.72;
    if (u > 0.82) w *= Math.sqrt(Math.max(0, 1 - ((u - 0.82) / 0.18) ** 2));
    return Math.max(0.6, w);
  };
  const pts: number[] = [];
  const N = 10;
  for (let i = 0; i <= N; i++) { const u = i / N; const w = half(u) + 0.6; pts.push(x0 + ux * len * u + nx * w, y0 + uy * len * u + ny * w); }
  for (let i = N; i >= 0; i--) { const u = i / N; const w = half(u) + 0.6; pts.push(x0 + ux * len * u - nx * w, y0 + uy * len * u - ny * w); }
  const rag = o.rag ?? 0.4;
  b.polyFn(pts, (x, y) => {
    const px = x + 0.5 - x0, py = y + 0.5 - y0;
    const u = (px * ux + py * uy) / len;
    if (u < -0.02 || u > 1.02) return -1;
    const hw = half(Math.max(0, Math.min(1, u)));
    const v = (px * nx + py * ny) / hw;
    if (Math.abs(v) > 1.25) return -1;
    // a split, ragged tip
    if (u > 0.84 && hsh(x, y, o.seed) < rag * (u - 0.84) * 5) return -1;
    if (u > 0.55 && Math.abs(v) > 0.55 && hsh(x >> 1, y >> 1, o.seed + 9) < rag * 0.07) return -1;
    // the seam
    if (Math.abs(v) > 0.86) return v > 0 ? o.ramp[0] : o.ramp[Math.max(0, 1)];
    let l = o.light + (v < 0 ? 0.16 : -0.06) - u * 0.12 + (hsh(x, y, o.seed + 3) - 0.5) * 0.08;
    if (Math.abs(v) < 0.16 && u < 0.92) l += 0.2;
    // barring
    if (o.bars) {
      const ph = (u * o.bars + 0.18 * Math.sin(v * 2.2 + o.seed)) % 1;
      if (ph < 0.26 && u > 0.12) {
        if (o.flash !== undefined && Math.abs(u - o.flash - v * 0.06) < 0.05) return tone(FLASH, 0.6, x, y);
        return tone(BAR, 0.35 + (v < 0 ? 0.3 : 0) + (0.26 - ph), x, y);
      }
    }
    if (o.flash !== undefined && Math.abs(u - o.flash - v * 0.06) < 0.045) return tone(FLASH, 0.85 - Math.abs(v) * 0.4, x, y);
    if (o.sheen && v < -0.3 && u < 0.7) return tone(SHEEN, l * 0.9, x, y);
    return tone(o.ramp, l, x, y);
  });
}

// ---------------------------------------------------------------- a whole wing
export interface WingPose {
  /** shoulder and wrist */
  sx: number; sy: number; wx: number; wy: number;
  /** direction the primaries fan around (radians), the fan's spread, their length */
  tip: number; spread: number; plen: number;
  /** the direction the secondaries trail (radians) and their length */
  sec: number; slen: number;
  /** the far wing (darker) */
  far?: boolean;
  /** primaries knocked loose (hurt) / missing (fleeing, a gap) */
  ruffle?: number;
  gap?: number;
  seed: number;
  /** we see its underside (optional; the upper side by default) */
  under?: boolean;
}

/** a wing, shoulder to fingertips, as one structure: the leading edge bowing to the carpal bend and the
 *  alula, covert rows stepping down in value, the scalloped secondaries, the slotted primaries with the
 *  lightning across them (painted by ./tb-bird.ts) */
export function paintWing(b: PixelBuffer, w: WingPose) {
  tbWing(b, w);
}

// ---------------------------------------------------------------- texture fills
/** shaggy pointed feathers (hackles, trousers) as short strokes from (x, y) at angle a */
function shag(b: PixelBuffer, x: number, y: number, a: number, len: number, ramp: C[], light: number, seed: number) {
  const n = Math.ceil(len * 1.5);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = (1 - t) * 1.6;
    const px = x + Math.cos(a) * len * t, py = y + Math.sin(a) * len * t;
    for (let s = -w; s <= w; s += 0.5) {
      const qx = Math.round(px - Math.sin(a) * s), qy = Math.round(py + Math.cos(a) * s);
      b.set(qx, qy, tone(ramp, light - t * 0.2 + (s < 0 ? 0.12 : -0.06) + (hsh(qx, qy, seed) - 0.5) * 0.1, qx, qy));
    }
  }
}

// ---------------------------------------------------------------- the poses
export type TBPose = 'soar' | 'flap' | 'flee' | 'dive' | 'land' | 'shriek' | 'hurt';
export const TB_FRAMES: Record<TBPose, number> = { soar: 2, flap: 4, flee: 4, dive: 2, land: 2, shriek: 2, hurt: 2 };
export interface TBArt { buf: PixelBuffer; ax: number; ay: number }

/** from below: 344 x 220, anchored on the body (TB_FRAMES soar / flap / flee) */

/** seen from below: wings across the sky, the tail fanned, talons tucked, the head turned to look down */
function paintUnder(phase: number, o: { flee?: boolean; soar?: boolean }): TBArt {
  return tbUnder(phase, o);
}

/** in profile: 300 x 230, anchored on the body (dive) or the ground under the feet */

/** in profile, facing right. kind: dive (0 the stoop, 1 the strike), land (mantling), shriek, hurt */
function paintProfile(kind: 'dive' | 'land' | 'shriek' | 'hurt', f: number): TBArt {
  return tbProfile(kind, f);
}

const cache = new Map<string, TBArt>();
/** one frame of a pose (cached); frames: TB_FRAMES */
export function thunderbirdFrame(pose: TBPose, i: number): TBArt {
  const n = TB_FRAMES[pose];
  const k = `${pose}:${((i % n) + n) % n}`;
  let a = cache.get(k);
  if (a) return a;
  const f = ((i % n) + n) % n;
  if (pose === 'soar') a = paintUnder(f / n, { soar: true });
  else if (pose === 'flap') a = paintUnder(f / n, {});
  else if (pose === 'flee') a = paintUnder(f / n, { flee: true });
  else a = paintProfile(pose, f);
  cache.set(k, a);
  return a;
}
export const TB_ALL: [TBPose, number][] = (Object.keys(TB_FRAMES) as TBPose[]).flatMap(p => Array.from({ length: TB_FRAMES[p] }, (_, i) => [p, i] as [TBPose, number]));

/** its shadow racing over the ground: the soaring silhouette squashed flat, dithered */
export function thunderbirdShadow(): TBArt {
  const k = 'shadow';
  const c = cache.get(k);
  if (c) return c;
  const src = thunderbirdFrame('soar', 0).buf;
  const W = src.w, Hh = 26;
  const b = new PixelBuffer(W, Hh);
  const ink = H('#100c14');
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const sy = Math.floor((y / Hh) * src.h);
    if (!(src.get(x, sy) >>> 24)) continue;
    // denser in the middle of the wing, a 50% checker towards the edges
    const edge = !(src.get(x, Math.max(0, sy - 6)) >>> 24) || !(src.get(x, Math.min(src.h - 1, sy + 6)) >>> 24);
    if (edge ? (x + y) % 2 === 0 : bayer(x, y) < 0.85) b.set(x, y, ink);
  }
  const a = { buf: b, ax: W / 2, ay: Hh / 2 };
  cache.set(k, a);
  return a;
}

// ================================================================ the signs it leaves
/** a single shed primary lying in the litter: longer than Mori's arm, barred, with the white streak */
export function paintGiantFeather(): TBArt {
  const b = new PixelBuffer(124, 24);
  // a gently curved shaft in four segments, the vanes widest a third of the way up
  const segs: [number, number, number, number, number, number][] = [[10, 17, 40, 13, 7, 9], [39, 13, 70, 10, 9, 9], [69, 10, 98, 9, 9, 7], [97, 9, 119, 10, 7, 3]];
  segs.forEach(([x0, y0, x1, y1, w0, w1], i) => feather(b, x0, y0, x1, y1, w0, w1, { ramp: PLUME, light: 0.56, bars: 2, seed: 800 + i, rag: i === 3 ? 0.6 : 0.12, flash: i === 2 ? 0.45 : undefined, sheen: i < 2 }));
  // the shaft: a pale line right along it
  for (let x = 2; x < 112; x++) {
    const t = x / 112;
    const y = Math.round(18 - Math.sin(t * Math.PI * 0.55) * 8.5);
    b.set(x, y, x < 12 ? H('#e8dcb8') : tone(BAR, 0.75 - t * 0.4, x, y));
    if (x < 12) b.set(x, y + 1, H('#8a7a58'));
  }
  // split barbs curling off the vanes
  for (const [x, y, dx, dy] of [[30, 9, 2, -2], [52, 6, 3, -2], [46, 18, 2, 2], [78, 14, 3, 2], [88, 5, 2, -2]]) for (let k = 0; k < 3; k++) b.set(Math.round(x + (dx * k) / 2), Math.round(y + (dy * k) / 2), tone(PLUME, 0.6, x, y));
  b.outline(OUT);
  // its shadow on the ground (a dithered strip below)
  for (let x = 8; x < 116; x++) for (let y = 19; y < 23; y++) if (!(b.get(x, y) >>> 24) && (x + y) % 2 === 0 && y - 19 < 2.5 + Math.sin(x * 0.08) * 1.2) b.set(x, y, H('#1a1410'));
  return { buf: b, ax: 62, ay: 21 };
}

/** four raking talon gouges torn into the side of a boulder (painted onto `rock`, a hills boulder) */
export function gougeRock(rock: PixelBuffer, seed: number): void {
  const rng = new Rng(seed);
  const W = rock.w, Hh = rock.h;
  const pale = [H('#7a7470'), H('#b8b0a4'), H('#e4dccc')];
  for (let k = 0; k < 4; k++) {
    const x0 = W * 0.28 + k * W * 0.12 + rng.range(-2, 2), y0 = Hh * 0.22 + k * 2;
    const x1 = x0 + W * 0.16, y1 = y0 + Hh * 0.46 + rng.range(-3, 3);
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const w = Math.sin(t * Math.PI) * 2.2 + 0.4;
      const x = x0 + (x1 - x0) * t + Math.sin(t * 9 + k) * 0.8, y = y0 + (y1 - y0) * t;
      for (let s = -w; s <= w; s += 0.5) {
        const px = Math.round(x + s), py = Math.round(y);
        if (!(rock.get(px, py) >>> 24)) continue;
        const e = Math.abs(s) / w;
        rock.set(px, py, e > 0.75 ? H('#1a1612') : s < 0 ? tone(pale, 0.3 + (1 - e) * 0.3, px, py) : tone(pale, 0.7 + (1 - e) * 0.3, px, py));
      }
    }
    // chips knocked out at the start of each gouge
    for (let c = 0; c < 3; c++) { const px = Math.round(x0 + rng.range(-3, 3)), py = Math.round(y0 - rng.range(1, 3)); if (rock.get(px, py) >>> 24) rock.set(px, py, pale[2]); }
  }
}

/** the kill site: what's left of a torhopper, its skull with the horn shields, a ribcage picked clean,
 *  wool torn out in tufts, a dark stain dithered into the turf, and two of its feathers */
export function paintKillSite(): TBArt {
  const W = 120, Hh = 40;
  const b = new PixelBuffer(W, Hh);
  const gy = 34;
  // the stain, dithered into the ground
  for (let y = gy - 3; y < Hh - 1; y++) for (let x = 6; x < W - 8; x++) {
    const e = Math.abs(x - 58) / 54 + Math.abs(y - gy) / 6;
    if (e < 1 && bayer(x, y) < (1 - e) * 0.9) b.set(x, y, e < 0.55 ? H('#2a0e0c') : H('#3e2016'));
  }
  const bone = [H('#6e6252'), H('#a89880'), H('#d8ccb0'), H('#f4ecd8')];
  // ribs: curved bones arching up from a spine, each with a lit top edge
  for (let k = 0; k < 7; k++) {
    // each rib springs from the spine, arcs up and over and curls back down (picked clean, one snapped)
    const bx = 32 + k * 7.5, h = 19 - Math.abs(k - 3) * 2.5, snap = k === 5 ? 0.6 : 1;
    for (let i = 0; i <= 26; i++) {
      const t = (i / 26) * snap;
      const x = bx + Math.sin(t * Math.PI) * 9 - t * 3, y = gy - 2 - Math.sin(t * Math.PI * 0.85) * h;
      const X = Math.round(x), Y = Math.round(y);
      b.set(X, Y, tone(bone, 0.85 - t * 0.35, X, Y));
      b.set(X + 1, Y, tone(bone, 0.4, X + 1, Y));
    }
  }
  for (let x = 30; x < 86; x++) { b.set(x, gy - 2, tone(bone, 0.55 + (x % 3 === 0 ? 0.2 : 0), x, gy)); b.set(x, gy - 1, bone[0]); if (x % 4 === 0) b.set(x, gy - 3, bone[2]); }
  // the skull (hand-placed), the horn shields swept back
  stamp(b, { pal: { o: OUT, a: bone[0], b: bone[1], c: bone[2], d: bone[3], h: H('#4a4038'), H: H('#7a6a58'), k: H('#000000') }, rows: [
    '.....oooo.......',
    '...oohHHHoo.....',
    '..ohHHHhhhHo....',
    '.ohHooooohHHo...',
    'ohHoccddcoohHoo.',
    'ohocbccdddcoohoo',
    '.ocbkkbccddddco.',
    '.ocbkkbbccddddco',
    '..obbbbbbccccdo.',
    '..oaabbbbbbbco..',
    '...ooaaobobao...',
    '.....oo.o.oo....',
  ] }, 88, gy - 12);
  // wool tufts, grizzled grey
  const wool = [H('#5a5650'), H('#8a847a'), H('#bcb4a6')];
  for (const [x, y] of [[14, gy - 2], [22, gy - 4], [96, gy - 3], [104, gy - 1], [70, gy - 1]]) for (let k = 0; k < 5; k++) shag(b, x + k, y, -1.2 + k * 0.5, 4, wool, 0.6, x * 7 + k);
  // two of its feathers stabbed into the turf
  feather(b, 8, gy - 1, 18, gy - 22, 6, 4, { ramp: PLUME, light: 0.5, bars: 3, seed: 901, flash: 0.5 });
  feather(b, 108, gy, 116, gy - 16, 5, 3, { ramp: PLUME, light: 0.45, bars: 2, seed: 902 });
  b.outline(OUT);
  return { buf: b, ax: 60, ay: gy + 2 };
}

// ================================================================ the storm
/** rain streaks: short slanted strokes, a bright head and a fading tail (3 lengths) */
export function paintRain(): PixelBuffer[] {
  return [7, 10, 13].map(len => {
    const b = new PixelBuffer(Math.ceil(len / 3) + 2, len);
    for (let i = 0; i < len; i++) {
      const x = Math.floor((len - 1 - i) / 3), c = i > len - 3 ? H('#eef6ff') : i > len / 2 ? H('#a8c0dc') : H('#6e86a4');
      if (i < len / 3 && i % 2) continue;
      b.set(x, i, c);
    }
    return b;
  });
}
/** a splash where a drop hits (2 frames) */
export function paintSplash(): PixelBuffer[] {
  return [
    ['.a.a.', 'a...a'],
    ['a...a', '.....', 'b...b'],
  ].map(rows => {
    const b = new PixelBuffer(5, rows.length);
    rows.forEach((r, y) => { for (let x = 0; x < 5; x++) if (r[x] !== '.') b.set(x, y, r[x] === 'a' ? H('#cfe0f4') : H('#7e94b0')); });
    return b;
  });
}
/** an ordered-dither veil tile (white pixels at the given coverage) for the lightning flash */
export function paintVeil(coverage: number): PixelBuffer {
  const b = new PixelBuffer(32, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (bayer(x, y) < coverage) b.set(x, y, H('#ffffff'));
  return b;
}
/** a forked lightning bolt, a random walk with branches: white core, pale blue edges */
export function paintBolt(seed: number, h = 240): TBArt {
  const W = 120;
  const b = new PixelBuffer(W, h);
  const rng = new Rng(seed);
  const walk = (x: number, y: number, len: number, wide: boolean) => {
    for (let i = 0; i < len && y < h - 1; i++) {
      const step = rng.range(4, 9);
      const nx = Math.max(2, Math.min(W - 3, x + rng.range(-7, 7)));
      const n = Math.ceil(step);
      for (let k = 0; k <= n; k++) {
        const px = Math.round(x + (nx - x) * (k / n)), py = Math.round(y + k);
        if (wide) { b.set(px - 1, py, FLASH[0]); b.set(px + 1, py, FLASH[0]); }
        b.set(px, py, wide ? FLASH[2] : FLASH[1]);
      }
      x = nx; y += n;
      if (wide && rng.chance(0.18)) walk(x, y, 5 + Math.floor(rng.range(0, 6)), false);
    }
  };
  walk(W / 2, 0, 60, true);
  return { buf: b, ax: W / 2, ay: 0 };
}

// ================================================================ stinging insects
/** a paper-wasp nest hanging under a branch: layered grey-tan paper in wavy bands, the entrance below */
export function paintWaspNest(): TBArt {
  const W = 30, Hh = 40;
  const b = new PixelBuffer(W, Hh);
  const paper = [H('#4a4038'), H('#7a6c5a'), H('#a8967a'), H('#d0c0a0')];
  // the stalk and branch it hangs from
  for (let x = 0; x < W; x++) { b.set(x, 1, H('#3a2a1a')); b.set(x, 2, H('#5a4028')); if (x % 5 === 2) b.set(x, 0, H('#6a5030')); }
  for (let y = 3; y < 7; y++) { b.set(14, y, H('#5a4a3a')); b.set(15, y, H('#7a6a54')); }
  // the hand-shaped silhouette (wider at the shoulders, a lumpy taper to the mouth)
  const prof = [3, 6, 8, 10, 11, 12, 12, 13, 13, 13, 12, 13, 12, 12, 11, 11, 10, 10, 9, 9, 8, 8, 7, 7, 6, 6, 5, 5, 4, 4, 4, 3];
  prof.forEach((hw, i) => {
    const y = 6 + i;
    const off = Math.round(Math.sin(i * 0.7) * 0.8);
    for (let x = 15 - hw + off; x <= 15 + hw + off; x++) {
      const band = Math.sin((y + Math.sin(x * 0.6) * 1.5) * 1.3);
      const l = 0.62 - (x - (15 + off)) / (hw * 2.4) - i * 0.006 + (band > 0.55 ? 0.22 : band < -0.7 ? -0.25 : 0);
      b.set(x, y, tone(paper, l, x, y));
    }
  });
  // the entrance
  for (const [x, y] of [[14, 35], [15, 35], [16, 35], [15, 36], [14, 36], [16, 36]]) b.set(x, y, H('#100a08'));
  b.outline(OUT);
  return { buf: b, ax: 15, ay: 1 };
}
/** a wasp, 5 x 4, two wing frames: yellow and black bands, glassy wings */
export function paintWasp(): PixelBuffer[] {
  const pal: Record<string, C> = { o: H('#100a04'), y: H('#f0c020'), Y: H('#ffe060'), k: H('#1a1208'), w: H('#e8f4ff'), W: H('#a8c0d8') };
  return [['.ww..', 'oykyY', '.okko', '..o..'], ['.....', 'oykyY', 'WokkoW', '..o..']].map(rows => {
    const b = new PixelBuffer(6, 4);
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = pal[r[x]]; if (c !== undefined) b.set(x, y, c); } });
    return b;
  });
}

// ================================================================ the hunt's props
const TUS: C[] = ['#4a3c16', '#7a6428', '#a88c40', '#d4b866', '#f0dc98'].map(H);
const POLE: C[] = ['#2e2014', '#5a4028', '#8a6a44'].map(H);
/** the hunters' blind on the ridge: tussock bundles lashed over a low mānuka frame, a dark slot to
 *  watch through (78 x 44). Mori crouches in it to vanish. */
export function paintBlind(): TBArt {
  const W = 78, Hh = 44;
  const b = new PixelBuffer(W, Hh);
  // the poles first (they stick out of the thatch)
  const poles: [number, number, number, number][] = [[10, 43, 18, 6], [66, 43, 58, 4], [30, 43, 36, 2], [50, 43, 44, 3]];
  for (const [x0, y0, x1, y1] of poles) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= n; i++) { const t = i / n, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t); b.set(x, y, POLE[1]); b.set(x + 1, y, POLE[0]); if (i % 7 === 0) b.set(x, y, POLE[2]); }
  }
  // the mound of thatch: a lumpy hand-picked outline filled with downward tussock strokes
  const out = [3, 43, 6, 30, 12, 20, 22, 12, 34, 9, 46, 10, 57, 14, 66, 22, 72, 31, 75, 43];
  b.polyFn(out, (x, y) => tone(TUS, 0.45 - (y - 10) * 0.006 + ((x * 7 + (y >> 1) * 3) % 5 === 0 ? 0.18 : 0) + (hsh(x, y, 41) - 0.5) * 0.14, x, y));
  for (let row = 0; row < 6; row++) for (let k = 0; k < 15; k++) {
    const x = 5 + k * 5 + (row & 1) * 2, y = 12 + row * 5 + ((k * 3) % 4);
    if (!opaque(b, x, y)) continue;
    shag(b, x, y, Math.PI / 2 + ((k % 3) - 1) * 0.22, 6 + ((k + row) % 4), TUS, 0.62 - row * 0.04, row * 31 + k);
  }
  // the watching slot and the flax lashings
  for (let x = 28; x < 50; x++) for (let y = 21; y < 25; y++) b.set(x, y, y === 21 ? TUS[0] : H('#120c06'));
  for (const lx of [18, 40, 60]) for (let y = 14; y < 40; y += 6) { b.set(lx, y, H('#5e7030')); b.set(lx + 1, y, H('#86964a')); }
  // tufts springing off the crown
  for (let k = 0; k < 9; k++) shag(b, 16 + k * 6, 12 - (k % 3), -Math.PI / 2 + ((k % 3) - 1) * 0.35, 5 + (k % 3) * 2, TUS, 0.8, 70 + k);
  b.outline(OUT);
  return { buf: b, ax: 39, ay: 43 };
}
/** the hide cloak pulled over a crouching Mori: a tussock mound with a dull feather or two (34 x 30) */
export function paintCloakDrape(): TBArt {
  const W = 34, Hh = 30;
  const b = new PixelBuffer(W, Hh);
  const out = [2, 29, 4, 18, 9, 9, 17, 5, 25, 8, 30, 16, 32, 29];
  b.polyFn(out, (x, y) => tone(TUS, 0.42 + ((x + y * 2) % 4 === 0 ? 0.16 : 0) + (hsh(x, y, 61) - 0.5) * 0.16, x, y));
  for (let row = 0; row < 5; row++) for (let k = 0; k < 7; k++) {
    const x = 4 + k * 4 + (row & 1) * 2, y = 7 + row * 5;
    if (!opaque(b, x, y)) continue;
    shag(b, x, y, Math.PI / 2 + ((k % 3) - 1) * 0.2, 5 + ((k + row) % 3), TUS, 0.6, row * 17 + k);
  }
  for (let k = 0; k < 6; k++) shag(b, 8 + k * 4, 7 - (k % 2), -Math.PI / 2 + ((k % 3) - 1) * 0.4, 4 + (k % 2) * 2, TUS, 0.82, 90 + k);
  feather(b, 22, 14, 29, 22, 3, 2, { ramp: PLUME, light: 0.55, bars: 2, seed: 970 });
  b.outline(OUT);
  return { buf: b, ax: 17, ay: 29 };
}
/** the bait laid out on the stone: the flax-wrapped eel, a feather fluttering from it (28 x 12) */
export function paintBaitWorld(): TBArt {
  const b = new PixelBuffer(28, 12);
  const eel = [H('#2a1a10'), H('#5a3418'), H('#8a5428'), H('#c48a48')];
  b.polyFn([1, 8, 5, 5, 13, 4, 22, 5, 26, 7, 26, 9, 21, 11, 12, 11, 4, 10], (x, y) => tone(eel, 0.75 - (y - 4) * 0.07 + (hsh(x, y, 7) - 0.5) * 0.14, x, y));
  for (const bx of [7, 12, 17, 21]) for (let y = 3; y < 12; y++) if (opaque(b, bx, y)) b.set(bx, y, y < 6 ? H('#86964a') : H('#5e7030'));
  feather(b, 23, 6, 27, 1, 3, 2, { ramp: PLUME, light: 0.6, seed: 971 });
  b.outline(OUT);
  return { buf: b, ax: 14, ay: 11 };
}
/** Aroha's snare: a running noose of flax cord pegged to a stake (22 x 12) */
export function paintSnare(): TBArt {
  const b = new PixelBuffer(22, 12);
  const cord = [H('#4e5a24'), H('#7a8a3a'), H('#a8b464')];
  for (let y = 1; y < 12; y++) { b.set(2, y, POLE[1]); b.set(3, y, POLE[0]); }
  b.set(2, 1, POLE[2]);
  const loop: [number, number][] = [[4, 3], [5, 4], [6, 5], [7, 6], [8, 7], [9, 7], [10, 8], [11, 8], [12, 7], [13, 7], [14, 7], [15, 7], [16, 7], [17, 8], [18, 9], [18, 10], [17, 11], [15, 11], [13, 11], [11, 11], [10, 10], [10, 9], [11, 8]];
  loop.forEach(([x, y], i) => b.set(x, y, cord[i % 3 === 0 ? 2 : 1]));
  b.set(10, 8, H('#2a3010'));
  b.outline(OUT);
  return { buf: b, ax: 3, ay: 11 };
}
const opaque = (b: PixelBuffer, x: number, y: number) => b.get(x, y) >>> 24 !== 0;

// ================================================================ backpack art (24 px cells)
function finishItem(b: PixelBuffer): HTMLCanvasElement {
  b.outline(H('#140a10'));
  const W = b.w, Hh = b.h, src = b.data.slice();
  for (let y = Hh - 2; y >= 0; y--) for (let x = W - 2; x >= 0; x--) if ((src[y * W + x] >>> 24) && !(src[(y + 1) * W + x + 1] >>> 24) && !(b.data[(y + 1) * W + x + 1] >>> 24)) b.data[(y + 1) * W + x + 1] = (0x60 << 24 | 0x100608) >>> 0;
  return b.toCanvas(1);
}
/** the hide cloak: a folded cloak of flax weave thatched with tussock and dull feathers (48 x 48) */
export function paintHideCloakItem(): PixelBuffer {
  const b = new PixelBuffer(48, 48);
  const flax = [H('#4a4422'), H('#6e6630'), H('#94884a'), H('#bcae6a')];
  const tus = [H('#5a4a1c'), H('#8a7230'), H('#b89a48'), H('#e0c87a')];
  // the cape laid out: narrow at the neck, flaring to a ragged hem (a hand-picked outline)
  const out = [19, 5, 29, 5, 33, 12, 38, 22, 43, 34, 44, 41, 34, 43, 24, 44, 13, 43, 4, 41, 5, 33, 10, 22, 15, 12];
  b.polyFn(out, (x, y) => {
    const weave = ((x >> 1) + (y >> 1)) % 2 === 0;
    const fold = Math.abs(x - 24 - (y - 24) * 0.08) < 0.8 && y > 12;
    return fold ? flax[0] : tone(flax, 0.62 - (x + y) / 140 + (weave ? 0.12 : -0.05), x, y);
  });
  // tussock thatch hanging in rows, and a few dull feathers
  for (let row = 0; row < 5; row++) for (let k = 0; k < 10; k++) {
    const x = 6 + k * 4 + (row & 1) * 2, y = 12 + row * 7;
    if (!(b.get(x, y) >>> 24)) continue;
    shag(b, x, y, Math.PI / 2 + ((k % 3) - 1) * 0.15, 6 + ((k + row) % 3), tus, 0.55, row * 13 + k);
  }
  feather(b, 30, 30, 40, 38, 4, 3, { ramp: PLUME, light: 0.55, bars: 2, seed: 951 });
  feather(b, 12, 32, 6, 40, 4, 3, { ramp: PLUME, light: 0.5, bars: 2, seed: 952 });
  // the flax tie at the neck, its two ends hanging
  for (let x = 16; x < 32; x++) { b.set(x, 7 + (x & 1), flax[3]); b.set(x, 8 + (x & 1), flax[1]); }
  for (let y = 8; y < 15; y++) { b.set(17 - (y >> 2), y, flax[2]); b.set(31 + (y >> 2), y, flax[2]); }
  return b;
}
/** the bait bundle: a smoked eel wrapped in flax, a feather tied on to flutter (48 x 24) */
export function paintBaitItem(): PixelBuffer {
  const b = new PixelBuffer(48, 24);
  const eel = [H('#2a1a10'), H('#5a3418'), H('#8a5428'), H('#c48a48')];
  const flax = [H('#3e4a1e'), H('#5e7030'), H('#86964a')];
  const pts = [3, 13, 10, 8, 22, 7, 36, 8, 44, 11, 45, 14, 38, 17, 24, 18, 10, 17];
  b.polyFn(pts, (x, y) => tone(eel, 0.7 - (y - 7) * 0.05 + (hsh(x, y, 3) - 0.5) * 0.12, x, y));
  // flax bands wrapped round it
  for (const bx of [12, 20, 28, 36]) for (let y = 6; y < 19; y++) { if (!(b.get(bx, y) >>> 24)) continue; b.set(bx, y, tone(flax, 0.7 - (y - 6) * 0.04, bx, y)); b.set(bx + 1, y, flax[0]); }
  feather(b, 40, 9, 46, 1, 4, 3, { ramp: PLUME, light: 0.6, bars: 2, seed: 960 });
  return b;
}
export const hideCloakCanvas = () => finishItem(paintHideCloakItem());
export const baitCanvas = () => finishItem(paintBaitItem());
/** a darker copy of a buffer (for frames that sit back in the haze) */
export function darken(b: PixelBuffer, k: number): PixelBuffer {
  const c = b.clone();
  c.map(col => (col >>> 24 ? shade(col, -k) : col));
  return c;
}
void mix;

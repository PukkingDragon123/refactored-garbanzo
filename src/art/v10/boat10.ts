// V10 art: the Kitten, the Kittiwake's clinker tender, at every stage of the repair, and the bits of
// the camp boatyard around her. Painted with the Kittiwake's own ramps (art/boatKit.ts), so she reads
// as the mother ship's little sister: cream lapstrake topsides with copper rivets along every lap,
// a varnished gunwale with a looped grab-line, a red boot stripe over dark antifouling, KITTEN on the
// bow. Repairs show: pale new planks stitched in with harakeke and sealed with amber kauri gum,
// Aroha's driftwood ama (outrigger float) on two lashed booms, Jenna's rebuilt outboard, a mast with
// a woven harakeke crab-claw sail and Jenna's pink cat pennant.
//
// Boat-local pixels: the hull runs x 0 (transom) .. KL (stem), bow to +x; y down; the static
// waterline is KWL. Every sprite is anchored at the boat-local origin (ax, ay = buffer position of
// boat-local 0,0), so draw them all at the same world point.
//
// API
//   KL, KWL, KPIV, MAST_X, sheerY(x), keelY(x), farSheerY(x), AMA (float geometry)
//   kittenHull(stage, part: 'back' | 'front' | 'all', ama = true): Spr   stage 1..6 (0: buriedTender)
//   amaRig(): Spr                      the outrigger float and booms on their own (the trip draws them over the sea)
//   outboard(mode: 'down' | 'up', frame = 0): Spr
//   sailRig(mode: 'furled' | 'set', fill = 1, frame = 0): Spr   mast, spars, sail, pennant
//   kittenCamp(stage): Spr             everything for the boatyard at a stage
//   buriedTender(); boatyard props: plankStack(n), gumLeaf(n), flaxBundle(n), amaLog(), sawhorseMotor(),
//   weaveMat(k), yardSign(); debugSheet() for checking

import { PixelBuffer } from '../pixel';
import { C, hex, mix, shade } from '../color';
import { P, OL, pixelText, textWidth } from '../boatKit';
import { bayer, clamp, hash2, noise1, smoothstep } from '../../core/math';

export interface Spr { buf: PixelBuffer; ax: number; ay: number; glow?: PixelBuffer }

export const KL = 118;
export const KWL = 28;
/** rocking pivot (boat-local) */
export const KPIV: [number, number] = [56, 28];
export const MAST_X = 80;
/** buffer margins around boat-local space */
const MX = 34, MT = 112, MB = 30;
const BW = KL + MX * 2, BH = MT + KWL + MB;
const mk = () => new PixelBuffer(BW, BH);
const spr = (buf: PixelBuffer, glow?: PixelBuffer): Spr => ({ buf, ax: MX, ay: MT, glow });

/** near gunwale: a gentle spring, lowest a little aft of midships, a proud stem head */
export function sheerY(x: number) {
  const u = clamp(x / KL);
  const aft = u < 0.45 ? Math.pow((0.45 - u) / 0.45, 2) : 0;
  const fwd = u > 0.45 ? Math.pow((u - 0.45) / 0.55, 2.1) : 0;
  return 12.5 - 2.4 * aft - 6.8 * fwd;
}
/** bottom of the keel: the run lifts aft to the transom, a round forefoot rises to the stem */
export function keelY(x: number) {
  const u = clamp(x / KL);
  const f = clamp((u - 0.72) / 0.28);
  return 34 - 6.5 * Math.pow(smoothstep(0.42, 0, u), 1.5) - 19.5 * (1 - Math.sqrt(Math.max(0, 1 - f * f)));
}
/** the far gunwale, seen over the near one (the camera is a little above the boat) */
export function farSheerY(x: number) {
  return sheerY(x) - 3.4 * Math.pow(Math.max(0, Math.sin(Math.PI * (x + 36) / (KL + 36))), 0.7);
}
/** the raked transom: the aft edge of the hull at row y */
const aftX = (y: number) => Math.max(0, (y - sheerY(0)) * 0.18);

// ------------------------------------------------------------------ helpers
function put(b: PixelBuffer, x: number, y: number, c: C) { b.set(Math.round(x) + MX, Math.round(y) + MT, c); }
const rq = (r: C[], f: number) => r[clamp(Math.round(f), 0, r.length - 1)];
const dz = (x: number, y: number, k = 0.8) => (bayer(x, y) - 0.5) * k;
function line(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, c: C | ((t: number) => C)) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) { const t = i / n; put(b, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, typeof c === 'function' ? c(t) : c); }
}
/** a round pole (w px thick): a light edge on top, a dark one below */
function pole(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, r: C[], w = 2) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5));
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  let nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
  if (ny > 0) { nx = -nx; ny = -ny; } // normal points up (toward the light)
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    for (let k = 0; k < w; k++) {
      const o = (w - 1) / 2 - k;
      const f = w === 1 ? r.length * 0.6 : r.length - 1 - (k / (w - 1)) * (r.length - 2) - 0.5;
      put(b, x + nx * o, y + ny * o, rq(r, f));
    }
  }
}
function outlineAll(b: PixelBuffer) { b.outline((c: C) => mix(shade(c, -0.7), OL, 0.6)); }
/** composite sprites that share the boat-local anchor */
function stack(parts: Spr[]): Spr {
  const b = mk();
  for (const p of parts) b.blit(p.buf, MX - p.ax, MT - p.ay);
  return spr(b);
}

// ------------------------------------------------------------------ damage & repairs
const STRAKES = 5;
/** t (0 gunwale .. 1 keel) of the lap between strake i-1 and i */
const lapT = (i: number) => i / STRAKES;
interface Patch { x0: number; x1: number; s0: number; s1: number }
/** holes in the near side, in (x, t) */
const HOLES = [{ x: 44, t: 0.5, rx: 6.5, rt: 0.17, seed: 3 }, { x: 86, t: 0.64, rx: 3.6, rt: 0.11, seed: 7 }];
/** the stove-in strake (a plank length missing) */
const GAP = { x0: 59, x1: 72, s: 2 };
/** new planks: whole strakes [s0, s1) between x0 and x1 */
const PATCHES: Patch[] = [{ x0: 34, x1: 55, s0: 1, s1: 4 }, { x0: 57, x1: 75, s0: 2, s1: 3 }, { x0: 80, x1: 93, s0: 2, s1: 4 }];

function holeAt(x: number, t: number): 0 | 1 | 2 {
  for (const h of HOLES) {
    const dx = (x - h.x) / h.rx, dt = (t - h.t) / h.rt;
    const a = Math.atan2(dt, dx);
    const r = 1 + (noise1(a * 2.2 + h.seed, h.seed) - 0.5) * 0.7;
    const d = Math.hypot(dx, dt);
    if (d < r * 0.82) return 1;
    if (d < r * 1.1) return 2;
  }
  const s = Math.floor(t * STRAKES);
  if (s === GAP.s && x >= GAP.x0 && x <= GAP.x1) {
    const e = Math.min(x - GAP.x0, GAP.x1 - x);
    if (e < 1.5 && hash2(Math.round(t * 60), x, 11) < 0.55) return 2;
    return 1;
  }
  return 0;
}
const patchAt = (x: number, t: number) => { const s = Math.floor(t * STRAKES); return PATCHES.find(p => x >= p.x0 && x <= p.x1 && s >= p.s0 && s < p.s1) ?? null; };

// ------------------------------------------------------------------ the hull
/** the hull at a stage: the far gunwale and the inside ('back'), the near planking ('front') */
export function kittenHull(stage: number, part: 'back' | 'front' | 'all' = 'all', ama = true): Spr {
  const b = mk();
  if (part !== 'front') paintInside(b, stage);
  if (part !== 'back') paintNearSide(b, stage);
  outlineAll(b);
  const out = spr(b);
  return part !== 'back' && ama && stage >= 3 ? stack([out, amaRig()]) : out;
}

/** far gunwale, the inside of the planking, frames and thwarts (the sliver over the near gunwale) */
function paintInside(b: PixelBuffer, stage: number) {
  for (let x = 1; x < KL - 1; x++) {
    const top = Math.round(farSheerY(x)), bot = Math.round(sheerY(x)) + 1;
    for (let y = top; y <= bot; y++) {
      let c = y === top ? P.varnish[6] : y === top + 1 ? P.varnish[4] : rq(P.varnish, 2.2 + (y - top) * 0.12 + dz(x, y, 0.5));
      if (y > top + 1 && x % 7 === 3) c = P.varnish[4]; // frames
      put(b, x, y, c);
    }
  }
  // thwarts: stern, midships, bow
  for (const tx of [20, 54, 92]) {
    const top = Math.round(farSheerY(tx)) + 1, bot = Math.round(sheerY(tx));
    for (let x = tx - 5; x <= tx + 5; x++) for (let y = top; y <= bot; y++) put(b, x, y, y === top ? P.wood[7] : x === tx + 5 ? P.wood[4] : P.wood[6]);
  }
  for (let y = Math.round(farSheerY(1)); y <= Math.round(sheerY(0)); y++) { put(b, 0, y, P.varnish[5]); put(b, 1, y, P.varnish[3]); }
  // oars stowed along the thwarts, blades forward, looms sticking out over the transom
  if (stage >= 5) {
    for (const [dy, x0, x1] of [[-1, -6, 108], [0, -2, 112]] as const) {
      for (let x = x0; x <= x1; x++) {
        const xx = clamp(x, 1, KL - 2);
        const y = Math.round(farSheerY(xx) + (sheerY(xx) - farSheerY(xx)) * 0.4) + dy;
        const blade = x > x1 - 13;
        put(b, x, y, blade ? P.wood[6] : P.varnish[5]);
        if (blade) { put(b, x, y - 1, P.wood[7]); put(b, x, y + 1, P.wood[5]); }
      }
    }
  }
}

function paintNearSide(b: PixelBuffer, stage: number) {
  const broken = stage <= 1, patched = stage >= 2;
  for (let x = 0; x < KL; x++) {
    const top = sheerY(x), bot = keelY(x);
    const y0 = Math.round(top), y1 = Math.round(bot);
    for (let y = y0; y <= y1; y++) {
      if (x < aftX(y)) continue;
      const t = (y + 0.5 - top) / Math.max(1, bot - top);
      let c = planking(x, y, t, y === y1);
      if (broken) {
        const h = holeAt(x, t);
        if (h === 1) c = x % 7 === 3 ? P.varnish[3] : rq(P.varnish, 0.6 + dz(x, y, 0.8)); // the dark inside, frames showing
        else if (h === 2) c = hash2(x, y, 5) < 0.5 ? P.wood[6] : P.wood[4]; // splinters
        else if (y > KWL + 1 && hash2(x >> 1, y >> 1, 21) < 0.06) c = P.white[4]; // barnacles
        else if (scrape(x, t)) c = rq(P.teak, 4.4 + dz(x, y)); // paint scraped to bare wood
      }
      if (patched) { const p = patchAt(x, t); if (p) c = patchPixel(x, y, t, p, stage); }
      put(b, x, y, c);
    }
  }
  // the gunwale: a varnished cap and rubbing strake
  for (let x = 0; x < KL; x++) {
    const y = Math.round(sheerY(x));
    put(b, x, y, P.varnish[6]);
    put(b, x, y + 1, x % 3 === 0 ? P.varnish[3] : P.varnish[4]);
  }
  // brass rowlock plates on the gunwale
  for (const rx of [30, 62]) { put(b, rx, sheerY(rx) - 1, P.brass[5]); put(b, rx + 1, sheerY(rx) - 1, P.brass[3]); }
  // KITTEN on the bow, scuffed until Jenna touches it up
  const name = 'KITTEN';
  const nx = 97 - Math.round(textWidth(name) / 2), ny = Math.round(sheerY(97)) + 4;
  // (pixelText only calls set(): a stand-in buffer offsets the letters into boat space and scuffs them)
  const pen = { set: (px: number, py: number, c: C) => { if (!(stage <= 1 && hash2(px, py, 9) < 0.16)) put(b, px, py, c); } } as unknown as PixelBuffer;
  pixelText(pen, name, nx, ny, P.navy[2]);
  if (stage >= 5) {
    // Jenna's pink cat face beside the name
    const cx = nx + textWidth(name) + 5, cy = ny + 2;
    const pink = hex('#e876a8');
    for (const [dx, dy] of [[-2, -2], [2, -2], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [-1, 2], [0, 2], [1, 2]]) put(b, cx + dx, cy + dy, pink);
    put(b, cx - 1, cy, P.navy[1]); put(b, cx + 1, cy, P.navy[1]); put(b, cx, cy + 1, hex('#ffd0e0'));
  }
  // the transom's end grain and the keel strip
  for (let y = Math.round(sheerY(0)); y <= Math.round(keelY(0)); y++) put(b, Math.ceil(aftX(y)), y, y > KWL ? P.bottom[1] : P.cream[2]);
  for (let x = 2; x < KL - 4; x++) put(b, x, Math.round(keelY(x)), P.bottom[0]);
}
const scrape = (x: number, t: number) => t > 0.08 && t < 0.86 && noise1(x / 7 + t * 9, 33) > 0.84;

/** cream lapstrake topsides, the boot stripe and the antifouling */
function planking(x: number, y: number, t: number, bottomRow: boolean): C {
  const s = t * STRAKES, si = Math.floor(s), f = s - si;
  const round = 1 - t;
  if (y > KWL) {
    let c = rq(P.bottom, 2.2 + round * 2 + dz(x, y, 0.6));
    if (f < 0.16 && si > 0) c = P.bottom[1];
    else if (f > 0.84 && si < STRAKES - 1) c = P.bottom[4];
    if (y > KWL + 2 && noise1(x / 6 + y * 0.6, 41) > 0.82) c = P.green[2]; // weed
    if (bottomRow) c = P.bottom[0];
    return c;
  }
  if (y >= KWL - 1) return y === KWL - 1 ? P.red[4] : P.red[2];
  // flat cel tone per strake (lighter up top where the side faces the sky), a soft dither only
  // across the middle of each plank so the face still reads as curved
  const base = 5.4 - si * 0.5;
  let c = rq(P.cream, base + (f > 0.35 && f < 0.65 ? dz(x, y, 0.5) : 0));
  // the lap: a hard shadow just under each plank edge, the proud edge lit just above it
  if (si > 0 && f < 0.17) c = P.cream[2];
  else if (f > 0.83 && si < STRAKES - 1) c = P.cream[6];
  // copper rivets along the laps
  if (si > 0 && f < 0.17 && x % 7 === 3) c = P.copper[4];
  void round;
  return c;
}

/** a new plank piece: pale wood, lapped like the rest, harakeke stitches and amber gum at the ends */
function patchPixel(x: number, y: number, t: number, p: Patch, stage: number): C {
  const s = t * STRAKES, f = s - Math.floor(s);
  const end = Math.min(x - p.x0, p.x1 - x) < 1;
  if (end) return (y % 3 === 0) ? P.green[4] : stage === 2 ? hex('#f0b040') : hex('#c88a2a');
  let c = rq(P.wood, 5.2 + (1 - t) * 1.8 + (noise1(x / 6 + y * 0.35, 51) - 0.5) * 0.9);
  if (Math.floor(s) > p.s0 || Math.floor(s) > 0) { if (f < 0.17) c = P.wood[3]; }
  if (f > 0.83) c = P.wood[7];
  // stitched lashings along the top and bottom of the patch
  const top = Math.floor(s) === p.s0 && f < 0.2, bot = Math.floor(s) === p.s1 - 1 && f > 0.8;
  if ((top || bot) && x % 3 === 0) c = P.green[3];
  if (y > KWL + 1) c = mix(c, P.bottom[3], 0.4);
  return c;
}

// ------------------------------------------------------------------ the outrigger
/** the ama: a shaped driftwood float alongside on the near side, on two booms (iako) lashed across the gunwales */
export const AMA = { x0: 14, x1: 100, cy: KWL - 1.5, r: 3.8 };
export function amaRig(): Spr {
  const b = mk();
  paintAma(b, AMA.cy);
  for (const bx of [24, 72]) {
    const y0 = sheerY(bx) - 1, y1 = AMA.cy - AMA.r + 0.5;
    pole(b, bx, y0, bx - 7, y1, P.teak, 3);
    // a curved crook where it meets the float, lashed on
    for (let k = -2; k <= 1; k++) { put(b, bx - 7 + k, y1, P.rope[4]); put(b, bx - 7 + k, y1 + 1, P.rope[2]); }
    for (let k = -1; k <= 1; k++) { put(b, bx + k, y0 + 1, P.rope[4]); put(b, bx + k, y0 + 2, P.rope[2]); }
  }
  outlineAll(b);
  return spr(b);
}
function paintAma(b: PixelBuffer, cy: number) {
  const { x0, x1, r: R } = AMA;
  for (let x = x0; x <= x1; x++) {
    const u = (x - x0) / (x1 - x0);
    // pointed forward, blunt aft, a slight upturn at the nose
    const r = R * Math.min(1, Math.pow(Math.min(u * 5, (1 - u) * 2.6), 0.55));
    const lift = Math.pow(smoothstep(0.75, 1, u), 2) * 2.5;
    for (let y = Math.floor(cy - r - lift); y <= Math.ceil(cy + r - lift); y++) {
      const ny = (y + lift - cy) / Math.max(0.5, r);
      if (Math.abs(ny) > 1) continue;
      let c = rq(P.teak, 5.6 - (ny + 1) * 2.2 + dz(x, y, 0.7));
      if (noise1(x / 4 + y * 0.9, 61) > 0.8) c = P.teak[2];
      put(b, x, y, c);
    }
  }
}

// ------------------------------------------------------------------ the outboard
const GRIP = hex('#26222a');
/** Jenna's two-stroke outboard on the transom: running (leg down) or tilted up on the beach */
export function outboard(mode: 'down' | 'up', frame = 0): Spr {
  const b = mk();
  const top = sheerY(0);
  // painted in a frame with the clamp pivot at (0, top); the tilt swings the leg up aft and the
  // powerhead forward over the transom, as a real one does
  const pts: [number, number, C][] = [];
  const P_ = (x: number, y: number, c: C) => pts.push([x, y, c]);
  for (let y = -12; y <= -1; y++) for (let x = -13; x <= 1; x++) {
    const nx = (x + 6) / 7.5, ny = (y + 6.5) / 6;
    if (nx * nx * 0.7 + ny * ny > 1.05 && !(y > -4 && x > -12)) continue;
    let c = rq(P.white, 4 - (ny + 1) * 1.4 + dz(x, y, 0.6));
    if (y === -5 || y === -4) c = y === -5 ? hex('#e8782e') : hex('#c05a1c');
    if (x === 1 || (y > -4 && x === -12)) c = P.white[1];
    P_(x, y, c);
  }
  // Jenna's cat sticker
  const pk = hex('#e876a8');
  for (const [x, y] of [[-8, -9], [-7, -9], [-9, -10], [-6, -10], [-8, -8], [-7, -8]]) P_(x, y, pk);
  // pull-start handle, tiller arm with its grip
  P_(-13, -8, P.metal[2]); P_(-14, -8, P.red[3]); P_(-14, -9, P.red[4]);
  for (let x = 1; x <= 15; x++) { P_(x, -6 - x * 0.12, P.metal[3]); P_(x, -5 - x * 0.12, P.metal[2]); }
  for (let x = 12; x <= 16; x++) { P_(x, -7 - x * 0.12, GRIP); P_(x, -6 - x * 0.12, GRIP); }
  // clamp bracket over the transom
  for (let y = -1; y <= 4; y++) { P_(0, y, P.metal[4]); P_(1, y, P.metal[2]); }
  P_(2, 2, P.metal[5]); P_(2, 3, P.metal[3]);
  // leg, anti-cavitation plate, gearcase, skeg and propeller
  const legBot = KWL + 15 - top;
  for (let y = 0; y <= legBot; y++) {
    const w = y > legBot - 6 ? 4 : 3;
    for (let k = 0; k < w; k++) P_(-4 - k + (y > legBot - 6 ? 1 : 0), y, k === 0 ? P.metal[6] : k === w - 1 ? P.metal[2] : P.metal[4]);
  }
  for (let x = -9; x <= 0; x++) P_(x, legBot - 6, x === -9 ? P.metal[2] : P.metal[5]);
  P_(-5, legBot + 1, P.metal[3]); P_(-5, legBot + 2, P.metal[2]);
  const bl = [[[-2, -3], [-2, 3]], [[-2, -2], [-1, 3]], [[-1, -3], [-2, 2]]][frame % 3];
  for (const [dx, dy] of bl) for (let k = 0; k <= Math.abs(dy); k++) P_(-8 + dx, legBot - 2 + Math.sign(dy) * k, P.brass[4]);
  P_(-8, legBot - 2, P.brass[2]);
  const a = mode === 'up' ? 1.2 : 0, ca = Math.cos(a), sa = Math.sin(a);
  for (const [x, y, c] of pts) {
    const rx = x * ca - y * sa, ry = x * sa + y * ca;
    put(b, rx, top + ry, c);
    if (mode === 'up') put(b, rx + 0.45, top + ry + 0.45, c);
  }
  outlineAll(b);
  return spr(b);
}

// ------------------------------------------------------------------ mast, sail, pennant
/** the tack, where both spars meet, low on the bow */
export const SAIL_TACK: [number, number] = [96, 9];
const MAST_TOP = -64;
/** the woven crab-claw sail on its two spars (or furled up the yard), and Jenna's pennant */
export function sailRig(mode: 'furled' | 'set', fill = 1, frame = 0): Spr {
  const b = mk();
  const mx = MAST_X, mBot = Math.round(sheerY(mx)) - 1;
  const [tx, ty] = SAIL_TACK;
  // the yard leans aft from the tack, lashed to the masthead; the boom swings out aft when it is set
  const yard: [number, number] = [mx - 12 - (mode === 'set' ? fill * 4 : 0), MAST_TOP - 16];
  if (mode === 'furled') {
    pole(b, mx, mBot, mx, MAST_TOP, P.varnish, 2);
    // the sail rolled up along the yard, lashed every few pixels
    const n = Math.ceil(Math.hypot(yard[0] - tx, yard[1] - ty));
    for (let i = 4; i <= n - 6; i++) {
      const u = i / n, x = tx + (yard[0] - tx) * u, y = ty + (yard[1] - ty) * u;
      const w = 1.4 + Math.sin(Math.min(1, u * 1.15) * Math.PI) * 2.4;
      for (let k = -Math.ceil(w); k <= Math.ceil(w); k++) {
        if (Math.abs(k) > w) continue;
        const lashed = i % 9 === 0;
        put(b, x + k * 0.97, y + k * 0.24, lashed ? (k % 2 ? P.rope[2] : P.rope[4]) : rq(SAIL, 3.4 - (k / w) * 1.6 + (((i + k) % 4) === 0 ? -1 : 0)));
      }
    }
    pole(b, tx, ty, yard[0], yard[1], P.teak, 2);
  } else {
    const flut = [0, 0.7, -0.5, 0.35][frame % 4] * (1.25 - fill);
    const boom: [number, number] = [tx - 60 - fill * 6, MAST_TOP + 24 - fill * 6];
    // cloth: tack -> yard tip -> (the claw: a deep inward curve) -> boom tip -> tack, with the belly
    const pts: number[] = [tx, ty, yard[0], yard[1]];
    const N = 18;
    for (let i = 1; i < N; i++) {
      const u = i / N;
      const x = yard[0] + (boom[0] - yard[0]) * u, y = yard[1] + (boom[1] - yard[1]) * u;
      // bow the edge in toward the tack
      const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy) || 1;
      const k = Math.sin(u * Math.PI) * (12 + flut * 5);
      pts.push(x + (dx / d) * k, y + (dy / d) * k);
    }
    pts.push(boom[0], boom[1]);
    // foot: the boom side sags a little with the wind behind it
    for (let i = 1; i < 8; i++) {
      const u = i / 8, x = boom[0] + (tx - boom[0]) * u, y = boom[1] + (ty - boom[1]) * u;
      pts.push(x, y + Math.sin(u * Math.PI) * 2 * fill);
    }
    const off = pts.map((v, i) => v + (i % 2 ? MT : MX));
    b.polyFn(off, (x, y) => {
      const lx = x - MX, ly = y - MT;
      // belly: brighter across the middle of the cloth, darker along the spars
      const dYard = distSeg(lx, ly, tx, ty, yard[0], yard[1]), dBoom = distSeg(lx, ly, tx, ty, boom[0], boom[1]);
      const belly = clamp(Math.min(dYard, dBoom) / 14) * fill;
      const weave = ((lx + ly) >> 1) % 2 === 0 ? 0.45 : -0.35;
      const strip = (lx - ly * 2 + 400) % 8 === 0 ? -1.3 : 0;
      return rq(SAIL, 2.2 + belly * 2 + weave + strip + dz(lx, ly, 0.45));
    });
    pole(b, mx, mBot, mx, MAST_TOP, P.varnish, 2);
    pole(b, tx, ty, yard[0], yard[1], P.teak, 2);
    pole(b, tx, ty, boom[0], boom[1], P.teak, 2);
    // the sheet, led aft to the helm
    line(b, boom[0] + 3, boom[1] + 2, 6, sheerY(6) - 1, P.rope[3]);
  }
  // lashed to the masthead
  const ly = MAST_TOP + 2;
  for (let k = -1; k <= 2; k++) put(b, mx + k, ly, P.rope[4]);
  // Jenna's pennant: pink, with a white cat face
  const fy = MAST_TOP - 1;
  for (let x = 1; x <= 11; x++) {
    const wav = Math.round(Math.sin(x * 0.7 + frame * 1.6) * (x / 11) * 1.5);
    const h = Math.round(5 - x * 0.36);
    for (let y = 0; y < h; y++) put(b, mx + x, fy + y + wav, y === 0 ? hex('#ff9ac4') : hex('#e876a8'));
  }
  for (const [dx, dy] of [[2, 1], [4, 1], [2, 2], [3, 2], [4, 2], [3, 3]]) put(b, mx + dx, fy + dy + Math.round(Math.sin(dx * 0.7 + frame * 1.6) * (dx / 11) * 1.5), hex('#fff4f8'));
  put(b, mx, MAST_TOP - 1, P.varnish[6]);
  outlineAll(b);
  return spr(b);
}
function distSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1;
  const t = clamp(((px - ax) * vx + (py - ay) * vy) / L2);
  return Math.hypot(px - ax - vx * t, py - ay - vy * t);
}
/** woven harakeke, gold-green, dark to light */
const SAIL = [hex('#4a4224'), hex('#6e6232'), hex('#928240'), hex('#b4a052'), hex('#cebc6c'), hex('#e4d494')];

// ------------------------------------------------------------------ the boatyard
/** everything at the boatyard for a stage: chocks, the hull, the outboard tilted up, the furled rig */
export function kittenCamp(stage: number): Spr {
  const parts: Spr[] = [chocks()];
  if (stage >= 5) parts.push(sailRig('furled'));
  parts.push(kittenHull(stage, 'all'));
  if (stage >= 4) parts.push(outboard('up'));
  return stack(parts);
}
/** run up a beach at the far end of a trip: rig furled, the outboard tilted up out of the sand */
export function kittenBeached(): Spr {
  return stack([sailRig('furled'), kittenHull(6, 'all'), outboard('up')]);
}
/** driftwood chocks under the keel and the float */
function chocks(): Spr {
  const b = mk();
  for (const cx of [28, 74]) {
    const y0 = Math.round(keelY(cx)) - 1;
    for (let y = y0; y <= y0 + 5; y++) for (let x = cx - 7; x <= cx + 7; x++) put(b, x, y, rq(P.teak, 4.6 - (y - y0) * 0.6 + dz(x, y, 0.8)));
  }
  outlineAll(b);
  return spr(b);
}

/** the tender as found: upside down in a mound of sand, the keel and the boot stripe showing */
export function buriedTender(): Spr {
  const hull = kittenHull(1, 'front').buf;
  const W = KL + 30, H = 34;
  const b = new PixelBuffer(W, H);
  const SAND = [hex('#b08a58'), hex('#caa46c'), hex('#e0c088'), hex('#f0d8a2')];
  for (let x = 0; x < KL; x++) for (let ly = 12; ly <= 36; ly++) {
    const c = hull.get(x + MX, ly + MT);
    if (!(c >>> 24)) continue;
    const y = 36 - ly + 6; // keel up
    if (y >= 0 && y < H) b.set(x + 15, y, c);
  }
  // sand drifted over the gunwale, with ripples
  for (let x = 0; x < W; x++) {
    const u = x / W;
    const m = 21 - Math.sin(u * Math.PI) * 4 + Math.sin(x * 0.21) * 0.8 + (noise1(x / 9, 71) - 0.5) * 2;
    for (let y = Math.round(m); y < H; y++) {
      const d = y - m;
      let c = SAND[clamp(3 - Math.floor(d / 4 + dz(x, y)), 0, 3)];
      if (Math.sin(x * 0.6 + y * 1.3) > 0.93) c = SAND[1];
      b.set(x, y, c);
    }
  }
  b.outline((c: C) => mix(shade(c, -0.6), OL, 0.5));
  return { buf: b, ax: Math.round(W / 2), ay: H - 3 };
}

const kitObj = (w: number, h: number, ax: number, ay: number, draw: (b: PixelBuffer) => void): Spr => {
  const b = new PixelBuffer(w, h);
  draw(b);
  b.outline((c: C) => mix(shade(c, -0.7), OL, 0.6));
  return { buf: b, ax, ay };
};
/** n salvaged planks stacked on the sand */
export function plankStack(n: number): Spr {
  n = Math.max(1, Math.min(6, n));
  return kitObj(44, 4 + n * 3, 22, 3 + n * 3, b => {
    for (let i = 0; i < n; i++) {
      const y = 1 + (n - 1 - i) * 3, x0 = 1 + (i % 2) * 3, x1 = 42 - ((i + 1) % 2) * 4;
      for (let x = x0; x <= x1; x++) { b.set(x, y, (x + i * 7) % 11 === 0 ? P.cream[3] : P.cream[5]); b.set(x, y + 1, P.wood[5]); b.set(x, y + 2, P.wood[3]); }
      b.set(x0, y + 1, P.wood[7]); b.set(x1, y + 1, P.wood[2]);
    }
  });
}
/** golden lumps of kauri gum on a broad leaf */
export function gumLeaf(n = 2): Spr {
  return kitObj(20, 9, 10, 8, b => {
    b.ellipseFn(10, 6, 9, 2.4, (x, y) => (y < 6 ? hex('#5a8a3a') : hex('#3c6a2a')));
    for (let i = 0; i < Math.min(3, n); i++) b.ellipseFn(5 + i * 5, 4, 2.4, 1.9, (x, y, nx, ny) => (nx < -0.2 && ny < -0.2 ? hex('#ffe08a') : ny > 0.4 ? hex('#b06a14') : hex('#e09a2a')));
  });
}
/** a bundle of cut harakeke leaves, tied */
export function flaxBundle(n = 3): Spr {
  return kitObj(34, 9, 17, 7, b => {
    const cols = [hex('#3c6a2a'), hex('#4e7e32'), hex('#62923c'), hex('#4a7430'), hex('#5a8a36'), hex('#6a9a40')];
    for (let i = 0; i < Math.min(6, n + 1); i++) for (let x = 1; x < 33; x++) {
      const y = 2 + Math.min(5, i) + Math.round(Math.sin(x * 0.2 + i) * 0.6) - (x > 28 ? 1 : 0);
      b.set(x, y, cols[i]);
    }
    for (let y = 1; y < 9; y++) { b.set(16, y, P.rope[4]); b.set(17, y, P.rope[2]); }
  });
}
/** the ama log lying on the sand by the boat, before it is lashed on */
export function amaLog(): Spr {
  const b = mk();
  paintAma(b, 0);
  outlineAll(b);
  return spr(b);
}
/** the outboard clamped on a driftwood sawhorse while Jenna works on it */
export function sawhorseMotor(motor = true): Spr {
  const W = 44, H = 56;
  const b = new PixelBuffer(W, H);
  for (const [x0, x1] of [[8, 14], [32, 26]] as const) for (let y = 20; y < 54; y++) { const x = Math.round(x0 + (x1 - x0) * ((y - 20) / 34)); b.set(x, y, P.teak[4]); b.set(x + 1, y, P.teak[2]); }
  for (let x = 6; x < 36; x++) { b.set(x, 19, P.teak[5]); b.set(x, 20, P.teak[3]); b.set(x, 21, P.teak[2]); }
  const m = outboard('down', 0).buf;
  const top = Math.round(sheerY(0));
  // (bare while someone carries the motor over to the transom)
  if (motor) for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const c = m.data[y * m.w + x];
    if (!(c >>> 24)) continue;
    const X = x - MX + 24, Y = y - (MT + top) + 20;
    if (X >= 0 && X < W && Y >= 0 && Y < H) b.data[Y * W + X] = c;
  }
  return { buf: b, ax: 20, ay: 54 };
}
/** the sail on Aroha's weaving pegs: k 0..1 of the way done */
export function weaveMat(k: number): Spr {
  return kitObj(56, 12, 28, 10, b => {
    const done = Math.round(4 + clamp(k) * 48);
    for (let x = 2; x < 54; x++) for (let y = 2; y < 10; y++) {
      if (x > done) { if (y % 2 === 0 && hash2(x, y, 3) < 0.75) b.set(x, y, SAIL[3 + ((y >> 1) % 2)]); continue; }
      b.set(x, y, rq(SAIL, 3 + ((((x + y) >> 1) % 2) ? 0.8 : -0.6) + ((x - y * 2 + 40) % 7 === 0 ? -1.2 : 0)));
    }
    for (const x of [1, 54]) for (let y = 0; y < 12; y++) b.set(x, y, P.teak[3]);
  });
}
/** Jenna's sign on a stake: KITTEN BOATWORKS */
export function yardSign(): Spr {
  const t1 = 'KITTEN', t2 = 'BOATWORKS';
  const w = Math.max(textWidth(t1), textWidth(t2)) + 8;
  return kitObj(w + 2, 30, Math.round(w / 2), 29, b => {
    for (let y = 1; y < 15; y++) for (let x = 1; x < w + 1; x++) b.set(x, y, rq(P.teak, 5 - (y % 4 === 0 ? 1 : 0) + dz(x, y, 0.6)));
    pixelText(b, t1, Math.round((w + 2 - textWidth(t1)) / 2), 2, hex('#c8306e'));
    pixelText(b, t2, Math.round((w + 2 - textWidth(t2)) / 2), 8, P.navy[2]);
    for (let y = 15; y < 30; y++) { b.set(Math.round(w / 2), y, P.teak[4]); b.set(Math.round(w / 2) + 1, y, P.teak[2]); }
  });
}

/** debug: every sprite on one canvas */
export function debugSheet(S = 3): HTMLCanvasElement {
  const list: Spr[] = [buriedTender(), ...[1, 2, 3, 4, 5].map(s => kittenCamp(s)), stack([kittenHull(6, 'back'), sailRig('set', 1, 0), kittenHull(6, 'front'), outboard('down', 1)]),
    sailRig('set', 0.4, 2), plankStack(3), gumLeaf(2), flaxBundle(3), amaLog(), sawhorseMotor(), weaveMat(0.5), yardSign()];
  const pad = 6, W = 1500;
  let x = pad, y = pad, rowH = 0;
  const pos: [number, number][] = [];
  for (const s of list) {
    if (x + s.buf.w * S > W) { x = pad; y += rowH + pad; rowH = 0; }
    pos.push([x, y]);
    x += s.buf.w * S + pad;
    rowH = Math.max(rowH, s.buf.h * S);
  }
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = y + rowH + pad;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#7aa6b8'; g.fillRect(0, 0, cv.width, cv.height);
  g.imageSmoothingEnabled = false;
  list.forEach((s, i) => g.drawImage(s.buf.toCanvas(S), pos[i][0], pos[i][1]));
  return cv;
}

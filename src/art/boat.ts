// art/boat.ts: the research boat Kittiwake: exterior, dollhouse cutaway, storm variant, wreck, debris.
//
// A sturdy old wooden expedition trawler turned research boat: cream carvel-planked topsides with
// caulked seams and fastening lines, a steel-shod rubbing strake and a lower belting, red boot
// stripe over dark blue-green antifouling (weed, slime and barnacles along the waterline),
// weathered varnished cap rail, raised wheelhouse with teak-framed windows, foremast with
// crosstrees, radar reflector and nav lights, stern davit, lifebuoys, tyre fenders, rope coils,
// a stockless anchor in its hawse and a small Union Jack at the stern.
//
// Coordinates: every sprite and BOAT_LAYOUT use BOAT-LOCAL pixels with the origin at the TOP-LEFT
// of the boat sprite (BOAT_W x BOAT_H = 600 x 236). The bow points to +x. The static waterline is
// y = 206 and the rocking pivot is (300, 206) (sprites are anchored there: ax = 300, ay = 206).
// Draw a boat sprite with its anchor at the world point where the pivot should be, rotated by the
// pitch angle; boat-local points map to world as world = pivotWorld + R(rot) * (local - pivot).
//
// API
//   export interface Sprite { buf: PixelBuffer; ax: number; ay: number; glow?: PixelBuffer }
//   export interface ExteriorSprite extends Sprite { back: PixelBuffer; front: PixelBuffer }
//   export const BOAT_W, BOAT_H, WATERLINE
//   export function paintBoatExterior(o?: { storm?: boolean }): ExteriorSprite
//        buf = full side view; back/front split it around deck-level actors (front = near bulwark);
//        glow = emissive windows and lamps (draw with r.emissive(1) or additively at night/storm)
//   export function paintBoatCutaway(o?: { storm?: boolean }): { back: Sprite; front: Sprite; glow: PixelBuffer }
//        back: hull interior, walls, floors, furniture (behind actors); front: near railing, table top,
//        cut edges (over actors). Window glass in `back` is translucent so the sky/sea shows through.
//   export const BOAT_LAYOUT: BoatLayout   // floors, ladders, named spots, lamps, cutLine, mounts...
//   export function paintBoatParts(o?): BoatParts   // animated / movable pieces (wheel, radar, flag, crates...)
//   export function paintWreck(): Sprite    // ~520 x 280, broken on shore rocks (anchor bottom-centre)
//   export function paintDebris(kind: DebrisKind, seed: number): Sprite
//   export const DEBRIS_KINDS: DebrisKind[]

import { PixelBuffer } from './pixel';
import { C, hex, mix, rgba, shade, withAlpha, A as alphaOf } from './color';
import { Rng, bayer, clamp, fbm2, hash2, noise1, noise2, smoothstep } from '../core/math';
import {
  BOAT_W, BOAT_H, WATERLINE, PIVOT, KEEL, P, OL, OLc, deckY, sheerY, STERN_X, BOW_X, hullMask,
  WH_X0, WH_X1, WH_FLOOR, WH_CEIL, WH_ROOF, LOW_FLOOR, HOLD_FLOOR, BH, lowCeil,
  ramp, dith, vline, hline, rope, rope2, ring, lifebuoy, tyre, porthole, pixelText, textWidth, tint,
} from './boatKit';
import { paintInterior } from './boatInterior';

export { BOAT_W, BOAT_H, WATERLINE, deckY };

export interface Sprite {
  buf: PixelBuffer;
  ax: number;
  ay: number;
  glow?: PixelBuffer;
}
export interface ExteriorSprite extends Sprite {
  back: PixelBuffer;
  front: PixelBuffer;
}

// ------------------------------------------------------------------ layout

export interface BoatLayout {
  origin: string;
  w: number;
  h: number;
  waterline: number;
  pivot: [number, number];
  /** walkable polylines (boat-local), one per deck/room level; y = where feet stand */
  floors: { name: string; pts: [number, number][] }[];
  ladders: { x: number; y0: number; y1: number; name: string }[];
  spots: Record<string, [number, number]>;
  lamps: { x: number; y: number; color: [number, number, number]; radius: number; name: string }[];
  /** rooms (boat-local rects) for camera framing / interior light */
  rooms: Record<string, { x0: number; y0: number; x1: number; y1: number }>;
  /** cutaway: the ocean's near band must not draw above this polyline (pass it to ocean.setMask) */
  cutLine: [number, number][];
  /** attachment points of the animated parts from paintBoatParts() */
  mounts: Record<string, [number, number]>;
}

const deckPts = (x0: number, x1: number, step = 12): [number, number][] => {
  const out: [number, number][] = [];
  for (let x = x0; x < x1; x += step) out.push([x, Math.round(deckY(x))]);
  out.push([x1, Math.round(deckY(x1))]);
  return out;
};

export const BOAT_LAYOUT: BoatLayout = {
  origin: 'top-left of the 600x236 boat sprite; bow toward +x; y down; sprites anchored at pivot (300, 206)',
  w: BOAT_W,
  h: BOAT_H,
  waterline: WATERLINE,
  pivot: PIVOT,
  floors: [
    // main deck, stern to bow, up the aft stair, through the raised wheelhouse, down the fore stair
    { name: 'deck', pts: [...deckPts(30, 192), [212, WH_FLOOR], [WH_X1 + 2, WH_FLOOR], ...deckPts(356, 540)] },
    // lower deck: engine room, galley & mess, bunk room (one level), step up into the cargo hold
    { name: 'lower', pts: [[BH.engAft + 4, LOW_FLOOR], [BH.bunkHold + 4, LOW_FLOOR], [BH.bunkHold + 10, HOLD_FLOOR], [BH.holdFwd - 2, HOLD_FLOOR]] },
  ],
  ladders: [
    { name: 'engineHatch', x: 113, y0: Math.round(deckY(113)), y1: LOW_FLOOR },
    { name: 'companionway', x: 224, y0: WH_FLOOR, y1: LOW_FLOOR },
    { name: 'foreHatch', x: 462, y0: Math.round(deckY(462)), y1: HOLD_FLOOR },
  ],
  spots: {
    helm: [288, WH_FLOOR],
    wheelhouseDoor: [WH_X0 + 3, WH_FLOOR],
    wheelhouseDoorFwd: [WH_X1 - 3, WH_FLOOR],
    radio: [250, WH_FLOOR],
    chart: [264, WH_FLOOR],
    lookoutBow: [530, Math.round(deckY(530))],
    stern: [36, Math.round(deckY(36))],
    hatch: [113, Math.round(deckY(113))],
    foreHatch: [462, Math.round(deckY(462))],
    companionway: [224, WH_FLOOR],
    crate1: [148, Math.round(deckY(148))],
    crate2: [174, Math.round(deckY(174))],
    crate3: [386, Math.round(deckY(386))],
    mast: [424, Math.round(deckY(424))],
    stove: [247, LOW_FLOOR],
    galley: [268, LOW_FLOOR],
    table: [308, LOW_FLOOR],
    seat1: [296, 183],
    seat2: [320, 183],
    bunk: [372, 182],
    bunkTop: [372, 158],
    engine: [166, LOW_FLOOR],
    workbench: [92, LOW_FLOOR],
    hold: [446, HOLD_FLOOR],
  },
  lamps: [
    { name: 'wheelhouse', x: 276, y: 32, color: [1, 0.82, 0.55], radius: 72 },
    { name: 'galley', x: 247, y: 130, color: [1, 0.78, 0.5], radius: 60 },
    { name: 'mess', x: 308, y: 134, color: [1, 0.8, 0.52], radius: 56 },
    { name: 'bunks', x: 380, y: 130, color: [1, 0.74, 0.48], radius: 50 },
    { name: 'engine', x: 150, y: 130, color: [0.95, 0.92, 0.75], radius: 64 },
    { name: 'hold', x: 452, y: 124, color: [1, 0.86, 0.62], radius: 46 },
    { name: 'deckFlood', x: 432, y: 60, color: [1, 0.96, 0.86], radius: 86 },
    { name: 'masthead', x: 424, y: 7, color: [1, 1, 0.95], radius: 26 },
    { name: 'sternLight', x: 27, y: 87, color: [1, 1, 0.9], radius: 18 },
  ],
  rooms: {
    wheelhouse: { x0: WH_X0, y0: WH_CEIL, x1: WH_X1, y1: WH_FLOOR },
    galley: { x0: BH.engGal + 6, y0: 122, x1: BH.galBunk, y1: LOW_FLOOR },
    bunks: { x0: BH.galBunk + 6, y0: 122, x1: BH.bunkHold, y1: LOW_FLOOR },
    engine: { x0: BH.engAft, y0: 122, x1: BH.engGal, y1: LOW_FLOOR },
    hold: { x0: BH.bunkHold + 6, y0: lowCeil(460), x1: BH.holdFwd, y1: HOLD_FLOOR },
    deckAft: { x0: 26, y0: 40, x1: WH_X0, y1: 116 },
    deckFore: { x0: WH_X1, y0: 20, x1: 552, y1: 116 },
  },
  cutLine: [[26, 186], [56, 206], [BH.engAft, 207], [BH.holdFwd, 207], [506, 204], [526, 188], [546, 150], [556, 110]],
  mounts: {
    wheel: [306, 66],
    radar: [292, 8],
    flag: [23, 62],
    funnel: [227, 2],
    lampGalley: [247, 123],
    lampMess: [308, 123],
    lampBunks: [380, 122],
    lampEngine: [150, 123],
    lampHold: [452, 117],
    lampWheelhouse: [276, WH_CEIL + 1],
    stovePot: [240, 176],
    kettle: [254, 176],
  },
};

// ------------------------------------------------------------------ exterior

interface PaintOpts { storm?: boolean }

/** Exterior portholes along the lower deck. */
const PORTHOLES: [number, number][] = [[92, 146], [272, 146], [318, 146], [388, 140], [446, 142]];
/** Tyre fenders hanging on the topsides. */
const FENDERS = [146, 258, 358];
/** Shroud chainplates on the sheer. */
const CHAINPLATES = [386, 398, 452];

const bootTop = (x: number) => 195 - smoothstep(470, 540, x) * 3 - smoothstep(80, 34, x) * 2;
const bootBot = (x: number) => bootTop(x) + 8;
const PLANKS = 11;
/** Strake index at (x, y) on the topsides: planks are lofted between the rub rail and the boot top, so they sweep with the sheer. */
function plankIndex(x: number, y: number) {
  const top = deckY(x) + 5, bot = bootTop(x) - 3;
  return Math.floor(((y - top) / (bot - top)) * PLANKS);
}
/** y of the seam above strake i at column x. */
function seamY(x: number, i: number) {
  const top = deckY(x) + 5, bot = bootTop(x) - 3;
  return top + (i / PLANKS) * (bot - top);
}
const BELT = 5; // the lower belting runs along the seam above strake 5, just under the portholes

/** Hull topsides, rubbing strakes, boot stripe, bottom paint, planking and weathering. */
function paintHullSkin(b: PixelBuffer, rng: Rng) {
  const M = hullMask();
  for (let y = 0; y < BOAT_H; y++)
    for (let x = 0; x < BOAT_W; x++) {
      if (!M.at(x, y)) continue;
      const dk = deckY(x);
      const sh = sheerY(x);
      const b0 = bootTop(x), b1 = bootBot(x);
      let c: C;
      if (y < dk + 1) {
        // bulwark: bright cream, one seam, the stanchions showing as faint vertical ribs
        let f = 5.3 - (y - sh) * 0.05;
        if ((Math.round(x) - 30) % 22 === 0 && y > sh + 3) f -= 0.7;
        if ((Math.round(x) - 30) % 22 === 1 && y > sh + 3) f += 0.3;
        if (Math.round(y) === Math.round(sh + 8)) f -= 1.1;
        if (Math.round(y) === Math.round(sh + 9)) f += 0.3;
        c = ramp(P.cream, f + dith(x, y, 0.3));
      } else if (y < b0 - 2) {
        // carvel strakes: lit under the rail, rolling into shadow toward the turn of the bilge,
        // a little bounce light off the water just above the boot top
        const t = (y - dk) / (b0 - dk);
        const bowFlare = smoothstep(440, 540, x) * (0.7 - t * 1.3);
        const sternTurn = smoothstep(90, 30, x) * -0.4;
        let f = 5.1 - t * 1.1 - smoothstep(0.5, 1, t) * 1.5 + bowFlare + sternTurn + smoothstep(0.9, 1, t) * 0.7;
        const pi = plankIndex(x, y);
        const seam = pi !== plankIndex(x, y - 1) && y > dk + 5;
        const underSeam = !seam && pi !== plankIndex(x, y - 2) && y > dk + 6;
        const overSeam = pi !== plankIndex(x, y + 1);
        // each strake takes the paint a little differently, with a slow mottle along its length
        f += (hash2(pi, 3, 7) - 0.5) * 0.22 + (noise1(x * 0.045 + pi * 7.3, 5) - 0.5) * 0.3;
        const butt = (x + pi * 53) % 97;
        c = ramp(P.cream, f + dith(x, y, 0.32));
        if (seam) {
          // caulked seam: a dark line with the odd lighter blob of seam compound
          c = hash2(x >> 1, pi, 11) > 0.92 ? ramp(P.cream, f - 0.6) : mix(ramp(P.cream, f - 2.1), P.wood[2], 0.25);
        } else if (underSeam) c = ramp(P.cream, f + 0.5 + dith(x, y, 0.3));
        else if (overSeam) c = ramp(P.cream, f - 0.45 + dith(x, y, 0.3));
        if (!seam && pi >= 0 && butt === 0) c = mix(c, ramp(P.cream, f - 1.6), 0.6);
        // fastening dots (bronze screws under paint) on every frame, two per strake
        if (!seam && pi >= 0 && (x - 30) % 22 === 0) {
          const s0 = seamY(x, pi), s1 = seamY(x, pi + 1);
          const r = Math.round(y);
          if (r === Math.round(s0 + (s1 - s0) * 0.5)) c = mix(c, ramp(P.cream, f - 1.4), 0.55);
        }
      } else if (y < b0) {
        // cove line: a navy pinstripe with a cream line under it, then the boot stripe
        c = y < b0 - 1 ? P.navy[3] : P.cream[4];
      } else if (y < b1) {
        const t = (y - b0) / (b1 - b0);
        c = ramp(P.red, 3.9 - t * 1.9 + dith(x, y, 0.3) + (noise1(x * 0.08, 9) - 0.5) * 0.4);
        if (y - b0 < 1) c = P.red[5];
      } else {
        const t = (y - b1) / (KEEL - b1);
        c = ramp(P.bottom, 3.6 - t * 2.6 + dith(x, y, 0.35) + (noise2(x * 0.1, y * 0.2, 4) - 0.5) * 0.7);
        if (y - b1 < 1) c = P.bottom[5];
      }
      b.set(x, y, c);
    }
  // rubbing strake at deck level: varnished oak shod with a steel half-round; cap rail on the sheer
  for (let x = STERN_X; x <= BOW_X; x++) {
    const dk = Math.round(deckY(x)), sh = Math.round(sheerY(x));
    if (!M.at(x, dk + 4)) continue;
    const scarf = (x - 20) % 64 === 0;
    b.set(x, dk + 1, scarf ? P.varnish[3] : P.varnish[5]);
    b.set(x, dk + 2, (x + 3) % 40 === 0 ? P.metal[5] : P.metal[7]);
    b.set(x, dk + 3, P.metal[4]);
    b.set(x, dk + 4, scarf ? P.varnish[1] : P.varnish[3]);
    b.set(x, dk + 5, P.cream[2]);
    if (M.at(x, dk + 6)) tint(b, x, dk + 6, P.cream[2], 0.4);
    // screw heads through the steel band
    if ((x - 30) % 22 === 11) b.set(x, dk + 2, P.metal[3]);
    b.set(x, sh - 1, (x - 8) % 48 === 0 ? P.varnish[4] : P.varnish[6]);
    b.set(x, sh, P.varnish[5]);
    b.set(x, sh + 1, P.varnish[3]);
    b.set(x, sh + 2, P.cream[2]);
    // lower belting along the seam above strake BELT
    const by = Math.round(seamY(x, BELT));
    if (M.at(x, by + 2) && x > 34 && x < 540) {
      b.set(x, by - 1, mix(b.get(x, by - 1), P.cream[6], 0.35));
      b.set(x, by, P.varnish[5]);
      b.set(x, by + 1, P.varnish[3]);
      b.set(x, by + 2, mix(b.get(x, by + 2), P.cream[1], 0.5));
    }
  }
  // freeing ports in the bulwark, with a hinged flap and a rust streak under each
  for (const fx of [62, 182, 372, 476]) {
    const dk = Math.round(deckY(fx));
    b.rect(fx, dk - 4, 7, 3, P.bottom[0]);
    hline(b, fx + 1, fx + 6, dk - 2, P.bottom[1]);
    hline(b, fx - 1, fx + 7, dk - 5, P.metal[4]);
    b.set(fx - 1, dk - 5, P.metal[6]);
    b.set(fx + 1, dk - 5, P.metal[2]); b.set(fx + 5, dk - 5, P.metal[2]);
    rustStreak(b, fx + 2, dk + 6, rng.int(10, 22), rng);
    rustStreak(b, fx + 5, dk + 6, rng.int(5, 12), rng);
  }
  // scupper and bilge outlets: small lipped holes with a dirty-water stain running down
  for (const [sx, dy] of [[104, 9], [236, 8], [330, 9], [416, 8], [508, 10]] as const) {
    const y = Math.round(deckY(sx)) + dy;
    b.rect(sx, y, 3, 2, P.metal[0]);
    hline(b, sx - 1, sx + 3, y - 1, P.cream[6]);
    hline(b, sx, sx + 2, y + 2, P.cream[2]);
    for (let k = 3; k < 16 + (sx % 7); k++) tint(b, sx + 1 + (k > 9 ? 1 : 0), y + k, P.grime[3], 0.3 * (1 - k / 22));
  }
  // chainplates for the shrouds: bolted bronze straps with a green-brown weep under them
  for (const cx of CHAINPLATES) {
    const sh = Math.round(sheerY(cx));
    for (let y = sh - 1; y < sh + 15; y++) {
      b.set(cx - 1, y, P.brass[y < sh + 1 ? 5 : 3]);
      b.set(cx, y, P.brass[y < sh + 1 ? 4 : 2]);
    }
    for (const by of [sh + 3, sh + 8, sh + 13]) { b.set(cx - 1, by, P.brass[6]); b.set(cx, by, P.brass[0]); }
    for (let k = 0; k < 12; k++) tint(b, cx - 1 + (k > 6 ? 1 : 0), sh + 15 + k, P.moss[3], 0.5 * (1 - k / 12));
  }
  // stem band: a steel strip shoeing the cutwater
  for (let y = 98; y < 206; y++) {
    let xe = -1;
    for (let x = BOAT_W - 1; x > 420; x--) if (M.at(x, y)) { xe = x; break; }
    if (xe < 0) continue;
    b.set(xe, y, P.metal[y % 9 === 0 ? 7 : 5]);
    b.set(xe - 1, y, P.metal[3]);
  }
  // draught marks: white figures up the stem and the stern quarter
  for (const [dx, marks] of [[508, [['6', 186], ['4', 196], ['2', 206]]], [44, [['6', 184], ['4', 194]]]] as const) {
    for (const [d, y] of marks) {
      const x = dx - (y - 186) * (dx > 300 ? 0.55 : -0.3);
      const onPaint = y + 5 < bootTop(x);
      if (M.at(Math.round(x), y) && M.at(Math.round(x) + 4, y + 4)) pixelText(b, d, Math.round(x), y, onPaint ? P.navy[1] : P.white[4], onPaint ? undefined : P.bottom[0]);
    }
  }
  // transom edge
  for (let y = Math.round(sheerY(STERN_X)); y < 186; y++) if (M.at(STERN_X + 1, y)) { b.set(STERN_X + 1, y, P.cream[2]); b.set(STERN_X + 2, y, P.cream[3]); }
  // barnacle clusters and weed along the waterline, thickest at the bow and stern
  for (let i = 0; i < 60; i++) {
    const x = i < 16 ? rng.range(36, 120) : i < 36 ? rng.range(440, 530) : rng.range(120, 440);
    const cy = WATERLINE - 6 + rng.range(-1, 5);
    const n = rng.int(3, 9);
    for (let k = 0; k < n; k++) {
      const px = Math.round(x + rng.range(-3, 3)), py = Math.round(cy + rng.range(-2, 2));
      if (!M.at(px, py)) continue;
      const v = rng.next();
      b.set(px, py, v < 0.35 ? P.white[3] : v < 0.75 ? P.white[1] : P.white[0]);
      if (v < 0.2) b.set(px + 1, py, P.white[2]);
    }
    if (rng.chance(0.6)) {
      const wx = Math.round(x + rng.range(-4, 4));
      const L = rng.int(2, 7);
      for (let k = 0; k < L; k++) if (M.at(wx, cy + 3 + k)) b.set(wx + (k > 2 ? 1 : 0), cy + 3 + k, P.green[k < 2 ? 3 : 2]);
    }
  }
  // waterline slime: a mottled green-brown band where the boat sits, creeping up into the boot stripe
  for (let x = 30; x < 530; x++) {
    const ends = Math.max(smoothstep(140, 40, x), smoothstep(400, 520, x));
    for (let y = WATERLINE - 8; y < WATERLINE + 6; y++) {
      if (!M.at(x, y)) continue;
      const n = noise2(x * 0.14, y * 0.3, 21);
      const band = smoothstep(WATERLINE - 7 - ends * 3, WATERLINE - 1, y) * (1 - smoothstep(WATERLINE + 1, WATERLINE + 6, y));
      const k = band * (0.15 + n * 0.45 + ends * 0.15);
      if (k > 0.22) tint(b, x, y, n > 0.6 ? P.moss[3] : P.grime[2], Math.min(0.55, k));
    }
    // algae streaks hanging up the stripe in drips
    if (hash2(x, 1, 31) > 0.9) {
      const L = 2 + Math.floor(hash2(x, 2, 31) * (3 + ends * 4));
      for (let k = 0; k < L; k++) tint(b, x, WATERLINE - 3 - k, P.moss[4], 0.45 * (1 - k / L));
    }
  }
  // chipped paint near the bow and waterline: primer showing through with a dark bruise edge
  for (let i = 0; i < 34; i++) {
    const x = Math.round(rng.chance(0.6) ? rng.range(470, 540) : rng.range(40, 470));
    const y = Math.round(rng.range(126, 192));
    if (!M.at(x, y) || !M.at(x + 3, y)) continue;
    const w = rng.int(1, 3);
    for (let k = 0; k < w; k++) b.set(x + k, y, k === 0 ? P.cream[1] : P.wood[4]);
    b.set(x + w, y, P.cream[2]);
    if (w > 1) b.set(x + 1, y + 1, P.cream[2]);
  }
  // salt and grime streaks weeping from under the rubbing strake
  for (let i = 0; i < 56; i++) {
    const x = Math.round(rng.range(34, 540));
    const y0 = deckY(x) + 6;
    const L = rng.int(6, 30);
    const dark = rng.chance(0.55);
    for (let k = 0; k < L; k++) {
      if (!M.at(x, y0 + k) || y0 + k > 190) break;
      tint(b, x, y0 + k, dark ? P.cream[1] : P.cream[6], (dark ? 0.2 : 0.3) * (1 - k / L));
    }
  }
  // general grime toward the turn of the bilge and at the stern quarter
  for (let y = 120; y < 195; y++) for (let x = 26; x < 552; x++) {
    if (!M.at(x, y) || y > bootTop(x) - 3) continue;
    const n = fbm2(x * 0.03, y * 0.08, 3, 17);
    const k = smoothstep(150, 194, y) * 0.1 + smoothstep(90, 30, x) * 0.1 + (n - 0.58) * 0.22;
    if (k > 0.05) tint(b, x, y, P.grime[3], Math.min(0.2, k));
  }
}

function rustStreak(b: PixelBuffer, x: number, y: number, L: number, rng: Rng) {
  let xx = x;
  for (let k = 0; k < L; k++) {
    const t = k / L;
    const cur = b.get(xx, y + k);
    if (!alphaOf(cur)) break;
    b.set(xx, y + k, mix(cur, P.rust[t < 0.3 ? 3 : 2], 0.75 * (1 - t) + 0.1));
    if (t < 0.4 && rng.chance(0.5)) b.set(xx + 1, y + k, mix(b.get(xx + 1, y + k), P.rust[2], 0.4 * (1 - t)));
    if (rng.chance(0.08)) xx += rng.chance(0.5) ? 1 : -1;
  }
}

/** Rudder, propeller and skeg under the counter. */
function paintRunningGear(b: PixelBuffer) {
  // skeg: the keel carried aft to support the rudder heel, with a steel shoe
  for (let x = 38; x < 114; x++) {
    b.set(x, KEEL, P.metal[2]);
    b.set(x, KEEL - 1, x < 60 ? P.bottom[1] : P.bottom[2]);
  }
  // sternpost
  b.rectFn(64, 206, 4, 24, (x, y) => ramp(P.bottom, 2.6 - (x - 64) * 0.4 + dith(x, y, 0.3)));
  // rudder blade hung under the counter, rounded trailing edge, pintles and a zinc anode
  b.polyFn([40, 196, 55, 198, 57, 228, 42, 228, 38, 222, 37, 204], (x, y) => ramp(P.bottom, 3.4 - (y - 196) * 0.05 - (x - 37) * 0.07 + dith(x, y, 0.4)));
  vline(b, 55, 199, 227, P.bottom[0]);
  vline(b, 39, 205, 220, P.bottom[5]);
  for (const py of [202, 214, 225]) { hline(b, 54, 58, py, P.metal[4]); b.set(54, py, P.metal[6]); }
  b.rect(45, 212, 4, 3, P.metal[5]);
  b.set(45, 212, P.metal[7]);
  b.rect(46, 194, 5, 3, P.metal[3]);
  // propeller in the aperture (two blades side on) with boss and shaft
  b.polyFn([59, 204, 63, 204, 63, 213, 59, 213], (x, y) => ramp(P.brass, 4 - (y - 204) * 0.2 + dith(x, y, 0.4)));
  b.polyFn([59, 217, 63, 217, 64, 227, 58, 227], (x, y) => ramp(P.brass, 2.8 - (y - 217) * 0.12 + dith(x, y, 0.4)));
  b.rect(58, 213, 7, 4, P.brass[2]);
  hline(b, 58, 64, 213, P.brass[4]);
  vline(b, 60, 205, 211, P.brass[6]);
}

/** A window of the wheelhouse seen from outside: teak frame, gasket, sky and sea reflections, glints, parked wiper. */
function wheelhouseWindow(b: PixelBuffer, wx: number, wy: number, ww: number, wh: number, wiper: number) {
  // eyebrow drip rail
  hline(b, wx - 3, wx + ww + 2, wy - 4, P.varnish[5]);
  hline(b, wx - 3, wx + ww + 2, wy - 3, P.varnish[2]);
  // frame, 2px, lit from the top-left, rounded corners
  b.rectFn(wx - 2, wy - 2, ww + 4, wh + 4, (x, y) => {
    const cx = x < wx ? 0 : x >= wx + ww ? 2 : 1, cy = y < wy ? 0 : y >= wy + wh ? 2 : 1;
    if (cx === 1 && cy === 1) return -1;
    if ((x === wx - 2 || x === wx + ww + 1) && (y === wy - 2 || y === wy + wh + 1)) return -1;
    const top = cy === 0, left = cx === 0, outer = x === wx - 2 || y === wy - 2 || x === wx + ww + 1 || y === wy + wh + 1;
    let f = top || left ? 5 : 2.4;
    if (outer) f += top || left ? 0.8 : -0.8;
    return ramp(P.varnish, f + dith(x, y, 0.3));
  });
  // corner fixings
  for (const [cx, cy] of [[wx - 1, wy - 1], [wx + ww, wy - 1], [wx - 1, wy + wh], [wx + ww, wy + wh]]) b.set(cx, cy, P.brass[5]);
  // glass
  b.rectFn(wx, wy, ww, wh, (x, y) => {
    const u = (x - wx) / ww, v = (y - wy) / wh;
    if (x === wx || y === wy) return P.metal[1]; // rubber gasket (inner shadow)
    const hz = 0.56;
    let f: number;
    if (v < hz) f = 4.3 - v * 2.4; // sky reflection, bright at the top
    else f = 1.9 - (v - hz) * 1.4; // the darker sea
    if (Math.abs(v - hz) < 0.02) f = 3.6; // horizon glint
    // cloud smear in the sky part
    if (v < hz && noise2(u * 3 + wx, v * 6, 13) > 0.62) f += 0.6;
    // two diagonal glints
    const d = u + v * 0.7;
    if (d > 0.2 && d < 0.3) f += 1.3;
    else if (d > 0.36 && d < 0.39) f += 0.9;
    // dark reflection of the far wall at the bottom
    if (v > 0.88) f -= 0.6;
    return ramp(P.glass, f + dith(x, y, 0.45));
  });
  b.set(wx + 1, wy + 1, P.white[4]);
  b.set(wx + 2, wy + 1, P.glass[5]);
  b.set(wx + 1, wy + 2, P.glass[5]);
  // parked wiper: arm pivot at the bottom, blade lying diagonally
  if (wiper) {
    const px = wx + Math.round(ww / 2), py = wy + wh - 1;
    b.set(px, py + 2, P.metal[5]); b.set(px + 1, py + 2, P.metal[3]);
    rope(b, px, py, px - 11 * wiper, py - 14, 0, P.metal[1]);
    rope(b, px + 1, py, px - 10 * wiper, py - 14, 0, P.metal[3]);
  }
}

/** Wheelhouse exterior shell: walls, windows, trim, roof and roof gear. */
function paintWheelhouseShell(b: PixelBuffer, fine: PixelBuffer, cut: boolean, rng: Rng) {
  const x0 = WH_X0, x1 = WH_X1;
  const top = WH_ROOF;
  const frontTop = x1 + 6; // front wall rakes forward
  const baseY = 116;
  // walls
  if (!cut) {
    b.polyFn([x0, baseY, x0, top + 6, frontTop, top + 6, x1, baseY], (x, y) => {
      const t = (y - top) / (baseY - top);
      let f = 4.8 - t * 1.2 + (x < x0 + 3 ? 0.8 : 0);
      if (x > x1 - 3 + (baseY - y) * ((frontTop - x1) / (baseY - top))) f -= 1;
      // vertical tongue-and-groove boards on the lower wall (groove shadow, lit bead)
      if (y > 72) {
        const k = (x - x0) % 5;
        if (k === 0) f -= 0.8;
        else if (k === 1) f += 0.35;
        f += (hash2(Math.floor((x - x0) / 5), 1, 5) - 0.5) * 0.3;
      }
      // soft shadow under the roof overhang
      if (y < top + 11) f -= (top + 11 - y) * 0.12;
      return ramp(P.cream, f + dith(x, y, y < top + 11 ? 0.2 : 0.45));
    });
    // corner posts
    for (let y = top + 7; y < baseY; y++) { b.set(x0, y, P.cream[6]); b.set(x0 + 1, y, P.cream[5]); }
    // trim bands
    for (let x = x0; x <= frontTop; x++) {
      const yb = top + 6;
      b.set(x, yb, P.varnish[3]);
      b.set(x, yb + 1, P.varnish[5]);
      b.set(x, yb + 2, P.varnish[2]);
    }
    for (let x = x0; x <= x1 + 1; x++) {
      b.set(x, 69, P.varnish[6]);
      b.set(x, 70, P.varnish[4]);
      b.set(x, 71, P.varnish[2]);
      b.set(x, 72, P.cream[2]);
    }
    // base: a varnished skirting where the house meets the deck
    for (let x = x0; x <= x1; x++) { b.set(x, baseY - 3, P.varnish[5]); b.set(x, baseY - 2, P.varnish[3]); b.set(x, baseY - 1, P.varnish[2]); }
    // three big side windows
    const WX = [228, 260, 292];
    WX.forEach((wx, i) => wheelhouseWindow(b, wx, 34, 26, 30, i === 1 ? 1 : i === 2 ? -1 : 0));
    // rust / tannin weeps from the lower window corners
    for (const wx of WX) for (const cx of [wx, wx + 24]) for (let k = 0; k < 7; k++) tint(b, cx + (k > 3 ? 1 : 0), 67 + k, P.varnish[3], 0.3 * (1 - k / 7));
    void rng;
    // brass grab rail under the windows on stand-off posts
    for (let x = 226; x <= 320; x++) { b.set(x, 75, P.brass[5]); b.set(x, 76, P.brass[2]); }
    for (let x = 228; x <= 320; x += 23) { b.set(x, 77, P.brass[3]); b.set(x, 78, P.brass[1]); }
    // name board: varnished plank with brass letters and bevelled ends
    const nb0 = 234, nb1 = 284, ny = 80;
    b.rectFn(nb0, ny, nb1 - nb0 + 1, 10, (x, y) => {
      if ((x === nb0 || x === nb1) && (y === ny || y === ny + 9)) return -1;
      let f = y === ny ? 6 : y === ny + 9 ? 1.4 : y === ny + 1 ? 5 : 3.6 - (y - ny) * 0.12;
      if (x === nb0 || x === nb1) f -= 1;
      f += (noise1(x * 0.3 + y * 7, 2) - 0.5) * 0.7;
      return ramp(P.varnish, f + dith(x, y, 0.3));
    });
    const tw = textWidth('KITTIWAKE');
    pixelText(b, 'KITTIWAKE', Math.round((nb0 + nb1) / 2 - tw / 2), ny + 3, P.brass[5], P.varnish[1]);
    b.set(nb0 + 2, ny + 5, P.brass[3]); b.set(nb1 - 2, ny + 5, P.brass[3]);
    // lifebuoy on the forward panel hung on two brass hooks, with its grab line
    b.set(321, 75, P.brass[6]); b.set(331, 75, P.brass[6]);
    lifebuoy(b, 326, 85, 7);
    // a vent louvre and the wheelhouse number plate
    for (let k = 0; k < 4; k++) hline(b, 218, 224, 90 + k * 2, P.cream[1]);
    b.rect(217, 89, 9, 1, P.cream[5]);
  }
  // roof slab with sun visor: a lit top edge, a painted fascia and a drip moulding
  b.polyFn([x0 - 5, top, frontTop + 8, top, frontTop + 10, top + 6, x0 - 5, top + 6], (x, y) => {
    const f = y === top ? 5.6 : y === top + 1 ? 4.8 : y === top + 5 ? 1.6 : 3.3 - (y - top) * 0.3;
    return ramp(P.cream, f + dith(x, y, 0.4));
  });
  hline(b, x0 - 5, frontTop + 10, top + 6, P.cream[1]);
  hline(b, x0 - 5, frontTop + 10, top + 7, withAlpha(P.cream[0], 160));
  // roof guard rail: posts and a top rail
  for (let x = x0 - 2; x <= frontTop + 4; x += 14) vline(fine, x, top - 5, top - 1, P.metal[3]);
  for (let x = x0 - 2; x <= frontTop + 4; x++) { fine.set(x, top - 6, P.metal[5]); fine.set(x, top - 5, P.metal[2]); }
  // funnel (exhaust stack) with a rain cap, red band and soot
  b.rectFn(221, 3, 12, top - 3, (x, y) => {
    const f = 4.4 - (x - 221) * 0.25;
    if (y < 6) return ramp(P.metal, 1.6 - (x - 221) * 0.08);
    if (y >= 8 && y < 11) return ramp(P.red, 4 - (x - 221) * 0.25 + dith(x, y));
    if (y === 7 || y === 11) return ramp(P.cream, f - 1.2);
    return ramp(P.cream, f + dith(x, y, 0.5));
  });
  hline(b, 219, 234, 3, P.metal[1]);
  hline(b, 220, 233, 2, P.metal[4]);
  vline(b, 222, 12, top - 1, P.cream[6]);
  for (let y = 6; y < 16; y++) b.set(231, y, mix(b.get(231, y), P.metal[1], 0.55));
  for (let y = 6; y < 12; y++) b.set(230, y, mix(b.get(230, y), P.metal[1], 0.3));
  // life raft canister in its cradle, with straps and a hydrostatic release
  b.rectFn(256, 9, 22, 8, (x, y) => {
    const t = (y - 9) / 7;
    const cap = x < 259 || x > 274;
    const seam = x === 259 || x === 274;
    return ramp(P.white, (seam ? 2 : cap ? 3.4 : 3.8) - t * 2 + dith(x, y, 0.4));
  });
  hline(b, 257, 276, 9, P.white[4]);
  for (const sx of [262, 271]) vline(b, sx, 9, 16, P.orange[3]);
  b.rect(265, 11, 4, 3, P.red[4]);
  b.set(265, 11, P.red[5]);
  for (const x of [258, 275]) vline(b, x, 16, top, P.metal[3]);
  hline(b, 255, 279, top - 1, P.metal[2]);
  // VHF whips with spring bases and tip balls; a GPS mushroom
  for (const [ax, lean] of [[243, -0.08], [250, 0.05]] as const) {
    for (let y = 0; y < top - 3; y++) fine.set(Math.round(ax + (top - y) * lean), y, y < 3 ? P.metal[5] : P.metal[2]);
    b.rect(ax - 1, top - 4, 3, 3, P.metal[2]);
    b.set(ax - 1, top - 4, P.metal[5]);
    fine.set(Math.round(ax + top * lean), 0, P.white[4]);
  }
  b.ellipseFn(283, 13, 3, 2, (x, y, nx, ny) => ramp(P.white, 3.6 - ny * 1.2 - nx * 0.6));
  vline(b, 283, 15, top - 1, P.metal[3]);
  // radar post (scanner is an animated part; frame 0 baked by paintBoatExterior)
  b.rect(290, 9, 5, top - 9, P.metal[4]);
  vline(b, 290, 9, top - 1, P.metal[6]);
  vline(b, 294, 9, top - 1, P.metal[2]);
  b.rect(287, 14, 11, 3, P.metal[3]);
  hline(b, 287, 297, 14, P.metal[5]);
  // brass horn on a bracket
  b.polyFn([312, 12, 320, 10, 320, 15, 312, 14], (x, y) => ramp(P.brass, 4 - (y - 10) * 0.4 + dith(x, y)));
  vline(b, 320, 10, 15, P.brass[6]);
  vline(b, 314, 15, top - 1, P.metal[3]);
  // searchlight on a yoke at the front of the roof, handle behind
  b.rect(330, 9, 9, 7, P.metal[3]);
  b.rect(331, 10, 7, 5, P.metal[5]);
  hline(b, 331, 337, 10, P.metal[6]);
  b.rect(338, 10, 2, 5, P.brass[5]);
  b.set(339, 11, P.white[4]);
  vline(b, 334, 16, top - 1, P.metal[2]);
  hline(b, 326, 330, 12, P.metal[4]);
  // starboard (green) sidelight in its screened box on the forward roof corner
  b.rect(342, 10, 7, 7, P.metal[1]);
  b.rect(343, 11, 5, 4, P.green[2]);
  b.rect(344, 11, 3, 3, hex('#5fe08a'));
  b.set(344, 11, hex('#c8ffd8'));
  hline(b, 342, 348, 10, P.metal[4]);
  vline(b, 345, 17, top - 1, P.metal[2]);
}

/** Foremast with crosstrees, lights, radar reflector, shrouds and halyards. Heavier lines are the standing rigging. */
function paintMastAndRig(b: PixelBuffer, fine: PixelBuffer, storm: boolean, rng: Rng) {
  const mx = 424, base = Math.round(deckY(mx)), top = 8;
  // rigging first (behind the mast): stays are the heaviest lines, shrouds medium, halyards fine
  const tip: [number, number] = [584, 84];
  rope2(fine, mx, top + 2, tip[0], tip[1], 3, P.metal[1], P.metal[4]); // forestay
  rope(fine, mx - 1, top + 2, WH_X1 + 12, WH_ROOF + 1, 2, P.metal[2]); // triatic stay to wheelhouse
  for (const [sx, dx] of [[398, -1], [452, 1], [386, -1]] as const) {
    const sy = Math.round(sheerY(sx)) - 1;
    rope(fine, mx + dx, 40, sx, sy - 5, 1, P.metal[sx === 386 ? 2 : 3]);
    // bottle-screw at the foot of each shroud
    vline(fine, sx, sy - 5, sy, P.brass[3]);
    fine.set(sx, sy - 4, P.brass[6]);
    fine.set(sx, sy - 1, P.brass[1]);
  }
  // signal halyard with small flags (fine rope)
  rope(fine, mx + 2, 42, 540, Math.round(sheerY(540)) - 2, 7, P.rope[2]);
  const flagC = [P.red[4], P.yellow[5], P.navy[4], P.white[4], P.green[4]];
  for (let i = 0; i < 9; i++) {
    const t = (i + 1) / 10;
    const x = mx + 2 + (540 - mx - 2) * t, y = 42 + (sheerY(540) - 2 - 42) * t + Math.sin(t * Math.PI) * 7;
    const c = flagC[i % flagC.length];
    fine.poly([x, y + 1, x + 4, y + 1, x + 2, y + 5], c);
    fine.set(x + 1, y + 1, shade(c, 0.3));
    fine.set(x + 3, y + 1, shade(c, -0.3));
    fine.set(x + 2, y + 4, shade(c, -0.3));
  }
  // flag halyard down the mast (fine, lighter, slightly slack)
  rope(fine, mx + 2, top, mx + 3, base - 12, 0.5, P.rope[4]);
  // mast pole: white-painted steel, lit from the left, with a shadowed right edge
  for (let y = top; y <= base; y++) {
    b.set(mx - 1, y, P.cream[6]);
    b.set(mx, y, P.cream[4]);
    b.set(mx + 1, y, P.cream[2]);
    // mast steps
    if (y > 44 && y < base - 8 && (y - 44) % 7 === 0) { b.set(mx - 2, y, P.metal[5]); b.set(mx - 3, y, P.metal[3]); }
  }
  // bands, gooseneck and pin rail with coiled halyards hanging off it
  for (const by of [36, 48, 84]) { hline(b, mx - 1, mx + 1, by, P.metal[4]); b.set(mx - 1, by, P.metal[6]); }
  b.rect(mx - 8, 86, 17, 2, P.varnish[4]);
  hline(b, mx - 8, mx + 8, 86, P.varnish[6]);
  for (const px of [mx - 6, mx - 2, mx + 3, mx + 7]) b.set(px, 85, P.brass[5]);
  ropeCoilHang(b, mx - 5, 88, 4, 7);
  ropeCoilHang(b, mx + 5, 88, 3, 6);
  // crosstrees with spreader lights underneath
  b.rect(mx - 12, 39, 25, 2, P.metal[4]);
  hline(b, mx - 12, mx + 12, 39, P.metal[6]);
  for (const sx of [mx - 10, mx + 9]) { b.rect(sx, 41, 3, 2, P.metal[2]); b.set(sx + 1, 42, P.white[4]); }
  // masthead light and a small VHF whip on the truck
  b.rect(mx - 2, top - 3, 5, 4, P.metal[2]);
  b.rect(mx - 1, top - 2, 3, 2, P.white[4]);
  vline(fine, mx + 1, 0, top - 4, P.metal[4]);
  // radar reflector diamond
  b.poly([mx - 5, 26, mx, 20, mx + 5, 26, mx, 32], P.metal[5]);
  b.poly([mx - 3, 26, mx, 23, mx + 3, 26, mx, 29], P.metal[3]);
  hline(b, mx - 4, mx + 4, 26, P.metal[7]);
  vline(b, mx, 21, 31, P.metal[6]);
  // steaming light in its box
  b.rect(mx + 2, 50, 4, 4, P.metal[2]);
  b.rect(mx + 3, 51, 2, 2, P.white[4]);
  // deck floodlight
  b.rect(mx + 2, 56, 6, 4, P.metal[3]);
  hline(b, mx + 2, mx + 7, 56, P.metal[5]);
  b.rect(mx + 7, 56, 2, 4, P.yellow[6]);
  // mast collar and base plate
  b.rect(mx - 3, base - 4, 7, 4, P.metal[3]);
  hline(b, mx - 3, mx + 3, base - 4, P.metal[5]);
  if (storm) {
    // a loose halyard whipping in the wind
    const pts: [number, number][] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      pts.push([mx - 2 - t * 46 - Math.sin(t * 7) * 4, top + 4 + t * 34 + Math.sin(t * 5 + 1) * 5]);
    }
    for (const [x, y] of pts) b.set(x, y, P.rope[4]);
    // torn tarp flapping on the derrick
    b.poly([mx - 4, 70, mx - 22, 64, mx - 18, 76, mx - 8, 78], P.navy[3]);
  }
  void rng;
}

/** A coil of rope hanging from a pin: stacked loops, with the tail hanging below. */
function ropeCoilHang(b: PixelBuffer, cx: number, y0: number, rx: number, h: number) {
  for (let k = 0; k < 3; k++) {
    ring(b, cx + (k - 1) * 0.6, y0 + h / 2 + k * 0.4, rx - 1.6, rx, (a, t, x, y) => {
      if (Math.sin(a) < -0.85 && k < 2) return -1;
      return ramp(P.rope, 3.2 - Math.cos(a + 2.2) * 1.2 + (t > 0.6 ? -0.8 : 0.2) - k * 0.3 + dith(x, y, 0.4));
    });
  }
  // lashing turns at the top and the tail
  hline(b, cx - 1, cx + 1, y0 + 1, P.rope[1]);
  vline(b, cx + 1, y0 + h, y0 + h + 3, P.rope[3]);
}

/** Stern crane (davit), flagstaff, stern light. */
function paintSternGear(b: PixelBuffer, rng: Rng) {
  const cx = 66, dk = Math.round(deckY(cx));
  // pedestal: yellow-painted steel with hazard stripes near the base and rust at the welds
  b.rectFn(cx - 3, dk - 30, 7, 30, (x, y) => {
    let f = (x === cx - 3 ? 6 : x > cx + 1 ? 2.6 : 4.4) - (y - (dk - 30)) * 0.02;
    if (y > dk - 12 && y < dk - 5 && ((x + y) >> 1) % 2 === 0) return ramp(P.metal, x > cx + 1 ? 1 : 2);
    return ramp(P.yellow, f + dith(x, y, 0.3));
  });
  for (const wy of [dk - 20, dk - 13]) hline(b, cx - 3, cx + 3, wy, P.yellow[2]);
  b.rect(cx - 5, dk - 4, 11, 4, P.metal[3]);
  hline(b, cx - 5, cx + 5, dk - 4, P.metal[5]);
  for (const bx of [cx - 4, cx + 4]) b.set(bx, dk - 2, P.metal[6]);
  // hydraulic control box with two levers
  b.rect(cx + 4, dk - 22, 5, 6, P.metal[3]);
  hline(b, cx + 4, cx + 8, dk - 22, P.metal[5]);
  vline(b, cx + 5, dk - 26, dk - 23, P.metal[5]); b.set(cx + 5, dk - 27, P.red[4]);
  vline(b, cx + 7, dk - 25, dk - 23, P.metal[5]); b.set(cx + 7, dk - 26, P.red[4]);
  // slewing head
  b.rect(cx - 4, dk - 34, 9, 5, P.yellow[3]);
  hline(b, cx - 4, cx + 4, dk - 34, P.yellow[5]);
  b.disc(cx, dk - 32, 1.4, P.metal[4]);
  // boom reaching up and aft over the transom
  const bx0 = cx, by0 = dk - 32, bx1 = 34, by1 = 50;
  const n = 60;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = bx0 + (bx1 - bx0) * t, y = by0 + (by1 - by0) * t;
    b.set(x, y - 1, P.yellow[6]);
    b.set(x, y, P.yellow[4]);
    b.set(x, y + 1, P.yellow[2]);
    if (i % 12 === 6) b.set(x, y, P.yellow[3]);
  }
  // hydraulic ram (chromed rod out of a painted cylinder)
  rope(b, cx + 1, dk - 18, (bx0 + bx1) / 2 + 4, (by0 + by1) / 2 + 1, 0, P.metal[5]);
  rope(b, cx + 2, dk - 18, (bx0 + bx1) / 2 + 5, (by0 + by1) / 2 + 2, 0, P.metal[3]);
  rope(b, cx + 1, dk - 18, cx - 6, dk - 30, 0, P.yellow[3]);
  // sheave, wire, block and hook
  b.disc(bx1, by1, 2.4, P.metal[3]);
  b.set(bx1 - 1, by1 - 1, P.metal[6]);
  b.set(bx1, by1, P.metal[1]);
  vline(b, bx1, by1 + 2, by1 + 30, P.metal[2]);
  b.rect(bx1 - 1, by1 + 30, 3, 3, P.yellow[4]);
  b.set(bx1 - 1, by1 + 30, P.yellow[6]);
  b.set(bx1 - 2, by1 + 34, P.metal[4]); b.set(bx1 - 2, by1 + 35, P.metal[4]); b.set(bx1 - 1, by1 + 36, P.metal[4]); b.set(bx1, by1 + 35, P.metal[4]);
  // rope coil hung on the pedestal
  ropeCoilHang(b, cx - 6, dk - 26, 4, 8);
  // flagstaff at the taffrail (the flag itself is an animated part)
  const fx = 24;
  for (let y = 58; y < sheerY(fx); y++) b.set(fx, y, y < 60 ? P.brass[5] : y % 12 === 0 ? P.varnish[2] : P.varnish[4]);
  b.disc(fx, 57, 1.2, P.brass[5]);
  // stern light on a bracket
  b.rect(fx + 1, 85, 5, 5, P.metal[2]);
  b.rect(fx + 2, 86, 3, 3, P.white[4]);
  b.set(fx + 2, 86, hex('#ffffff'));
  void rng;
}

/** Bowsprit pulpit, anchor, hawse, fairleads. */
function paintBowGear(b: PixelBuffer, fine: PixelBuffer, rng: Rng) {
  const sh = Math.round(sheerY(BOW_X));
  // bowsprit platform with teak slats
  b.polyFn([546, sh + 1, 586, 83, 586, 86, 546, sh + 6], (x, y) => ramp(P.varnish, 5 - (y - 83) * 0.5 + ((x - 546) % 6 === 0 ? -1.4 : 0) + dith(x, y)));
  hline(b, 548, 586, 82, P.varnish[6]);
  // pulpit rail: stanchions and two lines of rail
  for (let x = 552; x <= 584; x += 8) { vline(fine, x, 72, 83, P.metal[4]); fine.set(x, 72, P.metal[6]); }
  rope2(fine, 540, sh - 10, 584, 72, 1, P.metal[2], P.metal[5]);
  rope(fine, 540, sh - 5, 584, 78, 1, P.metal[3]);
  // bobstay to the stem, with its eye plate
  rope2(fine, 584, 86, 548, 128, 0, P.metal[1], P.metal[3]);
  b.rect(547, 127, 3, 3, P.metal[4]);
  b.set(547, 127, P.metal[6]);
  // navigation: a fairlead on the bow rail and a cleat
  b.rect(532, Math.round(sheerY(532)) - 2, 6, 2, P.metal[4]);
  hline(b, 532, 537, Math.round(sheerY(532)) - 2, P.metal[6]);
  // hawse pipe with a bronze lip and a rust stain, the stockless anchor stowed in it
  const ax = 522, ay = 112;
  rustStreak(b, ax - 3, ay + 4, 32, rng);
  rustStreak(b, ax + 3, ay + 4, 20, rng);
  rustStreak(b, ax + 6, ay + 22, 26, rng);
  ring(b, ax, ay, 3, 5.4, (a, _t, x, y) => ramp(P.brass, 3 - Math.cos(a + 2.3) * 1.8 + dith(x, y, 0.3)));
  b.discFn(ax, ay, 3, (_x, _y, nx, ny) => (nx + ny < -0.4 ? P.metal[2] : P.metal[0]));
  // shank
  b.rectFn(ax - 1, ay + 1, 4, 20, (x, y) => ramp(P.metal, (x === ax - 1 ? 6 : x === ax + 2 ? 2 : 4) - (y - ay) * 0.03));
  b.set(ax - 1, ay + 6, P.rust[3]); b.set(ax + 1, ay + 12, P.rust[2]);
  // crown and flukes
  b.polyFn([ax - 9, ay + 19, ax + 10, ay + 19, ax + 8, ay + 23, ax + 4, ay + 28, ax + 1, ay + 23, ax - 3, ay + 28, ax - 7, ay + 23], (x, y) => ramp(P.metal, 4.5 - (y - ay - 19) * 0.35 - (x - ax) * 0.05 + dith(x, y, 0.4)));
  hline(b, ax - 8, ax + 9, ay + 19, P.metal[6]);
  b.rect(ax - 1, ay + 17, 4, 3, P.metal[3]);
  b.set(ax - 5, ay + 21, P.rust[3]); b.set(ax + 6, ay + 22, P.rust[2]);
  // chain: alternating side-on and edge-on links from the hawse up over the bulwark to the windlass
  for (let i = 0; i < 8; i++) {
    const x = ax + 1 + i, y = ay - 4 - i * 1.4;
    if (i % 2) { b.rect(x, y - 1, 2, 3, P.metal[4]); b.set(x, y, P.metal[1]); b.set(x, y - 1, P.metal[6]); }
    else { b.set(x, y, P.metal[5]); b.set(x + 1, y, P.metal[3]); }
  }
  // name board on the bow: a varnished plank with gold letters, and the port number under it
  const nx = 464, ny = 117, tw = textWidth('KITTIWAKE');
  b.rectFn(nx, ny, tw + 6, 9, (x, y) => {
    if ((x === nx || x === nx + tw + 5) && (y === ny || y === ny + 8)) return -1;
    let f = y === ny ? 6 : y === ny + 8 ? 1.2 : 3.6 - (y - ny) * 0.15;
    f += (noise1(x * 0.35 + y * 5, 8) - 0.5) * 0.6;
    return ramp(P.varnish, f + dith(x, y, 0.3));
  });
  pixelText(b, 'KITTIWAKE', nx + 3, ny + 2, P.yellow[6], P.varnish[0]);
  pixelText(b, 'PZ 67', nx + 14, ny + 12, P.navy[1], P.cream[3]);
}

/** Tyre fenders hanging on the topsides from the cap rail. */
function paintFenders(b: PixelBuffer) {
  for (const fx of FENDERS) {
    const sh = Math.round(sheerY(fx));
    // clove hitch on the rail, then the lanyard down
    b.set(fx - 1, sh - 1, P.rope[4]); b.set(fx + 1, sh - 1, P.rope[4]); b.set(fx, sh - 2, P.rope[5]);
    for (let y = sh; y <= sh + 11; y++) b.set(fx, y, (y & 1) ? P.rope[2] : P.rope[4]);
    tyre(b, fx, sh + 17, 6);
    // lanyard through the tyre
    for (let y = sh + 11; y <= sh + 14; y++) b.set(fx, y, P.rope[3]);
    // scuffed paint and a dirt shadow behind the tyre
    for (let k = 0; k < 10; k++) tint(b, fx - 5 + k, sh + 24, P.grime[2], 0.25);
  }
}

/** Cleats and fairleads on the cap rail. */
function paintRailFittings(b: PixelBuffer) {
  for (const cx of [44, 128, 206, 346, 404, 492]) {
    const sh = Math.round(sheerY(cx));
    hline(b, cx - 2, cx + 2, sh - 3, P.metal[5]);
    b.set(cx - 2, sh - 3, P.metal[7]);
    b.set(cx - 1, sh - 2, P.metal[3]); b.set(cx + 1, sh - 2, P.metal[3]);
  }
}

/** Deck gear that shows above the bulwark in exterior view. */
function paintDeckGearExterior(b: PixelBuffer) {
  // net heap aft with floats and a trailing corkline
  const dk = Math.round(deckY(86));
  b.ellipseFn(86, dk - 8, 24, 12, (x, y, nx, ny) => {
    if (ny > 0.35) return -1;
    const mesh = (x + y) % 3 === 0 || (x - y + 300) % 3 === 0;
    return ramp(P.net, 3 - ny * 1.5 - nx * 0.8 + (mesh ? 0.6 : -0.3) + dith(x, y, 0.7));
  });
  for (let x = 64; x < 108; x++) if (hash2(x, 3, 9) > 0.7) b.set(x, dk - 9 - Math.round(Math.sin(x * 0.3) * 1.5 + 5 * (1 - Math.abs(x - 86) / 24)), P.net[4]);
  for (const [x, y] of [[74, dk - 15], [90, dk - 18], [100, dk - 13], [82, dk - 12]]) {
    b.disc(x, y, 2, P.orange[4]);
    b.set(x - 1, y - 1, P.orange[5]);
    b.set(x + 1, y + 1, P.orange[2]);
  }
  // windlass on the foredeck: green casting, chain gypsy, warping drum
  const wx = 500, wd = Math.round(deckY(wx));
  b.rect(wx - 8, wd - 16, 16, 8, P.green[3]);
  b.rect(wx - 8, wd - 16, 16, 2, P.green[5]);
  hline(b, wx - 8, wx + 7, wd - 9, P.green[1]);
  b.disc(wx + 10, wd - 13, 3, P.metal[4]);
  b.set(wx + 9, wd - 14, P.metal[6]);
  b.disc(wx - 11, wd - 13, 2.4, P.metal[3]);
  b.set(wx - 12, wd - 14, P.metal[5]);
  b.rect(wx - 2, wd - 20, 5, 4, P.green[2]);
  // a coiled mooring warp on the foredeck, just peeking over the rail
  const rx = 470, rd = Math.round(deckY(rx));
  for (let k = 0; k < 3; k++) b.ellipseFn(rx, rd - 13 - k * 1.2, 9 - k * 1.6, 2.4, (x, y, nx, ny) => (Math.hypot(nx, ny) > 0.55 ? ramp(P.rope, 3.4 - ny * 1.2 - k * 0.2 + dith(x, y, 0.5)) : -1));
}

/** Paint the full exterior into `b`. Returns the near-bulwark front layer as well. */
function paintExterior(storm: boolean): { buf: PixelBuffer; back: PixelBuffer; front: PixelBuffer; glow: PixelBuffer; fenders: PixelBuffer } {
  const rng = new Rng(4242);
  const back = new PixelBuffer(BOAT_W, BOAT_H);
  // things behind the hull: rigging, mast, wheelhouse, roof gear, deck gear
  const backFine = new PixelBuffer(BOAT_W, BOAT_H), frontFine = new PixelBuffer(BOAT_W, BOAT_H);
  paintMastAndRig(back, backFine, storm, rng);
  paintWheelhouseShell(back, backFine, false, rng);
  paintSternGear(back, rng);
  paintDeckGearExterior(back);
  // the hull (near side) is the front layer in exterior shots
  const front = new PixelBuffer(BOAT_W, BOAT_H);
  paintHullSkin(front, rng);
  paintRunningGear(front);
  paintBowGear(front, frontFine, rng);
  // fenders hang over the cut line, so they are kept on their own mask and go with the hull side in the cutaway
  const fenders = new PixelBuffer(BOAT_W, BOAT_H);
  paintFenders(fenders);
  front.blit(fenders, 0, 0);
  paintRailFittings(front);
  for (const [px, py] of PORTHOLES) {
    // eyebrow over each port, then the port
    for (let x = px - 6; x <= px + 6; x++) {
      const yy = py - 7 + Math.round(((x - px) / 6) ** 2 * 1.5);
      front.set(x, yy, P.cream[6]);
      front.set(x, yy + 1, P.cream[2]);
    }
    porthole(front, px, py, 5.5);
  }
  // rust and tannin streaks from the portholes
  for (const [px, py] of PORTHOLES) if (rng.chance(0.7)) rustStreak(front, px + rng.int(-2, 2), py + 6, rng.int(6, 16), rng);
  front.outline(OL);
  back.outline(OLc);
  // thin lines (rigging, rails, whips) go on after the outline pass so they keep their weight
  backFine.blit(back, 0, 0);
  back.data.set(backFine.data);
  front.blit(frontFine, 0, 0);
  const buf = back.clone();
  buf.blit(front, 0, 0);
  // glow: windows and lights (the scene decides when they are lit)
  const glow = new PixelBuffer(BOAT_W, BOAT_H);
  for (const wx of [228, 260, 292]) glow.rectFn(wx + 1, 35, 25, 29, (x, y) => rgba(255, 214, 150, y > 50 ? 170 : 110 + ((x + y) & 1) * 30));
  for (const [px, py] of PORTHOLES) glow.discFn(px, py, 3.2, () => rgba(255, 210, 140, 200));
  glow.rect(423, 6, 3, 2, rgba(255, 255, 240, 255));
  glow.rect(430, 56, 2, 4, rgba(255, 250, 220, 255));
  glow.rect(427, 51, 2, 2, rgba(255, 250, 235, 255));
  glow.rect(26, 86, 3, 3, rgba(255, 255, 235, 255));
  glow.rect(344, 11, 3, 3, rgba(120, 255, 160, 255));
  if (storm) wetSheen(buf, 1), wetSheen(back, 1), wetSheen(front, 1);
  return { buf, back, front, glow, fenders };
}

/** Storm: darker saturated wet surfaces, bright specular top edges and running rain streaks. */
function wetSheen(b: PixelBuffer, k: number) {
  const src = b.data.slice();
  const w = b.w, h = b.h;
  const rng = new Rng(77);
  for (let y = 1; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = src[y * w + x];
      if (!(c >>> 24)) continue;
      let o = shade(c, -0.12 * k);
      const above = src[(y - 1) * w + x];
      if (!(above >>> 24)) o = mix(o, rgba(214, 232, 240), 0.45 * k); // wet highlight on exposed tops
      b.data[y * w + x] = o;
    }
  // rain runnels
  for (let i = 0; i < 160; i++) {
    const x = rng.int(0, w - 1);
    let y = rng.int(0, h - 20);
    if (!(src[y * w + x] >>> 24)) continue;
    const L = rng.int(4, 14);
    for (let k2 = 0; k2 < L && y < h; k2++, y++) {
      const c = b.data[y * w + x];
      if (!(c >>> 24)) break;
      b.data[y * w + x] = mix(c, rgba(200, 222, 232), 0.28 * (1 - k2 / L));
    }
  }
}

export function paintBoatExterior(o: PaintOpts = {}): ExteriorSprite {
  const e = paintExterior(!!o.storm);
  // bake the static flag and radar frame into the plain composite
  const parts = paintBoatParts({ storm: o.storm });
  const fl = parts.flag[0], rd = parts.radar[0];
  e.buf.blit(fl.buf, BOAT_LAYOUT.mounts.flag[0] - fl.ax, BOAT_LAYOUT.mounts.flag[1] - fl.ay);
  e.buf.blit(rd.buf, BOAT_LAYOUT.mounts.radar[0] - rd.ax, BOAT_LAYOUT.mounts.radar[1] - rd.ay);
  return { buf: e.buf, back: e.back, front: e.front, ax: PIVOT[0], ay: PIVOT[1], glow: e.glow };
}

// ------------------------------------------------------------------ animated / movable parts

export interface BoatParts {
  /** helm wheel, 4 frames stepping 11.25 degrees (8 spokes, so the cycle repeats every 45 degrees); anchor = hub */
  wheel: Sprite[];
  /** radar scanner rotating, 6 frames over half a turn; anchor = top of the radar post */
  radar: Sprite[];
  /** Union Jack flying aft (to -x), 4 wave frames; anchor = top of the hoist on the flagstaff */
  flag: Sprite[];
  /** hanging brass lamp; anchor = hook (swing it with the boat's roll) */
  lamp: Sprite;
  /** loose deck crate and the same crate lashed down; anchor bottom-centre */
  crate: Sprite;
  crateLashed: Sprite;
  /** steaming pot for the galley stove; anchor bottom-centre */
  pot: Sprite;
}

function unionJack(W: number, H: number, wave: (u: number) => number): PixelBuffer {
  const b = new PixelBuffer(W, H + 4);
  const blue = hex('#233f86'), blueD = hex('#182c61'), white = hex('#f2f2ee'), whiteD = hex('#c9cbd1'), red = hex('#c8242b'), redD = hex('#931a20');
  for (let x = 0; x < W; x++) {
    const u = x / (W - 1);
    const dy = wave(u);
    const lit = Math.cos(u * 9 + dy) > 0;
    for (let y = 0; y < H; y++) {
      const px = x + 0.5, py = y + 0.5;
      const d1 = Math.abs(py - px * (H / W)), d2 = Math.abs(py - (W - px) * (H / W));
      const dd = Math.min(d1, d2);
      const cu = Math.abs(px - W / 2), cv = Math.abs(py - H / 2);
      let c: C;
      if (cu < W * 0.07 || cv < H * 0.1) c = lit ? red : redD;
      else if (cu < W * 0.15 || cv < H * 0.22) c = lit ? white : whiteD;
      else if (dd < 0.75) c = lit ? red : redD;
      else if (dd < 1.7) c = lit ? white : whiteD;
      else c = lit ? blue : blueD;
      b.set(x, Math.round(y + 2 + dy), c);
    }
  }
  return b;
}

export function paintBoatParts(o: PaintOpts = {}): BoatParts {
  const storm = !!o.storm;
  // flag: hoist at the right edge (on the staff), fly toward -x
  const FW = 16, FH = 10;
  const flag: Sprite[] = [0, 1, 2, 3].map(i => {
    const amp = storm ? 2.2 : 1.1;
    const buf = unionJack(FW, FH, u => Math.sin((1 - u) * 4.2 - i * (Math.PI / 2)) * amp * (1 - u));
    return { buf, ax: FW, ay: 2 };
  });
  // radar scanner
  const radar: Sprite[] = [0, 1, 2, 3, 4, 5].map(i => {
    const th = (i / 6) * Math.PI;
    const L = Math.max(3, Math.round(30 * Math.abs(Math.cos(th))));
    const buf = new PixelBuffer(34, 6);
    const x0 = 17 - Math.floor(L / 2);
    buf.rect(x0, 1, L, 3, P.metal[3]);
    hline(buf, x0, x0 + L - 1, 1, P.metal[6]);
    hline(buf, x0, x0 + L - 1, 3, P.metal[1]);
    if (L < 8) buf.rect(x0, 1, L, 3, P.metal[4]);
    buf.rect(15, 4, 5, 2, P.metal[2]); // pedestal
    return { buf, ax: 17, ay: 6 };
  });
  // helm wheel
  const wheel: Sprite[] = [0, 1, 2, 3].map(i => {
    const R = 13, S = R * 2 + 7;
    const buf = new PixelBuffer(S, S);
    const c = S / 2;
    const rot = (i / 4) * (Math.PI / 4);
    // spokes with turned handles
    for (let k = 0; k < 8; k++) {
      const a = rot + (k * Math.PI) / 4;
      for (let t = 2; t <= R + 3; t += 0.5) {
        const x = c + Math.cos(a) * t, y = c + Math.sin(a) * t;
        const outside = t > R;
        buf.set(x, y, outside ? (t > R + 2 ? P.varnish[5] : P.varnish[4]) : P.varnish[3]);
      }
    }
    ring(buf, c, c, R - 2.2, R, (a, t, x, y) => ramp(P.varnish, 4 - Math.cos(a + 2.3) * 1.8 + (t > 0.7 ? -0.6 : 0.3) + dith(x, y, 0.4)));
    buf.discFn(c, c, 3.2, (x, y, nx, ny) => ramp(P.brass, 4 - (nx + ny) * 1.6 + dith(x, y, 0.3)));
    buf.set(c - 1, c - 1, P.brass[6]);
    return { buf, ax: c, ay: c };
  });
  // hanging lamp
  const lamp = (() => {
    const buf = new PixelBuffer(9, 14);
    vline(buf, 4, 0, 3, P.metal[3]);
    buf.rect(2, 3, 5, 2, P.brass[4]);
    buf.rect(1, 5, 7, 6, P.brass[2]);
    buf.rect(2, 5, 5, 6, withAlpha(hex('#ffe3a0'), 230));
    vline(buf, 4, 6, 9, hex('#fff6d8'));
    buf.rect(1, 11, 7, 2, P.brass[3]);
    hline(buf, 1, 7, 11, P.brass[5]);
    buf.set(4, 13, P.brass[2]);
    return { buf, ax: 4, ay: 0 };
  })();
  const crateBuf = (lashed: boolean) => {
    const w = 22, hh = 18;
    const buf = new PixelBuffer(w, hh);
    buf.rectFn(0, 0, w, hh, (x, y) => {
      const plank = Math.floor(y / 6);
      let f = 4 + (noise1(x * 0.5 + plank * 9, 11) - 0.5) * 1.4 + (y % 6 === 0 ? -1.4 : 0);
      if (x < 2 || y < 2) f += 1;
      if (x > w - 3 || y > hh - 3) f -= 1.4;
      return ramp(P.wood, f + dith(x, y, 0.5));
    });
    // corner battens
    for (const bx of [0, w - 3]) buf.rectFn(bx, 0, 3, hh, (x, y) => ramp(P.wood, (x === bx ? 5.5 : 4) - y * 0.05));
    // stencil
    hline(buf, 6, 15, 7, P.cream[3]);
    hline(buf, 7, 14, 9, P.cream[3]);
    buf.rect(8, 11, 6, 1, P.red[3]);
    if (lashed) {
      for (const sx of [5, 16]) {
        vline(buf, sx, 0, hh - 1, P.yellow[3]);
        vline(buf, sx + 1, 0, hh - 1, P.yellow[5]);
      }
      buf.rect(4, hh - 3, 4, 3, P.metal[4]);
      buf.rect(15, hh - 3, 4, 3, P.metal[4]);
    }
    buf.outline(OL);
    return { buf, ax: (w + 2) / 2, ay: hh + 1 };
  };
  const pot = (() => {
    const buf = new PixelBuffer(14, 10);
    buf.rectFn(2, 3, 10, 7, (x, y) => ramp(P.metal, 5 - (x - 2) * 0.35 - (y - 3) * 0.1 + dith(x, y, 0.4)));
    hline(buf, 1, 12, 3, P.metal[6]);
    buf.set(0, 5, P.metal[4]); buf.set(13, 5, P.metal[4]);
    hline(buf, 5, 8, 2, P.metal[3]);
    buf.set(6, 1, P.metal[5]);
    buf.outline(OL);
    return { buf, ax: 7, ay: 10 };
  })();
  void storm;
  return { wheel, radar, flag, lamp, crate: crateBuf(false), crateLashed: crateBuf(true), pot };
}

// ------------------------------------------------------------------ the wreck & debris

const WRECK_W = 620, WRECK_H = 300, WRECK_ROT = -0.2, WRECK_OX = 318, WRECK_OY = 232;
/** Where a boat-local point ends up on the wreck sprite, relative to its anchor (bottom-centre). */
export function wreckPoint(lx: number, ly: number): [number, number] {
  const c = Math.cos(WRECK_ROT), s = Math.sin(WRECK_ROT);
  const dxp = lx - PIVOT[0], dyp = ly - PIVOT[1];
  const x = WRECK_OX + c * dxp - s * dyp, y = WRECK_OY + s * dxp + c * dyp;
  return [x - WRECK_W / 2, y - (WRECK_H - 2)];
}

/** The Kittiwake after the storm: heeled over on the rocks, bow torn off (you can see into the flooded hold), mast snapped. */
export function paintWreck(): Sprite {
  const cut = paintBoatCutaway({ storm: true });
  const src = new PixelBuffer(BOAT_W, BOAT_H);
  src.blit(cut.interior.buf, 0, 0);
  src.blit(cut.shell.buf, 0, 0);
  // the hull side is stove in over the bunks and hold: jagged hole shows the rooms inside
  const hole = (x: number, y: number) => {
    const dx = (x - 405) / 70, dy = (y - 168) / 34;
    return dx * dx + dy * dy + (hash2(x >> 2, y >> 2, 3) - 0.5) * 0.5 < 1;
  };
  for (let y = 0; y < BOAT_H; y++) for (let x = 0; x < BOAT_W; x++) {
    const c = cut.hullSide.buf.get(x, y);
    if (c >>> 24 && !hole(x, y)) src.set(x, y, c);
    // flood water inside the hold
    if (hole(x, y) && y > 184 && (src.get(x, y) >>> 24)) src.set(x, y, mix(src.get(x, y), hex('#1e4a52'), 0.7));
  }
  src.blit(cut.front.buf, 0, 0);
  const W = WRECK_W, H = WRECK_H;
  const out = new PixelBuffer(W, H);
  const c = Math.cos(WRECK_ROT), s = Math.sin(WRECK_ROT);
  const rng = new Rng(77);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x - WRECK_OX, dy = y - WRECK_OY;
      const sx = Math.round(c * dx + s * dy + PIVOT[0]), sy = Math.round(-s * dx + c * dy + PIVOT[1]);
      if (sx < 0 || sy < 0 || sx >= BOAT_W || sy >= BOAT_H) continue;
      let col = src.data[sy * BOAT_W + sx];
      if (!(col >>> 24)) continue;
      const brk = 470 + Math.sin(sy * 0.9) * 6 + (hash2(sy, 3, 9) - 0.5) * 10;
      if (sx > brk) continue;
      if (sy < 30 && sx > 400) continue; // snapped foremast
      const wet = smoothstep(160, 225, sy);
      col = mix(col, hex('#1c2420'), wet * 0.4);
      if (sy > 196 && hash2(sx, sy, 5) > 0.6) col = mix(col, hex('#3a5a2a'), 0.6);
      if (hash2(sx >> 3, sy, 2) > 0.94) col = shade(col, -0.25);
      out.data[y * W + x] = col;
    }
  // splintered planks at the break
  for (let i = 0; i < 30; i++) {
    const [px, py] = wreckPoint(466, rng.int(60, 225));
    const x0 = px + W / 2, y0 = py + H - 2;
    for (let k = 0; k < rng.int(4, 12); k++) out.set(x0 + k - 2, y0 - k * 0.3, P.wood[rng.int(2, 6)]);
  }
  // rope ladder hanging from the stern rail down to the rocks
  const [lx, ly] = wreckPoint(46, deckY(46) - 2);
  const X = Math.round(lx + W / 2), Y0 = Math.round(ly + H - 2);
  for (let y = Y0; y < H - 4; y++) { out.set(X - 4, y, P.rope[3]); out.set(X + 4, y, P.rope[3]); if ((y - Y0) % 7 === 3) hline(out, X - 4, X + 4, y, P.wood[4]); }
  // rocks it is stuck on
  for (let i = 0; i < 13; i++) {
    const rx = 30 + i * 45 + rng.range(-12, 12), ry = H - 8 - rng.range(0, 10), rr = rng.range(16, 34);
    for (let y = -rr; y < rr * 0.6; y++)
      for (let x = -rr * 1.3; x < rr * 1.3; x++) {
        const d = (x / (rr * 1.3)) ** 2 + (y / rr) ** 2;
        if (d > 1 || (out.get(rx + x, ry + y) >>> 24 && y < 0)) continue;
        const l = 0.55 - y / rr * 0.25 - x / rr * 0.15 + (fbm2((rx + x) * 0.08, (ry + y) * 0.08, 3, 3) - 0.5) * 0.5 + (bayer(rx + x, ry + y) - 0.5) * 0.25;
        const pal = P.metal;
        const cc = pal[clamp(Math.round(l * (pal.length - 1)), 1, pal.length - 1)];
        out.set(rx + x, ry + y, (ry + y) > H - 14 && hash2(rx + x, ry + y, 1) > 0.5 ? hex('#3a5a2a') : cc);
      }
  }
  out.outline(OL);
  return { buf: out, ax: W / 2, ay: H - 2 };
}

export type DebrisKind = 'crate' | 'barrel' | 'plank' | 'lifebuoy' | 'net' | 'rope';
export const DEBRIS_KINDS: DebrisKind[] = ['crate', 'barrel', 'plank', 'lifebuoy', 'net', 'rope'];
/** Washed-up bits of the Kittiwake. Anchor bottom-centre. */
export function paintDebris(kind: DebrisKind, seed: number): Sprite {
  const rng = new Rng(seed * 17 + kind.length);
  const b = new PixelBuffer(40, 24);
  const r = (pal: C[], l: number) => pal[clamp(Math.round(l * (pal.length - 1)), 0, pal.length - 1)];
  switch (kind) {
    case 'crate': b.rectFn(8, 6, 22, 16, (x, y) => r(P.wood, 0.6 - (y - 6) * 0.02 + (y % 4 === 0 ? -0.25 : 0) + (bayer(x, y) - 0.5) * 0.15)); break;
    case 'barrel': b.rectFn(12, 4, 14, 18, (x, y) => (y === 8 || y === 17 ? P.metal[3] : r(P.navy, 0.8 - Math.abs(x - 19) * 0.07))); break;
    case 'plank': for (let x = 2; x < 38; x++) { b.set(x, 18 + Math.round(Math.sin(x * 0.2 + seed)), P.wood[5]); b.set(x, 19 + Math.round(Math.sin(x * 0.2 + seed)), P.wood[3]); } break;
    case 'lifebuoy': for (let a = 0; a < 64; a++) { const t = (a / 64) * Math.PI * 2; for (let k = 5; k < 9; k++) b.set(20 + Math.cos(t) * k, 13 + Math.sin(t) * k * 0.8, Math.floor(a / 8) % 2 ? P.red[4] : P.white[4]); } break;
    case 'net': for (let y = 10; y < 22; y++) for (let x = 4; x < 36; x++) if ((x + y) % 4 === 0 || (x - y + 40) % 4 === 0) if (hash2(x, y, seed) > 0.25) b.set(x, y, P.net[rng.int(2, 4)]); break;
    case 'rope': for (let a = 0; a < 80; a++) { const t = a * 0.25; b.set(20 + Math.cos(t) * (4 + t * 0.4), 16 + Math.sin(t) * (2 + t * 0.2), P.rope[3 + (a % 2)]); } break;
  }
  b.outline(OL);
  return { buf: b, ax: 20, ay: 23 };
}

// ------------------------------------------------------------------ cutaway interior (V3)

export interface CutawaySet {
  /** interior rooms: paneling, furniture, engine, bunks, hold, wheelhouse interior (behind actors) */
  interior: Sprite;
  /** exterior pieces, split so the hull side / wheelhouse walls can fade away when you go inside */
  shell: Sprite;
  hullSide: Sprite;
  cabinWall: Sprite;
  /** near bulwark and rail (over actors) */
  front: Sprite;
  glow?: PixelBuffer;
}


/** Everything needed to show the Kittiwake as a dollhouse: walk the deck, climb below, see inside. */
export function paintBoatCutaway(o: PaintOpts = {}): CutawaySet {
  const e = paintExterior(!!o.storm);
  const parts = paintBoatParts({ storm: o.storm });
  const fl = parts.flag[0], rd = parts.radar[0];
  e.back.blit(fl.buf, BOAT_LAYOUT.mounts.flag[0] - fl.ax, BOAT_LAYOUT.mounts.flag[1] - fl.ay);
  e.back.blit(rd.buf, BOAT_LAYOUT.mounts.radar[0] - rd.ax, BOAT_LAYOUT.mounts.radar[1] - rd.ay);
  const W = BOAT_W, H = BOAT_H;
  const M = hullMask();
  const shell = new PixelBuffer(W, H), hull = new PixelBuffer(W, H), cabin = new PixelBuffer(W, H);
  const inCabin = (x: number, y: number) => x >= WH_X0 + 2 && x <= WH_X1 - 2 && y >= WH_CEIL + 2 && y <= WH_FLOOR - 1;
  const inHull = (x: number, y: number) => x > BH.engAft - 4 && x < BH.holdFwd + 6 && y > lowCeil(x) - 3 && M.at(x, y);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = e.back.get(x, y);
      if (!(c >>> 24)) continue;
      if (inCabin(x, y)) cabin.set(x, y, c);
      else if (inHull(x, y)) hull.set(x, y, c);
      else shell.set(x, y, c);
    }
  const front = new PixelBuffer(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = e.front.get(x, y);
      if (!(c >>> 24)) continue;
      const fender = y > 100 && (e.fenders.get(x, y) | e.fenders.get(x - 1, y) | e.fenders.get(x + 1, y) | e.fenders.get(x, y - 1) | e.fenders.get(x, y + 1)) >>> 24;
      if (inHull(x, y) || (fender && y > Math.round(deckY(x)) + 1)) hull.set(x, y, c);
      else front.set(x, y, c);
    }
  // ---- interior rooms
  const b = new PixelBuffer(W, H);
  const g = new PixelBuffer(W, H);
  paintInterior(b, g, BOAT_LAYOUT.lamps, BOAT_LAYOUT.ladders, !!o.storm);
  const A = (buf: PixelBuffer): Sprite => ({ buf, ax: PIVOT[0], ay: PIVOT[1] });
  return { interior: { ...A(b), glow: g }, shell: A(shell), hullSide: A(hull), cabinWall: A(cabin), front: A(front), glow: e.glow };
}

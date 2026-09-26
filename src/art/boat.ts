// art/boat.ts: the research boat Kittiwake: exterior, dollhouse cutaway, storm variant, wreck, debris.
//
// A sturdy old wooden expedition trawler turned research boat: cream topsides, red boot stripe,
// dark blue-green bottom, weathered varnished rail, raised wheelhouse, foremast with radar and
// lights, stern davit, lifebuoys, nets, crates and a small Union Jack at the stern.
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
import { Rng, bayer, clamp, fbm2, hash2, lerp, noise1, smoothstep } from '../core/math';

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

export const BOAT_W = 600;
export const BOAT_H = 236;
export const WATERLINE = 206;
const PIVOT: [number, number] = [300, 206];
const KEEL = 230;

// ------------------------------------------------------------------ palettes (dark -> light)

const hx = (...s: string[]): C[] => s.map(v => hex(v));
const P = {
  cream: hx('#4f483c', '#7d7462', '#a79d85', '#cbc1a6', '#e3dbc3', '#f3edda', '#fffaea'),
  red: hx('#3d1011', '#681a19', '#8f2621', '#b3352a', '#cf4b35', '#e66c47'),
  bottom: hx('#0b1719', '#112326', '#183134', '#213f40', '#2d514e', '#3d655d'),
  varnish: hx('#2a170c', '#472914', '#673d1e', '#885328', '#a86b33', '#c68846', '#dfab66'),
  wood: hx('#24160d', '#382315', '#50331d', '#6a4526', '#855a31', '#a1703d', '#bd8a50', '#d6a86b'),
  teak: hx('#342519', '#4d3826', '#684e36', '#836749', '#9c805e', '#b69b76', '#cdb58f'),
  paintIn: hx('#5a4b34', '#77664a', '#968461', '#b2a07a', '#cab995', '#ddd0ae'),
  steelIn: hx('#20282b', '#2c363a', '#3a464a', '#4c595d', '#617074', '#7c8b8e'),
  metal: hx('#101316', '#1c2126', '#2b3238', '#3d464d', '#525c63', '#6d777c', '#8f989a', '#bcc2c0'),
  brass: hx('#36250b', '#5f4213', '#8a611d', '#b3852b', '#d6aa45', '#efd07a', '#fff0b8'),
  rust: hx('#351a0e', '#582b16', '#7c3d1f', '#9f542a', '#bf6f39'),
  engine: hx('#141f18', '#1e3325', '#2a4832', '#385f41', '#4a7852', '#619367', '#80ad80'),
  glass: hx('#16232b', '#223642', '#34505e', '#56788a', '#8fb2c2', '#cfe6ee'),
  navy: hx('#0f1626', '#18233c', '#243453', '#33496e', '#4a6590'),
  green: hx('#15261a', '#1f3a27', '#2c5236', '#3c6b45', '#548a57', '#76a870'),
  yellow: hx('#3d2a07', '#62440b', '#8c6210', '#b58218', '#d9a42a', '#efc653', '#fbe48e'),
  rope: hx('#3b2f1d', '#5a4a2e', '#7a6641', '#9a8456', '#b8a270', '#d3c08e'),
  net: hx('#1b2a24', '#27403a', '#35564c', '#487060', '#618a73'),
  quiltR: hx('#4a1618', '#72231f', '#9b3427', '#c14d33', '#dc6d45'),
  quiltB: hx('#15213a', '#213457', '#304b78', '#456898', '#6488b5'),
  cushion: hx('#1d3326', '#2b4a36', '#3b6448', '#50805c', '#6e9e74'),
  tyre: hx('#0d0e10', '#18191c', '#232428', '#303236', '#43464b'),
  white: hx('#6d737e', '#9299a3', '#b8bec4', '#dadfe0', '#f4f5ef'),
};
const OL = hex('#15100c');
const OLc = hex('#0d1215');
const SECTION = hx('#1a100a', '#2a1a10', '#3d2819', '#533823');

// ------------------------------------------------------------------ geometry (boat-local px)

/** Walkable main-deck surface y (top of the planking). */
export function deckY(x: number): number {
  if (x < 300) return 116 - 4 * Math.pow((300 - x) / 276, 2);
  return 116 - 18 * Math.pow(clamp((x - 300) / 250), 2.2);
}
/** Top of the bulwark cap rail. */
const sheerY = (x: number) => deckY(x) - 13;

const STERN_X = 24;
const BOW_X = 551;

/** Hull silhouette polygon (without rudder / propeller / bowsprit). */
function hullPoly(): number[] {
  const pts: number[] = [];
  pts.push(STERN_X, sheerY(STERN_X));
  for (let x = STERN_X + 4; x < BOW_X; x += 4) pts.push(x, sheerY(x));
  pts.push(BOW_X, sheerY(BOW_X));
  const stem: [number, number][] = [[552, 100], [550, 118], [545, 142], [537, 165], [525, 186], [509, 204], [490, 218], [468, 227], [448, 230]];
  for (const [x, y] of stem) pts.push(x, y);
  pts.push(112, KEEL);
  const counter: [number, number][] = [[100, 228], [88, 223], [76, 216], [64, 208], [52, 200], [41, 193], [33, 188]];
  for (const [x, y] of counter) pts.push(x, y);
  pts.push(29, 184);
  return pts;
}

/** Rasterised hull mask with helpers. */
class Mask {
  readonly m: Uint8Array;
  constructor(readonly w: number, readonly h: number) {
    this.m = new Uint8Array(w * h);
  }
  static poly(w: number, h: number, pts: number[]) {
    const k = new Mask(w, h);
    const b = new PixelBuffer(w, h);
    b.poly(pts, 0xffffffff);
    for (let i = 0; i < w * h; i++) k.m[i] = b.data[i] ? 1 : 0;
    return k;
  }
  at(x: number, y: number) {
    x |= 0; y |= 0;
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.m[y * this.w + x] : 0;
  }
  /** first opaque row in column x (or -1) */
  top(x: number) {
    for (let y = 0; y < this.h; y++) if (this.m[y * this.w + x]) return y;
    return -1;
  }
  bottom(x: number) {
    for (let y = this.h - 1; y >= 0; y--) if (this.m[y * this.w + x]) return y;
    return -1;
  }
}

let HULL: Mask | null = null;
function hullMask() {
  return (HULL ??= Mask.poly(BOAT_W, BOAT_H, hullPoly()));
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

// Key interior dimensions
const WH_X0 = 214, WH_X1 = 334, WH_FLOOR = 102, WH_CEIL = 24, WH_ROOF = 17;
const LOW_FLOOR = 202, LOW_CEIL = 122, HOLD_FLOOR = 196;
const BH = { engAft: 76, engGal: 196, galBunk: 336, bunkHold: 424, holdFwd: 496 };

/** Ceiling of the lower deck (underside of the main deck planking). */
const lowCeil = (x: number) => Math.round(deckY(x)) + 6;

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
    { name: 'lower', pts: [[BH.engAft + 6, LOW_FLOOR], [BH.bunkHold + 4, LOW_FLOOR], [BH.bunkHold + 10, HOLD_FLOOR], [BH.holdFwd - 10, HOLD_FLOOR]] },
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
    galley: { x0: BH.engGal + 6, y0: LOW_CEIL, x1: BH.galBunk, y1: LOW_FLOOR },
    bunks: { x0: BH.galBunk + 6, y0: LOW_CEIL, x1: BH.bunkHold, y1: LOW_FLOOR },
    engine: { x0: BH.engAft, y0: LOW_CEIL, x1: BH.engGal, y1: LOW_FLOOR },
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

// ------------------------------------------------------------------ small painting helpers

const ramp = (r: C[], f: number) => r[clamp(Math.round(f), 0, r.length - 1)];
const dith = (x: number, y: number, k = 0.8) => (bayer(x, y) - 0.5) * k;

function rectRamp(b: PixelBuffer, x: number, y: number, w: number, h: number, r: C[], base: number, vert = 0.3, noiseK = 0) {
  b.rectFn(x, y, w, h, (px, py) => {
    const t = (py - y) / Math.max(1, h - 1);
    let f = base + (0.5 - t) * vert * (r.length - 1);
    if (noiseK) f += (noise1(px * 0.7 + py * 13.1, 3) - 0.5) * noiseK;
    return ramp(r, f + dith(px, py, 0.6));
  });
}

/** Vertical strip of a line with an optional highlight side. */
function vline(b: PixelBuffer, x: number, y0: number, y1: number, c: C) {
  for (let y = Math.round(Math.min(y0, y1)); y <= Math.round(Math.max(y0, y1)); y++) b.set(x, y, c);
}
function hline(b: PixelBuffer, x0: number, x1: number, y: number, c: C) {
  for (let x = Math.round(Math.min(x0, x1)); x <= Math.round(Math.max(x0, x1)); x++) b.set(x, y, c);
}

/** Rope / wire with catenary sag. */
function rope(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, sag: number, c: C, c2?: C) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.4);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag;
    b.set(x, y, c2 && i % 3 === 0 ? c2 : c);
  }
}

/** Filled ring (lifebuoy, tyre, porthole rim). */
function ring(b: PixelBuffer, cx: number, cy: number, r0: number, r1: number, fn: (a: number, t: number, x: number, y: number) => C | -1) {
  for (let y = Math.floor(cy - r1 - 1); y <= cy + r1 + 1; y++)
    for (let x = Math.floor(cx - r1 - 1); x <= cx + r1 + 1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d < r0 || d > r1) continue;
      const c = fn(Math.atan2(y + 0.5 - cy, x + 0.5 - cx), (d - r0) / Math.max(0.01, r1 - r0), x, y);
      if (c !== -1) b.set(x, y, c);
    }
}

function lifebuoy(b: PixelBuffer, cx: number, cy: number, r = 7) {
  ring(b, cx, cy, r * 0.5, r, (a, t, x, y) => {
    const seg = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8 + 0.5) % 2;
    const base = seg ? P.red : P.white;
    const lit = -Math.cos(a + 2.4) * 0.5 + (0.5 - Math.abs(t - 0.5)) * 1.2;
    return ramp(base, 2.2 + lit * 2 + dith(x, y, 0.5));
  });
  // grab line
  for (let k = 0; k < 4; k++) {
    const a = k * (Math.PI / 2) + Math.PI / 4;
    b.set(cx + Math.cos(a) * r * 0.75, cy + Math.sin(a) * r * 0.75, P.rope[4]);
  }
}

function tyre(b: PixelBuffer, cx: number, cy: number, r = 6) {
  ring(b, cx, cy, r * 0.45, r, (a, t, x, y) => ramp(P.tyre, 1.8 - Math.cos(a + 2.2) * 1.5 + (t > 0.8 ? -0.6 : 0) + dith(x, y, 0.4)));
}

function porthole(b: PixelBuffer, cx: number, cy: number, r = 5, glass: C | null = null, lit = false) {
  ring(b, cx, cy, r - 1.6, r, (a, _t, x, y) => ramp(P.brass, 3 - Math.cos(a + 2.3) * 2 + dith(x, y, 0.4)));
  b.discFn(cx, cy, r - 1.6, (x, y, nx, ny) => {
    if (glass !== null) return glass;
    if (lit) return ramp(P.yellow, 4.5 - ny * 1.5);
    const g = nx + ny < -0.6 ? 4 : nx + ny < -0.2 ? 2 : 1;
    return ramp(P.glass, g + dith(x, y, 0.3));
  });
  // bolts
  for (let k = 0; k < 6; k++) {
    const a = k * (Math.PI / 3);
    b.set(cx + Math.cos(a) * (r + 0.6), cy + Math.sin(a) * (r + 0.6), P.brass[1]);
  }
}

// pixel font for the name (4x5 / 3x5 / 5x5 glyphs)
const GLYPH: Record<string, string[]> = {
  K: ['1001', '1010', '1100', '1010', '1001'],
  I: ['111', '010', '010', '010', '111'],
  T: ['111', '010', '010', '010', '010'],
  W: ['10001', '10001', '10101', '10101', '01010'],
  A: ['0110', '1001', '1111', '1001', '1001'],
  E: ['1111', '1000', '1110', '1000', '1111'],
  P: ['1110', '1001', '1110', '1000', '1000'],
  Z: ['1111', '0010', '0100', '1000', '1111'],
  '6': ['0110', '1000', '1110', '1001', '0110'],
  '7': ['1111', '0001', '0010', '0100', '0100'],
};
function pixelText(b: PixelBuffer, text: string, x: number, y: number, c: C, shadow?: C) {
  let cx = x;
  for (const ch of text) {
    const g = GLYPH[ch];
    if (!g) { cx += 3; continue; }
    for (let r = 0; r < g.length; r++)
      for (let k = 0; k < g[r].length; k++)
        if (g[r][k] === '1') {
          if (shadow !== undefined) b.set(cx + k + 1, y + r + 1, shadow);
          b.set(cx + k, y + r, c);
        }
    cx += g[0].length + 1;
  }
  return cx - x;
}

// ------------------------------------------------------------------ exterior

interface PaintOpts { storm?: boolean }

/** Hull topsides, rub rail, boot stripe, bottom paint, planking and weathering. */
function paintHullSkin(b: PixelBuffer, rng: Rng) {
  const M = hullMask();
  const bootTop = (x: number) => 195 - smoothstep(470, 540, x) * 3 - smoothstep(80, 34, x) * 2;
  const bootBot = (x: number) => bootTop(x) + 8;
  for (let y = 0; y < BOAT_H; y++)
    for (let x = 0; x < BOAT_W; x++) {
      if (!M.at(x, y)) continue;
      const dk = deckY(x);
      const sh = sheerY(x);
      const b0 = bootTop(x), b1 = bootBot(x);
      let c: C;
      if (y < dk + 1) {
        // bulwark: bright, with the stays showing as faint vertical ribs
        let f = 5.3 - (y - sh) * 0.05;
        if ((Math.round(x) - 30) % 22 === 0 && y > sh + 3) f -= 0.9;
        c = ramp(P.cream, f + dith(x, y, 0.3));
      } else if (y < b0) {
        // cream topsides: light under the rail, rolling into shadow toward the turn of the bilge,
        // a little bounce light off the water just above the boot top
        const t = (y - dk) / (b0 - dk);
        const bowFlare = smoothstep(440, 540, x) * (0.7 - t * 1.3);
        const sternTurn = smoothstep(90, 30, x) * -0.4;
        let f = 5.1 - t * 1.1 - smoothstep(0.5, 1, t) * 1.5 + bowFlare + sternTurn + smoothstep(0.9, 1, t) * 0.7;
        const py = y - dk - 6;
        const seam = py > 2 && (((Math.round(py) % 8) + 8) % 8) === 0;
        const plank = Math.floor(py / 8);
        const butt = py > 2 && ((Math.round(x) + plank * 57) % 83) === 0;
        c = ramp(P.cream, f + dith(x, y, 0.32));
        if (seam || butt) c = shade(c, -0.14);
      } else if (y < b1) {
        const t = (y - b0) / (b1 - b0);
        c = ramp(P.red, 3.9 - t * 1.9 + dith(x, y, 0.3));
        if (y - b0 < 1) c = P.red[5];
      } else {
        const t = (y - b1) / (KEEL - b1);
        c = ramp(P.bottom, 3.6 - t * 2.6 + dith(x, y, 0.35));
        if (y - b1 < 1) c = P.bottom[5];
      }
      b.set(x, y, c);
    }
  // rub rail at deck level and cap rail at the sheer
  for (let x = STERN_X; x <= BOW_X; x++) {
    const dk = Math.round(deckY(x)), sh = Math.round(sheerY(x));
    if (!M.at(x, dk + 3)) continue;
    b.set(x, dk + 1, P.varnish[5]);
    b.set(x, dk + 2, P.varnish[4]);
    b.set(x, dk + 3, P.varnish[2]);
    b.set(x, dk + 4, P.cream[2]);
    b.set(x, sh - 1, P.varnish[6]);
    b.set(x, sh, P.varnish[5]);
    b.set(x, sh + 1, P.varnish[3]);
    b.set(x, sh + 2, P.cream[3]);
  }
  // freeing ports with rust streaks
  for (const fx of [62, 182, 372, 476]) {
    const dk = Math.round(deckY(fx));
    b.rect(fx, dk - 4, 7, 3, P.bottom[0]);
    hline(b, fx, fx + 6, dk - 5, P.cream[3]);
    rustStreak(b, fx + 3, dk + 5, rng.int(10, 22), rng);
  }
  // barnacle clusters and weed along the waterline, thickest at the bow and stern
  for (let i = 0; i < 46; i++) {
    const x = i < 14 ? rng.range(36, 120) : i < 30 ? rng.range(440, 530) : rng.range(120, 440);
    const cy = WATERLINE - 6 + rng.range(-1, 5);
    const n = rng.int(3, 9);
    for (let k = 0; k < n; k++) {
      const px = Math.round(x + rng.range(-3, 3)), py = Math.round(cy + rng.range(-2, 2));
      if (!M.at(px, py)) continue;
      const v = rng.next();
      b.set(px, py, v < 0.35 ? P.white[3] : v < 0.75 ? P.white[1] : P.white[0]);
      if (v < 0.2) b.set(px + 1, py, P.white[2]);
    }
    if (rng.chance(0.55)) {
      const wx = Math.round(x + rng.range(-4, 4));
      const L = rng.int(2, 6);
      for (let k = 0; k < L; k++) if (M.at(wx, cy + 3 + k)) b.set(wx + (k > 2 ? 1 : 0), cy + 3 + k, P.green[k < 2 ? 3 : 2]);
    }
  }
  // chipped paint near the bow and waterline
  for (let i = 0; i < 26; i++) {
    const x = rng.chance(0.6) ? rng.range(470, 540) : rng.range(40, 470);
    const y = rng.range(150, 192);
    if (!M.at(x, y) || !M.at(x + 2, y)) continue;
    b.set(x, y, P.cream[2]);
    b.set(x + 1, y, P.wood[3]);
  }
  // salt/dirt streaks under the rub rail
  for (let i = 0; i < 38; i++) {
    const x = Math.round(rng.range(34, 540));
    const y0 = deckY(x) + 5;
    const L = rng.int(6, 26);
    for (let k = 0; k < L; k++) {
      if (!M.at(x, y0 + k) || y0 + k > 190) break;
      const cur = b.get(x, y0 + k);
      b.set(x, y0 + k, mix(cur, P.cream[1], 0.22 * (1 - k / L)));
    }
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
  // skeg: the keel carried aft to support the rudder heel
  for (let x = 38; x < 114; x++) {
    b.set(x, KEEL, P.bottom[0]);
    b.set(x, KEEL - 1, x < 60 ? P.bottom[1] : P.bottom[2]);
  }
  // sternpost
  b.rectFn(64, 206, 4, 24, (x, y) => ramp(P.bottom, 2.6 - (x - 64) * 0.4 + dith(x, y, 0.3)));
  // rudder blade hung under the counter, rounded trailing edge
  b.polyFn([40, 196, 55, 198, 57, 228, 42, 228, 38, 222, 37, 204], (x, y) => ramp(P.bottom, 3.4 - (y - 196) * 0.05 - (x - 37) * 0.07 + dith(x, y, 0.4)));
  vline(b, 55, 199, 227, P.bottom[0]);
  b.rect(46, 194, 5, 3, P.metal[3]);
  // propeller in the aperture (two blades side on) with boss and shaft
  b.polyFn([59, 204, 63, 204, 63, 213, 59, 213], (x, y) => ramp(P.brass, 4 - (y - 204) * 0.2 + dith(x, y, 0.4)));
  b.polyFn([59, 217, 63, 217, 64, 227, 58, 227], (x, y) => ramp(P.brass, 2.8 - (y - 217) * 0.12 + dith(x, y, 0.4)));
  b.rect(58, 213, 7, 4, P.brass[2]);
  hline(b, 58, 64, 213, P.brass[4]);
}

/** Wheelhouse exterior shell: walls, windows, trim, roof and roof gear. */
function paintWheelhouseShell(b: PixelBuffer, cut: boolean, rng: Rng) {
  const x0 = WH_X0, x1 = WH_X1;
  const top = WH_ROOF;
  const frontTop = x1 + 6; // front wall rakes forward
  const baseY = 116;
  // walls
  if (!cut) {
    b.polyFn([x0, baseY, x0, top + 6, frontTop, top + 6, x1, baseY], (x, y) => {
      const t = (y - top) / (baseY - top);
      let f = 4.8 - t * 1.4 + (x < x0 + 3 ? 0.8 : 0);
      if (x > x1 - 3 + (baseY - y) * ((frontTop - x1) / (baseY - top))) f -= 1;
      // vertical tongue-and-groove boards on the lower wall
      if (y > 72 && (x - x0) % 5 === 0) f -= 0.6;
      return ramp(P.cream, f + dith(x, y, 0.5));
    });
    // trim bands
    for (let x = x0; x <= frontTop; x++) {
      const yb = top + 6;
      b.set(x, yb, P.varnish[3]);
      b.set(x, yb + 1, P.varnish[5]);
    }
    for (let x = x0; x <= x1 + 1; x++) {
      b.set(x, 70, P.varnish[4]);
      b.set(x, 71, P.varnish[2]);
    }
    // three big side windows
    for (const wx of [228, 260, 292]) {
      const ww = 26, wy = 34, wh = 30;
      b.rectFn(wx - 1, wy - 1, ww + 2, wh + 2, (x, y) => (x === wx - 1 || y === wy - 1 ? P.varnish[5] : P.varnish[2]));
      b.rectFn(wx, wy, ww, wh, (x, y) => {
        const u = (x - wx) / ww, v = (y - wy) / wh;
        const refl = u + v * 0.6;
        let f = 1.2 + v * 0.8;
        if (refl > 0.25 && refl < 0.38) f = 4;
        else if (refl > 0.44 && refl < 0.48) f = 3.2;
        if (v > 0.8) f -= 0.6;
        return ramp(P.glass, f + dith(x, y, 0.4));
      });
      // window frame corners rounded
      for (const [cx, cy] of [[wx, wy], [wx + ww - 1, wy], [wx, wy + wh - 1], [wx + ww - 1, wy + wh - 1]]) b.set(cx, cy, P.varnish[3]);
      // wiper blade on the middle window
      if (wx === 260) rope(b, wx + 13, wy + wh - 2, wx + 4, wy + 10, 0, P.metal[2]);
    }
    // lifebuoy on the forward panel and a name board
    lifebuoy(b, 326, 84, 7);
    b.rect(236, 78, 46, 9, P.varnish[2]);
    b.rect(237, 79, 44, 7, P.varnish[4]);
    hline(b, 237, 280, 79, P.varnish[6]);
    pixelText(b, 'KITTIWAKE', 239, 80, P.cream[6]);
  }
  // roof slab with sun visor
  b.polyFn([x0 - 5, top, frontTop + 8, top, frontTop + 10, top + 6, x0 - 5, top + 6], (x, y) => {
    const f = y === top ? 5.5 : y === top + 1 ? 4.6 : 3.2 - (y - top) * 0.4;
    return ramp(P.cream, f + dith(x, y, 0.4));
  });
  hline(b, x0 - 5, frontTop + 10, top + 6, P.cream[1]);
  // roof gear: funnel, life raft canister, antennas, radar post, horn, searchlight
  // funnel (exhaust stack)
  b.rectFn(221, 3, 12, top - 3, (x, y) => {
    let f = 4.4 - (x - 221) * 0.25;
    if (y < 6) return ramp(P.metal, 1.4 - (x - 221) * 0.08);
    if (y >= 8 && y < 11) return ramp(P.red, 4 - (x - 221) * 0.25 + dith(x, y));
    return ramp(P.cream, f + dith(x, y, 0.5));
  });
  hline(b, 220, 233, 3, P.metal[1]);
  // soot streak
  for (let y = 6; y < 13; y++) b.set(231, y, mix(b.get(231, y), P.metal[1], 0.5));
  // life raft canister
  b.rectFn(256, 9, 22, 8, (x, y) => {
    const t = (y - 9) / 7;
    const cap = x < 259 || x > 274;
    return ramp(P.white, (cap ? 3.4 : 3.8) - t * 2 + dith(x, y, 0.4));
  });
  hline(b, 266, 267, 9, P.red[4]);
  b.set(266, 12, P.red[3]); b.set(267, 12, P.red[3]);
  for (const x of [258, 275]) vline(b, x, 16, top, P.metal[3]);
  // VHF whips
  for (const [ax, lean] of [[243, -0.08], [250, 0.05]]) {
    for (let y = 0; y < top; y++) b.set(Math.round(ax + (top - y) * (lean as number)), y, y < 3 ? P.metal[5] : P.metal[3]);
    b.set(ax as number, top - 1, P.metal[1]);
  }
  // radar post (scanner is an animated part; frame 0 baked by paintBoatExterior)
  b.rect(290, 9, 5, top - 9, P.metal[4]);
  vline(b, 290, 9, top - 1, P.metal[6]);
  b.rect(287, 14, 11, 3, P.metal[3]);
  // brass horn
  b.polyFn([312, 12, 320, 10, 320, 15, 312, 14], (x, y) => ramp(P.brass, 4 - (y - 10) * 0.4 + dith(x, y)));
  vline(b, 314, 15, top - 1, P.metal[3]);
  // searchlight on a bracket at the front of the roof
  b.rect(330, 9, 9, 7, P.metal[3]);
  b.rect(331, 10, 7, 5, P.metal[5]);
  b.rect(338, 10, 2, 5, P.brass[5]);
  b.set(339, 11, P.white[4]);
  vline(b, 334, 16, top - 1, P.metal[2]);
  void rng;
}

/** Foremast with crosstrees, lights, derrick boom and rigging. */
function paintMastAndRig(b: PixelBuffer, storm: boolean, rng: Rng) {
  const mx = 424, base = Math.round(deckY(mx)), top = 8;
  // rigging first (behind the mast)
  const tip: [number, number] = [584, 84];
  rope(b, mx, top + 2, tip[0], tip[1], 3, P.metal[3]); // forestay
  rope(b, mx - 1, top + 2, WH_X1 + 12, WH_ROOF + 1, 2, P.metal[3]); // triatic stay to wheelhouse
  rope(b, mx - 1, 40, 398, Math.round(sheerY(398)) - 1, 1, P.metal[4]); // shrouds
  rope(b, mx + 1, 40, 452, Math.round(sheerY(452)) - 1, 1, P.metal[4]);
  rope(b, mx - 1, 40, 386, Math.round(sheerY(386)) - 1, 1, P.metal[3]);
  // signal halyard with small flags
  rope(b, mx + 2, 42, 540, Math.round(sheerY(540)) - 2, 7, P.rope[3]);
  const flagC = [P.red[4], P.yellow[5], P.navy[4], P.white[4], P.green[4]];
  for (let i = 0; i < 9; i++) {
    const t = (i + 1) / 10;
    const x = mx + 2 + (540 - mx - 2) * t, y = 42 + (sheerY(540) - 2 - 42) * t + Math.sin(t * Math.PI) * 7;
    const c = flagC[i % flagC.length];
    b.poly([x, y, x + 4, y, x + 2, y + 4], c);
  }
  // mast pole: white-painted steel, lit from the left
  for (let y = top; y <= base; y++) {
    b.set(mx - 1, y, P.cream[6]);
    b.set(mx, y, P.cream[4]);
    b.set(mx + 1, y, P.cream[2]);
  }
  // crosstrees and platform
  b.rect(mx - 12, 39, 25, 2, P.metal[4]);
  hline(b, mx - 12, mx + 12, 39, P.metal[6]);
  // lights: masthead lamp, radar reflector, floodlight
  b.rect(mx - 2, top - 3, 5, 4, P.metal[2]);
  b.rect(mx - 1, top - 2, 3, 2, P.white[4]);
  b.poly([mx - 5, 26, mx, 20, mx + 5, 26, mx, 32], P.metal[5]); // radar reflector diamond
  b.poly([mx - 3, 26, mx, 23, mx + 3, 26, mx, 29], P.metal[3]);
  b.rect(mx + 2, 56, 6, 4, P.metal[3]);
  b.rect(mx + 7, 56, 2, 4, P.yellow[6]);
  // mast collar and base plate
  b.rect(mx - 3, base - 4, 7, 4, P.metal[3]);
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

/** Stern crane (davit), flagstaff, stern light. */
function paintSternGear(b: PixelBuffer, rng: Rng) {
  const cx = 66, dk = Math.round(deckY(cx));
  // pedestal
  b.rectFn(cx - 3, dk - 30, 7, 30, (x, y) => ramp(P.yellow, (x === cx - 3 ? 6 : x > cx + 1 ? 2.6 : 4.4) - (y - (dk - 30)) * 0.02 + dith(x, y, 0.3)));
  b.rect(cx - 5, dk - 4, 11, 4, P.metal[3]);
  hline(b, cx - 5, cx + 5, dk - 4, P.metal[5]);
  // slewing head
  b.rect(cx - 4, dk - 34, 9, 5, P.yellow[3]);
  hline(b, cx - 4, cx + 4, dk - 34, P.yellow[5]);
  // boom reaching up and aft over the transom
  const bx0 = cx, by0 = dk - 32, bx1 = 34, by1 = 50;
  const n = 60;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = bx0 + (bx1 - bx0) * t, y = by0 + (by1 - by0) * t;
    b.set(x, y - 1, P.yellow[6]);
    b.set(x, y, P.yellow[4]);
    b.set(x, y + 1, P.yellow[2]);
  }
  // hydraulic ram
  rope(b, cx + 1, dk - 18, (bx0 + bx1) / 2 + 4, (by0 + by1) / 2 + 1, 0, P.metal[5]);
  rope(b, cx + 2, dk - 18, (bx0 + bx1) / 2 + 5, (by0 + by1) / 2 + 2, 0, P.metal[3]);
  // sheave, wire and hook
  b.disc(bx1, by1, 2.4, P.metal[3]);
  b.set(bx1 - 1, by1 - 1, P.metal[6]);
  vline(b, bx1, by1 + 2, by1 + 30, P.metal[2]);
  b.rect(bx1 - 1, by1 + 30, 3, 3, P.yellow[4]);
  b.set(bx1 - 2, by1 + 34, P.metal[4]); b.set(bx1 - 2, by1 + 35, P.metal[4]); b.set(bx1 - 1, by1 + 36, P.metal[4]); b.set(bx1, by1 + 35, P.metal[4]);
  // flagstaff at the taffrail (the flag itself is an animated part)
  const fx = 24;
  for (let y = 58; y < sheerY(fx); y++) b.set(fx, y, y < 60 ? P.brass[5] : P.varnish[4]);
  b.disc(fx, 57, 1.2, P.brass[5]);
  // stern light
  b.rect(fx + 2, 86, 3, 3, P.white[4]);
  void rng;
}

/** Bowsprit pulpit, anchor, hawse, fairleads. */
function paintBowGear(b: PixelBuffer, rng: Rng) {
  const sh = Math.round(sheerY(BOW_X));
  // bowsprit platform
  b.polyFn([546, sh + 1, 586, 83, 586, 86, 546, sh + 6], (x, y) => ramp(P.varnish, 5 - (y - 83) * 0.5 + dith(x, y)));
  hline(b, 548, 586, 82, P.varnish[6]);
  // pulpit rail
  for (let x = 552; x <= 584; x += 8) vline(b, x, 72, 83, P.metal[5]);
  rope(b, 540, sh - 10, 584, 72, 1, P.metal[6]);
  rope(b, 540, sh - 5, 584, 78, 1, P.metal[4]);
  // bobstay to the stem
  rope(b, 584, 86, 548, 128, 0, P.metal[3]);
  // hawsepipe and stockless anchor
  const ax = 522, ay = 112;
  // hawse pipe with a rust stain, the stockless anchor stowed in it
  b.ellipseFn(ax, ay, 5, 3.5, (x, y, nx, ny) => (Math.hypot(nx, ny) > 0.62 ? ramp(P.metal, 3 - ny * 1.5) : P.metal[0]));
  rustStreak(b, ax - 3, ay + 4, 30, rng);
  rustStreak(b, ax + 3, ay + 4, 18, rng);
  b.rectFn(ax - 1, ay + 1, 4, 20, (x, y) => ramp(P.metal, x === ax - 1 ? 6 : x === ax + 2 ? 2 : 4));
  // crown and flukes
  b.polyFn([ax - 9, ay + 19, ax + 10, ay + 19, ax + 8, ay + 23, ax + 4, ay + 28, ax + 1, ay + 23, ax - 3, ay + 28, ax - 7, ay + 23], (x, y) => ramp(P.metal, 4.5 - (y - ay - 19) * 0.35 - (x - ax) * 0.05 + dith(x, y, 0.4)));
  hline(b, ax - 8, ax + 9, ay + 19, P.metal[6]);
  b.rect(ax - 1, ay + 17, 4, 3, P.metal[3]);
  // chain over the bulwark
  for (let i = 0; i < 7; i++) b.set(ax + 1 + i, ay - 3 - i, i % 2 ? P.metal[5] : P.metal[3]);
}

/** Tyre fenders hanging on the topsides. */
function paintFenders(b: PixelBuffer) {
  for (const fx of [146, 258, 358]) {
    const sh = Math.round(sheerY(fx));
    vline(b, fx, sh + 1, sh + 12, P.rope[3]);
    tyre(b, fx, sh + 17, 6);
  }
}

/** Exterior portholes along the lower deck. */
const PORTHOLES: [number, number][] = [[92, 146], [272, 146], [318, 146], [388, 140], [446, 142]];

/** Deck gear that shows above the bulwark in exterior view. */
function paintDeckGearExterior(b: PixelBuffer) {
  // net heap aft with floats
  const dk = Math.round(deckY(86));
  b.ellipseFn(86, dk - 2, 24, 12, (x, y, nx, ny) => (ny > 0.1 ? -1 : ramp(P.net, 3 - ny * 1.5 - nx * 0.8 + dith(x, y, 1))));
  for (const [x, y] of [[74, dk - 8], [90, dk - 11], [100, dk - 6]]) {
    b.disc(x, y, 2, P.yellow[5]);
    b.set(x - 1, y - 1, P.yellow[6]);
  }
  // windlass drum peeking over the foredeck bulwark
  const wx = 500, wd = Math.round(deckY(wx));
  b.rect(wx - 8, wd - 16, 16, 8, P.green[3]);
  b.rect(wx - 8, wd - 16, 16, 2, P.green[5]);
  b.disc(wx + 10, wd - 13, 3, P.metal[4]);
}

/** Paint the full exterior into `b`. Returns the near-bulwark front layer as well. */
function paintExterior(storm: boolean): { buf: PixelBuffer; back: PixelBuffer; front: PixelBuffer; glow: PixelBuffer } {
  const rng = new Rng(4242);
  const back = new PixelBuffer(BOAT_W, BOAT_H);
  // things behind the hull: rigging, mast, wheelhouse, roof gear, deck gear
  paintMastAndRig(back, storm, rng);
  paintWheelhouseShell(back, false, rng);
  paintSternGear(back, rng);
  paintDeckGearExterior(back);
  // the hull (near side) is the front layer in exterior shots
  const front = new PixelBuffer(BOAT_W, BOAT_H);
  paintHullSkin(front, rng);
  paintRunningGear(front);
  paintBowGear(front, rng);
  paintFenders(front);
  for (const [px, py] of PORTHOLES) porthole(front, px, py, 5);
  // KITTIWAKE on the bow
  pixelText(front, 'KITTIWAKE', 470, 116, P.navy[1], P.cream[2]);
  pixelText(front, 'PZ 67', 486, 124, P.navy[2]);
  // a few rust streaks from portholes
  for (const [px, py] of PORTHOLES) if (rng.chance(0.6)) rustStreak(front, px + rng.int(-2, 2), py + 6, rng.int(6, 14), rng);
  front.outline(OL);
  back.outline(OLc);
  const buf = back.clone();
  buf.blit(front, 0, 0);
  // glow: windows and lights (the scene decides when they are lit)
  const glow = new PixelBuffer(BOAT_W, BOAT_H);
  for (const wx of [228, 260, 292]) glow.rectFn(wx, 34, 26, 30, (x, y) => rgba(255, 214, 150, y > 50 ? 170 : 110 + ((x + y) & 1) * 30));
  for (const [px, py] of PORTHOLES) glow.discFn(px, py, 3.4, () => rgba(255, 210, 140, 200));
  glow.rect(423, 6, 3, 2, rgba(255, 255, 240, 255));
  glow.rect(430, 56, 2, 4, rgba(255, 250, 220, 255));
  glow.rect(26, 86, 3, 3, rgba(255, 255, 235, 255));
  if (storm) wetSheen(buf, 1), wetSheen(back, 1), wetSheen(front, 1);
  return { buf, back, front, glow };
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

/** The Kittiwake after the storm: heeled over on the shore rocks, bow torn off, mast snapped. */
export function paintWreck(): Sprite {
  const e = paintExterior(true);
  const src = e.buf;
  const W = 560, H = 300, rot = -0.2;
  const out = new PixelBuffer(W, H);
  const cx = 300, cy = 206, ox = 270, oy = 230;
  const c = Math.cos(rot), s = Math.sin(rot);
  const rng = new Rng(77);
  // inverse-map every destination pixel into the boat sprite (heeled and settled on the rocks)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x - ox, dy = y - oy;
      const sx = Math.round(c * dx + s * dy + cx), sy = Math.round(-s * dx + c * dy + cy);
      if (sx < 0 || sy < 0 || sx >= src.w || sy >= src.h) continue;
      let col = src.data[sy * src.w + sx];
      if (!(col >>> 24)) continue;
      // torn-off bow: jagged break line
      const brk = 452 + Math.sin(sy * 0.9) * 6 + (hash2(sy, 3, 9) - 0.5) * 10;
      if (sx > brk) continue;
      // snapped foremast and wheelhouse roof caved in
      if (sy < 30 && sx > 380) continue;
      if (sy < 22 && sx > 210 && sx < 340 && hash2(sx >> 2, sy >> 2, 4) > 0.45) continue;
      // holes stove in along the waterline
      const hole = (sx > 150 && sx < 175 && sy > 150 && sy < 175) || (sx > 330 && sx < 350 && sy > 165 && sy < 190);
      if (hole) { col = hex('#0e0a08'); }
      // weathering: dark wet band, green weed on the bottom, scorched streaks
      const wet = smoothstep(150, 225, sy);
      col = mix(col, hex('#1c2420'), wet * 0.45);
      if (sy > 190 && hash2(sx, sy, 5) > 0.6) col = mix(col, hex('#3a5a2a'), 0.6);
      if (hash2(sx >> 3, sy, 2) > 0.93) col = shade(col, -0.25);
      out.data[y * W + x] = col;
    }
  // splintered planks at the break
  for (let i = 0; i < 26; i++) {
    const y = rng.int(60, 250), x = rng.int(380, 420);
    for (let k = 0; k < rng.int(4, 12); k++) out.set(x + k, y - k * 0.3, P.wood[rng.int(2, 6)]);
  }
  // rocks it is stuck on
  for (let i = 0; i < 12; i++) {
    const rx = 40 + i * 45 + rng.range(-12, 12), ry = H - 8 - rng.range(0, 10), rr = rng.range(16, 34);
    for (let y = -rr; y < rr * 0.6; y++)
      for (let x = -rr * 1.3; x < rr * 1.3; x++) {
        const d = (x / (rr * 1.3)) ** 2 + (y / rr) ** 2;
        if (d > 1) continue;
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

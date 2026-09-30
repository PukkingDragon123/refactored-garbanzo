// art/boatKit.ts: shared palettes, hull geometry and small raster helpers for the Kittiwake
// (exterior in boat.ts, the cutaway rooms in boatInterior.ts).
//
// Palettes are hand-picked hue-shifted ramps (dark -> light): shadows lean cool (blue / violet),
// lights lean warm (yellow / cream), so every material keeps its colour through the value range.

import { PixelBuffer } from './pixel';
import { C, hex, mix, shade } from './color';
import { bayer, clamp, noise1 } from '../core/math';
import { obj, Obj } from './ship4/kit';

export const BOAT_W = 600;
export const BOAT_H = 236;
export const WATERLINE = 206;
export const PIVOT: [number, number] = [300, 206];
export const KEEL = 230;

// ------------------------------------------------------------------ palettes (dark -> light)

export const hx = (...s: string[]): C[] => s.map(v => hex(v));
export const P = {
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
  // --- interior materials (the back walls sit a step darker than the props in front of them)
  steelW: hx('#11181c', '#182226', '#202d31', '#2a3a3c', '#364947', '#455a54', '#586f65'),
  lag: hx('#48443e', '#686357', '#8b8574', '#aea791', '#cdc6ae', '#e6e0c8'),
  copper: hx('#2e140d', '#4f2415', '#74381e', '#98502a', '#b86a38', '#d58b4f', '#ebb27a'),
  pipeRed: hx('#2a0f12', '#4a171a', '#6e2322', '#93322b', '#b44a38', '#cf6a4c'),
  tile: hx('#3d4543', '#556060', '#707c78', '#8d9890', '#a9b2a6', '#c4cbbd', '#dde0d0'),
  sage: hx('#161f1e', '#1f2b29', '#2a3833', '#36473f', '#44574b', '#566a59'),
  ochre: hx('#241c17', '#33281f', '#453628', '#584533', '#6c5540', '#82674e'),
  mahog: hx('#1c0e0e', '#2e1612', '#421f17', '#582a1e', '#6f3726', '#884830', '#a15d3d', '#bb7a50'),
  teakW: hx('#1b1311', '#281c16', '#37271d', '#483325', '#5a402d', '#6e4f37'),
  plankH: hx('#15120f', '#1f1a15', '#2b241c', '#393026', '#493d30', '#5b4c3b', '#705e49'),
  paper: hx('#6f6552', '#948a73', '#b5ab90', '#d2c8aa', '#e9e0c4', '#f7f1dc'),
  gingham: hx('#5a1a1c', '#8e2a26', '#b8412f', '#e3dccb', '#f6f1e2'),
  mustard: hx('#3a2a0c', '#5e4512', '#86641c', '#ab8428', '#c9a23c', '#e0c060'),
  moss: hx('#18200f', '#243016', '#34431d', '#465826', '#5b6f30', '#76883c'),
  grime: hx('#1a1a12', '#26261a', '#343222', '#44402c'),
  orange: hx('#3d1a08', '#6a2e0d', '#984414', '#c45c1c', '#e27a2c', '#f59e4c'),
  plum: hx('#231526', '#3a2140', '#553160', '#71447e', '#8e5d9a'),
};
export const OL = hex('#15100c');
export const OLc = hex('#0d1215');
export const INK = hex('#1a1014');

// ------------------------------------------------------------------ geometry (boat-local px)

/** Walkable main-deck surface y (top of the planking). */
export function deckY(x: number): number {
  if (x < 300) return 116 - 4 * Math.pow((300 - x) / 276, 2);
  return 116 - 18 * Math.pow(clamp((x - 300) / 250), 2.2);
}
/** Top of the bulwark cap rail. */
export const sheerY = (x: number) => deckY(x) - 13;

export const STERN_X = 24;
export const BOW_X = 551;

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
export class Mask {
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
export function hullMask() {
  return (HULL ??= Mask.poly(BOAT_W, BOAT_H, hullPoly()));
}

// Key interior dimensions
export const WH_X0 = 214, WH_X1 = 334, WH_FLOOR = 102, WH_CEIL = 24, WH_ROOF = 17;
export const LOW_FLOOR = 202, LOW_CEIL = 122, HOLD_FLOOR = 196;
export const BH = { engAft: 76, engGal: 196, galBunk: 336, bunkHold: 424, holdFwd: 496 };

/** Ceiling of the lower deck (underside of the main deck planking). */
export const lowCeil = (x: number) => Math.round(deckY(x)) + 6;

// ------------------------------------------------------------------ small painting helpers

export const ramp = (r: C[], f: number) => r[clamp(Math.round(f), 0, r.length - 1)];
export const dith = (x: number, y: number, k = 0.8) => (bayer(x, y) - 0.5) * k;

export function rectRamp(b: PixelBuffer, x: number, y: number, w: number, h: number, r: C[], base: number, vert = 0.3, noiseK = 0) {
  b.rectFn(x, y, w, h, (px, py) => {
    const t = (py - y) / Math.max(1, h - 1);
    let f = base + (0.5 - t) * vert * (r.length - 1);
    if (noiseK) f += (noise1(px * 0.7 + py * 13.1, 3) - 0.5) * noiseK;
    return ramp(r, f + dith(px, py, 0.6));
  });
}

export function vline(b: PixelBuffer, x: number, y0: number, y1: number, c: C) {
  for (let y = Math.round(Math.min(y0, y1)); y <= Math.round(Math.max(y0, y1)); y++) b.set(x, y, c);
}
export function hline(b: PixelBuffer, x0: number, x1: number, y: number, c: C) {
  for (let x = Math.round(Math.min(x0, x1)); x <= Math.round(Math.max(x0, x1)); x++) b.set(x, y, c);
}
/** Darken / lighten what is already there (only on opaque pixels). */
export function tint(b: PixelBuffer, x: number, y: number, c: C, k: number) {
  const cur = b.get(x, y);
  if (cur >>> 24) b.set(x, y, mix(cur, c, k));
}
export function shadeAt(b: PixelBuffer, x: number, y: number, amt: number) {
  const cur = b.get(x, y);
  if (cur >>> 24) b.set(x, y, shade(cur, amt));
}

/** Rope / wire with catenary sag. */
export function rope(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, sag: number, c: C, c2?: C) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.4);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag;
    b.set(x, y, c2 && i % 3 === 0 ? c2 : c);
  }
}
/** Heavier line: a lit core pixel with a shadow pixel under it (wire stays, pipes seen at a distance). */
export function rope2(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, sag: number, c: C, cHi: C) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.4);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag;
    b.set(x, y + 1, c);
    b.set(x, y, cHi);
  }
}
/** Laid rope with a visible twist (alternating light / dark pixels). */
export function laidRope(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, sag: number, r: C[] = P.rope) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.2);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag;
    b.set(x, y, r[(Math.floor(i / 1.2) % 3) === 0 ? 4 : 2]);
  }
}

/** Filled ring (lifebuoy, tyre, porthole rim). */
export function ring(b: PixelBuffer, cx: number, cy: number, r0: number, r1: number, fn: (a: number, t: number, x: number, y: number) => C | -1) {
  for (let y = Math.floor(cy - r1 - 1); y <= cy + r1 + 1; y++)
    for (let x = Math.floor(cx - r1 - 1); x <= cx + r1 + 1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d < r0 || d > r1) continue;
      const c = fn(Math.atan2(y + 0.5 - cy, x + 0.5 - cx), (d - r0) / Math.max(0.01, r1 - r0), x, y);
      if (c !== -1) b.set(x, y, c);
    }
}

export function lifebuoy(b: PixelBuffer, cx: number, cy: number, r = 7) {
  ring(b, cx, cy, r * 0.48, r, (a, t, x, y) => {
    const seg = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8 + 0.5) % 2;
    const base = seg ? P.red : P.white;
    const lit = -Math.cos(a + 2.4) * 0.6 + (0.5 - Math.abs(t - 0.45)) * 1.4;
    return ramp(base, 2.1 + lit * 2 + dith(x, y, 0.4));
  });
  // inner shadow and the grab line looped round the ring in four places
  ring(b, cx, cy, r * 0.48, r * 0.48 + 0.9, (a) => (Math.sin(a) < 0.2 ? P.red[0] : -1));
  for (let k = 0; k < 4; k++) {
    const a = k * (Math.PI / 2) + Math.PI / 4;
    const x = cx + Math.cos(a) * (r + 0.4), y = cy + Math.sin(a) * (r + 0.4);
    b.set(x, y, P.rope[4]);
    b.set(cx + Math.cos(a) * (r * 0.72), cy + Math.sin(a) * (r * 0.72), P.rope[3]);
  }
  for (let k = 0; k < 4; k++) {
    const a0 = k * (Math.PI / 2) + Math.PI / 4, a1 = a0 + Math.PI / 2;
    for (let s = 0.15; s < 0.85; s += 0.12) {
      const a = a0 + (a1 - a0) * s;
      b.set(cx + Math.cos(a) * (r + 1.1), cy + Math.sin(a) * (r + 1.1), (s * 10 | 0) % 2 ? P.rope[3] : P.rope[2]);
    }
  }
}

export function tyre(b: PixelBuffer, cx: number, cy: number, r = 6) {
  ring(b, cx, cy, r * 0.45, r, (a, t, x, y) => {
    let f = 1.8 - Math.cos(a + 2.2) * 1.5 + (t > 0.8 ? -0.6 : 0) + dith(x, y, 0.4);
    // tread blocks round the outer edge
    if (t > 0.72 && Math.floor((a + Math.PI) * 5) % 2 === 0) f -= 0.9;
    if (t < 0.18) f += 0.5; // bead lip catching light
    return ramp(P.tyre, f);
  });
}

/** Brass-rimmed porthole with a rubber seal, sky reflection, a hard glint and bolt heads. */
export function porthole(b: PixelBuffer, cx: number, cy: number, r = 5, glass: C | null = null, lit = false, inside = false) {
  // outer rim with a bright arc top-left and a deep shadow bottom-right
  ring(b, cx, cy, r - 1.8, r + 0.3, (a, t, x, y) => {
    const l = -Math.cos(a + 2.35);
    let f = 3.2 + l * 2 + (t > 0.75 ? -0.8 : t < 0.25 ? 0.4 : 0) + dith(x, y, 0.3);
    if (l > 0.82 && t > 0.3 && t < 0.7) f = 6;
    return ramp(P.brass, f);
  });
  // rubber seal
  ring(b, cx, cy, r - 2.4, r - 1.8, () => P.metal[1]);
  b.discFn(cx, cy, r - 2.4, (x, y, nx, ny) => {
    if (glass !== null) return glass;
    if (lit) return ramp(P.yellow, 4.5 - ny * 1.5);
    // sky gradient over sea (outside) or the dim cabin (inside), with a diagonal glint
    const d = nx + ny;
    if (d < -0.95 && d > -1.35) return P.glass[5];
    if (Math.abs(d + 0.25) < 0.14) return P.glass[4];
    const g = inside ? (ny < 0.1 ? 3.4 : 2.4) : ny < -0.2 ? 2.8 : ny < 0.35 ? 1.8 : 1.1;
    return ramp(P.glass, g + dith(x, y, 0.5));
  });
  // bolts
  const n = r >= 6 ? 8 : 6;
  for (let k = 0; k < n; k++) {
    const a = k * ((Math.PI * 2) / n) + 0.3;
    b.set(cx + Math.cos(a) * (r - 0.6), cy + Math.sin(a) * (r - 0.6), Math.sin(a + 0.8) < 0 ? P.brass[6] : P.brass[1]);
  }
}

// pixel font (3x5 / 4x5 / 5x5 glyphs)
const GLYPH: Record<string, string[]> = {
  A: ['0110', '1001', '1111', '1001', '1001'],
  B: ['1110', '1001', '1110', '1001', '1110'],
  C: ['0111', '1000', '1000', '1000', '0111'],
  D: ['1110', '1001', '1001', '1001', '1110'],
  E: ['1111', '1000', '1110', '1000', '1111'],
  F: ['1111', '1000', '1110', '1000', '1000'],
  G: ['0111', '1000', '1011', '1001', '0111'],
  H: ['1001', '1001', '1111', '1001', '1001'],
  I: ['111', '010', '010', '010', '111'],
  K: ['1001', '1010', '1100', '1010', '1001'],
  L: ['100', '100', '100', '100', '111'],
  M: ['10001', '11011', '10101', '10001', '10001'],
  N: ['1001', '1101', '1011', '1001', '1001'],
  O: ['0110', '1001', '1001', '1001', '0110'],
  P: ['1110', '1001', '1110', '1000', '1000'],
  R: ['1110', '1001', '1110', '1010', '1001'],
  S: ['0111', '1000', '0110', '0001', '1110'],
  T: ['111', '010', '010', '010', '010'],
  U: ['1001', '1001', '1001', '1001', '0110'],
  V: ['101', '101', '101', '101', '010'],
  W: ['10001', '10001', '10101', '10101', '01010'],
  Y: ['101', '101', '010', '010', '010'],
  Z: ['1111', '0010', '0100', '1000', '1111'],
  '0': ['010', '101', '101', '101', '010'],
  '1': ['01', '11', '01', '01', '01'],
  '2': ['110', '001', '010', '100', '111'],
  '3': ['110', '001', '010', '001', '110'],
  '4': ['101', '101', '111', '001', '001'],
  '6': ['0110', '1000', '1110', '1001', '0110'],
  '7': ['1111', '0001', '0010', '0100', '0100'],
  '-': ['00', '00', '11', '00', '00'],
  '.': ['0', '0', '0', '0', '1'],
};
// tiny 3x3 stencil font for crate labels and dials
const MICRO: Record<string, string[]> = {
  A: ['010', '111', '101'], B: ['110', '111', '111'], C: ['111', '100', '111'], D: ['110', '101', '110'], E: ['111', '110', '111'],
  F: ['111', '110', '100'], G: ['110', '101', '111'], H: ['101', '111', '101'], I: ['1', '1', '1'], K: ['101', '110', '101'],
  L: ['100', '100', '111'], M: ['111', '111', '101'], N: ['111', '101', '101'], O: ['111', '101', '111'], P: ['111', '111', '100'],
  R: ['110', '111', '101'], S: ['011', '010', '110'], T: ['111', '010', '010'], U: ['101', '101', '111'], W: ['101', '111', '111'],
  X: ['101', '010', '101'], Y: ['101', '010', '010'], Z: ['110', '010', '011'], '0': ['111', '101', '111'], '1': ['11', '01', '01'],
  '2': ['110', '010', '011'], '4': ['101', '111', '001'], '7': ['111', '001', '001'], '-': ['00', '11', '00'], '!': ['1', '1', '0'],
};

export function pixelText(b: PixelBuffer | Obj, text: string, x: number, y: number, c: C, shadow?: C, micro = false) {
  const set = (px: number, py: number, cc: C) => (b instanceof Obj ? b.px(px, py, cc) : b.set(px, py, cc));
  const font = micro ? MICRO : GLYPH;
  let cx = x;
  for (const ch of text) {
    const g = font[ch];
    if (!g) { cx += micro ? 2 : 3; continue; }
    for (let r = 0; r < g.length; r++)
      for (let k = 0; k < g[r].length; k++)
        if (g[r][k] === '1') {
          if (shadow !== undefined) set(cx + k + 1, y + r + 1, shadow);
          set(cx + k, y + r, c);
        }
    cx += g[0].length + 1;
  }
  return cx - x - 1;
}
export function textWidth(text: string, micro = false) {
  const font = micro ? MICRO : GLYPH;
  let w = 0;
  for (const ch of text) w += (font[ch]?.[0].length ?? (micro ? 1 : 2)) + 1;
  return w - 1;
}

// ------------------------------------------------------------------ stickers (outlined props)

/**
 * Paint a prop into its own buffer, ink-outline it and stamp it so the prop's own (0, 0) lands at
 * (x, y) on `b`. Returns the stamped buffer (with its 1px outline pad).
 */
export function sticker(b: PixelBuffer, x: number, y: number, w: number, h: number, draw: (o: Obj) => void, outline = true): PixelBuffer {
  const s = obj(w, h, draw, outline);
  const X = Math.round(x) - 1, Y = Math.round(y) - 1;
  for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
    const v = s.data[j * s.w + i];
    if (v >>> 24) b.set(X + i, Y + j, v);
  }
  return s;
}

/** Ramp lookup for Obj painters: f in ramp steps, dithered by position. */
export const rq = (r: C[], f: number, x = 0, y = 0, k = 0.5) => ramp(r, f + dith(x, y, k));

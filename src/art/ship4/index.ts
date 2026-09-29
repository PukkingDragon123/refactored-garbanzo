// The V4 Kittiwake: a bigger, lived-in research boat drawn as a side-view dollhouse.
//
// Ship-local pixels, origin top-left of the ship bounds (W x H), bow to +x, y down.
//   lower deck  (ceil 276, floor 356): engine room · storage hold · research lab · Jenna's cabin · Mori's cabin · forepeak
//   deckhouse   (ceil 186, floor 268): galley · mess (chess) · captain's cabin
//   bridge      (ceil 98,  floor 180): wheelhouse on top of the deckhouse; the rest of the roof is the upper deck
//   main deck   (y 268): stern fishing deck, foredeck with the mast and the bow pulpit
// Each painted layer is a region sprite (x, y = its top-left in ship-local pixels). Interiors are
// mid-dark on purpose: the scene lights them with dim warm lamps and cool window light.

import { PixelBuffer } from '../pixel';
import { P, T, Tone, hex, mix, shade, C, rng, vignetteRect, Obj, obj } from './kit';
import * as F from './furniture';

export const S4 = {
  W: 1640,
  H: 392,
  WATER: 366,
  lower: { ceil: 276, floor: 356, x0: 96, x1: 1470 },
  main: { y: 268, x0: 46, x1: 1596 },
  house: { ceil: 186, floor: 268, x0: 520, x1: 1120 },
  upper: { y: 180, x0: 520, x1: 900 },
  bridge: { ceil: 98, floor: 180, x0: 900, x1: 1120 },
};

export type Level = 'lower' | 'house' | 'bridge' | 'deck' | 'upper';
export interface RoomDef { id: string; name: string; level: 'lower' | 'house' | 'bridge'; x0: number; x1: number }
export const ROOMS: RoomDef[] = [
  { id: 'engine', name: 'Engine room', level: 'lower', x0: 96, x1: 400 },
  { id: 'hold', name: 'Storage hold', level: 'lower', x0: 400, x1: 640 },
  { id: 'lab', name: 'Research lab', level: 'lower', x0: 640, x1: 940 },
  { id: 'jenna', name: "Jenna's cabin", level: 'lower', x0: 940, x1: 1110 },
  { id: 'mori', name: "Mori's cabin", level: 'lower', x0: 1110, x1: 1300 },
  { id: 'forepeak', name: 'Forepeak', level: 'lower', x0: 1300, x1: 1470 },
  { id: 'galley', name: 'Galley', level: 'house', x0: 520, x1: 720 },
  { id: 'mess', name: 'Mess', level: 'house', x0: 720, x1: 900 },
  { id: 'captain', name: "Captain's cabin", level: 'house', x0: 900, x1: 1120 },
  { id: 'bridge', name: 'Bridge', level: 'bridge', x0: 900, x1: 1120 },
];
export const LADDERS = [
  { id: 'aft', x: 470, top: S4.main.y, bottom: S4.lower.floor },
  { id: 'fwd', x: 1142, top: S4.main.y, bottom: S4.lower.floor },
  { id: 'galley', x: 708, top: S4.house.floor, bottom: S4.lower.floor },
  { id: 'roof', x: 508, top: S4.upper.y, bottom: S4.main.y },
  { id: 'bridge', x: 1104, top: S4.bridge.floor, bottom: S4.house.floor },
];
/** bulkheads with doorways (x, level) */
const WALLS: { x: number; level: 'lower' | 'house' | 'bridge'; outer?: boolean }[] = [
  { x: 400, level: 'lower' }, { x: 640, level: 'lower' }, { x: 940, level: 'lower' }, { x: 1110, level: 'lower' }, { x: 1300, level: 'lower' },
  { x: 720, level: 'house' }, { x: 900, level: 'house' },
];
export interface LampDef { x: number; y: number; r: number; c: [number, number, number]; k: number; flicker?: number; room: string; kind?: 'bulb' | 'screen' | 'tank' | 'stove' | 'fairy' | 'window' }
export const LAMPS: LampDef[] = [];
export interface WindowDef { x: number; y: number; w: number; h: number; room: string; porthole?: boolean }
export const WINDOWS: WindowDef[] = [];
/** named spots for actors and interactables (ship-local) */
export const SPOTS: Record<string, [number, number]> = {};

// ------------------------------------------------------------------ region layer

class Region {
  readonly buf: PixelBuffer;
  readonly glow: PixelBuffer;
  /** daylight through window glass (dims with the weather, flashes with lightning) */
  readonly sky: PixelBuffer;
  constructor(readonly x: number, readonly y: number, readonly w: number, readonly h: number) {
    this.buf = new PixelBuffer(w, h);
    this.glow = new PixelBuffer(w, h);
    this.sky = new PixelBuffer(w, h);
  }
  px(x: number, y: number, c: C) {
    x = Math.floor(x - this.x); y = Math.floor(y - this.y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.buf.data[y * this.w + x] = c;
  }
  gpx(x: number, y: number, c: C) {
    x = Math.floor(x - this.x); y = Math.floor(y - this.y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.glow.data[y * this.w + x] = c;
  }
  get(x: number, y: number) {
    x = Math.floor(x - this.x); y = Math.floor(y - this.y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.buf.data[y * this.w + x];
  }
  rect(x: number, y: number, w: number, h: number, c: C | ((x: number, y: number) => C | -1)) {
    for (let j = Math.floor(y); j < Math.floor(y + h); j++)
      for (let i = Math.floor(x); i < Math.floor(x + w); i++) {
        const v = typeof c === 'function' ? c(i, j) : c;
        if (v !== -1) this.px(i, j, v);
      }
  }
  /** stamp an outlined object so its inner top-left lands at (x, y); `bottom` places by the base instead */
  put(sp: F.Sp | PixelBuffer, x: number, y: number, o: { bottom?: boolean; flip?: boolean; sky?: boolean } = {}) {
    const b = sp instanceof PixelBuffer ? sp : sp.buf;
    const g = sp instanceof PixelBuffer ? undefined : sp.glow;
    const gdst = o.sky ? this.sky : this.glow;
    const X = Math.round(x) - 1, Y = Math.round(o.bottom ? y - (b.h - 2) : y) - 1;
    for (let j = 0; j < b.h; j++)
      for (let i = 0; i < b.w; i++) {
        const si = o.flip ? b.w - 1 - i : i;
        const v = b.data[j * b.w + si];
        if (v >>> 24) this.px(X + i, Y + j, v);
        if (g) { const gv = g.data[j * g.w + si]; if (gv >>> 24) { const gx = Math.floor(X + i - this.x), gy = Math.floor(Y + j - this.y); if (gx >= 0 && gy >= 0 && gx < this.w && gy < this.h) gdst.data[gy * this.w + gx] = gv; } }
      }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: C) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) this.px(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), c);
  }
  /** darken toward the edges of a ship-local rect (baked dark corners) */
  vignette(x0: number, y0: number, w: number, h: number, k = 0.42, edge = 28) {
    vignetteRect(this.buf, Math.round(x0 - this.x), Math.round(y0 - this.y), Math.round(w), Math.round(h), k, edge);
  }
  sprite() {
    const has = (b: PixelBuffer) => { for (let i = 0; i < b.data.length; i++) if (b.data[i] >>> 24) return true; return false; };
    return { buf: this.buf, glow: has(this.glow) ? this.glow : null, sky: has(this.sky) ? this.sky : null, x: this.x, y: this.y };
  }
}
export interface ShipSprite { buf: PixelBuffer; glow: PixelBuffer | null; sky?: PixelBuffer | null; x: number; y: number }

// ------------------------------------------------------------------ shells: walls, floors, ceilings

type WallStyle = 'wood' | 'panel' | 'steel' | 'lav' | 'cream';
function wall(R: Region, x0: number, x1: number, ceil: number, floor: number, style: WallStyle, seed: number) {
  const rr = rng(seed);
  const tone: Tone = style === 'wood' ? P.plank : style === 'steel' ? T('#56666c', { sh: 0.16, deep: 0.3 }) : style === 'lav' ? T('#6e5e8e', { sh: 0.14, deep: 0.3 }) : style === 'cream' ? P.cream : T('#7a6a52', { sh: 0.14, deep: 0.3 });
  const low: Tone = style === 'wood' ? P.plankD : style === 'steel' ? T('#465458') : style === 'lav' ? T('#56486e') : style === 'cream' ? T('#6e5a42') : T('#5a4632');
  const wy0 = ceil, wy1 = floor;
  const wain = floor - 24;
  for (let y = wy0; y < wy1; y++)
    for (let x = x0; x < x1; x++) {
      let c: C;
      if (y >= wain) {
        // wainscot: vertical boards with a chair rail on top
        const bx = (x - x0) % 9;
        c = y === wain ? low[3] : y === wain + 1 ? low[1] : bx === 0 ? low[1] : low[2];
        if (y === floor - 3) c = low[0];
      } else if (style === 'wood') {
        // planks: each board its own tone, staggered butt joints with nail heads, grain streaks, knots
        const px = (x - x0) % 8, pi = Math.floor((x - x0) / 8);
        const h = ((pi * 2654435761) >>> 0) % 1000 / 1000;
        const joint = ((y - wy0) + (pi * 37) % 53) % 58;
        const base = h < 0.3 ? mix(tone[2], tone[1], 0.35) : h > 0.75 ? mix(tone[2], tone[3], 0.35) : tone[2];
        const grain = ((x * 7 + Math.floor(y / 4) * 13 + pi * 5) % 19) === 0 || (((y * 3 + pi * 11) % 29) === 0 && px > 2 && px < 6);
        const knot = ((pi * 131 + Math.floor((y - wy0) / 17) * 71) % 97) === 0 && (y - wy0) % 17 === 8 && px > 2 && px < 6;
        c = px === 0 ? tone[1] : px === 1 ? mix(base, tone[3], 0.5) : grain ? mix(base, tone[1], 0.6) : base;
        if (joint === 0) c = tone[1];
        else if (joint === 1 && px > 0) c = mix(base, tone[3], 0.4);
        if ((joint === 3 || joint === 55) && (px === 2 || px === 6)) c = shade(tone[1], -0.2);
        if (knot) c = tone[0];
      } else if (style === 'steel') {
        const pw = 34, ph = 22;
        const px = (x - x0) % pw, py = (y - wy0) % ph;
        c = px === 0 || py === 0 ? tone[1] : px === 1 || py === 1 ? tone[3] : tone[2];
        if ((px === 3 || px === pw - 3) && (py === 3 || py === ph - 3)) c = tone[0];
      } else {
        // painted tongue-and-groove panels: bevelled edges, each panel a touch different, a dado rail,
        // faint stains and chips in the paint
        const pw = 26;
        const px = (x - x0) % pw, pi = Math.floor((x - x0) / pw);
        const h = ((pi * 2246822519) >>> 0) % 1000 / 1000;
        const base = h < 0.33 ? mix(tone[2], tone[1], 0.18) : h > 0.7 ? mix(tone[2], tone[3], 0.2) : tone[2];
        const rail = wain - 20;
        c = px === 0 ? tone[1] : px === 1 ? tone[3] : px === pw - 1 ? mix(base, tone[1], 0.45) : base;
        if (px > 1 && px < pw - 1 && (px - 1) % 6 === 0) c = mix(base, tone[1], 0.25);
        if (y === rail) c = tone[3]; else if (y === rail + 1) c = tone[1];
        const n = Math.sin(x * 0.37 + y * 0.11) * Math.sin(x * 0.07 - y * 0.23);
        if (n > 0.82) c = mix(c, tone[1], 0.3);
        if (((x * 31 + y * 17) % 211) === 0) c = tone[3];
        if (style === 'lav' && ((x + y * 3) % 17 === 0)) c = tone[3];
      }
      R.px(x, y, c);
    }
  // soft shadow under the ceiling, grime and scuffs above the wainscot
  for (let x = x0; x < x1; x++) {
    for (let d = 0; d < 10; d++) {
      const y = ceil + 5 + d;
      if (y >= wain) break;
      const k = (10 - d) / 10 * 0.28;
      const lx = Math.floor(x - R.x), ly = Math.floor(y - R.y);
      if (lx < 0 || lx >= R.w || ly < 0 || ly >= R.h) continue;
      const i = ly * R.w + lx;
      if (i >= 0 && i < R.buf.data.length && R.buf.data[i] >>> 24) R.buf.data[i] = shade(R.buf.data[i], -k);
    }
    for (let d = 1; d < 7; d++) {
      const y = wain - d;
      const lx = Math.floor(x - R.x), ly = Math.floor(y - R.y);
      if (lx < 0 || lx >= R.w || ly < 0 || ly >= R.h) continue;
      const i = ly * R.w + lx;
      const n = ((x * 13 + d * 7) % 11) / 11;
      if (i >= 0 && i < R.buf.data.length && R.buf.data[i] >>> 24 && n < 0.75 - d * 0.1) R.buf.data[i] = shade(R.buf.data[i], -0.08 * (7 - d) / 6);
    }
  }
  // ceiling beams
  for (let x = x0; x < x1; x++) for (let y = ceil; y < ceil + 5; y++) R.px(x, y, y === ceil + 4 ? P.beam[0] : y === ceil ? P.beam[3] : P.beam[2]);
  for (let x = x0 + 18 + Math.floor(rr() * 10); x < x1 - 8; x += 44) R.rect(x, ceil + 5, 5, 4, (i, j) => (j === ceil + 8 ? P.beam[0] : i === x + 4 ? P.beam[1] : P.beam[2]));
  // floor boards
  for (let x = x0; x < x1; x++) for (let y = floor; y < floor + 6; y++) R.px(x, y, y === floor ? P.floor[3] : y === floor + 5 ? P.floor[0] : ((x + (y - floor) * 13) % 21 === 0 ? P.floor[1] : P.floor[2]));
  for (let x = x0 + 12; x < x1; x += 21) for (let y = floor + 1; y < floor + 5; y++) R.px(x, y, P.floor[1]);
}

function bulkhead(R: Region, x: number, ceil: number, floor: number, door = true) {
  const dh = 66;
  for (let y = ceil; y < floor; y++) {
    const inDoor = door && y > floor - dh;
    for (let i = -3; i <= 3; i++) {
      if (inDoor && Math.abs(i) < 3) continue;
      const c = i === -3 ? P.plankD[3] : i === 3 ? P.plankD[0] : Math.abs(i) === 2 && inDoor ? P.plankD[1] : P.plankD[2];
      R.px(x + i, y, c);
    }
  }
  if (door) {
    // door lintel with a little brass plate
    R.rect(x - 4, floor - dh - 3, 9, 3, (i, j) => (j === floor - dh - 3 ? P.plankD[3] : P.plankD[1]));
    // door leaf swung open against the wall (seen edge-on + a sliver of its face)
    R.rect(x + 4, floor - dh + 2, 3, dh - 3, (i, j) => (i === x + 6 ? P.plankD[0] : (j - floor) % 16 === 0 ? P.plankD[1] : P.plank[1]));
    R.px(x + 5, floor - 32, P.brass[3]);
  }
}

// ------------------------------------------------------------------ light registration helpers

function lamp(R: Region, x: number, ceil: number, cord: number, room: string, o: { c?: [number, number, number]; k?: number; r?: number; flicker?: number; shadeT?: Tone } = {}) {
  R.put(F.hangLamp(cord, o.shadeT), x - 5, ceil + 4);
  LAMPS.push({ x, y: ceil + 4 + cord + 7, r: o.r ?? 110, c: o.c ?? [1, 0.72, 0.42], k: o.k ?? 1.25, flicker: o.flicker, room, kind: 'bulb' });
}
function porthole(R: Region, x: number, y: number, room: string, r = 7) {
  R.put(F.porthole(r), x - r, y - r, { sky: true });
  WINDOWS.push({ x, y, w: r * 2, h: r * 2, room, porthole: true });
}
function windowAt(R: Region, x: number, y: number, w: number, h: number, room: string, curtain?: Tone) {
  R.put(F.windowRect(w, h, { curtain, mullion: w > 22 }), x, y, { sky: true });
  WINDOWS.push({ x: x + w / 2, y: y + h / 2, w, h, room });
}

// ------------------------------------------------------------------ lower deck rooms

function engineRoom(R: Region) {
  const { ceil, floor } = S4.lower;
  const x0 = 96, x1 = 400;
  wall(R, x0, x1, ceil, floor, 'steel', 11);
  // pipes along the ceiling and down the walls
  const pipe = (xa: number, xb: number, y: number, t: Tone) => { for (let x = xa; x <= xb; x++) { R.px(x, y, t[3]); R.px(x, y + 1, t[2]); R.px(x, y + 2, t[1]); } for (let x = xa + 10; x < xb; x += 30) R.rect(x, y - 1, 3, 5, P.dark[1]); };
  pipe(x0 + 4, x1 - 4, ceil + 9, P.rust);
  pipe(x0 + 30, x1 - 30, ceil + 14, P.steel);
  for (let y = ceil + 9; y < floor - 20; y++) { R.px(372, y, P.rust[2]); R.px(373, y, P.rust[1]); }
  R.put(F.valveWheel(), 366, 312);
  R.put(F.fuseBox(), 118, 296);
  R.put(F.gauge(), 146, 292); R.put(F.gauge(), 158, 292); R.put(F.gauge(), 170, 292);
  R.put(F.engineBlock(), 200, floor, { bottom: true });
  // exhaust stack from the engine up through the ceiling
  for (let y = ceil + 5; y < floor - 54; y++) R.rect(262, y, 6, 1, (i) => (i === 262 ? P.dark[3] : i === 267 ? P.dark[0] : P.dark[2]));
  R.put(F.toolBoard(40), 308, 290);
  R.put(F.desk(50, P.plankD), 304, floor, { bottom: true });
  R.put(F.oilCans(), 112, floor, { bottom: true });
  R.put(F.extinguisher(), 384, floor - 20, { bottom: true });
  // hazard stripes on the floor by the engine
  for (let x = 196; x < 300; x++) if (((x >> 2) % 2) === 0) R.px(x, floor, P.yellow[2]);
  lamp(R, 150, ceil, 6, 'engine', { c: [1, 0.66, 0.36], k: 1.1, flicker: 0.35, shadeT: P.steel });
  lamp(R, 330, ceil, 5, 'engine', { c: [1, 0.66, 0.36], k: 1, shadeT: P.steel });
  R.vignette(x0, ceil, x1 - x0, floor - ceil, 0.5, 34);
  SPOTS.engineFix = [240, floor];
  SPOTS.fuseBox = [128, floor];
  SPOTS.valve = [372, floor];
  SPOTS.toolboard = [328, floor];
}

function hold(R: Region) {
  const { ceil, floor } = S4.lower;
  const x0 = 400, x1 = 640;
  wall(R, x0, x1, ceil, floor, 'wood', 21);
  // kayak hanging from the ceiling
  for (let x = 492; x < 592; x++) {
    const u = (x - 492) / 100;
    const t = Math.sin(u * Math.PI);
    const y0 = ceil + 12 - Math.round(t * 1), y1 = ceil + 12 + Math.round(t * 5);
    for (let y = y0; y <= y1; y++) R.px(x, y, y === y0 ? P.yellow[3] : y === y1 ? P.yellow[0] : y > y0 + 3 ? P.yellow[1] : P.yellow[2]);
  }
  R.line(510, ceil + 5, 510, ceil + 11, P.rope[1]); R.line(574, ceil + 5, 574, ceil + 11, P.rope[1]);
  R.put(F.net(56, 22), 410, 288);
  // life jackets on hooks
  for (let i = 0; i < 3; i++) R.put(obj(10, 16, o => { o.poly([1, 0, 9, 0, 10, 16, 0, 16], (x) => (x < 3 ? P.orange[3] : x > 7 ? P.orange[1] : P.orange[2])); o.hline(1, 8, 8, P.white[2]); o.vline(5, 0, 15, P.orange[0]); }), 604 - i * 13, 294);
  // crates, barrels, sacks, stacked dog food
  R.put(F.crate(22, 18, P.plank, true), 488, floor, { bottom: true });
  R.put(F.crate(18, 16), 512, floor, { bottom: true });
  R.put(F.crate(18, 14, P.plankD), 492, floor - 18, { bottom: true });
  R.put(F.barrel(22), 534, floor, { bottom: true });
  R.put(F.barrel(20), 550, floor, { bottom: true });
  R.put(F.sack(), 568, floor, { bottom: true });
  R.put(F.sack(), 578, floor - 1, { bottom: true });
  R.put(F.shelf(40, 77, 'tins'), 590, 318);
  R.put(F.ropeCoil(), 600, floor, { bottom: true });
  // "CHUNK" dog food crate
  R.put(obj(20, 14, o => { o.box(0, 0, 20, 14, P.red); o.rect(3, 3, 14, 7, P.white[3]); o.ell(10, 6.5, 3, 2.4, P.fawn[2]); o.px(9, 6, P.black[0]); o.px(11, 6, P.black[0]); }), 420, floor, { bottom: true });
  lamp(R, 520, ceil, 8, 'hold', { k: 0.9, r: 100 });
  R.vignette(x0, ceil, x1 - x0, floor - ceil, 0.52, 36);
  SPOTS.holdHide = [505, floor];
  SPOTS.dogFood = [430, floor];
}

function lab(R: Region) {
  const { ceil, floor } = S4.lower;
  const x0 = 640, x1 = 940;
  wall(R, x0, x1, ceil, floor, 'cream', 31);
  R.put(F.fishTankFrame(62, 34), 654, floor, { bottom: true });
  LAMPS.push({ x: 685, y: floor - 30, r: 90, c: [0.4, 0.85, 1], k: 1.1, room: 'lab', kind: 'tank' });
  R.put(F.labBench(76), 730, floor, { bottom: true });
  R.put(F.microscope(), 742, floor - 22, { bottom: true });
  R.put(F.jars(5, 9), 760, floor - 22, { bottom: true });
  R.put(F.laptop(false), 792, floor - 22, { bottom: true });
  R.put(F.shelf(64, 5, 'jars'), 734, 300);
  R.put(F.whiteboard(36, 22), 818, 292);
  porthole(R, 783, 296, 'lab');
  const mon = F.monitor(14, 10, '#4a9ad0');
  R.put(F.desk(46), 862, floor, { bottom: true });
  R.put(mon, 866, floor - 18 - 14);
  R.put(F.monitor(14, 10, '#5ac89a'), 882, floor - 18 - 14);
  LAMPS.push({ x: 880, y: floor - 26, r: 60, c: [0.45, 0.75, 1], k: 0.7, room: 'lab', kind: 'screen' });
  R.put(F.chair(P.steel), 872, floor, { bottom: true });
  R.put(F.fridge(), 914, floor, { bottom: true });
  R.put(F.plant(14, P.teal), 828, floor, { bottom: true });
  lamp(R, 760, ceil, 6, 'lab', { c: [1, 0.86, 0.66], k: 1.05 });
  lamp(R, 870, ceil, 6, 'lab', { c: [1, 0.86, 0.66], k: 0.9 });
  R.vignette(x0, ceil, x1 - x0, floor - ceil, 0.4, 30);
  SPOTS.tank = [685, floor];
  SPOTS.microscope = [748, floor];
  SPOTS.labPC = [874, floor];
}

function jennaRoom(R: Region) {
  const { ceil, floor } = S4.lower;
  const x0 = 940, x1 = 1110;
  wall(R, x0, x1, ceil, floor, 'lav', 41);
  R.put(F.poster('anime', 16, 22), 950, 290);
  R.put(F.poster('code', 14, 18), 970, 292);
  R.put(F.poster('band', 16, 20), 1086, 290);
  R.put(F.bunk(62, P.pink, { pillow: P.lav, stripes: true, plush: [P.fawn, P.white] }), 1044, floor, { bottom: true });
  // desk with three monitors and an RGB keyboard
  R.put(F.desk(56, P.dark), 962, floor, { bottom: true });
  R.put(F.monitor(14, 10, '#e070b8'), 964, floor - 18 - 14);
  R.put(F.monitor(16, 11, '#4ac8e8'), 980, floor - 18 - 15);
  R.put(F.monitor(14, 10, '#8a6ae8'), 998, floor - 18 - 14);
  R.rect(972, floor - 20, 24, 2, (x) => [hex('#ff6aa8'), hex('#6ae8ff'), hex('#b06aff')][Math.floor((x - 972) / 8) % 3]);
  R.put(F.cans(3), 1008, floor - 18, { bottom: true });
  R.put(F.gamingChair(), 980, floor, { bottom: true });
  R.put(F.serverRack(), 1024, floor, { bottom: true });
  R.put(F.stringLights(150, 5, ['#ff6aa8', '#6ae8ff', '#ffe060', '#b06aff']), 952, ceil + 7);
  for (let i = 0; i < 6; i++) LAMPS.push({ x: 960 + i * 26, y: ceil + 12, r: 26, c: i % 2 ? [0.5, 0.9, 1] : [1, 0.45, 0.75], k: 0.4, room: 'jenna', kind: 'fairy' });
  LAMPS.push({ x: 990, y: floor - 26, r: 70, c: [0.7, 0.55, 1], k: 0.95, room: 'jenna', kind: 'screen' });
  R.put(F.rug(40, P.pink, P.lav), 1040, floor - 2);
  // sticky notes on the wall
  for (let i = 0; i < 5; i++) R.rect(1004 + (i % 3) * 6, 296 + Math.floor(i / 3) * 6, 4, 4, [P.yellow[2], P.pink[3], hex('#8ae8ff')][i % 3]);
  porthole(R, 1066, 300, 'jenna');
  R.vignette(x0, ceil, x1 - x0, floor - ceil, 0.45, 30);
  SPOTS.jennaDesk = [986, floor];
  SPOTS.jennaBunk = [1070, floor];
}

function moriRoom(R: Region) {
  const { ceil, floor } = S4.lower;
  const x0 = 1110, x1 = 1300;
  wall(R, x0, x1, ceil, floor, 'wood', 51);
  R.put(F.bunk(66, P.olive, { pillow: P.orange }), 1214, floor, { bottom: true });
  R.put(F.dogBed(), 1182, floor, { bottom: true });
  R.put(obj(6, 3, o => { o.rect(1, 1, 4, 1, P.white[3]); o.px(0, 0, P.white[3]); o.px(0, 2, P.white[3]); o.px(5, 0, P.white[3]); o.px(5, 2, P.white[3]); }), 1206, floor - 2);
  R.put(F.desk(50), 1154, floor, { bottom: true });
  R.put(F.laptop(true), 1160, floor - 18, { bottom: true });
  R.put(obj(5, 5, o => { o.rect(0, 0, 4, 5, P.white[2]); o.px(4, 2, P.white[2]); o.hline(0, 3, 0, hex('#6a4a2a')); }), 1178, floor - 18, { bottom: true });
  R.put(F.shelf(40, 13, 'books'), 1156, 306);
  R.put(F.photos(38, 17), 1236, 290);
  R.put(F.poster('birds', 18, 18), 1162, 286);
  R.put(F.poster('whale', 20, 14), 1188, 288);
  R.put(F.chair(), 1164, floor, { bottom: true });
  R.put(F.plant(16, P.rust), 1204, floor - 18 - 12, { bottom: true });
  // binoculars and camera bag hanging by the door
  R.put(F.binoculars(), 1286, 300);
  R.put(obj(10, 9, o => { o.box(0, 2, 10, 7, P.olive); o.line(0, 2, 5, -2, P.dark[1]); o.line(5, -2, 10, 2, P.dark[1]); }), 1284, 312);
  porthole(R, 1256, 318, 'mori');
  R.put(F.wallLamp(), 1216, 302);
  LAMPS.push({ x: 1220, y: 306, r: 80, c: [1, 0.74, 0.44], k: 1.1, room: 'mori', kind: 'bulb' });
  R.put(F.rug(44, P.red, P.brass), 1150, floor - 2);
  R.vignette(x0, ceil, x1 - x0, floor - ceil, 0.46, 32);
  SPOTS.moriBed = [1246, floor];
  SPOTS.moriDesk = [1170, floor];
  SPOTS.chunkBed = [1194, floor];
}

function forepeak(R: Region) {
  const { ceil, floor } = S4.lower;
  const x0 = 1300, x1 = 1470;
  wall(R, x0, x1, ceil, floor, 'wood', 61);
  R.put(obj(30, 30, o => { for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) { const k = (x + Math.floor(y / 2)) % 5; if (Math.hypot(x - 15, y - 26) < 16 && y > 8) o.px(x, y, k < 2 ? P.steel[1] : k < 4 ? P.steel[2] : P.steel[0]); } }), 1330, floor, { bottom: true });
  R.put(F.oilCans(), 1370, floor, { bottom: true });
  R.put(F.crate(16, 14), 1396, floor, { bottom: true });
  R.put(F.sack(), 1414, floor, { bottom: true });
  R.put(obj(24, 10, o => { o.poly([0, 10, 3, 2, 20, 0, 24, 10], (x) => (x < 8 ? P.blue[3] : P.blue[2])); o.hline(2, 22, 8, P.blue[1]); }), 1430, floor, { bottom: true });
  lamp(R, 1380, ceil, 5, 'forepeak', { k: 0.55, r: 70, flicker: 0.2 });
  R.vignette(x0, ceil, x1 - x0, floor - ceil, 0.62, 44);
  SPOTS.forepeak = [1400, floor];
}

// ------------------------------------------------------------------ deckhouse rooms

function galley(R: Region) {
  const { ceil, floor } = S4.house;
  const x0 = 520, x1 = 720;
  wall(R, x0, x1, ceil, floor, 'panel', 71);
  R.put(F.cupboard(84, 16, P.navy), 534, 200);
  R.put(F.counter(58, true), 534, floor, { bottom: true });
  const st = F.stove();
  R.put(st, 596, floor, { bottom: true });
  LAMPS.push({ x: 608, y: floor - 8, r: 44, c: [1, 0.5, 0.2], k: 0.7, room: 'galley', kind: 'stove' });
  R.put(F.pansRail(40), 596, 214);
  R.put(F.fridge(), 626, floor, { bottom: true });
  R.put(F.noodleStash(), 540, floor - 24, { bottom: true });
  R.put(F.shelf(40, 3, 'tins'), 650, 214);
  windowAt(R, 654, 232, 24, 18, 'galley', P.red);
  R.put(F.dogBowl(true), 676, floor, { bottom: true });
  R.put(F.dogBowl(false), 688, floor, { bottom: true });
  // kettle on the counter
  R.put(obj(10, 8, o => { o.box(1, 2, 8, 6, P.steel); o.line(8, 3, 10, 1, P.steel[2]); o.hline(3, 6, 1, P.dark[2]); }), 574, floor - 24, { bottom: true });
  lamp(R, 580, ceil, 7, 'galley', { k: 1.15 });
  R.vignette(x0, ceil, x1 - x0, floor - ceil, 0.42, 30);
  SPOTS.kettle = [578, floor];
  SPOTS.stove = [608, floor];
  SPOTS.noodles = [548, floor];
  SPOTS.bowls = [684, floor];
  SPOTS.fridge = [634, floor];
}

function mess(R: Region) {
  const { ceil, floor } = S4.house;
  const x0 = 720, x1 = 900;
  wall(R, x0, x1, ceil, floor, 'wood', 81);
  windowAt(R, 754, 206, 22, 18, 'mess', P.olive);
  windowAt(R, 812, 206, 22, 18, 'mess', P.olive);
  R.put(F.bench(80), 748, floor, { bottom: true });
  R.put(F.table(64, 22), 756, floor, { bottom: true });
  R.put(F.chessBoard(), 772, floor - 22, { bottom: true });
  R.put(obj(4, 5, o => { o.rect(0, 0, 4, 5, P.white[2]); o.hline(0, 3, 0, hex('#6a4a2a')); }), 804, floor - 22, { bottom: true });
  R.put(F.bookcase(28, 44, 91), 860, floor, { bottom: true });
  R.put(obj(12, 12, o => { o.ell(6, 6, 6, 6, (nx, ny) => { const r = Math.hypot(nx, ny); return r > 0.8 ? P.black[2] : r > 0.55 ? P.red[2] : r > 0.3 ? P.white[3] : P.red[2]; }); }), 732, 212);
  R.put(F.photos(30, 29), 846, 204);
  lamp(R, 788, ceil, 10, 'mess', { k: 1.2 });
  R.vignette(x0, ceil, x1 - x0, floor - ceil, 0.42, 30);
  SPOTS.chess = [788, floor];
  SPOTS.messSeat = [770, floor];
  SPOTS.games = [872, floor];
}

function captainRoom(R: Region) {
  const { ceil, floor } = S4.house;
  const x0 = 900, x1 = 1120;
  wall(R, x0, x1, ceil, floor, 'wood', 101);
  R.put(F.bunk(62, P.navy, { plaid: P.red, pillow: P.white }), 912, floor, { bottom: true });
  R.put(F.seaChest(), 978, floor, { bottom: true });
  R.put(F.fishTrophy(), 918, 206);
  R.put(F.frame(14, 16, o => { o.rect(0, 0, 10, 12, P.teal[1]); o.ell(5, 5, 2.4, 2.6, P.fawn[3]); o.ell(5, 3, 3, 2, P.pink[2]); o.rect(2, 8, 6, 4, P.yellow[2]); }), 950, 204);
  R.put(F.frame(14, 16, o => { o.rect(0, 0, 10, 12, P.yellow[1]); o.ell(5, 5, 2.4, 2.8, P.fawn[3]); o.ell(5, 3, 3.2, 2.2, hex('#e8a040')); o.rect(1, 8, 8, 4, P.white[2]); }), 968, 208);
  R.put(F.desk(52, P.plankD), 1010, floor, { bottom: true });
  R.put(F.globe(), 1016, floor - 18, { bottom: true });
  R.put(obj(14, 3, o => { o.rect(0, 0, 14, 3, P.paper[3]); o.line(2, 1, 11, 1, P.blue[1]); }), 1034, floor - 18, { bottom: true });
  R.put(F.shelf(40, 101, 'mixed'), 1012, 214);
  R.put(F.modelShip(), 1060, 198);
  R.put(F.coatHook(P.yellow), 994, 212);
  R.put(F.clock(), 1044, 196);
  windowAt(R, 1070, 222, 18, 16, 'captain', P.navy);
  R.put(F.rug(50, P.navy, P.red), 950, floor - 2);
  R.put(F.wallLamp(), 940, 220);
  LAMPS.push({ x: 944, y: 224, r: 80, c: [1, 0.7, 0.4], k: 1, room: 'captain', kind: 'bulb' });
  lamp(R, 1040, ceil, 6, 'captain', { k: 0.8, r: 90 });
  R.vignette(x0, ceil, x1 - x0, floor - ceil, 0.46, 32);
  SPOTS.captainBunk = [940, floor];
  SPOTS.modelShip = [1070, floor];
  SPOTS.photosJ = [960, floor];
}

function bridgeRoom(R: Region) {
  const { ceil, floor, x0, x1 } = S4.bridge;
  wall(R, x0, x1, ceil, floor, 'wood', 111);
  // big windows all along the front half and the aft side
  for (const [x, w] of [[924, 34], [966, 34], [1008, 34], [1050, 58]] as const) {
    R.put(F.windowRect(w, 30, { sky: '#8ab8d0' }), x, 110, { sky: true });
    WINDOWS.push({ x: x + w / 2, y: 125, w, h: 30, room: 'bridge' });
  }
  R.put(F.consoleDesk(64), 1046, floor, { bottom: true });
  R.put(F.helm(), 1024, floor, { bottom: true });
  R.put(F.chartTable(40), 930, floor, { bottom: true });
  R.put(F.binoculars(), 1000, 150);
  // hula bobblehead + thermos on the console
  R.put(obj(5, 9, o => { o.ell(2.5, 2, 2, 2, P.fawn[3]); o.rect(1, 4, 3, 3, P.green[2]); o.rect(0, 7, 5, 2, P.plankD[2]); }), 1060, floor - 26, { bottom: true });
  R.put(obj(4, 10, o => { o.rect(0, 1, 4, 9, P.red[2]); o.rect(0, 0, 4, 2, P.dark[2]); }), 1100, floor - 22, { bottom: true });
  LAMPS.push({ x: 1062, y: floor - 12, r: 60, c: [0.4, 1, 0.6], k: 0.7, room: 'bridge', kind: 'screen' });
  lamp(R, 980, ceil, 4, 'bridge', { k: 0.7, r: 80 });
  R.vignette(x0, ceil, x1 - x0, floor - ceil, 0.35, 26);
  SPOTS.helm = [1030, floor];
  SPOTS.radio = [1090, floor];
  SPOTS.charts = [950, floor];
}

// ------------------------------------------------------------------ exterior

const HULL = T('#e8e2d0', { sh: 0.12, deep: 0.28, hi: 0.06 });
const BOTTOM = T('#1e3a44', { sh: 0.16, deep: 0.3 });
const STRIPE = P.red;

/** hull outline: y of the top of the hull (bulwark) and keel profile at x */
export function hullTop(x: number) {
  // gentle sheer: rises toward the bow
  const t = Math.max(0, (x - 1200) / 420);
  return 246 - t * t * 20;
}
export function hullBottom(x: number) {
  if (x < 60) return 330 + (x - 40) * 1.2;
  if (x < 140) return 350 + ((x - 60) / 80) * 38;
  if (x > 1380) { const t = (x - 1380) / 240; return 388 - t * t * 150; }
  return 388;
}
function hullLeft(y: number) {
  // the transom rakes slightly forward toward the waterline
  return 40 + Math.max(0, (y - 246) * 0.12);
}
function hullRight(y: number) {
  // bow curve: from the tip at the bulwark down and back to the keel
  const t = Math.max(0, Math.min(1, (y - 226) / 162));
  return 1620 - t * t * 240;
}

function paintHull(R: Region, storm: boolean) {
  const rr = rng(7);
  for (let x = 30; x < 1630; x++) {
    // the hull side starts at the deck line (the near railing is a see-through rail in deckFront)
    const top = S4.main.y, bot = Math.round(hullBottom(x));
    for (let y = top; y < bot; y++) {
      if (x < hullLeft(y) || x > hullRight(y)) continue;
      let c: C;
      if (y > S4.WATER + 4) c = y > bot - 3 ? BOTTOM[0] : BOTTOM[(x + y) % 7 === 0 ? 1 : 2];
      else if (y > S4.WATER - 2) c = STRIPE[y === S4.WATER + 4 ? 1 : 2];
      else if (y > S4.WATER - 5) c = P.navy[2];
      else {
        const plate = (x - 40) % 64 === 0;
        c = y === top ? HULL[3] : y < top + 3 ? P.plank[2] : y === top + 3 ? P.plank[0] : plate ? HULL[1] : (y > S4.WATER - 16 ? HULL[1] : HULL[2]);
        if (y === top + 10) c = HULL[1];
      }
      R.px(x, y, c);
    }
  }
  // rubbing strake (varnished wood trim) and scuppers
  for (let x = 44; x < 1600; x++) { const y = S4.main.y + 12; if (x < hullRight(y) && x > hullLeft(y)) { R.px(x, y, P.plank[3]); R.px(x, y + 1, P.plank[1]); } }
  for (let x = 70; x < 1560; x += 46) { const y = S4.main.y + 3; R.rect(x, y, 5, 2, HULL[0]); }
  // portholes on the lower deck (matching the interior)
  for (const w of WINDOWS) if (w.porthole) R.put(F.porthole(7, storm ? '#4a6a7a' : '#8ab8d0'), w.x - 7, w.y - 7);
  for (const x of [180, 560, 900]) R.put(F.porthole(6, storm ? '#4a6a7a' : '#8ab8d0'), x - 6, 300 - 6);
  // rust streaks from the scuppers
  for (let i = 0; i < 16; i++) {
    const x = 80 + Math.floor(rr() * 1460), y = S4.main.y + 5, L = 6 + Math.floor(rr() * 18);
    for (let k = 0; k < L; k++) if (R.get(x, y + k) === HULL[2] || R.get(x, y + k) === HULL[1]) R.px(x, y + k, k < L * 0.4 ? P.rust[2] : mix(P.rust[3], HULL[2], 0.5));
  }
  // name on the bow
  const name = 'KITTIWAKE';
  const G: Record<string, string[]> = {
    K: ['1.1', '11.', '1.1'], I: ['111', '.1.', '111'], T: ['111', '.1.', '.1.'], W: ['1.1', '111', '1.1'], A: ['.1.', '111', '1.1'], E: ['111', '11.', '111'],
  };
  let nx = 1392;
  for (const ch of name) { const g = G[ch]; g.forEach((r, j) => { for (let i = 0; i < 3; i++) if (r[i] === '1') { R.px(nx + i, 284 + j * 2, P.navy[1]); R.px(nx + i, 285 + j * 2, P.navy[1]); } }); nx += 5; }
  // tyre fenders over the side
  for (const x of [300, 700, 1060]) R.put(obj(10, 12, o => { o.ell(5, 6, 5, 6, (nx2, ny) => (Math.hypot(nx2, ny) < 0.4 ? -1 : ny < -0.2 ? P.black[3] : P.black[2])); }), x, S4.main.y + 16);
  // anchor at the bow
  R.put(obj(12, 16, o => { o.vline(6, 0, 13, P.dark[2]); o.hline(3, 9, 3, P.dark[2]); o.line(1, 10, 6, 15, P.dark[2]); o.line(11, 10, 6, 15, P.dark[2]); o.ell(6, 1, 1.6, 1.6, P.dark[2]); }), 1500, S4.main.y + 6);
}

function bowCap(R: Region) {
  // the raised bow above the foredeck (behind actors so the bow walk stays readable)
  for (let x = 1480; x < 1622; x++) {
    const top = Math.round(hullTop(x));
    for (let y = top; y < S4.main.y; y++) if (x < hullRight(y)) R.px(x, y, y === top ? HULL[3] : y < top + 2 ? P.plank[2] : HULL[x > 1600 ? 1 : 2]);
  }
}

function bulwark(R: Region, front: boolean) {
  // the railing/bulwark at the deck edge: back = far side (behind actors), front = near rail over actors' feet
  for (let x = 46; x < 1600; x++) {
    const top = Math.round(hullTop(x));
    if (front) {
      // a slim cap rail and stanchions along the near side
      if (x > hullRight(top)) continue;
      R.px(x, top, P.plank[3]); R.px(x, top + 1, P.plank[1]);
      if ((x - 46) % 30 === 0) for (let y = top + 2; y < S4.main.y; y++) R.px(x, y, P.plankD[1]);
    } else {
      for (let y = top - 2; y < S4.main.y; y++) R.px(x, y, y === top - 2 ? P.plank[3] : y < top + 2 ? P.plank[2] : ((x - 46) % 30 < 2 ? P.plankD[1] : HULL[1]));
    }
  }
}

function paintDeckGear(R: Region) {
  const y = S4.main.y;
  // stern fishing spot
  R.put(F.rodHolder(), 64, y, { bottom: true });
  R.put(F.rodHolder(), 86, y, { bottom: true });
  R.put(F.bucket(), 104, y, { bottom: true });
  R.put(F.cooler(), 120, y, { bottom: true });
  R.put(F.deckChair(), 150, y, { bottom: true });
  // research A-frame crane at the stern
  for (let k = 0; k < 70; k++) { R.px(208 + k * 0.35, y - k, P.orange[2]); R.px(209 + k * 0.35, y - k, P.orange[1]); R.px(262 - k * 0.35, y - k, P.orange[2]); R.px(263 - k * 0.35, y - k, P.orange[1]); }
  R.rect(230, y - 72, 14, 4, P.orange[1]);
  R.line(236, y - 68, 236, y - 30, P.rope[1]);
  R.put(obj(8, 8, o => o.ball(4, 4, 4, 4, P.yellow)), 232, y - 30);
  R.put(F.ropeCoil(), 290, y, { bottom: true });
  R.put(F.winch(), 350, y, { bottom: true });
  R.put(F.lifeRing(), 396, Math.round(hullTop(396)) - 16);
  R.put(F.hatchCover(22), 459, y - 1);
  // exterior ladder to the upper deck
  for (let yy = S4.upper.y; yy < y; yy++) { R.px(502, yy, P.steel[2]); R.px(514, yy, P.steel[2]); if ((yy - S4.upper.y) % 8 === 0) for (let x = 502; x <= 514; x++) R.px(x, yy, P.steel[3]); }
  // foredeck
  R.put(F.hatchCover(22), 1131, y - 1);
  R.put(F.crate(22, 18, P.plank, true), 1186, y, { bottom: true });
  R.put(F.crate(18, 14), 1210, y, { bottom: true });
  R.line(1186, y - 18, 1228, y - 4, P.rope[1]);
  R.put(obj(30, 12, o => { o.box(0, 4, 30, 8, P.plankD); o.rect(2, 0, 26, 4, P.plank[2]); }), 1340, y, { bottom: true });
  R.put(F.winch(), 1470, y, { bottom: true });
  // mast with a crow's-nest light, radar and spreaders
  const mx = 1262;
  for (let yy = 20; yy < y; yy++) { R.px(mx, yy, P.white[3]); R.px(mx + 1, yy, P.white[2]); R.px(mx + 2, yy, P.white[1]); }
  R.rect(mx - 12, 70, 27, 3, P.white[2]);
  R.rect(mx - 14, 40, 30, 5, P.dark[2]);
  R.put(obj(8, 6, o => o.ball(4, 3, 3, 3, P.yellow)), mx - 3, 28);
  LAMPS.push({ x: mx + 1, y: 31, r: 60, c: [1, 0.9, 0.6], k: 0.6, room: 'deck', kind: 'bulb' });
  R.line(mx, 72, 1590, Math.round(hullTop(1590)) - 2, P.dark[1]);
  R.line(mx, 72, 1150, S4.main.y - 30, P.dark[1]);
  // pennant line with little flags
  for (let k = 0; k < 16; k++) { const x = mx + 20 + k * 20, yy = 74 + Math.round(k * 10 + Math.sin(k * 0.8) * 2); R.rect(x, yy, 4, 4, [P.red[2], P.yellow[2], P.blue[2], P.white[3]][k % 4]); }
  // stern flag pole
  for (let yy = S4.main.y - 64; yy < S4.main.y; yy++) R.px(52, yy, P.plankD[2]);
  // upper deck: life raft, antennas, Joshu's herbs, deck chairs, Jenna's satellite dish
  const u = S4.upper.y;
  R.put(F.lifeRaftCanister(), 548, u, { bottom: true });
  R.put(F.antenna(40), 600, u, { bottom: true });
  R.put(F.antenna(28), 616, u, { bottom: true });
  R.put(F.herbBox(), 646, u, { bottom: true });
  R.put(F.deckChair(), 700, u, { bottom: true });
  R.put(obj(20, 22, o => { o.ell(10, 8, 10, 8, (nx, ny) => (nx + ny < -0.3 ? P.white[3] : P.white[1])); o.line(10, 8, 16, 2, P.dark[2]); o.rect(8, 15, 4, 7, P.dark[2]); }), 780, u, { bottom: true });
  R.put(F.stringLights(90, 6, ['#ffd860', '#ff9a50']), 720, u - 38);
  // roof railing
  for (let x = 520; x < 900; x++) { R.px(x, u - 16, P.steel[3]); if ((x - 520) % 20 === 0) for (let yy = u - 16; yy < u; yy++) R.px(x, yy, P.steel[2]); }
  SPOTS.fishing = [96, y];
  SPOTS.bow = [1560, y];
  SPOTS.roofChair = [710, u];
  SPOTS.herbs = [660, u];
  SPOTS.crane = [236, y];
}

function houseExterior(R: Region, storm: boolean) {
  const { ceil, floor, x0, x1 } = S4.house;
  const top = S4.upper.y;
  for (let y = top; y < floor; y++)
    for (let x = x0; x < x1; x++) {
      const c = y < top + 4 ? (y === top ? HULL[3] : P.plank[2]) : y > floor - 6 ? P.plankD[2] : ((x - x0) % 40 === 0 ? HULL[1] : HULL[2]);
      R.px(x, y, c);
    }
  // windows (lit from inside), doors
  const win = (x: number, y: number, w: number, h: number) => {
    R.rect(x - 1, y - 1, w + 2, h + 2, P.plankD[1]);
    R.rect(x, y, w, h, (i, j) => (storm ? hex('#3a4a54') : (i - x) - (j - y) * 0.7 > w * 0.5 ? hex('#a8c8d8') : hex('#6a8a9a')));
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) R.gpx(i, j, hex('#e8a860'));
  };
  win(560, 206, 26, 18); win(654, 232, 24, 18); win(754, 206, 22, 18); win(812, 206, 22, 18); win(950, 214, 24, 18); win(1070, 222, 18, 16);
  const door = (x: number) => {
    R.rect(x - 9, floor - 58, 18, 58, (i, j) => (i === x - 9 || i === x + 8 ? P.plankD[0] : j === floor - 58 ? P.plankD[3] : P.plank[2]));
    R.rect(x - 5, floor - 52, 10, 10, hex(storm ? '#3a4a54' : '#8aaab8'));
    R.px(x + 5, floor - 28, P.brass[3]);
  };
  door(532); door(1108);
  R.put(F.lifeRing(), 700, 196);
  R.vignette(x0, ceil, x1 - x0, floor - ceil, 0.18, 12);
}

function bridgeExterior(R: Region, storm: boolean) {
  const { ceil, floor, x0, x1 } = S4.bridge;
  for (let y = ceil - 8; y < floor; y++)
    for (let x = x0; x < x1; x++) {
      const c = y < ceil - 4 ? (y === ceil - 8 ? HULL[3] : P.plank[2]) : y < ceil ? HULL[1] : HULL[2];
      R.px(x, y, c);
    }
  for (const [x, w] of [[924, 34], [966, 34], [1008, 34], [1050, 58]] as const) {
    R.rect(x - 1, 109, w + 2, 32, P.plankD[1]);
    R.rect(x, 110, w, 30, (i, j) => (storm ? hex('#34444e') : (i - x) - (j - 110) * 0.8 > w * 0.55 ? hex('#b8d8e8') : hex('#7a9aaa')));
    for (let j = 110; j < 140; j++) for (let i = x; i < x + w; i++) R.gpx(i, j, hex('#d8a060'));
  }
  // roof gear: horn, searchlight, radar mount
  R.put(obj(12, 8, o => { o.box(0, 2, 12, 6, P.dark); o.ell(10, 4, 2, 3, P.yellow[3]); }), 960, ceil - 8, { bottom: true });
  R.put(obj(10, 6, o => { o.poly([0, 0, 10, 2, 10, 4, 0, 6], P.steel[2]); }), 1000, ceil - 8, { bottom: true });
  R.put(obj(30, 12, o => { o.rect(13, 4, 4, 8, P.dark[2]); o.rect(0, 0, 30, 4, P.white[2]); }), 1040, ceil - 8, { bottom: true });
  R.px(1115, 140, P.red[2]);
}

// ------------------------------------------------------------------ assemble

export interface Ship4Art {
  lower: ShipSprite; house: ShipSprite; bridge: ShipSprite;
  hull: ShipSprite; houseExt: ShipSprite; bridgeExt: ShipSprite;
  deckBack: ShipSprite; deckFront: ShipSprite;
}

let cache: { storm: boolean; art: Ship4Art } | null = null;

export function paintShip4(o: { storm?: boolean } = {}): Ship4Art {
  const storm = !!o.storm;
  if (cache && cache.storm === storm) return cache.art;
  LAMPS.length = 0;
  WINDOWS.length = 0;
  const lo = new Region(90, S4.lower.ceil - 2, 1390, S4.lower.floor - S4.lower.ceil + 10);
  engineRoom(lo); hold(lo); lab(lo); jennaRoom(lo); moriRoom(lo); forepeak(lo);
  for (const w of WALLS) if (w.level === 'lower') bulkhead(lo, w.x, S4.lower.ceil, S4.lower.floor);
  // ladders (drawn into the rooms)
  const ladder = (R: Region, x: number, y0: number, y1: number) => {
    for (let y = y0; y < y1; y++) { R.px(x - 6, y, P.plank[3]); R.px(x - 5, y, P.plank[1]); R.px(x + 5, y, P.plank[3]); R.px(x + 6, y, P.plank[1]); if ((y - y0) % 7 === 3) for (let i = -4; i <= 4; i++) R.px(x + i, y, i === -4 ? P.plank[3] : P.plank[2]); }
  };
  for (const L of LADDERS) if (L.bottom === S4.lower.floor) ladder(lo, L.x, S4.lower.ceil - 2, L.bottom);
  const ho = new Region(514, S4.house.ceil - 2, 612, S4.house.floor - S4.house.ceil + 10);
  galley(ho); mess(ho); captainRoom(ho);
  for (const w of WALLS) if (w.level === 'house') bulkhead(ho, w.x, S4.house.ceil, S4.house.floor);
  ladder(ho, 708, S4.house.floor - 2, S4.house.floor + 8);
  ladder(ho, 1104, S4.house.ceil - 2, S4.house.floor);
  // aft and forward end walls of the deckhouse (edge-on)
  for (const x of [520, 1120]) for (let y = S4.house.ceil; y < S4.house.floor - 64; y++) for (let i = -3; i <= 3; i++) ho.px(x + i, y, P.plankD[2]);
  const br = new Region(894, S4.bridge.ceil - 10, 232, S4.bridge.floor - S4.bridge.ceil + 16);
  bridgeRoom(br);
  ladder(br, 1104, S4.bridge.floor - 2, S4.bridge.floor + 6);
  const hull = new Region(30, 220, 1604, 172);
  paintHull(hull, storm);
  const hx = new Region(514, S4.upper.y - 2, 612, S4.house.floor - S4.upper.y + 4);
  houseExterior(hx, storm);
  const bx = new Region(894, S4.bridge.ceil - 12, 232, S4.bridge.floor - S4.bridge.ceil + 14);
  bridgeExterior(bx, storm);
  const db = new Region(30, 0, 1604, 282);
  bulwark(db, false);
  bowCap(db);
  paintDeckGear(db);
  const df = new Region(30, 200, 1604, 80);
  bulwark(df, true);
  const art: Ship4Art = {
    lower: lo.sprite(), house: ho.sprite(), bridge: br.sprite(),
    hull: hull.sprite(), houseExt: hx.sprite(), bridgeExt: bx.sprite(),
    deckBack: db.sprite(), deckFront: df.sprite(),
  };
  cache = { storm, art };
  return art;
}

/** which room contains a ship-local point (for lighting and the cutaway fades) */
export function roomAt(x: number, y: number): RoomDef | null {
  for (const r of ROOMS) {
    const L = r.level === 'lower' ? S4.lower : r.level === 'house' ? S4.house : S4.bridge;
    if (x >= r.x0 && x < r.x1 && y > L.ceil && y <= L.floor + 2) return r;
  }
  return null;
}

void shade; void Obj;

// V6: the Kittiwake is the small V3 boat again (cream hull, wheelhouse on deck, one lower deck), with
// the Day 1 story's rooms folded into it. Same interface as the big V4 ship (S4, rooms, ladders,
// lamps, windows, named spots, painted layers) so the ship scene and story run unchanged on it.
//
// Boat-local pixels = world pixels (600 x 236, bow toward +x, y down, waterline 206).
//   lower deck (ceil ~122, floor 202): engine room (Jenna's bench) · galley & mess · bunk room · hold (tank)
//   wheelhouse (ceil 24, floor 102): helm, radio, charts, Joshu's bench
//   main deck: stern (fishing, crane, herbs) · foredeck (deck chair, mast, bow)

import { PixelBuffer } from '../pixel';
import { paintBoatCutaway, BOAT_LAYOUT, deckY } from '../boat';
import * as D5 from './props';

export interface ShipSprite { buf: PixelBuffer; glow: PixelBuffer | null; sky?: PixelBuffer | null; x: number; y: number }
export interface Ship4Art {
  lower: ShipSprite; house: ShipSprite; bridge: ShipSprite;
  hull: ShipSprite; houseExt: ShipSprite; bridgeExt: ShipSprite;
  deckBack: ShipSprite; deckFront: ShipSprite;
}

const LOW_FLOOR = 202, HOLD_FLOOR = 196, WH_FLOOR = 102;

export const S4 = {
  W: 600,
  H: 236,
  WATER: 206,
  lower: { ceil: 122, floor: LOW_FLOOR, x0: 76, x1: 496 },
  main: { y: 116, x0: 30, x1: 540 },
  /** the galley & mess are below deck on the small boat */
  house: { ceil: 122, floor: LOW_FLOOR, x0: 196, x1: 336 },
  /** wheelhouse roof (not walkable) */
  upper: { y: 17, x0: 214, x1: 334 },
  bridge: { ceil: 24, floor: WH_FLOOR, x0: 214, x1: 334 },
};
export const PIVOT5: [number, number] = [300, 206];

export type Level = 'lower' | 'house' | 'bridge' | 'deck' | 'upper';
export interface RoomDef { id: string; name: string; level: 'lower' | 'house' | 'bridge'; x0: number; x1: number }
export const ROOMS: RoomDef[] = [
  { id: 'engine', name: 'Engine room', level: 'lower', x0: 76, x1: 196 },
  { id: 'galley', name: 'Galley', level: 'house', x0: 196, x1: 272 },
  { id: 'mess', name: 'Mess', level: 'house', x0: 272, x1: 336 },
  { id: 'mori', name: 'Bunk room', level: 'lower', x0: 336, x1: 424 },
  { id: 'hold', name: 'Hold', level: 'lower', x0: 424, x1: 500 },
  { id: 'bridge', name: 'Wheelhouse', level: 'bridge', x0: 214, x1: 334 },
];
const lad = (n: string) => BOAT_LAYOUT.ladders.find(l => l.name === n)!;
export const LADDERS = [
  { id: 'aft', x: lad('engineHatch').x, top: lad('engineHatch').y0, bottom: lad('engineHatch').y1 },
  { id: 'galley', x: lad('companionway').x, top: lad('companionway').y0, bottom: lad('companionway').y1 },
  { id: 'fwd', x: lad('foreHatch').x, top: lad('foreHatch').y0, bottom: lad('foreHatch').y1 },
];
/** walkable polylines: the lower deck (steps up into the hold) and the main deck over the wheelhouse */
export const FLOORS = {
  lower: BOAT_LAYOUT.floors.find(f => f.name === 'lower')!.pts,
  deck: BOAT_LAYOUT.floors.find(f => f.name === 'deck')!.pts,
};
/** the near sea must not draw above this line (the cutaway's hull bottom) */
export const CUTLINE = BOAT_LAYOUT.cutLine;
/** animated part mounts (wheel, radar, flag) */
export const MOUNTS = BOAT_LAYOUT.mounts;
/** fish tank water rect for the swimming fish */
export const TANK = { x0: 434, x1: 454, y0: 168, y1: 177, bx: 450 };

export interface LampDef { x: number; y: number; r: number; c: [number, number, number]; k: number; flicker?: number; room: string; kind?: 'bulb' | 'screen' | 'tank' | 'stove' | 'fairy' | 'window' }
export const LAMPS: LampDef[] = [];
export interface WindowDef { x: number; y: number; w: number; h: number; room: string; porthole?: boolean }
export const WINDOWS: WindowDef[] = [];
export const SPOTS: Record<string, [number, number]> = {};

const D = (x: number): [number, number] => [x, Math.round(deckY(x))];

function setupSpots() {
  const L = LOW_FLOOR;
  Object.assign(SPOTS, {
    // engine room
    jennaDesk: [100, L], engineFix: [160, L], fuseBox: [84, L], valve: [188, L], toolboard: [128, L],
    // galley & mess
    noodles: [206, L], kettle: [240, L], stove: [252, L], fridge: [276, L], bowls: [288, L],
    messSeat: [297, L], chess: [308, L], games: [326, L],
    // bunk room
    moriDesk: [350, L], moriBed: [372, L], chunkBed: [404, L], jennaBunk: [390, L],
    // hold (lab)
    tank: [444, HOLD_FLOOR], microscope: [484, HOLD_FLOOR], labPC: [470, HOLD_FLOOR], holdHide: [488, HOLD_FLOOR], dogFood: [476, HOLD_FLOOR], forepeak: [492, HOLD_FLOOR],
    // wheelhouse
    helm: [290, WH_FLOOR], radio: [250, WH_FLOOR], charts: [266, WH_FLOOR], captainBunk: [234, WH_FLOOR], modelShip: [244, WH_FLOOR], photosJ: [318, WH_FLOOR],
    // decks
    fishing: D(40), crane: D(68), herbs: D(186), roofChair: D(372), bow: D(530),
  });
}

function setupLights() {
  const room: Record<string, string> = { wheelhouse: 'bridge', galley: 'galley', mess: 'mess', bunks: 'mori', engine: 'engine', hold: 'hold' };
  for (const l of BOAT_LAYOUT.lamps) {
    const r = room[l.name] ?? 'deck';
    LAMPS.push({ x: l.x, y: l.y, r: l.radius * 1.1, c: l.color, k: r === 'deck' ? 0.35 : 0.55, room: r, kind: 'bulb' });
  }
  LAMPS.push({ x: 250, y: 190, r: 34, c: [1, 0.55, 0.25], k: 0.6, room: 'galley', kind: 'stove' });
  LAMPS.push({ x: 444, y: 172, r: 30, c: [0.4, 0.85, 1], k: 0.8, room: 'hold', kind: 'tank' });
  LAMPS.push({ x: 92, y: 172, r: 22, c: [0.5, 0.85, 1], k: 0.7, room: 'engine', kind: 'screen' });
  for (const wx of [228, 260, 292]) WINDOWS.push({ x: wx + 13, y: 49, w: 26, h: 30, room: 'bridge' });
  for (const [x, room2] of [[140, 'engine'], [262, 'galley'], [379, 'mori'], [452, 'hold']] as [number, string][]) WINDOWS.push({ x, y: 146, w: 8, h: 8, room: room2, porthole: true });
}

/** stamp a sprite with its bottom-left at (x, floorY) */
function put(dst: PixelBuffer, src: PixelBuffer, x: number, bottom: number, glowDst?: PixelBuffer, glow?: PixelBuffer) {
  const y0 = bottom - src.h;
  for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
    const v = src.data[j * src.w + i];
    if (v >>> 24) dst.set(x + i, y0 + j, v);
  }
  if (glowDst && glow) for (let j = 0; j < glow.h; j++) for (let i = 0; i < glow.w; i++) {
    const v = glow.data[j * glow.w + i];
    if (v >>> 24) glowDst.set(x + i - 1, y0 + j - 1, v);
  }
}

/** the Day 1 props the small boat didn't have: Jenna's screens, the tank, chess, the fridge, Chunk's things */
function furnish(b: PixelBuffer, g: PixelBuffer) {
  // engine room: Jenna's three screens (one on a wall arm) and her stool at the workbench
  const wm = D5.monitor(12, 8, true); put(b, wm.buf, 88, 165, g, wm.glow);
  const mon = D5.monitor(11, 9); put(b, mon.buf, 81, 180, g, mon.glow);
  const lap = D5.laptop('term'); put(b, lap.buf, 93, 180, g, lap.glow);
  put(b, D5.stool(), 96, LOW_FLOOR);
  // galley & mess: fridge, Chunk's bowls, chess on the table, the games shelf
  put(b, D5.fridge(), 268, LOW_FLOOR);
  put(b, D5.dogBowls(), 283, LOW_FLOOR);
  put(b, D5.chessBoard(), 302, 181);
  put(b, D5.gamesShelf(), 318, 150);
  // bunk room: Chunk's bed, Mori's laptop on the bunk, the species photo board
  put(b, D5.dogBed(), 396, LOW_FLOOR);
  const ml = D5.laptop('birds'); put(b, ml.buf, 346, 182, g, ml.glow);
  put(b, D5.photoBoard(17, 20), 404, 147);
  // hold: the research tank on its cabinet, the lab laptop, microscope and Chunky Chow crate
  const tank = D5.fishTank(24, 16); put(b, tank.buf, 432, HOLD_FLOOR, g, tank.glow);
  const lab = D5.laptop('graph'); put(b, lab.buf, 464, 176, g, lab.glow);
  put(b, D5.microscope(), 480, 176);
  put(b, D5.chowCrate(), 470, HOLD_FLOOR);
  // wheelhouse: photos on the forward panel, the model ship on its shelf over Joshu's berth
  put(b, D5.framedPhotos(), 310, 62);
  put(b, D5.modelShip(), 234, 85);
}

function furnishDeck(b: PixelBuffer) {
  put(b, D5.herbBox(), 178, Math.round(deckY(186)));
  put(b, D5.deckChair(), 364, Math.round(deckY(372)));
  put(b, D5.rodHolder(), 33, Math.round(deckY(34)));
  put(b, D5.cooler(), 150, Math.round(deckY(150)));
}

const empty = (): ShipSprite => ({ buf: new PixelBuffer(1, 1), glow: null, sky: null, x: 0, y: 0 });
let cache: { storm: boolean; art: Ship4Art } | null = null;

export function paintShip4(o: { storm?: boolean } = {}): Ship4Art {
  const storm = !!o.storm;
  if (cache && cache.storm === storm) return cache.art;
  LAMPS.length = 0;
  WINDOWS.length = 0;
  setupSpots();
  setupLights();
  const cut = paintBoatCutaway({ storm });
  const intB = cut.interior.buf.clone();
  const intG = cut.interior.glow ?? new PixelBuffer(intB.w, intB.h);
  furnish(intB, intG);
  const shell = cut.shell.buf;
  furnishDeck(shell);
  const sp = (buf: PixelBuffer, glow: PixelBuffer | null = null): ShipSprite => ({ buf, glow, sky: null, x: 0, y: 0 });
  const art: Ship4Art = {
    lower: sp(intB, intG),
    house: sp(shell),
    bridge: empty(),
    hull: sp(cut.hullSide.buf, cut.glow ?? null),
    houseExt: empty(),
    bridgeExt: sp(cut.cabinWall.buf),
    deckBack: empty(),
    deckFront: sp(cut.front.buf),
  };
  cache = { storm, art };
  return art;
}

export function roomAt(x: number, y: number): RoomDef | null {
  for (const r of ROOMS) {
    const L = r.level === 'bridge' ? S4.bridge : S4.lower;
    if (x >= r.x0 && x < r.x1 && y > L.ceil && y <= L.floor + 2) return r;
  }
  return null;
}


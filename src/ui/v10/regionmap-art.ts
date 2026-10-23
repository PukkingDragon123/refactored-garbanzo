// V10 Region Map painter: the island as a hand-built 3/4 pixel-art diorama at 2640 x 1760 (mapart/:
// ground fields, the lifted terrain with its cliff faces, light and cast shadows, the sea by depth,
// every plant painted one by one, the landmarks), plus two companions that share its geometry:
//   paper  aged parchment with Joshu's old chart traced on it (a faint coastline and depth lines,
//          rhumb lines, a compass rose, a cartouche, a sea serpent, a ship, a whale, the seas' names
//          lettered in the map's pixel font): what an unexplored place looks like
//   ink    the pen sketch of the painted map (outlines and hatching): a place glimpsed but not yet
//          walked, and the first stage of the reveal (sketched ink, then the colour washes in)
// It is painted once per session in a background worker (mapart/worker.ts; Vite inlines it, so the
// single-file build has it too), or, if no worker can start, on the main thread in time slices.
// prewarmMap() starts it early so the map is ready when it is first opened. regionmap-fx.ts composes
// and animates it. Places stand on the ground: proj() gives the point on the picture where a ground
// point shows (h pixels up for ground h pixels high).

import PaintWorker from './mapart/worker?worker&inline';
import { PixelBuffer } from '../../art/pixel';
import { C, hex } from '../../art/color';
import { clamp } from '../../core/math';
import { W, H, TAG, WK, INK, INK2, INK3, INK_RED, INK_BLUE } from './mapart/kit';
import type { MapArt } from './mapart/paint';
import { BIOME_N } from './mapgeo';

export { W, H, TAG, WK, INK, INK2, INK3, INK_RED, INK_BLUE };
export type { MapArt };

// ------------------------------------------------------------------ ground -> picture
const HW = W >> 1, HH = H >> 1;
let lift: Float32Array | null = null;
/** where a ground point shows on the painted map (lifted by its height) */
export function proj(x: number, y: number): [number, number] {
  if (!lift) return [x, y];
  const fx = clamp(x / 2, 0, HW - 1.001), fy = clamp(y / 2, 0, HH - 1.001);
  const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
  const a = lift[j * HW + i], b = lift[j * HW + i + 1], c = lift[(j + 1) * HW + i], d = lift[(j + 1) * HW + i + 1];
  const h = (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  return [x, y - h];
}
/** the ground's height at a point (0 before the map is painted) */
export function heightAt(x: number, y: number): number { return y - proj(x, y)[1]; }
export const projReady = () => !!lift;

// ------------------------------------------------------------------ painting it (once per session)
let artV: MapArt | null = null;
let paperV: Uint32Array | null = null;
let paperRes: ((p: Uint32Array) => void) | null = null, artRes: ((a: MapArt) => void) | null = null, artRej: ((e: unknown) => void) | null = null;
const paperP = new Promise<Uint32Array>(r => (paperRes = r));
const artP = new Promise<MapArt>((r, j) => { artRes = r; artRej = j; });
let started = false;
const T0 = { t: 0 };

function done(a: MapArt, lf: Float32Array, T: unknown) {
  lift = lf;
  artV = a;
  const w = window as unknown as { __rmPaint?: number; __rmT?: unknown };
  w.__rmPaint = performance.now() - T0.t;
  w.__rmT = T;
  artRes?.(a);
}
async function onMainThread() {
  const m = await import('./mapart/paint');
  const paper = await m.buildPaper();
  paperV = paper; paperRes?.(paper);
  const r = await m.buildArt(paper);
  done(r.art, r.lift, m.T);
}
function start() {
  if (started) return;
  started = true;
  T0.t = performance.now();
  let w: Worker | null = null;
  try { w = new PaintWorker(); } catch (e) { console.warn('[regionmap] no paint worker, painting here', e); }
  if (!w) { void onMainThread().catch(e => artRej?.(e)); return; }
  let fellBack = false;
  const fallBack = (why: unknown) => { if (fellBack) return; fellBack = true; console.warn('[regionmap] paint worker failed, painting here', why); w?.terminate(); void onMainThread().catch(e => artRej?.(e)); };
  w.onmessage = (e: MessageEvent<{ type: string; paper?: Uint32Array; art?: MapArt; lift?: Float32Array; T?: unknown; error?: string }>) => {
    const d = e.data;
    if (d.type === 'paper' && d.paper) { paperV = d.paper; paperRes?.(d.paper); }
    else if (d.type === 'art' && d.art && d.lift) { done(d.art, d.lift, d.T); w?.terminate(); }
    else if (d.type === 'error') fallBack(d.error);
  };
  w.onerror = ev => fallBack(ev.message);
  w.postMessage({ go: 1 });
}
/** start painting in the background (the first open is instant if this ran a little earlier) */
export function prewarmMap() { start(); }
/** the painted map, if it is ready */
export const mapArt = () => artV;
/** the parchment alone (quick: the map unrolls on it while the rest paints) */
export function paintPaper(): Promise<Uint32Array> { start(); return paperP; }
export const paperNow = () => paperV;
/** the whole map (later calls get the same promise) */
export function paintMap(): Promise<MapArt> { start(); return artP; }

// ------------------------------------------------------------------ glyphs for finds
/** 1-char palette: k ink, w paper, r red, g green, b blue, y gold, s stone, d dark, l light ink, m moss, o orange, c cyan, p pink */
const GP: Record<string, C> = {
  k: INK, w: hex('#f6ead0'), r: INK_RED, g: hex('#4f8a3a'), b: INK_BLUE, y: hex('#e0a818'), s: hex('#9a9484'), d: hex('#1c120a'), l: INK3,
  m: hex('#6e8a44'), o: hex('#d8783a'), c: hex('#3fd1c1'), p: hex('#d87a8a'), t: hex('#b88a52'), n: hex('#7a5430'),
};
const glyph = (rows: string[]): PixelBuffer => {
  const b = new PixelBuffer(rows[0].length, rows.length);
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = GP[r[x]]; if (c !== undefined) b.set(x, y, c); } });
  return b;
};
/** 7px symbols for discoveries on the map */
export const MARKS: Record<string, PixelBuffer> = {
  artifact: glyph(['...k...', '..kyk..', '.kyyyk.', 'kyywyyk', '.kyyyk.', '..kyk..', '...k...']),
  fossil: glyph(['.kkkkk.', 'kwwwwwk', 'kwkkkwk', 'kwkwkwk', 'kwwkwwk', '.kkkwk.', '....k..']),
  sample: glyph(['.kkkkk.', '..kwk..', '.kwwwk.', 'kwbbbwk', 'kbbbbbk', 'kbbbbbk', '.kkkkk.']),
  plant: glyph(['....kk.', '...kgk.', '..kggk.', '.kggk..', 'kggk...', '.kk....', 'k......']),
  landmark: glyph(['...k...', '..kyk..', 'kkyyykk', '.kyyyk.', '.kykyk.', 'kk...kk', '.......']),
  ecosystem: glyph(['...c...', '.c.k.c.', '..kwk..', 'ckwwwkc', '..kwk..', '.c.k.c.', '...c...']),
  cave: glyph(['.kkkkk.', 'kssssk.', 'ksdddsk', 'ksdddsk', 'kkkkkkk', '.......', '.......']),
  village: glyph(['...k...', '..krk..', '.krrrk.', 'krkkkrk', '.ktdtk.', '.ktdtk.', '.kkkkk.']),
  ruin: glyph(['k...k..', 'ks..sk.', 'ks.ksk.', 'kskksk.', 'ksssssk', 'kkkkkkk', '.......']),
  note: glyph(['kkkkkk.', 'kwwwwk.', 'kwllwk.', 'kwwwwk.', 'kwllwkk', 'kwwwwwk', 'kkkkkkk']),
};
export { BIOME_N };
void hex;

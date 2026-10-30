// V12 notebook: the MAP tab. A spread with Mori's own map of what he has walked, drawn from the region
// map's painter (src/ui/v10/regionmap-art.ts): the explored land in watercolour washes quantised to a
// few pale tones and dithered, its pen outlines kept, the coast he hasn't walked as a dotted pencil
// guess, the trails he took as dashed pencil, the places he found lettered in his hand, his finds as
// the map's little symbols, the camp as a tent, a red cross where he is now. View only: there is no
// fast travel, you walk.

import { LOCATIONS, isFound, lastPos, mapPoint, location } from '../../../game/v10/regions';
import { Art, col, dith, bayer, mixC } from '../../v11/paper/px';
import { hashStr } from '../../v11/paper/rng';
import { Flow } from './flow';
import type { Page } from './flow';
import { PW, PH, C, hand, handW, doodleArt, plot, pxLine, artOfData } from './art';

/** the map image across the spread (both pages) */
export const MAP_W = 360, MAP_H = 236, MAP_Y = 28;
/** where the map starts on the left page */
const MAP_X0 = PW * 2 - MAP_W - 16;

interface MapPic { art: Art; places: { x: number; y: number; name: string; camp: boolean }[]; here: [number, number] | null }
let mapP: Promise<MapPic | null> | null = null;
let lastMap: MapPic | null = null;
let mapKey = '';

async function buildMap(): Promise<MapPic | null> {
  const art = await import('../../v10/regionmap-art');
  const fx = await import('../../v10/regionmap-fx');
  const M = await art.paintMap();
  const W = art.W, H = art.H;
  const k = W / MAP_W, kh = H / MAP_H;
  const out = new Art(MAP_W, MAP_H);
  // ---- explored: a coverage field at map-picture resolution, grown from the walked seeds
  const seeds = fx.seedsOf(fx.currentSeedState(), null);
  const N = MAP_W * MAP_H;
  const f = new Float32Array(N).fill(-60);
  for (const s of seeds) {
    const x = Math.round(s.x / k), y = Math.round(s.y / kh);
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
    const r = s.r / k;
    if (r > f[y * MAP_W + x]) f[y * MAP_W + x] = r;
  }
  const D = 1.414;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = y * MAP_W + x;
    let b = f[i];
    if (x > 0) b = Math.max(b, f[i - 1] - 1);
    if (y > 0) { b = Math.max(b, f[i - MAP_W] - 1); if (x > 0) b = Math.max(b, f[i - MAP_W - 1] - D); if (x < MAP_W - 1) b = Math.max(b, f[i - MAP_W + 1] - D); }
    f[i] = b;
  }
  for (let y = MAP_H - 1; y >= 0; y--) for (let x = MAP_W - 1; x >= 0; x--) {
    const i = y * MAP_W + x;
    let b = f[i];
    if (x < MAP_W - 1) b = Math.max(b, f[i + 1] - 1);
    if (y < MAP_H - 1) { b = Math.max(b, f[i + MAP_W] - 1); if (x < MAP_W - 1) b = Math.max(b, f[i + MAP_W + 1] - D); if (x > 0) b = Math.max(b, f[i + MAP_W - 1] - D); }
    f[i] = b;
  }
  // ---- the picture: box-averaged colour, ink kept where the pen sketch is dense, land / sea per box
  const paperC = col('#efe4c6'), inkC = col('#3a2a1e'), coastC = col('#6a6052');
  const land = new Uint8Array(N);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    let r = 0, g = 0, b = 0, n = 0, ink = 0, ln = 0;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const sx = Math.min(W - 1, Math.floor((x + (i + 0.5) / 4) * k)), sy = Math.min(H - 1, Math.floor((y + (j + 0.5) / 4) * kh));
      const si = sy * W + sx;
      const c = M.color[si];
      r += c & 255; g += (c >>> 8) & 255; b += (c >>> 16) & 255; n++;
      if (M.ink[si] >>> 24) ink++;
      if (M.land[si]) ln++;
    }
    land[y * MAP_W + x] = ln >= 8 ? 1 : 0;
    const cov = f[y * MAP_W + x];
    if (cov <= 0) continue;
    // a pale watercolour: lightened, posterised to a few tones, dithered
    const t = bayer(x, y) - 0.5;
    const q = (v: number) => Math.max(0, Math.min(255, Math.round(((v / n) / 255 * 5 + t * 0.9)) * 51));
    let c = (255 << 24 | q(b) << 16 | q(g) << 8 | q(r)) >>> 0;
    c = mixC(c, paperC, 0.38);
    // the edge of what's explored washes out in dithered steps
    if (cov < 3 && !dith(x, y, cov / 3)) continue;
    out.put(x, y, ink >= 5 ? mixC(c, inkC, 0.7) : c);
  }
  // ---- the coast: inked where walked, a dotted pencil guess elsewhere
  for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) {
    const i = y * MAP_W + x;
    if (!land[i]) continue;
    if (land[i - 1] && land[i + 1] && land[i - MAP_W] && land[i + MAP_W]) continue;
    if (f[i] > 0) out.put(x, y, inkC);
    else if ((x + y) % 3 === 0) out.put(x, y, coastC);
  }
  // ---- trails walked: dashed pencil
  const pencil = col('#5c574e');
  for (const L of LOCATIONS) {
    for (const r of L.routes ?? []) {
      const e = fx.routeEnds(r.from, L.id);
      if (!e || !isFound(L.id) || !isFound(r.from)) continue;
      const [[ax, ay], [bx, by]] = e;
      const p = pxLine(ax / k, ay / kh, bx / k, by / kh);
      p.forEach(([x, y], i) => { if (i % 5 < 3) out.put(x, y, pencil); });
    }
  }
  // ---- finds: the map's own little symbols
  try {
    const { discoveries } = await import('../../../game/v10/regions');
    for (const d of discoveries()) {
      const l = location(d.loc);
      if (!l) continue;
      const mk = art.MARKS[d.kind] ?? art.MARKS.note;
      const [u, v] = mapPoint(d.loc, d.x ?? (l.pos ? 0 : 0));
      const [mx, my] = fx.onMap(u, v);
      const g = artOfData(mk.w, mk.h, mk.data);
      out.blit(g, Math.round(mx / k) - 3, Math.round(my / kh) - 3);
    }
  } catch { /* no finds */ }
  const places = LOCATIONS.filter(l => isFound(l.id)).map(l => { const [x, y] = fx.onMap(l.pos[0], l.pos[1]); return { x: Math.round(x / k), y: Math.round(y / kh), name: l.name, camp: l.id === 'camp' }; });
  let here: [number, number] | null = null;
  const lp = lastPos();
  if (lp && location(lp.loc)) { const [u, v] = mapPoint(lp.loc, lp.x); const [x, y] = fx.onMap(u, v); here = [Math.round(x / k), Math.round(y / kh)]; }
  return { art: out, places, here };
}

function getMap(): Promise<MapPic | null> {
  const key = JSON.stringify([LOCATIONS.filter(l => isFound(l.id)).length, lastPos()]);
  if (!mapP || key !== mapKey) { mapKey = key; mapP = buildMap().catch(e => { console.warn('[notebook map]', e); return null; }); }
  return mapP;
}

/** draw the part of the map that falls on a page (side 'l' or 'r') */
function drawHalf(a: Art, m: MapPic, side: 'l' | 'r') {
  const toPage = (mx: number) => mx + MAP_X0 - (side === 'l' ? 0 : PW);
  const src = m.art;
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const px = toPage(x);
    if (px < 0 || px >= PW) continue;
    const c = src.d[y * src.w + x];
    if (c >>> 24) a.put(px, MAP_Y + y, c);
  }
  // the gutter shades the map too
  const g = col('#3a2410');
  for (let y = MAP_Y; y < MAP_Y + MAP_H; y++) for (let i = 0; i < 8; i++) {
    const x = side === 'r' ? i : PW - 1 - i;
    if (dith(x, y, Math.pow(1 - i / 8, 2) * 0.5)) a.put(x, y, mixC(a.get(x, y), g, 0.3));
  }
  // camp, places, here
  for (const p of m.places) {
    const x = toPage(p.x), y = MAP_Y + p.y;
    if (p.camp) a.blit(doodleArt('tent', 12, C.ink, { pencil: false }), x - 6, y - 10);
    else { a.put(x, y, C.ink); a.put(x - 1, y, C.ink); a.put(x + 1, y, C.ink); a.put(x, y - 1, C.ink); a.put(x, y + 1, C.ink); }
    const w = handW(p.name);
    const lx = Math.max(2, Math.min(PW - w - 2, x - Math.round(w / 2)));
    if (x > -40 && x < PW + 40) hand(a, p.name, lx, y + 11, C.ink);
  }
  if (m.here) {
    const x = toPage(m.here[0]), y = MAP_Y + m.here[1];
    for (let i = -3; i <= 3; i++) { a.put(x + i, y + i, C.red); a.put(x + i, y - i, C.red); a.put(x + i + 1, y + i, C.red); a.put(x + i + 1, y - i, C.red); }
  }
}

export interface MapBuild { pages: Page[]; anchors: Record<string, string> }

export function mapPages(): MapBuild {
  const f = new Flow('map', 'm:l', { head: 'map', paper: 'plain' });
  const half = (side: 'l' | 'r') => {
    const pg = f.page(side === 'l' ? 'm:l' : 'm:r', { head: side === 'l' ? 'where I have walked' : 'map', paper: 'plain' });
    pg.ops.push(c => {
      const m = c.pic('map:' + mapKey, () => getMap().then(mm => { lastMap = mm; return mm?.art ?? null; }));
      if (!m || !lastMap) {
        hand(c.a, 'sketching the map...', side === 'l' ? 60 : 20, 120, C.pencil, { pencil: true });
        return;
      }
      drawHalf(c.a, lastMap, side);
      if (side === 'l') {
        hand(c.a, 'Where I have walked', 18, 22, C.ink, { bold: true });
        c.a.blit(doodleArt('compass', 28, C.ink, { pencil: false, seed: 2 }), 10, PH - 40);
        hand(c.a, 'N', 21, PH - 42, C.red, { bold: true });
      } else {
        hand(c.a, 'no ferry, no shortcuts: walk it', PW - 8 - handW('no ferry, no shortcuts: walk it'), PH - 10, C.pencil, { pencil: true });
        c.a.blit(doodleArt('footprints', 22, C.pencil, { pencil: true, seed: 3 }), PW - 30, 6);
      }
    });
  };
  half('l');
  half('r');
  void hashStr;
  return { pages: f.pages, anchors: { map: 'm:l' } };
}
/** start painting the map (so it's ready when the tab is opened) */
export function prewarmNotebookMap() { void getMap().then(m => { lastMap = m; }); }

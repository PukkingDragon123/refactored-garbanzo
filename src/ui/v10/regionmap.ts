// V10 Region Map: Mori's own map of the island, a big sheet of aged paper he unrolls on the table.
// Only Joshu's old chart is on it at first (a faint coastline, depth lines, a compass rose, rhumb
// lines, a sea serpent); every stretch Mori walks is sketched in ink and then the colour washes in,
// and from then on that land is a living 3/4 diorama: surf, rivers, smoke, clouds, birds, the odd
// whale (regionmap-art.ts paints it, regionmap-fx.ts animates it).
//
// Everything on and around it is pixel art drawn in code (regionmap-ui.ts, the map font in
// mapfont.ts): place names on little paper banners that never overlap (and step aside or hide as the
// zoom changes), the land's names lettered big across it, illustrated checkpoint pins (a medallion
// per kind of place, a picture per place), flagged stakes for the ways on, a pixel legend, wooden
// zoom buttons, the place card, the roll of parchment. The zoom rests on whole-number scales.
//
// Tap a pin for its card; "Set off" draws the route in red ink from where Mori is, walks (or sails)
// a marker along it while the clock runs, then rolls the map up and returns the target: from camp
// the caller sets off (field10 departFromCamp); on an expedition (opts.travelFrom) the caller moves
// on to that checkpoint (maptravel travelOn). Pan with a drag, zoom with the wheel or a pinch.
// openRegionMap() resolves with the target ('loc' or 'loc@x') or null.

import { game } from '../../game/game';
import { audio } from '../../core/audio';
import { guardInput } from '../../core/input';
import { el } from '../ui';
import { PixelBuffer } from '../../art/pixel';
import { hex, mix } from '../../art/color';
import { clamp, hash2, bayer } from '../../core/math';
import { W, H, INK, INK2, MARKS, paintMap, paintPaper, proj } from './regionmap-art';
import { LiveMap, currentSeedState, lastShown, markShown, routeEnds, sketchCard, onMap } from './regionmap-fx';
import type { SeedState } from './regionmap-fx';
import { SEA_LANES, REGION_NAMES, S } from './mapgeo';
import {
  LOCATIONS, location, isFound, isRumoured, mapPoint, explored, discoveries, discoveriesAt, mapNotes, homeCost, syncReachable, lastPos,
  onMapChange, BINS, xRange, seenBins, isIsland,
} from '../../game/v10/regions';
import type { LocationDef, Discovery } from '../../game/v10/regions';
import { currentExpedition, expeditionHour, clockText } from '../../game/v10/expedition';
import { energy, maxEnergy } from '../../game/v10/energy';
import { dayNumber } from '../../game/v10/day';
import { junctions, tripTo, tripNeed, routePath, targetId, arrivalHour } from '../../game/v10/maptravel';
import type { Target, TripCost } from '../../game/v10/maptravel';
import { speciesSprite } from '../icons';
import { SPECIES_BY_ID } from '../../game/species';
import { GH, measure, drawText, wrap, toImageData } from './mapfont';
import {
  UI, plate, bigText, pinURL, pinBuffer, stakeURL, moriURL, buttonURL, panel, gauge, woodURL, rollRow, rollCap, cachedURL, para,
} from './regionmap-ui';
import type { PlateKind, Glyph } from './regionmap-ui';

export interface RegionMapOpts {
  /** no travelling from camp (during an expedition) */
  readOnly?: boolean;
  /** on an expedition: travel on from here to another checkpoint (or home) */
  travelFrom?: { loc: string; x: number };
  /** where Mori is ("you are here") */
  here?: { loc: string; x: number };
  /** select this location when the map opens */
  focus?: string;
}

const REGION_NAME: Record<string, string> = { home: 'Home shore', interior: 'The interior', south: 'The south', east: 'The east coast', ocean: 'Open sea', isle2: 'Offshore' };
const KIND_NAME: Record<string, string> = { camp: 'Camp', site: 'Wild place', village: 'Village', ruin: 'Ruins', cave: 'Cave', fossil: 'Fossil bed', ecosystem: 'Strange ecosystem', ocean: 'Open sea', island: 'Island' };
const ROUTE_WORD: Record<string, string> = { walk: 'a walk', climb: 'a climb', swim: 'a swim', wade: 'a wade', dive: 'a dive', tunnel: 'a rope descent' };
const fmtH = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : `${h % 1 ? h.toFixed(1) : h} h`);
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeO = (t: number) => 1 - Math.pow(1 - t, 3);
/** what the visible content of the sheet spans (map px): the island, its lift and the islets */
const CONTENT = { x0: 70, y0: 50, x1: 2590, y1: 1660 };

// ------------------------------------------------------------------ species sketches
const inked = new Map<string, PixelBuffer | null>();
const pending = new Map<string, Promise<void>>();
/** the species sprite as a little sepia sketch (ink outline, a light wash inside), at most 18px */
function inkSpecies(id: string): Promise<void> {
  if (inked.has(id)) return Promise.resolve();
  let p = pending.get(id);
  if (p) return p;
  p = new Promise<void>(res => {
    let url = '';
    try { url = speciesSprite(id); } catch { url = ''; }
    if (!url) { inked.set(id, null); res(); return; }
    const img = new Image();
    img.onload = () => {
      const s = 3, w0 = Math.floor(img.width / s), h0 = Math.floor(img.height / s);
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0);
      const src = g.getImageData(0, 0, img.width, img.height).data;
      const k = Math.max(1, Math.ceil(Math.max(w0, h0 * 1.4) / 18));
      const w = Math.max(1, Math.floor(w0 / k)), h = Math.max(1, Math.floor(h0 / k));
      const b = new PixelBuffer(w + 2, h + 2);
      const op = new Uint8Array((w + 2) * (h + 2));
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const sx = (x * k + Math.floor(k / 2)) * s + 1, sy = (y * k + Math.floor(k / 2)) * s + 1;
        const i = (sy * img.width + sx) * 4;
        if (src[i + 3] < 100) continue;
        const lum = (src[i] * 0.3 + src[i + 1] * 0.55 + src[i + 2] * 0.15) / 255;
        op[(y + 1) * (w + 2) + x + 1] = 1;
        b.set(x + 1, y + 1, lum < 0.28 ? INK2 : mix(hex('#c8ad78'), hex('#8a6c48'), clamp(1 - lum)));
      }
      for (let y = 0; y < h + 2; y++) for (let x = 0; x < w + 2; x++) {
        if (op[y * (w + 2) + x]) continue;
        const n = (x > 0 && op[y * (w + 2) + x - 1]) || (x < w + 1 && op[y * (w + 2) + x + 1]) || (y > 0 && op[(y - 1) * (w + 2) + x]) || (y < h + 1 && op[(y + 1) * (w + 2) + x]);
        if (n) b.set(x, y, INK);
      }
      inked.set(id, b);
      res();
    };
    img.onerror = () => { inked.set(id, null); res(); };
    img.src = url;
  });
  pending.set(id, p);
  return p;
}
/** the species sprite at 1 art px per sprite px (for the card) */
const spriteImgs = new Map<string, HTMLImageElement>();
function spriteImg(id: string, done: () => void): HTMLImageElement | null {
  let im = spriteImgs.get(id);
  if (im) return im.complete && im.naturalWidth ? im : null;
  im = new Image();
  im.onload = done;
  try { im.src = speciesSprite(id); } catch { /* no sprite */ }
  spriteImgs.set(id, im);
  return null;
}

interface Spot { x: number; y: number; d: Discovery }
/** discovery marks laid out beside their path, alternating sides so they don't sit on the trail */
function spots(): Spot[] {
  const out: Spot[] = [];
  const used = new Map<string, number>();
  for (const d of discoveries()) {
    if (d.kind === 'location') continue;
    const L = location(d.loc);
    if (!L) continue;
    const x = d.x ?? (xRange(L)[0] + xRange(L)[1]) / 2;
    const [u, v] = mapPoint(d.loc, x), [u2, v2] = mapPoint(d.loc, x + 60);
    let nx = -(v2 - v) * H, ny = (u2 - u) * W;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl; ny /= nl;
    const key = `${d.loc}:${Math.round(x / 120)}`;
    const k = used.get(key) ?? 0;
    used.set(key, k + 1);
    const side = k % 2 ? -1 : 1, ring = (11 + Math.floor(k / 2) * 11) * S * 0.8;
    const [px, py] = onMap(u, v);
    out.push({ x: px + nx * ring * side + (k > 1 ? (k % 3) * 8 : 0), y: py + ny * ring * side, d });
  }
  return out;
}
/** the trail walked through each place (lifted map px), split where it hasn't been walked */
function walkedTrails(): { pts: [number, number][]; beach: boolean }[] {
  const out: { pts: [number, number][]; beach: boolean }[] = [];
  for (const L of LOCATIONS) {
    if (!L.path) continue;
    const bins = seenBins(L.id), [a, b] = xRange(L);
    let run: [number, number][] = [];
    const flush = () => { if (run.length > 1) out.push({ pts: run, beach: isIsland(L) }); run = []; };
    for (let i = 0; i < BINS; i++) {
      if (!bins[i]) { flush(); continue; }
      const x0 = a + ((b - a) * i) / BINS, x1 = a + ((b - a) * (i + 1)) / BINS;
      for (let k = run.length ? 1 : 0; k <= 3; k++) { const [u, v] = mapPoint(L.id, x0 + ((x1 - x0) * k) / 3); run.push(onMap(u, v)); }
    }
    flush();
  }
  return out;
}

// ------------------------------------------------------------------ the window
const CSS = `
.rm11 { position: absolute; inset: 0; z-index: 60; pointer-events: auto; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none; opacity: 0; transition: opacity 0.25s steps(4);
  background-color: #20120a; background-repeat: repeat; image-rendering: pixelated; }
.rm11.on { opacity: 1; }
.rm11 canvas.sh { position: absolute; left: 0; top: 0; width: 100%; height: 100%; image-rendering: pixelated; }
.rm11 img, .rm11 canvas { image-rendering: pixelated; image-rendering: crisp-edges; }
.rm11 .ov { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.rm11 .ov > * { position: absolute; left: 0; top: 0; }
.rm11.drag { cursor: grabbing; }
.rm11 .lb { display: block; pointer-events: none; }
.rm11 .lb.new { animation: rmWrite 1.2s steps(10) both; }
@keyframes rmWrite { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
.rm11 .cp { width: 0; height: 0; pointer-events: none; }
.rm11 .cp i { position: absolute; display: block; background-size: 100% 100%; image-rendering: pixelated; transform-origin: 50% 100%; }
.rm11 .cp.hov i, .rm11 .cp.sel i { transform: translateY(calc(var(--u) * -2px)); }
.rm11 .cp.drop i { animation: rmDrop 0.6s steps(6) both; }
@keyframes rmDrop { 0% { transform: translateY(calc(var(--u) * -18px)); opacity: 0; } 40% { opacity: 1; } 70% { transform: translateY(calc(var(--u) * 1px)); } 100% { transform: none; opacity: 1; } }
.rm11 .cp.stamp i { animation: rmStamp 0.4s steps(4); }
@keyframes rmStamp { 0% { transform: none; } 40% { transform: translateY(calc(var(--u) * -5px)); } 100% { transform: none; } }
.rm11 .ring { position: absolute; display: block; background-size: 400% 100%; image-rendering: pixelated; animation: rmRing 0.8s steps(4) infinite; }
@keyframes rmRing { from { background-position: 0 0; } to { background-position: -400% 0; } }
.rm11 .jn { width: 0; height: 0; }
.rm11 .jn i { position: absolute; display: block; background-size: 300% 100%; image-rendering: pixelated; animation: rmFlag 0.6s steps(3) infinite; }
.rm11 .jn.sel i, .rm11 .jn.hov i { transform: translateY(calc(var(--u) * -2px)); }
@keyframes rmFlag { from { background-position: 0 0; } to { background-position: -300% 0; } }
.rm11 .here { width: 0; height: 0; }
.rm11 .here i { position: absolute; display: block; background-size: 200% 100%; image-rendering: pixelated; animation: rmBob 1.2s steps(2) infinite; }
.rm11 .here .lb { position: absolute; }
.rm11 .here.far .lb { display: none; }
@keyframes rmBob { from { background-position: 0 0; } to { background-position: -200% 0; } }
.rm11 .walker { width: 0; height: 0; }
.rm11 .walker i { position: absolute; display: block; background-size: 200% 100%; image-rendering: pixelated; animation: rmStep 0.36s steps(2) infinite; }
@keyframes rmStep { from { background-position: 0 0; } to { background-position: -200% 0; } }
.rm11 .top { position: absolute; left: 50%; top: calc(var(--u) * 4px); transform: translateX(-50%); pointer-events: none; z-index: 3; }
.rm11 .x { position: absolute; right: calc(var(--u) * 6px); top: calc(var(--u) * 5px); z-index: 3; }
.rm11 .pbtn { display: block; padding: 0; border: 0; background-color: transparent; background-repeat: no-repeat; background-size: 300% 100%; image-rendering: pixelated; cursor: pointer;
  width: calc(var(--u) * 18px); height: calc(var(--u) * 20px); }
.rm11 .pbtn:hover { background-position: 50% 0; }
.rm11 .pbtn:active { background-position: 100% 0; }
.rm11 .tools { position: absolute; left: calc(var(--u) * 6px); bottom: calc(var(--u) * 7px); display: flex; flex-direction: column; gap: calc(var(--u) * 3px); z-index: 3; }
.rm11 .legend { position: absolute; left: calc(var(--u) * 28px); bottom: calc(var(--u) * 7px); pointer-events: none; z-index: 3; }
.rm11 .legend.off { display: none; }
.rm11 .card { position: absolute; right: calc(var(--u) * 8px); top: calc(var(--u) * 26px); display: none; pointer-events: auto; z-index: 4; }
.rm11 .card.on { display: block; animation: rmCard 0.24s steps(4); }
@keyframes rmCard { from { transform: translateY(calc(var(--u) * -8px)); opacity: 0; } to { transform: none; opacity: 1; } }
.rm11 .card .cbtn { position: absolute; padding: 0; border: 0; background-color: transparent; background-repeat: no-repeat; image-rendering: pixelated; cursor: pointer; }
.rm11 .card .cbtn:hover { filter: none; }
.rm11 .card .cbtn[disabled] { cursor: default; }
.rm11 .card .cx { position: absolute; padding: 0; border: 0; background-color: transparent; background-size: 300% 100%; image-rendering: pixelated; cursor: pointer; }
.rm11 .card .cx:hover { background-position: 50% 0; }
.rm11 .hint { position: absolute; left: 50%; bottom: calc(var(--u) * 6px); transform: translateX(-50%); pointer-events: none; z-index: 3; transition: opacity 0.4s steps(4); }
.rm11.busy .tools, .rm11.busy .legend, .rm11.busy .hint { opacity: 0; transition: opacity 0.3s steps(3); pointer-events: none; }
.rm11.phone .legend { display: none; }
.rm11.phone .legend.show { display: block; left: calc(var(--u) * 6px); bottom: auto; top: calc(var(--u) * 26px); }
.rm11.phone .hint { display: none; }
.rm11.phone .tools { left: auto; right: calc(var(--u) * 6px); bottom: auto; top: calc(var(--u) * 26px); }
.rm11.phone .card { left: calc(var(--u) * 4px); right: calc(var(--u) * 4px); top: auto; bottom: calc(var(--u) * 4px); }
`;
let styled = false;
function ensureStyle() {
  if (styled) return;
  styled = true;
  document.head.appendChild(el('style', '', CSS));
}

interface LabelArt { url: string; w: number; h: number }
const labelArt = new Map<string, LabelArt>();
/** a pixel buffer as an <img> source with its size (cached by key) */
function art(key: string, make: () => PixelBuffer): LabelArt {
  let a = labelArt.get(key);
  if (!a) { const b = make(); a = { url: b.toDataURL(1), w: b.w, h: b.h }; labelArt.set(key, a); }
  return a;
}
const imgEl = (a: LabelArt, cls = 'lb') => { const e = document.createElement('img'); e.className = cls; e.src = a.url; e.alt = ''; e.draggable = false; e.dataset.w = String(a.w); e.dataset.h = String(a.h); return e; };

interface Lab { el: HTMLElement; x: number; y: number; w: number; h: number; min: number; max?: number; pri: number; loc?: string; region?: [number, number]; anchor: 'pin' | 'center' | 'free'; scaleK?: number; place?: [number, number] }
interface Pin { el: HTMLElement; x: number; y: number; id: string; loc: string; t: Target; small: boolean; min: number; w: number; h: number }

/** open the Region Map; resolves with the target picked for travel ('loc' or 'loc@x'; null: closed) */
export function openRegionMap(o: RegionMapOpts = {}): Promise<string | null> {
  ensureStyle();
  syncReachable();
  const ui = game.ui;
  ui.modalOpen++;
  audio.play('pageTurn', { vol: 0.55 });
  const root = el('div', 'rm11');
  const travelMode: 'camp' | 'on' | 'none' = o.travelFrom ? 'on' : o.readOnly ? 'none' : 'camp';
  root.innerHTML = `<canvas class="sh"></canvas><div class="ov"></div>
    <div class="top"></div>
    <button class="pbtn x" title="Close (Esc)"></button>
    <div class="tools"><button class="pbtn zi" title="Zoom in (+)"></button><button class="pbtn zo" title="Zoom out (-)"></button><button class="pbtn zc" title="Where am I? (C)"></button><button class="pbtn zf" title="The whole island (F)"></button><button class="pbtn zl" title="Legend"></button></div>
    <div class="legend"></div>
    <div class="card"></div>
    <div class="hint"></div>`;
  ui.modalLayer.appendChild(root);
  requestAnimationFrame(() => root.classList.add('on'));
  // the table covers the whole screen: freeze the world behind it once it has faded in
  let covering = false;
  const coverT = window.setTimeout(() => { game.covered++; covering = true; }, 300);
  const cv = root.querySelector('canvas.sh') as HTMLCanvasElement, ov = root.querySelector('.ov') as HTMLElement;
  const card = root.querySelector('.card') as HTMLElement, top = root.querySelector('.top') as HTMLElement, leg = root.querySelector('.legend') as HTMLElement;
  const hint = root.querySelector('.hint') as HTMLElement;
  const g = cv.getContext('2d')!;
  const phone = () => root.clientWidth <= 720 || root.clientHeight <= 520;

  // ---- the UI pixel size: whole device pixels per art pixel
  let dpr = 1, u = 2;
  const setScale = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    const base = phone() ? 2 : root.clientWidth >= 1700 && root.clientHeight >= 900 ? 3 : 2;
    u = Math.max(1, Math.round(base * dpr)) / dpr;
    root.style.setProperty('--u', String(u));
    root.classList.toggle('phone', phone());
    root.style.backgroundImage = `url(${woodURL()})`;
    root.style.backgroundSize = `${96 * u * 2}px ${64 * u * 2}px`;
  };
  const btnBg = (sel: string, gl: Glyph, red = false) => { (root.querySelector(sel) as HTMLElement).style.backgroundImage = `url(${buttonURL(gl, red)})`; };
  btnBg('.x', 'close', true); btnBg('.zi', 'plus'); btnBg('.zo', 'minus'); btnBg('.zc', 'here'); btnBg('.zf', 'fit'); btnBg('.zl', 'legend');

  // ---- header: the title plate, the day, the clock, the energy gauge
  const cur = currentExpedition();
  const hour0 = cur ? expeditionHour() : game.save.vars['v10:hour'] ?? 7.5;
  let headKey = '';
  const header = (h = hour0, e = energy(), to?: number) => {
    const key = `${dayNumber()}|${clockText(h)}|${to !== undefined ? clockText(to) : ''}|${Math.round(e)}|${u}`;
    if (key === headKey) return;
    headKey = key;
    const t1 = 'REGION MAP', day = `Day ${dayNumber()}`, clk = clockText(h) + (to !== undefined ? ' → ' + clockText(to) : '');
    const en = `${Math.round(e)}/${maxEnergy()}`;
    const tw = measure(t1, { bold: true, track: 2 });
    const w = tw + 16 + 8 + measure(day) + 10 + 9 + measure(clk) + 10 + 9 + 62 + measure(en) + 12;
    const b = new PixelBuffer(w + 3, 22);
    b.blit(panel(w, 19, { tone: 'dark' }), 0, 0);
    // the title on a red plate at the left end
    const pw = tw + 14;
    for (let y = 2; y < 17; y++) for (let x = 2; x < pw; x++) b.set(x, y, y === 2 || y === 16 || x === 2 || x === pw - 1 ? hex('#3a0a06') : y === 3 ? hex('#e8644a') : y >= 14 ? hex('#7a1a10') : hex('#b8321e'));
    drawText(b, t1, 9, 3, hex('#fff2dc'), { bold: true, track: 2, shadow: hex('#4a0c06') });
    let x = pw + 8;
    drawText(b, day, x, 3, hex('#f4e6c0'));
    x += measure(day) + 10;
    // a clock face
    for (let yy = 0; yy < 9; yy++) for (let xx = 0; xx < 9; xx++) { const d = Math.hypot(xx - 4, yy - 4); if (d < 4.6) b.set(x + xx, 5 + yy, d > 3.5 ? hex('#e8c050') : hex('#f4ecd4')); }
    b.set(x + 4, 7, hex('#2a1a0c')); b.set(x + 4, 8, hex('#2a1a0c')); b.set(x + 4, 9, hex('#2a1a0c')); b.set(x + 5, 9, hex('#2a1a0c')); b.set(x + 6, 9, hex('#2a1a0c'));
    x += 12;
    drawText(b, clk, x, 3, to !== undefined ? hex('#ffb38a') : hex('#f4e6c0'));
    x += measure(clk) + 10;
    // energy: a bolt and a segmented gauge
    for (const [dx, dy] of [[3, 0], [2, 1], [3, 1], [1, 2], [2, 2], [1, 3], [2, 3], [3, 3], [4, 3], [2, 4], [3, 4], [2, 5], [1, 6]]) b.set(x + dx, 5 + dy, hex('#8ae0ff'));
    x += 8;
    gauge(b, x, 6, 58, e, maxEnergy(), hex('#5ad0f0'), hex('#2a88b0'));
    x += 62;
    drawText(b, en, x, 3, hex('#8ad8ff'));
    const c = document.createElement('img');
    c.src = b.toDataURL(1);
    c.style.width = b.w * u + 'px'; c.style.height = b.h * u + 'px';
    c.draggable = false;
    top.replaceChildren(c);
  };

  // ---- legend and hint
  const buildLegend = () => {
    const campL = location('camp')!;
    const rows: [string, (b: PixelBuffer, x: number, y: number) => void][] = [
      ['Camp', (b, x, y) => b.blit(scaleDown(pinBuffer(campL)), x, y - 3)],
      ['Checkpoint', (b, x, y) => b.blit(scaleDown(pinBuffer(location('fernwood') ?? campL)), x, y - 3)],
      ['Way on', (b, x, y) => { for (let k = 0; k < 10; k++) { b.set(x + 5, y + k, hex('#7a5430')); } for (const [dx, dy] of [[6, 0], [7, 1], [8, 1], [6, 2], [9, 2], [7, 2]]) b.set(x + dx, y + dy, hex('#d03a2a')); }],
      ['Heard of', (b, x, y) => drawText(b, '?', x + 3, y - 2, UI.ink3, { bold: true })],
      ['Trail walked', (b, x, y) => { for (let k = 0; k < 12; k++) { b.set(x + k, y + 4, k % 5 === 0 ? hex('#a88a54') : hex('#c8a86a')); b.set(x + k, y + 5, hex('#6e5432')); } }],
      ['Way taken', (b, x, y) => { for (let k = 0; k < 12; k++) if (k % 4 < 2) { b.set(x + k, y + 4, UI.red); b.set(x + k, y + 5, UI.red); } }],
      ['Find', (b, x, y) => b.blit(MARKS.artifact, x + 2, y + 1)],
      ['Note', (b, x, y) => b.blit(MARKS.note, x + 2, y + 1)],
    ];
    const colW = 74, rowH = 13;
    const w = colW * 2 + 10, h = Math.ceil(rows.length / 2) * rowH + 18;
    const b = new PixelBuffer(w + 3, h + 3);
    b.blit(panel(w, h, { pin: true }), 0, 0);
    drawText(b, 'Legend', 6, 3, UI.ink, { bold: true });
    rows.forEach(([t, ic], k) => {
      const cx = 6 + (k % 2) * colW, cy = 16 + Math.floor(k / 2) * rowH;
      ic(b, cx, cy);
      drawText(b, t, cx + 15, cy - 1, UI.ink2);
    });
    const im = document.createElement('img');
    im.src = b.toDataURL(1); im.style.width = b.w * u + 'px'; im.style.height = b.h * u + 'px'; im.draggable = false;
    leg.replaceChildren(im);
    const ht = 'Drag to pan · wheel or pinch to zoom · tap a checkpoint';
    const hw = measure(ht) + 12, hb = new PixelBuffer(hw + 3, 17);
    hb.blit(panel(hw, 14, { tone: 'dark' }), 0, 0);
    drawText(hb, ht, 6, 1, hex('#f4e6c0'));
    const hi = document.createElement('img');
    hi.src = hb.toDataURL(1); hi.style.width = hb.w * u + 'px'; hi.style.height = hb.h * u + 'px'; hi.draggable = false;
    hint.replaceChildren(hi);
  };
  /** a pin at half size for the legend (every other pixel) */
  const scaleDown = (b: PixelBuffer) => { const o2 = new PixelBuffer(Math.ceil(b.w / 2), Math.ceil(b.h / 2)); for (let y = 0; y < o2.h; y++) for (let x = 0; x < o2.w; x++) o2.set(x, y, b.get(x * 2, y * 2) || b.get(x * 2 + 1, y * 2 + 1)); return o2; };

  // ---- the live map
  const paper0 = new Uint32Array(W * H);
  let live: LiveMap | null = null;
  let artOn = false;
  let nowState: SeedState = currentSeedState();
  const prevShown = lastShown();

  // ---- view: scale = CSS px per map px; at rest it sits on whole device pixels (or the fit)
  let scale = 1, ox = 0, oy = 0, vw = 1, vh = 1;
  const topPad = () => 24 * u;
  const fitScale = () => Math.min(vw / ((CONTENT.x1 - CONTENT.x0) * 1.0), (vh - topPad() - 6 * u) / (CONTENT.y1 - CONTENT.y0 - 40)) * 0.995;
  const minScale = () => Math.min(fitScale(), vw / W) * 0.9;
  const maxScale = () => 6 / dpr;
  const levels = () => {
    const f = fitScale();
    const out = [f];
    for (const d of [1, 2, 3, 4, 6]) { const s = d / dpr; if (s > f * 1.18) out.push(s); }
    return out;
  };
  const snapLevel = (s: number, dir = 0) => {
    const L = levels();
    if (dir > 0) return L.find(v => v > s * 1.02) ?? L[L.length - 1];
    if (dir < 0) return [...L].reverse().find(v => v < s * 0.98) ?? L[0];
    let best = L[0];
    for (const v of L) if (Math.abs(Math.log(v / s)) < Math.abs(Math.log(best / s))) best = v;
    return best;
  };
  const clampView = () => {
    scale = clamp(scale, minScale(), maxScale());
    const mw = W * scale, mh = H * scale, m = 30 * u;
    ox = mw + m * 2 <= vw ? (vw - mw) / 2 : clamp(ox, vw - mw - m, m);
    const t0 = topPad();
    oy = mh + m <= vh - t0 ? t0 + (vh - t0 - mh) / 2 : clamp(oy, vh - mh - m, t0 + m * 0.4);
  };
  const camAt = (mx: number, my: number, s: number) => ({ s, x: mx, y: my });
  const applyCam = (c: { s: number; x: number; y: number }) => { scale = c.s; ox = vw / 2 - c.x * scale; oy = (vh + topPad() * 0.6) / 2 - c.y * scale; clampView(); };
  const camNow = () => ({ s: scale, x: (vw / 2 - ox) / scale, y: ((vh + topPad() * 0.6) / 2 - oy) / scale });
  const fitCam = () => camAt((CONTENT.x0 + CONTENT.x1) / 2, (CONTENT.y0 + CONTENT.y1) / 2 - 10, fitScale());
  const fit = () => {
    vw = Math.max(1, root.clientWidth); vh = Math.max(1, root.clientHeight);
    setScale();
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
  };
  let tween: { a: { s: number; x: number; y: number }; b: { s: number; x: number; y: number }; t0: number; d: number; done?: () => void } | null = null;
  const tweenTo = (b: { s: number; x: number; y: number }, d: number) => new Promise<void>(res => { const old = tween; tween = { a: camNow(), b, t0: performance.now(), d, done: res }; old?.done?.(); });
  const boxCam = (x0: number, y0: number, x1: number, y1: number, lo = 1, hi = 3) => {
    const want = Math.min((vw * 0.8) / Math.max(80, x1 - x0), ((vh - topPad()) * 0.75) / Math.max(60, y1 - y0));
    const s = snapLevel(clamp(want, Math.max(minScale(), lo / dpr), hi / dpr), 0);
    return camAt((x0 + x1) / 2, (y0 + y1) / 2, Math.min(s, Math.max(fitScale(), want)));
  };

  // ---- here (Mori)
  const here = o.here ?? (cur ? lastPos() : { loc: 'camp', x: 1980 });
  const herePt = (): [number, number] | null => { if (!here || !location(here.loc)) return null; const [a, b] = mapPoint(here.loc, here.x); return onMap(a, b); };
  let hereP = herePt();
  const from = o.travelFrom ?? null;

  // ---- the overlay: checkpoints, labels, notes
  let labs: Lab[] = [];
  let pins: Pin[] = [];
  let sel: Pin | null = null, hov: Pin | null = null;
  const hereEl = el('div', 'here', `<i></i>`);
  const walker = el('div', 'walker', `<i></i>`);
  const ring = el('i', 'ring', '');
  const seenLabels = new Set<string>(prevShown?.found ?? []);
  const ringURL = () => cachedURL('ring', () => {
    const fw = 30, fh = 14, b = new PixelBuffer(fw * 4, fh);
    for (let f = 0; f < 4; f++) for (let a = 0; a < 64; a++) {
      if (((a >> 2) + f) % 2) continue;
      const t = (a / 64) * Math.PI * 2;
      const x = Math.round(f * fw + fw / 2 - 0.5 + Math.cos(t) * 13), y = Math.round(fh / 2 - 0.5 + Math.sin(t) * 5.5);
      b.set(x, y, hex('#d8402c')); b.set(x, y + 1, hex('#6a120c'));
    }
    return b;
  });
  const buildOverlay = () => {
    ov.innerHTML = '';
    labs = []; pins = [];
    hereP = herePt();
    const lab = (a: LabelArt, x: number, y: number, o2: Partial<Lab> & { cls?: string } = {}) => {
      const e = imgEl(a, 'lb' + (o2.cls ? ' ' + o2.cls : ''));
      ov.appendChild(e);
      const l: Lab = { el: e, x, y, w: a.w, h: a.h, min: 0, pri: 5, anchor: 'center', ...o2 };
      labs.push(l);
      return l;
    };
    // the land's names, lettered big (shown once the land under them is coloured in, from afar)
    for (const r of REGION_NAMES) {
      const [x, y] = proj(r.at[0], r.at[1]);
      lab(art('reg:' + r.text, () => bigText(r.text)), x, y, { pri: 9, region: [x, y], max: 1.25 / dpr * 1.0, scaleK: r.size, anchor: 'center' });
    }
    // places
    const jn = junctions();
    for (const L of LOCATIONS) {
      const [x, y] = onMap(L.pos[0], L.pos[1]);
      if (isFound(L.id)) {
        const isle = isIsland(L) && L.id !== 'camp';
        const isNew = !seenLabels.has(L.id) && !!prevShown;
        const t: Target = { loc: L.id };
        const reach = canTravel(t);
        const pa = { url: pinURL(L, !reach && travelMode !== 'none'), w: 23, h: 30 };
        const e = el('div', `cp${isNew ? ' drop' : ''}`, `<i style="background-image:url(${pa.url})"></i>`);
        ov.appendChild(e);
        pins.push({ el: e, x, y, id: targetId(t), loc: L.id, t, small: isle, min: isle ? 1 : 0, w: 23, h: 30 });
        const kind: PlateKind = L.id === 'camp' ? 'camp' : isNew ? 'new' : 'place';
        lab(art(`pl:${L.name}:${kind}`, () => plate(L.name, kind)), x, y, { anchor: 'pin', min: isle ? 1.4 : 0, pri: L.id === 'camp' ? 0 : isle ? 3 : 1, loc: L.id, cls: isNew ? 'new' : '' });
        if (L.sub && !isle) lab(art(`sub:${L.sub}`, () => plate(L.sub!, 'small')), x, y, { anchor: 'pin', min: 2.4, pri: 4, loc: L.id + ':sub' });
      } else if (isRumoured(L.id)) {
        const name = L.secret ? '???' : `${L.name}?`;
        lab(art(`rum:${name}`, () => plate(name, 'rumour')), x, y, { anchor: 'center', loc: L.id, min: 0, pri: 6 });
        const e = el('div', 'cp', '');
        pins.push({ el: e, x, y, id: L.id, loc: L.id, t: { loc: L.id }, small: true, min: 99, w: 0, h: 0 });
      }
    }
    // ways on: little flagged stakes where a route leaves a scene
    for (const j of jn) {
      const [a, b] = mapPoint(j.from, j.route.at);
      const [x, y] = onMap(a, b);
      const t: Target = { loc: j.from, at: j.route.at };
      const e = el('div', `jn`, `<i style="background-image:url(${stakeURL(j.known)})"></i>`);
      ov.appendChild(e);
      pins.push({ el: e, x, y, id: targetId(t), loc: j.from, t, small: true, min: 1.4, w: 11, h: 19 });
    }
    // notes pinned to the paper, find notes pencilled in
    for (const n of mapNotes()) {
      const [a, b] = mapPoint(n.loc, n.x);
      const [x, y] = onMap(a, b);
      lab(art('note:' + n.text, () => noteBuf(n.text, false)), x + 18, y - 30, { anchor: 'free', min: 2, pri: 7 });
    }
    for (const s of spots()) if (s.d.note && s.d.kind !== 'species') lab(art('pen:' + s.d.note, () => noteBuf(s.d.note!, true)), s.x + 10, s.y + 6, { anchor: 'free', min: 3, pri: 8 });
    if (hereP) {
      ov.appendChild(hereEl);
      const hp = art('here', () => plate('you are here →', 'here'));
      const e = imgEl(hp);
      hereEl.querySelector('.lb')?.remove();
      hereEl.appendChild(e);
    }
    ov.appendChild(ring);
    ov.appendChild(walker);
    walker.style.display = 'none';
    labs.sort((a, b) => a.pri - b.pri);
    overlayDirty = true;
  };
  /** a note pinned to the map (or pencilled straight on it) */
  const noteBuf = (text: string, pencil: boolean) => {
    const lines = wrap(text, 92);
    const tw = Math.max(...lines.map(l => measure(l)));
    const w = tw + 10, h = lines.length * (GH - 1) + 6;
    const b = new PixelBuffer(w + 3, h + 3);
    if (!pencil) b.blit(panel(w, h, { tone: 'note', pin: true }), 0, 0);
    lines.forEach((l, k) => drawText(b, l, 5, 1 + k * (GH - 1), pencil ? UI.ink2 : UI.ink, pencil ? { outline: undefined } : {}));
    if (pencil) for (let i = 0; i < b.data.length; i++) if (b.data[i] >>> 24) { /* a pale halo so pencil reads on any ground */ }
    return pencil ? haloed(b) : b;
  };
  const haloed = (b: PixelBuffer) => {
    const o2 = new PixelBuffer(b.w + 2, b.h + 2);
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (b.data[y * b.w + x] >>> 24) for (let dy = 0; dy <= 2; dy++) for (let dx = 0; dx <= 2; dx++) o2.set(x + dx, y + dy, hex('#f4e6c0'));
    o2.blit(b, 1, 1);
    return o2;
  };

  const place = () => {
    const ux = unrollX();
    const ds = scale * dpr;
    const taken: [number, number, number, number][] = [];
    // pins first: they are never hidden by a label; they claim their space
    const pk = scale < 0.42 ? 0.5 : 1;
    const pinU = u * pk;
    for (const p of pins) {
      const sx = Math.round(ox + p.x * scale), sy = Math.round(oy + p.y * scale);
      const vis = ds >= p.min * 0.999 && sx > -60 && sx < vw + 60 && sy > -60 && sy < vh + 80 && sx < ux;
      p.el.style.display = vis ? '' : 'none';
      if (!vis) continue;
      p.el.style.transform = `translate(${sx}px, ${sy}px)`;
      const i = p.el.firstElementChild as HTMLElement | null;
      if (i && p.w) {
        const w = p.w * pinU, h = p.h * pinU;
        const ax = p.el.classList.contains('jn') ? 3 * pinU : Math.round(w / 2);
        i.style.width = w + 'px'; i.style.height = h + 'px'; i.style.left = -ax + 'px'; i.style.top = -(h - (p.el.classList.contains('jn') ? 2 : 3) * pinU) + 'px';
        taken.push([sx - ax, sy - h + 3 * pinU, sx - ax + w, sy + 2 * pinU]);
      }
      p.el.classList.toggle('sel', p === sel);
      p.el.classList.toggle('hov', p === hov && p !== sel);
    }
    // the selection ring under the chosen pin
    if (sel && sel.el.style.display !== 'none') {
      const sx = Math.round(ox + sel.x * scale), sy = Math.round(oy + sel.y * scale);
      ring.style.display = ''; ring.style.backgroundImage = `url(${ringURL()})`;
      ring.style.width = 30 * pinU + 'px'; ring.style.height = 14 * pinU + 'px';
      ring.style.transform = `translate(${sx - 15 * pinU}px, ${sy - 7 * pinU}px)`;
    } else ring.style.display = 'none';
    // labels: try below, above, right, left of their pin; skip any that would overlap
    const overlaps = (b: [number, number, number, number]) => taken.some(t => b[0] < t[2] && b[2] > t[0] && b[1] < t[3] && b[3] > t[1]);
    const placed = new Map<string, [number, number, number, number]>();
    for (const l of labs) {
      const k = l.scaleK ?? 1;
      const w = l.w * u * k, h = l.h * u * k;
      const sx = ox + l.x * scale, sy = oy + l.y * scale;
      let vis = ds >= l.min * 0.999 && (l.max === undefined || scale <= l.max) && sx > -400 && sx < vw + 400 && sy > -100 && sy < vh + 100 && sx < ux + 40;
      if (vis && l.region && live) vis = live.stateAt(l.region[0], l.region[1]) === 3;
      if (vis && l.loc?.endsWith(':sub') && !placed.has(l.loc.slice(0, -4))) vis = false;
      let bx = 0, by = 0;
      if (vis) {
        const pinH = 30 * pinU;
        let cands: [number, number][];
        if (l.loc?.endsWith(':sub')) {
          const m = placed.get(l.loc.slice(0, -4))!;
          cands = [[(m[0] + m[2]) / 2 - w / 2, m[3] - u]];
        } else if (l.anchor === 'pin') cands = [[sx - w / 2, sy + 3 * u], [sx - w / 2, sy - pinH - h - 2 * u], [sx + 12 * pinU, sy - pinH * 0.55 - h / 2], [sx - 12 * pinU - w, sy - pinH * 0.55 - h / 2]];
        else if (l.anchor === 'free') cands = [[sx, sy], [sx - w - 20 * u, sy]];
        else cands = [[sx - w / 2, sy - h / 2]];
        vis = false;
        for (const [cx, cy] of cands) {
          const b: [number, number, number, number] = [cx - u, cy - u, cx + w + u, cy + h + u];
          if (!overlaps(b)) { vis = true; bx = cx; by = cy; taken.push(b); if (l.loc) placed.set(l.loc, b); break; }
        }
      }
      l.el.style.display = vis ? '' : 'none';
      if (!vis) continue;
      l.el.style.width = w + 'px'; l.el.style.height = h + 'px';
      l.el.style.transform = `translate(${Math.round(bx)}px, ${Math.round(by)}px)`;
    }
    if (hereP) {
      const sx = Math.round(ox + hereP[0] * scale), sy = Math.round(oy + hereP[1] * scale);
      hereEl.style.display = sx < ux && !trip ? '' : 'none';
      hereEl.style.transform = `translate(${sx}px, ${sy}px)`;
      const i = hereEl.querySelector('i') as HTMLElement;
      i.style.backgroundImage = `url(${moriURL()})`;
      i.style.width = 20 * pinU + 'px'; i.style.height = 14 * pinU + 'px'; i.style.left = -5 * pinU + 'px'; i.style.top = -13 * pinU + 'px';
      const lb = hereEl.querySelector('.lb') as HTMLElement | null;
      if (lb) { const w = +lb.dataset.w! * u, h = +lb.dataset.h! * u; lb.style.width = w + 'px'; lb.style.height = h + 'px'; lb.style.left = -(w + 7 * u) + 'px'; lb.style.top = -(h + 8 * u) + 'px'; }
      hereEl.classList.toggle('far', scale * dpr < 0.9);
    }
    if (trip && trip.walkerP) {
      walker.style.display = '';
      walker.style.transform = `translate(${Math.round(ox + trip.walkerP[0] * scale)}px, ${Math.round(oy + trip.walkerP[1] * scale)}px)`;
      const i = walker.firstElementChild as HTMLElement;
      i.style.width = 20 * pinU + 'px'; i.style.height = 14 * pinU + 'px'; i.style.left = -5 * pinU + 'px'; i.style.top = -13 * pinU + 'px';
    }
  };

  // ---- travel rules
  function canTravel(t: Target): boolean {
    if (travelMode === 'none') return false;
    const L = location(t.loc);
    if (!L || !isFound(L.id)) return false;
    if (travelMode === 'on' && L.trip) return false;
    return !!tripTo(t, travelMode === 'on' ? from : null) || (travelMode === 'on' && t.loc === 'camp');
  }

  // ---- the frame loop
  let raf = 0, last = performance.now(), renderAcc = 1, dirty = true, placeSig = '', overlayDirty = true;
  const perf = { n: 0, live: 0, present: 0, maxLive: 0, maxPresent: 0 };
  (window as unknown as { __rmPerf?: unknown }).__rmPerf = perf;
  const openAt = performance.now();
  let closing: { at: number; done: () => void } | null = null;
  const OPEN_RISE = 0.28, OPEN_UNROLL = 0.85;
  let paperAt = 0;
  let unroll = 0, rollY = 1;
  const unrollX = () => ox + W * scale * unroll;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!closing) {
      const openT = (now - openAt) / 1000;
      rollY = 1 - easeO(clamp(openT / OPEN_RISE));
      if (paperAt) { const u0 = Math.max(openAt + OPEN_RISE * 1000, paperAt); unroll = easeIO(clamp((now - u0) / 1000 / OPEN_UNROLL)); }
      else { unroll = 0; if (openT > OPEN_RISE) rollY = Math.round(Math.sin(now / 140) * 2) * 0.004; }
    } else {
      const t = (now - closing.at) / 1000;
      unroll = 1 - easeIO(clamp((t - 0.05) / 0.5));
      rollY = easeO(clamp((t - 0.58) / 0.26));
      if (t > 0.9) { const d = closing.done; closing.done = () => {}; d(); }
    }
    if (tween) {
      const tk = clamp((now - tween.t0) / 1000 / tween.d);
      const k = easeIO(tk);
      const a = tween.a, b = tween.b;
      const s = Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * k);
      applyCam({ s, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
      if (tk >= 1) { const d = tween.done; tween = null; d?.(); }
      dirty = true;
    }
    if (trip) stepTrip(dt);
    const tp0 = performance.now();
    if (live) {
      live.update(dt);
      const far = scale * dpr < 0.7;
      renderAcc += dt;
      if (renderAcc >= (far ? 1 / 10 : 1 / 30)) {
        renderAcc = 0;
        const m = 4;
        live.render(-ox / scale - m, -oy / scale - m, (vw - ox) / scale + m, (vh - oy) / scale + m, far);
        dirty = true;
      }
    }
    const tp1 = performance.now();
    if (dirty || unroll < 1 || closing) { present(); dirty = false; }
    const sig = `${scale.toFixed(4)},${ox.toFixed(1)},${oy.toFixed(1)},${unroll.toFixed(3)},${rollY.toFixed(3)},${trip?.walkerP?.[0].toFixed(1) ?? ''},${trip?.walkerP?.[1].toFixed(1) ?? ''},${sel?.id ?? ''},${hov?.id ?? ''}`;
    if (sig !== placeSig || overlayDirty) { placeSig = sig; overlayDirty = false; place(); }
    const tp2 = performance.now();
    perf.n++; perf.live += tp1 - tp0; perf.present += tp2 - tp1; perf.maxLive = Math.max(perf.maxLive, tp1 - tp0); perf.maxPresent = Math.max(perf.maxPresent, tp2 - tp1);
  };

  // a dithered shadow pattern for the sheet on the table
  let shadowPat: CanvasPattern | null = null;
  const sheetShadow = () => {
    if (shadowPat) return shadowPat;
    const c = document.createElement('canvas');
    c.width = 4; c.height = 4;
    const cg = c.getContext('2d')!;
    cg.fillStyle = '#0c0603';
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (bayer(x, y) < 0.5) cg.fillRect(x, y, 1, 1);
    shadowPat = g.createPattern(c, 'repeat');
    return shadowPat;
  };
  let rollCv: HTMLCanvasElement | null = null, capCv: HTMLCanvasElement | null = null;
  const present = () => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    const sw = W * scale, sh = H * scale;
    const ux = ox + sw * unroll;
    const lift = Math.round(rollY * (vh + 80));
    if (unroll > 0.001) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // the sheet's shadow on the table (a dither, offset down-right)
      const pat = sheetShadow();
      if (pat) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = pat; const s = Math.max(1, Math.round(u * dpr)); g.fillRect(Math.round((ox + 6 * u) * dpr), Math.round((oy + lift + 6 * u) * dpr), Math.round((ux - ox) * dpr), Math.round(sh * dpr)); void s; g.restore(); }
      g.save();
      g.beginPath(); g.rect(0, 0, ux, vh); g.clip();
      const ds = scale * dpr;
      g.imageSmoothingEnabled = ds < 0.99;
      g.imageSmoothingQuality = 'high';
      const view = live?.view;
      if (view) {
        const x0 = clamp(Math.floor(-ox / scale), 0, W), y0 = clamp(Math.floor((-oy - lift) / scale), 0, H);
        const x1 = clamp(Math.ceil((vw - ox) / scale) + 1, 0, W), y1 = clamp(Math.ceil((vh - oy - lift) / scale) + 1, 0, H);
        if (x1 > x0 && y1 > y0) {
          // whole device pixels per map pixel when zoomed in: snap the origin to the device grid
          const dx = Math.round((ox + x0 * scale) * dpr) / dpr, dy = Math.round((oy + lift + y0 * scale) * dpr) / dpr;
          g.drawImage(view, x0, y0, x1 - x0, y1 - y0, dx, dy, (x1 - x0) * scale, (y1 - y0) * scale);
        }
      }
      drawRoutes(lift);
      g.restore();
    }
    if (unroll < 0.999) drawRoll(ux, lift);
    const ot = lift ? `translateY(${lift}px)` : '', oo = unroll > 0.98 ? '1' : '0';
    if (ov.style.transform !== ot) ov.style.transform = ot;
    if (ov.style.opacity !== oo) ov.style.opacity = oo;
  };

  /** the rolled-up part of the sheet: a parchment cylinder at the unrolling edge (pixel bands) */
  const drawRoll = (ux: number, lift: number) => {
    const sh = H * scale;
    const d = Math.round(clamp(sh * 0.07, 14 * u, 30 * u) * (1 - unroll * 0.5) / u) * u;
    const x = ux - d * 0.25, y0 = oy + lift - d * 0.14, y1 = oy + lift + sh + d * 0.14;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = Math.max(4, Math.round(d / u));
    if (!rollCv || rollCv.width !== cols) { const rb = rollRow(cols); rollCv = document.createElement('canvas'); rollCv.width = cols; rollCv.height = 1; rollCv.getContext('2d')!.putImageData(toImageData(rb), 0, 0); const cb = rollCap(cols); capCv = document.createElement('canvas'); capCv.width = cb.w; capCv.height = cb.h; capCv.getContext('2d')!.putImageData(toImageData(cb), 0, 0); }
    g.imageSmoothingEnabled = false;
    const pat = sheetShadow();
    if (pat) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = pat; g.fillRect(Math.round((x + d * 0.6) * dpr), Math.round((y0 + 4 * u) * dpr), Math.round(d * 0.8 * dpr), Math.round((y1 - y0) * dpr)); g.restore(); }
    g.drawImage(rollCv, 0, 0, cols, 1, Math.round(x), Math.round(y0), cols * u, Math.round(y1 - y0));
    if (capCv) for (const yy of [y0, y1]) g.drawImage(capCv, Math.round(x), Math.round(yy - (capCv.height * u) / 2), capCv.width * u, capCv.height * u);
  };

  // ---- routes drawn in ink (screen space, square pixel dots): a pencil preview, the trip in red
  type Pt = [number, number];
  let preview: Pt[] | null = null;
  interface Trip { pts: Pt[]; len: number; seg: number[]; prog: number; sea: boolean; walkerP: Pt | null; t: number; t0: number; dur: number; h0: number; h1: number; e0: number; e1: number; stepT: number; done: () => void; target: Pin | null }
  let trip: Trip | null = null;
  const polyLen = (pts: Pt[]) => { const seg = [0]; for (let k = 1; k < pts.length; k++) seg.push(seg[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1])); return seg; };
  const pointAt = (pts: Pt[], seg: number[], d: number): Pt => {
    for (let k = 1; k < pts.length; k++) if (d <= seg[k]) { const t = (d - seg[k - 1]) / Math.max(1e-6, seg[k] - seg[k - 1]); return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * t, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t]; }
    return pts[pts.length - 1];
  };
  const dot = (sx: number, sy: number, col: string, size: number) => {
    const p = Math.max(1, Math.round(size * dpr)) / dpr;
    g.fillStyle = col;
    g.fillRect(Math.round((sx - p / 2) * dpr) / dpr, Math.round((sy - p / 2) * dpr) / dpr, p, p);
  };
  const drawDots = (pts: Pt[], upto: number, col: string, dark: string, size: number, gap: number, lift: number) => {
    const seg = polyLen(pts);
    const total = Math.min(upto, seg[seg.length - 1]);
    const step = gap / scale;
    for (let d = 0; d <= total; d += step) {
      const [x, y] = pointAt(pts, seg, d);
      const sx = ox + x * scale, sy = oy + lift + y * scale;
      dot(sx + u, sy + u, dark, size);
      dot(sx, sy, col, size);
    }
  };
  const drawRoutes = (lift: number) => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    if (preview && !trip) drawDots(preview, 1e9, '#6a4a2a', 'rgba(0,0,0,0)', 2 * u, 7 * u, lift);
    if (trip) {
      drawDots(trip.pts, trip.len * trip.prog, trip.sea ? '#2a6a9a' : '#b02a1c', '#2a0a06', 2 * u, 6 * u, lift);
      // the destination ringed in red ink when the line arrives (a pixel ellipse)
      if (trip.prog >= 1) {
        const [x, y] = trip.pts[trip.pts.length - 1];
        const cx = ox + x * scale, cy = oy + lift + y * scale;
        const n = Math.floor(48 * clamp(trip.t / 0.3));
        for (let k = 0; k < n; k++) { const a = (k / 48) * Math.PI * 2 - 1.2; dot(cx + Math.cos(a) * 16 * u, cy + Math.sin(a) * 7 * u, '#b02a1c', 2 * u); }
      }
    }
  };
  const stepTrip = (dt: number) => {
    const tr = trip!;
    tr.t = Math.max(tr.t, (performance.now() - tr.t0) / 1000);
    const k = clamp(tr.t / tr.dur);
    tr.prog = easeIO(k);
    tr.walkerP = pointAt(tr.pts, tr.seg, tr.len * tr.prog);
    header(tr.h0 + (tr.h1 - tr.h0) * k, tr.e0 + (tr.e1 - tr.e0) * k, tr.h1);
    tr.stepT -= dt;
    if (k < 1 && tr.stepT <= 0) { tr.stepT = tr.sea ? 0.7 : 0.3; audio.play(tr.sea ? 'splash' : 'stepSoft', { vol: tr.sea ? 0.08 : 0.14, pitch: 0.9 + Math.random() * 0.25 }); }
    dirty = true;
    if (k >= 1 && tr.t >= tr.dur + 0.55) { const d = tr.done; tr.done = () => {}; d(); }
  };

  // ---- the card: a paper panel drawn in pixels, with pixel buttons on it
  const CW = 196;
  const showCard = (p: Pin | null) => {
    sel = p;
    preview = null;
    if (!p) { card.classList.remove('on'); dirty = true; overlayDirty = true; return; }
    const L = location(p.loc);
    if (!L) return;
    renderCard(p, L);
    card.classList.add('on');
    audio.play('ui', { vol: 0.35 });
    dirty = true;
    overlayDirty = true;
  };
  const renderCard = (p: Pin, L: LocationDef) => {
    const found = isFound(L.id), rum = isRumoured(L.id);
    const isJn = p.t.at !== undefined;
    const name = found || !L.secret ? L.name : '???';
    const lines: ((b: PixelBuffer, y: number) => number)[] = [];
    const inner = CW - 16;
    const title = (t: string) => lines.push((b, y) => {
      const big = measure(t, { bold: true }) * 2 <= inner;
      if (big) {
        const tb = new PixelBuffer(measure(t, { bold: true }) + 2, GH + 1);
        drawText(tb, t, 0, 0, UI.ink, { bold: true });
        for (let yy = 0; yy < tb.h; yy++) for (let xx = 0; xx < tb.w; xx++) { const c = tb.data[yy * tb.w + xx]; if (c >>> 24) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) b.set(8 + xx * 2 + i, y + yy * 2 + j, c); }
        return y + GH * 2 - 2;
      }
      drawText(b, t, 8, y, UI.ink, { bold: true });
      return y + GH + 1;
    });
    const sub = (t: string) => lines.push((b, y) => para(b, t, 8, y, inner, UI.ink2) + 2);
    const text = (t: string, c = UI.ink) => lines.push((b, y) => para(b, t, 8, y, inner, c) + 1);
    const row = (k: string, v: string | ((b: PixelBuffer, x: number, y: number) => void), vc = UI.ink) => lines.push((b, y) => {
      drawText(b, k, 8, y, UI.ink2);
      const kw = measure(k);
      if (typeof v === 'string') {
        const vw2 = measure(v, { bold: true });
        drawText(b, v, CW - 8 - vw2, y, vc, { bold: true });
        for (let x = 8 + kw + 3; x < CW - 8 - vw2 - 3; x += 2) b.set(x, y + 8, UI.ink3);
      } else v(b, CW - 8, y);
      return y + GH;
    });
    const gap = (n = 4) => lines.push((_b, y) => y + n);
    const rule = () => lines.push((b, y) => { for (let x = 8; x < CW - 8; x++) if (x % 3) b.set(x, y + 2, UI.paper3); return y + 6; });
    const sprites: { id: string; x: number; y: number }[] = [];
    let btn: { label: string; ok: boolean; x: number; y: number; w: number; h: number } | null = null;
    const button = (label: string, ok: boolean) => lines.push((b, y) => { const w = CW - 16, h = 18; btn = { label, ok, x: 8, y: y + 2, w, h }; return y + h + 6; });
    if (isJn) {
      const j = junctions().find(q => q.from === p.loc && Math.round(q.route.at) === Math.round(p.t.at!));
      const T = j ? location(j.to) : null;
      title('A way on');
      sub(`${L.name} · ${j ? ROUTE_WORD[j.route.kind] : 'a trail'}`);
      if (j) { text(`“${j.route.label}”`, UI.ink2); gap(); row('Leads to', T && isFound(T.id) ? T.name : 'somewhere unknown'); row('The way itself', `${fmtH(j.route.hours)} · -${j.route.energy} energy`); }
      if (j?.route.needs) row('Needs', `${j.route.needs.n} × ${j.route.needs.item}`);
      gap();
      text('A checkpoint: travel here and Mori starts at the foot of the way on.', UI.ink3);
    } else {
      title(name);
      sub(`${found && L.sub ? L.sub + ' · ' : ''}${REGION_NAME[L.region] ?? L.region} · ${KIND_NAME[L.kind] ?? L.kind}`);
      if (!found) {
        text(rum ? (L.secret ? 'Something is out there. Aroha won’t say its name.' : 'Heard of, never seen. ' + L.desc) : 'Unexplored.');
        gap();
        text('Find the way there on foot: it lies beyond somewhere you have already been.', UI.ink3);
      } else {
        const ds = discoveriesAt(L.id);
        const sp = [...new Set(ds.filter(d => d.kind === 'species' && d.icon).map(d => d.icon!))];
        const fc = ds.filter(d => d.kind !== 'species' && d.kind !== 'location').length;
        const ex = Math.round(explored(L.id) * 100);
        rule();
        row('Difficulty', (b, x, y) => { for (let k = 0; k < 5; k++) { const cx = x - 4 - (4 - k) * 9; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (Math.abs(dx) + Math.abs(dy) <= 3) b.set(cx + dx, y + 5 + dy, Math.abs(dx) + Math.abs(dy) === 3 ? UI.ink : k < L.difficulty ? (dy < 0 ? UI.red2 : UI.red) : UI.paper2); } });
        if (L.terrain) row('Terrain', L.terrain);
        row('Explored', `${ex}%`);
        lines.push((b, y) => { gauge(b, 8, y, CW - 16, ex, 100, hex('#7ac04a'), hex('#4a8a2e')); return y + 10; });
        lines.push((b, y) => para(b, L.desc, 8, y + 1, inner, UI.ink) + 2);
        if (sp.length) lines.push((_b, y) => { const n = Math.min(sp.length, 12); for (let k = 0; k < n; k++) sprites.push({ id: sp[k], x: 8 + (k % 6) * 30, y: y + Math.floor(k / 6) * 24 }); return y + Math.ceil(n / 6) * 24 + 2; });
        text(`${sp.length} species sketched here · ${fc} find${fc === 1 ? '' : 's'} noted`, UI.ink3);
        const ways = LOCATIONS.filter(t => t.routes?.some(r => r.from === L.id));
        if (ways.length) text('Ways on: ' + ways.map(t => (isFound(t.id) ? t.name : '???') + ` (${ROUTE_WORD[t.routes!.find(r => r.from === L.id)!.kind]})`).join(', '), UI.ink3);
      }
    }
    // the trip
    const herePlace = travelMode === 'on' ? from?.loc : 'camp';
    let why = '';
    if (found || isJn) {
      rule();
      if (!isJn && L.id === 'camp' && travelMode !== 'on') text('Home. Expeditions leave from the trailhead signpost.', UI.ink3);
      else if (!isJn && herePlace === L.id && travelMode === 'on') text('You are here.', UI.green);
      else if (travelMode === 'none') why = 'Fast travel starts from camp.';
      else if (travelMode === 'on' && L.trip) why = 'The Kitten sails from camp.';
      else {
        const c: TripCost | null = travelMode === 'on' && L.id === 'camp' && !isJn ? homeCost(from!.loc, from!.x) : tripTo(p.t, travelMode === 'on' ? from : null);
        if (c) {
          const homeTrip = travelMode === 'on' && L.id === 'camp';
          if (!homeTrip && !isJn && travelMode === 'camp') { const hc = homeCost(L.id); row(L.trip ? 'By boat' : 'From camp', `${fmtH(c.hours)} · -${c.energy} energy`); row(L.trip ? 'Sail home' : 'Walk home', `${fmtH(hc.hours)} · -${hc.energy} energy`); }
          else row(homeTrip ? 'Walk home' : 'From here', `${fmtH(c.hours)} · -${c.energy} energy`);
          const need = homeTrip ? 0 : tripNeed(c);
          const ok = energy() >= need;
          button(`${homeTrip ? 'Head home' : 'Set off'} · arrive ${clockText(arrivalHour(c.hours))}`, ok);
          if (!ok) why = `Too tired: you need ${need} energy for this trip.`;
          const rp = routePath(p.t, travelMode === 'on' ? from : null, SEA_LANES);
          preview = rp?.pts.map(([x, y]) => (rp.sea ? [x, y] : proj(x, y)) as Pt) ?? null;
        } else why = 'No known trail from here.';
      }
    }
    if (why) text(why, UI.red);
    // lay it out: measure on a tall scratch buffer, then cut to height
    const scratch = new PixelBuffer(CW + 3, 900);
    let y = 9;
    for (const f of lines) y = f(scratch, y);
    const ch = y + 6;
    const b = new PixelBuffer(CW + 3, ch + 3);
    b.blit(panel(CW, ch, { pin: true }), 0, 0);
    y = 9;
    for (const f of lines) y = f(b, y);
    const draw = () => {
      for (const s of sprites) {
        const im = spriteImg(s.id, () => { if (sel === p) renderCard(p, L); });
        if (!im) continue;
        const c = document.createElement('canvas');
        c.width = im.naturalWidth; c.height = im.naturalHeight;
        const cg = c.getContext('2d')!;
        cg.drawImage(im, 0, 0);
        const k = Math.max(3, Math.ceil(Math.max(im.naturalWidth / 26, im.naturalHeight / 22)));
        const d = cg.getImageData(0, 0, c.width, c.height).data;
        for (let yy = 0; yy * k < c.height; yy++) for (let xx = 0; xx * k < c.width; xx++) {
          const i = ((yy * k + (k >> 1)) * c.width + xx * k + (k >> 1)) * 4;
          if (d[i + 3] > 100) b.set(s.x + xx, s.y + yy, (255 << 24) | (d[i + 2] << 16) | (d[i + 1] << 8) | d[i]);
        }
      }
    };
    draw();
    const im = document.createElement('img');
    im.src = b.toDataURL(1); im.style.width = b.w * u + 'px'; im.style.height = b.h * u + 'px'; im.style.display = 'block'; im.draggable = false;
    card.replaceChildren(im);
    // the close button and the set-off button
    const cx = document.createElement('button');
    cx.className = 'cx'; cx.title = 'Close';
    cx.style.backgroundImage = `url(${buttonURL('close')})`;
    cx.style.width = 18 * u * 0.75 + 'px'; cx.style.height = 20 * u * 0.75 + 'px'; cx.style.right = 4 * u + 'px'; cx.style.top = 4 * u + 'px';
    cx.addEventListener('pointerdown', e => { e.stopPropagation(); showCard(null); });
    card.appendChild(cx);
    const bt = btn as { label: string; ok: boolean; x: number; y: number; w: number; h: number } | null;
    if (bt) {
      const mk = (state: number) => cachedURL(`cbtn:${bt.label}:${bt.ok}:${state}`, () => cardButton(bt.label, bt.w, bt.h, bt.ok, state));
      const be = document.createElement('button');
      be.className = 'cbtn go';
      if (!bt.ok) be.disabled = true;
      be.style.left = bt.x * u + 'px'; be.style.top = bt.y * u + 'px'; be.style.width = bt.w * u + 'px'; be.style.height = (bt.h + 1) * u + 'px';
      be.style.backgroundImage = `url(${mk(0)})`; be.style.backgroundSize = '100% 100%';
      be.addEventListener('pointerenter', () => { if (bt.ok) be.style.backgroundImage = `url(${mk(1)})`; });
      be.addEventListener('pointerleave', () => { be.style.backgroundImage = `url(${mk(0)})`; });
      be.addEventListener('pointerdown', e => { e.stopPropagation(); if (!bt.ok) return; be.style.backgroundImage = `url(${mk(2)})`; void setOff(p); });
      card.appendChild(be);
    }
    card.onpointerdown = e => e.stopPropagation();
  };
  /** the big set-off button: a green plank with the label, three states */
  const cardButton = (label: string, w: number, h: number, ok: boolean, state: number) => {
    const b = new PixelBuffer(w, h + 1);
    const down = state === 2 ? 1 : 0;
    const face = ok ? [hex('#1e4a1c'), hex('#2e6a28'), hex('#3e8a34'), hex('#62b04a')] : [hex('#4a4034'), hex('#6a5e4e'), hex('#8a7e6a'), hex('#a89a84')];
    for (let y = 0; y < h + 1; y++) for (let x = 0; x < w; x++) {
      const yy = y - down;
      if (yy < 0 || ((x === 0 || x === w - 1) && (yy === 0 || yy === h - 1))) continue;
      if (yy >= h) { if (!down) b.set(x, y, hex('#0e0804')); continue; }
      const e = x === 0 || x === w - 1 || yy === 0 || yy === h - 1;
      let c = e ? hex('#0e0804') : yy === 1 ? face[3] : yy >= h - 3 ? face[0] : face[2];
      if (state === 1 && !e && yy > 1 && yy < h - 3) c = mix(c, hex('#e0ffb0'), 0.2);
      b.set(x, y, c);
    }
    const tw = measure(label, { bold: true });
    drawText(b, label, Math.round((w - tw) / 2), 2 + down, ok ? hex('#f4ffe4') : hex('#e4dccc'), { bold: true, shadow: ok ? hex('#0e2a0c') : hex('#3a3024') });
    return b;
  };

  // ---- setting off: ink the route, walk the marker along it, the clock runs; then roll up
  let leaving = false;
  const setOff = async (p: Pin) => {
    if (leaving || trip) return;
    const L = location(p.loc);
    if (!L) return;
    const homeTrip = travelMode === 'on' && L.id === 'camp' && p.t.at === undefined;
    const c = homeTrip ? homeCost(from!.loc, from!.x) : tripTo(p.t, travelMode === 'on' ? from : null);
    if (!c) return;
    if (!homeTrip && energy() < tripNeed(c)) return;
    leaving = true;
    audio.play('uiOpen');
    card.classList.remove('on');
    root.classList.add('busy');
    const rp = homeTrip ? routePath({ loc: 'camp' }, from, SEA_LANES) : routePath(p.t, travelMode === 'on' ? from : null, SEA_LANES);
    const end = onMap(L.pos[0], L.pos[1]);
    const pts = rp ? rp.pts.map(([x, y]) => (rp.sea ? [x, y] : proj(x, y)) as Pt) : [hereP ?? end, end];
    preview = null;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    live?.finishReveal();
    await tweenTo(boxCam(x0 - 80, y0 - 100, x1 + 80, y1 + 80, 0.6, 3), 0.55);
    const seg = polyLen(pts);
    const sea = !!rp?.sea;
    (walker.firstElementChild as HTMLElement).style.backgroundImage = `url(${moriURL(sea)})`;
    const h0 = travelMode === 'on' ? expeditionHour() : game.save.vars['v10:hour'] ?? 7.5;
    await new Promise<void>(res => {
      trip = { pts, len: seg[seg.length - 1], seg, prog: 0, sea, walkerP: pts[0], t: 0, t0: performance.now(), dur: clamp(1.3 + c.hours * 0.55, 1.6, 4.4), h0, h1: h0 + c.hours, e0: energy(), e1: energy() - c.energy, stepT: 0, done: res, target: p };
    });
    audio.play('place', { vol: 0.6 });
    p.el.classList.remove('stamp'); void p.el.offsetWidth; p.el.classList.add('stamp');
    await sleep(380);
    finish(homeTrip ? 'camp' : p.id);
  };

  // ---- input: drag, pinch, wheel, tap, hover
  const pts = new Map<number, { x: number; y: number }>();
  let down: { x: number; y: number; t: number; ox: number; oy: number } | null = null;
  let pinch: { d: number; s: number; mx: number; my: number } | null = null;
  const local = (e: PointerEvent | WheelEvent) => { const r = root.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  /** zoom about a screen point to a level (tweened) */
  const zoomTo = (sx: number, sy: number, s: number, d = 0.22) => {
    const mx = (sx - ox) / scale, my = (sy - oy) / scale;
    const c = camNow();
    // keep the point under the cursor: solve for the camera centre at the new scale
    const nx = mx - (sx - vw / 2) / s, ny = my - (sy - (vh + topPad() * 0.6) / 2) / s;
    void c;
    void tweenTo({ s, x: nx, y: ny }, d);
  };
  const hit = (sx: number, sy: number): Pin | null => {
    let best: Pin | null = null, bd = (phone() ? 16 : 12) * u;
    for (const p of pins) {
      if (p.el.style.display === 'none' || !p.w) continue;
      const k = scale < 0.42 ? 0.5 : 1;
      const px = ox + p.x * scale, py = oy + p.y * scale - (p.h * u * k) * 0.6;
      const d = Math.hypot(px - sx, py - sy) * (p.t.at !== undefined ? 1.15 : 1);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  };
  const busy = () => leaving || !!trip || !!closing || unroll < 0.98;
  root.addEventListener('pointerdown', e => {
    if (busy()) { if (live?.revealing) live.finishReveal(); return; }
    root.setPointerCapture(e.pointerId);
    const p = local(e);
    pts.set(e.pointerId, p);
    tween = null;
    if (pts.size === 1) down = { ...p, t: performance.now(), ox, oy };
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: scale, mx: ((a.x + b.x) / 2 - ox) / scale, my: ((a.y + b.y) / 2 - oy) / scale };
      down = null;
    }
  });
  root.addEventListener('pointermove', e => {
    const p = local(e);
    if (!pts.has(e.pointerId)) {
      if (e.pointerType === 'mouse' && !busy()) { const h = hit(p.x, p.y); if (h !== hov) { hov = h; root.style.cursor = h ? 'pointer' : ''; dirty = true; } }
      return;
    }
    pts.set(e.pointerId, p);
    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      scale = clamp(pinch.s * (d / Math.max(1, pinch.d)), minScale(), maxScale());
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      ox = cx - pinch.mx * scale; oy = cy - pinch.my * scale;
      clampView(); dirty = true;
    } else if (down) {
      if (Math.hypot(p.x - down.x, p.y - down.y) > 6) root.classList.add('drag');
      ox = Math.round(down.ox + p.x - down.x); oy = Math.round(down.oy + p.y - down.y);
      clampView(); dirty = true;
    }
  });
  const up = (e: PointerEvent) => {
    const p = local(e);
    if (down && pts.size === 1 && Math.hypot(p.x - down.x, p.y - down.y) < 8 && performance.now() - down.t < 500) showCard(hit(p.x, p.y));
    const wasPinch = !!pinch;
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (!pts.size) { down = null; root.classList.remove('drag'); if (wasPinch) { const [a] = [p]; zoomTo(a.x, a.y, snapLevel(scale)); } }
  };
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);
  let wheelT = 0;
  root.addEventListener('wheel', e => {
    e.preventDefault();
    if (busy()) return;
    const now = performance.now();
    if (now - wheelT < 140) return;
    wheelT = now;
    const p = local(e);
    const target = tween ? tween.b.s : scale;
    zoomTo(p.x, p.y, snapLevel(target, e.deltaY < 0 ? 1 : -1));
  }, { passive: false });
  const tool = (sel2: string, fn: () => void) => root.querySelector(sel2)!.addEventListener('pointerdown', e => { e.stopPropagation(); if (!busy()) fn(); });
  const goHere = () => { const c = hereP ?? onMap(location('camp')!.pos[0], location('camp')!.pos[1]); void tweenTo(camAt(c[0], c[1], Math.max(scale, snapLevel(2 / dpr))), 0.45); };
  tool('.zi', () => zoomTo(vw / 2, vh / 2, snapLevel(tween ? tween.b.s : scale, 1)));
  tool('.zo', () => zoomTo(vw / 2, vh / 2, snapLevel(tween ? tween.b.s : scale, -1)));
  tool('.zc', goHere);
  tool('.zf', () => void tweenTo(fitCam(), 0.45));
  tool('.zl', () => { if (phone()) leg.classList.toggle('show'); else leg.classList.toggle('off'); });

  // ---- open / close
  let done: (v: string | null) => void = () => {};
  const result = new Promise<string | null>(r => (done = r));
  let finished = false;
  const finish = (v: string | null) => {
    if (finished) return;
    finished = true;
    window.removeEventListener('keydown', kh, true);
    window.removeEventListener('resize', rs);
    off();
    if (live && nowState) markShown(nowState);
    card.classList.remove('on');
    root.classList.add('busy');
    audio.play(v === null ? 'uiBack' : 'rustle', { vol: 0.5 });
    tween = null;
    void tweenTo(scale > fitScale() * 1.6 ? { s: Math.max(fitScale(), scale * 0.55), x: camNow().x, y: camNow().y } : fitCam(), 0.3).then(() => {
      audio.play('pageTurn', { vol: 0.45 });
      closing = { at: performance.now(), done: () => {
        cancelAnimationFrame(raf);
        clearTimeout(coverT);
        if (covering) { game.covered = Math.max(0, game.covered - 1); covering = false; }
        root.classList.remove('on');
        setTimeout(() => root.remove(), 260);
        ui.modalOpen = Math.max(0, ui.modalOpen - 1);
        guardInput(300);
        done(v);
      } };
    });
  };
  const kh = (e: KeyboardEvent) => {
    const k = e.code;
    if (k === 'Escape' || k === 'KeyM' || k === 'Tab') {
      e.preventDefault(); e.stopPropagation();
      if (trip || leaving) { if (trip) trip.t = Math.max(trip.t, trip.dur); return; }
      if (live?.revealing) { live.finishReveal(); return; }
      if (sel && k === 'Escape') showCard(null); else finish(null);
      return;
    }
    if (busy()) return;
    const step = 70;
    if (k === 'ArrowLeft' || k === 'KeyA') ox += step; else if (k === 'ArrowRight' || k === 'KeyD') ox -= step;
    else if (k === 'ArrowUp' || k === 'KeyW') oy += step; else if (k === 'ArrowDown' || k === 'KeyS') oy -= step;
    else if (k === 'Equal' || k === 'NumpadAdd') { zoomTo(vw / 2, vh / 2, snapLevel(scale, 1)); return; }
    else if (k === 'Minus' || k === 'NumpadSubtract') { zoomTo(vw / 2, vh / 2, snapLevel(scale, -1)); return; }
    else if (k === 'KeyC') { goHere(); return; }
    else if (k === 'KeyF') { void tweenTo(fitCam(), 0.45); return; }
    else if (k === 'Enter' && sel) { const b = card.querySelector('.go') as HTMLButtonElement | null; if (b && !b.disabled) void setOff(sel); return; }
    else return;
    e.preventDefault(); e.stopPropagation(); tween = null; clampView(); dirty = true;
  };
  window.addEventListener('keydown', kh, true);
  const rs = () => { const c = camNow(); const was = u; fit(); applyCam(c); if (u !== was) { header(); buildLegend(); buildOverlay(); } dirty = true; };
  window.addEventListener('resize', rs);
  root.querySelector('.x')!.addEventListener('pointerdown', e => { e.stopPropagation(); if (!leaving) finish(null); });
  let changeT = 0;
  const off = onMapChange(() => { if (changeT) return; changeT = window.setTimeout(() => { changeT = 0; refresh(); }, 120); });

  // ---- what the map shows
  const refreshTrails = () => {
    if (!live) return;
    const ways: { pts: [number, number][]; kind: string }[] = [];
    for (const k of nowState.routes) { const [a, b] = k.split('>'); const e = routeEnds(a, b); if (e) ways.push({ pts: [e[0], e[1]], kind: e[2] }); }
    const lanes: [number, number][][] = [];
    for (const L of LOCATIONS) if (L.trip && isFound(L.id) && SEA_LANES[L.id]) lanes.push(SEA_LANES[L.id]);
    live.setTrails(walkedTrails(), ways, lanes);
    const sk: { s: PixelBuffer; x: number; y: number }[] = [], mk: { kind: string; x: number; y: number }[] = [];
    for (const s of spots()) {
      if (s.d.kind === 'species' && s.d.icon) {
        const ic = inked.get(s.d.icon);
        if (ic) { sk.push({ s: sketchCard(ic), x: s.x, y: s.y }); continue; }
        if (!inked.has(s.d.icon)) void inkSpecies(s.d.icon).then(() => { if (!finished) refreshTrails(); });
        continue;
      }
      mk.push({ kind: s.d.kind, x: s.x, y: s.y });
    }
    for (const n of mapNotes()) { const [a, b] = mapPoint(n.loc, n.x); const [x, y] = onMap(a, b); mk.push({ kind: 'note', x: x + 12, y: y - 12 }); }
    live.setMarks(sk, mk);
  };
  const refresh = () => {
    if (!live) return;
    const was = nowState;
    nowState = currentSeedState();
    if (artOn) live.setExplored(nowState, was, true);
    refreshTrails();
    buildOverlay();
    dirty = true;
  };

  // ---- debug hooks (screenshots, tests)
  (window as unknown as { __rm?: unknown }).__rm = {
    cam: (x: number, y: number, s: number) => { tween = null; applyCam(camAt(x, y, s)); dirty = true; },
    skip: () => live?.finishReveal(),
    all: () => { live?.revealEverything(); overlayDirty = true; dirty = true; },
    view: () => ({ scale, ox, oy, vw, vh, u, dpr, levels: levels() }),
    pick: (id: string) => { const p = pins.find(q => q.id === id); if (p) showCard(p); return !!p; },
    go: () => { if (sel) void setOff(sel); },
    proj: (x: number, y: number) => proj(x, y),
  };

  // ---- first frame: the parchment (quick), then the painted map (in slices, while it unrolls)
  fit();
  header();
  buildLegend();
  if (phone()) leg.classList.add('off');
  applyCam(fitCam());
  buildOverlay();
  raf = requestAnimationFrame(frame);
  void paintPaper().then(p => {
    if (finished) return;
    paper0.set(p);
    paperAt = performance.now();
    live = new LiveMap(paper0);
    refreshTrails();
    dirty = true;
    return paintMap();
  }).then(a => {
    if (finished || !a || !live) return;
    live.setArt(a);
    artOn = true;
    live.setExplored(nowState, prevShown, true);
    refreshTrails();
    buildOverlay();
    // once unrolled: swoop to where Mori is, or to what is being inked in
    const go = async () => {
      while (unroll < 0.995 && !finished) await sleep(30);
      if (finished) return;
      const rb = live?.revealBox;
      const focus = o.focus ? location(o.focus) : null;
      let c = hereP ? camAt(hereP[0], hereP[1], snapLevel((phone() ? 1 : 2) / dpr)) : fitCam();
      if (focus) { const [fx, fy] = onMap(focus.pos[0], focus.pos[1]); c = camAt(fx, fy, snapLevel(2 / dpr)); }
      else if (rb) c = boxCam(rb[0] - 40, rb[1] - 40, rb[2] + 40, rb[3] + 40, 1, 3);
      await tweenTo(c, 0.8);
      if (live?.revealing) audio.play('rustle', { vol: 0.25 });
      if (focus) { const p = pins.find(q => q.loc === focus.id && q.t.at === undefined); if (p) showCard(p); }
      markShown(nowState);
    };
    void go();
    setTimeout(() => { hint.style.opacity = '0'; }, 6000);
    const ids = [...new Set(discoveries().filter(d => d.kind === 'species' && d.icon).map(d => d.icon!))];
    void Promise.all(ids.map(inkSpecies)).then(() => { if (!finished) { refreshTrails(); dirty = true; } });
  }).catch(e => console.warn('[regionmap]', e));
  return result;
}

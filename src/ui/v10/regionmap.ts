// V10 Region Map: a huge hand-inked map of the region in a gold-and-leather frame. The coastline is
// always there; the interior stays blank parchment until Mori has physically walked it: every stretch
// explored lifts the fog and draws its terrain, the trail walked (dashed ink), the ways between places
// (dotted), photographed animals (little inked portraits where they were seen), landmarks, finds and
// notes. Found places are pins: from camp, pick one to fast-travel (the trip's energy and hours are on
// its card); during an expedition the map is read-only with a "you are here" mark. Pan with a drag,
// zoom with the wheel or a pinch, tap a pin. openRegionMap() resolves with the chosen location id.

import { game } from '../../game/game';
import { audio } from '../../core/audio';
import { guardInput } from '../../core/input';
import { el } from '../ui';
import { PixelBuffer } from '../../art/pixel';
import { C, hex, mix, A as AL } from '../../art/color';
import { clamp, hash2 } from '../../core/math';
import { W, H, paintBase, paintDetail, PINS, MARKS, INK, INK2, INK3, INK_RED } from './regionmap-art';
import {
  LOCATIONS, location, isFound, isRumoured, seenBins, binPoint, mapPoint, explored, discoveries, discoveriesAt, mapNotes,
  travelledRoutes, tripCost, homeCost, lastPos, onMapChange, BINS, xRange,
} from '../../game/v10/regions';
import type { LocationDef, Discovery } from '../../game/v10/regions';
import { currentExpedition, expeditionHour, clockText } from '../../game/v10/expedition';
import { energy, maxEnergy } from '../../game/v10/energy';
import { dayNumber } from '../../game/v10/day';
import { speciesSprite } from '../icons';
import { SPECIES_BY_ID } from '../../game/species';

export interface RegionMapOpts {
  /** no travelling (during an expedition) */
  readOnly?: boolean;
  /** where Mori is ("you are here") */
  here?: { loc: string; x: number };
  /** select this location when the map opens */
  focus?: string;
}

const REGION_NAME: Record<string, string> = { home: 'Home shore', interior: 'The interior', south: 'The south', east: 'The east coast', ocean: 'Open sea', isle2: 'Offshore' };
const KIND_NAME: Record<string, string> = { camp: 'Camp', site: 'Wild place', village: 'Village', ruin: 'Ruins', cave: 'Cave', fossil: 'Fossil bed', ecosystem: 'Strange ecosystem', ocean: 'Open sea', island: 'Island' };
const ROUTE_WORD: Record<string, string> = { walk: 'a walk', climb: 'a climb', swim: 'a swim', wade: 'a wade', dive: 'a dive', tunnel: 'a rope descent' };

function pinOf(L: LocationDef): PixelBuffer {
  if (L.id === 'glowforest') return PINS.glow;
  if (L.id === 'geovalley') return PINS.thermal;
  if (L.id === 'unknown') return PINS.sink;
  return PINS[L.kind] ?? PINS.site;
}
const P = (L: LocationDef): [number, number] => [L.pos[0] * W, L.pos[1] * H];
const fmtH = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : `${h % 1 ? h.toFixed(1) : h} h`);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// ------------------------------------------------------------------ species portraits, inked
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

// ------------------------------------------------------------------ composing the map
interface Spot { x: number; y: number; d: Discovery }
function blit(dst: PixelBuffer, src: PixelBuffer, x: number, y: number) {
  x = Math.round(x); y = Math.round(y);
  for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
    const c = src.data[j * src.w + i];
    if (AL(c) > 0) dst.set(x + i, y + j, c);
  }
}
function dashLine(b: PixelBuffer, pts: [number, number][], on: number, off: number, col: C, phase = 0) {
  let s = phase;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
    for (let k = 0; k < n; k++, s++) if (s % (on + off) < on) b.set(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n, col);
  }
}
/** the polyline of a location's path between world x0 and x1, in map pixels */
function pathPts(L: LocationDef, x0: number, x1: number): [number, number][] {
  const out: [number, number][] = [];
  const n = 8;
  for (let i = 0; i <= n; i++) { const [u, v] = mapPoint(L.id, x0 + ((x1 - x0) * i) / n); out.push([u * W, v * H]); }
  return out;
}
function routeEnds(from: string, to: string): [[number, number], [number, number], string] | null {
  const T = location(to), F = location(from);
  const r = T?.routes?.find(rt => rt.from === from);
  if (!T || !F || !r) return null;
  const a = mapPoint(from, r.at), b = mapPoint(to, r.enter ?? xRange(T)[0]);
  return [[a[0] * W, a[1] * H], [b[0] * W, b[1] * H], r.kind];
}

function buildMask(): Uint8Array {
  const m = new Uint8Array(W * H);
  const disc = (cx: number, cy: number, r: number) => {
    const R2 = r + 3;
    for (let y = Math.floor(cy - R2); y <= cy + R2; y++) for (let x = Math.floor(cx - R2); x <= cx + R2; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const d = Math.hypot(x - cx, y - cy) + (hash2(x >> 1, y >> 1, 7) - 0.5) * 5 + (hash2(x, y, 3) - 0.5) * 2;
      if (d < r) m[y * W + x] = 1;
    }
  };
  for (const L of LOCATIONS) {
    const bins = seenBins(L.id);
    const r = L.scene.type === 'island' ? 15 : 21;
    for (let i = 0; i < BINS; i++) if (bins[i]) { const [u, v] = binPoint(L.id, i); disc(u * W, v * H, r); }
  }
  for (const [a, b] of travelledRoutes()) {
    const e = routeEnds(a, b);
    if (!e) continue;
    const [[ax, ay], [bx, by]] = e;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 6));
    for (let k = 0; k <= n; k++) disc(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n, 9);
  }
  for (const d of discoveries()) { const [u, v] = mapPoint(d.loc, d.x ?? 0); disc(u * W, v * H, 11); }
  // camp is always known
  const c = location('camp');
  if (c) disc(c.pos[0] * W, c.pos[1] * H, 14);
  return m;
}

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
    const side = k % 2 ? -1 : 1, ring = 9 + Math.floor(k / 2) * 9;
    out.push({ x: u * W + nx * ring * side + (k > 1 ? (k % 3) * 3 : 0), y: v * H + ny * ring * side, d });
  }
  return out;
}

function compose(cv: HTMLCanvasElement) {
  const base = paintBase(), det = paintDetail();
  const mask = buildMask();
  const out = new PixelBuffer(W, H);
  out.data.set(base.data);
  for (let i = 0; i < W * H; i++) if (mask[i] && det.data[i]) out.data[i] = det.data[i];
  // the trail walked: dashed ink along the explored bins
  for (const L of LOCATIONS) {
    if (!L.path) continue;
    const bins = seenBins(L.id), [a, b] = xRange(L);
    for (let i = 0; i < BINS; i++) {
      if (!bins[i]) continue;
      const x0 = a + ((b - a) * i) / BINS, x1 = a + ((b - a) * (i + 1)) / BINS;
      dashLine(out, pathPts(L, x0, x1), L.scene.type === 'island' ? 1 : 3, 2, L.id === 'deep' || L.id === 'grotto' ? INK3 : INK2, i * 3);
    }
  }
  // the ways between places
  for (const [f, t] of travelledRoutes()) {
    const e = routeEnds(f, t);
    if (!e) continue;
    const [[ax, ay], [bx, by], kind] = e;
    dashLine(out, [[ax, ay], [bx, by]], 1, 2, kind === 'swim' || kind === 'dive' ? hex('#3a6a8a') : INK2);
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    if (kind === 'climb' || kind === 'tunnel') { out.set(mx - 1, my + 1, INK); out.set(mx, my, INK); out.set(mx + 1, my + 1, INK); }
    if (kind === 'swim' || kind === 'dive' || kind === 'wade') { out.set(mx - 2, my, INK_RED); out.set(mx - 1, my - 1, INK_RED); out.set(mx, my, INK_RED); out.set(mx + 1, my - 1, INK_RED); }
  }
  // finds and animals
  for (const s of spots()) {
    if (s.d.kind === 'species' && s.d.icon) {
      const ic = inked.get(s.d.icon);
      if (ic) { blit(out, ic, s.x - ic.w / 2, s.y - ic.h / 2); continue; }
      if (!inked.has(s.d.icon)) void inkSpecies(s.d.icon).then(() => cvRedraw?.());
    }
    const mk = MARKS[s.d.kind] ?? MARKS.landmark;
    blit(out, mk, s.x - 3, s.y - 3);
  }
  for (const n of mapNotes()) { const [u, v] = mapPoint(n.loc, n.x); blit(out, MARKS.note, u * W + 6, v * H - 9); }
  // pins
  for (const L of LOCATIONS) {
    const [x, y] = P(L);
    if (isFound(L.id)) {
      const pin = pinOf(L);
      // a little shadow, then the pin
      for (let k = 0; k < pin.w; k++) out.set(x - pin.w / 2 + k, y + 1, mix(out.get(Math.round(x - pin.w / 2 + k), Math.round(y + 1)), INK, 0.35));
      blit(out, pin, x - pin.w / 2, y - pin.h + 1);
    } else if (isRumoured(L.id)) blit(out, PINS.rumour, x - 4, y - 9);
  }
  const g = cv.getContext('2d')!;
  g.putImageData(new ImageData(new Uint8ClampedArray(out.bytes), W, H), 0, 0);
}
let cvRedraw: (() => void) | null = null;

// ------------------------------------------------------------------ the window
const CSS = `
.rm10 { position: absolute; inset: 0; z-index: 60; pointer-events: auto; background: radial-gradient(circle at 50% 40%, #3a2412, #140a04 75%); opacity: 0; transition: opacity 0.22s; touch-action: none; user-select: none; -webkit-user-select: none; }
.rm10.on { opacity: 1; }
.rm10 .vp { position: absolute; inset: clamp(46px, 7.5vh, 64px) clamp(8px, 1.6vw, 18px) clamp(8px, 1.6vw, 18px); border-style: solid; border-width: 18px;
  border-image: var(--sk-frame) 6 fill / 18px / 0 round; image-rendering: pixelated; overflow: hidden; cursor: grab; background: #2a1408; }
.rm10 .vp.drag { cursor: grabbing; }
.rm10 canvas { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; }
.rm10 .ov { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.rm10 .lbl { position: absolute; left: 0; top: 0; white-space: nowrap; font-family: 'Jersey 15', 'Pixelify Sans', monospace; color: #3a2614; text-shadow: 0 1px 0 rgba(246,234,208,0.9), 1px 0 0 rgba(246,234,208,0.7), -1px 0 0 rgba(246,234,208,0.7);
  font-size: 15px; line-height: 1; transform-origin: 50% 0; }
.rm10 .lbl.sub { font-size: 12px; color: #6a4a2a; }
.rm10 .lbl.sea { font-family: 'Jersey 10', 'Jersey 15', monospace; color: #5e6a5a; letter-spacing: 0.25em; font-size: 14px; text-shadow: none; }
.rm10 .lbl.note { font-size: 12px; color: #5e4026; font-style: italic; max-width: 14em; white-space: normal; }
.rm10 .lbl.q { color: #8a6c48; }
.rm10 .lbl.sel { color: #a8382a; }
.rm10 .here, .rm10 .ring { position: absolute; left: 0; top: 0; width: 0; height: 0; }
.rm10 .here i { position: absolute; left: -13px; top: -13px; width: 26px; height: 26px; border-radius: 50%; box-shadow: 0 0 0 2px #a8382a; animation: rmPulse 1.3s ease-out infinite; }
.rm10 .here b { position: absolute; left: 0; top: 14px; transform: translateX(-50%); font: 11px 'Jersey 10', monospace; font-weight: 400; color: #a8382a; letter-spacing: 0.15em; text-shadow: 0 1px 0 #f6ead0; }
@keyframes rmPulse { 0% { transform: scale(0.5); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
.rm10 .ring i { position: absolute; left: -18px; top: -31px; width: 36px; height: 36px; border: 2px dashed #a8382a; border-radius: 50%; animation: rmSpin 6s linear infinite; }
@keyframes rmSpin { to { transform: rotate(360deg); } }
.rm10 .top { position: absolute; left: 50%; top: clamp(6px, 1.2vh, 12px); transform: translateX(-50%); display: flex; align-items: center; gap: 0.8em; white-space: nowrap; }
.rm10 .top .pz-tab { font-size: 1.35em !important; }
.rm10 .top .st { font-family: var(--head); color: #ffe9a8; text-shadow: 0 2px 0 #1a0e06; font-size: 1.05em; letter-spacing: 0.05em; }
.rm10 .top .st i { font-style: normal; color: #8ad8ff; }
.rm10 .x { position: absolute; right: clamp(8px, 1.6vw, 18px); top: clamp(6px, 1.2vh, 12px); }
.rm10 .tools { position: absolute; left: clamp(26px, 3vw, 40px); bottom: clamp(26px, 3vw, 40px); display: flex; flex-direction: column; gap: 8px; }
.rm10 .tools button { width: 46px; height: 46px; padding: 0 !important; font-size: 1.3em !important; }
.rm10 .legend { position: absolute; left: clamp(84px, 9vw, 110px); bottom: clamp(26px, 3vw, 40px); padding: 0.45em 0.7em; font-family: 'Jersey 15', monospace; font-size: 0.82em; color: #3a2614; background: rgba(242,228,188,0.92);
  box-shadow: 0 0 0 2px #2a1a10, 0 4px 0 2px rgba(0,0,0,0.3); display: grid; grid-template-columns: auto auto; gap: 0.15em 0.9em; pointer-events: none; }
.rm10 .legend span { display: flex; align-items: center; gap: 0.35em; white-space: nowrap; }
.rm10 .legend img { width: 18px; height: 18px; image-rendering: pixelated; object-fit: contain; }
.rm10 .card { position: absolute; right: clamp(26px, 3vw, 40px); top: clamp(70px, 10vh, 90px); width: min(23em, 40vw); max-height: calc(100% - clamp(110px, 16vh, 140px)); overflow: auto; padding: 0.9em 1em 1em; display: none; pointer-events: auto; color: #3a2614; }
.rm10 .card.on { display: block; }
.rm10 .card h3 { margin: 0; font-family: var(--head); font-size: 1.5em; color: #2f6b2a; line-height: 1.05; }
.rm10 .card .sub { font-size: 0.92em; color: #6a4a2a; margin-bottom: 0.4em; }
.rm10 .card .row { display: flex; justify-content: space-between; gap: 0.6em; font-size: 0.92em; margin: 0.18em 0; }
.rm10 .card .row b { color: #3a2614; font-weight: 600; }
.rm10 .card .pips i { display: inline-block; width: 0.7em; height: 0.7em; margin-left: 2px; background: #c9b489; box-shadow: inset 0 0 0 1px #8a6a44; }
.rm10 .card .pips i.on { background: #a8382a; box-shadow: inset 0 0 0 1px #5a1a10; }
.rm10 .card .bar { height: 7px; background: #c9b489; box-shadow: inset 0 0 0 1px #8a6a44; margin: 0.2em 0 0.5em; }
.rm10 .card .bar > div { height: 100%; background: linear-gradient(#8ad05a 0 50%, #5a9a3a 50%); }
.rm10 .card p { margin: 0.4em 0; font-size: 0.92em; line-height: 1.25; }
.rm10 .card .sp { display: flex; flex-wrap: wrap; gap: 4px; margin: 0.3em 0; }
.rm10 .card .sp img { height: 26px; image-rendering: pixelated; background: rgba(120,80,30,0.12); padding: 2px; }
.rm10 .card .finds { font-size: 0.86em; color: #5e4026; }
.rm10 .card .go { width: 100%; margin-top: 0.6em; font-size: 1.1em !important; padding: 0.35em 0.9em !important; }
.rm10 .card .why { font-size: 0.86em; color: #a8382a; margin-top: 0.4em; }
.rm10 .card .x2 { position: absolute; right: 8px; top: 8px; }
.rm10 .hint { position: absolute; left: 50%; bottom: clamp(24px, 3vw, 36px); transform: translateX(-50%); padding: 0.3em 0.8em; font-family: 'Jersey 15', monospace; font-size: 0.82em; color: #f2e4bc; background: rgba(26,14,6,0.72); pointer-events: none; white-space: nowrap; }
@media (max-width: 720px), (max-height: 520px) {
  .rm10 .card { left: 12px; right: 12px; top: auto; bottom: 12px; width: auto; max-height: 48%; }
  .rm10 .legend { display: none; }
  .rm10 .hint { display: none; }
  .rm10 .tools { left: auto; right: clamp(26px, 3vw, 40px); bottom: auto; top: clamp(70px, 10vh, 90px); }
}
`;
let styled = false;

/** open the Region Map; resolves with the location picked for travel (null: closed) */
export function openRegionMap(o: RegionMapOpts = {}): Promise<string | null> {
  if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
  const ui = game.ui;
  ui.modalOpen++;
  audio.play('pageTurn', { vol: 0.5 });
  const root = el('div', 'rm10');
  root.innerHTML = `<div class="vp"><canvas></canvas><div class="ov"></div></div>
    <div class="top"><span class="pz-tab">Region Map</span><span class="st"></span></div>
    <button class="pz-x x" title="Close (Esc)"></button>
    <div class="tools"><button class="btn ghost zi" title="Zoom in">+</button><button class="btn ghost zo" title="Zoom out">−</button><button class="btn ghost zc" title="Centre">◎</button></div>
    <div class="legend"></div>
    <div class="card panel"></div>
    <div class="hint">Drag to pan · wheel or pinch to zoom · tap a pin</div>`;
  ui.modalLayer.appendChild(root);
  requestAnimationFrame(() => root.classList.add('on'));
  const vp = root.querySelector('.vp') as HTMLElement, cv = root.querySelector('canvas') as HTMLCanvasElement, ov = root.querySelector('.ov') as HTMLElement;
  const card = root.querySelector('.card') as HTMLElement;
  const map = document.createElement('canvas');
  map.width = W; map.height = H;

  // header: day, clock, energy
  const st = root.querySelector('.st') as HTMLElement;
  const cur = currentExpedition();
  const hour = cur ? expeditionHour() : game.save.vars['v10:hour'] ?? 7.5;
  st.innerHTML = `Day ${dayNumber()} · ${clockText(hour)} · <i>Energy ${Math.round(energy())}/${maxEnergy()}</i>`;
  // legend
  const leg = root.querySelector('.legend') as HTMLElement;
  const legURL = (b: PixelBuffer) => b.toDataURL(2);
  leg.innerHTML = [['Camp', PINS.camp], ['Wild place', PINS.site], ['Village', PINS.village], ['Ruins', PINS.ruin], ['Cave', PINS.cave], ['Fossils', PINS.fossil], ['Strange place', PINS.glow], ['Heard of', PINS.rumour], ['Artifact', MARKS.artifact], ['Sample', MARKS.sample], ['Landmark', MARKS.landmark], ['Note', MARKS.note]]
    .map(([t, b]) => `<span><img src="${legURL(b as PixelBuffer)}" alt="">${t}</span>`).join('');

  // ---- view state
  let scale = 2, ox = 0, oy = 0, vw = 1, vh = 1, dpr = 1;
  let sel: string | null = o.focus ?? null;
  const here = o.here ?? (cur ? lastPos() : { loc: 'camp', x: 1980 });
  const hereP = (() => { if (!here || !location(here.loc)) return null; const [u, v] = mapPoint(here.loc, here.x); return [u * W, v * H] as [number, number]; })();
  const minScale = () => Math.min(vw / W, vh / H) * 0.98;
  const clampView = () => {
    scale = clamp(scale, minScale(), 6);
    const mw = W * scale, mh = H * scale;
    ox = mw <= vw ? (vw - mw) / 2 : clamp(ox, vw - mw - 14, 14);
    oy = mh <= vh ? (vh - mh) / 2 : clamp(oy, vh - mh - 14, 14);
  };
  const centreOn = (mx: number, my: number) => { ox = vw / 2 - mx * scale; oy = vh / 2 - my * scale; clampView(); };
  const fit = () => {
    const r = vp.getBoundingClientRect();
    const bw = 18;
    vw = Math.max(1, r.width - bw * 2); vh = Math.max(1, r.height - bw * 2);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
  };

  // ---- overlay labels (in map pixels)
  interface Lab { el: HTMLElement; x: number; y: number; dy: number; min: number; loc?: string }
  let labs: Lab[] = [];
  const hereEl = el('div', 'here', '<i></i><b>YOU</b>'), ringEl = el('div', 'ring', '<i></i>');
  const buildLabels = () => {
    ov.innerHTML = '';
    labs = [];
    const lab = (cls: string, html: string, x: number, y: number, dy: number, min = 0, loc?: string) => { const e = el('div', 'lbl ' + cls, html); ov.appendChild(e); labs.push({ el: e, x, y, dy, min, loc }); return e; };
    let shore = 0;
    for (const L of LOCATIONS) {
      const [x, y] = P(L);
      if (isFound(L.id)) {
        const isle = L.scene.type === 'island' && L.id !== 'camp';
        const up = isle && shore++ % 2 === 0;
        lab(isle ? 'sub' : '', esc(L.name), x, y, up ? -36 : 5, isle ? 2.6 : 0, L.id);
        if (L.sub && !isle) lab('sub', esc(L.sub), x, y, 21, 2.4);
      } else if (isRumoured(L.id)) lab('q', L.secret ? '???' : `${esc(L.name)}?`, x, y, 4, 0, L.id);
    }
    for (const n of mapNotes()) { const [u, v] = mapPoint(n.loc, n.x); lab('note', esc(n.text), u * W + 15, v * H - 10, 0, 2.4); }
    for (const s of spots()) if (s.d.note && s.d.kind !== 'species') lab('note', esc(s.d.note), s.x + 6, s.y + 4, 0, 3.2);
    lab('sea', 'TE MOANA NUI', 560, 32, 0, 0);
    lab('sea', 'NGĀ PUKE', 770, 210, 0, 0);
    lab('sea', 'TE WHENUA HUNA', 520, 590, 0, 0).style.fontSize = '18px';
    lab('sub', `the hidden land · surveyed by Mori, day ${dayNumber()}`, 520, 612, 0, 0);
    ov.appendChild(hereEl);
    ov.appendChild(ringEl);
  };
  const place = () => {
    for (const l of labs) {
      const sx = ox + l.x * scale, sy = oy + l.y * scale + l.dy;
      const vis = scale >= l.min && sx > -200 && sx < vw + 200 && sy > -60 && sy < vh + 60;
      l.el.style.display = vis ? '' : 'none';
      if (vis) l.el.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translateX(-50%)`;
      l.el.classList.toggle('sel', !!l.loc && l.loc === sel);
    }
    if (hereP) { hereEl.style.display = ''; hereEl.style.transform = `translate(${Math.round(ox + hereP[0] * scale)}px, ${Math.round(oy + hereP[1] * scale)}px)`; } else hereEl.style.display = 'none';
    const S = sel ? location(sel) : null;
    if (S) { const [x, y] = P(S); ringEl.style.display = ''; ringEl.style.transform = `translate(${Math.round(ox + x * scale)}px, ${Math.round(oy + y * scale)}px)`; } else ringEl.style.display = 'none';
  };

  // ---- drawing
  let raf = 0;
  const draw = () => {
    raf = 0;
    const g = cv.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#2a1408';
    g.fillRect(0, 0, cv.width, cv.height);
    g.imageSmoothingEnabled = false;
    g.setTransform(scale * dpr, 0, 0, scale * dpr, ox * dpr, oy * dpr);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(3 / scale + 2, 4 / scale + 2, W, H);
    g.drawImage(map, 0, 0);
    place();
  };
  const redraw = () => { if (!raf) raf = requestAnimationFrame(draw); };
  const recompose = () => { compose(map); buildLabels(); redraw(); };
  cvRedraw = () => { compose(map); redraw(); };

  // ---- the card
  const showCard = (id: string | null) => {
    sel = id;
    const L = id ? location(id) : null;
    if (!L) { card.classList.remove('on'); redraw(); return; }
    const found = isFound(L.id), rum = isRumoured(L.id);
    const name = found || !L.secret ? L.name : '???';
    const ds = discoveriesAt(L.id);
    const sp = [...new Set(ds.filter(d => d.kind === 'species' && d.icon).map(d => d.icon!))];
    const fc = ds.filter(d => d.kind !== 'species' && d.kind !== 'location').length;
    const ex = Math.round(explored(L.id) * 100);
    let html = `<button class="pz-x x2" title="Close"></button><h3>${esc(name)}</h3><div class="sub">${found && L.sub ? esc(L.sub) + ' · ' : ''}${REGION_NAME[L.region] ?? L.region} · ${KIND_NAME[L.kind] ?? L.kind}</div>`;
    if (!found) {
      html += `<p>${rum ? (L.secret ? 'Something is out there. Aroha won’t say its name.' : 'Heard of, never seen. ' + esc(L.desc)) : 'Unexplored.'}</p><p class="finds">Find the way there on foot: it lies beyond somewhere you have already been.</p>`;
    } else {
      html += `<div class="row"><span>Difficulty</span><span class="pips">${[1, 2, 3, 4, 5].map(k => `<i class="${k <= L.difficulty ? 'on' : ''}"></i>`).join('')}</span></div>`;
      if (L.terrain) html += `<div class="row"><span>Terrain</span><b>${esc(L.terrain)}</b></div>`;
      html += `<div class="row"><span>Explored</span><b>${ex}%</b></div><div class="bar"><div style="width:${ex}%"></div></div><p>${esc(L.desc)}</p>`;
      if (sp.length) html += `<div class="sp">${sp.slice(0, 12).map(s => `<img src="${speciesSprite(s)}" alt="" title="${esc(SPECIES_BY_ID[s]?.name ?? s)}">`).join('')}</div>`;
      html += `<div class="finds">${sp.length} species sketched here · ${fc} find${fc === 1 ? '' : 's'} noted</div>`;
      const ways = LOCATIONS.filter(t => t.routes?.some(r => r.from === L.id));
      if (ways.length) html += `<div class="finds">Ways on: ${ways.map(t => (isFound(t.id) ? esc(t.name) : '???') + ` (${ROUTE_WORD[t.routes!.find(r => r.from === L.id)!.kind]})`).join(', ')}</div>`;
      if (L.id === 'camp') html += `<p class="finds">Home. Expeditions leave from the trailhead signpost.</p>`;
      else {
        const t = tripCost(L.id), hc = homeCost(L.id);
        if (t) html += `<div class="row"><span>From camp</span><b>${fmtH(t.hours)} · −${t.energy} energy</b></div><div class="row"><span>Walk home</span><b>${fmtH(hc.hours)} · −${hc.energy} energy</b></div>`;
        const here2 = cur === L.id;
        if (here2) html += `<div class="why" style="color:#2f6b2a">You are here.</div>`;
        else if (o.readOnly) html += `<div class="why">Fast travel starts from camp.</div>`;
        else if (t) {
          const need = t.energy + 4;
          const arrive = (game.save.vars['v10:hour'] ?? 7.5) + t.hours;
          const ok = energy() >= need;
          html += `<button class="btn go"${ok ? '' : ' disabled'}>Travel here · arrive ${clockText(arrive)}</button>${ok ? '' : `<div class="why">Too tired: you need ${need} energy for this trip.</div>`}`;
        }
      }
    }
    card.innerHTML = html;
    card.classList.add('on');
    card.querySelector('.x2')?.addEventListener('pointerdown', e => { e.stopPropagation(); showCard(null); });
    card.querySelector('.go')?.addEventListener('pointerdown', e => { e.stopPropagation(); audio.play('uiOpen'); finish(L.id); });
    audio.play('ui', { vol: 0.35 });
    redraw();
  };

  // ---- input: drag, pinch, wheel, tap
  const pts = new Map<number, { x: number; y: number }>();
  let down: { x: number; y: number; t: number; ox: number; oy: number } | null = null;
  let pinch: { d: number; s: number; mx: number; my: number } | null = null;
  const local = (e: PointerEvent | WheelEvent) => { const r = vp.getBoundingClientRect(); return { x: e.clientX - r.left - 18, y: e.clientY - r.top - 18 }; };
  const zoomAt = (sx: number, sy: number, k: number) => {
    const mx = (sx - ox) / scale, my = (sy - oy) / scale;
    scale = clamp(scale * k, minScale(), 6);
    ox = sx - mx * scale; oy = sy - my * scale;
    clampView(); redraw();
  };
  const hit = (sx: number, sy: number): string | null => {
    let best: string | null = null, bd = Math.max(18, 8 * scale);
    for (const L of LOCATIONS) {
      if (!isFound(L.id) && !isRumoured(L.id)) continue;
      const [x, y] = P(L);
      const d = Math.hypot(ox + x * scale - sx, oy + (y - 5) * scale - sy);
      if (d < bd) { bd = d; best = L.id; }
    }
    return best;
  };
  vp.addEventListener('pointerdown', e => {
    vp.setPointerCapture(e.pointerId);
    const p = local(e);
    pts.set(e.pointerId, p);
    if (pts.size === 1) down = { ...p, t: performance.now(), ox, oy };
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: scale, mx: ((a.x + b.x) / 2 - ox) / scale, my: ((a.y + b.y) / 2 - oy) / scale };
      down = null;
    }
    vp.classList.add('drag');
  });
  vp.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const p = local(e);
    pts.set(e.pointerId, p);
    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      scale = clamp(pinch.s * (d / Math.max(1, pinch.d)), minScale(), 6);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      ox = cx - pinch.mx * scale; oy = cy - pinch.my * scale;
      clampView(); redraw();
    } else if (down) {
      ox = down.ox + p.x - down.x; oy = down.oy + p.y - down.y;
      clampView(); redraw();
    }
  });
  const up = (e: PointerEvent) => {
    const p = local(e);
    if (down && pts.size === 1 && Math.hypot(p.x - down.x, p.y - down.y) < 8 && performance.now() - down.t < 500) {
      const id = hit(p.x, p.y);
      showCard(id);
    }
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (!pts.size) { down = null; vp.classList.remove('drag'); }
  };
  vp.addEventListener('pointerup', up);
  vp.addEventListener('pointercancel', up);
  vp.addEventListener('wheel', e => { e.preventDefault(); const p = local(e); zoomAt(p.x, p.y, e.deltaY < 0 ? 1.18 : 1 / 1.18); }, { passive: false });
  root.querySelector('.zi')!.addEventListener('pointerdown', e => { e.stopPropagation(); zoomAt(vw / 2, vh / 2, 1.35); });
  root.querySelector('.zo')!.addEventListener('pointerdown', e => { e.stopPropagation(); zoomAt(vw / 2, vh / 2, 1 / 1.35); });
  root.querySelector('.zc')!.addEventListener('pointerdown', e => { e.stopPropagation(); const c = hereP ?? P(location('camp')!); centreOn(c[0], c[1]); redraw(); });

  // ---- open / close
  let done: (v: string | null) => void = () => {};
  const result = new Promise<string | null>(r => (done = r));
  const finish = (v: string | null) => {
    window.removeEventListener('keydown', kh, true);
    window.removeEventListener('resize', rs);
    off();
    cvRedraw = null;
    if (raf) cancelAnimationFrame(raf);
    root.classList.remove('on');
    setTimeout(() => root.remove(), 220);
    ui.modalOpen = Math.max(0, ui.modalOpen - 1);
    guardInput(300);
    if (v === null) audio.play('uiBack');
    done(v);
  };
  const kh = (e: KeyboardEvent) => {
    const k = e.code;
    if (k === 'Escape' || k === 'KeyM' || k === 'Tab') { e.preventDefault(); e.stopPropagation(); if (sel && k === 'Escape') showCard(null); else finish(null); return; }
    const step = 60;
    if (k === 'ArrowLeft' || k === 'KeyA') ox += step; else if (k === 'ArrowRight' || k === 'KeyD') ox -= step;
    else if (k === 'ArrowUp' || k === 'KeyW') oy += step; else if (k === 'ArrowDown' || k === 'KeyS') oy -= step;
    else if (k === 'Equal' || k === 'NumpadAdd') { zoomAt(vw / 2, vh / 2, 1.25); return; }
    else if (k === 'Minus' || k === 'NumpadSubtract') { zoomAt(vw / 2, vh / 2, 1 / 1.25); return; }
    else if (k === 'Enter' && sel) { (card.querySelector('.go') as HTMLButtonElement | null)?.dispatchEvent(new PointerEvent('pointerdown')); return; }
    else return;
    e.preventDefault(); e.stopPropagation(); clampView(); redraw();
  };
  window.addEventListener('keydown', kh, true);
  const rs = () => { fit(); clampView(); redraw(); };
  window.addEventListener('resize', rs);
  root.querySelector('.x')!.addEventListener('pointerdown', e => { e.stopPropagation(); finish(null); });
  const off = onMapChange(() => recompose());

  // first frame: paint (the first open builds the parchment and the terrain), centre on Mori
  requestAnimationFrame(() => {
    fit();
    scale = clamp(Math.max(2, minScale()), minScale(), 6);
    const c = hereP ?? P(location('camp')!);
    centreOn(c[0], c[1]);
    recompose();
    if (sel) showCard(sel);
    // the species sketches load in the background, then the map redraws with them
    const ids = [...new Set(discoveries().filter(d => d.kind === 'species' && d.icon).map(d => d.icon!))];
    Promise.all(ids.map(inkSpecies)).then(() => { if (cvRedraw) cvRedraw(); });
  });
  return result;
}


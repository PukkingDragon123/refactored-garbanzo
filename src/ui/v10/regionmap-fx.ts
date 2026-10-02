// V10 Region Map, the live layer: what Mori has explored (a coverage field grown from every stretch
// walked, way travelled, find and place), the reveal (newly explored land is first sketched in ink,
// then washed with colour, spreading out from the trail in the order he walked it) and everything
// that moves on the painted land: surf rolling in, sparkles on the sea, rivers flowing, the falls,
// canopy swaying in a gust, glowing fungi, smoke and steam, drifting clouds and their shadows, mist,
// birds, hawks, whales, seals, the tiger in its wallow, waka and the Kitten. Only coloured-in land
// is alive; unexplored parchment stays still paper.
//
// It renders at map resolution into one W x H ImageData (just the visible window each frame, from
// the cached composition plus sparse per-pixel effects and small sprites); regionmap.ts scales it up.

import { C, hex, mix, rgba, R, G, B as BL } from '../../art/color';
import { hash2, fbm2, clamp } from '../../core/math';
import { W, H, TAG, WK, MARKS, INK, INK2, INK3, INK_RED, mapArt } from './regionmap-art';
import type { MapArt } from './regionmap-art';
import { SMOKES, SEA_LANES, CRITTERS, B, REVEAL_R, VISTAS } from './mapgeo';
import { PixelBuffer } from '../../art/pixel';
import {
  LOCATIONS, location, isFound, seenBins, binPoint, mapPoint, discoveries, mapNotes, travelledRoutes, BINS, xRange,
} from '../../game/v10/regions';
import type { Discovery } from '../../game/v10/regions';
import { tripTrail } from '../../game/v10/expedition';
import { bucket } from '../../game/v10/store';
import { boatReady, boatIsAway } from '../../game/v10/boat';

// ------------------------------------------------------------------ what has been explored
export interface Seed { x: number; y: number; r: number; t: number }
/** a record of the explored map (saved as "what the map showed last time") */
export interface SeedState { seen: Record<string, string>; routes: string[]; disc: string[]; found: string[] }

export function currentSeedState(): SeedState {
  const seen: Record<string, string> = {};
  for (const L of LOCATIONS) { const b = seenBins(L.id); if (b.some(Boolean)) seen[L.id] = b.map(v => (v ? '1' : '0')).join(''); }
  return {
    seen,
    routes: travelledRoutes().map(([a, b]) => a + '>' + b),
    disc: discoveries().map(d => d.id),
    found: LOCATIONS.filter(L => isFound(L.id)).map(L => L.id),
  };
}
interface ViewState { last: SeedState | null }
const VS = () => bucket<ViewState>('mapview', () => ({ last: null }));
/** what the map showed when it was last looked at (null: never opened with this map) */
export const lastShown = () => VS().last;
export function markShown(s: SeedState) { VS().last = s; }

/** the end points of a travelled way on the map */
export function routeEnds(from: string, to: string): [[number, number], [number, number], string] | null {
  const T = location(to), F = location(from);
  const r = T?.routes?.find(rt => rt.from === from);
  if (!T || !F || !r) return null;
  const a = mapPoint(from, r.at), b = mapPoint(to, r.enter ?? xRange(T)[0]);
  return [[a[0] * W, a[1] * H], [b[0] * W, b[1] * H], r.kind];
}

/** seeds of a recorded state; `fresh` (not in `old`) seeds get increasing times in the order walked */
function seedsOf(s: SeedState, old: SeedState | null): Seed[] {
  const out: Seed[] = [];
  const trail = tripTrail();
  const order = (loc: string) => { const k = trail.indexOf(loc); return k < 0 ? trail.length + 1 : k; };
  const fresh: { s: Seed; k: number }[] = [];
  const push = (x: number, y: number, r: number, isNew: boolean, k: number) => { const sd = { x, y, r, t: -1 }; out.push(sd); if (isNew) fresh.push({ s: sd, k }); };
  for (const id of Object.keys(s.seen)) {
    const L = location(id);
    if (!L) continue;
    const bins = s.seen[id], ob = old?.seen[id] ?? '';
    const r = REVEAL_R[id] ?? (L.scene.type === 'island' ? 18 : L.region === 'ocean' ? 24 : 30);
    for (let i = 0; i < BINS; i++) if (bins[i] === '1') { const [u, v] = binPoint(id, i); push(u * W, v * H, r, ob[i] !== '1', order(id) * 100 + i); }
  }
  // vistas: a place walked well enough shows the land around it
  const frac = (st: SeedState | null, id: string) => {
    if (!st) return 0;
    const L = location(id);
    if (L?.trip) return st.found.includes(id) ? 1 : 0;
    const b = st.seen[id] ?? '';
    let n = 0;
    for (let i = 0; i < b.length; i++) if (b[i] === '1') n++;
    return n / BINS;
  };
  for (const id of Object.keys(VISTAS)) {
    if (!location(id) || frac(s, id) < 0.5) continue;
    const isNew = !old || frac(old, id) < 0.5;
    VISTAS[id].forEach(([cx, cy, rx, ry], k) => {
      for (let y = -ry; y <= ry; y += 10) for (let x = -rx; x <= rx; x += 10) {
        const e = (x / rx) ** 2 + (y / ry) ** 2;
        if (e > 1) continue;
        push(cx + x, cy + y, 12, isNew, order(id) * 100 + 70 + k * 5 + Math.sqrt(e) * 4);
      }
    });
  }
  const oldR = new Set(old?.routes ?? []);
  for (const k of s.routes) {
    const [a, b] = k.split('>');
    const e = routeEnds(a, b);
    if (!e) continue;
    const [[ax, ay], [bx, by]] = e;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 3));
    for (let j = 0; j <= n; j++) push(ax + ((bx - ax) * j) / n, ay + ((by - ay) * j) / n, 11, !oldR.has(k), order(b) * 100 - 50 + j);
  }
  const oldD = new Set(old?.disc ?? []);
  const dmap = new Map<string, Discovery>(discoveries().map(d => [d.id, d]));
  for (const id of s.disc) {
    const d = dmap.get(id);
    if (!d || !location(d.loc)) continue;
    const [u, v] = mapPoint(d.loc, d.x ?? (xRange(location(d.loc)!)[0] + xRange(location(d.loc)!)[1]) / 2);
    push(u * W, v * H, 12, !oldD.has(id), order(d.loc) * 100 + 60);
  }
  const oldF = new Set(old?.found ?? []);
  for (const id of s.found) {
    const L = location(id);
    if (!L) continue;
    const boat = !!L.trip;
    push(L.pos[0] * W, L.pos[1] * H, boat ? 30 : id === 'camp' ? 24 : 16, !oldF.has(id), order(id) * 100);
    const lane = SEA_LANES[id];
    if (boat && lane) for (let i = 1; i < lane.length; i++) {
      const [ax, ay] = lane[i - 1], [bx, by] = lane[i];
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 4);
      for (let j = 0; j <= n; j++) push(ax + ((bx - ax) * j) / n, ay + ((by - ay) * j) / n, 10, !oldF.has(id), order(id) * 100 + i * 4 + j * 0.1);
    }
  }
  const c = location('camp');
  if (c) push(c.pos[0] * W, c.pos[1] * H, 24, !old, 0);
  fresh.sort((a, b) => a.k - b.k);
  fresh.forEach((f, k) => (f.s.t = k));
  return out;
}

/** coverage: how far inside the explored area each pixel is (map px; negative outside), and when the
 *  reveal reaches it (seed time + distance) */
function coverField(seeds: Seed[], withTime: boolean): { f: Float32Array; tau: Float32Array | null } {
  const N = W * H;
  const f = new Float32Array(N).fill(-60);
  const tau = withTime ? new Float32Array(N).fill(-1) : null;
  for (const s of seeds) {
    const x = Math.round(s.x), y = Math.round(s.y);
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const i = y * W + x;
    if (s.r > f[i]) { f[i] = s.r; if (tau) tau[i] = s.t; }
  }
  const D = 1.414;
  const relax = (i: number, j: number, d: number) => {
    const c = f[j] - d;
    if (c > f[i]) { f[i] = c; if (tau) tau[i] = tau[j] < 0 ? -1 : tau[j] + d * 0.5; }
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (x > 0) relax(i, i - 1, 1);
    if (y > 0) { relax(i, i - W, 1); if (x > 0) relax(i, i - W - 1, D); if (x < W - 1) relax(i, i - W + 1, D); }
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x;
    if (x < W - 1) relax(i, i + 1, 1);
    if (y < H - 1) { relax(i, i + W, 1); if (x < W - 1) relax(i, i + W + 1, D); if (x > 0) relax(i, i + W - 1, D); }
  }
  return { f, tau };
}

// ------------------------------------------------------------------ small runtime sprites
interface Spr { w: number; h: number; d: Uint32Array }
const spr = (rows: string[], pal: Record<string, C>): Spr => {
  const w = rows[0].length, h = rows.length, d = new Uint32Array(w * h);
  rows.forEach((r, y) => { for (let x = 0; x < w; x++) { const c = pal[r[x]]; if (c !== undefined) d[y * w + x] = c; } });
  return { w, h, d };
};
const fromBuf = (b: PixelBuffer): Spr => ({ w: b.w, h: b.h, d: b.data });
const P = {
  k: hex('#1a1410'), w: hex('#f4f2ea'), g: hex('#a8aeb0'), d: hex('#3a3a40'), o: hex('#d8782a'), y: hex('#f0c040'), r: hex('#b0281e'), b: hex('#2a3640'),
  n: hex('#5a4630'), s: hex('#6a6a70'), l: hex('#c8c8c0'), t: hex('#8a8a50'), e: hex('#e8e0d0'), m: hex('#4a5a3a'), c: hex('#6ad8e8'), p: hex('#e070a0'),
};
const SP = {
  gull: [spr(['w.w', '.w.'], P), spr(['...', 'www'], P)],
  bird: [spr(['k.k', '.k.'], P), spr(['...', 'kkk'], P)],
  hawk: [spr(['n...n', '.nnn.', '..n..'], P), spr(['.....', 'nnnnn', '..n..'], P)],
  hawkShadow: spr(['.....', 'kkkkk', '..k..'], P),
  whaleBack: [spr(['..ddd..', '.ddddd.', 'sssssss'], P), spr(['...dd..', '.dddddd', 'sssssss'], P)],
  fluke: spr(['d...d', '.d.d.', '..d..', '..s..'], P),
  fin: spr(['.d', 'dd', 'ss'], P),
  seal: [spr(['.nnnn', 'nnnnn'], P), spr(['n....', 'nnnnn'], P)],
  sealHead: spr(['nn', 'nn'], P),
  tiger: [spr(['....ok.', 'okokoko', 'o.o.o.o'], P), spr(['.o..ok.', 'okokoko', '.......'], P), spr(['....oko', 'okokok.', '.......'], P)],
  croc: spr(['..t..t..', 'mmmmmmmm'], P),
  stork: [spr(['.w..', 'ww..', '.wkk', '.w..', '.k..'], P), spr(['.w..', 'ww..', '.w..', '.wk.', '.kk.'], P)],
  bone: [spr(['.lll', 'lll.'], P), spr(['lll.', '.lll'], P)],
  kitten: [spr(['...w...', '..ww...', '.www...', 'wwww.w.', '...k...', 'rrrrrrr', '.rrrrr.'], P), spr(['...w...', '..ww...', '.www...', 'wwwwww.', '...k...', 'rrrrrrr', '.rrrrr.'], P)],
  waka: spr(['r.......r', '.nnnnnnn.', '..kkkkk..'], P),
  paddler: [spr(['k', 'n'], P), spr(['k', 'k'], P)],
  ribbon: [spr(['cy.', '..p'], P), spr(['.y.', 'c.p'], P)],
  flag: [spr(['rrr', 'rr.', 'r..'], P), spr(['rr.', 'rrr', 'r..'], P), spr(['r..', 'rrr', 'rr.'], P)],
};

/** a pixel cumulus: puffs shaded white to blue-grey; the shadow is its silhouette */
function cloudSprite(seed: number, w: number): { c: Spr; s: Spr } {
  const h = Math.round(w * 0.42);
  const d = new Uint32Array(w * h), sd = new Uint32Array(w * h);
  const puffs: [number, number, number][] = [];
  const n = 4 + Math.floor(hash2(seed, 1, 1) * 4);
  for (let k = 0; k < n; k++) {
    const u = (k + 0.5) / n;
    puffs.push([w * (0.12 + u * 0.76) + (hash2(seed, k, 2) - 0.5) * 6, h * (0.62 - Math.sin(u * Math.PI) * 0.22) + (hash2(seed, k, 3) - 0.5) * 3, h * (0.26 + Math.sin(u * Math.PI) * 0.22 + hash2(seed, k, 4) * 0.1)]);
  }
  const ramp = [hex('#9aa6b4'), hex('#b8c2cc'), hex('#d4dbe0'), hex('#eef2f2'), hex('#ffffff')];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let best = -1, ny = 0, nx = 0;
    for (const [px, py, pr] of puffs) {
      const k = 1 - Math.hypot(x + 0.5 - px, (y + 0.5 - py) * 1.15) / pr;
      if (k > best) { best = k; nx = (x - px) / pr; ny = (y - py) / pr; }
    }
    if (best < 0 || y > h - 2) continue;
    const l = 0.62 - nx * 0.3 - ny * 0.55 + best * 0.25 + (hash2(x, y, seed) - 0.5) * 0.1;
    const c = ramp[clamp(Math.floor(l * 5), 0, 4)];
    d[y * w + x] = (c & 0x00ffffff) | ((best < 0.12 ? 70 : best < 0.3 ? 140 : 190) << 24);
    sd[y * w + x] = rgba(12, 22, 34, best < 0.12 ? 26 : 62);
  }
  return { c: { w, h, d }, s: { w, h, d: sd } };
}

// ------------------------------------------------------------------ the live map
interface Particle { x: number; y: number; vx: number; vy: number; age: number; life: number; kind: 'smoke' | 'steam' | 'spray' | 'ash' }
interface Sparkle { i: number; age: number }
interface Flock { x: number; y: number; vx: number; vy: number; n: number; age: number; life: number; dark: boolean; seed: number }
export interface MarkSpot { x: number; y: number; d: Discovery }

export class LiveMap {
  readonly frame: ImageData;
  readonly px: Uint32Array;
  readonly view: HTMLCanvasElement;
  private vctx: CanvasRenderingContext2D;
  /** the composed still map */
  readonly comp = new Uint32Array(W * H);
  /** what each pixel shows: 0 paper, 1 ink sketch, 2 wash, 3 colour */
  readonly state = new Uint8Array(W * H);
  private target = new Uint8Array(W * H);
  private cov = new Float32Array(W * H).fill(-60);
  private art: MapArt | null = null;
  // the reveal
  private rq: Int32Array | null = null;
  private rw: Float32Array | null = null;
  private rc = [0, 0, 0];
  private rt = 0;
  private rDur = 0;
  /** bounds of what is being revealed now (map px) */
  revealBox: [number, number, number, number] | null = null;
  // effects data
  private waves: Int32Array[] = [];
  private rivers: Int32Array[] = [];
  private falls: Int32Array = new Int32Array(0);
  private glow: Int32Array = new Int32Array(0);
  private gust: Int32Array[] = [];
  private trail: { i: Int32Array; c: Uint32Array; ci: Uint32Array } = { i: new Int32Array(0), c: new Uint32Array(0), ci: new Uint32Array(0) };
  private lanes: { pts: [number, number][]; len: number }[] = [];
  private sparkles: Sparkle[] = [];
  private parts: Particle[] = [];
  private flocks: Flock[] = [];
  private clouds: { c: Spr; s: Spr; x0: number; y: number; v: number }[] = [];
  private mist: { x: number; y: number; r: number; v: number; ph: number }[] = [];
  private sketches: { s: Spr; x: number; y: number }[] = [];
  private marks: { s: Spr; x: number; y: number }[] = [];
  t = 0;
  private emitT = new Map<number, number>();
  private flockT = 4;

  constructor(readonly paper: Uint32Array) {
    this.frame = new ImageData(W, H);
    this.px = new Uint32Array(this.frame.data.buffer);
    this.view = document.createElement('canvas');
    this.view.width = W; this.view.height = H;
    this.vctx = this.view.getContext('2d')!;
    for (let i = 0; i < W * H; i++) this.comp[i] = paper[i];
    this.px.set(this.comp);
    this.vctx.putImageData(this.frame, 0, 0);
    for (let k = 0; k < 6; k++) {
      const { c, s } = cloudSprite(k * 17 + 3, 30 + Math.floor(hash2(k, 9, 9) * 34));
      this.clouds.push({ c, s, x0: hash2(k, 1, 5) * (W + 240), y: 40 + hash2(k, 2, 5) * (H - 140), v: 2.2 + hash2(k, 3, 5) * 2.4 });
    }
    const mists: [number, number, number][] = [[196, 236, 26], [178, 286, 20], [300, 196, 22], [440, 206, 18], [522, 470, 30], [676, 300, 22], [388, 250, 26], [128, 314, 16]];
    this.mist = mists.map(([x, y, r], k) => ({ x, y, r, v: 1 + hash2(k, 1, 3) * 1.5, ph: hash2(k, 2, 3) * 10 }));
  }

  get ready() { return !!this.art; }
  get revealing() { return !!this.rq; }

  /** the painted map arrived: index what animates */
  setArt(a: MapArt) {
    this.art = a;
    const wv: number[][] = Array.from({ length: 16 }, () => []);
    const rv: number[][] = Array.from({ length: 24 }, () => []);
    const fl: number[] = [], gl: number[] = [];
    const gs: number[][] = Array.from({ length: 64 }, () => []);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const w = a.water[i];
      if (w === WK.sea) { const d = a.coast[i]; if (d < 16) wv[Math.floor(d)].push(i); }
      else if (w === WK.river) { if (a.ink[i] === 0 || (a.ink[i] & 0xffffff) !== (hex('#2a4a62') & 0xffffff)) rv[a.flow[i] % 24].push(i); }
      else if (w === WK.fall) fl.push(i);
      const tg = a.tag[i];
      if (tg === TAG.glow || tg === TAG.lava) gl.push(i);
      else if (tg === TAG.gust && (a.tag[i + 1] === TAG.crown || a.tag[i + 1] === TAG.gust)) gs[Math.floor((x + y * 0.6) / 5) % 64].push(i);
    }
    this.waves = wv.map(l => Int32Array.from(l));
    this.rivers = rv.map(l => Int32Array.from(l));
    this.falls = Int32Array.from(fl);
    this.glow = Int32Array.from(gl);
    this.gust = gs.map(l => Int32Array.from(l));
  }

  // ---------------------------------------------------------------- explored state
  /** recompute what is explored; anything new since `old` is revealed with the sketch-then-colour animation */
  setExplored(now: SeedState, old: SeedState | null, animate: boolean) {
    const seeds = seedsOf(now, old);
    const { f, tau } = coverField(seeds, true);
    const prev = old && animate ? coverField(seedsOf(old, null), false).f : null;
    const N = W * H;
    const cov = this.cov, tgt = this.target, st = this.state;
    const land = this.art?.land;
    const q: number[] = [];
    let bx0 = W, by0 = H, bx1 = 0, by1 = 0;
    let tmin = 1e9, tmax = -1e9;
    for (let i = 0; i < N; i++) {
      if (!this.paper[i]) { tgt[i] = 0; continue; }
      const x = i % W, y = (i / W) | 0;
      const n = (fbm2(x * 0.07, y * 0.07, 2, 301) - 0.5) * 9 + (hash2(x >> 1, y >> 1, 302) - 0.5) * 2;
      const sea = land ? !land[i] : false;
      const c = f[i] + n + (sea ? 5 : 0);
      cov[i] = c;
      const t = c > 0 ? 3 : c > -15 ? 1 : 0;
      tgt[i] = t;
      if (!this.art) continue;
      let was = st[i];
      if (prev) { const pc = prev[i] + n + (sea ? 5 : 0); was = pc > 0 ? 3 : pc > -15 ? 1 : 0; }
      else if (!animate) was = t;
      if (t > was) {
        q.push(i);
        st[i] = was;
        const tt = tau![i] < 0 ? 0 : tau![i];
        if (tt < tmin) tmin = tt; if (tt > tmax) tmax = tt;
        if (t === 3) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
      } else st[i] = t;
    }
    if (q.length && this.art) {
      const span = Math.max(1, tmax - tmin);
      const dur = clamp(0.9 + q.length / 22000, 1.1, 2.8);
      const keys = new Float64Array(q.length);
      for (let k = 0; k < q.length; k++) {
        const i = q[k];
        const tt = tau![i] < 0 ? tmin : tau![i];
        const when = ((tt - tmin) / span) * dur + hash2(i, 7, 303) * 0.18;
        keys[k] = Math.floor(when * 1000) * 1048576 + i;
      }
      keys.sort();
      this.rq = new Int32Array(q.length);
      this.rw = new Float32Array(q.length);
      for (let k = 0; k < q.length; k++) { this.rq[k] = keys[k] % 1048576; this.rw[k] = Math.floor(keys[k] / 1048576) / 1000; }
      this.rc = [0, 0, 0];
      this.rt = -0.25;
      this.rDur = dur;
      this.revealBox = bx1 >= bx0 ? [bx0, by0, bx1, by1] : null;
    } else { this.rq = null; this.revealBox = null; }
    this.recompose();
  }
  /** debug: colour in the whole sheet (to look at the painting) */
  revealEverything() {
    for (let i = 0; i < W * H; i++) { if (!this.paper[i]) continue; this.cov[i] = 20; this.target[i] = 3; this.state[i] = 3; }
    this.rq = null; this.rw = null;
    this.recompose();
  }
  /** skip the reveal to its end */
  finishReveal() {
    if (!this.rq) return;
    for (let k = 0; k < this.rq.length; k++) { const i = this.rq[k]; this.state[i] = this.target[i]; this.composeAt(i); }
    this.rq = null; this.rw = null;
  }
  private stepReveal(dt: number) {
    const q = this.rq, w = this.rw;
    if (!q || !w) return;
    this.rt += dt;
    const lag = [0, 0.38, 0.8];
    for (let s = 0; s < 3; s++) {
      let c = this.rc[s];
      const lv = s === 0 ? 1 : s === 1 ? 2 : 3;
      while (c < q.length && w[c] + lag[s] <= this.rt) {
        const i = q[c++];
        if (this.target[i] >= lv && this.state[i] < lv) { this.state[i] = lv; this.composeAt(i); }
      }
      this.rc[s] = c;
    }
    if (this.rc[2] >= q.length) { this.rq = null; this.rw = null; }
  }

  // ---------------------------------------------------------------- the still composition
  recompose() { for (let i = 0; i < W * H; i++) this.composeAt(i); }
  composeAt(i: number) {
    const p = this.paper[i];
    if (!p) { this.comp[i] = 0; return; }
    const a = this.art, st = this.state[i];
    if (!a || st === 0) { this.comp[i] = p; return; }
    const ink = a.ink[i];
    if (st === 1) {
      const c = this.cov[i];
      const keep = hash2(i, 3, 311) < clamp((c + 15) / 9);
      this.comp[i] = ink && keep ? mix(p, ink, 0.86) : p;
      return;
    }
    const col = a.color[i];
    // the paper's grain shows through the paint
    const pl = (R(p) * 0.3 + G(p) * 0.55 + BL(p) * 0.15) / 255;
    const k = 0.86 + clamp((pl - 0.62) / 0.3) * 0.16;
    let c = rgba(Math.min(255, R(col) * k), Math.min(255, G(col) * k), Math.min(255, BL(col) * k));
    if (st === 2) { c = mix(p, c, 0.5); if (ink) c = mix(c, ink, 0.55); this.comp[i] = c; return; }
    const cv = this.cov[i];
    if (cv < 3.5) {
      // a watercolour edge: the wash thins out, the pigment pools at the very rim
      c = mix(c, p, (1 - cv / 3.5) * 0.42);
      if (cv < 1) c = mix(c, rgba(R(col) * 0.62, G(col) * 0.62, BL(col) * 0.62), 0.5);
    }
    this.comp[i] = c;
  }
  /** 0 paper, 1 sketched, 3 coloured (at a map pixel) */
  stateAt(x: number, y: number) { x = Math.round(x); y = Math.round(y); return x < 0 || y < 0 || x >= W || y >= H ? 0 : this.state[y * W + x]; }
  covAt(x: number, y: number) { x = Math.round(x); y = Math.round(y); return x < 0 || y < 0 || x >= W || y >= H ? -60 : this.cov[y * W + x]; }
  /** bounds of everything coloured in (for "fit the explored land") */
  exploredBox(): [number, number, number, number] | null {
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (this.target[y * W + x] === 3) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : [x0, y0, x1, y1];
  }

  // ---------------------------------------------------------------- trails, lanes and marks (drawn every frame)
  /** the trails walked (worn paths in colour, pencil dashes in the sketch), the ways travelled, the sea lanes */
  setTrails(walked: { pts: [number, number][]; beach: boolean }[], ways: { pts: [number, number][]; kind: string }[], lanes: [number, number][][]) {
    const idx: number[] = [], cc: number[] = [], ci: number[] = [];
    const seen = new Set<number>();
    const put = (x: number, y: number, c: C, cInk: C) => {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = y * W + x;
      if (seen.has(i)) return;
      seen.add(i); idx.push(i); cc.push(c); ci.push(cInk);
    };
    const walk = (pts: [number, number][], fn: (x: number, y: number, s: number, dx: number, dy: number) => void) => {
      let s = 0;
      for (let k = 1; k < pts.length; k++) {
        const [ax, ay] = pts[k - 1], [bx, by] = pts[k];
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
        for (let j = 0; j < n; j++, s++) fn(ax + ((bx - ax) * j) / n, ay + ((by - ay) * j) / n, s, bx - ax, by - ay);
      }
    };
    const dirt = hex('#c8a86a'), dirtD = hex('#6e5432'), sand = hex('#a88a58');
    for (const t of walked) walk(t.pts, (x, y, s, dx, dy) => {
      if (t.beach) { if (s % 3 === 0) put(x, y + 1, sand, INK3); return; }
      put(x, y, dirt, s % 4 < 2 ? INK2 : 0);
      if (Math.abs(dx) > Math.abs(dy)) put(x, y + 1, dirtD, 0); else put(x + 1, y, dirtD, 0);
    });
    for (const wy of ways) walk(wy.pts, (x, y, s) => {
      const water = wy.kind === 'swim' || wy.kind === 'dive';
      if (s % 3 === 0) put(x, y, water ? hex('#a8e0f0') : hex('#e8d0a0'), water ? hex('#3a6a8a') : INK_RED);
      else if (s % 3 === 1 && !water) put(x, y, dirtD, 0);
    });
    this.trail = { i: Int32Array.from(idx), c: Uint32Array.from(cc), ci: Uint32Array.from(ci) };
    this.lanes = lanes.map(pts => { let len = 0; for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); return { pts, len }; });
  }
  setMarks(sketches: { s: PixelBuffer; x: number; y: number }[], marks: { kind: string; x: number; y: number }[]) {
    this.sketches = sketches.map(k => ({ s: fromBuf(k.s), x: Math.round(k.x - k.s.w / 2), y: Math.round(k.y - k.s.h / 2) }));
    this.marks = marks.map(m => ({ s: fromBuf(MARKS[m.kind] ?? MARKS.landmark), x: Math.round(m.x - 3), y: Math.round(m.y - 3) }));
  }

  // ---------------------------------------------------------------- the frame
  /** advance the clock (reveal, particles, flocks) */
  update(dt: number) {
    dt = Math.min(dt, 0.1);
    this.t += dt;
    this.stepReveal(dt);
    // particles
    for (const p of this.parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.kind !== 'spray') p.vx += dt * 0.6; }
    this.parts = this.parts.filter(p => p.age < p.life);
    SMOKES.forEach((e, k) => {
      if (this.stateAt(e.at[0], e.at[1]) !== 3) return;
      let acc = (this.emitT.get(k) ?? hash2(k, 1, 1)) + dt * e.rate;
      while (acc >= 1) {
        acc -= 1;
        const r = Math.random();
        const kind = e.kind;
        this.parts.push({
          x: e.at[0] + (r - 0.5) * (kind === 'spray' ? 6 : 1.5), y: e.at[1],
          vx: kind === 'spray' ? (Math.random() - 0.5) * 6 : 1.5 + Math.random() * 1.5, vy: kind === 'spray' ? -2 - Math.random() * 2 : -3.2 - Math.random() * 2,
          age: 0, life: kind === 'spray' ? 0.8 + Math.random() * 0.6 : kind === 'steam' ? 1.8 + Math.random() * 1.2 : 2.6 + Math.random() * 1.6, kind,
        });
      }
      this.emitT.set(k, acc);
    });
    for (const s of this.sparkles) s.age += dt;
    this.sparkles = this.sparkles.filter(s => s.age < 0.36);
    // a flock now and then, over somewhere coloured in
    this.flockT -= dt;
    if (this.flockT <= 0) {
      this.flockT = 7 + Math.random() * 9;
      const box = this.exploredBoxCached();
      if (box) {
        const tx = box[0] + Math.random() * (box[2] - box[0]), ty = box[1] + Math.random() * (box[3] - box[1]);
        const a = Math.random() * Math.PI * 2, sp = 14 + Math.random() * 8;
        this.flocks.push({ x: tx - Math.cos(a) * 90, y: ty - Math.sin(a) * 60, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, n: 4 + Math.floor(Math.random() * 5), age: 0, life: 12, dark: Math.random() < 0.6, seed: Math.random() * 1000 });
      }
    }
    for (const f of this.flocks) { f.age += dt; f.x += f.vx * dt; f.y += f.vy * dt; }
    this.flocks = this.flocks.filter(f => f.age < f.life);
  }
  private ebox: [number, number, number, number] | null = null;
  private eboxT = -10;
  private exploredBoxCached() { if (this.t - this.eboxT > 5) { this.ebox = this.exploredBox(); this.eboxT = this.t; } return this.ebox; }

  /** draw the window x0..x1, y0..y1 (map px) into the view canvas */
  render(x0: number, y0: number, x1: number, y1: number) {
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(W, Math.ceil(x1)); y1 = Math.min(H, Math.ceil(y1));
    if (x1 <= x0 || y1 <= y0) return;
    const px = this.px, comp = this.comp;
    for (let y = y0; y < y1; y++) px.set(comp.subarray(y * W + x0, y * W + x1), y * W + x0);
    const win = { x0, y0, x1, y1 };
    if (this.art) {
      this.fxWater(win);
      this.fxLand(win);
      this.fxTrails(win);
      this.fxMarks(win);
      this.fxLife(win);
      this.fxAir(win);
    }
    this.vctx.putImageData(this.frame, 0, 0, x0, y0, x1 - x0, y1 - y0);
  }

  // ---------------------------------------------------------------- effects
  private alive(i: number) { return this.state[i] === 3; }
  private inWin(i: number, w: { x0: number; y0: number; x1: number; y1: number }) { const x = i % W, y = (i / W) | 0; return x >= w.x0 && x < w.x1 && y >= w.y0 && y < w.y1; }
  private put(x: number, y: number, c: C, a = 1) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (this.state[i] !== 3) return;
    this.px[i] = a >= 1 ? c : mix(this.px[i], c, a);
  }
  private blit(s: Spr, x: number, y: number, a = 1, gate = true, flip = false) {
    x = Math.round(x); y = Math.round(y);
    for (let ly = 0; ly < s.h; ly++) {
      const gy = y + ly;
      if (gy < 0 || gy >= H) continue;
      for (let lx = 0; lx < s.w; lx++) {
        const c = s.d[ly * s.w + (flip ? s.w - 1 - lx : lx)];
        const ca = c >>> 24;
        if (!ca) continue;
        const gx = x + lx;
        if (gx < 0 || gx >= W) continue;
        const i = gy * W + gx;
        if (gate && this.state[i] !== 3) continue;
        const k = (ca / 255) * a;
        this.px[i] = k >= 0.99 ? c : mix(this.px[i], c | 0xff000000, k);
      }
    }
  }

  private fxWater(w: { x0: number; y0: number; x1: number; y1: number }) {
    const t = this.t, px = this.px, st = this.state;
    const foam = hex('#e6f2ee'), foam2 = hex('#b0d0d0');
    // surf rolling in: two fronts moving to the shore, broken by noise
    for (let f = 0; f < 2; f++) {
      const D = 12.5 - ((t * 2.1 + f * 6.2) % 12.5);
      const b = this.waves[Math.max(1, Math.floor(D))];
      if (!b) continue;
      const k = 0.25 + (1 - D / 12.5) * 0.55, tq = Math.floor(t * 0.8 + f * 3);
      for (let j = 0; j < b.length; j++) {
        const i = b[j];
        if (st[i] !== 3 || !this.inWin(i, w)) continue;
        if (hash2((i % W) >> 2, ((i / W) | 0) >> 1, tq) < 0.38) continue;
        px[i] = mix(px[i], foam, k);
      }
    }
    const shore = this.waves[1];
    if (shore) {
      const tq = Math.floor(t * 3);
      for (let j = 0; j < shore.length; j++) { const i = shore[j]; if (st[i] === 3 && hash2(i, tq, 5) > 0.55 && this.inWin(i, w)) px[i] = mix(px[i], foam, 0.6); }
    }
    // sparkles
    const a = this.art!;
    for (let k = 0; k < 26; k++) {
      const x = w.x0 + Math.floor(Math.random() * (w.x1 - w.x0)), y = w.y0 + Math.floor(Math.random() * (w.y1 - w.y0));
      const i = y * W + x;
      const wk = a.water[i];
      if ((wk === WK.sea && a.coast[i] > 4) || wk === WK.lake || wk === WK.river) { if (st[i] === 3) this.sparkles.push({ i, age: 0 }); }
    }
    for (const s of this.sparkles) {
      if (!this.inWin(s.i, w)) continue;
      const bright = s.age < 0.12 ? 0.55 : s.age < 0.24 ? 1 : 0.5;
      px[s.i] = mix(px[s.i], hex('#f4fcff'), bright);
      if (bright === 1) { const x = s.i % W; if (x > 0) px[s.i - 1] = mix(px[s.i - 1], foam2, 0.6); if (x < W - 1) px[s.i + 1] = mix(px[s.i + 1], foam2, 0.6); }
    }
    // rivers flowing: bright dashes travel downstream
    const sh = Math.floor(t * 9) % 24;
    for (let b = 0; b < 3; b++) {
      const l = this.rivers[(sh - b * 1 + 48) % 24];
      if (!l) continue;
      const k = b === 0 ? 0.5 : 0.3;
      for (let j = 0; j < l.length; j++) { const i = l[j]; if (st[i] === 3 && this.inWin(i, w)) px[i] = mix(px[i], hex('#a8d4e6'), k); }
    }
    // the falls
    for (let j = 0; j < this.falls.length; j++) {
      const i = this.falls[j];
      if (st[i] !== 3 || !this.inWin(i, w)) continue;
      const y = (i / W) | 0, x = i % W;
      px[i] = ((y - Math.floor(t * 16) + x * 2) & 3) === 0 ? hex('#ffffff') : ((y - Math.floor(t * 16)) & 3) === 2 ? hex('#a8cce0') : hex('#e2f0f6');
    }
    // sea lanes the Kitten has sailed: dashes crawling outward
    for (const ln of this.lanes) {
      let s = 0;
      const off = Math.floor(t * 5) % 7;
      for (let k = 1; k < ln.pts.length; k++) {
        const [ax, ay] = ln.pts[k - 1], [bx, by] = ln.pts[k];
        const n = Math.ceil(Math.hypot(bx - ax, by - ay));
        for (let j = 0; j < n; j++, s++) if ((s + 7 - off) % 7 < 2) this.put(ax + ((bx - ax) * j) / n, ay + ((by - ay) * j) / n, hex('#d8eef0'), 0.7);
      }
    }
  }

  private fxLand(w: { x0: number; y0: number; x1: number; y1: number }) {
    const t = this.t, px = this.px, st = this.state, comp = this.comp;
    // a gust sweeping over the canopy: highlights lean east by a pixel
    for (let g = 0; g < 2; g++) {
      const band = Math.floor(t * 5 + g * 32) % 64;
      for (let b = 0; b < 3; b++) {
        const l = this.gust[(band - b + 64) % 64];
        for (let j = 0; j < l.length; j++) {
          const i = l[j];
          if (st[i] !== 3 || st[i + 1] !== 3 || !this.inWin(i, w)) continue;
          px[i] = comp[i + 1]; px[i + 1] = comp[i];
        }
      }
    }
    // glowing fungi breathe; the crater flickers
    for (let j = 0; j < this.glow.length; j++) {
      const i = this.glow[j];
      if (st[i] !== 3 || !this.inWin(i, w)) continue;
      const lava = this.art!.tag[i] === TAG.lava;
      const ph = hash2(i, 1, 9) * 6.28;
      const k = lava ? 0.5 + 0.5 * Math.sin(t * 9 + ph) * Math.sin(t * 3.3 + ph) : 0.5 + 0.5 * Math.sin(t * 1.6 + ph);
      px[i] = lava ? mix(hex('#8a2a10'), hex('#ffc050'), k) : mix(hex('#0e3a40'), hex('#c4fff6'), k);
    }
  }

  private fxTrails(w: { x0: number; y0: number; x1: number; y1: number }) {
    const tr = this.trail, st = this.state, px = this.px;
    for (let j = 0; j < tr.i.length; j++) {
      const i = tr.i[j];
      if (!this.inWin(i, w)) continue;
      const s = st[i];
      if (s >= 2) px[i] = tr.c[j];
      else if (tr.ci[j]) px[i] = mix(px[i], tr.ci[j], 0.85);
    }
  }

  private fxMarks(w: { x0: number; y0: number; x1: number; y1: number }) {
    void w;
    for (const s of this.sketches) this.blit(s.s, s.x, s.y, 1, false);
    for (const m of this.marks) this.blit(m.s, m.x, m.y, 1, false);
  }

  private fxLife(w: { x0: number; y0: number; x1: number; y1: number }) {
    void w;
    const t = this.t, C0 = CRITTERS;
    const alive = (x: number, y: number) => this.stateAt(x, y) === 3;
    // seals: one lifts its head now and then
    C0.seals.forEach(([x, y], k) => { if (!alive(x, y)) return; const up = Math.sin(t * 0.9 + k * 2.1) > 0.82; this.blit(SP.seal[up ? 1 : 0], x - 2, y - 1, 1, true, k === 1); });
    { const [x, y] = C0.seals[0]; if (alive(x, y)) { const sx = x + 10 + Math.sin(t * 0.3) * 6, sy = y + 4; this.blit(SP.sealHead, sx, sy); this.put(sx - 1 - (Math.sin(t * 0.3) > 0 ? 1 : -1), sy + 1, hex('#d8eef0'), 0.6); } }
    // a whale surfaces, blows, swims a little and sounds
    {
      const cyc = 15, ph = t % cyc, k = Math.floor(t / cyc);
      const [bx, by] = C0.whale;
      const x = bx + (hash2(k, 1, 21) - 0.5) * 60 + ph * 1.6, y = by + (hash2(k, 2, 21) - 0.5) * 14;
      if (alive(x, y)) {
        if (ph < 5) { this.blit(SP.whaleBack[Math.floor(t * 2) % 2], x - 3, y - 1); this.put(x - 4, y + 1, hex('#d8eef0'), 0.6); this.put(x + 4, y + 1, hex('#d8eef0'), 0.6); }
        if (ph > 0.6 && ph < 3.4) for (let j = 0; j < 6; j++) { const u = ((ph - 0.6) * 3 + j * 0.35) % 2.2; this.put(x - 1 + Math.sin(j * 1.7) * u * 0.9, y - 2 - u * 2.6, hex('#f4fbff'), clamp(1 - u / 2.2) * 0.9); }
        if (ph >= 5 && ph < 6.4) this.blit(SP.fluke, x - 2, y - 3 + (ph - 5) * 1.5);
      }
    }
    // the Leviathan's shadow passing under the Deep
    {
      const p = C0.leviathan, u = (Math.sin(t * 0.05) + 1) / 2;
      const seg = u * (p.length - 1), k = Math.min(p.length - 2, Math.floor(seg)), f = seg - k;
      const x = p[k][0] + (p[k + 1][0] - p[k][0]) * f, y = p[k][1] + (p[k + 1][1] - p[k][1]) * f;
      for (let j = -22; j <= 22; j++) {
        const yy = y + Math.sin(j * 0.25 + t * 0.8) * 1.6;
        const r = Math.max(0, 2.4 - Math.abs(j) / 10);
        for (let q = -r; q <= r; q++) this.put(x + j, yy + q, hex('#050c14'), 0.32);
      }
    }
    // a fin cutting past the reef off the Serpent Coast
    {
      const ph = t % 20;
      if (ph < 8) {
        const p = C0.fin, u = ph / 8;
        const seg = u * (p.length - 1), k = Math.min(p.length - 2, Math.floor(seg)), f = seg - k;
        const x = p[k][0] + (p[k + 1][0] - p[k][0]) * f, y = p[k][1] + (p[k + 1][1] - p[k][1]) * f;
        if (alive(x, y)) { this.blit(SP.fin, x, y - 2); this.put(x - 1, y + 1, hex('#e8f4f4'), 0.6); this.put(x - 2, y + 1, hex('#e8f4f4'), 0.4); }
      }
    }
    // the tiger in its wallow: lazes, flicks its tail, gets up for a prowl
    {
      const [x, y] = C0.tiger;
      if (alive(x, y)) {
        const ph = t % 16;
        if (ph < 11) this.blit(SP.tiger[Math.floor(t * 1.5) % 2], x - 3, y - 2);
        else { const u = (ph - 11) / 5, a = u * Math.PI * 2; this.blit(SP.tiger[2], x - 3 + Math.cos(a) * 5, y - 2 + Math.sin(a) * 2.5, 1, true, Math.sin(a) > 0); }
      }
    }
    // an ironjaw drifting down the black water, a stork fishing
    {
      const p = C0.croc, u = (Math.sin(t * 0.07) + 1) / 2;
      const seg = u * (p.length - 1), k = Math.min(p.length - 2, Math.floor(seg)), f = seg - k;
      const x = p[k][0] + (p[k + 1][0] - p[k][0]) * f, y = p[k][1] + (p[k + 1][1] - p[k][1]) * f;
      if (alive(x, y)) { this.blit(SP.croc, x - 4, y - 1); this.put(x + 5, y, hex('#5a6a4a'), 0.6); this.put(x + 6, y + 1, hex('#5a6a4a'), 0.4); }
      const [sx, sy] = C0.stork;
      if (alive(sx, sy)) this.blit(SP.stork[Math.sin(t * 0.8) > 0.6 ? 1 : 0], sx - 1, sy - 4);
    }
    // bonefaces grazing in a fernwood clearing
    C0.bonefaces.forEach(([x, y], k) => { if (!alive(x, y)) return; const dx = Math.sin(t * 0.21 + k * 2) * 3; this.blit(SP.bone[Math.floor(t * 0.7 + k) % 2], x + dx - 1, y - 1, 1, true, Math.cos(t * 0.21 + k * 2) < 0); });
    // hawks wheeling over the hills, their shadows sliding over the tussock
    C0.hawks.forEach(([cx, cy, r], k) => {
      if (!alive(cx, cy)) return;
      const a = t * (0.6 + k * 0.15) + k * 2;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.6 - 6;
      this.blit(SP.hawkShadow, x - 2 + 8, y + 14, 0.22);
      this.blit(SP.hawk[Math.floor(t * 4 + k) % 2], x - 2, y - 1);
    });
    // gulls over the shore
    C0.gulls.forEach(([cx, cy], k) => {
      if (!alive(cx, cy)) return;
      const a = t * (0.5 + k * 0.13) + k * 1.7;
      this.blit(SP.gull[Math.floor(t * 5 + k) % 2], cx + Math.cos(a) * (12 + k * 4), cy + Math.sin(a * 1.3) * 5);
    });
    // auks round the falls; the seabird colony swirling over Motu Ahi
    { const [x, y] = C0.auks; if (alive(x, y)) for (let j = 0; j < 4; j++) { const a = t * 1.4 + j * 1.6; this.put(x + Math.cos(a) * (4 + j), y + Math.sin(a * 1.2) * 3, hex('#2a2a30')); } }
    { const [x, y] = C0.colony; if (alive(x, y)) for (let j = 0; j < 14; j++) { const a = t * (0.8 + (j % 3) * 0.3) + j * 0.9; this.put(x + Math.cos(a) * (9 + (j % 4) * 3), y - 4 + Math.sin(a * 1.4) * (5 + (j % 3)), j % 3 ? hex('#f4f2ea') : hex('#2a2a30')); } }
    // skyribbons gliding over the tableland
    { const x0 = 360, y0 = 240; if (alive(x0, y0)) { const ph = t % 9; if (ph < 3) { const u = ph / 3; this.blit(SP.ribbon[Math.floor(t * 6) % 2], x0 + u * 46, y0 - 6 + Math.sin(u * Math.PI) * -4 + u * 6); } } }
    // waka on the inlet and the river
    C0.waka.forEach((p, k) => {
      const u = (Math.sin(t * 0.06 + k * 2) + 1) / 2;
      const seg = u * (p.length - 1), q = Math.min(p.length - 2, Math.floor(seg)), f = seg - q;
      const x = p[q][0] + (p[q + 1][0] - p[q][0]) * f, y = p[q][1] + (p[q + 1][1] - p[q][1]) * f;
      if (!alive(x, y)) return;
      const back = Math.cos(t * 0.06 + k * 2) < 0;
      this.blit(SP.waka, x - 4, y - 1, 1, true, back);
      for (let j = 0; j < 3; j++) this.blit(SP.paddler[(Math.floor(t * 3) + j) % 2], x - 2 + j * 2, y - 2);
      if (Math.floor(t * 3) % 2) this.put(x + (back ? 5 : -5), y + 1, hex('#e0f0f0'), 0.7);
    });
    // the Kitten at her mooring off the camp beach
    if (boatReady() && !boatIsAway()) {
      const [x, y] = C0.kitten;
      if (alive(x, y)) { const bob = Math.sin(t * 2.2) > 0.3 ? 1 : 0; this.blit(SP.kitten[Math.floor(t * 0.8) % 2], x - 3, y - 6 + bob); this.put(x - 4, y + 1, hex('#d8eef0'), 0.5); this.put(x + 4, y + 1, hex('#d8eef0'), 0.5); }
    }
    // the camp's flag
    { const x = 165, y = 96; if (alive(x, y)) { for (let k = 0; k < 8; k++) this.put(x, y + k, hex('#5a4030')); this.blit(SP.flag[Math.floor(t * 6) % 3], x + 1, y); } }
    // flocks crossing
    for (const f of this.flocks) {
      const fade = clamp(Math.min(f.age, f.life - f.age) / 1.2);
      for (let j = 0; j < f.n; j++) {
        const side = j % 2 ? 1 : -1, rank = Math.ceil(j / 2);
        const len = Math.hypot(f.vx, f.vy) || 1, ux = f.vx / len, uy = f.vy / len;
        const x = f.x - ux * rank * 4 - uy * rank * 3 * side + Math.sin(f.seed + j) * 0.8, y = f.y - uy * rank * 4 + ux * rank * 3 * side;
        if (this.stateAt(x, y) !== 3) continue;
        this.blit((f.dark ? SP.bird : SP.gull)[Math.floor(this.t * 6 + j) % 2], x - 1, y - 1, fade);
      }
    }
  }

  private fxAir(w: { x0: number; y0: number; x1: number; y1: number }) {
    void w;
    const t = this.t;
    // smoke, steam, spray
    for (const p of this.parts) {
      const u = p.age / p.life;
      const a = (p.kind === 'spray' ? 0.75 : p.kind === 'steam' ? 0.62 : 0.55) * (1 - u);
      const c = p.kind === 'smoke' ? hex('#b4aca4') : p.kind === 'ash' ? hex('#6a6460') : p.kind === 'spray' ? hex('#e8f6fa') : hex('#f2f6f6');
      const r = p.kind === 'spray' ? 0 : u < 0.25 ? 0 : u < 0.6 ? 1 : 1.5;
      if (r === 0) this.put(p.x, p.y, c, a);
      else for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (Math.abs(dx) + Math.abs(dy) <= r) this.put(p.x + dx, p.y + dy, c, a * (dx || dy ? 0.7 : 1));
    }
    // mist drifting over the low wet places
    for (const m of this.mist) {
      const x = m.x + Math.sin(t * 0.05 * m.v + m.ph) * 10, y = m.y + Math.cos(t * 0.04 * m.v + m.ph) * 3;
      if (this.stateAt(x, y) !== 3) continue;
      const r = m.r;
      for (let dy = -r * 0.45; dy <= r * 0.45; dy++) for (let dx = -r; dx <= r; dx++) {
        const k = 1 - Math.hypot(dx / r, dy / (r * 0.45));
        if (k <= 0) continue;
        const gx = Math.round(x + dx), gy = Math.round(y + dy);
        if (((gx + gy) & 1) === 0 && k < 0.5) continue;
        this.put(gx, gy, hex('#e8eee8'), k * 0.32);
      }
    }
    // clouds, and their shadows on the ground below
    for (const c of this.clouds) {
      const x = ((c.x0 + t * c.v) % (W + 240)) - 120;
      this.cloud(c.s, x + 14, c.y + 18);
      this.cloud(c.c, x, c.y);
    }
  }
  private cloud(s: Spr, x: number, y: number) {
    x = Math.round(x); y = Math.round(y);
    for (let ly = 0; ly < s.h; ly++) {
      const gy = y + ly;
      if (gy < 0 || gy >= H) continue;
      for (let lx = 0; lx < s.w; lx++) {
        const c = s.d[ly * s.w + lx];
        const ca = c >>> 24;
        if (!ca) continue;
        const gx = x + lx;
        if (gx < 0 || gx >= W) continue;
        const i = gy * W + gx;
        if (this.state[i] !== 3) continue;
        const fade = clamp(this.cov[i] / 7);
        if (fade <= 0) continue;
        this.px[i] = mix(this.px[i], c | 0xff000000, (ca / 255) * fade);
      }
    }
  }
}

/** the species sketch, sepia ink on a scrap of paper pinned to the map */
export function sketchCard(ink: PixelBuffer): PixelBuffer {
  const w = ink.w + 4, h = ink.h + 5;
  const b = new PixelBuffer(w, h);
  const paper = hex('#f2e4c2'), edge = hex('#c8ae7c');
  for (let y = 1; y < h; y++) for (let x = 0; x < w - 1; x++) b.set(x, y, x === 0 || y === 1 || x === w - 2 || y === h - 1 ? edge : paper);
  for (let x = 1; x < w; x++) b.set(x, h, hex('#00000040'));
  b.blit(ink, 2, 3);
  b.set(Math.floor(w / 2), 0, INK_RED); b.set(Math.floor(w / 2), 1, hex('#e86a5a'));
  return b;
}
export { INK, INK2, INK3, B };
export const _artReady = () => !!mapArt();

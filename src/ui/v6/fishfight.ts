// V6 fishing fight close-up: once a fish is hooked the camera cuts under the stern. Full screen, no
// UI: a sliver of sky and the Kittiwake's hull above the waterline, the rod tip bending in from the
// top edge, and below it the sea, with light shafts, drifting specks, kelp and the dark hull and
// rudder. The hooked fish thrashes on the line (painted from the same design as fishCanvas, only big,
// shaded and inked). Hold to reel it up: it comes closer and grows as it rises. When it runs, keep
// reeling and the line strains: it shivers, flushes from white to red, the rod bows, the rod creaks,
// bubbles stream and the shot shakes, until it snaps. Ease off and it takes line instead. Land it
// at the surface.

import { openCloseup, CW, CH, rgb, hx, mixc, blend, add, ramp, dith, hash, R, G, B } from './closeup';
import { Hold, loop } from '../v4/mini';
import { audio } from '../../core/audio';
import type { FishDef, Temper } from '../v4/fishing';

export type FightEnd = 'caught' | 'snap' | 'lost' | 'cancel';

// ------------------------------------------------------------------ palettes
const INK = hx('#1a1014');
const SKY = ['#5ea4d2', '#78b6de', '#96cae8', '#b6dcf0', '#d6ecf6'].map(hx);
const FARSEA = ['#17507a', '#1f6590', '#2b7ea8', '#4498c0', '#6ab4d4'].map(hx);
const WATER = ['#040b1c', '#071430', '#0a1f46', '#10305e', '#174676', '#1f5e8e', '#2a78a6', '#3a92ba', '#52acca', '#72c6da'].map(hx);
const HULL = ['#4e4a46', '#7e776c', '#aaa292', '#cec8b6', '#e8e4d6', '#fbf9f0'].map(hx);
const BOOT = ['#5a1610', '#86241a', '#b23a20', '#d85a34'].map(hx);
const KELP = ['#10160a', '#1e2a12', '#2e3e18', '#465a20', '#62782a', '#84983a', '#a8b458'].map(hx);
const ROD = ['#0c1014', '#18242c', '#263846', '#3a5464', '#5e7e90', '#9cbccc', '#e0f0f6'].map(hx);
const ROCK = ['#0c1422', '#142034', '#1c2e46', '#284058', '#36546c'].map(hx);
const SAND = ['#1a2230', '#26303c', '#343c46', '#4a5058'].map(hx);
const SH = hx('#0a1428'), LT = hx('#fff6dc');

// ------------------------------------------------------------------ layout
const WL = 30; // the waterline
const RT0: [number, number] = [178, 15]; // rod tip at rest
const RB: [number, number] = [258, -26]; // rod butt (off the top edge)
const yOf = (dep: number) => WL + 24 + dep * 112;
/** the waterline's ripple (y) at column x */
const surfY = (x: number, t: number) => WL + Math.sin(x * 0.07 + t * 1.7) * 1.2 + Math.sin(x * 0.19 - t * 2.4) * 0.6;
/** underwater hull: the stern curves in under the counter, the keel runs down to the right */
const hullBot = (x: number) => x < 238 ? -1 : x < 272 ? WL + 36 * Math.sqrt((x - 238) / 34) : WL + 36 + (x - 272) * 0.14;
const hullTop = (y: number) => 238 - (WL - y) * 0.32; // above water: the transom rakes aft

// ------------------------------------------------------------------ small helpers
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const frac = (v: number) => v - Math.floor(v);
/** smooth colour from a ramp (no dithering), for fog */
function rampS(r: number[], t: number) {
  const f = clamp01(t) * (r.length - 1), i = Math.min(r.length - 2, Math.floor(f));
  return mixc(r[i], r[i + 1], f - i);
}
const waterLit = (x: number, y: number) => 0.97 - (y - WL) / (CH - WL) * 1.05 + Math.exp(-(((x - 120) / 120) ** 2)) * 0.08 * clamp01(1 - (y - WL) / 70) - x / CW * 0.04;
const WCOL: number[] = [];
for (let y = 0; y < CH + 40; y++) WCOL[y] = rampS(WATER, waterLit(160, Math.max(WL, y)));
const wcol = (y: number) => WCOL[Math.max(0, Math.min(CH + 39, y | 0))];
const shadeRamp = (c: number) => [mixc(c, SH, 0.66), mixc(c, SH, 0.44), mixc(c, SH, 0.22), c, mixc(c, LT, 0.26), mixc(c, LT, 0.52)];

// ------------------------------------------------------------------ an inked sprite layer (draw, then composite with a 1px ink outline)
const LAY = new Uint32Array(CW * CH), MSK = new Uint8Array(CW * CH);
let lx0 = CW, ly0 = CH, lx1 = -1, ly1 = -1;
function layPut(x: number, y: number, c: number) {
  x |= 0; y |= 0;
  if (x < 1 || y < 1 || x >= CW - 1 || y >= CH - 1) return;
  const i = y * CW + x;
  LAY[i] = c; MSK[i] = 1;
  if (x < lx0) lx0 = x; if (x > lx1) lx1 = x; if (y < ly0) ly0 = y; if (y > ly1) ly1 = y;
}
/** composite the layer into buf; fog > 0 mixes it toward the water colour at each row */
function layFlush(buf: Uint32Array, fog = 0, ink = INK) {
  if (lx1 < 0) return;
  for (let y = Math.max(1, ly0 - 1); y <= Math.min(CH - 2, ly1 + 1); y++) for (let x = Math.max(1, lx0 - 1); x <= Math.min(CW - 2, lx1 + 1); x++) {
    const i = y * CW + x;
    let c: number;
    if (MSK[i]) c = LAY[i];
    else if (MSK[i - 1] || MSK[i + 1] || MSK[i - CW] || MSK[i + CW]) c = ink;
    else continue;
    buf[i] = fog > 0 ? mixc(c, wcol(y), fog) : c;
  }
  for (let y = ly0; y <= ly1; y++) MSK.fill(0, y * CW + lx0, y * CW + lx1 + 1);
  lx0 = CW; ly0 = CH; lx1 = -1; ly1 = -1;
}

// ------------------------------------------------------------------ the fish, painted from the fishCanvas design at any size
export interface FishGeo { W: number; H: number; cx: number; cy: number; rx: number; ry: number; tail: number; xm: number; xe: number }
export function fishGeo(f: FishDef): FishGeo {
  const W = f.shape === 'moon' ? 30 : f.shape === 'long' ? 32 : 26, H = f.shape === 'moon' ? 22 : f.shape === 'flat' ? 18 : 14;
  const cx = W * 0.44, cy = H / 2;
  const rx = W * (f.shape === 'long' ? 0.42 : 0.36), ry = H * (f.shape === 'moon' ? 0.44 : f.shape === 'flat' ? 0.42 : 0.36);
  const tail = (f.shape === 'moon' ? 0.6 : 1) * 6.4;
  return { W, H, cx, cy, rx, ry, tail, xm: cx + rx, xe: cx - rx * 1.1 - tail };
}
interface FishPal { back: number[]; side: number[]; belly: number[]; fin: number[]; iris: number; spot: number }
function fishPal(f: FishDef): FishPal {
  const [dark, mid, belly] = f.cols.map(hx);
  const fin = f.id === 'opah' ? hx('#d8303a') : f.id === 'tarakihi' ? hx('#3a3440') : f.id === 'gurnard' ? hx('#c8402e') : mixc(dark, mid, 0.35);
  return {
    back: shadeRamp(dark), side: shadeRamp(mid), belly: shadeRamp(belly), fin: shadeRamp(fin),
    iris: hx(f.id === 'opah' || f.id === 'snapper' ? '#e8c050' : f.id === 'bluecod' ? '#6ac088' : f.id === 'johndory' ? '#d8b040' : '#c8a060'),
    spot: hx(f.id === 'snapper' ? '#5ad0f4' : f.id === 'opah' ? '#fff4f4' : f.id === 'kahawai' ? '#1e3a30' : '#1a1014'),
  };
}
function bodyH(g: FishGeo, u: number) {
  if (u > 1 || u < -1.15) return 0;
  const e = Math.sqrt(Math.max(0, 1 - u * u)) * g.ry * (1 + 0.1 * u);
  return u < -0.5 ? Math.max(e, g.ry * 0.25) : e;
}

/** one fish pixel at base-grid coords (x, y); 0 = empty. detail adds scales, fin rays, glints. */
function fishPixel(f: FishDef, g: FishGeo, P: FishPal, x: number, y: number, sx: number, sy: number, fin: number, detail: boolean): number {
  const { cx, cy, rx, ry } = g;
  const u = (x - cx) / rx, dy = y - cy;
  const hb = bodyH(g, u);
  const dth = dith(sx, sy) - 0.5;
  // the eye sits on top of everything
  const big = f.id === 'johndory' || f.id === 'opah' || f.id === 'bluecod';
  const ex = cx + rx * 0.62, ey = cy - ry * 0.25, er = Math.max(0.8, ry * 0.2) * (big ? 1.25 : 1);
  const de = Math.hypot(x - ex, y - ey);
  if (de < er) {
    if (de > er * 0.8) return mixc(P.side[0], INK, 0.5);
    const hl = Math.hypot(x - (ex - er * 0.28), y - (ey - er * 0.3));
    if (hl < er * 0.24) return hx('#ffffff');
    if (de < er * 0.46) return Math.hypot(x - (ex + er * 0.2), y - (ey + er * 0.22)) < er * 0.14 ? hx('#6a8a9a') : hx('#0a0608');
    return mixc(P.iris, INK, clamp01((y - ey) / er * 0.5 + 0.2));
  }
  // pectoral fin, over the body side, fanning with the stroke
  if (detail || f.id === 'gurnard') {
    const wing = f.id === 'gurnard';
    const pxv = cx + rx * (wing ? 0.3 : 0.36), pyv = cy + ry * (wing ? 0.3 : 0.18);
    const a = Math.PI - (wing ? 0.55 : 0.32) + fin * (wing ? 0.35 : 0.3);
    const qx = x - pxv, qy = y - pyv;
    const al = qx * Math.cos(a) + qy * Math.sin(a), pp = -qx * Math.sin(a) + qy * Math.cos(a);
    const L = rx * (wing ? 0.62 : 0.4);
    if (al > 0 && al < L) {
      const w = ry * (wing ? 0.5 : 0.24) * Math.pow(Math.sin(Math.PI * Math.min(1, al / L * 0.85 + 0.08)), 0.7);
      if (Math.abs(pp) < w) {
        const ray = frac(Math.atan2(pp, al + 0.8) * 4.2) < 0.28;
        if (wing) return al > L * 0.8 || (ray && al > L * 0.5) ? hx('#6ad0ff') : ramp([hx('#1e5a58'), hx('#2e8074'), hx('#46a890')], 0.6 - pp / w * 0.3, sx, sy);
        return ramp(P.fin, 0.62 - al / L * 0.2 + (ray ? -0.18 : 0) + (al > L * 0.75 ? 0.16 : 0), sx, sy);
      }
    }
  }
  if (hb > 0 && Math.abs(dy) < hb) {
    const vn = dy / hb;
    const zone = vn < -0.3 + dth * 0.16 ? P.back : vn > 0.34 + dth * 0.16 ? P.belly : P.side;
    let lit = 0.6 - vn * 0.3 + Math.sqrt(1 - vn * vn) * 0.14 + u * 0.05;
    if (Math.abs(vn) > 0.86) lit -= 0.2;
    // gill cover and its lit edge
    const gx = cx + rx * (0.46 - 0.1 * vn * vn);
    if (Math.abs(vn) < 0.84) { if (Math.abs(x - gx) < 0.24) lit -= 0.26; else if (x > gx + 0.24 && x < gx + 0.55) lit += 0.08; }
    // mouth
    if (u > 0.84 && Math.abs(dy - ry * 0.14) < 0.2) return mixc(zone[0], INK, 0.4);
    if (detail) {
      // scales: a fine diamond lattice behind the gill, a lateral line and a wet glint along the back
      if (u < 0.44 && vn < 0.6) { const d1 = frac((x + y) * 0.95), d2 = frac((x - y) * 0.95); if (Math.min(d1, d2) < 0.13) lit -= 0.08; }
      if (u < 0.45 && u > -0.95 && Math.abs(dy - hb * (-0.1 + u * 0.08)) < 0.16) lit += 0.12;
      if (vn > -0.74 && vn < -0.5 && u > -0.4 && u < 0.5) lit += 0.22;
      if (vn > -0.66 && vn < -0.6 && u > -0.1 && u < 0.3 && hash(sx, sy) < 0.5) return LT;
    }
    let c = ramp(zone, lit, sx, sy);
    // species markings
    const cell = (k: number) => { const X = Math.floor(x * k), Y = Math.floor(y * k); return { h: hash(X, Y, 3), ox: X / k + hash(X, Y, 5) / k, oy: Y / k + hash(X, Y, 7) / k }; };
    if (f.id === 'snapper' && vn < 0.36 && u < 0.7) { const q = cell(0.8); if (q.h < 0.35 && Math.hypot(x - q.ox, y - q.oy) < 0.36) c = Math.hypot(x - q.ox + 0.12, y - q.oy + 0.12) < 0.14 && detail ? hx('#dff8ff') : P.spot; }
    if (f.id === 'opah' && vn < 0.5) { const q = cell(0.7); if (q.h < 0.4 && Math.hypot(x - q.ox, y - q.oy) < 0.4) c = mixc(P.spot, c, 0.15); }
    if (f.id === 'kahawai' && vn < -0.05 && u < 0.5) { const q = cell(0.9); if (q.h < 0.3 && Math.hypot(x - q.ox, y - q.oy) < 0.3) c = mixc(P.spot, c, 0.2); }
    if (f.id === 'bluecod' && vn < 0.3) { const m = Math.sin(x * 0.9 + Math.sin(y * 1.3) * 1.5) * Math.sin(y * 1.1 - x * 0.4); if (m > 0.45) c = ramp(P.back, lit - 0.1, sx, sy); }
    if (f.id === 'tarakihi' && vn < 0.12 && Math.abs(u - 0.28 + vn * 0.1) < 0.1) c = ramp(shadeRamp(hx('#241e2a')), lit, sx, sy);
    if (f.id === 'johndory') {
      const d = Math.hypot(x - cx, y - cy);
      if (d < ry * 0.22) c = ramp(shadeRamp(hx('#1e1a20')), lit, sx, sy); else if (d < ry * 0.32) c = mixc(c, LT, 0.35);
      else if (detail && Math.abs(Math.sin(x * 1.2 + Math.sin(y * 0.9) * 2)) < 0.08) c = mixc(c, hx('#a89060'), 0.4);
    }
    if (f.id === 'maomao' && detail && vn < 0 && Math.abs(Math.sin(x * 2.1 - y * 1.4)) < 0.1) c = mixc(c, hx('#bfe4ff'), 0.4);
    return c;
  }
  // tail fin: a forked fan off the wrist, rays radiating from it
  const xt0 = cx - rx * 1.08;
  if (x < xt0 + 0.8 && x > xt0 - g.tail) {
    const w = clamp01((xt0 - x) / g.tail);
    const th = ry * (0.26 + w * (f.shape === 'moon' ? 0.8 : 0.98));
    const a = Math.abs(dy);
    if (a < th && !(w > 0.46 && a < (w - 0.46) * ry * 1.3)) {
      const ray = detail && frac(Math.atan2(dy, xt0 + 1.6 - x) * 3.8) < 0.3;
      return ramp(P.fin, 0.55 - dy / th * 0.2 + (w > 0.82 ? 0.2 : 0) + (ray ? -0.2 : 0), sx, sy);
    }
  }
  // dorsal fin along the back (spiny on the long, fast fish), anal and pelvic fins below
  const top = -hb, bot = hb;
  if (u > -0.56 && u < 0.36) {
    const s = (u + 0.56) / 0.92;
    const spiny = f.shape === 'long' || f.id === 'johndory' || f.id === 'gurnard';
    const fh = ry * (f.shape === 'moon' ? 0.75 : 0.5) * Math.pow(Math.sin(Math.PI * Math.pow(s, f.shape === 'moon' ? 0.6 : 1)), 0.65) * (spiny ? 0.7 + 0.3 * Math.abs(Math.sin(s * 20)) : 1);
    if (dy < top + 0.4 && dy > top - fh) {
      const ray = detail && frac(x * 1.1) < 0.28;
      return ramp(P.fin, 0.62 + (dy < top - fh * 0.7 ? 0.18 : 0) + (ray ? -0.2 : 0), sx, sy);
    }
  }
  if (u > -0.8 && u < -0.3) {
    const s = (u + 0.8) / 0.5, fh = ry * 0.34 * Math.pow(Math.sin(Math.PI * s), 0.7);
    if (dy > bot - 0.4 && dy < bot + fh) return ramp(P.fin, 0.45 + (frac(x * 1.1) < 0.28 && detail ? -0.18 : 0), sx, sy);
  }
  if (u > 0.04 && u < 0.34) {
    const s = (u - 0.04) / 0.3, fh = ry * 0.34 * Math.min(1, (1 - s) * 2.2) * Math.min(1, s * 3);
    if (dy > bot - 0.4 && dy < bot + fh) return ramp(P.fin, 0.5, sx, sy);
  }
  // the gurnard's walking "fingers" under its chin
  if (f.id === 'gurnard' && u > 0.42 && u < 0.72 && dy > bot - 0.2 && dy < bot + 1.5 && frac(x * 0.9) < 0.35) return hx('#f07050');
  return 0;
}

interface FishPose { mx: number; my: number; pitch: number; face: number; S: number; bend: number; ph: number; fin: number; fog: number }
/** draw the fish hanging from its mouth at (mx, my) */
function drawFish(buf: Uint32Array, f: FishDef, g: FishGeo, P: FishPal, q: FishPose) {
  const sf = q.face >= 0 ? 1 : -1, wk = Math.max(0.14, Math.abs(q.face));
  const ca = Math.cos(q.pitch), sa = Math.sin(q.pitch);
  const Fx = sf * ca, Fy = sa, Nx = -sf * sa, Ny = ca;
  const L = g.xm - g.xe;
  let x0 = CW, x1 = 0, y0 = CH, y1 = 0;
  for (const bx of [g.xe - 1, g.xm + 1]) for (const by of [g.cy - g.ry * 1.8 - 1, g.cy + g.ry * 1.7 + 1]) {
    const X = q.mx + Fx * (bx - g.xm) * q.S * wk + Nx * (by - g.cy) * q.S, Y = q.my + Fy * (bx - g.xm) * q.S * wk + Ny * (by - g.cy) * q.S;
    x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
  }
  const m = q.bend * q.S + 2;
  const X0 = Math.max(1, Math.floor(x0 - m)), X1 = Math.min(CW - 2, Math.ceil(x1 + m)), Y0 = Math.max(1, Math.floor(y0 - m)), Y1 = Math.min(CH - 2, Math.ceil(y1 + m));
  const detail = q.S > 1.6;
  for (let py = Y0; py <= Y1; py++) for (let px = X0; px <= X1; px++) {
    const dx = px + 0.5 - q.mx, dy = py + 0.5 - q.my;
    const x = g.xm + (dx * Fx + dy * Fy) / (q.S * wk);
    const back = (g.xm - x) / L;
    if (back < -0.06 || back > 1.04) continue;
    const y = g.cy + (dx * Nx + dy * Ny) / q.S - q.bend * Math.sin(q.ph - back * 3.4) * back * back;
    const c = fishPixel(f, g, P, x, y, px, py, q.fin, detail);
    if (c) layPut(px, py, c);
  }
  layFlush(buf, q.fog, mixc(INK, hx('#0a1830'), q.fog * 0.6));
}

/** a small shaded sprite of the fish (facing right), for Mori to hold up in the world */
export function fishSprite(f: FishDef, targetW: number, ph = 0): { w: number; h: number; px: Uint32Array } {
  const g = fishGeo(f), P = fishPal(f);
  const L = g.xm - g.xe, S = targetW / L;
  const top = g.cy - g.ry * 1.6, hgt = g.ry * 3.2;
  const w = Math.ceil(targetW) + 2, h = Math.ceil(hgt * S) + 2;
  const src = new Uint32Array(w * h);
  for (let py = 1; py < h - 1; py++) for (let px = 1; px < w - 1; px++) {
    const x = g.xe + (px - 1 + 0.5) / S;
    const back = (g.xm - x) / L;
    const y = top + (py - 1 + 0.5) / S - Math.sin(ph - back * 3.4) * back * back * 0.8;
    const c = fishPixel(f, g, P, x, y, px, py, 0, false);
    if (c) src[py * w + px] = c;
  }
  // the eye always reads, however small
  const ex = Math.round(1 + (g.cx + g.rx * 0.62 - g.xe) * S - 0.5), ey = Math.round(1 + (g.cy - g.ry * 0.25 - top) * S - 0.5);
  if (ex > 0 && ey > 0 && ex < w && ey < h && src[ey * w + ex]) { src[ey * w + ex] = hx('#0a0608'); if (src[ey * w + ex - 1]) src[ey * w + ex - 1] = hx('#ffffff'); }
  const out = src.slice();
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] !== 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!op(x, y) && (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1))) out[y * w + x] = INK;
  return { w, h, px: out };
}

// ------------------------------------------------------------------ static background: sky, hull, water, seabed, far kelp
interface Base { base: Uint32Array; air: Uint32Array; hullM: Uint8Array; bedY: Float32Array }
let cached: Base | null = null;
function paintBase(): Base {
  if (cached) return cached;
  const b = new Uint32Array(CW * CH), air = new Uint32Array(CW * CH), hullM = new Uint8Array(CW * CH), bedY = new Float32Array(CW);
  // sky and the far sea, seen from right at the waterline
  for (let y = 0; y < WL + 5; y++) for (let x = 0; x < CW; x++) {
    let c: number;
    if (y < 21) {
      c = ramp(SKY, 0.1 + y / 21 * 0.9 - x / CW * 0.08, x, y);
      // a bank of cloud low over the horizon
      const cl = Math.sin(x * 0.05 + 1) * 2.2 + Math.sin(x * 0.13) * 1.2 + 15;
      if (y > cl) c = mixc(c, hx('#f4f8fa'), y > cl + 1.5 ? 0.55 : 0.8);
    } else {
      const k = (y - 21) / (WL + 5 - 21);
      c = ramp(FARSEA, 0.75 - k * 0.8 + Math.sin(x * 0.4 + y * 2) * 0.06, x, y);
      if (y === 21) c = hx('#c8e4ee');
      if (hash(x >> 1, y, 9) < 0.05 && y < WL - 1) c = hx('#e6f6fa');
    }
    air[y * CW + x] = c;
  }
  // water
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    b[y * CW + x] = y < WL - 3 ? air[y * CW + x] : ramp(WATER, waterLit(x, Math.max(WL, y)), x, y);
  }
  // seabed: sand with rock outcrops, lost in the blue
  for (let x = 0; x < CW; x++) {
    let yb = 166 + Math.sin(x * 0.045 + 1) * 4 + Math.sin(x * 0.12) * 2;
    for (const [rx0, rw, rh] of [[58, 34, 16], [214, 26, 11], [298, 30, 22], [140, 16, 6]]) { const d = (x - rx0) / rw; if (Math.abs(d) < 1) yb = Math.min(yb, 168 - rh * Math.sqrt(1 - d * d) * (0.9 + hash(x >> 2, 4) * 0.1)); }
    bedY[x] = yb;
    for (let y = Math.floor(yb); y < CH; y++) {
      const rock = yb < 162;
      const lit = 0.75 - (y - yb) / 14 + (hash(x >> 1, y >> 1, 2) - 0.5) * 0.2;
      const c = rock ? ramp(ROCK, lit, x, y) : ramp(SAND, lit - 0.1, x, y);
      b[y * CW + x] = mixc(c, wcol(y), 0.45);
      if (y === Math.floor(yb)) b[y * CW + x] = mixc(rock ? ROCK[4] : SAND[3], wcol(y), 0.35);
    }
  }
  // far kelp: tall fronds swaying from the rocks, hazy with distance
  const farKelp = [[22, 96, 0.62], [64, 70, 0.52], [100, 112, 0.66], [150, 60, 0.56], [206, 88, 0.6], [230, 118, 0.7], [290, 76, 0.54], [120, 48, 0.72], [176, 80, 0.74]];
  for (let i = 0; i < farKelp.length; i++) {
    const [kx, kh, fog] = farKelp[i];
    const y0 = bedY[kx] + 1, y1 = y0 - kh;
    const stemX = (y: number) => kx + Math.sin(y * 0.05 + i * 1.7) * 4 * ((y0 - y) / kh) + ((y0 - y) / kh) ** 2 * 6;
    for (let y = y0; y > y1; y -= 0.5) {
      const sx = stemX(y);
      for (let q = -0.6; q <= 0.6; q += 0.5) { const X = Math.round(sx + q), Y = Math.round(y); if (X >= 0 && X < CW) b[Y * CW + X] = mixc(q < 0 ? KELP[4] : KELP[3], wcol(Y), fog); }
    }
    // blades trail off the stem with the current, irregularly spaced
    for (let yb = y0 - 5, n = 0; yb > y1 + 2; yb -= 6 + hash(i, n, 3) * 7, n++) {
      const side = hash(i, n, 5) < 0.62 ? 1 : -1, len = 6 + hash(i, n, 7) * 6, ang = 0.5 + hash(i, n, 9) * 0.5;
      const sx = stemX(yb);
      for (let s = 0; s < len; s += 0.5) {
        const bw = 1.7 * Math.sin(Math.PI * Math.min(1, s / len * 0.9 + 0.1));
        const cx = sx + side * s * Math.cos(ang), cy = yb - s * Math.sin(ang) + (s / len) ** 2 * 2.5;
        for (let w = -bw; w <= bw; w += 0.5) {
          const X = Math.round(cx), Y = Math.round(cy + w);
          if (X >= 0 && X < CW && Y > 0 && Y < CH) b[Y * CW + X] = mixc(w < -0.6 ? KELP[5] : w > 0.8 ? KELP[2] : KELP[4], wcol(Y), fog + 0.03);
        }
      }
    }
  }
  // the hull above the water: cream topsides lit from above, red boot stripe, a porthole
  for (let y = 0; y < WL; y++) for (let x = Math.floor(hullTop(y)); x < CW; x++) {
    const e = x - hullTop(y);
    let c = ramp(HULL, 0.72 - y / WL * 0.2 - (x - 238) / 90 * 0.18 + (e < 2 ? 0.16 : 0) + Math.sin(x * 0.9) * 0.02, x, y);
    if (y >= 2 && y <= 3) c = y === 2 ? hx('#8a5a36') : hx('#5a3620');
    if (y >= WL - 7 && y < WL - 3) c = ramp(BOOT, 0.7 - (y - (WL - 7)) * 0.12 - (x - 238) / 120 * 0.2, x, y);
    if (y >= WL - 3) c = mixc(ramp(HULL, 0.3, x, y), hx('#3a4a3a'), 0.5);
    const pd = Math.hypot(x + 0.5 - 292, y + 0.5 - 13);
    if (pd < 5.5) c = pd > 4.3 ? ramp(['#4a3418', '#8a6a2a', '#c8a048', '#f0d890'].map(hx), 0.6 - (y - 13) / 8, x, y) : ramp(['#1a3a52', '#2e5a78', '#6a9ab8'].map(hx), 0.5 - (y - 11) / 6, x, y);
    if (e < 1) c = INK;
    const i = y * CW + x;
    b[i] = c; air[i] = c; hullM[i] = 1;
  }
  // the hull under the water: antifouling fading into a dark silhouette, the rudder and the prop
  const put2 = (x: number, y: number, c: number) => { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < CW && y < CH) { const i = y * CW + x; b[i] = c; air[i] = c; hullM[i] = 1; } };
  for (let x = 238; x < CW; x++) {
    const yb = hullBot(x);
    for (let y = WL - 3; y <= yb; y++) {
      const k = (y - WL) / 60;
      const edge = yb - y < 1.2;
      let c = mixc(ramp(BOOT, 0.4 - k * 1.4 + (hash(x >> 1, y >> 1) - 0.5) * 0.12, x, y), wcol(y), 0.42 + k * 0.6);
      c = mixc(c, hx('#0a1426'), clamp01(k * 1.6));
      if (edge) c = mixc(hx('#4a8aa8'), wcol(y), 0.35);
      if (hash(x, y, 11) < 0.02) c = mixc(c, hx('#c8d8d0'), 0.3); // barnacles
      put2(x, y, c);
    }
  }
  // weed and a fringe of growth trailing from the hull's belly
  for (let x = 240; x < CW; x++) {
    if (hash(x, 5) > 0.34) continue;
    const yb = hullBot(x), len = 2 + hash(x, 6) * 6;
    for (let k = 1; k <= len; k++) put2(x + Math.round(Math.sin(k * 0.7 + x) * 0.6), yb + k, mixc(k < 2 ? KELP[4] : KELP[3], wcol(yb + k), 0.35 + k / len * 0.3));
  }
  for (let y = WL + 6; y < WL + 50; y++) {
    const r = y > WL + 44 ? Math.sqrt(1 - ((y - WL - 44) / 6) ** 2) : 1;
    for (let x = 241; x < 241 + 9 * r; x++) put2(x, y, x < 242 ? mixc(hx('#3a6a88'), wcol(y), 0.4) : mixc(hx('#0c1626'), wcol(y), 0.3 + (y - WL) / 180));
    put2(240, y, INK);
  }
  for (let x = 252; x < 280; x++) put2(x, WL + 32 - (x - 252) * 0.25, mixc(hx('#1a2a38'), wcol(WL + 32), 0.3));
  const PXc = 256, PYc = WL + 33;
  for (let a = 0; a < 3; a++) {
    const ang = a * 2.094 + 0.5;
    for (let r = 2; r < 9; r++) for (let w = -2.2; w <= 2.2; w += 0.5) {
      const ww = w * Math.sin(Math.PI * r / 9);
      const X = PXc + Math.cos(ang) * r - Math.sin(ang) * ww * 0.7, Y = PYc + Math.sin(ang) * r * 1.3 + Math.cos(ang) * ww * 0.7;
      put2(X, Y, mixc(ramp(['#3a2a14', '#6a5220', '#9a7a34'].map(hx), 0.5 - w * 0.2, X | 0, Y | 0), wcol(Y), 0.45));
    }
  }
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y < 10) put2(PXc + x, PYc + y, mixc(hx(x + y < 0 ? '#b0904a' : '#5a4420'), wcol(PYc), 0.4));
  cached = { base: b, air, hullM, bedY };
  return cached;
}

// ------------------------------------------------------------------ vignette
const VIG = new Float32Array(CW * CH);
for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
  const d = ((x - CW / 2) / (CW * 0.6)) ** 2 + ((y - CH * 0.46) / (CH * 0.62)) ** 2;
  VIG[y * CW + x] = d > 0.45 ? Math.min(0.62, (d - 0.45) * 0.9) : 0;
}

// ------------------------------------------------------------------ the fight
interface Bub { x: number; y: number; r: number; vx: number; life: number }
interface Drop { x: number; y: number; vx: number; vy: number; life: number }

export async function runFishFight(fish: FishDef, hold: Hold, o: { cancelled(): boolean; caughtSub: string; dep0?: number }): Promise<FightEnd> {
  const cu = openCloseup();
  const { base, air, hullM, bedY } = paintBase();
  const buf = cu.buf;
  const work = new Uint32Array(CW * CH);
  const g = fishGeo(fish), P = fishPal(fish);
  const d = fish.diff / 100;
  const Smin = 1.7, Smax = Math.min(4.6, 142 / (g.xm - g.xe));
  hold.hit();
  cu.hint('Hold <span class="key">Space</span> to reel in · ease off when it runs', 4600);

  // fight state
  let dep = o.dep0 ?? 0.78, ten = 0.3, rodT = 0.3, rodV = 0;
  let run = 0, tele = 0, runDir = 1, runPow = 0, kind: Temper = 'smooth';
  let nextRun = 1.6 + Math.random() * 1.4 - d;
  let mx = 150, my = yOf(dep), tx = 150, face = -1, pitch = -0.5, ph = 0, bend = 1, finT = 0;
  let end: FightEnd | null = null, endT = 0, snapY = 0;
  let coached = false, reelSfx = 0, creakSfx = 0, kick = 0, hookT = 0.6;
  const bubbles: Bub[] = [], drops: Drop[] = [];
  const specks = Array.from({ length: 70 }, (_, i) => ({ x: hash(i, 1) * CW, y: WL + hash(i, 2) * (CH - WL), z: hash(i, 3) }));
  const school = Array.from({ length: 9 }, (_, i) => ({ x: 40 + i * 9 + hash(i, 4) * 8, y: 92 + hash(i, 5) * 14, p: hash(i, 6) * 6 }));
  const bubble = (x: number, y: number, n: number, spread = 3) => { for (let i = 0; i < n; i++) bubbles.push({ x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread, r: Math.random() < 0.3 ? 2 : Math.random() < 0.6 ? 1 : 0.5, vx: (Math.random() - 0.5) * 8, life: 3 }); };
  const splash = (x: number, n: number, pow = 1) => { for (let i = 0; i < n; i++) drops.push({ x: x + (Math.random() - 0.5) * 16 * pow, y: WL - 1, vx: (Math.random() - 0.5) * 60 * pow, vy: -30 - Math.random() * 70 * pow, life: 1.2 }); };
  const finish = (e: FightEnd, word: string, sub: string, bad: boolean) => {
    end = e; endT = 0;
    if (e !== 'cancel') cu.result(word, sub, bad).then(() => cu.close());
  };

  const result = await new Promise<FightEnd>(done => {
    loop((dt, t) => {
      if (!end && o.cancelled()) { end = 'cancel'; cu.close().then(() => done('cancel')); return false; }
      if (cu.closed) { if (end !== 'cancel') done(end ?? 'lost'); return false; }
      const holding = hold.down && !end;
      hookT = Math.max(0, hookT - dt);
      // ------------------------------------------------------ the fish's temper: pauses, a tell, then a run
      if (!end) {
        if (run <= 0 && tele <= 0) {
          nextRun -= dt;
          if (nextRun <= 0) {
            kind = fish.temper === 'mixed' ? (['smooth', 'dart', 'sinker', 'floater'] as Temper[])[Math.floor(Math.random() * 4)] : fish.temper;
            tele = kind === 'dart' ? 0.38 : 0.5;
            runDir = mx < 110 ? 1 : mx > 220 ? -1 : Math.random() < 0.5 ? -1 : 1;
            runPow = (0.45 + d * 0.8) * (kind === 'dart' ? 1.12 : kind === 'floater' ? 0.8 : kind === 'smooth' ? 0.9 : 1) * (0.85 + Math.random() * 0.3);
            bubble(mx, my, 6, 6);
            audio.play('splash', { vol: 0.18, pitch: 0.6 });
          }
        }
        if (tele > 0) {
          tele -= dt;
          if (tele <= 0) { run = (0.8 + d * 1.1 + Math.random() * 0.8) * (kind === 'dart' ? 0.7 : 1); kick = 1.5; audio.play('whoosh', { vol: 0.35, pitch: 0.6 }); }
        }
        if (run > 0) {
          run -= dt;
          if (run <= 0) nextRun = (4.2 - d * 2.6 + Math.random() * (2.5 - d * 1.3)) * (kind === 'dart' ? 0.75 : kind === 'smooth' ? 1.2 : 1);
        }
      }
      const running = run > 0 && !end;
      // ------------------------------------------------------ line tension and how much line is out
      if (!end) {
        if (running) {
          if (holding) { ten += (0.5 + runPow * 0.95) * dt; dep += runPow * 0.02 * dt; }
          else { ten += (0.3 + runPow * 0.22 - ten) * Math.min(1, dt * 5); dep += runPow * (kind === 'sinker' ? 0.1 : kind === 'floater' ? 0.04 : 0.07) * dt; }
        } else if (holding) {
          ten += (0.3 + (1 - dep) * 0.06 + Math.sin(t * 9) * 0.03 + (tele > 0 ? 0.12 : 0) - ten) * Math.min(1, dt * 3.5);
          dep -= (0.12 - d * 0.04) * dt * (tele > 0 ? 0.4 : 1);
        } else {
          ten += (0.07 - ten) * Math.min(1, dt * 3);
          dep += 0.018 * dt;
        }
        if (ten > 0.72 && !coached) { coached = true; cu.say('Mori', 'It’s running! *Ease off* or the line goes!', { shout: true, ms: 2600 }); }
        if (ten >= 1) {
          finish('snap', 'SNAP!', 'too much strain on the line', true);
          snapY = RT0[1]; kick = 5; rodV = -2.5;
          audio.play('whoosh', { vol: 0.6, pitch: 1.8 }); audio.play('wrong', { vol: 0.45 });
        } else if (dep >= 1) {
          finish('lost', 'GONE...', 'it took all the line', true);
          audio.play('wrong', { vol: 0.45 });
        } else if (dep <= 0) {
          dep = 0; finish('caught', 'CAUGHT!', o.caughtSub, false);
          kick = 3; splash(mx, 26, 1.3);
          audio.play('splashBig', { vol: 0.6 }); audio.play('discover', { vol: 0.5 });
          cu.flash();
        }
        // sound: the reel clicking in, and the rod and line creaking under strain
        if (holding && !running) { reelSfx -= dt; if (reelSfx <= 0) { reelSfx = 0.09; audio.play('rope', { vol: 0.09, pitch: 1.7 + Math.random() * 0.1 }); } }
        if (ten > 0.5) {
          creakSfx -= dt;
          if (creakSfx <= 0) { creakSfx = 0.42 - (ten - 0.5) * 0.6; audio.play('woodCreak', { vol: 0.1 + (ten - 0.5) * 0.6, pitch: 1.1 + ten * 0.6 }); if (ten > 0.75) audio.play('rope', { vol: 0.12, pitch: 2.4 + ten }); }
        }
      } else endT += dt;
      // ------------------------------------------------------ the fish on the line
      const E0x = RT0[0] + (mx - RT0[0]) * ((WL - RT0[1]) / Math.max(20, my - RT0[1]));
      let faceT = face, pitchT = -0.4, freq = 4, bendT = 0.8;
      if (end === 'caught') { pitchT = -1.15; freq = 18; bendT = 1.8; my += (WL - 24 - my) * Math.min(1, dt * 6); }
      else if (end === 'snap' || end === 'lost') {
        faceT = runDir; pitchT = 0.35; freq = 12; bendT = 1.4;
        tx += runDir * 70 * dt; dep = Math.min(1.6, dep + dt * 0.5);
      } else if (running) {
        faceT = runDir; freq = 15; bendT = 1.7;
        pitchT = kind === 'sinker' ? 0.5 : kind === 'floater' ? -0.35 : 0.14;
        tx += runDir * (38 + runPow * 46) * dt;
      } else if (tele > 0) {
        faceT = runDir; freq = 11; bendT = 1.4; pitchT = 0;
      } else if (holding) {
        // dragged up by the lip, shaking its head, swimming against it
        if (Math.abs(E0x - mx) > 14) faceT = Math.sign(E0x - mx);
        pitchT = -0.8 + Math.sin(t * 5.2) * 0.28; freq = 9; bendT = 1.25;
        tx += (E0x + Math.sin(t * 0.7) * 30 - tx) * Math.min(1, dt * 0.6);
      } else {
        // resting: it noses away from the boat
        if (Math.abs(E0x - mx) > 14) faceT = -Math.sign(E0x - mx);
        pitchT = -0.25 + Math.sin(t * 1.3) * 0.15;
        tx += (E0x - faceT * 50 + Math.sin(t * 0.5) * 20 - tx) * Math.min(1, dt * 0.4);
      }
      if (hookT > 0) { freq = 16; bendT = 1.8; }
      face += Math.sign(faceT - face) * Math.min(Math.abs(faceT - face), dt * 4.2);
      pitch += (pitchT - pitch) * Math.min(1, dt * 5);
      bend += (bendT - bend) * Math.min(1, dt * 4);
      ph += dt * freq;
      finT = Math.sin(t * (freq * 0.6));
      if (!end) {
        // keep the whole fish in the shot, however big it has grown
        const span = (g.xm - g.xe) * (Smin + (Smax - Smin) * clamp01(1 - dep)) * 0.85;
        const lo = face > 0 ? 16 + span : 44, hi = face < 0 ? CW - 16 - span : CW - 44;
        tx = lo < hi ? Math.max(lo, Math.min(hi, tx)) : (lo + hi) / 2;
        if (running && ((tx <= lo + 1 && runDir < 0) || (tx >= hi - 1 && runDir > 0))) runDir = -runDir;
      }
      mx += (tx - mx) * Math.min(1, dt * (running ? 3 : 1.4));
      if (end !== 'caught') my += (yOf(dep) + Math.sin(t * 1.7) * 2 - my) * Math.min(1, dt * 4);
      const S = end === 'caught' ? Smax * (1 + Math.min(0.25, endT * 0.5)) : Smin + (Smax - Smin) * clamp01(1 - dep);
      const fog = end === 'caught' ? 0 : clamp01(0.08 + 0.58 * Math.pow(clamp01(dep), 1.2));
      // bubbles stream off it when it fights, the more so under strain
      const gillX = mx - (face >= 0 ? 1 : -1) * Math.cos(pitch) * g.rx * 0.5 * S, gillY = my - Math.sin(pitch) * g.rx * 0.5 * S;
      if (!end && Math.random() < dt * ((running ? 9 : tele > 0 ? 12 : 1.2) + Math.max(0, ten - 0.55) * 30)) bubble(gillX, gillY, 1 + (Math.random() < 0.4 ? 1 : 0), 4);
      if (Math.random() < dt * 0.8) bubble(20 + Math.random() * 280, bedY[(Math.random() * CW) | 0] - 2, 1, 2);
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const q = bubbles[i];
        q.y -= dt * (14 + q.r * 9); q.x += (q.vx + Math.sin(q.y * 0.3 + i) * 6) * dt; q.vx *= 1 - dt;
        q.life -= dt;
        if (q.y < surfY(q.x, t) + 1 || q.life <= 0) { if (q.y < WL + 3 && q.r >= 1 && Math.random() < 0.5) drops.push({ x: q.x, y: WL - 1, vx: (Math.random() - 0.5) * 10, vy: -12 - Math.random() * 10, life: 0.4 }); bubbles.splice(i, 1); }
      }
      for (let i = drops.length - 1; i >= 0; i--) { const q = drops[i]; q.vy += 220 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; if (q.life <= 0 || (q.vy > 0 && q.y > WL)) drops.splice(i, 1); }
      for (const s of specks) { s.y += dt * (1.5 + s.z * 3); s.x += Math.sin(t * 0.4 + s.z * 9) * dt * (1 + s.z * 3); if (s.y > CH) { s.y = WL + 2; s.x = Math.random() * CW; } }
      // rod: bows toward the fish with the strain, springs back when the line breaks
      if (end === 'snap' || end === 'lost') { rodV += (-rodT * 60 - rodV * 5) * dt; rodT += rodV * dt; }
      else { rodT += (ten - rodT) * Math.min(1, dt * 8); rodV = 0; }
      kick = Math.max(0, kick - dt * 6);

      // ------------------------------------------------------ draw
      const fT0 = performance.now();
      buf.set(base);
      // light shafts from the sun over the stern, sliding slowly; the hull throws a shadow
      const shaft = new Float32Array(CW + 200);
      for (let s = 0; s < shaft.length; s++) {
        const a = Math.sin(s * 0.045 + t * 0.22) * Math.sin(s * 0.019 - t * 0.13 + 1.3) + Math.sin(s * 0.11 + t * 0.4) * 0.25;
        shaft[s] = a > 0.2 ? Math.min(1, (a - 0.2) * 1.6) : 0;
      }
      for (let y = WL; y < CH; y++) {
        const fall = Math.pow(clamp01(1 - (y - WL) / 150), 1.6);
        if (fall <= 0) break;
        for (let x = 0; x < CW; x++) {
          const i = y * CW + x;
          if (hullM[i]) continue;
          const s = Math.floor(x - (y - WL) * 0.42 + 120);
          if (s > 330 - (y - WL) * 0.2 && s < 372) continue; // the hull's shadow
          const I = shaft[s] * fall;
          if (I <= 0) continue;
          const lv = Math.floor(I * 3 + dith(x, y) * 0.9) / 3;
          if (lv > 0) add(buf, x, y, lv * 22, lv * 34, lv * 32);
        }
      }
      // caustic net just under the surface
      for (let y = WL + 2; y < WL + 16; y++) for (let x = 0; x < 236; x++) {
        const c = Math.abs(Math.sin(x * 0.28 + Math.sin(y * 0.55 + t * 1.8) * 1.6 + t * 0.9) + Math.sin(y * 0.4 - x * 0.1 - t * 1.2));
        if (c < 0.16) add(buf, x, y, 18 * (1 - (y - WL) / 16), 30 * (1 - (y - WL) / 16), 30 * (1 - (y - WL) / 16));
      }
      // a school of tiny fish far off, and the far specks
      for (const f of school) {
        const X = ((f.x - t * 7) % 360 + 360) % 360 - 20, Y = f.y + Math.sin(t * 0.8 + f.p) * 2;
        const c = mixc(hx('#8ab0c4'), wcol(Y), 0.6);
        blend(buf, X, Y, c, 0.8); blend(buf, X + 1, Y, c, 0.8); blend(buf, X - 1, Y, c, 0.6); blend(buf, X + 2, Y - (Math.sin(t * 9 + f.p) > 0 ? 1 : 0), c, 0.5);
      }
      for (const s of specks) if (s.z < 0.6) blend(buf, s.x, s.y, hx('#b8dce6'), 0.2 + s.z * 0.3);
      // the waterline: air above, a bright meniscus, the silvery underside of the surface below
      for (let x = 0; x < CW; x++) {
        const ys = surfY(x, t);
        for (let y = WL - 4; y <= WL + 6; y++) {
          const i = y * CW + x;
          if (hullM[i]) continue;
          if (y + 0.5 < ys) buf[i] = air[i];
          else if (y - 0.5 < ys) buf[i] = hx('#e8fbff');
          else if (y - 1.5 < ys) buf[i] = mixc(hx('#8fd6ea'), buf[i], 0.2);
          else {
            const k = (y - ys) / 6;
            const band = Math.sin(x * 0.21 + t * 2.1 + y * 0.8) > 0.2 ? 0.3 : 0.14;
            if (k < 1) buf[i] = mixc(buf[i], hx('#9ad8e8'), band * (1 - k));
          }
        }
      }
      // the fish (hooked at the lip)
      const q: FishPose = { mx, my, pitch, face, S, bend, ph, fin: finT, fog };
      drawFish(buf, fish, g, P, q);
      // the hook glinting in its lip
      blend(buf, mx, my, hx('#e8eef0'), 0.9);
      // bubbles
      for (const b2 of bubbles) {
        if (b2.r < 1) { blend(buf, b2.x, b2.y, hx('#dff4fa'), 0.7); continue; }
        if (b2.r < 2) { blend(buf, b2.x, b2.y, hx('#dff4fa'), 0.8); blend(buf, b2.x + 1, b2.y, hx('#8ac8dc'), 0.6); blend(buf, b2.x, b2.y + 1, hx('#8ac8dc'), 0.6); continue; }
        for (let a = 0; a < 6.28; a += 0.5) blend(buf, b2.x + Math.cos(a) * 2, b2.y + Math.sin(a) * 2, hx('#bfe6f2'), 0.75);
        blend(buf, b2.x - 1, b2.y - 1, hx('#ffffff'), 0.9);
      }
      // ------------------------------------------------------ the line: rod tip, through the surface, down to the fish's lip
      const shake = Math.max(0, rodT - 0.62) * 2.4;
      const dirx = mx - RT0[0], diry = my - RT0[1], dl = Math.hypot(dirx, diry) || 1;
      const rb = Math.max(-0.3, rodT);
      const TX = RT0[0] + (dirx / dl) * rb * 14 + (Math.random() - 0.5) * shake, TY = RT0[1] + rb * 16 + (diry / dl) * rb * 5 + (Math.random() - 0.5) * shake;
      const strain = clamp01((ten - 0.42) / 0.5);
      const lineC = end ? hx('#e8eef4') : mixc(hx('#f4f8ff'), hx('#ff3424'), strain);
      const vib = end ? 0 : Math.max(0, ten - 0.48) * 3.4;
      const Ex = TX + (mx - TX) * ((WL - TY) / Math.max(20, my - TY));
      const sag = end === 'lost' ? 30 : (1 - Math.min(1, ten * 1.6)) * 16;
      const seg = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, under: boolean, k0 = 0, k1 = 1) => {
        const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 1.6) + 2;
        const nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1;
        for (let i = Math.floor(n * k0); i <= n * k1; i++) {
          const s = i / n, u = 1 - s;
          let x = u * u * ax + 2 * u * s * cx + s * s * bx, y = u * u * ay + 2 * u * s * cy + s * s * by;
          const w = vib * Math.sin(Math.PI * s) * Math.sin(t * 83 + s * (under ? 14 : 8));
          x += nx / nl * w; y += ny / nl * w;
          const c = under ? mixc(lineC, wcol(y), 0.15 + 0.4 * clamp01((y - WL) / 120)) : lineC;
          blend(buf, x, y, c, under ? 0.85 : 1);
          if (strain > 0.6) blend(buf, x + nx / nl, y + ny / nl, hx('#ff5a3a'), (strain - 0.6) * 0.8);
        }
      };
      if (end === 'snap') {
        // the upper end whips back up to the rod, the lower end trails after the fleeing fish
        const k = Math.max(0, 1 - endT * 3.5);
        snapY = Math.min(snapY, TY);
        if (k > 0) seg(TX, TY, TX + (Ex - TX) * k, TY + (WL - TY) * k - (1 - k) * 8, TX + (Ex - TX) * k * 0.5 + 6, TY + (WL - TY) * k * 0.5 - 6, false);
        seg(mx, my, mx - (face >= 0 ? 1 : -1) * 20, my - 26 - endT * 10, mx - (face >= 0 ? 1 : -1) * 4, my - 16, true);
      } else if (end === 'lost') {
        seg(TX, TY, Ex, WL, (TX + Ex) / 2, (TY + WL) / 2 + 2, false);
        const hx0 = Ex - 8 + endT * 4, hy0 = WL + 40 - endT * 6;
        seg(Ex, WL, hx0, hy0, Ex + 4, WL + 26, true);
        blend(buf, hx0, hy0, hx('#dfe6ea'), 1); blend(buf, hx0 + 1, hy0 + 1, hx('#8a9aa0'), 1);
      } else {
        seg(TX, TY, Ex, WL, (TX + Ex) / 2, (TY + WL) / 2, false);
        seg(Ex, WL, mx, my, (Ex + mx) / 2 + sag * 0.5, (WL + my) / 2 + sag, true);
        // the line tugs the surface up into a little peak where it goes in
        const ex = Math.round(Ex), ey = Math.round(surfY(Ex, t));
        blend(buf, ex - 1, ey, hx('#ffffff'), 0.8); blend(buf, ex + 1, ey, hx('#ffffff'), 0.8); blend(buf, ex, ey - 1, hx('#e8fbff'), 0.6 + strain * 0.3);
        if (strain > 0.3 && hash(Math.floor(t * 20), 1) < strain) { blend(buf, ex - 2, ey - 1, hx('#ffffff'), 0.7); blend(buf, ex + 2, ey - 1, hx('#ffffff'), 0.7); }
      }
      // splash drops over the waterline
      for (const q2 of drops) { blend(buf, q2.x, q2.y, hx('#f4fcff'), 0.95); blend(buf, q2.x, q2.y + 1, hx('#9ad4e8'), 0.6); }
      if (end === 'caught' && endT < 0.9) for (let x = mx - 26; x < mx + 26; x++) {
        const h = Math.max(0, (1 - Math.abs(x - mx) / 26) * 10 * (1 - endT) * (0.6 + hash(x | 0, Math.floor(t * 12)) * 0.4));
        for (let y = WL - h; y < WL + 3; y++) blend(buf, x, y, hx('#f4fcff'), 0.85);
      }
      // ------------------------------------------------------ the rod tip, bowing in from the top edge
      {
        const ax = RB[0], ay = RB[1];
        const cx = ax + (RT0[0] - ax) * 0.5, cy = ay + (RT0[1] - ay) * 0.5 - 2;
        const n = 140;
        for (let i = 0; i <= n; i++) {
          const s = i / n, u = 1 - s;
          const x = u * u * ax + 2 * u * s * cx + s * s * TX, y = u * u * ay + 2 * u * s * cy + s * s * TY;
          const tx2 = 2 * u * (cx - ax) + 2 * s * (TX - cx), ty2 = 2 * u * (cy - ay) + 2 * s * (TY - cy), tl = Math.hypot(tx2, ty2) || 1;
          const nx = ty2 / tl, ny = -tx2 / tl; // points to the rod's underside
          const r = 3.6 - s * 2.7;
          const GS = [0.3, 0.52, 0.7, 0.85, 0.975];
          const gi = GS.findIndex(gq => Math.abs(s - gq) < 0.006);
          const wrap = GS.some(gq => Math.abs(s - gq) < 0.011 + (1 - s) * 0.006);
          for (let k = -r; k <= r; k += 0.4) {
            const kk = k / r;
            const X = (x + nx * k) | 0, Y = (y + ny * k) | 0;
            // glossy blank: a hard specular stripe along the top, dark underside
            let c = ramp(ROD, 0.42 - kk * 0.3 + (kk < -0.25 && kk > -0.6 ? 0.34 : 0), X, Y);
            if (wrap) c = ramp(BOOT, 0.3 - kk * 0.4, X, Y);
            if (s < 0.08) c = ramp(['#3a2a1a', '#6a4a2a', '#9a7040', '#c8a060'].map(hx), 0.45 - kk * 0.3, X, Y); // the ferrule's wooden sleeve
            layPut(x + nx * k, y + ny * k, c);
          }
          // line guides: a wire foot and a bright ring hanging under the blank
          if (gi >= 0) {
            const gr = 1.3 - gi * 0.1;
            for (let k = 0; k < 2; k++) layPut(x + nx * (r + k + 0.5), y + ny * (r + k + 0.5), hx('#6a7882'));
            const ccx = x + nx * (r + 2 + gr), ccy = y + ny * (r + 2 + gr);
            for (let a = 0; a < 6.3; a += 0.3) layPut(ccx + Math.cos(a) * gr, ccy + Math.sin(a) * gr, Math.sin(a) < 0 ? hx('#f4f8fa') : hx('#8a98a2'));
          }
        }
        layFlush(buf);
      }
      // ------------------------------------------------------ near kelp, swaying across the frame edges
      const nearKelp: [number, number, number][] = [[8, 150, 0], [34, 112, 1.7], [311, 128, 3.1]];
      for (const [kx, kh, kp] of nearKelp) {
        const y0 = CH + 2, y1 = y0 - kh;
        const sway = (y: number) => kx + Math.sin(y * 0.045 + t * 0.9 + kp) * 7 * Math.pow((y0 - y) / kh, 1.3) + Math.sin(t * 1.7 + y * 0.1) * 1.2 * ((y0 - y) / kh);
        for (let y = y0; y > y1; y -= 0.5) {
          const sx = sway(y);
          for (let q2 = -1.3; q2 <= 1.3; q2 += 0.5) layPut(sx + q2, y, ramp(KELP, 0.45 - q2 * 0.18, (sx + q2) | 0, y | 0));
        }
        for (let yb = y0 - 6; yb > y1 + 4; yb -= 10) {
          const side = Math.round(yb / 10) % 2 ? 1 : -1;
          const sx = sway(yb), len = 13 + hash(kx, yb | 0) * 5, lift = 0.7 + Math.sin(t * 1.3 + yb * 0.05 + kp) * 0.25;
          for (let s = 0; s < len; s += 0.5) {
            const bw = 3.2 * Math.sin(Math.PI * Math.min(1, s / len * 0.9 + 0.1));
            const bx = sx + side * s * Math.cos(lift), by = yb - s * Math.sin(lift) + Math.sin(s * 0.4 + t * 2 + kp) * 1.1;
            for (let w = -bw; w <= bw; w += 0.5) {
              const lit = 0.62 - w / bw * side * 0.22 + (Math.abs(w) < 0.5 ? 0.2 : 0) + (s / len) * 0.12;
              layPut(bx + w * 0.3 * side, by + w, ramp(KELP, lit, (bx | 0), (by + w) | 0));
            }
          }
        }
      }
      layFlush(buf);
      for (const s of specks) if (s.z >= 0.6) { blend(buf, s.x, s.y, hx('#e0f4f8'), 0.55); if (s.z > 0.9) blend(buf, s.x + 1, s.y, hx('#e0f4f8'), 0.35); }
      // vignette, deep blue in the corners
      for (let i = 0; i < CW * CH; i++) { const k = VIG[i]; if (k > 0) { const v = buf[i]; buf[i] = rgb(R(v) * (1 - k * 1.1), G(v) * (1 - k), B(v) * (1 - k * 0.7)); } }
      // shake under strain, and on the big moments
      const sh = Math.max(0, ten - 0.7) * 6 * (end ? 0 : 1) + kick;
      if (sh > 0.4) {
        const ox = Math.round((Math.random() - 0.5) * 2 * sh), oy = Math.round((Math.random() - 0.5) * 2 * sh);
        work.set(buf);
        for (let y = 0; y < CH; y++) {
          const sy = Math.max(0, Math.min(CH - 1, y - oy));
          for (let x = 0; x < CW; x++) buf[y * CW + x] = work[sy * CW + Math.max(0, Math.min(CW - 1, x - ox))];
        }
      }
      (window as unknown as { __fishFight?: unknown }).__fishFight = { t: +t.toFixed(1), ms: +(performance.now() - fT0).toFixed(1), dep: +dep.toFixed(3), ten: +ten.toFixed(3), run: +run.toFixed(2), tele: +tele.toFixed(2), end };
      cu.present();
      return true;
    });
  });
  return result;
}

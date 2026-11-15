// V12 Te Moana Rimurimu, the kelp painters: every frond is hand-shaped, never a primitive.
//
//   giantKelp   Macrocystis, towering from the floor to the surface: a claw holdfast of branching
//               haptera, two to four twisting stipes (the light side flips as they spiral), a gas
//               bladder at the foot of every blade, long ruffled blades with a midrib, serrated
//               margins and translucent edges that glow where the light comes through from above;
//               at the top the stipes lie over along the surface into the floating canopy mat
//   bullKelp    rimurapa (Durvillaea), on the shallow pinnacle: a glossy disc holdfast, a short thick
//               stipe, then a mane of thick leathery straps (honeycombed inside, so they float),
//               streaming up and over with the surge, twisting, splitting at the tips
//   stalkedKelp kelp (Ecklonia radiata), the reef's patches: a stiff stipe and a flopping crown of
//               corrugated, spiny-edged blades
//   seagrass    karepō (Zostera), tufts of ribbon blades on the sand with yellowing tips and epiphytes
//
// Light comes from above (the surface): the upper margin of a blade is the lit, backlit one. Every
// painter takes `haze` (0..1) and a water colour, so the same plant can stand far back in the water.

import { PixelBuffer } from '../../pixel';
import { C, hex, mix, shade } from '../../color';
import { Rng, clamp, noise1 } from '../../../core/math';
import type { Sprite } from '../../jungle-core';
import { outlineSel } from '../../jungle-core';

const r = (...h: string[]) => h.map(x => hex(x));
/** giant kelp: golden olive-brown, dark to light */
export const KELP_RAMP = r('#14110a', '#211b0e', '#2f2712', '#403515', '#544517', '#6a571b', '#816b21', '#9a8029', '#b39634', '#c9ab45', '#ddc15e', '#ecd67e');
const KELP_RIM = hex('#d8bc5a');
/** the same kelp in other moods: olive, and a deeper amber-brown (every plant picks one) */
const KELP_RAMPS = [KELP_RAMP, KELP_RAMP.map(c => mix(c, hex('#5e7a2a'), 0.22)), KELP_RAMP.map(c => mix(c, hex('#8a4a1e'), 0.2))];
const HOLD = r('#120d08', '#1f160e', '#2e2115', '#3e2d1b', '#503b22', '#654b2a', '#7c5d33', '#93703d', '#a8844a');
const ECK = r('#100c07', '#1c150b', '#2a1f0f', '#3a2b13', '#4c3917', '#5f481b', '#745820', '#8a6a27', '#a17e31', '#b8933e', '#ccaa52');
const ECK_RIM = hex('#e8cf7c');
const BULL = r('#121008', '#1f1b0c', '#2e2911', '#3f3815', '#524819', '#665a1d', '#7c6c22', '#937f29', '#ab9433', '#c3aa43', '#d9c25c', '#ece0a0');
const GRASS = r('#0c1612', '#122018', '#192c1e', '#213824', '#2a4429', '#35512e', '#425e33', '#506b39', '#617840', '#758648', '#8c9654');
const CORALLINE = r('#5a2438', '#8a3a56', '#b85a78', '#dc86a0', '#f2b4c4');

type P3 = [number, number, number];
const TAU = Math.PI * 2;
const at = (rp: C[], i: number) => rp[i <= 0 ? 0 : i >= rp.length - 1 ? rp.length - 1 : Math.round(i)];
const h01 = (x: number, y: number, s: number) => {
  let n = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

/** a painting surface that remembers which pixels are frond (translucent overlaps read darker) */
class Canvas {
  readonly b: PixelBuffer;
  readonly frond: Uint8Array;
  constructor(w: number, h: number) {
    this.b = new PixelBuffer(w, h);
    this.frond = new Uint8Array(this.b.w * this.b.h);
  }
  set(x: number, y: number, c: C, frond = 0) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.b.w || y >= this.b.h) return;
    this.b.data[y * this.b.w + x] = c;
    this.frond[y * this.b.w + x] = frond;
  }
  isFrond(x: number, y: number) {
    x = Math.round(x); y = Math.round(y);
    return x >= 0 && y >= 0 && x < this.b.w && y < this.b.h && this.frond[y * this.b.w + x] > 0;
  }
}

// ------------------------------------------------------------------ the parts
interface BladeO {
  x: number; y: number; a: number; len: number;
  /** half-width at the widest */
  w: number;
  /** total turn of the centreline over its length (radians) */
  bend: number;
  /** base ramp index */
  tone: number;
  rp: C[];
  rim: C;
  /** corrugation strength 0..1.5 */
  ruffle?: number;
  rib?: boolean;
  serrate?: boolean;
  /** frond id (overlap darkening only against other fronds) */
  id: number;
  /** where along the blade it is widest (0..1, default ~0.33) */
  peak?: number;
  /** a ragged, eaten tip */
  ragged?: number;
  seed: number;
  /** 0..1 backlit: up near the surface the light comes through the thin margins on both sides */
  glow?: number;
}
/**
 * One blade: a curving centreline swept with a lanceolate width; corrugations run across it as
 * chevrons pointing to the tip, the midrib is a darker line, the upper margin catches the light
 * through the frond (the backlit rim), the lower margin is in shadow, teeth stand off the margins.
 */
function blade(cv: Canvas, o: BladeO): P3[] {
  const n = Math.max(6, Math.ceil(o.len * 2));
  const pts: P3[] = [];
  let x = o.x, y = o.y, a = o.a;
  for (let i = 0; i <= n; i++) {
    pts.push([x, y, a]);
    x += Math.cos(a) * 0.5; y += Math.sin(a) * 0.5;
    // a bend that eases in, plus a little wander
    a += (o.bend / n) * (0.6 + 0.8 * (i / n)) + (noise1(i * 0.11, o.seed) - 0.5) * 0.02;
  }
  const pk = o.peak ?? 0.34, ex = Math.log(0.5) / Math.log(pk);
  const rf = o.ruffle ?? 1;
  const teeth: [number, number, C][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const [cx, cy, ca] = pts[i];
    let hw = o.w * Math.pow(Math.sin(Math.PI * Math.pow(t, ex)), 0.85);
    if (o.ragged && t > 1 - o.ragged) hw *= 0.55 + 0.45 * noise1(i * 0.9, o.seed + 3);
    if (t < 0.05) hw = Math.min(hw, 0.5);
    const nx = -Math.sin(ca), ny = Math.cos(ca);
    // which side faces up (toward the surface and the light)
    const upSign = ny < 0 ? 1 : -1;
    const along = i * 0.5;
    const steps = Math.max(1, Math.ceil(hw * 2.2));
    for (let s = 0; s <= steps; s++) {
      const v = -hw + (2 * hw * s) / steps;
      const px = Math.round(cx + nx * v), py = Math.round(cy + ny * v);
      const av = Math.abs(v), up = v * upSign > 0;
      let tone = o.tone;
      // corrugations: chevrons across the blade
      const wv = Math.sin(along * 0.62 - av * 1.15 + o.seed);
      if (wv > 0.45) tone += Math.round(rf);
      else if (wv < -0.55) tone -= Math.round(rf);
      // form: the upper half lit, the lower half turned away
      if (av > 0.4) tone += up ? 0.5 : -1;
      if (o.rib && av < 0.55 && t > 0.04 && t < 0.86) tone = o.tone - 1;
      // a translucent tip, thinner and lighter
      if (t > 0.88) tone += 1;
      let c = at(o.rp, tone);
      const margin = av > hw - 0.8 && hw > 1.1;
      // the backlit upper margin glows in proportion to the light the blade gets
      const gl = o.glow ?? 0;
      if (margin) c = up ? (t > 0.1 && t < 0.86 && hw > 1.4 ? mix(at(o.rp, o.tone + 1.5), o.rim, clamp((o.tone - 3) / 5)) : at(o.rp, o.tone + 1)) : gl > 0.3 && t > 0.15 && t < 0.8 && ((i >> 1) & 1) ? mix(at(o.rp, o.tone + 1), o.rim, gl * 0.6) : at(o.rp, o.tone - 2);
      // just inside the margins the frond is thin: lighter where the light comes through
      else if (gl > 0 && av > hw - 1.8 && hw > 1.6 && t > 0.12 && t < 0.88) c = at(o.rp, tone + gl * 1.2);
      // seen through another frond: darker
      if (cv.isFrond(px, py) && cv.frond[py * cv.b.w + px] !== o.id) c = shade(c, -0.16);
      cv.set(px, py, c, o.id);
      if (o.serrate && margin && i % 3 === 0 && t > 0.1 && t < 0.92) {
        const tx = Math.round(cx + nx * (v + Math.sign(v) * 1)), ty = Math.round(cy + ny * (v + Math.sign(v) * 1));
        teeth.push([tx, ty, up ? at(o.rp, o.tone + 1) : at(o.rp, o.tone - 2)]);
      }
    }
  }
  for (const [tx, ty, c] of teeth) if (!cv.isFrond(tx, ty) || cv.frond[ty * cv.b.w + tx] !== o.id) cv.set(tx, ty, c, o.id);
  return pts;
}

/** a gas bladder (pneumatocyst): a glossy pear on the blade's foot, pointing along it */
function bladder(cv: Canvas, x: number, y: number, a: number, len: number, rp: C[], tone: number, id: number) {
  const ca = Math.cos(a), sa = Math.sin(a);
  const nx = -sa, ny = ca;
  for (let s = -0.5; s <= len; s += 0.5) {
    const t = (s + 0.5) / (len + 0.5);
    const hw = Math.max(0.5, (len * 0.42) * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.6));
    for (let v = -hw; v <= hw; v += 0.5) {
      const px = x + ca * s + nx * v, py = y + sa * s + ny * v;
      const up = (ny * v) < 0;
      let tn = tone + (up ? 1 : -1) + (Math.abs(v) > hw - 0.6 ? -1 : 0);
      if (t > 0.3 && t < 0.6 && up && Math.abs(v) > hw * 0.3 && Math.abs(v) < hw * 0.8) tn = tone + 3;
      cv.set(px, py, at(rp, tn), id);
    }
  }
}

/** a stipe: a thin stem that spirals as it climbs, so its lit side swaps over and back */
function stipe(cv: Canvas, pts: [number, number][], rp: C[], tone: number, width: number, seed: number) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    const [x1, y1] = pts[Math.min(pts.length - 1, i + 1)];
    const [x0, y0] = pts[Math.max(0, i - 1)];
    const a = Math.atan2(y1 - y0, x1 - x0);
    if (i) s += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]);
    const nx = -Math.sin(a), ny = Math.cos(a);
    const tw = Math.sin(s * 0.075 + seed);
    for (let k = 0; k < width; k++) {
      const v = k - (width - 1) / 2;
      const side = v * (nx * -0.6 + ny * -0.8) >= 0 ? 1 : -1;
      let tn = tone;
      if (Math.abs(tw) < 0.3) tn += 0;
      else tn += (tw > 0 ? side : -side) * 1.4;
      if (k === 0 || k === width - 1) tn -= 0.5;
      cv.set(x + nx * v, y + ny * v, at(rp, tn), 1);
    }
  }
}

/** a curved path from a to b through a sideways bulge (n points per px of length) */
function curve(x0: number, y0: number, x1: number, y1: number, bulge: number, wob: number, seed: number, step = 1): [number, number][] {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(2, Math.ceil(len / step));
  const nx = -(y1 - y0) / (len || 1), ny = (x1 - x0) / (len || 1);
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const b = Math.sin(t * Math.PI) * bulge + (noise1(t * len * 0.045, seed) - 0.5) * wob * Math.sin(t * Math.PI);
    out.push([x0 + (x1 - x0) * t + nx * b, y0 + (y1 - y0) * t + ny * b]);
  }
  return out;
}

/** a tangle of root-like haptera gripping the rock: a dark mound, then claws branching down to it */
function holdfast(cv: Canvas, rng: Rng, cx: number, base: number, hw: number, hh: number, rp: C[]) {
  const seed = rng.int(1, 9999);
  for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
    const u = (x + 0.5 - cx) / hw;
    const top = base - hh * Math.pow(Math.max(0, 1 - u * u), 0.55) * (0.75 + 0.35 * noise1(x * 0.4, seed));
    for (let y = Math.round(top); y <= base; y++) cv.set(x, y, at(rp, 1 + (h01(x, y, seed) < 0.2 ? 1 : 0)), 0);
  }
  const n = Math.round(hw * 1.8);
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const sx = cx + rng.range(-hw * 0.3, hw * 0.3), sy = base - hh * rng.range(0.45, 1);
    const ex = cx + side * rng.range(hw * 0.25, hw * 1.15), ey = base - rng.range(0, 1.5);
    const path = curve(sx, sy, ex, ey, side * rng.range(-2, 3), 1.5, seed + i, 0.5);
    for (let k = 0; k < path.length; k++) {
      const [x, y] = path[k];
      const t = k / path.length;
      const nxt = path[Math.min(path.length - 1, k + 1)];
      const lit = nxt[0] < x ? 1 : 0;
      cv.set(x, y, at(rp, 4 + lit + (t < 0.3 ? 1 : 0) - (t > 0.8 ? 1 : 0)), 0);
      if (t < 0.6) cv.set(x + 1, y, at(rp, 3 + (t < 0.2 ? 1 : 0)), 0);
    }
    // a fork near the foot
    if (rng.chance(0.55)) {
      const [fx, fy] = path[Math.floor(path.length * 0.55)];
      const fp = curve(fx, fy, fx + side * rng.range(1.5, 4), base, side * 0.8, 0.6, seed + 77 + i, 0.5);
      for (const [x, y] of fp) cv.set(x, y, at(rp, 4), 0);
    }
  }
  // the light catches the top of the tangle
  for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
    for (let y = Math.round(base - hh - 2); y <= base; y++) {
      if (!cv.b.opaque(x, y) || cv.b.opaque(x, y - 1)) continue;
      if (h01(x, y, seed + 9) < 0.6) cv.set(x, y, at(rp, 6), 0);
      break;
    }
  }
}

/** pale specks and coralline crust on old stipes and holdfasts */
function epiphytes(cv: Canvas, rng: Rng, x0: number, y0: number, x1: number, y1: number, n: number) {
  for (let i = 0; i < n; i++) {
    const x = Math.round(rng.range(x0, x1)), y = Math.round(rng.range(y0, y1));
    if (!cv.b.opaque(x, y)) continue;
    const c = rng.chance(0.6) ? at(CORALLINE, rng.int(1, 3)) : hex('#d8d2b8');
    cv.set(x, y, c, cv.frond[y * cv.b.w + x]);
    if (rng.chance(0.4) && cv.b.opaque(x + 1, y)) cv.set(x + 1, y, at(CORALLINE, 3), cv.frond[y * cv.b.w + x + 1]);
  }
}

/** pull every colour toward the water (haze) and finish with a selective outline */
function finish(cv: Canvas, haze: number, water: C, outline = 0.5): PixelBuffer {
  const b = cv.b;
  if (outline > 0) outlineSel(b, outline, 0);
  if (haze > 0) {
    const d = b.data;
    for (let i = 0; i < d.length; i++) if (d[i] >>> 24) d[i] = mix(d[i], water, haze);
  }
  return b;
}

// ------------------------------------------------------------------ giant kelp
export interface KelpOpts {
  /** -1..1: which way the column leans and the canopy runs along the surface */
  lean?: number;
  /** 0..1 how far it is pulled toward the water colour (far layers) */
  haze?: number;
  water?: C;
  /** fewer, simpler fronds (far layers) */
  simple?: boolean;
  /** the canopy mat at the top (false: it ends below the surface) */
  canopy?: boolean;
}

/**
 * Giant kelp, `H` px from its holdfast (the bottom row, the anchor) to the surface (the top row).
 * The canopy at the top spreads out along the surface over the sprite's full width.
 */
export function giantKelp(seed: number, H: number, o: KelpOpts = {}): Sprite {
  const rng = new Rng(seed * 97 + 13);
  const W = 160, ax = 80;
  const cv = new Canvas(W, H);
  const base = H - 1;
  const lean = o.lean ?? rng.range(-0.6, 0.6);
  /** the way the current streams the fronds */
  const ds = lean >= 0 ? 1 : -1;
  const simple = !!o.simple;
  const hw = rng.range(7, 10), hh = rng.range(5, 8);
  const nSt = simple ? rng.int(1, 2) : rng.int(1, 4);
  // every plant its own: broad or narrow blades, long or short, close-set or sparse, a big or small canopy
  const bw = rng.range(0.75, 1.35), bln = rng.range(0.8, 1.35) / Math.sqrt(bw), bgap = rng.range(0.8, 1.3), pk = rng.range(0.24, 0.48);
  const canopyK = rng.range(1, 1.7);
  const KR = KELP_RAMPS[rng.int(0, 2)];
  const canopyY = rng.range(3, 5);
  type Bl = BladeO & { back: boolean };
  const blades: Bl[] = [];
  const bladders: [number, number, number, number, number][] = [];
  const stipes: [number, number][][] = [];
  let id = 2;
  for (let s = 0; s < nSt; s++) {
    const bx = ax + rng.range(-hw * 0.3, hw * 0.3), by = base - hh * 0.6;
    const tx = ax + lean * H * 0.14 + rng.range(-12, 12), ty = canopyY + rng.range(3, 7);
    // the column: a slow S with a little wander, every stipe its own
    const ph = rng.range(0, TAU), k = rng.range(1.1, 2.2), amp = rng.range(3, 8);
    const col: [number, number][] = [];
    for (let y = by; y >= ty; y -= 1) {
      const t = (by - y) / (by - ty);
      const e = t * t * (3 - 2 * t);
      col.push([bx + (tx - bx) * e + Math.sin(t * Math.PI * k + ph) * amp * Math.sin(t * Math.PI) + (noise1(y * 0.05, seed + s) - 0.5) * 2, y]);
    }
    // over the top: the stipe lies along the surface, trailing off downstream (or back the other way)
    const runDir = s === 0 ? ds : rng.chance(0.65) ? ds : -ds;
    const run = rng.range(34, 64) * (simple ? 0.8 : canopyK);
    const [lx, ly] = col[col.length - 1];
    const over: [number, number][] = [];
    for (let i = 1; i <= run; i++) {
      const t = i / run;
      over.push([lx + runDir * i, ly + (canopyY - ly) * Math.min(1, t * 2.6) + Math.sin(i * 0.2 + ph) * 1.1]);
    }
    stipes.push(col.concat(over));
    // blades up the column, a bladder at each one's foot; they stream downstream: the ones on the
    // downstream side stand out from the stipe, the upstream ones arch over it
    let side = rng.chance(0.5) ? 1 : -1;
    const gap = (simple ? rng.range(18, 24) : rng.range(12, 16)) * bgap;
    for (let d = hh + rng.range(4, 12); d < col.length - 6; d += gap * rng.range(0.75, 1.25)) {
      const [px, py] = col[Math.floor(d)];
      const h = 1 - py / H;
      // the oldest blades low down are short, dark and tattered; some have fallen away
      if (h < 0.2 && rng.chance(0.4)) { side = -side; continue; }
      const down = side === ds;
      const a = -Math.PI / 2 + side * (down ? rng.range(0.55, 1.05) : rng.range(0.15, 0.4));
      const bend = down ? -side * rng.range(0.05, 0.35) : ds * rng.range(0.7, 1.3);
      const len = ((simple ? 26 : 22) + rng.range(4, 16) * (0.55 + 0.6 * h)) * bln;
      const tone = 3.2 + h * 4.4 + rng.range(-0.6, 0.6);
      const back = !down && rng.chance(0.7) || rng.chance(0.2);
      const bl = Math.max(2, Math.round(2.5 + h * 1.5));
      bladders.push([px + Math.cos(a) * 1, py + Math.sin(a) * 1, a, bl, tone + 0.5]);
      blades.push({
        x: px + Math.cos(a) * (bl + 1), y: py + Math.sin(a) * (bl + 1), a, len, w: (rng.range(1.7, 2.4) + h * 0.5) * bw, bend, tone: back ? tone - 1.2 : tone,
        rp: KR, rim: KELP_RIM, ruffle: 1, rib: true, serrate: !simple, id: id++, peak: pk, glow: h > 0.55 ? (h - 0.55) / 0.45 : 0, ragged: h < 0.32 ? 0.35 : rng.chance(0.2) ? 0.2 : 0, seed: rng.int(1, 9999), back,
      });
      side = -side;
    }
    // the canopy: blades lying flat along the surface downstream of the stipe, others hanging below it
    for (let d = 3; d < over.length - 2; d += rng.range(3.5, 6)) {
      const [px, py] = over[Math.floor(d)];
      const flat = rng.chance(0.55);
      const a = flat ? (runDir > 0 ? 0 : Math.PI) + rng.range(-0.18, 0.28) * runDir : Math.PI / 2 - runDir * rng.range(0.25, 0.85);
      const len = flat ? rng.range(16, 28) : rng.range(12, 24);
      const tone = flat ? 7 + rng.range(-0.6, 0.8) : 5.6 + rng.range(-0.8, 0.8);
      const bl = rng.chance(0.6) ? 3 : 2;
      bladders.push([px, py, a, bl, tone]);
      blades.push({
        x: px + Math.cos(a) * (bl + 1), y: py + Math.sin(a) * (bl + 1), a, len, w: rng.range(1.7, 2.6), bend: flat ? rng.range(-0.2, 0.2) : runDir * rng.range(0.1, 0.5), tone,
        rp: KR, rim: KELP_RIM, ruffle: 1, rib: true, serrate: !simple, id: id++, peak: pk, glow: 1, ragged: rng.chance(0.25) ? 0.25 : 0, seed: rng.int(1, 9999), back: flat,
      });
    }
  }
  // paint: the holdfast, back blades, the stipes, their bladders, then the front blades
  holdfast(cv, rng, ax, base, hw, hh, HOLD);
  for (const b of blades) if (b.back) blade(cv, b);
  stipes.forEach((st, i) => stipe(cv, st, KR, 3.6 + i * 0.4, 2, seed + i));
  for (const [x, y, a, l, t] of bladders) bladder(cv, x, y, a, l, KR, Math.round(t), 1);
  for (const b of blades) if (!b.back) blade(cv, b);
  if (!simple) epiphytes(cv, rng, ax - hw, base - H * 0.25, ax + hw, base - hh * 0.5, 10);
  return { buf: finish(cv, o.haze ?? 0, o.water ?? 0, simple ? 0.35 : 0.5), ax, ay: base };
}

// ------------------------------------------------------------------ bull kelp (rimurapa)
/**
 * Durvillaea: a glossy disc holdfast and a short thick stipe, then a mane of thick straps streaming
 * up and over toward `lean` in the surge. Each strap undulates, twists (a narrow neck where the
 * other face shows), carries a long specular streak and a faint honeycomb, and splits at the tip.
 */
export function bullKelp(seed: number, len: number, o: KelpOpts = {}): Sprite {
  const rng = new Rng(seed * 61 + 5);
  const lean = o.lean ?? rng.range(-1, 1);
  const W = Math.round(len * 1.5 + 30), H = Math.round(len + 16);
  const ax = Math.round(W / 2 - lean * len * 0.35), base = H - 1;
  const cv = new Canvas(W, H);
  const rp = BULL;
  // the holdfast: a glossy dome gripping the rock
  const dw = rng.range(6, 8);
  for (let x = Math.floor(ax - dw); x <= ax + dw; x++) {
    const u = (x + 0.5 - ax) / dw;
    const top = base - 4.5 * Math.pow(Math.max(0, 1 - u * u), 0.5) * (0.8 + 0.3 * noise1(x * 0.5, seed));
    for (let y = Math.round(top); y <= base; y++) {
      const e = y - top;
      cv.set(x, y, at(HOLD, (u < -0.2 ? 5 : u > 0.4 ? 2 : 4) - (e > 3 ? 1 : 0) + (e < 1 ? 1 : 0)), 0);
    }
  }
  // the stipe: short and thick, cylinder-lit
  const sh = rng.range(9, 13), sw = 2.5;
  const stTop: [number, number] = [ax + lean * 3, base - 3 - sh];
  for (let y = base - 3; y >= stTop[1]; y--) {
    const t = (base - 3 - y) / sh;
    const cx = ax + lean * 3 * t * t;
    for (let v = -sw; v <= sw; v += 0.5) cv.set(cx + v, y, at(rp, 5 + (v < -0.8 ? 2 : v > 1 ? -1.5 : 0.5)), 1);
  }
  // the straps
  const n = rng.int(8, 12);
  type Strap = { pts: P3[]; w: number[]; id: number; tone: number; ph: number };
  const straps: Strap[] = [];
  for (let i = 0; i < n; i++) {
    const spread = (i / (n - 1) - 0.5) * 1.6;
    let a = -Math.PI / 2 + spread * 0.55 + lean * 0.25;
    const L = len * rng.range(0.55, 1.05);
    const turn = lean * rng.range(0.6, 1.4) + spread * 0.4;
    let x = stTop[0] + spread * 2, y = stTop[1] + 1;
    const pts: P3[] = [];
    const ws: number[] = [];
    const w0 = rng.range(2.0, 3.2);
    const ph = rng.range(0, TAU), twist = rng.range(0.25, 0.75);
    for (let s = 0; s < L; s += 0.5) {
      const t = s / L;
      pts.push([x, y, a]);
      // wide in the middle, a twisted neck somewhere along it, tapering to the split tip
      let w = w0 * (0.55 + 0.6 * Math.sin(Math.PI * Math.min(1, t * 1.25))) * (1 - t * 0.35) * (1 + 0.2 * Math.sin(s * 0.38 + ph));
      const neck = Math.abs(t - twist);
      if (neck < 0.05) w *= 0.25 + neck * 15;
      ws.push(Math.max(0.6, w));
      x += Math.cos(a) * 0.5; y += Math.sin(a) * 0.5;
      a += (turn / L) * 0.5 * (0.4 + t * 1.4) + Math.sin(s * 0.12 + ph) * 0.012;
    }
    straps.push({ pts, w: ws, id: 2 + i, tone: 5.2 + rng.range(-0.8, 1) + (Math.abs(spread) < 0.4 ? 0.6 : 0), ph: twist });
  }
  // the ones behind first: the outer straps sit behind the middle ones
  straps.sort((p, q) => Math.abs(q.pts.length) - Math.abs(p.pts.length));
  for (const S of straps) {
    const L = S.pts.length;
    for (let i = 0; i < L; i++) {
      const [cx, cy, ca] = S.pts[i];
      const t = i / L, hw = S.w[i];
      const nx = -Math.sin(ca), ny = Math.cos(ca);
      const flip = t > S.ph ? -1 : 1;
      const steps = Math.max(1, Math.ceil(hw * 2.2));
      // the split tip: two or three fingers
      const fingers = t > 0.86 ? 2 + (S.id % 2) : 1;
      for (let s = 0; s <= steps; s++) {
        const v = -hw + (2 * hw * s) / steps;
        if (fingers > 1) {
          const f = ((v / hw) * 0.5 + 0.5) * fingers;
          if (Math.abs(f - Math.round(f)) < 0.2 * (t - 0.86) * 8 && Math.round(f) > 0 && Math.round(f) < fingers) continue;
        }
        const px = Math.round(cx + nx * v), py = Math.round(cy + ny * v);
        const u = (v / hw) * flip;
        let tone = S.tone - u * 1.3;
        // the glossy streak down one side of the strap
        if (u < -0.15 && u > -0.55 && Math.sin(i * 0.05 + S.id) > -0.4) tone += 2.2;
        // honeycomb: faint cells inside
        const cell = h01(Math.round(px / 3), Math.round(py / 3), S.id) < 0.3;
        if (cell && Math.abs(u) < 0.6) tone -= 0.6;
        if (Math.abs(v) > hw - 0.7) tone -= 1.4;
        let c = at(rp, tone);
        if (Math.abs(v) > hw - 0.7 && u < 0) c = at(rp, S.tone + 2.4);
        if (cv.isFrond(px, py) && cv.frond[py * cv.b.w + px] !== S.id) c = shade(c, -0.1);
        cv.set(px, py, c, S.id);
      }
    }
    // the specular glint, a few bright pixels where the streak is widest
    const gi = Math.floor(L * rng.range(0.2, 0.5));
    const [gx, gy, ga] = S.pts[gi];
    const g = -S.w[gi] * 0.35;
    cv.set(gx - Math.sin(ga) * g, gy + Math.cos(ga) * g, rp[rp.length - 1], S.id);
  }
  return { buf: finish(cv, o.haze ?? 0, o.water ?? 0, 0.5), ax, ay: base };
}

// ------------------------------------------------------------------ stalked kelp (Ecklonia)
/** Ecklonia radiata: a claw holdfast, a stiff stipe, a crown of corrugated spiny blades flopping over */
export function stalkedKelp(seed: number, h: number, o: KelpOpts = {}): Sprite {
  const rng = new Rng(seed * 43 + 9);
  const lean = o.lean ?? rng.range(-1, 1);
  const W = Math.round(h * 1.5 + 20), H = Math.round(h + 8);
  const ax = Math.round(W / 2), base = H - 1;
  const cv = new Canvas(W, H);
  holdfast(cv, rng, ax, base, rng.range(4, 6), rng.range(3, 4.5), HOLD);
  const sl = h * rng.range(0.42, 0.55);
  const tx = ax + lean * sl * 0.25, ty = base - 3 - sl;
  const pts = curve(ax, base - 3, tx, ty, lean * rng.range(1, 3), 1, seed, 1);
  stipe(cv, pts, ECK, 5, 2, seed);
  epiphytes(cv, rng, ax - 2, ty + sl * 0.4, ax + 2, base - 4, 4);
  // the primary blade: up out of the stipe, then flopping over toward lean
  const pa = -Math.PI / 2 + lean * 0.3;
  const pl = h * rng.range(0.62, 0.78);
  const prim: BladeO = { x: tx, y: ty, a: pa, len: pl, w: rng.range(2.0, 2.6), bend: lean * rng.range(1.3, 2.1), tone: 6, rp: ECK, rim: ECK_RIM, ruffle: 1.2, rib: true, serrate: true, id: 2, peak: 0.5, seed: rng.int(1, 999) };
  // laterals along both sides of the primary, combed toward its tip, some behind it and some in front
  const path: P3[] = [];
  {
    let x = tx, y = ty, a = pa;
    const n = Math.ceil(pl * 2);
    for (let i = 0; i <= n; i++) { path.push([x, y, a]); x += Math.cos(a) * 0.5; y += Math.sin(a) * 0.5; a += (prim.bend / n) * (0.6 + 0.8 * (i / n)); }
  }
  const lats: (BladeO & { side: number })[] = [];
  let id = 3;
  for (let t = 0.1; t < 0.86; t += rng.range(0.08, 0.12)) {
    const [px, py, pa2] = path[Math.floor(t * (path.length - 1))];
    for (const side of [-1, 1]) {
      if (rng.chance(0.12)) continue;
      const a = pa2 + side * rng.range(0.32, 0.62);
      lats.push({ x: px, y: py, a, len: h * rng.range(0.26, 0.42) * (1 - t * 0.45), w: rng.range(1.5, 2.1), bend: prim.bend * 0.35 + side * rng.range(0.05, 0.3), tone: 5.4 + rng.range(-0.7, 0.7), rp: ECK, rim: ECK_RIM, ruffle: 1, rib: false, serrate: true, id: id++, seed: rng.int(1, 999), ragged: rng.chance(0.3) ? 0.3 : 0, peak: 0.4, side });
    }
  }
  // the side turned away from the light is behind the primary, darker
  const far = lean >= 0 ? -1 : 1;
  for (const l of lats) if (l.side === far) blade(cv, { ...l, tone: l.tone - 1.3 });
  blade(cv, prim);
  for (const l of lats) if (l.side !== far) blade(cv, l);
  return { buf: finish(cv, o.haze ?? 0, o.water ?? 0, 0.5), ax, ay: base };
}

// ------------------------------------------------------------------ seagrass (karepō)
/** a tuft of seagrass: ribbon blades with a lit edge, yellowing tips, a few epiphyte specks */
export function seagrass(seed: number, h: number, n: number, o: KelpOpts = {}): Sprite {
  const rng = new Rng(seed * 29 + 3);
  const lean = o.lean ?? rng.range(-0.5, 0.5);
  const W = Math.round(n * 2.4 + h * 0.9 + 6), H = Math.round(h + 3);
  const ax = Math.round(W / 2 - lean * h * 0.25), base = H - 1;
  const cv = new Canvas(W, H);
  const list = Array.from({ length: n }, (_, i) => ({ i, k: rng.next() }));
  list.sort((a, b) => a.k - b.k);
  for (const { i } of list) {
    const x0 = ax + (i - (n - 1) / 2) * 1.1 + rng.range(-0.6, 0.6);
    const L = h * rng.range(0.45, 1);
    const spread = (i / Math.max(1, n - 1) - 0.5) * 0.9;
    let a = -Math.PI / 2 + spread * 0.5 + lean * 0.2;
    const turn = (lean * 1.2 + spread * 0.8) * rng.range(0.6, 1.3);
    const w2 = rng.chance(0.6);
    const tone = 5 + rng.range(-1.2, 1.4);
    let x = x0, y = base;
    for (let s = 0; s < L; s += 0.5) {
      const t = s / L;
      const nx = -Math.sin(a);
      const lit = nx < 0 ? 0 : 1;
      let tn = tone + (t > 0.8 ? 1.5 : 0) + (t < 0.12 ? -1.5 : 0);
      let c = at(GRASS, tn);
      if (t > 0.86 && rng.chance(0.5)) c = mix(c, hex('#d8c870'), 0.5);
      cv.set(x, y, c, 1);
      if (w2 && t < 0.85) cv.set(x + (lit ? 1 : -1), y, at(GRASS, tn - 1.5), 1);
      x += Math.cos(a) * 0.5; y += Math.sin(a) * 0.5;
      a += (turn / L) * 0.5 * (0.3 + t * 1.6);
    }
  }
  epiphytes(cv, rng, ax - n, base - h * 0.8, ax + n, base - h * 0.3, Math.round(n * 0.4));
  // sand heaped at the foot
  for (let x = Math.round(ax - n * 0.7); x <= ax + n * 0.7; x++) if (h01(x, 0, seed) < 0.7) cv.set(x, base, hex('#a8946a'), 0);
  return { buf: finish(cv, o.haze ?? 0, o.water ?? 0, 0.4), ax, ay: base };
}

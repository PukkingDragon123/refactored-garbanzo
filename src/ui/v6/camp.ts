// V6 camp close-ups: the island camp's two jobs rebuilt as full-screen, UI-free shots in the style of
// the ramen pour.
//
// Hold the tent pole: a low 3D camera on the sand at sunset. Beach, sea, tent and sky are ray-cast per
// pixel into a painted palette (sand ripples catching the low sun, long shadows, a sky panorama with
// clouds, a wreck on the reef, palms and the treeline). A campfire burns off to one side. Mori's hands
// hold the swaying pole while Joshu's hairy forearm swings a caulking mallet over the peg. Press as the
// pole comes upright and the peg drives home; the camera then orbits round the pole to the next guy line.
//
// Lash the frame: two driftwood poles crossed in front of a soft, out-of-focus dusk camp. Aroha's hand
// shows each move, then Mori wraps the flax cord over, under and around the joint and pulls it tight.
// Each prompt is a small arrow glyph drawn into the shot.

import { openCloseup, CW, CH, rgb, hx as hx0, mixc, put, blend, add, ramp, dith, hash, R, G, B } from './closeup';
import { Hold, loop } from '../v4/mini';
import { audio } from '../../core/audio';
import { pxIcon } from '../pxicons';

// ------------------------------------------------------------------ shared palettes & helpers
const HXC = new Map<string, number>();
const hx = (h: string) => { let c = HXC.get(h); if (c === undefined) { c = hx0(h); HXC.set(h, c); } return c; };
const P = (a: string[]) => a.map(hx);
const INK = hx('#1a1014');
const SKIN = P(['#8c392f', '#ba805d', '#d49672', '#f3a572', '#f8c090']);
const SLEEVE = P(['#1c181a', '#2e282a', '#403a3c', '#555052', '#6c6668', '#858082', '#a29a96']);
const JSKIN = P(['#4a1c14', '#742e22', '#9c4a36', '#bc6a50', '#d4886a', '#e6a684', '#f4c4a0']);
const JHAIR = hx('#3a1c12');
const KNIT = P(['#0e1226', '#1a2240', '#303a5a', '#43507a', '#5a6a96']);
const MALLET = P(['#2a180c', '#462a14', '#664020', '#86582e', '#a47442', '#c4965e']);
const IRON = P(['#141418', '#26262e', '#3e3e48', '#62606c', '#9894a0']);
const POLE = P(['#2a1c14', '#48301f', '#684a30', '#886644', '#a88458', '#c6a26e', '#e2c28c']);
const PEG = P(['#3a2616', '#5e4026', '#86623a', '#aa844e', '#c8a468', '#e4c68c', '#f4e0b0']);
const ROPE = P(['#3a2a18', '#62482c', '#8c6c44', '#b4925e', '#d4b680', '#ecd6a4']);
const SAND = P(['#34243c', '#503448', '#704a56', '#926262', '#b27c6a', '#cc9672', '#e2b07e', '#f2ca92', '#fce2ae']);
const CANVAS = P(['#261e2a', '#3e3236', '#5a4840', '#7a624c', '#9a7c5a', '#b8966a', '#d2b07e', '#e8ca96']);
const FLAME = P(['#6a1a10', '#b0321a', '#e0621e', '#fa9a32', '#ffd062', '#fff4c8']);
const STONE = P(['#1a1420', '#2c2230', '#443440', '#5e4a50', '#7a6260']);
const AROHA = P(['#4a2616', '#6e3e26', '#96603c', '#b67a52', '#c8885e', '#daa276', '#ecbe94']);
const WARMC = hx('#ff9a48');
const TWIG = P(['#5a4a4c', '#8a7a74', '#b8aa9c']), CHAR = P(['#1a1216', '#2e2224', '#4a3632', '#6a4e44']), BARK = P(['#2a1a14', '#3e2a1e', '#5a3e2a', '#76543a']);
const TAN_R = P(['#3a1208', '#6a2414', '#9a3a1e', '#c05a2e']), TAN_K = P(['#0e0a0a', '#1e1614', '#302420']), TAN_W = P(['#8a7e6a', '#c8baa0', '#ece0c8']);
const JOSHU = '#2c3a5a', AROHA_C = '#8a4a24';

const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const frac = (v: number) => v - Math.floor(v);
const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
/** smooth value noise 0..1 */
function vn(x: number, y: number, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const angd = (a: number, b: number) => { let d = (a - b) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; };

/** lights in screen space (x right, y down, z toward the viewer), set per frame */
const LIT = { sx: 0, sy: 0, sz: 1, si: 1, rx: 0, ry: 0, fx: 0, fy: 0, fz: 1, fi: 0, amb: 0.3, px: 0, py: 0, pi: 0 };
let gWarm = 0, gPink = 0;
function lit(nx: number, ny: number, nz: number) {
  const s = nx * LIT.sx + ny * LIT.sy + nz * LIT.sz;
  const f = nx * LIT.fx + ny * LIT.fy + nz * LIT.fz;
  const sd = s > 0 ? s * LIT.si : 0, fd = f > 0 ? f * LIT.fi : 0;
  // rim: a light behind the subject catches the silhouette edges facing it
  let rim = 0;
  if (LIT.sz < 0.3) { const e = nx * LIT.rx + ny * LIT.ry; if (e > 0) rim = e * Math.pow(1 - nz, 0.75) * LIT.si * (0.3 - LIT.sz) * 0.8; }
  // the campfire behind the subject rims it too
  if (LIT.fz < 0.1 && LIT.fi > 0) { const fl = Math.hypot(LIT.fx, LIT.fy) || 1, e = (nx * LIT.fx + ny * LIT.fy) / fl; if (e > 0) rim += e * Math.pow(1 - nz, 0.8) * LIT.fi * (0.1 - LIT.fz) * 1.6; }
  // a second, cool rim from the sky
  let pk = 0;
  if (LIT.pi > 0) { const e = nx * LIT.px + ny * LIT.py; if (e > 0) pk = e * (1 - nz) ** 1.5 * LIT.pi; }
  gWarm = fd * 0.6 + sd * 0.3 + rim * 1.3;
  gPink = pk;
  return LIT.amb - ny * 0.12 + sd * 0.5 + fd * 0.46 + rim + pk * 0.5 - (1 - nz) * (1 - nz) * 0.26;
}
const PINKC = hx('#f0a0c0');
function shadeC(pal: number[], b: number, x: number, y: number) {
  let c = ramp(pal, b, x, y);
  if (gWarm > 0.04) c = mixc(c, WARMC, Math.min(0.5, gWarm * 0.45));
  if (gPink > 0.04) c = mixc(c, PINKC, Math.min(0.35, gPink * 0.45));
  return c;
}

type Shade = (t: number, v: number, nx: number, ny: number, nz: number, x: number, y: number) => number;
interface CapOpt { ink?: boolean; caps?: boolean; clip?: (x: number, y: number) => boolean }
/** a tapered capsule from (x0,y0) to (x1,y1) with cylindrical normals and a 1px ink outline */
function capsule(buf: Uint32Array, x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, shade: Shade | null, o: CapOpt = {}) {
  const ink = o.ink !== false && shade !== null ? 1 : 0;
  const caps = o.caps !== false;
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-6, L = Math.sqrt(L2);
  const px = -dy / L, py = dx / L;
  const rm = Math.max(r0, r1) + ink + 1;
  const xa = Math.max(0, Math.floor(Math.min(x0, x1) - rm)), xb = Math.min(CW - 1, Math.ceil(Math.max(x0, x1) + rm));
  const ya = Math.max(0, Math.floor(Math.min(y0, y1) - rm)), yb = Math.min(CH - 1, Math.ceil(Math.max(y0, y1) + rm));
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const cx = x + 0.5 - x0, cy = y + 0.5 - y0;
    const t = (cx * dx + cy * dy) / L2;
    if (!caps && (t < 0 || t > 1)) continue;
    const tc = t < 0 ? 0 : t > 1 ? 1 : t;
    const r = r0 + (r1 - r0) * tc;
    const qx = cx - dx * tc, qy = cy - dy * tc, d2 = qx * qx + qy * qy;
    const ro = r + ink;
    if (d2 > ro * ro) continue;
    if (o.clip && !o.clip(x, y)) continue;
    const i = y * CW + x;
    if (d2 > r * r || !shade) { buf[i] = INK; continue; }
    const v = (qx * px + qy * py) / r;
    let nx: number, ny: number, nz: number;
    if (t < 0 || t > 1) { const d = Math.sqrt(d2) / r; nx = qx / r; ny = qy / r; nz = Math.sqrt(Math.max(0, 1 - d * d)); }
    else { nx = px * v; ny = py * v; nz = Math.sqrt(Math.max(0, 1 - v * v)); }
    buf[i] = shade(t, v, nx, ny, nz, x, y);
  }
}
/** a rope/cord along a polyline: ink pass first so the segments join without seams. `shade` gets arc length */
function cord(buf: Uint32Array, pts: number[], r: number, shade: Shade, clip?: (x: number, y: number) => boolean) {
  for (let i = 0; i + 3 < pts.length; i += 2) capsule(buf, pts[i], pts[i + 1], pts[i + 2], pts[i + 3], r + 1, r + 1, null, { clip });
  let s = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const len = Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]), s0 = s;
    capsule(buf, pts[i], pts[i + 1], pts[i + 2], pts[i + 3], r, r, (t, v, nx, ny, nz, x, y) => shade(s0 + t * len, v, nx, ny, nz, x, y), { ink: false, clip });
    s += len;
  }
}
/** a rotated ellipse; shade gets local u,v in -1..1 */
function ellipse(buf: Uint32Array, cx: number, cy: number, rx: number, ry: number, rot: number, shade: (u: number, v: number, x: number, y: number) => number, ink = true) {
  const c = Math.cos(rot), s = Math.sin(rot), m = Math.max(rx, ry) + 2;
  for (let y = Math.floor(cy - m); y <= cy + m; y++) for (let x = Math.floor(cx - m); x <= cx + m; x++) {
    if (x < 0 || y < 0 || x >= CW || y >= CH) continue;
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    const lx = dx * c + dy * s, ly = -dx * s + dy * c;
    const u = lx / rx, v = ly / ry;
    if (u * u + v * v <= 1) buf[y * CW + x] = shade(u, v, x, y);
    else if (ink && (lx / (rx + 1)) ** 2 + (ly / (ry + 1)) ** 2 <= 1) buf[y * CW + x] = INK;
  }
}
function vignette(k: number): Float32Array {
  const v = new Float32Array(CW * CH);
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const d = ((x - CW / 2) / (CW * 0.62)) ** 2 + ((y - CH / 2) / (CH * 0.68)) ** 2;
    v[y * CW + x] = d > 0.45 ? Math.min(k, (d - 0.45) * 0.9) : 0;
  }
  return v;
}
function applyVignette(buf: Uint32Array, vig: Float32Array) {
  for (let i = 0; i < buf.length; i++) {
    const k = vig[i];
    if (k <= 0) continue;
    const c = buf[i];
    buf[i] = rgb(R(c) * (1 - k), G(c) * (1 - k * 1.06), B(c) * (1 - k * 0.94));
  }
}
function shakeBuf(buf: Uint32Array, tmp: Uint32Array, ox: number, oy: number) {
  if (!ox && !oy) return;
  tmp.set(buf);
  for (let y = 0; y < CH; y++) {
    const sy = Math.max(0, Math.min(CH - 1, y - oy));
    for (let x = 0; x < CW; x++) buf[y * CW + x] = tmp[sy * CW + Math.max(0, Math.min(CW - 1, x - ox))];
  }
}

// ================================================================== HOLD STEADY: the tent pole

const FOC = 260, PX0 = 150, HY = 58, HC = 0.5, RC = 1.41;
const SUN_AZ = -0.22, SUN_EL = 0.035, TAN_E = Math.tan(SUN_EL);
const SHX = Math.sin(SUN_AZ), SHZ = Math.cos(SUN_AZ);
const SUNV = [SHX * Math.cos(SUN_EL), Math.sin(SUN_EL), SHZ * Math.cos(SUN_EL)];
const RSUN = HY - TAN_E * FOC;
const FIRE_X = -Math.sin(2.4) * 1.41 + Math.sin(2.4 - 0.3) * 6, FIRE_Z = -Math.cos(2.4) * 1.41 + Math.cos(2.4 - 0.3) * 6;
// the tent: a ridge tent whose front pole is the one Mori holds, running off along TA
const TA = 0.6, TAX = Math.sin(TA), TAZ = Math.cos(TA), TNX = Math.cos(TA), TNZ = -Math.sin(TA);
const TH = 1.6, TL = 2.6, TW = 1.25, TK = TW / TH, HEM = 0.86;
const VIEWS = [0, 1.2, 2.4];
const PW = Math.round(2 * Math.PI * FOC), PR0 = 6, PH = HY + PR0 + 3;
const POLE_TOP = 1.55;

const SKY_S = P(['#fff2c0', '#ffd88c', '#fcb468', '#f08c58', '#d06c5c', '#a05066', '#6c3a62', '#452a58', '#2a1e48']);
const SKY_A = P(['#f4b4a4', '#e2989c', '#c27e96', '#9a668e', '#724e84', '#523e74', '#3a2e62', '#2a2450', '#1e1a40']);
const FOL = P(['#141424', '#1e1c30', '#2a263c', '#3e3046', '#56404e', '#725254']);
const DUNE = P(['#3a2a42', '#563c50', '#76505c', '#966864', '#b6806c']);
const ROCKP = P(['#1c1626', '#2a2234', '#3e3044', '#56404e']);
const SEA = hx('#2c2446');

interface Cam { yaw: number; fx: number; fz: number; rx: number; rz: number; cx: number; cy: number; cz: number }
function mkCam(yaw: number): Cam {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  return { yaw, fx, fz, rx: fz, rz: -fx, cx: -fx * RC, cy: HC, cz: -fz * RC };
}
const PJ = [0, 0, 0];
function proj(c: Cam, X: number, Y: number, Z: number) {
  const dx = X - c.cx, dy = Y - c.cy, dz = Z - c.cz;
  const zc = dx * c.fx + dz * c.fz, xc = dx * c.rx + dz * c.rz;
  PJ[0] = PX0 + FOC * xc / zc; PJ[1] = HY - FOC * dy / zc; PJ[2] = zc;
  return PJ;
}

// ------------------------------------------------------------------ the sky panorama (sky, clouds, sun, far land)
function paintPano(): Uint32Array {
  const p = new Uint32Array(PW * PH);
  const land = new Float32Array(PW), kind = new Uint8Array(PW), tree = new Float32Array(PW);
  for (let c = 0; c < PW; c++) {
    const az = c / PW * 2 * Math.PI, a0 = angd(az, 0), a = Math.abs(a0);
    let h = 0, k = 0;
    if (a < 0.95) { const q = (a0 + 0.36) / 0.11; if (Math.abs(q) < 1) { h = (1 - q * q) * 3.4 + vn(c / 3, 0, 5) * 0.8; k = 1; } }
    else if (a < 1.85) { h = Math.min(1, (a - 0.95) / 0.45) * (7 + vn(c / 9, 1, 3) * 7 + vn(c / 3, 2, 3) * 2.5); k = 2; }
    else { h = 3.5 + Math.sin(c * 0.021) * 1.5 + vn(c / 12, 3, 4) * 3; k = 3; tree[c] = clamp((a - 1.85) / 0.3) * (8 + vn(c / 16, 9) * 12 + vn(c / 4, 10) * 4); }
    land[c] = h; kind[c] = k;
  }
  const CL: [number, number, number, number][] = [[14, 5, 60, 1], [30, 4, 44, 2], [42, 3, 30, 3], [22, 3, 80, 4]];
  for (let j = 0; j < PH; j++) {
    const r = j - PR0;
    const g = clamp((HY - r) / (HY + PR0));
    const tt = Math.pow(g, 0.72);
    for (let c = 0; c < PW; c++) {
      const az = c / PW * 2 * Math.PI, dS = angd(az, SUN_AZ);
      const w = ((Math.cos(dS) + 1) / 2) ** 2.2;
      let col = mixc(ramp(SKY_A, tt, c, j), ramp(SKY_S, tt, c, j), w);
      const sx = dS * FOC, sy = r - RSUN;
      const sd = Math.hypot(sx, sy * 1.7);
      if (sd < 80) col = mixc(col, hx('#fff0c4'), (1 - sd / 80) ** 2.4 * 0.8);
      // streaky dusk clouds: dark plum against the sun, lit pink away from it, gold undersides
      for (const [rc, th, sc, seed] of CL) {
        const yc = rc + Math.sin(c * 0.0041 + seed) * 5 + (vn(c / 90, seed) - 0.5) * 6;
        const dy = (r - yc) / th;
        if (Math.abs(dy) > 1.7) continue;
        const n = vn(c / sc, seed * 3) * 0.65 + vn(c / (sc * 0.28), seed * 3 + 7) * 0.35;
        const dens = n - 0.5 - dy * dy * 0.3 + (seed === 4 ? -0.08 : 0);
        if (dens <= 0) continue;
        const body = mixc(hx('#d88c98'), hx('#6e3456'), w), top = mixc(hx('#a86a88'), hx('#50284a'), w);
        const rim = mixc(hx('#ffd6c4'), hx('#ffe6a0'), w);
        if (dens < 0.05) col = mixc(col, body, 0.45);
        else if (dy > 0.25 && dens < 0.16) col = rim;
        else col = ramp([top, body, body], 0.5 + dy * 0.4, c, j);
      }
      if (w < 0.2 && r < 30 && hash(c, j, 77) > 0.9935) col = hash(c, j, 78) > 0.5 ? hx('#fff6ea') : hx('#c8b8e0');
      // the sun just kissing the sea, barred by thin cloud
      const s2 = Math.hypot(sx, sy * 1.1);
      if (s2 < 8.6) {
        col = s2 > 7.6 ? hx('#ffd488') : mixc(hx('#fffbe4'), hx('#ffb458'), clamp((sy + 8) / 16));
        if (Math.abs(sy - 3.4) < 0.6 || Math.abs(sy + 2.6) < 0.5) col = mixc(col, hx('#e0785a'), 0.6);
      }
      // far land
      const hl = land[c], k = kind[c];
      if (k === 3 && tree[c] > 0 && r > HY - hl - tree[c] && r <= HY) {
        const top = (HY - hl - tree[c]);
        const b = 0.18 + (1 - w) * 0.28 * clamp(1 - (r - top) / 6) + (vn(c / 2.2, r / 2, 12) - 0.5) * 0.14;
        col = mixc(ramp(FOL, b, c, j), col, 0.22);
      }
      if (r > HY - hl && r <= HY) {
        const top = HY - hl;
        if (k === 3) col = ramp(DUNE, 0.3 + (1 - w) * 0.38 - (r - top) * 0.03 + (r - top < 1 ? 0.12 : 0), c, j);
        else if (k === 2) { col = ramp(ROCKP, 0.3 + (vn(c / 4, r / 3, 6) - 0.5) * 0.35 + (1 - w) * 0.25, c, j); if (r - top < 1.2) col = mixc(col, hx('#e08a5a'), 0.2 + w * 0.5); }
        else { col = mixc(col, hx('#5e4266'), 0.82); if (r - top < 1) col = mixc(col, hx('#f0a070'), 0.6); }
      }
      p[j * PW + c] = col;
    }
  }
  const pp = (c: number, r: number, col: number) => { const j = Math.round(r) + PR0; if (j < 0 || j >= PH) return; p[j * PW + (((Math.round(c) % PW) + PW) % PW)] = col; };
  // the wreck on the reef: the little boat, broken-backed, mast leaning
  const wc = 0.42 / (2 * Math.PI) * PW;
  for (let x = -9; x <= 9; x++) for (let y = 0; y < 4; y++) if (Math.abs(x) < 9 - y * 1.2 + (x < 0 ? 0 : -1)) pp(wc + x, HY - y + (x > 3 ? 1 : 0), y === 3 ? hx('#f0a070') : hx('#2a1e36'));
  for (let s = 0; s < 14; s++) pp(wc - 2 + s * 0.42, HY - 3 - s, hx('#2a1e36'));
  for (let s = 0; s < 7; s++) pp(wc - 1 + s, HY - 10 + s * 0.3, hx('#3a2a44'));
  // palms against the treeline
  const PALMS: [number, number, number][] = [[2.12, 36, 0.4], [2.9, 44, -0.35], [2.02, 26, -0.3], [2.6, 34, 0.5], [2.75, 28, -0.4], [3.35, 40, 0.3], [3.5, 30, -0.6], [3.95, 36, 0.45], [4.4, 42, -0.3], [4.62, 30, 0.6], [5.0, 26, -0.4]];
  for (const [az, h, lean] of PALMS) {
    const c0 = az / (2 * Math.PI) * PW, base = HY - land[Math.round(c0) % PW];
    const w = ((Math.cos(angd(az, SUN_AZ)) + 1) / 2) ** 2.2;
    const dark = mixc(FOL[1], FOL[2], 0.5), lite = mixc(FOL[4], hx('#c07860'), (1 - w) * 0.5);
    let cx = c0, cy = base;
    // a curving ringed trunk, thicker at the foot
    for (let s = 0; s <= 1; s += 1 / (h * 1.5)) {
      cx = c0 + lean * s * s * h * 0.45; cy = base - s * h;
      const wd = s < 0.25 ? 2 : 1;
      for (let q = -1; q <= wd; q++) pp(cx + q, cy, dark);
      if (Math.round(s * h) % 3 === 0) pp(cx + (lean > 0 ? wd : -1), cy, lite);
    }
    // the crown: arching fronds hung with leaflets
    for (let f = 0; f < 9; f++) {
      const a = -Math.PI + 0.2 + f * (Math.PI - 0.4) / 8 + Math.sin(f * 7.1 + az) * 0.12, len = 11 + hash(f, Math.round(az * 10)) * 7;
      for (let l = 0; l < len; l += 0.5) {
        const k = l / len;
        const fx = cx + Math.cos(a) * l, fy = cy + Math.sin(a) * l * 0.6 + k * k * len * 0.6;
        pp(fx, fy, dark);
        if (l > 1.5 && Math.round(l * 2) % 2 === 0) {
          const ll = (1 - k) * 3 + 1;
          for (let q = 1; q <= ll; q++) { pp(fx - Math.cos(a) * q * 0.3, fy + q, dark); pp(fx + Math.cos(a) * q * 0.2 + (Math.cos(a) > 0 ? 1 : -1), fy + q * 0.8, dark); }
        }
        if (Math.sin(a) < -0.2 && l > 2 && Math.round(l * 2) % 3 === 0) pp(fx, fy - 1, lite);
      }
    }
    for (let q = -1; q <= 1; q++) pp(cx + q, cy + 1, dark);
  }
  // dune grass tufts
  for (let c = 0; c < PW; c++) if (kind[c] === 3 && hash(c, 3, 41) > 0.82) {
    const top = HY - land[c], h = 2 + hash(c, 4, 41) * 3;
    for (let k = 0; k < h; k++) pp(c + (k > 1 ? (hash(c, 5) > 0.5 ? 1 : -1) : 0), top - k, hx('#3a2e3e'));
  }
  return p;
}
function panoAt(pano: Uint32Array, col: number, r: number) {
  let j = Math.round(r) + PR0; if (j < 0) j = 0; else if (j >= PH) j = PH - 1;
  return pano[j * PW + ((((col | 0) % PW) + PW) % PW)];
}

// ------------------------------------------------------------------ tent ray cast
// the tent is a canvas fly pitched high on the ridge line: two sloping panels, open ends, the hem
// well above the sand so the guy lines and the sea show underneath
let tFace = 0, tAl = 0, tLat = 0, tY = 0, tIn = false;
function tentRay(cx: number, cy: number, cz: number, dx: number, dy: number, dz: number) {
  const cA = cx * TAX + cz * TAZ, dA = dx * TAX + dz * TAZ;
  const cN = cx * TNX + cz * TNZ, dN = dx * TNX + dz * TNZ;
  let best = Infinity;
  for (let s = -1; s <= 1; s += 2) {
    const den = s * dN + TK * dy;
    if (Math.abs(den) < 1e-9) continue;
    const t = (TW - s * cN - TK * cy) / den;
    if (t <= 0 || t >= best) continue;
    const al = cA + t * dA, y = cy + t * dy;
    if (al < 0 || al > TL || y > TH || y < HEM + Math.sin(al * 7.5) * 0.012) continue;
    best = t; tFace = s < 0 ? 0 : 1; tAl = al; tLat = cN + t * dN; tY = y; tIn = den > 0;
  }
  // the triangular gables at either end, above the hem
  if (Math.abs(dA) > 1e-9) for (let f = 2; f <= 3; f++) {
    const t = ((f === 2 ? 0 : TL) - cA) / dA;
    if (t <= 0 || t >= best) continue;
    const y = cy + t * dy, lat = cN + t * dN;
    if (y < HEM + 0.04 || y > TH || Math.abs(lat) > TW * (1 - y / TH)) continue;
    best = t; tFace = f; tAl = f === 2 ? 0 : TL; tLat = lat; tY = y; tIn = f === 2 ? dA < 0 : dA > 0;
  }
  return best;
}
function tentColor(cam: Cam, x: number, y: number) {
  const s = tFace === 0 || tFace === 2 ? -1 : 1, l = Math.hypot(1, TK);
  const nx = tFace < 2 ? s * TNX / l : s * TAX, nz = tFace < 2 ? s * TNZ / l : s * TAZ, ny = tFace < 2 ? TK / l : 0;
  if (tIn) {
    // the underside: dim canvas, warmed by a hurricane lantern hanging from the ridge
    const ld = Math.hypot(tAl - 1.3, tLat, tY - 1.2);
    const lan = 0.9 / (1 + ld * ld * 3);
    const b = 0.34 + lan * 0.5 - (tY - HEM) * 0.32 + (Math.abs(tAl - 0.8) < 0.014 || Math.abs(tAl - 1.6) < 0.014 ? -0.1 : 0) + (tY - HEM < 0.05 ? -0.08 : 0) + (vn(tAl * 3, tY * 4, 22) - 0.5) * 0.1;
    return mixc(ramp(CANVAS, b, x, y), hx('#ffa048'), Math.min(0.5, lan * 0.7 + 0.08));
  }
  const sx = nx * cam.rx + nz * cam.rz, sy = -ny, sz = -(nx * cam.fx + nz * cam.fz);
  let b = lit(sx, sy, sz) + 0.06;
  // canvas: sagging between the ties, seams with stitching, a hem, a faded blue patch, weave
  b += tFace < 2 ? Math.sin(tAl * 2.6 + tY * 3.2) * 0.035 : Math.sin(tLat * 9) * 0.03 - (Math.abs(tLat) < 0.03 ? 0.1 : 0);
  b += (vn(tAl * 2.2, tY * 3 + tFace * 7, 21) - 0.5) * 0.1;
  b += (hash(Math.floor(tAl * 150), Math.floor(tY * 150), tFace) - 0.5) * 0.05;
  for (const sm of [0.8, 1.6]) if (Math.abs(tAl - sm) < 0.014) b -= 0.12; else if (Math.abs(tAl - sm - 0.028) < 0.008 && Math.floor(tY * 40) % 2 === 0) b += 0.08;
  if (Math.abs(tY - TH) < 0.03) b += 0.1;
  const hem = tY - HEM;
  if (hem < 0.06) b -= 0.08 + (hem < 0.02 ? 0.08 : 0);
  let c = shadeC(CANVAS, b, x, y);
  if (hem < 0.05 && hem > 0.015 && Math.abs(frac(tAl / 0.4) - 0.5) < 0.04) c = ramp(IRON, 0.7, x, y);
  if (tFace === 0 && tAl > 1.05 && tAl < 1.4 && tY > 1.02 && tY < 1.3) {
    const edge = tAl < 1.07 || tAl > 1.38 || tY < 1.04 || tY > 1.28;
    c = mixc(c, hx(edge ? '#3a4a5a' : '#6a8aa0'), edge ? 0.5 : 0.45);
  }
  return c;
}

// ------------------------------------------------------------------ the beach
interface Decal { x: number; z: number; r: number; rot: number; kind: number; s: number }
function makeDecals(): Decal[] {
  const d: Decal[] = [];
  VIEWS.forEach((yaw, i) => {
    const c = mkCam(yaw);
    const at = (rt: number, fw: number) => [c.rx * rt + c.fx * fw, c.rz * rt + c.fz * fw];
    // Joshu's bootprints by the peg, Mori's knee dents by the pole
    for (const [rt, fw, k] of [[0.86, 0.12, 0], [1.02, 0.46, 0], [0.7, 0.62, 0], [-0.3, -0.3, 1], [-0.45, -0.05, 1]] as const) {
      const [x, z] = at(rt, fw);
      d.push({ x, z, r: k === 0 ? 0.16 : 0.08, rot: yaw + (k === 0 ? 0.3 : 0) + hash(i, rt * 10) * 0.4, kind: k, s: i });
    }
  });
  for (let i = 0; i < 70; i++) {
    const a = hash(i, 1, 9) * Math.PI * 2, r = 0.35 + Math.sqrt(hash(i, 2, 9)) * 4.5;
    const k = hash(i, 3, 9);
    d.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, r: 0.06, rot: hash(i, 4, 9) * 6.28, kind: k < 0.4 ? 2 : k < 0.72 ? 3 : k < 0.86 ? 4 : 5, s: i });
  }
  return d;
}
const DECALS = makeDecals();
// a coarse grid over the beach so each ground pixel only tests the decals near it
const DG = 0.3, DN = 40, DO = DN / 2;
const DGRID: Decal[][] = Array.from({ length: DN * DN }, () => []);
for (const d of DECALS) for (let j = Math.floor((d.z - d.r) / DG); j <= Math.floor((d.z + d.r) / DG); j++) for (let i = Math.floor((d.x - d.r) / DG); i <= Math.floor((d.x + d.r) / DG); i++) {
  if (i + DO >= 0 && i + DO < DN && j + DO >= 0 && j + DO < DN) DGRID[(j + DO) * DN + i + DO].push(d);
}
const NO_DECALS: Decal[] = [];
const SHORE = (x: number) => 17 + Math.sin(x * 0.21) * 1.2 + Math.sin(x * 0.07 + 1) * 2;

interface Peg { x: number; z: number; h: number; target: number; lean: number; twang: number; bruise: number }

/** is the ground point in a cast shadow (0..1)? the pole, the pegs and the tent, from a sun on the horizon */
function shadowAt(gx: number, gz: number, pegs: Peg[]) {
  const along = -(gx * SHX + gz * SHZ), lat = Math.abs(gx * SHZ - gz * SHX);
  if (along > 0 && along < POLE_TOP / TAN_E && lat < 0.024 + along * 0.003) return 1;
  for (const p of pegs) {
    const px = gx - p.x, pz = gz - p.z, al = -(px * SHX + pz * SHZ);
    if (al > 0 && al < p.h / TAN_E && Math.abs(px * SHZ - pz * SHX) < 0.017 + al * 0.002) return 1;
  }
  // the tent prism: does the ray toward the sun pass through it?
  const al0 = gx * TAX + gz * TAZ, la0 = gx * TNX + gz * TNZ;
  const da = SHX * TAX + SHZ * TAZ, dl = SHX * TNX + SHZ * TNZ, m = TK * TAN_E;
  let lo = HEM / TAN_E, hi = TH / TAN_E;
  if (Math.abs(da) < 1e-9) { if (al0 < 0 || al0 > TL) return 0; }
  else { const s1 = -al0 / da, s2 = (TL - al0) / da; lo = Math.max(lo, Math.min(s1, s2)); hi = Math.min(hi, Math.max(s1, s2)); }
  const k1 = dl + m, k2 = m - dl;
  if (k1 > 1e-9) hi = Math.min(hi, (TW - la0) / k1); else if (k1 < -1e-9) lo = Math.max(lo, (TW - la0) / k1); else if (TW - la0 < 0) return 0;
  if (k2 > 1e-9) hi = Math.min(hi, (TW + la0) / k2); else if (k2 < -1e-9) lo = Math.max(lo, (TW + la0) / k2); else if (TW + la0 < 0) return 0;
  return lo < hi ? 1 : 0;
}

function sandColor(gx: number, gz: number, dist: number, x: number, y: number, pegs: Peg[], t: number, pano: Uint32Array, col: number, rm: number, az: number) {
  const shore = SHORE(gx), wave = Math.sin(t * 0.8 + gx * 0.05) * 0.55 + Math.sin(t * 1.9) * 0.15;
  if (gz > shore + wave) {
    // the sea: the sky mirrored, wave streaks, the sun's glitter path and a foam line at the edge
    const refl = panoAt(pano, col, rm);
    let c = mixc(refl, SEA, 0.42);
    const wv = Math.sin(gz * 2.6 + gx * 0.35 + t * 1.3 + vn(gx * 0.4, gz * 0.8, 3) * 5);
    if (wv > 0.72) c = mixc(c, refl, 0.5); else if (wv < -0.75) c = mixc(c, SEA, 0.5);
    const dS = Math.abs(angd(az, SUN_AZ));
    if (dS < 0.035 + (y - HY) * 0.006 && hash(x, y, Math.floor(t * 6)) > 0.5 - (0.04 - dS) * 6) c = mixc(c, hx('#ffe6a0'), 0.9);
    const e = gz - (shore + wave);
    if (e < 0.6 && hash(x >> 1, y, Math.floor(t * 3)) < 1.1 - e / 0.6) c = mixc(hx('#f6dcd2'), c, e / 0.9);
    return c;
  }
  let b = 0.46 + (vn(gx * 0.7, gz * 0.7, 1) - 0.5) * 0.14 + (vn(gx * 5, gz * 5, 2) - 0.5) * 0.06;
  const fade = clamp(1.7 - dist / 3.2);
  // wind ripples, their faces catching the low sun
  const ph = (gx * 0.8 + gz * 0.6) * 15 + vn(gx * 1.6, gz * 1.6, 4) * 6;
  const rs = Math.cos(ph), crest = Math.sin(ph);
  b += rs * 0.13 * fade + (crest > 0.8 ? 0.07 * fade : crest < -0.9 ? -0.05 * fade : 0);
  // decals: footprints, knee dents, shells, pebbles, crab holes, twigs
  let dc = -1;
  const gi = Math.floor(gx / DG) + DO, gj = Math.floor(gz / DG) + DO;
  for (const d of gi >= 0 && gi < DN && gj >= 0 && gj < DN ? DGRID[gj * DN + gi] : NO_DECALS) {
    const dx = gx - d.x, dz = gz - d.z;
    if (dx > d.r || dx < -d.r || dz > d.r || dz < -d.r) continue;
    const cr = Math.cos(d.rot), sr = Math.sin(d.rot);
    const u = dx * cr - dz * sr, v = dx * sr + dz * cr;
    if (d.kind === 0) {
      const e = (u / 0.14) ** 2 + (v / (0.05 + (u > 0 ? 0.012 : 0))) ** 2;
      if (e < 1.25) {
        const wall = (u / 0.14 * SHX + v / 0.05 * SHZ);
        if (e < 1) { b -= 0.1; if (Math.floor((u + 0.2) / 0.024) % 2 === 0 && e < 0.7) b -= 0.05; b += wall * 0.08 * e; }
        else b += wall < 0 ? 0.1 : -0.06;
      }
    } else if (d.kind === 1) {
      const e = (u / 0.075) ** 2 + (v / 0.06) ** 2;
      if (e < 1.2) { if (e < 1) b -= 0.07 - (u * SHX + v * SHZ) * 0.8; else b += 0.06; }
    } else if (d.kind === 2 && dist < 5) {
      // a cockle shell: ribbed fan, pale pink-cream
      const a = Math.atan2(v, u), rr = Math.hypot(u, v) / 0.022;
      if (rr < 1 && Math.abs(a) < 1.25) { dc = mixc(hx('#f4e2d4'), hx('#d8a098'), (Math.sin(a * 9) > 0.3 ? 0.5 : 0) + rr * 0.3); if (u * SHX + v * SHZ > 0.004) dc = mixc(dc, hx('#fff4e8'), 0.5); if (rr > 0.86) dc = mixc(dc, hx('#8a5a5a'), 0.5); }
      else if (rr < 1.35 && Math.abs(a) < 1.4 && u * SHX + v * SHZ < 0) b -= 0.12;
    } else if (d.kind === 3) {
      const e = (u / 0.018) ** 2 + (v / 0.013) ** 2;
      if (e < 1) { dc = ramp(STONE, 0.5 + (u * SHX + v * SHZ) * 30 - e * 0.2, x, y); }
      else if (e < 2.4 && u * SHX + v * SHZ < 0) b -= 0.1;
    } else if (d.kind === 4) {
      const rr = Math.hypot(u, v);
      if (rr < 0.007) dc = SAND[0]; else if (rr < 0.024 && hash(Math.floor(u * 300), Math.floor(v * 300)) > 0.6) b += 0.1;
    } else if (d.kind === 5 && dist < 5) {
      if (Math.abs(v - Math.sin(u * 30) * 0.004) < 0.006 && Math.abs(u) < 0.055) dc = ramp(TWIG, 0.5 + v * 40, x, y);
    }
  }
  // cast shadows and contact shade
  const sh = shadowAt(gx, gz, pegs);
  b += sh ? -0.13 : 0.05;
  const pr = Math.hypot(gx, gz); if (pr < 0.14) b -= 0.22 * (1 - pr / 0.14);
  for (const p of pegs) { const q = Math.hypot(gx - p.x, gz - p.z); if (q < 0.07) b -= 0.18 * (1 - q / 0.07); }
  // wet sand toward the waterline, glossy with the sky
  const wet = clamp((gz - (shore + wave - 2.4)) / 2.4);
  b -= wet * 0.12;
  // the campfire's warm pool of light
  const fdx = gx - FIRE_X, fdz = gz - FIRE_Z, fl = 1 / (1 + (fdx * fdx + fdz * fdz) * 0.45);
  b += fl * 0.2;
  // grains of sand, sparkles in the sun
  if (dist < 3) {
    const h = hash(Math.floor(gx * 240), Math.floor(gz * 240), 5);
    if (h > 0.95) b += 0.28 * (1 - dist / 3); else if (h < 0.05) b -= 0.2 * (1 - dist / 3);
    const h2 = hash(Math.floor(gx * 90), Math.floor(gz * 90), 6);
    if (h2 > 0.93) b += 0.06 * (1 - dist / 3); else if (h2 < 0.06) b -= 0.06 * (1 - dist / 3);
  }
  let c = dc >= 0 ? dc : ramp(SAND, b, x, y);
  if (fl > 0.05) c = mixc(c, hx('#ff8a3a'), Math.min(0.45, fl * 0.55));
  if (!sh) c = mixc(c, hx('#ffb070'), 0.08);
  if (wet > 0) c = mixc(c, panoAt(pano, col, rm), wet * 0.3);
  const fog = clamp((dist - 5) / 34, 0, 0.85);
  if (fog > 0) c = mixc(c, panoAt(pano, col, HY - 0.5), fog);
  return c;
}

function renderBG(bg: Uint32Array, ids: Uint8Array, cam: Cam, pano: Uint32Array, y0: number, y1: number, t: number, pegs: Peg[]) {
  for (let x = 0; x < CW; x++) {
    const ox = x + 0.5 - PX0;
    const dx = cam.rx * ox + cam.fx * FOC, dz = cam.rz * ox + cam.fz * FOC;
    const az = Math.atan2(dx, dz), col = (az / (2 * Math.PI)) * PW;
    const hz = Math.hypot(ox, FOC);
    for (let y = y0; y < y1; y++) {
      const dy = HY - (y + 0.5), i = y * CW + x;
      const tt = tentRay(cam.cx, cam.cy, cam.cz, dx, dy, dz);
      const tg = dy < 0 ? HC / -dy : Infinity;
      if (tt < tg) { bg[i] = tentColor(cam, x, y); ids[i] = 2; }
      else if (tg < Infinity) {
        const gx = cam.cx + tg * dx, gz = cam.cz + tg * dz;
        bg[i] = sandColor(gx, gz, tg * hz, x, y, pegs, t, pano, col, HY + dy * FOC / hz, az);
        ids[i] = 1;
      } else { bg[i] = panoAt(pano, col, HY - dy * FOC / hz); ids[i] = 0; }
    }
  }
  // ink outline round the tent
  for (let y = Math.max(0, y0 - 1); y < Math.min(CH, y1 + 1); y++) for (let x = 0; x < CW; x++) {
    const i = y * CW + x;
    if (ids[i] !== 2) continue;
    if ((x > 0 && ids[i - 1] !== 2) || (x < CW - 1 && ids[i + 1] !== 2) || (y > 0 && ids[i - CW] !== 2) || (y < CH - 1 && ids[i + CW] !== 2)) bg[i] = INK;
  }
}

function setLights(cam: Cam, t: number) {
  LIT.sx = SUNV[0] * cam.rx + SUNV[2] * cam.rz; LIT.sy = -SUNV[1]; LIT.sz = -(SUNV[0] * cam.fx + SUNV[2] * cam.fz);
  const rl = Math.hypot(LIT.sx, LIT.sy) || 1; LIT.rx = LIT.sx / rl; LIT.ry = LIT.sy / rl;
  LIT.si = 0.95;
  const fx = FIRE_X, fy = -0.1, fz = FIRE_Z, fl = Math.hypot(fx, fy, fz);
  LIT.fx = (fx * cam.rx + fz * cam.rz) / fl; LIT.fy = -fy / fl; LIT.fz = -(fx * cam.fx + fz * cam.fz) / fl;
  LIT.fi = 0.42 * (0.88 + Math.sin(t * 13) * Math.sin(t * 7.3) * 0.12);
  LIT.amb = 0.3; LIT.pi = 0;
}

// ------------------------------------------------------------------ the campfire
interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; c: number }
function drawFire(buf: Uint32Array, cam: Cam, t: number, embers: Spark[], dt: number) {
  proj(cam, FIRE_X, 0, FIRE_Z);
  const bx = PJ[0], by = PJ[1], zc = PJ[2];
  if (zc < 0.4 || bx < -80 || bx > CW + 80) { embers.length = 0; return; }
  const s = FOC / zc, flick = 0.85 + Math.sin(t * 11) * Math.sin(t * 6.7) * 0.15;
  // glow halo over sand and sky
  const GR = 1.4 * s;
  for (let y = Math.floor(by - GR * 1.2); y < by + GR * 0.6; y++) for (let x = Math.floor(bx - GR); x < bx + GR; x++) {
    const d = Math.hypot((x - bx) / GR, (y - by + 0.25 * s) / (GR * 0.8));
    if (d < 1) { const f = (1 - d) ** 2 * flick; add(buf, x, y, 70 * f, 30 * f, 6 * f); }
  }
  // ring of stones and the logs: back half first, then the flames, then the front
  const stones: [number, number, number, number][] = [];
  for (let k = 0; k < 10; k++) {
    const a = k / 10 * Math.PI * 2 + 0.3, rr = 0.3 + hash(k, 1, 31) * 0.03;
    proj(cam, FIRE_X + Math.cos(a) * rr, 0.03, FIRE_Z + Math.sin(a) * rr);
    stones.push([PJ[0], PJ[1], PJ[2], k]);
  }
  stones.sort((a, b) => b[2] - a[2]);
  const drawStone = (sx: number, sy: number, sz: number, k: number) => {
    const sr = 0.075 * FOC / sz * (0.8 + hash(k, 2, 31) * 0.4);
    ellipse(buf, sx, sy, sr, sr * 0.62, hash(k, 3, 31) - 0.5, (u, v, x, y) => {
      const toward = ((bx - sx) * u + (by - 0.1 * s - sy) * v) / (Math.hypot(bx - sx, by - sy) + 1);
      const b = 0.25 - v * 0.2 + toward * 0.5 * flick;
      return mixc(ramp(STONE, b, x, y), hx('#ff8a3a'), clamp(toward * 0.6 * flick, 0, 0.5));
    });
  };
  for (const st of stones) if (st[2] >= zc) drawStone(st[0], st[1], st[2], st[3]);
  // logs, a little teepee of driftwood glowing at the core
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * Math.PI * 2 + 0.8;
    proj(cam, FIRE_X + Math.cos(a) * 0.26, 0.03, FIRE_Z + Math.sin(a) * 0.26); const x0 = PJ[0], y0 = PJ[1];
    proj(cam, FIRE_X + Math.cos(a) * 0.03, 0.2, FIRE_Z + Math.sin(a) * 0.03); const x1 = PJ[0], y1 = PJ[1];
    capsule(buf, x0, y0, x1, y1, 0.04 * s, 0.028 * s, (tt, v, nx, ny, nz, x, y) => {
      const glow = tt * tt * flick;
      const ch = hash(Math.floor(tt * 14), Math.floor(v * 3), k);
      let c = ramp(CHAR, 0.3 - ny * 0.3 + nz * 0.2, x, y);
      if (ch > 0.7 && glow > 0.2) c = mixc(c, hx('#ff7a2a'), glow);
      return mixc(c, hx('#ff9a48'), glow * 0.35);
    });
  }
  // the flames: licking tongues shaped from scrolling noise
  const FH = 0.62 * s, fx0 = bx, fy0 = by - 0.1 * s;
  for (let y = Math.floor(fy0 - FH * 1.1); y <= fy0 + 2; y++) for (let x = Math.floor(fx0 - FH * 0.5); x <= fx0 + FH * 0.5; x++) {
    const h = (fy0 - y) / FH;
    if (h < -0.05 || h > 1.1) continue;
    const w = 0.3 * FH * Math.pow(Math.max(0, 1 - h), 0.8) * (0.85 + Math.sin(t * 5 + h * 3) * 0.15);
    const sway = Math.sin(h * 5 - t * 8) * h * 0.06 * FH + Math.sin(t * 3.1) * h * h * 0.08 * FH;
    const n = vn((x - fx0) / (FH * 0.12) , h * 5 - t * 7, 17);
    const val = 1 - Math.abs(x - fx0 - sway) / Math.max(0.5, w) - n * 0.55 * (0.3 + h) - h * 0.25;
    if (val <= 0) continue;
    put(buf, x, y, ramp(FLAME, clamp(val * 1.4 + (1 - h) * 0.25), x, y));
  }
  for (const st of stones) if (st[2] < zc) drawStone(st[0], st[1], st[2], st[3]);
  // embers drifting up
  if (Math.random() < dt * 9) embers.push({ x: fx0 + (Math.random() - 0.5) * FH * 0.3, y: fy0 - FH * 0.5, vx: (Math.random() - 0.5) * 8, vy: -14 - Math.random() * 16, life: 1.4 + Math.random(), max: 2.4, c: 0 });
  for (let i = embers.length - 1; i >= 0; i--) {
    const e = embers[i];
    e.life -= dt; e.x += (e.vx + Math.sin(t * 3 + i) * 6) * dt; e.y += e.vy * dt;
    if (e.life <= 0) { embers.splice(i, 1); continue; }
    put(buf, e.x, e.y, e.life > 0.8 ? hx('#ffe08a') : hx('#ff7a3a'));
  }
}

// ------------------------------------------------------------------ hands
/** Mori's fist round the pole: local lv across (right +), lu along the pole (up +) */
function drawGrip(buf: Uint32Array, cx: number, cy: number, ux: number, uy: number, ax: number, ay: number, pr: number) {
  const rx = -uy, ry = ux;
  const L = (lv: number, lu: number): [number, number] => [cx + rx * lv + ux * lu, cy + ry * lv + uy * lu];
  const [wx, wy] = L(-15, -3);
  const kx = ax + (wx - ax) * 0.88, ky = ay + (wy - ay) * 0.88;
  const skin: Shade = (_t, _v, nx, ny, nz, x, y) => shadeC(SKIN, lit(nx, ny, nz) + 0.08, x, y);
  capsule(buf, ax, ay, kx, ky, 10, 7.4, (t, v, nx, ny, nz, x, y) => { const fold = Math.sin(t * 26 + v * 2.5 + Math.sin(t * 7) * 2); return shadeC(SLEEVE, lit(nx, ny, nz) + 0.06 + (frac(t * 40 + v * 0.3) < 0.5 ? 0.02 : -0.03) + (fold > 0.6 ? -0.12 : fold < -0.7 ? 0.07 : 0), x, y); }, { caps: false });
  capsule(buf, kx, ky, wx, wy, 4.8, 4.4, skin);
  const [c0x, c0y] = [ax + (wx - ax) * 0.83, ay + (wy - ay) * 0.83];
  capsule(buf, c0x, c0y, kx, ky, 8.2, 8, (t, _v, nx, ny, nz, x, y) => shadeC(SLEEVE, lit(nx, ny, nz) - 0.02 + (Math.floor(t * 9) % 2 ? 0.06 : -0.04), x, y), { caps: false });
  const [p0x, p0y] = L(-15, -1), [p1x, p1y] = L(-8, 1);
  capsule(buf, p0x, p0y, p1x, p1y, 6.8, 6.4, skin);
  for (let k = 3; k >= 0; k--) {
    const yk = 4.9 - k * 3.3, rr = k === 3 ? 1.5 : 1.8;
    const [f0x, f0y] = L(-7.5, yk + 0.4), [f1x, f1y] = L(pr + 0.6 - (k === 3 ? 1.2 : 0), yk - 0.6);
    const span = pr + 8.1;
    capsule(buf, f0x, f0y, f1x, f1y, rr, rr * 0.92, (t, _v, nx, ny, nz, x, y) => {
      const lv = -7.5 + t * span;
      const b = lit(nx, ny, nz) + 0.1 - Math.max(0, lv - pr * 0.3) / pr * 0.28 + (t < 0.14 ? 0.08 : 0);
      return shadeC(SKIN, b, x, y);
    });
  }
  const [t0x, t0y] = L(-11, 6), [t1x, t1y] = L(-1.5, 8.4);
  capsule(buf, t0x, t0y, t1x, t1y, 2.3, 2, (t, _v, nx, ny, nz, x, y) => (t > 0.82 && nz > 0.5 ? SKIN[4] : shadeC(SKIN, lit(nx, ny, nz) + 0.12, x, y)));
}

// Joshu's forearm and mallet, laid out in the strike pose (head flat on the peg top), swung about his elbow
const ELB: [number, number] = [338, 176];
const STRIKE_X = 218, STRIKE_Y = 113;
function drawJoshu(buf: Uint32Array, beta: number, ox: number, oy: number) {
  const c = Math.cos(beta), s = Math.sin(beta);
  const T = (x: number, y: number): [number, number] => { const dx = x - ELB[0], dy = y - ELB[1]; return [ELB[0] + dx * c - dy * s + ox, ELB[1] + dx * s + dy * c + oy]; };
  const cap = (a: [number, number], b: [number, number], r0: number, r1: number, sh: Shade, o?: CapOpt) => {
    const [x0, y0] = T(a[0], a[1]), [x1, y1] = T(b[0], b[1]);
    capsule(buf, x0, y0, x1, y1, r0, r1, sh, o);
  };
  const skin = (extra: number): Shade => (t, v, nx, ny, nz, x, y) => {
    const b = lit(nx, ny, nz) + extra;
    const h = hash(Math.floor(t * 60), Math.floor((v + 1) * 6), 3);
    let cc = shadeC(JSKIN, b, x, y);
    if (h > 0.55 - (v < -0.2 ? 0.15 : 0) && frac(t * 60 + v * 1.5) < 0.38 && v < 0.65) cc = mixc(cc, JHAIR, 0.55 + (v < -0.2 ? 0.3 : 0));
    return cc;
  };
  // navy knit sleeve pushed up past the elbow, a rolled cuff
  cap([330, 166], [376, 220], 17, 19, (t, _v, nx, ny, nz, x, y) => shadeC(KNIT, lit(nx, ny, nz) + 0.06 + (frac(t * 26) < 0.5 ? 0.04 : -0.05), x, y), { caps: false });
  // forearm: big and hairy, with a faded anchor tattoo
  cap([273, 106], [330, 166], 9.5, 15, (t, v, nx, ny, nz, x, y) => {
    let cc = skin(0.02)(t, v, nx, ny, nz, x, y);
    const u = (t - 0.5) * 83, w = v * 12;
    const anchor = (Math.abs(u) < 0.8 && w > -5 && w < 4) || (Math.abs(w + 3) < 0.7 && Math.abs(u) < 3) || (Math.abs(Math.hypot(u, w + 6) - 1.4) < 0.6)
      || (w > 1.5 && w < 5 && Math.abs(Math.hypot(u, w - 0.5) - 3.8) < 0.7);
    if (anchor) cc = mixc(cc, hx('#2a4658'), 0.55);
    return cc;
  });
  cap([322, 157], [333, 170], 18, 18.5, (t, _v, nx, ny, nz, x, y) => shadeC(KNIT, lit(nx, ny, nz) + 0.1 + (Math.floor(t * 6) % 2 ? 0.07 : -0.04), x, y), { caps: false });
  // mallet handle
  cap([222, 98], [279, 104], 3.1, 3.3, (t, v, nx, ny, nz, x, y) => shadeC(MALLET, lit(nx, ny, nz) + 0.14 + (Math.sin(t * 60 + v * 3) > 0.7 ? -0.07 : 0), x, y));
  // the fist round it: back of the hand, four knuckled fingers, the thumb along the top
  cap([264, 100], [276, 107], 8.8, 8.2, skin(0.06));
  for (let k = 0; k < 4; k++) {
    const x0 = 256.5 + k * 4.3;
    cap([x0 + 1.4, 97], [x0 - 0.4, 111], k === 0 ? 2.4 : k === 3 ? 2 : 2.35, 2.1, (t, _v, nx, ny, nz, x, y) => shadeC(JSKIN, lit(nx, ny, nz) + 0.1 + (t < 0.2 ? 0.1 : 0) - (t > 0.82 ? 0.14 : 0), x, y));
  }
  cap([273, 94], [257, 96], 2.9, 2.4, (t, _v, nx, ny, nz, x, y) => (t > 0.84 && nz > 0.6 ? JSKIN[5] : shadeC(JSKIN, lit(nx, ny, nz) + 0.12, x, y)));
  // the head: a ship's caulking mallet, iron hoops at both ends
  const [hbx, hby] = T(STRIKE_X, STRIKE_Y), [htx, hty] = T(STRIKE_X, STRIKE_Y - 29);
  capsule(buf, hbx, hby, htx, hty, 11.5, 11.5, (t, v, nx, ny, nz, x, y) => {
    const hoop = (t > 0.05 && t < 0.15) || (t > 0.85 && t < 0.95);
    if (hoop) return shadeC(IRON, lit(nx, ny, nz) + 0.05 + (Math.abs(v + 0.35) < 0.12 ? 0.3 : 0), x, y);
    const g = Math.sin(v * 8 + Math.sin(t * 6) * 0.8 + vn(t * 5, v * 3, 8) * 2);
    return shadeC(MALLET, lit(nx, ny, nz) + (g > 0.75 ? -0.1 : g < -0.85 ? 0.06 : 0), x, y);
  }, { caps: false });
  // the visible end face: the worn striking face from below when it is raised above eye level, else the top
  const up = (hby + hty) / 2 < HY + 10;
  const [ex, ey] = up ? [hbx, hby] : [htx, hty];
  ellipse(buf, ex, ey, 11.5, 3.2, beta, (u, v, x, y) => {
    const rr = Math.hypot(u, v * 0.9);
    let cc = ramp(MALLET, (up ? 0.55 : 0.62) - v * 0.12 + (Math.sin(rr * 11) > 0.6 ? -0.1 : 0), x, y);
    if (rr > 0.84) cc = ramp(IRON, 0.55 - v * 0.2, x, y);
    return cc;
  });
}

// ------------------------------------------------------------------ the game

const MISS_LINES = ['Oi! Keep her *straight*, lad!', 'Whoa. She’s wobbling. Wait till she’s upright.', 'Mind my thumbs!', 'Steady... *steady*. Upright, then I swing.'];
const HIT_LINES = ['*THUNK.* That’s one.', '*THUNK.* Two. Round we go.', '*THUNK!* Last one. Tight as a drum.'];

/** three pegs: press as the swaying pole comes upright. Resolves true with no misses. */
export async function holdSteady(title: string, hint: string): Promise<boolean> {
  void title;
  const cu = openCloseup();
  const buf = cu.buf;
  const pano = paintPano();
  const hold = new Hold(cu.wrap);
  const bg = new Uint32Array(CW * CH), ids = new Uint8Array(CW * CH), tmp = new Uint32Array(CW * CH);
  const vig = vignette(0.6);
  const pegs: Peg[] = VIEWS.map(yaw => { const c = mkCam(yaw); return { x: c.rx * 0.45 + c.fx * 0.3, z: c.rz * 0.45 + c.fz * 0.3, h: 0.14, target: 0.14, lean: 0, twang: 0, bruise: 0 }; });
  let yaw = VIEWS[0], lastYaw = NaN;
  let phase = 0, amp = 0, wob = 0, hits = 0, misses = 0, tries = 0, missLine = 0;
  let swing: { kind: 'hit' | 'glance'; t: number; b0: number; done: boolean } | null = null;
  let pan: { t: number; from: number; to: number } | null = null;
  let retract = 1, shake = 0, lock = 1.2, endT = -1, resulting = false, beta = 0.5, glint = 0;
  const grains: Spark[] = [], puffs: Spark[] = [], embers: Spark[] = [], chips: Spark[] = [], rings: Spark[] = [];
  cu.hint(hint, 5200);
  audio.play('uiOpen', { vol: 0.3 });
  setTimeout(() => { if (!cu.closed) cu.say('Joshu', 'Hold her steady, lad. I swing when she’s *upright*.', { color: JOSHU, right: true, ms: 3400 }); }, 800);

  const ok = await new Promise<boolean>(done => {
    loop((dt, t) => {
      if (cu.closed) { done(misses === 0 && tries >= 3); return false; }
      // ---------------------------------------------------------- sway, input, swing
      if (!pan && endT < 0) phase += dt * (1.6 + hits * 0.5);
      const lean = Math.sin(phase * 2);
      amp += ((pan || endT >= 0 ? 0.1 : 1) - amp) * Math.min(1, dt * 3);
      wob *= Math.exp(-dt * 2.6);
      const theta = lean * 0.15 * amp + Math.sin(t * 21) * wob * 0.06;
      const tol = 0.25 - hits * 0.04;
      glint += ((Math.abs(lean) < tol && amp > 0.8 ? 1 : 0) - glint) * Math.min(1, dt * 14);
      lock -= dt;
      const pressed = hold.hit();
      if (pressed && !swing && !pan && endT < 0 && lock <= 0 && retract < 0.15) {
        tries++;
        swing = { kind: Math.abs(lean) < tol ? 'hit' : 'glance', t: 0, b0: beta, done: false };
      }
      const hover = 0.36 + Math.sin(t * 2.2) * 0.03;
      let gx = 0;
      beta = hover;
      if (swing) {
        const s = (swing.t += dt);
        if (swing.kind === 'hit') beta = s < 0.08 ? swing.b0 * (1 - (s / 0.08) ** 2) : s < 0.34 ? 0 : hover * ease((s - 0.34) / 0.45);
        else if (s < 0.08) { beta = swing.b0 * (1 - (s / 0.08) ** 2) + 0.05 * (s / 0.08); gx = 8 * (s / 0.08); }
        else { const k = Math.min(1, (s - 0.08) / 0.55); beta = 0.05 + Math.sin(k * Math.PI / 2) * (hover - 0.05) + Math.sin(k * 20) * 0.05 * (1 - k); gx = 8 + k * 6 - k * k * 14; }
        if (!swing.done && s >= 0.08) {
          swing.done = true;
          const pg = pegs[hits];
          proj(mkCam(yaw), pg.x, 0, pg.z);
          const px = PJ[0], py = PJ[1];
          if (swing.kind === 'hit') {
            pg.target = 0.035; pg.twang = 1; pg.bruise = 1; pg.lean *= 0.3;
            shake = 1; hits++;
            audio.play('hammer', { vol: 0.8, pitch: 0.7 }); audio.play('dig', { vol: 0.5 });
            for (let i = 0; i < 80; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.7; const sp = 50 + Math.random() * 150; grains.push({ x: px + (Math.random() - 0.5) * 10, y: py - 1, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, max: py + Math.random() * 14, c: SAND[6 + (i % 3)] }); }
            rings.push({ x: px, y: py + 1, vx: 0, vy: 0, life: 0.55, max: 0.55, c: 0 });
            for (let i = 0; i < 9; i++) puffs.push({ x: px + (i - 4) * 5, y: py - 2, vx: (i - 4) * 14, vy: -8 - Math.random() * 10, life: 1.1, max: 1.1, c: 4 + Math.random() * 3 });
            cu.say('Joshu', HIT_LINES[Math.min(2, hits - 1)], { color: JOSHU, right: true, ms: 2000 });
            if (hits < 3) pan = { t: -0.8, from: VIEWS[hits - 1], to: VIEWS[hits] };
            else endT = t + 1.1;
          } else {
            misses++; wob = 1; lock = 0.6;
            pg.lean = clamp(pg.lean + (Math.random() < 0.5 ? -0.14 : 0.14), -0.3, 0.3); pg.twang = 0.6;
            audio.play('hammer', { vol: 0.45, pitch: 1.5 }); audio.play('wrong', { vol: 0.35 });
            for (let i = 0; i < 8; i++) chips.push({ x: px + 4, y: py - 30, vx: 20 + Math.random() * 60, vy: -30 - Math.random() * 60, life: 0.6, max: 0.6, c: PEG[4 + (i % 3)] });
            cu.say('Joshu', MISS_LINES[missLine++ % MISS_LINES.length], { color: JOSHU, right: true, shout: missLine === 1, ms: 2400 });
          }
        }
        if (swing.t > (swing.kind === 'hit' ? 0.8 : 0.7)) swing = null;
      }
      // the orbit to the next guy line: the arm lifts away, the camera swings round the pole, the arm comes back
      if (pan) {
        pan.t += dt;
        const k = ease(clamp(pan.t / 1.8));
        yaw = pan.from + (pan.to - pan.from) * k;
        if (pan.t > 2.1) { pan = null; lock = 0.3; }
      }
      retract += (((pan && pan.t > -0.3 && pan.t < 1.5) || (endT >= 0 && t > endT - 0.5) ? 1 : 0) - retract) * Math.min(1, dt * (retract > 0.5 ? 4 : 5));
      for (const p of pegs) { p.h += (p.target - p.h) * Math.min(1, dt * 28); p.twang *= Math.exp(-dt * 3); p.bruise *= Math.exp(-dt * 0.5); }
      shake = Math.max(0, shake - dt * 3);
      if (endT >= 0 && t > endT && !resulting) {
        resulting = true;
        const good = misses === 0 && tries >= 3;
        audio.play(good ? 'star' : 'wrong', { vol: 0.5 });
        if (good) cu.flash();
        cu.result(good ? 'TIGHT!' : 'WONKY...', good ? 'three pegs, dead straight' : `${misses} glancing blow${misses === 1 ? '' : 's'}`, !good).then(() => cu.close().then(() => done(good)));
      }

      // ---------------------------------------------------------- draw
      const f0 = performance.now();
      const cam = mkCam(yaw);
      setLights(cam, t);
      if (yaw !== lastYaw) { renderBG(bg, ids, cam, pano, 0, CH, t, pegs); lastYaw = yaw; }
      else renderBG(bg, ids, cam, pano, HY - 1, HY + 12, t, pegs);
      buf.set(bg);
      drawFire(buf, cam, t, embers, dt);
      // the pole top, where every guy line meets it
      const TX = cam.rx * Math.sin(theta) * POLE_TOP, TZ = cam.rz * Math.sin(theta) * POLE_TOP, TY = Math.cos(theta) * POLE_TOP;
      const drawPeg = (p: Peg) => {
        proj(cam, p.x, 0, p.z);
        const bx = PJ[0], by = PJ[1], bz = PJ[2];
        if (bz < 0.25) return;
        const s = FOC / bz;
        const ph = p.h * s, tx = bx + Math.sin(p.lean) * ph, ty = by - Math.cos(p.lean) * ph;
        const rw = 0.019 * s;
        // the guy line, sagging a little, twanging after a blow
        const tie = p.h - 0.03, pts: number[] = [];
        const sag = 0.02 + Math.abs(Math.sin(theta)) * 0.12;
        for (let k = 0; k <= 36; k++) {
          const f = k / 36;
          const X = p.x + (TX - p.x) * f + Math.sin(p.lean) * tie * (1 - f), Z = p.z + (TZ - p.z) * f, Y = tie + (TY - tie) * f - sag * 4 * f * (1 - f);
          proj(cam, X, Y, Z);
          if (PJ[2] < 0.1) break;
          const tw = p.twang * Math.sin(f * Math.PI) * Math.sin(t * 70) * 3;
          pts.push(PJ[0] + tw, PJ[1]);
          if (PJ[1] < -20) break;
        }
        // peg: split stake, bruised end grain, sand heaped round its foot
        capsule(buf, bx, by + 2, tx, ty, rw * 1.08, rw, (tt, v, nx, ny, nz, x, y) => {
          const g = Math.sin(v * 5 + tt * 2 + hash(Math.floor(tt * 6), 0, 9) * 2);
          return shadeC(PEG, lit(nx, ny, nz) + 0.06 + (g > 0.8 ? -0.1 : 0) + (tt < 0.15 ? -0.12 : 0), x, y);
        }, { caps: false });
        ellipse(buf, tx, ty, rw + 0.4, Math.max(1.2, rw * 0.42), p.lean, (u, v, x, y) => {
          const rr = Math.hypot(u, v);
          let cc = ramp(PEG, 0.72 - v * 0.1 + (Math.sin(rr * 9) > 0.5 ? -0.1 : 0), x, y);
          if (p.bruise > 0.1 && rr < 0.6) cc = mixc(cc, PEG[2], 0.5);
          return cc;
        });
        if (pts.length > 3) cord(buf, pts, bz < 1.6 ? 1 : 0.6, (sl, v, nx, ny, nz, x, y) => shadeC(ROPE, lit(nx, ny, nz) + 0.08 + (frac(sl * 0.4 + v * 0.3) < 0.5 ? 0.06 : -0.08), x, y));
        // a hitch round the peg under its head
        const hy = ty + (by - ty) * 0.2, hx2 = tx + (bx - tx) * 0.2;
        capsule(buf, hx2 - rw - 0.5, hy, hx2 + rw + 0.5, hy + 1.2, 1, 1, (_tt, _v, nx, ny, nz, x, y) => shadeC(ROPE, lit(nx, ny, nz) + 0.15, x, y));
        ellipse(buf, bx, by + 0.5, rw * 2.3, rw * 0.7, 0, (u, v, x, y) => ramp(SAND, 0.62 - v * 0.2 - Math.hypot(u, v) * 0.15 + (hash(x, y, 4) > 0.8 ? 0.1 : 0), x, y), false);
      };
      const order = pegs.map((p, i) => { proj(cam, p.x, 0, p.z); return [PJ[2], i]; }).sort((a, b) => b[0] - a[0]);
      for (const [z, i] of order) if (z > RC) drawPeg(pegs[i]);
      // the pole: a straight manuka pole, bark scraps, catching the sun as it swings upright
      const ux = Math.sin(theta), uy = -Math.cos(theta);
      proj(cam, 0, 0, 0);
      const pbx = PJ[0], pby = PJ[1];
      capsule(buf, pbx, pby + 2, pbx + ux * 240, pby + uy * 240, 6.2, 4.6, (tt, v, nx, ny, nz, x, y) => {
        const lp = tt * 240;
        let b = lit(nx, ny, nz) + 0.04;
        const g = Math.sin(v * 7 + Math.sin(lp * 0.05) * 1.3 + vn(lp * 0.04, v * 2 + 3, 5) * 3);
        if (g > 0.8) b -= 0.1; else if (g < -0.9) b += 0.05;
        if (vn(lp * 0.06, v * 1.2, 6) > 0.8 && v > 0.1) return shadeC(BARK, b, x, y);
        if (Math.abs(lp - 64) < 3 && v > -0.2 && v < 0.6) b -= 0.18 - Math.abs(lp - 64) * 0.04;
        const gl = glint * clamp(1.2 - Math.abs(v + 0.4) * 2.6) * (0.75 + 0.25 * Math.sin(lp * 0.07 - t * 14));
        const pc = shadeC(POLE, b + gl * 0.4, x, y);
        return gl > 0.05 ? mixc(pc, hx('#fff0c0'), Math.min(0.8, gl * 0.9)) : pc;
      }, { caps: false });
      ellipse(buf, pbx, pby + 0.5, 12, 3.4, 0, (u, v, x, y) => {
        const rr = Math.hypot(u, v);
        return rr < 0.45 && v < 0.2 ? ramp(SAND, 0.2, x, y) : ramp(SAND, 0.64 - v * 0.24 - rr * 0.1 + (hash(x, y, 7) > 0.82 ? 0.1 : 0), x, y);
      }, false);
      for (const [z, i] of order) if (z <= RC) drawPeg(pegs[i]);
      // Mori's hands on the pole
      drawGrip(buf, pbx + ux * 44, pby + uy * 44, ux, uy, 24, 226, 6);
      drawGrip(buf, pbx + ux * 80, pby + uy * 80, ux, uy, -34, 186, 5.6);
      // Joshu, the mallet squared on the peg top (or glancing off its edge)
      {
        const pg = pegs[Math.min(2, hits - (swing?.kind === 'hit' && swing.done ? 1 : 0))];
        proj(cam, pg.x, 0, pg.z);
        const s = FOC / PJ[2];
        const topX = PJ[0] + Math.sin(pg.lean) * pg.h * s, topY = PJ[1] - Math.cos(pg.lean) * pg.h * s - 1;
        drawJoshu(buf, beta, topX - STRIKE_X + gx + retract * 120, topY - STRIKE_Y + retract * 70);
      }
      // sand burst and wood chips, flying out in front of the mallet
      for (let i = grains.length - 1; i >= 0; i--) {
        const g = grains[i];
        g.vy += 320 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.life -= dt;
        if (g.life <= 0 || (g.vy > 0 && g.y > g.max)) { grains.splice(i, 1); continue; }
        put(buf, g.x, g.y, g.c); put(buf, g.x, g.y + 1, SAND[3]); if (i % 2) { put(buf, g.x + 1, g.y, g.c); put(buf, g.x + 1, g.y + 1, SAND[2]); }
      }
      for (let i = chips.length - 1; i >= 0; i--) {
        const g = chips[i];
        g.vy += 300 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.life -= dt;
        if (g.life <= 0) { chips.splice(i, 1); continue; }
        put(buf, g.x, g.y, g.c); put(buf, g.x + 1, g.y, INK);
      }
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 2;
        if (p.life <= 0) { puffs.splice(i, 1); continue; }
        const r = p.c + (p.max - p.life) * 10, a = (p.life / p.max) * 0.45;
        for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
          const d = (x * x + y * y) / (r * r);
          if (d > 1 || dith(p.x + x | 0, p.y + y | 0) > 0.9 - d * 0.6) continue;
          blend(buf, p.x + x, p.y + y * 0.6, SAND[8], a * 1.3 * (1 - d * 0.6));
        }
      }
      // the shock of the blow rippling out across the sand
      for (let i = rings.length - 1; i >= 0; i--) {
        const g = rings[i];
        g.life -= dt;
        if (g.life <= 0) { rings.splice(i, 1); continue; }
        const k = 1 - g.life / g.max, r = 6 + k * 46, a = (1 - k) * 0.7;
        for (let q = 0; q < 160; q++) {
          const an = q / 160 * Math.PI * 2, x = g.x + Math.cos(an) * r, y = g.y + Math.sin(an) * r * 0.26;
          if (dith(x | 0, y | 0) < a) { blend(buf, x, y, SAND[7], a); blend(buf, x, y + 1, SAND[2], a * 0.6); }
        }
      }
      applyVignette(buf, vig);
      shakeBuf(buf, tmp, Math.round(Math.sin(t * 97) * 3 * shake), Math.round(Math.cos(t * 83) * 3 * shake));
      (window as unknown as { __camp?: unknown }).__camp = { t: +t.toFixed(2), ms: +(performance.now() - f0).toFixed(1), next: Math.sin((phase + 0.05 * (1.6 + hits * 0.5)) * 2), lean, tol, hits, misses, tries, pan: !!pan, ready: !swing && !pan && lock <= 0 && retract < 0.15 && endT < 0 };
      cu.present();
      return true;
    });
  });
  hold.dispose();
  return ok;
}

// ================================================================== LASHING KNOT: Aroha's drying rack

const KNOT: { key: string; code: string[]; name: string }[] = [
  { key: 'key_up', code: ['ArrowUp', 'KeyW'], name: 'over' },
  { key: 'key_down', code: ['ArrowDown', 'KeyS'], name: 'under' },
  { key: 'key_left', code: ['ArrowLeft', 'KeyA'], name: 'around' },
  { key: 'key_right', code: ['ArrowRight', 'KeyD'], name: 'pull tight' },
];

const KJX = 160, KJY = 94;
const KAx = 0.8, KAy = -0.6, KBx = -0.6, KBy = -0.8; // unit axes: A runs up-right (behind), B up-left (in front)
const RA = 17, RB = 16;
const DRIFT = P(['#281c22', '#3e3034', '#584846', '#74625a', '#8e7c70', '#aa9886', '#c6b49e', '#dcccb4', '#eee2cc']);
const FLAX = P(['#2a200e', '#4a3c1a', '#6c5c2a', '#8e7c3c', '#ae9a54', '#cab672', '#e2d296', '#f2e6b8']);
const distA = (x: number, y: number) => Math.abs((x - KJX) * KAy - (y - KJY) * KAx);
const distB = (x: number, y: number) => Math.abs((x - KJX) * KBy - (y - KJY) * KBx);
const inA = (x: number, y: number, e = 0) => distA(x + 0.5, y + 0.5) < RA + e;
const inB = (x: number, y: number, e = 0) => distB(x + 0.5, y + 0.5) < RB + e;

function knotLights() {
  // the campfire low on the left, the sunset sky rimming the right edges
  const l = Math.hypot(-0.78, 0.1, 0.6);
  LIT.sx = 0; LIT.sy = 0; LIT.sz = 1; LIT.si = 0; LIT.rx = 0; LIT.ry = 0;
  LIT.fx = -0.78 / l; LIT.fy = 0.1 / l; LIT.fz = 0.6 / l; LIT.fi = 0.9;
  const p = Math.hypot(0.75, -0.55); LIT.px = 0.75 / p; LIT.py = -0.55 / p; LIT.pi = 0.95;
  LIT.amb = 0.17;
}

function paintKnotBase(): Uint32Array {
  const b = new Uint32Array(CW * CH);
  const BSKY = P(['#241a3e', '#34224c', '#4c2c5a', '#6e385e', '#964a60', '#bc6258', '#dc8658', '#eeaa66', '#f6c67e']);
  const BSAND = P(['#3a2638', '#523444', '#6e4650', '#8a5a5a', '#a67064', '#c08a70']);
  const HZ = 100;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    let c: number;
    if (y < HZ) c = ramp(BSKY, Math.pow(y / HZ, 1.25) + (x - 160) / 1400, x, y);
    else if (y < 112) {
      // soft, out-of-focus sea: the sunset smeared across it
      const k = (y - HZ) / 12;
      c = mixc(hx('#e09a6e'), hx('#6a4a6a'), Math.min(1, k * 1.3));
      const glow = Math.exp(-(((x - 244) / 46) ** 2)) * (1 - k);
      c = mixc(c, hx('#fcd49a'), glow * 0.8);
    } else c = ramp(BSAND, 0.62 - (y - 112) / 90 + Math.sin(x * 0.03 + y * 0.05) * 0.03, x, y);
    // the low sun glowing behind the frame, the fire's warmth from the left
    const sg = Math.exp(-(((x - 246) / 60) ** 2 + ((y - 96) / 26) ** 2));
    if (sg > 0.02) c = mixc(c, hx('#fff0c0'), sg * 0.6);
    const fg = Math.max(0, 1 - Math.hypot(x + 20, (y - 150) * 1.2) / 190);
    if (fg > 0) c = mixc(c, hx('#ff8a40'), fg * fg * 0.55);
    b[y * CW + x] = c;
  }
  // the tent, soft behind: a dim shape with a lantern
  for (let y = 36; y < 118; y++) for (let x = 0; x < 110; x++) {
    const half = (y - 36) * 0.72;
    const e = half - Math.abs(x - 56);
    if (e < -3) continue;
    const a = clamp((e + 3) / 6) * 0.55;
    blend(b, x, y, hx(y > 100 ? '#2e2030' : '#4a3440'), a);
  }
  // bokeh: sparks, the lantern, the sun on the water
  const disc = (cx: number, cy: number, r: number, col: number, a: number) => {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > r) continue;
      blend(b, x, y, col, d > r - 1.2 ? a * 1.6 : a);
    }
  };
  disc(58, 88, 9, hx('#ffc070'), 0.3);
  disc(62, 94, 5, hx('#fff0c0'), 0.3);
  for (let i = 0; i < 22; i++) {
    const warm = i < 12;
    const x = warm ? 10 + hash(i, 1, 51) * 120 : 190 + hash(i, 1, 51) * 130, y = warm ? 110 + hash(i, 2, 51) * 70 : 70 + hash(i, 2, 51) * 50;
    const r = 3 + hash(i, 3, 51) * 8;
    disc(x, y, r, hx(warm ? (hash(i, 4, 51) > 0.5 ? '#ffa850' : '#ff7a3a') : (hash(i, 4, 51) > 0.5 ? '#ffd8a8' : '#f0a0b0')), 0.16 + hash(i, 5, 51) * 0.14);
  }
  // shadows of the frame falling on the sand behind? no: soft darkness low in the frame
  for (let y = 150; y < CH; y++) for (let x = 0; x < CW; x++) blend(b, x, y, hx('#1e1426'), (y - 150) / 30 * 0.35);
  // the two driftwood poles
  knotLights();
  const drift = (seed: number, len: number): Shade => (t, v, nx, ny, nz, x, y) => {
    const lp = t * len;
    let bb = lit(nx, ny, nz) + 0.08;
    const g = Math.sin(v * 9 + Math.sin(lp * 0.021 + v * 2 + seed) * 1.8 + vn(lp * 0.02, v * 3, seed) * 3);
    if (g > 0.86) bb -= 0.16; else if (g > 0.6) bb -= 0.05; else if (g < -0.7) bb += 0.05;
    // long checks in the grain, knots, the pinholes of shipworm
    if (Math.abs(v - 0.28 - Math.sin(lp * 0.03 + seed) * 0.05) < 0.035 && vn(lp * 0.012, seed, 3) > 0.55) bb -= 0.3;
    for (const kp of [seed * 70 % 200 + 60, seed * 130 % 180 + 320]) {
      const d = Math.hypot((lp - kp) / 2.2, (v + 0.2) * 16);
      if (d < 7) { bb += Math.sin(d * 2.2) > 0.3 ? -0.14 : 0.03; if (d < 1.6) bb -= 0.35; }
    }
    if (hash(Math.floor(lp / 2.5), Math.floor((v + 1) * 9), seed) > 0.986) bb -= 0.4;
    return shadeC(DRIFT, bb, x, y);
  };
  capsule(b, KJX - KAx * 300, KJY - KAy * 300, KJX + KAx * 300, KJY + KAy * 300, RA + 1, RA - 1, drift(1, 600), { caps: false });
  // B's shadow across A beside the joint
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (inA(x, y) && !inB(x, y) && inB(x - 6, y + 1)) b[y * CW + x] = mixc(b[y * CW + x], hx('#1e1426'), 0.45);
  capsule(b, KJX - KBx * 300, KJY - KBy * 300, KJX + KBx * 300, KJY + KBy * 300, RB + 1, RB - 1, drift(2, 600), { caps: false });
  return b;
}

interface Wrap { kind: number; n: number; prog: number; slack: number }
const PATH_N = 40;
/** resample a waypoint polyline into PATH_N even steps */
function resample(w: number[]): number[] {
  const cum = [0];
  for (let i = 2; i < w.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(w[i] - w[i - 2], w[i + 1] - w[i - 1]));
  const tot = cum[cum.length - 1] || 1, out: number[] = [];
  let j = 0;
  for (let k = 0; k <= PATH_N; k++) {
    const d = k / PATH_N * tot;
    while (j < cum.length - 2 && cum[j + 1] < d) j++;
    const f = (d - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
    out.push(w[j * 2] + (w[j * 2 + 2] - w[j * 2]) * f, w[j * 2 + 1] + (w[j * 2 + 3] - w[j * 2 + 1]) * f);
  }
  return out;
}
/** the cord's path for a wrap (flat x,y list). Over and under lay a turn on both arms of a pole, joined behind it */
function wrapPath(kind: number, n: number, slack: number): number[] {
  const w: number[] = [];
  const band = (cx: number, cy: number, ex: number, ey: number, h: number, ox: number, oy: number, rev: boolean) => {
    for (let k = 0; k <= 8; k++) {
      const f = rev ? 1 - k / 8 : k / 8, bow = Math.sin(f * Math.PI) * slack * 2;
      w.push(cx + ex * (-h + 2 * h * f) + ox * bow, cy + ey * (-h + 2 * h * f) + oy * bow);
    }
  };
  if (kind === 0) {
    // over: across the front of pole B on both sides of the joint, snug against pole A
    const off = RA + 4 + n * 5.5 + slack, h = RB + 2;
    band(KJX + KBx * off, KJY + KBy * off, KAx, KAy, h, KBx, KBy, false);
    band(KJX - KBx * off, KJY - KBy * off, KAx, KAy, h, -KBx, -KBy, true);
  } else if (kind === 1) {
    // under: beneath B and across the back pole A on both sides of it
    const off = RB + 4 + n * 5.5 + slack, h = RA + 2;
    band(KJX - KAx * off, KJY - KAy * off, -KBx, -KBy, h, -KAx, -KAy, false);
    band(KJX + KAx * off, KJY + KAy * off, -KBx, -KBy, h, KAx, KAy, true);
  } else {
    // around: a frapping turn cinched round the lashing, starting at the top and going left
    const r = 27 + n * 2.8 + slack * 1.6;
    for (let k = 0; k <= 24; k++) { const a = -Math.PI / 2 - k / 24 * Math.PI * 1.96; w.push(KJX + Math.cos(a) * r, KJY + Math.sin(a) * r * 0.94); }
  }
  return resample(w);
}
const wrapClip = (kind: number) => kind === 0 ? (x: number, y: number) => inB(x, y, 1.2) : kind === 1 ? (x: number, y: number) => inA(x, y, 1.2) && !inB(x, y) : (x: number, y: number) => !inB(x, y);
/** a point partway along a path */
function along(pts: number[], p: number): [number, number] {
  const f = clamp(p) * PATH_N, i = Math.min(PATH_N - 1, Math.floor(f)), k = f - i;
  return [pts[i * 2] + (pts[i * 2 + 2] - pts[i * 2]) * k, pts[i * 2 + 1] + (pts[i * 2 + 3] - pts[i * 2 + 1]) * k];
}
const flaxShade = (tight: number): Shade => (sl, v, nx, ny, nz, x, y) => {
  const tw = frac(sl * 0.36 + v * 0.55);
  let b = lit(nx, ny, nz) + 0.12 + (tw < 0.5 ? 0.07 : -0.09) + tight * 0.15;
  if (hash(Math.floor(sl), Math.floor((v + 1) * 2), 8) > 0.9) b += 0.1;
  return shadeC(FLAX, b, x, y);
};

/** a hand pinching (or pointing): local f forward from the wrist to the fingertips, s to the thumb side */
function drawHand(buf: Uint32Array, px: number, py: number, ang: number, pal: number[], ax: number, ay: number, o: { sleeve?: boolean; band?: boolean; point?: boolean; k?: number; flip?: boolean }) {
  const k = o.k ?? 1.6, ca = Math.cos(ang), sa = Math.sin(ang), fl = o.flip ? -1 : 1;
  const L = (f: number, s: number): [number, number] => [px + (ca * f - sa * s * fl) * k, py + (sa * f + ca * s * fl) * k];
  const sk: Shade = (_t, _v, nx, ny, nz, x, y) => shadeC(pal, lit(nx, ny, nz) + 0.08, x, y);
  const [wx, wy] = L(-25, 1);
  if (o.sleeve) {
    const cx = ax + (wx - ax) * 0.84, cy = ay + (wy - ay) * 0.84;
    capsule(buf, ax, ay, cx, cy, 8.5 * k, 6.4 * k, (t, v, nx, ny, nz, x, y) => { const fold = Math.sin(t * 22 + v * 2.5 + Math.sin(t * 6) * 2); return shadeC(SLEEVE, lit(nx, ny, nz) + 0.08 + (frac(t * 30 + v * 0.3) < 0.5 ? 0.02 : -0.03) + (fold > 0.6 ? -0.12 : fold < -0.7 ? 0.07 : 0), x, y); }, { caps: false });
    capsule(buf, cx, cy, wx, wy, 4.4 * k, 4.1 * k, sk);
    const qx = ax + (wx - ax) * 0.78, qy = ay + (wy - ay) * 0.78;
    capsule(buf, qx, qy, cx, cy, 6.9 * k, 6.7 * k, (t, _v, nx, ny, nz, x, y) => shadeC(SLEEVE, lit(nx, ny, nz) + 0.06 + (Math.floor(t * 8) % 2 ? 0.06 : -0.04), x, y), { caps: false });
  } else {
    capsule(buf, ax, ay, wx, wy, 6.2 * k, 4.4 * k, sk, { caps: false });
  }
  if (o.band) {
    // taniko: a woven wristband, black and white niho (teeth) between ochre-red borders
    const dl = Math.hypot(ax - wx, ay - wy) || 1, bx2 = wx + (ax - wx) / dl * 7 * k, by2 = wy + (ay - wy) / dl * 7 * k;
    capsule(buf, bx2, by2, wx, wy, 4.9 * k, 4.6 * k, (t, v, nx, ny, nz, x, y) => {
      const b = lit(nx, ny, nz) + 0.1;
      if (t < 0.18 || t > 0.82) return shadeC(TAN_R, b, x, y);
      const u = (v + 1) * 5, tri = Math.abs(frac(u) * 2 - 1);
      const up = (t - 0.18) / 0.64;
      return shadeC(tri > up ? TAN_K : TAN_W, b, x, y);
    }, { caps: false });
  }
  const [p0x, p0y] = L(-21, 1.5), [p1x, p1y] = L(-11, 2.5);
  capsule(buf, p0x, p0y, p1x, p1y, 7.4 * k, 6.8 * k, sk);
  for (let i = 2; i >= 0; i--) {
    const [c0x, c0y] = L(-11 + i * 0.6, 3.6 + i * 2.9), [c1x, c1y] = L(-5.5 + i * 0.3, 4.4 + i * 2.9);
    capsule(buf, c0x, c0y, c1x, c1y, 1.9 * k, 1.8 * k, (t, _v, nx, ny, nz, x, y) => shadeC(pal, lit(nx, ny, nz) + 0.06 - t * 0.1, x, y));
  }
  const [i0x, i0y] = L(-12, -2.2), [i1x, i1y] = o.point ? L(5, -1.8) : L(-0.6, -0.6);
  capsule(buf, i0x, i0y, i1x, i1y, 2.2 * k, 1.9 * k, (t, _v, nx, ny, nz, x, y) => (t > 0.86 && nz > 0.55 ? pal[pal.length - 1] : shadeC(pal, lit(nx, ny, nz) + 0.12 + (t < 0.12 ? 0.08 : 0), x, y)));
  const [h0x, h0y] = L(-16, -7.5), [h1x, h1y] = o.point ? L(-6, -4) : L(-1.4, -2.8);
  capsule(buf, h0x, h0y, h1x, h1y, 2.5 * k, 2.1 * k, (t, _v, nx, ny, nz, x, y) => (t > 0.84 && nz > 0.55 ? pal[pal.length - 1] : shadeC(pal, lit(nx, ny, nz) + 0.1, x, y)));
}
/** Aroha's other hand, steadying pole A: palm on its upper edge, fingers curled over its front */
function drawSteadyHand(buf: Uint32Array, cx: number, cy: number, ax: number, ay: number) {
  // local lv across A (toward its lower-right edge), lu along A (up-right)
  const ux = KAx, uy = KAy, rx = -uy, ry = ux;
  const L = (lv: number, lu: number): [number, number] => [cx + rx * lv + ux * lu, cy + ry * lv + uy * lu];
  const sk: Shade = (_t, _v, nx, ny, nz, x, y) => shadeC(AROHA, lit(nx, ny, nz) + 0.06, x, y);
  const [wx, wy] = L(-RA - 11, 6);
  capsule(buf, ax, ay, wx, wy, 10, 7.4, sk, { caps: false });
  const dl = Math.hypot(ax - wx, ay - wy), bx = wx + (ax - wx) / dl * 9, by = wy + (ay - wy) / dl * 9;
  capsule(buf, bx, by, wx, wy, 8.4, 8, (t, v, nx, ny, nz, x, y) => {
    const b = lit(nx, ny, nz) + 0.1;
    if (t < 0.18 || t > 0.82) return shadeC(TAN_R, b, x, y);
    const tri = Math.abs(frac((v + 1) * 5) * 2 - 1);
    return shadeC(tri > (t - 0.18) / 0.64 ? TAN_K : TAN_W, b, x, y);
  }, { caps: false });
  const [p0x, p0y] = L(-RA - 8, 4.5), [p1x, p1y] = L(-RA + 1, 2.5);
  capsule(buf, p0x, p0y, p1x, p1y, 8.4, 7.6, sk);
  for (let f = 3; f >= 0; f--) {
    const lu = 8.5 - f * 4.6, len = [0.5, 0.62, 0.58, 0.42][f] * RA * 2;
    const [f0x, f0y] = L(-RA + 1, lu), [f1x, f1y] = L(-RA + 1 + len, lu - 1.2);
    capsule(buf, f0x, f0y, f1x, f1y, f === 3 ? 2.1 : 2.5, f === 3 ? 1.8 : 2.2, (t, _v, nx, ny, nz, x, y) => shadeC(AROHA, lit(nx, ny, nz) + 0.12 - t * t * 0.3 + (t < 0.12 ? 0.1 : 0), x, y));
  }
  const [t0x, t0y] = L(-RA - 5, 11), [t1x, t1y] = L(-RA + 4, 14.5);
  capsule(buf, t0x, t0y, t1x, t1y, 3, 2.6, (t, _v, nx, ny, nz, x, y) => (t > 0.8 && nz > 0.55 ? AROHA[6] : shadeC(AROHA, lit(nx, ny, nz) + 0.1, x, y)));
}

/** the prompt: a small arrow glyph in the shot, bevelled bone-white with an ink edge */
function drawGlyph(buf: Uint32Array, cx: number, cy: number, dir: number, sc: number, tint: number, a: number) {
  const inside = (u: number, v: number) => {
    // pointing up in local space: head rows -6..0, shaft 0..6
    if (v >= -6 && v < 0) return Math.abs(u) <= (v + 6) * 0.95 + 0.4;
    return v >= 0 && v <= 6 && Math.abs(u) <= 1.9;
  };
  const rot = [0, Math.PI, -Math.PI / 2, Math.PI / 2][dir];
  const c = Math.cos(rot), s = Math.sin(rot);
  const loc = (x: number, y: number): [number, number] => { const dx = (x + 0.5 - cx) / sc, dy = (y + 0.5 - cy) / sc; return [dx * c + dy * s, -dx * s + dy * c]; };
  const m = Math.ceil(9 * sc);
  for (let y = Math.floor(cy - m); y <= cy + m; y++) for (let x = Math.floor(cx - m); x <= cx + m; x++) {
    const [u, v] = loc(x, y);
    const [su, sv] = loc(x - 2, y - 2);
    if (inside(su, sv) && !inside(u, v)) blend(buf, x, y, hx('#140c14'), 0.4 * a);
  }
  for (let y = Math.floor(cy - m); y <= cy + m; y++) for (let x = Math.floor(cx - m); x <= cx + m; x++) {
    const [u, v] = loc(x, y);
    if (inside(u, v)) {
      const [lu, lv] = loc(x - 1, y - 1), [du, dv] = loc(x + 1, y + 1);
      let col = !inside(lu, lv) ? hx('#fffaf0') : !inside(du, dv) ? hx('#c0a07a') : hx('#f4e6c6');
      if (tint) col = mixc(col, tint, 0.55);
      blend(buf, x, y, col, a);
    } else {
      let edge = false;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const [qu, qv] = loc(x + ox, y + oy); if (inside(qu, qv)) edge = true; }
      if (edge) blend(buf, x, y, INK, a);
    }
  }
}
const GLYPH_AT: [number, number][] = [[KJX, 40], [KJX, 150], [98, KJY], [224, KJY]];

export async function lashingKnot(): Promise<boolean> {
  const cu = openCloseup();
  const buf = cu.buf;
  const base = paintKnotBase();
  const vig = vignette(0.55);
  const wraps: Wrap[] = [];
  const count = [0, 0, 0];
  const S = {
    act: null as null | { who: 'aroha' | 'mori'; kind: number; slip?: boolean; t: number; dur: number; wrap?: Wrap; path: number[]; res: () => void },
    glyph: -1, glyphPop: 0, glyphTint: 0, glyphShake: 0,
    ghost: null as null | { path: number[]; p: number; fade: number; kind: number },
    tight: 0, arohaOut: 1, fibres: [] as Spark[], embers: [] as Spark[],
    moriX: 70, moriY: 150, tipX: 0, tipY: 0,
  };
  // the clove hitch the cord starts from, on A's lower arm
  const HITCH = { x: KJX - KAx * 50, y: KJY - KAy * 50 };
  const lastTip = (): [number, number] => {
    for (let i = wraps.length - 1; i >= 0; i--) { const w = wraps[i]; return along(wrapPath(w.kind, w.n, w.slack), w.prog); }
    return [HITCH.x + KBx * -(RA + 1), HITCH.y + KBy * -(RA + 1)];
  };
  const run = (a: { who: 'aroha' | 'mori'; kind: number; slip?: boolean; dur: number; wrap?: Wrap; path: number[] }) => new Promise<void>(res => { S.act = { ...a, t: 0, res }; });
  const nextPath = (kind: number) => kind < 3 ? wrapPath(kind, count[kind], 1) : (() => { const [x, y] = lastTip(); const p: number[] = []; for (let k = 0; k <= PATH_N; k++) { const f = k / PATH_N; p.push(x + f * 52, y + Math.sin(f * Math.PI) * -6 + f * 10); } return p; })();

  let press: ((i: number) => void) | null = null;
  const kd = (e: KeyboardEvent) => { const i = KNOT.findIndex(k => k.code.includes(e.code)); if (i >= 0) { e.preventDefault(); e.stopPropagation(); press?.(i); } };
  const pd = (e: PointerEvent) => {
    const r = cu.wrap.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5;
    press?.(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 0 : 1));
  };
  window.addEventListener('keydown', kd, true);
  cu.wrap.addEventListener('pointerdown', pd);

  let clock = 0;
  const stop = loop((dt, t) => {
    if (cu.closed) return false;
    clock = t;
    knotLights();
    // ---------------------------------------------------------- animation
    const A = S.act;
    let arohaP: [number, number] | null = null;
    if (A) {
      A.t += dt;
      const p = clamp(A.t / A.dur), e = ease(p);
      if (A.who === 'aroha') {
        arohaP = along(A.path, e);
        if (S.ghost) S.ghost.p = e;
      } else if (A.slip) {
        if (A.wrap) A.wrap.prog = 1 - e;
        for (const w of wraps) w.slack = Math.min(1, w.slack + dt * 4);
      } else if (A.kind < 3 && A.wrap) {
        A.wrap.prog = e;
      } else if (A.kind === 3) {
        if (p > 0.35) for (const w of wraps) w.slack = Math.max(0, w.slack - dt * 9);
      }
      if (p >= 1) {
        if (A.slip && A.wrap) { wraps.splice(wraps.indexOf(A.wrap), 1); count[A.wrap.kind]--; }
        if (A.who === 'mori' && A.kind === 3 && !A.slip) { for (const w of wraps) w.slack = 0; }
        S.act = null; A.res();
      }
    }
    S.arohaOut += ((A?.who === 'aroha' ? 0 : 1) - S.arohaOut) * Math.min(1, dt * 6);
    S.tight = Math.max(0, S.tight - dt * 1.6);
    S.glyphPop = Math.max(0, S.glyphPop - dt * 3);
    S.glyphShake = Math.max(0, S.glyphShake - dt * 2.5);
    if (S.ghost && !A) { S.ghost.fade -= dt * 1.4; if (S.ghost.fade <= 0) S.ghost = null; }

    // ---------------------------------------------------------- draw
    buf.set(base);
    // the clove hitch
    for (const o of [-3, 3]) {
      const cx = HITCH.x + KAx * o, cy = HITCH.y + KAy * o;
      cord(buf, [cx - KBx * (RA + 1.5), cy - KBy * (RA + 1.5), cx + KBx * (RA + 1.5), cy + KBy * (RA + 1.5)], 1.7, flaxShade(0), (x, y) => inA(x, y, 1.2) && !inB(x, y));
    }
    cord(buf, [HITCH.x + KBx * 9 - KAx * 3, HITCH.y + KBy * 9 - KAy * 3, HITCH.x - KBx * 9 + KAx * 3, HITCH.y - KBy * 9 + KAy * 3], 1.7, flaxShade(0.1), (x, y) => inA(x, y, 1.2));
    // the wraps: under B first, then round the joint, then over B; each with a soft shadow on the wood
    for (const kind of [1, 2, 0]) for (const w of wraps) {
      if (w.kind !== kind || w.prog <= 0) continue;
      const path = wrapPath(w.kind, w.n, w.slack);
      const m = Math.max(1, Math.ceil(w.prog * PATH_N));
      const pts = path.slice(0, m * 2);
      pts.push(...along(path, w.prog));
      const clip = wrapClip(w.kind);
      for (let i = 0; i + 1 < pts.length; i += 2) for (let q = -2; q <= 2; q++) {
        const sx = pts[i] + 2 + q * 0.4, sy = pts[i + 1] + 2.5;
        if ((inA(sx | 0, sy | 0) || inB(sx | 0, sy | 0)) && clip(sx | 0, sy | 0)) blend(buf, sx, sy, hx('#1a1020'), 0.12 + w.slack * 0.05);
      }
      // each turn is laid as a doubled cord, the two strands side by side along the pole
      if (w.kind === 2) cord(buf, pts, 1.9, flaxShade(S.tight * (1 - w.slack)), clip);
      else {
        const ox = (w.kind === 0 ? KBx : KAx) * 1.7, oy = (w.kind === 0 ? KBy : KAy) * 1.7;
        for (const sg of [-1, 1]) cord(buf, pts.map((v, i) => v + (i % 2 ? oy : ox) * sg), 1.3, flaxShade(S.tight * (1 - w.slack) + (sg > 0 ? -0.05 : 0.04)), clip);
      }
    }
    // the working strand: from the last turn to Mori's fingers, then the loose coil off the bottom
    const [tx, ty] = lastTip();
    const moriBusy = A && A.who === 'mori';
    let mx: number, my: number;
    const ol = Math.hypot(tx - KJX, ty - KJY) || 1, onx = (tx - KJX) / ol, ony = (ty - KJY) / ol;
    if (moriBusy && A!.kind === 3 && !A!.slip) { const yk = Math.sin(clamp(A!.t / A!.dur) * Math.PI); mx = tx + 24 + yk * 40; my = ty + 14 + yk * 10; }
    else if (moriBusy) { mx = tx + onx * 34 + 4; my = ty + ony * 34 + 8; }
    else if (S.glyph >= 0 && press) { mx = tx + onx * 38 + 6 + Math.sin(t * 2) * 2; my = ty + ony * 38 + 10 + Math.cos(t * 1.7) * 2; }
    else { mx = tx + onx * 40 + 4 + Math.sin(t * 1.3) * 2; my = ty + ony * 40 + 12 + Math.cos(t * 1.1) * 2; }
    // Mori works from below: his hand keeps clear of the joint so the turns stay in view
    my = clamp(my, KJY + 36 + Math.abs(mx - KJX) * 0.1, 158); mx = clamp(mx, 70, 262);
    S.moriX += (mx - S.moriX) * Math.min(1, dt * (moriBusy ? 30 : 6)); S.moriY += (my - S.moriY) * Math.min(1, dt * (moriBusy ? 30 : 6));
    {
      const pts: number[] = [];
      const hx0 = S.moriX, hy0 = S.moriY;
      const d = Math.hypot(hx0 - tx, hy0 - ty);
      for (let k = 0; k <= 12; k++) { const f = k / 12; pts.push(tx + (hx0 - tx) * f, ty + (hy0 - ty) * f + Math.sin(f * Math.PI) * Math.min(10, d * 0.12)); }
      for (let k = 1; k <= 14; k++) { const f = k / 14; pts.push(hx0 + (-40 - hx0) * f, hy0 + (CH + 30 - hy0) * f * f + Math.sin(f * Math.PI) * 10); }
      cord(buf, pts, 1.6, flaxShade(0));
    }
    // fibres flicking off when it's pulled tight
    for (let i = S.fibres.length - 1; i >= 0; i--) {
      const f = S.fibres[i];
      f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 60 * dt;
      if (f.life <= 0) { S.fibres.splice(i, 1); continue; }
      put(buf, f.x, f.y, FLAX[6]); put(buf, f.x + (f.vx > 0 ? 1 : -1), f.y + 1, FLAX[4]);
    }
    // Mori's hand holding the cord
    drawHand(buf, S.moriX, S.moriY, Math.atan2(S.moriY - 262, S.moriX - 40), SKIN, 40, 262, { sleeve: true, k: 1.25 });
    // Aroha: one hand steadying the frame, the other showing the move
    drawSteadyHand(buf, KJX + KAx * 80, KJY + KAy * 80, 350, -30);
    {
      const ghost = S.ghost;
      if (ghost) {
        const n = Math.floor(ghost.p * PATH_N);
        for (let k = 0; k <= n; k++) {
          if (k % 2) continue;
          const x = ghost.path[k * 2], y = ghost.path[k * 2 + 1];
          const a = Math.min(1, ghost.fade) * 0.75;
          blend(buf, x, y, hx('#fff4d0'), a); blend(buf, x + 1, y, hx('#fff4d0'), a * 0.6); blend(buf, x, y + 1, hx('#e8c88a'), a * 0.6);
        }
      }
      const ap = arohaP ?? [300 + S.arohaOut * 40, -20 - S.arohaOut * 60];
      const ax = 330, ay = -70;
      drawHand(buf, ap[0], ap[1], Math.atan2(ap[1] - ay, ap[0] - ax), AROHA, ax, ay, { band: true, point: true, k: 1.25, flip: true });
    }
    // the prompt glyph
    if (S.glyph >= 0) {
      const [gx, gy] = GLYPH_AT[S.glyph];
      const bob = Math.sin(t * 4) * 1.2, sc = 1.3 + S.glyphPop * 0.45;
      const shx = Math.sin(t * 60) * S.glyphShake * 3;
      drawGlyph(buf, gx + shx, gy + bob, S.glyph, sc, S.glyphTint, 1);
    }
    // embers drifting across from the fire
    if (Math.random() < dt * 3) S.embers.push({ x: -4, y: 120 + Math.random() * 60, vx: 18 + Math.random() * 16, vy: -12 - Math.random() * 10, life: 5, max: 5, c: 0 });
    for (let i = S.embers.length - 1; i >= 0; i--) {
      const e = S.embers[i];
      e.life -= dt; e.x += (e.vx + Math.sin(t * 2 + i) * 5) * dt; e.y += e.vy * dt;
      if (e.life <= 0 || e.x > CW) { S.embers.splice(i, 1); continue; }
      put(buf, e.x, e.y, e.life > 2.5 ? hx('#ffe08a') : hx('#ff8a3a'));
    }
    applyVignette(buf, vig);
    (window as unknown as { __knot?: unknown }).__knot = { t: +t.toFixed(2), act: S.act ? S.act.who + S.act.kind : "", wraps: wraps.length, glyph: S.glyph, busy: !!S.act, input: !!press };
    cu.present();
    return true;
  });

  const sleep = (s: number) => new Promise<void>(res => { const t0 = clock; const chk = () => (cu.closed || clock - t0 >= s ? res() : requestAnimationFrame(chk)); chk(); });
  audio.play('uiOpen', { vol: 0.3 });
  cu.hint(`Watch Aroha’s hands, then do the same: ${['over', 'under', 'around', 'pull'].map((w, i) => `<span class="key">${pxIcon(KNOT[i].key)}</span> ${w}`).join(' ')}`, 6000);
  let mistakes = 0;
  const SLIP = ['Ah, it slipped. Back one.', 'Keep the tension on it!', 'Other way. Again.'];
  let slips = 0;
  const moriMove = async (kind: number) => {
    if (kind < 3) {
      const w: Wrap = { kind, n: count[kind]++, prog: 0, slack: 1 };
      wraps.push(w);
      audio.play('rope', { vol: 0.4, pitch: 0.95 + Math.random() * 0.15 });
      await run({ who: 'mori', kind, dur: 0.42, wrap: w, path: [] });
    } else {
      audio.play('rope', { vol: 0.55, pitch: 0.75 }); audio.play('woodCreak', { vol: 0.4 });
      S.tight = 1;
      const [x, y] = lastTip();
      for (let i = 0; i < 12; i++) S.fibres.push({ x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.3) * 60, vy: -20 - Math.random() * 40, life: 0.6, max: 0.6, c: 0 });
      await run({ who: 'mori', kind, dur: 0.4, path: [] });
    }
  };
  const moriSlip = async (undo: number) => {
    audio.play('wrong', { vol: 0.4 }); audio.play('rope', { vol: 0.3, pitch: 0.6 });
    const w = undo >= 0 && undo < 3 ? [...wraps].reverse().find(q => q.kind === undo) : undefined;
    await run({ who: 'mori', kind: undo, slip: true, dur: 0.45, wrap: w, path: [] });
  };

  for (const [ri, len] of [4, 5].entries()) {
    if (cu.closed) break;
    const seq = Array.from({ length: len }, (_, i) => (i < 4 && len === 4 ? i : Math.floor(Math.random() * 4)));
    cu.say('Aroha', ri === 0 ? 'Watch my hands. *Over, under, around, pull tight.*' : 'Ka pai. A longer one now. Watch.', { color: AROHA_C, ms: 2800 });
    await sleep(1.1);
    // Aroha shows each move: her finger traces the cord's path and the glyph pops up beside it
    for (const k of seq) {
      if (cu.closed) break;
      S.glyph = k; S.glyphPop = 1; S.glyphTint = 0;
      const path = nextPath(k);
      S.ghost = { path, p: 0, fade: 1.2, kind: k };
      audio.play('rope', { vol: 0.25, pitch: 1.2 });
      await run({ who: 'aroha', kind: k, dur: 0.62, path });
      await sleep(0.18);
    }
    S.glyph = -1;
    await sleep(0.3);
    cu.say('Aroha', ri === 0 ? 'Your turn.' : 'Now you.', { color: AROHA_C, ms: 1600 });
    // the player repeats it
    let at = 0;
    const queue: number[] = [];
    S.glyph = seq[0]; S.glyphPop = 1;
    const ok = await new Promise<boolean>(done => {
      const t0 = clock;
      let finished = false, failed = false;
      const pump = async () => {
        while (queue.length && !finished) {
          const i = queue.shift()!;
          if (i === seq[at]) {
            S.glyphTint = hx('#ffd860'); S.glyphPop = 0.6;
            at++;
            await moriMove(i);
            S.glyphTint = 0;
            if (at >= seq.length) { finished = true; press = null; S.glyph = -1; done(!failed); return; }
            S.glyph = seq[at]; S.glyphPop = 1;
          } else {
            failed = true; mistakes++;
            S.glyphTint = hx('#e8583c'); S.glyphShake = 1;
            cu.say('Aroha', SLIP[slips++ % SLIP.length], { color: AROHA_C, ms: 1800 });
            if (at > 0) { at--; await moriSlip(seq[at]); } else await moriSlip(-1);
            S.glyphTint = 0; S.glyph = seq[at]; S.glyphPop = 1;
            queue.length = 0;
          }
        }
        busy = false;
      };
      let busy = false;
      press = i => { queue.push(i); if (!busy) { busy = true; void pump(); } };
      const watch = () => {
        if (finished || cu.closed) return;
        if (clock - t0 > 3.4 + len * 0.6 + (failed ? 2 : 0)) { finished = true; press = null; S.glyph = -1; done(false); return; }
        requestAnimationFrame(watch);
      };
      watch();
    });
    press = null;
    if (!ok) {
      if (at < seq.length) {
        mistakes++;
        cu.say('Aroha', 'Too slow, it’s gone loose. Here...', { color: AROHA_C, ms: 1800 });
        for (const w of wraps) w.slack = 1;
      }
      await sleep(1);
    } else { cu.say('Aroha', ri === 0 ? '*Tight!*' : '*Tika.* That’s it.', { color: AROHA_C, ms: 1400 }); await sleep(0.9); }
  }
  window.removeEventListener('keydown', kd, true);
  cu.wrap.removeEventListener('pointerdown', pd);
  const good = mistakes === 0;
  if (!cu.closed) {
    audio.play(good ? 'star' : 'wrong', { vol: 0.5 });
    if (good) cu.flash();
    await cu.result(good ? 'TIKA!' : 'LOOSE...', good ? 'lashed tight' : 'it’ll stand. mostly.', !good);
    await cu.close();
  }
  stop();
  return good;
}

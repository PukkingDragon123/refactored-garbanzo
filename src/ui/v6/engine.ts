// V6 engine repair close-up: Jenna's emergency, Dave-the-Diver style. The camera is right in the
// Kittiwake's little diesel, full screen and UI-free: a painted engine room (grimy bulkhead with a
// caged bulb that flickers, the teal engine block with a cutaway into its cylinders, pipes, a brass
// gauge, the fuse box) seen in 3/4, with the bulkhead on a slower parallax layer so the room has
// depth when the camera pans between the four jobs. Mori's hands and forearms do every action.
//  1. valve: the big red handwheel on the fuel line. Alternate A / D (or tap left / right). It is
//     seized at first (judders, sheds rust), cracks free, then spins up. The wheel is the progress.
//  2. bleed: hold to back the bleed screw out; air hisses and bubbles spit out, then diesel as the
//     air clears and the needle climbs. Let go in the green; past the red it sprays all over you.
//  3. fuse: F3 is blackened. Pick from the tray in Mori's hand (1-4, Left/Right + Space, or click).
//     Wrong ones zap; the blue fifteen clicks in.
//  4. start: the flywheel turns over; jab the starter as its timing mark swings past the pointer,
//     three times: cough, splutter, VROOM, the whole engine shaking and smoking.
// Jenna coaches through the corner speech bubble, with the same lines as the old panel version.

import { openCloseup, CW, CH, rgb, hx, mixc, ramp, dith, hash, R, G, B } from './closeup';
import { Hold, loop } from '../v4/mini';
import { audio } from '../../core/audio';
import { closeupHands, HANDS3D, HandsController } from '../../art/v11/hands3d';

type Stage = 'valve' | 'bleed' | 'fuse' | 'start';
const STAGES: Stage[] = ['valve', 'bleed', 'fuse', 'start'];

// ------------------------------------------------------------------ palettes (dark to light)
const INK = hx('#1a1014');
const BULK = ['#1e1a17', '#2c2622', '#3c342d', '#4e443a', '#62564a', '#786a5a', '#90806c', '#a8987e'].map(hx);
const TEAL = ['#0c1818', '#142626', '#1c3636', '#264a48', '#315e5a', '#3e746c', '#528a7e', '#6ea896', '#94c8b0'].map(hx);
const IRON = ['#101014', '#18181e', '#222229', '#2e2e36', '#3e3e48', '#52525e', '#6c6c7a', '#8e8e9c'].map(hx);
const STEEL = ['#23272d', '#3c4249', '#5c646c', '#86909a', '#b4bcc4', '#e4eaee', '#ffffff'].map(hx);
const ALU = ['#2a2e32', '#40464c', '#5c646a', '#7e878d', '#a4acb0', '#c8d0d2', '#eef2f2'].map(hx);
const BRASS = ['#2a1a0a', '#4a3012', '#72501e', '#9c742c', '#c49a40', '#e2bc5c', '#f4dc94', '#fff6d8'].map(hx);
const COPPER = ['#2a120a', '#4a2212', '#72381c', '#9a5428', '#c07238', '#dc9656', '#f2c48c', '#fff0d8'].map(hx);
const RED = ['#260808', '#4a0e0c', '#761812', '#a2241a', '#c83826', '#e05a3a', '#f28e66', '#ffd2b4'].map(hx);
const RUST = ['#2a1206', '#48200e', '#6a3216', '#8e4820', '#b0622c', '#cc8446', '#e0a868'].map(hx);
const LAG = ['#2e2820', '#4a4236', '#6a604e', '#8a7e68', '#a89c82', '#c4b89c', '#dcd2b8'].map(hx);
const RUBBER = ['#0c0c0e', '#16161a', '#212126', '#2e2e35', '#404048', '#5a5a64'].map(hx);
const SKIN = ['#8c392f', '#ba805d', '#d49672', '#f3a572', '#f8c090'].map(hx);
const SLEEVE = ['#2a2426', '#3e3638', '#555052', '#6c6668', '#858082'].map(hx);
const CREAM = ['#5e5444', '#857a64', '#ada084', '#d0c4a4', '#e8dec2', '#f8f2e0', '#fffcf2'].map(hx);
const BOXP = ['#161c20', '#20292e', '#2c3a40', '#3c4e56', '#50666e', '#688088', '#86a0a6', '#a8c0c2'].map(hx);
const SOOT = hx('#0e0a0a');
const DIESEL = ['#3a2208', '#5e3a10', '#8a5a1c', '#b8822c', '#dcaa4c', '#f4d488'].map(hx);
const JACKET = ['#060c0c', '#0c1616', '#12201f', '#1a2c2a'].map(hx);
const CUTF = ['#6a1c0c', '#9a3016', '#c24a22', '#dc6a36'].map(hx);
const FUSES = [
  { a: 10, pal: ['#4a0a0a', '#8a1818', '#c42c24', '#e84a3a', '#ff8a78', '#ffd0c8'].map(hx) },
  { a: 15, pal: ['#0a1a4a', '#14328a', '#2250c4', '#3a78e8', '#78aaff', '#cce0ff'].map(hx) },
  { a: 20, pal: ['#4a3606', '#8a660c', '#c49a18', '#e8c23a', '#ffe078', '#fff4c8'].map(hx) },
  { a: 30, pal: ['#0a3a12', '#146a22', '#249a34', '#44c050', '#8ae88a', '#d4ffd0'].map(hx) },
];

// ------------------------------------------------------------------ world layout
// The engine layer is the world; the bulkhead behind it scrolls at PF of the camera (parallax).
const WW = 576, WH = 330, PF = 0.7;
const BW = 500, BH = 290;
const VIEW: Record<Stage, [number, number]> = { valve: [0, 0], bleed: [256, 0], fuse: [256, 150], start: [0, 150] };
const PAN_T = 1.5;
// valve
const WX = 150, WY = 90, WRX = 47, WRY = 44, PIPE_Y = 90;
// fuel filter, gauge, bleed screw
const GX = 440, GY = 72, GR = 36;
const FH = { x0: 390, y0: 114, x1: 520, y1: 144, dep: 10 };
const BOWL = { x0: 430, x1: 470, y0: 144, y1: 174 };
const SCREW = { x: 524, y: 128 };
// fuse box (bulkhead coordinates) and the tray in Mori's hand (world)
const FBO: [number, number] = [Math.round(VIEW.fuse[0] * PF), Math.round(VIEW.fuse[1] * PF)];
const FB = { x0: FBO[0] + 128, y0: FBO[1] + 36, x1: FBO[0] + 288, y1: FBO[1] + 146, dep: 12 };
const FB_IN = 8; // inner wall depth
const slotX = (i: number) => FB.x0 + 26 + i * 21 + Math.round(FB_IN * 0.76);
const SLOT_Y = FB.y0 + 34;
const TRAY = { x0: 400, x1: 536, y0: 286, y1: 314 };
const trayFuseX = (i: number) => TRAY.x0 + 16 + i * 30;
// flywheel, cutaway, starter
const FWX = 84, FWY = 258, FRX = 50, FRY = 48;
const CUT = { x0: 152, x1: 252, y0: 188, y1: 308 };
const BORES = [184, 220], BORE_HW = 12, BORE_TOP = 224, CRANK_Y = 292, CRANK_R = 11, ROD = 40;
const BTN = { x: 296, y: 300 }, KEY = { x: 274, y: 280 };
// the caged bulb (bulkhead coordinates)
const BULB = { x: 298, y: 22 };

// ------------------------------------------------------------------ layers and helpers
interface Lay { w: number; h: number; d: Uint32Array }
const mk = (w: number, h: number): Lay => ({ w, h, d: new Uint32Array(w * h) });
// the sprite scratch layer keeps a bounding box of what was drawn, so compositing only scans that
let SPR: Lay | null = null;
const BB = [1e9, 1e9, -1e9, -1e9];
function sp(L: Lay, x: number, y: number, c: number) {
  x = Math.floor(x); y = Math.floor(y);
  if (c && x >= 0 && y >= 0 && x < L.w && y < L.h) {
    L.d[y * L.w + x] = c;
    if (L === SPR) { if (x < BB[0]) BB[0] = x; if (y < BB[1]) BB[1] = y; if (x > BB[2]) BB[2] = x; if (y > BB[3]) BB[3] = y; }
  }
}
function sb(L: Lay, x: number, y: number, c: number, a: number) {
  x = Math.floor(x); y = Math.floor(y);
  if (a <= 0 || x < 0 || y < 0 || x >= L.w || y >= L.h) return;
  const i = y * L.w + x;
  if (!(L.d[i] >>> 24)) return;
  L.d[i] = a >= 1 ? c : mixc(L.d[i], c, a);
}
function sadd(L: Lay, x: number, y: number, r: number, g: number, b: number) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= L.w || y >= L.h) return;
  const i = y * L.w + x, v = L.d[i];
  L.d[i] = rgb(Math.min(255, R(v) + r), Math.min(255, G(v) + g), Math.min(255, B(v) + b));
}
const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
const ease = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const wrapPi = (a: number) => { a %= Math.PI * 2; if (a > Math.PI) a -= Math.PI * 2; if (a < -Math.PI) a += Math.PI * 2; return a; };
function vn(x: number, y: number, s: number, seed = 0) {
  const X = x / s, Y = y / s, i = Math.floor(X), j = Math.floor(Y), fx = X - i, fy = Y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(i, j, seed), b = hash(i + 1, j, seed), c = hash(i, j + 1, seed), d = hash(i + 1, j + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x: number, y: number, s: number, seed = 0) => vn(x, y, s, seed) * 0.55 + vn(x, y, s / 2, seed + 1) * 0.3 + vn(x, y, s / 4, seed + 2) * 0.15;

// light from the upper left and a little in front
const LV = (() => { const v = [-0.52, -0.64, 0.56], l = Math.hypot(v[0], v[1], v[2]); return v.map(a => a / l); })();
const lam = (nx: number, ny: number, nz: number) => nx * LV[0] + ny * LV[1] + nz * LV[2];
const specl = (nx: number, ny: number, nz: number, p: number) => { const rz = 2 * lam(nx, ny, nz) * nz - LV[2]; return rz > 0 ? rz ** p : 0; };
/** shade a surface normal into a palette, with an optional hard specular highlight */
function sh(pal: number[], nx: number, ny: number, nz: number, x: number, y: number, base = 0.3, gain = 0.72, sp0 = 0, pw = 14) {
  const l = base + gain * lam(nx, ny, nz);
  if (sp0 > 0) {
    const s = specl(nx, ny, nz, pw) * sp0;
    if (s > 0.6) return pal[pal.length - 1];
    return ramp(pal, l + s * 0.5, x, y);
  }
  return ramp(pal, l, x, y);
}
/** ellipse fill with the local normal of a dome (nz from the ellipse) */
function ell(L: Lay, cx: number, cy: number, rx: number, ry: number, fn: (nx: number, ny: number, nz: number, x: number, y: number) => number) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, r2 = nx * nx + ny * ny;
    if (r2 > 1) continue;
    sp(L, x, y, fn(nx, ny, Math.sqrt(1 - r2), x, y));
  }
}
/** a round tube along a polyline, shaded from its normal; s is the distance along the path */
function tube(L: Lay, pts: number[][], r: number, fn: (nx: number, ny: number, nz: number, x: number, y: number, s: number) => number) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const cum = [0];
  for (let i = 0; i < pts.length; i++) {
    x0 = Math.min(x0, pts[i][0]); y0 = Math.min(y0, pts[i][1]); x1 = Math.max(x1, pts[i][0]); y1 = Math.max(y1, pts[i][1]);
    if (i) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  for (let y = Math.max(0, Math.floor(y0 - r)); y <= Math.min(L.h - 1, Math.ceil(y1 + r)); y++) for (let x = Math.max(0, Math.floor(x0 - r)); x <= Math.min(L.w - 1, Math.ceil(x1 + r)); x++) {
    const px = x + 0.5, py = y + 0.5;
    let best = 1e9, qx = 0, qy = 0, bs = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0], ay = pts[i][1], dx = pts[i + 1][0] - ax, dy = pts[i + 1][1] - ay, l2 = dx * dx + dy * dy || 1;
      const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1), cx = ax + dx * t, cy = ay + dy * t;
      const d2 = (px - cx) ** 2 + (py - cy) ** 2;
      if (d2 < best) { best = d2; qx = cx; qy = cy; bs = cum[i] + Math.sqrt(l2) * t; }
    }
    if (best > r * r) continue;
    const nx = (px - qx) / r, ny = (py - qy) / r;
    sp(L, x, y, fn(nx, ny, Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), x, y, bs));
  }
}
// oblique box: front face, lit top face and shaded right side receding up-right (the depth axis)
const DX = 0.76, DY = 0.65;
function box(L: Lay, x0: number, y0: number, x1: number, y1: number, dep: number,
  front: (x: number, y: number, u: number, v: number) => number, top: (x: number, y: number, u: number, k: number) => number, side: (x: number, y: number, k: number, v: number) => number) {
  for (let y = Math.floor(y0 - dep * DY); y < y0; y++) {
    const k = (y0 - y - 0.5) / DY;
    if (k < 0 || k > dep) continue;
    const s = k * DX;
    for (let x = Math.floor(x0 + s); x < x1 + s; x++) sp(L, x, y, top(x, y, (x - x0 - s) / (x1 - x0), k / dep));
  }
  for (let x = x1; x < x1 + dep * DX; x++) {
    const k = (x - x1 + 0.5) / DX, s = k * DY;
    for (let y = Math.floor(y0 - s); y < y1 - s; y++) sp(L, x, y, side(x, y, k / dep, (y - y0 + s) / (y1 - y0)));
  }
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) sp(L, x, y, front(x, y, (x - x0) / (x1 - x0), (y - y0) / (y1 - y0)));
}
/** painted cast metal: speckle, grime and chipped paint showing rust */
function enamel(pal: number[], lit: number, x: number, y: number, chip = 0.8) {
  const n = fbm(x, y, 8, 11);
  if (n > chip) return ramp(RUST, 0.28 + (n - chip) * 2.5 + (hash(x, y, 3) - 0.5) * 0.2, x, y);
  if (n > chip - 0.025) lit += 0.16; // the lit lip of a paint chip
  lit += (hash(x, y, 9) - 0.5) * 0.07 - (fbm(x, y, 34, 12) - 0.5) * 0.24;
  return ramp(pal, lit, x, y);
}
/** paint chips cluster along worn edges */
const edgeChip = (e: number) => 0.86 - Math.max(0, 1 - e / 7) * 0.16;
function bolt(L: Lay, x: number, y: number, r = 2.3, pal = IRON, tear = 0) {
  ell(L, x, y, r, r, (nx, ny, nz, px, py) => nx * nx + ny * ny > 0.72 ? pal[1] : sh(pal, nx, ny, nz, px, py, 0.4, 0.7, 0.8, 8));
  if (tear > 0) for (let k = 1; k < tear; k++) sb(L, x + (hash(x, k) < 0.2 ? 1 : 0), y + r + k, RUST[3], 0.55 * (1 - k / tear));
}
/** 1 px ink outline where a layer's opaque pixels meet transparency */
function inkLayer(L: Lay) {
  const s = L.d.slice(), w = L.w, h = L.h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (s[i] >>> 24) continue;
    if ((x > 0 && s[i - 1] >>> 24) || (x < w - 1 && s[i + 1] >>> 24) || (y > 0 && s[i - w] >>> 24) || (y < h - 1 && s[i + w] >>> 24)) L.d[i] = INK;
  }
}
/** draw a sprite layer onto the frame with an ink outline (and optionally a soft shadow cast down-right) */
function flush(S: Lay, F: Lay, shadow = 0) {
  const s = S.d, f = F.d, w = S.w, h = S.h;
  if (BB[2] < BB[0]) return;
  const X0 = Math.max(0, BB[0] - 1), Y0 = Math.max(0, BB[1] - 1), X1 = Math.min(w - 1, BB[2] + 1 + shadow), Y1 = Math.min(h - 1, BB[3] + 1 + shadow);
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    const i = y * w + x, v = s[i];
    if (v >>> 24) { f[i] = v; continue; }
    if ((x > 0 && s[i - 1] >>> 24) || (x < w - 1 && s[i + 1] >>> 24) || (y > 0 && s[i - w] >>> 24) || (y < h - 1 && s[i + w] >>> 24)) { f[i] = INK; continue; }
    if (shadow && x >= shadow && y >= shadow && s[i - shadow * w - shadow] >>> 24) f[i] = mixc(f[i], INK, 0.42);
  }
  // clear what was drawn, ready for the next sprite
  for (let y = BB[1]; y <= BB[3]; y++) s.fill(0, y * w + BB[0], y * w + BB[2] + 1);
  BB[0] = BB[1] = 1e9; BB[2] = BB[3] = -1e9;
}

// tiny 3x5 stencil font
const FONT: Record<string, string> = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001011001111', '4': '101101111001001',
  '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111',
  F: '111100110100100', P: '110101110100100', S: '011100010001110', I: '111010010010111', T: '111010010010010', A: '010101111101101',
  R: '110101110101101', U: '101101101101111', E: '111100110100111', L: '100100100100111', D: '110101101101110', C: '011100100100011',
  O: '111101101101111', N: '101111111101101', K: '101110100110101', W: '101101111111101', '!': '010010010000010', '-': '000000111000000',
};
function txt(L: Lay, s: string, x: number, y: number, c: number, blendA = 1) {
  for (let k = 0; k < s.length; k++) {
    const g = FONT[s[k]];
    if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') { if (blendA >= 1) sp(L, x + k * 4 + (i % 3), y + Math.floor(i / 3), c); else sb(L, x + k * 4 + (i % 3), y + Math.floor(i / 3), c, blendA); }
  }
}

// ------------------------------------------------------------------ the bulkhead (static, parallax layer)
function paintFuse(L: Lay, x: number, y: number, pal: number[], amps: number, legs: boolean, lift = 0, big = false) {
  // a blade fuse: glossy translucent head with the rating embossed, two tinned blades
  y -= lift;
  const W = big ? 13 : 10, H = big ? 14 : 11;
  if (legs) for (let k = 0; k < 6; k++) { sp(L, x + 1, y + H - 1 + k, STEEL[4]); sp(L, x + 2, y + H - 1 + k, STEEL[2]); sp(L, x + W - 3, y + H - 1 + k, STEEL[4]); sp(L, x + W - 2, y + H - 1 + k, STEEL[2]); }
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
    if (yy === 0 && (xx === 0 || xx === W - 1)) continue;
    const nx = (xx + 0.5 - W / 2) / (W / 2);
    let c = ramp(pal, 0.64 - nx * 0.4 - yy / (H * 3) + (yy < 3 ? 0.1 : 0), x + xx, y + yy);
    if (xx === 1 && yy > 0 && yy < H - 2) c = pal[5];
    if (xx === 0 || xx === W - 1 || yy === H - 1) c = pal[0];
    if (yy === 2 && xx > 1 && xx < W - 2) c = mixc(pal[4], STEEL[5], 0.5); // the element seen through the clear top
    if (big && yy === 3 && xx > 2 && xx < W - 3) c = mixc(pal[3], STEEL[4], 0.4);
    sp(L, x + xx, y + yy, c);
  }
  txt(L, String(amps), x + Math.floor((W - 7) / 2) + 1, y + (big ? 6 : 4), big ? pal[0] : pal[1]);
}
function paintBack(): Lay {
  const L = mk(BW, BH);
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
    let c: number;
    if (y < 12) {
      // deckhead: beams running toward us over the room
      const bx = (x + 8) % 46, beam = bx < 14;
      let lit = beam ? 0.34 - bx / 14 * 0.12 : 0.12 + y / 12 * 0.06;
      if (y === 11) lit = beam ? 0.5 : 0.24;
      c = ramp(BULK, lit + (fbm(x, y, 20, 1) - 0.5) * 0.1, x, y);
    } else {
      const yy = y - 12, row = Math.floor(yy / 70), ly = yy - row * 70;
      const off = (row & 1) * 44, col = Math.floor((x + off) / 88), lx = x + off - col * 88;
      const gr = fbm(x, y, 36, 3);
      let lit = 0.64 - y / BH * 0.34 + (hash(col, row, 5) - 0.5) * 0.08 - (gr - 0.45) * 0.34 - Math.max(0, ly - 54) / 16 * 0.1 + Math.sin(lx / 88 * Math.PI) * 0.05;
      lit += (hash(x, y, 1) - 0.5) * 0.05;
      c = ramp(BULK, lit, x, y);
      if (ly === 0 || lx === 0) c = BULK[1];
      else if (ly === 1 || lx === 1) c = mixc(BULK[6], c, 0.45);
      // frames: flat bars standing proud of the plating, lit on their left face
      const fx = (x + 30) % 150;
      if (fx < 14) {
        const lf = fx < 3 ? 0.8 : fx < 11 ? 0.56 - (fx - 3) * 0.02 : 0.2;
        c = ramp(BULK, lf - y / BH * 0.3 - (gr - 0.45) * 0.3, x, y);
        if (fx === 13) c = BULK[0];
      } else if (fx < 21) c = mixc(c, BULK[0], (21 - fx) / 7 * 0.6);
      // oily grime pooling low down
      const oil = fbm(x, y, 18, 7);
      if (y > 150 && oil > 0.6 - (y - 150) / 600) c = mixc(c, hx('#1a130c'), Math.min(0.5, (oil - 0.5) * 2));
    }
    L.d[y * BW + x] = c;
  }
  // rivets along the seams, some weeping rust
  const rivet = (x: number, y: number) => {
    sp(L, x, y, BULK[6]); sp(L, x + 1, y, BULK[5]); sp(L, x, y + 1, BULK[4]); sp(L, x + 1, y + 1, BULK[1]);
    if (hash(x, y, 4) < 0.28) { const n = 4 + hash(x, y, 5) * 14; for (let k = 2; k < n; k++) sb(L, x + (k > 6 && hash(x, k) < 0.3 ? 1 : 0), y + k, RUST[3], 0.45 * (1 - k / n)); }
  };
  for (let row = 0; row < 5; row++) { const y = 12 + row * 70; for (let x = 4; x < BW; x += 9) { rivet(x, y - 4); rivet(x, y + 3); } }
  for (let f = 0; f < 5; f++) { const x = f * 150 - 30 + 6; for (let y = 16; y < BH; y += 11) rivet(x, y); }
  // soot on the deckhead above the exhaust riser
  for (let y = 0; y < 60; y++) for (let x = 230; x < 320; x++) { const d = Math.hypot((x - 272) / 34, y / 50); if (d < 1) sb(L, x, y, SOOT, (1 - d) * 0.55 * (0.7 + fbm(x, y, 8, 2) * 0.6)); }
  // cable tray under the deckhead: a lit steel ledge and sagging cables between hangers
  for (let x = 0; x < BW; x++) { sp(L, x, 20, BULK[6]); sp(L, x, 21, BULK[4]); sp(L, x, 22, BULK[2]); }
  const CAB = [RUBBER, RED, RUBBER, ['#3a3a30', '#5a5a48', '#7a7a62', '#9a9a80', '#b8b89c'].map(hx)];
  for (let i = 0; i < 4; i++) for (let x = 0; x < BW; x++) {
    const sag = Math.sin(((x + i * 7) % 64) / 64 * Math.PI) * (2 + i * 0.6);
    const y = 23 + i * 2.2 + sag;
    sp(L, x, y, CAB[i][Math.min(CAB[i].length - 1, 3)]); sp(L, x, y + 1, CAB[i][1]); sp(L, x, y + 2, CAB[i][0]);
  }
  for (let x = 20; x < BW; x += 64) for (let y = 12; y < 36; y++) { sp(L, x, y, BULK[5]); sp(L, x + 1, y, BULK[2]); }
  // a spanner rack on the bulkhead (valve view, top left)
  for (let x = 16; x < 92; x++) { sp(L, x, 38, BULK[6]); sp(L, x, 39, IRON[3]); sp(L, x, 40, IRON[1]); }
  for (let i = 0; i < 5; i++) {
    const x = 22 + i * 15, len = 30 - i * 4, w = 3 - (i > 2 ? 1 : 0);
    sp(L, x + 1, 37, STEEL[3]);
    for (let y = 41; y < 41 + len; y++) for (let k = -w; k <= w; k++) { const t = (k + w) / (2 * w); sp(L, x + k, y, ramp(STEEL, 0.72 - t * 0.55 - (y - 41) / 120, x + k, y)); }
    // open jaw at the bottom, ring end at the top
    for (let a = 0; a < 6.3; a += 0.2) { sp(L, x + Math.cos(a) * (w + 2), 41 + len + 3 + Math.sin(a) * (w + 2), a > 4 && a < 5.4 ? BULK[3] : STEEL[3]); }
    for (let y = 41 + len + 1; y < 41 + len + 5; y++) sp(L, x, y, BULK[2]);
    for (let yy = 41; yy < 41 + len + 6; yy++) sb(L, x + w + 2, yy + 2, BULK[0], 0.5);
  }
  // Jenna's sticky note: "DON'T TOUCH" scrawl and a heart
  for (let y = 0; y < 15; y++) for (let x = 0; x < 16; x++) {
    const X = 210 + x + Math.floor(y / 6), Y = 36 + y;
    let c = ramp(['#8a7a2a', '#c8b448', '#ecdc70', '#fff4a8'].map(hx), 0.8 - y / 30 - x / 60, X, Y);
    if (y > 3 && y % 3 === 1 && x > 2 && x < 13 - (y > 9 ? 4 : 0) && hash(x, y, 8) < 0.8) c = hx('#c0487a');
    sp(L, X, Y, c);
  }
  for (const [x, y] of [[223, 47], [225, 47], [222, 48], [223, 48], [224, 48], [225, 48], [226, 48], [223, 49], [224, 49], [225, 49], [224, 50]]) sp(L, x, y, hx('#e0406a'));
  for (let x = 213; x < 219; x++) sp(L, x, 35, hx('#d8d4c4'));
  for (let y = 36; y < 52; y++) sb(L, 227 + Math.floor((y - 36) / 6), y + 1, BULK[0], 0.4);

  // a little atmosphere: the far wall sits back in the warm murk so the engine pops
  const FOG = hx('#2a211c');
  for (let i = 0; i < L.d.length; i++) L.d[i] = mixc(L.d[i], FOG, 0.16);

  // ---------------------------------------------------------------- the fuse box, door swung open
  const { x0, y0, x1, y1, dep } = FB;
  // soft cast shadow on the plating (down and right)
  for (let y = y0; y < y1 + 12; y++) for (let x = x0; x < x1 + 12; x++) { const dx = Math.max(0, x - x1), dy = Math.max(0, y - y1); if (dx + dy > 0) sb(L, x, y, BULK[0], 0.5 * (1 - Math.max(dx, dy) / 12)); }
  box(L, x0, y0, x1, y1, dep,
    (x, y) => {
      const e = Math.min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y);
      return enamel(BOXP, 0.58 - (y - y0) / 300 - (x - x0) / 900 + (e === 0 ? 0.2 : e === 5 ? -0.3 : 0), x, y, 0.82);
    },
    (x, y) => enamel(BOXP, 0.8, x, y, 0.84),
    (x, y) => enamel(BOXP, 0.26, x, y, 0.84));
  // the interior: back panel shifted up-right, dark left wall, lit floor
  const ix0 = x0 + 6, iy0 = y0 + 6, ix1 = x1 - 6, iy1 = y1 - 6;
  for (let y = iy0; y < iy1; y++) for (let x = ix0; x < ix1; x++) {
    const inL = x - ix0 < FB_IN * DX * (1 - (iy0 - y) / (FB_IN * DY) * 0) && x - ix0 < FB_IN * DX;
    const inB = iy1 - y < FB_IN * DY;
    let c: number;
    if (inB && (iy1 - y) / DY <= (x - ix0) / DX + 0.5) c = ramp(BOXP, 0.42 + (iy1 - y) / 20, x, y);
    else if (inL) c = ramp(BOXP, 0.1 + (x - ix0) / 40, x, y);
    else c = ramp(BOXP, 0.2 + (y - iy0) / 400 + (hash(x, y) - 0.5) * 0.05, x, y);
    L.d[y * BW + x] = c;
  }
  // DIN rail, holders, labels, wiring
  for (let x = ix0 + 8; x < ix1; x++) { sp(L, x, SLOT_Y + 12, ALU[4]); sp(L, x, SLOT_Y + 13, ALU[2]); sp(L, x, SLOT_Y + 14, ALU[1]); sp(L, x, SLOT_Y + 15, BOXP[0]); }
  const inst = [0, 2, -1, 3, 2, 0];
  for (let i = 0; i < 6; i++) {
    const sx = slotX(i);
    for (let y = SLOT_Y + 4; y < SLOT_Y + 32; y++) for (let x = sx - 1; x < sx + 13; x++) {
      const nx = (x + 0.5 - sx - 6) / 7;
      let c = ramp(CREAM, 0.64 - nx * 0.3 - (y - SLOT_Y) / 90, x, y);
      if (x === sx - 1 || x === sx + 12 || y === SLOT_Y + 31) c = CREAM[0];
      if (y === SLOT_Y + 4) c = CREAM[5];
      if (y > SLOT_Y + 5 && y < SLOT_Y + 9 && x > sx && x < sx + 11) c = IRON[0]; // the slot
      // screw terminals
      if (y > SLOT_Y + 22 && y < SLOT_Y + 28 && (Math.abs(x - sx - 3) < 2 || Math.abs(x - sx - 9) < 2)) c = y === SLOT_Y + 23 ? STEEL[5] : STEEL[3];
      sp(L, x, y, c);
    }
    for (let y = SLOT_Y + 32; y < iy1 - 1; y++) {
      const wc = [RED, RUBBER, BRASS, RED, RUBBER, BRASS][i];
      const wx = sx + 3 + Math.round((y - SLOT_Y - 32) * (i - 2.5) * -0.12);
      sp(L, wx, y, wc[4]); sp(L, wx + 1, y, wc[2]);
      const wx2 = sx + 9 + Math.round((y - SLOT_Y - 32) * (i - 2.5) * -0.12);
      sp(L, wx2, y, RUBBER[4]); sp(L, wx2 + 1, y, RUBBER[1]);
    }
    txt(L, 'F' + (i + 1), sx + 2, SLOT_Y + 38, i === 2 ? hx('#ff9a70') : CREAM[4]);
    if (inst[i] >= 0) paintFuse(L, sx + 1, SLOT_Y - 4, FUSES[inst[i]].pal, FUSES[inst[i]].a, false);
  }
  // F3: blown, scorched black, soot licking up the panel
  const bx = slotX(2);
  for (let y = SLOT_Y - 30; y < SLOT_Y + 30; y++) for (let x = bx - 12; x < bx + 26; x++) {
    const d = Math.hypot((x - bx - 6) / 13, (y - SLOT_Y - 6) / (y < SLOT_Y + 6 ? 26 : 12));
    const n = fbm(x, y, 5, 9);
    if (d < 1) sb(L, x, y, SOOT, Math.min(0.92, (1 - d) * 1.4 * (0.5 + n)));
  }
  for (let x = bx + 1; x < bx + 11; x++) for (let y = SLOT_Y + 5; y < SLOT_Y + 10; y++) sp(L, x, y, hash(x, y, 2) < 0.2 ? hx('#3a1a10') : SOOT);
  // warning sticker and a grommet where the loom leaves the box
  for (let y = 0; y < 11; y++) for (let x = -y / 2; x <= y / 2; x++) sp(L, x1 - 20 + x, y0 + 12 + y, y === 10 || Math.abs(x) > y / 2 - 1 ? INK : hx('#f0c828'));
  for (const [dx, dy] of [[0, 3], [1, 4], [0, 5], [-1, 6], [0, 7], [1, 8]]) sp(L, x1 - 20 + dx, y0 + 12 + dy, INK);
  txt(L, 'PWR', x0 + 12, y0 - 0, CREAM[3]);
  // the door, swung open toward us on its left hinge: its inside face with the fuse chart taped on
  const DW = 50, DS = 30;
  for (let x = x0 - DW; x < x0; x++) {
    const k = (x0 - x) / DW;
    const ta = y0 + k * DS, tb = y1 + k * DS * 1.2;
    for (let y = Math.floor(ta); y < tb; y++) {
      const v = (y - ta) / (tb - ta);
      let c = enamel(BOXP, 0.66 - k * 0.2 - v * 0.2, x, y, 0.86);
      if (y < ta + 1 || y > tb - 2 || x === x0 - DW) c = ramp(BOXP, 0.3, x, y);
      if (x0 - x < 3) c = ramp(BOXP, 0.36, x, y);
      // the chart
      if (k > 0.14 && k < 0.84 && v > 0.1 && v < 0.62) {
        c = ramp(CREAM, 0.72 - v * 0.3 - k * 0.1 + (fbm(x, y, 6, 4) - 0.5) * 0.3, x, y);
        if (Math.floor((v - 0.1) * 60) % 4 === 0 && hash(x, y, 5) < 0.7) c = CREAM[1];
        if (k > 0.66 && Math.floor((v - 0.1) * 60) % 4 === 1) c = [FUSES[0].pal[2], FUSES[2].pal[2], FUSES[1].pal[3], FUSES[3].pal[2], FUSES[2].pal[2], FUSES[0].pal[2]][Math.min(5, Math.floor((v - 0.1) / 0.52 * 6))];
      }
      sp(L, x, y, c);
    }
  }
  for (const hy of [y0 + 10, y1 - 14]) for (let y = hy; y < hy + 6; y++) { sp(L, x0 - 1, y, STEEL[4]); sp(L, x0, y, STEEL[2]); }
  // the loom out of the bottom of the box, down behind the engine
  for (let y = y1; y < BH; y++) for (let k = 0; k < 8; k++) {
    const x = x0 + 60 + k * 2 + Math.round(Math.sin(y * 0.05 + k) * 1.2);
    sp(L, x, y, [RED[3], RUBBER[3], BRASS[3], RUBBER[2]][k % 4]);
  }
  return L;
}

// ------------------------------------------------------------------ the engine (static world layer)
function paintEngine(): Lay {
  const L = mk(WW, WH);
  // mounting plate for the fuel filter, bolted to the bulkhead
  box(L, 378, 100, 546, 178, 4, (x, y) => enamel(IRON, 0.46 - (y - 100) / 200, x, y, 0.8), (x, y) => ramp(IRON, 0.7, x, y), (x, y) => ramp(IRON, 0.2, x, y));
  for (const [x, y] of [[384, 106], [540, 106], [384, 172], [540, 172]]) bolt(L, x, y, 2.4, IRON, 6);

  // the exhaust riser: heat-lagged pipe up into the deckhead, steel clamps, stained wrap
  tube(L, [[272, -6], [272, 160]], 10, (nx, ny, nz, x, y, s) => {
    let c = sh(LAG, nx, ny, nz, x, y, 0.28, 0.7);
    const wrap = (y + nx * 5 + 400) % 7;
    if (wrap < 1) c = mixc(c, LAG[1], 0.6);
    const st = fbm(x, y, 9, 5);
    if (st > 0.6) c = mixc(c, hx('#3a2a18'), (st - 0.6) * 2.2);
    if (Math.abs(s - 30) < 3 || Math.abs(s - 100) < 3) c = sh(STEEL, nx, ny, nz, x, y, 0.3, 0.7, 0.9);
    return c;
  });

  // the head and block: teal enamel, top faces lit, right sides in shade
  const DEP = 16;
  box(L, 22, 178, 318, 336, DEP,
    (x, y, u, v) => enamel(TEAL, 0.5 - v * 0.32 - u * 0.08 + (y < 181 ? 0.12 : 0), x, y, edgeChip(Math.min(x - 22, 318 - x, y - 178))),
    (x, y) => enamel(TEAL, 0.78, x, y, 0.8),
    (x, y, k, v) => enamel(TEAL, 0.22 - v * 0.1, x, y, 0.8));
  box(L, 34, 150, 306, 178, 14,
    (x, y, u, v) => enamel(TEAL, 0.56 - v * 0.2 - u * 0.06 + (y === 150 ? 0.2 : 0), x, y, edgeChip(Math.min(x - 34, 306 - x, y - 150, 178 - y))),
    (x, y) => enamel(TEAL, 0.82, x, y, 0.8),
    (x, y, k, v) => enamel(TEAL, 0.26 - v * 0.08, x, y, 0.8));
  // rocker cover: black crinkle paint, ribbed, a brass oil filler cap
  box(L, 70, 130, 262, 150, 10,
    (x, y, u, v) => { let c = ramp(IRON, 0.52 - v * 0.3 + (hash(x, y, 6) - 0.5) * 0.12, x, y); if ((y - 130) % 5 === 0 && v < 0.9) c = IRON[5]; if ((y - 130) % 5 === 1) c = IRON[1]; return c; },
    (x, y) => ramp(IRON, 0.76 + (hash(x, y, 6) - 0.5) * 0.14, x, y),
    (x, y) => ramp(IRON, 0.2, x, y));
  ell(L, 120, 124, 9, 5, (nx, ny, nz, x, y) => sh(BRASS, nx, ny, nz, x, y, 0.3, 0.7, 1, 10));
  for (let x = 111; x < 130; x++) { sp(L, x, 125, BRASS[2]); sp(L, x, 126, BRASS[1]); }
  for (let x = 74; x < 262; x += 24) bolt(L, x, 133, 1.8, STEEL);
  // head gasket line with head bolts, oil weeping down the block
  for (let x = 22; x < 318; x++) { sp(L, x, 178, TEAL[0]); sp(L, x, 179, TEAL[4]); }
  for (let x = 44; x < 300; x += 22) bolt(L, x, 170, 2.4, STEEL, 0);
  for (let i = 0; i < 9; i++) {
    const x = 36 + Math.floor(hash(i, 3) * 270), n = 10 + hash(i, 4) * 40;
    if (x > CUT.x0 - 4 && x < CUT.x1 + 4) continue;
    for (let k = 0; k < n; k++) { sb(L, x, 180 + k, hx('#140e08'), 0.55 * (1 - k / n)); sb(L, x + 1, 180 + k, hx('#140e08'), 0.3 * (1 - k / n)); }
    sp(L, x, 180 + n, hx('#5a4a2a'));
  }
  // brass maker's plate on the head
  box(L, 54, 155, 104, 169, 1, (x, y) => {
    const e = Math.min(x - 54, 103 - x, y - 155, 168 - y);
    let c = ramp(BRASS, 0.62 - (y - 155) / 40 - (x - 54) / 200 + (e === 0 ? -0.3 : e === 1 ? 0.15 : 0), x, y);
    if (e > 2 && (y - 155) % 3 === 0 && hash(x >> 1, y, 3) < 0.7) c = BRASS[2];
    return c;
  }, () => BRASS[5], () => BRASS[1]);
  for (const [x, y] of [[56, 157], [101, 157], [56, 166], [101, 166]]) sp(L, x, y, BRASS[1]);
  // exhaust manifold on the head front, flanged into the riser
  for (let i = 0; i < 2; i++) tube(L, [[204 + i * 36, 176], [210 + i * 36, 160], [260, 160]], 6, (nx, ny, nz, x, y) => {
    let c = sh(RUST, nx, ny, nz, x, y, 0.2, 0.62, 0.3, 6);
    if (fbm(x, y, 5, 8) > 0.64) c = mixc(c, SOOT, 0.5);
    return c;
  });
  ell(L, 268, 160, 11, 7, (nx, ny, nz, x, y) => nx * nx + ny * ny > 0.7 ? IRON[1] : sh(IRON, nx, ny, nz, x, y, 0.3, 0.7, 0.6));
  for (const bx of [260, 276]) bolt(L, bx, 160, 1.8, STEEL);
  // the coolant hose curling off the head to the left
  tube(L, [[42, 162], [22, 166], [8, 184], [-8, 204]], 6, (nx, ny, nz, x, y, s) => {
    let c = sh(RUBBER, nx, ny, nz, x, y, 0.26, 0.7, 0.5, 6);
    if (Math.abs(s - 6) < 2.5) c = sh(STEEL, nx, ny, nz, x, y, 0.32, 0.7, 0.8);
    return c;
  });

  // ---------------------------------------------------------------- flywheel housing and pointer boss
  ell(L, FWX, FWY, FRX + 11, FRY + 11, (nx, ny, nz, x, y) => {
    const r = Math.hypot(nx, ny);
    if (r < 0.84) return ramp(IRON, 0.08 + (1 - r) * 0.1, x, y);
    if (r > 0.97) return IRON[1];
    return enamel(IRON, 0.3 + 0.62 * lam(nx * 0.8, ny * 0.8, nz + 0.3), x, y, 0.82);
  });
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + 0.2; bolt(L, FWX + Math.cos(a) * (FRX + 6), FWY + Math.sin(a) * (FRY + 6), 1.8, STEEL); }
  // the pointer boss at the top of the housing (the tip is drawn over the flywheel each frame)
  box(L, FWX - 6, FWY - FRY - 14, FWX + 7, FWY - FRY - 5, 4, (x, y) => ramp(BRASS, 0.56 - (y - FWY + FRY + 14) / 30, x, y), () => BRASS[5], () => BRASS[1]);
  bolt(L, FWX - 3, FWY - FRY - 10, 1.4, STEEL); bolt(L, FWX + 4, FWY - FRY - 10, 1.4, STEEL);
  txt(L, 'TDC', FWX + 12, FWY - FRY - 12, TEAL[7]);

  // ---------------------------------------------------------------- the cutaway into the cylinders
  const jag = (v: number, k: number) => 2 + Math.abs(Math.sin(v * 0.31 + k)) * 3 + hash(Math.floor(v / 4), k, 3) * 3;
  for (let y = CUT.y0; y < CUT.y1; y++) for (let x = CUT.x0; x < CUT.x1; x++) {
    const e = Math.min(x - CUT.x0 - jag(y, 1), CUT.x1 - x - jag(y, 2), y - CUT.y0 - jag(x, 3), CUT.y1 - y - jag(x, 4));
    if (e < 0) continue;
    let c: number;
    const hatch = (x + y) % 4 === 0;
    if (e < 4) c = hatch ? CUTF[0] : ramp(CUTF, 0.7 - e / 8, x, y); // the cut face of the block wall
    else if (y < BORE_TOP) {
      // the head in section: hatched metal with valve ports
      c = hatch ? CUTF[1] : CUTF[2];
      for (const b of BORES) {
        for (const vx of [b - 6, b + 6]) {
          const port = Math.abs(x - vx) < 4 && y > BORE_TOP - 18 && y < BORE_TOP - 2;
          if (port) c = ramp(IRON, 0.12 + (y - BORE_TOP + 18) / 60, x, y);
          if (Math.abs(x + 0.5 - vx) < 1 && y < BORE_TOP - 2) c = STEEL[4]; // valve stem
          if (y >= BORE_TOP - 4 && y < BORE_TOP - 1 && Math.abs(x + 0.5 - vx) < 4 - (BORE_TOP - 1 - y)) c = STEEL[y === BORE_TOP - 4 ? 5 : 3]; // valve head
          if (y > CUT.y0 + 6 && y < BORE_TOP - 18 && Math.abs(x + 0.5 - vx) < 3 && (y + (x > vx ? 1 : 0)) % 3 === 0) c = STEEL[3]; // spring
        }
        if (Math.abs(x + 0.5 - b) < 1.5 && y > CUT.y0 + 4) c = y > BORE_TOP - 4 ? BRASS[5] : BRASS[3]; // injector
      }
    } else if (y < CRANK_Y - 18) {
      c = ramp(JACKET, 0.5 + (hash(x, y) - 0.5) * 0.2 - (y - BORE_TOP) / 200, x, y); // water jacket
      for (const b of BORES) {
        const dx = x + 0.5 - b;
        if (Math.abs(dx) < BORE_HW) {
          // the far wall of the bore: concave, lit on the right, fine honing streaks
          const u = dx / BORE_HW;
          c = ramp(STEEL, 0.14 + (u + 1) * 0.2 - (y - BORE_TOP) / 300 + ((x * 3 + y) % 7 === 0 ? 0.06 : 0), x, y);
        } else if (Math.abs(dx) < BORE_HW + 3) c = hatch ? CUTF[0] : CUTF[1]; // liner in section
      }
    } else {
      // crankcase, oil glinting in the sump
      c = ramp(IRON, 0.1 + (y - CRANK_Y + 18) / 200, x, y);
      if (y > CUT.y1 - 12) c = ramp(DIESEL, 0.12 + Math.sin(x * 0.5) * 0.08 + (y === CUT.y1 - 12 ? 0.4 : 0), x, y);
    }
    L.d[y * WW + x] = c;
  }

  // ---------------------------------------------------------------- oil filter canister and the dipstick
  {
    const OF = ['#0e1a3a', '#162a5a', '#1e3c80', '#2a52a4', '#3e6cc4', '#6a94e0', '#a8c4f4'].map(hx);
    const fx0 = 268, fx1 = 306, fy0 = 196, fy1 = 246;
    // its shadow on the block, then the can: a vertical cylinder with a crimped rim and a label band
    for (let y = fy0 + 4; y < fy1 + 5; y++) for (let x = fx0 + 4; x < fx1 + 5; x++) sb(L, x, y, TEAL[0], 0.45);
    for (let y = fy0; y < fy1; y++) for (let x = fx0; x < fx1; x++) {
      const nx = (x + 0.5 - (fx0 + fx1) / 2) / ((fx1 - fx0) / 2), nz = Math.sqrt(Math.max(0, 1 - nx * nx));
      const v = (y - fy0) / (fy1 - fy0);
      let c = sh(OF, nx, 0, nz, x, y, 0.28, 0.72, 1, 10);
      if (v < 0.08 || v > 0.93) c = sh(STEEL, nx, v < 0.5 ? -0.3 : 0.3, nz, x, y, 0.3, 0.7, 1, 8);
      else if (v > 0.3 && v < 0.62) {
        c = sh(CREAM, nx, 0, nz, x, y, 0.36, 0.62);
        if (v > 0.36 && v < 0.42 && Math.abs(nx) < 0.6) c = RED[3];
        if (v > 0.47 && v < 0.56 && Math.abs(nx) < 0.7 && (x + y) % 3 === 0) c = CREAM[1];
      }
      if (fbm(x, y, 5, 40) > 0.7) c = mixc(c, hx('#1a120a'), 0.5); // oily fingerprints
      sp(L, x, y, c);
    }
    txt(L, 'OIL', 282, 205, OF[6]);
    // dipstick: a thin tube up the block with a yellow ring pull
    for (let y = 200; y < 262; y++) { sp(L, 257, y, STEEL[4]); sp(L, 258, y, STEEL[2]); sp(L, 259, y, IRON[1]); }
    ell(L, 258, 196, 4, 4, (nx, ny, nz, x, y) => Math.hypot(nx, ny) < 0.5 ? 0 : sh(BRASS, nx, ny, nz, x, y, 0.34, 0.7, 1, 8));
    // an oil drip down from the filter seal
    for (let k = 0; k < 18; k++) sb(L, 290, fy1 + k, hx('#140e08'), 0.6 * (1 - k / 18));
  }
  // ---------------------------------------------------------------- starter panel: key and the big button
  box(L, 262, 262, 316, 326, 6, (x, y, u, v) => {
    const e = Math.min(x - 262, 315 - x, y - 262, 325 - y);
    return ramp(IRON, 0.42 - v * 0.2 + (hash(x, y, 7) - 0.5) * 0.1 + (e === 0 ? 0.2 : 0), x, y);
  }, (x, y) => ramp(IRON, 0.7, x, y), (x, y) => ramp(IRON, 0.18, x, y));
  for (const [x, y] of [[265, 265], [312, 265], [265, 322], [312, 322]]) bolt(L, x, y, 1.3, STEEL);
  ell(L, KEY.x, KEY.y, 8, 8, (nx, ny, nz, x, y) => { const r = Math.hypot(nx, ny); return r > 0.7 ? sh(STEEL, nx, ny, nz, x, y, 0.36, 0.7, 0.8) : ramp(IRON, 0.2, x, y); });
  txt(L, 'OFF', KEY.x - 19, KEY.y - 9, IRON[6]);
  txt(L, 'ON', KEY.x + 7, KEY.y - 11, IRON[6]);
  ell(L, BTN.x, BTN.y, 11, 10, (nx, ny, nz, x, y) => Math.hypot(nx, ny) > 0.8 ? sh(STEEL, nx, ny, nz, x, y, 0.36, 0.7, 0.9) : IRON[0]);
  txt(L, 'START', BTN.x - 10, BTN.y + 13, hx('#b8e0a8'));

  // ---------------------------------------------------------------- the fuel line and the valve body
  // pipe hangers from the deckhead
  for (const hxp of [40, 334]) {
    for (let y = 0; y < PIPE_Y - 7; y++) { sp(L, hxp - 1, y, IRON[5]); sp(L, hxp, y, IRON[3]); sp(L, hxp + 1, y, IRON[1]); }
  }
  // thin copper return line above, then the main fuel line
  tube(L, [[-8, 72], [396, 72], [396, 110]], 2.6, (nx, ny, nz, x, y) => sh(COPPER, nx, ny, nz, x, y, 0.3, 0.7, 1, 10));
  tube(L, [[-8, PIPE_Y], [372, PIPE_Y], [372, 128], [392, 128]], 6.5, (nx, ny, nz, x, y, s) => {
    let c = sh(COPPER, nx, ny, nz, x, y, 0.28, 0.72, 1.1, 12);
    const g = fbm(x, y, 10, 21);
    if (g > 0.62) c = mixc(c, hx('#2e4a3a'), (g - 0.62) * 2); // verdigris
    // flare nuts / flanges at the joints
    if (Math.abs(s - 120) < 3 || Math.abs(s - 180) < 3 || Math.abs(s - 350) < 3) c = sh(BRASS, nx * 0.8, ny, nz, x, y, 0.32, 0.72, 1, 8);
    return c;
  });
  for (const hxp of [40, 334]) {
    // a U-bolt round the pipe
    for (let a = Math.PI; a <= Math.PI * 2; a += 0.05) { sp(L, hxp + Math.cos(a) * 8, PIPE_Y - Math.sin(a) * 8, IRON[4]); sp(L, hxp + Math.cos(a) * 9, PIPE_Y - Math.sin(a) * 9, IRON[1]); }
  }
  // the valve body: a bronze globe with flanges either side of the wheel
  ell(L, WX, WY, 22, 17, (nx, ny, nz, x, y) => sh(BRASS, nx, ny, nz, x, y, 0.12, 0.6, 0.7, 8));
  for (const fx of [WX - 26, WX + 26]) {
    ell(L, fx, WY, 4, 13, (nx, ny, nz, x, y) => sh(BRASS, nx, ny, nz, x, y, 0.18, 0.66, 0.8, 8));
    bolt(L, fx, WY - 10, 1.6, STEEL); bolt(L, fx, WY + 10, 1.6, STEEL);
  }
  // the bonnet and stem sticking out toward us (under the wheel hub)
  ell(L, WX, WY, 9, 9, (nx, ny, nz, x, y) => sh(BRASS, nx, ny, nz, x, y, 0.26, 0.7, 0.9, 10));

  // ---------------------------------------------------------------- the fuel filter head, bowl and gauge
  box(L, FH.x0, FH.y0, FH.x1, FH.y1, FH.dep, (x, y, u, v) => {
    let c = ramp(ALU, 0.6 - v * 0.34 + (hash(x, y, 4) - 0.5) * 0.1 - (fbm(x, y, 12, 30) - 0.5) * 0.3, x, y);
    if (y === FH.y0) c = ALU[6];
    // cast lettering and an arrow for the flow
    if (y === FH.y0 + 14 && x > FH.x0 + 10 && x < FH.x0 + 40) c = ALU[2];
    if (Math.abs(y - FH.y0 - 14) < 3 - (x - FH.x0 - 40) && x >= FH.x0 + 40 && x < FH.x0 + 43) c = ALU[2];
    return c;
  }, (x, y) => ramp(ALU, 0.84 + (hash(x, y) - 0.5) * 0.1, x, y), (x, y, k, v) => ramp(ALU, 0.3 - v * 0.14, x, y));
  for (const [x, y] of [[FH.x0 + 6, FH.y0 + 6], [FH.x1 - 6, FH.y0 + 6], [FH.x0 + 6, FH.y1 - 6], [FH.x1 - 30, FH.y1 - 6]]) bolt(L, x, y, 2.2, STEEL);
  txt(L, 'FUEL FILTER', FH.x0 + 64, FH.y0 + 12, ALU[2]);
  txt(L, 'FUEL FILTER', FH.x0 + 64, FH.y0 + 13, ALU[5], 0.5);
  // the hand primer: a black plunger knob on top of the head
  for (let y = FH.y0 - 14; y < FH.y0 - 6; y++) for (let x = 494; x < 500; x++) sp(L, x, y, ramp(STEEL, 0.7 - (x - 494) / 8, x, y));
  ell(L, 497, FH.y0 - 16, 7, 4, (nx, ny, nz, x, y) => sh(RUBBER, nx, ny, nz, x, y, 0.3, 0.72, 1, 10));
  // bleed screw boss on the right side face
  ell(L, SCREW.x + 2, SCREW.y, 5, 6, (nx, ny, nz, x, y) => sh(BRASS, nx, ny, nz, x, y, 0.2, 0.7, 0.9, 8));
  // the sediment bowl: a steel collar, the glass (contents drawn live) and a drain cock
  for (let y = BOWL.y0; y < BOWL.y0 + 5; y++) for (let x = BOWL.x0 - 2; x < BOWL.x1 + 2; x++) sp(L, x, y, ramp(STEEL, 0.7 - (x - BOWL.x0) / 60 - (y - BOWL.y0) / 12, x, y));
  for (let y = BOWL.y0 + 5; y < BOWL.y1; y++) {
    const inset = y > BOWL.y1 - 8 ? (y - BOWL.y1 + 8) * 0.8 : 0;
    for (let x = Math.ceil(BOWL.x0 + inset); x < BOWL.x1 - inset; x++) sp(L, x, y, ramp(IRON, 0.36 + (x - BOWL.x0) / 90, x, y));
  }
  for (let y = BOWL.y1; y < BOWL.y1 + 5; y++) for (let x = 447; x < 453; x++) sp(L, x, y, ramp(BRASS, 0.7 - (x - 447) / 8, x, y));
  // the flexible feed from the filter down to the injection pump
  tube(L, [[402, 146], [398, 170], [360, 180], [320, 184]], 4, (nx, ny, nz, x, y) => sh(RUBBER, nx, ny, nz, x, y, 0.26, 0.7, 0.6, 6));
  // gauge on its stalk: brass case with depth (its side shows up and right), bezel, dial face
  for (let y = GY + GR - 2; y < FH.y0 - 5; y++) for (let x = GX - 3; x < GX + 4; x++) sp(L, x, y, ramp(BRASS, 0.7 - (x - GX + 3) / 8, x, y));
  for (let k = 5; k >= 1; k--) ell(L, GX + k * DX, GY - k * DY, GR, GR, (nx, ny, nz, x, y) => sh(BRASS, nx, ny, 0.2, x, y, 0.08, 0.6, 0.5, 6));
  ell(L, GX, GY, GR, GR, (nx, ny, nz, x, y) => {
    const r = Math.hypot(nx, ny);
    if (r > 0.8) {
      // bezel: a rounded brass ring
      const t = (r - 0.8) / 0.2, rn = (t - 0.5) * 2;
      const ux = nx / r, uy = ny / r, n2 = Math.sqrt(Math.max(0, 1 - rn * rn));
      return sh(BRASS, ux * rn, uy * rn, n2, x, y, 0.26, 0.74, 1.2, 12);
    }
    // the dial: cream, darker in the lower right, shadowed under the bezel's upper-left lip
    let c = ramp(CREAM, 0.8 - (nx + ny) * 0.12, x, y);
    const lip = r > 0.7 && nx + ny < -0.3 ? (r - 0.7) / 0.1 : 0;
    if (lip > 0) c = mixc(c, CREAM[0], Math.min(0.6, lip * 0.5));
    // arcs: green window and the red
    const a = Math.atan2(ny, nx);
    const n = gaugeFrac(a);
    if (r > 0.6 && r < 0.72 && n >= 0 && n <= 1) {
      if (n >= 0.72 && n < 0.86) c = ramp(['#1e5a24', '#2e8a34', '#4ab04a', '#7ad07a'].map(hx), 0.6 - (nx + ny) * 0.2, x, y);
      else if (n >= 0.86) c = ramp(['#6a1010', '#a81c16', '#d8321e', '#f06a4a'].map(hx), 0.6 - (nx + ny) * 0.2, x, y);
    }
    // ticks
    if (n >= -0.001 && n <= 1.001) {
      const tk = n * 20, near = Math.abs(tk - Math.round(tk));
      const major = Math.round(tk) % 5 === 0;
      if (near < (major ? 0.22 : 0.12) && r > (major ? 0.62 : 0.68) && r < 0.76) c = INK;
    }
    return c;
  });
  for (let i = 0; i <= 4; i++) {
    const a = gaugeAng(i / 4);
    txt(L, String(i), GX + Math.cos(a) * GR * 0.49 - 1, GY + Math.sin(a) * GR * 0.49 - 2, IRON[2]);
  }
  txt(L, 'PSI', GX - 5, GY + 8, IRON[3]);
  txt(L, 'FUEL', GX - 7, GY + 15, RED[3]);

  inkLayer(L);
  return L;
}
// gauge scale: 270 degrees clockwise from the lower left
const G_A0 = Math.PI * 0.75, G_SW = Math.PI * 1.5;
const gaugeAng = (n: number) => G_A0 + n * G_SW;
function gaugeFrac(a: number) { let d = a - G_A0; while (d < 0) d += Math.PI * 2; return d / G_SW; }

// ------------------------------------------------------------------ Mori's arms and hands (sprite layer, screen coords)
function sleeve(S: Lay, x0: number, y0: number, x1: number, y1: number, r0: number, r1: number) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
  const rm = Math.max(r0, r1);
  for (let y = Math.max(0, Math.floor(Math.min(y0, y1) - rm)); y <= Math.min(S.h - 1, Math.ceil(Math.max(y0, y1) + rm)); y++)
    for (let x = Math.max(0, Math.floor(Math.min(x0, x1) - rm)); x <= Math.min(S.w - 1, Math.ceil(Math.max(x0, x1) + rm)); x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0;
      const t = clamp((px * ux + py * uy) / len, 0, 1);
      const perp = px * -uy + py * ux; // signed distance across the arm
      const along = px * ux + py * uy - t * len;
      const r = r0 + (r1 - r0) * t;
      if (perp * perp + along * along > r * r) continue;
      const q = perp / r, nz = Math.sqrt(Math.max(0, 1 - q * q));
      const nx = -uy * q, ny = ux * q;
      let c: number;
      if (t > 0.9) {
        // the rolled cuff
        c = sh(SLEEVE, nx, ny, nz, x, y, 0.36, 0.7);
        if (Math.abs(t * len - len * 0.9) < 1) c = SLEEVE[0];
      } else {
        // fabric: soft folds bunching toward the wrist, a crease or two, a rim of light on the lit edge
        const fold = Math.sin(t * len * (0.1 + t * 0.12) + q * 1.4 + x0 * 0.07) * 0.1;
        c = sh(SLEEVE, nx, ny, nz, x, y, 0.24 + fold + (hash(x, y, 13) - 0.5) * 0.06, 0.84);
        const cr = Math.abs(Math.sin(t * len * 0.09 + q * 0.9 + x0 * 0.03));
        if (cr < 0.05 && Math.abs(q) < 0.7 && t > 0.2) c = SLEEVE[1];
        if (lam(nx, ny, 0) > 0.55 && Math.abs(q) > 0.82) c = SLEEVE[4];
      }
      sp(S, x, y, c);
    }
}
/** a fist: ellipsoid palm along `ang` (wrist to knuckles), fingers creased, a thumb on one side */
function fist(S: Lay, cx: number, cy: number, ang: number, rx = 9, ry = 7.5, thumb = 1) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const R2 = Math.max(rx, ry) + 1;
  for (let y = Math.floor(cy - R2); y <= Math.ceil(cy + R2); y++) for (let x = Math.floor(cx - R2); x <= Math.ceil(cx + R2); x++) {
    const px = x + 0.5 - cx, py = y + 0.5 - cy;
    const lx = px * ca + py * sa, ly = -px * sa + py * ca;
    const nx0 = lx / rx, ny0 = ly / ry, r2 = nx0 * nx0 + ny0 * ny0;
    if (r2 > 1) continue;
    const nz = Math.sqrt(1 - r2);
    const nx = nx0 * ca - ny0 * sa, ny = nx0 * sa + ny0 * ca;
    let c = sh(SKIN, nx, ny, nz, x, y, 0.38, 0.62);
    // finger creases across the curled fingers, and the knuckle ridge
    if (lx > rx * 0.05 && Math.abs(Math.abs(ly) - ry * 0.34) < 0.55) c = SKIN[1];
    if (lx > rx * 0.05 && Math.abs(ly) < 0.5) c = SKIN[1];
    if (Math.abs(lx - rx * 0.1) < 0.6 && nz > 0.4) c = SKIN[4];
    sp(S, x, y, c);
  }
  // the thumb, wrapped over
  const tx = cx + ca * rx * 0.2 - sa * ry * 0.95 * thumb, ty = cy + sa * rx * 0.2 + ca * ry * 0.95 * thumb;
  ell(S, tx, ty, 3.6, 3.1, (nx, ny, nz, x, y) => sh(SKIN, nx, ny, nz, x, y, 0.4, 0.6));
}
/** a hand gripping a rim: back of the hand outside it, four fingers curled over the front, thumb tucked */
function grip(S: Lay, hx0: number, hy0: number, out: number, side: number) {
  const ox = Math.cos(out), oy = Math.sin(out), tx = -oy, ty = ox;
  // back of the hand
  const cx = hx0 + ox * 6, cy = hy0 + oy * 6;
  for (let y = Math.floor(cy - 10); y <= cy + 10; y++) for (let x = Math.floor(cx - 10); x <= cx + 10; x++) {
    const px = x + 0.5 - cx, py = y + 0.5 - cy;
    const a = (px * tx + py * ty) / 8.5, b = (px * ox + py * oy) / 7;
    const r2 = a * a + b * b;
    if (r2 > 1) continue;
    const nz = Math.sqrt(1 - r2), nx = a * tx + b * ox, ny = a * ty + b * oy;
    let c = sh(SKIN, nx, ny, nz, x, y, 0.36, 0.64);
    // tendons and a knuckle ridge
    if (b < -0.25 && Math.abs(Math.abs(a) - 0.35) < 0.08) c = mixc(c, SKIN[4], 0.5);
    sp(S, x, y, c);
  }
  // fingers, each a little capsule with a dark edge so they separate
  for (let k = 0; k < 4; k++) {
    const off = (k - 1.5) * 3.4, len = k === 0 || k === 3 ? 6.5 : 8;
    const ax = hx0 + ox * 1.5 + tx * off, ay = hy0 + oy * 1.5 + ty * off;
    tube(S, [[ax, ay], [ax - ox * len, ay - oy * len]], 2.1, (nx, ny, nz, x, y) => {
      if (nz < 0.45) return SKIN[1];
      return sh(SKIN, nx, ny, nz, x, y, 0.4, 0.62);
    });
    sp(S, ax - ox * len + tx * 0.5, ay - oy * len, SKIN[4]);
  }
  // thumb along the side
  const bx = hx0 + ox * 5 - tx * 8 * side, by = hy0 + oy * 5 - ty * 8 * side;
  tube(S, [[bx, by], [bx - ox * 7 + tx * 1 * side, by - oy * 7 + ty * 1 * side]], 2.5, (nx, ny, nz, x, y) => nz < 0.4 ? SKIN[1] : sh(SKIN, nx, ny, nz, x, y, 0.38, 0.62));
}
/** a relaxed half-fist, waiting */
function restHand(S: Lay, x: number, y: number, ang: number) {
  fist(S, x, y, ang, 8.5, 7, -1);
  const ca = Math.cos(ang), sa = Math.sin(ang);
  tube(S, [[x + ca * 6 - sa * 2, y + sa * 6 + ca * 2], [x + ca * 9 - sa * 4, y + sa * 9 + ca * 4]], 2.2, (nx, ny, nz, px, py) => sh(SKIN, nx, ny, nz, px, py, 0.38, 0.62));
}
/** an open hand with the index finger (and thumb) reaching to a point */
function reach(S: Lay, wx: number, wy: number, tx: number, ty: number, pinch = 0) {
  const ang = Math.atan2(ty - wy, tx - wx), d = Math.hypot(tx - wx, ty - wy);
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const kx = wx + ca * 7, ky = wy + sa * 7;
  fist(S, kx, ky, ang, 8, 6.5, -1);
  const fl = Math.max(4, d - 12);
  const fx0 = kx + ca * 5 - sa * 2.5, fy0 = ky + sa * 5 + ca * 2.5;
  tube(S, [[fx0, fy0], [fx0 + ca * fl, fy0 + sa * fl]], 2.3, (nx, ny, nz, x, y) => sh(SKIN, nx, ny, nz, x, y, 0.4, 0.62));
  // thumb meets the fingertip when pinching
  const th = pinch ? fl - 1 : fl * 0.45;
  const bx = kx - sa * -5.5, by = ky + ca * -5.5;
  tube(S, [[bx, by], [bx + ca * th - sa * (pinch ? 3 : -1), by + sa * th + ca * (pinch ? 3 : -1)]], 2.4, (nx, ny, nz, x, y) => sh(SKIN, nx, ny, nz, x, y, 0.36, 0.62));
  sp(S, fx0 + ca * fl, fy0 + sa * fl, SKIN[4]);
}

// ------------------------------------------------------------------ the game

interface P { k: number; x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; c: number }

export async function runEngineRepair(o: { onStep?: (k: string) => void | Promise<void> } = {}): Promise<boolean> {
  const cu = openCloseup();
  const back = paintBack(), eng = paintEngine();
  const F: Lay = { w: CW, h: CH, d: cu.buf };
  const S = mk(CW, CH);
  SPR = S;
  const prev = new Uint32Array(CW * CH);
  const hold = new Hold(cu.wrap);
  // Mori's real arms and hands (the painted ones stand in until the meshes are ready)
  const hands: HandsController | null = HANDS3D.enabled ? closeupHands(cu, { who: 'mori', side: 'both', lights: 'engine', scale: 2.3 }) : null;
  hands?.left?.shoulderAt(-70, 330, 90);
  hands?.right?.shoulderAt(400, 320, 90);

  let si = 0, stage: Stage = 'valve', T = 0, stageT = 0, lastSay = -9;
  const cam = { x: VIEW.valve[0], y: VIEW.valve[1] };
  let pan: { fx: number; fy: number; tx: number; ty: number; t: number } | null = null;
  let shake = 0, shudder = 0, finished = false, flick = 1, sprayA = 0, haze = 0, frameMs = 0;
  const later: { at: number; fn: () => void }[] = [];
  const after = (s: number, fn: () => void) => later.push({ at: T + s, fn });
  const parts: P[] = [];
  const add = (k: number, x: number, y: number, vx: number, vy: number, life: number, r: number, c = 0) => parts.push({ k, x, y, vx, vy, life, max: life, r, c });
  const splats: { x: number; y: number; r: number; s: number; drip: number; age: number }[] = [];
  const jenna = (text: string, ox: { shout?: boolean; ms?: number } = {}) => {
    cu.say('Jenna', text, { color: '#b04a8a', right: stage === 'bleed' || stage === 'start', ...ox });
    lastSay = T;
  };

  // ---------------------------------------------------------------- stage state
  // valve
  let vAng = 0.3, vTarget = 0.3, vSpin = 0, vPress = 0, lastSide = 0, vJud = 0, pushL = 0, pushR = 0, vDone = false, slipT = 0;
  const VNEED = 12;
  // bleed
  let needle = 0.1, nVis = 0.1, nVel = 0, bOpen = false, bDone = false, bLock = false, screwOut = 0, screwRot = 0, hissT = 0;
  // fuse
  let sel = -1, fDone = false, zap = 0, recoil = 0, ledOn = 0;
  let fAnim: { i: number; t: number; ok: boolean; zapped: boolean } | null = null;
  // start
  let fwA = -Math.PI / 2 - 2.2, fwW = 0, hits = 0, running = false, press = 0, fire = 0, fireCyl = 0, nowSaid = false, puffT = 0;

  const enter = (i: number) => {
    stage = STAGES[i];
    stageT = 0;
    void o.onStep?.(stage);
    if (stage === 'valve') { jenna('The fuel valve’s seized! Crank it! Left, right, left, right!'); cu.hint('Alternate <span class="key">A</span><span class="key">D</span> · or tap left / right', 4600); }
    if (stage === 'bleed') { jenna('Now bleed the air out. Open the screw... and stop when the needle hits the green. NOT past it!', { ms: 4600 }); cu.hint('Hold <span class="key">Space</span> · let go in the green', 4600); }
    if (stage === 'fuse') { jenna('Fuse F3 is toast. It needs a fifteen amp... Dad colour-codes them... it’s the... blue one? Blue is fifteen!', { ms: 5200 }); cu.hint('Pick a fuse · <span class="key">1</span>–<span class="key">4</span> or click it', 4600); }
    if (stage === 'start') { jenna('Okay okay okay! When I say NOW, hit the starter! Three good cranks!', { ms: 3800 }); cu.hint('<span class="key">Space</span> as the white mark passes the pointer', 4600); }
  };
  const next = () => {
    if (si >= STAGES.length - 1) return;
    si++;
    audio.play('star', { vol: 0.35 });
    audio.play('whoosh', { vol: 0.25, pitch: 0.7 });
    const [tx, ty] = VIEW[STAGES[si]];
    pan = { fx: cam.x, fy: cam.y, tx, ty, t: 0 };
    enter(si);
  };
  const live = (k: Stage) => stage === k && !pan && !cu.closed;

  // ---------------------------------------------------------------- input
  const crank = (side: number) => {
    if (!live('valve') || vDone) return;
    if (side === lastSide) {
      // the same hand again: it slips on the rim
      slipT = 0.3; vJud = Math.max(vJud, 0.15);
      audio.play('place', { vol: 0.25, pitch: 0.6 });
      return;
    }
    lastSide = side;
    vPress++;
    if (side < 0) pushL = 1; else pushR = 1;
    const hub = [WX - cam.x, WY - cam.y];
    if (vPress < 4) {
      // seized: it only judders, shedding rust flakes and dust
      vTarget += 0.05; vJud = 0.4; shake = Math.max(shake, 0.12);
      audio.play('woodCreak', { vol: 0.45, pitch: 0.55 + vPress * 0.08 });
      for (let k = 0; k < 10; k++) { const a = Math.random() * Math.PI * 2; add(0, hub[0] + Math.cos(a) * WRX * 0.9, hub[1] + Math.sin(a) * WRY * 0.9, (Math.random() - 0.5) * 30, -Math.random() * 20, 1.4, 1, RUST[2 + (k % 4)]); }
      for (let k = 0; k < 9; k++) { const a = Math.random() * Math.PI * 2, rr = Math.random(); add(1, hub[0] + Math.cos(a) * rr * WRX * 0.9, hub[1] + Math.sin(a) * rr * WRY * 0.9, Math.cos(a) * 10, 4 + Math.random() * 8, 1.4 + Math.random(), 1.5 + Math.random() * 2.5, 0); }
    } else if (vPress === 4) {
      // CRACK: it breaks free in a burst of rust dust
      vTarget += 0.7; vJud = 0.25; shake = 0.3;
      audio.play('hammer', { vol: 0.5, pitch: 0.7 });
      audio.play('woodCreak', { vol: 0.5, pitch: 0.4 });
      for (let k = 0; k < 24; k++) { const a = Math.random() * Math.PI * 2; add(0, hub[0] + Math.cos(a) * WRX * 0.8, hub[1] + Math.sin(a) * WRY * 0.8, Math.cos(a) * 40, Math.sin(a) * 30 - 20, 1.6, 1 + (k % 3 === 0 ? 1 : 0), RUST[2 + (k % 5)]); }
      for (let k = 0; k < 22; k++) { const a = Math.random() * Math.PI * 2, rr = 0.2 + Math.random() * 0.8; add(1, hub[0] + Math.cos(a) * rr * WRX, hub[1] + Math.sin(a) * rr * WRY, Math.cos(a) * 26, Math.sin(a) * 18 + 4, 1.6 + Math.random(), 2 + Math.random() * 3, 0); }
      jenna('It moved! Keep going!', { ms: 1800 });
    } else {
      const p = vPress / VNEED;
      vTarget += 0.35 + p * 0.55;
      vSpin += 0.6 + p * 1.6;
      audio.play('woodCreak', { vol: 0.28, pitch: 1.1 + p * 0.6 + Math.random() * 0.1 });
      for (let k = 0; k < 3; k++) { const a = Math.random() * Math.PI * 2; add(0, hub[0] + Math.cos(a) * WRX * 0.9, hub[1] + Math.sin(a) * WRY * 0.9, (Math.random() - 0.5) * 30, -Math.random() * 10, 1.2, 1, RUST[3 + (k % 3)]); }
    }
    if (vPress >= VNEED) {
      vDone = true;
      vSpin += 5;
      audio.play('bubble', { vol: 0.4, pitch: 0.5 });
      after(0.4, () => audio.play('bubble', { vol: 0.35, pitch: 0.7 }));
      after(1.2, next);
    }
  };
  const pickFuse = (i: number) => {
    if (!live('fuse') || fDone || fAnim) return;
    sel = i;
    fAnim = { i, t: 0, ok: FUSES[i].a === 15, zapped: false };
    audio.play('ui', { vol: 0.3 });
  };
  const kd = (e: KeyboardEvent) => {
    if (cu.closed) return;
    const c = e.code;
    if (stage === 'valve') {
      const side = c === 'KeyA' || c === 'ArrowLeft' ? -1 : c === 'KeyD' || c === 'ArrowRight' ? 1 : 0;
      if (side) { e.preventDefault(); if (!e.repeat) crank(side); }
    } else if (stage === 'fuse') {
      if (/^Digit[1-4]$/.test(c) || /^Numpad[1-4]$/.test(c)) { e.preventDefault(); pickFuse(+c.slice(-1) - 1); }
      else if ((c === 'ArrowLeft' || c === 'KeyA') && live('fuse') && !fAnim && !fDone) { e.preventDefault(); sel = sel < 0 ? 0 : Math.max(0, sel - 1); audio.play('ui', { vol: 0.2, pitch: 1.3 }); }
      else if ((c === 'ArrowRight' || c === 'KeyD') && live('fuse') && !fAnim && !fDone) { e.preventDefault(); sel = sel < 0 ? 0 : Math.min(3, sel + 1); audio.play('ui', { vol: 0.2, pitch: 1.3 }); }
      else if ((c === 'Space' || c === 'Enter' || c === 'KeyE') && !e.repeat) { if (sel < 0) sel = 0; else pickFuse(sel); }
    }
  };
  const toBuf = (e: PointerEvent) => { const r = cu.cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * CW, (e.clientY - r.top) / r.height * CH]; };
  const pd = (e: PointerEvent) => {
    const [x, y] = toBuf(e);
    if (stage === 'valve') crank(x < CW / 2 ? -1 : 1);
    else if (stage === 'fuse') {
      for (let i = 0; i < 4; i++) { const fx = trayFuseX(i) - cam.x, fy = TRAY.y0 - 14 - cam.y; if (x > fx - 3 && x < fx + 16 && y > fy - 6 && y < fy + 26) pickFuse(i); }
    }
  };
  const pm = (e: PointerEvent) => {
    if (stage !== 'fuse' || fAnim || fDone) return;
    const [x, y] = toBuf(e);
    for (let i = 0; i < 4; i++) { const fx = trayFuseX(i) - cam.x, fy = TRAY.y0 - 14 - cam.y; if (x > fx - 3 && x < fx + 16 && y > fy - 6 && y < fy + 26) sel = i; }
  };
  window.addEventListener('keydown', kd, true);
  cu.wrap.addEventListener('pointerdown', pd);
  cu.wrap.addEventListener('pointermove', pm);
  audio.play('uiOpen', { vol: 0.3 });
  enter(0);

  const dbg = { go: (i: number) => { while (si < i) { si++; } const [x, y] = VIEW[STAGES[si]]; cam.x = x; cam.y = y; pan = null; enter(si); }, st: () => ({ stage, pan: !!pan, needle, hits, delta: wrapPi(fwA + Math.PI / 2), running, vPress, fDone, bDone, T, ms: frameMs }) };
  (window as unknown as { __engine?: typeof dbg }).__engine = dbg;

  const ok = await new Promise<boolean>(done => {
    loop((dt, t) => {
      if (cu.closed) { done(finished); return false; }
      const t0 = performance.now();
      T = t; stageT += dt;
      for (let i = later.length - 1; i >= 0; i--) if (T >= later[i].at) { const f = later[i].fn; later.splice(i, 1); f(); }
      shake = Math.max(0, shake - dt);
      shudder = Math.max(0, shudder - dt);
      // camera
      if (pan) {
        pan.t += dt / PAN_T;
        const k = ease(Math.min(1, pan.t));
        cam.x = pan.fx + (pan.tx - pan.fx) * k; cam.y = pan.fy + (pan.ty - pan.fy) * k;
        if (pan.t >= 1) pan = null;
      }
      // the bulb: a nervous flicker until the engine runs, then steady and bright
      const dip = hash(Math.floor(t * 9), 77) < (running ? 0 : fDone ? 0.03 : 0.09) ? 0.45 : 1;
      flick = running ? 1.08 + Math.sin(t * 40) * 0.02 : (0.86 + Math.sin(t * 13) * Math.sin(t * 7.3) * 0.08) * dip;

      // ---------------------------------------------------------- stage logic
      // valve: spring toward the target angle, free spin once it's open
      vSpin *= Math.exp(-dt * (vDone ? 0.8 : 2.4));
      vTarget += vSpin * dt;
      vAng += (vTarget - vAng) * Math.min(1, dt * 12);
      vJud = Math.max(0, vJud - dt);
      pushL = Math.max(0, pushL - dt * 2.4); pushR = Math.max(0, pushR - dt * 2.4);
      slipT = Math.max(0, slipT - dt);

      // bleed
      if (live('bleed') && !bDone) {
        if (!hold.down) bLock = false;
        if (hold.down && !bLock) {
          bOpen = true;
          needle = Math.min(1.05, needle + dt * 0.42);
          hissT -= dt;
          if (hissT <= 0) { hissT = 0.5; audio.play('hiss', { vol: 0.1 + needle * 0.1, pitch: 1.6 + needle * 0.4 }); }
        } else if (bOpen) {
          bOpen = false;
          if (needle > 0.72 && needle < 0.86) {
            bDone = true;
            audio.play('place', { vol: 0.5 });
            jenna('Perfect! Hear that? That’s the sound of no more bubbles!');
            after(1.3, next);
          } else if (needle >= 0.86) sprayNow('Pffft! Diesel on your glasses! Again, again!');
          else { jenna('A bit more...', { ms: 1600 }); }
        } else needle = Math.max(0.1, needle - dt * 0.08);
        if (needle > 1) { bOpen = false; bLock = true; sprayNow('PAST THE RED! Spray! Oh no. Oh no, that’s so funny. Try again!'); }
      }
      screwOut += ((bOpen ? 1 : 0) - screwOut) * Math.min(1, dt * 8);
      if (bOpen) screwRot += dt * 9;
      // the needle: a damped spring with a nervous tremble while the screw is open
      nVel += ((needle - nVis) * 60 - nVel * 9) * dt;
      nVis += nVel * dt + (bOpen ? (Math.random() - 0.5) * 0.006 : 0);
      if (stage === 'bleed' && bOpen) {
        // what comes out of the screw: air mist and bubbles first, diesel as the air clears
        const ex = SCREW.x + 9 - cam.x, ey = SCREW.y - 2 - cam.y;
        const dieselFrac = clamp((needle - 0.45) / 0.35, 0, 1);
        const n = Math.random() < dt * (18 + needle * 30) ? 1 + (needle > 0.86 ? 2 : 0) : 0;
        for (let k = 0; k < n; k++) {
          if (Math.random() < dieselFrac) add(2, ex, ey, 10 + Math.random() * 30 * (needle > 0.86 ? 2 : 1), -20 - Math.random() * 30, 1.2, 1, 1);
          else add(3, ex, ey, 6 + Math.random() * 18, -18 - Math.random() * 20, 0.8, 1.4 + Math.random() * 1.8, 0);
        }
        if (Math.random() < dt * 8 * (1 - dieselFrac)) add(4, ex, ey, 8 + Math.random() * 10, -10 - Math.random() * 8, 1, 2, 0);
      }

      // fuse
      if (fAnim) {
        fAnim.t += dt;
        if (fAnim.t >= 0.45 && !fAnim.zapped) {
          fAnim.zapped = true;
          if (fAnim.ok) {
            fDone = true;
            audio.play('place', { vol: 0.7 });
            audio.play('scanBeep', { vol: 0.3 });
            ledOn = 1;
            jenna('Blue! Fifteen amps! I KNEW that. I totally knew that.');
            after(1.3, next);
          } else {
            zap = 0.5; shake = 0.4; recoil = 1;
            cu.flash();
            audio.play('alert', { vol: 0.5 });
            audio.play('hiss', { vol: 0.3, pitch: 2.4 });
            const [sx, sy] = [slotX(2) + 6 - Math.round(cam.x * PF), SLOT_Y + 6 - Math.round(cam.y * PF)];
            for (let k = 0; k < 26; k++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 3.2; const s = 40 + Math.random() * 90; add(5, sx, sy, Math.cos(a) * s, Math.sin(a) * s, 0.5 + Math.random() * 0.5, 1, 0); }
            for (let k = 0; k < 4; k++) add(6, sx + (Math.random() - 0.5) * 6, sy - 4, (Math.random() - 0.5) * 6, -10, 2, 3, 0);
            jenna(FUSES[fAnim.i].a < 15 ? 'NOT THAT ONE! That’s a ten, it’ll just blow again!' : 'Too big! That’s how boats catch fire, Mori!', { shout: true });
          }
        }
        if (!fAnim.ok && fAnim.t > 1.0) fAnim = null;
      }
      zap = Math.max(0, zap - dt); recoil = Math.max(0, recoil - dt * 2);

      // start: the flywheel turns over, lumpy on compression; fire it as the mark passes the pointer
      if (stage === 'start') {
        const base = running ? 17 : pan ? 0 : 2.3 + hits * 0.75;
        fwW += (base - fwW) * Math.min(1, dt * (running ? 1.1 : 2.2));
        fwA += fwW * (running ? 1 : 1 + 0.34 * Math.sin(fwA * 2)) * dt;
      }
      const delta = wrapPi(fwA + Math.PI / 2);
      const WIN = 0.36;
      if (live('start') && !running) {
        if (hold.hit()) {
          press = 1;
          if (Math.abs(delta) < WIN) {
            hits++;
            fire = 1; fireCyl = Math.cos(fwA * 1) > 0 ? 0 : 1;
            fwW += 3.4 + hits;
            shudder = 0.5 + hits * 0.2; shake = 0.2 + hits * 0.1;
            audio.play('engine', { vol: 0.4 + hits * 0.15, pitch: 0.7 + hits * 0.1 });
            const n = 3 + hits * 3;
            for (let k = 0; k < n; k++) puff(k * 0.3, 0.8 + hits * 0.2);
            if (hits >= 3) {
              running = true;
              cu.flash();
              jenna('SHE LIVES!!!', { shout: true, ms: 2600 });
              after(0.5, () => audio.play('engine', { vol: 0.8, pitch: 1.1 }));
              after(1.5, () => audio.play('engine', { vol: 0.7, pitch: 1.2 }));
              after(1.8, () => { finished = true; cu.result('SHE LIVES!', 'engine running').then(() => cu.close()); });
            } else jenna(hits === 1 ? 'Ooh! Again! NOW!' : 'Almost! One more! NOW NOW NOW!', { ms: 2200 });
          } else {
            // clunk: the starter grinds, the engine lurches against compression
            fwW *= 0.4; shudder = 0.2;
            audio.play('wrong', { vol: 0.4 });
            audio.play('hammer', { vol: 0.25, pitch: 0.5 });
            jenna('Wait for it... wait for it...', { ms: 1800 });
          }
        }
        // Jenna calls it as the mark comes round
        if (stageT > 4 && delta > -0.8 && delta < -0.35 && !nowSaid && T - lastSay > 2.2) { nowSaid = true; jenna('NOW!', { shout: true, ms: 700 }); }
        if (delta > 1) nowSaid = false;
      } else hold.hit();
      press = Math.max(0, press - dt * 4);
      fire = Math.max(0, fire - dt * 3);
      if (running) {
        puffT -= dt;
        if (puffT <= 0) { puffT = 0.12 + Math.random() * 0.08; puff(0, 0.7); }
        haze = Math.max(0, haze - dt * 0.12);
        if (Math.random() < 0.6) shudder = Math.max(shudder, 0.05);
      }

      // particles
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        if (p.k === 0 || p.k === 2 || p.k === 5) p.vy += (p.k === 5 ? 160 : 140) * dt; // flakes, droplets, sparks fall
        if (p.k === 1 || p.k === 4 || p.k === 6 || p.k === 7) { p.vx *= 1 - dt * 1.5; p.vy *= 1 - dt * 1.2; p.r += dt * (p.k === 7 ? 9 : 3); p.vy -= dt * (p.k === 7 ? 14 : p.k === 6 ? 10 : 0); }
        if (p.k === 1) p.vy += dt * 6;
        if (p.k === 3) { p.vy += 40 * dt; }
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      for (const s of splats) s.age += dt;
      sprayA = Math.max(0, sprayA - dt * 0.35);
      if (sprayA <= 0) splats.length = 0;

      // ---------------------------------------------------------- compose: bulkhead (parallax), engine (shudders), cast shadow
      const shx = shake > 0 ? Math.round((Math.random() - 0.5) * 4 * Math.min(1, shake * 4)) : 0;
      const shy = shake > 0 ? Math.round((Math.random() - 0.5) * 4 * Math.min(1, shake * 4)) : 0;
      const eshx = shudder > 0 ? Math.round((Math.random() - 0.5) * (running ? 2.4 : 4)) : 0;
      const eshy = shudder > 0 ? Math.round((Math.random() - 0.5) * (running ? 2 : 3)) : 0;
      const cx = Math.round(cam.x) + shx, cy = Math.round(cam.y) + shy;
      const bx = Math.round(cam.x * PF) + shx, by = Math.round(cam.y * PF) + shy;
      const ex = cx - eshx, ey = cy - eshy;
      const buf = F.d, bd = back.d, ed = eng.d;
      for (let y = 0; y < CH; y++) {
        const BY = clamp(y + by, 0, BH - 1) * BW, Y = y + ey;
        for (let x = 0; x < CW; x++) {
          const X = x + ex;
          let c = 0;
          if (X >= 0 && Y >= 0 && X < WW && Y < WH) c = ed[Y * WW + X];
          if (!(c >>> 24)) {
            c = bd[BY + clamp(x + bx, 0, BW - 1)];
            // the engine's soft shadow on the bulkhead
            const X2 = X - 5, Y2 = Y - 6;
            if (X2 >= 0 && Y2 >= 0 && X2 < WW && Y2 < WH && ed[Y2 * WW + X2] >>> 24) c = mixc(c, BULK[0], 0.45);
          }
          buf[y * CW + x] = c;
        }
      }
      const ox = -ex, oy = -ey; // world -> screen for engine-attached things
      const box0 = -bx, boy0 = -by; // bulkhead -> screen

      // ---------------------------------------------------------- the caged bulb (bulkhead)
      if (on(BULB.x + box0, BULB.y + boy0, 50)) drawBulb(F, BULB.x + box0, BULB.y + boy0, flick);
      // ---------------------------------------------------------- fuse box live bits
      {
        const lx = FB.x0 + 8 + box0, ly = FB.y0 + 2 + boy0;
        ell(F, lx + 1, ly + 1, 2.2, 2.2, (nx, ny, nz) => ledOn ? (nz > 0.8 && nx < 0 ? hx('#eaffe8') : nz > 0.4 ? hx('#7aff8a') : hx('#2a9a3a')) : (nz > 0.8 && nx < 0 ? hx('#b86a5a') : hx('#4a1410')));
        if (ledOn) glow(F, lx + 1, ly + 1, 12, 20, 110, 40);
        // a live arc across the blown slot while a wrong fuse is in it
        if (zap > 0) {
          const sx = slotX(2) + box0, sy = SLOT_Y + boy0;
          for (let k = 0; k < 3; k++) {
            let px = sx + 1, py = sy + 6 + (Math.random() - 0.5) * 4;
            for (let s = 0; s < 10; s++) { const nx2 = sx + 1 + s * 1.1, ny2 = sy + 6 + (Math.random() - 0.5) * 7; line(F, px, py, nx2, ny2, s % 2 ? hx('#d8f0ff') : hx('#ffffff')); px = nx2; py = ny2; }
          }
          glow(F, sx + 6, sy + 6, 26, 180 * zap, 200 * zap, 255 * zap);
        }
      }
      // ---------------------------------------------------------- gauge needle, glass, the bowl, the bleed screw
      if (on(GX + ox, GY + oy, GR + 6)) drawGauge(F, GX + ox, GY + oy, nVis);
      if (on((BOWL.x0 + BOWL.x1) / 2 + ox, (BOWL.y0 + BOWL.y1) / 2 + oy, 30)) drawBowl(F, ox, oy, needle, bOpen, t);
      if (on(SCREW.x + ox, SCREW.y + oy, 16)) drawScrew(F, SCREW.x + ox, SCREW.y + oy, screwOut, screwRot);
      // ---------------------------------------------------------- flywheel, pistons, button
      const near = Math.abs(delta) < WIN && stage === 'start' && !running;
      if (on(FWX + ox, FWY + oy, FRX + 8)) {
        drawFlywheel(F, FWX + ox, FWY + oy, fwA, fwW);
        drawPointer(F, FWX + ox, FWY - FRY - 5 + oy, near);
      }
      if (on((CUT.x0 + CUT.x1) / 2 + ox, (CUT.y0 + CUT.y1) / 2 + oy, 70)) drawPistons(F, ox, oy, fwA, fwW, fire, fireCyl);
      if (on(BTN.x + ox, BTN.y + oy, 20)) drawButton(F, BTN.x + ox, BTN.y + oy, press, running, t);
      // ---------------------------------------------------------- the handwheel
      if (on(WX + ox, WY + oy, WRX + 8)) {
        const jud = vJud > 0 ? Math.sin(t * 80) * 0.035 * vJud / 0.4 : 0;
        drawWheel(S, WX + ox + (vJud > 0.2 ? Math.round(Math.sin(t * 70)) : 0), WY + oy, vAng + jud);
        flush(S, F, 3);
      }

      // ---------------------------------------------------------- Mori's hands, per stage (they slide in and out with the camera)
      const pres = (k: Stage) => {
        if (stage === k) return pan ? ease(Math.min(1, pan.t * 1.4 - 0.3 > 0 ? pan.t * 1.4 - 0.3 : 0)) : 1;
        if (pan && STAGES[si - 1] === k) return 1 - ease(Math.min(1, pan.t * 3));
        return 0;
      };
      const use3d = !!hands?.ready3d;
      const L3 = hands?.left ?? null, R3 = hands?.right ?? null;
      if (L3) L3.visible = false;
      if (R3) R3.visible = false;
      const pv = pres('valve');
      if (pv > 0) {
        const drop = (1 - pv) * 110;
        const cxw = WX - cam.x, cyw = WY - cam.y;
        const hand = (baseA: number, push: number, side: number) => {
          // the hand rides the rim through the push, then lifts off and re-grips
          const ph = push > 0.72 ? (1 - push) / 0.28 : push / 0.72;
          const slip = side === lastSide && slipT > 0 ? Math.sin(slipT * 30) * 0.08 : 0;
          const a = baseA + ph * (vPress < 4 ? 0.08 : 0.42) + slip;
          const lift = push > 0 && push < 0.72 ? Math.sin(push / 0.72 * Math.PI) * 4 : 0;
          const hx0 = cxw + Math.cos(a) * (WRX - 3 + lift), hy0 = cyw + Math.sin(a) * (WRY - 3 + lift) + drop;
          return [hx0, hy0, a, lift] as const;
        };
        const [lx, ly, la, ll] = hand(Math.PI * 1.12, pushL, -1);
        const [rx, ry, ra, rl] = hand(-Math.PI * 0.12, pushR, 1);
        if (use3d && L3 && R3) {
          // both fists round the rim: a short chord of the rim under each hand, the index side on top
          const rim = (a: number, lift: number, d: number): [number, number, number] => [cxw + Math.cos(a + d) * (WRX - 3 + lift), cyw + Math.sin(a + d) * (WRY - 3 + lift) + drop, 4];
          const grip = (h: typeof L3, a: number, lift: number, push: number) => {
            const p0 = rim(a, lift, -0.2), p1 = rim(a, lift, 0.2);
            const top = p0[1] < p1[1];
            h.visible = true;
            h.hold({ a: top ? p0 : p1, b: top ? p1 : p0, r: 3.4 }, { follow: 0, force: 0.55 + push * 0.4 });
          };
          grip(L3, la, ll, pushL);
          grip(R3, ra, rl, pushR);
        } else {
          const lwx = lx + Math.cos(la) * 12, lwy = ly + Math.sin(la) * 12 + 4, rwx = rx + Math.cos(ra) * 12, rwy = ry + Math.sin(ra) * 12 + 4;
          sleeve(S, lwx - 44, lwy + 130, lwx, lwy, 24, 9);
          sleeve(S, rwx + 44, rwy + 130, rwx, rwy, 24, 9);
          flush(S, F, 5);
          grip(S, lx, ly, la, -1);
          grip(S, rx, ry, ra, 1);
          flush(S, F, 3);
        }
      }
      const pb = pres('bleed');
      if (pb > 0) {
        const drop = (1 - pb) * 90;
        const hx0 = SCREW.x + ox + 38 + screwOut * 3, hy0 = SCREW.y + oy + drop;
        // the screwdriver: shaft into the slot, a fluted amber handle that turns
        drawDriver(S, SCREW.x + ox + 10 + screwOut * 3, hy0, hx0 - 2, screwRot);
        flush(S, F);
        if (use3d && R3 && pb >= pv) {
          // the fist round the handle, the wrist rolling as the screw backs out
          const phi = 0.7 + Math.sin(screwRot * 2) * 0.28 * screwOut;
          R3.visible = true;
          R3.hold({ a: [hx0 - 13, hy0, 6], b: [hx0 + 6, hy0, 6], r: 5 }, { follow: 0, approach: [0.25, Math.cos(phi), Math.sin(phi)], force: 0.5 + screwOut * 0.3 });
        } else if (!use3d) {
          sleeve(S, hx0 + 34, hy0 + 110, hx0 + 8, hy0 + 12, 24, 9);
          fist(S, hx0 + 4, hy0 + 1, -Math.PI / 2 - 0.35 + Math.sin(screwRot * 2) * 0.12 * screwOut, 10, 8.5, 1);
          flush(S, F, 4);
        }
      }
      const pfz = pres('fuse');
      if (pfz > 0) {
        const tr = drawTray(S, F, pfz, -cx, -cy, box0, boy0, { sel, anim: fAnim, done: fDone, recoil }, t, use3d);
        if (use3d && L3 && R3) {
          // the left hand under the tray, palm up; the right pinches the fuse or points at the one picked
          L3.visible = true;
          L3.release().setPose('hold').reachTo(tr.lx + 6, tr.ly + 4, 2, { with: 'palm', fingers: [0.85, -0.15, -0.35], palm: [0.05, -1, 0.15], follow: 0 });
          R3.visible = true;
          R3.release();
          if (tr.holding) R3.setPose('pinch').reachTo(tr.tx + 2, tr.ty + 1, 8, { with: 'pinch', fingers: [-0.45, 0.55, -0.55], palm: [-0.5, 0.2, -0.8], follow: 26 });
          else if (tr.pointing) R3.setPose('point').reachTo(tr.tx + 2, tr.ty - 3, 10, { with: 'index', fingers: [-0.5, 0.65, -0.5], palm: [-0.3, 0.3, -1], follow: 18 });
          else R3.setPose('relaxed').reachTo(tr.tx + 16, tr.ty + 26, 6, { with: 'palm', fingers: [-0.5, -0.6, -0.4], palm: [-0.3, 0.4, -1], follow: 12 });
        }
      }
      const ps = pres('start');
      if (ps > 0) {
        const drop = (1 - ps) * 90;
        const bxs = BTN.x + ox, bys = BTN.y + oy;
        const pr = press > 0.5 ? (1 - press) * 2 : press * 2;
        const wx0 = bxs + 26 - pr * 3, wy0 = bys + 20 + drop - pr * 2;
        if (use3d && R3 && ps >= pfz) {
          // a fingertip on the starter: the index jabs it, the hand follows through
          R3.visible = true;
          R3.release().setPose('press').reachTo(bxs + 3 - pr * 2, bys - 1 - pr + drop, 6 - pr * 3, { with: 'index', fingers: [-0.55, -0.45, -0.7], palm: [0.1, 0.5, -1], follow: 0 });
        } else if (!use3d) {
          sleeve(S, wx0 + 60, wy0 + 40, wx0 + 4, wy0 + 2, 15, 9);
          reach(S, wx0, wy0, bxs + 3 - pr * 2, bys - 1 - pr, 0);
          flush(S, F, 4);
        }
      }

      // ---------------------------------------------------------- particles
      for (const p of parts) drawPart(F, p);
      // ---------------------------------------------------------- warm light from the bulb, dust in its beam
      if (on(BULB.x + box0, BULB.y + boy0, 150)) {
        glow(F, BULB.x + box0, BULB.y + boy0 + 4, 150, 64 * flick, 38 * flick, 12 * flick);
        glow(F, BULB.x + box0, BULB.y + boy0 + 4, 26, 120 * flick, 90 * flick, 40 * flick);
      }
      for (let i = 0; i < 26; i++) {
        const px = (hash(i, 1) * 360 + t * (3 + hash(i, 2) * 5) + Math.sin(t * 0.7 + i) * 8) % 360 - 20, py = (hash(i, 3) * 200 + t * (2 + hash(i, 4) * 3)) % 200 - 10;
        const d = Math.hypot(px - (BULB.x + box0), py - (BULB.y + boy0));
        if (d < 110) sb(F, px, py, hx('#ffe8c0'), (1 - d / 110) * 0.6 * flick);
      }
      // ---------------------------------------------------------- diesel all over the lens
      if (splats.length) drawSpray(F, splats, sprayA);
      // smoky haze that builds up with every cough, drifting (sampled on a 2x2 grid)
      if (haze > 0.01 && stage === 'start') {
        const HZ = hx('#6e6668');
        for (let y = 0; y < CH; y += 2) for (let x = 0; x < CW; x += 2) {
          const n = vn(x + t * 9, y - t * 4, 30, 5) * 0.7 + vn(x - t * 5, y, 12, 6) * 0.3;
          const a = haze * 0.55 * n * (1 - y / CH * 0.45);
          if (a > 0.02) { blend2(F, x, y, HZ, a); blend2(F, x + 1, y, HZ, a); blend2(F, x, y + 1, HZ, a); blend2(F, x + 1, y + 1, HZ, a); }
        }
      }
      // ---------------------------------------------------------- one pass: the room's warm key light from the upper left,
      // the bulb's flicker on everything, and a warm vignette
      {
        const fk = flick !== 1 ? Math.min(1.1, 0.8 + flick * 0.2) : 1;
        const kr = 24 * flick, kg = 14 * flick, kb = 4 * flick;
        for (let i = 0; i < buf.length; i++) {
          const v = buf[i], k = KEYL[i];
          buf[i] = rgb(Math.min(255, (R(v) * fk + k * kr) * VR[i]), Math.min(255, (G(v) * fk + k * kg) * VG[i]), Math.min(255, (B(v) * fk * 0.98 + k * kb) * VB[i]));
        }
      }
      if (pan && pan.t > 0.08 && pan.t < 0.92) {
        const k = Math.sin(pan.t * Math.PI) * 0.32;
        for (let i = 0; i < buf.length; i++) buf[i] = mixc(buf[i], prev[i], k);
      }
      prev.set(buf);
      frameMs = frameMs * 0.9 + (performance.now() - t0) * 0.1;
      cu.present();
      if (hands) {
        // the bulb's flicker on the hands too
        hands.keyGain = Math.min(1.15, flick);
        hands.frame(dt);
      }
      return true;
    });
  });
  hands?.destroy();

  window.removeEventListener('keydown', kd, true);
  cu.wrap.removeEventListener('pointerdown', pd);
  cu.wrap.removeEventListener('pointermove', pm);
  hold.dispose();
  return ok;

  // ---------------------------------------------------------------- local helpers that use the state
  function sprayNow(line: string) {
    needle = 0.2; nVel = -2;
    sprayA = 1;
    splats.length = 0;
    for (let i = 0; i < 12; i++) splats.push({ x: 20 + Math.random() * 280, y: 10 + Math.random() * 150, r: 6 + Math.random() * 18, s: Math.random() * 100, drip: 0.4 + Math.random(), age: -i * 0.02 });
    shake = 0.35;
    audio.play('hiss', { vol: 0.6 });
    audio.play('splash', { vol: 0.35, pitch: 1.4 });
    after(0.35, () => audio.play('emoteLaugh', { vol: 0.4 }));
    const ex = SCREW.x + 9 - cam.x, ey = SCREW.y - 2 - cam.y;
    for (let k = 0; k < 40; k++) add(2, ex, ey, -40 - Math.random() * 160, -60 - Math.random() * 60, 1.4, 1 + (k % 3 === 0 ? 1 : 0), 1);
    jenna(line, { ms: 3000 });
  }
  function puff(delay = 0, scale = 1) {
    // smoke coughed out of the manifold joint, the head gasket and the cutaway
    const src = [[262, 160], [214, 168], [246, 170], [190, 196], [230, 194]];
    const [sx, sy] = src[Math.floor(Math.random() * src.length)];
    const dark = running ? 0.35 : 0.85 + Math.random() * 0.15;
    add(7, sx - cam.x + (Math.random() - 0.5) * 10, sy - cam.y + delay * 6, (Math.random() - 0.35) * 26, -10 - Math.random() * 16, 2.2 + Math.random() * 1.4, (6 + Math.random() * 5) * scale, dark);
    haze = Math.min(1, haze + 0.08 * scale);
  }
}

// ------------------------------------------------------------------ live drawing
function line(F: Lay, x0: number, y0: number, x1: number, y1: number, c: number) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) sp(F, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c);
}
function glow(F: Lay, cx: number, cy: number, rad: number, r: number, g: number, b: number) {
  const r2 = rad * rad, d = F.d;
  for (let y = Math.max(0, Math.floor(cy - rad)); y < Math.min(CH, cy + rad); y++) for (let x = Math.max(0, Math.floor(cx - rad)); x < Math.min(CW, cx + rad); x++) {
    const q = 1 - ((x - cx) ** 2 + (y - cy) ** 2) / r2;
    if (q <= 0) continue;
    const k = q * q * q, i = y * CW + x, v = d[i];
    d[i] = rgb(Math.min(255, R(v) + r * k), Math.min(255, G(v) + g * k), Math.min(255, B(v) + b * k));
  }
}
const on = (x: number, y: number, r: number) => x + r >= 0 && y + r >= 0 && x - r < CW && y - r < CH;
// screen-space light maps (constant): the key light's falloff and the vignette's per-channel darkening
const KEYL = new Float32Array(CW * CH), VR = new Float32Array(CW * CH), VG = new Float32Array(CW * CH), VB = new Float32Array(CW * CH);
for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
  const i = y * CW + x, q = Math.max(0, 1 - Math.hypot(x - 20, y + 40) / 250);
  KEYL[i] = q * q;
  const d = ((x - CW / 2) / (CW * 0.6)) ** 2 + ((y - CH / 2) / (CH * 0.68)) ** 2;
  const k = d > 0.42 ? Math.min(0.62, (d - 0.42) * 0.9) : 0;
  VR[i] = 1 - k; VG[i] = 1 - k * 1.08; VB[i] = 1 - k * 1.18;
}
function drawBulb(F: Lay, x: number, y: number, k: number) {
  // conduit, porcelain socket, a warm pear bulb behind a wire cage
  for (let yy = -40; yy < -10; yy++) { sp(F, x - 1, y + yy, IRON[5]); sp(F, x, y + yy, IRON[3]); sp(F, x + 1, y + yy, IRON[1]); }
  for (let yy = -10; yy < -4; yy++) for (let xx = -4; xx <= 4; xx++) sp(F, x + xx, y + yy, Math.abs(xx) === 4 ? INK : ramp(CREAM, 0.7 - xx / 8 - (yy + 10) / 20, x + xx, y + yy));
  const hot = Math.min(1, k);
  ell(F, x, y + 4, 7, 9, (nx, ny, nz) => {
    const c = nz > 0.8 && nx < 0 && ny < 0 ? hx('#fffbe8') : mixc(hx('#ffb44a'), hx('#fff0b8'), nz * hot);
    return mixc(hx('#6a4020'), c, 0.3 + hot * 0.7);
  });
  // filament
  for (let xx = -2; xx <= 2; xx++) sp(F, x + xx, y + 3 + (xx & 1), hot > 0.8 ? hx('#ffffff') : hx('#ffe0a0'));
  // cage wires
  for (let a = 0; a < 5; a++) {
    const xx = -7 + a * 3.5;
    for (let yy = -4; yy < 12; yy++) { const bow = Math.sqrt(Math.max(0, 1 - ((yy - 4) / 9) ** 2)); sp(F, x + xx * (0.6 + bow * 0.5), y + yy, a === 0 ? IRON[5] : INK); }
  }
  for (const yy of [0, 6, 11]) for (let xx = -8; xx <= 8; xx++) { const w = yy === 11 ? 4 : 8; if (Math.abs(xx) <= w) sp(F, x + xx, y + yy, INK); }
}
function drawGauge(F: Lay, cx: number, cy: number, n: number) {
  const a = gaugeAng(clamp(n, -0.02, 1.04));
  const ca = Math.cos(a), sa = Math.sin(a);
  // needle shadow, then the needle: a red blade with a short tail
  for (let r = -6; r < GR * 0.7; r += 0.5) { sb(F, cx + ca * r + 2, cy + sa * r + 2, CREAM[0], 0.35); }
  for (let r = -6; r < GR * 0.7; r += 0.4) {
    const w = r < 0 ? 1.4 : 1.4 * (1 - r / (GR * 0.74));
    for (let q = -w; q <= w; q += 0.5) sp(F, cx + ca * r - sa * q, cy + sa * r + ca * q, q < 0 ? RED[5] : RED[3]);
  }
  ell(F, cx, cy, 3.4, 3.4, (nx, ny, nz, x, y) => sh(BRASS, nx, ny, nz, x, y, 0.3, 0.7, 1, 8));
  // the glass: a soft sheen and a hard window glint across the upper left
  for (let y = Math.floor(cy - GR); y < cy + GR; y++) for (let x = Math.floor(cx - GR); x < cx + GR; x++) {
    const nx = (x + 0.5 - cx) / (GR * 0.8), ny = (y + 0.5 - cy) / (GR * 0.8), r = Math.hypot(nx, ny);
    if (r > 1) continue;
    const g = nx + ny;
    if (g < -0.9 && g > -1.05 && r > 0.4) sb(F, x, y, hx('#ffffff'), 0.7);
    else if (g < -0.6 && g > -0.68 && r > 0.35) sb(F, x, y, hx('#ffffff'), 0.4);
    else if (g < -0.7) sb(F, x, y, hx('#fffef4'), 0.12);
  }
}
function drawBowl(F: Lay, ox: number, oy: number, needle: number, open: boolean, t: number) {
  // diesel in the glass, the air pocket at the top shrinks as the air bleeds out
  const air = clamp(0.62 - needle * 0.72, 0, 0.62);
  const top = BOWL.y0 + 5, bot = BOWL.y1, lvl = top + (bot - top) * air;
  for (let y = top; y < bot; y++) {
    const inset = y > BOWL.y1 - 8 ? (y - BOWL.y1 + 8) * 0.8 : 0;
    for (let x = Math.ceil(BOWL.x0 + inset); x < BOWL.x1 - inset; x++) {
      const X = x + ox, Y = y + oy;
      const u = (x + 0.5 - BOWL.x0) / (BOWL.x1 - BOWL.x0);
      if (y >= lvl + Math.sin(x * 0.6 + t * 6) * (open ? 0.8 : 0.3)) {
        sb(F, X, Y, ramp(DIESEL, 0.55 - u * 0.3 + (y - lvl) / 90, X, Y), 0.82);
        if (Math.abs(y - lvl) < 1) sb(F, X, Y, DIESEL[5], 0.8);
      } else sb(F, X, Y, hx('#c8d8dc'), 0.12);
      // glass: a vertical window glint on the left and a rim on the right
      if (Math.abs(u - 0.16) < 0.04) sb(F, X, Y, hx('#ffffff'), 0.55);
      if (u > 0.9) sb(F, X, Y, hx('#101418'), 0.35);
    }
  }
  // bubbles rising through the diesel while the screw is open
  if (open && air > 0.02) for (let i = 0; i < 7; i++) {
    const ph = (t * (0.7 + hash(i, 2) * 0.6) + hash(i, 1)) % 1;
    const x = BOWL.x0 + 6 + hash(i, 3) * (BOWL.x1 - BOWL.x0 - 12) + Math.sin(t * 5 + i) * 1.2, y = bot - 3 - ph * (bot - lvl - 3);
    sp(F, x + ox, y + oy, hx('#fff8e0')); sp(F, x + ox + 1, y + oy + 1, DIESEL[2]);
  }
}
function drawScrew(F: Lay, x: number, y: number, out: number, rot: number) {
  // a knurled brass bleed screw backing out of its boss
  const len = 5 + out * 3;
  for (let xx = 0; xx < len; xx++) for (let yy = -4; yy <= 4; yy++) {
    const nyv = yy / 4.5, nz = Math.sqrt(Math.max(0, 1 - nyv * nyv));
    let c = sh(BRASS, 0, nyv, nz, x + 5 + xx, y + yy, 0.3, 0.7, 1, 8);
    if (((yy * 3 + Math.floor(rot * 6)) & 3) === 0 && xx > 1) c = BRASS[2]; // knurl, turning
    if (xx < 2 && out > 0.2) c = ramp(BRASS, 0.3 + (yy + 4) / 20, x, y); // threads showing
    sp(F, x + 5 + xx, y + yy, c);
  }
  for (let yy = -4; yy <= 4; yy++) sp(F, x + 5 + len, y + yy, INK);
  for (let yy = -5; yy <= 5; yy++) { sp(F, x + 4, y + yy, INK); }
  for (let xx = 5; xx < 5 + len; xx++) { sp(F, x + xx, y - 5, INK); sp(F, x + xx, y + 5, INK); }
}
function drawDriver(S: Lay, tipX: number, y: number, handX: number, rot: number) {
  tube(S, [[tipX, y], [handX - 18, y]], 1.6, (nx, ny, nz, x, yy) => sh(STEEL, nx, ny, nz, x, yy, 0.34, 0.7, 1.2, 12));
  // the ferrule then the fluted amber handle; the flutes scroll as it turns
  tube(S, [[handX - 19, y], [handX - 15, y]], 2.6, (nx, ny, nz, x, yy) => sh(STEEL, nx, ny, nz, x, yy, 0.3, 0.7, 1, 8));
  const AMB = ['#3a1a06', '#6a3008', '#a4520e', '#d87c1c', '#f4a840', '#ffd890'].map(hx);
  tube(S, [[handX - 15, y], [handX + 10, y]], 5.4, (nx, ny, nz, x, yy) => {
    let c = sh(AMB, nx, ny, nz, x, yy, 0.3, 0.72, 1, 10);
    const f = Math.asin(clamp(ny, -1, 1)) * 2.6 + rot * 3;
    if (Math.abs(Math.sin(f)) < 0.3) c = mixc(c, AMB[1], 0.5);
    return c;
  });
}
function drawFlywheel(F: Lay, cx: number, cy: number, ang: number, w: number) {
  // the rim's thickness: the cylindrical edge shows up and right of the face
  for (let k = 4; k >= 1; k--) ell(F, cx + k * DX, cy - k * DY, FRX, FRY, (nx, ny, nz, x, y) => {
    const r = Math.hypot(nx, ny) || 1;
    if (r < 0.86) return 0; // hidden behind the face anyway
    return sh(STEEL, nx / r, ny / r, 0.1, x, y, 0.14, 0.6, 0.6, 6);
  });
  const blur = w > 5 ? Math.min(4, Math.floor(w / 3)) : 1;
  const step = w * 0.012;
  ell(F, cx, cy, FRX, FRY, (nx, ny, nz, x, y) => {
    const r = Math.hypot(nx, ny), sa = Math.atan2(ny, nx);
    // machined face: lathe rings and the fixed anisotropic highlight of a turned disc
    let lit = 0.42 + Math.sin(r * 44) * 0.03 + Math.pow(Math.max(0, Math.cos(2 * (sa + 2.3))), 6) * 0.3 * r - r * 0.08;
    let c: number;
    if (r > 0.9) {
      // ring gear: the teeth sweep round as it turns
      const phi = sa - ang;
      let dark = 0;
      for (let b = 0; b < blur; b++) dark += Math.sin((phi + b * step) * 48) > 0.3 ? 1 : 0;
      c = ramp(STEEL, 0.5 - (nx + ny) * 0.2 - (dark / blur) * 0.3, x, y);
      if (r > 0.97) c = INK;
      return c;
    }
    if (r < 0.2) {
      // the hub: a dome with a big hex nut
      const hn = Math.sqrt(Math.max(0, 1 - (r / 0.2) ** 2));
      c = sh(STEEL, nx / 0.2, ny / 0.2, hn, x, y, 0.3, 0.7, 1, 10);
      const la = sa - ang, hr = r / 0.12;
      const hexR = Math.cos(Math.PI / 6) / Math.cos(((la % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3) - Math.PI / 6);
      if (hr < hexR) c = ramp(IRON, 0.5 - (nx + ny) * 1.6, x, y);
      if (Math.abs(hr - hexR) < 0.12) c = INK;
      return c;
    }
    c = ramp(STEEL, lit, x, y);
    // holes, bolts and the timing mark ride round with the wheel (smeared when it spins fast)
    let hole = 0, boltv = 0, mark = 0;
    for (let b = 0; b < blur; b++) {
      const phi = sa - ang - b * step, px = r * Math.cos(phi), py = r * Math.sin(phi);
      if ((r > 0.46 && r < 0.7) || (r > 0.26 && r < 0.38)) for (let i = 0; i < 6; i++) {
        // rotate the point into each hole's frame (precomputed angles, no trig per hole)
        const hc = HOLE_C[i], hs = HOLE_S[i];
        const hx2 = px * hc + py * hs - 0.58, hy2 = py * hc - px * hs;
        if (hx2 * hx2 + hy2 * hy2 < 0.012) hole++;
        const bc = BOLT_C[i], bs = BOLT_S[i];
        const bx2 = px * bc + py * bs - 0.32, by2 = py * bc - px * bs;
        if (bx2 * bx2 + by2 * by2 < 0.0025) boltv++;
      }
      if (r > 0.66 && px > 0 && Math.abs(py) < 0.045 * r) mark++;
    }
    if (hole) {
      const inner = ramp(IRON, 0.1 + (nx + ny + 1.4) * 0.12, x, y);
      c = mixc(c, inner, hole / blur);
    }
    if (boltv) c = mixc(c, STEEL[5], boltv / blur * 0.8);
    if (mark) c = mixc(c, hx('#fffcf0'), mark / blur);
    return c;
  });
}
const HOLE_C = [0, 1, 2, 3, 4, 5].map(i => Math.cos(i * Math.PI / 3 + Math.PI / 6)), HOLE_S = [0, 1, 2, 3, 4, 5].map(i => Math.sin(i * Math.PI / 3 + Math.PI / 6));
const BOLT_C = [0, 1, 2, 3, 4, 5].map(i => Math.cos(i * Math.PI / 3)), BOLT_S = [0, 1, 2, 3, 4, 5].map(i => Math.sin(i * Math.PI / 3));
function drawPointer(F: Lay, x: number, y: number, near: boolean) {
  // the brass pointer tip reaching over the rim; it glints as the mark lines up
  for (let yy = 0; yy < 8; yy++) for (let xx = -(3 - yy * 0.4); xx <= 3 - yy * 0.4; xx++) sp(F, x + xx, y + yy, near ? BRASS[7] : xx < 0 ? BRASS[5] : BRASS[3]);
  for (let yy = 0; yy < 8; yy++) { sp(F, x - (4 - yy * 0.4), y + yy, INK); sp(F, x + (4 - yy * 0.4), y + yy, INK); }
  sp(F, x, y + 8, INK);
  if (near) { glow(F, x, y + 5, 10, 90, 80, 40); sp(F, x - 1, y + 2, hx('#ffffff')); }
}
function drawPistons(F: Lay, ox: number, oy: number, ang: number, w: number, fire: number, fireCyl: number) {
  const blur = w > 8 ? 3 : 1;
  for (let i = 0; i < BORES.length; i++) {
    const bx = BORES[i] + ox;
    for (let b = blur - 1; b >= 0; b--) {
      const phi = ang + i * Math.PI - b * w * 0.012;
      const cpx = bx + Math.sin(phi) * CRANK_R, cpy = CRANK_Y + oy - Math.cos(phi) * CRANK_R;
      const pinY = CRANK_Y + oy - (CRANK_R * Math.cos(phi) + Math.sqrt(ROD * ROD - (CRANK_R * Math.sin(phi)) ** 2));
      const topY = pinY - 8;
      const a = b === 0 ? 1 : 0.35;
      // crankshaft journal, and the web with its counterweight swinging opposite the pin
      for (let xx = -BORE_HW - 4; xx <= BORE_HW + 4; xx++) for (let yy = -3; yy <= 3; yy++) blend2(F, bx + xx, CRANK_Y + oy + yy, ramp(STEEL, 0.55 - yy * 0.12, bx + xx, yy), a);
      for (let yy = -12; yy <= 12; yy++) for (let xx = -12; xx <= 12; xx++) {
        const d = Math.hypot(xx, yy);
        const along = (xx * Math.sin(phi) - yy * Math.cos(phi));
        const inW = along > 0 ? Math.hypot(xx - Math.sin(phi) * CRANK_R, yy + Math.cos(phi) * CRANK_R) < 5 || d < 5 : d < 11.5;
        if (!inW) continue;
        const nx2 = xx / 12, ny2 = yy / 12;
        let c = ramp(IRON, 0.42 - (nx2 + ny2) * 0.35, bx + xx, CRANK_Y + yy);
        if (d > 10.5 && along < 0) c = IRON[1];
        blend2(F, bx + xx, CRANK_Y + oy + yy, c, a);
      }
      // connecting rod: an I-section bar, lit on its left flank
      const rl = Math.hypot(bx - cpx, pinY - cpy), n = Math.ceil(rl * 2);
      const rx = (pinY - cpy) / rl, ry = -(bx - cpx) / rl;
      for (let s2 = 0; s2 <= n; s2++) {
        const X = cpx + (bx - cpx) * s2 / n, Y = cpy + (pinY - cpy) * s2 / n;
        for (let q = -2.5; q <= 2.5; q += 0.5) blend2(F, X + rx * q, Y + ry * q, Math.abs(q) > 2 ? STEEL[0] : q < -0.5 ? STEEL[4] : q > 0.8 ? STEEL[2] : STEEL[3], a);
      }
      ell(F, cpx, cpy, 3, 3, (nx, ny, nz, x, y) => sh(STEEL, nx, ny, nz, x, y, 0.3, 0.7, 1, 8));
      // the piston: a lit cylinder with ring grooves and a sooty crown
      for (let yy = 0; yy < 16; yy++) for (let xx = -BORE_HW + 1; xx < BORE_HW - 1; xx++) {
        const nx = (xx + 0.5) / (BORE_HW - 1), nz = Math.sqrt(Math.max(0, 1 - nx * nx));
        let c = sh(ALU, nx, 0, nz, bx + xx, topY + yy, 0.3, 0.72, 0.8, 10);
        if (yy === 3 || yy === 6) c = ALU[1];
        if (yy === 0) c = mixc(c, SOOT, 0.5);
        if (yy === 15) c = ALU[1];
        if (Math.abs(yy - 9) < 2 && Math.abs(xx) < 2) c = STEEL[4]; // wrist pin
        blend2(F, bx + xx, topY + yy, c, a);
      }
      // combustion: the chamber above the fired piston flares orange
      if (b === 0 && fire > 0 && i === fireCyl) {
        // a flame front blooming from the injector tip
        for (let y = BORE_TOP + oy; y < topY; y++) for (let x = bx - BORE_HW + 1; x < bx + BORE_HW - 1; x++) {
          const d = Math.hypot((x - bx) / BORE_HW, (y - BORE_TOP - oy) / 14);
          const k = fire * clamp(1.25 - d * (1.4 - fire * 0.6), 0, 1) * (0.75 + hash(x, y, Math.floor(fire * 20)) * 0.25);
          sadd(F, x, y, 255 * k, 170 * k * k + 40 * k, 60 * k * k * k);
        }
        glow(F, bx, BORE_TOP + oy + 6, 40, 200 * fire, 100 * fire, 20 * fire);
      }
    }
  }
}
function blend2(F: Lay, x: number, y: number, c: number, a: number) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= F.w || y >= F.h) return;
  const i = y * F.w + x;
  F.d[i] = a >= 1 ? c : mixc(F.d[i], c, a);
}
function drawButton(F: Lay, x: number, y: number, press: number, running: boolean, t: number) {
  const dn = press > 0 ? 2 : 0;
  const GR2 = ['#0c2a10', '#15461a', '#206a26', '#2e9434', '#4cbc4c', '#8ae07a', '#d0ffc0'].map(hx);
  ell(F, x, y + dn * 0.5, 8, 7 - dn * 0.8, (nx, ny, nz, px, py) => sh(GR2, nx, ny, nz, px, py, 0.3 - dn * 0.05, 0.72, 1, 10));
  for (let a = 0; a < 6.3; a += 0.1) sp(F, x + Math.cos(a) * 8.5, y + dn * 0.5 + Math.sin(a) * (7.5 - dn * 0.8), INK);
  if (running) glow(F, x, y, 14, 20, 80 + Math.sin(t * 8) * 20, 20);
}
function drawWheel(S: Lay, cx: number, cy: number, ang: number) {
  // the red cast handwheel: rim with grip knobs, five spokes, hub and nut. Its thickness shows
  // as a darker copy behind, stepped up and right along the depth axis.
  const spokes = 5, rimR = 0.9, rimH = 0.105;
  const paint = (ox: number, oy: number, backside: boolean) => {
    const X = cx + ox, Y = cy + oy;
    const base = backside ? 0.05 : 0.3, gain = backside ? 0.35 : 0.72, spv = backside ? 0 : 1.1;
    // spokes
    for (let i = 0; i < spokes; i++) {
      const a = ang + i * Math.PI * 2 / spokes;
      const x0 = X + Math.cos(a) * WRX * 0.16, y0 = Y + Math.sin(a) * WRY * 0.16, x1 = X + Math.cos(a) * WRX * 0.86, y1 = Y + Math.sin(a) * WRY * 0.86;
      tube(S, [[x0, y0], [x1, y1]], 3.4, (nx, ny, nz, x, y) => sh(RED, nx, ny, nz, x, y, base, gain, spv, 10));
    }
    // rim: a torus around the ellipse, with chipped paint that rotates with it and grip knobs
    for (let y = Math.floor(Y - WRY - 4); y <= Math.ceil(Y + WRY + 4); y++) for (let x = Math.floor(X - WRX - 4); x <= Math.ceil(X + WRX + 4); x++) {
      const u = (x + 0.5 - X) / WRX, v = (y + 0.5 - Y) / WRY, r = Math.hypot(u, v);
      if (r < rimR - rimH - 0.01 || r > rimR + rimH + 0.09) continue;
      const la = Math.atan2(v, u) - ang;
      const knob = Math.pow(Math.max(0, Math.cos(la * 8)), 12) * 0.05;
      const hh = rimH + knob;
      const q = (r - rimR - knob * 0.6) / hh;
      if (Math.abs(q) > 1 || r === 0) continue;
      const ux = u / r, uy = v / r, nz = Math.sqrt(1 - q * q);
      let c = sh(RED, ux * q, uy * q, nz, x, y, base, gain, spv, 12);
      if (!backside) {
        const chip = hash(Math.floor(((la % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) * 9), Math.floor(q * 2 + 2), 5);
        if (chip < 0.12) c = ramp(RUST, 0.3 + nz * 0.4, x, y);
        else if (chip > 0.93 && q < 0) c = RED[6];
      }
      sp(S, x, y, c);
    }
    // hub boss and the stem nut (hexagonal, turning)
    ell(S, X, Y, 10, 9.5, (nx, ny, nz, x, y) => sh(RED, nx, ny, nz, x, y, base, gain, spv, 10));
    if (!backside) ell(S, X, Y, 5.2, 5.2, (nx, ny, nz, x, y) => {
      const la = Math.atan2(ny, nx) - ang, r = Math.hypot(nx, ny);
      const hexR = Math.cos(Math.PI / 6) / Math.cos(((((la % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3)) - Math.PI / 6));
      if (r > hexR) return 0;
      const facet = Math.floor((((la + ang) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 3));
      return ramp(STEEL, [0.9, 0.62, 0.3, 0.2, 0.4, 0.75][facet] ?? 0.5, x, y);
    });
  };
  paint(3 * DX, -3 * DY, true);
  paint(1.5 * DX, -1.5 * DY, true);
  paint(0, 0, false);
}
interface TraySt { sel: number; anim: { i: number; t: number; ok: boolean; zapped: boolean } | null; done: boolean; recoil: number }
interface Tray3 { lx: number; ly: number; tx: number; ty: number; holding: boolean; pointing: boolean }
function drawTray(S: Lay, F: Lay, pres: number, ox: number, oy: number, box0: number, boy0: number, st: TraySt, t: number, skipHands = false): Tray3 {
  const drop = (1 - pres) * 100;
  const X0 = TRAY.x0 + ox, X1 = TRAY.x1 + ox, Y0 = TRAY.y0 + oy + drop, Y1 = TRAY.y1 + oy + drop + 8;
  const TP = ['#0a0a0c', '#141418', '#1e1e24', '#2a2a32', '#3a3a44', '#50505c'].map(hx);
  // Mori's left hand under the tray's left end
  if (!skipHands) sleeve(S, X0 - 40, Y1 + 90, X0 - 2, Y0 + 16, 22, 9);
  // tray: the top rim and dark compartments (seen from above), then the fuses standing in them
  for (let y = Y0; y < Y0 + 8; y++) for (let x = X0 + Math.round((Y0 + 8 - y) * 0.3); x < X1 + Math.round((Y0 + 8 - y) * 0.3); x++) {
    const inner = y > Y0 + 1 && y < Y0 + 7 && ((x - X0 - 4) % 28) > 2;
    sp(S, x, y, inner ? TP[0] : y === Y0 ? TP[5] : TP[3]);
  }
  const target = [slotX(2) + 1 + box0, SLOT_Y - 4 + boy0];
  let handTo: number[] | null = null;
  for (let i = 0; i < 4; i++) {
    const fx = trayFuseX(i) + ox, fy = Y0 - 10;
    const a = st.anim && st.anim.i === i ? st.anim : null;
    if (a || (st.done && i === 1)) continue;
    const lift = i === st.sel ? 4 + Math.round(Math.sin(t * 6) * 0.8) : 0;
    paintFuse(S, fx, fy, FUSES[i].pal, FUSES[i].a, false, lift, true);
    if (i === st.sel) handTo = [fx + 6, fy - lift - 1];
  }
  // the front face of the tray hides the fuse blades; a paper label with the ratings
  for (let y = Y0 + 8; y < Y1; y++) for (let x = X0; x < X1; x++) {
    let c = ramp(TP, 0.5 - (y - Y0) / 50 - (x - X0) / 500 + (y === Y0 + 8 ? 0.3 : 0), x, y);
    if (y > Y0 + 11 && y < Y0 + 19 && x > X0 + 8 && x < X1 - 8) c = ramp(CREAM, 0.7 - (x - X0) / 400, x, y);
    sp(S, x, y, c);
  }
  for (let i = 0; i < 4; i++) txt(S, String(i + 1), trayFuseX(i) + ox + 5, Y0 + 13, INK);
  if (!skipHands) fist(S, X0 + 2, Y0 + 16, -Math.PI * 0.35, 9, 7.5, 1);
  // the fuse in flight to F3 (and back, if it was the wrong one)
  let holding = false;
  if (st.anim) {
    const a = st.anim, i = a.i;
    const from = [trayFuseX(i) + ox, Y0 - 10];
    let k: number;
    if (a.t < 0.45) k = ease(a.t / 0.45);
    else if (a.ok || a.t < 0.6) k = 1;
    else k = 1 - ease(Math.min(1, (a.t - 0.6) / 0.4));
    const shakeZ = !a.ok && a.t > 0.45 && a.t < 0.6 ? Math.round((Math.random() - 0.5) * 3) : 0;
    const x = from[0] + (target[0] - from[0]) * k + shakeZ, y = from[1] + (target[1] - from[1]) * k - Math.sin(k * Math.PI) * 18;
    if (!(a.ok && a.t > 0.6)) {
      paintFuse(S, x, y, FUSES[i].pal, FUSES[i].a, true, 0, k < 0.7);
      handTo = [x + 5, y - 1];
      holding = true;
    }
  }
  if (st.done) paintFuse(F, target[0], target[1], FUSES[1].pal, 15, false);
  // Mori's right hand: pinching the chosen fuse, or waiting beside the tray
  const idle = [X1 + 4, Y0 - 22];
  let [tx, ty] = handTo ?? idle;
  if (st.done && !(st.anim && st.anim.t < 0.9)) { tx = idle[0] + 16; ty = idle[1] + 40; }
  const rc = st.recoil;
  tx += rc * 14; ty += rc * 10;
  const out: Tray3 = { lx: X0 + 2, ly: Y0 + 16, tx, ty: ty + drop, holding, pointing: !!handTo && !holding };
  if (skipHands) { flush(S, F, 4); return out; }
  if (holding) {
    // pinched between thumb and fingers: the fist sits on the fuse's right side, thumb across its face
    const fx = tx + 9, fy = ty + 9 + drop;
    sleeve(S, fx + 48, fy + 96, fx + 12, fy + 12, 22, 9);
    fist(S, fx + 4, fy + 2, -Math.PI * 0.72, 9, 7.5, 1);
    tube(S, [[fx - 2, fy + 6], [fx - 8, fy + 2]], 2.4, (nx, ny, nz, x, y) => nz < 0.4 ? SKIN[1] : sh(SKIN, nx, ny, nz, x, y, 0.4, 0.62));
    tube(S, [[fx - 1, fy - 5], [fx - 6, fy - 8]], 2.2, (nx, ny, nz, x, y) => nz < 0.4 ? SKIN[1] : sh(SKIN, nx, ny, nz, x, y, 0.4, 0.62));
  } else {
    const wx = tx + 20, wy = ty + 28;
    sleeve(S, wx + 50, wy + 100 + drop, wx + 4, wy + 4 + drop, 22, 9);
    if (handTo) reach(S, wx, wy + drop, tx + 8, ty + 6 + drop, 0);
    else restHand(S, wx - 2, wy - 4 + drop, -Math.PI * 0.72);
  }
  flush(S, F, 4);
  return out;
}
function drawPart(F: Lay, p: P) {
  const x = p.x, y = p.y, f = p.life / p.max;
  switch (p.k) {
    case 0: { // rust flake, tumbling: flat side on (2x2), then edge on
      const edge = Math.sin(p.life * 24 + p.r * 3) > 0.3;
      sp(F, x, y, p.c);
      if (!edge) { sp(F, x + 1, y, mixc(p.c, RUST[6], 0.3)); sp(F, x, y + 1, mixc(p.c, INK, 0.35)); if (p.r > 1) sp(F, x + 1, y + 1, mixc(p.c, INK, 0.2)); }
      else sp(F, x + 1, y + 1, mixc(p.c, INK, 0.4));
      break;
    }
    case 1: case 4: case 6: case 7: { // dust puff, air mist, zap smoke, exhaust smoke
      const col = p.k === 1 ? (p.r > 3 ? hx('#9a6a40') : hx('#c89060')) : p.k === 4 ? hx('#eef4f6') : p.k === 6 ? hx('#9a9aa0') : mixc(hx('#b4aca6'), hx('#3e383a'), p.c * (0.5 + f * 0.5));
      const a = (p.k === 7 ? 0.78 : p.k === 1 ? 0.5 : 0.35) * Math.min(1, f * 1.4) * Math.min(1, (1 - f) * 10 + 0.5);
      const r = p.r;
      for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
        const d = (xx * xx + yy * yy) / (r * r);
        if (d > 1) continue;
        if (dith(x + xx | 0, y + yy | 0) > 0.95 - d * 0.6) continue;
        // lit from the upper left: puffs are lighter on that side
        const lc = xx + yy < -r * 0.4 ? mixc(col, hx('#fff4e0'), 0.25) : col;
        sb(F, x + xx, y + yy, lc, a * (1 - d * 0.5));
      }
      break;
    }
    case 2: // diesel droplet
      sp(F, x, y, DIESEL[4]); sb(F, x, y + 1, DIESEL[2], 0.8);
      if (p.r > 1) sp(F, x + 1, y, DIESEL[3]);
      break;
    case 3: { // air bubble
      const r = p.r;
      for (let a = 0; a < 6.3; a += 0.8) sb(F, x + Math.cos(a) * r, y + Math.sin(a) * r, hx('#f0faff'), 0.8);
      sp(F, x - r * 0.4, y - r * 0.4, hx('#ffffff'));
      break;
    }
    case 5: { // spark streak
      const c = f > 0.6 ? hx('#ffffff') : f > 0.3 ? hx('#ffe070') : hx('#ff8a30');
      line(F, x, y, x - p.vx * 0.025, y - p.vy * 0.025, c);
      break;
    }
  }
}
function drawSpray(F: Lay, splats: { x: number; y: number; r: number; s: number; drip: number; age: number }[], a: number) {
  const A = Math.min(1, a * 1.4);
  for (let i = 0; i < F.d.length; i++) F.d[i] = mixc(F.d[i], hx('#3a2408'), 0.22 * A);
  for (const s of splats) {
    if (s.age < 0) continue;
    const grow = Math.min(1, s.age * 8);
    const r = s.r * grow;
    // a glossy blob with a lumpy rim, a darker edge where it pools, and a window highlight
    for (let y = Math.floor(s.y - r - 2); y <= s.y + r + 2; y++) for (let x = Math.floor(s.x - r - 2); x <= s.x + r + 2; x++) {
      const ang = Math.atan2(y - s.y, x - s.x);
      const edge = r * (0.86 + 0.1 * Math.sin(ang * 3 + s.s) + 0.06 * Math.sin(ang * 7 - s.s));
      const d = Math.hypot(x - s.x, y - s.y) / Math.max(1, edge);
      if (d > 1) continue;
      let c = d > 0.82 ? DIESEL[0] : ramp(DIESEL, 0.4 - (y - s.y) / (r * 3) - d * 0.3, x, y);
      const hl = Math.hypot(x - s.x + r * 0.38, y - s.y + r * 0.4) / (r * 0.28);
      if (hl < 1) c = hl < 0.5 ? DIESEL[5] : DIESEL[4];
      sb(F, x, y, c, (0.72 - d * 0.1) * A);
    }
    // thrown tendrils ending in droplets
    for (let k = 0; k < 4; k++) {
      const aa = hash(k, 11, s.s | 0) * 6.28, L2 = r * (1.05 + hash(k, 12, s.s | 0) * 0.45);
      for (let q = r * 0.7; q < L2; q += 0.5) { const w = 2 * (1 - (q - r * 0.7) / (L2 - r * 0.7)); for (let o = -w; o <= w; o += 0.5) sb(F, s.x + Math.cos(aa) * q - Math.sin(aa) * o, s.y + Math.sin(aa) * q + Math.cos(aa) * o, DIESEL[1], 0.8 * A); }
      const ex = s.x + Math.cos(aa) * (L2 + 1.5), ey = s.y + Math.sin(aa) * (L2 + 1.5);
      for (let o = 0; o < 4; o++) sb(F, ex + (o & 1), ey + (o >> 1), o === 0 ? DIESEL[4] : DIESEL[1], 0.85 * A);
    }
    // drips running down
    const len = Math.min(60, s.age * 18 * s.drip) * grow;
    for (let k = 0; k < 3; k++) {
      const dx = s.x + (hash(k, s.s | 0) - 0.5) * s.r * 1.2, ln = len * (0.4 + hash(k, 3, s.s | 0) * 0.6);
      for (let y = s.y; y < s.y + s.r * 0.6 + ln; y++) { sb(F, dx, y, DIESEL[1], 0.75 * A); sb(F, dx + 1, y, DIESEL[3], 0.5 * A); }
      sb(F, dx, s.y + s.r * 0.6 + ln, DIESEL[4], 0.8 * A); sb(F, dx + 1, s.y + s.r * 0.6 + ln + 1, DIESEL[2], 0.8 * A);
    }
    // specks thrown round the splat
    for (let k = 0; k < 8; k++) { const aa = hash(k, 7, s.s | 0) * 6.28, dd = s.r * (1.2 + hash(k, 8, s.s | 0)); sb(F, s.x + Math.cos(aa) * dd, s.y + Math.sin(aa) * dd, DIESEL[2], 0.8 * A); }
  }
}

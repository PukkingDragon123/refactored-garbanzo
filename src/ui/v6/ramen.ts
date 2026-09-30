// V6 breakfast close-up: pouring boiling water into an instant ramen cup, Dave-the-Diver-tea style.
// Full screen, no UI: the galley counter under the porthole, the paper cup seen from above in 3/4,
// a gooseneck kettle in Mori's hand tipping as you hold. The water is a continuous ribbon stream
// that drums into a rippling heightfield surface (shaded from its normals: window glints, a bright
// meniscus at the wall, churning foam where the stream lands). The noodle puck sits dry with its
// toppings, then drowns, floats up and loosens; the flakes drift off on the ripples, the powder
// clouds the water into golden broth, steam curls up, and Chunk watches every drop.

import { openCloseup, CW, CH, rgb, hx, mixc, put, blend, ramp, dith, hash, R, G, B } from './closeup';
import { Hold, loop } from '../v4/mini';
import { audio } from '../../core/audio';

type Outcome = 'perfect' | 'over' | 'under';

// ------------------------------------------------------------------ palettes
const TILE = ['#7a6c58', '#a89a80', '#c8bb9e', '#ddd1b6', '#ece3cc'].map(hx);
const GROUT = hx('#857761');
const WOOD = ['#3a2416', '#553420', '#6e462a', '#875a36', '#a06e44', '#b88654'].map(hx);
const PAPER = ['#6e6258', '#9a8e80', '#c2b8a6', '#ddd5c4', '#efe9dc', '#fffaf0'].map(hx);
const INNER = ['#5e5446', '#83786a', '#a89c88', '#c9bea8', '#ddd4c0'].map(hx);
const LABEL = ['#5a1410', '#8a2218', '#b8341e', '#d8502c', '#ee7a44'].map(hx);
const NOODLE = ['#8a6428', '#b48c3c', '#d4aa56', '#e8c472', '#f6dc9c'].map(hx);
const STEEL = ['#23272d', '#3c4249', '#5c646c', '#86909a', '#b4bcc4', '#e4eaee', '#ffffff'].map(hx);
const SKIN = ['#8c392f', '#ba805d', '#d49672', '#f3a572', '#f8c090'].map(hx);
const SLEEVE = ['#2a2426', '#3e3638', '#555052', '#6c6668', '#858082'].map(hx);
const FUR = ['#6a4a2a', '#9a7040', '#c8984e', '#e4b87c', '#f4d4a0'].map(hx);
const MASK = ['#140c0a', '#2a1c16', '#3e2c2a', '#5a4238'].map(hx);
const INK = hx('#1a1014');

// ------------------------------------------------------------------ cup geometry (seen from above)
const CX = 150, RIM_Y = 84, RIM_RX = 56, RIM_RY = 33;
const BOT_Y = 150, BOT_RX = 42, BOT_RY = 24;
const DEPTH = 44; // screen px from the rim plane to the inside floor
const ASP = RIM_RY / RIM_RX;
const LINE_LO = 0.72, LINE_HI = 0.83, LINE = 0.775;
/** the water plane at fill level L (0 floor .. 1 rim) */
const surf = (L: number) => { const rx = BOT_RX - 3 + (RIM_RX - 2 - (BOT_RX - 3)) * L; return { cy: RIM_Y + (1 - L) * DEPTH, rx, ry: rx * ASP }; };
const halfW = (y: number) => RIM_RX + (BOT_RX - RIM_RX) * ((y - RIM_Y) / (BOT_Y - RIM_Y));
/** the noodle puck: its top sits at this level when dry */
const PUCK_TOP = 0.34, PUCK_R = 0.74;

// ------------------------------------------------------------------ static background: wall, porthole, counter, cup body
function paintBase(): Uint32Array {
  const b = new Uint32Array(CW * CH);
  const WALL = 62;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    let c: number;
    if (y < WALL) {
      // galley tiles, lit from the porthole on the left
      const row = Math.floor(y / 9), tx = (x + (row % 2) * 8) % 16, ty = y % 9;
      const cell = hash(Math.floor((x + (row % 2) * 8) / 16), row);
      const lit = 0.72 - x / CW * 0.4 - (WALL - y) / WALL * 0.08 + (cell - 0.5) * 0.14 + (ty === 1 ? 0.14 : ty === 8 ? -0.12 : 0) + (tx === 1 ? 0.08 : 0);
      c = tx === 0 || ty === 0 ? mixc(GROUT, TILE[2], 0.3 - x / CW * 0.2) : ramp(TILE, lit, x, y);
    } else {
      // the wooden counter in perspective, planks converging above the wall
      const u = (x - 150) / (y + 40);
      const pl = Math.floor(u * 7 + 50), f = (u * 7 + 50) - pl;
      const pv = hash(pl, 3) * 0.16 - 0.08;
      const grain = Math.sin((y * 1.4 + hash(pl, 5) * 90) * 0.28 + Math.sin(u * 36 + pl) * 2.4) * 0.05;
      const pool = Math.exp(-(((x - 150) / 120) ** 2 + ((y - 120) / 60) ** 2)) * 0.32;
      const lit = 0.36 + pv + grain + pool - x / CW * 0.08;
      c = f < 0.035 ? WOOD[0] : f < 0.07 ? WOOD[1] : ramp(WOOD, lit, x, y);
    }
    b[y * CW + x] = c;
  }
  // the counter's front edge where it meets the wall: a lit lip and a shadow line
  for (let x = 0; x < CW; x++) {
    b[WALL * CW + x] = mixc(WOOD[5], TILE[4], 0.3);
    b[(WALL + 1) * CW + x] = WOOD[4];
    for (let k = 0; k < 4; k++) b[(WALL - 1 - k) * CW + x] = mixc(b[(WALL - 1 - k) * CW + x], TILE[0], 0.5 - k * 0.12);
  }
  // porthole: brass ring, blue sea and sky beyond, a window glint
  const PX = 44, PY = 30, PR = 24;
  for (let y = PY - PR - 3; y <= PY + PR + 3; y++) for (let x = PX - PR - 3; x <= PX + PR + 3; x++) {
    const d = Math.hypot(x + 0.5 - PX, y + 0.5 - PY);
    if (d > PR + 3 || y < 0) continue;
    let c: number;
    if (d > PR - 1) {
      const a = Math.atan2(y - PY, x - PX);
      c = ramp(['#4a3418', '#7a5a26', '#a8843a', '#d4b060', '#f4e0a0'].map(hx), 0.5 - Math.sin(a + 0.8) * 0.4 + (d > PR + 2 ? -0.35 : 0), x, y);
      if (Math.abs(((a + Math.PI) * 8 / Math.PI) % 2 - 1) < 0.12 && d > PR) c = hx('#3a2810');
    } else {
      const hz = PY + 3;
      c = y < hz ? ramp(['#7aa8c4', '#9cc4dc', '#c4e0ee', '#e8f4fa'].map(hx), 0.3 + (hz - y) / 30, x, y)
        : ramp(['#16405a', '#225a78', '#347694', '#5292ae'].map(hx), 0.55 + Math.sin(x * 0.45 + y * 0.8) * 0.18 - (y - hz) / 30, x, y);
      if (y === hz) c = hx('#d8ecf4');
      const g = (x - PX + 8) + (y - PY + 8);
      if (Math.abs(g) < 3 && d < PR - 4) c = mixc(c, hx('#ffffff'), 0.35);
    }
    b[y * CW + x] = c;
  }
  // a shelf with jars, top right
  for (let x = 218; x < 320; x++) { b[26 * CW + x] = WOOD[4]; b[27 * CW + x] = WOOD[2]; b[28 * CW + x] = WOOD[1]; b[29 * CW + x] = mixc(TILE[1], WOOD[0], 0.4); }
  const JAR = [['#c86a3a', '#e8a06a'], ['#5a8a4a', '#8abe70'], ['#d8b040', '#f0d880'], ['#8a5aa0', '#b88ad0'], ['#3a6a9a', '#6a9ac8']];
  for (let i = 0; i < 6; i++) {
    const x0 = 224 + i * 16, [c0, c1] = JAR[i % JAR.length];
    for (let y = 12; y < 26; y++) for (let x = x0; x < x0 + 10; x++) b[y * CW + x] = y < 14 ? hx('#5a4a3a') : y < 15 ? hx('#8a7a6a') : x < x0 + 2 ? hx(c1) : x > x0 + 8 ? mixc(hx(c0), INK, 0.3) : mixc(hx(c0), TILE[3], 0.2);
  }
  // cup shadow on the counter, cast to the lower right away from the porthole
  for (let y = 130; y < 176; y++) for (let x = 100; x < 260; x++) {
    const d = ((x - 170) / 62) ** 2 + ((y - 160) / 14) ** 2;
    if (d < 1) b[y * CW + x] = mixc(b[y * CW + x], WOOD[0], (1 - d) ** 0.7 * 0.6);
  }
  // the foil lid, peeled back and standing up off the far rim
  const LX = CX + 18, LY = RIM_Y - RIM_RY - 2, LRX = 34, LRY = 20;
  for (let y = LY - LRY; y < RIM_Y; y++) for (let x = LX - LRX; x <= LX + LRX; x++) {
    const nx = (x + 0.5 - LX) / LRX, ny = (y + 0.5 - LY) / LRY;
    if (nx * nx + ny * ny > 1) continue;
    const back = RIM_Y - RIM_RY * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - CX) / RIM_RX) ** 2));
    if (y >= back - 1 || Math.abs(x + 0.5 - CX) > RIM_RX - 2) continue;
    const crink = Math.sin(x * 0.9 + y * 0.4) * Math.sin(y * 0.7 - x * 0.2) * 0.12;
    let c = ramp(STEEL, 0.55 - nx * 0.25 - ny * 0.2 + crink, x, y);
    if (nx * nx + ny * ny > 0.86) c = mixc(c, STEEL[1], 0.5);
    // printed label on the lid: red disc, a white wave and "NOODLE" dashes
    const dd = ((x - LX + 4) / 20) ** 2 + ((y - LY + 6) / 12) ** 2;
    if (dd < 1) c = ramp(LABEL, 0.6 - nx * 0.3, x, y);
    if (dd < 1 && Math.abs(y - LY + 6 - Math.sin((x - LX) * 0.3) * 2) < 1) c = PAPER[5];
    if (dd < 0.35 && y === LY - 11 && (x & 1)) c = hx('#ffe070');
    b[y * CW + x] = c;
  }
  // cup body: tapered paper cylinder, lit from the upper left, red label band with a white wave
  for (let y = RIM_Y - 2; y < BOT_Y + BOT_RY + 1; y++) {
    const hw = halfW(Math.min(BOT_Y, y));
    for (let x = Math.floor(CX - hw - 1); x <= Math.ceil(CX + hw + 1); x++) {
      const nx = (x + 0.5 - CX) / hw;
      if (Math.abs(nx) > 1) continue;
      const top = RIM_Y + RIM_RY * Math.sqrt(1 - Math.min(1, ((x + 0.5 - CX) / RIM_RX) ** 2));
      const bot = BOT_Y + BOT_RY * Math.sqrt(1 - nx * nx);
      if (y < top || y > bot) continue;
      const v = (y - top) / (bot - top);
      const lit = 0.52 - nx * 0.42 + Math.sqrt(1 - nx * nx) * 0.26;
      let c: number;
      if (v > 0.2 && v < 0.62) {
        c = ramp(LABEL, lit + 0.05, x, y);
        const wave = 0.43 + Math.sin(nx * 5 + 1.2) * 0.06;
        if (Math.abs(v - wave) < 0.04) c = ramp(PAPER, lit + 0.12, x, y);
        // gold star mark on the front
        const sx = (nx + 0.2) * 1.2, sy = (v - 0.33) * 2.4;
        const ang = Math.atan2(sy, sx), rr = Math.hypot(sx, sy);
        if (rr < 0.075 + Math.cos(ang * 5) * 0.03) c = hx(lit > 0.5 ? '#ffe070' : '#d8a830');
        if (Math.abs(v - 0.21) < 0.012 || Math.abs(v - 0.61) < 0.012) c = hx('#e8c050');
      } else c = ramp(PAPER, lit + (v > 0.9 ? -0.22 : 0) + (v < 0.06 ? 0.1 : 0), x, y);
      // the rolled rim bulges just under the lip
      if (v < 0.035) c = ramp(PAPER, lit + 0.25, x, y);
      if (Math.abs(x + 0.5 - (CX - hw)) < 1 || Math.abs(x + 0.5 - (CX + hw)) < 1 || y > bot - 1) c = mixc(c, INK, 0.6);
      b[y * CW + x] = c;
    }
  }
  return b;
}

// ------------------------------------------------------------------ gooseneck kettle (drawn upright, rotated at runtime)
const KW = 96, KH = 70, KPX = 84, KPY = 30; // pivot = Mori's grip on the handle
const TIP: [number, number] = [5, 22];
function paintKettle(): Uint32Array {
  const k = new Uint32Array(KW * KH);
  const set = (x: number, y: number, c: number) => { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < KW && y < KH) k[y * KW + x] = c; };
  // body: a squat brushed-steel drum with rounded shoulders
  const BX = 58, BT = 22, BB = 66;
  for (let y = BT; y < BB; y++) for (let x = 30; x < 88; x++) {
    const t = (y - BT) / (BB - BT);
    const hw = 20 + Math.sin(Math.min(1, t * 2.6) * Math.PI / 2) * 5 - (t > 0.92 ? (t - 0.92) * 30 : 0);
    const nx = (x + 0.5 - BX) / hw;
    if (Math.abs(nx) > 1) continue;
    const lit = 0.5 - nx * 0.38 + Math.sqrt(1 - nx * nx) * 0.22 - t * 0.08;
    let c = ramp(STEEL, lit, x, y);
    // chrome streaks: a hard window highlight, a dark band, the counter's warm bounce low down
    if (Math.abs(nx + 0.5) < 0.07 && t > 0.12 && t < 0.86) c = STEEL[6];
    if (Math.abs(nx + 0.36) < 0.04 && t > 0.2 && t < 0.8) c = STEEL[5];
    if (Math.abs(nx - 0.42) < 0.06) c = STEEL[1];
    if (t > 0.76) c = mixc(c, WOOD[3], 0.35);
    // a red smear reflected from the cup's label
    if (nx < -0.1 && nx > -0.75 && t > 0.6 && t < 0.72) c = mixc(c, LABEL[3], 0.35);
    if (t < 0.05) c = STEEL[4];
    set(x, y, c);
  }
  // lid and black knob
  for (let x = 42; x < 75; x++) { set(x, BT - 1, STEEL[5]); set(x, BT, STEEL[3]); set(x, BT + 1, STEEL[1]); }
  for (let y = 14; y < 21; y++) for (let x = 53; x < 64; x++) { const r = ((x - 58.5) / 5.5) ** 2 + ((y - 17.5) / 3.5) ** 2; if (r < 1) set(x, y, y < 16 ? hx('#4a4246') : hx('#161214')); }
  // gooseneck spout: out of the body low on the left, a long S-curve up to a fine tip
  const P = [[36, 58], [26, 60], [18, 52], [14, 40], [10, 30], [TIP[0], TIP[1]]];
  for (let i = 0; i < P.length - 1; i++) {
    const [x0, y0] = P[i], [x1, y1] = P[i + 1];
    const n = 24;
    for (let s = 0; s <= n; s++) {
      const f = s / n, x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f;
      const g = (i + f) / (P.length - 1);
      const r = 3.1 - g * 1.9;
      const dx = -(y1 - y0), dy = x1 - x0, dl = Math.hypot(dx, dy) || 1;
      for (let q = -r; q <= r; q += 0.5) {
        const px = x + dx / dl * q, py = y + dy / dl * q;
        set(px, py, ramp(STEEL, 0.62 - q / r * 0.42 + (Math.abs(q / r + 0.4) < 0.18 ? 0.3 : 0), px | 0, py | 0));
      }
    }
  }
  // handle: a black loop on the right; Mori's hand wraps round the top of it
  for (let a = -Math.PI / 2; a <= Math.PI / 2; a += 0.015) {
    const x = 82 + Math.cos(a) * 11, y = 42 + Math.sin(a) * 18;
    for (let r = -2.2; r <= 2.2; r += 0.5) set(x + Math.cos(a) * r, y + Math.sin(a) * r, r < -0.8 ? hx('#4a4246') : hx('#161214'));
  }
  for (let y = 18; y < 42; y++) for (let x = 76; x < 96; x++) {
    const dx = (x - 86) / 9.6, dy = (y - 30) / 11;
    if (dx * dx + dy * dy > 1) continue;
    const fing = x < 80 && (y - 20) % 5 === 0;
    let c = ramp(SKIN, 0.62 - dx * 0.28 - dy * 0.3, x, y);
    if (fing) c = SKIN[1];
    if (x < 78 && y > 22) c = mixc(c, SKIN[1], 0.4);
    set(x, y, c);
  }
  // outline
  const src = k.slice();
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < KW && y < KH && src[y * KW + x] >>> 24;
  for (let y = 0; y < KH; y++) for (let x = 0; x < KW; x++) if (!op(x, y) && (op(x + 1, y) || op(x - 1, y) || op(x, y + 1) || op(x, y - 1))) k[y * KW + x] = INK;
  return k;
}

// ------------------------------------------------------------------ Chunk peeking in (bottom left)
function paintChunk(buf: Uint32Array, t: number, lookX: number, lookY: number, lick: number, joy: number) {
  const cx = 30, cy = 170 + Math.sin(t * 2.2) * 1.5 - joy * 4;
  for (const [ex, dir] of [[-26, -1], [22, 1]] as const) for (let y = -32; y < -8; y++) for (let x = 0; x < 16; x++) {
    const X = cx + ex + dir * x * 0.8, Y = cy + y + x * 0.5;
    if (x > 14 - (y + 32) * 0.4) continue;
    put(buf, X, Y, ramp(MASK, 0.3 + x / 30, X | 0, Y | 0));
  }
  for (let y = -40; y < 16; y++) for (let x = -40; x < 40; x++) {
    const d = (x / 38) ** 2 + ((y + 10) / 30) ** 2;
    if (d > 1) continue;
    const X = cx + x, Y = cy + y;
    let c = ramp(FUR, 0.62 - x / 90 - (y + 10) / 80 + (d > 0.86 ? -0.25 : 0), X, Y | 0);
    if (y < -18 && y > -30 && Math.abs(Math.sin(x * 0.28) * 4 + y + 24) < 0.8) c = FUR[1];
    const md = (x / 20) ** 2 + ((y + 1) / 13) ** 2;
    if (md < 1) c = ramp(MASK, 0.45 - (y + 1) / 30 - x / 70, X, Y | 0);
    if (d > 0.965) c = INK;
    put(buf, X, Y, c);
  }
  for (const ex of [-17, 15]) {
    const ox = Math.max(-3, Math.min(3, (lookX - (cx + ex)) / 30)), oy = Math.max(-2, Math.min(1, (lookY - (cy - 16)) / 40));
    for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) {
      if (x * x + y * y > 42) continue;
      const X = cx + ex + x, Y = cy - 16 + y;
      put(buf, X, Y, x * x + y * y > 34 ? MASK[0] : hx('#1a1210'));
      const px = x - ox, py = y - oy;
      if (px * px + py * py < 18) put(buf, X, Y, hx('#3a2418'));
    }
    put(buf, cx + ex - 2 + ox, cy - 19 + oy, hx('#ffffff')); put(buf, cx + ex - 1 + ox, cy - 19 + oy, hx('#ffffff')); put(buf, cx + ex - 2 + ox, cy - 18 + oy, hx('#ffffff'));
    put(buf, cx + ex + 3 + ox, cy - 13 + oy, hx('#e8e0f0'));
  }
  for (let y = -6; y < -1; y++) for (let x = -5; x <= 5; x++) if (x * x / 30 + (y + 4) ** 2 / 6 < 1) put(buf, cx + x, cy + y, y < -4 ? hx('#3a3034') : hx('#0c0808'));
  const tl = 3 + lick * 8;
  for (let y = 4; y < 4 + tl; y++) for (let x = -4; x <= 4; x++) if (x * x / 16 + ((y - 4) / tl) ** 2 * 0.6 < 1) put(buf, cx + x + 2, cy + y, x < -1 ? hx('#e86a78') : hx('#c84858'));
  // a drool drop when the broth smells good
  if (lick > 0.6) { put(buf, cx + 8, cy + 8 + lick * 3, hx('#d8f0ff')); put(buf, cx + 8, cy + 9 + lick * 3, hx('#a8d0e8')); }
}

// ------------------------------------------------------------------ noodle strand textures (puck-local)
// 0 gap, 1 strand edge, 2 strand body, 3 highlight. Dry: a tight crinkled block; soaked: loose waves.
const TW = 80, TH = 48;
function noodleTex(loose: boolean): Uint8Array {
  const tx = new Uint8Array(TW * TH);
  const n = loose ? 8 : 13;
  for (let r = -1; r < n + 2; r++) {
    const y0 = r * TH / n + (loose ? 0 : (r % 2) * 0.8);
    for (let x = 0; x < TW; x += 0.25) {
      const y = loose ? y0 + Math.sin(x * 0.2 + r * 1.7) * 3.4 + Math.sin(x * 0.07 + r * 0.9) * 3 : y0 + Math.sin(x * 1.05 + r * 2.1) * 1.3;
      const hw = loose ? 1.6 : 1.3;
      for (let q = -hw; q <= hw + 0.01; q += 0.5) {
        const X = x | 0, Y = Math.round(y + q);
        if (X < 0 || Y < 0 || X >= TW || Y >= TH) continue;
        tx[Y * TW + X] = Math.abs(q) > hw - 0.5 ? 1 : q < -0.2 ? 3 : 2;
      }
    }
  }
  return tx;
}
const TEX_DRY = noodleTex(false), TEX_WET = noodleTex(true);
const texAt = (u: number, v: number, soak: number, x: number, y: number) => {
  const X = Math.max(0, Math.min(TW - 1, ((u + 1) / 2 * TW) | 0)), Y = Math.max(0, Math.min(TH - 1, ((v + 1) / 2 * TH) | 0));
  // the block loosens from the top down as it soaks
  const wet = (v + 1) / 2 + Math.sin(u * 7) * 0.06 < soak * 1.6 - 0.2;
  void x; void y;
  return (wet ? TEX_WET : TEX_DRY)[Y * TW + X];
};

// ------------------------------------------------------------------ toppings that float off the puck
interface Flake { u: number; v: number; vu: number; vv: number; kind: number; rot: number }
const FLAKE_COL = [['#e8742a', '#b84a18'], ['#6ab04a', '#3a7a2a'], ['#fbeef0', '#e87a98'], ['#c8a060', '#8a6030']].map(p => p.map(hx));

// ------------------------------------------------------------------ the game

export async function runRamenPour(): Promise<Outcome> {
  const cu = openCloseup();
  const base = paintBase();
  const kettle = paintKettle();
  const hold = new Hold(cu.wrap);
  const buf = cu.buf;
  // water surface heightfield over the cup's disk (-1..1 in both axes)
  const N = 56;
  let hA = new Float32Array(N * N), hB = new Float32Array(N * N);
  const disk = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const u = (i + 0.5) / N * 2 - 1, v = (j + 0.5) / N * 2 - 1; disk[j * N + i] = u * u + v * v < 0.97 ? 1 : 0; }
  const poke = (u: number, v: number, amt: number, r = 1) => {
    const i = Math.round((u + 1) / 2 * N - 0.5), j = Math.round((v + 1) / 2 * N - 0.5);
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const I = i + di, J = j + dj, d = Math.hypot(di, dj) / (r + 0.5);
      if (d < 1 && I > 0 && J > 0 && I < N - 1 && J < N - 1 && disk[J * N + I]) hA[J * N + I] += amt * (1 - d);
    }
  };
  const stepWaves = () => {
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
      const n = j * N + i;
      if (!disk[n]) { hB[n] = 0; continue; }
      // reflect at the cup wall: outside cells mirror the inside so rings bounce back
      const a = disk[n - 1] ? hA[n - 1] : hA[n], b = disk[n + 1] ? hA[n + 1] : hA[n], c = disk[n - N] ? hA[n - N] : hA[n], d = disk[n + N] ? hA[n + N] : hA[n];
      hB[n] = ((a + b + c + d) / 2 - hB[n]) * 0.982;
    }
    const t = hA; hA = hB; hB = t;
  };
  const hAt = (u: number, v: number) => {
    const fx = (u + 1) / 2 * N - 0.5, fy = (v + 1) / 2 * N - 0.5;
    const i = Math.max(0, Math.min(N - 2, Math.floor(fx))), j = Math.max(0, Math.min(N - 2, Math.floor(fy)));
    const ax = Math.max(0, Math.min(1, fx - i)), ay = Math.max(0, Math.min(1, fy - j));
    const n = j * N + i;
    return (hA[n] * (1 - ax) + hA[n + 1] * ax) * (1 - ay) + (hA[n + N] * (1 - ax) + hA[n + N + 1] * ax) * ay;
  };

  let L = 0, tilt = 0.2, flow = 0, broth = 0, soak = 0, spill = 0, released = -1, outcome: Outcome | null = null, joy = 0;
  let pourSfx = 0, started = false, simAcc = 0, impactU = 0, impactV = 0, foam = 0, wet = 0;
  let sid = 0;
  const lastTip: [number, number] = [0, 0];
  const stream: { id: number; x: number; y: number; vx: number; vy: number }[] = [];
  const drops: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  const steam: { x: number; y: number; r: number; life: number; vx: number; max: number }[] = [];
  const bubbles: { u: number; v: number; r: number; life: number }[] = [];
  const flakes: Flake[] = [];
  for (let i = 0; i < 14; i++) {
    const a = hash(i, 7) * Math.PI * 2, r = Math.sqrt(hash(i, 9)) * 0.5;
    flakes.push({ u: Math.cos(a) * r, v: Math.sin(a) * r, vu: 0, vv: 0, kind: i < 5 ? 0 : i < 10 ? 1 : i < 12 ? 2 : 3, rot: hash(i, 11) });
  }
  cu.hint('Hold <span class="key">Space</span> to pour · stop on the dotted line', 4200);
  audio.play('uiOpen', { vol: 0.3 });

  const rot = (lx: number, ly: number, a: number, px0: number, py0: number): [number, number] => {
    const c = Math.cos(a), s = Math.sin(a);
    return [px0 + lx * c - ly * s, py0 + lx * s + ly * c];
  };
  const KX = 222, KY = 20, TMAX = 0.86, TREST = 0.18;

  const result = await new Promise<Outcome>(done => {
    loop((dt, t) => {
      if (cu.closed) { done(outcome ?? 'under'); return false; }
      // ---------------------------------------------------------- input and physics
      if (!outcome) {
        const want = hold.down && t > 0.7 ? TMAX : TREST;
        tilt += (want - tilt) * Math.min(1, dt * (want > tilt ? 3.2 : 4.6));
        if (hold.down) { started = true; released = -1; } else if (started && released < 0) released = t;
        flow = Math.max(0, Math.min(1, (tilt - 0.42) / (TMAX - 0.48)));
        if (L >= 1) { L = 1; outcome = 'over'; }
        else if (released >= 0 && t - released > 1.1 && L > 0.08 && flow < 0.01) outcome = L < LINE_LO ? 'under' : L > LINE_HI ? 'over' : 'perfect';
        if (outcome) {
          audio.play(outcome === 'perfect' ? 'star' : 'wrong', { vol: 0.5 });
          if (outcome === 'perfect') { joy = 1; cu.flash(); }
          cu.result(outcome === 'perfect' ? 'PERFECT!' : outcome === 'over' ? 'SOUP?!' : 'CRUNCHY...', outcome === 'perfect' ? 'right on the line' : outcome === 'over' ? 'way past the line' : 'not enough water', outcome !== 'perfect').then(() => cu.close().then(() => done(outcome!)));
        }
      } else {
        tilt += (0 - tilt) * Math.min(1, dt * 4);
        flow = Math.max(0, Math.min(1, (tilt - 0.42) / (TMAX - 0.48)));
        if (outcome === 'over') spill = Math.min(1, spill + dt * 0.8);
      }
      if (flow > 0.02) {
        pourSfx -= dt;
        if (pourSfx <= 0) { pourSfx = 0.07; audio.play('bubble', { vol: 0.1 + flow * 0.16, pitch: 0.5 + L * 1.1 + Math.random() * 0.08 }); }
      }
      if (L > 0.05) { broth = Math.min(1, broth + dt * (0.05 + flow * 0.22)); soak = Math.min(1, soak + dt * 0.16); }
      joy = Math.max(0, joy - dt * 0.4);
      foam = Math.max(0, foam - dt * 1.6);
      // the stream: a ribbon of particles from the spout tip
      const [sx, sy] = rot(TIP[0] - KPX, TIP[1] - KPY, -tilt, KX, KY);
      const S = surf(L);
      const nE = Math.max(1, Math.round(dt * 180));
      if (flow > 0.01) for (let i = 0; i < nE; i++) {
        const sp = 10 + flow * 26;
        const f = i / nE, ex = lastTip[0] + (sx - lastTip[0]) * f, ey = lastTip[1] + (sy - lastTip[1]) * f;
        stream.push({ id: sid++, x: ex - 1, y: ey + 1, vx: -sp * 0.55, vy: sp * 0.3 + (1 - f) * dt * 400 * 0.5 });
      }
      lastTip[0] = sx; lastTip[1] = sy;
      let hitX = -1;
      for (let i = stream.length - 1; i >= 0; i--) {
        const p = stream[i];
        p.vy += 400 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        const u = (p.x - CX) / S.rx;
        // floor level when dry: the water lands on the puck top
        const land = L < PUCK_TOP ? surf(PUCK_TOP).cy : S.cy;
        if (Math.abs(u) < 0.95 && p.y >= land) {
          impactU = u; impactV = 0.05; hitX = p.x;
          if (L > 0.02) poke(u, 0.05, -0.1 - flow * 0.08, 1);
          foam = Math.min(1, foam + 0.05);
          wet = Math.min(1, wet + 0.02);
          L = Math.min(1.001, L + 0.0014 * (0.6 + flow * 0.4));
          if (Math.random() < 0.3) drops.push({ x: p.x + (Math.random() - 0.5) * 3, y: land - 1, vx: (Math.random() - 0.5) * 50, vy: -24 - Math.random() * 46, life: 0.45 });
          if (Math.random() < 0.12) bubbles.push({ u: u + (Math.random() - 0.5) * 0.3, v: 0.05 + (Math.random() - 0.5) * 0.4, r: 1 + Math.random() * 1.5, life: 0.6 + Math.random() * 0.8 });
          if (Math.random() < 0.08) steam.push({ x: p.x, y: land - 2, r: 2, life: 1.6, vx: (Math.random() - 0.5) * 6, max: 1.6 });
          stream.splice(i, 1);
        } else if (p.y > 178) stream.splice(i, 1);
      }
      for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.vy += 300 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; if (d.life <= 0) drops.splice(i, 1); }
      for (let i = bubbles.length - 1; i >= 0; i--) { const b2 = bubbles[i]; b2.life -= dt; b2.u += (b2.u - impactU) * dt * 0.8; b2.v += (b2.v - impactV) * dt * 0.8; if (b2.life <= 0) { if (L > 0.1) poke(b2.u, b2.v, 0.08); bubbles.splice(i, 1); } }
      if (L > 0.04 && Math.random() < dt * (1.5 + L * 4 + broth * 2)) steam.push({ x: CX - S.rx * 0.8 + Math.random() * S.rx * 1.6, y: S.cy - 2, r: 2 + Math.random() * 2, life: 3, vx: (Math.random() - 0.5) * 5, max: 3 });
      for (let i = steam.length - 1; i >= 0; i--) { const s2 = steam[i]; s2.life -= dt; s2.y -= dt * 15; s2.x += (s2.vx + Math.sin(s2.y * 0.1 + t * 1.3 + s2.max) * 7) * dt; s2.r += dt * 3; if (s2.life <= 0) steam.splice(i, 1); }
      // noodles bob and nudge the surface once they float; the flakes ride the ripples
      if (L > 0.3 && Math.random() < dt * 4) poke((Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9, 0.03);
      const floating = L > PUCK_TOP + 0.04;
      for (const f of flakes) {
        if (!floating) continue;
        const gx = hAt(f.u + 0.05, f.v) - hAt(f.u - 0.05, f.v), gy = hAt(f.u, f.v + 0.05) - hAt(f.u, f.v - 0.05);
        const pushU = (f.u - impactU), pushV = (f.v - impactV), pd = Math.hypot(pushU, pushV) + 0.05;
        f.vu += (-gx * 2.4 + pushU / pd * flow * 0.35 + Math.sin(t * 0.7 + f.rot * 6) * 0.03) * dt;
        f.vv += (-gy * 2.4 + pushV / pd * flow * 0.35 + Math.cos(t * 0.6 + f.rot * 5) * 0.03) * dt;
        f.vu *= 1 - dt * 1.2; f.vv *= 1 - dt * 1.2;
        f.u += f.vu * dt; f.v += f.vv * dt;
        const r = Math.hypot(f.u, f.v);
        if (r > 0.86) { f.u *= 0.86 / r; f.v *= 0.86 / r; f.vu *= -0.4; f.vv *= -0.4; }
        f.rot += dt * (f.vu - f.vv) * 2;
      }
      simAcc += dt;
      while (simAcc > 1 / 60) { stepWaves(); simAcc -= 1 / 60; }

      // ---------------------------------------------------------- draw
      buf.set(base);
      // spilled broth on the counter (overflow)
      if (spill > 0) for (let y = 150; y < 178; y++) for (let x = 80; x < 260; x++) {
        const d = ((x - 160) / (78 * spill + 10)) ** 2 + ((y - 168) / (6 + 6 * spill)) ** 2 + (hash(x >> 2, y >> 1) - 0.5) * 0.3;
        if (d < 1) blend(buf, x, y, d > 0.8 ? hx('#f0d090') : hx('#c89a4a'), 0.6);
      }
      // inside the cup
      const Pk = surf(PUCK_TOP);
      const puckLevel = floating ? Math.max(PUCK_TOP, L - 0.02 - (1 - soak) * 0.08) : PUCK_TOP;
      const PT = surf(puckLevel);
      const spread = 1 + soak * 0.22;
      for (let y = RIM_Y - RIM_RY; y <= RIM_Y + RIM_RY; y++) for (let x = CX - RIM_RX; x <= CX + RIM_RX; x++) {
        const rn = ((x + 0.5 - CX) / RIM_RX) ** 2 + ((y + 0.5 - RIM_Y) / RIM_RY) ** 2;
        if (rn > 1) continue;
        const wu = (x + 0.5 - CX) / S.rx, wv = (y + 0.5 - S.cy) / S.ry;
        const wr = wu * wu + wv * wv;
        const inW = wr < 1 && L > 0.012;
        // noodle puck top (a wavy block of strands), where it shows through the opening
        const nu = (x + 0.5 - CX) / (PT.rx * PUCK_R * spread), nv = (y + 0.5 - PT.cy) / (PT.ry * PUCK_R * spread);
        const inN = nu * nu + nv * nv < 1;
        // puck side band below its top (visible while it sits dry on the floor)
        const pu = (x + 0.5 - CX) / (Pk.rx * PUCK_R);
        const sideTop = PT.cy + PT.ry * PUCK_R * Math.sqrt(Math.max(0, 1 - pu * pu));
        const inSide = !floating && Math.abs(pu) < 1 && y >= sideTop && y < sideTop + 14;
        let c: number;
        if (inW) {
          // water: normal from the heightfield, broth tint swirling in from the powder, noodles below
          const e = 0.045;
          const h0 = hAt(wu, wv), gx = hAt(wu + e, wv) - hAt(wu - e, wv), gy = hAt(wu, wv + e) - hAt(wu, wv - e);
          const swirl = Math.sin(Math.atan2(wv, wu) * 2 + Math.hypot(wu, wv) * 5 - t * 0.8) * 0.5 + 0.5;
          const bk = Math.max(0, Math.min(1, broth * 1.25 - (1 - swirl) * 0.35 * (1 - broth)));
          const clear = mixc(hx('#c8ccbc'), hx('#98a49c'), 0.35 - wv * 0.35);
          const gold = mixc(hx('#d8943a'), hx('#9a5a20'), 0.4 - wv * 0.35);
          let w = mixc(clear, gold, bk);
          // what's under the surface: the puck (refracted: shifted by the slope) or the cup floor
          const ru = wu + gx * 0.35, rv = wv + gy * 0.35;
          const qu = (CX + ru * S.rx - CX) / (PT.rx * PUCK_R * spread), qv = (S.cy + rv * S.ry - PT.cy) / (PT.ry * PUCK_R * spread);
          const depthOver = Math.max(0, L - puckLevel);
          if (qu * qu + qv * qv < 1) {
            // soaked strands go pale and glossy; each has a dark edge so the tangle reads through the broth
            const k = texAt(qu, qv, soak, x, y);
            const al = Math.max(0.5, 0.97 - depthOver * 3 - bk * 0.12);
            const cream = hx('#fff2c4');
            if (k === 0) w = mixc(w, mixc(NOODLE[0], gold, 0.5), al * 0.55);
            else if (k === 1) w = mixc(w, mixc(NOODLE[1], gold, 0.25), al);
            else if (k === 2) w = mixc(w, mixc(NOODLE[3], cream, soak * 0.4), al);
            else w = mixc(w, mixc(NOODLE[4], cream, 0.3 + soak * 0.4), al);
          } else w = mixc(w, INNER[1], Math.max(0, 0.3 - depthOver));
          // lighting: window light from the upper left, a Fresnel sheen toward the back wall
          const lit = -gx * 2.6 - gy * 1.8 + h0 * 0.15;
          w = lit > 0 ? mixc(w, hx('#fff6e0'), Math.min(0.55, lit * 0.9)) : mixc(w, hx('#4a2c14'), Math.min(0.45, -lit * 0.8));
          if (wv < -0.45) w = mixc(w, INNER[4], (-wv - 0.45) * 0.5);
          // the porthole reflected on the surface: a bright oval on the left, wobbling with the ripples
          const rx0 = wu + 0.52 + gx * 3, ry0 = wv + 0.12 + gy * 3;
          if (rx0 * rx0 / 0.05 + ry0 * ry0 / 0.08 < 1 && (y & 1) === 0) w = mixc(w, hx('#eaf6fc'), 0.4);
          if (lit > 0.5 && hash(x, y, Math.floor(t * 10)) < 0.4) w = hx('#ffffff');
          // meniscus: the water climbs the wall in a bright line
          if (wr > 0.9) w = mixc(w, hx('#f8f4ea'), wr > 0.96 ? 0.7 : 0.35);
          // foam where the stream drums in
          const fu = (wu - impactU) * 1.2, fv = (wv - impactV) * 0.9, fd = Math.hypot(fu, fv);
          const fr = 0.08 + flow * 0.2 + foam * 0.1;
          if (fd < fr && hash(x, y, Math.floor(t * 14)) < 1.2 - fd / fr) w = mixc(w, hx('#fbfaf4'), 0.85);
          c = w;
        } else if (!floating && (inN || inSide) && (!inW)) {
          // the dry puck with its toppings and a little heap of seasoning powder
          if (inN) {
            const k = texAt(nu, nv, 0, x, y);
            const lit = 0.6 - nv * 0.25 - nu * 0.18 - wet * 0.1;
            c = k === 0 ? NOODLE[0] : k === 1 ? ramp(NOODLE, lit - 0.35, x, y) : k === 2 ? ramp(NOODLE, lit, x, y) : ramp(NOODLE, lit + 0.3, x, y);
            if (Math.abs(nu - 0.25) < 0.22 && Math.abs(nv + 0.15) < 0.32 && L < 0.05 && hash(x, y) < 0.75) c = hx(hash(x, y, 2) < 0.6 ? '#d0a060' : '#a87438');
          } else {
            const k = Math.sin(pu * 9 + (y - sideTop) * 0.9);
            c = ramp(NOODLE, 0.42 - pu * 0.3 + k * 0.12 - (y - sideTop) / 30, x, y);
          }
        } else {
          // inner wall: shaded paper, darker deeper down; the printed fill line on the far side
          const depth = (y - (RIM_Y - RIM_RY)) / (RIM_RY * 2 + DEPTH);
          const side = Math.abs((x + 0.5 - CX) / RIM_RX);
          c = ramp(INNER, 0.82 - depth * 1.1 - side * 0.18 + (x < CX ? 0.08 : -0.05), x, y);
          // a wet band on the wall just above the water once it's been splashed
          if (L > 0.02 && y < S.cy && y > S.cy - S.ry - 4 && wet > 0.2) c = mixc(c, INNER[1], 0.35);
          const F = surf(LINE);
          const fu = (x + 0.5 - CX) / F.rx;
          if (Math.abs(fu) < 0.98) {
            const fy = F.cy - F.ry * Math.sqrt(1 - fu * fu);
            if (Math.abs(y + 0.5 - fy) < 0.6 && (x >> 1) % 2 === 0) c = hx('#b8341e');
            if (Math.abs(y + 0.5 - (fy - 1)) < 0.6 && (x >> 1) % 2 === 0) c = mixc(c, hx('#ffffff'), 0.25);
          }
        }
        // the rolled rim lip: bright on top, a darker inner edge
        if (rn > 0.86) c = rn > 0.965 ? PAPER[1] : rn > 0.93 ? (y > RIM_Y ? PAPER[5] : PAPER[4]) : mixc(c, PAPER[0], 0.35);
        put(buf, x, y, c);
      }
      // toppings: floating flakes (carrot, spring onion, fish-cake swirls, egg)
      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i];
        const lvl = floating ? L : PUCK_TOP;
        const P2 = surf(lvl), sc = floating ? 1 : PUCK_R;
        const fx = CX + f.u * P2.rx * sc * 0.9, fy = (floating ? P2.cy : PT.cy) + f.v * P2.ry * sc * 0.9 + (floating ? hAt(f.u, f.v) * 1.5 : 0);
        const [c0, c1] = FLAKE_COL[f.kind];
        const ca = Math.cos(f.rot * 6), sa = Math.sin(f.rot * 6);
        const sz = f.kind === 2 ? 2.2 : f.kind === 3 ? 1.8 : 1.6;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const lx = dx * ca + dy * sa, ly = (-dx * sa + dy * ca) * 1.6;
          const d = f.kind === 1 ? Math.max(Math.abs(lx) / (sz * 1.4), Math.abs(ly) / (sz * 0.8)) : Math.hypot(lx, ly) / sz;
          if (d > 1) continue;
          const X = fx + dx, Y = fy + dy * 0.5;
          const rn = ((X + 0.5 - CX) / RIM_RX) ** 2 + ((Y + 0.5 - RIM_Y) / RIM_RY) ** 2;
          if (rn > 0.84) continue;
          let col = d > 0.7 ? c1 : c0;
          if (f.kind === 2 && Math.abs(Math.hypot(lx, ly) - sz * 0.5) < 0.5) col = c1; // pink swirl
          put(buf, X, Y, col);
        }
      }
      // bubbles popping near the impact
      for (const b2 of bubbles) {
        if (L < 0.05) continue;
        const bx = CX + b2.u * S.rx, by = S.cy + b2.v * S.ry;
        const r = b2.r * (1 + (1 - b2.life) * 0.5);
        for (let a = 0; a < 6.3; a += 0.7) put(buf, bx + Math.cos(a) * r, by + Math.sin(a) * r * 0.6, hx('#f4fbff'));
      }
      // spill running down the front of the cup
      if (spill > 0) for (let k = 0; k < 7; k++) {
        const x = CX - 36 + k * 12 + Math.sin(k * 2.1) * 4;
        const len = spill * (46 + hash(k, 1) * 30);
        const top = RIM_Y + RIM_RY * Math.sqrt(Math.max(0, 1 - ((x - CX) / RIM_RX) ** 2)) - 1;
        for (let y = top; y < top + len; y++) { blend(buf, x, y, hx('#e8b868'), 0.7); blend(buf, x + 1, y, hx('#fbe6b0'), 0.4); }
      }
      // splash drops
      for (const d of drops) { put(buf, d.x, d.y, hx('#f2fafc')); blend(buf, d.x, d.y + 1, hx('#a8ccd8'), 0.6); }
      // the stream: consecutive particles joined into a glassy ribbon (bright core, blue edges)
      const w = 0.6 + flow * 1.4;
      for (let i = 1; i < stream.length; i++) {
        const a = stream[i - 1], b2 = stream[i];
        if (b2.id !== a.id + 1) continue;
        const n = Math.max(1, Math.ceil(Math.hypot(b2.x - a.x, b2.y - a.y)));
        for (let s = 0; s <= n; s++) {
          const x = a.x + (b2.x - a.x) * s / n, y = a.y + (b2.y - a.y) * s / n;
          for (let q = -w; q <= w + 0.01; q += 0.5) {
            const qq = Math.abs(q) / (w + 0.5);
            put(buf, x + q, y, qq < 0.35 ? hx('#ffffff') : q < 0 ? hx('#d4ecf4') : hx('#8ec0d4'));
          }
        }
      }
      if (hitX >= 0 && flow > 0.05) for (let k = 0; k < 3; k++) put(buf, hitX + (Math.random() - 0.5) * 6, (L < PUCK_TOP ? PT.cy : S.cy) - Math.random() * 3, hx('#ffffff'));
      // steam: soft dithered puffs
      for (const s2 of steam) {
        const a = Math.min(1, s2.life / 1.2) * Math.min(1, (s2.max - s2.life) * 0.8) * 0.2;
        for (let y = -s2.r; y <= s2.r; y++) for (let x = -s2.r; x <= s2.r; x++) {
          const d = (x * x + y * y) / (s2.r * s2.r);
          if (d > 1) continue;
          if (dith(s2.x + x | 0, s2.y + y | 0) > 0.85 - d * 0.5) continue;
          blend(buf, s2.x + x, s2.y + y, hx('#fbf8f2'), a * (1 - d * 0.5));
        }
      }
      // the kettle in Mori's hand (rotated sprite, nearest-neighbour), his sleeve out to the edge
      const ca = Math.cos(tilt), sa = Math.sin(tilt);
      for (let y = 0; y < CH; y++) for (let x = 100; x < CW; x++) {
        const dx = x + 0.5 - KX, dy = y + 0.5 - KY;
        const lx = dx * ca - dy * sa + KPX, ly = dx * sa + dy * ca + KPY;
        if (lx < 0 || ly < 0 || lx >= KW || ly >= KH) continue;
        const v = kettle[(ly | 0) * KW + (lx | 0)];
        if (v >>> 24) buf[y * CW + x] = v;
      }
      const [hx0, hy0] = rot(92 - KPX, 26 - KPY, -tilt, KX, KY);
      for (let x = Math.round(hx0 - 1); x < CW; x++) {
        const k = (x - hx0) / (CW - hx0);
        const cy = hy0 - 4 - k * 36, r = 8 + k * 6;
        for (let y = Math.round(cy - r); y <= Math.round(cy + r); y++) {
          const e = Math.abs(y - cy) > r - 1 || x === Math.round(hx0 - 1);
          let c = e ? INK : ramp(SLEEVE, 0.62 - (y - cy) / r * 0.4 + Math.sin(x * 0.4 + y * 0.2) * 0.04, x, y);
          if (!e && x < hx0 + 4) c = ramp(SLEEVE, 0.2, x, y); // cuff
          put(buf, x, y, c);
        }
      }
      // Chunk, drooling at the steam
      paintChunk(buf, t, hitX >= 0 ? hitX : CX, S.cy, Math.max(0, Math.sin(t * 5)) * (broth > 0.3 ? 1 : 0.3), joy);
      // warm vignette
      for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
        const d = ((x - CW / 2) / (CW * 0.62)) ** 2 + ((y - CH / 2) / (CH * 0.7)) ** 2;
        if (d > 0.5) { const i = y * CW + x, v = buf[i], k = Math.min(0.55, (d - 0.5) * 0.85); buf[i] = rgb(R(v) * (1 - k), G(v) * (1 - k * 1.05), B(v) * (1 - k * 1.12)); }
      }
      (window as unknown as { __ramen?: string }).__ramen = `${L.toFixed(3)} t${t.toFixed(1)} n${stream.length} s${steam.length}`;
      cu.present();
      return true;
    });
  });
  hold.dispose();
  return result;
}

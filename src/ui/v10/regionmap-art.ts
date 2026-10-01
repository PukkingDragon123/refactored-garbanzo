// V10 Region Map painter: the hand-drawn expedition map as pixel art. The base (always visible) is
// parchment with the region's coastline inked in, ripple lines in the sea, old-map decorations (a
// compass rose, a sea serpent, a cartouche, folds and stains); the interior is left blank. The terrain
// layer (watercolour washes, forest, peaks, marsh, the strange valleys, rivers) is painted once for
// the whole region and only shown through the explored mask. Glyphs for pins and finds are tiny
// hand-inked pixel drawings. Everything is generated at runtime at MAP_W x MAP_H map pixels.

import { PixelBuffer } from '../../art/pixel';
import { C, hex, mix, shade } from '../../art/color';
import { fbm2, hash2, bayer, clamp } from '../../core/math';
import { MAP_W, MAP_H, COAST, ISLETS, ZONES10, RIVERS } from '../../game/v10/atlas';
import type { Zone10 } from '../../game/v10/atlas';

export const W = MAP_W, H = MAP_H;

export const INK = hex('#3a2614'), INK2 = hex('#5e4026'), INK3 = hex('#8a6c48'), INK_RED = hex('#a8382a'), INK_BLUE = hex('#2e5a78');
const PAPER = [hex('#cdb37c'), hex('#dcc594'), hex('#e8d5a6'), hex('#f0e0b6'), hex('#f6ead0')];
const SEA = [hex('#a9b29a'), hex('#b9bea4'), hex('#c7c8ad'), hex('#d3d1b5')];

// ------------------------------------------------------------------ geometry
let landM: Uint8Array | null = null;
let distM: Float32Array | null = null;

/** 1 where there is land (the coastline polygon, roughened, plus the islets) */
export function landMask(): Uint8Array {
  if (landM) return landM;
  const poly = new PixelBuffer(W, H);
  poly.poly(COAST.flat(), 0xffffffff);
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (fbm2(x * 0.028, y * 0.028, 3, 11) - 0.5) * 18 + (fbm2(x * 0.11, y * 0.11, 2, 4) - 0.5) * 4;
    const dy = (fbm2(x * 0.028 + 7.3, y * 0.028 + 3.1, 3, 12) - 0.5) * 18 + (fbm2(x * 0.11 + 2, y * 0.11 + 9, 2, 5) - 0.5) * 4;
    const sx = Math.round(x + dx), sy = Math.round(y + dy);
    let on = sx >= 0 && sy >= 0 && sx < W && sy < H && poly.data[sy * W + sx] !== 0;
    if (!on) for (const [cx, cy, r] of ISLETS) { const d = Math.hypot(x + dx * 0.4 - cx, (y + dy * 0.4 - cy) * 1.15); if (d < r) { on = true; break; } }
    if (on) m[y * W + x] = 1;
  }
  landM = m;
  return m;
}

/** distance (map px) from each pixel to the nearest pixel of the other kind (land <-> sea) */
export function coastDist(): Float32Array {
  if (distM) return distM;
  const m = landMask();
  const d = new Float32Array(W * H).fill(1e6);
  // seed: pixels next to the other kind
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, v = m[i];
    if ((x > 0 && m[i - 1] !== v) || (x < W - 1 && m[i + 1] !== v) || (y > 0 && m[i - W] !== v) || (y < H - 1 && m[i + W] !== v)) d[i] = 1;
  }
  // two-pass chamfer (3-4), per side
  const A = 1, B = 1.414;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, v = m[i];
    let b = d[i];
    if (x > 0 && m[i - 1] === v) b = Math.min(b, d[i - 1] + A);
    if (y > 0 && m[i - W] === v) b = Math.min(b, d[i - W] + A);
    if (x > 0 && y > 0 && m[i - W - 1] === v) b = Math.min(b, d[i - W - 1] + B);
    if (x < W - 1 && y > 0 && m[i - W + 1] === v) b = Math.min(b, d[i - W + 1] + B);
    d[i] = b;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x, v = m[i];
    let b = d[i];
    if (x < W - 1 && m[i + 1] === v) b = Math.min(b, d[i + 1] + A);
    if (y < H - 1 && m[i + W] === v) b = Math.min(b, d[i + W] + A);
    if (x < W - 1 && y < H - 1 && m[i + W + 1] === v) b = Math.min(b, d[i + W + 1] + B);
    if (x > 0 && y < H - 1 && m[i + W - 1] === v) b = Math.min(b, d[i + W - 1] + B);
    d[i] = b;
  }
  distM = d;
  return d;
}

const dith = (x: number, y: number, ramp: C[], t: number) => ramp[clamp(Math.floor(t * (ramp.length - 1) + bayer(x, y)), 0, ramp.length - 1)];

// ------------------------------------------------------------------ the base: parchment, sea, coast
let baseBuf: PixelBuffer | null = null;
export function paintBase(): PixelBuffer {
  if (baseBuf) return baseBuf;
  const b = new PixelBuffer(W, H);
  const m = landMask(), d = coastDist();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const n = fbm2(x * 0.045, y * 0.045, 3, 5), st = fbm2(x * 0.011, y * 0.011, 3, 9);
    const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
    const burn = clamp(1 - edge / 22) ** 2 + (edge < 6 ? 0.3 : 0);
    let c: C;
    if (m[i]) {
      const t = clamp(0.7 + (n - 0.5) * 0.7 - burn * 0.8 - (st > 0.68 ? 0.18 : 0));
      c = dith(x, y, PAPER, t);
      // the coastline in ink, a second softer line inside it
      const dd = d[i];
      if (dd <= 1.2) c = INK;
      else if (dd <= 2.4 && bayer(x, y) < 0.5) c = INK2;
    } else {
      const t = clamp(0.62 + (n - 0.5) * 0.6 - burn * 0.8 - (st > 0.7 ? 0.15 : 0));
      c = dith(x, y, SEA, t);
      // ripple lines following the coast, broken up further out
      const dd = d[i];
      for (const [r, k] of [[4, 0.95], [8, 0.8], [13, 0.55], [19, 0.32]] as const) {
        if (Math.abs(dd - r) < 0.6 && hash2(Math.floor(x / 5), Math.floor(y / 5), r) < k) c = r < 9 ? INK3 : mix(INK3, c, 0.45);
      }
    }
    // folds of the paper (a cross of creases) and the odd ink fleck
    const fx = Math.abs(x - Math.round(W / 3)) <= 0 || Math.abs(x - Math.round((2 * W) / 3)) <= 0, fy = Math.abs(y - Math.round(H / 2)) <= 0;
    if (fx || fy) c = shade(c, -0.07);
    else if (Math.abs(x - Math.round(W / 3)) === 1 || Math.abs(x - Math.round((2 * W) / 3)) === 1 || Math.abs(y - Math.round(H / 2)) === 1) c = shade(c, 0.05);
    if (hash2(x, y, 77) > 0.9994) c = INK2;
    b.data[i] = c;
  }
  waves(b);
  compass(b, 872, 560);
  serpent(b, 34, 598);
  border(b);
  baseBuf = b;
  return b;
}

/** little wave strokes scattered over the open sea */
function waves(b: PixelBuffer) {
  const d = coastDist(), m = landMask();
  for (let y = 10; y < H - 10; y += 13) for (let x = 10; x < W - 10; x += 17) {
    const jx = x + Math.floor(hash2(x, y, 3) * 10), jy = y + Math.floor(hash2(x, y, 4) * 8);
    const i = jy * W + jx;
    if (m[i] || d[i] < 26 || hash2(x, y, 5) < 0.55) continue;
    for (let k = 0; k < 7; k++) b.set(jx + k, jy - Math.round(Math.sin((k / 6) * Math.PI) * 1.5), INK3);
    for (let k = 0; k < 5; k++) b.set(jx + 6 + k, jy - Math.round(Math.sin((k / 4) * Math.PI) * 1.2), INK3);
  }
}

/** an inked compass rose with a red north point */
function compass(b: PixelBuffer, cx: number, cy: number) {
  const R = 28;
  for (let a = 0; a < 360; a += 1) {
    const r = a % 2 ? R : R - 1;
    b.set(cx + Math.cos((a * Math.PI) / 180) * r, cy + Math.sin((a * Math.PI) / 180) * r, INK2);
    if (a % 10 === 0) b.set(cx + Math.cos((a * Math.PI) / 180) * (R - 3), cy + Math.sin((a * Math.PI) / 180) * (R - 3), INK2);
  }
  const point = (ang: number, len: number, wid: number, fill: C) => {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let t = 0; t <= len; t++) {
      const w = wid * (1 - t / len);
      for (let s = -w; s <= w; s += 0.5) {
        const x = cx + ca * t - sa * s, y = cy + sa * t + ca * s;
        b.set(x, y, Math.abs(s) > w - 0.8 ? INK : s < 0 ? fill : shade(fill, -0.2));
      }
    }
  };
  for (let k = 0; k < 4; k++) point(-Math.PI / 4 + (k * Math.PI) / 2, 15, 3, hex('#d8c08c'));
  point(Math.PI / 2, 24, 4, hex('#e8d5a6'));
  point(0, 24, 4, hex('#e8d5a6'));
  point(Math.PI, 24, 4, hex('#e8d5a6'));
  point(-Math.PI / 2, 25, 4, INK_RED);
  b.disc(cx, cy, 2, INK);
  b.set(cx, cy, hex('#f2e4bc'));
}

/** a sea serpent sketched in the south-west sea, as old maps have */
function serpent(b: PixelBuffer, x0: number, y0: number) {
  const pts: [number, number][] = [];
  for (let i = 0; i < 70; i++) pts.push([x0 + i * 1.6, y0 + Math.sin(i * 0.22) * 6]);
  pts.forEach(([x, y], i) => {
    const above = Math.sin(i * 0.22) < -0.15 || i > 60;
    if (!above) { if (i % 3 === 0) b.set(x, y + 4, INK3); return; }
    const r = i > 60 ? 2.6 : 2;
    for (let s = -r; s <= r; s += 0.5) b.set(x, y + s, Math.abs(s) > r - 0.6 ? INK : i % 4 === 0 ? hex('#7a8a6a') : hex('#a4ae8a'));
  });
  const [hx, hy] = pts[pts.length - 1];
  b.disc(hx + 3, hy - 1, 3, hex('#a4ae8a'));
  b.set(hx + 4, hy - 2, INK);
  for (let k = 0; k < 4; k++) b.set(hx + 6 + k, hy + (k % 2), INK_RED);
  for (let k = 0; k < 3; k++) b.set(hx - 2 - k * 2, hy - 4 - k, INK2);
}

/** a thin double ink border inside the burnt edge */
function border(b: PixelBuffer) {
  for (let x = 10; x < W - 10; x++) { if (bayer(x, 0) < 0.85) { b.set(x, 10, INK2); b.set(x, H - 11, INK2); } b.set(x, 13, INK3); b.set(x, H - 14, INK3); }
  for (let y = 10; y < H - 10; y++) { if (bayer(0, y) < 0.85) { b.set(10, y, INK2); b.set(W - 11, y, INK2); } b.set(13, y, INK3); b.set(W - 14, y, INK3); }
}

// ------------------------------------------------------------------ the terrain (shown where explored)
const ZCOL: Record<Zone10, C[]> = {
  forest: [hex('#8fa86a'), hex('#a3b87a'), hex('#b6c68a')],
  plateau: [hex('#b49a6a'), hex('#c4aa78'), hex('#d0b886')],
  swamp: [hex('#7f9a86'), hex('#93ab92'), hex('#a8bc9e')],
  garden: [hex('#b8be6a'), hex('#c8cc7c'), hex('#d4d68a')],
  glow: [hex('#4c6a76'), hex('#5e8088'), hex('#76989a')],
  thermal: [hex('#c88a52'), hex('#d8a062'), hex('#e4b878')],
  gorge: [hex('#a87a5a'), hex('#bc9070'), hex('#cca482')],
  sink: [hex('#4a4a3a'), hex('#5c5a46'), hex('#706c54')],
  terraces: [hex('#a8a080'), hex('#b8b090'), hex('#c8c0a0')],
  cave: [hex('#8c8a7a'), hex('#9c9a88'), hex('#acaa96')],
  dunes: [hex('#e2c88a'), hex('#e8d29a'), hex('#efdcaa')],
  peaks: [hex('#a49a86'), hex('#b4ac98'), hex('#c4bca8')],
};
const LANDWASH = [hex('#c8c592'), hex('#d4cf9e'), hex('#ddd6a8')];

let detailBuf: PixelBuffer | null = null;
export function paintDetail(): PixelBuffer {
  if (detailBuf) return detailBuf;
  const b = new PixelBuffer(W, H);
  const m = landMask(), d = coastDist();
  const zk = (x: number, y: number, z: (typeof ZONES10)[number]) => {
    const [, cx, cy, rx, ry] = z;
    return 1 - ((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2 + (fbm2(x * 0.06, y * 0.06, 2, cx) - 0.5) * 0.6;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!m[i]) {
      // the sea near the coast gets a blue wash (only seen where explored)
      const dd = d[i];
      if (dd < 40) b.data[i] = dith(x, y, [hex('#8ea8a8'), hex('#9cb4b0'), hex('#aec0b6'), hex('#bccab8')], clamp(dd / 40));
      continue;
    }
    const n = fbm2(x * 0.05, y * 0.05, 3, 21);
    let c = dith(x, y, LANDWASH, clamp(0.4 + (n - 0.5)));
    let best = 0, bz: Zone10 | null = null;
    for (const z of ZONES10) { const k = zk(x, y, z); if (k > best) { best = k; bz = z[0]; } }
    if (bz) c = dith(x, y, ZCOL[bz], clamp(best * 1.6 + (n - 0.5) * 0.4));
    const dd = d[i];
    if (dd <= 4.5) c = dith(x, y, ZCOL.dunes, clamp(0.3 + n * 0.5));
    if (dd <= 1.2) c = INK;
    else if (dd <= 2.4 && bayer(x, y) < 0.5) c = INK2;
    b.data[i] = c;
  }
  // glyphs zone by zone
  for (const z of ZONES10) {
    const [kind, cx, cy, rx, ry] = z;
    const step = kind === 'forest' ? 9 : kind === 'peaks' || kind === 'plateau' ? 17 : kind === 'swamp' ? 9 : 11;
    for (let y = cy - ry; y < cy + ry; y += step) for (let x = cx - rx; x < cx + rx; x += step) {
      const jx = Math.round(x + (hash2(x, y, 8) - 0.5) * step * 0.8), jy = Math.round(y + (hash2(x, y, 9) - 0.5) * step * 0.8);
      if (jx < 4 || jy < 4 || jx >= W - 4 || jy >= H - 4 || !m[jy * W + jx] || d[jy * W + jx] < 5) continue;
      if (zk(jx, jy, z) < 0.2 || hash2(jx, jy, 10) < 0.2) continue;
      glyph(b, kind, jx, jy, hash2(jx, jy, 11));
    }
  }
  for (const r of RIVERS) river(b, r);
  paintSink(b, 522, 470, 40, 15);
  // the falls: a white curtain glyph where the river drops off the plateau
  for (let k = 0; k < 6; k++) { b.set(521, 250 + k, hex('#f6f2e2')); b.set(522, 250 + k, hex('#dfe9ea')); b.set(523, 250 + k, INK_BLUE); }
  // kelp in the deep, north of the grotto
  for (let i = 0; i < 40; i++) {
    const x = 450 + hash2(i, 1, 2) * 180, y = 52 + hash2(i, 2, 2) * 34;
    if (m[Math.floor(y) * W + Math.floor(x)]) continue;
    for (let k = 0; k < 5; k++) b.set(x + Math.sin(k * 1.3) * 0.8, y - k, k % 2 ? hex('#5a6a3a') : hex('#6e7c44'));
  }
  detailBuf = b;
  return b;
}

/** a river: a dark blue ink line with a light core */
function river(b: PixelBuffer, pts: [number, number][]) {
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const n = Math.ceil(Math.hypot(bx - ax, by - ay));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = ax + (bx - ax) * t + Math.sin((i * 30 + k) * 0.35) * 0.9, y = ay + (by - ay) * t + Math.cos((i * 30 + k) * 0.3) * 0.9;
      b.set(x, y, INK_BLUE);
      b.set(x + 1, y, hex('#5c8aa8'));
      if (i > pts.length / 2) b.set(x, y + 1, hex('#4a7896'));
    }
  }
}

/** one inked terrain symbol */
function glyph(b: PixelBuffer, kind: Zone10, x: number, y: number, r: number) {
  switch (kind) {
    case 'forest': {
      if (r < 0.3) { // tree fern: a little star of fronds
        b.set(x, y, INK2); b.set(x, y - 1, INK2); b.set(x, y - 2, INK2);
        for (const [dx, dy] of [[-2, -3], [2, -3], [-1, -4], [1, -4], [-3, -2], [3, -2]]) b.set(x + dx, y + dy, hex('#4c6e36'));
        b.set(x, y - 4, hex('#6a8a44'));
      } else { // a round-topped tree
        b.ellipse(x, y - 3, 2.6, 2.2, hex('#5e7e3c'));
        b.set(x - 1, y - 4, hex('#86a456')); b.set(x, y - 5, hex('#86a456'));
        b.set(x + 2, y - 2, INK2); b.set(x + 1, y - 1, INK2); b.set(x - 2, y - 1, INK2);
        b.set(x, y, INK2); b.set(x, y + 1, INK2);
      }
      break;
    }
    case 'peaks': case 'plateau': {
      const h = kind === 'peaks' ? 7 + Math.floor(r * 4) : 4 + Math.floor(r * 2), w = h + 2;
      for (let k = 0; k <= h; k++) {
        const hw = (k / h) * (w / 2);
        b.set(x - hw, y - h + k, INK);
        b.set(x + hw, y - h + k, INK);
        for (let s = -hw + 1; s < 0; s++) if ((k + Math.round(s)) % 2 === 0) b.set(x + s, y - h + k, INK3);
        if (kind === 'peaks' && k < 2) b.set(x, y - h + k + 1, hex('#f6f2e2'));
      }
      break;
    }
    case 'swamp':
      for (let k = -3; k <= 3; k++) b.set(x + k, y, hex('#3e6a6a'));
      b.set(x - 1, y - 1, hex('#4c7a52')); b.set(x, y - 2, hex('#4c7a52')); b.set(x + 1, y - 1, hex('#4c7a52')); b.set(x + 2, y - 2, hex('#4c7a52'));
      break;
    case 'garden':
      for (let k = 0; k < 4; k++) b.set(x + k * 2, y, hex('#6a7a2a'));
      for (let k = 0; k < 4; k++) b.set(x + k * 2 + 1, y + 2, hex('#6a7a2a'));
      break;
    case 'glow':
      if (r < 0.55) { b.rect(x - 2, y - 3, 5, 1, hex('#2a4a5a')); b.rect(x - 1, y - 4, 3, 1, hex('#3a6a76')); b.set(x, y - 2, INK2); b.set(x, y - 1, INK2); b.set(x - 1, y - 3, hex('#7affe0')); }
      else { b.set(x, y, hex('#9affea')); b.set(x + 1, y, hex('#3fd1c1')); b.set(x, y - 1, hex('#3fd1c1')); }
      break;
    case 'thermal':
      if (r < 0.5) { for (let k = 0; k < 6; k++) b.set(x + Math.sin(k * 1.4) * 1.5, y - k, k < 2 ? INK_RED : INK3); }
      else { b.ellipse(x, y, 2, 1, hex('#b8582a')); b.set(x, y, hex('#f0c060')); }
      break;
    case 'gorge':
      for (let k = -4; k <= 4; k++) { b.set(x + k, y, INK2); if (k % 2 === 0) b.set(x + k, y + 2, hex('#a84a32')); }
      break;
    case 'sink':
      break;
    case 'terraces':
      for (let k = 0; k < 6; k++) { b.set(x + k, y, INK); if (k === 2) { b.set(x + k, y + 1, INK); b.set(x + k, y + 2, INK); } }
      for (let k = 2; k < 8; k++) b.set(x + k, y + 2, INK);
      b.set(x + 1, y - 1, hex('#8a8270')); b.set(x + 4, y + 1, hex('#8a8270'));
      break;
    case 'cave':
      b.ellipse(x, y, 2.4, 1.6, INK); b.ellipse(x, y + 0.5, 1.2, 0.8, hex('#140c08'));
      break;
    case 'dunes':
      for (let k = 0; k < 4; k++) b.set(x + k, y - (k === 1 || k === 2 ? 1 : 0), INK3);
      break;
  }
}

/** the sinkhole: concentric rings, darker toward the middle (drawn into the detail layer) */
export function paintSink(b: PixelBuffer, cx: number, cy: number, rx: number, ry: number) {
  for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
    const k = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    if (k > 1) continue;
    const ring = Math.floor((1 - k) * 6);
    const c = [hex('#7c745a'), hex('#686048'), hex('#544c38'), hex('#40382a'), hex('#2c241c'), hex('#1c1610'), hex('#120c08')][ring];
    if (Math.abs(((1 - k) * 6) % 1) < 0.12 || bayer(x, y) < 0.6) b.set(x, y, c);
  }
}

// ------------------------------------------------------------------ glyphs for pins and finds
/** 1-char palette: k ink, w paper, r red, g green, b blue, y gold, s stone, d dark, l light ink, m moss, o orange, c cyan, p pink */
const GP: Record<string, C> = {
  k: INK, w: hex('#f6ead0'), r: INK_RED, g: hex('#4f8a3a'), b: INK_BLUE, y: hex('#e0a818'), s: hex('#9a9484'), d: hex('#1c120a'), l: INK3,
  m: hex('#6e8a44'), o: hex('#d8783a'), c: hex('#3fd1c1'), p: hex('#d87a8a'), t: hex('#b88a52'), n: hex('#7a5430'),
};
const G = (rows: string[]): PixelBuffer => {
  const b = new PixelBuffer(rows[0].length, rows.length);
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = GP[r[x]]; if (c !== undefined) b.set(x, y, c); } });
  return b;
};
export const PINS: Record<string, PixelBuffer> = {
  camp: G([
    '......kr.....',
    '......krr....',
    '......kr.....',
    '.....kkk.....',
    '....kwwwk....',
    '...kwwlwwk...',
    '..kwwlllwwk..',
    '.kwwwldlwwwk.',
    'kkkkkdddkkkkk',
    '.....kkk.....',
    '......k......',
  ]),
  site: G([
    '....kkkk....',
    '..kkmmggkk..',
    '.kmmggggmmk.',
    'kmgggmggggmk',
    'kgggggggmggk',
    '.kmggggggmk.',
    '..kkkmmkkk..',
    '.....nn.....',
    '.....nn.....',
    '....kkkk....',
    '.....kk.....',
    '......k.....',
  ]),
  village: G([
    '......kk......',
    '.....krrk.....',
    '....krrrrk....',
    '...krr..rrk...',
    '..krr.kk.rrk..',
    '.krr.ktttk.rrk',
    'kkk.ktnntk.kkk',
    '...ktnddntk...',
    '...ktnddntk...',
    '...kkkkkkkk...',
    '......kk......',
    '.......k......',
  ]),
  ruin: G([
    '.kk......kk..',
    '.ks......sk..',
    '.ks.kk...sk..',
    '.ks.ks...sk..',
    '.ks.ks.k.sk..',
    '.kskks.kkskk.',
    'kssssssssssk.',
    'kkkkkkkkkkkk.',
    '.....kk......',
    '......k......',
  ]),
  cave: G([
    '...kkkkkk...',
    '..kssssssk..',
    '.ksskkkksk..',
    'kssk....kssk',
    'ksk..dd..ksk',
    'ksk.dddd.ksk',
    'kkkkddddkkkk',
    '.....kk.....',
    '......k.....',
  ]),
  fossil: G([
    '...kkkkk...',
    '..kwwwwwk..',
    '.kwkkkkwwk.',
    '.kwkwwkkwk.',
    '.kwkwkwkwk.',
    '.kwkkwkwk..',
    '..kwwwkwk..',
    '...kkkkk...',
    '.....k.....',
    '.....k.....',
  ]),
  glow: G([
    '...kkkkk...',
    '..kcccccck.',
    '.kccwcccck.',
    'kkkkkkkkkkk',
    '....kwk....',
    '....kwk....',
    '..c.kwk.c..',
    '...kkkkk...',
    '.....k.....',
  ]),
  thermal: G([
    '..l..l..l..',
    '.l..l..l...',
    '..l..l..l..',
    '.l..l..l...',
    '...kkkkk...',
    '.kkoooook..',
    'kooorroook.',
    '.kkkkkkkk..',
    '.....k.....',
  ]),
  sink: G([
    '..kkkkkkk..',
    '.kllllllk..',
    'klkkkkkklk.',
    'klkdddddklk',
    'klkdddddklk',
    'klkkkkkklk.',
    '.kllllllk..',
    '..kkkkkkk..',
    '.....k.....',
  ]),
  ocean: G([
    '.....kk.....',
    '....kbbk....',
    '...kbbbk....',
    'kk.kbbbbk.kk',
    'bbkkbbbbkkbb',
    'kbbbbkkbbbbk',
    '.kkkk..kkkk.',
  ]),
  rumour: G([
    '..k.k.k..',
    '.k.....k.',
    'k..kkk..k',
    '..k...k..',
    'k....k..k',
    '....k....',
    'k...k...k',
    '.........',
    '.k..k..k.',
    '..k.k.k..',
  ]),
  here: G([
    'r.....r',
    'rr...rr',
    '.rr.rr.',
    '..rrr..',
    '.rr.rr.',
    'rr...rr',
    'r.....r',
  ]),
};
/** 7px symbols for discoveries on the map */
export const MARKS: Record<string, PixelBuffer> = {
  artifact: G(['...k...', '..kyk..', '.kyyyk.', 'kyywyyk', '.kyyyk.', '..kyk..', '...k...']),
  fossil: G(['.kkkkk.', 'kwwwwwk', 'kwkkkwk', 'kwkwkwk', 'kwwkwwk', '.kkkwk.', '....k..']),
  sample: G(['.kkkkk.', '..kwk..', '.kwwwk.', 'kwbbbwk', 'kbbbbbk', 'kbbbbbk', '.kkkkk.']),
  plant: G(['....kk.', '...kgk.', '..kggk.', '.kggk..', 'kggk...', '.kk....', 'k......']),
  landmark: G(['...k...', '..kyk..', 'kkyyykk', '.kyyyk.', '.kykyk.', 'kk...kk', '.......']),
  ecosystem: G(['...c...', '.c.k.c.', '..kwk..', 'ckwwwkc', '..kwk..', '.c.k.c.', '...c...']),
  cave: G(['.kkkkk.', 'kssssk.', 'ksdddsk', 'ksdddsk', 'kkkkkkk', '.......', '.......']),
  village: G(['...k...', '..krk..', '.krrrk.', 'krkkkrk', '.ktdtk.', '.ktdtk.', '.kkkkk.']),
  ruin: G(['k...k..', 'ks..sk.', 'ks.ksk.', 'kskksk.', 'ksssssk', 'kkkkkkk', '.......']),
  note: G(['kkkkkk.', 'kwwwwk.', 'kwllwk.', 'kwwwwk.', 'kwllwkk', 'kwwwwwk', 'kkkkkkk']),
};

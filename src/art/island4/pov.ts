// V4 island art: the first-person view from the sand the morning after the wreck. Lying on the beach
// looking up: a washed-clean morning sky with the last of the storm clouds, palm crowns and a leaning
// pōhutukawa in flower overhead. Sitting up: the sun low over a calm, glittering sea, a bank of
// gold-lit cloud on the horizon, distant islands and a volcano in the haze, the basalt headland to the
// west with surf breaking at its foot and the palm point to the east, the glassy swash zone mirroring
// the sky, then the near beach with its kelp, shells, driftwood and crab tracks, framed by leaning
// palms and dense coastal bush on the left and the pōhutukawa and a taupata on the right, and Mori's
// own legs and boots at the bottom of the frame. No boat, no wreckage: just the island.
//
// The painting is POV_W x POV_H in content coordinates with a POV_PAD margin all round (so breathing,
// the roll while sitting up and wide screens never show an edge); the buffer origin is (-PAD, -PAD).

import { PixelBuffer } from '../pixel';
import { hex, mix, shade, C } from '../color';
import * as L from '../landscape';
import { Rng, bayer, clamp, noise1, noise2, fbm2, hash2, smoothstep } from '../../core/math';
import { leafStamp, drawStamp } from '../jungle-core';
import type { Sprite } from '../jungle-core';
import { paintHeadland } from '../v9/headland';
import * as D from '../v9/beach-debris';
import * as Wr from '../v9/beach-wrack';
import * as F from '../v9/beach-flora';
import { PAL } from '../palettes';

export const POV_W = 1000, POV_H = 800, POV_PAD = 48, POV_HORIZON = 452, POV_SHORE = 566, POV_WET = 616;
/** the low morning sun, just above the horizon */
export const POV_SUN = { x: 600, y: 404 };
/** where Mori's right hand rests on the sand (the fingertips) */
export const POV_HAND = { x: 668, y: 702 };
const W = POV_W, H = POV_H, PAD = POV_PAD, HORIZON = POV_HORIZON, SHORE = POV_SHORE;
const SUNX = POV_SUN.x, SUNY = POV_SUN.y;
/** the shoreline curves away up the beach toward the headland on the left */
export const povShore = (x: number) => SHORE - Math.max(0, 430 - x) * 0.22 - (noise1(x / 60, 31) - 0.5) * 4;

export function paintPOV(): PixelBuffer {
  const b = new PixelBuffer(W + PAD * 2, H + PAD * 2);
  const rng = new Rng(41);
  const set = (x: number, y: number, c: C) => { x = Math.round(x) + PAD; y = Math.round(y) + PAD; if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.data[y * b.w + x] = c; };
  const get = (x: number, y: number) => b.data[clamp(Math.round(y) + PAD, 0, b.h - 1) * b.w + clamp(Math.round(x) + PAD, 0, b.w - 1)];
  const blend = (x: number, y: number, c: C, k: number) => { if (k > 0) set(x, y, mix(get(x, y), c, Math.min(1, k))); };
  const disc = (cx: number, cy: number, rx: number, ry: number, fn: (nx: number, ny: number, x: number, y: number) => C | -1) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const nx = (x - cx) / rx, ny = (y - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const c = fn(nx, ny, x, y);
      if (c !== -1) set(x, y, c);
    }
  };
  const dark = (cx: number, cy: number, rx: number, ry: number, a: number) => disc(cx, cy, rx, ry, (nx, ny, x, y) => shade(get(x, y), -a * (1 - (nx * nx + ny * ny) * 0.6)));
  /** stamp a kit sprite with its anchor at (x, y) */
  const put = (s: Sprite | { buf: PixelBuffer; ax: number; ay: number }, x: number, y: number, flip = false, haze = 0, hazeC: C = 0) => {
    for (let j = 0; j < s.buf.h; j++) for (let i = 0; i < s.buf.w; i++) {
      let c = s.buf.data[j * s.buf.w + (flip ? s.buf.w - 1 - i : i)];
      if (!(c >>> 24)) continue;
      const X = x - (flip ? s.buf.w - 1 - s.ax : s.ax) + i, Y = y - s.ay + j;
      if (haze) c = (mix(c | 0xff000000, hazeC, haze) & 0xffffff | (c & 0xff000000)) >>> 0;
      if ((c >>> 24) < 255) blend(X, Y, c | 0xff000000, (c >>> 24) / 255); else set(X, Y, c);
    }
  };
  const X0 = -PAD, X1 = W + PAD;
  const sunD = (x: number, y: number) => Math.hypot((x - SUNX) / 1.4, y - SUNY);

  // ---- sky: deep morning blue at the zenith, washed clean after the storm, warming to peach and
  // gold toward the low sun
  const sky = ['#1e4a94', '#2458a2', '#2c68b0', '#3a7abc', '#4c8cc6', '#62a0d0', '#7cb2d8', '#9cc4dc', '#bcd2d8', '#dcdcc8', '#f0dcb4'].map(h => hex(h));
  const glowC = hex('#fff0c4'), warmC = hex('#ffc890');
  for (let y = -PAD; y < HORIZON; y++) {
    const t = Math.pow(clamp((y + PAD) / (HORIZON + PAD)), 1.35);
    for (let x = X0; x < X1; x++) {
      let c = sky[clamp(Math.round(t * (sky.length - 1) + (bayer(x, y) - 0.5) * 0.8), 0, sky.length - 1)];
      const d = sunD(x, y);
      const g = Math.exp(-d / 150) * 0.75 + Math.exp(-d / 40) * 0.5;
      const band = smoothstep(HORIZON - 140, HORIZON, y) * Math.exp(-Math.abs(x - SUNX) / 420) * 0.45;
      c = mix(c, warmC, clamp(band + (bayer(x, y) - 0.5) * 0.06));
      c = mix(c, glowC, clamp(g + (bayer(x + 3, y) - 0.5) * 0.05));
      set(x, y, c);
    }
  }
  // high cirrus combed out by the storm's tail, catching the first light
  for (let i = 0; i < 22; i++) {
    const cx = rng.range(X0, X1), cy = rng.range(-30, 300), len = rng.range(60, 200), tilt = rng.range(-0.08, 0.02);
    for (let k = 0; k < len; k++) {
      const x = cx + k, y = cy + Math.sin(k * 0.04 + i) * 4 + k * tilt;
      const a = 0.3 * Math.sin((k / len) * Math.PI);
      if ((k + i) % 3) blend(x, y, hex('#ffffff'), a);
      if (k % 5 === 0) blend(x + 2, y + 1, hex('#ffe8d0'), a * 0.6);
    }
  }
  // the sun: a soft white disc with a hot core, sitting just above the cloud bank
  for (let y = SUNY - 40; y < SUNY + 40; y++) for (let x = SUNX - 40; x < SUNX + 40; x++) {
    const d = Math.hypot(x - SUNX, y - SUNY);
    if (d < 13) set(x, y, d < 9 ? hex('#fffef4') : hex('#fff6d4'));
    else if (d < 40) blend(x, y, hex('#fff4d0'), Math.pow(1 - (d - 13) / 27, 2) * 0.7);
  }
  // the last of the storm: a long bank of cumulus on the horizon, lit gold from the sun behind it,
  // and a few puffy towers standing over the sea
  const CL = ['#6a6684', '#857c96', '#a496a6', '#c4aeb0', '#e2c6b4', '#f6dcc0', '#fff0d8'].map(h => hex(h));
  const CLF = ['#8a90ac', '#a0a4bc', '#b8b8c8', '#d0ccd0', '#e8dcd0', '#fae8d4'].map(h => hex(h));
  const cloud = (seed: number, x: number, y: number, w: number, h: number, ramp: C[], toward: number, haze: number) => {
    const cb = L.paintCloud(seed, w, h, ramp, toward, 0.8);
    for (let j = 0; j < cb.h; j++) for (let i = 0; i < cb.w; i++) {
      const c = cb.data[j * cb.w + i];
      if (!(c >>> 24)) continue;
      const X = x + i, Y = y + j;
      // the rims that face the sun glow
      const d = sunD(X, Y);
      let cc = mix(c, hex('#a8c4d8'), haze);
      if (d < 220 && i > 0 && !(cb.data[j * cb.w + i - Math.sign(SUNX - X)] >>> 24)) cc = mix(cc, hex('#fff4d8'), 0.7 * (1 - d / 220));
      set(X, Y, cc);
    }
  };
  for (const [seed, x, y, w, h, haze] of [[61, -40, 352, 260, 60, 0.25], [62, 180, 330, 300, 80, 0.2], [63, 660, 340, 260, 70, 0.22], [64, 860, 360, 220, 54, 0.3], [65, 440, 384, 140, 38, 0.15]] as const) cloud(seed, x, y, w, h, CL, x + w / 2 < SUNX ? 1 : -1, haze);
  for (let i = 0; i < 9; i++) { const x = X0 + i * 125 + rng.range(-30, 30); cloud(70 + i, x, HORIZON - 34 - rng.range(0, 10), rng.range(140, 220), rng.range(26, 36), CLF, x < SUNX ? 1 : -1, 0.35); }
  // crepuscular rays fanning up from the sun through the gaps in the bank
  for (let r = 0; r < 9; r++) {
    const a = -Math.PI / 2 + (r - 4) * 0.21 + rng.range(-0.05, 0.05);
    for (let s = 30; s < 420; s++) {
      const x = SUNX + Math.cos(a) * s * 1.4, y = SUNY + Math.sin(a) * s;
      for (let w = -3; w <= 3; w++) blend(x + w, y, hex('#fff2d0'), 0.06 * (1 - s / 420) * (1 - Math.abs(w) / 4));
    }
  }
  // the sun's rim shows again over the cloud bank
  for (let y = SUNY - 13; y < SUNY + 14; y++) for (let x = SUNX - 13; x < SUNX + 14; x++) { const d = Math.hypot(x - SUNX, y - SUNY); if (d < 12) blend(x, y, hex('#fffbe8'), d < 8 ? 0.85 : 0.5); }

  // ---- the far archipelago: islands and a volcano, flat lavender silhouettes in the morning haze
  const ridge = L.paintRidge(W + PAD * 2, 70, { seed: 17, base: 60, amp: 16, freq: 0.012, body: hex('#7a86a8'), lit: hex('#929cb8'), shadow: hex('#6a7698'), fogTo: hex('#c8c4c8'), fogStart: 30, peaks: [{ x: 830 + PAD, h: 56, w: 70, cone: true }, { x: 930 + PAD, h: 26, w: 60 }, { x: 520 + PAD, h: 18, w: 46 }], sharp: 0.6 });
  for (let y = 0; y < 70; y++) for (let x = 0; x < ridge.w; x++) {
    const c = ridge.data[y * ridge.w + x];
    const X = x - PAD;
    if (!(c >>> 24) || X < 470 || (X > 560 && X < 690)) continue;
    set(X, HORIZON - 66 + y, mix(c, hex('#e8d4c4'), 0.25 * Math.exp(-Math.abs(X - SUNX) / 200)));
  }
  // a wisp of steam off the volcano
  for (let k = 0; k < 40; k++) { const x = 830 + Math.sin(k * 0.3) * 3 + k * 0.7, y = HORIZON - 58 - k * 1.3; blend(x, y, hex('#f0eae8'), 0.45); blend(x + 1, y, hex('#f0eae8'), 0.3); }

  // ---- the sea: calm after the storm, long glassy swells, the sun's glitter path coming toward us
  for (let y = HORIZON; y < SHORE + 8; y++) {
    const t = clamp((y - HORIZON) / (SHORE - HORIZON));
    const sc = 0.3 + t * 1.7;
    for (let x = X0; x < X1; x++) {
      let c = mix(hex('#8aa8c4'), hex('#1e6a9c'), Math.pow(t, 0.5));
      if (t > 0.62) c = mix(c, hex('#36aeb4'), (t - 0.62) / 0.38);
      // the morning sky's warmth mirrored in the far water
      c = mix(c, hex('#e8c8a8'), Math.exp(-Math.abs(x - SUNX) / 260) * (1 - t) * 0.45);
      const swell = Math.sin(y / (0.9 + t * 3.2) + noise1(x / (90 * sc), 5) * 3);
      const n = noise2(x / (24 * sc), y / (1.3 + t * 2.6), 5);
      if (swell > 0.82) c = mix(c, hex('#c8e4ec'), 0.18 + t * 0.12);
      else if (swell < -0.86) c = shade(c, -0.06);
      if (n > 0.86) c = mix(c, hex('#eafafc'), 0.2 + t * 0.2);
      // the glitter path
      const pw = 16 + t * 150;
      const gp = Math.exp(-(((x - SUNX) / pw) ** 2));
      if (gp > 0.02) {
        c = mix(c, hex('#f8e8c0'), gp * 0.35 * (1 - t * 0.6));
        if (hash2(x, y, 3) < gp * (0.16 - t * 0.08) && swell > -0.2) c = mix(c, hex('#fffef0'), 0.9);
      }
      set(x, y, c);
    }
  }
  // the palm point to the east: a low sandy spit with leaning palms and bush, surf at its foot
  for (let x = 700; x < X1; x++) {
    const top = HORIZON - 4 - smoothstep(700, 860, x) * 12 - (noise1(x / 14, 33) - 0.5) * 4;
    for (let y = Math.round(top); y < HORIZON + 8; y++) set(x, y, y - top < 3 ? hex('#4a6e48') : mix(hex('#344e3c'), hex('#c8b894'), smoothstep(HORIZON + 2, HORIZON + 8, y)));
    if (rng.next() < 0.5) set(x, HORIZON + 6 + rng.range(0, 2), hex('#ffffff'));
  }
  for (const [px, ph, lean] of [[760, 30, -0.3], [800, 38, 0.25], [846, 26, -0.15], [905, 42, 0.3], [962, 34, -0.2]] as const) {
    const base = HORIZON - 8 - smoothstep(700, 860, px) * 10;
    for (let k = 0; k < ph; k++) set(px + lean * k * k / ph, base - k, k % 4 ? hex('#4a4440') : hex('#5e5448'));
    const tx = px + lean * ph, ty = base - ph;
    for (let f = 0; f < 7; f++) {
      const a = -Math.PI * 0.95 + f * (Math.PI * 0.9 / 6);
      for (let s = 0; s < 12; s++) { const x = tx + Math.cos(a) * s, y = ty + Math.sin(a) * s * 0.6 + s * s * 0.03; set(x, y, s < 9 ? hex('#2a4a30') : hex('#3a5e36')); }
    }
  }
  // ---- the headland to the west, the beach curving away to its foot, surf bursting on its ledges
  const hd = paintHeadland(470, 170, 11, 0.86);
  const hBase = HORIZON + 54;
  for (let j = 0; j < hd.buf.h; j++) for (let i = 0; i < hd.buf.w; i++) {
    const c = hd.buf.data[j * hd.buf.w + i];
    if (c >>> 24) set(X0 + i, hBase - hd.buf.h + j, mix(c, hex('#9aaec4'), 0.14));
  }
  for (let x = X0; x < 430; x++) {
    // where the rock meets the sea, throw foam up it
    if (!(hd.buf.data[(hd.buf.h - 1) * hd.buf.w + (x - X0)] >>> 24)) continue;
    const surf = 2 + noise1(x / 9, 44) * 9 + (noise1(x / 3, 45) > 0.7 ? 4 : 0);
    for (let k = 0; k < surf; k++) if (hash2(x, k, 46) < 0.8 - k / surf * 0.5) blend(x, hBase - 1 - k, hex('#f4f8f8'), 0.85 - k / surf * 0.4);
  }
  // low reef rocks at the foot of the headland with the swell washing over them
  for (const [rx, rw, rh, sd] of [[150, 46, 14, 81], [228, 30, 10, 82], [300, 54, 12, 83], [372, 24, 8, 84]] as const) {
    const y = povShore(rx) - 6;
    put(Wr.boulder(sd, rw, rh, 'shore', 'wet'), rx, y);
    for (let x = rx - rw / 2 - 6; x < rx + rw / 2 + 6; x++) { const k = noise1(x / 4, sd); if (k > 0.35) blend(x, y + 1 + (k > 0.7 ? -1 : 0), hex('#ffffff'), 0.8); }
  }

  // ---- the beach: glassy swash zone mirroring the sky, then dry sand with wind ripples
  for (let x = X0; x < X1; x++) {
    const sh = povShore(x);
    for (let y = Math.floor(sh) - 1; y < H + PAD; y++) {
      const dd = y - sh, near = clamp((y - HORIZON) / (H - HORIZON));
      const wetD = 18 + near * 60;
      let c: C;
      if (dd < wetD) {
        const k = dd / wetD;
        const base = mix(hex('#86785a'), hex('#b49c70'), k);
        const wob = Math.round(Math.sin(y * 0.9 + x * 0.02) * 1.5);
        const refl = get(x + wob, HORIZON - 2 - dd * 1.3);
        c = mix(base, refl, 0.62 * (1 - k * 0.75));
        // the sun's path carries on across the wet sand
        c = mix(c, hex('#fff0cc'), Math.exp(-(((x - SUNX) / (40 + near * 120)) ** 2)) * 0.35 * (1 - k));
        if (noise2(x / 38, y / 1.6, 11) > 0.74) c = mix(c, hex('#ffffff'), 0.2);
        if (Math.abs(dd - wetD * 0.6 - Math.sin(x * 0.03) * 4) < 0.7 && noise1(x / 6, 12) > 0.4) c = mix(c, hex('#f4f8f4'), 0.5);
      } else {
        const t = clamp((dd - wetD) / 220);
        c = mix(hex('#f0d498'), hex('#c89a60'), Math.pow(t, 0.8) * 0.72);
        // long low light: every wind ripple throws a little shadow toward us
        const rip = Math.sin((dd - wetD) / (2 + near * 7) * 2.4 + fbm2(x / 90, y / 40, 2, 4) * 6);
        if (rip > 0.86) c = shade(c, -0.09); else if (rip > 0.7) c = mix(c, hex('#fff0cc'), 0.18);
        if (rip < -0.9 && fbm2(x / 120, y / 30, 2, 18) > 0.55) c = mix(c, hex('#5a5048'), 0.25); // ironsand in the troughs
        if (dd - wetD < 6 && bayer(x, y) > (dd - wetD) / 6) c = mix(c, hex('#a89070'), 0.5);
        const s = near > 0.7 ? 2 : 1, g = hash2(Math.floor(x / s), Math.floor(y / s), 8);
        if (g < 0.035) c = shade(c, -0.06); else if (g > 0.978) c = shade(c, 0.08);
        if (g > 0.9992) c = hex('#f8f0e8');
        if (g > 0.9975 && g < 0.9985 && near > 0.5) c = hex('#ffffff'); // glints off quartz grains
      }
      set(x, y, c);
    }
  }
  // the wrack line: bits of kelp and shell at the swash's reach
  for (let x = X0; x < X1; x++) {
    const y = povShore(x) + 18 + clamp((povShore(x) - HORIZON) / (H - HORIZON)) * 60 + 3 + (noise1(x / 9, 13) - 0.5) * 3;
    if (noise1(x / 5, 14) > 0.5) set(x, y, hash2(x, 1, 15) < 0.5 ? hex('#4a4a2a') : hex('#5e4a2e'));
    if (hash2(x, 2, 16) < 0.06) set(x, y - 1, hex('#f4ece0'));
  }

  // ---- the near beach: kelp and seaweed, shells, driftwood, a few finds (bigger toward the viewer)
  put(Wr.kelpHeap(51, 110, 'none'), 330, 646);
  put(Wr.kelpHeap(52, 70, 'none'), 560, 606);
  put(Wr.kelpStrand(53, 150, 'none'), 470, 628);
  put(Wr.kelpStrand(57, 110, 'none'), 760, 646, true);
  put(D.driftLog(54, 200, 'dry'), 300, 704, true);
  put(D.driftBranch(58, 80, 'dry'), 700, 616);
  put(Wr.shellScatter(61, 120, 26), 470, 668);
  put(Wr.shellScatter(62, 90, 18), 390, 690);
  put(Wr.shellScatter(63, 70, 14), 640, 640);
  put(Wr.shellScatter(64, 60, 12), 800, 690);
  for (const [k, x, y] of [['paua', 590, 662], ['star', 280, 668], ['dollar', 700, 668], ['kina', 420, 626], ['cuttle', 520, 690], ['feather', 380, 612], ['jelly', 610, 590], ['whelk', 760, 676], ['pumice', 240, 640]] as const) put(Wr.find(k, x, 'dry'), x, y);
  // pebbles and broken shell grit, catching the low light
  for (let i = 0; i < 70; i++) {
    const x = rng.range(180, 860), y = rng.range(600, 730), r = 0.8 + (y - 600) / 130 * 1.6;
    if (x > 600 && x < 900 && y > 680) continue; // keep the crab's run clear
    disc(x, y, r * 1.3, r, (nx, ny) => hex(ny < -0.3 ? '#f6ecd8' : nx > 0.3 ? '#8a7258' : rng.next() < 0.5 ? '#c8b08c' : '#b49c7c'));
    dark(x + 1, y + r, r * 1.4, 1, 0.12);
  }
  // crab and bird tracks wandering across the sand; a dotted line runs up from the taupata
  for (let k = 0; k < 60; k++) { const x = 300 + k * 5 + Math.sin(k * 0.4) * 8, y = 660 + Math.sin(k * 0.17) * 14; for (const s2 of [-1, 1]) { blend(x - 1, y + s2 * 3, hex('#8a6a40'), 0.35); blend(x + 1, y + s2 * 3 + 1, hex('#8a6a40'), 0.35); } }
  for (let k = 0; k < 30; k++) { const x = 900 - k * 7, y = 718 - k * 1.6 + Math.sin(k * 0.5) * 3; for (const s2 of [-1, 1]) { blend(x - 1, y + s2 * 4, hex('#8a6a40'), 0.3); blend(x + 1, y + s2 * 4 + 1, hex('#8a6a40'), 0.3); } }
  for (let k = 0; k < 14; k++) { const x = 460 + k * 14, y = 640 + Math.sin(k * 0.6) * 6; for (const [dx, dy] of [[0, 0], [-2, -2], [2, -2], [0, -3]]) blend(x + dx, y + dy, hex('#8a6a40'), 0.4); }

  // ---- framing, left: dense coastal bush at the back of the beach with palms leaning out of it
  const BUSH = ['#0a140e', '#101e14', '#16281a', '#1e3420', '#284428', '#345630', '#46683a', '#5e7e44'].map(h => hex(h));
  const PALM = ['#0c1810', '#122216', '#1a301c', '#244222', '#30562a', '#426a34', '#5c8442', '#7a9c50'].map(h => hex(h));
  const palm = (bx: number, by: number, tx: number, ty: number, fronds: number, flen: number, seed: number) => {
    const pr = new Rng(seed);
    const n = Math.ceil(Math.hypot(tx - bx, ty - by));
    // the trunk: a gentle curve, ringed, thinning toward the crown; lit on the sun side
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = bx + (tx - bx) * t + Math.sin(t * Math.PI) * (tx - bx) * 0.18, y = by + (ty - by) * t;
      const r = 7 - t * 2.6;
      for (let dx = -r; dx <= r; dx++) {
        const u = dx / r;
        let l = 0.42 + u * 0.3 + Math.sqrt(1 - u * u) * 0.1;
        if (((i + Math.round(u * 2)) % 7) < 1) l -= 0.18; // the leaf-scar rings
        const rp = ['#1e1814', '#2c241c', '#3c3226', '#4e4232', '#62543e', '#7a6a4e', '#a0886a'];
        set(x + dx, y, hex(rp[clamp(Math.round(l * 6 + (bayer(x + dx, y) - 0.5) * 0.8), 0, 6)]));
      }
    }
    // the crown: arching fronds, leaflets drooping off both sides of each rachis
    for (let f = 0; f < fronds; f++) {
      const a = -Math.PI / 2 + (f / (fronds - 1) - 0.5) * Math.PI * 1.7 + pr.range(-0.12, 0.12);
      const len = flen * pr.range(0.75, 1.1);
      const droop = 0.006 + pr.range(0, 0.004);
      let px = tx, py = ty;
      for (let s = 0; s < len; s += 1) {
        const x = tx + Math.cos(a) * s, y = ty + Math.sin(a) * s * 0.85 + droop * s * s;
        const dx = x - px, dy = y - py; px = x; py = y;
        const dl = Math.hypot(dx, dy) || 1;
        const tx2 = dx / dl, ty2 = dy / dl;
        set(x, y, PALM[2]);
        if (s % 2) continue;
        const ll = (1 - s / len) * 0.8 + 0.25;
        for (const side of [-1, 1]) {
          const leafL = (8 + flen * 0.08) * ll * (s < 6 ? s / 6 : 1);
          for (let q = 0; q < leafL; q++) {
            const k = q / leafL;
            const lx = x + (-ty2 * side * 0.8 + tx2 * 0.5) * q, ly = y + (tx2 * side * 0.8 + ty2 * 0.5) * q + k * k * leafL * 0.5;
            // backlit leaflets: dark, glowing yellow-green where the sun shines through the tips
            const lit = 0.25 + k * 0.35 + (lx > tx ? 0.1 : 0) + (bayer(lx, ly) - 0.5) * 0.2;
            set(lx, ly, PALM[clamp(Math.round(lit * 7), 0, 7)]);
          }
        }
      }
    }
    disc(tx, ty + 2, 6, 5, (nx, ny) => hex(ny < 0 ? '#3a3020' : '#2a2216'));
    for (let c = 0; c < 6; c++) disc(tx - 4 + c * 1.6, ty + 6 + (c % 2), 1.8, 1.8, () => hex(c % 2 ? '#8a6a2a' : '#6a5020')); // a bunch of nuts
  };
  // the bush mass: overlapping leaf clusters, ragged against the sky, lit from the sun on the right
  const bushTop = (x: number) => 470 + Math.max(0, x - 40) * 0.6 + (noise1(x / 22, 91) - 0.5) * 34;
  const bushR = (y: number) => 140 + Math.max(0, y - 520) * 0.5 + (noise1(y / 30, 92) - 0.5) * 24;
  for (let k = 0; k < 420; k++) {
    const cy = rng.range(440, H + PAD), cx = rng.range(X0, bushR(cy) - 6);
    if (cy < bushTop(cx)) continue;
    const r = rng.range(8, 18);
    for (let n = 0; n < r * 4; n++) {
      const a = rng.range(0, Math.PI * 2), d = Math.sqrt(rng.next()) * r;
      const x = cx + Math.cos(a) * d * 1.2, y = cy + Math.sin(a) * d;
      if (y < bushTop(x) - 6 || x > bushR(y) + 8) continue;
      const lit = clamp(0.4 - (y - cy) / r * 0.3 + (x - cx) / r * 0.15 + (x - bushR(y)) / 140 + rng.range(-0.15, 0.15));
      drawStamp(b, leafStamp('oval', rng.range(5, 9), rng.range(2.6, 3.8), rng.range(0, Math.PI)), x + PAD, y + PAD, BUSH, Math.round(lit * 7));
    }
  }
  // the bush throws a soft shadow onto the sand at its foot
  for (let y = 520; y < H + PAD; y++) for (let x = bushR(y) - 4; x < bushR(y) + 20; x++) if (get(x, y) !== 0) { const k = 1 - (x - bushR(y) + 4) / 24; if (k > 0 && !BUSH.includes(get(x, y))) blend(x, y, hex('#5a4a3a'), 0.25 * k); }
  /** a mound of glossy coastal shrub, lit from the sun ahead and to the left, with wet glints */
  function shrub(cx: number, cy: number, rx: number, ry: number, seed: number) {
    const sr = new Rng(seed);
    const TP = ['#08140c', '#0e1e12', '#16301a', '#1e4022', '#2a542c', '#3a6a36', '#548444', '#80aa5c'].map(h => hex(h));
    dark(cx, cy + ry * 0.15, rx * 1.15, ry * 0.25, 0.25);
    for (let k = 0; k < rx * ry / 22; k++) {
      const a = sr.range(-Math.PI, 0.25), d = Math.sqrt(sr.next());
      const kx = cx + Math.cos(a) * rx * d, ky = cy + Math.sin(a) * ry * d;
      const r = sr.range(7, 15);
      for (let n = 0; n < r * 4; n++) {
        const a2 = sr.range(0, Math.PI * 2), d2 = Math.sqrt(sr.next()) * r;
        const x = kx + Math.cos(a2) * d2 * 1.2, y = ky + Math.sin(a2) * d2;
        if (y > cy + 4) continue;
        const lit = clamp(0.42 - (y - ky) / r * 0.3 - (x - kx) / r * 0.12 - (y - cy + ry) / (ry * 2) * 0.3 + sr.range(-0.12, 0.12));
        drawStamp(b, leafStamp('oval', sr.range(5, 8), sr.range(2.8, 4), sr.range(0, Math.PI)), x + PAD, y + PAD, TP, Math.round(lit * 7));
        if (sr.chance(0.03) && lit > 0.45) set(x, y, hex('#d8f0c0'));
      }
    }
    // the dark hollow under it, where things hide
    dark(cx - rx * 0.25, cy - 2, rx * 0.4, 6, 0.35);
  }
  palm(-20, 640, 30, 300, 11, 96, 201);
  palm(110, 600, 230, 318, 12, 110, 202);
  palm(40, 540, 120, 420, 9, 70, 203);
  put(F.toetoe(82, 110, 'dry', 4), 160, 700);
  put(F.harakeke(83, 220, 'dry', 3, true), 200, 800);
  put(F.harakeke(86, 260, 'dry', 2), 60, 860);
  put(F.spinifex(80, 70, 'dry', 2), 280, 800);
  put(F.pingao(84, 80, 'dry'), 240, 820, true);
  put(F.morningGlory(87, 90, 'dry'), 230, 740);

  // ---- framing, right: a gnarled pōhutukawa leaning in, its branches and crimson flowers across the
  // top of the frame, and a dense taupata at its foot
  const trunk: [number, number][] = [];
  for (let i = 0; i <= 150; i++) { const t = i / 150; trunk.push([935 - t * 130 - Math.sin(t * 3) * 20 + Math.sin(t * 11) * 4, 860 - t * 600]); }
  for (let i = 0; i < trunk.length; i++) {
    const [tx, ty] = trunk[i], r = 30 - i * 0.11 + Math.sin(i * 0.18) * 2 + (i < 12 ? (12 - i) * 1.2 : 0);
    for (let y = ty - 3; y < ty + 3; y++) for (let x = tx - r; x <= tx + r; x++) {
      const u = (x - tx) / r;
      const bark = noise2(x / 3, y / 14, 90);
      // the morning sun is in front of us: the left flank of the trunk catches it
      const l = 0.42 - u * 0.4 + (bark - 0.5) * 0.5 + (u < -0.8 ? 0.2 : 0);
      set(x, y, hex(['#1a1210', '#2a1e18', '#3a2a20', '#4e3a2c', '#64503c', '#7a6650', '#a08468'][clamp(Math.round(l * 6 + (bayer(x, y) - 0.5) * 0.8), 0, 6)]));
    }
  }
  const limb = (x0: number, y0: number, a: number, len: number, r0: number) => {
    let x = x0, y = y0;
    const pts: [number, number, number][] = [];
    for (let s = 0; s < len; s += 2) { a += Math.sin(s * 0.03 + x0) * 0.02; x += Math.cos(a) * 2; y += Math.sin(a) * 2; pts.push([x, y, r0 * (1 - s / len) + 1.5]); }
    for (const [px, py, r] of pts) disc(px, py, r, r, (nx, ny) => hex(ny < -0.3 ? '#5a4634' : nx > 0.4 ? '#22180f' : '#3a2a20'));
    return pts;
  };
  const tips = [...limb(830, 300, Math.PI * 1.08, 340, 12), ...limb(815, 430, Math.PI * 1.04, 170, 9), ...limb(850, 230, Math.PI * 1.25, 260, 8), ...limb(860, 520, Math.PI * 0.94, 90, 7)];
  const LEAF = ['#09140e', '#0e1e14', '#14281a', '#1c3622', '#26462a', '#345a32', '#467038'].map(h => hex(h));
  for (let k = 0; k < 190; k++) {
    const [px, py] = tips[Math.floor(rng.next() * tips.length)];
    const cx = px + rng.range(-34, 34), cy = py + rng.range(-26, 26), r = rng.range(9, 20);
    for (let n = 0; n < r * 5; n++) {
      const a = rng.range(0, Math.PI * 2), d = Math.sqrt(rng.next()) * r;
      const x = cx + Math.cos(a) * d * 1.3, y = cy + Math.sin(a) * d;
      const lit = clamp(0.45 - (y - cy) / r * 0.35 - (x - cx) / r * 0.12 + rng.range(-0.15, 0.15));
      drawStamp(b, leafStamp('oval', rng.range(5, 8), rng.range(2.6, 3.6), rng.range(0, Math.PI)), x + PAD, y + PAD, LEAF, Math.round(lit * 6));
    }
    if (rng.chance(0.55)) for (let f = 0; f < 3; f++) {
      const fx = cx + rng.range(-r, r), fy = cy - r * rng.range(0.4, 1);
      disc(fx, fy, 3.2, 2.6, (nx, ny) => hex(ny < -0.3 ? '#ff6a5a' : nx > 0.3 ? '#a8182a' : '#e0303a'));
      set(fx, fy - 2, hex('#ffd24a')); set(fx - 1, fy - 1, hex('#ffd24a'));
    }
  }
  // fallen stamens dusting the sand under the tree
  for (let i = 0; i < 90; i++) { const x = rng.range(700, 1000), y = rng.range(640, 780); set(x, y, rng.next() < 0.7 ? hex('#d02a34') : hex('#ff6a5a')); }
  // the taupata: a dense mound of glossy leaves at the foot of the tree, the crab's hiding place
  shrub(870, 712, 110, 70, 85);
  shrub(990, 760, 90, 80, 88);
  put(F.pingao(81, 60, 'dry'), 760, 760);
  put(F.icePlant(89, 70, 'dry'), 900, 800);

  // ---- Mori's legs and boots at the bottom of the frame (he's sitting up, legs out on the sand):
  // dark trousers widening toward the viewer, the boots' laced tops and toe caps at the far end
  const TR = ['#10131c', '#171c28', '#1f2636', '#283044', '#323c54', '#3e4a66'].map(h => hex(h));
  const LEA = ['#24160e', '#3a2416', '#553620', '#704a2c', '#8c623a', '#a87c4e', '#c49a68'].map(h => hex(h));
  const LY = -28;
  for (const [bx, lean] of [[448, -0.22], [572, 0.2]] as const) {
    const top = 708 + LY, bot = H + PAD;
    dark(bx, top - 2, 30, 6, 0.2);
    for (let y = top; y < bot; y++) {
      const t = (y - top) / (bot - top);
      const cx = bx + lean * (y - top), hw = 20 + t * 44 + Math.sin(t * Math.PI) * 4;
      for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
        const u = (x - cx) / hw;
        const fold = Math.sin(y * 0.11 + u * 2 + bx) * 0.08;
        const l = 0.5 + u * 0.12 + Math.sqrt(Math.max(0, 1 - u * u)) * 0.12 + fold + (t > 0.35 && t < 0.5 ? 0.06 : 0);
        let c = TR[clamp(Math.round(l * 5 + (bayer(x, y) - 0.5) * 0.6), 0, 5)];
        if (Math.abs(u) > 0.94) c = TR[0];
        if (hash2(x, y, 96) < 0.015) c = hex('#c8aa78'); // sand stuck to the cloth
        set(x, y, c);
      }
    }
    // the cuff, then the boot: padded collar, laced vamp, the toe cap at the far end, the sole's rim
    for (let x = bx - 21; x <= bx + 21; x++) for (let y = 702 + LY; y < 712 + LY; y++) set(x, y, TR[(y + x) % 4 === 0 ? 1 : 2]);
    disc(bx, 686 + LY, 25, 21, (nx, ny, x, y) => {
      const d = Math.hypot(nx, ny);
      if (ny > 0.62) return -1;
      if (d > 0.86) return hex('#1a120c'); // the sole sticking out round the upper
      const l = 0.6 - nx * 0.1 - ny * 0.3 + (noise2(x / 3, y / 3, 97) - 0.5) * 0.18;
      let c = LEA[clamp(Math.round(l * 6 + (bayer(x, y) - 0.5) * 0.6), 0, 6)];
      if (ny < -0.45 && d < 0.6) c = LEA[clamp(Math.round(l * 6) + 1, 0, 6)]; // the scuffed toe cap
      return c;
    });
    for (let y = 682 + LY; y < 708 + LY; y++) for (let x = bx - 9; x <= bx + 9; x++) if (y > 690 + LY || Math.abs(x - bx) < 6) set(x, y, LEA[y > 700 + LY ? 1 : 2]); // tongue and collar
    for (let k = 0; k < 4; k++) {
      const y = 688 + LY + k * 4;
      for (let x = bx - 8; x <= bx + 8; x++) if ((x + y) % 2 === 0) set(x, y, hex('#d8c8a8'));
      set(bx - 9, y, hex('#c8c0b0')); set(bx + 9, y, hex('#c8c0b0'));
    }
    // the sun rims the toe caps
    for (let x = bx - 14; x <= bx + 14; x++) { const y = 686 + LY - Math.sqrt(Math.max(0, 1 - ((x - bx) / 21.5) ** 2)) * 21 * 0.86 + 1; blend(x, y, hex('#e8b880'), 0.6); }
    for (let k = 0; k < 12; k++) set(bx + rng.range(-18, 18), 666 + LY + rng.range(0, 24), hex('#e2c48c'));
  }
  return b;
}

export function droplet(r: number): PixelBuffer {
  const d = r * 2 + 2;
  const b = new PixelBuffer(d, d);
  for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) {
    const nx = (x + 0.5 - r - 1) / r, ny = (y + 0.5 - r - 1) / r;
    const q = nx * nx + ny * ny;
    if (q > 1) continue;
    const rim = q > 0.7;
    const hi = nx < -0.2 && ny < -0.2 && q < 0.35;
    b.data[y * d + x] = hi ? hex('#ffffff', 200) : rim ? hex('#1a3040', 110) : hex('#dff4ff', 46);
  }
  return b;
}

/** a little distant shore crab for the POV (two frames: legs in and out) */
export function povCrab(frame: number): PixelBuffer {
  const b = new PixelBuffer(14, 8);
  const set = (x: number, y: number, c: string) => { if (x >= 0 && y >= 0 && x < 14 && y < 8) b.data[y * 14 + x] = hex(c); };
  for (let y = 2; y < 6; y++) for (let x = 3; x < 11; x++) if (!((x === 3 || x === 10) && (y === 2 || y === 5))) set(x, y, y < 3 ? '#f08a4a' : y < 5 ? '#d0582a' : '#8a3018');
  set(5, 1, '#1a1010'); set(8, 1, '#1a1010');
  const o = frame ? 1 : 0;
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const x = s < 0 ? 2 - k : 11 + k; set(x, 4 + k - (k === 1 ? o : 0), '#b8421e'); set(x, 5 + k - (k === 1 ? o : 0), '#8a3018'); }
  set(2, 2, '#d0582a'); set(1, 1, '#f08a4a'); set(11, 2, '#d0582a'); set(12, 1, '#f08a4a');
  return b;
}

/**
 * Mori's right hand resting on the sand, palm down, seen from where he sits: the jacket cuff coming
 * in from the bottom of the frame, the back of the hand, four fingers spread toward the sea and the
 * thumb tucked in on the left. Frame 0 lies flat; frame 1 is the flinch, fingers curled up off the
 * sand. Anchored at the fingertips (POV_HAND).
 */
export function povHand(frame: 0 | 1): { buf: PixelBuffer; ax: number; ay: number } {
  const w = 76, h = 74, ax = 40, ay = 10;
  const b = new PixelBuffer(w, h);
  const SK = PAL.skin1;
  const SL = ['#0e1420', '#161e2e', '#1e283c', '#28344c', '#34425e', '#46567a'].map(h2 => hex(h2));
  const set = (x: number, y: number, c: C) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h) b.data[y * w + x] = c; };
  const curl = frame === 1;
  // the shadow on the sand (semi-transparent so the sand shows through)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = ((x - 38) / 30) ** 2 + ((y - 34) / 26) ** 2;
    if (d < 1 && !curl) b.data[y * w + x] = hex('#3a2a1a', Math.round(90 * (1 - d)));
  }
  const tube = (pts: [number, number][], r0: number, r1: number, rp: C[], lit0: number) => {
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
      for (let s = 0; s <= n; s++) {
        const t = (i - 1 + s / n) / (pts.length - 1);
        const cx = x0 + (x1 - x0) * (s / n), cy = y0 + (y1 - y0) * (s / n);
        const r = r0 + (r1 - r0) * t;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          const q = (dx * dx + dy * dy) / (r * r);
          if (q > 1) continue;
          // backlit by the low sun ahead: brightest along the far (upper) edges
          const l = lit0 + (-dy / r) * 0.22 + (dx / r) * 0.1 - q * 0.16 + (bayer(cx + dx, cy + dy) - 0.5) * 0.06;
          set(cx + dx, cy + dy, rp[clamp(Math.round(l * (rp.length - 1)), 0, rp.length - 1)]);
        }
      }
    }
  };
  // the cuff of the rain jacket coming in from the bottom of the frame
  tube([[46, h + 6], [42, 56]], 13, 12, SL, 0.45);
  for (let x = 30; x < 56; x++) set(x, 56 - Math.round(Math.sin((x - 30) / 26 * Math.PI) * 2) + 1, SL[5]);
  // the back of the hand: a broad pad from the wrist to the knuckles
  for (let y = 22; y < 58; y++) for (let x = 18; x < 64; x++) {
    const u = (x - 41) / (curl ? 18 : 19.5), v = (y - 42) / 14;
    if (Math.pow(Math.abs(u), 2.6) + Math.pow(Math.abs(v), 2.2) > 1) continue;
    const tendon = Math.abs(((x - 26) / 6) % 1 - 0.5) < 0.08 && y < 40 ? -0.07 : 0;
    const l = 0.56 - v * 0.2 + u * 0.05 - (u * u + v * v) * 0.12 + tendon + (bayer(x, y) - 0.5) * 0.06;
    set(x, y, SK[clamp(Math.round(l * 6), 0, 6)]);
  }
  // fingers: index to little finger fanning out toward the sea (curled: drawn up short and knuckled)
  const fingers: [number, number, number, number][] = [[29, 31, -0.12, 19], [37.5, 29, -0.03, 21], [46, 29.5, 0.06, 20], [54, 32, 0.17, 16]];
  for (const [fx, fy, a, len] of fingers) {
    const L2 = curl ? len * 0.45 : len;
    const ex = fx + Math.sin(a) * L2, ey = fy - Math.cos(a) * L2;
    const mx = fx + Math.sin(a) * L2 * 0.5, my = fy - Math.cos(a) * L2 * 0.5 - (curl ? 3 : 0);
    tube([[fx, fy], [mx, my], [ex, ey]], 4.2, 3.3, SK, curl ? 0.6 : 0.52);
    if (!curl) {
      // the nail at the tip, and a crease at each knuckle
      set(ex, ey + 1, SK[6]); set(ex + 1, ey + 1, SK[5]);
      for (const t of [0.35, 0.68]) set(fx + Math.sin(a) * L2 * t, fy - Math.cos(a) * L2 * t, SK[2]);
    }
    set(fx, fy + 1, SK[3]);
  }
  // the thumb, tucked along the inside
  tube([[25, 48], [18, 40], [14, 33]], 4.6, 3.6, SK, 0.5);
  // sand stuck to the skin, a graze across the knuckles from the wreck
  for (let i = 0; i < 26; i++) { const x = 20 + ((i * 37) % 40), y = 24 + ((i * 23) % 30); if (b.data[y * w + x] >>> 24 === 255) set(x, y, hex(i % 3 ? '#e8cc96' : '#c8a878')); }
  for (let x = 32; x < 50; x++) if ((x * 7) % 5 < 3) set(x, 30 + (x % 3 === 0 ? 1 : 0), hex('#a83a2a'));
  return { buf: b, ax, ay };
}

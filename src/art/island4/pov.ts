// V4 island art: the first-person view from the sand after the wreck. Lying on the beach looking up:
// sky, a faint rainbow, palm fronds (wake.ts), a flax and toetoe clump on the left and a leaning
// pōhutukawa on the right framing the view. Sitting up: the sea, the basalt headland to the west with
// what's left of the Kittiwake beached at its foot (holed, mast snapped, smoking), the palm point to
// the east, the shore break and the glassy swash zone, then the near beach strewn with the boat's
// debris (the name board, the life ring, a split crate of Chunky Chow, the torn tarp, rope, planks, a
// bottle, Mori's camera), kelp, shells and spinifex, and Mori's own boots at the bottom of the frame.
//
// The painting is POV_W x POV_H in content coordinates with a POV_PAD margin all round (so breathing,
// the roll while sitting up and wide screens never show an edge); the buffer origin is (-PAD, -PAD).

import { PixelBuffer } from '../pixel';
import { hex, mix, shade, C } from '../color';
import * as L from '../landscape';
import { Rng, bayer, clamp, noise1, noise2, fbm1, fbm2, hash2, smoothstep } from '../../core/math';
import { text, leafStamp, drawStamp } from '../jungle-core';
import type { Sprite } from '../jungle-core';
import { paintHeadland } from '../v9/headland';
import * as D from '../v9/beach-debris';
import * as Wr from '../v9/beach-wrack';
import * as F from '../v9/beach-flora';

export const POV_W = 1000, POV_H = 800, POV_PAD = 48, POV_HORIZON = 452, POV_SHORE = 566, POV_WET = 616;
const W = POV_W, H = POV_H, PAD = POV_PAD, HORIZON = POV_HORIZON, SHORE = POV_SHORE;
/** the shoreline curves away up the beach toward the headland on the left */
export const povShore = (x: number) => SHORE - Math.max(0, 430 - x) * 0.22 - (noise1(x / 60, 31) - 0.5) * 4;

export function paintPOV(): PixelBuffer {
  const b = new PixelBuffer(W + PAD * 2, H + PAD * 2);
  const rng = new Rng(41);
  const set = (x: number, y: number, c: C) => { x = Math.round(x) + PAD; y = Math.round(y) + PAD; if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.data[y * b.w + x] = c; };
  const get = (x: number, y: number) => b.data[clamp(Math.round(y) + PAD, 0, b.h - 1) * b.w + clamp(Math.round(x) + PAD, 0, b.w - 1)];
  const blend = (x: number, y: number, c: C, k: number) => set(x, y, mix(get(x, y), c, k));
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
  const put = (s: Sprite, x: number, y: number, flip = false) => {
    for (let j = 0; j < s.buf.h; j++) for (let i = 0; i < s.buf.w; i++) {
      const c = s.buf.data[j * s.buf.w + (flip ? s.buf.w - 1 - i : i)];
      if (!(c >>> 24)) continue;
      const X = x - (flip ? s.buf.w - 1 - s.ax : s.ax) + i, Y = y - s.ay + j;
      if ((c >>> 24) < 255) blend(X, Y, c | 0xff000000, (c >>> 24) / 255); else set(X, Y, c);
    }
  };
  const X0 = -PAD, X1 = W + PAD;

  // ---- sky: deep zenith to hazy horizon, washed clean after the storm, a faint rainbow to the east
  const sky = ['#1a4e9e', '#2260ae', '#2e72be', '#3e86cc', '#5098d4', '#68aadc', '#86bee4', '#a8d2ea', '#c8e4f0'].map(h => hex(h));
  for (let y = -PAD; y < HORIZON; y++) {
    const t = Math.pow(clamp((y + PAD) / (HORIZON + PAD)), 1.2);
    for (let x = X0; x < X1; x++) set(x, y, sky[clamp(Math.round(t * (sky.length - 1) + (bayer(x, y) - 0.5) * 0.8), 0, sky.length - 1)]);
  }
  for (let i = 0; i < 18; i++) {
    const cx = rng.range(X0, X1), cy = rng.range(10, 300), len = rng.range(50, 160);
    for (let k = 0; k < len; k++) { const x = cx + k, y = cy + Math.sin(k * 0.05 + i) * 3 + k * 0.04; if ((k + i) % 3) blend(x, y, hex('#ffffff'), 0.26 * Math.sin((k / len) * Math.PI)); }
  }
  const bands = ['#ff6a6a', '#ffaa5a', '#ffe070', '#8ae07a', '#6ab0ff', '#9a7aff'].map(h => hex(h));
  for (let y = 0; y < HORIZON; y++) for (let x = 420; x < X1; x++) {
    const d = Math.hypot(x - 760, (y - 520) * 1.05), k = (360 - d) / 12;
    if (k < 0 || k >= 1) continue;
    blend(x, y, bands[Math.floor(k * bands.length)], 0.18 * Math.sin(k * Math.PI) * smoothstep(80, 300, HORIZON - y + 60));
  }

  // ---- the far archipelago: a volcano and islands in blue haze on the horizon
  const ridge = L.paintRidge(W + PAD * 2, 70, { seed: 17, base: 60, amp: 22, freq: 0.012, body: hex('#6a8cb0'), lit: hex('#86a6c4'), shadow: hex('#587898'), fogTo: hex('#a8c8e0'), fogStart: 30, peaks: [{ x: 640 + PAD, h: 58, w: 70, cone: true }, { x: 860 + PAD, h: 30, w: 60 }], sharp: 0.6 });
  for (let y = 0; y < 70; y++) for (let x = 0; x < ridge.w; x++) { const c = ridge.data[y * ridge.w + x]; if (c >>> 24 && x - PAD > 470) set(x - PAD, HORIZON - 66 + y, c); }
  for (let k = 0; k < 40; k++) { const x = 640 + Math.sin(k * 0.3) * 3 + k * 0.6, y = HORIZON - 58 - k * 1.4; blend(x, y, hex('#e8eef4'), 0.5); blend(x + 1, y, hex('#e8eef4'), 0.3); }

  // ---- the sea: haze at the horizon to turquoise over the sand, broken crests, the sun's glitter
  for (let y = HORIZON; y < SHORE + 8; y++) {
    const t = clamp((y - HORIZON) / (SHORE - HORIZON));
    const sc = 0.3 + t * 1.7;
    for (let x = X0; x < X1; x++) {
      let c = mix(hex('#6aa8c8'), hex('#1c74a0'), Math.pow(t, 0.55));
      if (t > 0.66) c = mix(c, hex('#38b6b6'), (t - 0.66) / 0.34);
      const n = noise2(x / (16 * sc), y / (1.2 + t * 2.4), 5), n2 = noise2(x / (70 * sc), y / 5, 9);
      if (n > 0.84 - n2 * 0.12) c = mix(c, hex('#eafafc'), 0.3 + t * 0.4);
      else if (n > 0.74 - n2 * 0.1) c = mix(c, hex('#8ad6e0'), 0.25);
      else if (n < 0.14) c = shade(c, -0.07);
      const glit = Math.exp(-(((x - 540) / (50 + t * 140)) ** 2));
      if (hash2(x, y, 3) < glit * 0.07 * (1 - t * 0.5)) c = mix(c, hex('#ffffff'), 0.85);
      set(x, y, c);
    }
  }
  // the palm point to the east: a low sandy spit with leaning palms and bush, surf at its foot
  for (let x = 700; x < X1; x++) {
    const top = HORIZON - 4 - smoothstep(700, 860, x) * 12 - (noise1(x / 14, 33) - 0.5) * 4;
    for (let y = Math.round(top); y < HORIZON + 8; y++) set(x, y, y - top < 3 ? hex('#4e7a46') : mix(hex('#3a5a3a'), hex('#c8b890'), smoothstep(HORIZON + 2, HORIZON + 8, y)));
    if (rng.next() < 0.5) set(x, HORIZON + 6 + rng.range(0, 2), hex('#ffffff'));
  }
  for (const [px, ph, lean] of [[760, 30, -0.3], [800, 38, 0.25], [846, 26, -0.15], [905, 42, 0.3], [962, 34, -0.2]] as const) {
    const base = HORIZON - 8 - smoothstep(700, 860, px) * 10;
    for (let k = 0; k < ph; k++) set(px + lean * k * k / ph, base - k, k % 4 ? hex('#5a4a3a') : hex('#6e5a46'));
    const tx = px + lean * ph, ty = base - ph;
    for (let f = 0; f < 7; f++) {
      const a = -Math.PI * 0.95 + f * (Math.PI * 0.9 / 6);
      for (let s = 0; s < 12; s++) { const x = tx + Math.cos(a) * s, y = ty + Math.sin(a) * s * 0.6 + s * s * 0.03; set(x, y, s < 9 ? hex('#2e5a2e') : hex('#3e6e34')); }
    }
  }
  // ---- the headland to the west, the beach curving away to its foot
  const hd = paintHeadland(470, 170, 11, 0.86);
  for (let j = 0; j < hd.buf.h; j++) for (let i = 0; i < hd.buf.w; i++) {
    const c = hd.buf.data[j * hd.buf.w + i];
    if (c >>> 24) set(X0 + i, HORIZON + 54 - hd.buf.h + j, mix(c, hex('#9ab8cc'), 0.12));
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
        c = mix(base, refl, 0.6 * (1 - k * 0.75));
        if (noise2(x / 38, y / 1.6, 11) > 0.74) c = mix(c, hex('#ffffff'), 0.2);
        if (Math.abs(dd - wetD * 0.6 - Math.sin(x * 0.03) * 4) < 0.7 && noise1(x / 6, 12) > 0.4) c = mix(c, hex('#f4f8f4'), 0.5);
      } else {
        const t = clamp((dd - wetD) / 220);
        c = mix(hex('#ecd092'), hex('#c89a60'), Math.pow(t, 0.8) * 0.75);
        const rip = Math.sin((dd - wetD) / (2 + near * 7) * 2.4 + fbm2(x / 90, y / 40, 2, 4) * 6);
        if (rip > 0.88) c = shade(c, -0.08); else if (rip > 0.74) c = shade(c, 0.04);
        if (rip < -0.9 && fbm2(x / 120, y / 30, 2, 18) > 0.55) c = mix(c, hex('#5a5048'), 0.25); // ironsand in the troughs
        if (dd - wetD < 6 && bayer(x, y) > (dd - wetD) / 6) c = mix(c, hex('#a89070'), 0.5);
        const s = near > 0.7 ? 2 : 1, g = hash2(Math.floor(x / s), Math.floor(y / s), 8);
        if (g < 0.035) c = shade(c, -0.06); else if (g > 0.978) c = shade(c, 0.08);
        if (g > 0.9992) c = hex('#f8f0e8');
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

  // ---- the Kittiwake, beached at the foot of the headland: listing, holed, mast snapped, smoking
  const wx = 150, wy = 532, WL = 230;
  const deckY = (i: number) => wy - 26 - i * 0.12 - Math.max(0, i - (WL - 40)) * 0.5;
  const keelY = (i: number) => wy + 2 - i * 0.05;
  for (let i = 0; i < WL; i++) {
    const x = wx + i, top = deckY(i), bot = keelY(i);
    const k = i < 10 ? i / 10 : i > WL - 14 ? (WL - i) / 14 : 1;
    const t0 = Math.round(bot - (bot - top) * (0.4 + k * 0.6));
    const tear = i > WL - 30 && noise1(i / 3, 40) * 30 < i - (WL - 30);
    for (let y = t0; y <= Math.round(bot); y++) {
      if (tear && y < bot - 4) { set(x, y, hex('#1a1614')); continue; }
      const d = y - t0, fromBot = Math.round(bot) - y;
      let c = d === 0 ? hex('#7a7468') : d < 2 ? hex('#b8b0a0') : hex('#e6e0d0');
      if (fromBot < 5) c = fromBot < 2 ? hex('#5a2620') : hex('#a8402e');
      else if (fromBot === 5) c = hex('#2a3a5a');
      if (i % 26 === 0 && d > 1 && fromBot > 5) c = hex('#cac2b0');
      if (d > 2 && hash2(x, y, 41) < 0.03) c = hex('#a07a5a');
      set(x, y, c);
    }
  }
  for (let i = 0; i < WL; i++) { const sx = wx + i; for (let y = keelY(i) - 3 - noise1(i / 12, 42) * 6; y <= keelY(i) + 2; y++) set(sx, y, mix(hex('#e2c48e'), hex('#c8a670'), clamp((y - keelY(i) + 6) / 8))); }
  disc(wx + 84, wy - 13, 11, 6, (nx, ny) => (Math.hypot(nx, ny) > 0.8 ? hex('#8a8272') : ny > 0.2 ? hex('#141414') : hex('#262422')));
  for (const [hx, hy] of [[wx + 40, wy - 16], [wx + 132, wy - 14]] as const) disc(hx, hy, 3, 3, (nx, ny) => (Math.hypot(nx, ny) > 0.7 ? hex('#5a5048') : hex('#2e3a48')));
  for (let k = 0; k < 30; k++) set(wx + 100 + k * 0.28, deckY(100) - 1 - k, hex('#4a4440'));
  for (let k = 0; k < 26; k++) set(wx + 108 + k * 0.9, deckY(108) - 30 + k * 1.1, hex('#5a5450'));
  for (let k = 0; k < 7; k++) set(wx + 130 + k, deckY(130) - 12 + (k % 2), hex('#c8402e'));
  // the ensign staff at the stern, the name on the quarter
  for (let k = 0; k < 16; k++) set(wx + 4, deckY(4) - k, hex('#5a5048'));
  for (let y = 0; y < 5; y++) for (let x = 0; x < 8; x++) set(wx + 5 + x, deckY(4) - 15 + y + (x > 4 ? 1 : 0), (x + y) % 3 ? hex('#c8402e') : hex('#e8e2d4'));
  text(b, wx + 30 + PAD, deckY(30) + 7 + PAD, 'KITTIWAKE', hex('#2e3c5c'), 3);
  for (let k = 0; k < 110; k++) {
    const x = wx + 60 + Math.sin(k * 0.22) * (2 + k * 0.08) + k * 0.5, y = deckY(60) - 4 - k;
    for (let j = -1; j <= 1 + Math.floor(k / 30); j++) blend(x + j, y, hex('#4a4a52'), 0.5 - k / 240);
  }
  dark(wx + WL / 2, keelY(WL / 2) + 3, WL * 0.55, 4, 0.12);

  // ---- the near beach: the Kittiwake's debris, wrack and shells (bigger toward the viewer)
  const kelpA = Wr.kelpHeap(51, 120, 'none'), kelpB = Wr.kelpHeap(52, 80, 'none');
  put(kelpB, 700, 612);
  put(Wr.kelpStrand(53, 150, 'none'), 360, 628);
  put(D.driftLog(54, 240, 'wet'), 160, 640, true);
  put(D.crate(55, 'damp', 64, 40), 640, 650);
  put(D.tarp(56, 220, 'tarp', 'dry'), 430, 730);
  put(D.plank(57, 160, 'hull', 'dry', -0.12), 250, 700);
  put(D.plank(58, 120, 'deck', 'dry', 0.18), 780, 706);
  put(D.rope(59, 260, 'dry'), 560, 742);
  put(D.floats(60, 'damp'), 820, 640);
  put(kelpA, 90, 668);
  put(Wr.shellScatter(61, 120, 26), 520, 690);
  put(Wr.shellScatter(62, 90, 18), 330, 660);
  put(Wr.shellScatter(63, 70, 14), 720, 728);
  for (const [k, x, y] of [['paua', 600, 700], ['crab', 470, 676], ['star', 300, 742], ['dollar', 690, 690], ['kina', 760, 672], ['cuttle', 410, 664], ['feather', 560, 668], ['jelly', 520, 632]] as const) put(Wr.find(k, x, 'dry'), x, y);
  // the life ring, half-buried, a big version for up close
  const lrx = 335, lry = 690, R = 30, r0 = 14;
  dark(lrx + 6, lry + 22, R * 1.2, 7, 0.16);
  disc(lrx, lry, R, R * 0.9, (nx, ny, x, y) => {
    const d = Math.hypot(nx, ny);
    if (d < r0 / R || ny > 0.62 + noise1(x / 6, 70) * 0.12) return -1;
    if (d > 0.95) return hex('#5a2a20');
    const seg = Math.floor((Math.atan2(ny, nx) + Math.PI) / (Math.PI / 2) + 0.5) % 2;
    const m = (d - r0 / R) / (1 - r0 / R);
    const l = 0.62 - (m - 0.5) * (ny < 0 ? -0.5 : 0.5) - ny * 0.25 + (hash2(x, y, 71) - 0.5) * 0.08;
    const rp = seg ? ['#5e1810', '#8a2a1e', '#b8402c', '#d85a40', '#f08060'] : ['#8a8478', '#b4ae9e', '#d8d2c2', '#efeade', '#ffffff'];
    return hex(rp[clamp(Math.round(l * 4), 0, 4)]);
  });
  for (let k = 0; k < 4; k++) for (let t = 0; t <= 1; t += 0.02) { const a = k * Math.PI / 2 - Math.PI * 0.8 + t * (Math.PI / 2 - 0.5); const rr = R + 2 + Math.sin(t * Math.PI) * 4; if (Math.sin(a) < 0.6) set(lrx + Math.cos(a) * rr, lry + Math.sin(a) * rr * 0.9, t % 0.08 < 0.04 ? hex('#8a6c44') : hex('#d0b27a')); }
  for (let x = lrx - R - 8; x < lrx + R + 8; x++) { const y = lry + R * 0.56 + Math.sin(x * 0.2) * 1.5; set(x, y, hex('#f0d8a2')); set(x, y + 1, hex('#e2c48c')); }
  // the name board torn off the transom, big gilt letters on dark varnish
  const nbx = 640, nby = 742, NBW = 92, NBH = 20;
  dark(nbx + NBW / 2 + 4, nby + NBH + 2, NBW * 0.6, 5, 0.18);
  for (let y = 0; y < NBH; y++) for (let x = 0; x < NBW; x++) {
    const endX = NBW - 4 - Math.abs(noise1(y * 0.6, 21) - 0.5) * 16;
    if (x > endX) continue;
    const g = (noise2(x / 12, y * 0.8, 22) - 0.5) * 0.3;
    const edge = y >= NBH - 3;
    const rp = ['#1e120a', '#301c10', '#472a16', '#5e3a1e', '#7a4e2a', '#96663a'];
    let c = hex(rp[clamp(Math.round((edge ? 0.15 : 0.55 + g - (y < 1 ? 0.3 : 0) + (y === 1 ? 0.3 : 0)) * 5), 0, 5)]);
    if (!edge && noise2(x / 6, y / 3, 23) > 0.76) c = mix(c, hex('#9a8a70'), 0.4);
    set(nbx + x, nby + y + Math.round(Math.sin((x / NBW) * Math.PI) * -2), c);
  }
  text(b, nbx + 9 + 1 + PAD, nby + 6 + 1 + PAD, 'KITTIWAKE', hex('#140a06'), 5, { spacing: 1 });
  text(b, nbx + 9 + PAD, nby + 6 + PAD, 'KITTIWAKE', hex('#e8bc4a'), 5, { spacing: 1 });
  for (let x = nbx + 8; x < nbx + 70; x++) for (let y = nby + 5; y < nby + 14; y++) if (get(x, y) === hex('#e8bc4a') && get(x, y - 1) !== hex('#e8bc4a')) set(x, y, hex('#ffe28e'));
  for (let x = nbx; x < nbx + NBW * 0.8; x++) { const y = nby + NBH - 1 + Math.sin(x * 0.3) * 1.2; set(x, y, hex('#e8cc96')); set(x, y + 1, hex('#d8b880')); }
  // a bottle with a message, Mori's camera on its strap
  const btx = 560, bty = 640;
  for (let x = 0; x < 26; x++) { const neck = x > 17, r = neck ? 2 : 4; for (let y = -r; y <= r; y++) set(btx + x, bty + y, hex(['#0e2a18', '#18462a', '#28683e', '#4c9464', '#a8e0bc'][clamp(2 - Math.round(y / 1.4) + (neck ? 0 : 1), 0, 4)])); }
  for (let x = 4; x < 14; x++) { set(btx + x, bty + 1, hex('#e8dcb8')); set(btx + x, bty + 2, hex('#d8c8a0')); }
  set(btx + 26, bty, hex('#8a6a40')); set(btx + 27, bty, hex('#6a4a2a'));
  for (let x = 4; x < 12; x++) set(btx + x, bty - 3, hex('#d8f4e0'));
  dark(314 - 230, 738, 18, 4, 0.2);
  const cmx = 82, cmy = 720;
  for (let y = 0; y < 18; y++) for (let x = 0; x < 30; x++) set(cmx + x, cmy + y, y < 2 ? hex('#6a6a74') : x > 21 ? hex('#2a2a30') : hex('#3a3a44'));
  disc(cmx + 20, cmy + 9, 6, 6, (nx, ny) => (Math.hypot(nx, ny) > 0.6 ? hex('#1a1a20') : nx + ny < -0.3 ? hex('#bfeaff') : hex('#4a8ab0')));
  for (let k = 0; k < 50; k++) set(cmx - 2 - k * 1.4, cmy + 4 + Math.sin(k * 0.3) * 3, hex('#2a2a30'));
  // crab and bird tracks wandering across the sand
  for (let k = 0; k < 60; k++) { const x = 260 + k * 6 + Math.sin(k * 0.4) * 8, y = 668 + Math.sin(k * 0.17) * 18; for (const s2 of [-1, 1]) { blend(x - 1, y + s2 * 3, hex('#8a6a40'), 0.35); blend(x + 1, y + s2 * 3 + 1, hex('#8a6a40'), 0.35); } }
  for (let k = 0; k < 14; k++) { const x = 640 + k * 14, y = 676 + Math.sin(k * 0.6) * 6; for (const [dx, dy] of [[0, 0], [-2, -2], [2, -2], [0, -3]]) blend(x + dx, y + dy, hex('#8a6a40'), 0.4); }

  // ---- the framing plants: a flax and toetoe clump on the left, a leaning pōhutukawa on the right
  put(F.spinifex(80, 70, 'dry', 2), 300, 800);
  put(F.pingao(81, 50, 'dry'), 900, 790);
  put(F.toetoe(82, 130, 'dry', 4), 170, 820);
  put(F.harakeke(83, 300, 'dry', 2), 60, 880);
  put(F.pingao(84, 80, 'dry'), 230, 820, true);
  // the pōhutukawa: a gnarled trunk leaning in from the right edge, branches across the top
  const trunk: [number, number][] = [];
  for (let i = 0; i <= 30; i++) { const t = i / 30; trunk.push([1040 - t * 150 - Math.sin(t * 3) * 20, 860 - t * 640]); }
  for (let i = 0; i < trunk.length; i++) {
    const [tx, ty] = trunk[i], r = 34 - i * 0.62 + Math.sin(i * 0.9) * 2;
    for (let y = ty - 12; y < ty + 12; y++) for (let x = tx - r; x <= tx + r; x++) {
      const u = (x - tx) / r;
      const bark = noise2(x / 3, y / 14, 90);
      const l = 0.5 - u * 0.35 + (bark - 0.5) * 0.5;
      set(x, y, hex(['#1a1210', '#2a1e18', '#3a2a20', '#4e3a2c', '#64503c', '#7a6650'][clamp(Math.round(l * 5 + (bayer(x, y) - 0.5) * 0.8), 0, 5)]));
    }
  }
  const limb = (x0: number, y0: number, a: number, len: number, r0: number) => {
    let x = x0, y = y0;
    const pts: [number, number, number][] = [];
    for (let s = 0; s < len; s += 2) { a += Math.sin(s * 0.03 + x0) * 0.02; x += Math.cos(a) * 2; y += Math.sin(a) * 2; pts.push([x, y, r0 * (1 - s / len) + 1.5]); }
    for (const [px, py, r] of pts) disc(px, py, r, r, (nx, ny) => hex(ny < -0.3 ? '#5a4634' : nx > 0.4 ? '#22180f' : '#3a2a20'));
    return pts;
  };
  const tips = [...limb(900, 260, Math.PI * 1.08, 360, 12), ...limb(880, 380, Math.PI * 1.15, 220, 9), ...limb(930, 200, Math.PI * 1.25, 260, 8)];
  // the canopy seen from beneath against the sky: dark undersides of leaf clusters, sky showing
  // through, the lit upper leaves at the rims and crimson pom-pom flowers out at the tips
  const LEAF = ['#09140e', '#0e1e14', '#14281a', '#1c3622', '#26462a', '#345a32', '#467038'].map(h => hex(h));
  for (let k = 0; k < 150; k++) {
    const [px, py] = tips[Math.floor(rng.next() * tips.length)];
    const cx = px + rng.range(-34, 34), cy = py + rng.range(-26, 26), r = rng.range(9, 20);
    for (let n = 0; n < r * 5; n++) {
      const a = rng.range(0, Math.PI * 2), d = Math.sqrt(rng.next()) * r;
      const x = cx + Math.cos(a) * d * 1.3, y = cy + Math.sin(a) * d;
      const lit = clamp(0.45 - (y - cy) / r * 0.35 - (x - cx) / r * 0.12 + rng.range(-0.15, 0.15));
      drawStamp(b, leafStamp('oval', rng.range(5, 8), rng.range(2.6, 3.6), rng.range(0, Math.PI)), x + PAD, y + PAD, LEAF, Math.round(lit * 6));
    }
    if (rng.chance(0.5)) for (let f = 0; f < 3; f++) {
      const fx = cx + rng.range(-r, r), fy = cy - r * rng.range(0.4, 1);
      disc(fx, fy, 3.2, 2.6, (nx, ny) => hex(ny < -0.3 ? '#ff6a5a' : nx > 0.3 ? '#a8182a' : '#e0303a'));
      set(fx, fy - 2, hex('#ffd24a')); set(fx - 1, fy - 1, hex('#ffd24a'));
    }
  }
  put(F.taupata(85, 110, 'dry'), 880, 830);

  // ---- Mori's legs and boots at the bottom of the frame (he's sitting up, legs out on the sand):
  // dark trousers widening toward the viewer, the boots' laced tops and toe caps at the far end
  const TR = ['#10131c', '#171c28', '#1f2636', '#283044', '#323c54', '#3e4a66'].map(h => hex(h));
  const LEA = ['#24160e', '#3a2416', '#553620', '#704a2c', '#8c623a', '#a87c4e', '#c49a68'].map(h => hex(h));
  for (const [bx, lean] of [[448, -0.22], [572, 0.2]] as const) {
    const top = 708, bot = H + PAD;
    for (let y = top; y < bot; y++) {
      const t = (y - top) / (bot - top);
      const cx = bx + lean * (y - top), hw = 20 + t * 44 + Math.sin(t * Math.PI) * 4;
      for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
        const u = (x - cx) / hw;
        const fold = Math.sin(y * 0.11 + u * 2 + bx) * 0.08;
        const l = 0.5 - u * 0.32 + Math.sqrt(Math.max(0, 1 - u * u)) * 0.12 + fold + (t > 0.35 && t < 0.5 ? 0.06 : 0);
        let c = TR[clamp(Math.round(l * 5 + (bayer(x, y) - 0.5) * 0.6), 0, 5)];
        if (Math.abs(u) > 0.94) c = TR[0];
        if (hash2(x, y, 96) < 0.015) c = hex('#c8aa78'); // sand stuck to the cloth
        set(x, y, c);
      }
    }
    // the cuff, then the boot: padded collar, laced vamp, the toe cap at the far end, the sole's rim
    for (let x = bx - 21; x <= bx + 21; x++) for (let y = 702; y < 712; y++) set(x, y, TR[(y + x) % 4 === 0 ? 1 : 2]);
    disc(bx, 686, 25, 21, (nx, ny, x, y) => {
      const d = Math.hypot(nx, ny);
      if (ny > 0.62) return -1;
      if (d > 0.86) return hex('#1a120c'); // the sole sticking out round the upper
      const l = 0.6 - nx * 0.3 - ny * 0.25 + (noise2(x / 3, y / 3, 97) - 0.5) * 0.18;
      let c = LEA[clamp(Math.round(l * 6 + (bayer(x, y) - 0.5) * 0.6), 0, 6)];
      if (ny < -0.45 && d < 0.6) c = LEA[clamp(Math.round(l * 6) + 1, 0, 6)]; // the scuffed toe cap
      return c;
    });
    for (let y = 682; y < 708; y++) for (let x = bx - 9; x <= bx + 9; x++) if (y > 690 || Math.abs(x - bx) < 6) set(x, y, LEA[y > 700 ? 1 : 2]); // tongue and collar
    for (let k = 0; k < 4; k++) {
      const y = 688 + k * 4;
      for (let x = bx - 8; x <= bx + 8; x++) if (Math.abs((x - bx) - (k % 2 ? 1 : -1) * (x - bx)) < 20 && (x + y) % 2 === 0) set(x, y, hex('#d8c8a8'));
      set(bx - 9, y, hex('#c8c0b0')); set(bx + 9, y, hex('#c8c0b0'));
    }
    for (let k = 0; k < 12; k++) set(bx + rng.range(-18, 18), 666 + rng.range(0, 24), hex('#e2c48c'));
  }
  void fbm1;
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

/** a little shore crab for the POV (two frames: legs in and out) */
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

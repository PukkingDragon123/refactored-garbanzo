// V4 island art: the first-person view from the sand after the wreck. Looking up at the sky with
// palm fronds overhead, then sitting up to the sea, the headland, and the Kittiwake up on the rocks,
// with the debris scattered over the wet mirror sand.

import { PixelBuffer } from '../pixel';
import { hex, mix, shade, C } from '../color';
import * as L from '../landscape';
import { Rng, bayer, clamp, noise1, noise2, fbm2, hash2 } from '../../core/math';

export const POV_W = 720, POV_H = 780, POV_HORIZON = 452;
const W = POV_W, H = POV_H, HORIZON = POV_HORIZON;

export function paintPOV(): PixelBuffer {
  const b = new PixelBuffer(W, H);
  const rng = new Rng(41);
  const set = (x: number, y: number, c: C) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) b.data[y * W + x] = c; };
  const get = (x: number, y: number) => b.data[clamp(Math.round(y), 0, H - 1) * W + clamp(Math.round(x), 0, W - 1)];
  const disc = (cx: number, cy: number, rx: number, ry: number, fn: (nx: number, ny: number) => C | -1) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const nx = (x - cx) / rx, ny = (y - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const c = fn(nx, ny);
      if (c !== -1) set(x, y, c);
    }
  };
  // ---- sky: deep zenith to hazy horizon, washed clean after the storm
  const sky = ['#1e56a8', '#2a68b8', '#3a7cc8', '#4e92d4', '#68a8dc', '#86bee4', '#a8d2ea', '#c8e4f0'].map(h => hex(h));
  for (let y = 0; y < HORIZON; y++) {
    const t = Math.pow(y / HORIZON, 1.25);
    for (let x = 0; x < W; x++) set(x, y, sky[clamp(Math.round(t * (sky.length - 1) + (bayer(x, y) - 0.5) * 0.8), 0, sky.length - 1)]);
  }
  // high cirrus streaks
  for (let i = 0; i < 14; i++) {
    const cx = rng.range(0, W), cy = rng.range(30, 260), len = rng.range(40, 120);
    for (let k = 0; k < len; k++) { const x = cx + k, y = cy + Math.sin(k * 0.05) * 3; if ((k + i) % 3) set(x, y, mix(get(x, y), hex('#ffffff'), 0.28)); }
  }
  // ---- distant archipelago: a volcano and islands in blue haze on the horizon
  const ridge = L.paintRidge(W, 70, { seed: 17, base: 60, amp: 22, freq: 0.012, body: hex('#6a8cb0'), lit: hex('#86a6c4'), shadow: hex('#587898'), fogTo: hex('#a8c8e0'), fogStart: 30, peaks: [{ x: 160, h: 58, w: 70, cone: true }, { x: 380, h: 30, w: 60 }], sharp: 0.6 });
  for (let y = 0; y < 70; y++) for (let x = 0; x < W; x++) { const c = ridge.data[y * W + x]; if (c >>> 24 && (x < 430 || x > 700)) set(x, HORIZON - 70 + y + 4, c); }
  for (let k = 0; k < 40; k++) { const x = 160 + Math.sin(k * 0.3) * 3 + k * 0.6, y = HORIZON - 62 - k * 1.4; set(x, y, mix(get(x, y), hex('#e8eef4'), 0.5)); set(x + 1, y, mix(get(x + 1, y), hex('#e8eef4'), 0.3)); }
  // ---- the sea: hazy blue at the horizon to turquoise over the sand, broken crests that grow toward
  // the shore, and a column of sun glitter
  const SHORE = 566;
  for (let y = HORIZON; y < SHORE; y++) {
    const t = (y - HORIZON) / (SHORE - HORIZON);
    const sc = 0.3 + t * 1.7;
    for (let x = 0; x < W; x++) {
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
  // headland at the right: cliffs with bush on top, surf at the base
  for (let x = 596; x < W; x++) {
    const top = HORIZON - 26 - Math.sin((x - 596) * 0.035) * 14 - (x - 596) * 0.4 + Math.sin(x * 0.3) * 1.5;
    for (let y = Math.round(top); y < HORIZON + 14; y++) {
      const d = y - top;
      let c = d < 5 ? mix(hex('#3a6a3a'), hex('#5a8a4a'), bayer(x, y)) : mix(hex('#6a6458'), hex('#3a3834'), clamp(d / 50));
      if (d >= 5 && ((x + Math.floor(y / 3)) % 11 === 0)) c = shade(c, -0.12);
      set(x, y, c);
    }
    if (rng.next() < 0.5) set(x, HORIZON + 12 + rng.range(0, 3), hex('#ffffff'));
  }
  // ---- the wreck of the Kittiwake up on the rocks: listing, bow in the air, holed, mast snapped, smoking
  const wx = 432, wy = HORIZON + 8, WL = 150;
  const deckY = (i: number) => wy - 17 - i * 0.16 - Math.max(0, i - (WL - 30)) * 0.55;
  const keelY = (i: number) => wy + 1 - i * 0.07;
  for (const [cx, r] of [[wx + 20, 7], [wx + 74, 10], [wx + 120, 8], [wx + 150, 5]] as const)
    disc(cx, wy + 2, r * 1.7, r, (nx, ny) => (ny > 0.4 ? -1 : mix(hex('#2e2a28'), hex('#5e5850'), clamp(-ny - nx * 0.3))));
  for (let i = 0; i < WL; i++) {
    const x = wx + i, top = deckY(i), bot = keelY(i);
    const k = i < 8 ? i / 8 : i > WL - 10 ? (WL - i) / 10 : 1;
    const t0 = Math.round(bot - (bot - top) * (0.4 + k * 0.6));
    for (let y = t0; y <= Math.round(bot); y++) {
      const d = y - t0, fromBot = Math.round(bot) - y;
      let c = d === 0 ? hex('#7a7468') : d < 2 ? hex('#b8b0a0') : hex('#e6e0d0');
      if (fromBot < 4) c = fromBot < 2 ? hex('#5a2620') : hex('#a8402e');
      else if (fromBot === 4) c = hex('#2a3a5a');
      if (i % 24 === 0 && d > 1 && fromBot > 4) c = hex('#cac2b0');
      set(x, y, c);
    }
  }
  // the breach: a torn dark hole with bent plates
  disc(wx + 58, wy - 9, 9, 4.5, (nx, ny) => (Math.hypot(nx, ny) > 0.8 ? hex('#8a8272') : ny > 0.2 ? hex('#141414') : hex('#262422')));
  // wheelhouse, leaning with the hull, windows catching the sun
  for (let yy = 0; yy < 18; yy++) for (let xx = 0; xx < 36; xx++) {
    const X = wx + 52 + xx, Y = Math.round(deckY(52 + xx)) - 1 - yy;
    let c = yy > 15 ? hex('#8a847a') : yy > 13 ? hex('#c4bca8') : hex('#dcd4c2');
    if (yy >= 7 && yy <= 11 && xx % 9 > 1 && xx % 9 < 8) c = xx % 9 < 4 && yy > 8 ? hex('#cfeaf4') : hex('#3a5a70');
    if (xx === 0 || xx === 35) c = hex('#8a847a');
    set(X, Y, c);
  }
  // snapped mast: the stub and the broken top hanging down the side, a torn pennant
  for (let k = 0; k < 26; k++) set(wx + 70 + k * 0.28, deckY(70) - 19 - k, hex('#4a4440'));
  for (let k = 0; k < 22; k++) set(wx + 78 + k * 0.9, deckY(78) - 44 + k * 1.1, hex('#5a5450'));
  for (let k = 0; k < 6; k++) set(wx + 98 + k, deckY(98) - 22 + (k % 2), hex('#c8402e'));
  // smoke curling up from the engine room
  for (let k = 0; k < 90; k++) {
    const x = wx + 40 + Math.sin(k * 0.22) * (2 + k * 0.08) + k * 0.45, y = deckY(40) - 4 - k;
    for (let j = -1; j <= 1 + Math.floor(k / 30); j++) set(x + j, y, mix(get(x + j, y), hex('#4a4a52'), 0.5 - k / 200));
  }
  for (let x = wx - 16; x < wx + 170; x++) if (rng.next() < 0.7) set(x, wy + 2 + rng.range(0, 4), hex('#ffffff'));
  // ---- the shore break: a ragged foam line where the sea meets the sand
  for (let x = 0; x < W; x++) {
    const f = noise1(x / 14, 21);
    for (let y = SHORE - 3 - Math.round(f * 4); y < SHORE + 2; y++) set(x, y, f > 0.45 || y > SHORE - 1 ? hex('#f4fcfc') : mix(get(x, y), hex('#ffffff'), 0.6));
  }
  // ---- the beach: glassy wet sand reflecting the sky, the islands and the wreck, then dry sand with
  // wind ripples, shells and crab tracks
  const WET = 612;
  for (let y = SHORE + 2; y < H; y++) {
    const t = (y - WET) / (H - WET);
    for (let x = 0; x < W; x++) {
      let c: C;
      if (y < WET) {
        const k = (y - SHORE) / (WET - SHORE);
        const base = mix(hex('#86785a'), hex('#b49c70'), k);
        const wob = Math.round(Math.sin(y * 0.9 + x * 0.02) * 1.5);
        const refl = get(x + wob, HORIZON - 2 - (y - SHORE) * 1.7);
        c = mix(base, refl, 0.62 * (1 - k * 0.75));
        if (noise2(x / 38, y / 1.6, 11) > 0.74) c = mix(c, hex('#ffffff'), 0.22);
      } else {
        c = mix(hex('#ecd092'), hex('#c89a60'), Math.pow(t, 0.8) * 0.85);
        const rip = Math.sin((y - WET) / (2 + t * 5) * 2.4 + fbm2(x / 90, y / 40, 2, 4) * 6);
        if (rip > 0.88) c = shade(c, -0.08); else if (rip > 0.74) c = shade(c, 0.04);
        const g = hash2(x, y, 8);
        if (g < 0.035) c = shade(c, -0.06); else if (g > 0.978) c = shade(c, 0.08);
        if (g > 0.9994) c = hex('#f8f0e8');
      }
      set(x, y, c);
    }
  }
  // crab tracks wandering across
  for (let k = 0; k < 40; k++) { const x = 230 + k * 5 + Math.sin(k * 0.4) * 6, y = 650 + Math.sin(k * 0.17) * 16; for (const s2 of [-1, 1]) { set(x - 1, y + s2 * 3, shade(get(x, y + s2 * 3), -0.14)); set(x + 1, y + s2 * 3 + 1, shade(get(x + 1, y + s2 * 3 + 1), -0.14)); } }
  // ---- debris from the Kittiwake: a half-buried lifebuoy, the split crate with Chunk's food cans,
  // rope, kelp, Mori's camera
  const dark = (cx: number, cy: number, rx: number, ry: number, a: number) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const nx = (x - cx) / rx, ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) set(x, y, shade(get(x, y), -a * (1 - (nx * nx + ny * ny) * 0.5)));
    }
  };
  dark(144, 684, 36, 8, 0.18);
  disc(140, 670, 30, 22, (nx, ny) => { const r = Math.hypot(nx, ny); if (r < 0.46 || ny > 0.5) return -1; if (r > 0.92) return hex('#6a3a2a'); const a = Math.atan2(ny, nx); const red = Math.floor((a + Math.PI) / (Math.PI / 2)) % 2; return red ? (ny < -0.3 ? hex('#ee6a50') : hex('#c8402e')) : (ny < -0.3 ? hex('#ffffff') : hex('#dedace')); });
  for (let x = 108; x < 174; x++) set(x, 680 + Math.round(Math.sin(x * 0.2)), hex('#b89060'));
  // the crate: front face, top, one split board, a spilled can with a pug on the label
  const CX = 390, CY = 612, CW = 64, CH = 34, TOP = 10;
  dark(CX + CW / 2 + 6, CY + CH + 2, CW * 0.62, 7, 0.2);
  for (let y = 0; y < TOP; y++) for (let x = 0; x < CW; x++) {
    const X = CX + x + (TOP - y) * 0.9, Y = CY + y;
    set(X, Y, y === 0 ? hex('#4a3020') : (x % 16 === 0) ? hex('#6a4a2c') : y % 5 === 0 ? hex('#9a6e40') : hex('#b8844c'));
  }
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const X = CX + x, Y = CY + TOP + y;
    if (x > 44 && y < 12) { if (y > 3 && x < 52) set(X, Y, hex('#1c140e')); continue; }
    const edge = x === 0 || x === CW - 1 || y === CH - 1;
    const plank = y % 11 === 0;
    const brace = Math.abs(x - y * (CW / CH)) < 2.2;
    let c = edge ? hex('#3a2616') : plank ? hex('#5e3e24') : brace ? hex('#a8763e') : x % 3 === 0 && (y * 7 + x) % 5 === 0 ? hex('#7a5230') : hex('#8e6038');
    if (y === 1) c = hex('#a4703e');
    set(X, Y, c);
  }
  for (let k = 0; k < 14; k++) set(CX + 46 + k, CY + TOP + 2 - k * 0.6, hex('#b8844c'));
  // stencil on the crate
  // a paw print stencilled on the side (Chunky Chow)
  for (const [dx, dy] of [[12, 13], [13, 13], [16, 12], [17, 12], [20, 12], [21, 12], [24, 13], [25, 13]]) set(CX + dx, CY + TOP + dy, hex('#3a2616'));
  for (let j = 0; j < 4; j++) for (let i = 13; i < 25; i++) if (!(j === 3 && (i < 15 || i > 22))) set(CX + i, CY + TOP + 15 + j, hex('#3a2616'));
  const can = (cx: number, cy: number, lying: boolean) => {
    const w = lying ? 14 : 10, h = lying ? 10 : 13;
    dark(cx + w / 2, cy + h, w * 0.7, 3, 0.18);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = lying ? y / h : x / w;
      const rim = lying ? x < 2 || x > w - 3 : y < 2 || y > h - 3;
      let c = rim ? (u < 0.4 ? hex('#e8ecf0') : hex('#9aa0a8')) : u < 0.3 ? hex('#f0c848') : u < 0.8 ? hex('#d8a030') : hex('#9a6a1c');
      if (!rim && ((lying && x > 4 && x < 9 && y > 2 && y < 7) || (!lying && x > 2 && x < 7 && y > 4 && y < 9))) c = hex('#c89060');
      set(cx + x, cy + y, c);
    }
    if (lying) { set(cx + 6, cy + 4, hex('#2a1a10')); set(cx + 8, cy + 4, hex('#2a1a10')); } else { set(cx + 4, cy + 6, hex('#2a1a10')); set(cx + 6, cy + 6, hex('#2a1a10')); }
  };
  can(462, 648, true);
  can(372, 640, false);
  // rope, a coil, kelp, Mori's camera with its strap
  for (let k = 0; k < 120; k++) {
    const x = 470 + k * 0.95, y = 706 - k * 0.38 + Math.sin(k * 0.12) * 5;
    if (k === 0) dark(x + 55, y - 18, 64, 12, 0.08);
    disc(x, y, 2.6, 2.4, (nx, ny) => ((Math.floor((nx + ny) * 2 + k * 0.6) & 1) ? (ny < 0 ? hex('#c8a060') : hex('#9a7040')) : hex('#6a4a2a')));
  }
  for (let j = 0; j < 4; j++) for (let k = 0; k < 5; k++) set(470 - k, 706 + (j - 1.5) * 1.6 + k * (j - 1.5) * 0.4, hex('#b89058'));
  dark(584, 724, 26, 6, 0.16);
  disc(580, 716, 24, 12, (nx, ny) => { const r = Math.hypot(nx, ny); return r < 0.32 ? -1 : (Math.floor(r * 7) % 2 ? hex('#c8aa70') : hex('#9a7a44')); });
  // a tangle of kelp: glossy blades fanning out from a holdfast, with air bladders
  dark(64, 628, 50, 7, 0.12);
  for (let j = 0; j < 7; j++) {
    const a0 = -0.5 + j * 0.2, len = 34 + (j * 13) % 20;
    for (let k = 0; k < len; k++) {
      const u = k / len, a = a0 + Math.sin(k * 0.18 + j) * 0.25;
      const x = 30 + Math.cos(a) * k * 1.6, y = 624 + Math.sin(a) * k * 0.5 + Math.sin(k * 0.3 + j) * 1.5;
      const w = 1.2 + Math.sin(u * Math.PI) * 1.8;
      disc(x, y, w, w * 0.6, (nx, ny) => (ny < -0.3 ? hex('#8a8a3a') : j % 2 ? hex('#4a5a22') : hex('#5a6a2a')));
      if (k % 9 === 5) disc(x, y - 1, 1.6, 1.6, (nx, ny) => (nx + ny < -0.4 ? hex('#d8d890') : hex('#7a7a2a')));
    }
  }
  dark(314, 738, 18, 4, 0.2);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 26; x++) set(300 + x, 720 + y, y < 2 ? hex('#6a6a74') : x > 17 ? hex('#2a2a30') : hex('#3a3a44'));
  for (let x = 2; x < 8; x++) set(300 + x, 719, hex('#3a3a44'));
  disc(318, 728, 5, 5, (nx, ny) => (Math.hypot(nx, ny) > 0.6 ? hex('#1a1a20') : nx + ny < -0.3 ? hex('#bfeaff') : hex('#4a8ab0')));
  for (let k = 0; k < 40; k++) set(290 - k * 1.5, 724 + Math.sin(k * 0.3) * 3, hex('#2a2a30'));
  // a few shells
  for (const [x, y, c] of [[210, 700, '#f4e4d4'], [520, 660, '#f0c8b8'], [650, 690, '#f8f0e8'], [80, 740, '#e8d0c0']] as const) disc(x, y, 3, 2, (nx, ny) => (ny < -0.2 ? hex('#ffffff') : hex(c)));
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

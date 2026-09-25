// Base camp props: tents, the jeep "Beatrice", campfire, radio mast, crates, the research ship.

import { PixelBuffer } from './pixel';
import { C, hex, mix, shade, rgba, withAlpha } from './color';
import { PAL, OUTLINE } from './palettes';
import { Rng, bayer, clamp, fbm2, noise1 } from '../core/math';

const O = OUTLINE;

/** fill a quad-ish polygon with vertical ramp shading + fabric weave noise */
function fabric(buf: PixelBuffer, pts: number[], ramp: C[], light: number, seed: number, folds = 0) {
  buf.polyFn(pts, (x, y) => {
    let l = light + (fbm2(x * 0.3, y * 0.3, 2, seed) - 0.5) * 0.25 + (bayer(x, y) - 0.5) * 0.35;
    if (folds) l += Math.sin(x * folds) * 0.12;
    const i = clamp(Math.round((l * 0.5 + 0.5) * (ramp.length - 1)), 0, ramp.length - 1);
    return ramp[i];
  });
}

function rope(buf: PixelBuffer, x0: number, y0: number, x1: number, y1: number, sag = 2, c: C = PAL.canvas[2]) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    buf.set(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag, c);
  }
}

function peg(buf: PixelBuffer, x: number, y: number) {
  buf.set(x, y, PAL.bark[5]);
  buf.set(x, y + 1, PAL.bark[3]);
}

/** Large ridge wall-tent: the field laboratory. Returns buffer + door rect for interior glow. */
export function paintLabTent(seed = 1) {
  const W = 132, H = 84;
  const buf = new PixelBuffer(W, H);
  const R = PAL.canvas;
  const g = H - 1; // ground
  const wallTop = 40, ridge = 12;
  const x0 = 16, x1 = W - 16;
  // back roof
  fabric(buf, [x0 - 6, wallTop, x0 + 14, ridge, x1 - 14, ridge, x1 + 6, wallTop], R, 0.35, seed, 0.4);
  // walls
  fabric(buf, [x0, wallTop, x1, wallTop, x1, g, x0, g], R, -0.05, seed + 1);
  // shading under the eave
  for (let x = x0; x < x1; x++) for (let y = wallTop; y < wallTop + 3; y++) buf.paint(x, y, R[2]);
  // roof front edge / valance scallops
  for (let x = x0 - 6; x <= x1 + 6; x++) {
    buf.set(x, wallTop, R[1]);
    if ((x & 7) < 4) buf.set(x, wallTop + 1, R[3]);
  }
  // ridge pole + roof seams
  for (let x = x0 + 14; x <= x1 - 14; x++) buf.set(x, ridge, R[6]);
  for (let s = 0; s < 4; s++) {
    const sx = x0 + 14 + ((x1 - x0 - 28) * (s + 0.5)) / 4;
    for (let y = ridge; y < wallTop; y++) buf.set(sx + (y - ridge) * 0.05 * (s - 1.5), y, R[4]);
  }
  // open door (dark interior with warm lamp glow handled by lighting)
  const dx0 = W / 2 - 16, dx1 = W / 2 + 16, dTop = wallTop + 6;
  buf.poly([dx0, g, dx0 + 5, dTop, dx1 - 5, dTop, dx1, g], hex('#3a2616'));
  // interior details: table, lamp, charts
  buf.rect(dx0 + 6, g - 12, 20, 2, PAL.bark[5]);
  buf.rect(dx0 + 8, g - 10, 2, 10, PAL.bark[3]);
  buf.rect(dx1 - 10, g - 10, 2, 10, PAL.bark[3]);
  buf.rect(W / 2 - 6, dTop + 5, 12, 8, hex('#d9c9a0'));
  buf.rect(W / 2 - 5, dTop + 6, 5, 3, hex('#5e8f5a'));
  buf.rect(W / 2 + 1, dTop + 7, 4, 4, hex('#9a4a3a'));
  buf.rect(dx0 + 12, g - 17, 3, 5, PAL.yellow[5]);
  buf.set(dx0 + 13, g - 18, PAL.yellow[6]);
  // rolled flaps
  for (const fx of [dx0 - 3, dx1 + 1]) {
    for (let y = dTop; y < g - 6; y++) {
      buf.set(fx, y, R[5]);
      buf.set(fx + 1, y, R[3]);
      buf.set(fx + 2, y, R[2]);
    }
    buf.rect(fx - 1, dTop + 10, 5, 2, PAL.bark[4]);
  }
  // windows with mesh
  for (const wx of [x0 + 10, x1 - 30]) {
    buf.rect(wx, wallTop + 10, 20, 12, R[1]);
    for (let y = wallTop + 10; y < wallTop + 22; y++) for (let x = wx; x < wx + 20; x++) if ((x + y) % 2 === 0) buf.set(x, y, hex('#4a3a24'));
    buf.rect(wx - 1, wallTop + 9, 22, 1, R[5]);
  }
  // mud line at the bottom
  for (let x = x0; x < x1; x++) for (let y = g - 3; y <= g; y++) if (bayer(x, y) < 0.6) buf.paint(x, y, PAL.soil[4]);
  // guy ropes & pegs
  rope(buf, x0 - 6, wallTop, 2, g, 1);
  rope(buf, x1 + 6, wallTop, W - 3, g, 1);
  peg(buf, 2, g - 1);
  peg(buf, W - 3, g - 1);
  // flag on the ridge
  for (let y = 0; y < ridge; y++) buf.set(x0 + 16, y, PAL.metal[5]);
  buf.poly([x0 + 17, 1, x0 + 29, 3, x0 + 17, 7], PAL.red[5]);
  buf.rect(x0 + 17, 3, 12, 1, PAL.white[6]);
  buf.outline(O);
  return { buf, ax: W / 2, ay: H, door: { x: W / 2, y: g - 14 } };
}

/** Orange dome-ish A-frame tent: gear workshop, with antennas & hanging gadgets. */
export function paintGearTent(seed = 2) {
  const W = 96, H = 66;
  const buf = new PixelBuffer(W, H);
  const R = PAL.canvasOrange;
  const g = H - 1;
  const apexX = W / 2, apexY = 12;
  fabric(buf, [8, g, apexX, apexY, W - 8, g], R, 0.1, seed, 0.25);
  // lit left half
  buf.polyFn([8, g, apexX, apexY, apexX, g], (x, y) => {
    const c = buf.get(x, y);
    return (x + y) % 11 === 0 ? shade(c, 0.12) : shade(c, 0.1);
  });
  // seams
  for (let y = apexY; y < g; y++) {
    const t = (y - apexY) / (g - apexY);
    buf.set(apexX - t * 20, y, R[3]);
    buf.set(apexX + t * 20, y, R[2]);
  }
  // door: zipped half-open
  buf.poly([apexX - 12, g, apexX, apexY + 18, apexX + 12, g], hex('#2e1a10'));
  buf.poly([apexX - 12, g, apexX - 2, apexY + 22, apexX - 5, g], R[5]);
  // workbench glow inside
  buf.rect(apexX - 6, g - 8, 12, 2, PAL.metal[5]);
  buf.set(apexX + 2, g - 10, PAL.glowCyan[5]);
  buf.set(apexX - 3, g - 11, PAL.yellow[6]);
  // antenna & dish on top
  for (let y = 0; y < apexY; y++) buf.set(apexX + 3, y, PAL.metal[6]);
  buf.set(apexX + 3, 0, PAL.red[6]);
  buf.ellipse(apexX - 8, apexY + 2, 5, 3, PAL.white[5]);
  buf.set(apexX - 8, apexY + 2, PAL.metal[3]);
  // hanging gadgets on a line
  rope(buf, 12, g - 30, apexX - 14, apexY + 16, 2, PAL.bark[2]);
  buf.rect(20, g - 28, 4, 5, PAL.metal[4]);
  buf.rect(28, g - 30, 3, 6, PAL.yellow[4]);
  // ground stakes
  peg(buf, 7, g - 1);
  peg(buf, W - 8, g - 1);
  buf.outline(O);
  return { buf, ax: W / 2, ay: H };
}

/** Small radio tent. */
export function paintRadioTent(seed = 3) {
  const W = 70, H = 46;
  const buf = new PixelBuffer(W, H);
  const R = PAL.olive;
  const g = H - 1;
  fabric(buf, [6, g, 24, 8, 46, 8, W - 6, g], R, 0.1, seed, 0.3);
  for (let x = 24; x <= 46; x++) buf.set(x, 8, R[6]);
  buf.poly([26, g, 35, 16, 44, g], hex('#1e1a12'));
  // radio console glow
  buf.rect(30, g - 9, 10, 5, PAL.metal[3]);
  buf.set(32, g - 8, PAL.glowGreen[5]);
  buf.set(34, g - 8, PAL.red[6]);
  buf.set(36, g - 7, PAL.yellow[6]);
  peg(buf, 5, g - 1);
  peg(buf, W - 6, g - 1);
  buf.outline(O);
  return { buf, ax: W / 2, ay: H };
}

/** Lattice radio mast with dish. */
export function paintRadioMast(h = 150) {
  const W = 30, H = h;
  const buf = new PixelBuffer(W, H);
  const cx = W / 2;
  const M = PAL.metal;
  for (let y = 4; y < H; y++) {
    const t = y / H;
    const half = 1.5 + t * 6;
    buf.set(cx - half, y, M[5]);
    buf.set(cx + half, y, M[3]);
    // cross bracing
    const seg = 10;
    const k = (y % seg) / seg;
    buf.set(cx - half + k * half * 2, y, M[4]);
    buf.set(cx + half - k * half * 2, y, M[2]);
    if (y % seg === 0) buf.hline(cx - half, cx + half, y, M[4]);
  }
  for (let y = 0; y < 6; y++) buf.set(cx, y, M[6]);
  // dish
  buf.ellipseFn(cx - 7, 40, 6, 8, (_x, _y, nx) => (nx < -0.2 ? PAL.white[6] : nx > 0.5 ? PAL.white[3] : PAL.white[5]));
  buf.set(cx - 3, 40, M[2]);
  buf.set(cx - 2, 40, M[2]);
  // guy wires
  for (let y = 20; y < H; y += 1) {
    buf.set(cx + (y - 20) * 0.15 + 2, y, withAlpha(M[4], 150));
  }
  return { buf, ax: cx, ay: H };
}

/** The expedition 4x4, facing right. Wheels are drawn separately. */
export function paintJeep() {
  const W = 112, H = 60;
  const buf = new PixelBuffer(W, H);
  const G = [hex('#1c2414'), hex('#2c3a1e'), hex('#3f5229'), hex('#566c33'), hex('#6f8840'), hex('#8ea553'), hex('#b3c56f')];
  const bodyTop = 22, bodyBot = 48;
  // chassis body
  buf.polyFn([8, bodyTop + 4, 60, bodyTop, 70, bodyTop, 78, bodyTop + 10, 104, bodyTop + 12, 107, bodyTop + 16, 107, bodyBot, 6, bodyBot, 5, bodyTop + 8], (x, y) => {
    let l = -((y - bodyTop) / (bodyBot - bodyTop)) * 0.9 + 0.35 + (bayer(x, y) - 0.5) * 0.25;
    if (y < bodyTop + 6) l += 0.25;
    return G[clamp(Math.round((l * 0.5 + 0.5) * 6), 0, 6)];
  });
  // white expedition stripe
  for (let x = 7; x < 106; x++) for (let y = 34; y < 37; y++) buf.paint(x, y, y === 34 ? PAL.white[6] : PAL.white[5]);
  // cabin frame & windows
  buf.polyFn([14, bodyTop + 3, 20, 4, 60, 4, 64, bodyTop, 60, bodyTop, 14, bodyTop + 3], () => -1);
  const frame = G[1];
  for (const [x0, x1] of [[16, 36], [39, 58]]) {
    buf.poly([x0, bodyTop + 2, x0 + 3, 7, x1, 7, x1 + 2, bodyTop], hex('#27353a'));
    // glass reflection streaks
    for (let y = 8; y < bodyTop; y++) {
      const t = (y - 7) / (bodyTop - 7);
      buf.set(x0 + 5 + t * 3 + 4, y, hex('#6d8e96'));
      buf.set(x0 + 6 + t * 3 + 4, y, hex('#557178'));
    }
  }
  for (let x = 17; x < 60; x++) buf.set(x, 6, frame);
  for (let y = 6; y < bodyTop + 2; y++) {
    buf.set(16 + (bodyTop - y) * 0.15, y, frame);
    buf.set(37, y, frame);
    buf.set(38, y, G[2]);
    buf.set(60 + (y - 6) * 0.15, y, frame);
  }
  // roof rack with luggage
  for (let x = 16; x < 64; x++) buf.set(x, 3, PAL.metal[4]);
  for (let x = 18; x < 62; x += 8) buf.set(x, 4, PAL.metal[3]);
  buf.rect(20, -1 + 0, 14, 3, PAL.canvasOrange[4]);
  buf.rect(21, 0, 12, 1, PAL.canvasOrange[6]);
  buf.rect(36, 0, 10, 3, PAL.canvas[4]);
  buf.rect(48, 1, 12, 2, PAL.olive[4]);
  // spare tyre on the back
  buf.shadedEllipse(6, 30, 5, 9, [hex('#141414'), hex('#222222'), hex('#303030'), hex('#3c3c3c')]);
  buf.ellipse(6, 30, 2, 4, PAL.metal[4]);
  // headlight + grille + bumper
  buf.rect(104, bodyTop + 14, 3, 12, G[1]);
  buf.disc(103, bodyTop + 16, 2.2, PAL.yellow[6]);
  buf.set(102, bodyTop + 15, rgba(255, 255, 240));
  buf.rect(100, bodyBot - 2, 11, 3, PAL.metal[3]);
  buf.rect(100, bodyBot - 2, 11, 1, PAL.metal[5]);
  // winch
  buf.rect(106, bodyBot - 5, 3, 3, PAL.metal[2]);
  // snorkel
  for (let y = 10; y < bodyTop + 10; y++) buf.set(72, y, PAL.metal[2]);
  buf.rect(71, 9, 3, 2, PAL.metal[3]);
  // door handle & panel lines
  buf.rect(48, 28, 4, 1, PAL.metal[5]);
  for (let y = bodyTop + 2; y < bodyBot - 2; y++) buf.set(38, y, G[1]);
  // wheel arches (dark)
  for (const wx of [24, 88]) {
    buf.discFn(wx, bodyBot + 2, 13, (_x, y) => (y > bodyTop + 14 ? hex('#141a10') : -1));
  }
  // mud splatter
  const rng = new Rng(8);
  for (let i = 0; i < 90; i++) {
    const x = rng.range(8, 104), y = rng.range(38, bodyBot);
    if (rng.chance(0.7)) buf.paint(x, y, rng.chance(0.5) ? PAL.soil[4] : PAL.soil[3]);
  }
  // step/running board
  buf.rect(36, bodyBot, 30, 2, PAL.metal[2]);
  // painted name plate "B" emblem
  buf.rect(78, 28, 8, 4, PAL.yellow[5]);
  buf.rect(79, 29, 6, 2, PAL.yellow[3]);
  buf.outline(O);
  return { buf, ax: W / 2, ay: H - 6, wheels: [24, 88], wheelY: bodyBot + 2 };
}

/** 4 rotation frames of a chunky off-road wheel. */
export function paintWheels(r = 11) {
  const out: PixelBuffer[] = [];
  const s = r * 2 + 2;
  for (let f = 0; f < 4; f++) {
    const b = new PixelBuffer(s, s);
    const cx = s / 2, cy = s / 2;
    b.discFn(cx, cy, r, (x, y, nx, ny) => {
      const d = Math.hypot(nx, ny);
      if (d > 0.62) {
        const a = Math.atan2(ny, nx) + (f * Math.PI) / 8;
        const tread = Math.sin(a * 10) > 0.3 && d > 0.85;
        return tread ? hex('#0e0e0e') : ny < -0.3 ? hex('#3a3a3a') : hex('#262626');
      }
      if (d > 0.5) return PAL.metal[2];
      const a = Math.atan2(ny, nx) + (f * Math.PI) / 8;
      const spoke = Math.abs(Math.sin(a * 2.5)) < 0.3;
      return spoke ? PAL.metal[3] : d < 0.2 ? PAL.metal[6] : ny < 0 ? PAL.olive[5] : PAL.olive[3];
    });
    b.outline(O);
    out.push(b);
  }
  return out;
}

export function paintCrate(w = 18, h = 14, stencil = true, seed = 4) {
  const buf = new PixelBuffer(w, h);
  const B = PAL.bark;
  buf.rectFn(0, 0, w, h, (x, y) => {
    const plank = Math.floor(y / 4);
    let l = 0.1 + (noise1(x * 0.4 + plank * 7, seed) - 0.5) * 0.4 + (y % 4 === 0 ? -0.4 : 0);
    if (x === 0 || y === 0) l += 0.3;
    if (x === w - 1 || y === h - 1) l -= 0.5;
    return B[clamp(Math.round((l * 0.5 + 0.5) * 6) + 1, 1, 7)];
  });
  // frame
  for (let x = 0; x < w; x++) {
    buf.set(x, 0, B[6]);
    buf.set(x, h - 1, B[2]);
  }
  for (let y = 0; y < h; y++) {
    buf.set(0, y, B[5]);
    buf.set(w - 1, y, B[2]);
    buf.set(Math.round((y / h) * (w - 1)), y, B[4]);
  }
  if (stencil) {
    buf.rect(w / 2 - 3, h / 2 - 1, 6, 1, withAlpha(PAL.white[4], 255));
    buf.rect(w / 2 - 2, h / 2 + 1, 4, 1, withAlpha(PAL.white[4], 255));
  }
  buf.outline(O);
  return { buf, ax: w / 2, ay: h };
}

export function paintBarrel(color: C[] = PAL.blue) {
  const W = 12, H = 17;
  const buf = new PixelBuffer(W, H);
  buf.rectFn(1, 1, W - 2, H - 2, (x, y) => {
    const nx = (x + 0.5 - W / 2) / (W / 2 - 1);
    let l = -nx * 0.8 + (bayer(x, y) - 0.5) * 0.3;
    if (y === 4 || y === H - 5) l -= 0.5;
    return color[clamp(Math.round((l * 0.5 + 0.5) * 6), 0, 6)];
  });
  buf.rect(2, 1, W - 4, 1, color[6]);
  buf.set(W / 2 - 1, 2, PAL.metal[2]);
  buf.outline(O);
  return { buf, ax: W / 2, ay: H };
}

/** Log bench */
export function paintBench(len = 34) {
  const buf = new PixelBuffer(len, 9);
  for (let x = 0; x < len; x++)
    for (let y = 1; y < 6; y++) {
      const l = -(y - 3) * 0.35 + (noise1(x * 0.3, 3) - 0.5) * 0.4;
      buf.set(x, y, PAL.bark[clamp(Math.round((l * 0.5 + 0.5) * 6) + 1, 1, 7)]);
    }
  for (const lx of [4, len - 6]) buf.rect(lx, 6, 3, 3, PAL.bark[2]);
  buf.ellipse(1, 3, 1.5, 2.5, PAL.bark[6]);
  buf.outline(O);
  return { buf, ax: len / 2, ay: 9 };
}

/** Stone fire ring + logs (flames are drawn live). */
export function paintFirePit() {
  const W = 36, H = 12;
  const buf = new PixelBuffer(W, H);
  const rng = new Rng(3);
  // logs crossed
  buf.thickLine(8, 9, 27, 4, 1.8, PAL.bark[3]);
  buf.thickLine(9, 4, 28, 9, 1.8, PAL.bark[4]);
  buf.thickLine(12, 3, 24, 3, 1.2, PAL.bark[5]);
  // embers bed
  for (let i = 0; i < 20; i++) buf.set(rng.range(11, 25), rng.range(6, 10), rng.pick([PAL.red[5], PAL.canvasOrange[5], PAL.yellow[5]]));
  // stones
  for (let i = 0; i < 9; i++) {
    const a = (i / 8) * Math.PI;
    const x = W / 2 + Math.cos(a) * 15, y = H - 3 + Math.sin(a) * 1.5 - (i % 2);
    buf.shadedEllipse(x, y, 3, 2.2, PAL.stone.slice(2, 7));
  }
  buf.outline(O);
  return { buf, ax: W / 2, ay: H };
}

/** Flame frames (emissive), 6 frames. */
export function paintFlames(w = 16, h = 22) {
  const frames: PixelBuffer[] = [];
  const cols = [hex('#b3261e'), hex('#e8541f'), hex('#ff9a2e'), hex('#ffd35a'), hex('#fff4c2')];
  for (let f = 0; f < 6; f++) {
    const b = new PixelBuffer(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const nx = (x + 0.5 - w / 2) / (w / 2);
        const ty = 1 - y / h; // 0 bottom .. 1 top
        const n = fbm2(x * 0.35, y * 0.3 + f * 1.7, 3, 11);
        const width = (1 - ty) * 0.95 + 0.05;
        const v = (1 - Math.abs(nx) / width) * (1 - ty * 0.8) + (n - 0.5) * 0.9 - ty * 0.35;
        if (v < 0.08) continue;
        const i = clamp(Math.floor(v * 5.5), 0, 4);
        b.set(x, y, cols[i]);
      }
    frames.push(b);
  }
  return frames;
}

/** Hanging lantern. */
export function paintLantern() {
  const b = new PixelBuffer(7, 11);
  b.rect(2, 0, 3, 1, PAL.metal[4]);
  b.rect(1, 1, 5, 1, PAL.metal[5]);
  b.rect(1, 2, 5, 6, PAL.yellow[6]);
  b.rect(2, 3, 3, 4, rgba(255, 250, 220));
  b.rect(1, 8, 5, 1, PAL.metal[4]);
  b.set(1, 2, PAL.metal[3]);
  b.set(5, 2, PAL.metal[3]);
  b.set(1, 7, PAL.metal[3]);
  b.set(5, 7, PAL.metal[3]);
  b.outline(O);
  return b;
}

/** Post with a crossbar hook for hanging a lantern. */
export function paintLanternPost(h = 44) {
  const b = new PixelBuffer(14, h);
  for (let y = 2; y < h; y++) {
    b.set(3, y, PAL.bark[5]);
    b.set(4, y, PAL.bark[3]);
  }
  for (let x = 3; x < 12; x++) b.set(x, 3, PAL.bark[5]);
  b.set(11, 4, PAL.metal[4]);
  b.outline(O);
  return { buf: b, ax: 4, ay: h, hookX: 11 - 4, hookY: -h + 5 };
}

/** Kitchen tarp shelter with stove & pots. */
export function paintKitchen() {
  const W = 92, H = 58;
  const buf = new PixelBuffer(W, H);
  const g = H - 1;
  // poles
  for (const px of [8, W - 9]) for (let y = 10; y < H; y++) {
    buf.set(px, y, PAL.bark[5]);
    buf.set(px + 1, y, PAL.bark[3]);
  }
  // tarp (blue)
  fabric(buf, [2, 16, 18, 6, W - 18, 6, W - 2, 16, W - 2, 19, 2, 19], PAL.blue, 0.2, 5, 0.5);
  for (let x = 2; x < W - 2; x++) if (x % 6 < 3) buf.set(x, 19, PAL.blue[2]);
  // table
  buf.rect(24, g - 16, 44, 3, PAL.bark[5]);
  buf.rect(24, g - 16, 44, 1, PAL.bark[6]);
  buf.rect(27, g - 13, 2, 13, PAL.bark[3]);
  buf.rect(63, g - 13, 2, 13, PAL.bark[3]);
  // stove + pot
  buf.rect(30, g - 21, 12, 5, PAL.metal[3]);
  buf.rect(32, g - 27, 9, 6, PAL.metal[5]);
  buf.rect(32, g - 27, 9, 1, PAL.metal[6]);
  buf.rect(41, g - 25, 3, 1, PAL.metal[4]);
  // cutting board, veggies, jars
  buf.rect(48, g - 18, 12, 2, PAL.bark[6]);
  buf.set(50, g - 19, PAL.red[5]);
  buf.set(52, g - 19, PAL.leafOlive[5]);
  buf.set(53, g - 19, PAL.leafOlive[4]);
  buf.rect(56, g - 21, 3, 4, PAL.yellow[5]);
  // hanging ladles
  for (const hx of [20, 24, 72]) {
    for (let y = 20; y < 27; y++) buf.set(hx, y, PAL.metal[5]);
    buf.rect(hx - 1, 27, 3, 2, PAL.metal[4]);
  }
  // sacks
  buf.shadedEllipse(76, g - 5, 7, 6, PAL.canvas.slice(1, 6));
  buf.shadedEllipse(83, g - 4, 5, 5, PAL.canvas.slice(1, 6));
  buf.outline(O);
  return { buf, ax: W / 2, ay: H };
}

/** Wooden signpost with arrows. */
export function paintSignpost() {
  const W = 40, H = 46;
  const b = new PixelBuffer(W, H);
  for (let y = 4; y < H; y++) {
    b.set(19, y, PAL.bark[5]);
    b.set(20, y, PAL.bark[3]);
  }
  const arrow = (y: number, dir: number, c: C) => {
    const x0 = dir > 0 ? 20 : 4, x1 = dir > 0 ? 36 : 20;
    b.rect(x0, y, x1 - x0, 6, c);
    b.rect(x0, y, x1 - x0, 1, shade(c, 0.3));
    const tip = dir > 0 ? x1 : x0 - 1;
    for (let k = 0; k < 3; k++) b.rect(tip + (dir > 0 ? k : -k), y + k, 1, 6 - k * 2, c);
    for (let x = x0 + 3; x < x1 - 3; x += 2) b.set(x, y + 3, shade(c, -0.35));
  };
  arrow(6, 1, PAL.bark[6]);
  arrow(15, -1, PAL.bark[5]);
  arrow(24, 1, PAL.bark[6]);
  b.outline(O);
  return { buf: b, ax: 20, ay: H };
}

/** Corkboard of pinned photos next to the lab. */
export function paintCorkboard() {
  const W = 30, H = 34;
  const b = new PixelBuffer(W, H);
  for (const lx of [3, W - 4]) for (let y = 16; y < H; y++) b.set(lx, y, PAL.bark[4]);
  b.rectFn(0, 0, W, 20, (x, y) => (x === 0 || y === 0 || x === W - 1 || y === 19 ? PAL.bark[3] : (x * 7 + y * 13) % 5 === 0 ? hex('#8a6038') : hex('#b0804a')));
  const rng = new Rng(4);
  for (let i = 0; i < 6; i++) {
    const x = 3 + (i % 3) * 8 + rng.range(-1, 1), y = 3 + Math.floor(i / 3) * 8;
    b.rect(x, y, 6, 6, PAL.white[6]);
    b.rect(x + 1, y + 1, 4, 3, rng.pick([PAL.leafDeep[4], PAL.blue[4], PAL.canvasOrange[4], PAL.stone[4]]));
    b.set(x + 2, y, PAL.red[6]);
  }
  // red string
  for (let x = 6; x < 22; x++) b.set(x, 9 + Math.round(Math.sin(x * 0.5)), PAL.red[5]);
  b.outline(O);
  return { buf: b, ax: W / 2, ay: H };
}

/** Hammock slung between two posts. */
export function paintHammock() {
  const W = 50, H = 32;
  const b = new PixelBuffer(W, H);
  for (const px of [2, W - 3]) for (let y = 2; y < H; y++) {
    b.set(px, y, PAL.bark[5]);
    b.set(px + 1, y, PAL.bark[3]);
  }
  for (let x = 4; x < W - 4; x++) {
    const t = (x - 4) / (W - 8);
    const y = 8 + Math.sin(t * Math.PI) * 12;
    for (let k = 0; k < 3; k++) b.set(x, y + k, k === 0 ? PAL.canvasOrange[5] : (x % 4 < 2 ? PAL.canvasOrange[4] : PAL.yellow[4]));
  }
  b.outline(O);
  return { buf: b, ax: W / 2, ay: H };
}

/** Rowboat & short dock for the beach. */
export function paintDock(len = 90) {
  const W = len, H = 26;
  const b = new PixelBuffer(W, H);
  // posts
  for (let px = 4; px < W; px += 16) for (let y = 6; y < H; y++) {
    b.set(px, y, PAL.bark[3]);
    b.set(px + 1, y, PAL.bark[2]);
  }
  for (let x = 0; x < W; x++) for (let y = 4; y < 8; y++) b.set(x, y, (x % 7 === 0 ? PAL.bark[2] : y === 4 ? PAL.bark[6] : PAL.bark[4]));
  b.outline(O);
  return { buf: b, ax: 0, ay: 8 };
}

export function paintRowboat() {
  const W = 40, H = 13;
  const b = new PixelBuffer(W, H);
  b.polyFn([0, 2, W, 2, W - 6, H, 6, H], (x, y) => (y < 4 ? PAL.white[6] : y < 6 ? PAL.red[5] : y < 9 ? PAL.red[4] : PAL.red[3]));
  b.rect(10, 0, 2, 3, PAL.bark[4]);
  b.rect(26, 1, 12, 1, PAL.bark[5]);
  b.outline(O);
  return { buf: b, ax: W / 2, ay: H - 3 };
}

/** The research icebreaker RV Southern Wren, side view facing left. scale 1 ~ 150px long. */
export function paintShip(len = 150) {
  const k = len / 150;
  const W = Math.ceil(len + 8), H = Math.ceil(78 * k) + 4;
  const b = new PixelBuffer(W, H);
  const water = H - Math.ceil(10 * k);
  const S = (v: number) => v * k;
  // hull (red, with ice-strengthened white band at waterline)
  b.polyFn([S(4), S(44), S(150), S(44), S(144), water, S(24), water], (x, y) => {
    const t = (y - S(44)) / (water - S(44));
    if (t > 0.72) return PAL.white[5];
    let l = 0.3 - t * 0.8 + (bayer(x, y) - 0.5) * 0.25;
    return PAL.red[clamp(Math.round((l * 0.5 + 0.5) * 6), 1, 6)];
  });
  // bow rake
  b.polyFn([S(4), S(44), S(24), water, S(0), S(36)], () => PAL.red[5]);
  // deck line
  for (let x = S(2); x < S(150); x++) b.set(x, S(44), PAL.white[6]);
  // superstructure (white)
  b.polyFn([S(70), S(44), S(72), S(20), S(118), S(20), S(122), S(44)], (x, y) => ((y - S(20)) % Math.max(1, Math.round(S(8))) === 0 ? PAL.white[4] : x < S(80) ? PAL.white[6] : PAL.white[5]));
  b.polyFn([S(78), S(20), S(80), S(10), S(108), S(10), S(110), S(20)], (x) => (x < S(86) ? PAL.white[6] : PAL.white[5]));
  // bridge windows
  for (let x = S(81); x < S(107); x += Math.max(2, S(4))) b.rect(x, S(12), Math.max(1, S(2)), Math.max(1, S(3)), hex('#27353a'));
  // portholes
  for (let x = S(74); x < S(118); x += Math.max(3, S(6))) b.rect(x, S(28), Math.max(1, S(2)), Math.max(1, S(2)), hex('#3a4a50'));
  // funnel (orange with band)
  b.rect(S(112), S(2), S(10), S(18), PAL.canvasOrange[5]);
  b.rect(S(112), S(6), S(10), S(3), PAL.white[6]);
  b.rect(S(112), S(2), S(10), S(1), PAL.metal[2]);
  // mast & radar
  for (let y = S(0); y < S(10); y++) b.set(S(92), y, PAL.metal[5]);
  b.rect(S(88), S(3), S(9), 1, PAL.metal[6]);
  // crane on the foredeck
  b.thickLine(S(40), S(44), S(52), S(18), Math.max(0.6, S(1)), PAL.yellow[5]);
  b.thickLine(S(52), S(18), S(26), S(22), Math.max(0.5, S(0.7)), PAL.yellow[4]);
  for (let y = S(22); y < S(38); y++) b.set(S(26), y, PAL.metal[4]);
  // containers
  b.rect(S(30), S(38), S(12), S(6), PAL.blue[4]);
  b.rect(S(44), S(38), S(12), S(6), PAL.yellow[4]);
  // helideck aft
  b.rect(S(124), S(38), S(24), S(2), PAL.white[5]);
  // name hint (lighter stripe)
  b.rect(S(20), S(48), S(20), 1, PAL.white[6]);
  b.outline(O);
  return { buf: b, ax: W / 2, ay: water };
}

/** Clothesline with drying socks and a shirt. */
export function paintClothesline(w = 48) {
  const b = new PixelBuffer(w, 22);
  for (const px of [1, w - 2]) for (let y = 2; y < 22; y++) b.set(px, y, PAL.bark[4]);
  for (let x = 1; x < w - 1; x++) b.set(x, 3 + Math.sin(((x - 1) / (w - 3)) * Math.PI) * 3, PAL.white[3]);
  const items: [number, C, number, number][] = [[8, PAL.red[5], 3, 6], [14, PAL.white[6], 8, 9], [26, PAL.blue[5], 3, 6], [33, PAL.yellow[5], 6, 7]];
  for (const [x, c, iw, ih] of items) {
    const y = Math.round(3 + Math.sin(((x - 1) / (w - 3)) * Math.PI) * 3) + 1;
    b.rect(x, y, iw, ih, c);
    b.rect(x, y, iw, 1, shade(c, 0.25));
  }
  b.outline(O);
  return { buf: b, ax: w / 2, ay: 22 };
}

/** Log gate at the jungle road with a hanging sign. */
export function paintGate() {
  const W = 80, H = 90;
  const b = new PixelBuffer(W, H);
  for (const px of [6, W - 8]) for (let y = 8; y < H; y++) for (let k = 0; k < 4; k++) b.set(px + k - 1, y, PAL.bark[k === 0 ? 5 : k === 3 ? 2 : 4]);
  for (let x = 0; x < W; x++) for (let y = 8; y < 13; y++) b.set(x, y, y === 8 ? PAL.bark[6] : y === 12 ? PAL.bark[2] : PAL.bark[4]);
  // sign
  b.rect(18, 18, 44, 14, PAL.bark[5]);
  b.rect(18, 18, 44, 1, PAL.bark[6]);
  for (const hx of [24, 56]) for (let y = 13; y < 18; y++) b.set(hx, y, PAL.metal[3]);
  // painted "letters" (abstract strokes)
  for (let i = 0; i < 9; i++) {
    const x = 22 + i * 4;
    b.rect(x, 22, 2, 5, PAL.yellow[6]);
    if (i % 2) b.rect(x, 24, 3, 1, PAL.yellow[6]);
  }
  // vines on posts
  for (let y = 14; y < H; y += 3) b.set(4 + Math.round(Math.sin(y * 0.3) * 1.5), y, PAL.leafDeep[4]);
  b.outline(O);
  return { buf: b, ax: W / 2, ay: H };
}

export function paintGenerator() {
  const W = 22, H = 14;
  const b = new PixelBuffer(W, H);
  b.rectFn(1, 3, W - 2, H - 4, (x, y) => (y < 5 ? PAL.yellow[6] : x < 4 ? PAL.yellow[5] : PAL.yellow[4]));
  b.rect(3, 6, 8, 5, PAL.metal[2]);
  for (let y = 6; y < 11; y += 2) b.hline(3, 10, y, PAL.metal[4]);
  b.rect(14, 1, 2, 3, PAL.metal[3]);
  b.rect(1, H - 2, W - 2, 2, PAL.metal[2]);
  b.outline(O);
  return { buf: b, ax: W / 2, ay: H };
}

export function paintTable() {
  const b = new PixelBuffer(30, 16);
  b.rect(0, 4, 30, 2, PAL.bark[6]);
  b.rect(0, 6, 30, 1, PAL.bark[3]);
  b.rect(2, 7, 2, 9, PAL.bark[3]);
  b.rect(26, 7, 2, 9, PAL.bark[3]);
  // map & mug & binoculars
  b.rect(5, 2, 10, 2, hex('#e8dcb0'));
  b.set(8, 2, PAL.red[5]);
  b.rect(18, 1, 3, 3, PAL.white[5]);
  b.rect(23, 2, 5, 2, PAL.metal[2]);
  b.outline(O);
  return { buf: b, ax: 15, ay: 16 };
}

export { mix };

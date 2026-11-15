// The mysterious archipelago on the title screen: hazy far islands with a smoking volcano and sea
// stacks, and a near headland with cliffs, jungle, a waterfall and a carved pou (guardian post)
// watching the sea. Silhouettes are rim-lit by the low sun; `glow` holds emissive bits.

import { PixelBuffer } from './pixel';
import { hex, mix, C } from './color';
import { fbm1, fbm2, hash2, bayer, clamp } from '../core/math';

export interface IsleArt { buf: PixelBuffer; glow: PixelBuffer; crater?: [number, number]; eyes?: [number, number][] }

type Prof = (x: number) => number;
const cone = (cx: number, hw: number, h: number, pow = 1.7, notch = 0): Prof => x => {
  const d = Math.abs(x - cx) / hw;
  if (d >= 1) return 0;
  let y = h * Math.pow(1 - d, pow);
  if (notch > 0 && Math.abs(x - cx) < notch) y -= (1 - Math.abs(x - cx) / notch) * notch * 0.45;
  return y;
};
const hill = (cx: number, hw: number, h: number, seed: number): Prof => x => {
  const d = (x - cx) / hw;
  if (Math.abs(d) >= 1) return 0;
  const base = Math.sqrt(1 - d * d);
  return h * base * (0.75 + fbm1(x * 0.05, 3, seed) * 0.5);
};
const stack = (cx: number, hw: number, h: number): Prof => x => { const d = Math.abs(x - cx) / hw; return d <= 1 ? h * (1 - d * d * 0.35) : 0; };
const cliff = (x0: number, x1: number, h: number, seed: number): Prof => x => {
  if (x < x0 || x > x1) return 0;
  const edge = Math.min(1, (x - x0) / 6);
  const top = h * (0.9 + fbm1(x * 0.03, 3, seed) * 0.2) * (x > x1 - 60 ? Math.max(0, (x1 - x) / 60) ** 0.5 : 1);
  return top * edge;
};

function silhouette(w: number, h: number, profs: Prof[], rough: number, seed: number) {
  const top = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let v = 0;
    for (const p of profs) v = Math.max(v, p(x));
    if (v > 0) v += (fbm1(x * 0.35, 2, seed) - 0.5) * rough;
    top[x] = clamp(v, 0, h - 1);
  }
  return top;
}

/** Far hazy islands: volcano with crater, a long ridge, sea stacks. Baseline is the bottom row. */
export function paintFarIsles(w = 960, h = 120, seed = 7): IsleArt {
  const b = new PixelBuffer(w, h), g = new PixelBuffer(w, h);
  const vx = Math.round(w * 0.62);
  const top = silhouette(w, h, [
    cone(vx, 200, 84, 1.45, 12), hill(vx - 250, 140, 42, seed), hill(vx + 250, 110, 34, seed + 1),
    hill(90, 120, 30, seed + 2), stack(vx - 120, 4, 30), stack(vx - 106, 3, 20), stack(w - 60, 5, 26),
  ], 2.2, seed);
  const body = hex('#5b4f7e'), dark = hex('#463c66'), haze = hex('#b494b4'), rim = hex('#f2c8b0'), rim2 = hex('#d8a8b8');
  for (let x = 0; x < w; x++) {
    const t = top[x];
    if (t < 0.5) continue;
    const y0 = Math.round(h - t);
    for (let y = y0; y < h; y++) {
      const dy = y - y0;
      const hz = (y - (h - 40)) / 40; // haze thickens toward the waterline
      let c: C = fbm2(x * 0.06, y * 0.12, 3, seed) > 0.56 ? dark : body;
      // lava streak and strata on the volcano
      if (Math.abs(x - vx) < 190 && hash2(x >> 2, y >> 3, seed) > 0.97) c = dark;
      if (hz > 0) c = mix(c, haze, clamp(hz + (bayer(x, y) - 0.5) * 0.3));
      if (dy === 0) c = rim;
      else if (dy === 1 && (x & 1) === 0) c = rim2;
      b.set(x, y, c);
    }
  }
  // crater glow + glowing lava threads
  const cy = Math.round(h - top[vx]) + 1;
  for (let i = -9; i <= 9; i++) for (let j = 0; j < 3; j++) if (Math.abs(i) < 9 - j * 2) g.set(vx + i, cy + j, j ? hex('#ff7a2a') : hex('#ffd07a'));
  for (let k = 0; k < 3; k++) {
    let x = vx + (k - 1) * 5, y = cy + 3;
    for (let n = 0; n < 34 + k * 8; n++) {
      if (hash2(n, k, seed) > 0.25) g.set(x, y, n < 10 ? hex('#ff9a3a') : hex('#c8401a'));
      y++;
      x += hash2(n, k + 9, seed) > 0.5 ? 1 : k === 0 ? -1 : 0;
    }
  }
  return { buf: b, glow: g, crater: [vx, cy] };
}

/** Near headland: cliffs, jungle crown, waterfall, sea arch and a carved guardian pou. */
export function paintNearIsles(w = 960, h = 170, seed = 11): IsleArt {
  const b = new PixelBuffer(w, h), g = new PixelBuffer(w, h);
  const cx0 = Math.round(w * 0.56), cx1 = w - 20;
  const ramp: Prof = x => (x < cx0 || x > cx1 ? 0 : 58 + (x - cx0) * 0.12 + Math.sin((x - cx0) * 0.03) * 8);
  const top = silhouette(w, h, [ramp, cliff(cx0, cx1, 70, seed), hill(cx0 + 150, 90, 104, seed + 3), hill(cx0 + 260, 70, 86, seed + 6), hill(120, 110, 46, seed + 4), stack(250, 7, 44), stack(268, 4, 26)], 2.4, seed);
  // carve a sea arch into the left island
  const archX = 120, archW = 26, archH = 22;
  const rock = [hex('#1c1830'), hex('#2a2446'), hex('#3a3058'), hex('#4c3e68')];
  const leaf = [hex('#12241f'), hex('#1c3630'), hex('#28483c'), hex('#3a6048')];
  const rim = hex('#f0b8a0');
  for (let x = 0; x < w; x++) {
    const t = top[x];
    if (t < 0.5) continue;
    const y0 = Math.round(h - t);
    for (let y = y0; y < h; y++) {
      const dx = (x - archX) / archW, dyA = (h - y) / archH;
      if (dx * dx + dyA * dyA < 1) continue;
      const dy = y - y0;
      const canopy = dy < 7 + fbm1(x * 0.2, 2, seed) * 6;
      const n = fbm2(x * 0.08, y * 0.05, 3, seed + 5);
      let c: C;
      if (canopy) {
        const lit = n + (7 - dy) * 0.04 + (bayer(x, y) - 0.5) * 0.25;
        c = leaf[clamp(Math.floor(lit * 4), 0, 3)];
      } else {
        // vertical cliff strata, lit from the upper left
        const strata = Math.sin(y * 0.55 + fbm1(x * 0.04, 2, seed) * 6) * 0.2;
        const k = n * 0.9 + strata + (x > cx0 && x < cx0 + 30 ? 0.25 : 0) - dy * 0.004 + (bayer(x, y) - 0.5) * 0.2;
        c = rock[clamp(Math.floor(k * 4), 0, 3)];
      }
      if (dy === 0) c = rim;
      else if (dy === 1 && hash2(x, 0, seed) > 0.4) c = leaf[3];
      b.set(x, y, c);
    }
  }
  // waterfall from a notch in the cliff
  const wx = cx0 + 70, wy0 = Math.round(h - top[wx]) + 6;
  for (let y = wy0; y < h - 2; y++) for (let i = 0; i < 3; i++) {
    const on = hash2(i, Math.floor(y / 3), seed) > 0.25;
    b.set(wx + i + Math.round(Math.sin(y * 0.07)), y, on ? hex('#dfeef0') : hex('#9ab8c4'));
  }
  // the pou: an old carving of a serpent rearing out of its coils on the cliff edge, leaning, its crest
  // broken, one pāua eye still catching the light
  const px = cx0 + 16, py = Math.round(h - top[px]) + 1;
  const wood = [hex('#140f1a'), hex('#231a2a'), hex('#3a2c3a')];
  const lean = (j: number) => Math.round(j * 0.09);
  // the coils: a lumpy mound on the cliff top
  for (let i = -6; i <= 6; i++) {
    const hh = Math.round(4 - (i * i) / 12 + (hash2(i, 3, seed) > 0.6 ? 1 : 0));
    for (let k = 0; k < hh; k++) b.set(px + i, py - k, k === hh - 1 ? (i < 0 ? rim : wood[2]) : (i + k) % 3 === 0 ? wood[0] : wood[1]);
  }
  // the body rising in an S, thinning to the neck
  const cx = (j: number) => px + Math.round(Math.sin(j * 0.2) * 2.4) - lean(j);
  for (let j = 3; j < 27; j++) {
    const hw = j < 14 ? 2 : 1;
    for (let i = -hw; i <= hw; i++) b.set(cx(j) + i, py - j, i === -hw ? rim : i === hw ? wood[0] : wood[(j >> 1) % 3 === 0 ? 0 : 2]);
  }
  // the head looking out to sea (west), a jaw line
  const hx = cx(27), hy = py - 28;
  for (let i = -5; i <= 1; i++) for (let k = -1; k <= 1; k++) b.set(hx + i, hy + k, k === -1 ? rim : i === -5 ? wood[1] : wood[2]);
  b.set(hx - 6, hy, wood[1]);
  for (let i = -5; i <= -1; i++) b.set(hx + i, hy + 1, wood[0]);
  // the crest: two spines left of three, the middle one snapped
  b.set(hx + 1, hy - 2, wood[1]); b.set(hx + 2, hy - 3, wood[1]); b.set(hx + 2, hy - 4, rim);
  b.set(hx + 2, hy - 1, wood[1]); b.set(hx + 3, hy - 2, wood[2]);
  b.set(hx + 3, hy + 1, wood[1]); b.set(hx + 4, hy, wood[1]); b.set(hx + 5, hy - 1, rim);
  const eyes: [number, number][] = [[hx - 3, hy - 1]];
  for (const [ex, ey] of eyes) { g.set(ex, ey, hex('#8ff0dc')); b.set(ex, ey, hex('#3a8a88')); }
  return { buf: b, glow: g, eyes };
}

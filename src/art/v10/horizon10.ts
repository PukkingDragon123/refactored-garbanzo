// V10 art: islands on the horizon for the boat trips, painted as hazy distant silhouettes (a few
// aerial-perspective tones, lit from the left, a lighter rim where the sun catches them):
//   home    the castaways' island: the west headland, the long beach, the forested ridge behind
//   islet   Motu Ahi: a steep volcanic cone with a notched crater (the scene adds the steam plume and
//           the birds), white guano streaks down the sea cliffs at its foot
//   coast   the far coast: a wall of sea cliffs with a waterfall into the sea and forest on top
//   reef    Glass Reef: a sand cay with two palms (the scene adds the surf line)
// Anchored at the bottom centre of the waterline.

import { PixelBuffer } from '../pixel';
import { C, hex, mix } from '../color';
import { bayer, clamp, fbm2, noise1 } from '../../core/math';
import type { Horizon } from '../../game/sites10/ocean';

export interface HSpr { buf: PixelBuffer; ax: number; ay: number }
export interface HorizonBufs { home: HSpr; ahead: HSpr | null; glow: HSpr | null; crater: [number, number] }

const HAZE = hex('#a8c0d4');
/** distant land: dark to light, already pushed toward the sky colour */
const LAND = ['#4a5e6e', '#5a7080', '#6c8290', '#8098a6', '#9ab0bc'].map(h => hex(h));
const GREEN = ['#466058', '#557064', '#668272', '#7c9682', '#94aa94'].map(h => hex(h));
const tone = (r: C[], f: number, x: number, y: number) => r[clamp(Math.round(f + (bayer(x, y) - 0.5) * 0.7), 0, r.length - 1)];

/** a ridge profile: height at column x (0..w) */
function silhouette(w: number, h: number, top: (x: number) => number, col: (x: number, y: number, d: number, lit: number) => C): HSpr {
  const b = new PixelBuffer(w, h + 2);
  for (let x = 0; x < w; x++) {
    const t = Math.round(clamp(top(x), 0, h));
    const slope = top(x + 2) - top(x - 2);
    const lit = clamp(0.5 + slope * 0.18);
    for (let y = t; y < h; y++) b.set(x, y, col(x, y, y - t, lit));
  }
  // the sea's edge: a pale line of surf at the foot
  for (let x = 0; x < w; x++) if (b.get(x, h - 1) >>> 24 && noise1(x / 6, 3) > 0.35) b.set(x, h - 1, hex('#dce8ee'));
  return { buf: b, ax: Math.round(w / 2), ay: h - 1 };
}

function home(): HSpr {
  const w = 340, h = 52;
  return silhouette(w, h, x => {
    const u = x / w;
    // west headland, then the low beach, then the forested ridge rising to the east
    const head = Math.exp(-((u - 0.1) ** 2) / 0.004) * 30;
    const ridge = Math.max(0, Math.sin(Math.PI * clamp((u - 0.32) / 0.68))) * 40 + noise1(x / 18, 5) * 6;
    return h - 4 - Math.max(head, ridge, 3);
  }, (x, y, d, lit) => {
    const u = x / w;
    const r = u > 0.3 ? GREEN : LAND;
    let c = tone(r, 1.2 + lit * 2.2 - d * 0.04, x, y);
    if (u > 0.18 && u < 0.32 && y > h - 8) c = mix(hex('#c8bc9c'), HAZE, 0.4); // the beach
    if (fbm2(x / 8, y / 6, 2, 9) > 0.62 && u > 0.3) c = mix(c, GREEN[0], 0.4);
    return mix(c, HAZE, 0.18);
  });
}

function islet(): { spr: HSpr; crater: [number, number] } {
  const w = 220, h = 82;
  const cx = 0.48;
  const spr = silhouette(w, h, x => {
    const u = x / w;
    // the cone: steep sides, a notched crater, a shoulder of older lava to the east
    const cone = Math.max(0, 1 - Math.abs(u - cx) / 0.36) ** 1.25 * 72;
    const notch = Math.exp(-((u - cx - 0.02) ** 2) / 0.0012) * 9;
    const shoulder = Math.exp(-((u - 0.78) ** 2) / 0.01) * 18;
    return h - 6 - Math.max(cone - notch, shoulder, 4) + noise1(x / 7, 11) * 2;
  }, (x, y, d, lit) => {
    let c = tone(LAND, 0.6 + lit * 2.8 - d * 0.02, x, y);
    // the scorched upper cone, lava ribs, green lower slopes, white guano on the sea cliffs
    const u = x / w;
    if (y > h - 24 && fbm2(x / 10, y / 8, 2, 4) > 0.45) c = tone(GREEN, 1 + lit * 2, x, y);
    // guano: irregular pale streaks running down the sea cliffs under the ledges
    if (y > h - 18 && u > 0.18 && u < 0.82 && fbm2(x / 3.5, y / 16, 2, 6) > 0.6 && noise1(x / 11, 2) > 0.35) c = mix(hex('#e8eae4'), HAZE, 0.25);
    if (Math.sin(x * 0.9 + y * 0.2) > 0.96 && y < h - 20) c = LAND[0];
    return mix(c, HAZE, 0.12);
  });
  return { spr, crater: [Math.round((cx + 0.02) * w) - spr.ax, h - 6 - 66] };
}

function coast(): HSpr {
  const w = 420, h = 62;
  const fall = 0.62;
  return silhouette(w, h, x => {
    const u = x / w;
    const cliff = 44 + noise1(x / 30, 21) * 10 + Math.sin(u * 9) * 3;
    const gorge = Math.exp(-((u - fall) ** 2) / 0.0008) * 18;
    const ends = Math.min(1, u * 8, (1 - u) * 8);
    return h - 4 - (cliff - gorge) * ends;
  }, (x, y, d, lit) => {
    const u = x / w;
    let c = d < 5 ? tone(GREEN, 2 + lit * 2, x, y) : tone(LAND, 1 + lit * 2.2 - d * 0.015, x, y);
    // strata on the cliff face, the waterfall in the gorge
    if (d > 6 && Math.sin(y * 0.9 + noise1(x / 20, 4) * 3) > 0.85) c = LAND[1];
    if (Math.abs(u - fall) < 0.008 && d > 2) c = mix(hex('#eef6fa'), HAZE, 0.15);
    return mix(c, HAZE, 0.16);
  });
}

function reef(): HSpr {
  const w = 140, h = 30;
  const b = new PixelBuffer(w, h);
  // a low sand cay, two palms leaning in the trade wind
  for (let x = 30; x < 110; x++) {
    const u = (x - 30) / 80;
    const t = h - 3 - Math.sin(u * Math.PI) * 4;
    for (let y = Math.round(t); y < h; y++) b.set(x, y, mix(hex('#e8dcb8'), HAZE, 0.3 + (y - t) * 0.02));
  }
  for (const [px, lean] of [[58, -1], [80, 1]] as const) {
    for (let i = 0; i < 18; i++) { const x = px + lean * i * 0.35, y = h - 5 - i; b.set(Math.round(x), y, LAND[1]); }
    const tx = px + lean * 6.3, ty = h - 23;
    for (let a = 0; a < 7; a++) {
      const ang = -Math.PI / 2 + (a - 3) * 0.55;
      for (let r = 2; r < 9; r++) b.set(Math.round(tx + Math.cos(ang) * r), Math.round(ty + Math.sin(ang) * r * 0.6 + r * r * 0.05), GREEN[2]);
    }
  }
  return { buf: b, ax: Math.round(w / 2), ay: h - 1 };
}

export function paintHorizonBufs(ahead: Horizon): HorizonBufs {
  const out: HorizonBufs = { home: home(), ahead: null, glow: null, crater: [0, 0] };
  if (ahead === 'islet') { const i = islet(); out.ahead = i.spr; out.crater = i.crater; }
  else if (ahead === 'coast') out.ahead = coast();
  else if (ahead === 'reef') out.ahead = reef();
  return out;
}

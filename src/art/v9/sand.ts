// V9 island ground: the pixel painters for the beach sand and the west rock shelf, used by
// island4/ground.ts. The sand runs from the glassy swash zone at the walk line (the mirror band, with
// sheen streaks, foam lace left by the backwash, rills and crab holes) through a damp margin and the
// wrack line (clumps of kelp, shell hash, twigs, an older bleached line further up) to dry, wind-rippled
// sand with black ironsand streaks, pebbles, shell grit and bird tracks, and hummocky dune sand with
// spinifex runners and grass tufts toward the camera. Texture scales up with distance from the walk
// line (it's nearer the camera). The rock shelf is tilted basalt slabs lit on top with dark risers,
// barnacles and mussels, sand pockets and weedy rock pools, dissolving into the beach eastward.

import { hex, mix, shade, C } from '../color';
import { bayer, clamp, fbm1, fbm2, hash2, noise1, noise2, smoothstep } from '../../core/math';

const SAND = { hi: hex('#f6e4b2'), lit: hex('#f0d8a2'), mid: hex('#e2c48c'), low: hex('#cea872'), deep: hex('#b48c5a') };
const WETS = { a: hex('#5e5646'), b: hex('#9a8666'), damp: hex('#bfa47a') };
const IRON = hex('#4e4944');
const KELP = [hex('#2e2a14'), hex('#3e3a1a'), hex('#524a22'), hex('#6a5e2c')];
const SHELL = [hex('#f6efe2'), hex('#f2d4c4'), hex('#e8dcc0'), hex('#d8c8a8'), hex('#c8b8e0')];
const PEBBLE = [hex('#5a5652'), hex('#76706a'), hex('#9a948a'), hex('#b4ada0')];
const GRASS = [hex('#5a6a34'), hex('#7a8a44'), hex('#a0a458'), hex('#c8c078')];
const ROCK = [hex('#141316'), hex('#1e1c20'), hex('#29262a'), hex('#353134'), hex('#433e3e'), hex('#544d4a'), hex('#686058'), hex('#7e7566')];

/** per-column values of the beach, computed once per x */
export interface SandCol { x: number; wet: number; wrack: number; wrackK: number; old: number; iron: number; ripK: number }
export function sandCol(x: number): SandCol {
  return {
    x,
    // how far the swash zone (the mirror) reaches toward the camera
    wet: 21 + (fbm1(x / 90, 3, 5) - 0.5) * 12 + (noise1(x / 13, 6) - 0.5) * 3,
    // the fresh wrack line just above the swash, clumped where the tide dumped heaps of kelp
    wrack: 0, wrackK: Math.max(0, fbm1(x / 46, 3, 51) - 0.34) * 2.4,
    // an older, bleached tide line further up
    old: 48 + (fbm1(x / 70, 2, 57) - 0.5) * 16,
    iron: noise1(x / 160, 58),
    ripK: 0.35 + fbm1(x / 120, 2, 59) * 0.9,
  };
}

function grit(x: number, y: number, c: C, d: number): C {
  // scattered shell grit, pebbles and dark specks; grains get bigger nearer the camera
  const s = d > 70 ? 2 : 1;
  const g = hash2(Math.floor(x / s), Math.floor(y / s), 8);
  if (g < 0.045) return shade(c, -0.06);
  if (g > 0.975) return shade(c, 0.06);
  if (g > 0.9985) return SHELL[Math.floor(hash2(x, y, 9) * SHELL.length)];
  if (g < 0.0022) return PEBBLE[Math.floor(hash2(x, y, 10) * 2) + (hash2(x, y - 1, 8) < 0.5 ? 0 : 2)];
  return c;
}

/** sand at world (x, y), d px below the walk line. Returns the colour and whether it's the wet mirror. */
export function sandPixel(col: SandCol, x: number, y: number, d: number): [C, boolean] {
  const W = col.wet;
  if (d < W) {
    // ---- swash zone: glassy wet sand (drawn again as a mirror)
    const k = Math.max(0, d) / W;
    let c = mix(WETS.a, WETS.b, Math.pow(k, 0.85));
    if (noise2(x / 34, y / 1.4, 11) > 0.74) c = mix(c, hex('#dcd4c4'), 0.2);
    // lace of foam left by the last backwash, in broken lines
    const lace = Math.abs(d - (W * 0.55 + Math.sin(x * 0.045) * 3 + (noise1(x / 17, 12) - 0.5) * 5));
    if (lace < 0.6 && noise1(x / 5, 13) > 0.42) c = mix(c, hex('#eef4f0'), 0.45);
    // rills where the backwash drains, and small ripple marks
    if (Math.abs(noise2(x / 3, y / 16, 14) - 0.5) < 0.025 && k > 0.2) c = shade(c, -0.08);
    if (Math.sin(x * 0.5 + Math.sin(y * 0.7) * 2 + y * 0.9) > 0.95) c = shade(c, -0.05);
    if (col.iron > 0.55) { const f = fbm2(x / 90, y / 12, 2, 18); if (bayer(x, y) < smoothstep(0.58, 0.74, f)) c = mix(c, IRON, 0.25); }
    const h = hash2(x, y, 21);
    if (h < 0.004) c = hex('#3e3628'); // crab and worm holes
    else if (h > 0.9975) c = SHELL[Math.floor(hash2(x, y, 22) * 3)]; // a wet shell catching the light
    return [c, true];
  }
  // ---- damp margin, dithered into the dry sand
  const t = clamp((d - 30) / 150);
  let c = mix(SAND.lit, SAND.mid, t * 0.8);
  const hum = fbm2(x / 150, y / 46, 3, 7) - 0.5;
  c = shade(c, hum * 0.14 + (d > 80 ? (noise2(x / 40, y / 16, 16) - 0.5) * 0.1 : 0));
  // wind ripples: long gentle crests that open up toward the viewer, patchy along the beach
  const rip = Math.sin((d / (1.7 + t * 4.4)) * 2.2 + fbm2(x / 70, y / 30, 2, 4) * 7);
  const rk = col.ripK * (0.6 + noise2(x / 60, y / 20, 17) * 0.8);
  if (rip > 1 - 0.1 * rk) c = shade(c, -0.075);
  else if (rip > 1 - 0.2 * rk) c = shade(c, 0.05);
  // black ironsand: the heavy grains collect in the ripple troughs, drawing them in dark lines
  if (col.iron > 0.45 && rip < -0.86) {
    const a = smoothstep(0.5, 0.7, fbm2(x / 80, y / 14, 2, 18)) * Math.min(1, (col.iron - 0.45) * 3);
    if (a > 0.05) c = mix(c, IRON, 0.1 + a * 0.22);
  }
  const damp = d - W;
  if (damp < 7) {
    const k = damp / 7;
    if (bayer(x, y) > k * 0.9) c = mix(c, WETS.damp, 0.55 * (1 - k * 0.6));
  }
  // ---- the fresh wrack line: clumps of kelp, shell hash, twigs
  const wr = Math.abs(d - (W + 4 + (noise1(x / 11, 52) - 0.5) * 3));
  const wk = col.wrackK;
  if (wr < 1 + wk * 1.4) {
    const n = noise2(x / 3, y / 2, 53);
    if (n > 0.62 - wk * 0.12) c = KELP[Math.floor(hash2(x, y, 54) * 2) + (n > 0.8 ? 2 : 0)];
    else if (hash2(x, y, 55) < 0.08 + wk * 0.05) c = SHELL[Math.floor(hash2(x, y, 56) * SHELL.length)];
  }
  // the old bleached tide line
  const ol = Math.abs(d - col.old);
  if (ol < 1.2 && noise1(x / 6, 60) > 0.55) c = hash2(x, y, 61) < 0.5 ? mix(c, hex('#8a8466'), 0.5) : mix(c, SHELL[0], 0.5);
  // twigs and splinters lying along the lines
  if ((wr < 2 || ol < 2) && hash2(Math.floor(x / 5), Math.floor(y), 62) < 0.02) c = hex('#7a5a3a');
  c = grit(x, y, c, d);
  // ---- toward the camera: spinifex runners creeping over the dune sand (the tufts are sprites)
  if (d > 90) {
    const k = smoothstep(90, 160, d);
    const run = Math.abs(Math.sin(x * 0.05 + fbm2(x / 50, y / 20, 2, 63) * 5 + y * 0.1));
    if (run < 0.035 * k && noise2(x / 40, y / 14, 64) > 0.5) c = hash2(x, y, 66) < 0.2 ? GRASS[3] : GRASS[1];
  }
  return [c, false];
}

// ------------------------------------------------------------------ the west rock shelf

/** How much of the ground at world x is rock shelf (0 sand .. 1 solid rock). */
export const shelfK = (x: number) => 1 - smoothstep(240, 450, x);

// A wave-cut platform seen from the land: ledges running along the shore, each a little lower than the
// one in front, with a dark riser where it drops toward the sea. Spacing grows toward the camera.
const LEDGE = [0, 6, 14, 25, 40, 60, 88, 124, 170, 230];
const ledgeB = (x: number, i: number) => LEDGE[i] + (noise1(x / (16 + i * 7), 90 + i) - 0.5) * (3 + i * 2.6) + (noise1(x / 5, 100 + i) - 0.5) * (1 + i * 0.3);

/** rock shelf pixel (or null where sand fills the gaps between the rocks) */
export function shelfPixel(x: number, y: number, d: number): [C, boolean] | null {
  if (x > 470) return null;
  let i = 0;
  while (i < LEDGE.length - 2 && d >= ledgeB(x, i + 1)) i++;
  const b0 = ledgeB(x, i), b1 = ledgeB(x, i + 1);
  // each ledge is broken into blocks along the shore by joints
  const segL = 34 + i * 16;
  const jx = x + (noise1(d / 7 + i * 3, 110) - 0.5) * (6 + i * 2);
  const seg = Math.floor(jx / segL), fx = jx / segL - seg;
  const sh = hash2(seg, i, 111);
  // blocks drop out toward the beach (whole blocks, so the edge is a scatter of rocks in the sand)
  const k = shelfK((seg + 0.5) * segL);
  if (sh < 1 - k * 1.2) return null;
  // round the exposed ends of a block that has sand beside it
  const nextGone = hash2(seg + 1, i, 111) < 1 - shelfK((seg + 1.5) * segL) * 1.2;
  const prevGone = hash2(seg - 1, i, 111) < 1 - shelfK((seg - 0.5) * segL) * 1.2;
  const v = (d - b0) / Math.max(1, b1 - b0);
  if ((nextGone && fx > 0.82 + Math.sin(v * Math.PI) * 0.16) || (prevGone && fx < 0.18 - Math.sin(v * Math.PI) * 0.16)) return null;
  const riser = 1.2 + i * 0.7;
  let l = 0.52 + (sh - 0.5) * 0.3 + (hash2(seg, i, 112) - 0.5) * 0.2 + (noise2(x / 6, y / 3, 75) - 0.5) * 0.2 - v * 0.08;
  if (d > b1 - riser) l = 0.08 + (b1 - d) / riser * 0.1; // the drop toward the sea, in shadow
  else if (d < b0 + 1.2) l = 0.78; // lit upper lip
  if (fx < 0.03 || fx > 0.97) l = Math.min(l, 0.14); // joints between blocks
  else if (fx < 0.07) l += 0.14;
  l -= (1 - smoothstep(0, 30, d)) * 0.14; // the splash zone near the sea is darker and wetter
  let c = ROCK[clamp(Math.round(l * (ROCK.length - 1) + (bayer(x, y) - 0.5) * 0.7), 0, ROCK.length - 1)];
  let wet = d < 8 && hash2(x, y, 83) < 0.7;
  // rock pools sitting in hollows of the broader ledges: sky-lit water over weed and pebbles
  if (i >= 2 && hash2(seg, i, 113) > 0.55 && k > 0.4) {
    const pc = 0.3 + hash2(seg, i, 114) * 0.4, pr = 0.16 + hash2(seg, i, 115) * 0.14;
    const q = ((fx - pc) / pr) ** 2 + ((v - 0.45) / 0.3) ** 2 + (noise2(x / 5, y / 3, 116) - 0.5) * 0.3;
    if (q < 1) {
      const depth = clamp((1 - q) * 1.4);
      c = mix(hex('#5a8a90'), hex('#1c3a46'), depth);
      if (noise2(x / 4, y / 2, 77) > 0.7) c = mix(c, hex('#4e7a3a'), 0.35);
      if (hash2(x, y, 78) < 0.02) c = mix(c, hex('#b8ccc4'), 0.35);
      if (q > 0.82) c = hex('#26343a');
      return [c, true];
    }
    if (q < 1.35) c = mix(c, hex('#56703e'), 0.55); // weedy lip round the pool
  }
  // barnacles and mussels in the splash zone, weed in the low places, pale lichen up top
  if (d < 22 && hash2(x, y, 79) < 0.06 && l > 0.3) c = hex('#cfc8b6');
  if (d < 30 && d > b1 - riser - 2 && noise2(x / 4, y / 3, 80) > 0.55) c = noise2(x, y, 81) > 0.5 ? hex('#1a1e2a') : hex('#2a3242');
  if (d > b1 - riser - 3 && noise2(x / 6, y / 3, 82) > 0.6) c = mix(c, hex('#44662e'), 0.55);
  if (d > 50 && noise2(x / 9, y / 5, 86) > 0.84) c = mix(c, hex('#9a9a7a'), 0.25);
  if (d < 10) c = mix(c, hex('#0e1216'), 0.2);
  return [c, wet];
}

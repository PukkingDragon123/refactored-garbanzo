// V9 island art: what the tide leaves. Heaps of bull kelp (glossy straps, coiled stipes, knobbly
// holdfasts) mixed with Neptune's necklace and sea lettuce, single kelp strands, scatters of little
// shells (cockle, pipi, pāua, cat's eye, scallop, moon snail), bigger finds (a pāua shell showing its
// rainbow, a crab shell, a kina test, a starfish, a sand dollar, a stranded jelly, a gull feather,
// pumice), and basalt boulders for the shore with barnacle bands and weed skirts.

import { PixelBuffer } from '../pixel';
import { blade, tube, P } from '../jungle-core';
import { bayer, clamp, hash2, noise1, noise2 } from '../../core/math';
import { Bed, Sprite, Rng, C, canvas, done, sandLip, tone, ramp, bedTone, hex, mix, shade } from './kit';

export const KELP = ramp('#16140a', '#24200e', '#363014', '#4a421a', '#605420', '#786a28', '#948432', '#b0a044');
const LETTUCE = ramp('#1e4a1a', '#2e6a22', '#46902e', '#6cb444', '#9ad266');
const NECK = ramp('#3a3010', '#5a4a18', '#806a22', '#a88c30', '#cab048');
const REDWEED = ramp('#3a0e14', '#5e1822', '#862a30', '#ac4a44');
const SHELLS = {
  cockle: ramp('#8a8070', '#bdb4a0', '#e2dac8', '#f8f4ea'),
  pipi: ramp('#8a7a5a', '#b8a47c', '#dccaa0', '#f2e6c8'),
  scallop: ramp('#6a2a1a', '#a84a2a', '#d87a4a', '#f4a878'),
  moon: ramp('#6a6258', '#9a9084', '#cac0b0', '#eee8dc'),
  cats: ramp('#1e2418', '#3a4230', '#5a6448', '#86906a'),
  paua: ramp('#2a2418', '#4a3e2a', '#6e5e40', '#948258'),
};
const ROCK = ramp('#151417', '#1f1d21', '#2a272b', '#363235', '#443e3e', '#554d4a', '#6a6158', '#80766a', '#978b7c');

// ------------------------------------------------------------------ kelp and weed

/** a heap of washed-up bull kelp with other weed tangled in */
export function kelpHeap(seed: number, w = 44, bed: Bed = 'damp'): Sprite {
  const rng = new Rng(seed * 137 + 23);
  const H = Math.max(6, w * 0.22);
  const { buf, o } = canvas(w + 20, H + 14, 10);
  const x0 = o + 8, gy = o + H + 10;
  // stipes: thick round stalks coiled through the heap
  for (let k = 0; k < rng.int(2, 4); k++) {
    const pts: P[] = [];
    const sx = x0 + rng.range(0, w * 0.4), dir = rng.chance(0.7) ? 1 : -1;
    for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([sx + dir * t * w * rng.range(0.5, 0.8), gy - 2 - Math.sin(t * Math.PI * rng.range(1, 2.4)) * H * 0.5 - rng.range(0, 2)]); }
    tube(buf, pts, t => 1.9 - t * 0.6, KELP, 3.6, { spread: 2.2 });
  }
  // the broad straps (blades), lying in overlapping folds
  for (let k = 0; k < Math.round(w / 5); k++) {
    const x = x0 + rng.range(0, w), y = gy - rng.range(0, H * 0.7);
    const a = (rng.chance(0.5) ? 0 : Math.PI) + rng.range(-0.5, 0.5);
    blade(buf, { x, y, ang: a, len: rng.range(8, w * 0.45), droop: rng.range(0.2, 0.9), w0: rng.range(3, 5.5), ramp: KELP, base: rng.int(3, 5) });
  }
  // honeycomb texture and wet glints on the straps
  for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) {
    const c = buf.data[y * buf.w + x];
    if (!(c >>> 24)) continue;
    if (noise2(x / 1.7, y / 1.7, seed) > 0.78) buf.data[y * buf.w + x] = shade(c, -0.12);
    if (!buf.opaque(x, y - 1) && hash2(x, y, seed + 1) < 0.22) buf.data[y * buf.w + x] = KELP[7];
    else if (hash2(x, y, seed + 2) < 0.012) buf.data[y * buf.w + x] = hex('#f4f0d8');
  }
  // the knobbly holdfast at one end
  const hx = x0 + (rng.chance(0.5) ? 2 : w - 2), hy = gy - 2;
  for (let k = 0; k < 9; k++) {
    const cx = hx + rng.range(-4, 4), cy = hy - rng.range(0, 4), r = rng.range(1.2, 2.2);
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) buf.set(x, y, (x - cx) + (y - cy) < -r * 0.4 ? KELP[6] : KELP[2]);
  }
  // Neptune's necklace, sea lettuce and a little red weed tangled in
  for (let k = 0; k < rng.int(1, 3); k++) {
    let x = x0 + rng.range(0, w), y = gy - rng.range(1, H * 0.6);
    for (let b = 0; b < rng.int(4, 9); b++) {
      buf.set(x, y, NECK[3]); buf.set(x + 1, y, NECK[2]); buf.set(x, y + 1, NECK[1]); buf.set(x, y - 1, NECK[4]);
      x += rng.range(1.6, 2.6); y += rng.range(-1.2, 1.2);
    }
  }
  if (rng.chance(0.6)) {
    const cx = x0 + rng.range(w * 0.2, w * 0.8), cy = gy - H * 0.5;
    for (let y = Math.floor(cy - 3); y <= cy + 3; y++) for (let x = Math.floor(cx - 6); x <= cx + 6; x++) {
      if (((x - cx) / 6) ** 2 + ((y - cy) / 3) ** 2 + (noise2(x / 2, y / 2, seed + 3) - 0.5) * 0.8 < 1) buf.set(x, y, tone(LETTUCE, 0.55 - (y - cy) / 6, x, y));
    }
  }
  if (rng.chance(0.5)) for (let k = 0; k < 12; k++) buf.set(x0 + rng.range(0, w), gy - rng.range(0, H * 0.5), REDWEED[rng.int(1, 3)]);
  sandLip(buf, x0 - 4, x0 + w + 4, gy + 0.5, 2, bed, seed + 4, 1.4);
  return done(buf, x0 + w / 2, gy, 0.3);
}

/** a single strand of kelp across the sand: stipe, then a long ragged blade */
export function kelpStrand(seed: number, len = 60, bed: Bed = 'wet'): Sprite {
  const rng = new Rng(seed * 139 + 25);
  const { buf, o } = canvas(len + 10, 20, 8);
  const gy = o + 16;
  const pts: P[] = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([o + 4 + t * len * 0.55, gy - 2 - Math.sin(t * 3 + seed) * 3]); }
  tube(buf, pts, () => 1.3, KELP, 3.4, { spread: 2 });
  const [ex, ey] = pts[12];
  blade(buf, { x: ex, y: ey, ang: rng.range(-0.3, 0.2), len: len * 0.5, droop: 0.3, w0: 4.5, ramp: KELP, base: 4 });
  for (let k = 0; k < 5; k++) buf.set(o + 3 - k * 0.6, gy - 2 + rng.range(-2, 2), KELP[2]); // holdfast frazzle
  for (let x = 0; x < buf.w; x++) for (let y = 0; y < buf.h; y++) if (buf.opaque(x, y) && !buf.opaque(x, y - 1) && hash2(x, y, seed) < 0.3) buf.set(x, y, KELP[7]);
  sandLip(buf, o + len * 0.3, o + len * 0.45, gy + 0.5, 1.4, bed, seed + 2);
  return done(buf, o + 4 + len / 2, gy, 0.25);
}

// ------------------------------------------------------------------ shells and finds

type ShellKind = keyof typeof SHELLS;
function tinyShell(b: PixelBuffer, x: number, y: number, kind: ShellKind, buried: boolean, seed: number) {
  const rp = SHELLS[kind];
  const put = (dx: number, dy: number, i: number) => { if (!(buried && dy > 0)) b.set(x + dx, y + dy, rp[clamp(i, 0, 3)]); };
  switch (kind) {
    case 'cockle': case 'scallop': // a ribbed fan
      for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 0; dy++) if (dx * dx + dy * dy * 2.2 <= 5) put(dx, dy + 1, 2 + (dx & 1 ? 0 : 1) - (dy === 0 ? 1 : 0));
      put(0, 1, 1); break;
    case 'pipi': // a smooth wedge
      for (let dx = -2; dx <= 2; dx++) { put(dx, 0, 2 + (dx < 0 ? 1 : 0)); if (Math.abs(dx) < 2) put(dx, 1, 1); } put(-1, -1, 3); break;
    case 'moon': // a round swirl
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) put(dx, dy, dx + dy < 0 ? 3 : dx + dy > 0 ? 1 : 2);
      put(0, 0, 0); break;
    case 'cats': // a dark turban with its green eye
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) put(dx, dy, 1 + (dy < 0 ? 1 : 0));
      b.set(x, y, hex('#5ab87a')); break;
    case 'paua': // an oval, rough outside up (or the rainbow inside)
      for (let dx = -2; dx <= 2; dx++) for (let dy = -1; dy <= 1; dy++) if (dx * dx / 5 + dy * dy / 1.6 <= 1) put(dx, dy, 1 + ((dx + dy) & 1));
      if (hash2(x, y, seed) < 0.5) { b.set(x, y, hex('#4ac8b8')); b.set(x - 1, y, hex('#6a7ae0')); b.set(x + 1, y - 1, hex('#e07ab8')); }
      break;
  }
}

/** a scatter of little shells and grit, some half-buried (a flat decal) */
export function shellScatter(seed: number, w = 30, n = 9): Sprite {
  const rng = new Rng(seed * 149 + 27);
  const { buf, o } = canvas(w, 8, 6);
  const kinds: ShellKind[] = ['cockle', 'cockle', 'pipi', 'pipi', 'moon', 'cats', 'scallop', 'paua'];
  for (let k = 0; k < n; k++) tinyShell(buf, o + rng.range(2, w - 2), o + rng.range(2, 6), rng.pick(kinds), rng.chance(0.35), seed + k);
  for (let k = 0; k < n * 2; k++) buf.set(o + rng.range(0, w), o + rng.range(2, 7), rng.chance(0.5) ? hex('#f2ece0') : hex('#c8bca4'));
  return done(buf, o + w / 2, o + 6, 0);
}

export type FindKind = 'paua' | 'crab' | 'kina' | 'star' | 'dollar' | 'jelly' | 'feather' | 'pumice' | 'cuttle' | 'whelk';
/** one bigger beach find, lying in the sand */
export function find(kind: FindKind, seed = 1, bed: Bed = 'dry'): Sprite {
  const rng = new Rng(seed * 151 + 29);
  const { buf, o } = canvas(14, 9, 6);
  const cx = o + 7, cy = o + 5;
  const ell = (rx: number, ry: number, fn: (nx: number, ny: number, x: number, y: number) => C | -1) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const c = fn(nx, ny, x, y);
      if (c !== -1) buf.set(x, y, c);
    }
  };
  switch (kind) {
    case 'paua': // the rainbow inside turned up, a row of breathing holes along the rim
      ell(5, 3, (nx, ny, x, y) => {
        if (nx * nx + ny * ny > 0.72) return SHELLS.paua[1 + (ny < 0 ? 1 : 0)];
        const h = noise2(x / 2, y / 1.5, seed) * 3 + nx;
        return [hex('#2a8a9a'), hex('#4ac8b8'), hex('#6a7ae0'), hex('#b86ad8'), hex('#8ae0c8')][clamp(Math.floor(h * 1.6), 0, 4)];
      });
      for (let k = -3; k <= 2; k += 2) buf.set(cx + k, cy - 2, hex('#1a1410'));
      break;
    case 'crab': // an orange crab shell with a couple of legs
      ell(4, 2.5, (nx, ny, x, y) => tone(ramp('#6a1a0a', '#a8321a', '#d8582a', '#f48a4a'), 0.6 - ny * 0.4 - nx * 0.1, x, y));
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) buf.set(cx + s * (4 + k), cy + 1 + k * 0.4, hex('#b8421e'));
      buf.set(cx - 1, cy - 1, hex('#ffd0a0'));
      break;
    case 'kina': // an urchin test: purple-green dome with rows of dots
      ell(3.5, 2.8, (nx, ny, x, y) => ((x + y) % 2 === 0 && ny < 0.5 ? hex('#c8b8d8') : tone(ramp('#2a3a2a', '#4a5a3e', '#6a7a54', '#9a8aa8'), 0.6 - ny * 0.5, x, y)));
      break;
    case 'star': // a five-armed starfish
      for (let a = 0; a < 5; a++) {
        const ang = -Math.PI / 2 + a * (Math.PI * 2 / 5) + rng.range(-0.1, 0.1);
        for (let r = 0; r < 5; r++) { const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r * 0.6; buf.set(x, y, r < 2 ? hex('#e8702a') : hex('#d05a1e')); if (r < 3) buf.set(x + 1, y, hex('#f49040')); }
      }
      buf.set(cx, cy, hex('#ffb070'));
      break;
    case 'dollar': // a pale sand dollar with its petal star
      ell(3.5, 2.2, (nx, ny) => (Math.abs(nx) < 0.15 || Math.abs(nx + ny) < 0.15 || Math.abs(nx - ny) < 0.15 ? hex('#c8bca0') : ny < 0 ? hex('#f4eee0') : hex('#e0d6c0')));
      break;
    case 'jelly': // a stranded moon jelly, glassy and faintly blue
      ell(5, 2.4, (nx, ny, x, y) => {
        const r = Math.hypot(nx, ny);
        if (r > 0.86) return hex('#9ab8c8', 200);
        if (Math.abs(r - 0.45) < 0.12) return hex('#c8a8d8', 210);
        return hash2(x, y, seed) < 0.1 ? hex('#ffffff', 230) : hex('#b8d8e4', 150);
      });
      break;
    case 'feather': // a gull's flight feather
      for (let k = 0; k < 9; k++) { buf.set(cx - 4 + k, cy - k * 0.2, hex('#8a8a86')); if (k > 1) { buf.set(cx - 4 + k, cy - 1 - k * 0.2, k > 6 ? hex('#3a3a3a') : hex('#e8e8e4')); buf.set(cx - 4 + k, cy + 1 - k * 0.2, hex('#c8c8c4')); } }
      break;
    case 'pumice': // porous grey floaters
      for (const [dx, dy, r] of [[0, 0, 2.6], [4, 1, 1.8], [-3, 1, 1.5]] as const) for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
        if (x * x + y * y > r * r) continue;
        buf.set(cx + dx + x, cy + dy + y, hash2(x + dx, y, seed) < 0.2 ? hex('#6a6862') : x + y < 0 ? hex('#c8c4b8') : hex('#9a968c'));
      }
      break;
    case 'cuttle': // a white cuttlebone
      ell(4.5, 1.6, (nx, ny) => (ny < -0.2 ? hex('#fbf8f0') : Math.abs(nx) > 0.8 ? hex('#c8b89a') : hex('#e8e2d4')));
      break;
    case 'whelk': // a spiral whelk shell
      for (let k = 0; k < 6; k++) for (let j = -Math.max(0, 2 - k * 0.3); j <= Math.max(0, 2 - k * 0.3); j++) buf.set(cx - 3 + k, cy + j, (k + Math.round(j)) % 2 ? hex('#d8c4a4') : hex('#a88a64'));
      buf.set(cx + 3, cy, hex('#6a5038'));
      break;
  }
  if (bed !== 'none' && kind !== 'jelly' && kind !== 'feather') sandLip(buf, cx - 4, cx + 4, cy + 3, 1.3, bed, seed + 3);
  return done(buf, cx, cy + 3, kind === 'jelly' ? 0 : 0.3);
}

// ------------------------------------------------------------------ boulders

/**
 * A basalt boulder: fractured facets lit from the upper left. 'shore' rocks carry a black wet base, a
 * barnacle band and a weed skirt; 'beach' rocks are dry with lichen and sit in drifted sand.
 */
export function boulder(seed: number, w = 30, h = 20, zone: 'shore' | 'beach' = 'beach', bed: Bed = 'dry'): Sprite {
  const rng = new Rng(seed * 157 + 31);
  const { buf, o } = canvas(w + 6, h + 6, 8);
  const cx = o + w / 2 + 3, gy = o + h + 3;
  const lean = rng.range(-0.25, 0.25);
  const topAt = (x: number) => {
    const u = (x - cx) / (w / 2);
    if (Math.abs(u) > 1) return Infinity;
    const shape = Math.pow(Math.max(0, 1 - u * u), 0.45 + rng.range(0, 0.001)) * (1 + lean * u) * (0.9 + noise1(x / 4, seed) * 0.2);
    return gy - h * shape;
  };
  // facet cells
  const cells = Array.from({ length: rng.int(6, 10) }, () => ({ x: cx + rng.range(-w / 2, w / 2), y: gy - rng.range(0, h), l: rng.range(-0.3, 0.3) }));
  for (let x = Math.floor(cx - w / 2); x <= Math.ceil(cx + w / 2); x++) {
    const t = topAt(x);
    if (!Number.isFinite(t)) continue;
    for (let y = Math.floor(t); y <= gy; y++) {
      let best = 1e9, second = 1e9, bi = 0;
      for (let i = 0; i < cells.length; i++) {
        const d = Math.hypot(x - cells[i].x, (y - cells[i].y) * 1.3);
        if (d < best) { second = best; best = d; bi = i; } else if (d < second) second = d;
      }
      const u = (x - cx) / (w / 2), v = (y - (gy - h)) / h;
      let l = 0.55 + cells[bi].l - u * 0.25 - (1 - v) * -0.1 - v * 0.25;
      if (y - t < 1.2) l += 0.25; // lit crown
      if (second - best < 1.1) l -= 0.25; // fractures between facets
      let c = tone(ROCK, l, x, y, 0.8);
      if (zone === 'shore') {
        const up = gy - y;
        if (up < h * 0.42 + noise1(x / 3, seed) * 2) c = mix(c, hex('#0e1012'), 0.45);
        if (up < h * 0.3 && up > h * 0.12 && hash2(x, y, seed) < 0.3) c = hex('#cfc8b6');
        if (up < h * 0.14 + noise1(x / 2, seed + 1) * 2) c = noise2(x / 2, y / 2, seed) > 0.5 ? hex('#3e5a2a') : hex('#2a4222');
      } else if (noise2(x / 3, y / 3, seed + 2) > 0.76 && y - t < h * 0.5) c = mix(c, hex('#b8a860'), 0.35); // lichen
      buf.set(x, y, c);
    }
  }
  sandLip(buf, cx - w / 2 - 3, cx + w / 2 + 3, gy + 0.5, zone === 'shore' ? 1.5 : 3, bed, seed + 3);
  void bayer; void bedTone;
  return done(buf, cx, gy, 0.45);
}

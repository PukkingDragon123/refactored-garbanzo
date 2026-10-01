// V9 east-half sprite painters: stones the stream breaks around, raupō reeds and toetoe on the banks,
// barnacled basalt at the seal rocks, the creek's mossy ledge, driftwood, and small forest-floor
// pieces (moss mounds, root knees). All sprites anchor at the bottom centre (ground contact) unless
// noted, are lit from the upper left and use the jungle kit's ramps.

import { PixelBuffer } from '../pixel';
import { C, hex, mix, shade } from '../color';
import { Rng, clamp, fbm2, hash2, noise1, noise2 } from '../../core/math';
import { JP, Ramp, Sprite, rc, blade, frond, mossBlob, outlineSel, arc, tube, P } from '../jungle-core';

const H = (s: string) => hex(s);
const ROCK: Ramp = ['#1e1b22', '#2a262e', '#38323a', '#4a4248', '#5c5358', '#716664', '#877a74', '#9e9086'].map(H);
const BASALT: Ramp = ['#141418', '#1d1d23', '#27272e', '#33333a', '#414048', '#524f56', '#656068', '#7a747a'].map(H);

/**
 * A rounded boulder sitting in water: lit dry cap, dark glossy wet lower half, a bright line where the
 * water laps it; `moss` adds a cushion on top. (w x h, anchor at the waterline, bottom centre)
 */
export function paintStone(seed: number, w: number, h: number, o: { moss?: boolean; ramp?: Ramp; wetLine?: number } = {}): Sprite {
  const rng = new Rng(seed);
  const b = new PixelBuffer(w + 2, h + 2);
  const rp = o.ramp ?? ROCK;
  const cx = (w + 2) / 2, base = h + 1;
  const wl = o.wetLine ?? 0.45;
  // silhouette: a squashed dome with a lumpy outline, flat where it meets the water
  for (let y = 0; y <= base; y++) for (let x = 0; x < w + 2; x++) {
    const nx = (x + 0.5 - cx) / (w / 2), ny = (base - y) / h;
    const lump = (noise1(x * 0.7, seed) - 0.5) * 0.28 + (noise1(x * 1.9, seed + 3) - 0.5) * 0.1;
    const top = Math.sqrt(Math.max(0, 1 - nx * nx)) * (1 + lump) * (0.85 + 0.15 * Math.cos(nx * 2 + seed));
    if (ny > top || Math.abs(nx) > 1) continue;
    const t = top > 0 ? ny / top : 0;
    // normal from the dome, lit from the upper left
    const l = -nx * 0.5 + t * 0.9 - 0.25 + (fbm2(x / 3, y / 2, 2, seed + 5) - 0.5) * 0.5;
    let c = rc(rp, 2.6 + l * 3.2);
    if (t < wl) c = shade(rc(rp, 1.6 + l * 2), -0.1);
    if (t >= wl && t < wl + 0.12 && rng.chance(0.55)) c = H('#9cc4bc');
    if (t > wl + 0.3 && hash2(x, y, seed + 7) < 0.1) c = rc(rp, 6);
    b.data[y * b.w + x] = c;
  }
  if (o.moss) mossBlob(b, rng, cx - w * 0.08, base - h * 0.82, w * 0.3, h * 0.18, JP.moss, 5);
  outlineSel(b, 0.5);
  return { buf: b, ax: Math.round(cx), ay: base };
}

/** raupō (bulrush): a clump of tall strap leaves with velvety brown seed heads. */
export function paintReeds(seed: number, h: number): Sprite {
  const rng = new Rng(seed);
  const w = Math.round(h * 0.7);
  const b = new PixelBuffer(w, h + 2);
  const cx = w / 2, by = h;
  const heads: [number, number, number][] = [];
  const n = Math.round(9 + h / 7);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x0 = cx + (t - 0.5) * w * 0.34 + rng.range(-1.5, 1.5);
    const lean = (t - 0.5) * 0.7 + rng.range(-0.18, 0.18);
    const len = h * rng.range(0.55, 0.98);
    blade(b, { x: x0, y: by, ang: -Math.PI / 2 + lean, len, droop: rng.range(0.02, 0.22) * Math.sign(lean || 1), w0: rng.range(2, 3.4), ramp: JP.flax, base: rng.int(4, 7), fold: true });
    if (rng.chance(0.4)) heads.push([x0 + lean * len * 0.35, by - len * 0.78, rng.range(4, 6.5)]);
  }
  // seed heads on thin stalks
  for (const [x, y, l] of heads) {
    for (let k = 0; k < l + 3; k++) b.set(x, y - l - 2 + k - 3, rc(JP.flax, 3));
    for (let k = 0; k < l; k++) {
      const c = k < 1 ? rc(JP.tan, 4) : k > l - 1.5 ? rc(JP.tan, 1) : rc(JP.tan, 2 + (k < l * 0.4 ? 1 : 0));
      b.set(x, y + k - l, c);
      b.set(x + 1, y + k - l, shade(c, -0.25));
    }
  }
  return { buf: b, ax: Math.round(cx), ay: by + 1 };
}

/** toetoe: arching grass fountain with pale feathery plumes. */
export function paintToetoe(seed: number, h: number): Sprite {
  const rng = new Rng(seed);
  const w = Math.round(h * 1.1);
  const b = new PixelBuffer(w, h + 2);
  const cx = w / 2, by = h;
  for (let i = 0; i < 26; i++) {
    const lean = rng.range(-1.1, 1.1);
    blade(b, { x: cx + rng.range(-3, 3), y: by, ang: -Math.PI / 2 + lean, len: h * rng.range(0.35, 0.7), droop: 0.5 * Math.sign(lean), w0: rng.range(1.4, 2.4), ramp: JP.flax, base: rng.int(3, 6) });
  }
  for (let i = 0; i < 5; i++) {
    const lean = rng.range(-0.35, 0.35);
    const pts = arc(cx + rng.range(-2, 2), by - 2, -Math.PI / 2 + lean, h * rng.range(0.8, 0.98), 0.12 * Math.sign(lean));
    for (let k = 0; k < pts.length; k++) {
      const [x, y] = pts[k];
      const t = k / pts.length;
      if (t < 0.62) { if (k % 2) b.set(x, y, rc(JP.flax, 5)); continue; }
      // the plume: soft cream flecks drooping to one side
      for (let j = 0; j < 3; j++) {
        const px = x + Math.sin(k * 0.7 + i) * 1.4 + (j - 1) * 1.1 + lean * 3 * (t - 0.62), py = y + j * 0.6 + (t - 0.62) * 4;
        if (hash2(Math.round(px), Math.round(py), seed + i) < 0.75) b.set(px, py, rc(JP.cream, 4 + ((k + j) % 3)));
      }
    }
  }
  return { buf: b, ax: Math.round(cx), ay: by + 1 };
}

/** a clump of creek-side ferns (kiokio / hound's tongue) spilling over a bank */
export function paintBankFern(seed: number, size: number): Sprite {
  const rng = new Rng(seed);
  const w = Math.round(size * 2.2), h = Math.round(size * 1.2);
  const b = new PixelBuffer(w, h + 2);
  const cx = w / 2, by = h;
  const n = 7 + Math.round(size / 8);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const ang = -Math.PI / 2 + (t - 0.5) * 2.6 + rng.range(-0.15, 0.15);
    frond(b, { x: cx + rng.range(-2, 2), y: by, ang, len: size * rng.range(0.75, 1.1), droop: 0.5 + Math.abs(t - 0.5) * 0.8, ramp: JP.fern, base: rng.int(4, 6), pinna: size * 0.16, sweep: 0.9, hang: 0.2, rng, ragged: 0.05 });
  }
  outlineSel(b, 0.45);
  return { buf: b, ax: Math.round(cx), ay: by + 1 };
}

/** barnacled basalt: black rock with a pale barnacle crust above a skirt of weed (seal rocks) */
export function paintBarnacleRock(seed: number, w: number, h: number): Sprite {
  const rng = new Rng(seed);
  const b = new PixelBuffer(w + 2, h + 2);
  const cx = (w + 2) / 2, base = h + 1;
  const weedLine = 0.28 + rng.range(-0.05, 0.08);
  for (let y = 0; y <= base; y++) for (let x = 0; x < w + 2; x++) {
    const nx = (x + 0.5 - cx) / (w / 2), ny = (base - y) / h;
    const blk = Math.floor(x / 4 + noise1(y / 5, seed) * 2);
    const crag = (noise1(x * 0.35, seed) - 0.5) * 0.35 + (hash2(blk, 0, seed) - 0.5) * 0.2;
    const top = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(nx), 2.4)), 0.55) * (1 + crag);
    if (ny > top || Math.abs(nx) > 1) continue;
    const t = top > 0 ? ny / top : 0;
    // blocky columnar facets: each block has its own tone, lit side up-left
    const l = -nx * 0.45 + t * 0.7 + (hash2(blk, Math.floor(y / 6), seed + 1) - 0.5) * 0.9;
    let c = rc(BASALT, 2.5 + l * 2.4 + (fbm2(x / 3, y / 3, 2, seed + 2) - 0.5));
    if (t < weedLine) {
      // the tide zone: weed and neptune's necklace, dripping wet
      const g = noise2(x / 1.8, y / 2.6, seed + 3);
      c = g > 0.55 ? rc(JP.moss, 2 + g * 4) : g > 0.4 ? H('#5a4a22') : shade(c, -0.2);
      if (hash2(x, y, seed + 4) < 0.06) c = H('#8a7a2a');
    } else if (t < weedLine + 0.3 && hash2(x, y, seed + 5) < 0.42 - (t - weedLine)) {
      // barnacle crust: pale cones with a dark mouth
      c = hash2(x, y, seed + 6) < 0.25 ? H('#5a5448') : hash2(x, y, seed + 7) < 0.5 ? H('#d8d0bc') : H('#b4ab98');
    } else if (hash2(x, y, seed + 8) < 0.015) c = H('#e8e4d8'); // limpets / gull droppings
    b.data[y * b.w + x] = c;
  }
  outlineSel(b, 0.5);
  return { buf: b, ax: Math.round(cx), ay: base };
}

/** a sea anemone cluster frame (open 0..1) for the tide pools: red or green, tentacles swaying */
export function paintAnemone(seed: number, open: number, green = false): PixelBuffer {
  const b = new PixelBuffer(9, 6);
  const body = green ? ['#1e4a2e', '#2e6a3e', '#4a9a58', '#8ad08a'].map(H) : ['#4a0e18', '#7a1a26', '#b42a36', '#ff6a6a'].map(H);
  for (let x = 2; x < 7; x++) for (let y = 3; y < 6; y++) b.set(x, y, body[y === 3 ? 2 : 1]);
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.42 * (0.5 + open * 0.8);
    const len = 1.5 + open * 2;
    for (let k = 0; k <= len; k++) b.set(4.5 + Math.cos(a) * k + Math.sin(seed + i) * 0.3 * k, 3 + Math.sin(a) * k, body[k >= len - 0.5 ? 3 : 2]);
  }
  return b;
}

/** the creek's ledge: stacked mossy boulders with a notch the water pours through (anchor: notch lip) */
export function paintLedge(seed: number, w: number, h: number, notch: number): Sprite {
  const rng = new Rng(seed);
  const b = new PixelBuffer(w, h + 4);
  const cx = w / 2;
  // boulders either side of the notch, a flat lip stone under the pour
  const stones: [number, number, number, number][] = [];
  for (const side of [-1, 1]) {
    let x = cx + side * (notch + 4);
    for (let i = 0; i < 4; i++) {
      const r = rng.range(7, 13) * (1 - i * 0.12);
      stones.push([x + side * r * 0.4, h - rng.range(0, h * 0.5) - r * 0.4 * (i === 0 ? 1.4 : 1), r, rng.range(0.7, 1)]);
      x += side * r * rng.range(0.9, 1.3);
    }
  }
  stones.push([cx, h - 3, notch + 3, 0.45]);
  stones.sort((a, q) => a[1] - q[1]);
  for (const [sx, sy, r, sq] of stones) {
    b.ellipseFn(sx, sy, r, r * sq, (x, y, nx, ny) => {
      const l = -nx * 0.5 - ny * 0.75 + (fbm2(x / 3, y / 3, 2, seed) - 0.5) * 0.6;
      let c = rc(ROCK, 3 + l * 2.6);
      if (ny < -0.2 && noise2(x / 2.5, y / 2, seed + 1) > 0.42) c = rc(JP.moss, 4 + l * 3);
      if (ny > 0.55) c = shade(c, -0.2);
      return c;
    });
  }
  // ferns and moss tufts spilling from the cracks
  for (let i = 0; i < 5; i++) {
    const x = rng.range(4, w - 4);
    if (Math.abs(x - cx) < notch + 3) continue;
    frond(b, { x, y: rng.range(h * 0.2, h * 0.6), ang: -Math.PI / 2 + rng.range(-1, 1), len: rng.range(7, 13), droop: 0.9, ramp: JP.fern, base: 5, pinna: 2.4, sweep: 0.9, rng });
  }
  outlineSel(b, 0.5);
  return { buf: b, ax: Math.round(cx), ay: h };
}

/** a bleached driftwood log with a root plate (anchor bottom centre) */
export function paintDriftwood(seed: number, len: number): Sprite {
  const rng = new Rng(seed);
  const w = len + 20, h = Math.round(len * 0.3) + 12;
  const b = new PixelBuffer(w, h);
  const r0 = Math.max(3, len * 0.07);
  const pts: P[] = [];
  for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push([6 + t * len, h - r0 - 1 - Math.sin(t * 2.8 + seed) * 1.5 - t * 2]); }
  tube(b, pts, t => r0 * (1 - t * 0.55), JP.bone, 4, { texture: (x, y) => (Math.sin(x * 0.9 + noise1(y, seed) * 2) > 0.7 ? -1 : 0), rim: true });
  // root plate at the thick end, a snapped branch or two
  for (let i = 0; i < 6; i++) {
    const a = Math.PI + rng.range(-1.2, 1.2);
    const rp = arc(pts[0][0] + 2, pts[0][1], a, rng.range(5, 10), rng.range(-0.3, 0.4));
    tube(b, rp, t => 1.6 * (1 - t) + 0.5, JP.bone, 3);
  }
  for (let i = 0; i < 2; i++) {
    const at = pts[rng.int(6, 16)];
    tube(b, arc(at[0], at[1] - r0 * 0.5, -Math.PI / 2 + rng.range(-0.8, 0.8), rng.range(6, 11), 0.2), t => 1.3 * (1 - t) + 0.4, JP.bone, 4);
  }
  outlineSel(b, 0.5);
  return { buf: b, ax: Math.round(w / 2), ay: h - 1 };
}

/** a low moss mound with a few fern crosiers (forest floor, in front of the walk line) */
export function paintMossMound(seed: number, w: number): Sprite {
  const rng = new Rng(seed);
  const h = Math.round(w * 0.45) + 6;
  const b = new PixelBuffer(w + 4, h);
  for (let i = 0; i < 3; i++) mossBlob(b, rng, (w + 4) / 2 + rng.range(-w * 0.2, w * 0.2), h - w * 0.12 - 2, w * rng.range(0.2, 0.38), w * 0.12, JP.moss, 4 + i, true);
  for (let i = 0; i < 3; i++) {
    const x = rng.range(w * 0.3, w * 0.8);
    frond(b, { x, y: h - w * 0.2, ang: -Math.PI / 2 + rng.range(-0.7, 0.7), len: rng.range(6, 10), droop: 0.6, ramp: JP.fern, base: 6, pinna: 2, rng });
  }
  outlineSel(b, 0.45);
  return { buf: b, ax: Math.round((w + 4) / 2), ay: h - 1 };
}

export { mix, clamp };
export type { C };

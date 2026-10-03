// V11 Rocky Hills, the rock: granite tors (stacks of rounded blocks split along their joints, weathered
// into pillows and lit from the upper left, with feldspar speckle, sheeting joints, black water
// streaks, crusts of orange and pale lichen and moss in the shaded seams), single boulders, and the
// greywacke bluff with an overhang at its foot (the hunters' shelter).

import { PixelBuffer } from '../../pixel';
import type { C } from '../../color';
import { hex, mix, shade } from '../../color';
import { Rng, bayer, clamp, fbm2, noise2, smoothstep } from '../../../core/math';
import type { Sprite } from '../../jungle-core';
import { HP, pick, hp } from './kit';

/** a tor: the sprite (anchor bottom centre) and the top surface per column (buffer y, -1 = none) */
export interface TorArt extends Sprite { crest: Int16Array }

interface Block { cx: number; cy: number; rx: number; ry: number; n: number; rot: number; seed: number }

const L = (() => { const v = [-0.55, -0.7, 0.45]; const m = Math.hypot(v[0], v[1], v[2]); return v.map(c => c / m); })();

/** paint rounded granite blocks (in order, later in front) into a buffer */
function paintBlocks(b: PixelBuffer, blocks: Block[], ramp: C[], o: { lichen: number; moss: number; streaks: number; seed: number }) {
  const W = b.w, H = b.h;
  const owner = new Int16Array(W * H).fill(-1);
  const sh = new Float32Array(W * H);
  blocks.forEach((k, bi) => {
    const x0 = Math.max(0, Math.floor(k.cx - k.rx - 2)), x1 = Math.min(W - 1, Math.ceil(k.cx + k.rx + 2));
    const y0 = Math.max(0, Math.floor(k.cy - k.ry - 2)), y1 = Math.min(H - 1, Math.ceil(k.cy + k.ry + 2));
    const cs = Math.cos(k.rot), sn = Math.sin(k.rot);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx0 = x - k.cx, dy0 = y - k.cy;
      const dx = (dx0 * cs + dy0 * sn) / k.rx, dy = (-dx0 * sn + dy0 * cs) / k.ry;
      // lumpy superellipse (weathered pillow)
      const wob = (fbm2(x * 0.06, y * 0.06, 2, k.seed) - 0.5) * 0.18;
      const f = Math.pow(Math.abs(dx), k.n) + Math.pow(Math.abs(dy), k.n) + wob;
      if (f >= 1) continue;
      const z = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, f), 2 / k.n)));
      let nx = Math.sign(dx) * Math.pow(Math.abs(dx), k.n - 1) / k.rx, ny = Math.sign(dy) * Math.pow(Math.abs(dy), k.n - 1) / k.ry;
      const nm = Math.hypot(nx, ny) || 1;
      const s = (1 - z) * 1.1;
      nx = (nx / nm) * s; ny = (ny / nm) * s;
      const nz = Math.max(0.15, z);
      const len = Math.hypot(nx, ny, nz);
      // the light, a little cool sky light from above, and a bounce from the warm ground below
      let l = (nx * L[0] + ny * L[1] + nz * L[2]) / len;
      l += -ny / len * 0.12;
      const i = y * W + x;
      owner[i] = bi;
      sh[i] = l;
    }
  });
  // ambient occlusion where a block sits on (or in front of) another: the seams go dark
  const seam = (x: number, y: number) => {
    const i = y * W + x, me = owner[i];
    let d = 0;
    for (const [ox, oy] of [[0, -2], [0, 2], [-2, 0], [2, 0], [0, -4], [0, 4]]) {
      const xx = x + ox, yy = y + oy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const o2 = owner[yy * W + xx];
      if (o2 >= 0 && o2 !== me) d += Math.abs(oy) === 4 ? 0.5 : 1;
    }
    return d;
  };
  const N = ramp.length - 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, bi = owner[i];
    if (bi < 0) continue;
    const k = blocks[bi];
    let l = sh[i];
    // granular texture and big weathering mottles
    l += (fbm2(x * 0.09, y * 0.09, 3, k.seed + 5) - 0.5) * 0.5 + (noise2(x * 0.5, y * 0.5, k.seed) - 0.5) * 0.16;
    // sheeting joints: thin dark lines curving with the block's top
    const sj = Math.sin(((y - k.cy) / k.ry + Math.pow((x - k.cx) / k.rx, 2) * 0.35) * 9 + k.seed) ;
    const joint = Math.abs(sj) < 0.07 && fbm2(x * 0.05, y * 0.05, 2, k.seed + 9) > 0.45;
    const crack = Math.abs(fbm2(x * 0.03, y * 0.012, 3, k.seed + 21) - 0.5) < 0.012;
    const sd = seam(x, y);
    l -= sd * 0.22;
    let v = 3 + l * 6.4 + (bayer(x, y) - 0.5) * 0.9;
    if (joint || crack) v -= 2.6;
    let c = pick(ramp, clamp(v, 0, N));
    // feldspar and mica speckle
    const h = hp(x, y, k.seed + 3);
    if (h < 0.035 && v > 3) c = mix(c, hex('#e8c8b0'), 0.55);
    else if (h > 0.975) c = shade(c, -0.25);
    // black streaks where water runs down off the tops
    const streak = o.streaks * smoothstep(0.62, 0.78, fbm2(x * 0.14, y * 0.008, 2, k.seed + 31)) * smoothstep(k.cy - k.ry, k.cy, y);
    if (streak > 0.1) c = mix(c, hex('#141416'), streak * 0.55);
    // lichen crusts on the lit, upward faces: orange spots and pale rosettes
    const up = sh[i] > 0.25 && (y - k.cy) / k.ry < 0.3;
    const lo = fbm2(x * 0.11, y * 0.11, 3, k.seed + 41), lp = fbm2(x * 0.08, y * 0.08, 3, k.seed + 51);
    if (up && lo > 1 - o.lichen * 0.28) c = pick(HP.lichenOrange, 1 + (lo - 0.7) * 10 + l * 2 + (bayer(x, y) - 0.5));
    else if (lp > 1 - o.lichen * 0.34) c = mix(c, pick(HP.lichenPale, 2 + l * 3 + (bayer(x + 1, y) - 0.5) * 1.5), 0.75);
    // moss in the seams and on the shaded lower faces
    if (o.moss > 0 && (sd > 1 || (y - k.cy) / k.ry > 0.55) && fbm2(x * 0.1, y * 0.1, 2, k.seed + 61) > 1 - o.moss * 0.5) c = pick(HP.beech, 3 + l * 3 + (bayer(x, y) - 0.5));
    b.data[i] = c;
  }
}

/** A granite tor: stacked, rounded, jointed blocks. h: total height, w: base width. */
export function paintTor(seed: number, w: number, h: number, o: { ramp?: C[]; lichen?: number; moss?: number; rows?: number } = {}): TorArt {
  const rng = new Rng(seed * 977 + 13);
  const pad = 4;
  const W = Math.round(w + pad * 2), H = Math.round(h + pad * 2);
  const b = new PixelBuffer(W, H);
  const blocks: Block[] = [];
  const rows = o.rows ?? Math.max(1, Math.round(h / Math.max(26, w * 0.28)));
  let y = H - pad, rowW = w, cx = W / 2;
  for (let r = 0; r < rows; r++) {
    const rh = (h / rows) * rng.range(0.85, 1.15) * (r === rows - 1 ? 1.1 : 1);
    const n = r === 0 && rowW > 90 ? rng.int(2, 3) : rowW > 60 && rng.chance(0.4) ? 2 : 1;
    const bw = rowW / n;
    for (let i = 0; i < n; i++) {
      const bx = cx - rowW / 2 + bw * (i + 0.5) + rng.range(-bw * 0.08, bw * 0.08);
      blocks.push({ cx: bx, cy: y - rh * 0.5, rx: bw * rng.range(0.52, 0.6), ry: rh * rng.range(0.56, 0.64), n: rng.range(2.4, 3.6), rot: rng.range(-0.08, 0.08), seed: seed * 31 + r * 7 + i });
    }
    y -= rh * 0.92;
    cx += rng.range(-rowW * 0.12, rowW * 0.12);
    rowW *= rng.range(0.62, 0.86);
  }
  paintBlocks(b, blocks, o.ramp ?? HP.granite, { lichen: o.lichen ?? 1, moss: o.moss ?? 0.4, streaks: 1, seed });
  b.outline(hex('#121014'));
  const crest = new Int16Array(W).fill(-1);
  for (let x = 0; x < W; x++) for (let yy = 0; yy < H; yy++) if (b.data[yy * W + x] >>> 24) { crest[x] = yy; break; }
  return { buf: b, ax: Math.round(W / 2), ay: H - pad + 2, crest };
}

/** one weathered boulder (anchor bottom centre) */
export function paintBoulder(seed: number, w: number, h: number, o: { ramp?: C[]; lichen?: number; moss?: number } = {}): TorArt {
  const pad = 3;
  const W = Math.round(w + pad * 2), H = Math.round(h + pad * 2);
  const b = new PixelBuffer(W, H);
  const rng = new Rng(seed * 61 + 5);
  paintBlocks(b, [{ cx: W / 2, cy: H - pad - h / 2, rx: w / 2, ry: h / 2, n: rng.range(2.2, 3.2), rot: rng.range(-0.15, 0.15), seed }], o.ramp ?? HP.granite, { lichen: o.lichen ?? 0.8, moss: o.moss ?? 0.3, streaks: 0.5, seed });
  b.outline(hex('#121014'));
  const crest = new Int16Array(W).fill(-1);
  for (let x = 0; x < W; x++) for (let yy = 0; yy < H; yy++) if (b.data[yy * W + x] >>> 24) { crest[x] = yy; break; }
  return { buf: b, ax: Math.round(W / 2), ay: H - pad + 1, crest };
}

/** small angular scree stones (anchor bottom centre) */
export function paintScreeStone(seed: number, w: number, h: number): Sprite {
  const b = new PixelBuffer(w + 2, h + 2);
  const rng = new Rng(seed * 13 + 1);
  const pts: number[] = [];
  const n = rng.int(5, 7);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.3, 0.3);
    pts.push(1 + w / 2 + Math.cos(a) * (w / 2) * rng.range(0.75, 1), 1 + h / 2 + Math.sin(a) * (h / 2) * rng.range(0.7, 1));
  }
  b.polyFn(pts, (x, y) => pick(HP.scree, 4 + (1 - y / h) * 3 - (x / w) * 1.5 + (bayer(x, y) - 0.5)));
  b.outline(hex('#121417'));
  return { buf: b, ax: Math.round(w / 2) + 1, ay: h + 1 };
}

/**
 * The greywacke bluff: a crag of shattered, blocky rock (steep jointed faces, slanting bedding, ledges
 * with tussock and lichen, black seepage streaks), talus flanks running down to the ground either
 * side, and an overhang at its foot deep enough to shelter in (the cave's dark mouth). Returns the
 * sprite (anchor bottom left) and the mouth (buffer coords).
 */
export function paintBluff(w: number, h: number, seed: number, mouth: { x: number; w: number; h: number }): Sprite & { mouth: typeof mouth } {
  const b = new PixelBuffer(w, h);
  const R = HP.greywacke;
  // the crag's skyline: talus flanks, a broken crest with knobs and a notch
  const top = (x: number) => {
    const u = x / w;
    const body = smoothstep(0.02, 0.3, u) * (1 - smoothstep(0.78, 1, u));
    const knobs = (fbm2(x * 0.018, 0.5, 3, seed) - 0.5) * 70 + (fbm2(x * 0.06, 1.5, 2, seed + 1) - 0.5) * 16;
    return h - 10 - body * (h * 0.86 + knobs) - (1 - body) * 18 * fbm2(x * 0.05, 3, 2, seed + 2);
  };
  const tops = new Float32Array(w);
  for (let x = 0; x < w; x++) tops[x] = top(x);
  const mx0 = mouth.x, mx1 = mouth.x + mouth.w;
  for (let x = 0; x < w; x++) {
    const t = tops[x];
    const slope = (tops[Math.min(w - 1, x + 3)] - tops[Math.max(0, x - 3)]) / 6;
    for (let y = Math.max(0, Math.floor(t)); y < h; y++) {
      const d = y - t;
      // big facets: jointed blocks whose faces catch the light differently, cut by slanting bedding
      const jx = x + fbm2(x * 0.015, y * 0.01, 2, seed) * 40, jy = y + x * 0.3 + fbm2(x * 0.01, y * 0.015, 2, seed + 3) * 24;
      const col = Math.floor(jx / 34), bed = Math.floor(jy / 30);
      const u = (jx / 34) % 1, v = (jy / 30) % 1;
      const facet = hp(col, bed, seed);
      let l = 4.2 + (facet - 0.5) * 3 + (0.5 - u) * 1.6 + (0.5 - v) * 0.8 + (fbm2(x * 0.07, y * 0.07, 3, seed + 7) - 0.5) * 1.8;
      // the skyline catches the light; the talus flanks are rubble
      l += Math.max(0, 1 - d / 10) * 1.5 - slope * 0.8;
      if ((u < 0.05 && facet > 0.3) || (v < 0.05 && hp(col, bed, seed + 9) > 0.45)) l -= 2.4;
      l -= smoothstep(h * 0.6, h, y) * 1.4;
      let c = pick(R, l + (bayer(x, y) - 0.5) * 0.9);
      const flank = x < w * 0.16 || x > w * 0.82;
      if (flank && d > 6) {
        const id = hp(Math.floor(x / 6), Math.floor((y + x * 0.2) / 4), seed + 21);
        c = pick(HP.scree, 3.4 + id * 3 + (bayer(x, y) - 0.5) - smoothstep(h * 0.7, h, y));
      }
      // tussock and moss on some ledges, lichen rosettes, black seepage streaks down the faces
      if (v > 0.06 && v < 0.14 && hp(col, bed, seed + 11) > 0.62 && !flank) c = pick(HP.tussock, 3 + (bayer(x, y) - 0.5) * 2 + (u < 0.5 ? 1 : 0));
      else if (fbm2(x * 0.09, y * 0.09, 3, seed + 13) > 0.72) c = mix(c, pick(HP.lichenPale, 2 + (bayer(x, y) - 0.5) * 2), 0.55);
      else if (fbm2(x * 0.12, y * 0.12, 2, seed + 15) > 0.78 && l > 4) c = pick(HP.lichenOrange, 1 + (bayer(x, y) - 0.5) * 2);
      const seep = fbm2(x * 0.16, y * 0.008, 2, seed + 17);
      if (seep > 0.68 && !flank) c = mix(c, hex('#0c0e10'), (seep - 0.68) * 3);
      // the tussock fringe along the crest
      if (d < 4 + hp(x, 0, seed) * 5) c = pick(HP.tussock, 4 + d * 0.4 + (bayer(x, y) - 0.5) * 2);
      b.data[y * w + x] = c;
    }
    // tussock blades standing up off the skyline
    if (hp(x, 1, seed) < 0.5) {
      const hh = 2 + hp(x, 2, seed) * 6;
      for (let k = 0; k < hh; k++) b.set(x + (k > hh * 0.6 ? 1 : 0), Math.floor(t) - k, pick(HP.tussock, 6 - k * 0.3));
    }
  }
  // the overhang: a dark hollow under a roof that juts out over it
  const my1 = h;
  for (let x = Math.max(0, mx0 - 12); x < Math.min(w, mx1 + 12); x++) {
    const e = Math.min(x - mx0, mx1 - x);
    if (e < 0) continue;
    const arch = Math.sqrt(Math.max(0, 1 - ((x - (mx0 + mx1) / 2) / (mouth.w / 2)) ** 2));
    const roof = my1 - mouth.h * (0.35 + 0.65 * arch) + Math.sin(x * 0.2) * 1.5 + hp(x, 3, seed) * 2;
    for (let y = Math.floor(roof); y < my1; y++) {
      if (y < 0 || y >= h) continue;
      const depth = clamp((y - roof) / Math.max(1, my1 - roof));
      const k = 0.08 + depth * 0.3 + (1 - Math.min(1, e / 30)) * 0.12;
      b.data[y * w + x] = mix(hex('#060708'), hex('#2e2c2a'), clamp(k + (bayer(x, y) - 0.5) * 0.08));
    }
    // soot on the roof over where the fires have been
    for (let k = 0; k < 10; k++) { const y = Math.floor(roof) - 4 - k; if (y >= 0 && y < h && hp(x, k, seed + 5) < 0.7 - k * 0.06) b.data[y * w + x] = mix(b.data[y * w + x], hex('#0a0a0a'), 0.5); }
    // the roof's lip
    for (let k = 0; k < 4; k++) { const y = Math.floor(roof) - k; if (y >= 0 && y < h) b.data[y * w + x] = pick(R, 1 + k * 0.7); }
    // drips and roots hanging from the lip
    if (e > 4 && hp(x, 4, seed) < 0.16) { const len = 2 + hp(x, 5, seed) * 7; for (let k = 0; k < len; k++) b.set(x, Math.floor(roof) + k, pick(HP.beech, 2 + (k % 2))); }
  }
  b.outline(hex('#0c0e10'));
  return { buf: b, ax: 0, ay: h - 1, mouth };
}

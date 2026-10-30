// V11 Rocky Hills, the rock: granite tors (stacks of jointed blocks cut into flat-lit planes, chipped at
// the corners and lit from the upper left, with feldspar speckle, sheeting joints, black water
// streaks, crusts of orange and pale lichen and moss in the shaded seams), single boulders, and the
// greywacke bluff with an overhang at its foot (the hunters' shelter).

import { PixelBuffer } from '../../pixel';
import type { C } from '../../color';
import { hex, mix, shade } from '../../color';
import { Rng, bayer, clamp, fbm2, noise2, smoothstep } from '../../../core/math';
import type { Sprite } from '../../jungle-core';
import { HP, pick, hp } from './kit';
import { paintRock } from '../../flora';

/** a tor: the sprite (anchor bottom centre) and the top surface per column (buffer y, -1 = none) */
export interface TorArt extends Sprite { crest: Int16Array }

interface Block { cx: number; cy: number; rx: number; ry: number; n: number; rot: number; seed: number }

const L = (() => { const v = [-0.55, -0.7, 0.45]; const m = Math.hypot(v[0], v[1], v[2]); return v.map(c => c / m); })();

/**
 * Paint jointed granite blocks (in order, later in front) into a buffer. Each block is cut, not
 * blown up: its outline is a ring of vertices set on (or just inside) a squarish superellipse with
 * chips knocked out between them, and its face is split into a few flat planes that each take the
 * light from the upper left, with a bright lip where a plane turns to the sun and a dark crease
 * where it turns away. The topmost vertex stays on the curve, so a tor keeps its summit height.
 */
function paintBlocks(b: PixelBuffer, blocks: Block[], ramp: C[], o: { lichen: number; moss: number; streaks: number; seed: number }) {
  const W = b.w, H = b.h;
  const owner = new Int16Array(W * H).fill(-1);
  const fid = new Int16Array(W * H).fill(-1);
  const sh = new Float32Array(W * H);
  const facetL: number[] = [], facetUp: boolean[] = [];
  blocks.forEach((k, bi) => {
    const rng = new Rng(k.seed * 131 + 7);
    const cs = Math.cos(k.rot), sn = Math.sin(k.rot);
    // the outline
    const N = clamp(Math.round((k.rx + k.ry) / 7), 8, 18);
    const poly: number[] = [];
    let px = 0, py = 0;
    for (let i = 0; i <= N; i++) {
      const j = i % N;
      const a = -Math.PI / 2 + (j / N) * Math.PI * 2 + (j ? rng.range(-0.35, 0.35) * Math.PI / N : 0);
      const ca = Math.cos(a), sa = Math.sin(a);
      const r = 1 / Math.pow(Math.pow(Math.abs(ca), k.n) + Math.pow(Math.abs(sa), k.n), 1 / k.n);
      const f = j === 0 ? 1 : rng.range(0.88, 1);
      const lx = ca * r * k.rx * f, ly = sa * r * k.ry * f;
      const x = k.cx + lx * cs - ly * sn, y = k.cy + lx * sn + ly * cs;
      if (i > 0 && rng.chance(0.4)) {
        // a chip knocked out between two corners
        const mx = (px + x) / 2, my = (py + y) / 2, dx = k.cx - mx, dy = k.cy - my, dl = Math.hypot(dx, dy) || 1;
        const d = rng.range(1.2, Math.max(1.5, Math.min(5, Math.min(k.rx, k.ry) * 0.12)));
        poly.push(mx + (dx / dl) * d, my + (dy / dl) * d);
      }
      if (i < N) poly.push(x, y);
      px = x; py = y;
    }
    // the planes: seeds in the block's own frame, each with a facing
    const nf = clamp(Math.round((k.rx * k.ry) / 70), 3, 10);
    const fx: number[] = [], fy: number[] = [], f0 = facetL.length;
    for (let i = 0; i < nf; i++) {
      const sx = rng.range(-0.85, 0.85), sy = i === 0 ? -0.8 : rng.range(-0.85, 0.9);
      fx.push(sx); fy.push(sy);
      let nx = sx * 0.9 + rng.range(-0.3, 0.3), ny = (i === 0 ? -1.1 : sy - 0.25) + rng.range(-0.3, 0.3), nz = 0.8;
      const nl = Math.hypot(nx, ny, nz);
      nx /= nl; ny /= nl; nz /= nl;
      facetL.push(nx * L[0] + ny * L[1] + nz * L[2] - ny * 0.1);
      facetUp.push(ny < -0.45);
    }
    b.polyFn(poly, (x, y) => {
      const dx0 = x - k.cx, dy0 = y - k.cy;
      const u = (dx0 * cs + dy0 * sn) / k.rx, v = (-dx0 * sn + dy0 * cs) / k.ry;
      let best = 0, bd = Infinity;
      for (let i = 0; i < nf; i++) { const d = (u - fx[i]) ** 2 + ((v - fy[i]) * 1.3) ** 2; if (d < bd) { bd = d; best = i; } }
      const i = y * W + x;
      owner[i] = bi;
      fid[i] = f0 + best;
      // a little roundness left in the planes: the edges on the shadow side fall away
      sh[i] = facetL[f0 + best] - Math.max(0, u) * 0.12 - Math.max(0, v) * 0.1;
      return -1;
    });
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
  const jointAt = (x: number, y: number, k: Block) => Math.abs(Math.sin(((y - k.cy) / k.ry + Math.pow((x - k.cx) / k.rx, 2) * 0.08) * 8 + k.seed)) < 0.06;
  const N = ramp.length - 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, bi = owner[i];
    if (bi < 0) continue;
    const k = blocks[bi];
    let l = sh[i];
    // the planes' edges: a lip where a plane turns to the light, a crease where it turns away
    const me = fid[i];
    const up = y > 0 ? fid[i - W] : -1, lf = x > 0 ? fid[i - 1] : -1;
    let edge = 0;
    if (up >= 0 && owner[i - W] === bi && up !== me) edge = facetL[me] - facetL[up];
    else if (lf >= 0 && owner[i - 1] === bi && lf !== me) edge = facetL[me] - facetL[lf];
    // the sunlit rim along the block's top edge
    const rim = (y === 0 || owner[i - W] !== bi) && sh[i] > -0.1 ? 1 : 0;
    // granular texture, a little weathering mottle (kept low, so the planes read)
    l += (fbm2(x * 0.09, y * 0.09, 3, k.seed + 5) - 0.5) * 0.22 + (noise2(x * 0.5, y * 0.5, k.seed) - 0.5) * 0.12;
    // sheeting joints: thin dark lines running nearly level across the block
    const joint = jointAt(x, y, k) && fbm2(x * 0.05, y * 0.05, 2, k.seed + 9) > 0.42;
    const crack = Math.abs(fbm2(x * 0.03, y * 0.012, 3, k.seed + 21) - 0.5) < 0.012;
    const sd = seam(x, y);
    l -= sd * 0.22;
    let v = 3.3 + l * 5.2 + (bayer(x, y) - 0.5) * 0.7;
    if (edge > 0.14) v += 1.2; else if (edge < -0.14) v -= 1.4;
    if (rim) v += 1.3;
    if (joint || crack) v -= 2.6;
    // a joint's lower lip catches the light
    else if (y > 0 && fid[i - W] === me && jointAt(x, y - 1, k) && fbm2(x * 0.05, (y - 1) * 0.05, 2, k.seed + 9) > 0.42) v += 1;
    let c = pick(ramp, clamp(v, 0, N));
    // feldspar and mica speckle
    const h = hp(x, y, k.seed + 3);
    if (h < 0.035 && v > 3) c = mix(c, hex('#e8c8b0'), 0.55);
    else if (h > 0.975) c = shade(c, -0.25);
    // black streaks where water runs down off the tops (on the steep planes only)
    const streak = o.streaks * smoothstep(0.62, 0.78, fbm2(x * 0.14, y * 0.008, 2, k.seed + 31)) * smoothstep(k.cy - k.ry, k.cy, y) * (facetUp[me] ? 0.3 : 1);
    if (streak > 0.1) c = mix(c, hex('#141416'), Math.round(streak * 4) / 4 * 0.55);
    // lichen crusts on the lit, upward planes: orange spots and pale rosettes
    const upF = (facetUp[me] || sh[i] > 0.3) && (y - k.cy) / k.ry < 0.3;
    const lo = fbm2(x * 0.11, y * 0.11, 3, k.seed + 41), lp = fbm2(x * 0.08, y * 0.08, 3, k.seed + 51);
    if (upF && lo > 1 - o.lichen * 0.28 && hp(x >> 1, y >> 1, k.seed + 43) < 0.75) c = pick(HP.lichenOrange, 1 + (lo - 0.7) * 10 + l * 2 + (bayer(x, y) - 0.5));
    else if (lp > 1 - o.lichen * 0.24 && hp(x, y, k.seed + 53) < 0.6) c = mix(c, pick(HP.lichenPale, 1.5 + l * 3 + (bayer(x + 1, y) - 0.5) * 1.5), 0.55);
    // moss in the seams and on the shaded lower planes
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

/**
 * One boulder, chiselled (anchor bottom centre): the shared cut-rock painter (an angular silhouette
 * on a flat footing, flat-lit planes with lips and creases, chips, cracks) in hills granite, then
 * weathered: feldspar speckle, orange and pale lichen on the planes that look up, black streaks
 * where rain runs off the top, moss low in the creases, and tussock blades and grit round its foot
 * so it sits in the ground rather than on it.
 */
export function paintBoulder(seed: number, w: number, h: number, o: { ramp?: C[]; lichen?: number; moss?: number; foot?: boolean } = {}): TorArt {
  const W = Math.max(6, Math.round(w)), H = Math.max(5, Math.round(h));
  // the top of the ramp is kept for the lichen and the rim, so the planes sit in the mid-tones
  const ramp = (o.ramp ?? HP.granite).slice(0, 10);
  const rk = paintRock(seed, W, H, ramp, 0, { verts: clamp(Math.round(W / 8), 6, 16), facets: clamp(Math.round((W * H) / 200), 3, 18) });
  const b = rk.buf;
  const idx = new Map<C, number>();
  ramp.forEach((c, i) => idx.set(c, i));
  const top = new Int16Array(W).fill(-1);
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (rk.cell[y * W + x] >= 0) { top[x] = y; break; }
  const lichen = o.lichen ?? 0.8, moss = o.moss ?? 0.3;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, f = rk.cell[i];
    if (f < 0) continue;
    const lv = idx.get(b.data[i]);
    if (lv === undefined) continue;
    let c = b.data[i];
    if (hp(x, y, seed + 3) < 0.04 && lv > 4) c = mix(c, hex('#e8c8b0'), 0.5);
    // rain streaks down the steep planes, from the top edge
    const sk = fbm2(x * 0.3, 0.5, 2, seed + 31);
    if (!rk.fup[f] && sk > 0.68 && top[x] >= 0 && y - top[x] < H * 0.7 * (sk - 0.5) * 3) c = mix(c, hex('#141416'), sk > 0.76 ? 0.5 : 0.3);
    // lichen
    const lo = fbm2(x * 0.16, y * 0.16, 2, seed + 41);
    if ((rk.fup[f] || rk.fl[f] > 0.3) && lo > 1 - lichen * 0.24 && hp(x >> 1, y >> 1, seed + 43) < 0.7) c = pick(HP.lichenOrange, 1 + (lo - 0.7) * 9 + (lv - 5) * 0.3 + (bayer(x, y) - 0.5));
    else if (fbm2(x * 0.12, y * 0.12, 2, seed + 51) > 1 - lichen * 0.22 && hp(x, y, seed + 53) < 0.55) c = mix(c, pick(HP.lichenPale, 1 + lv * 0.3), 0.5);
    // moss low in the creases, on the shaded side
    if (moss > 0 && y > H * 0.55 && x > rk.cx - W * 0.1 && fbm2(x * 0.14, y * 0.14, 2, seed + 61) > 1 - moss * 0.55) c = pick(HP.beech, 3 + (lv - 4) * 0.4 + (bayer(x, y) - 0.5));
    b.data[i] = c;
  }
  // the foot: grit and tussock blades over the bottom edge
  if (o.foot !== false && H > 8) {
    for (let x = 1; x < W - 1; x++) {
      if (rk.cell[(H - 1) * W + x] < 0) continue;
      const r = hp(x, 7, seed);
      if (r < 0.3) {
        const bh = 2 + Math.floor(hp(x, 8, seed) * Math.min(7, H * 0.3));
        const lean = hp(x, 9, seed) < 0.6 ? 1 : -1;
        for (let k = 0; k < bh; k++) b.set(x + (k > bh * 0.55 ? lean : 0), H - 1 - k, pick(HP.tussock, 3 + k * 0.7 + (hp(x, k, seed) < 0.3 ? 1 : 0)));
      } else if (r < 0.42) b.set(x, H - 1, pick(HP.scree, 3 + hp(x, 10, seed) * 4));
    }
  }
  const crest = new Int16Array(W).fill(-1);
  for (let x = 0; x < W; x++) for (let yy = 0; yy < H; yy++) if (b.data[yy * W + x] >>> 24) { crest[x] = yy; break; }
  return { buf: b, ax: Math.round(W / 2), ay: H - 1, crest };
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
    // the talus flanks are heaps of fallen blocks, not a ramp: each block a flat top and a step
    const bw = 9 + Math.floor(hp(Math.floor(x / 13), 7, seed) * 9);
    const blk = Math.floor(x / bw);
    const steps = (hp(blk, 8, seed) - 0.35) * 16 * (1 - body) * smoothstep(0, 0.05, u) * (1 - smoothstep(0.95, 1, u));
    // the crest broken into jointed teeth along the bedding
    const teeth = (hp(Math.floor(x / 7), 9, seed) - 0.5) * 6 * body;
    return h - 10 - body * (h * 0.86 + knobs) - (1 - body) * 18 * fbm2(x * 0.05, 3, 2, seed + 2) - steps - teeth;
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
      // alternate beds of sandstone and darker mudstone (argillite), with a lit upper lip on each bed
      const mud = hp(0, bed, seed + 33) > 0.55;
      if (mud) l -= 0.9;
      if (v > 0.06 && v < 0.11 && !mud) l += 0.7;
      let c = pick(R, l + (bayer(x, y) - 0.5) * 0.9);
      if (mud && hp(x >> 1, y, seed + 34) < 0.08) c = mix(c, hex('#2a2430'), 0.5);
      // the talus heaps against the crag's foot: the line between them wanders and rises toward the ground
      const fj = (fbm2(y * 0.04, 1.5, 2, seed + 43) - 0.5) * w * 0.08 + smoothstep(h * 0.4, h, y) * w * 0.05;
      const flank = x < w * 0.16 + fj || x > w * 0.82 - fj;
      if (flank && d > 6) {
        const id = hp(Math.floor(x / 6), Math.floor((y + x * 0.2) / 4), seed + 21);
        c = pick(HP.scree, 3.4 + id * 3 + (bayer(x, y) - 0.5) - smoothstep(h * 0.7, h, y));
      }
      // tussock and moss on some ledges, lichen rosettes, black seepage streaks down the faces
      if (v > 0.06 && v < 0.13 && hp(col, bed, seed + 11) > 0.82 && fbm2(x * 0.04, y * 0.1, 2, seed + 12) > 0.5 && !flank) c = pick(HP.tussock, 3 + (bayer(x, y) - 0.5) * 2 + (u < 0.5 ? 1 : 0));
      else if (fbm2(x * 0.09, y * 0.09, 3, seed + 13) > 0.8 && hp(x, y, seed + 14) < 0.6) c = mix(c, pick(HP.lichenPale, 2 + (bayer(x, y) - 0.5) * 2), 0.4);
      else if (fbm2(x * 0.12, y * 0.12, 2, seed + 15) > 0.84 && l > 4.5) c = pick(HP.lichenOrange, 1 + (bayer(x, y) - 0.5) * 2);
      const seep = fbm2(x * 0.16, y * 0.008, 2, seed + 17);
      if (seep > 0.68 && !flank) c = mix(c, hex('#0c0e10'), (seep - 0.68) * 3);
      // the tussock fringe along the crest
      if (d < 2 + hp(x, 0, seed) * 4 && fbm2(x * 0.04, 0.5, 2, seed + 19) > 0.42) c = pick(HP.tussock, 4 + d * 0.4 + (bayer(x, y) - 0.5) * 2);
      // fallen blocks on the talus: a lit top edge and a shadowed foot per block
      else if (flank && d > 1) {
        const by = Math.floor((y - t) / 7), bx = Math.floor((x + by * 5) / 11);
        const u2 = ((x + by * 5) % 11) / 11, v2 = ((y - t) % 7) / 7;
        const id = hp(bx, by, seed + 41);
        c = pick(HP.scree, 3 + id * 4 + (v2 < 0.2 ? 1.5 : 0) - (v2 > 0.8 || u2 > 0.88 ? 1.6 : 0) - smoothstep(h * 0.7, h, y) + (bayer(x, y) - 0.5));
        if (id > 0.82 && v2 < 0.5) c = pick(HP.tussock, 3 + v2 * 2 + (bayer(x, y) - 0.5) * 2);
      }
      b.data[y * w + x] = c;
    }
    // tussock blades standing up off the skyline (in clumps)
    if (hp(x, 1, seed) < 0.5 && fbm2(x * 0.04, 0.5, 2, seed + 19) > 0.38) {
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

/**
 * The summit cairn on Te Tihi: flat, hand-stacked slabs of greywacke and granite, each one a cut
 * stone of its own, narrowing up to a pointed cap stone (anchor bottom centre). Lichen on the old
 * stones low down, the cap clean.
 */
export function paintCairn(seed: number, h = 46): Sprite {
  const rng = new Rng(seed * 17 + 3);
  const W = Math.round(h * 0.9), b = new PixelBuffer(W, h + 2);
  let y = h + 1, w = W * 0.92, i = 0;
  while (y > 6 && i < 12) {
    const sh = Math.max(4, Math.round(rng.range(4, 7) * (h / 46)));
    const sw = Math.max(7, Math.round(w * rng.range(0.85, 1)));
    const last = y - sh < 10 || w < 9;
    const s = paintBoulder(seed * 7 + i, last ? Math.max(7, Math.round(sw * 0.6)) : sw, last ? sh + 4 : sh, { ramp: i % 3 === 1 ? HP.greywacke : HP.granite, lichen: i < 3 ? 0.9 : 0.3, moss: 0, foot: false });
    const ox = Math.round(W / 2 - s.ax + rng.range(-2, 2) * (i ? 1 : 0)), oy = Math.round(y - s.ay - 1);
    for (let yy = 0; yy < s.buf.h; yy++) for (let xx = 0; xx < s.buf.w; xx++) {
      const c = s.buf.data[yy * s.buf.w + xx];
      if (c >>> 24) b.set(ox + xx, oy + yy, c);
    }
    y -= sh - 1;
    w *= rng.range(0.74, 0.86);
    i++;
    if (last) break;
  }
  // tussock round its foot
  for (let x = 1; x < W - 1; x++) if (hp(x, 3, seed) < 0.35) { const bh = 2 + Math.floor(hp(x, 4, seed) * 5); for (let k = 0; k < bh; k++) b.set(x + (k > bh / 2 ? 1 : 0), h + 1 - k, pick(HP.tussock, 3 + k * 0.8)); }
  return { buf: b, ax: Math.round(W / 2), ay: h + 1 };
}

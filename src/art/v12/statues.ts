// V12 the old carvings of Zealandia: every statue is one of the island's animals, sculpted as a body
// (coils, limbs, a head with a jaw, a claw) on the beast sketch core (src/art/beasts-core.ts Sk: swept
// tubes and ellipsoids with real form light), and every one of them is old and going back to the
// forest: weathered silver wood or lichened stone, the red ochre (kōkōwai) left only in the deepest
// grooves, cracks running with the grain, chips knocked out of the edges, pieces snapped off (the break
// faces paler where the inside shows), moss on everything that faces the sky, and ferns in the cracks.
//
//   hineruaStatue      Te Kāinga's landing: Hinerua rearing out of her own coils, a fin crest with a
//                      spine snapped, one pāua eye left, offerings at her foot (still cared for)
//   bearerStatue       the Old Pā: Matikuku Nui up on its hind legs, the great claw arm raised, the
//                      claw itself snapped off and lying in the moss at its feet
//   striderStatue      the Old Pā: a legged forest serpent coiled on a broken stump, its snout worn away
//   fallenSerpent      the Old Pā: a serpent carving toppled and broken in two, half sunk and overgrown
//   ruinStump          the Old Pā's palisade: rotted, split post stumps with jagged tops
//   brokenRelief       the Old Pā's great carving: a stone slab cracked across, a corner fallen, the
//                      legged taniwha coiled round the hole worn soft and mossed in its grooves

import { PixelBuffer } from '../pixel';
import { hex } from '../color';
import type { C } from '../color';
import type { Sprite } from '../jungle-core';
import { Sk, rmp, cbez, qbez } from '../beasts-core';
import type { V2, Px } from '../beasts-core';
import { Rng, clamp, fbm2 } from '../../core/math';
import { plant } from '../jungle-plants';
import type { PlantKind } from '../jungle-plants';

const h01 = (x: number, y: number, s: number) => {
  let n = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

// ---------------------------------------------------------------- palettes
const RAMPS = {
  /** old tōtara gone silver */
  wood: rmp('#8b7c6a', { n: 7, cool: 0.45, warm: 0.15, dark: 0.72, light: 0.42 }),
  /** older, darker, wetter wood (the pā) */
  woodOld: rmp('#6f5d4b', { n: 7, cool: 0.5, warm: 0.2, dark: 0.75, light: 0.4 }),
  /** the pā's greywacke */
  stone: rmp('#7d8072', { n: 7, cool: 0.5, warm: 0.15, dark: 0.72, light: 0.4 }),
  ochre: rmp('#8f3a24', { n: 5, cool: 0.2, warm: 0.3, dark: 0.6, light: 0.3 }),
  moss: rmp('#5d8a30', { n: 6, cool: 0.35, warm: 0.4, dark: 0.7, light: 0.45 }),
  mossDry: rmp('#7d8a3c', { n: 5, cool: 0.3, warm: 0.4, dark: 0.65, light: 0.4 }),
  breakWood: rmp('#b9a487', { n: 5, cool: 0.3, warm: 0.3, dark: 0.45, light: 0.4 }),
  breakStone: rmp('#a9a998', { n: 5, cool: 0.3, warm: 0.2, dark: 0.45, light: 0.4 }),
  paua: rmp('#3aa39a', { n: 5, cool: 0.6, warm: 0.1, dark: 0.7, light: 0.75 }),
};
const LICHEN = [hex('#aebb84'), hex('#cfd7a6'), hex('#d49a3e'), hex('#e9c47a')];
const INK = hex('#120c08');

interface Mats {
  body: number; groove: number; ochre: number; moss: number; mossDry: number; brk: number; paua: number; socket: number;
  ramp: C[];
}
function mats(sk: Sk, kind: 'wood' | 'woodOld' | 'stone'): Mats {
  const ramp = RAMPS[kind];
  return {
    ramp,
    body: sk.m(ramp, { k: 1.05 }),
    groove: sk.m(ramp, { k: 0.9, bias: -0.32, edge: 1 }),
    ochre: sk.m(RAMPS.ochre, { k: 0.9, bias: -0.12, edge: 1 }),
    moss: sk.m(RAMPS.moss, { k: 0.85, bias: 0.04 }),
    mossDry: sk.m(RAMPS.mossDry, { k: 0.85 }),
    brk: sk.m(kind === 'stone' ? RAMPS.breakStone : RAMPS.breakWood, { k: 0.8, bias: 0.05, noRim: true }),
    paua: sk.m(RAMPS.paua, { k: 1.2, spec: 0.6 }),
    socket: sk.m([INK, hex('#2a1e16'), hex('#3a2c22')], { k: 0.6, bias: -0.2 }),
  };
}

/**
 * The surface of a carving: moss where it faces the sky (and near the ground), the carved pattern cut
 * into it as grooves (some still holding ochre), lichen, and the grain or the stone's mottle in the light.
 */
function surface(M: Mats, o: { seed: number; base: number; mossK?: number; groove?: (p: Px) => boolean; ochreK?: number; grain?: 'wood' | 'stone'; mossFrom?: number }) {
  const mk = o.mossK ?? 1;
  return (p: Px): number => {
    const n = fbm2(p.x * 0.11, p.y * 0.11, 3, o.seed);
    // the grain (wood: long streaks up the carving; stone: a mottle)
    if (o.grain === 'stone') p.l += (fbm2(p.x * 0.3, p.y * 0.3, 2, o.seed + 3) - 0.5) * 0.22;
    else p.l += (Math.sin(p.x * 1.7 + fbm2(p.x * 0.05, p.y * 0.02, 2, o.seed) * 9) > 0.7 ? -0.08 : 0) + (h01(p.x | 0, (p.y / 3) | 0, o.seed) - 0.5) * 0.06;
    // moss: on the tops of things, thicker low down, in clumps
    const up = -p.ny * (o.mossFrom === undefined ? 1 : clamp((p.y - o.mossFrom) / 24 + 0.15));
    const low = clamp((p.y - (o.base - 14)) / 14);
    const mossy = (up * 0.9 + low * 0.55) * mk + (n - 0.5) * 1.3;
    if (mossy > 0.55) return n > 0.62 ? M.mossDry : M.moss;
    // lichen in pale and orange rosettes on the exposed faces
    if (h01((p.x / 2) | 0, (p.y / 2) | 0, o.seed + 9) > 0.975 && up > -0.3) return M.mossDry;
    if (o.groove?.(p)) return h01(p.x | 0, p.y | 0, o.seed + 5) < (o.ochreK ?? 0.35) ? M.ochre : M.groove;
    return M.body;
  };
}

/** a loop of a coil seen from the side: back half low, front half high */
function coil(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 40): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return out;
}

// ---------------------------------------------------------------- the ruin
/** knock pieces out of the G-buffer: everything where `gone` is true goes; the faces left beside the cut turn into a pale break */
function breakOff(sk: Sk, M: Mats, gone: (x: number, y: number) => boolean) {
  const W = sk.w, H = sk.h, cut = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (sk.mat[i] && gone(x - sk.ox + 0.5, y - sk.oy + 0.5)) { sk.mat[i] = 0; cut[i] = 1; }
  }
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (!sk.mat[i]) continue;
    let near = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const j = (y + dy) * W + x + dx; if (j >= 0 && j < cut.length && cut[j]) near++; }
    if (near > 0 && sk.mat[i] !== M.moss) { sk.mat[i] = M.brk; sk.lum[i] = 0.42 + h01(x, y, 3) * 0.3 + (cut[i - 1] || cut[i - W] ? 0.12 : -0.1); }
  }
}

/** chip the silhouette: notches where the edge has crumbled, a few deeper bites */
function chip(sk: Sk, seed: number, k = 1) {
  const W = sk.w, H = sk.h, src = sk.mat.slice();
  const empty = (x: number, y: number) => x < 0 || y < 0 || x >= W || y >= H || !src[y * W + x];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!src[i]) continue;
    const edge = empty(x - 1, y) || empty(x + 1, y) || empty(x, y - 1) || empty(x, y + 1);
    if (!edge) continue;
    const n = fbm2(x * 0.35, y * 0.35, 2, seed);
    if (n > 0.66 - 0.06 * k) {
      sk.mat[i] = 0;
      // a deeper bite now and then
      if (h01(x, y, seed) > 0.8) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const j = (y + dy) * W + x + dx; if (j >= 0 && j < sk.mat.length && h01(x + dx, y + dy, seed + 1) > 0.4) sk.mat[j] = 0; }
    }
  }
}

/** cracks: dark seams wandering with the grain (mostly down), a pale lip on the lit side */
function cracks(b: PixelBuffer, sk: Sk, M: Mats, seed: number, n: number, len: [number, number], dir: V2 = [0, 1]) {
  const rng = new Rng(seed);
  const solid = (x: number, y: number) => x > 0 && y > 0 && x < b.w - 1 && y < b.h - 1 && (b.get(x, y) >>> 24) > 0 && sk.mat[y * sk.w + x] > 0 && sk.mat[y * sk.w + x] !== M.moss;
  for (let c = 0; c < n; c++) {
    let tries = 0, x = 0, y = 0;
    do { x = rng.int(2, b.w - 3); y = rng.int(2, b.h - 3); } while (!solid(x, y) && ++tries < 200);
    if (tries >= 200) continue;
    const L = rng.int(len[0], len[1]);
    let fx = x, fy = y;
    for (let s = 0; s < L; s++) {
      const X = Math.round(fx), Y = Math.round(fy);
      if (!solid(X, Y)) break;
      b.set(X, Y, M.ramp[0]);
      if (solid(X - 1, Y) && h01(X, Y, seed) > 0.35) b.set(X - 1, Y, M.ramp[Math.min(M.ramp.length - 1, 5)]);
      fx += dir[0] + (rng.next() - 0.5) * 1.3;
      fy += dir[1] + (rng.next() - 0.5) * 0.5;
      // a branch now and then
      if (rng.next() < 0.08 && s > 3) { const bx = X + (rng.next() < 0.5 ? -1 : 1), by = Y + 1; if (solid(bx, by)) b.set(bx, by, M.ramp[1]); }
    }
  }
}

/** moss tufts standing up off the mossy tops, and orange-and-pale lichen rosettes */
function mossTufts(b: PixelBuffer, sk: Sk, M: Mats, seed: number) {
  const W = b.w, moss = RAMPS.moss;
  for (let y = 1; y < b.h; y++) for (let x = 1; x < W - 1; x++) {
    const m = sk.mat[y * sk.w + x];
    if ((m !== M.moss && m !== M.mossDry) || (b.get(x, y - 1) >>> 24) !== 0) continue;
    const r = h01(x, y, seed);
    if (r > 0.55) { b.set(x, y - 1, moss[3]); if (r > 0.82 && y > 2) b.set(x, y - 2, moss[4]); }
    if (r > 0.93 && y > 3 && x > 2) { b.set(x - 1, y - 2, moss[2]); b.set(x, y - 3, moss[5]); }
  }
  // lichen rosettes on the bare carving
  for (let y = 1; y < b.h - 1; y++) for (let x = 1; x < W - 1; x++) {
    const m = sk.mat[y * sk.w + x];
    if (m !== M.body || h01((x / 3) | 0, (y / 3) | 0, seed + 4) < 0.965) continue;
    const c = LICHEN[(h01(x, y, seed) * 4) | 0];
    if (h01(x, y, seed + 2) > 0.45) b.set(x, y, c);
  }
}

/** a small plant growing out of the carving (a fern in a crack, a seedling on a ledge) */
function sprout(b: PixelBuffer, kind: PlantKind, seed: number, size: number, x: number, y: number) {
  const s = plant(kind, seed, size);
  b.blit(s.buf, Math.round(x - s.ax), Math.round(y - s.ay));
}

function finish(sk: Sk, M: Mats, seed: number, o: { cracks: number; crackLen?: [number, number]; ax: number; ay: number; chipK?: number }): { b: PixelBuffer; sk: Sk } {
  chip(sk, seed, o.chipK ?? 1);
  const b = sk.resolve({ rim: 0.1, bounce: 0.06 });
  cracks(b, sk, M, seed + 1, o.cracks, o.crackLen ?? [6, 18]);
  mossTufts(b, sk, M, seed + 2);
  return { b, sk };
}

// ================================================================ Hinerua at the landing
/** Hinerua rearing out of her own coils: the village's serpent pou, very old, still cared for (about 64 x 132) */
export function hineruaStatue(): Sprite {
  const W = 70, H = 136, base = 132;
  const sk = new Sk(W, H, 0, 0);
  const M = mats(sk, 'wood');
  const seed = 71;
  // notched ridges (pākati) along the edges of the body and koru spirals cut into the coils
  const groove = (p: Px) => (Math.abs(p.v) > 0.72 && (Math.floor(p.t * 70) & 1) === 0) || Math.sin(p.t * 34 + p.v * 2.6) > 0.93;
  const S = surface(M, { seed, base, groove, ochreK: 0.45, mossFrom: 96 });
  // the base: two loops of her body, the lower the widest
  sk.np(); sk.tube(coil(34, 120, 24, 7, Math.PI * 0.95, Math.PI * 2.95), t => 6.4 - t * 0.6, S, { z: t => Math.sin(Math.PI * 0.95 + t * Math.PI * 2) * 12 });
  sk.np(); sk.tube(coil(32, 107, 17, 5, Math.PI * 1.05, Math.PI * 2.85), t => 5.8 - t * 0.4, S, { z: t => 8 + Math.sin(Math.PI * 1.05 + t * Math.PI * 1.8) * 9 });
  // the body rising in an S, tapering to the neck
  const rise = cbez([47, 104], [62, 84], [16, 72], [30, 46], 24);
  const neck = qbez([30, 46], [35, 30], [25, 24], 10);
  const body = [...rise, ...neck.slice(1)];
  sk.np(); sk.tube(body, t => 7.4 - t * 2.2, S, { z: t => 14 + Math.sin(t * Math.PI) * 4 });
  // two short forelegs held up in front of her chest, claws open: the guardian's pose (the far one behind)
  for (const [sx, sy, ex, ey, hx, hy, z] of [[30, 56, 21, 62, 15, 54, 8], [27, 58, 17, 66, 10, 59, 26]] as [number, number, number, number, number, number, number][]) {
    sk.np(); sk.tube([[sx, sy], [ex, ey], [hx, hy]], t => 3 - t * 0.9, S, { z });
    sk.np(); for (let k = -1; k <= 1; k++) sk.tube([[hx, hy], [hx - 3.2, hy - 1.5 + k * 2.2]], 0.85, M.groove, { z: z + 1 });
  }
  // her head: wide and gentle, looking out over the river (west), the jaw a deep groove
  sk.np(); sk.ell(18, 21, 11.5, 7.2, S, { z: 20, rot: 0.08 });
  sk.np(); sk.ell(7.5, 23.5, 6.4, 4.4, S, { z: 21 });
  sk.np(); sk.tube([[27, 16], [17, 14], [8, 17]], 1.4, S, { z: 26 });
  sk.np(); sk.tube([[24, 26.5], [12, 27.2], [3.5, 25.6]], 0.75, M.groove, { z: 27 });
  sk.np(); sk.tube([[3.5, 21.5], [5, 22.5]], 0.6, M.socket, { z: 27 });
  // the fin crest: five spines along the back of the head and neck, the third snapped short
  const spines: [number, number, number, number][] = [[22, 15, 26, 3], [27, 16, 34, 5], [30, 21, 38, 12], [32, 27, 41, 21], [33, 33, 42, 30]];
  spines.forEach(([x0, y0, x1, y1], i) => {
    const snap = i === 2 ? 0.45 : 1;
    sk.np(); sk.tube([[x0, y0], [x0 + (x1 - x0) * snap, y0 + (y1 - y0) * snap]], t => 1.6 - t * 1.1, S, { z: 18 - i });
  });
  // the one pāua eye still in its socket (the other side's long gone)
  sk.np(); sk.ell(14, 19.5, 2.5, 2, M.socket, { z: 27 });
  sk.np(); sk.ell(14, 19.4, 1.6, 1.3, M.paua, { z: 28 });
  // the ruin: the snapped spine's break, a bite out of the lower coil's front, the snout's tip
  breakOff(sk, M, (x, y) => (Math.hypot(x - 52, y - 125) < 4.5 + fbm2(x * 0.5, y * 0.5, 2, seed) * 3) || (x < 2.4 + fbm2(0, y * 0.6, 2, seed) * 2 && y > 20 && y < 28));
  const { b } = finish(sk, M, seed, { cracks: 7, crackLen: [8, 22], ax: 34, ay: base });
  // a fern from the crack between the coils, a seedling on her shoulder
  sprout(b, 'fern', 912, 14, 55, 112);
  sprout(b, 'seedling', 913, 8, 36, 72);
  // offerings at her foot: a flat stone, kōwhai flowers, a twist of flax
  for (let x = 14; x < 50; x++) for (let y = 129; y <= 133; y++) {
    const k = (x - 32) / 18, top = 129 + Math.round(k * k * 2.4 + h01(x, 0, 5));
    if (y < top) continue;
    if (b.get(x, y) >>> 24) continue;
    b.set(x, y, y === top ? hex('#9a9890') : y === 133 ? hex('#3a3834') : (x + y) % 5 === 0 ? hex('#5e5c56') : hex('#76746c'));
  }
  for (const [x, y] of [[20, 127], [23, 128], [26, 127], [40, 128]]) { b.set(x, y, hex('#f4c63a')); b.set(x + 1, y, hex('#e8a722')); b.set(x, y - 1, hex('#fde68a')); b.set(x, y + 1, hex('#5d7a2c')); }
  for (let i = 0; i < 9; i++) b.set(30 + i, 127 - (i % 3 === 1 ? 1 : 0), i % 2 ? hex('#3c5c2a') : hex('#6a9246'));
  b.outline(INK);
  return { buf: b, ax: 34, ay: base };
}

// ================================================================ the Old Pā
/** Matikuku Nui rearing, the claw arm raised, the claw snapped off and lying at its feet (about 84 x 112) */
export function bearerStatue(seed = 31): Sprite {
  const W = 88, H = 116, base = 112;
  const sk = new Sk(W, H, 0, 0);
  const M = mats(sk, 'stone');
  // fur cut in short chiselled strokes, ridged along the brow and the claw
  const groove = (p: Px) => Math.sin(p.x * 1.3 + p.y * 0.5 + fbm2(p.x * 0.2, p.y * 0.2, 2, seed) * 6) > 0.86;
  const S = surface(M, { seed, base, groove, ochreK: 0.12, grain: 'stone', mossK: 1.25 });
  const lean = (y: number) => (base - y) * 0.05;
  const L = (x: number, y: number): V2 => [x + lean(y), y];
  // a rough plinth, sunk in the ground
  sk.np(); sk.ell(44, base - 3, 26, 6, S, { z: 0, flat: 0.3 });
  // hind legs, thick, planted
  sk.np(); sk.tube([L(36, 80), L(30, 94), L(31, base - 5)], t => 8 - t * 2.4, S, { z: 6 });
  sk.np(); sk.tube([L(52, 80), L(57, 94), L(55, base - 5)], t => 8.2 - t * 2.4, S, { z: 10 });
  for (const fx of [26, 51]) { sk.np(); sk.ell(fx + 4 + lean(base - 6), base - 6, 7, 3.2, S, { z: 14 }); }
  // the body: a heavy barrel rearing up, a hump of shoulder
  sk.np(); sk.ell(44 + lean(64), 64, 17, 22, S, { z: 12, rot: 0.12 });
  sk.np(); sk.ell(46 + lean(46), 45, 15, 11, S, { z: 15 });
  // the near arm hanging, its paw curled
  sk.np(); sk.tube([L(34, 48), L(28, 62), L(31, 74)], t => 5.2 - t * 1.4, S, { z: 26 });
  sk.np(); sk.ell(31 + lean(76), 76, 4.6, 3.8, S, { z: 27 });
  // the claw arm raised high over its head
  sk.np(); sk.tube([L(55, 44), L(66, 30), L(66, 15)], t => 6.4 - t * 1.6, S, { z: 20 });
  // the wrist knob where the claw grew out (the claw itself is gone: a stub and a pale break)
  sk.np(); sk.ell(66 + lean(12), 12, 5.4, 4.6, S, { z: 22 });
  sk.np(); sk.tube([L(68, 9), L(74, 5)], t => 3.6 - t * 0.8, S, { z: 23 });
  // the head: heavy brow, short snout, small ears, worn soft
  sk.np(); sk.ell(36 + lean(30), 30, 10.5, 9, S, { z: 22 });
  sk.np(); sk.ell(25 + lean(35), 35, 9, 5.2, S, { z: 25, rot: 0.1 });
  sk.np(); sk.ell(17 + lean(34), 34, 2.6, 2.2, M.groove, { z: 29 });
  sk.np(); sk.tube([L(28, 25.5), L(42, 24)], 2.1, S, { z: 29 });
  for (const ex of [32, 43]) { sk.np(); sk.ell(ex + lean(22), 22, 2.8, 2.4, S, { z: 18 }); }
  sk.np(); sk.ell(31 + lean(28.5), 28.5, 1.4, 1.1, M.socket, { z: 30 });
  sk.np(); sk.tube([L(18, 38.5), L(30, 39.5)], 0.7, M.groove, { z: 30 });
  // the claw, snapped at the base, lying in the moss at its feet: a long hooked blade
  const clawPts = cbez([6, base - 4], [14, base - 14], [30, base - 13], [38, base - 6], 18);
  sk.np(); sk.tube(clawPts, t => 4.4 * (1 - t) ** 0.7 + 0.6, S, { z: 2 });
  // breaks: the claw's stub on the wrist, the claw's own broken base, a chunk out of the brow
  breakOff(sk, M, (x, y) => (x > 74.5 + lean(5) + fbm2(0, y * 0.7, 2, seed) * 1.6 && y < 10) || (x < 6.4 + fbm2(0, y * 0.5, 2, seed + 1) * 1.5 && y > base - 12) || Math.hypot(x - 43 - lean(21), y - 21) < 3 + fbm2(x, y, 2, seed) * 2.2);
  const { b } = finish(sk, M, seed, { cracks: 9, crackLen: [8, 24], ax: 44, ay: base, chipK: 1.4 });
  // ferns at its feet and in the crook of the raised arm
  sprout(b, 'fern', 931, 18, 70, base - 2);
  sprout(b, 'kidneyfern', 932, 10, 18, base - 1);
  sprout(b, 'seedling', 933, 9, 59, 40);
  b.outline(INK);
  return { buf: b, ax: 44, ay: base };
}

/** a legged forest serpent coiled on a broken stump, its snout worn away (about 58 x 76) */
export function striderStatue(seed = 41): Sprite {
  const W = 60, H = 80, base = 76;
  const sk = new Sk(W, H, 0, 0);
  const M = mats(sk, 'woodOld');
  const groove = (p: Px) => (Math.abs(p.v) > 0.7 && (Math.floor(p.t * 50) & 1) === 0) || Math.sin(p.t * 26 + p.v * 3) > 0.92;
  const S = surface(M, { seed, base, groove, ochreK: 0.3, mossK: 1.2 });
  // the stump it was carved from, split and splayed at the foot
  sk.np(); sk.tube([[30, base], [30, 52]], t => 12 - t * 2 + (t < 0.15 ? (0.15 - t) * 30 : 0), S, { z: 0 });
  // one coil round the top of the stump
  sk.np(); sk.tube(coil(30, 49, 16, 4.6, Math.PI * 0.9, Math.PI * 2.9), t => 4.8 - t * 0.6, S, { z: t => 12 + Math.sin(Math.PI * 0.9 + t * Math.PI * 2) * 10 });
  // the body rising, the neck arched forward
  const body = cbez([44, 47], [52, 30], [24, 26], [20, 15], 20);
  sk.np(); sk.tube(body, t => 4.4 - t * 1, S, { z: 20 });
  // its legs: a pair gripping the coil, one broken off at the knee
  sk.np(); sk.tube([[41, 40], [48, 45], [47, 50]], 1.8, S, { z: 24 });
  sk.np(); sk.tube([[37, 34], [30, 38]], 1.8, S, { z: 23 });
  // the head, the snout worn away to a pale stump
  sk.np(); sk.ell(16, 14, 7.5, 4.6, S, { z: 23, rot: -0.15 });
  sk.np(); sk.ell(18, 12.5, 1.4, 1.1, M.socket, { z: 27 });
  breakOff(sk, M, (x, y) => (x < 11 + fbm2(0, y * 0.6, 2, seed) * 3 && y < 22) || (x < 31 && x > 27 && y > 35 && y < 40));
  const { b } = finish(sk, M, seed, { cracks: 6, crackLen: [6, 16], ax: 30, ay: base, chipK: 1.3 });
  sprout(b, 'fern', 941, 13, 44, base - 1);
  sprout(b, 'moss', 942, 8, 23, base - 1);
  b.outline(INK);
  return { buf: b, ax: 30, ay: base };
}

/** a serpent carving toppled and broken in two, half sunk in the earth, overgrown (about 118 x 40) */
export function fallenSerpent(seed = 51): Sprite {
  const W = 120, H = 42, base = 38;
  const sk = new Sk(W, H, 0, 0);
  const M = mats(sk, 'woodOld');
  const groove = (p: Px) => (Math.abs(p.v) > 0.7 && (Math.floor(p.t * 60) & 1) === 0) || Math.sin(p.t * 30 + p.v * 3) > 0.92;
  const S = surface(M, { seed, base: base - 4, groove, ochreK: 0.25, mossK: 1.6 });
  sk.clipY = base - 2;
  // the long piece: the body, coils carved on it, sunk to the waist
  sk.np(); sk.tube(qbez([4, 31], [30, 25], [58, 29], 16), t => 8 - t * 0.8, S, { z: 0 });
  sk.np(); sk.tube(coil(28, 25, 9, 3, Math.PI, Math.PI * 2.1), 2.6, S, { z: t => 8 + Math.sin(Math.PI + t * Math.PI * 1.1) * 4 });
  // the head end, rolled onto its side, a leg sticking up out of the ferns
  sk.np(); sk.tube(qbez([66, 30], [82, 24], [96, 26], 12), t => 7 - t * 1.2, S, { z: 2 });
  sk.np(); sk.ell(104, 24, 9, 6, S, { z: 4, rot: 0.25 });
  sk.np(); sk.tube([[100, 29.5], [111, 27]], 0.8, M.groove, { z: 10 });
  sk.np(); sk.ell(104, 21, 1.4, 1.1, M.socket, { z: 10 });
  sk.np(); sk.tube([[84, 22], [88, 12], [92, 9]], t => 2 - t * 0.6, S, { z: 6 });
  // the two ragged ends where it broke apart
  breakOff(sk, M, (x, y) => (x > 59 + fbm2(0, y * 0.7, 2, seed) * 3 && x < 66 + fbm2(1, y * 0.7, 2, seed) * 3) || (x > 2 && x < 6 && y < 30));
  const { b } = finish(sk, M, seed, { cracks: 6, crackLen: [5, 14], ax: 60, ay: base, chipK: 1.2 });
  // a mound of soil it settled into, ferns growing over the break
  for (let x = 0; x < W; x++) {
    const top = base - 2 - Math.round(Math.sin(x * 0.07) * 1.2 + h01(x, 1, seed) * 1.4);
    for (let y = top; y < H; y++) if (!(b.get(x, y) >>> 24)) b.set(x, y, y === top ? hex('#4a3a24') : (x + y) % 3 ? hex('#2e2216') : hex('#3a2a1a'));
  }
  sprout(b, 'fern', 951, 16, 62, base - 1);
  sprout(b, 'crownfern', 952, 14, 20, base);
  sprout(b, 'moss', 953, 9, 92, base - 1);
  b.outline(INK);
  return { buf: b, ax: 60, ay: base };
}

/** a palisade post rotted to a stump: split, leaning, a jagged top, moss climbing it (h px tall) */
export function ruinStump(seed: number, h: number): Sprite {
  const W = 18, H = h + 8, base = H - 3;
  const sk = new Sk(W, H, 0, 0);
  const M = mats(sk, 'woodOld');
  const S = surface(M, { seed, base, mossK: 1.4, groove: p => Math.abs(Math.sin(p.x * 2.2 + seed)) > 0.96 });
  const lean = (h01(seed, 1, 2) - 0.5) * 6;
  sk.np(); sk.tube([[9, base], [9 + lean * 0.5, base - h * 0.6], [9 + lean, base - h]], t => 4.2 - t * 1 + Math.sin(t * 9 + seed) * 0.4, S, { z: 0 });
  breakOff(sk, M, (x, y) => y < base - h + 2 + fbm2(x * 0.7, 0, 2, seed) * 6);
  const { b } = finish(sk, M, seed, { cracks: 2, crackLen: [4, Math.max(5, h * 0.6 | 0)], ax: 9, ay: base, chipK: 1.5 });
  if (h > 16 && h01(seed, 7, 3) > 0.5) sprout(b, 'moss', 960 + (seed % 5), 7, 9, base);
  b.outline(INK);
  return { buf: b, ax: 9, ay: base };
}

/** the great carving: a stone slab cracked across, the top corner fallen, the legged taniwha coiled
 *  round the hole in the earth worn soft, moss in its grooves (about 128 x 100) */
export function brokenRelief(seed = 61): Sprite {
  const W = 132, H = 102, base = 98;
  const sk = new Sk(W, H, 0, 0);
  const M = mats(sk, 'stone');
  const S = surface(M, { seed, base, grain: 'stone', mossK: 0.9, groove: () => false });
  // the slab: a rough, leaning shape (no straight edges), its top-right corner gone
  const edgeN = (a: number) => (fbm2(a * 3, 0, 2, seed) - 0.5) * 10;
  const slab: number[] = [];
  const pts: V2[] = [[6, base], [3, 70], [7, 44], [4, 22], [14, 8], [30, 10], [44, 3], [62, 7], [80, 5], [94, 12], [99, 26], [112, 32], [119, 50], [117, 74], [122, base]];
  for (let i = 0; i < pts.length; i++) { const [x, y] = pts[i]; const edge = y >= base - 1; slab.push(x + edgeN(i), edge ? y : y + edgeN(i + 9)); }
  sk.np(); sk.poly(slab, S, { z: 0, n: [0, 0, 1] });
  // the relief: the taniwha's body coiled round the hole, raised off the face
  const cx = 62, cy = 54;
  // scales cut in rows across the body, a ridge of notches down its back
  const R = (p: Px) => { const m = S(p); if (m !== M.body) return m; return Math.abs(p.v) > 0.82 || (Math.sin(p.t * 120) > 0.55 && Math.abs(p.v) < 0.5) ? M.groove : m; };
  // the body: from the head (top right) round the hole, the tail curling in at the end
  const bodyPath = [...coil(cx, cy, 33, 27, -0.55, -0.55 + Math.PI * 1.75, 56), ...coil(cx - 4, cy - 6, 18, 14, -0.55 + Math.PI * 1.75, Math.PI * 3.1, 20).slice(1)];
  sk.np(); sk.tube(bodyPath, t => 6.4 * (1 - t) ** 0.6 + 0.8, R, { z: 4, rz: 0.75 });
  // four clawed legs reaching in toward the hole
  for (const a of [0.55, 1.6, 2.7, 3.8]) {
    const sx = cx + Math.cos(a) * 33, sy = cy + Math.sin(a) * 27;
    const kx = cx + Math.cos(a + 0.35) * 26, ky = cy + Math.sin(a + 0.35) * 20;
    const ex = cx + Math.cos(a + 0.15) * 19, ey = cy + Math.sin(a + 0.15) * 14;
    sk.np(); sk.tube([[sx, sy], [kx, ky], [ex, ey]], t => 2.8 - t * 0.9, R, { z: 5, rz: 0.75 });
    for (let k = -1; k <= 1; k++) { const ca = Math.atan2(cy - ey, cx - ex) + k * 0.5; sk.np(); sk.tube([[ex, ey], [ex + Math.cos(ca) * 3.6, ey + Math.sin(ca) * 3.6]], 0.75, M.groove, { z: 7 }); }
  }
  // the head, out past the rim at the top right: a long open jaw, a worn brow ridge, the eye socket
  const hx = cx + Math.cos(-0.55) * 33, hy = cy + Math.sin(-0.55) * 27;
  sk.np(); sk.ell(hx + 3, hy - 7, 10, 6.4, R, { z: 7, rot: -0.75, rz: 3.4 });
  sk.np(); sk.tube([[hx + 4, hy - 9], [hx + 16, hy - 20]], t => 3.2 - t * 1.6, R, { z: 8, rz: 0.8 });
  sk.np(); sk.tube([[hx + 7, hy - 4], [hx + 20, hy - 11]], t => 2.6 - t * 1.4, R, { z: 7, rz: 0.8 });
  sk.np(); sk.tube([[hx + 9, hy - 9], [hx + 18, hy - 14]], 0.9, M.socket, { z: 9 });
  sk.np(); sk.ell(hx + 1, hy - 11, 1.8, 1.4, M.socket, { z: 11 });
  for (let i = 0; i < 4; i++) { sk.np(); sk.tube([[hx - 3 + i * 2, hy - 13 - i * 2], [hx - 6 + i * 2, hy - 17 - i * 2]], 0.9, R, { z: 9 }); }
  // the spiral hole: a dark groove winding in to a black centre
  for (let a = 0; a < Math.PI * 5; a += 0.05) {
    const r = 1.6 + a * 0.85, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.8;
    sk.np(); sk.ell(x, y, 0.9, 0.9, M.groove, { z: 0.5, noZ: true });
  }
  sk.np(); sk.ell(cx, cy, 3.2, 2.6, M.socket, { z: 1, noZ: true });
  // the big crack right across, the slab settled a little either side of it
  const crackX = (y: number) => 40 + (y - 6) * 0.3 + fbm2(0, y * 0.25, 2, seed) * 8;
  breakOff(sk, M, (x, y) => (Math.abs(x - crackX(y)) < 0.9 && y > 26) || (x < 34 + fbm2(0, y * 0.3, 2, seed + 4) * 6 && y < 30 - x * 0.25));
  const { b } = finish(sk, M, seed, { cracks: 10, crackLen: [8, 30], ax: 64, ay: base, chipK: 1.2 });
  // the fallen corner lying at the foot, leaning on the slab
  const ck = new Sk(30, 24, 0, 0), CM = mats(ck, 'stone');
  const CS = surface(CM, { seed: seed + 7, base: 22, grain: 'stone' });
  ck.np(); ck.poly([2, 22, 4, 6, 18, 2, 28, 12, 26, 22], CS, { z: 0, n: [0.25, -0.2, 0.95] });
  chip(ck, seed + 7, 1.4);
  const corner = ck.resolve({ rim: 0.1 });
  b.blit(corner, 0, base - 21);
  sprout(b, 'fern', 971, 18, 118, base);
  sprout(b, 'kidneyfern', 972, 12, 34, base);
  sprout(b, 'moss', 973, 10, 60, base);
  b.outline(INK);
  return { buf: b, ax: 64, ay: base };
}

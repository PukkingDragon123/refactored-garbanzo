// V12 Te Ara Matatū, chapters 4-7: the props, hand-shaped on the beast sketch core (real form light,
// then hand detail: grooves, chips, lichen, barnacles, cracks), in the manner of
// src/art/v12/statues.ts and src/art/v12/wild/encounters.ts.
//
//   watcherStatue(seed, o)   a stone watcher: the Old One (a tuatara) carved crouched on a plinth, its head
//                            raised and turned to look along the way it points; spiral grooves on the
//                            flank, the crest cut as notches, one eye socket (o.socket: the clue stone
//                            sits in it, a pāua glint). o.drowned: green with weed, barnacled, kelp
//                            streaming off it. Anchor: the middle of the plinth's foot.
//   denRock(seed)            the octopus's den under the drowned watcher: a heap of boulders with a dark
//                            mouth (back: the heap; lip: the stones in front of the mouth). Anchor: bottom middle.
//   seabirdNest(seed, eggs)  a scrape ringed with pebbles, down and feathers, 0-3 pale speckled eggs.
//   throatGate(lit, open)    the gate of Te Korokoro: two carved posts, the lintel, and a stone slab
//                            between with five sockets that glow as the clues go in; open: the slab sunk.
//   sinterCone(seed)         a geyser's cone of grey-white sinter, a dark throat, mineral stains.

import { PixelBuffer } from '../../pixel';
import { hex } from '../../color';
import type { C } from '../../color';
import type { Sprite } from '../../jungle-core';
import { Sk, rmp, qbez, cbez, hh } from '../../beasts-core';
import type { V2, Px } from '../../beasts-core';

const INK = hex('#120c08');
const h01 = (x: number, y: number, s: number) => hh(x, y, s);

/** carved stone: chisel grooves, weathering, lichen (or weed) on what faces up, a few cracks */
function stoneFill(sk: Sk, seed: number, drowned: boolean) {
  const M = {
    body: sk.m(rmp(drowned ? '#5f7470' : '#7d8072', { n: 7, cool: 0.5, warm: 0.15, dark: 0.72, light: 0.42 }), { k: 1.05 }),
    groove: sk.m(rmp(drowned ? '#2a3a3a' : '#3c3c34', { n: 4, dark: 0.5, light: 0.3 }), { edge: 0, noRim: true }),
    ochre: sk.m(rmp('#8f3a24', { n: 4, dark: 0.5, light: 0.3 }), { edge: 0, noRim: true }),
    moss: sk.m(rmp(drowned ? '#4f7a3a' : '#5d8a30', { n: 5, cool: 0.35, warm: 0.4, dark: 0.7, light: 0.45 }), { edge: 0 }),
    barn: sk.m(rmp('#d8d0bc', { n: 4, dark: 0.4, light: 0.35 }), { edge: 0, k: 0.8 }),
    lichen: sk.m(rmp('#c8b46a', { n: 4, dark: 0.35, light: 0.35 }), { edge: 0, k: 0.6 }),
  };
  const fill = (groove: (p: Px) => boolean) => (p: Px) => {
    p.l += (h01(p.x / 2, p.y / 2, seed) - 0.5) * 0.14 + (h01(p.x, p.y, seed + 1) - 0.5) * 0.06;
    if (groove(p)) { if (h01(p.x, p.y, seed + 2) > 0.92 && !drowned) return M.ochre; return M.groove; }
    if (p.ny < -0.55) {
      const m = h01(p.x / 3, p.y / 2, seed + 3) * 0.7 + h01(p.x, p.y, seed + 4) * 0.3;
      if (m > (drowned ? 0.5 : 0.62)) return M.moss;
    }
    if (drowned && h01(p.x, p.y, seed + 5) > 0.93) { p.l += 0.2; return M.barn; }
    if (!drowned && h01(p.x / 3, p.y / 3, seed + 6) > 0.955 && p.ny < 0.2) return M.lichen;
    return M.body;
  };
  return { M, fill };
}

function cracks(b: PixelBuffer, seed: number, n: number, col: C) {
  for (let i = 0; i < n; i++) {
    let x = Math.floor(h01(i, 1, seed) * b.w), y = Math.floor(h01(i, 2, seed) * b.h);
    for (let s = 0; s < 6 + h01(i, 3, seed) * 10; s++) {
      if (b.get(x, y) >>> 24 && b.get(x + 1, y) >>> 24 && b.get(x - 1, y) >>> 24) b.set(x, y, col);
      x += h01(i, s, seed + 9) < 0.5 ? 1 : -1; y += h01(s, i, seed + 7) < 0.7 ? 1 : 0;
    }
  }
}

// ================================================================== the watcher
export function watcherStatue(seed = 71, o: { drowned?: boolean; socket?: boolean; facing?: 1 | -1 } = {}): Sprite {
  const W = 92, H = 74, base = 70;
  const sk = new Sk(W, H, 0, 0);
  const dr = !!o.drowned;
  const { M, fill } = stoneFill(sk, seed, dr);
  // spiral grooves cut into the flank, notches along the crest
  const groove = (p: Px) => {
    const dx = p.x - 42, dy = p.y - 44;
    const r = Math.hypot(dx * 0.8, dy), a = Math.atan2(dy, dx);
    return (r < 13 && Math.abs(((r + a * 2.1) % 4.5 + 4.5) % 4.5 - 2.2) < 0.5) || Math.sin(p.x * 0.9) > 0.97;
  };
  const S = fill(groove);
  // the plinth: a rough slab of greywacke, chipped
  sk.np();
  sk.poly([8, base - 9, 14, base - 13, 52, base - 14, 78, base - 12, 84, base - 7, 82, base, 10, base], (p: Px) => { p.l = 0.5 + (p.y - (base - 13)) * -0.03 + (h01(p.x / 2, p.y, seed + 8) - 0.5) * 0.2; return M.body; }, { z: 0, n: [0, -0.3, 1] });
  // the tail curled round the plinth's edge
  sk.np(); sk.tube(qbez([20, base - 14], [8, base - 18], [12, base - 26], 10), t => 5 - t * 3.6, S, { z: 8 });
  // the body crouched, the back arched
  sk.np(); sk.tube(qbez([22, base - 18], [42, base - 34], [60, base - 26], 12), t => 9 + Math.sin(t * Math.PI) * 3, S, { z: 10 });
  // legs: tucked, the near front leg straight, the toes cut into the plinth
  sk.np(); sk.tube([[28, base - 18], [26, base - 14]], 4, S, { z: 18 });
  sk.np(); sk.tube([[56, base - 22], [60, base - 15]], 3.8, S, { z: 18 });
  for (const fx of [24, 60]) for (let i = 0; i < 3; i++) sk.over(fx + i * 2, base - 13, M.groove ? hex('#3c3c34') : INK);
  // the neck rising and the head raised, turned to look along the way: the wedge of the tuatara head
  sk.np(); sk.tube(qbez([60, base - 28], [68, base - 40], [70, base - 48], 8), t => 7 - t * 1.6, S, { z: 14 });
  sk.np();
  sk.poly([64, base - 54, 72, base - 57, 82, base - 55, 89, base - 51, 90, base - 48, 86, base - 45.5, 74, base - 44, 65, base - 45], (p: Px) => {
    const lx = (p.x - 76) / 13, ly = (p.y - (base - 50)) / 6;
    p.nx = lx * 0.6; p.ny = ly * 0.8; p.nz = Math.sqrt(Math.max(0.1, 1 - lx * lx * 0.5 - ly * ly * 0.6));
    p.l = 0.44 + 0.62 * (p.nx * -0.52 + p.ny * -0.74 + p.nz * 0.42);
    return S(p);
  }, { z: 20 });
  // the crest: a row of stone spines along the neck and the back, chipped
  {
    const back = qbez([68, base - 50], [52, base - 50], [24, base - 28], 14);
    back.forEach((q, i) => {
      if (i % 1 !== 0 || hh(i, 3, seed) < 0.12) return;
      const ht = (i < 5 ? 6 : 5) - i * 0.18 + hh(i, 5, seed) * 1.5;
      sk.np();
      sk.blade(q[0], q[1] + 2, q[0] - 1.6, q[1] - ht, t => 1.5 - t * 1.3, S, { z0: 9, z1: 9 });
    });
  }
  // the smile cut in, the crest notches down the neck and back
  for (let x = 68; x <= 88; x++) sk.over(x, Math.round(base - 47.5 + (x < 72 ? (72 - x) * 0.3 : 0)), hex('#24241e'));
  for (let i = 0; i < 9; i++) {
    const p = qbez([66, base - 52], [56, base - 42], [26, base - 32], 8)[i % 9];
    sk.over(p[0], p[1] - 5 - (i % 2), hex(dr ? '#8aa49a' : '#b4b6a2'));
    sk.over(p[0] + 1, p[1] - 4, hex(dr ? '#3a4c4a' : '#4a4a40'));
  }
  // the eye socket: a deep drilled hollow, or the clue stone set in it (a pāua glint)
  {
    const ex = 76, ey = base - 51;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) sk.over(ex + dx, ey + dy, o.socket ? (dx + dy === 0 ? hex('#bff4e4') : hex(dy ? '#2a8a86' : '#4ac8b4')) : hex('#141412'));
    sk.over(ex - 1, ey - 1, hex(dr ? '#4a5c58' : '#5a5a50'));
  }
  const b = sk.resolve();
  cracks(b, seed, 7, hex(dr ? '#2a3836' : '#3a3a32'));
  // weed and kelp streaming off the drowned one; ferns at the foot of the dry one
  if (dr) {
    for (const [x0, y0, L] of [[30, base - 40, 26], [52, base - 36, 34], [70, base - 56, 22], [16, base - 24, 18]] as const) {
      for (let i = 0; i < L; i++) {
        const x = x0 + Math.round(Math.sin(i * 0.35 + x0) * 2 + i * 0.25), y = y0 - i;
        if (y < 0 || x >= W) break;
        const c = i % 7 === 3 ? hex('#a4a03a') : i % 2 ? hex('#5a6a22') : hex('#6e7e2a');
        if (!(b.get(x, y) >>> 24) || i > 2) b.set(x, y, c);
        if (i % 5 === 2) b.set(x + 1, y, hex('#7e8a30'));
      }
    }
  } else {
    for (let i = 0; i < 9; i++) { const x = 6 + i * 2, y = base - 1 - (i % 3); b.set(x, y, hex(i % 2 ? '#4a7a2a' : '#6a9a3a')); b.set(x, y - 1, hex('#3a6a22')); }
  }
  b.outline(INK);
  if (o.facing === -1) {
    const f = new PixelBuffer(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) f.set(W - 1 - x, y, b.get(x, y));
    return { buf: f, ax: W - 1 - 46, ay: base };
  }
  return { buf: b, ax: 46, ay: base };
}

// ================================================================== the octopus's den
export const DEN = { w: 96, h: 50, mouthX: 0.58, mouthY: 0.62 };
export function denRock(seed = 81): { back: Sprite; lip: Sprite } {
  const W = DEN.w + 8, H = DEN.h + 4;
  const make = (front: boolean) => {
    const sk = new Sk(W, H, 0, 0);
    const { M, fill } = stoneFill(sk, seed, true);
    const S = fill(() => false);
    const rocks: [number, number, number, number, number][] = front
      ? [[DEN.w * 0.4, H - 8, 13, 9, 30], [DEN.w * 0.78, H - 7, 12, 8, 30], [DEN.w * 0.6, H - 4, 9, 5, 34]]
      : [[16, H - 14, 16, 14, 0], [40, H - 26, 22, 22, 4], [72, H - 24, 20, 20, 2], [92, H - 12, 12, 11, 6], [56, H - 38, 14, 11, 8]];
    for (const [cx, cy, rx, ry, z] of rocks) {
      sk.np();
      // a boulder: irregular outline (lobed), real form light, then the weed and barnacles from fill
      const pts: number[] = [];
      for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, r = 0.78 + h01(i, cx, seed) * 0.32; pts.push(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r * (Math.sin(a) > 0 ? 0.8 : 1)); }
      sk.poly(pts, (p: Px) => {
        const lx = (p.x - cx) / rx, ly = (p.y - cy) / ry;
        p.nx = lx * 0.8; p.ny = ly * 0.8; p.nz = Math.sqrt(Math.max(0.1, 1 - lx * lx * 0.6 - ly * ly * 0.6));
        p.l = 0.44 + 0.62 * (p.nx * -0.52 + p.ny * -0.74 + p.nz * 0.42);
        return S(p);
      }, { z });
    }
    void M;
    const b = sk.resolve();
    if (!front) {
      // the mouth of the den: a black hollow going back into the dark, its rim lit
      const mx = DEN.w * DEN.mouthX, my = H * DEN.mouthY;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const d = Math.hypot((x - mx) / 15, (y - my) / 9) + (h01(x, y, seed + 3) - 0.5) * 0.12;
        if (d < 1 && b.get(x, y) >>> 24) b.set(x, y, d < 0.75 ? hex('#05090c') : hex('#101a1e'));
      }
      cracks(b, seed, 6, hex('#22302e'));
    }
    b.outline(INK);
    return { buf: b, ax: Math.round(DEN.w / 2), ay: H - 1 };
  };
  return { back: make(false), lip: make(true) };
}

// ================================================================== a seabird's nest
export function seabirdNest(seed: number, eggs: number): Sprite {
  const W = 30, H = 13, b = new PixelBuffer(W, H);
  const peb = [hex('#2a2a30'), hex('#4a4850'), hex('#6e6a70'), hex('#9a948e')];
  const down = [hex('#d8d4c8'), hex('#f2eee4')];
  // the rim: pebbles, each a little lit cluster, with down and feather quills tucked between
  for (let i = 0; i < 13; i++) {
    const x = 2 + i * 1.8 + h01(i, 1, seed) * 1.2, y = H - 3 - Math.sin((i / 12) * Math.PI) * 1.2 - (i % 3 === 1 ? 1 : 0);
    const r = 1 + (h01(i, 2, seed) > 0.6 ? 1 : 0);
    for (let dy = -r; dy <= 0; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + 0.5) b.set(Math.round(x + dx), Math.round(y + dy), peb[dy < 0 && dx <= 0 ? 3 : dy < 0 ? 2 : dx > 0 ? 0 : 1]);
  }
  for (let i = 0; i < 9; i++) b.set(4 + Math.round(h01(i, 3, seed) * 18), H - 4 - Math.round(h01(i, 4, seed) * 2), down[i % 2]);
  // a feather standing out of the rim
  for (let i = 0; i < 4; i++) b.set(19 + i, H - 6 - i, i ? hex('#e8e4da') : hex('#8a8478'));
  // the eggs: pale blue-green, speckled dark at the blunt end
  for (let e = 0; e < eggs; e++) {
    const cx = 9 + e * 6, cy = H - 6;
    for (let dy = -4; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) {
      if ((dx * dx) / 6.5 + (dy * dy) / (dy < 0 ? 12 : 5.5) > 1) continue;
      const lit = dx < 0 && dy < 0;
      const c = h01(cx + dx, dy, seed + 9) > (dy < -1 ? 0.7 : 0.88) ? hex('#4a3a2a') : lit ? hex('#e8f2e8') : dy > 1 || dx > 1 ? hex('#a8bcb0') : hex('#cadcd0');
      b.set(cx + dx, cy + dy, c);
    }
  }
  b.outline(INK);
  return { buf: b, ax: W >> 1, ay: H - 1 };
}

// ================================================================== the gate of Te Korokoro
export function throatGate(lit: number, open: boolean): Sprite {
  const W = 120, H = 110, base = 106;
  const sk = new Sk(W, H, 0, 0);
  const { M, fill } = stoneFill(sk, 91, false);
  // spirals and chevrons cut down the posts (not bands)
  const carve = (p: Px) => { const cy = ((p.y % 14) + 14) % 14 - 7, cx = p.x - (p.x < 60 ? 12 : W - 12); const r = Math.hypot(cx, cy), a = Math.atan2(cy, cx); return r < 6 && Math.abs(((r + a * 1.4) % 3 + 3) % 3 - 1.5) < 0.45; };
  const S = fill(carve), plain = fill(() => false);
  // the posts: each a carved Old One standing on its tail, head at the top looking inward
  for (const [x0, dir] of [[12, 1], [W - 12, -1]] as const) {
    sk.np();
    sk.tube(cbez([x0, base], [x0 - dir * 4, base - 40], [x0 + dir * 3, base - 70], [x0 + dir * 1, base - 88], 14), t => 9 - t * 2.4, S, { z: 10 });
    // the head, turned in, its smile and socket
    sk.np();
    sk.tube([[x0, base - 90], [x0 + dir * 12, base - 92]], t => 6 - t * 3, plain, { z: 16 });
    sk.over(x0 + dir * 7, base - 94, hex('#141412'));
    for (let i = 0; i < 9; i++) sk.over(x0 + dir * (3 + i), base - 89, hex('#24241e'));
    // the crest notches down the post
    for (let y = base - 84; y < base - 10; y += 5) sk.over(x0 - dir * 8, y, hex('#b4b6a2'));
  }
  // the lintel
  sk.np();
  sk.poly([6, base - 100, W - 6, base - 100, W - 2, base - 94, W - 8, base - 88, 8, base - 88, 2, base - 94], (p: Px) => { p.l = 0.62 - (p.y - (base - 100)) * 0.03; return S(p); }, { z: 20, n: [0, -0.4, 1] });
  // the slab: the door, five sockets in an arc; sunk when it opens
  if (!open) {
    sk.np();
    const edge: number[] = [];
    const ptsL: [number, number][] = [[23, base], [25, base - 30], [22, base - 55], [26, base - 76], [33, base - 85], [50, base - 83], [64, base - 86], [86, base - 84], [95, base - 74], [93, base - 50], [97, base - 26], [95, base]];
    for (const [x, y] of ptsL) edge.push(x, y);
    sk.poly(edge, (p: Px) => {
      const lx = (p.x - 60) / 36, ly = (p.y - (base - 42)) / 44;
      p.nx = lx * 0.35; p.ny = ly * 0.3; p.nz = Math.sqrt(Math.max(0.2, 1 - lx * lx * 0.2 - ly * ly * 0.1));
      p.l = 0.44 + 0.62 * (p.nx * -0.52 + p.ny * -0.74 + p.nz * 0.42) + (h01(p.x / 4, p.y / 4, 93) - 0.5) * 0.12;
      // the old carving worn into the slab: the Old One coiled, all but gone
      const r = Math.hypot(p.x - 60, (p.y - (base - 44)) * 1.1), a = Math.atan2(p.y - (base - 44), p.x - 60);
      if (r > 30 && r < 33 && h01(p.x, p.y, 97) > 0.25) return M.groove;
      if (r < 14 && Math.abs(((r + a * 2) % 5 + 5) % 5 - 2.5) < 0.5) return M.groove;
      return plain(p);
    }, { z: 4 });
  }
  const b = sk.resolve();
  cracks(b, 91, 8, hex('#3a3a32'));
  // the sockets: dark hollows, or filled stones glowing pāua-green
  const glow = new PixelBuffer(W, H);
  if (!open) for (let i = 0; i < 5; i++) {
    const a = Math.PI * (0.15 + i * 0.175), sx = Math.round(60 - Math.cos(a) * 24), sy = Math.round(base - 46 - Math.sin(a) * 22);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dy * dy > 5) continue;
      if (i < lit) { const c = dx * dx + dy * dy <= 1 ? hex('#d8fff0') : hex('#3ac8a8'); b.set(sx + dx, sy + dy, c); glow.set(sx + dx, sy + dy, hex('#2a8a74')); }
      else b.set(sx + dx, sy + dy, dx * dx + dy * dy <= 2 ? hex('#0e0e0c') : hex('#4a4a40'));
    }
  } else {
    // the way open: the dark of the throat between the posts, warm air shimmering
    // (dithered from the warm dusk at the threshold into black, the edges ragged where the posts meet it)
    const deep = [hex('#3a2a1e'), hex('#24180f'), hex('#140c08'), hex('#080504')];
    for (let y = base - 86; y < base; y++) for (let x = 24; x < 96; x++) {
      if (b.get(x, y) >>> 24) continue;
      const e = Math.min(x - 24, 96 - x, y - (base - 88)) + h01(x, y >> 1, 96) * 3;
      if (e < 2) continue;
      const k = Math.min(3, Math.floor((e / 9) + (h01(x, y, 95) - 0.5) * 0.9 + ((x + y) & 1) * 0.3));
      b.set(x, y, deep[Math.max(0, k)]);
    }
  }
  void M;
  b.outline(INK);
  return { buf: b, ax: W >> 1, ay: base, glow };
}

// ================================================================== a geyser's cone
export function sinterCone(seed: number): Sprite {
  const W = 52, H = 22, b = new PixelBuffer(W, H);
  const ramp = [hex('#4a4440'), hex('#7a726a'), hex('#a8a096'), hex('#cfc8bc'), hex('#ebe6dc')];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // a low lumpy cone, terraced in thin rims of sinter
    const nx = (x - W / 2) / (W / 2), top = 4 + Math.abs(nx + 0.12 * Math.sin(nx * 3)) ** 1.25 * 14 + (h01(x >> 2, 1, seed) - 0.5) * 3 + (nx > 0.3 && nx < 0.55 ? -2 : 0);
    if (y < top || Math.abs(nx) > 1) continue;
    if (Math.abs(nx) < 0.12 && y < top + 4) { b.set(x, y, hex('#141210')); continue; }
    let t = 3 - (y - top) * 0.12 + (nx < 0 ? 0.6 : -0.4);
    if (Math.abs(((y + Math.abs(nx) * 6) % 4)) < 1) t -= 1;
    if (h01(x, y, seed + 3) > 0.9) t += 1;
    const ci = Math.max(0, Math.min(4, Math.round(t)));
    let c = ramp[ci];
    // orange and sulphur stains where the water runs off
    if (Math.abs(Math.sin(nx * 9 + seed)) < 0.15 && y > top + 2) c = h01(x, y, seed) > 0.5 ? hex('#c8742e') : hex('#d8b23a');
    b.set(x, y, c);
  }
  b.outline(INK);
  return { buf: b, ax: W >> 1, ay: H - 1 };
}

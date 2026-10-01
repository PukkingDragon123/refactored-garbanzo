// V9 ember bushes: a waist-high shrub of glossy dark leaves on twiggy stems, hung with clusters of
// shiny red emberberries (separate sprites, so each cluster can be picked and regrow), and the
// jewel hornets' underground nest at its roots: a crumbly mound of dug-out soil with round entrance
// holes, dropped berry skins and chewed pulp. After an ambush the mound is a torn crater. Also the
// little flower clumps the hornets, jewel beetles and lantern moths visit. Sketch-core shading.

import { PixelBuffer } from '../../pixel';
import { Sk, rmp, hh } from '../../beasts-core';
import { hex } from '../../color';
import type { Sprite } from './rocks';

const trim = (sk: Sk, rim = 0.12): Sprite => {
  const b = sk.resolve({ rim, bounce: 0.06 });
  const t = b.trim(1);
  return { buf: t.buf, ax: sk.ox - t.ox, ay: sk.oy - t.oy };
};

export interface EmberBushArt {
  bush: Sprite;
  /** where berry clusters hang (relative to the anchor at the ground, bush centre) */
  spots: [number, number][];
  /** where the nest holes are (relative to the anchor) */
  w: number;
  h: number;
}

/** the shrub without berries; anchor = ground under its centre */
export function emberBush(seed: number, w = 52, h = 40): EmberBushArt {
  const sk = new Sk(w + 14, h + 10, Math.round(w / 2 + 7), h + 4);
  const leaf = sk.m(rmp('#24562a', { n: 5, dark: 0.66, light: 0.36, cool: 0.45 }), { edge: 1 });
  const leafY = sk.m(rmp('#3a7230', { n: 5, dark: 0.6, light: 0.36 }), { edge: 1 });
  const stem = sk.m(rmp('#5a3a24', { n: 4, dark: 0.55, light: 0.35 }), { edge: 1 });
  // twiggy stems fanning up from the base
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.32 + (hh(i, seed, 1) - 0.5) * 0.2;
    const L = h * (0.55 + hh(i, seed, 2) * 0.25);
    sk.np();
    sk.tube([[(i - 3) * 1.2, 0], [Math.cos(a) * L * 0.5, Math.sin(a) * L * 0.5], [Math.cos(a) * L, Math.sin(a) * L]], t => 1.3 - t * 0.9, stem, { z: -2 });
  }
  // leaves: glossy ovals pointing out from the dome centre, lit from the upper left
  const n = Math.round(w * h / 8);
  for (let i = 0; i < n; i++) {
    const u = hh(i, seed, 3), v = hh(i, seed, 4);
    const ang = Math.PI * 0.85 + u * Math.PI * 1.3;
    const rr = Math.sqrt(v);
    const cx = Math.cos(ang) * rr * w * 0.5, cy = -h * 0.46 + Math.sin(ang) * rr * h * 0.5;
    if (cy > -4) continue;
    const out = Math.atan2(cy + h * 0.46, cx) + (hh(i, seed, 5) - 0.5) * 0.9;
    const L = 3.6 + hh(i, seed, 6) * 2.2;
    sk.np();
    const shade = (cy + h) / h; // higher = lighter
    sk.blade(cx, cy, cx + Math.cos(out) * L, cy + Math.sin(out) * L, s => Math.sin(Math.min(1, s * 1.1) * Math.PI) * 1.5 + 0.2, (p) => {
      p.l += (1 - shade) * 0.18 - (cx > w * 0.2 ? 0.06 : 0);
      if (Math.abs(p.v) < 0.18 && p.t > 0.15 && p.t < 0.8) p.l -= 0.08; // midrib
      return hh(i, seed, 7) < 0.25 ? leafY : leaf;
    }, { z0: rr * -3 + 3, z1: rr * -3 + 3.5, curl: 0.6 });
    // the glossy glint
    if (hh(i, seed, 8) < 0.3 && cy < -h * 0.4) sk.over(Math.floor(cx + Math.cos(out) * L * 0.4), Math.floor(cy + Math.sin(out) * L * 0.4) - 1, hex('#c8f0a0', 200));
  }
  const bush = trim(sk);
  const spots: [number, number][] = [];
  for (let i = 0; spots.length < 7 && i < 60; i++) {
    const x = (hh(i, seed, 11) - 0.5) * w * 0.78, y = -h * (0.32 + hh(i, seed, 12) * 0.5);
    const inside = (x / (w * 0.46)) ** 2 + ((y + h * 0.5) / (h * 0.5)) ** 2 < 0.85;
    if (!inside || spots.some(([a, b]) => Math.hypot(a - x, b - y) < 9)) continue;
    spots.push([Math.round(x), Math.round(y)]);
  }
  return { bush, spots, w, h };
}

/** a hanging cluster of 3-5 glossy red berries; anchor = the stalk at the top */
export function berryCluster(v: number): Sprite {
  const sk = new Sk(12, 12, 6, 2);
  const red = sk.m(rmp('#d2202a', { n: 4, dark: 0.55, light: 0.35, warm: 0.2 }), { edge: 1 });
  const ripe = sk.m(rmp('#f04a2a', { n: 4, dark: 0.55, light: 0.35 }), { edge: 1 });
  const stalk = sk.m(rmp('#4a6a24', { n: 3 }), { edge: 0 });
  sk.np();
  sk.line(0, 0, (v % 2 ? 1 : -1) * 0.6, 2, stalk, 0.4, 2, true);
  const pts = [[[-1.4, 3.6], [1.4, 3.4], [0, 5.6]], [[-1.6, 3.2], [1.2, 3.8], [-0.4, 5.8], [2.2, 6]], [[0, 3.2], [-2, 4.6], [2, 4.6], [-0.8, 6.8], [1.2, 6.9]]][v % 3];
  pts.forEach(([x, y], i) => {
    sk.np();
    sk.ell(x, y, 1.35, 1.3, i % 2 ? ripe : red, { z: i, rz: 1.2 });
    sk.over(Math.floor(x - 0.6), Math.floor(y - 0.7), hex('#fff0e0'));
  });
  return trim(sk, 0.1);
}

/** the nest mound at the roots: dug soil, entrance holes, dropped skins. `burst` = after an ambush */
export function nestMound(seed: number, burst = false): { spr: Sprite; holes: [number, number][] } {
  const W = 34, sk = new Sk(W + 12, 18, Math.round(W / 2 + 6), 12);
  const soil = sk.m(rmp('#8a5a32', { n: 5, dark: 0.6, light: 0.4 }), { edge: 1 });
  const dark = sk.m(rmp('#4a2c1a', { n: 4, dark: 0.55, light: 0.3 }), { edge: 1 });
  const hole = sk.m(rmp('#120a08', { n: 2, dark: 0.3, light: 0.2 }), { edge: 0, noRim: true });
  const skin = sk.m(rmp('#7a1a26', { n: 3, dark: 0.5, light: 0.3 }), { edge: 1 });
  const pulp = sk.m(rmp('#e8b8a0', { n: 3, dark: 0.4, light: 0.3 }), { edge: 1, noRim: true });
  const holes: [number, number][] = burst ? [[-2, -2.5], [6, -2]] : [[-7, -2.4], [2, -3.2], [9, -1.8]];
  const fill = (p: { x: number; y: number; l: number }) => {
    for (const [hx2, hy] of holes) {
      const q = ((p.x - hx2) / (burst ? 4.5 : 1.9)) ** 2 + ((p.y - hy) / (burst ? 2.4 : 1.2)) ** 2;
      if (q < 1) return hole;
      if (q < 1.9) { p.l += 0.12; return dark; }
    }
    const n = hh(p.x * 1.4, p.y * 1.4, seed);
    if (n < 0.2) { p.l -= 0.1; return dark; }
    if (n > 0.93) p.l += 0.15; // crumbs catching the light
    return soil;
  };
  const lobes: [number, number, number, number][] = burst
    ? [[-11, -1.5, 6, 2.6], [11, -1.2, 6, 2.2], [0, -0.8, 13, 2]]
    : [[-6, -1.8, 8, 3], [5, -2.2, 9, 3.4], [0, -1, 14, 2.2]];
  for (const [cx, cy, rx, ry] of lobes) { sk.np(); sk.ell(cx, cy, rx, ry, fill, { rz: ry * 0.8, z: 0 }); }
  // clods thrown out by the burst
  if (burst) for (let i = 0; i < 9; i++) { sk.np(); sk.ell((hh(i, seed, 30) - 0.5) * W, -0.5 - hh(i, seed, 31) * 2, 1 + hh(i, seed, 32), 0.8, soil, { z: 1 }); }
  // dropped berry skins and chewed pulp
  for (let i = 0; i < 6; i++) {
    const x = (hh(i, seed, 20) - 0.5) * W * 0.95, y = -0.4 - hh(i, seed, 21) * 1.6;
    sk.np();
    sk.ell(x, y, 0.9 + hh(i, seed, 22) * 0.6, 0.6, i % 3 === 2 ? pulp : skin, { z: 2, rz: 0.4 });
  }
  return { spr: trim(sk, 0.1), holes };
}

/** a little clump of flowers (the hornets, beetles and moths visit these); anchor = ground */
export function flowerClump(seed: number, kind: 'gold' | 'pink' | 'white'): { spr: Sprite; heads: [number, number][] } {
  const sk = new Sk(30, 26, 15, 22);
  const leaf = sk.m(rmp('#3e7a2e', { n: 4, dark: 0.6, light: 0.4 }), { edge: 1 });
  const col = { gold: '#f2b42a', pink: '#e8609a', white: '#f2eee0' }[kind];
  const pet = sk.m(rmp(col, { n: 4, dark: 0.5, light: 0.4 }), { edge: 1 });
  const eye = sk.m(rmp(kind === 'white' ? '#e8b82a' : '#5a2a1a', { n: 3 }), { edge: 0 });
  const heads: [number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const x = (hh(i, seed, 1) - 0.5) * 16, top = -9 - hh(i, seed, 2) * 9;
    sk.np();
    sk.tube([[x * 0.4, 0], [x * 0.8, top * 0.6], [x, top]], 0.45, leaf, { z: 0 });
    sk.np();
    sk.blade(x * 0.5, -2, x * 0.5 + (i % 2 ? 4 : -4), -5 - hh(i, seed, 3) * 3, s => Math.sin(s * Math.PI) * 1.3 + 0.2, leaf, { z0: 1, z1: 1 });
    sk.np();
    for (let q = 0; q < 6; q++) { const a = (q / 6) * Math.PI * 2 + seed; sk.ell(x + Math.cos(a) * 1.5, top + Math.sin(a) * 1.1, 1.05, 0.85, pet, { z: 3, rz: 0.6 }); }
    sk.np();
    sk.ell(x, top, 0.8, 0.7, eye, { z: 4, rz: 0.5 });
    heads.push([Math.round(x), Math.round(top)]);
  }
  return { spr: trim(sk), heads };
}

export type { PixelBuffer };

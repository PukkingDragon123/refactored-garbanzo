// V9 understorey saplings: the young trees that carry the bush track's small twigs (the twinfan's
// perches, the leaf-veil mantis's twig, the zombie-capped hornets, the scraps of Joshu's jacket). A
// thin, slightly crooked stem flares out of a moss tuft on the forest floor, rises to a junction
// where the side twig grows out, and carries on as a leafy leader above it, so no twig ever hangs in
// the air on its own.

import { Sk, rmp } from '../../beasts-core';
import type { V2 } from '../../beasts-core';
import type { PixelBuffer } from '../../pixel';

export interface SaplingSprite {
  buf: PixelBuffer;
  /** anchor: the foot of the stem on the ground */
  ax: number;
  ay: number;
}

const hash = (a: number, b: number) => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** horizontal offset of the junction from the foot (px, local): the stem leans a little */
export function saplingLean(v: number): number {
  return [-2, 1, 2, -1][((v % 4) + 4) % 4];
}

/**
 * A sapling whose side twig joins the stem `h` px above the foot, at x = saplingLean(v). The caller
 * places the foot at (twigRootX - saplingLean(v), ground), with h = ground - twigRootY.
 */
export function paintSapling(v: number, h: number): SaplingSprite {
  h = Math.max(6, Math.round(h));
  const lead = 12 + Math.round(hash(v, 3) * 8);
  const W = 30, oy = h + lead + 11;
  const sk = new Sk(W, oy + 5, 15, oy);
  const bark = sk.m(rmp('#5a4632', { n: 4, dark: 0.5, light: 0.35 }), { edge: 1 });
  const moss = sk.m(rmp('#62762e', { n: 4, dark: 0.5, light: 0.3 }), { edge: 0 });
  const leaf = sk.m(rmp('#4e7a34', { n: 5, dark: 0.55, light: 0.4 }), { edge: 1 });
  const young = sk.m(rmp('#6e9a3a', { n: 4, dark: 0.5, light: 0.4 }), { edge: 1 });
  const jx = saplingLean(v);
  // the stem: from the foot to the junction with a soft crook, then the leader curving the other way
  const bow = (hash(v, 5) - 0.5) * 3;
  const stem: V2[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    stem.push([jx * t + Math.sin(t * Math.PI) * bow, -h * t]);
  }
  const tipX = jx - jx * 0.6 + (hash(v, 7) - 0.5) * 4;
  const leader: V2[] = [];
  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    leader.push([jx + (tipX - jx) * t * t, -h - lead * t]);
  }
  sk.np();
  sk.tube([...stem, ...leader], t => 1.5 - t * 1.0, p => (p.v < -0.35 && p.t < 0.35 && hash(Math.floor(p.y), v) < 0.5 ? moss : bark), { z: 0 });
  // the foot: a flare and a tuft of moss so it grows out of the floor
  sk.np();
  sk.ell(0, -0.5, 3.2, 1.6, moss, { z: 1 });
  sk.np();
  sk.ell(1.5, 0, 2.2, 1.1, moss, { z: 1.5 });
  // leaves: a fan at the top of the leader, and a few singles down the stem
  const top: V2 = [tipX, -h - lead];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.48 + (hash(v, 10 + i) - 0.5) * 0.3;
    const len = 5 + hash(v, 20 + i) * 3;
    sk.np();
    sk.blade(top[0], top[1] + 1, top[0] + Math.cos(a) * len, top[1] + 1 + Math.sin(a) * len, s => Math.sin(Math.min(1, s * 1.1) * Math.PI) * 1.6 + 0.2, i % 3 === 1 ? young : leaf, { z0: 2, z1: 3 });
  }
  const singles = Math.max(1, Math.floor(h / 16));
  for (let i = 0; i < singles + 2; i++) {
    // two on the leader just above the junction, the rest on the stem below it
    const t = i < 2 ? 0.35 + i * 0.3 : 0.25 + (i - 2) * (0.6 / Math.max(1, singles));
    const y = i < 2 ? -h - lead * t : -h * t;
    const x = i < 2 ? jx + (tipX - jx) * t * t : jx * t + Math.sin(t * Math.PI) * bow;
    const side = (i + v) % 2 ? 1 : -1;
    const a = -Math.PI / 2 + side * (0.8 + hash(v, 30 + i) * 0.5);
    const len = 4 + hash(v, 40 + i) * 2;
    sk.np();
    sk.blade(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, s => Math.sin(Math.min(1, s * 1.1) * Math.PI) * 1.3 + 0.2, leaf, { z0: 1, z1: 2 });
  }
  const buf = sk.resolve();
  return { buf, ax: sk.ox, ay: sk.oy };
}

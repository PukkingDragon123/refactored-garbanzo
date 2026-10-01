// V9 shore dressing owned by the wildlife: the Trycop crabs' crevice boulders (a back piece with the
// dark split the crab backs into, and the front lip it disappears behind), and the pale shed claw
// a crab leaves on the rocks after moulting. Painted with the beast sketch core so the rocks share
// the creatures' shading and outline.

import { PixelBuffer } from '../../pixel';
import { Sk, rmp, hh } from '../../beasts-core';
import { hex } from '../../color';

export interface Sprite { buf: PixelBuffer; ax: number; ay: number }

const trim = (sk: Sk, o: { rim?: number } = {}): Sprite => {
  const b = sk.resolve({ rim: o.rim ?? 0.1, bounce: 0.06 });
  const t = b.trim(1);
  return { buf: t.buf, ax: sk.ox - t.ox, ay: sk.oy - t.oy };
};

/**
 * A basalt boulder with a crevice at its foot. `back` is the whole rock with the dark split;
 * `lip` is just the jagged front edge below the split, drawn over the crab. Anchor: ground at the
 * crevice centre.
 */
export function creviceRock(seed: number, w = 64, h = 34): { back: Sprite; lip: Sprite; lipY: number } {
  const lipY = -6;
  const paint = () => {
    const sk = new Sk(w + 16, h + 12, Math.round(w / 2 + 8), h + 6);
    const rock = sk.m(rmp('#5c554e', { n: 5, dark: 0.62, light: 0.42, cool: 0.4 }), { edge: 1 });
    const wet = sk.m(rmp('#3e4a3a', { n: 4, dark: 0.55, light: 0.3 }), { edge: 1 });
    const moss = sk.m(rmp('#5e7a34', { n: 4, dark: 0.5, light: 0.35 }), { edge: 1 });
    const dark = sk.m(rmp('#141214', { n: 3, dark: 0.3, light: 0.25 }), { edge: 0, noRim: true });
    const barn = sk.m(rmp('#d8d0c0', { n: 3, dark: 0.35, light: 0.3 }), { edge: 1 });
    const fill = (p: { x: number; y: number; l: number }) => {
      const n = hh(p.x * 0.7, p.y * 0.7, seed);
      // the split: a dark cleft rising from the ground, widest at the base
      const cw = Math.max(0, 12.5 - (-p.y) * 0.5) * (1 + Math.sin(p.y * 0.7 + seed) * 0.08);
      if (Math.abs(p.x + Math.sin(p.y * 0.4) * 1.2) < cw && p.y < -1 && p.y > -h * 0.66) return dark;
      if (p.y > -4 && n < 0.5) return wet;
      if (p.y < -h * 0.55 && hh(p.x * 0.35, p.y * 0.5, seed + 3) < 0.28) return moss;
      if (n < 0.05) { p.l -= 0.2; return rock; }
      if (n > 0.988) return barn;
      if (Math.sin(p.y * 0.8 + hh(p.x >> 2, 0, seed) * 4) > 0.86) p.l -= 0.08;
      return rock;
    };
    const lobes: [number, number, number, number][] = [[-w * 0.26, -h * 0.4, w * 0.3, h * 0.42], [w * 0.2, -h * 0.36, w * 0.32, h * 0.38], [0, -h * 0.62, w * 0.3, h * 0.36], [-w * 0.1, -h * 0.18, w * 0.46, h * 0.22]];
    for (let i = 0; i < lobes.length; i++) {
      const [cx, cy, rx, ry] = lobes[i];
      sk.np();
      sk.ell(cx + (hh(i, seed, 1) - 0.5) * 3, cy, rx, ry, fill, { z: i * 0.5, rz: Math.min(rx, ry) * 0.9, rot: (hh(i, seed, 2) - 0.5) * 0.4 });
    }
    return trim(sk);
  };
  const back = paint();
  // lip: repaint the bottom rows of the rock (below lipY) with a ragged top edge, no cleft
  const sk = new Sk(w + 16, 16, Math.round(w / 2 + 8), 9);
  const rock = sk.m(rmp('#5c554e', { n: 5, dark: 0.62, light: 0.42, cool: 0.4 }), { edge: 1 });
  const wet = sk.m(rmp('#3e4a3a', { n: 4, dark: 0.55, light: 0.3 }), { edge: 1 });
  for (let x = -15; x <= 15; x += 1) {
    const top = lipY + Math.round(hh(x, seed, 9) * 2.2) - (Math.abs(x) > 11 ? 2 : 0);
    sk.np();
    sk.ell(x, (top + 2) / 2, 1.6, Math.max(1, (2 - top) / 2 + 0.6), (p) => (p.y > -2 ? wet : rock), { z: 3, rz: 1.2 });
  }
  const lip = trim(sk);
  return { back, lip, lipY };
}

/** a Trycop moult: the pale, empty shed crusher claw lying on its side */
export function trycopMoult(): Sprite {
  const sk = new Sk(30, 18, 14, 14);
  const shell = sk.m(rmp('#e8b49a', { n: 5, dark: 0.5, light: 0.5 }), { edge: 1 });
  const spot = sk.m(rmp('#fbf0dc', { n: 3, dark: 0.3, light: 0.4 }), { edge: 1, noRim: true });
  const tip = sk.m(rmp('#6a5458', { n: 4, dark: 0.5, light: 0.4 }), { edge: 1 });
  sk.np();
  sk.ell(-2, -3.2, 6.2, 3.3, (p) => (Math.hypot(p.u + 0.3, p.v) < 0.25 || Math.hypot(p.u - 0.35, p.v + 0.3) < 0.2 ? spot : shell), { rot: -0.1, rz: 2.6 });
  sk.np();
  sk.blade(3.5, -3.6, 10, -5.2, t => (1 - t * 0.7) * 1.4 + 0.3, (p) => (p.t > 0.62 ? tip : shell), { z0: 1, z1: 1, bend: -0.4 });
  sk.np();
  sk.blade(3.8, -2, 10.2, -2.6, t => (1 - t * 0.7) * 1.2 + 0.3, (p) => (p.t > 0.62 ? tip : shell), { z0: 0.6, z1: 0.6, bend: 0.3 });
  sk.np();
  sk.tube([[-8, -2.4], [-11, -1.2]], 1.1, shell, { z: -0.5 });
  const out = trim(sk);
  // translucent: an empty moult is paper thin
  const d = out.buf.data;
  for (let i = 0; i < d.length; i++) if (d[i] >>> 24) d[i] = (d[i] & 0x00ffffff) | (220 << 24);
  void hex;
  return out;
}

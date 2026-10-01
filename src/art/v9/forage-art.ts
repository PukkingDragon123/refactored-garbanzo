// V9 island pickups, painted with the Kittiwake's sticker kit (flat cel shading, dark outline) so they
// sit with the cast and the camp props: half-buried shells, sea glass, kelp, feathers, flint, clay,
// dig spots with breathing holes, shore plants, berry bushes, flowers with jewel beetles, wrack with
// sand hoppers, lantern moths, driftwood, stones, flax, kawakawa, mussels and the odd warm stone.
// Every painter returns a sprite anchored at its foot (ax, ay) and an optional glow layer.

import { obj, T, hex, mix, shade } from '../ship4/kit';
import type { Obj } from '../ship4/kit';
import { PixelBuffer } from '../pixel';

export interface ForageSprite { buf: PixelBuffer; ax: number; ay: number; glow?: PixelBuffer }

const SAND = T('#d8bc8a', { sh: 0.12, deep: 0.26, hi: 0.1 });
const WETS = T('#a8906a', { sh: 0.14, deep: 0.3, hi: 0.1 });
const ROCK = T('#7a7670', { sh: 0.18, deep: 0.36, hi: 0.14 });
const GOLD = T('#e8b450', { sh: 0.16, deep: 0.32, hi: 0.16 });
const PINK = T('#e88a8a', { sh: 0.16, deep: 0.32, hi: 0.16 });
const OPAL = T('#5ac0b8', { sh: 0.18, deep: 0.34, hi: 0.2 });
const KELP = T('#6a5a24', { sh: 0.18, deep: 0.34, hi: 0.12 });
const DRIFT = T('#c4b49a', { sh: 0.16, deep: 0.34, hi: 0.12 });
const LEAF = T('#5a8a3a', { sh: 0.18, deep: 0.34, hi: 0.12 });
const DARKLEAF = T('#3e6a34', { sh: 0.18, deep: 0.34, hi: 0.12 });
const FLAX = T('#6e7e36', { sh: 0.16, deep: 0.32, hi: 0.12 });
const HOLLY = T('#7aa0b0', { sh: 0.16, deep: 0.32, hi: 0.18 });
const CLAY = T('#8a8a88', { sh: 0.14, deep: 0.3, hi: 0.1 });
const FLINT = T('#3a3a44', { sh: 0.16, deep: 0.3, hi: 0.22 });
const MUSSEL = T('#2e3448', { sh: 0.14, deep: 0.28, hi: 0.2 });
const RED = T('#c03a3a', { sh: 0.16, deep: 0.3, hi: 0.14 });

const sp = (buf: PixelBuffer, ax?: number, ay?: number, glow?: PixelBuffer): ForageSprite => ({ buf, ax: ax ?? Math.round(buf.w / 2), ay: ay ?? buf.h - 2, glow });
/** a small sand mound the thing pokes out of */
const mound = (o: Obj, x: number, y: number, w: number, t = SAND) => o.ell(x, y, w, Math.max(1.5, w * 0.32), (nx, ny) => (ny < -0.3 ? t[3] : nx > 0.4 ? t[1] : t[2]));

/** a golden spiral shell half-buried in the sand */
export function sunwhorl(): ForageSprite {
  return sp(obj(12, 8, o => {
    mound(o, 6, 6.5, 5.5);
    o.ell(6, 4, 4, 3.2, (nx, ny) => { const a = Math.atan2(ny, nx), r = Math.hypot(nx, ny); const band = (a + r * 9) % 2.1 < 0.5; return band ? GOLD[0] : -nx * 0.4 - ny * 0.7 > 0.3 ? GOLD[3] : GOLD[2]; });
    o.px(7, 3, hex('#fff4d0'));
    mound(o, 6, 7, 6);
  }));
}
/** a pink ribbed fan on the tide line */
export function fanshell(): ForageSprite {
  return sp(obj(11, 7, o => {
    o.poly([5.5, 6.5, 0.5, 2, 2.5, 0.5, 8.5, 0.5, 10.5, 2], (x, y) => ((x - 5) * 3 + y * 0.2) % 3 < 1 ? PINK[1] : y < 2 ? PINK[3] : PINK[2]);
    o.rect(4, 5, 3, 2, PINK[0]);
  }));
}
/** an ear-shaped shell with a blue-green lining, in a little rock pool */
export function opalEar(): ForageSprite {
  const b = obj(18, 9, o => {
    o.ell(9, 6, 8.5, 3, (nx, ny) => (ny < -0.2 ? ROCK[3] : ROCK[2]));
    o.ell(9, 6, 6, 1.8, () => hex('#4a7a8a'));
    o.ell(9, 4.6, 3.6, 2.4, (nx, ny) => (Math.hypot(nx + 0.2, ny + 0.2) < 0.55 ? (ny < 0 ? OPAL[3] : OPAL[2]) : OPAL[1]));
    o.px(8, 4, hex('#e0fff8'));
  });
  const g = new PixelBuffer(b.w, b.h);
  for (let i = 0; i < b.data.length; i++) { const c = b.data[i]; if (c >>> 24 && (c & 255) < 140 && ((c >>> 8) & 255) > 150) g.data[i] = c; }
  return sp(b, undefined, undefined, g);
}
/** the shed claw of a Trycop crab: round spots and all */
export function trycopMoult(): ForageSprite {
  return sp(obj(20, 11, o => {
    o.ell(8, 7, 7.5, 3.6, (nx, ny) => (Math.hypot(nx * 3 % 1 - 0.5, ny * 2 % 1 - 0.5) < 0.22 ? hex('#f4e0c0') : ny < -0.3 ? hex('#e88a5a') : hex('#c8643a')));
    o.poly([13, 5, 19, 1, 18, 5, 15, 8], hex('#c8643a'));
    o.poly([14, 8, 19, 9, 17, 10], hex('#a84a2a'));
    o.px(17, 2, hex('#ffd8b0'));
  }));
}
/** a frosty pebble of sea glass */
export function seaGlass(): ForageSprite {
  const b = obj(6, 4, o => { o.ell(3, 2.2, 2.8, 1.8, (nx, ny) => (ny < -0.2 ? hex('#c8f0e0') : nx > 0.3 ? hex('#5aa898') : hex('#8ad0bc'))); o.px(2, 1, hex('#ffffff')); });
  return sp(b);
}
/** a leathery ribbon of kelp thrown up on the wrack line */
export function kelpHeap(): ForageSprite {
  return sp(obj(20, 6, o => {
    for (let x = 0; x < 20; x++) { const y = 3 + Math.round(Math.sin(x * 0.7) * 1.2); o.px(x, y, KELP[2]); o.px(x, y + 1, KELP[1]); if (x % 5 === 2) o.px(x, y - 1, KELP[3]); }
    o.ell(6, 4, 2, 1.4, KELP[0]); o.ell(14, 3.5, 1.6, 1.2, KELP[1]);
  }));
}
/** a long flight feather washed up on the sand */
export function feather(): ForageSprite {
  return sp(obj(14, 5, o => {
    o.line(0, 4, 13, 1, hex('#8a8478'));
    for (let x = 2; x < 13; x++) { const y = 4 - x * 3 / 13; o.px(x, Math.round(y) - 1, hex('#f4f0e8')); if (x < 11) o.px(x, Math.round(y) + 1, x % 3 ? hex('#d8d4cc') : hex('#a8a49c')); }
  }));
}
/** a dark flint nodule among the stream gravel */
export function flintStone(): ForageSprite {
  return sp(obj(12, 6, o => {
    for (const [x, y, r] of [[2, 4, 1.4], [9.5, 4.4, 1.2], [6, 4.8, 1]] as const) o.ell(x, y, r * 1.3, r, ROCK[2]);
    o.ell(6, 3, 3.2, 2.3, (nx, ny) => (ny < -0.3 && nx < 0.2 ? FLINT[3] : nx > 0.4 ? FLINT[0] : FLINT[1]));
    o.px(5, 2, hex('#a8b0c8'));
  }));
}
/** a slick grey seam of clay in the stream bank */
export function clayBank(): ForageSprite {
  return sp(obj(16, 7, o => {
    o.ell(8, 5, 7.5, 2.4, (nx, ny) => (ny < -0.3 ? WETS[3] : WETS[2]));
    o.ell(8, 4.4, 5, 1.6, (nx, ny) => (ny < -0.2 ? CLAY[3] : CLAY[2]));
    o.px(6, 4, hex('#c8c8c4')); o.px(10, 5, CLAY[1]);
  }));
}
/** wet sand with breathing holes (something is buried here); dug = a little pit */
export function digSpot(dug = false): ForageSprite {
  return sp(obj(14, 5, o => {
    o.ell(7, 3, 6.5, 1.8, (nx, ny) => (ny < -0.2 ? WETS[3] : WETS[2]));
    if (dug) { o.ell(7, 2.6, 4, 1.4, WETS[0]); o.ell(3, 2, 1.6, 1, SAND[2]); o.ell(11.5, 2.4, 1.6, 1, SAND[2]); }
    else for (const x of [4, 7, 10]) { o.px(x, 2, WETS[0]); o.px(x, 3, shade(WETS[1], -0.1)); }
  }));
}
/** spiky blue-silver sea holly in the dunes */
export function seaHolly(): ForageSprite {
  return sp(obj(16, 14, o => {
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.38, len = 9 + (i % 2) * 3;
      const x1 = 8 + Math.cos(a) * len, y1 = 13 + Math.sin(a) * len;
      o.line(8, 13, x1, y1, i % 2 ? HOLLY[2] : HOLLY[1]);
      o.px(x1 + Math.cos(a + 1.4), y1 + Math.sin(a + 1.4), HOLLY[3]); o.px(x1 + Math.cos(a - 1.4), y1 + Math.sin(a - 1.4), HOLLY[3]);
    }
    o.ell(8, 4, 1.8, 1.8, hex('#8a9ae0'));
  }));
}
/** a salt-crusted fern growing out of the spray-zone rocks */
export function saltFern(): ForageSprite {
  return sp(obj(18, 14, o => {
    o.ell(9, 12, 7, 2, (nx, ny) => (ny < -0.2 ? ROCK[3] : ROCK[2]));
    for (const [a, len] of [[-2.2, 10], [-1.6, 12], [-1.0, 10], [-2.7, 7], [-0.5, 7]] as const) {
      const x1 = 9 + Math.cos(a) * len, y1 = 11 + Math.sin(a) * len;
      o.line(9, 11, x1, y1, LEAF[1]);
      for (let k = 2; k < len; k += 2) { const px = 9 + Math.cos(a) * k, py = 11 + Math.sin(a) * k; o.px(px + 1, py, k % 4 ? LEAF[2] : hex('#f0f4f0')); o.px(px - 1, py, LEAF[3]); }
    }
  }));
}
/** soft moss on the cave wall that glows faint green */
export function glowMoss(): ForageSprite {
  const b = obj(16, 8, o => {
    o.ell(8, 5.5, 7.5, 2.6, (nx, ny) => (ny < -0.2 ? ROCK[2] : ROCK[1]));
    for (let i = 0; i < 18; i++) { const x = 2 + (i * 7) % 12, y = 3 + (i * 5) % 3; o.px(x, y, i % 3 ? hex('#5a8a4a') : hex('#9af0a0')); }
  });
  const g = new PixelBuffer(b.w, b.h);
  for (let i = 0; i < b.data.length; i++) { const c = b.data[i]; if (c >>> 24 && ((c >>> 8) & 255) > 200) g.data[i] = hex('#b0ffb8'); }
  return sp(b, undefined, undefined, g);
}
/** strappy dune lily leaves with a white flower (the bulb is underneath) */
export function duneLily(): ForageSprite {
  return sp(obj(14, 14, o => {
    mound(o, 7, 12.5, 6);
    for (const [x1, y1] of [[1, 5], [4, 2], [10, 3], [13, 6]] as const) o.line(7, 12, x1, y1, FLAX[2]);
    o.line(7, 12, 7, 3, FLAX[1]);
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) o.px(7 + dx, 2 + dy, hex('#fff8f0'));
    o.px(7, 2, hex('#f0d050'));
  }));
}
/** a berry bush (duskberries purple, goldcurrants gold); bare = picked clean */
export function berryBush(kind: 'dusk' | 'gold', bare = false): ForageSprite {
  const B = kind === 'dusk' ? T('#6a3a8a', { sh: 0.16, deep: 0.32, hi: 0.2 }) : T('#f0b830', { sh: 0.16, deep: 0.32, hi: 0.2 });
  return sp(obj(26, 20, o => {
    for (const [x, y, r] of [[8, 13, 7], [17, 12, 7.5], [12.5, 8, 7], [5, 16, 4], [21, 16, 4]] as const) o.ell(x, y, r, r * 0.8, (nx, ny) => (-nx * 0.4 - ny * 0.7 > 0.35 ? DARKLEAF[3] : ny > 0.4 ? DARKLEAF[1] : DARKLEAF[2]));
    o.rect(12, 17, 2, 3, hex('#5a3a22'));
    if (bare) return;
    const pts: [number, number][] = [[6, 11], [9, 14], [14, 9], [17, 13], [20, 10], [11, 6], [16, 6], [7, 16], [19, 16], [13, 12]];
    for (const [x, y] of pts) { o.px(x, y, B[2]); o.px(x + 1, y, B[1]); o.px(x, y + 1, B[1]); o.px(x, y - 1 + 0, kind === 'dusk' ? B[3] : B[3]); }
  }));
}
/** a clump of shore flowers (jewel beetles feed on them) */
export function flowerClump(): ForageSprite {
  return sp(obj(14, 12, o => {
    for (const [x1, y1] of [[3, 3], [7, 1], [11, 4]] as const) o.line(7, 11, x1, y1, LEAF[1]);
    for (const [x, y, c] of [[3, 3, '#f0d040'], [7, 1, '#f8f0e0'], [11, 4, '#e8a0c8']] as const) { o.ell(x, y, 1.8, 1.6, hex(c)); o.px(x, y, hex('#c08020')); }
    o.ell(7, 10.5, 4, 1.3, LEAF[2]);
  }));
}
/** the jewel beetle itself: 2 frames (legs) */
export function jewelBeetle(f: number): ForageSprite {
  return sp(obj(5, 4, o => {
    o.ell(2.5, 2, 2.2, 1.6, (nx, ny) => (ny < -0.2 ? hex('#a0f070') : nx > 0.3 ? hex('#2a8a5a') : hex('#40c070')));
    o.px(2, 1, hex('#f0ffb0'));
    o.px(f ? 0 : 1, 3, hex('#1a2a1a')); o.px(f ? 4 : 3, 3, hex('#1a2a1a'));
  }), 2, 3);
}
/** rotting wrack (sand hoppers live under it) */
export function wrack(): ForageSprite {
  return sp(obj(18, 5, o => {
    o.ell(9, 3, 8.5, 1.8, (nx, ny) => (ny < -0.2 ? KELP[2] : KELP[1]));
    for (let x = 1; x < 17; x += 3) o.px(x, 2, KELP[3]);
    o.px(6, 3, hex('#c8b090')); o.px(12, 2, hex('#e0d8c8'));
  }));
}
/** a sand hopper (one frame) */
export function sandHopper(): ForageSprite {
  return sp(obj(3, 2, o => { o.rect(0, 0, 3, 1, hex('#d8c8a8')); o.px(0, 1, hex('#8a7a5a')); o.px(2, 1, hex('#8a7a5a')); }), 1, 1);
}
/** a pale lantern moth (2 wing frames) with two glowing spots */
export function lanternMoth(f: number): ForageSprite {
  const b = obj(9, 6, o => {
    const up = f === 0;
    o.poly(up ? [4.5, 4, 0, 0, 3, 4] : [4.5, 3, 0, 5, 3, 2], hex('#e8e0c8'));
    o.poly(up ? [4.5, 4, 9, 0, 6, 4] : [4.5, 3, 9, 5, 6, 2], hex('#d8d0b8'));
    o.rect(4, 1, 1, 4, hex('#8a7a5a'));
    o.px(up ? 2 : 2, up ? 2 : 3, hex('#b8ffe8')); o.px(up ? 6 : 6, up ? 2 : 3, hex('#b8ffe8'));
  });
  const g = new PixelBuffer(b.w, b.h);
  for (let i = 0; i < b.data.length; i++) { const c = b.data[i]; if (c >>> 24 && (c & 255) < 200 && ((c >>> 8) & 255) > 240) g.data[i] = hex('#c0fff0'); }
  return sp(b, 4, 3, g);
}
/** a bleached driftwood branch */
export function driftwood(seed = 0): ForageSprite {
  return sp(obj(22, 6, o => {
    const tilt = (seed % 3) - 1;
    for (let x = 0; x < 22; x++) { const y = 3 + Math.round((x - 11) * tilt * 0.08); o.px(x, y, DRIFT[2]); o.px(x, y + 1, DRIFT[1]); if (x % 6 === 1) o.px(x, y - 1, DRIFT[3]); }
    o.line(14, 3, 18, 0, DRIFT[2]);
    o.ell(2, 3.5, 1.6, 1.6, DRIFT[0]);
  }));
}
/** two smooth beach stones */
export function stones(): ForageSprite {
  return sp(obj(12, 6, o => { o.ell(4, 3.5, 3.6, 2.4, (nx, ny) => (ny < -0.3 ? ROCK[3] : ROCK[2])); o.ell(9, 4, 2.6, 1.8, (nx, ny) => (ny < -0.3 ? shade(ROCK[3], 0.1) : ROCK[1])); }));
}
/** a clump of harakeke (flax) */
export function flaxClump(): ForageSprite {
  return sp(obj(22, 24, o => {
    for (const [x1, y1] of [[1, 6], [4, 1], [9, 0], [13, 2], [18, 3], [21, 9], [7, 4], [16, 7]] as const) { o.line(11, 23, x1, y1, FLAX[2]); o.line(12, 23, x1 + 1, y1 + 1, FLAX[1]); }
    o.line(11, 23, 11, 2, FLAX[3]);
  }));
}
/** a kawakawa shrub: heart-shaped leaves full of holes */
export function kawakawaShrub(): ForageSprite {
  return sp(obj(18, 16, o => {
    o.rect(8, 10, 2, 6, hex('#5a4a2a'));
    for (const [x, y] of [[4, 8], [9, 4], [14, 8], [6, 12], [12, 12], [9, 9]] as const) {
      o.ell(x, y, 3.2, 2.6, (nx, ny) => (ny < -0.3 ? LEAF[3] : LEAF[2]));
      o.px(x, y, hex('#2a3a1a'));
    }
  }));
}
/** a cluster of mussels on a rock */
export function musselRock(): ForageSprite {
  return sp(obj(16, 9, o => {
    o.ell(8, 6, 7.5, 3.2, (nx, ny) => (ny < -0.3 ? ROCK[3] : ROCK[2]));
    for (const [x, y] of [[4, 4], [7, 3], [10, 4], [12, 6], [6, 6]] as const) { o.ell(x, y, 1.6, 1.1, (nx, ny) => (ny < -0.2 ? MUSSEL[3] : MUSSEL[1])); o.px(x + 1, y, hex('#6a9a5a')); }
  }));
}
/** a stone that is warm, and glows: Aroha will have a name for it */
export function warmStone(): ForageSprite {
  const b = obj(8, 6, o => {
    o.ell(4, 3.4, 3.6, 2.5, (nx, ny) => (Math.hypot(nx - 0.1, ny + 0.1) < 0.45 ? hex('#ffb060') : ny < -0.2 ? RED[2] : RED[1]));
    o.px(3, 2, hex('#fff0b0'));
  });
  const g = new PixelBuffer(b.w, b.h);
  for (let i = 0; i < b.data.length; i++) { const c = b.data[i]; if (c >>> 24 && (c & 255) > 220) g.data[i] = hex('#ffd080'); }
  return sp(b, undefined, undefined, g);
}
/** the bug net, drawn at Mori's hand while he swings it */
export function bugNet(): ForageSprite {
  return sp(obj(8, 22, o => {
    o.line(4, 21, 4, 8, hex('#8a6a3a'));
    o.ell(4, 4, 3.6, 3.6, (nx, ny) => (Math.hypot(nx, ny) > 0.75 ? hex('#a0a8b0') : (Math.floor((nx + 2) * 4) + Math.floor((ny + 2) * 4)) % 2 ? hex('#e8ecf0') : -1));
  }), 4, 21);
}
/** a glass specimen jar */
export function specimenJar(): ForageSprite {
  return sp(obj(6, 8, o => { o.rect(0, 2, 6, 6, hex('#a8d0e0')); o.rect(1, 3, 1, 4, hex('#e8f8ff')); o.rect(0, 0, 6, 2, hex('#b0b0b8')); }), 3, 7);
}

export { mix };

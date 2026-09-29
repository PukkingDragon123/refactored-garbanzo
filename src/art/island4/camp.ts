// V4 island camp and story props, painted with the Kittiwake's sticker kit (flat cel shading, dark
// outline) so they sit with the anime cast: the blue dome tent, Aroha's flax lean-to, the fire pit,
// Joshu's cooking bench, the drying rack, Mori's research table and specimen shelf, the tarp-covered
// storage, Jenna's electronics corner, Chunk's bed, log benches, the woodpile, a lantern, the spilled
// crate of Chunky Chow in the wreck and Joshu's boots.

import { obj, P, T, hex, mix, shade } from '../ship4/kit';
import type { PixelBuffer } from '../pixel';

const BLUE = T('#3a6ab0', { sh: 0.16, deep: 0.32, hi: 0.12 });
const ORANGE = T('#e0782e', { sh: 0.16, deep: 0.32, hi: 0.1 });
const DRIFT = T('#a89478', { sh: 0.16, deep: 0.34, hi: 0.12 });
const FLAX = T('#7a8a3a', { sh: 0.16, deep: 0.32, hi: 0.12 });
const STONE = T('#8a8480', { sh: 0.18, deep: 0.36, hi: 0.14 });
const TARP = T('#4a7a5a', { sh: 0.16, deep: 0.3, hi: 0.1 });
const FISH = T('#b8c4c8', { sh: 0.16, deep: 0.3, hi: 0.2 });

export interface CampSprite { buf: PixelBuffer; ax: number; ay: number; glow?: PixelBuffer }
/** a little paw print stencil (4 toes and a pad) */
function paw(o: { px(x: number, y: number, c: number): void }, x: number, y: number, c: number) {
  for (const [dx, dy] of [[0, 0], [2, -1], [4, -1], [6, 0]]) { o.px(x + dx, y + dy, c); o.px(x + dx + 1, y + dy, c); }
  for (let j = 0; j < 3; j++) for (let i = 1; i < 7; i++) if (!(j === 2 && (i === 1 || i === 6))) o.px(x + i, y + 2 + j, c);
}
const anchor = (buf: PixelBuffer, ax?: number): CampSprite => ({ buf, ax: ax ?? Math.round(buf.w / 2), ay: buf.h - 2 });

/** blue dome tent (Jenna and Joshu's, from the Kittiwake's hold) */
export function domeTent(open = true): CampSprite {
  return anchor(obj(76, 42, o => {
    o.ell(38, 42, 36, 38, (nx, ny) => {
      if (ny > 0) return -1;
      const seam = Math.abs(nx) < 0.04 || Math.abs(Math.abs(nx) - 0.5) < 0.03;
      const l = -nx * 0.5 - ny * 0.6;
      return seam ? BLUE[1] : l > 0.55 ? BLUE[3] : l > 0 ? BLUE[2] : BLUE[1];
    });
    // fly sheet stripe and the door
    o.rect(4, 30, 68, 3, ORANGE[2]);
    if (open) o.poly([30, 41, 38, 16, 46, 41], (x, y) => (y > 36 ? P.dark[0] : P.dark[1]));
    else o.line(38, 16, 38, 41, BLUE[0]);
    // guy lines and pegs
    o.line(2, 41, 10, 22, P.rope[2]); o.line(73, 41, 66, 22, P.rope[2]);
  }));
}

/** Aroha's lean-to: a flax-thatched roof on driftwood poles */
export function leanTo(): CampSprite {
  return anchor(obj(62, 38, o => {
    o.line(8, 37, 8, 8, DRIFT[1]); o.line(9, 37, 9, 8, DRIFT[2]);
    o.line(54, 37, 54, 20, DRIFT[1]); o.line(55, 37, 55, 20, DRIFT[2]);
    o.poly([2, 10, 60, 18, 60, 24, 2, 14], (x, y) => ((x + y * 3) % 7 < 2 ? FLAX[1] : (x % 5 === 0 ? FLAX[3] : FLAX[2])));
    // woven flax mat and a kete (basket) underneath
    o.rect(12, 34, 38, 3, (x, y) => ((x + y) % 3 ? FLAX[2] : FLAX[1]));
    o.ell(46, 31, 5, 4, (nx, ny) => ((Math.floor((nx + 1) * 6) + Math.floor((ny + 1) * 4)) % 2 ? FLAX[1] : FLAX[3]));
  }));
}

/** ring of stones with a stack of wood (the flames are drawn live) */
export function firePit(lit: boolean): CampSprite {
  return anchor(obj(34, 14, o => {
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI; o.ball(17 + Math.cos(a) * 14, 11 - Math.sin(a) * 2.5 + (i % 2), 3, 2.4, STONE); }
    o.ell(17, 10, 10, 2.4, lit ? hex('#3a1e12') : hex('#4a3a30'));
    o.line(9, 10, 24, 5, DRIFT[1]); o.line(10, 11, 25, 6, DRIFT[2]);
    o.line(25, 10, 11, 4, DRIFT[1]); o.line(24, 11, 10, 5, DRIFT[2]);
    if (lit) for (const [x, y] of [[14, 9], [17, 8], [20, 9], [16, 10]] as const) o.px(x, y, hex('#ff9a3a'));
    for (let k = 0; k < 7; k++) o.ball(4 + k * 4, 13, 2, 1.4, STONE);
  }));
}

/** Joshu's cooking bench: driftwood table, pot, pan, chopping board with a fish, the cooler */
export function cookBench(): CampSprite {
  return anchor(obj(70, 34, o => {
    o.box(4, 14, 44, 4, DRIFT);
    o.rect(7, 18, 3, 15, DRIFT[1]); o.rect(42, 18, 3, 15, DRIFT[1]);
    o.box(10, 10, 16, 4, P.plank);
    o.ell(18, 10, 5, 1.6, FISH[2]); o.px(22, 10, P.dark[0]);
    o.ball(34, 9, 7, 5, P.steel); o.rect(27, 4, 14, 2, P.steel[3]); o.hline(29, 39, 3, P.dark[2]);
    o.box(50, 18, 18, 15, T('#e8e2d4', { sh: 0.14, deep: 0.3 })); o.rect(50, 18, 18, 3, hex('#3a78c0'));
    o.rect(0, 12, 4, 2, P.steel[2]);
  }));
}

/** drying rack: driftwood A-frames, a crossbar, flax strips and fish hung to dry */
export function dryingRack(): CampSprite {
  return anchor(obj(60, 40, o => {
    for (const x of [6, 54]) { o.line(x - 5, 39, x, 4, DRIFT[1]); o.line(x + 5, 39, x, 4, DRIFT[2]); }
    o.hline(4, 56, 5, DRIFT[3]); o.hline(4, 56, 6, DRIFT[1]);
    for (let i = 0; i < 6; i++) {
      const x = 12 + i * 7;
      if (i % 2) { o.line(x, 7, x, 18, P.rope[1]); o.ell(x, 23, 2.6, 6, (nx, ny) => (nx < -0.2 ? FISH[3] : FISH[2])); o.px(x, 28, FISH[0]); }
      else for (let k = 0; k < 3; k++) o.vline(x - 1 + k, 7, 22 + k * 3, k === 1 ? FLAX[3] : FLAX[2]);
    }
  }));
}

/** research table: plank on two crates, microscope, laptop (screen glows), specimen jars, lamp */
export function researchTable(): CampSprite {
  const buf = obj(66, 36, o => {
    o.box(2, 16, 62, 4, P.plank);
    o.box(4, 20, 16, 15, P.plank); o.box(46, 20, 16, 15, P.plank);
    o.hline(6, 18, 27, P.plankD[1]); o.hline(48, 60, 27, P.plankD[1]);
    // microscope
    o.rect(8, 13, 9, 3, P.dark[2]); o.rect(11, 5, 3, 8, P.dark[1]); o.rect(10, 3, 5, 3, P.dark[3]); o.px(14, 10, P.steel[3]);
    // laptop, lid up
    o.poly([22, 16, 40, 16, 38, 14, 24, 14], P.steel[2]);
    o.poly([24, 14, 38, 14, 40, 3, 26, 3], P.steel[1]);
    o.poly([26, 12, 37, 12, 38, 5, 27, 5], hex('#9ad0f0'));
    // specimen jars and a notebook
    for (const [x, c] of [[44, '#6ab8a0'], [49, '#e8b840'], [54, '#c86a8a']] as const) { o.box(x, 9, 4, 7, T('#cfe4ec', { sh: 0.1, deep: 0.3 })); o.rect(x, 12, 4, 3, hex(c)); o.rect(x, 8, 4, 1, P.dark[2]); }
    o.box(58, 13, 6, 3, T('#5a8a4a', { sh: 0.14, deep: 0.3 }));
  });
  const glow = obj(66, 36, o => { o.poly([26, 12, 37, 12, 38, 5, 27, 5], hex('#bfe8ff')); }, false);
  return { ...anchor(buf), glow };
}

/** salvage stacked under a tied-down tarp */
export function storage(): CampSprite {
  return anchor(obj(62, 36, o => {
    o.box(2, 16, 24, 19, P.plank); o.box(26, 22, 20, 13, P.plankD); o.box(8, 4, 16, 12, P.plank);
    o.ell(52, 26, 8, 9, (nx, ny) => (nx < -0.3 ? hex('#4a8ac8') : ny > 0.6 ? hex('#1e4a7a') : hex('#3a6aa8')));
    o.hline(44, 60, 22, hex('#1e3a5a')); o.hline(44, 60, 30, hex('#1e3a5a'));
    // tarp over the top
    o.poly([0, 16, 12, 2, 30, 4, 46, 20, 46, 24, 26, 18, 0, 20], (x, y) => ((x + y) % 9 === 0 ? TARP[1] : y < 8 ? TARP[3] : TARP[2]));
    o.line(0, 19, 0, 35, P.rope[1]); o.line(46, 23, 48, 35, P.rope[1]);
  }));
}

/** Chunk's bed: an open crate lined with the orange blanket, his name painted on, a bowl */
export function chunkBed(): CampSprite {
  return anchor(obj(40, 18, o => {
    o.box(2, 5, 28, 12, P.plank);
    o.rect(4, 3, 24, 4, (x, y) => ((x + y) % 4 === 0 ? ORANGE[1] : ORANGE[2]));
    paw(o, 12, 10, hex('#f4f0e0'));
    o.ell(35, 15, 4, 2, P.red[2]); o.px(35, 14, hex('#8a5a2a'));
  }));
}

/** Jenna's corner: battery bank, a solar panel on a crate, the radio and a coil of cable */
export function electronics(): CampSprite {
  const buf = obj(54, 34, o => {
    o.box(2, 22, 20, 11, P.dark); o.rect(4, 20, 4, 2, P.red[2]); o.rect(15, 20, 4, 2, P.dark[3]);
    o.box(26, 22, 24, 11, P.plank);
    o.poly([24, 22, 52, 22, 48, 6, 28, 6], (x, y) => ((x % 5 === 0 || y % 4 === 0) ? hex('#6a8ab8') : hex('#1e2e5a')));
    o.box(8, 12, 12, 8, T('#4a5a40', { sh: 0.14, deep: 0.3 })); o.vline(18, 2, 12, P.steel[3]); o.px(10, 14, hex('#e8b840')); o.px(12, 14, hex('#6ae080'));
    o.ell(46, 31, 6, 2, P.dark[1]); o.ell(46, 31, 3, 1, P.dark[3]);
  });
  const glow = obj(54, 34, o => { o.px(10, 14, hex('#ffd060')); o.px(12, 14, hex('#80ff90')); }, false);
  return { ...anchor(buf), glow };
}

export function logBench(len = 46): CampSprite {
  return anchor(obj(len, 10, o => {
    o.rect(0, 2, len, 7, (x, y) => (y === 0 ? DRIFT[3] : y > 5 ? DRIFT[0] : (x + y * 3) % 11 === 0 ? DRIFT[1] : DRIFT[2]));
    o.ell(1, 5, 1.6, 3.4, DRIFT[3]); o.ell(len - 2, 5, 1.6, 3.4, DRIFT[1]);
  }));
}

/** firewood pile, 0..3 armfuls */
export function woodPile(n: number): CampSprite {
  return anchor(obj(36, 17, o => {
    const logs = Math.max(1, n * 2 + 1);
    for (let i = 0; i < logs; i++) {
      const row = i < 3 ? 0 : i < 5 ? 1 : 2, col = i < 3 ? i : i < 5 ? i - 3 : 0;
      const y = 12 - row * 4, x = 2 + col * 11 + row * 5;
      o.rect(x, y, 10, 4, (xx, yy) => (yy === 0 ? DRIFT[3] : yy === 3 ? DRIFT[0] : DRIFT[2]));
      o.ell(x + 10, y + 2, 1.8, 2, (nx) => (nx < 0 ? DRIFT[3] : hex('#c8b490')));
      o.px(x + 10, y + 2, DRIFT[1]);
    }
  }));
}

export function lantern(): CampSprite {
  const buf = obj(8, 12, o => { o.rect(2, 0, 4, 2, P.dark[2]); o.box(1, 2, 6, 8, T('#e8d890', { sh: 0.1, deep: 0.3, hi: 0.1 })); o.rect(1, 10, 6, 2, P.dark[2]); });
  const glow = obj(8, 12, o => o.rect(2, 3, 4, 6, hex('#ffe8a0')), false);
  return { ...anchor(buf), glow };
}

/** a driftwood pole for the string lights */
export function pole(h = 50): CampSprite {
  return anchor(obj(4, h, o => { o.rect(1, 0, 2, h, (x, y) => (x ? DRIFT[1] : DRIFT[3])); o.px(0, 2, DRIFT[2]); o.px(3, 2, DRIFT[2]); }));
}

/** the burst crate of Chunky Chow in the hold, cans everywhere */
export function chunkyChow(): CampSprite {
  return anchor(obj(52, 26, o => {
    o.box(4, 8, 28, 17, P.plank);
    o.poly([4, 8, 18, 0, 32, 6, 32, 8], P.plank[3]);
    paw(o, 11, 13, hex('#f4e8c8')); paw(o, 20, 16, hex('#f4e8c8'));
    const can = (x: number, y: number, lying: boolean) => {
      if (lying) { o.box(x, y, 8, 5, T('#e0a830', { sh: 0.16, deep: 0.32, hi: 0.14 })); o.rect(x, y, 1, 5, P.steel[3]); o.rect(x + 7, y, 1, 5, P.steel[2]); o.px(x + 3, y + 2, hex('#6a3a1a')); }
      else { o.box(x, y, 5, 7, T('#e0a830', { sh: 0.16, deep: 0.32, hi: 0.14 })); o.rect(x, y, 5, 1, P.steel[3]); o.px(x + 2, y + 3, hex('#6a3a1a')); }
    };
    can(34, 19, true); can(44, 18, false); can(0, 20, false); can(38, 13, false);
    // the open one, licked clean
    o.box(26, 20, 6, 5, T('#e0a830', { sh: 0.16, deep: 0.32 })); o.ell(29, 20, 3, 1, hex('#5a3a22'));
  }));
}

/** Mori's orange sleeping bag rolled out on a mat by the fire */
export function bedroll(): CampSprite {
  return anchor(obj(40, 9, o => {
    o.rect(0, 5, 40, 3, (x) => (x % 4 === 0 ? P.olive[1] : P.olive[2]));
    o.rect(3, 1, 34, 6, (x, y) => (y === 0 ? ORANGE[3] : x % 6 === 0 ? ORANGE[1] : y > 3 ? ORANGE[1] : ORANGE[2]));
    o.ell(6, 3, 4, 3, (nx, ny) => (ny < -0.2 ? hex('#f4f0e0') : hex('#d8d0c0')));
  }));
}

/** Joshu's boots, laces knotted together */
export function boots(): CampSprite {
  return anchor(obj(24, 12, o => {
    for (const x of [2, 12]) { o.box(x, 2, 7, 8, T('#4a3424', { sh: 0.16, deep: 0.32, hi: 0.1 })); o.rect(x, 9, 10, 2, P.dark[1]); o.rect(x + 1, 0, 5, 2, T('#6a4a34', {})[2]); }
    o.line(5, 1, 15, 1, P.rope[3]); o.line(9, 1, 11, 5, P.rope[2]);
  }));
}

/** a strip of Joshu's navy jacket snagged on a twig */
export function jacketScrap(): CampSprite {
  return anchor(obj(16, 18, o => {
    o.line(0, 4, 15, 8, P.plankD[2]); o.line(8, 6, 12, 0, P.plankD[2]);
    o.poly([6, 6, 11, 7, 10, 16, 7, 14], P.navy[2]); o.vline(8, 8, 13, P.navy[3]);
  }));
}

export { mix, shade };

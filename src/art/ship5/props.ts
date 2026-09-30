// Detailed Day 1 props for the small Kittiwake (ship5): the things the story points at (Jenna's
// screens, the fridge, Chunk's bed and bowls, the chess game, the research tank, the microscope,
// the photo boards, Joshu's model ship) and the deck furniture. Each returns an ink-outlined
// sprite (1px pad) sized to the same footprint as the plain V4 prop it replaces, so the spots the
// story uses still line up. Palettes are the boat's hue-shifted ramps.

import { PixelBuffer } from '../pixel';
import { C, hex } from '../color';
import { hash2 } from '../../core/math';
import { Obj, obj } from '../ship4/kit';
import { P as K, ramp, dith, pixelText } from '../boatKit';

export interface Sp { buf: PixelBuffer; glow?: PixelBuffer }
const rq = (r: C[], f: number, x = 0, y = 0, k = 0.5) => ramp(r, f + dith(x, y, k));

/** glow buffer the same size as an object buffer (with its outline pad) */
function glowOf(w: number, h: number, draw: (o: Obj) => void): PixelBuffer {
  const g = new Obj(w + 2, h + 2);
  const inner = new Obj(w, h);
  draw(inner);
  g.put(inner.b, 1, 1);
  return g.b;
}

// ------------------------------------------------------------------ engine room: Jenna's desk

/** Open laptop, keyboard toward the viewer, a terminal on the screen and a sticker on the bezel. */
export function laptop(screen: 'term' | 'graph' | 'birds' = 'term'): Sp {
  const w = 15, h = 10;
  const content = (o: Obj, glow: boolean) => {
    o.rect(3, 1, 10, 6, (x, y) => {
      if (screen === 'term') return y % 2 === 0 && x < 2 + ((y * 7 + 3) % 8) ? (glow ? hex('#9af0b8') : K.green[5]) : glow ? hex('#1c4a38') : K.green[1];
      if (screen === 'graph') { const gy = 4 - Math.round(Math.sin(x * 0.9) * 1.5 + x * 0.15); return y === gy ? (glow ? hex('#ffd070') : K.yellow[5]) : y === 5 ? (glow ? hex('#5a7a90') : K.glass[3]) : glow ? hex('#182838') : K.navy[1]; }
      return y > 3 ? (glow ? hex('#4a8ab0') : K.glass[3]) : (x + y) % 5 === 0 ? (glow ? hex('#ffffff') : K.white[4]) : glow ? hex('#8ac0e0') : K.glass[4];
    });
  };
  const buf = obj(w, h, o => {
    // lid / screen, tilted back a touch
    o.poly([2, 8, 2, 0, 14, 0, 14, 8], (x, y) => (x === 2 || y === 0 ? K.metal[5] : x === 13 ? K.metal[2] : K.metal[3]));
    content(o, false);
    o.px(12, 6, K.red[4]); // sticker
    // base with a row of keys and the trackpad
    o.rect(0, 8, 15, 2, (x, y) => (y === 0 ? (x % 2 ? K.metal[4] : K.metal[6]) : x === 0 ? K.metal[5] : K.metal[3]));
    o.px(7, 9, K.metal[2]);
  });
  const glow = glowOf(w, h, o => content(o, true));
  return { buf, glow };
}

/** A flat-panel monitor on a stand (or a wall arm), with code on it. */
export function monitor(w = 13, h = 9, arm = false): Sp {
  const draw = (o: Obj, glow: boolean) => o.rect(1, 1, w - 2, h - 2, (x, y) => {
    if (y % 2 === 1 && x > 0 && x < 1 + ((x * 3 + y * 5) % 7)) return glow ? (y % 4 === 1 ? hex('#ff9ad0') : hex('#8af0ff')) : y % 4 === 1 ? K.plum[4] : K.glass[4];
    return glow ? hex('#15303c') : K.navy[1];
  });
  const buf = obj(w, h + 4, o => {
    o.rect(0, 0, w, h, (x, y) => (x === 0 || y === 0 ? K.metal[3] : x === w - 1 || y === h - 1 ? K.metal[0] : K.metal[1]));
    draw(o, false);
    if (arm) { o.rect(Math.floor(w / 2) - 1, h, 3, 2, K.metal[3]); o.hline(Math.floor(w / 2), w + 1, h + 2, K.metal[4]); }
    else { o.rect(Math.floor(w / 2) - 1, h, 3, 3, (x) => (x === 0 ? K.metal[4] : K.metal[2])); o.hline(Math.floor(w / 2) - 3, Math.floor(w / 2) + 3, h + 3, K.metal[3]); }
    o.px(w - 2, h - 1, K.green[5]);
  });
  const glow = glowOf(w, h + 4, o => { draw(o, true); o.px(w - 2, h - 1, hex('#80ff9a')); });
  return { buf, glow };
}

/** Workshop stool: round wooden seat, splayed legs, a foot ring. */
export function stool(): PixelBuffer {
  return obj(12, 14, o => {
    o.ell(6, 1.5, 6, 1.8, (nx, ny) => (ny < -0.1 ? K.wood[6] : ny < 0.5 ? K.wood[4] : K.wood[2]));
    o.rect(0, 2, 12, 1, K.wood[2]);
    o.line(2, 3, 0, 13, K.wood[3]); o.line(9, 3, 11, 13, K.wood[2]); o.line(5, 3, 5, 13, K.wood[4]); o.line(6, 3, 6, 13, K.wood[2]);
    o.hline(1, 10, 9, K.metal[5]); o.hline(1, 10, 10, K.metal[2]);
  });
}

// ------------------------------------------------------------------ galley & mess

/** Old round-shouldered fridge: chrome handles, freezer line, magnets, a drawing, a list, a jar on top. */
export function fridge(): PixelBuffer {
  const w = 18, h = 38;
  return obj(w, h, o => {
    o.rect(0, 0, w, h, (x, y) => {
      if ((x === 0 || x === w - 1) && y === 0) return -1;
      if (y === h - 1) return K.metal[1];
      if (y >= h - 3) return K.metal[2];
      let f = 3.4 - x * 0.06;
      if (x === 0 || y === 0) f = 4.4;
      if (x === w - 1) f = 1.6;
      if (y === 1 && x > 0 && x < w - 1) f = 4;
      if (y === 12) f = 1.2;
      if (y === 13) f = 4.2;
      return rq(K.white, f, x, y, 0.35);
    });
    // chrome handles
    for (const [y0, y1] of [[3, 9], [16, 25]]) { o.vline(14, y0, y1, K.metal[7]); o.vline(15, y0, y1, K.metal[4]); o.px(14, y0 - 1, K.metal[5]); o.px(14, y1 + 1, K.metal[5]); }
    // maker's badge
    o.hline(3, 7, 10, K.metal[6]);
    // a child's drawing of a fish, a shopping list, magnets
    o.rect(2, 17, 7, 6, (x, y) => (x === 0 || y === 0 ? K.paper[5] : K.paper[4]));
    o.ell(5, 20, 2.2, 1.2, K.orange[4]); o.px(8, 19, K.orange[3]); o.px(8, 21, K.orange[3]); o.px(4, 20, K.metal[0]);
    o.px(5, 16, K.red[4]);
    o.rect(3, 26, 5, 7, (x, y) => (y % 2 === 1 && x > 0 ? K.navy[3] : K.paper[5]));
    o.px(5, 25, K.yellow[5]);
    o.px(10, 20, K.quiltB[4]); o.px(11, 29, K.green[5]); o.px(10, 5, K.red[4]); o.px(4, 6, K.yellow[5]);
    // kick plate vent
    for (let x = 3; x < 15; x += 2) o.px(x, h - 2, K.metal[0]);
  });
}

/** Chunk's bowls on a little mat: food and water, "CHUNK" in glitter paint. */
export function dogBowls(): PixelBuffer {
  return obj(13, 5, o => {
    o.hline(0, 12, 4, K.quiltR[2]);
    for (const [x, food] of [[0, true], [7, false]] as const) {
      o.rect(x, 1, 6, 3, (i, j) => (j === 0 ? K.metal[7] : i === 5 ? K.metal[2] : j === 2 ? K.metal[3] : K.metal[5]));
      o.hline(x + 1, x + 4, 0, food ? K.wood[4] : K.glass[4]);
      if (food) o.px(x + 2, 0, K.wood[6]);
      o.px(x + 1, 2, K.yellow[6]); o.px(x + 3, 2, K.plum[4]); // glitter
    }
  });
}

/** Tabletop chessboard mid-game (day nineteen): the board seen edge-on, pieces standing on it. */
export function chessBoard(): PixelBuffer {
  return obj(18, 7, o => {
    o.rect(0, 5, 18, 2, (x, y) => (y === 0 ? ((x >> 1) % 2 ? K.cream[5] : K.wood[2]) : K.wood[1]));
    const W1 = K.cream[6], W0 = K.cream[3], B1 = K.metal[3], B0 = K.metal[0];
    const pawn = (x: number, w: boolean) => { o.px(x, 3, w ? W1 : B1); o.px(x, 4, w ? W0 : B0); };
    const rook = (x: number, w: boolean) => { o.hline(x, x + 1, 1, w ? W1 : B1); o.rect(x, 2, 2, 3, w ? W0 : B0); o.px(x, 2, w ? W1 : B1); };
    const knight = (x: number, w: boolean) => { o.px(x, 1, w ? W1 : B1); o.px(x + 1, 1, w ? W1 : B1); o.px(x, 2, w ? W0 : B0); o.rect(x, 3, 2, 2, w ? W0 : B0); o.px(x + 1, 2, w ? W1 : B1); };
    const king = (x: number, w: boolean) => { o.px(x, 0, w ? W1 : B1); o.rect(x - 1, 1, 3, 1, w ? W1 : B1); o.rect(x, 2, 1, 3, w ? W0 : B0); o.px(x - 1, 4, w ? W0 : B0); o.px(x + 1, 4, w ? W0 : B0); };
    pawn(1, true); rook(3, true); king(7, true); pawn(9, true);
    knight(11, false); pawn(13, false); king(15, false); pawn(17, false);
    // the captured, "emotionally compromised" knight lying beside the board
  });
}

/** The board-games shelf: stacked boxes (the lighthouse puzzle, Scrabble, the forbidden Monopoly), dice. */
export function gamesShelf(): PixelBuffer {
  return obj(16, 13, o => {
    o.rect(0, 11, 16, 2, (x, y) => (y === 0 ? K.wood[6] : K.wood[2]));
    const box = (x: number, y: number, w: number, h: number, c: C[], lid: C) => {
      o.rect(x, y, w, h, (i, j) => (j === 0 ? lid : i === 0 ? c[4] : i === w - 1 ? c[1] : c[3]));
      o.hline(x + 1, x + w - 2, y + Math.floor(h / 2), c[2]);
    };
    box(0, 7, 9, 4, K.red, K.white[4]);
    box(0, 3, 8, 4, K.navy, K.quiltB[4]);
    box(1, 0, 6, 3, K.green, K.mustard[5]);
    // the lighthouse puzzle standing up
    o.rect(10, 1, 4, 10, (i, j) => (i === 0 ? K.quiltB[4] : j === 4 ? K.red[4] : j > 6 ? K.green[3] : K.quiltB[3]));
    o.px(11, 3, K.white[4]);
    // dice
    o.rect(14, 8, 2, 3, K.white[4]); o.px(14, 9, K.metal[0]);
  });
}

// ------------------------------------------------------------------ bunk room

/** Chunk's bed: a round bolster in red tartan, a sheepskin cushion, his name tag and a rope toy. */
export function dogBed(): PixelBuffer {
  return obj(26, 10, o => {
    o.ell(13, 6, 13, 4.5, (nx, ny) => {
      const r = Math.hypot(nx, ny);
      if (r > 0.7) {
        const tart = (Math.floor((nx + 1) * 12) % 3 === 0) || (Math.floor((ny + 1) * 5) % 2 === 0 && r > 0.85);
        return ny < 0 ? (tart ? K.quiltR[4] : K.quiltR[3]) : tart ? K.quiltR[2] : K.quiltR[1];
      }
      return ny < 0.2 ? K.cream[5] : K.cream[4];
    });
    o.ell(13, 5, 8.4, 2.2, (nx, ny) => (ny < 0 ? K.cream[6] : K.cream[4]));
    // name tag
    o.rect(9, 7, 8, 3, K.brass[5]);
    o.hline(10, 15, 8, K.brass[2]);
    // rope toy
    o.hline(18, 23, 3, K.rope[4]); o.px(18, 2, K.red[4]); o.px(23, 2, K.quiltB[4]); o.px(20, 3, K.rope[2]);
  });
}

/** Mori's species photo board: corkboard, pinned bird / fish / dolphin / pug photos, a tally card. */
export function photoBoard(w = 18, h = 21): PixelBuffer {
  return obj(w, h, o => {
    o.rect(0, 0, w, h, (x, y) => (x === 0 || y === 0 ? K.wood[5] : x === w - 1 || y === h - 1 ? K.wood[1] : (x * 7 + y * 13) % 5 === 0 ? K.rope[1] : K.rope[2]));
    const photo = (x: number, y: number, kind: number) => {
      o.rect(x, y, 6, 5, (i, j) => (i === 0 || j === 0 || i === 5 || j === 4 ? K.white[4] : kind === 3 ? K.cream[3] : K.glass[j < 2 ? 4 : 3]));
      if (kind === 0) { o.px(x + 2, y + 2, K.white[4]); o.px(x + 3, y + 2, K.metal[1]); o.px(x + 1, y + 2, K.metal[1]); } // gull
      if (kind === 1) { o.hline(x + 1, x + 4, y + 3, K.navy[2]); o.px(x + 2, y + 2, K.navy[2]); } // dolphin
      if (kind === 2) { o.px(x + 2, y + 2, K.orange[4]); o.px(x + 3, y + 2, K.orange[4]); o.px(x + 4, y + 2, K.orange[3]); } // fish
      if (kind === 3) { o.rect(x + 2, y + 1, 2, 2, K.wood[4]); o.px(x + 2, y + 2, K.metal[0]); } // the pug
      o.px(x + 3, y, K.red[4]);
    };
    photo(1, 1, 0); photo(8, 2, 2); photo(2, 8, 1); photo(9, 9, 3);
    if (w > 15) photo(w - 5 > 14 ? 14 : 12, 14, 0);
    // tally card and a length of string between two pins
    o.rect(2, 14, 7, 5, (x, y) => (y % 2 === 1 && x > 0 && x < 6 ? K.navy[3] : K.paper[5]));
    o.line(5, 6, 12, 8, K.red[3]);
  });
}

// ------------------------------------------------------------------ hold & lab

/**
 * The research tank on its cabinet. Same layout as the V4 frame (w x h glass, 14px cabinet below)
 * so the scene's fish (TANK rect) swim in the water: lid with a strip light, rim, water gradient,
 * weed, a rock, gravel, an air line to a pump on the side, and a label on the cabinet.
 */
export function fishTank(w: number, h: number): Sp {
  const buf = obj(w, h + 14, o => {
    // cabinet: two doors, knobs, kick plate, label
    o.rect(0, h, w, 14, (x, y) => (y === 13 ? K.metal[0] : y === 0 ? K.teak[6] : x === 0 ? K.teak[5] : x === w - 1 ? K.teak[1] : rq(K.teak, 3, x, y, 0.3)));
    const dw = Math.floor(w / 2) - 3;
    for (const dx of [2, Math.floor(w / 2) + 1]) {
      o.rect(dx, h + 2, dw, 9, (x, y) => (x === 0 || y === 0 ? K.teak[1] : x === dw - 1 || y === 8 ? K.teak[5] : K.teak[3]));
    }
    o.px(Math.floor(w / 2) - 2, h + 6, K.brass[6]); o.px(Math.floor(w / 2) + 2, h + 6, K.brass[6]);
    o.rect(4, h + 4, 6, 3, K.paper[5]); o.hline(5, 8, h + 5, K.navy[3]);
    // glass box: steel corner posts, top rim
    o.rect(0, 0, w, h, (x, y) => {
      if (y === 0) return K.metal[4];
      if (x === 0 || x === w - 1) return x === 0 ? K.metal[5] : K.metal[2];
      if (y >= h - 4) return (x * 3 + y) % 4 === 0 ? K.cream[4] : y === h - 4 ? K.teak[4] : (x + y) % 3 ? K.teak[3] : K.teak[2];
      if (y === 1) return hex('#a8e0ee');
      const v = (y - 1) / (h - 5);
      return v < 0.35 ? hex('#3e92a8') : v < 0.7 ? hex('#2f7a92') : hex('#276a82');
    });
    // weed and a rock
    for (const [x0, hh] of [[3, 9], [5, 11], [w - 8, 10], [w - 4, 7]]) for (let y = 0; y < hh; y++) o.px(x0 + Math.round(Math.sin(y * 0.6 + x0) * 1), h - 4 - y, y % 3 ? K.green[4] : K.green[3]);
    o.ell(w * 0.62, h - 5, 4, 2.4, (nx, ny) => (ny < -0.2 ? K.metal[5] : K.metal[3]));
    // glass glint
    o.vline(2, 2, h - 6, hex('#8ad0e0'));
    // lid with a strip light
    o.rect(-0, -0, w, 1, K.metal[4]);
    // air pump on the cabinet side and its line into the tank
    o.rect(w - 5, h + 1, 4, 3, K.navy[3]);
    o.line(w - 3, h + 1, w - 3, h - 4, K.white[3]);
  });
  const glow = glowOf(w, h + 14, o => o.rect(1, 1, w - 2, h - 5, (x, y) => (y < 2 ? hex('#a0e8ff') : hex('#1a5a70'))));
  return { buf, glow };
}

/** Compound microscope: heavy foot, curved arm, stage with a slide, turret, eyepiece, focus knob. */
export function microscope(): PixelBuffer {
  return obj(11, 16, o => {
    o.rect(0, 13, 10, 3, (x, y) => (y === 0 ? K.metal[4] : x === 9 ? K.metal[0] : K.metal[2]));
    // arm
    for (let y = 3; y < 13; y++) { o.px(7, y, K.white[4]); o.px(8, y, K.white[2]); }
    o.px(6, 4, K.white[4]); o.px(6, 3, K.white[4]);
    // stage with a glass slide and the clips
    o.hline(1, 8, 10, K.metal[1]); o.hline(1, 8, 9, K.metal[3]);
    o.hline(2, 5, 8, K.glass[5]); o.px(3, 8, K.plum[4]);
    // lamp under the stage
    o.px(3, 11, K.yellow[6]); o.px(4, 11, K.yellow[5]);
    // turret and objectives
    o.rect(2, 5, 4, 2, K.metal[5]); o.px(3, 7, K.metal[6]); o.px(5, 7, K.brass[5]);
    // body tube and the angled eyepiece
    o.line(3, 4, 5, 0, K.white[4]); o.line(4, 4, 6, 0, K.white[2]);
    o.rect(5, 0, 3, 1, K.metal[1]);
    // focus knob
    o.ell(8.5, 7.5, 1.6, 1.6, (nx, ny) => (nx + ny < 0 ? K.metal[6] : K.metal[3]));
  });
}

/** Chunk's food crate: a slatted crate, stencilled CHOW with a paw, a can on top. */
export function chowCrate(): PixelBuffer {
  return obj(19, 14, o => {
    o.rect(0, 2, 19, 12, (x, y) => {
      let f = 4 + (hash2(x >> 2, Math.floor(y / 4), 3) - 0.5) * 0.8 + ((y - 2) % 4 === 0 ? -1.3 : 0);
      if (x < 2) f += 0.9;
      if (x > 16 || y === 13) f -= 1.2;
      return rq(K.wood, f, x, y, 0.3);
    });
    for (const bx of [0, 17]) o.rect(bx, 2, 2, 12, (x) => (x === 0 ? K.wood[6] : K.wood[4]));
    pixelText(o, 'CHOW', 2, 5, K.wood[1], undefined, true);
    // paw print
    o.px(9, 11, K.wood[1]); o.px(8, 10, K.wood[1]); o.px(10, 10, K.wood[1]); o.px(9, 12, K.wood[1]);
    // a can of dog food on the lid
    o.rect(3, 0, 4, 2, (x, y) => (y === 0 ? K.metal[7] : x === 0 ? K.red[4] : K.red[3]));
  });
}

// ------------------------------------------------------------------ wheelhouse

/** Framed family photos on the forward panel: Jenna and the big fish, the boat, a gull. */
export function framedPhotos(): PixelBuffer {
  return obj(16, 22, o => {
    const frame = (x: number, y: number, w: number, h: number, inner: (i: number, j: number) => C) => {
      o.rect(x, y, w, h, (i, j) => (i === 0 || j === 0 ? K.brass[5] : i === w - 1 || j === h - 1 ? K.brass[1] : i === 1 || j === 1 || i === w - 2 || j === h - 2 ? K.brass[3] : inner(i - 2, j - 2)));
    };
    // little Jenna with a fish bigger than she is
    frame(0, 0, 10, 12, (i, j) => {
      if (j < 3) return K.glass[4];
      if (i === 2 && j >= 2 && j < 7) return j === 2 ? K.cream[5] : K.navy[3]; // Jenna
      if (j === 4 && i > 2) return i === 5 ? K.metal[0] : K.metal[5]; // the fish
      if (j === 5 && i > 3) return K.metal[4];
      return j > 5 ? K.glass[2] : K.glass[3];
    });
    // the Kittiwake on launch day
    frame(8, 12, 8, 9, (i, j) => (j < 2 ? K.glass[4] : j === 2 && i > 0 && i < 4 ? K.cream[5] : j === 3 ? K.cream[4] : j === 4 ? K.red[3] : K.glass[2]));
    // a small oval of a gull
    frame(11, 1, 5, 7, (i, j) => (j === 1 && i > 0 ? K.white[4] : K.glass[3]));
  });
}

/** Joshu's model of the Kittiwake in a glass case on a varnished base (with the tiny dent in the bow). */
export function modelShip(): PixelBuffer {
  return obj(26, 17, o => {
    o.rect(0, 13, 26, 4, (x, y) => (y === 0 ? K.varnish[6] : y === 3 ? K.varnish[1] : x === 25 ? K.varnish[2] : K.varnish[4]));
    o.hline(10, 15, 15, K.brass[5]);
    // glass case
    o.rect(1, 0, 24, 13, (x, y) => (x === 0 || y === 0 ? hex('#b8d8e0') : x === 23 ? hex('#6a8a9a') : (x + y * 2) % 13 === 0 ? hex('#a8c8d4') : -1));
    // hull, boot stripe, wheelhouse, mast
    o.poly([4, 8, 22, 7, 20, 12, 7, 12], (x, y) => (y >= 11 ? K.red[3] : y === 10 ? K.navy[3] : x > 19 ? K.cream[3] : K.cream[5]));
    o.px(20, 9, K.cream[2]); // the dent
    o.rect(10, 4, 6, 4, (x, y) => (y === 0 ? K.cream[6] : x === 5 ? K.cream[2] : y === 1 ? K.glass[3] : K.cream[4]));
    o.vline(18, 1, 7, K.cream[5]); o.hline(16, 20, 3, K.metal[4]);
    o.line(18, 1, 23, 7, K.metal[3]);
    o.rect(3, 12, 20, 1, K.glass[3]);
  });
}

// ------------------------------------------------------------------ deck

/** Joshu's herb planter: basil, thyme and a very determined chilli (red pods). */
export function herbBox(): PixelBuffer {
  return obj(30, 16, o => {
    o.rect(0, 9, 30, 7, (x, y) => (y === 0 ? K.teak[6] : y === 6 ? K.teak[0] : x === 0 ? K.teak[5] : x === 29 ? K.teak[1] : y === 3 ? K.teak[2] : rq(K.teak, 3.6, x, y, 0.3)));
    o.hline(1, 28, 9, K.wood[1]);
    // basil: broad leaves
    for (const [cx, cy] of [[4, 6], [7, 4], [3, 3], [8, 7]]) o.ell(cx, cy, 2.2, 1.6, (nx, ny) => (nx + ny < -0.3 ? K.green[5] : ny > 0.3 ? K.green[2] : K.green[4]));
    // thyme: fine sprigs
    for (let x = 12; x < 19; x++) for (let y = 3 + (x % 3); y < 9; y++) if ((x + y) % 2 === 0) o.px(x, y, (x * y) % 3 ? K.moss[4] : K.moss[5]);
    // chilli: stems and hanging red pods
    o.vline(24, 1, 8, K.green[2]);
    for (const [cx, cy] of [[22, 2], [26, 3], [23, 5], [26, 6]]) o.ell(cx, cy, 1.8, 1.3, K.green[4]);
    for (const [px, py] of [[21, 4], [25, 5], [27, 8], [22, 7]]) { o.px(px, py, K.red[5]); o.px(px, py + 1, K.red[3]); }
    // plant labels
    o.px(6, 8, K.white[4]); o.px(15, 8, K.white[4]);
  });
}

/** Striped canvas deck chair, folded open. */
export function deckChair(): PixelBuffer {
  return obj(22, 20, o => {
    o.line(0, 19, 14, 0, K.wood[5]); o.line(1, 19, 15, 0, K.wood[3]);
    o.line(8, 19, 20, 6, K.wood[4]); o.line(9, 19, 21, 6, K.wood[2]);
    o.line(3, 12, 21, 12, K.wood[4]);
    o.poly([4, 11, 16, 1, 20, 6, 10, 11], (x, y) => ((((x + y) >> 1) % 2) ? K.quiltB[3] : K.white[4]));
    o.line(4, 11, 16, 1, K.quiltB[1]);
  });
}

/** Rod holder on the taffrail with two rods, reels and a float clipped on. */
export function rodHolder(): PixelBuffer {
  return obj(14, 40, o => {
    o.rect(4, 26, 5, 14, (x) => (x === 0 ? K.metal[6] : x === 4 ? K.metal[2] : K.metal[4]));
    o.hline(3, 9, 26, K.metal[7]);
    // rods: cork grips, blanks with rings, tips
    o.line(6, 27, 12, 0, K.metal[1]); o.line(7, 27, 13, 1, K.varnish[5]);
    o.line(5, 27, 1, 3, K.varnish[4]);
    for (const [x, y] of [[9, 13], [11, 6], [3, 14], [2, 8]]) o.px(x, y, K.metal[6]);
    o.px(12, 0, K.red[5]); o.px(1, 3, K.yellow[6]);
    // reels
    o.ell(9, 22, 2, 2, (nx, ny) => (nx + ny < 0 ? K.metal[6] : K.metal[3]));
    o.ell(3, 21, 1.6, 1.6, (nx, ny) => (nx + ny < 0 ? K.brass[5] : K.brass[2]));
    o.vline(6, 30, 38, K.rope[4]);
  });
}

/** A chilly bin: blue body, white lid, a rope handle and a drain plug. */
export function cooler(): PixelBuffer {
  return obj(20, 13, o => {
    o.rect(0, 3, 20, 10, (x, y) => (y === 9 ? K.navy[0] : x === 0 ? K.quiltB[4] : x === 19 ? K.quiltB[1] : rq(K.quiltB, 3, x, y, 0.3)));
    o.rect(0, 1, 20, 3, (x, y) => (y === 0 ? K.white[4] : y === 2 ? K.white[1] : K.white[3]));
    o.hline(7, 12, 0, K.rope[4]);
    o.rect(6, 6, 8, 3, K.white[3]); o.hline(7, 12, 7, K.quiltB[3]);
    o.px(17, 11, K.metal[5]);
  });
}

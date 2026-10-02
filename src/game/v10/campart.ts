// V10 camp props, painted with the Kittiwake's sticker kit (flat cel shading, dark outline) like the
// Day 1 camp (src/art/island4/camp.ts): Mori's tarp tent, Jenna's tech bench, the camp board with
// its pinned requests, the trail sign out of camp, the fishing rock on the shore, a cooking pot.

import { obj, P, T, hex } from '../../art/ship4/kit';
import type { CampSprite } from '../../art/island4/camp';
import type { PixelBuffer } from '../../art/pixel';

const DRIFT = T('#a89478', { sh: 0.16, deep: 0.34, hi: 0.12 });
// the Kittiwake's spare mainsail, rust-red canvas (it reads against the sea behind camp)
const TARP = T('#b5533c', { sh: 0.16, deep: 0.34, hi: 0.12 });
const ROCK = T('#7a746e', { sh: 0.18, deep: 0.38, hi: 0.14 });
const WET = T('#5a5450', { sh: 0.16, deep: 0.32, hi: 0.16 });
const anchor = (buf: PixelBuffer, ax?: number, lift = 2): CampSprite => ({ buf, ax: ax ?? Math.round(buf.w / 2), ay: buf.h - lift });

/** Mori's tarp tent: a sailcloth tarp on a ridge line between two driftwood poles, guyed out, a mat under it */
export function tarpTent(): CampSprite {
  return anchor(obj(64, 34, o => {
    // the far half of the tarp (the inside, in shadow)
    o.poly([6, 33, 30, 4, 34, 4, 60, 33], (x, y) => ((x * 3 + y) % 11 === 0 ? TARP[0] : TARP[0]));
    o.poly([10, 33, 31, 8, 33, 8, 56, 33], hex('#3a1e18'));
    // poles and the ridge line
    o.line(31, 33, 31, 1, DRIFT[1]); o.line(32, 33, 32, 1, DRIFT[2]);
    o.hline(2, 62, 2, P.rope[2]);
    // the near flap, rolled up on the right so the inside shows; the left half hangs down
    o.poly([2, 30, 31, 3, 31, 14, 12, 33, 2, 33], (x, y) => ((x + y) % 7 === 0 ? TARP[1] : y < 10 ? TARP[3] : TARP[2]));
    o.line(3, 30, 30, 4, TARP[3]);
    o.ell(46, 11, 9, 2.4, (nx) => (nx < -0.2 ? TARP[3] : TARP[1]));
    o.line(40, 12, 40, 16, P.rope[1]); o.line(52, 11, 52, 15, P.rope[1]);
    // guy lines and pegs
    o.line(0, 33, 4, 28, P.rope[1]); o.line(63, 33, 58, 29, P.rope[1]);
    o.rect(0, 32, 2, 2, DRIFT[0]); o.rect(62, 32, 2, 2, DRIFT[0]);
    // a little name tag Jenna hung on the ridge
    o.rect(20, 3, 5, 4, P.paper[2]); o.px(22, 4, P.red[2]);
  }));
}

/** Jenna's tech bench: a hatch-cover table on two crates, a vice, a soldering iron on its stand, a
 *  desk lamp, a gutted radio, a jar of screws, coiled wire and a battery with a green LED */
export function techBench(): CampSprite {
  const buf = obj(58, 38, o => {
    o.box(1, 17, 56, 4, P.plankD);
    o.box(3, 21, 14, 16, P.plank); o.box(41, 21, 14, 16, P.plank);
    o.hline(5, 15, 28, P.plankD[1]); o.hline(43, 53, 28, P.plankD[1]);
    // the vice on the left end
    o.box(2, 12, 7, 5, P.steel); o.rect(9, 13, 3, 2, P.steel[3]); o.vline(4, 9, 12, P.steel[1]);
    // the gutted radio, lid off, a circuit board standing in it
    o.box(13, 9, 14, 8, P.dark); o.rect(15, 11, 4, 4, hex('#2a6a4a')); o.px(16, 12, hex('#e8b840')); o.px(18, 13, hex('#e8b840'));
    o.rect(21, 11, 4, 1, P.steel[3]); o.rect(21, 13, 4, 1, P.steel[2]);
    // desk lamp on a bent arm
    o.line(30, 16, 33, 7, P.steel[2]); o.line(33, 7, 38, 5, P.steel[2]);
    o.poly([36, 3, 42, 4, 41, 8, 36, 7], P.yellow[2]);
    // soldering iron on its coil stand
    o.ell(46, 15, 3, 1.5, P.steel[1]); o.line(44, 14, 52, 10, P.dark[2]); o.px(52, 10, hex('#ff8a3a'));
    // jar of screws, coiled wire, the battery
    o.box(29, 12, 4, 5, T('#cfe4ec', { sh: 0.1, deep: 0.3 })); o.px(30, 14, P.steel[3]); o.px(31, 15, P.brass[2]);
    o.ell(12, 34, 5, 2.2, P.red[1]); o.ell(12, 34, 2.4, 1, P.red[3]);
    o.box(44, 30, 10, 6, P.dark); o.rect(46, 28, 2, 2, P.red[2]); o.rect(51, 28, 2, 2, P.dark[3]); o.px(49, 32, hex('#6ae080'));
    // Kevin's cousin? no: a little wind-up crab toy
    o.ell(24, 16, 2, 1.2, P.orange[2]);
  });
  const glow = obj(58, 38, o => {
    o.poly([36, 7, 41, 8, 40, 9, 36, 8], hex('#fff0b0'));
    o.px(52, 10, hex('#ffb060'));
    o.px(49, 32, hex('#80ff90'));
    o.px(16, 12, hex('#ffd060'));
  }, false);
  return { ...anchor(buf), glow };
}

/** the camp board: a plank notice board on two driftwood posts under a little flax roof, with pinned
 *  notes (crew requests on the left, the agency's printouts on the right) */
export function campBoard(): CampSprite {
  return anchor(obj(34, 44, o => {
    o.rect(4, 8, 2, 36, DRIFT[1]); o.rect(28, 8, 2, 36, DRIFT[2]);
    o.poly([0, 8, 17, 1, 34, 8, 34, 10, 17, 4, 0, 10], (x, y) => ((x + y) % 4 === 0 ? hex('#5e6e2c') : hex('#7a8a3a')));
    o.box(2, 10, 30, 20, P.plank);
    // notes
    const note = (x: number, y: number, w: number, h: number, c: number, pin: number) => {
      o.rect(x, y, w, h, c);
      for (let j = y + 2; j < y + h - 1; j += 2) o.hline(x + 1, x + w - 2, j, hex('#8a7a60'));
      o.px(x + Math.floor(w / 2), y, pin);
    };
    note(4, 12, 7, 8, P.paper[2], P.red[2]);
    note(12, 13, 6, 7, hex('#f0d0e0'), P.blue[2]);
    note(5, 21, 6, 7, hex('#d8e8c0'), P.yellow[2]);
    note(20, 12, 9, 10, hex('#eef2f4'), P.teal[2]);
    note(19, 23, 8, 5, hex('#eef2f4'), P.teal[2]);
    // a feather tucked in the corner (Aroha's)
    o.line(28, 11, 31, 16, P.cream[3]);
  }));
}

/** the trail sign at the east end of camp: a post with two arrow boards and a coil of rope */
export function trailSign(): CampSprite {
  return anchor(obj(30, 40, o => {
    o.rect(13, 4, 3, 36, DRIFT[1]); o.rect(15, 4, 1, 36, DRIFT[2]);
    o.poly([2, 8, 24, 8, 28, 11, 24, 14, 2, 14], P.plank[2]);
    o.hline(4, 22, 11, P.paper[2]);
    o.poly([28, 17, 6, 17, 2, 20, 6, 23, 28, 23], P.plankD[2]);
    o.hline(8, 26, 20, P.paper[1]);
    o.ell(15, 31, 5, 2, P.rope[1]); o.ell(15, 31, 2.6, 1, P.rope[3]);
  }));
}

/** the fishing rock: a flat-topped boulder at the edge of the beach, wet below, a rod wedged in a crack
 *  and a bait tin */
export function fishRock(): CampSprite {
  return anchor(obj(44, 30, o => {
    o.poly([2, 29, 4, 14, 10, 8, 30, 6, 38, 10, 43, 18, 43, 29], (x, y) => {
      const l = -x * 0.012 - y * 0.05;
      return y > 22 ? WET[(x + y) % 5 === 0 ? 1 : 2] : l > -0.6 ? ROCK[3] : l > -1 ? ROCK[2] : ROCK[1];
    });
    o.hline(8, 32, 8, ROCK[3]);
    o.line(12, 14, 18, 20, ROCK[0]); o.line(26, 12, 30, 17, ROCK[0]);
    // barnacles and weed at the waterline
    for (const x of [6, 11, 17, 24, 31, 37]) o.px(x, 23 + (x % 3), hex('#d8d0c0'));
    for (const x of [4, 9, 14, 20, 28, 35, 41]) o.vline(x, 26, 29, hex('#4a6a2a'));
    // the bait tin
    o.box(32, 3, 6, 5, T('#b8c0c4', { sh: 0.14, deep: 0.3 })); o.rect(32, 3, 6, 1, P.red[2]);
  }));
}

/** a rod wedged in a crack (drawn on its own so Mori can take it) */
export function rodInRock(): CampSprite {
  return anchor(obj(18, 40, o => {
    o.line(2, 39, 16, 0, P.dark[2]); o.line(3, 39, 16, 1, P.plank[1]);
    o.ell(5, 33, 2, 2, P.steel[2]);
    o.line(16, 0, 17, 14, hex('#e8e8f0'));
  }), 3, 2);
}

/** Joshu's cooking pot (carried to the fire for breakfast) */
export function pot(): CampSprite {
  return anchor(obj(14, 10, o => {
    o.ball(7, 6, 6, 4, P.steel); o.rect(1, 2, 12, 2, P.steel[3]); o.hline(3, 11, 1, P.dark[2]);
    o.px(0, 3, P.dark[1]); o.px(13, 3, P.dark[1]);
  }));
}

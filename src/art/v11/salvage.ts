// V11 salvage on the beach below the wreck of the Kittiwake, painted with the same sticker kit as the
// V9 pickups (flat cel shading, dark outline): a burst life ring with its black inner tube showing
// (rubber for the slingshot band), a sodden leather boat bag (leather scraps), and a tangle of torn-off
// fittings (scrap metal). Each sprite is anchored at its foot.

import { obj, T, hex, shade } from '../ship4/kit';
import type { ForageSprite } from '../v9/forage-art';

const SAND = T('#d8bc8a', { sh: 0.12, deep: 0.26, hi: 0.1 });
const RING = T('#e0602e', { sh: 0.16, deep: 0.32, hi: 0.16 });
const WHITE = T('#e8e2d4', { sh: 0.12, deep: 0.28, hi: 0.1 });
const TUBE = T('#34343a', { sh: 0.16, deep: 0.3, hi: 0.2 });
const LEATHER = T('#7a4a2a', { sh: 0.16, deep: 0.32, hi: 0.12 });
const STEEL = T('#7a868a', { sh: 0.18, deep: 0.36, hi: 0.18 });
const RUST = T('#8a4a2a', { sh: 0.16, deep: 0.3, hi: 0.1 });

const sp = (buf: ForageSprite['buf'], ax?: number, ay?: number): ForageSprite => ({ buf, ax: ax ?? Math.round(buf.w / 2), ay: ay ?? buf.h - 2 });

/** a burst life ring half sunk in the sand, the black inner tube bulging out of the split */
export function lifeRing(): ForageSprite {
  return sp(obj(24, 11, o => {
    o.ell(12, 9, 11.5, 2.4, (nx, ny) => (ny < -0.2 ? SAND[3] : SAND[2]));
    // the ring, tipped toward us: an ellipse band with orange and white quarters
    o.ell(12, 5.5, 10, 4.6, (nx, ny) => {
      const r = Math.hypot(nx, ny);
      if (r < 0.5) return -1;
      const a = Math.atan2(ny, nx);
      const q = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 4 + 0.5) % 4;
      const t = q % 2 ? WHITE : RING;
      return ny < -0.45 ? t[3] : r > 0.88 ? t[1] : t[2];
    });
    // the split on the right, the tube bulging out of it
    o.rect(18, 3, 3, 5, 0);
    for (const [x, y] of [[18, 3], [19, 3], [18, 7], [20, 7]] as const) o.px(x, y, RING[0]);
    o.ell(19.5, 5.2, 2.6, 2.2, (nx, ny) => (ny < -0.3 && nx < 0.2 ? TUBE[3] : TUBE[1]));
    o.px(18, 4, hex('#8a8a96'));
    // a torn tail of tube lying in the sand
    o.line(21, 8, 23, 9, TUBE[1]);
    o.px(22, 8, TUBE[2]);
    // the rope grab line, sagging between two cleats
    for (let x = 4; x <= 15; x++) o.px(x, 1 + Math.round(Math.sin(((x - 4) / 11) * Math.PI) * 1), hex('#c8b890'));
  }));
}

/** a ruined leather boat bag slumped on the sand, the flap open, a strap trailing */
export function boatBag(): ForageSprite {
  return sp(obj(18, 11, o => {
    o.ell(9, 9, 8.5, 2, (nx, ny) => (ny < -0.2 ? SAND[3] : SAND[2]));
    // the body: a soft slumped box, darker where it's soaked
    o.poly([2, 9, 3, 3, 14, 2, 16, 9], (x, y) => (y < 4 ? LEATHER[3] : x > 13 ? LEATHER[1] : (x + y) % 5 === 0 ? LEATHER[1] : y > 7 ? shade(LEATHER[1], -0.1) : LEATHER[2]));
    // the open flap folded back, its stitched edge
    o.poly([3, 3, 1, 1, 12, 0, 14, 2], LEATHER[2]);
    for (let x = 2; x < 13; x += 2) o.px(x, 1, hex('#d8c09a'));
    // the brass buckle and the strap trailing off to the right
    o.rect(8, 4, 2, 2, hex('#c8a048'));
    o.px(8, 4, hex('#f0d888'));
    o.line(15, 6, 17, 9, LEATHER[1]);
    // a cut-out square where a scrap was taken before
    o.rect(5, 6, 2, 2, LEATHER[0]);
  }));
}

/** a tangle of torn-off fittings: a bent stanchion, a cleat, a plate with bolt holes, all rust-streaked */
export function scrapHeap(): ForageSprite {
  return sp(obj(20, 10, o => {
    o.ell(10, 8.5, 9.5, 2, (nx, ny) => (ny < -0.2 ? SAND[3] : SAND[2]));
    // the plate, half buried and tilted
    o.poly([2, 8, 4, 3, 12, 4, 11, 8], (x, y) => (y < 5 ? STEEL[3] : (x * 3 + y) % 7 === 0 ? RUST[2] : STEEL[2]));
    for (const [x, y] of [[5, 5], [9, 6]] as const) o.px(x, y, STEEL[0]);
    // the bent stanchion tube over it
    for (let x = 6; x <= 18; x++) { const y = 2 + Math.round(Math.abs(x - 12) * 0.35); o.px(x, y, STEEL[3]); o.px(x, y + 1, STEEL[1]); }
    o.line(18, 4, 19, 8, STEEL[1]);
    // a cleat and a curl of wire
    o.rect(13, 6, 5, 2, STEEL[2]);
    o.px(13, 6, STEEL[3]); o.px(17, 7, STEEL[0]);
    for (const [x, y] of [[1, 6], [0, 5], [1, 4], [2, 5]] as const) o.px(x, y, hex('#b07040'));
  }));
}

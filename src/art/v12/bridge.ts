// V12 the big regions: a swing bridge over a gully, painted pixel by pixel. Two squared tōtara posts
// stand on the rims in little cairns, lashed with flax rope; a deck of hand-split planks (each its own
// width and weathering, a few warped, one gone) hangs on two cables between them, the hand rope sagging
// lower than the deck with a hanger every hand-width; beard moss and a fern or two hang off the
// underside, moss creeps over the planks near the posts. Hard pixels, a dark ink outline.

import { PixelBuffer } from '../pixel';
import type { C } from '../color';
import { hex, mix } from '../color';
import { hash2, noise1, Rng } from '../../core/math';
import { FP, pick } from '../v11/forest/kit';

export interface SwingBridge {
  buf: PixelBuffer;
  /** the anchor: the top of the deck at its west end */
  ax: number;
  ay: number;
  /** how far below the ends the deck top hangs at local x (0..len) */
  deck(x: number): number;
}

const INK = hex('#0a0d0b');

/** a swing bridge `len` px from rim to rim whose deck sags `sag` px in the middle */
export function paintSwingBridge(len: number, sag: number, seed: number): SwingBridge {
  const rng = new Rng(seed);
  const P = 9, T = 34, W = len + P * 2, H = T + Math.ceil(sag) + 30;
  const b = new PixelBuffer(W, H);
  const deck = (x: number) => sag * Math.sin(Math.PI * Math.max(0, Math.min(1, x / len)));
  const handSag = sag * 1.25 + 3;
  const hand = (x: number) => T - 17 + handSag * Math.sin(Math.PI * Math.max(0, Math.min(1, x / len)));
  const rope = (x: number, y: number, k: number) => { const tw = ((x + y * 2) & 3) < 2; return tw ? pick(FP.litter, 5 + k) : pick(FP.litter, 3 + k); };

  // ---- beard moss and ferns hanging under the deck (behind everything)
  for (let x = 6; x < len - 6; x++) {
    if (hash2(x, 3, seed) > 0.16) continue;
    const y0 = Math.round(T + deck(x)) + 4, n = 3 + Math.floor(hash2(x, 4, seed) * 9);
    for (let k = 0; k < n; k++) {
      const sx = x + P + (k > 3 && hash2(x, k, seed + 1) < 0.3 ? (hash2(x, k, seed + 2) < 0.5 ? -1 : 1) : 0);
      b.set(sx, y0 + k, k < 2 ? pick(FP.moss, 3) : pick(FP.lichen, 1 + (k % 3 === 0 ? 1 : 0)));
    }
  }
  // ---- the cables under the planks
  for (let x = 0; x <= len; x++) {
    const y = Math.round(T + deck(x)) + 3;
    b.set(x + P, y, rope(x, y, 0));
    b.set(x + P, y + 1, pick(FP.litter, 1));
  }
  // ---- the planks: hand-split, each its own width and weathering
  let x = 1;
  let gone = Math.round(len * (0.35 + rng.next() * 0.3));
  while (x < len - 1) {
    const pw = 3 + (hash2(x, 9, seed) < 0.35 ? 1 : 0) + (hash2(x, 10, seed) < 0.12 ? 1 : 0);
    if (Math.abs(x - gone) < 3) { x += pw + 1; gone = -99; continue; }
    const tone = (hash2(x, 11, seed) - 0.5) * 2.4 + (noise1(x / 30, seed) - 0.5) * 1.6;
    const warp = hash2(x, 12, seed) < 0.12 ? 1 : 0;
    const grey = hash2(x, 13, seed) < 0.3;
    const ramp = grey ? FP.kauri : FP.podo;
    for (let i = 0; i < pw && x + i < len - 1; i++) {
      const xx = x + i;
      const top = Math.round(T + deck(xx)) - 2 + warp;
      const edge = i === 0 || i === pw - 1;
      b.set(xx + P, top, pick(ramp, 7 + tone - (edge ? 1 : 0)));
      b.set(xx + P, top + 1, pick(ramp, 5 + tone - (edge ? 1 : 0)));
      b.set(xx + P, top + 2, pick(ramp, 3 + tone));
      // a nail, a knot, a split
      if (i === 1 && hash2(xx, 14, seed) < 0.25) b.set(xx + P, top + 1, pick(FP.stone, 2));
      if (i === pw - 2 && hash2(xx, 15, seed) < 0.15) b.set(xx + P, top, pick(ramp, 4 + tone));
      // moss creeping over the deck near the posts
      const nearEnd = Math.min(xx, len - xx);
      if (nearEnd < 40 && hash2(xx, 16, seed) < 0.55 * (1 - nearEnd / 40)) b.set(xx + P, top - (hash2(xx, 17, seed) < 0.3 ? 1 : 0), pick(FP.moss, 5 + hash2(xx, 18, seed) * 3));
    }
    x += pw + (hash2(x, 19, seed) < 0.55 ? 1 : 0);
  }
  // ---- the hangers and the hand rope
  for (let hx = 4; hx < len - 3; hx += 9 + (hash2(hx, 20, seed) < 0.4 ? 1 : 0)) {
    const y0 = Math.round(hand(hx)) + 1, y1 = Math.round(T + deck(hx)) - 2;
    for (let y = y0; y < y1; y++) b.set(hx + P, y, pick(FP.litter, 3 + ((y & 1) ? 0 : 1)));
    b.set(hx + P - 1, y1 - 1, pick(FP.litter, 2)); b.set(hx + P + 1, y1 - 1, pick(FP.litter, 2));
  }
  for (let x2 = -2; x2 <= len + 2; x2++) {
    const y = Math.round(hand(x2));
    b.set(x2 + P, y, rope(x2, y, 1));
    b.set(x2 + P, y + 1, rope(x2 + 1, y, -1));
    // leaves of a climbing vine on the hand rope, here and there
    if (hash2(x2, 21, seed) < 0.07) { b.set(x2 + P, y - 1, pick(FP.fern, 6)); b.set(x2 + P + 1, y - 1, pick(FP.fern, 5)); b.set(x2 + P + 1, y - 2, pick(FP.fern, 7)); }
  }
  // ---- the posts on the rims, in their cairns
  const post = (cx: number, flip: boolean) => {
    const top = T - 26, bot = T + 9;
    const cols = [2, 5, 7, 7, 6, 5, 3];
    for (let i = 0; i < cols.length; i++) {
      const xx = cx + (flip ? cols.length - 1 - i : i) - 3;
      for (let y = top + (i === 0 || i === cols.length - 1 ? 1 : 0); y <= bot; y++) {
        const grain = noise1(y / 3 + i * 7, seed + 30) > 0.62 ? -1 : 0;
        const crack = hash2(i, y >> 2, seed + 31) < 0.06 ? -2 : 0;
        b.set(xx, y, pick(FP.podo, cols[i] + grain + crack));
      }
    }
    // the carved top, worn round, and its moss cap
    b.set(cx - 3, top + 1, 0); b.set(cx + 3, top + 1, 0);
    for (let i = -2; i <= 2; i++) b.set(cx + i, top, pick(FP.moss, 5 + (i === -1 ? 2 : i === 2 ? -1 : 0)));
    b.set(cx - 1, top - 1, pick(FP.moss, 6)); b.set(cx, top - 1, pick(FP.moss, 7));
    // a carved notch, a koru scratched into the face
    for (const [dx, dy] of [[0, 6], [1, 6], [1, 7], [0, 8], [-1, 8], [-1, 7]]) b.set(cx + dx, top + dy, pick(FP.podo, 2));
    // flax lashings where the ropes tie on
    for (const ly of [Math.round(hand(flip ? len : 0)), T + 2]) {
      for (let i = -4; i <= 4; i++) { b.set(cx + i, ly - 1, rope(i, ly, 1)); b.set(cx + i, ly + 1, rope(i + 1, ly, 0)); }
      for (let i = -4; i <= 4; i += 2) b.set(cx + i, ly, pick(FP.litter, 6));
    }
    // the cairn at its foot: hand-placed stones, mossy on top
    const stones: [number, number, number][] = flip ? [[-6, 3, 2], [-2, 4, 3], [3, 3, 2], [-4, 2, 1]] : [[-4, 3, 2], [1, 4, 3], [5, 3, 2], [3, 2, 1]];
    for (const [sx, sw, sh] of stones) {
      for (let yy = 0; yy < sh + 1; yy++) for (let xx = 0; xx < sw + (yy === sh ? -1 : 0); xx++) {
        const px = cx + sx + xx + (yy === 0 ? 1 : 0), py = bot - yy;
        if (yy === 0 && xx === sw - 1) continue;
        b.set(px, py, yy === sh ? pick(FP.moss, 4 + (xx & 1)) : pick(FP.stone, 5 - yy + (xx === 0 ? -1 : 0) + (hash2(px, py, seed) < 0.2 ? 1 : 0)));
      }
    }
    // a kiokio frond leaning on the post
    const fx = cx + (flip ? -5 : 5);
    for (let k = 0; k < 9; k++) {
      const yy = bot - 2 - k, xx = fx + (flip ? -1 : 1) * Math.round(k * k / 22);
      b.set(xx, yy, pick(FP.fern, 5 + (k > 5 ? 1 : 0)));
      if (k > 1 && (k & 1)) { b.set(xx + 1, yy, pick(FP.fern, 6)); b.set(xx - 1, yy + 1, pick(FP.fern, 4)); }
    }
  };
  post(P - 4, false);
  post(P + len + 4, true);
  b.outline(INK);
  void mix; void (0 as unknown as C);
  return { buf: b, ax: P, ay: T, deck };
}

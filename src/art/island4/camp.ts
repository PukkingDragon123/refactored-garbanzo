// V4 island camp and story props. The camp (the blue dome tent, Aroha's flax lean-to, the fire pit,
// Joshu's cooking bench, the drying rack, Mori's research table, the tarped stores and the salvage
// pile, Jenna's electronics corner, Chunk's bed, log seats, the woodpile, a hurricane lantern, the
// light poles and Mori's sleeping bag) is painted with the camp kit (campkit.ts): real volume shading
// from the sun's side, materials (canvas weave and seams, sailcloth, grain, nails, lashings, rope,
// dented metal), ambient occlusion and a selective outline, with wind frames for anything made of
// cloth or hanging. The spilled crate of Chunky Chow in the wreck, Joshu's boots and the jacket scraps
// keep the Kittiwake's sticker kit.

import { obj, P, T, hex as khex, mix, shade } from '../ship4/kit';
import { PixelBuffer } from '../pixel';
import { Cv, RP, build, obox, grain, folds, stencil, hex, clamp, hash2, noise1, noise2, bayer } from './campkit';
import type { CampSprite, Ramp } from './campkit';

export type { CampSprite };

/** a little paw print stencil (4 toes and a pad) */
function paw(o: { px(x: number, y: number, c: number): void }, x: number, y: number, c: number) {
  for (const [dx, dy] of [[0, 0], [2, -1], [4, -1], [6, 0]]) { o.px(x + dx, y + dy, c); o.px(x + dx + 1, y + dy, c); }
  for (let j = 0; j < 3; j++) for (let i = 1; i < 7; i++) if (!(j === 2 && (i === 1 || i === 6))) o.px(x + i, y + 2 + j, c);
}
const PAW = ['#.#.#.#', '.......', '.#####.', '.#####.', '..###..'];
const anchor = (buf: PixelBuffer, ax?: number): CampSprite => ({ buf, ax: ax ?? Math.round(buf.w / 2), ay: buf.h - 2 });

// ------------------------------------------------------------------ shared bits

/** a driftwood stake / pole, slightly crooked (two segments), with a fork stub at the top */
function driftPole(cv: Cv, x: number, gy: number, h: number, r = 1.6, seed = 1, lean = 0) {
  const mx = x + lean * 0.5 + (hash2(seed, 1, 7) - 0.5) * 1.5, tx = x + lean;
  cv.cyl(x, gy, mx, gy - h * 0.55, r, RP.drift, { grain: 0.3, seed, knots: 0.4 });
  cv.cyl(mx, gy - h * 0.55, tx, gy - h, r * 0.9, RP.drift, { grain: 0.3, seed: seed + 1, knots: 0.4 });
}

/** a peg with its guy line running up to (x1, y1) */
function guy(cv: Cv, px: number, gy: number, x1: number, y1: number, dir: number) {
  const [hx, hy] = cv.peg(px, gy, dir);
  cv.rope([[hx, hy], [x1, y1]], RP.rope, 0.62);
}

/** a stone for the fire ring: lumpy ball, lichen speckle, soot on the side facing the fire */
function stone(cv: Cv, cx: number, cy: number, rx: number, ry: number, seed: number, sootDir = 0) {
  cv.ball(cx, cy, rx, ry, RP.stone, {
    flat: 0.6,
    tex: (x, y) => (noise2(x * 0.5, y * 0.6, seed) - 0.5) * 0.35 + (hash2(x, y, seed) < 0.06 ? 0.2 : 0) + (sootDir && Math.sign(x + 0.5 - cx) === sootDir ? -0.25 : 0),
  });
}

// ------------------------------------------------------------------ the blue dome tent

/** blue dome tent (Jenna and Joshu's, from the Kittiwake's hold): pole sleeves with the panels sagging
 *  between them, an orange fly band, the door unzipped with its curtain swinging, a vent hood, guy lines */
export function domeTent(open = true): CampSprite {
  return build(k => {
    const cv = new Cv(112, 62, k);
    const cx = 56, gy = 54, rx = 34, ry = 33, amp = k.amp;
    const poles = [-1, -0.5, 0.5, 1];
    const geo = (x: number, y: number) => {
      const nx = (x - cx) / rx, ny = (y - gy) / ry;
      const cl = Math.sqrt(Math.max(0.05, 1 - ny * ny));
      return { nx, ny, cl, u: clamp(nx / cl, -1, 1) };
    };
    const z = (x: number, y: number) => {
      const { nx, ny, u } = geo(x, y);
      const base = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)) * rx;
      let sag = 0;
      for (let i = 0; i < 3; i++) {
        const a = poles[i], b = poles[i + 1];
        if (u < a || u > b) continue;
        const f = (u - a) / (b - a), s = Math.sin(Math.PI * f);
        sag = s * (i === 1 ? 1.5 : 2.1) * (0.55 + 0.45 * (1 + ny));
        // the windward panel breathes in and out; a ripple runs over the others
        if (i === 0) sag += amp * 1.7 * (0.55 + 0.45 * cv.wave(0)) * s;
        else sag += amp * 0.45 * cv.wave(u * 0.7, 1.3) * s;
      }
      return base - sag;
    };
    const dh = (y: number) => (gy - y) / 25;
    const dwAt = (y: number) => { const t = dh(y); return t >= 1 ? 0 : 11 * Math.sqrt(1 - t * t); };
    // curtain: the door panel bunched on the right, its hem swinging
    const swing = amp * 1.6 * cv.wave(0.2) + amp * 0.8;
    for (let y = gy - ry; y <= gy; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
      const { nx, ny, cl, u } = geo(x + 0.5, y + 0.5);
      if (nx * nx + ny * ny > 1 || y > gy) continue;
      const dx = x + 0.5 - cx, dw = dwAt(y + 0.5);
      if (open && Math.abs(dx) < dw) {
        // the dark inside: the far wall glows faintly blue, a sleeping bag and a pack on the floor
        const t = dh(y + 0.5);
        let c = cv.tone(RP.black, 0.18 + t * 0.35 + (Math.abs(dx) / Math.max(1, dw)) * -0.1, x, y, 0.5);
        if (t > 0.45) c = mix(c, RP.dome[2], 0.35 * (t - 0.45));
        if (gy - y < 5 && dx > -9 && dx < 5) c = cv.tone(RP.orange, 0.18 + (5 - (gy - y)) * 0.06, x, y, 0.5);
        if (gy - y < 7 && dx > 5) c = cv.tone(RP.olive, 0.2 + (7 - (gy - y)) * 0.03, x, y, 0.4);
        // the curtain on the right side of the door, hanging in folds
        const edge = cx + 3 + swing * (1 - t) + Math.sin(t * 7) * 0.6;
        if (x + 0.5 > edge && gy - y > 2 + swing * 0.6 * (dx / 11)) {
          const f = Math.sin((x - edge) * 1.25 + cv.k.ph * 6.28 * amp * 0.5);
          c = cv.tone(RP.dome, 0.42 + f * 0.13 - (x + 0.5 - edge < 1 ? 0.15 : 0) + t * 0.12, x, y, 0.5);
        }
        cv.set(x, y, c);
        continue;
      }
      let l = cv.field(z, x + 0.5, y + 0.5, 1);
      let rp: Ramp = RP.dome;
      const band = ny > -0.36 && ny < -0.27;
      if (band) { rp = RP.orange; l += 0.04; if (ny > -0.285) l -= 0.12; }
      const half = rx * cl;
      // pole sleeves: raised, catching the light, a crease on their shadow side
      for (const p of [-0.5, 0.5]) {
        const d = (u - p) * half;
        if (Math.abs(d) < 1.1) l += 0.12;
        else if (d * -k.lx > 1 && d * -k.lx < 2.2) l -= 0.1;
      }
      if (!band && Math.abs(u * half) < 0.55) l -= y % 3 === 0 ? 0.2 : 0.08; // centre seam, stitched
      // zip binding round the door
      if (open && Math.abs(Math.abs(dx) - dw) < 1.2 && dh(y) < 1.04) { l -= 0.14; if ((y & 1) && Math.abs(dx) > dw) { cv.set(x, y, RP.steel[5]); continue; } }
      // canvas weave in the light, fabric gathered into wrinkles at the foot
      if (l > 0.5 && ((x ^ y) & 1) === 0 && (x & 1)) l += 0.03;
      if (gy - y < 4) l += (noise1(x * 0.8, 3) - 0.5) * 0.5 * (1 - (gy - y) / 4) - 0.06;
      cv.t(x, y, rp, l, 0.5);
    }
    // vent hood on top, lifting in the wind
    const vy = gy - ry + 6 - Math.round(amp * (0.5 + 0.5 * cv.wave(0.4)));
    cv.ell(cx + 1, vy, 6.5, 2.4, (nx, ny, x, y) => cv.tone(RP.dome, ny < 0 ? 0.62 - nx * 0.1 * k.lx : 0.22, x, y, 0.4));
    cv.rect(cx - 4, vy + 1, 10, 1, RP.black[1]);
    // guy lines from the fly band out to pegs; stake loops at the base
    const pL = cv.peg(cx - rx - 11, gy, -1), pR = cv.peg(cx + rx + 11, gy, 1);
    for (const sx of [-1, 1]) { cv.peg(cx + sx * (rx - 1), gy + 1, sx); cv.set(cx + sx * (rx - 2), gy - 1, RP.black[2]); }
    cv.ao(gy, 4, 0.3);
    const post = (c: Cv) => { c.cord(pL[0], pL[1], cx - rx + 1, gy - 10, 0.3 + amp * 0.3); c.cord(pR[0], pR[1], cx + rx - 1, gy - 10, 0.3 + amp * 0.3); };
    return { cv, ax: cx, ay: gy, post };
  }, { frames: 6, shadow: { w: 84, h: 1.1, a: 0.45 } });
}

// ------------------------------------------------------------------ Aroha's lean-to

/** Aroha's lean-to: harakeke (flax) blades laid like shingles over a driftwood frame, the fringe stirring
 *  in the wind, a woven mat and a kete in its shade, a bundle of leaves against the pole */
export function leanTo(): CampSprite {
  return build(k => {
    const cv = new Cv(84, 54, k);
    const gy = 46, x0 = 8, amp = k.amp;
    const roofAt = (x: number) => gy - 39 + (x - x0) * 0.33; // top surface line, falling to the right
    // shade under the roof (painted first; the ground there)
    // poles: tall at the back left, short at the front right
    driftPole(cv, x0 + 6, gy, 38, 1.7, 11, 1);
    driftPole(cv, x0 + 58, gy, 20, 1.6, 12, -1);
    // the mat and the kete under the roof
    for (let x = x0 + 8; x < x0 + 54; x++) for (let y = gy - 3; y <= gy; y++) {
      const w = (Math.floor((x - y) / 2) + Math.floor((x + y) / 2)) & 1;
      cv.t(x, y, RP.flaxDry, 0.3 + w * 0.18 + (y === gy - 3 ? 0.1 : 0) - (x < x0 + 20 ? 0.1 : 0), 0.3);
    }
    cv.ball(x0 + 45, gy - 6, 6, 5.5, RP.flaxDry, { flat: 0.4, tex: (x, y) => (((x >> 1) + (y >> 1)) & 1 ? 0.12 : -0.1) + (y === gy - 9 ? -0.25 : 0) });
    cv.rope([[x0 + 40, gy - 10], [x0 + 43, gy - 14], [x0 + 48, gy - 14], [x0 + 51, gy - 10]], RP.flaxDry, 0.5);
    // a bundle of cut leaves leaning on the tall pole
    for (let i = 0; i < 5; i++) cv.line(x0 + 2 + i, gy, x0 + 9 + i * 0.6, gy - 22 - i * 1.5, (t, x, y) => cv.tone(RP.flax, 0.45 + (i % 2) * 0.15 + t * 0.15, x, y, 0.3));
    cv.lash(x0 + 7, gy - 10, 2, 3);
    // underside shade on everything below the roof
    for (let x = x0 + 4; x < x0 + 62; x++) for (let y = Math.floor(roofAt(x) + 5); y <= gy; y++) {
      const c = cv.get(x, y);
      if (!(c >>> 24)) continue;
      const t = clamp(1 - (y - roofAt(x) - 5) / 26);
      if (t + (bayer(x, y) - 0.5) * 0.3 > 0.2) cv.set(x, y, shade(c, -0.32 * t));
    }
    // the crossbar and the roof: overlapping rows of blades, each with a midrib and lit edge
    cv.cyl(x0 - 2, roofAt(x0 - 2) + 3, x0 + 66, roofAt(x0 + 66) + 3, 1.4, RP.drift, { grain: 0.3, seed: 4 });
    for (let row = 3; row >= 0; row--) {
      for (let b = 0; b < 15; b++) {
        const bx = x0 - 3 + b * 4.6 + row * 2.3 + (hash2(b, row, 5) - 0.5) * 2;
        const by = roofAt(bx) + row * 1.9 - 2;
        const len = 9 + hash2(b, row, 9) * 5;
        // the bottom row's tips hang free and stir
        const free = row === 3 ? amp * (0.35 + 0.35 * cv.wave(b * 0.13, 1, 1)) : row === 1 ? amp * 0.12 * cv.wave(b * 0.1) : 0;
        const ang = 1.2 + free * 0.3 + (hash2(b, row, 3) - 0.5) * 0.15;
        cv.hang(bx, by, len, ang, u => 1.7 * (1 - u * 0.55), (u, v, x, y) => {
          const l = 0.62 - row * 0.09 - u * 0.1 + (v < -0.3 ? 0.18 : v > 0.4 ? -0.16 : 0) + (Math.abs(v) < 0.2 ? -0.08 : 0);
          return cv.tone(hash2(b, row, 1) < 0.25 ? RP.flaxDry : RP.flax, l, x, y, 0.4);
        });
      }
    }
    // the fringe along the low edge: blade tips hanging over, swaying
    for (let i = 0; i < 12; i++) {
      const fx = x0 + 2 + i * 5.2, fy = roofAt(fx) + 6;
      const ang = 0.25 + amp * (0.3 + 0.25 * cv.wave(i * 0.11, 1, 1)) + (hash2(i, 7, 2) - 0.5) * 0.2;
      cv.hang(fx, fy, 5 + hash2(i, 3, 4) * 4, ang, u => 0.9 * (1 - u * 0.5), (u, v, x, y) => cv.tone(RP.flax, 0.42 - u * 0.15 + (v < 0 ? 0.1 : -0.05), x, y, 0.3));
    }
    // flax ties at the pole tops
    cv.lash(x0 + 7, roofAt(x0 + 7) + 3, 2, 2);
    cv.lash(x0 + 57, roofAt(x0 + 57) + 3, 2, 2);
    cv.ao(gy, 3, 0.25);
    return { cv, ax: 42, ay: gy };
  }, { frames: 6, shadow: { w: 60, a: 0.35 } });
}

// ------------------------------------------------------------------ the fire

/** the fire pit: a ring of soot-blackened stones on a bed of ash, charred logs crossed in the middle and a
 *  couple of half-burnt sticks; `glow` holds the live coals (scaled by the fire) */
export function firePit(lit: boolean): CampSprite {
  const s = build(k => {
    const cv = new Cv(52, 26, k);
    const cx = 26, gy = 19;
    const glow = new PixelBuffer(cv.w, cv.h);
    // back stones (the far half of the ring)
    for (let i = 0; i < 8; i++) {
      const a = Math.PI + (i + 0.5) / 8 * Math.PI;
      stone(cv, cx + Math.cos(a) * 15.5, gy - 3 + Math.sin(a) * 4.2, 3 + hash2(i, 1, 3) * 0.8, 2.4 + hash2(i, 2, 3) * 0.6, i + 10, Math.cos(a) < 0 ? 1 : -1);
    }
    // ash bed
    cv.ell(cx, gy - 3, 12.5, 3.4, (nx, ny, x, y) => cv.tone(RP.ash, 0.3 + (noise2(x * 0.4, y * 0.7, 4) - 0.5) * 0.5 - (1 - Math.hypot(nx, ny)) * 0.2, x, y, 0.7));
    // charred logs crossing, a half-burnt stick poking out
    cv.cyl(cx - 9, gy - 2, cx + 6, gy - 7, 1.6, RP.iron, { grain: 0.4, seed: 2 });
    cv.cyl(cx + 9, gy - 2, cx - 5, gy - 7, 1.6, RP.iron, { grain: 0.4, seed: 3 });
    cv.cyl(cx - 3, gy - 1, cx + 14, gy - 4, 1.2, RP.drift, { grain: 0.3, seed: 5 });
    for (let t = 0; t < 1; t += 0.12) { const x = cx - 3 + 9 * t, y = gy - 1 - 1.5 * t; cv.t(x, y, RP.iron, 0.25); }
    // coals: cracks in the logs and embers in the ash
    const coal = (x: number, y: number, hot: boolean) => {
      if (!cv.op(x, y)) return;
      cv.set(x, y, lit ? hex(hot ? '#ffb04a' : '#c8501c') : hot ? RP.ash[5] : RP.iron[0]);
      glow.set(x, y, hex(hot ? '#ffcf70' : '#ff7a2a'));
    };
    for (const [x, y, h] of [[cx - 4, gy - 5, 1], [cx - 1, gy - 6, 0], [cx + 3, gy - 5, 1], [cx + 1, gy - 4, 0], [cx - 6, gy - 3, 0], [cx + 5, gy - 3, 0], [cx, gy - 3, 1], [cx - 2, gy - 2, 0], [cx + 7, gy - 4, 0]] as const) coal(x, y, !!h);
    // front stones
    for (let i = 0; i < 7; i++) {
      const a = (i + 0.5) / 7 * Math.PI;
      stone(cv, cx + Math.cos(a) * 16, gy - 2 + Math.sin(a) * 2.6, 3.3 + hash2(i, 4, 3) * 0.9, 2.6 + hash2(i, 5, 3) * 0.5, i + 30, Math.cos(a) > 0 ? -1 : 1);
    }
    cv.ao(gy, 2, 0.25);
    return { cv, ax: cx, ay: gy, glow };
  }, { shadow: { w: 40, a: 0.3 } });
  return s;
}

// ------------------------------------------------------------------ Joshu's kitchen

/** Joshu's cooking bench: a hatch board on lashed driftwood legs; the chopping board with a snapper, a
 *  knife, the pot with its lid, a tin mug, the frying pan hung off the end, a tea towel flapping on the
 *  other, and the dented chilly bin */
export function cookBench(): CampSprite {
  return build(k => {
    const cv = new Cv(100, 50, k);
    const gy = 43, x0 = 8, amp = k.amp;
    const top = gy - 19;
    // legs: crossed driftwood pairs lashed under the board
    for (const lx of [x0 + 5, x0 + 40]) {
      cv.cyl(lx - 3, gy, lx + 3, top + 3, 1.3, RP.drift, { grain: 0.3, seed: lx });
      cv.cyl(lx + 3, gy, lx - 3, top + 3, 1.3, RP.drift, { grain: 0.3, seed: lx + 1 });
      cv.lash(lx, gy - 9, 2, 2);
      cv.contact(lx - 3, gy + 1, 2, 1.5); cv.contact(lx + 3, gy + 1, 2, 1.5);
    }
    // a stretcher bar between the legs, a bucket under it
    cv.cyl(x0 + 4, gy - 7, x0 + 42, gy - 7, 1, RP.drift, { grain: 0.3, seed: 8 });
    cv.ball(x0 + 24, gy - 4, 5, 4.4, RP.white, { flat: 1, tex: (x, y) => (y === gy - 7 ? 0.2 : 0) });
    cv.rect(x0 + 19, gy - 8, 11, 1, RP.white[2]);
    // the board: a hatch cover, thick, planked, with nails
    obox(cv, x0, top, 46, 4, 6, RP.teak, { planks: 0, seed: 21, tex: (f, u, v, px) => (f === 'top' && px % 9 === 0 ? -0.18 : 0) });
    for (const nx of [x0 + 2, x0 + 22, x0 + 43]) cv.nail(nx, top + 1);
    // the chopping board with the fish on it
    obox(cv, x0 + 4, top - 2, 17, 2, 4, RP.wood, { seed: 23 });
    cv.hang(x0 + 6, top - 5, 13, Math.PI / 2 - 0.04, u => (u < 0.12 ? 1.6 - u * 6 : u < 0.2 ? 0.7 : 0.7 + 1.9 * Math.sin(Math.PI * Math.min(1, (u - 0.2) / 0.85))), (u, v, x, y) => {
      if (u > 0.86 && Math.abs(v) < 0.3 && u < 0.92) return RP.black[1];
      let l = 0.5 + v * 0.3 + (u < 0.18 ? -0.12 : 0) + ((x + y) % 3 === 0 && u > 0.25 ? 0.06 : 0);
      if (u > 0.78 && u < 0.81) l -= 0.2;
      return cv.tone(v > 0.3 ? RP.red : RP.fish, l, x, y, 0.4);
    });
    // knife
    cv.rect(x0 + 13, top - 1, 6, 1, RP.steel[6]); cv.rect(x0 + 19, top - 1, 3, 1, RP.black[3]);
    // the pot with its lid, the handle bail up, soot on its belly
    cv.ball(x0 + 31, top - 5, 6.5, 4.6, RP.steel, { flat: 1.2, tex: (x, y) => (y > top - 4 ? -0.25 : 0) + (hash2(x, y, 3) < 0.05 ? -0.15 : 0) });
    cv.ell(x0 + 31, top - 9, 6.5, 1.6, (nx, ny, x, y) => cv.tone(RP.steel, 0.7 - ny * 0.2 - nx * k.lx * 0.15, x, y, 0.4));
    cv.rect(x0 + 30, top - 11, 2, 1, RP.black[3]);
    for (let a = 0; a <= Math.PI; a += 0.08) cv.set(x0 + 31 + Math.cos(a) * 7, top - 8 - Math.sin(a) * 4, RP.steel[3]);
    // tin mug (enamel, chipped)
    obox(cv, x0 + 39, top - 5, 4, 5, 2, RP.blue, { seed: 2 });
    cv.set(x0 + 38, top - 3, RP.blue[2]); cv.set(x0 + 40, top - 2, RP.white[4]);
    // the frying pan hanging off the left end by its handle, swinging a little
    const pa = amp * 0.15 * cv.wave(0.1);
    cv.hang(x0 + 1, top + 2, 6, pa, () => 0.6, (u, v, x, y) => cv.tone(RP.black, 0.5, x, y, 0.2));
    const pcx = x0 + 1 + Math.sin(pa) * 9, pcy = top + 12;
    cv.ell(pcx, pcy, 4.4, 4.4, (nx, ny, x, y) => {
      const r = Math.hypot(nx, ny);
      if (r > 0.78) return cv.tone(RP.iron, 0.55 - ny * 0.2 - nx * k.lx * 0.2, x, y, 0.4);
      return cv.tone(RP.iron, 0.25 + (hash2(x, y, 2) < 0.1 ? 0.2 : 0) + ny * -0.1, x, y, 0.4);
    });
    // a tea towel over the right end, flapping downwind
    const tw = x0 + 45;
    for (let j = 0; j < 12; j++) {
      const v = j / 11, off = amp * (1.2 + 1.4 * cv.wave(v * 0.6, 1, 1)) * v + v * 0.5;
      for (let i = 0; i < 6; i++) {
        const x = Math.round(tw + i + off), y = top + 1 + j;
        const check = ((i >> 1) + (j >> 1)) & 1;
        const l = 0.62 - v * 0.15 + (i === 0 ? -0.15 : 0) + Math.sin((i + off) * 1.5) * 0.06;
        cv.t(x, y, check ? RP.red : RP.cream, l, 0.4);
      }
    }
    // the chilly bin: white, a blue lid, a latch, scuffs and a dent, a fish sticker
    const bx = x0 + 57, by = gy - 15;
    obox(cv, bx, by, 22, 15, 5, RP.white, {
      seed: 33,
      tex: (f, u, v, px, py) => {
        if (f === 'front' && v < 0.2) return 0.05;
        if (f === 'front' && Math.abs(u - 0.7) < 0.08 && Math.abs(v - 0.5) < 0.12) return -0.25; // the dent
        return (hash2(px, py, 4) < 0.04 ? -0.12 : 0);
      },
    });
    // blue lid over the top
    obox(cv, bx - 1, by - 1, 24, 3, 5, RP.blue, { seed: 34 });
    cv.rect(bx + 9, by + 2, 4, 2, RP.steel[5]); cv.set(bx + 10, by + 3, RP.steel[2]);
    stencil(cv, bx + 5, by + 6, ['..###...#', '.#####.##', '########.', '.#####.##', '..###...#'], RP.blue[4], 0.08, 4);
    cv.rect(bx + 1, by + 13, 20, 1, RP.white[1]);
    cv.ao(gy, 3, 0.28);
    return { cv, ax: 46, ay: gy };
  }, { frames: 6, shadow: { w: 74, a: 0.35 } });
}

// ------------------------------------------------------------------ the drying rack

/** drying rack: two lashed driftwood A-frames and a crossbar, strips of flax and split fish hung to dry,
 *  everything on it swinging with the wind */
export function dryingRack(): CampSprite {
  return build(k => {
    const cv = new Cv(76, 54, k);
    const gy = 47, x0 = 8, amp = k.amp, top = gy - 38;
    for (const ex of [x0 + 6, x0 + 56]) {
      cv.cyl(ex - 6, gy, ex + 1.5, top - 3, 1.4, RP.drift, { grain: 0.3, seed: ex, knots: 0.3 });
      cv.cyl(ex + 6, gy, ex - 1.5, top - 3, 1.4, RP.drift, { grain: 0.3, seed: ex + 3, knots: 0.3 });
      cv.contact(ex - 6, gy + 1, 2.4, 1.4); cv.contact(ex + 6, gy + 1, 2.4, 1.4);
    }
    cv.cyl(x0 - 1, top, x0 + 63, top + 1, 1.5, RP.drift, { grain: 0.35, seed: 9, knots: 0.3 });
    cv.lash(x0 + 6, top + 1, 2, 3); cv.lash(x0 + 56, top + 1, 2, 3);
    // hanging things
    for (let i = 0; i < 7; i++) {
      const hx = x0 + 12 + i * 6.6, hy = top + 2;
      const ang = amp * (0.16 + 0.17 * cv.wave(i * 0.17, 1, 1)) + (hash2(i, 1, 4) - 0.5) * 0.06;
      if (i % 2) {
        // a split fish hung by the tail on a loop of twine
        const sl = 4;
        cv.line(hx, hy, hx + Math.sin(ang) * sl, hy + Math.cos(ang) * sl, (t, x, y) => cv.tone(RP.rope, 0.6, x, y, 0.2));
        const fx = hx + Math.sin(ang) * sl, fy = hy + Math.cos(ang) * sl;
        cv.hang(fx, fy, 15, ang, u => (u < 0.14 ? 1.9 - u * 8 : u < 0.22 ? 0.8 : 0.8 + 2.1 * Math.sin(Math.PI * Math.min(1, (u - 0.22) / 0.9))), (u, v, x, y) => {
          if (u > 0.86 && u < 0.92 && v > -0.4 && v < 0.1) return RP.black[1];
          let l = 0.5 + v * 0.22 * -k.lx + Math.sqrt(Math.max(0, 1 - v * v)) * 0.14 - (u < 0.2 ? 0.14 : 0);
          if (u > 0.78 && u < 0.81) l -= 0.18;
          // the split belly, drying amber
          if (Math.abs(v) < 0.35 && u > 0.3 && u < 0.84) return cv.tone(RP.flaxDry, 0.55 + v * 0.2, x, y, 0.4);
          return cv.tone(RP.fish, l, x, y, 0.4);
        });
      } else {
        // a bunch of flax strips, curling as they dry
        for (let s = 0; s < 3; s++) {
          const a2 = ang + (s - 1) * 0.08;
          cv.hang(hx - 1 + s, hy, 14 + s * 2 - (i % 3), a2, u => 0.75 - u * 0.25, (u, v, x, y) => cv.tone(s === 1 ? RP.flaxDry : RP.flax, 0.55 - u * 0.2 + (v < 0 ? 0.1 : -0.08), x, y, 0.35));
        }
        cv.lash(hx, hy + 1, 1, 1);
      }
    }
    return { cv, ax: x0 + 31, ay: gy };
  }, { frames: 6, shadow: { w: 60, a: 0.25 } });
}

// ------------------------------------------------------------------ Mori's research table

/** the research table: a plank on two crates, the microscope, the laptop (screen glows), specimen jars, a
 *  field notebook with a pencil, a magnifier and a mug of brushes */
export function researchTable(): CampSprite {
  return build(k => {
    const cv = new Cv(84, 52, k);
    const gy = 44, x0 = 8, top = gy - 20;
    const glow = new PixelBuffer(cv.w, cv.h);
    const crate = (x: number, seed: number) => {
      obox(cv, x, gy - 15, 15, 15, 5, RP.wood, { planks: 5, seed });
      cv.nail(x + 1, gy - 14); cv.nail(x + 13, gy - 14); cv.nail(x + 1, gy - 4); cv.nail(x + 13, gy - 4);
      stencil(cv, x + 4, gy - 10, ['.#.#.', '#####', '.###.', '..#..'], RP.black[2], 0.25, seed);
      cv.contact(x + 7, gy + 1, 9, 1.6);
    };
    crate(x0 + 2, 41); crate(x0 + 50, 42);
    // the plank top
    obox(cv, x0, top, 66, 3, 6, RP.wood, { seed: 44, tex: (f, u, v, px) => (f === 'top' && (px - x0) % 22 === 0 ? -0.2 : 0) });
    cv.occlude(x0 + 9, gy - 15, 8, 2, 0.35); cv.occlude(x0 + 57, gy - 15, 8, 2, 0.35);
    // microscope: base, pillar, arm, tube, stage, a knob catching the light
    const mx = x0 + 6, my = top - 1;
    cv.rect(mx, my - 2, 9, 2, RP.black[3]); cv.rect(mx, my - 1, 9, 1, RP.black[1]);
    cv.cyl(mx + 6, my - 2, mx + 6, my - 9, 1, RP.black, {});
    cv.cyl(mx + 6, my - 9, mx + 3, my - 13, 1.1, RP.black, {});
    cv.cyl(mx + 3, my - 12, mx + 2, my - 6, 1.2, RP.steel, {});
    cv.rect(mx + 1, my - 6, 4, 1, RP.steel[6]); cv.set(mx + 7, my - 7, RP.steel[7]);
    // laptop, lid up, the screen glowing
    const lx = x0 + 22, ly = top - 1;
    cv.poly([lx - 1, ly, lx + 17, ly, lx + 15, ly - 2, lx + 1, ly - 2], (x, y) => cv.tone(RP.steel, 0.55 + ((x + y) & 1 ? 0.05 : -0.05), x, y, 0.3));
    cv.poly([lx + 1, ly - 2, lx + 15, ly - 2, lx + 16, ly - 13, lx + 2, ly - 13], RP.black[3]);
    const scr = [lx + 3, ly - 3, lx + 14, ly - 3, lx + 15, ly - 12, lx + 3.5, ly - 12];
    cv.poly(scr, (x, y) => cv.tone(RP.glass, 0.7 + (y - ly + 12) * -0.03 + (x === Math.round(lx + 6) ? 0.1 : 0), x, y, 0.5));
    cv.rect(lx + 5, ly - 10, 6, 1, RP.glass[7]); cv.rect(lx + 5, ly - 8, 4, 1, RP.glass[3]); cv.rect(lx + 5, ly - 6, 7, 1, RP.glass[4]);
    const g2 = new Cv(cv.w, cv.h, k); g2.poly(scr, hex('#bfe8ff'));
    glow.data.set(g2.b.data);
    // specimen jars: glass with a highlight, coloured contents, cork lids, paper labels
    for (const [jx, c, h] of [[x0 + 42, RP.olive, 8], [x0 + 47, RP.orange, 6], [x0 + 52, RP.red, 7]] as const) {
      const jy = top - 1;
      for (let y = jy - h; y < jy; y++) for (let x = jx; x < jx + 4; x++) {
        const edge = x === jx || x === jx + 3;
        const fill = y > jy - h + 2;
        let col = fill ? cv.tone(c, 0.45 + (x === jx + 1 ? 0.2 : 0), x, y, 0.3) : cv.tone(RP.glass, 0.6, x, y, 0.3);
        if (edge) col = mix(col, RP.glass[6], 0.35);
        cv.set(x, y, col);
      }
      cv.set(jx + 1, jy - h + 1, RP.glass[7]);
      cv.rect(jx, jy - h - 1, 4, 1, RP.wood[5]);
      cv.rect(jx, jy - 4, 4, 2, RP.paper[4]);
    }
    // field notebook with a pencil, a magnifier
    obox(cv, x0 + 57, top - 2, 7, 2, 3, RP.olive, { seed: 2 });
    cv.line(x0 + 57, top - 4, x0 + 63, top - 5, (t, x, y) => (t > 0.85 ? RP.red[4] : RP.brass[5]));
    cv.ell(x0 + 18, top - 2, 2, 1.5, (nx, ny, x, y) => (Math.hypot(nx, ny) > 0.6 ? RP.brass[4] : RP.glass[6]));
    cv.ao(gy, 3, 0.25);
    return { cv, ax: x0 + 33, ay: gy, glow };
  }, { shadow: { w: 70, a: 0.35 } });
}

// ------------------------------------------------------------------ stores and salvage

/** a lumpy burlap sack, tied at the neck */
function sack(cv: Cv, cx: number, gy: number, w: number, h: number, seed: number) {
  cv.ball(cx, gy - h / 2, w / 2, h / 2, RP.flaxDry, { flat: 0.5, tex: (x, y) => ((x + y * 2) % 3 === 0 ? -0.06 : 0) + (noise2(x * 0.4, y * 0.4, seed) - 0.5) * 0.3 });
  cv.ball(cx + 1, gy - h - 1, 2.2, 2, RP.flaxDry, {});
  cv.rect(cx - 1, gy - h + 1, 4, 1, RP.rope[1]);
}
/** a blue plastic drum standing up, ribbed, with its bung cap */
function drum(cv: Cv, cx: number, gy: number, r: number, h: number) {
  for (let y = gy - h; y <= gy; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    const q = (x + 0.5 - cx) / r;
    if (Math.abs(q) > 1) continue;
    const rib = (gy - y) % 6 === 3 || (gy - y) % 6 === 4;
    const l = cv.lam(q, 0, Math.sqrt(1 - q * q)) + (rib ? 0.1 : 0) - ((gy - y) % 6 === 2 ? 0.08 : 0);
    cv.t(x, y, RP.blue, l, 0.5);
  }
  cv.ell(cx, gy - h, r, 2, (nx, ny, x, y) => cv.tone(RP.blue, 0.72 - ny * 0.1, x, y, 0.4));
  cv.rect(cx + r * 0.3, gy - h - 1, 2, 1, RP.white[4]);
}
/** a red jerry can */
function jerry(cv: Cv, x: number, gy: number) {
  obox(cv, x, gy - 11, 8, 11, 3, RP.red, { seed: 9, tex: (f, u, v) => (f === 'front' && Math.abs(u - v) < 0.08 ? 0.12 : f === 'front' && Math.abs(u + v - 1) < 0.08 ? 0.12 : 0) });
  cv.rect(x + 2, gy - 13, 3, 2, RP.black[3]); cv.rect(x + 6, gy - 13, 2, 1, RP.red[4]);
}
/** a coil of rope lying on the sand */
function coil(cv: Cv, cx: number, gy: number, r: number) {
  for (let i = 0; i < 3; i++) cv.ell(cx, gy - 1.5 - i, r - i * 0.6, 1.8, (nx, ny, x, y) => {
    const d = Math.hypot(nx, ny);
    if (d < 0.6) return -1;
    return cv.tone(RP.rope, 0.55 + (ny < 0 ? 0.15 : -0.15) + ((x + i) % 3 === 0 ? -0.1 : 0) - i * -0.05, x, y, 0.3);
  });
}

/** the stores: crates, a drum and a sack under the green deck tarp, roped down to pegs, one corner
 *  loose and lifting in the wind. variant 1 is Jenna's salvage pile from the wreck (no tarp). */
export function storage(variant = 0): CampSprite {
  return build(k => {
    const cv = new Cv(88, 56, k);
    const gy = 48, x0 = 12, amp = k.amp;
    if (variant === 1) {
      // salvage: a split crate, the drum on its side, a jerry can, a sack, a coil of rope, a plank
      obox(cv, x0 + 2, gy - 14, 20, 14, 6, RP.wood, { planks: 5, seed: 61 });
      for (const [nx, ny] of [[1, 1], [18, 1], [1, 11], [18, 11]]) cv.nail(x0 + 2 + nx, gy - 14 + ny);
      stencil(cv, x0 + 7, gy - 10, ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'], RP.black[2], 0.2, 2);
      obox(cv, x0 + 6, gy - 24, 14, 10, 5, RP.teak, { planks: 5, seed: 62 });
      for (let y = gy - 8; y <= gy; y++) for (let x = x0 + 26; x <= x0 + 46; x++) {
        const q = (y + 0.5 - (gy - 4)) / 4.5;
        if (Math.abs(q) > 1) continue;
        cv.t(x, y, RP.blue, cv.lam(0, q, Math.sqrt(1 - q * q)) + ((x - x0) % 7 < 2 ? 0.08 : 0), 0.5);
      }
      cv.ell(x0 + 26, gy - 4, 2, 4.5, (nx, ny, x, y) => cv.tone(RP.blue, 0.4 - ny * 0.2, x, y, 0.4));
      jerry(cv, x0 + 48, gy);
      sack(cv, x0 + 62, gy, 11, 10, 3);
      coil(cv, x0 + 36, gy - 8, 5);
      cv.cyl(x0 - 6, gy - 1, x0 + 14, gy - 3, 1.2, RP.drift, { grain: 0.3, seed: 6 });
      cv.ao(gy, 3, 0.3);
      return { cv, ax: x0 + 34, ay: gy };
    }
    // the stack
    obox(cv, x0, gy - 18, 22, 18, 6, RP.wood, { planks: 6, seed: 51 });
    obox(cv, x0 + 26, gy - 12, 18, 12, 5, RP.teak, { planks: 4, seed: 52 });
    obox(cv, x0 + 5, gy - 30, 15, 12, 5, RP.wood, { planks: 4, seed: 53 });
    drum(cv, x0 + 56, gy, 7.5, 18);
    sack(cv, x0 + 68, gy, 9, 8, 7);
    // the tarp draped over the crates: a height field over the boxes, folds where it hangs
    const edgeY = (x: number) => gy - 7 - clamp((x0 + 26 - x) / 4) * 5 + Math.sin((x - x0) * 0.21) * 1.6 + noise1(x * 0.2, 3) * 1.6;
    const topY = (x: number) => (x < x0 + 5 ? gy - 33 + (x0 + 5 - x) * 1.8 : x < x0 + 22 ? gy - 34 + Math.abs(x - x0 - 13) * 0.12 : x < x0 + 30 ? gy - 33 + (x - x0 - 22) * 2.1 : gy - 16 + (x - x0 - 30) * 0.05);
    for (let x = x0 - 3; x < x0 + 49; x++) {
      const t0 = topY(x), t1 = edgeY(x);
      // the loose corner at the right lifts with the wind
      let lift = 0;
      if (x > x0 + 38) lift = (x - x0 - 38) / 10 * amp * (2.4 + 2 * cv.wave(0.1, 1, 1));
      for (let y = Math.floor(t0); y <= t1 - lift; y++) {
        const z = (xx: number, yy: number) => folds(xx, yy, 7, 1.1, 7) + (yy - t0) * 0.35 + lift * 0.4;
        let l = cv.field(z, x + 0.5, y + 0.5, 1) - (y > t1 - lift - 2 ? 0.12 : 0);
        if (Math.abs(y - (t1 - lift)) < 1) l += 0.12; // hem
        if ((x - x0) % 11 === 4 && y > t1 - lift - 2) { cv.set(x, y, RP.steel[6]); continue; } // eyelets
        cv.t(x, y, RP.tarp, l + (((x ^ y) & 1) && l > 0.5 ? 0.03 : 0), 0.5);
      }
    }
    // tie-downs over the tarp to pegs
    cv.rope([[x0 + 8, gy - 30], [x0 + 2, gy - 16], [x0 - 6, gy - 1]]);
    cv.rope([[x0 + 18, gy - 33], [x0 + 27, gy - 20], [x0 + 34, gy - 4]]);
    cv.peg(x0 - 6, gy + 1, -1); cv.peg(x0 + 34, gy + 1, 1);
    cv.ao(gy, 3, 0.3);
    return { cv, ax: x0 + 34, ay: gy };
  }, { frames: variant === 1 ? 0 : 6, shadow: { w: 66, a: 0.38 } });
}

// ------------------------------------------------------------------ Chunk's bed

/** Chunk's bed: an open crate lined with the orange blanket (spilling over the edge), his paw painted
 *  on the front, a steel bowl of kibble and a chewed rope toy */
export function chunkBed(): CampSprite {
  return build(k => {
    const cv = new Cv(56, 30, k);
    const gy = 23, x0 = 6;
    obox(cv, x0, gy - 11, 28, 11, 6, RP.wood, { planks: 4, seed: 71 });
    // inside the crate (the blanket's hollow) on the top face
    for (let y = gy - 15; y < gy - 11; y++) for (let x = x0 + 2; x < x0 + 31; x++) {
      if (!cv.op(x, y)) continue;
      cv.t(x, y, RP.orange, 0.32 + Math.sin(x * 0.7) * 0.1 + (y - gy + 15) * 0.05, 0.5);
    }
    // the blanket folds spilling over the front edge
    for (let x = x0 + 1; x < x0 + 27; x++) {
      const d = 2 + Math.round(Math.max(0, Math.sin(x * 0.35 + 1)) * 2 + (x > x0 + 18 ? 2 : 0));
      for (let y = gy - 12; y < gy - 12 + d; y++) cv.t(x, y, RP.orange, 0.6 - (y - gy + 12) * 0.08 + Math.cos(x * 0.7) * 0.1, 0.5);
    }
    stencil(cv, x0 + 10, gy - 7, PAW, RP.cream[5], 0.12, 3);
    cv.nail(x0 + 1, gy - 9); cv.nail(x0 + 26, gy - 9);
    // the bowl
    cv.ell(x0 + 39, gy - 2, 5, 2.2, (nx, ny, x, y) => cv.tone(RP.steel, 0.6 - ny * 0.3 - nx * k.lx * 0.2, x, y, 0.4));
    cv.ell(x0 + 39, gy - 3, 3.4, 1, (nx, ny, x, y) => cv.tone(RP.wood, 0.4 + (hash2(x, y, 1) < 0.4 ? 0.2 : 0), x, y, 0.3));
    // rope toy
    cv.rope([[x0 + 44, gy], [x0 + 47, gy - 1], [x0 + 50, gy]], RP.rope, 0.5, 2);
    cv.set(x0 + 43, gy - 1, RP.red[4]); cv.set(x0 + 51, gy - 1, RP.red[4]);
    cv.ao(gy, 2, 0.25);
    return { cv, ax: x0 + 20, ay: gy };
  }, { shadow: { w: 40, a: 0.35 } });
}

// ------------------------------------------------------------------ Jenna's corner

/** Jenna's corner: the battery bank, a solar panel propped on a crate, the radio with its whip aerial
 *  (a ribbon tied on, streaming), and a coil of cable; the LEDs glow */
export function electronics(): CampSprite {
  return build(k => {
    const cv = new Cv(72, 54, k);
    const gy = 46, x0 = 6;
    const glow = new PixelBuffer(cv.w, cv.h);
    // the battery bank
    obox(cv, x0 + 1, gy - 11, 18, 11, 5, RP.black, { seed: 3 });
    cv.rect(x0 + 3, gy - 14, 3, 2, RP.red[4]); cv.rect(x0 + 14, gy - 14, 3, 2, RP.black[5]);
    cv.rect(x0 + 3, gy - 8, 14, 2, RP.brass[5]);
    // the radio on top of it: olive case, dials, a speaker grille, the aerial
    const rx = x0 + 4, ry = gy - 22;
    obox(cv, rx, ry, 13, 8, 3, RP.olive, { seed: 4 });
    for (let x = rx + 1; x < rx + 6; x++) for (let y = ry + 2; y < ry + 7; y++) if ((x + y) & 1) cv.set(x, y, RP.olive[1]);
    cv.ell(rx + 9, ry + 3, 1.6, 1.6, (nx, ny, x, y) => cv.tone(RP.steel, 0.7 - ny * 0.3, x, y, 0.2));
    cv.set(rx + 8, ry + 6, hex('#e8b840')); cv.set(rx + 11, ry + 6, hex('#6ae080'));
    glow.set(rx + 8, ry + 6, hex('#ffd060')); glow.set(rx + 11, ry + 6, hex('#80ff90'));
    const ax = rx + 12, aTop = ry - 14, sway = k.amp * (0.6 + 0.6 * cv.wave(0.3));
    cv.line(ax, ry, ax + sway, aTop, (t, x, y) => cv.tone(RP.steel, 0.65, x, y, 0.2));
    cv.streamer(ax + sway, aTop + 1, 9, 2, 1, RP.orange, { droop: 5, flap: 1.6 });
    // the solar panel propped on a crate
    obox(cv, x0 + 28, gy - 12, 22, 12, 5, RP.wood, { planks: 4, seed: 5 });
    cv.nail(x0 + 29, gy - 11); cv.nail(x0 + 48, gy - 11);
    const pts = [x0 + 25, gy - 12, x0 + 55, gy - 12, x0 + 51, gy - 31, x0 + 30, gy - 31];
    cv.poly(pts, (x, y) => {
      const u = (x - x0 - 25) / 30, v = (gy - 12 - y) / 19;
      const frame = y === gy - 12 || y === gy - 31 || x <= x0 + 26 + v * 4.5 || x >= x0 + 54 - v * 3.5;
      if (frame) return cv.tone(RP.steel, 0.7 - v * 0.2, x, y, 0.2);
      const cell = (x - x0) % 5 === 0 || (gy - y) % 4 === 0;
      // a streak of sky reflected across the cells
      const refl = Math.abs(u - v * 0.7 - 0.25) < 0.08 ? 0.3 : Math.abs(u - v * 0.7 - 0.25) < 0.14 ? 0.12 : 0;
      return cv.tone(RP.blue, (cell ? 0.55 : 0.18) + refl + v * 0.12, x, y, 0.5);
    });
    cv.line(x0 + 50, gy - 13, x0 + 52, gy - 2, (t, x, y) => cv.tone(RP.steel, 0.5, x, y, 0.2)); // prop stick
    // the coil of cable
    for (let i = 0; i < 3; i++) cv.ell(x0 + 60, gy - 2 - i * 0.6, 5 - i * 0.5, 2 - i * 0.2, (nx, ny, x, y) => (Math.hypot(nx, ny) < 0.55 ? -1 : cv.tone(RP.black, 0.45 + (ny < 0 ? 0.2 : -0.1), x, y, 0.3)));
    cv.rope([[x0 + 19, gy - 4], [x0 + 24, gy - 1], [x0 + 55, gy - 1]], RP.black, 0.4);
    cv.ao(gy, 3, 0.28);
    return { cv, ax: x0 + 28, ay: gy, glow };
  }, { frames: 6, shadow: { w: 58, a: 0.35 } });
}

// ------------------------------------------------------------------ seats, wood, light

/** a log seat: a bleached drift log, checked along the grain, the top worn smooth where people sit, a
 *  stub of branch and the sawn end showing its rings */
export function logBench(len = 46): CampSprite {
  return build(k => {
    const cv = new Cv(len + 16, 20, k);
    const gy = 14, x0 = 8, r = 4;
    cv.cyl(x0, gy - r, x0 + len, gy - r, r, RP.drift, { grain: 0.55, seed: len, knots: 0.2, lift: -0.04 });
    for (let x = x0 + 1; x < x0 + len; x++) {
      // the seat, smooth and pale
      if (x > x0 + 3 && x < x0 + len - 3) cv.t(x, gy - 2 * r + 1, RP.drift, 0.8 + (noise1(x * 0.3, 2) - 0.5) * 0.2, 0.4);
      // checks (long cracks) along the grain
      for (const [cy, sd] of [[gy - r - 1, 3], [gy - 2, 7]] as const) if (noise1(x * 0.12, sd) > 0.62) cv.set(x, cy + Math.round(noise1(x * 0.3, sd + 1)), RP.drift[1]);
    }
    cv.cyl(x0 + len * 0.62, gy - 2 * r + 1, x0 + len * 0.62 + 2, gy - 2 * r - 2, 1.1, RP.drift, { lift: -0.05 });
    // the sawn end (the right end is the one that shows)
    cv.ell(x0 + len, gy - r, 1.9, r, (nx, ny, x, y) => {
      const d = Math.hypot(nx * 0.5, ny);
      if (d > 0.86) return cv.tone(RP.drift, 0.35, x, y, 0.2);
      return cv.tone(RP.wood, (k.lx > 0 ? 0.8 : 0.55) - (Math.round(d * 4) % 2 ? 0.12 : 0) - (hash2(x, y, 3) < 0.1 ? 0.15 : 0), x, y, 0.3);
    });
    cv.ao(gy, 2, 0.32);
    return { cv, ax: x0 + Math.round(len / 2), ay: gy };
  }, { shadow: { w: len + 6, a: 0.35, h: 0.8 } });
}

/** firewood, 0..3 armfuls: split rounds stacked, bark on the round side, pale split faces, end grain */
export function woodPile(n: number): CampSprite {
  return build(k => {
    const cv = new Cv(52, 30, k);
    const gy = 24, x0 = 6;
    const logs = Math.max(1, n * 2 + 1);
    // rounds stacked end-on (bottom row of three, then two, then one, and a spare on the side), each a
    // short bark-covered log going back into the pile with its sawn face toward us
    const slots: [number, number][] = [[0, 0], [7, 0], [14, 0], [3.5, -5.6], [10.5, -5.6], [7, -11.2], [21, 0]];
    const R = 3.2, dx = 5, dy = 3.5;
    const pos = slots.slice(0, Math.min(logs, slots.length)).map(([x, y]) => [x0 + 4 + x, gy - R + y] as [number, number]);
    // back to front, top to bottom so the lower front faces sit over the bodies behind
    const order = pos.map((p, i) => i).sort((a2, b2) => pos[a2][1] - pos[b2][1] || pos[b2][0] - pos[a2][0]);
    for (const i of order) {
      const [x, y] = pos[i];
      cv.cyl(x + dx, y - dy, x, y, R, RP.bark, { grain: 0.5, seed: i * 3 + 1 });
    }
    for (const i of order) {
      const [x, y] = pos[i];
      // the sawn face: rings, a split check, the bark rim
      cv.ell(x, y, R * 0.92, R, (nx, ny, px, py) => {
        const d = Math.hypot(nx, ny);
        if (d > 0.82) return cv.tone(RP.bark, 0.42 - ny * 0.2, px, py, 0.3);
        if (Math.abs(nx + ny * 0.3 - (hash2(i, 1, 5) - 0.5) * 0.6) < 0.09 && d > 0.25) return RP.wood[2];
        return cv.tone(RP.wood, 0.84 - (Math.round(d * 3.4) % 2 ? 0.12 : 0) - ny * 0.08 + (k.lx < 0 ? 0.04 : -0.04), px, py, 0.35);
      });
      cv.set(x, y, RP.wood[3]);
    }
    // a hatchet stuck in the chopping round beside the pile
    cv.cyl(x0 + 40, gy - 3, x0 + 40, gy - 6, 4.2, RP.bark, { grain: 0.4, seed: 9 });
    cv.ell(x0 + 40, gy - 7, 4.2, 1.4, (nx, ny, x, y) => cv.tone(RP.wood, 0.75 - Math.round(Math.hypot(nx, ny) * 3) % 2 * 0.12, x, y, 0.3));
    cv.line(x0 + 40, gy - 8, x0 + 44, gy - 15, (t, x, y) => cv.tone(RP.drift, 0.6, x, y, 0.2));
    cv.poly([x0 + 37, gy - 9, x0 + 41, gy - 9, x0 + 41, gy - 6, x0 + 38, gy - 7], (x, y) => cv.tone(RP.steel, 0.62 + (y === gy - 9 ? 0.25 : 0), x, y, 0.3));
    cv.ao(gy, 2, 0.3);
    return { cv, ax: x0 + 18, ay: gy };
  }, { shadow: { w: 46, a: 0.34 } });
}

/** a hurricane lantern: wire bail, red-painted cap, the glass globe with the flame in it, brass fount */
export function lantern(): CampSprite {
  return build(k => {
    const cv = new Cv(16, 22, k);
    const cx = 8, gy = 18;
    const glow = new PixelBuffer(cv.w, cv.h);
    for (let a = 0; a <= Math.PI; a += 0.1) cv.set(cx + Math.cos(a) * 3.5, gy - 15 - Math.sin(a) * 2.5, RP.steel[4]);
    cv.ell(cx, gy - 13, 3.2, 1.6, (nx, ny, x, y) => cv.tone(RP.red, 0.6 - ny * 0.2 - nx * k.lx * 0.2, x, y, 0.3));
    cv.ell(cx, gy - 7, 2.8, 4.6, (nx, ny, x, y) => {
      const d = Math.hypot(nx, ny);
      return d > 0.75 ? cv.tone(RP.glass, 0.7, x, y, 0.2) : mix(RP.brass[6], RP.glass[6], d);
    });
    cv.set(k.lx < 0 ? cx - 1 : cx + 1, gy - 9, hex('#ffffff'));
    for (const dx of [-3, 3]) cv.line(cx + dx, gy - 11, cx + dx, gy - 3, (t, x, y) => cv.tone(RP.steel, 0.4, x, y, 0.2));
    cv.ell(cx, gy - 1.5, 3.6, 1.8, (nx, ny, x, y) => cv.tone(RP.brass, 0.62 - ny * 0.3 - nx * k.lx * 0.25, x, y, 0.3));
    for (let y = gy - 10; y <= gy - 4; y++) for (let x = cx - 2; x <= cx + 2; x++) {
      const d = Math.hypot((x - cx) / 2.2, (y - gy + 7) / 3.4);
      if (d < 1) glow.set(x, y, d < 0.45 ? hex('#fff4c0') : hex('#ffc860'));
    }
    return { cv, ax: cx, ay: gy, glow, noRim: true };
  });
}

/** a driftwood pole for the string lights (the wire is lashed round its top) */
export function pole(h = 50): CampSprite {
  return build(k => {
    const cv = new Cv(14, h + 10, k);
    const gy = h + 6;
    driftPole(cv, 7, gy, h, 1.5, h, 0);
    cv.lash(7, gy - h + 3, 2, 2);
    cv.ao(gy, 3, 0.25);
    return { cv, ax: 7, ay: gy };
  }, { shadow: { w: 10, a: 0.3 } });
}

/** Mori's orange sleeping bag on a ridged foam mat, quilted baffles, a rolled jacket for a pillow */
export function bedroll(): CampSprite {
  return build(k => {
    const cv = new Cv(56, 18, k);
    const gy = 12, x0 = 8;
    for (let x = x0 - 2; x < x0 + 42; x++) for (let y = gy - 1; y <= gy; y++) cv.t(x, y, RP.olive, 0.45 + ((x >> 1) & 1 ? 0.1 : -0.06) - (y === gy ? 0.15 : 0), 0.3);
    for (let x = x0 + 4; x < x0 + 40; x++) {
      const bf = ((x - x0 - 4) % 5) / 4;
      const hh = 6 - (x > x0 + 34 ? (x - x0 - 34) * 0.5 : 0);
      for (let y = Math.round(gy - 1 - hh); y < gy - 1; y++) {
        const v = (y - (gy - 1 - hh)) / hh;
        const l = cv.lam(Math.sin((bf - 0.5) * Math.PI) * 0.6, -Math.cos(v * Math.PI * 0.5), 0.6) + (bf < 0.15 ? -0.12 : 0) + (v > 0.8 ? -0.1 : 0);
        cv.t(x, y, RP.orange, l, 0.5);
      }
    }
    cv.line(x0 + 6, gy - 7, x0 + 38, gy - 7, (t, x, y) => (x % 2 ? RP.steel[4] : -1));
    // hood and pillow
    cv.ball(x0 + 5, gy - 4, 4.5, 3.4, RP.orange, { flat: 0.4 });
    cv.ball(x0 + 2, gy - 4, 3.6, 2.6, RP.blue, { tex: (x) => (x % 3 === 0 ? -0.1 : 0) });
    cv.ao(gy, 2, 0.25);
    return { cv, ax: x0 + 20, ay: gy };
  }, { shadow: { w: 46, a: 0.3, h: 0.7 } });
}

// ------------------------------------------------------------------ story props (wreck, cove, track)

/** the burst crate of Chunky Chow in the hold, cans everywhere */
export function chunkyChow(): CampSprite {
  return anchor(obj(52, 26, o => {
    o.box(4, 8, 28, 17, P.plank);
    o.poly([4, 8, 18, 0, 32, 6, 32, 8], P.plank[3]);
    paw(o, 11, 13, khex('#f4e8c8')); paw(o, 20, 16, khex('#f4e8c8'));
    const can = (x: number, y: number, lying: boolean) => {
      if (lying) { o.box(x, y, 8, 5, T('#e0a830', { sh: 0.16, deep: 0.32, hi: 0.14 })); o.rect(x, y, 1, 5, P.steel[3]); o.rect(x + 7, y, 1, 5, P.steel[2]); o.px(x + 3, y + 2, khex('#6a3a1a')); }
      else { o.box(x, y, 5, 7, T('#e0a830', { sh: 0.16, deep: 0.32, hi: 0.14 })); o.rect(x, y, 5, 1, P.steel[3]); o.px(x + 2, y + 3, khex('#6a3a1a')); }
    };
    can(34, 19, true); can(44, 18, false); can(0, 20, false); can(38, 13, false);
    // the open one, licked clean
    o.box(26, 20, 6, 5, T('#e0a830', { sh: 0.16, deep: 0.32 })); o.ell(29, 20, 3, 1, khex('#5a3a22'));
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

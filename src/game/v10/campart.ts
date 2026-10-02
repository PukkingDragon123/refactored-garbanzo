// V10 camp props, painted with the camp kit (src/art/island4/campkit.ts) like the Day 1 camp: Mori's
// sailcloth tarp tent, the lantern hung in its doorway, Jenna's tech bench, the camp board with its
// pinned requests, the trail sign out of camp, the fishing rock on the shore and its rod, Joshu's pot,
// Aroha's slingshot target, and the Kittiwake's signal flags strung along the camp lights. Cloth and
// anything hanging is painted for a cycle of wind phases (see build()).

import { PixelBuffer } from '../../art/pixel';
import { Cv, RP, build, obox, folds, stencil, hex, mix, shade, clamp, hash2, noise1, noise2 } from '../../art/island4/campkit';
import type { CampSprite, Ramp, Look } from '../../art/island4/campkit';
import type { C } from '../../art/color';

// ------------------------------------------------------------------ Mori's tarp tent

/** Mori's tarp tent: the Kittiwake's spare mainsail over a ridge line between two driftwood poles, the
 *  near side rolled up and tied so the inside shows (mat, pack, books), the far end open, guyed out to
 *  pegs, a strip of sail streaming from the pole top. The cloth ripples with the wind. */
export function tarpTent(): CampSprite {
  return build(k => {
    const cv = new Cv(132, 74, k);
    const cx = 62, gy = 64, amp = k.amp;
    const Hr = 39.5, sh = 7, X0 = -30, X1 = 26, sR = 0.4;
    const P = (x: number, s: number): [number, number] => [cx + x + sh * s, gy - Hr * s];
    const yRoll = gy - Hr * sR;
    const tieX = [-15, 11];
    const sagR = (x: number) => (x < tieX[0] ? 2.4 * ((tieX[0] - x) / (tieX[0] - X0)) ** 1.5 : x > tieX[1] ? 2.4 * ((x - tieX[1]) / (X1 - tieX[1])) ** 1.5 : 1.1 * Math.sin(Math.PI * (x - tieX[0]) / (tieX[1] - tieX[0])));
    // ---- inside (under the rolled-up side): the far wall and the mat floor, darker toward the ends
    for (let y = Math.floor(yRoll); y <= gy; y++) {
      const s = (gy - y) / Hr;
      for (let x = Math.floor(cx + X0 + sh * s); x <= cx + X1 + sh * s; x++) {
        const fx = (x - (cx + X0 + sh * s)) / (X1 - X0);
        const endK = clamp(1 - fx * 6) * 0.14 + clamp((fx - 0.85) * 6) * 0.06;
        let c: C;
        // the mat's front edge is ragged; in front of it, the sand inside the tent mouth in shade
        const matFront = gy - 2 + Math.round(noise1(x * 0.4, 6) * 1.6);
        if (y > matFront) c = cv.tone(RP.sand, 0.2 - endK + (y - matFront) * 0.08, x, y, 0.5);
        else if (y > gy - 11) {
          const w = (((x - y) >> 1) + ((x + y) >> 1)) & 1;
          const d = (y - gy + 11) / 11;
          c = cv.tone(RP.flaxDry, 0.05 + d * d * 0.32 + w * 0.08 - endK, x, y, 0.4);
        } else c = cv.tone(RP.sail, 0.1 + (gy - 11 - y) * 0.025 - endK, x, y, 0.5);
        cv.set(x, y, c);
      }
    }
    // Mori's pack at the back, a stack of field guides and the camera case
    cv.ball(cx - 19, gy - 7, 4.2, 4.8, RP.olive, { flat: 0.4, tex: () => -0.22 });
    cv.rect(cx - 21, gy - 8, 5, 1, RP.olive[1]);
    obox(cv, cx + 12, gy - 6, 7, 3, 3, RP.blue, { seed: 3, tex: () => -0.2 });
    obox(cv, cx + 13, gy - 9, 6, 3, 3, RP.red, { seed: 4, tex: () => -0.2 });
    // ---- the open far end: the inside of the far slope, sunlight glowing through the sailcloth
    const A: [number, number] = [cx + X1, gy], B = P(X1, 1), Cc: [number, number] = [cx + X1 + 14, gy - 11];
    cv.poly([A[0], A[1], B[0], B[1], Cc[0], Cc[1]], (x, y) => {
      const v = (y - B[1]) / (gy - B[1]);
      const nearFloor = y > A[1] + (Cc[1] - A[1]) * ((x - A[0]) / (Cc[0] - A[0])) - 2.5;
      if (nearFloor) return cv.tone(RP.flaxDry, 0.22, x, y, 0.4);
      return cv.tone(RP.sail, 0.5 - v * 0.32 - (x - A[0] < 3 ? 0.1 : 0), x, y, 0.55);
    });
    cv.line(B[0], B[1], Cc[0], Cc[1], (t, x, y) => cv.tone(RP.sail, 0.78 - t * 0.2, x, y, 0.3));
    for (let t = 0.15; t < 0.95; t += 0.17) { const x = B[0] + (Cc[0] - B[0]) * t, y = B[1] + (Cc[1] - B[1]) * t; cv.set(x - 1, y, RP.steel[6]); }
    cv.peg(Cc[0] + 3, Cc[1] + 2, 1);
    cv.rope([[Cc[0], Cc[1]], [Cc[0] + 3, Cc[1] - 2]]);
    // ---- poles (shaded under the tarp)
    const poleX = [cx - 19, cx + 29] as const;
    for (const [i, px] of poleX.entries()) {
      cv.cyl(px, gy - 5.5, px + (i ? -0.5 : 0.5), gy - Hr + 1, 1.5, RP.drift, { grain: 0.3, seed: 31 + i, lift: -0.3 });
      cv.cyl(px + (i ? -0.5 : 0.5), gy - Hr + 1, px + (i ? -0.8 : 0.8), gy - Hr - 6, 1.4, RP.drift, { grain: 0.3, seed: 33 + i, knots: 0.5 });
    }
    // ---- the near slope: sailcloth panels, seams, a patch, sagging between the poles, rippling
    const z = (px: number, py: number) => {
      const s = (gy - py) / Hr, x = px - cx - sh * s;
      const ss = clamp((s - sR) / (1 - sR));
      let v = -(gy - py) * 0.85;
      v += folds(x, s * 40, 5, 0.45, 12) * (0.35 + ss * (1 - ss) * 2.2);
      v -= 2.6 * Math.sin(Math.PI * clamp((x - X0) / (X1 - X0))) * Math.sin(Math.PI * ss);
      for (const tx of tieX) v -= 1.2 * Math.exp(-Math.abs(x - tx) / 2.2) * (1 - ss);
      // tension creases running from the pole tops down to the ties
      for (const [xa, xb] of [[X0 + 4, tieX[0]], [X1 - 3, tieX[1]], [X0 + 10, tieX[0] + 5]] as const) {
        const cx2 = xa + (xb - xa) * (1 - ss), d = x - cx2;
        v -= 1.1 * Math.exp(-d * d / 3) * Math.sin(Math.PI * ss);
      }
      // the cloth curls under into the roll
      v -= 6 * clamp(1 - (s - sR) / 0.12) ** 2;
      v += amp * 1.15 * cv.wave((x - X0) / 30, 1, 1) * Math.sin(Math.PI * ss) + amp * 0.5 * cv.wave(s * 1.3, 0.8, 1) * ss;
      return v;
    };
    for (let py = Math.floor(gy - Hr - 1); py <= yRoll + 3; py++) {
      const s = (gy - py) / Hr;
      if (s > 1.005) continue;
      for (let px = Math.floor(cx + X0 + sh * s); px <= Math.ceil(cx + X1 + sh * s); px++) {
        const x = px + 0.5 - cx - sh * s;
        if (x < X0 || x > X1 || py > yRoll + sagR(x)) continue;
        let l = cv.field(z, px + 0.5, py + 0.5, 1);
        for (let xs = X0 + 6; xs < X1; xs += 11) {
          const d = x - xs;
          if (Math.abs(d) < 0.5) l -= 0.15 + (py % 2 ? 0.05 : 0);
          else if (d >= 0.5 && d < 1.5) l += 0.07;
        }
        if (x > -23 && x < -15 && s > 0.62 && s < 0.82) {
          l += 0.08;
          const edge = x < -22 || x > -16 || s < 0.635 || s > 0.805;
          if (edge && (px + py) % 2) l -= 0.22;
        }
        if (x < X0 + 1.2 || x > X1 - 1.2) l += 0.1;
        if (s > 0.975) l += 0.12;
        if (l > 0.5 && ((px ^ py) & 1) === 0 && (px & 1)) l += 0.03;
        // weathering: salt-faded patches and a darker, damp hem
        l += (noise2(x * 0.08, s * 3, 12) - 0.5) * 0.12 - clamp(0.5 - s) * 0.1 - 0.05;
        cv.t(px, py, RP.sail, l, 0.5);
      }
    }
    // grommets down both edges, the Kittiwake's bird on the sail (faded)
    for (let s = sR + 0.08; s < 0.97; s += 0.14) for (const ex of [X0 + 1, X1 - 1]) { const [gx, gyy] = P(ex, s); cv.set(gx, gyy, RP.steel[6]); cv.set(gx, gyy + 1, RP.steel[2]); }
    const [bx, by] = P(2, 0.78);
    stencil(cv, bx, by, ['##.....##', '..##.##..', '....#....'], RP.cream[4], 0.2, 3);
    // ---- the roll along the bottom of the near side, its spiral end, the ties
    const [r0x] = P(X0, sR), [r1x] = P(X1, sR);
    for (let x = r0x; x < r1x; x += 3) {
      const xa = x - cx - sh * sR, xb = Math.min(r1x, x + 3) - cx - sh * sR;
      cv.cyl(x, yRoll + 1 + sagR(xa), Math.min(r1x, x + 3), yRoll + 1 + sagR(xb), 2.6, RP.sail, { grain: 0.25, seed: 8 });
    }
    cv.ell(r1x, yRoll + 1 + sagR(X1), 1.6, 2.6, (nx, ny, x, y) => cv.tone(RP.sail, Math.round(Math.hypot(nx, ny) * 3) % 2 ? 0.3 : 0.6, x, y, 0.2));
    for (const [i, tx] of tieX.entries()) {
      const [ax0, ay0] = P(tx, sR), [ax1, ay1] = P(tx + 0.5, 1);
      cv.rope([[ax0, ay0 + 4], [ax0, ay0 - 1], [ax1, ay1]], RP.rope, 0.55);
      cv.rect(ax0 - 1, ay0 + 3, 3, 2, RP.rope[4]);
      for (const side of [-1, 1]) {
        const a = side * 0.25 + amp * (0.35 + 0.3 * cv.wave(i * 0.3 + side * 0.15, 1, 1.5));
        cv.line(ax0 + side * 0.6, ay0 + 5, ax0 + side * 0.6 + Math.sin(a) * 6, ay0 + 5 + Math.cos(a) * 6, (t, x, y) => cv.tone(RP.rope, 0.6 - t * 0.2, x, y, 0.2));
      }
    }
    // ---- ridge line from pole to pole, lashings, guy lines out to pegs
    const top = gy - Hr - 0.5;
    cv.rope([[poleX[0] + 0.5, top], [poleX[1] - 0.5, top]], RP.rope, 0.66);
    for (const px of poleX) cv.lash(Math.round(px), Math.round(top) + 1, 2, 2);
    const pegL = cv.peg(cx - 52, gy, -1), pegR = cv.peg(cx + 62, gy - 2, 1);
    // ---- a strip of old sail streaming off the pole top
    cv.streamer(poleX[1] - 0.6, gy - Hr - 6, 15, 4, 1.6, RP.cream, { droop: 6, flap: 2.4, stripe: (u, v) => (v > 0.35 ? RP.red[4] : 0) });
    cv.ao(gy, 3, 0.28);
    // the guy lines (thin, after the outline), slackening a touch in the gusts
    const post = (c: Cv) => {
      c.cord(pegL[0], pegL[1], poleX[0] + 0.8, gy - Hr - 4, 0.5 + amp * 0.4);
      c.cord(pegR[0], pegR[1], poleX[1] - 0.8, gy - Hr - 4, 0.5 + amp * 0.4);
    };
    return { cv, ax: cx, ay: gy, post };
  }, { frames: 6, shadow: { w: 82, a: 0.42, dx: 4 } });
}

/** a peg with its guy line running up to (x1, y1) */
function guy(cv: Cv, px: number, gy: number, x1: number, y1: number, dir: number) {
  const [hx, hy] = cv.peg(px, gy, dir);
  cv.rope([[hx, hy], [x1, y1]], RP.rope, 0.62);
}

/** a hurricane lantern on a hook, anchored at the hook (draw it rotated to swing): returns the lit and
 *  glow layers (one light, it swings as a whole) */
export function hangingLantern(): { buf: PixelBuffer; glow: PixelBuffer; ax: number; ay: number } {
  const k: Look = { lx: -1, ph: 0, amp: 0 };
  const cv = new Cv(16, 26, k);
  const cx = 8, top = 2;
  const glow = new PixelBuffer(cv.w, cv.h);
  cv.line(cx, top, cx, top + 4, RP.steel[3]);
  for (let a = 0; a <= Math.PI; a += 0.1) cv.set(cx + Math.cos(a) * 3.5, top + 7 - Math.sin(a) * 2.5, RP.steel[4]);
  cv.ell(cx, top + 8, 3.2, 1.6, (nx, ny, x, y) => cv.tone(RP.red, 0.6 - ny * 0.2 + nx * 0.2, x, y, 0.3));
  cv.ell(cx, top + 14, 2.8, 4.6, (nx, ny) => { const d = Math.hypot(nx, ny); return d > 0.75 ? RP.glass[5] : mix(RP.brass[7], RP.glass[6], d); });
  cv.set(cx - 1, top + 12, hex('#ffffff'));
  for (const dx of [-3, 3]) cv.line(cx + dx, top + 10, cx + dx, top + 18, RP.steel[3]);
  cv.ell(cx, top + 19.5, 3.6, 1.8, (nx, ny, x, y) => cv.tone(RP.brass, 0.62 - ny * 0.3 + nx * 0.2, x, y, 0.3));
  for (let y = top + 11; y <= top + 17; y++) for (let x = cx - 2; x <= cx + 2; x++) {
    const d = Math.hypot((x - cx) / 2.2, (y - top - 14) / 3.4);
    if (d < 1) glow.set(x, y, d < 0.45 ? hex('#fff4c0') : hex('#ffc860'));
  }
  cv.outline();
  return { buf: cv.b, glow, ax: cx, ay: top };
}

// ------------------------------------------------------------------ Jenna's tech bench

/** Jenna's tech bench: a hatch-cover table on two crates, a vice, a soldering iron on its coil stand, a
 *  desk lamp on a bent arm, a gutted radio with its board standing in it, a jar of screws, coiled wire,
 *  a battery with a green LED, the wind-up crab, and an oily rag tucked under the edge, flapping */
export function techBench(): CampSprite {
  return build(k => {
    const cv = new Cv(78, 56, k);
    const gy = 47, x0 = 10, amp = k.amp, top = gy - 20;
    const glow = new PixelBuffer(cv.w, cv.h);
    const crate = (x: number, seed: number) => {
      obox(cv, x, gy - 16, 14, 16, 5, RP.wood, { planks: 4, seed });
      cv.nail(x + 1, gy - 15); cv.nail(x + 12, gy - 15); cv.nail(x + 1, gy - 3); cv.nail(x + 12, gy - 3);
      cv.contact(x + 7, gy + 1, 8, 1.5);
    };
    crate(x0 + 2, 81); crate(x0 + 40, 82);
    stencil(cv, x0 + 6, gy - 11, ['..#..', '.###.', '#####', '..#..', '..#..'], RP.black[2], 0.25, 2);
    // the battery on the ground by the right crate, its LED
    obox(cv, x0 + 46, gy - 7, 10, 7, 3, RP.black, { seed: 6 });
    cv.rect(x0 + 47, gy - 9, 2, 1, RP.red[4]); cv.rect(x0 + 53, gy - 9, 2, 1, RP.black[5]);
    cv.set(x0 + 51, gy - 5, hex('#6ae080')); glow.set(x0 + 51, gy - 5, hex('#80ff90'));
    // coiled red wire in front of the left crate
    for (let i = 0; i < 3; i++) cv.ell(x0 + 11, gy - 1.5 - i * 0.6, 5 - i * 0.5, 1.8, (nx, ny, x, y) => (Math.hypot(nx, ny) < 0.55 ? -1 : cv.tone(RP.red, 0.5 + (ny < 0 ? 0.2 : -0.12), x, y, 0.3)));
    // the board
    obox(cv, x0, top, 56, 3, 6, RP.teak, { seed: 84, tex: (f, u, v, px) => (f === 'top' && (px - x0) % 14 === 0 ? -0.18 : 0) });
    cv.occlude(x0 + 9, gy - 16, 8, 2, 0.35); cv.occlude(x0 + 47, gy - 16, 8, 2, 0.35);
    // an oily rag tucked under the left end, flapping
    for (let j = 0; j < 9; j++) {
      const v = j / 8, off = amp * (1 + 1.3 * cv.wave(v * 0.7, 1, 1.2)) * v;
      for (let i = 0; i < 5; i++) cv.t(Math.round(x0 - 2 + i + off), top + 3 + j, RP.cream, 0.5 - v * 0.15 + (i === 0 ? -0.15 : 0) + (hash2(i, j, 2) < 0.2 ? -0.2 : 0), 0.5);
    }
    // the vice
    obox(cv, x0 + 1, top - 5, 7, 5, 3, RP.steel, { seed: 7 });
    cv.rect(x0 + 8, top - 4, 3, 2, RP.steel[6]); cv.line(x0 + 10, top - 7, x0 + 10, top - 1, RP.steel[3]);
    // the gutted radio, lid off, a circuit board standing in it
    obox(cv, x0 + 13, top - 8, 14, 8, 4, RP.black, { seed: 8 });
    cv.rect(x0 + 15, top - 12, 8, 5, hex('#2a6a4a'));
    for (const [px, py, c] of [[16, -11, '#e8b840'], [18, -10, '#c8c8c8'], [20, -11, '#3a3a3a'], [21, -9, '#e8b840'], [17, -9, '#b85a3a']] as const) cv.set(x0 + px, top + py, hex(c));
    cv.set(x0 + 16, top - 11, hex('#ffd060')); glow.set(x0 + 16, top - 11, hex('#ffd060'));
    cv.rect(x0 + 15, top - 5, 10, 1, RP.steel[5]); cv.rect(x0 + 15, top - 3, 6, 1, RP.steel[3]);
    // desk lamp on a bent arm, its shade throwing a pool of light
    cv.line(x0 + 30, top - 1, x0 + 33, top - 10, (t, x, y) => cv.tone(RP.steel, 0.55, x, y, 0.2));
    cv.line(x0 + 33, top - 10, x0 + 38, top - 12, (t, x, y) => cv.tone(RP.steel, 0.55, x, y, 0.2));
    cv.ell(x0 + 30, top - 1, 2.6, 1, (nx, ny, x, y) => cv.tone(RP.steel, 0.5 - ny * 0.2, x, y, 0.2));
    cv.poly([x0 + 36, top - 14, x0 + 42, top - 13, x0 + 42, top - 9, x0 + 36, top - 10], (x, y) => cv.tone(RP.brass, 0.62 + (y < top - 12 ? 0.18 : 0) + (x > x0 + 40 ? -0.15 * -k.lx : 0), x, y, 0.4));
    cv.poly([x0 + 36, top - 10, x0 + 42, top - 9, x0 + 41, top - 8, x0 + 36, top - 9], hex('#fff0b0'));
    const g2 = new Cv(cv.w, cv.h, k);
    g2.poly([x0 + 36, top - 10, x0 + 42, top - 9, x0 + 41, top - 8, x0 + 36, top - 9], hex('#fff0b0'));
    for (let x = x0 + 34; x < x0 + 44; x++) g2.set(x, top - 1, mix(hex('#000000'), hex('#a08040'), 1 - Math.abs(x - x0 - 39) / 5));
    // soldering iron on its coil stand, the hot tip
    cv.ell(x0 + 47, top - 1, 3, 1.4, (nx, ny, x, y) => cv.tone(RP.steel, 0.4 - ny * 0.2, x, y, 0.2));
    for (let i = 0; i < 4; i++) cv.set(x0 + 46 + i, top - 3 - (i & 1), RP.steel[5]);
    cv.line(x0 + 44, top - 3, x0 + 53, top - 7, (t, x, y) => (t < 0.45 ? cv.tone(RP.blue, 0.5, x, y, 0.2) : RP.steel[5]));
    cv.set(x0 + 54, top - 8, hex('#ff8a3a'));
    // jar of screws, the crab toy
    for (let y = top - 6; y < top; y++) for (let x = x0 + 26; x < x0 + 29; x++) cv.set(x, y, (x + y) % 2 ? mix(RP.glass[5], RP.steel[5], 0.4) : mix(RP.glass[4], RP.brass[5], 0.4));
    cv.rect(x0 + 26, top - 7, 3, 1, RP.red[3]);
    cv.ball(x0 + 50, top - 2, 2.2, 1.4, RP.orange, {});
    cv.set(x0 + 48, top - 3, RP.orange[5]); cv.set(x0 + 52, top - 3, RP.orange[5]);
    const gb = g2.b;
    for (let i = 0; i < gb.data.length; i++) if (gb.data[i] >>> 24 && !(glow.data[i] >>> 24)) glow.data[i] = gb.data[i];
    glow.set(x0 + 54, top - 8, hex('#ffb060'));
    cv.ao(gy, 3, 0.28);
    return { cv, ax: x0 + 29, ay: gy, glow };
  }, { frames: 6, shadow: { w: 62, a: 0.38 } });
}

// ------------------------------------------------------------------ the camp board

/** the camp board: a plank notice board on two driftwood posts under a little flax roof, with pinned
 *  notes (crew requests on the left, the agency's printouts on the right) lifting in the wind */
export function campBoard(): CampSprite {
  return build(k => {
    const cv = new Cv(50, 60, k);
    const gy = 52, x0 = 8, amp = k.amp;
    cv.cyl(x0 + 4, gy, x0 + 4, gy - 44, 1.3, RP.drift, { grain: 0.3, seed: 1, knots: 0.4 });
    cv.cyl(x0 + 30, gy, x0 + 30.5, gy - 44, 1.3, RP.drift, { grain: 0.3, seed: 2, knots: 0.4 });
    // the board: three planks, nailed
    obox(cv, x0 + 1, gy - 42, 32, 21, 2, RP.wood, { planks: 7, seed: 91 });
    for (const yy of [1, 8, 15]) { cv.nail(x0 + 3, gy - 42 + yy + 2); cv.nail(x0 + 30, gy - 42 + yy + 2); }
    // the roof: two rows of flax blades over a crossbar
    cv.cyl(x0 - 1, gy - 44, x0 + 35, gy - 44, 1, RP.drift, { seed: 3 });
    for (let row = 1; row >= 0; row--) for (let b = 0; b < 9; b++) {
      const side = b < 4.5 ? -1 : 1;
      const bx = x0 + 17 + (b - 4) * 0.4, by = gy - 51 + row * 1.6;
      const len = 19 - Math.abs(b - 4) * 1.3 + row;
      const ang = side * (1.12 + (b % 2) * 0.08) + (row ? amp * 0.06 * cv.wave(b * 0.1) : 0);
      cv.hang(bx + (b - 4) * 0.9, by + Math.abs(b - 4) * 0.5, len, ang, u => 1.3 - u * 0.5, (u, v, x, y) => cv.tone(RP.flax, 0.62 - row * 0.12 - u * 0.12 + (v < -0.3 ? 0.12 : v > 0.4 ? -0.12 : 0), x, y, 0.35));
    }
    // fringe tips
    for (let i = 0; i < 8; i++) {
      const fx = x0 - 1 + i * 5.2, fy = gy - 46 + Math.abs(fx - x0 - 17) * 0.05;
      cv.hang(fx, fy, 4 + (i % 3), 0.2 + amp * (0.25 + 0.2 * cv.wave(i * 0.12)), () => 0.7, (u, v, x, y) => cv.tone(RP.flax, 0.4 - u * 0.1, x, y, 0.3));
    }
    // notes: paper, ruled with scribble, a pin, the free bottom corner lifting
    const note = (x: number, y: number, w: number, h: number, rp: Ramp, pin: C, i: number) => {
      const lift = amp * (0.6 + 0.6 * cv.wave(i * 0.21, 1, 1.3));
      for (let j = 0; j < h; j++) for (let q = 0; q < w; q++) {
        const v = j / (h - 1), u = q / (w - 1);
        const curl = v > 0.6 && u > 0.5 ? lift * (v - 0.6) * (u - 0.5) * 6 : 0;
        const px = x + q + Math.round(curl * 0.5), py = y + j - Math.round(curl);
        let l = 0.62 - curl * 0.12 + (j === 0 ? 0.08 : 0);
        if (j > 1 && j % 2 === 0 && q > 0 && q < w - 1 && hash2(q, j + i * 7, i) > 0.3) l -= 0.3;
        cv.t(px, py, rp, l, 0.3);
      }
      cv.occlude(x + w / 2 + 1, y + h, w / 2, 1.2, 0.25);
      cv.set(x + Math.floor(w / 2), y, pin); cv.set(x + Math.floor(w / 2) + 1, y + 1, shade(pin, -0.4));
    };
    note(x0 + 3, gy - 40, 7, 8, RP.paper, hex('#d4523a'), 0);
    note(x0 + 11, gy - 39, 6, 7, ramp6('#f0d0e0'), hex('#3a78c0'), 1);
    note(x0 + 4, gy - 30, 6, 7, ramp6('#d8e8c0'), hex('#e8b840'), 2);
    note(x0 + 19, gy - 40, 9, 10, RP.white, hex('#3a9a9a'), 3);
    note(x0 + 18, gy - 28, 8, 5, RP.white, hex('#3a9a9a'), 4);
    // a feather tucked in the corner (Aroha's)
    cv.line(x0 + 29, gy - 41, x0 + 33, gy - 35, (t, x, y) => cv.tone(RP.cream, 0.8 - t * 0.3, x, y, 0.2));
    cv.set(x0 + 30, gy - 40, RP.black[3]);
    cv.ao(gy, 3, 0.25);
    return { cv, ax: x0 + 17, ay: gy };
  }, { frames: 6, shadow: { w: 34, a: 0.3 } });
}

/** a 6-step ramp around one paper colour */
function ramp6(h: string): Ramp {
  const c = hex(h);
  return [shade(c, -0.55), shade(c, -0.4), shade(c, -0.25), shade(c, -0.12), c, shade(c, 0.12)];
}

// ------------------------------------------------------------------ the trail sign

/** the trail sign at the east end of camp: a post with two arrow boards (painted with a hill and a wave),
 *  a coil of rope on a nail and a strip of red cloth tied round the top, streaming */
export function trailSign(): CampSprite {
  return build(k => {
    const cv = new Cv(48, 56, k);
    const gy = 48, x0 = 8;
    cv.cyl(x0 + 15, gy, x0 + 15.5, gy - 38, 1.8, RP.drift, { grain: 0.35, seed: 5, knots: 0.4 });
    const board = (y: number, dir: number, seed: number, icon: string[], ic: C) => {
      const xa = x0 + (dir > 0 ? 2 : 6), xb = x0 + (dir > 0 ? 24 : 28);
      const tip = dir > 0 ? xb + 4 : xa - 4;
      const pts = dir > 0 ? [xa, y, xb, y, tip, y + 3.5, xb, y + 7, xa, y + 7] : [xb, y, xa, y, tip, y + 3.5, xa, y + 7, xb, y + 7];
      cv.poly(pts, (x, yy) => {
        let l = cv.lam(0, 0, 1) + (yy === y ? 0.15 : yy === y + 6 ? -0.18 : 0) + (noise2(x * 0.15, yy * 1.2, seed) - 0.5) * 0.3;
        if ((x + seed) % 9 === 0 && yy > y && yy < y + 6) l -= 0.08;
        return cv.tone(RP.wood, l + 0.12, x, yy, 0.45);
      });
      // the painted arrow line and the icon
      for (let x = xa + 2; x < xb - 1; x++) if (hash2(x, y, seed) > 0.15) cv.set(x, y + 3, mix(cv.get(x, y + 3) | 0xff000000, RP.paper[5], 0.8));
      stencil(cv, dir > 0 ? xa + 2 : xb - 2 - icon[0].length, y + 1, icon, ic, 0.15, seed);
      cv.nail(x0 + 15, y + 3);
    };
    board(gy - 37, 1, 3, ['..#..', '.###.', '#####'], RP.olive[5]);
    board(gy - 27, -1, 4, ['.#..#', '#.##.'], RP.blue[5]);
    // the rope coil hung on a nail
    for (let i = 0; i < 3; i++) cv.ell(x0 + 15, gy - 14 + i * 0.5, 4.6 - i * 0.6, 3.4 - i * 0.3, (nx, ny, x, y) => (Math.hypot(nx, ny) < 0.62 ? -1 : cv.tone(RP.rope, 0.55 + (ny < 0 ? 0.15 : -0.15) - (x * k.lx > 0 ? 0.1 : 0) + ((x + y + i) % 3 === 0 ? -0.1 : 0), x, y, 0.3)));
    cv.nail(x0 + 15, gy - 17);
    // the red marker cloth round the top of the post
    cv.lash(x0 + 15, gy - 38, 1, 2);
    cv.streamer(x0 + 17, gy - 39, 11, 2.6, 1.2, RP.red, { droop: 5, flap: 1.8 });
    cv.ao(gy, 3, 0.25);
    return { cv, ax: x0 + 15, ay: gy };
  }, { frames: 6, shadow: { w: 20, a: 0.3 } });
}

// ------------------------------------------------------------------ the fishing rock

/** the fishing rock: a flat-topped boulder at the edge of the beach, lichened on top and wet below with
 *  a glossy waterline, barnacles and weed, and Joshu's dented bait tin */
export function fishRock(): CampSprite {
  return build(k => {
    const cv = new Cv(60, 42, k);
    const gy = 34, x0 = 8;
    const outline = [x0 + 2, gy, x0 + 4, gy - 15, x0 + 10, gy - 21, x0 + 30, gy - 23, x0 + 38, gy - 19, x0 + 43, gy - 11, x0 + 43, gy];
    const hgt = (x: number, y: number) => {
      const cx = x0 + 23, cy = gy - 6;
      const nx = (x - cx) / 22, ny = (y - cy) / 18;
      return Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny * 0.6)) * 14 + (noise2(x * 0.18, y * 0.18, 5) - 0.5) * 6 + (y < gy - 20 ? (gy - 20 - y) * -2 : 0);
    };
    cv.poly(outline, (x, y) => {
      let l = cv.field(hgt, x + 0.5, y + 0.5, 1);
      const wet = y > gy - 10 + noise1(x * 0.3, 2) * 2;
      if (y < gy - 19 && hash2(x, y, 4) < 0.3) return cv.tone(RP.olive, 0.5 + l * 0.3, x, y, 0.4);
      if (wet) {
        // darker and glossy where the swash keeps it wet, with a bright wet line along the top
        const wl = gy - 10 + noise1(x * 0.3, 2) * 2;
        l = l * 0.62 - 0.06 + (Math.abs(y - wl) < 1 ? 0.3 : 0) + (hash2(x, y, 6) < 0.05 ? 0.25 : 0);
        return cv.tone(RP.stone, l, x, y, 0.5);
      }
      return cv.tone(RP.stone, l + (hash2(x, y, 9) < 0.05 ? 0.15 : 0), x, y, 0.5);
    });
    // cracks
    cv.line(x0 + 12, gy - 16, x0 + 18, gy - 10, (t, x, y) => cv.tone(RP.stone, 0.1, x, y, 0.2));
    cv.line(x0 + 26, gy - 18, x0 + 30, gy - 13, (t, x, y) => cv.tone(RP.stone, 0.1, x, y, 0.2));
    // barnacles and weed at the waterline
    for (const x of [6, 11, 17, 24, 31, 37]) { cv.set(x0 + x, gy - 8 + (x % 3), RP.cream[4]); cv.set(x0 + x + 1, gy - 8 + (x % 3), RP.cream[2]); }
    for (let i = 0; i < 9; i++) { const x = 3 + i * 4.6 + hash2(i, 1, 3) * 2, h = 2 + hash2(i, 2, 3) * 4; for (let y = gy - h; y <= gy; y++) cv.set(x0 + x + Math.round(Math.sin(y * 0.9 + i) * 0.6), y, cv.tone(RP.olive, 0.25 + (gy - y) * 0.07, x, y, 0.3)); }
    // the bait tin, dented, a red label
    obox(cv, x0 + 31, gy - 28, 6, 5, 2, RP.steel, { seed: 3, tex: (f, u, v) => (f === 'front' && v > 0.2 && v < 0.6 ? -0.05 : 0) });
    cv.rect(x0 + 31, gy - 26, 6, 1, RP.red[4]);
    cv.set(x0 + 33, gy - 24, RP.steel[2]);
    cv.ao(gy, 3, 0.3);
    return { cv, ax: x0 + 22, ay: gy };
  }, { shadow: { w: 46, a: 0.35 } });
}

/** a rod wedged in a crack (drawn on its own so Mori can take it) */
export function rodInRock(): CampSprite {
  const s = build(k => {
    const cv = new Cv(28, 50, k);
    const x0 = 6, gy = 44;
    // blank, cork grip, reel
    cv.line(x0 + 2, gy, x0 + 16, gy - 40, (t, x, y) => (t < 0.22 ? cv.tone(RP.flaxDry, 0.55 + ((x + y) % 2 ? 0.1 : 0), x, y, 0.3) : cv.tone(RP.black, 0.45 + (t > 0.6 ? 0.1 : 0), x, y, 0.2)));
    cv.line(x0 + 3, gy, x0 + 16, gy - 38, (t, x, y) => (t < 0.22 ? -1 : cv.tone(RP.black, 0.2, x, y, 0.2)));
    cv.ball(x0 + 5, gy - 7, 2.2, 2.2, RP.steel, {});
    cv.set(x0 + 4, gy - 8, RP.steel[7]);
    // guides
    for (const t of [0.4, 0.6, 0.8]) cv.set(x0 + 2 + 14 * t + 1, gy - 40 * t, RP.steel[6]);
    // the line hanging from the tip
    cv.line(x0 + 16, gy - 40, x0 + 17, gy - 26, (t, x, y) => (y % 2 ? hex('#e8e8f0') : -1));
    return { cv, ax: x0 + 3, ay: gy, noRim: true };
  });
  return s;
}

/** Joshu's cooking pot (carried to the fire for breakfast): a blackened billy with a bail and a lid */
export function pot(): CampSprite {
  return build(k => {
    const cv = new Cv(24, 20, k);
    const cx = 12, gy = 14;
    cv.ball(cx, gy - 4, 6.5, 4.6, RP.steel, { flat: 1.4, tex: (x, y) => (y > gy - 5 ? -0.35 : -0.05) + (hash2(x, y, 3) < 0.08 ? -0.15 : 0) });
    cv.ell(cx, gy - 8, 6.4, 1.6, (nx, ny, x, y) => cv.tone(RP.steel, 0.68 - ny * 0.2 + nx * -k.lx * 0.18, x, y, 0.4));
    cv.rect(cx - 1, gy - 10, 3, 1, RP.black[3]);
    for (let a = 0; a <= Math.PI; a += 0.08) cv.set(cx + Math.cos(a) * 7, gy - 7 - Math.sin(a) * 3.5, RP.steel[3]);
    return { cv, ax: cx, ay: gy };
  });
}

/** Aroha's slingshot target: a driftwood post with a white shell wedged on top, chipped where she hits it */
export function target(): CampSprite {
  return build(k => {
    const cv = new Cv(16, 40, k);
    const cx = 8, gy = 34;
    cv.cyl(cx, gy, cx + 0.5, gy - 23, 1.6, RP.drift, { grain: 0.35, seed: 4, knots: 0.5 });
    for (const y of [gy - 18, gy - 12, gy - 15]) cv.set(cx + (y % 2 ? 1 : -1), y, RP.drift[1]);
    cv.ball(cx + 0.5, gy - 26, 3.4, 2.4, RP.cream, { flat: 0.5, tex: (x) => (x % 2 ? 0.06 : -0.06) });
    cv.set(cx - 1, gy - 27, RP.orange[6]);
    cv.ao(gy, 3, 0.25);
    return { cv, ax: cx, ay: gy };
  }, { shadow: { w: 10, a: 0.3 } });
}

// ------------------------------------------------------------------ signal flags (bunting)

/** the Kittiwake's code flags, strung along the camp lights: [design][wind frame], each anchored at the
 *  middle of its top edge (the line) and rippling */
export function signalFlags(): { frames: PixelBuffer[][]; ax: number; ay: number } {
  const designs: ((u: number, v: number) => C)[] = [
    (u, v) => (v < 0.5 ? hex('#e8e2d4') : hex('#c83a2a')),                                   // H: white over red
    (u, v) => (Math.abs(u - 0.5) < 0.2 || Math.abs(v - 0.5) < 0.2 ? hex('#c83a2a') : hex('#e8e2d4')), // a red cross
    (u, v) => (Math.floor(v * 5) % 2 ? hex('#2a54a0') : hex('#e8c040')),                        // yellow and blue bands
    (u, v) => (Math.abs(u - 0.5) < 0.22 && Math.abs(v - 0.5) < 0.22 ? hex('#e8e2d4') : hex('#2a54a0')), // P: blue, white square
    (u, v) => (u + v < 1 ? hex('#e8c040') : hex('#c83a2a')),                                      // yellow / red diagonal
  ];
  const N = 4, W = 7, H = 8;
  const frames = designs.map(d => Array.from({ length: N }, (_, f) => {
    const b = new PixelBuffer(W + 6, H + 4);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const u = i / (W - 1), v = j / (H - 1);
      const ph = f / N;
      const ripple = Math.sin((ph - u * 0.8) * Math.PI * 2);
      const dx = Math.round(ripple * v * 0.8), dy = Math.round(Math.sin((ph - v * 0.7) * Math.PI * 2) * u * 0.6);
      let c = d(u, v);
      const l = Math.cos((ph - u * 0.8) * Math.PI * 2) * 0.16 - v * 0.08;
      c = shade(c, l);
      b.set(3 + i + dx, 1 + j + dy, c);
    }
    // the hoist line along the top
    for (let i = 0; i < W + 2; i++) b.set(2 + i, 0, hex('#3a3026'));
    b.outline(c => mix(shade(c, -0.6), hex('#140e12'), 0.4));
    return b;
  }));
  return { frames, ax: Math.round((W + 6) / 2), ay: 0 };
}

void noise1;

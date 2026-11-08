// V12 Te Kāinga's family houses, rebuilt (user: "the house looks ugly, make it better, no simple blocky
// shapes"). Each whare is seen a little from the side, so it has a body: the gable end facing us (in the
// wall's own material, raupō bundles or adzed slabs, under bargeboards), the side wall going back in
// shadow, and the side of the roof running back in perspective. Nothing is a straight-edged block:
//   the roof    thatch laid in courses whose lower edges are ragged, the ridge sagging a little between
//               its ends and capped with a rolled bundle lashed with flax, the thatch's thickness showing
//               as a fringe over the bargeboards, weathered grey toward the top, moss and a fern on it,
//               a patch of new gold thatch; or salvaged corrugated iron in overlapping sheets of
//               different ages, nail rows, rust running down from the nails, a stone holding a corner
//   the walls   raupō bundles that bow between lashed vertical battens, reed tips at the corners; or
//               adzed slabs of uneven width, knots, splits, the grey weathering low down
//   the frame   barked corner posts with a lean and a swelling at the foot, a stone and earth footing
//   the front   a plank door standing ajar under a carved lintel, a log step; a window with a shutter
//               propped open on a stick; on the porch, whatever lives on a porch
// The window stays where the night's lit-window overlay expects it (anchor + 14, ground - 38).

import { PixelBuffer } from '../../pixel';
import { hex } from '../../color';
import type { C } from '../../color';
import type { Sprite } from '../../jungle-core';
import { Rng, bayer, clamp } from '../../../core/math';
import { VP } from './props';

const pick = (r: C[], v: number) => r[clamp(Math.round(v), 0, r.length - 1)];
const dp = (r: C[], v: number, x: number, y: number) => pick(r, v + (bayer(x, y) - 0.5) * 0.9);
const h01 = (x: number, y: number, s: number) => {
  let n = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
const DARK = hex('#0c0705');
const MOSS = [hex('#1e3014'), hex('#2e481a'), hex('#466a22'), hex('#62902e'), hex('#86b240')];
const FRESH = [hex('#5a4416'), hex('#8a6a22'), hex('#b8922e'), hex('#d8b448'), hex('#f0d474')];

type Mat = 'raupo' | 'slab';

export function whare12(variant: number, seed: number): Sprite {
  const sizes: [number, number][] = [[112, 104], [98, 96], [128, 108], [92, 92]];
  const [w, h] = sizes[variant % sizes.length];
  const SD = Math.round(w * 0.2); // how far the side goes back
  const RISE = Math.round(SD * 0.32); // and how much it rises with it
  const OV = 10; // the eaves' overhang
  const W = w + SD + OV * 2 + 16, H = h + 44;
  const b = new PixelBuffer(W, H);
  const rng = new Rng(seed * 13 + variant);
  const cx = Math.floor((w + OV * 2 + 10) / 2) + 2, base = H - 2;
  const fx0 = Math.round(cx - w / 2), fx1 = Math.round(cx + w / 2);
  const wallH = Math.round(h * 0.5), roofH = Math.round(h * 0.56);
  const wallTop = base - wallH;
  const apexY = wallTop - roofH, eaveY = wallTop + 3;
  const mat: Mat = variant % 2 === 0 ? 'slab' : 'raupo';
  const iron = variant === 3;
  const thatchR = variant === 1 ? VP.raupo : VP.thatch;
  // the roof's front edge: from the apex down to the eaves, a gentle bell (steeper near the ridge)
  const halfR = w / 2 + OV;
  const edgeY = (x: number) => { const t = clamp(Math.abs(x - cx) / halfR); return apexY + (eaveY - apexY) * (t * 0.82 + t * t * 0.18) + Math.sin(t * Math.PI) * 1.2; };

  // ---------------------------------------------------------------- the footing: earth and stones
  for (let x = fx0 - 4; x <= fx1 + SD + 2; x++) {
    const back = clamp((x - fx1) / SD), top = base - 3 - Math.round(back * RISE * 0.3) + (h01(x, 1, seed) > 0.7 ? -1 : 0);
    for (let y = top; y <= base; y++) b.set(x, y, dp(VP.soil, 2.2 + (y === top ? 1.4 : 0) - back * 0.8, x, y));
  }
  for (let i = 0; i < Math.round(w / 9); i++) {
    const sx = fx0 + rng.int(0, w + SD - 4), r = 1.5 + rng.next() * 2.2, sy = base - 1;
    for (let y = -r; y <= 0.5; y++) for (let x = -r * 1.4; x <= r * 1.4; x++) if ((x / (r * 1.4)) ** 2 + (y / r) ** 2 <= 1) b.set(Math.round(sx + x), Math.round(sy + y), dp(VP.stone, 3.4 - y * 0.2 - x / r * 0.6, sx + x, sy + y));
  }

  // ---------------------------------------------------------------- the side wall going back (in shadow)
  const sideTop = (x: number) => wallTop - (x - fx1) / SD * RISE;
  const sideBot = (x: number) => base - 3 - (x - fx1) / SD * RISE * 0.35;
  for (let x = fx1; x <= fx1 + SD; x++) {
    const u = (x - fx1) / SD;
    for (let y = Math.round(sideTop(x)); y <= sideBot(x); y++) {
      let v = 1.6 - u * 0.4;
      if (mat === 'raupo') { const band = (y - sideTop(x)) / 4 + u * 1.2; v += (band % 1 < 0.25 ? -0.6 : 0.2) + Math.sin(x * 2.1 + y * 0.3) * 0.15; }
      else v += ((x + Math.round(y * 0.05)) % 5 === 0 ? -0.7 : 0) + (h01(x, y >> 2, seed) - 0.5) * 0.4;
      b.set(x, y, dp(mat === 'raupo' ? VP.raupo : VP.wood, v, x, y));
    }
  }
  // a stack of firewood against the side wall
  if (variant !== 3) for (let k = 0; k < 4; k++) for (let i = 0; i < 5 - (k & 1); i++) {
    const lx = fx1 + 3 + i * 4 + (k & 1) * 2, ly = base - 4 - k * 3;
    for (let a = 0; a < 8; a++) { const ang = (a / 8) * Math.PI * 2; b.set(Math.round(lx + Math.cos(ang) * 1.6), Math.round(ly + Math.sin(ang) * 1.3), VP.bark[2]); }
    b.set(lx, ly, VP.wood[4]); b.set(lx - 1, ly, VP.wood[3]); b.set(lx, ly - 1, VP.wood[5]);
  }

  // ---------------------------------------------------------------- the side of the roof running back
  // every point of it is a point on the gable's right edge E(t) (t 0 at the ridge, 1 at the eave) pushed
  // back along the ridge by s (0 the front, 1 the back): courses run along t, the light falls off with s
  const E = (t: number): [number, number] => { const x = cx + t * halfR; return [x, edgeY(x)]; };
  const back = (sv: number): [number, number] => [sv * SD, -sv * RISE + Math.sin(sv * Math.PI) * 1.2]; // the ridge sags between its ends
  const nT = Math.ceil(roofH * 2.4), nS = Math.ceil(SD * 2.4);
  for (let ti = 0; ti <= nT; ti++) for (let si = 0; si <= nS; si++) {
    const t = ti / nT, sv = si / nS;
    const [ex, ey] = E(t), [bx, by] = back(sv * (1 - t * 0.04));
    const X = Math.round(ex + bx), Y = Math.round(ey + by);
    if (iron) {
      const sheet = Math.floor(sv * 4 + h01(Math.floor(t * 3), 0, seed) * 0.5);
      const rib = Math.round(sv * SD) % 4 === 0;
      const rust = h01(Math.floor(sv * SD / 2), Math.floor(t * roofH / 3), seed + 3) > 0.8 || (t > 0.3 && h01(Math.floor(sv * SD), 7, seed) > 0.86);
      const v = 3 - (rib ? 1 : 0) - sv * 0.6 + (sheet % 2 ? 0.3 : -0.2) + (Math.round(t * roofH) % 12 === 0 ? -0.8 : 0);
      b.set(X, Y, rust ? dp(VP.rust, 2.4 + (rib ? -0.8 : 0) + t * 0.5, X, Y) : dp(VP.iron, v, X, Y));
    } else {
      const row = t * roofH;
      const course = (row + h01(Math.floor(sv * SD / 3), 0, seed) * 2.5) % 6;
      const grey = clamp(1 - t * 2.2) * 0.7;
      const v = 2.7 - sv * 0.9 + (course > 5 ? -1.4 : course < 1 ? 0.6 : 0) - grey + (h01(X, Y, seed) > 0.92 ? -0.7 : 0);
      b.set(X, Y, dp(thatchR, v, X, Y));
    }
  }
  // the back edge of the roof: its ragged eave line and the far bargeboard's end
  for (let ti = 0; ti <= nT; ti++) {
    const t = ti / nT, [ex, ey] = E(t), [bx, by] = back(1);
    const X = Math.round(ex + bx), Y = Math.round(ey + by);
    b.set(X + 1, Y, iron ? VP.iron[1] : thatchR[1]);
    if (!iron && h01(ti, 3, seed) > 0.5) b.set(X + 2, Y + 1, thatchR[2]);
  }
  for (let si = 0; si <= nS; si++) {
    const [ex, ey] = E(1), [bx, by] = back(si / nS);
    for (let k = 1; k <= 2; k++) if (!iron || k === 1) b.set(Math.round(ex + bx), Math.round(ey + by) + k, iron ? VP.iron[1] : (h01(si, k, seed) > 0.3 ? thatchR[1] : 0));
  }
  const ridge = (x: number) => { const sv = clamp((x - cx) / SD); return apexY + back(sv)[1]; };

  // ---------------------------------------------------------------- the front: the wall and the gable end
  const inFront = (x: number, y: number) => x >= fx0 && x <= fx1 && y <= base - 3 && y >= Math.min(wallTop, edgeY(x) + 4);
  for (let x = fx0; x <= fx1; x++) for (let y = Math.round(edgeY(x) + 3); y <= base - 3; y++) {
    if (!inFront(x, y)) continue;
    const u = (x - fx0) / w;
    let c: C;
    if (mat === 'raupo') {
      // horizontal raupō bundles that bow a little between the battens
      const bat = Math.round(w / 9);
      const bi = Math.floor((x - fx0) / bat), bu = ((x - fx0) % bat) / bat;
      const sag = Math.sin(bu * Math.PI) * 1.2;
      const yy = y - sag;
      const band = ((yy - wallTop + 400) % 5) / 5;
      let v = 3.1 - u * 0.7 + (band < 0.22 ? -1.1 : band > 0.75 ? 0.4 : 0) + Math.sin(x * 1.9 + y * 0.4 + bi) * 0.18;
      // the battens (kākaho canes, lashed)
      if ((x - fx0) % bat === 0 || (x - fx0) % bat === 1) { c = (x - fx0) % bat === 0 ? VP.wood[3] : VP.wood[2]; if ((y + bi) % 7 === 0) c = VP.flax[2]; b.set(x, y, c); continue; }
      c = dp(VP.raupo, v, x, y);
    } else {
      // adzed slabs of uneven width
      let sx = fx0, sw = 0, si = 0;
      const r2 = new Rng(seed + 41);
      while (sx <= x) { sw = 5 + r2.int(0, 3); if (sx + sw > x) break; sx += sw; si++; }
      const su = (x - sx) / sw;
      let v = 2.7 + (si % 3) * 0.25 - u * 0.6 + (su < 0.15 ? -1.2 : su > 0.85 ? -0.5 : 0);
      if (Math.sin(y * 0.9 + si * 2.3) > 0.9 && su > 0.2 && su < 0.8) v -= 0.6; // adze marks
      if (h01(si, Math.floor(y / 9), seed) > 0.9 && Math.abs(su - 0.5) < 0.3) v -= 1.2; // a knot
      const greyK = clamp((y - (base - 14)) / 12);
      c = greyK > 0.3 && h01(x, y, seed + 2) < greyK ? dp(VP.grey, 2.6 + (su < 0.15 ? -1 : 0), x, y) : dp(VP.wood, v, x, y);
      if (h01(si, 3, seed) > 0.8 && Math.abs(su - 0.6) < 0.06 && y > wallTop + 6) c = VP.wood[0]; // a split
    }
    b.set(x, y, c);
  }
  // reed tips poking out at the corners (raupō)
  if (mat === 'raupo') for (let y = wallTop; y < base - 3; y += 2) { b.set(fx0 - 1, y, VP.raupo[4]); if (h01(y, 1, seed) > 0.5) b.set(fx0 - 2, y + 1, VP.raupo[3]); }

  // ---------------------------------------------------------------- the thatch's edge and the bargeboards
  for (let x = fx0 - OV; x <= fx1 + OV; x++) {
    const ey = edgeY(x);
    if (!iron) {
      // the thickness of the thatch showing over the bargeboard: bundle ends, ragged
      const th = 4 + Math.round(h01(x, 2, seed) * 2);
      for (let k = 0; k < th; k++) b.set(x, Math.round(ey - 2 - k), dp(thatchR, 3.6 - k * 0.35 + (h01(x, k, seed) > 0.8 ? -1 : 0) - clamp(1 - (ey - apexY) / roofH) * 0.5, x, ey - k));
      if (h01(x, 9, seed) > 0.55) b.set(x, Math.round(ey + 2), thatchR[2]); // stray ends below
    } else {
      for (let k = 0; k < 3; k++) b.set(x, Math.round(ey - 1 - k), k === 2 ? VP.iron[5] : VP.iron[3]);
    }
    // the bargeboard: a timber running down each side, ochre on the bigger houses, its lower end carved
    const ochre = variant === 0 || variant === 2;
    for (let k = 0; k < 3; k++) {
      const c = ochre ? (k === 0 ? VP.ochre[4] : k === 1 ? VP.ochre[3] : VP.ochre[1]) : (k === 0 ? VP.wood[4] : k === 1 ? VP.wood[3] : VP.wood[1]);
      if (Math.abs(x - cx) < 2 && k === 0) continue;
      b.set(x, Math.round(ey + k), c);
    }
    if (ochre && Math.round(x - cx) % 5 === 0) b.set(x, Math.round(ey + 1), VP.ochre[0]); // notches
  }
  // the bargeboards' carved ends (raparapa): little spiralled fingers at the eaves
  for (const s of [-1, 1]) {
    const ex = Math.round(cx + s * halfR), ey = Math.round(edgeY(cx + s * halfR));
    for (let k = 0; k < 6; k++) { b.set(ex + s * Math.round(k * 0.4), ey + k, variant === 0 || variant === 2 ? VP.ochre[3] : VP.wood[3]); if (k > 2) b.set(ex + s * (Math.round(k * 0.4) + 1), ey + k, VP.wood[1]); }
  }
  // the ridge: a rolled bundle lashed with flax, running back from the apex (or an iron ridge cap)
  for (let x = cx - 2; x <= cx + SD + 2; x++) {
    const y = Math.round(ridge(Math.min(x, cx + SD)));
    for (let k = -2; k <= 1; k++) b.set(x, y + k, iron ? (k < 0 ? VP.iron[5] : VP.iron[2]) : dp(thatchR, 3.6 - k * 0.6, x, y + k));
    if (!iron && (x - cx) % 6 === 0) for (let k = -2; k <= 1; k++) b.set(x, y + k, VP.flax[2]);
  }
  // weathering on the roof: moss cushions, a fern, a patch of new gold thatch (or a stone on the iron)
  if (!iron) {
    for (let i = 0; i < 4 + variant; i++) {
      const [ex, ey] = E(0.25 + rng.next() * 0.6), [bx, by] = back(0.25 + rng.next() * 0.6);
      const mx = Math.round(ex + bx), my = Math.round(ey + by);
      for (let k = -2; k <= 2; k++) for (let j = -1; j <= 0; j++) if (h01(mx + k, my + j, seed) > 0.25) b.set(mx + k, my + j, MOSS[2 + j + (k === 0 ? 1 : 0)]);
      b.set(mx, my - 2, MOSS[4]);
    }
    // a patch of new gold thatch, laid in its own short courses
    for (let ti = 0; ti < 14; ti++) for (let si = 0; si < 10; si++) {
      const [ex, ey] = E(0.4 + ti / 70), [bx, by] = back(0.35 + si / 40);
      const X = Math.round(ex + bx), Y = Math.round(ey + by);
      // ragged all round: the new bundles end unevenly where they meet the old thatch
      const edge = Math.min(ti, 13 - ti, si * 1.4, (9 - si) * 1.4);
      if (edge < 2.2 && h01(ti, si, seed + 9) > edge / 2.2) continue;
      b.set(X, Y, dp(FRESH, 2.4 - si * 0.08 + (ti % 5 === 4 ? -1.2 : 0.3) - (edge < 3 ? 0.6 : 0), X, Y));
    }
  } else {
    const [sex, sey] = E(0.55), [sbx, sby] = back(0.7);
    const sx = Math.round(sex + sbx), sy = Math.round(sey + sby);
    for (let y = -3; y <= 0; y++) for (let x = -4; x <= 4; x++) if ((x / 4) ** 2 + (y / 3) ** 2 <= 1) b.set(sx + x, sy + y, dp(VP.stone, 3.2 - y * 0.3 - x * 0.15, sx + x, sy + y));
    // rust streaks running down the front edge
    for (let i = 0; i < 6; i++) { const x = fx0 + rng.int(0, w); const y0 = Math.round(edgeY(x) + 3); for (let y = y0; y < y0 + 3 + rng.int(0, 5); y++) if (b.get(x, y)) b.set(x, y, VP.rust[2]); }
  }

  // ---------------------------------------------------------------- the corner posts
  for (const [px0, lean] of [[fx0, -0.04], [fx1, 0.03]] as [number, number][]) {
    for (let y = Math.round(edgeY(px0) + 1); y <= base - 2; y++) {
      const foot = clamp((y - (base - 8)) / 8);
      const r = 2 + foot * 1.2;
      const xc = px0 + (base - y) * lean;
      for (let k = -r; k <= r; k++) {
        const X = Math.round(xc + k);
        b.set(X, y, dp(VP.bark, 3.6 - (k + r) / (2 * r) * 2.4 + (h01(X, y >> 1, seed) > 0.85 ? -1 : 0), X, y));
      }
    }
  }

  // ---------------------------------------------------------------- the door, ajar, under a carved lintel
  const dw = 20, dh = 44;
  const dx = cx - 10 + (variant === 2 ? -18 : -8);
  for (let y = base - dh; y <= base - 3; y++) for (let x = dx; x < dx + dw; x++) b.set(x, y, x < dx + 7 ? hex('#160e0a') : DARK);
  // the door leaf swung in, seen edge-on at the left: planks with a cross brace
  for (let y = base - dh + 1; y <= base - 4; y++) for (let x = dx; x < dx + 6; x++) b.set(x, y, dp(VP.wood, 2.4 + (x - dx === 0 ? 1 : 0) - (x - dx) * 0.15 + ((y - (base - dh)) % 14 === 0 ? -1 : 0), x, y));
  for (let k = 0; k < 6; k++) b.set(dx + k, base - dh + 8 + k * 4, VP.wood[1]);
  // the jambs and the lintel board with its notches
  for (let y = base - dh - 1; y <= base - 3; y++) { b.set(dx - 1, y, VP.wood[3]); b.set(dx - 2, y, VP.wood[2]); b.set(dx + dw, y, VP.wood[2]); b.set(dx + dw + 1, y, VP.wood[1]); }
  for (let x = dx - 4; x < dx + dw + 4; x++) for (let k = 0; k < 4; k++) {
    let c = k === 0 ? VP.wood[5] : k === 3 ? VP.wood[1] : (variant === 0 || variant === 2 ? VP.ochre[3] : VP.wood[3]);
    if (k > 0 && k < 3 && (x - dx) % 4 === 0) c = VP.ochre[0];
    b.set(x, base - dh - 5 + k, c);
  }
  // a log step and a flax mat at the door
  for (let x = dx - 3; x < dx + dw + 3; x++) for (let k = 0; k < 3; k++) b.set(x, base - 2 + k - 1, k === 0 ? VP.bark[4] : VP.bark[2]);
  for (let x = dx + 2; x < dx + dw - 2; x++) b.set(x, base - 3, (x & 1) ? VP.flax[3] : VP.flax[2]);

  // ---------------------------------------------------------------- the window and its shutter (fixed place: the night lights it)
  const wx = dx + dw + 12, wy = base - 38;
  for (let y = wy; y < wy + 12; y++) for (let x = wx; x < wx + 14; x++) b.set(x, y, (x === wx + 7 || y === wy + 6) ? VP.wood[2] : DARK);
  for (let x = wx - 2; x < wx + 16; x++) { b.set(x, wy - 1, VP.wood[4]); b.set(x, wy - 2, VP.wood[2]); b.set(x, wy + 12, VP.wood[4]); b.set(x, wy + 13, VP.wood[1]); }
  for (let y = wy; y < wy + 12; y++) { b.set(wx - 1, y, VP.wood[3]); b.set(wx + 14, y, VP.wood[2]); }
  // the shutter swung up and propped on a stick
  for (let y = 0; y < 5; y++) for (let x = -1; x < 16; x++) b.set(wx + x + Math.round(y * 0.6), wy - 7 + y, dp(VP.wood, 3 - y * 0.3 + (x % 5 === 0 ? -1 : 0), wx + x, wy - 7 + y));
  for (let y = 0; y < 8; y++) b.set(wx + 13 - Math.round(y * 0.3), wy - 2 + y - 6 + 6, VP.wood[1]);
  if (variant === 2) for (let x = wx + 2; x < wx + 12; x++) for (let y = wy + 2; y < wy + 5; y++) if (x !== wx + 7) b.set(x, y, hex('#e8c060'));

  // ---------------------------------------------------------------- on the porch
  const porch = rng.next();
  // gumboots, toes out, bent at the ankle
  if (porch < 0.7) for (const [gx, gh] of [[dx - 15, 10], [dx - 10, 9]] as [number, number][]) {
    for (let y = 0; y < gh; y++) for (let x = 0; x < 4; x++) b.set(gx + x, base - 3 - y, y > gh - 2 ? hex('#2a2a26') : x === 0 ? hex('#3a3a36') : hex('#1a1a18'));
    for (let x = 4; x < 6; x++) for (let y = 0; y < 3; y++) b.set(gx + x, base - 3 - y, hex('#1a1a18'));
  }
  // a woven kete on the bench, a broom leaning on the wall
  if (variant !== 3) {
    const bx0 = Math.min(fx1 - 30, wx + 18), bx1 = bx0 + 24;
    for (let x = bx0; x < bx1; x++) { b.set(x, base - 14, VP.wood[4]); b.set(x, base - 13, VP.wood[2]); }
    for (const px of [bx0 + 2, bx1 - 3]) for (let y = base - 12; y <= base - 3; y++) b.set(px, y, VP.wood[2]);
    for (let y = 0; y < 7; y++) for (let x = -5 + (y < 2 ? 1 : 0); x <= 5 - (y < 2 ? 1 : 0); x++) b.set(bx0 + 10 + x, base - 15 - y, ((x + y) & 1) ? VP.flax[3] : VP.flax[2]);
    for (let a = 0; a < 12; a++) { const ang = Math.PI + (a / 11) * Math.PI; b.set(Math.round(bx0 + 10 + Math.cos(ang) * 4), Math.round(base - 22 + Math.sin(ang) * 3), VP.flax[1]); }
  }
  for (let y = 0; y < 30; y++) b.set(dx + dw + 4 + Math.round(y * 0.13), base - 33 + y, VP.wood[3]);
  for (let y = 0; y < 7; y++) for (let x = -3; x <= 3; x++) b.set(dx + dw + 8 + x + Math.round(y * 0.25), base - 9 + y, (x + y) & 1 ? VP.thatch[3] : VP.thatch[2]);
  b.outline(VP.ink);
  return { buf: b, ax: cx, ay: base };
}

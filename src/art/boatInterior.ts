// art/boatInterior.ts: the Kittiwake's rooms for the dollhouse cutaway (engine room, galley & mess,
// bunk room, hold / lab, wheelhouse).
//
// Value structure: the back walls, ceilings and bulkheads sit in the low-mid values with quiet
// texture (and the band behind the walking characters, roughly y 150..196, calmer still); the
// props in front are a step lighter, cel-shaded and ink-outlined so they read as objects. Each
// room has its own material: riveted green-grey steel (engine room), sage boards over a tiled
// splashback (galley), panelled ochre over a varnished wainscot (mess), warm teak (bunks), raw
// planking and frames (hold), and a mahogany-panelled wheelhouse.
//
// Everything is in boat-local pixels (see boat.ts); the story's spots, ladders, lamps and floors
// are fixed by BOAT_LAYOUT and ship5, and nothing here moves them.

import { PixelBuffer } from './pixel';
import { C, hex, rgba, shade, withAlpha } from './color';
import { Rng, hash2, noise1, noise2, smoothstep } from '../core/math';
import type { Obj } from './ship4/kit';
import {
  P, hullMask, lowCeil, BH, LOW_FLOOR, HOLD_FLOOR, WH_X0, WH_X1, WH_FLOOR, WH_CEIL, BOAT_H,
  ramp, dith, vline, hline, rope, ring, porthole, pixelText, sticker, rq, tint, shadeAt,
} from './boatKit';

type Lamp = { x: number; y: number; color: [number, number, number]; radius: number; name: string };
type Ladder = { x: number; y0: number; y1: number; name: string };

const floorAt = (x: number) => (x > BH.bunkHold + 4 ? HOLD_FLOOR : LOW_FLOOR);

// ------------------------------------------------------------------ walls, ceilings, floors

function engineWall(x: number, y: number, fy: number): C {
  const R = P.steelW;
  const gx = x - 76, gy = y - 120;
  const px = gx % 30, py = gy % 22;
  let f = 3 + (hash2(Math.floor(gx / 30), Math.floor(gy / 22), 3) - 0.5) * 0.45;
  if (px === 0 || py === 0) f -= 1.2;
  else if (px === 1 || py === 1) f += 0.5;
  // rivet rows along the plate seams (sparse, so the wall stays quiet)
  if (py === 2 && px % 5 === 3) f += 1.4;
  if (py === 3 && px % 5 === 3) f -= 0.8;
  if (px === 2 && py % 5 === 3) f += 1.2;
  const fr = (x - 88) % 24;
  if (fr === 0) f += 1.1;
  else if (fr === 1) f += 0.4;
  else if (fr === 2) f -= 1;
  // slow mottle and grime rising from the bilge; oil weeping down from the ceiling pipes
  f += (noise2(x * 0.06, y * 0.05, 7) - 0.5) * 0.6;
  f -= smoothstep(fy - 22, fy, y) * 0.9;
  if (hash2(x, 3, 71) > 0.93 && y < 150) f -= 0.5 * (1 - (y - 124) / 26);
  return ramp(R, f + dith(x, y, 0.45));
}

function galleyWall(x: number, y: number, fy: number): C {
  // splashback tiles behind the counter and the stove, sage tongue-and-groove above
  if (y >= 158 && y < 177 && x >= 199 && x < 266) {
    const tx = (x - 199) % 6, ty = (y - 158) % 6;
    if (tx === 0 || ty === 0) return ramp(P.tile, 1.6 + dith(x, y, 0.3));
    const blue = hash2(Math.floor((x - 199) / 6), Math.floor((y - 158) / 6), 5) > 0.82;
    const base = blue ? P.quiltB : P.tile;
    let f = blue ? 2.4 : 3.3;
    if (tx === 1 || ty === 1) f += 0.7;
    if (tx === 5 || ty === 5) f -= 0.5;
    if (blue && tx === 3 && ty === 3) f += 1.2;
    return ramp(base, f + dith(x, y, 0.35));
  }
  if (y === 157 && x >= 199 && x < 266) return P.tile[5];
  const bx = (x - 196) % 6;
  let f = 3.1 + (hash2(Math.floor((x - 196) / 6), 2, 9) - 0.5) * 0.4;
  if (bx === 0) f -= 1.1;
  else if (bx === 1) f += 0.5;
  f -= smoothstep(fy - 18, fy, y) * 0.6;
  f += (noise2(x * 0.08, y * 0.03, 11) - 0.5) * 0.4;
  return ramp(P.sage, f + dith(x, y, 0.45));
}

function messWall(x: number, y: number, fy: number): C {
  if (y < 165) {
    // raised panels between stiles and rails
    const sx = (x - 272) % 16, ry = y - 124;
    const stile = sx < 2, rail = ry < 3 || y > 161;
    let f = 3.2;
    if (stile || rail) f = 3.6;
    else {
      if (sx === 2 || ry === 3) f -= 0.9; // panel shadow line under the moulding
      else if (sx === 3 || ry === 4) f += 0.6;
      else if (sx === 15 || y === 161) f += 0.4;
    }
    f += (noise2(x * 0.07, y * 0.05, 13) - 0.5) * 0.35;
    return ramp(P.ochre, f + dith(x, y, 0.4));
  }
  if (y === 165) return P.varnish[5];
  if (y === 166) return P.varnish[3];
  if (y === 167) return P.varnish[1];
  // varnished wainscot boards
  const bx = (x - 272) % 5;
  let f = 3 + (hash2(Math.floor((x - 272) / 5), 4, 3) - 0.5) * 0.6 + (noise1(x * 0.4 + y * 0.05, 3) - 0.5) * 0.5;
  if (bx === 0) f -= 1.3;
  else if (bx === 1) f += 0.6;
  f -= smoothstep(fy - 12, fy, y) * 0.8;
  return ramp(P.varnish, f - 0.6 + dith(x, y, 0.4));
}

function bunkWall(x: number, y: number, fy: number): C {
  const bx = (x - 336) % 5;
  const board = Math.floor((x - 336) / 5);
  let f = 3.1 + (hash2(board, 7, 2) - 0.5) * 0.5;
  // fine grain running down each board
  f += (noise1(y * 0.25 + board * 17.3, 5) - 0.5) * 0.7;
  if (bx === 0) f -= 1.3;
  else if (bx === 1) f += 0.55;
  f -= smoothstep(fy - 14, fy, y) * 0.6;
  return ramp(P.teakW, f + dith(x, y, 0.4));
}

function holdWall(x: number, y: number, fy: number): C {
  // the bare inside of the hull: horizontal ceiling planks, sawn frames every 16px
  const fx = (x - 428) % 16;
  if (fx >= 0 && fx < 3 && x > 428) {
    const f = fx === 0 ? 4.6 : fx === 1 ? 3.8 : 2.2;
    return ramp(P.wood, f - 1 + (noise1(y * 0.3 + x, 9) - 0.5) * 0.6 + dith(x, y, 0.3));
  }
  const row = Math.floor((y - 108) / 6), ry = (y - 108) % 6;
  let f = 3.2 + (hash2(row, Math.floor((x + row * 29) / 37), 5) - 0.5) * 0.7;
  if (ry === 0) f -= 1.3;
  else if (ry === 1) f += 0.5;
  if ((x + row * 29) % 37 === 0) f -= 1.1;
  f += (noise1(x * 0.3 + row * 13, 6) - 0.5) * 0.6;
  f -= smoothstep(fy - 14, fy, y) * 0.7;
  return ramp(P.plankH, f + dith(x, y, 0.4));
}

function paintWalls(b: PixelBuffer) {
  const M = hullMask();
  for (let x = BH.engAft; x <= BH.holdFwd; x++) {
    const top = lowCeil(x);
    const fy = floorAt(x);
    for (let y = top; y < BOAT_H; y++) {
      if (!M.at(x, y)) continue;
      if (y > fy + 2) {
        // bilge under the sole: floor joists, the keelson, a sheen of bilge water
        const j = (x - 80) % 12;
        let f = 1.1 + (j < 2 ? 1 : 0) + dith(x, y, 0.6);
        if (y > 214) f += (noise1(x * 0.2, 4) - 0.5) * 0.8;
        b.set(x, y, ramp(P.bottom, f));
        continue;
      }
      const c = x < BH.engGal ? engineWall(x, y, fy) : x < 272 ? galleyWall(x, y, fy) : x < BH.galBunk ? messWall(x, y, fy) : x < BH.bunkHold ? bunkWall(x, y, fy) : holdWall(x, y, fy);
      b.set(x, y, c);
    }
  }
  // bilge water glints
  for (let x = 90; x < 480; x += 7) if (hash2(x, 1, 3) > 0.5) b.set(x, 222 + (x % 3), P.glass[3]);
}

/** Soft ambient occlusion: walls darken toward the ceiling, the floor and the bulkheads. */
function occlude(b: PixelBuffer) {
  const M = hullMask();
  const walls = [BH.engAft, BH.engGal, BH.galBunk, BH.bunkHold, BH.holdFwd];
  for (let x = BH.engAft; x <= BH.holdFwd; x++) {
    const top = lowCeil(x), fy = floorAt(x);
    let dw = 99;
    for (const w of walls) dw = Math.min(dw, Math.abs(x - w));
    for (let y = top; y < fy - 4; y++) {
      if (!M.at(x, y)) continue;
      const dt = y - top;
      let k = 0;
      if (dt < 14) k = Math.max(k, (1 - dt / 14) * 0.34);
      if (dw < 10) k = Math.max(k, (1 - dw / 10) * 0.28);
      const db = fy - 4 - y;
      if (db < 8) k = Math.max(k, (1 - db / 8) * 0.22);
      if (k > 0.02) shadeAt(b, x, y, -k * (0.85 + (((x + y * 2) & 3) / 3 - 0.5) * 0.25));
    }
  }
}

/** Deck beams and deckhead planking along the ceiling. */
function paintCeiling(b: PixelBuffer) {
  const M = hullMask();
  for (let x = BH.engAft; x <= BH.holdFwd; x++) {
    const top = lowCeil(x);
    if (!M.at(x, top)) continue;
    const steel = x < BH.engGal;
    // deckhead planking seen edge-on, with the plank seams dotted along it
    b.set(x, top, steel ? P.metal[1] : P.wood[0]);
    b.set(x, top + 1, (x % 9 === 0) ? (steel ? P.metal[1] : P.wood[0]) : steel ? P.metal[2] : P.wood[1]);
    // beams every 24px: section with a lit lower-left edge
    const bx = (x - 82) % 24;
    if (bx >= 0 && bx < 4) {
      for (let y = top + 1; y <= top + 5; y++) {
        let f = bx === 0 ? 4.4 : bx === 3 ? 1.4 : 3;
        if (y === top + 5) f -= 1.4;
        b.set(x, y, steel ? ramp(P.metal, f) : ramp(P.wood, f - 0.4 + dith(x, y, 0.3)));
      }
      // steel I-beam flanges
      if (steel) { b.set(x, top + 5, P.metal[bx === 0 ? 5 : 3]); }
    } else {
      // shadow between the beams
      for (let k = 2; k < 5; k++) shadeAt(b, x, top + k, -0.3 + (k - 2) * 0.08);
    }
  }
  // hatch openings above the ladders (the hatch coaming frames the light)
  for (const hx0 of [106, 455]) {
    const top = lowCeil(hx0 + 7);
    for (let x = hx0; x <= hx0 + 14; x++) {
      for (let y = top - 2; y <= top + 5; y++) if (M.at(x, y)) b.set(x, y, ramp(P.wood, 1 + (y - top) * 0.1));
      b.set(x, top + 5, P.wood[5]);
      b.set(x, top + 6, P.wood[3]);
    }
    vline(b, hx0, top, top + 6, P.wood[5]);
    vline(b, hx0 + 14, top, top + 6, P.wood[2]);
  }
}

/** Sole boards (seen from slightly above: a narrow band of fore-and-aft planks) and their front edge. */
function paintFloors(b: PixelBuffer) {
  for (let x = BH.engAft; x <= BH.holdFwd; x++) {
    const fy = floorAt(x);
    const eng = x < BH.engGal, hold = x >= BH.bunkHold;
    const R = eng ? P.wood : P.teak;
    // skirting shadow where the wall meets the floor
    shadeAt(b, x, fy - 5, -0.35);
    for (let r = 0; r < 4; r++) {
      const y = fy - 4 + r;
      const butt = (x + r * 23 + (hold ? 7 : 0)) % 41;
      let f = (eng ? 2.2 : 2.6) + r * 0.55 + (noise1(x * 0.21 + r * 31, 12) - 0.5) * 0.9;
      if (butt === 0) f -= 1.4;
      else if (butt === 1) f += 0.5;
      if (r === 0) f -= 0.7;
      // oil stains under the engine and by the bench, wear in the walking line
      if (eng && x > 126 && x < 192) f -= 0.9 + (noise1(x * 0.15, 3) > 0.5 ? 0.5 : 0);
      if (!eng && r >= 2 && hash2(x >> 2, r, 21) > 0.7) f += 0.3;
      b.set(x, y, ramp(R, f + dith(x, y, 0.4)));
    }
    b.set(x, fy, ramp(R, (eng ? 4.8 : 5.6) + ((x % 41) === 0 ? -1.5 : 0)));
    b.set(x, fy + 1, ramp(R, eng ? 2.4 : 3.2));
    b.set(x, fy + 2, ramp(R, 1));
    // end grain dashes on the nosing
    if (x % 41 === 20) b.set(x, fy + 1, R[1]);
  }
  // the step up into the hold
  for (let x = BH.bunkHold + 4; x < BH.bunkHold + 10; x++) {
    const sy = x < BH.bunkHold + 7 ? LOW_FLOOR - 3 : HOLD_FLOOR;
    b.set(x, sy, P.teak[5]);
    for (let y = sy + 1; y <= LOW_FLOOR; y++) b.set(x, y, ramp(P.teak, 2.4 - (y - sy) * 0.12));
  }
}

/** Watertight bulkheads between the rooms: seen end-on, with a door opening, jambs, a lintel and a brass sill. */
function paintBulkheads(b: PixelBuffer) {
  const M = hullMask();
  const doorTop = 146;
  for (const bx of [BH.engGal, BH.galBunk, BH.bunkHold]) {
    const fy = floorAt(bx);
    const top = lowCeil(bx);
    for (let y = top; y <= fy + 1; y++) {
      if (!M.at(bx, y)) continue;
      const door = y >= doorTop && y < fy;
      for (let k = -1; k < 5; k++) {
        const x = bx + k;
        if (door && k > 0 && k < 4) continue;
        let f = k === -1 ? 1.2 : k === 0 ? 5.2 : k === 4 ? 0.8 : 3.2;
        if (door) f = k === -1 ? 1.4 : k === 0 ? 4.4 : 1.6;
        if (y === doorTop - 1 && !(k === -1)) f = 5.6; // lintel lit edge
        if (y === doorTop - 2 && !(k === -1)) f = 2;
        b.set(x, y, ramp(P.wood, f + dith(x, y, 0.3)));
      }
    }
    // brass sill and a hook for the door
    hline(b, bx - 1, bx + 4, fy - 1, P.brass[4]);
    hline(b, bx, bx + 3, fy - 2, P.brass[6]);
    b.set(bx + 5, doorTop + 20, P.brass[5]);
    b.set(bx + 5, doorTop + 21, P.brass[2]);
  }
  // aft and forward ends of the accommodation
  for (let y = lowCeil(BH.engAft); y <= LOW_FLOOR + 1; y++) if (M.at(BH.engAft, y)) {
    b.set(BH.engAft, y, P.metal[1]); b.set(BH.engAft + 1, y, P.metal[3]); b.set(BH.engAft + 2, y, P.steelW[4]);
  }
  for (let y = lowCeil(BH.holdFwd); y <= HOLD_FLOOR + 1; y++) if (M.at(BH.holdFwd, y)) {
    b.set(BH.holdFwd - 1, y, P.wood[3]); b.set(BH.holdFwd, y, P.wood[1]);
  }
}

/** Pipes and wiring runs along the ceiling: a copper fresh-water line, a grey cable loom on clips. */
function paintServices(b: PixelBuffer) {
  const M = hullMask();
  // copper water pipe, with unions (brass collars) every few frames
  for (let x = BH.engAft + 3; x < BH.bunkHold; x++) {
    const y = lowCeil(x) + 7;
    if (!M.at(x, y)) continue;
    b.set(x, y, P.copper[5]);
    b.set(x, y + 1, P.copper[3]);
    b.set(x, y + 2, withAlpha(P.copper[0], 150));
    if ((x - 94) % 72 === 0) {
      for (let k = -1; k <= 1; k++) { b.set(x + k, y - 1, P.brass[5]); b.set(x + k, y + 2, P.brass[2]); }
      b.set(x, y, P.brass[6]); b.set(x, y + 1, P.brass[3]);
    }
  }
  // cable loom sagging between clips at every beam
  for (let x0 = 82; x0 < BH.bunkHold - 4; x0 += 24) {
    const x1 = x0 + 24;
    const y0 = lowCeil(x0) + 11, y1 = lowCeil(x1) + 11;
    rope(b, x0 + 2, y0, x1 + 2, y1, 1.6, P.metal[2]);
    rope(b, x0 + 2, y0 - 1, x1 + 2, y1 - 1, 1.6, P.metal[4]);
    // clip
    b.set(x0 + 2, y0 - 2, P.metal[5]);
    b.set(x0 + 2, y0 + 1, P.metal[1]);
  }
  // where the services pierce each bulkhead: a gland plate
  for (const bx of [BH.engGal, BH.galBunk]) {
    const y = lowCeil(bx) + 6;
    b.rect(bx - 1, y, 6, 7, P.metal[3]);
    hline(b, bx - 1, bx + 4, y, P.metal[5]);
    b.set(bx, y + 2, P.metal[6]); b.set(bx + 3, y + 5, P.metal[6]);
  }
}

// ------------------------------------------------------------------ engine room (76..196)

function paintEngineRoom(b: PixelBuffer, G: GlowFn) {
  // --- electrical panel on the aft end of the room, cables climbing out of it to the ceiling
  sticker(b, 121, 125, 13, 20, o => {
    o.rect(0, 0, 13, 20, (x, y) => rq(P.metal, x === 0 || y === 0 ? 5 : x === 12 || y === 19 ? 2 : 4, x, y, 0.4));
    o.rect(2, 3, 9, 12, (x, y) => (y === 0 ? P.metal[0] : P.metal[1]));
    // breaker rows
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) {
      o.px(3 + k * 2, 5 + r * 4, r === 1 && k === 2 ? P.red[4] : P.white[3]);
      o.px(3 + k * 2, 6 + r * 4, P.metal[3]);
    }
    // warning label and the main switch
    o.rect(3, 16, 5, 2, P.yellow[5]);
    o.px(5, 16, P.metal[0]);
    o.rect(9, 15, 2, 3, P.red[3]);
    o.px(9, 15, P.red[5]);
  });
  G(126, 141, [1, 0.3, 0.2], 200);
  for (const [cx, sag] of [[124, 0], [127, 1], [130, 0]] as const) vline(b, cx, lowCeil(cx) + 10, 124, P.metal[sag ? 1 : 2]);
  // fire extinguisher on its bracket below the panel
  sticker(b, 124, 150, 6, 16, o => {
    o.rect(0, 3, 6, 13, (x, y) => rq(P.red, x === 0 ? 4.6 : x === 5 ? 1.8 : 3.4 - y * 0.03, x, y, 0.3));
    o.rect(1, 0, 3, 3, P.metal[2]);
    o.px(4, 1, P.metal[5]);
    o.line(5, 1, 6, 8, P.metal[1]);
    o.rect(1, 7, 4, 4, P.white[4]);
    o.px(2, 8, P.red[2]); o.px(3, 9, P.red[2]);
    o.hline(0, 5, 12, P.metal[3]);
  });
  // --- pegboard toolboard with outlined tool silhouettes, above the bench
  sticker(b, 81, 127, 24, 22, o => {
    o.rect(0, 0, 24, 22, (x, y) => {
      if (x === 0 || y === 0) return P.wood[5];
      if (x === 23 || y === 21) return P.wood[2];
      if (x % 3 === 1 && y % 3 === 1) return P.wood[2];
      return rq(P.wood, 3.6 + (noise1(x * 0.3 + y, 2) - 0.5) * 0.4, x, y, 0.3);
    });
    const tool = (pts: [number, number][], c: C) => { for (const [x, y] of pts) o.px(x, y, c); };
    const S = P.metal;
    // open-ended spanners (big to small)
    for (let i = 0; i < 3; i++) {
      const x = 3 + i * 3, y0 = 3, L = 12 - i * 2;
      o.vline(x, y0 + 2, y0 + L, S[5]);
      o.px(x - 1, y0, S[6]); o.px(x + 1, y0, S[6]); o.px(x - 1, y0 + 1, S[5]); o.px(x + 1, y0 + 1, S[4]);
      o.px(x, y0 + L + 1, S[4]);
    }
    // claw hammer
    o.vline(13, 6, 17, P.wood[6]); o.vline(14, 6, 17, P.wood[4]);
    o.hline(11, 16, 4, S[5]); o.hline(11, 16, 5, S[3]); o.px(10, 5, S[4]); o.px(17, 3, S[4]);
    // screwdrivers with coloured handles
    for (const [x, c] of [[18, P.red], [20, P.yellow], [22, P.navy]] as const) {
      o.vline(x, 3, 8, S[6]);
      o.rect(x, 9, 1, 5, c[4]);
      o.px(x, 13, c[2]);
    }
    // pliers
    tool([[17, 15], [18, 16], [19, 17], [19, 18], [20, 19], [21, 15], [20, 16], [19, 16]], S[5]);
    // tool outlines painted on the board where a tool is missing (the "shadow board")
    for (const [x, y] of [[8, 16], [8, 17], [8, 18], [9, 19], [7, 19]] as const) o.px(x, y, P.wood[1]);
  });
  // --- workbench: thick oak top, a vice, drawers and a red toolbox on the shelf under it
  sticker(b, 80, 180, 30, 22, o => {
    o.rect(0, 0, 30, 3, (x, y) => rq(P.wood, y === 0 ? 6.3 : y === 1 ? 5 : 3.2, x, y, 0.3));
    for (let x = 4; x < 30; x += 7) o.px(x, 1, P.wood[3]);
    // drawers
    o.rect(2, 3, 16, 10, (x, y) => (y === 0 ? P.wood[1] : x === 0 ? P.wood[5] : x === 15 || y === 9 ? P.wood[2] : y === 5 ? P.wood[1] : rq(P.wood, 3.8, x, y, 0.3)));
    o.px(9, 5, P.brass[5]); o.px(9, 10, P.brass[5]); o.px(10, 5, P.brass[2]); o.px(10, 10, P.brass[2]);
    // legs and the shelf
    o.rect(1, 3, 2, 19, (x) => (x === 0 ? P.wood[4] : P.wood[2]));
    o.rect(27, 3, 2, 19, (x) => (x === 0 ? P.wood[4] : P.wood[2]));
    o.hline(3, 26, 17, P.wood[4]); o.hline(3, 26, 18, P.wood[2]);
    // red toolbox on the shelf
    o.rect(5, 12, 11, 5, (x, y) => rq(P.red, y === 0 ? 4.8 : x === 10 ? 1.8 : 3.2, x, y, 0.3));
    o.hline(8, 12, 11, P.metal[4]); o.px(7, 11, P.metal[2]); o.px(13, 11, P.metal[2]);
    o.px(10, 14, P.metal[5]);
    // a coffee tin of bolts and a rag
    o.rect(19, 13, 4, 4, (x) => (x === 0 ? P.metal[5] : P.metal[3]));
    o.rect(23, 14, 3, 3, P.white[2]);
  });
  // --- jerry can and oil tins by the ladder
  sticker(b, 120, 189, 9, 13, o => {
    o.rect(0, 2, 9, 11, (x, y) => rq(P.red, x === 0 ? 4.4 : x === 8 ? 1.6 : 3.2 - y * 0.05, x, y, 0.3));
    o.line(1, 4, 7, 11, P.red[1]); o.line(7, 4, 1, 11, P.red[1]);
    o.rect(1, 0, 3, 2, P.red[2]); o.hline(5, 7, 1, P.red[4]); o.px(1, 0, P.metal[5]);
  });
  sticker(b, 129, 195, 5, 7, o => { o.rect(0, 0, 5, 7, (x, y) => (y === 0 ? P.metal[6] : x === 0 ? P.yellow[5] : y === 3 ? P.metal[1] : P.yellow[3])); });
  // --- gauge panel above the engine: three brass-rimmed gauges, needles, labels
  sticker(b, 155, 126, 25, 17, o => {
    o.rect(0, 0, 25, 17, (x, y) => rq(P.engine, x === 0 || y === 0 ? 3.6 : x === 24 || y === 16 ? 1 : 2.2, x, y, 0.3));
    for (let i = 0; i < 3; i++) {
      const cx = 4 + i * 8, cy = 7;
      o.ell(cx + 0.5, cy + 0.5, 4, 4, (nx, ny) => {
        const r = Math.hypot(nx, ny);
        if (r > 0.72) return nx + ny < 0 ? P.brass[5] : P.brass[2];
        return ny > 0.35 ? P.cream[3] : P.cream[5];
      });
      // red zone and needle
      o.px(cx + 2, cy - 1, P.red[4]);
      const a = [-2.2, -1.2, -0.5][i];
      o.px(cx + Math.round(Math.cos(a) * 1.5), cy + Math.round(Math.sin(a) * 1.5), P.metal[0]);
      o.px(cx, cy, P.metal[0]);
      o.hline(cx - 2, cx + 2, 14, P.cream[2]);
    }
  });
  // --- the engine: a green-enamelled four-cylinder marine diesel on steel bearers
  sticker(b, 124, 150, 62, 52, o => {
    const E = P.engine;
    // bearers and drip tray
    o.rect(0, 46, 62, 6, (x, y) => rq(P.metal, y === 0 ? 4.6 : y === 5 ? 1 : 2.6, x, y, 0.3));
    for (let x = 4; x < 62; x += 10) o.px(x, 48, P.metal[6]);
    o.hline(0, 61, 49, P.metal[1]);
    // crankcase with inspection doors
    o.rect(9, 25, 46, 21, (x, y) => rq(E, (y === 0 ? 4.4 : x === 0 ? 3.8 : x === 45 ? 1.4 : 3 - y * 0.05), x, y, 0.35));
    for (let i = 0; i < 3; i++) {
      const dx = 13 + i * 13;
      o.rect(dx, 29, 10, 10, (x, y) => (x === 0 || y === 0 ? E[4] : x === 9 || y === 9 ? E[1] : E[3]));
      for (const [bx, by] of [[1, 1], [8, 1], [1, 8], [8, 8]]) o.px(dx + bx, 29 + by, P.metal[6]);
    }
    // cylinder block with cooling ribs
    o.rect(10, 11, 44, 14, (x, y) => rq(E, (y === 0 ? 4.6 : x === 0 ? 4 : x === 43 ? 1.6 : 3.3) + (x % 11 === 10 ? -0.9 : 0), x, y, 0.35));
    // rocker covers with their hold-down nuts, injector pipes
    for (let i = 0; i < 4; i++) {
      const cx = 11 + i * 11;
      o.rect(cx, 4, 9, 7, (x, y) => rq(P.metal, y === 0 ? 6.4 : x === 0 ? 5.5 : x === 8 ? 3 : 4.6 - y * 0.2, x, y, 0.3));
      o.px(cx + 2, 6, P.metal[2]); o.px(cx + 6, 6, P.metal[2]);
      o.vline(cx + 4, 2, 3, P.copper[5]);
    }
    // exhaust manifold along the back, rusty, running into the lagged riser
    o.rect(10, 0, 50, 3, (x, y) => rq(P.rust, y === 0 ? 4 : 2.5, x, y, 0.5));
    o.rect(56, 0, 6, 3, (x, y) => rq(P.rust, y === 0 ? 3.6 : 2, x, y, 0.5));
    // bell housing and the reverse gearbox at the aft end, output flange for the shaft
    o.rect(5, 20, 5, 22, (x, y) => rq(P.engine, y === 0 ? 4 : x === 0 ? 3.4 : x === 4 ? 1.2 : 2.4, x, y, 0.3));
    o.rect(0, 30, 6, 12, (x, y) => rq(P.metal, y === 0 ? 5 : x === 0 ? 4.4 : x === 5 ? 1.6 : 3, x, y, 0.3));
    for (const by of [22, 30, 38]) o.px(6, by, P.metal[7]);
    o.px(1, 33, P.metal[6]); o.px(1, 39, P.metal[6]);
    // starter motor
    o.rect(9, 38, 6, 4, (x, y) => (y === 0 ? P.red[4] : x === 5 ? P.red[1] : P.red[2]));
    // pulleys, belt and alternator at the forward end
    o.ell(57, 36, 4, 4, (nx, ny) => (Math.hypot(nx, ny) < 0.35 ? P.metal[6] : nx + ny < 0 ? P.metal[5] : P.metal[3]));
    o.ell(57, 19, 3, 3, (nx, ny) => (Math.hypot(nx, ny) < 0.4 ? P.metal[6] : nx + ny < 0 ? P.metal[5] : P.metal[2]));
    o.vline(60, 19, 36, P.metal[0]); o.vline(54, 19, 36, P.metal[1]);
    o.rect(52, 10, 9, 6, (x, y) => rq(P.metal, y === 0 ? 5.5 : 3.6, x, y, 0.4));
    for (let k = 0; k < 4; k++) o.px(53 + k * 2, 12, P.metal[1]);
    // oil filter canister, dipstick with its yellow ring, fuel filter and line
    o.rect(44, 36, 5, 8, (x) => (x === 0 ? P.navy[4] : x === 4 ? P.navy[1] : P.navy[3]));
    o.hline(44, 48, 36, P.white[3]);
    o.vline(17, 19, 25, P.metal[6]); o.px(16, 18, P.yellow[5]); o.px(17, 18, P.yellow[5]); o.px(18, 18, P.yellow[3]);
    o.rect(24, 19, 4, 6, (x) => (x === 0 ? P.white[4] : P.white[2]));
    o.line(26, 19, 34, 14, P.copper[5]);
    // warning plate and the maker's brass badge
    o.rect(37, 15, 8, 5, P.yellow[4]); o.px(40, 16, P.metal[0]); o.px(40, 17, P.metal[0]); o.px(40, 19, P.metal[0]);
    o.rect(20, 13, 8, 3, P.brass[4]); o.hline(21, 26, 14, P.brass[2]);
    // oil weeping down the sump
    for (const [sx, sy, L] of [[19, 40, 6], [33, 39, 7], [50, 42, 4]] as const) for (let k = 0; k < L; k++) o.px(sx, sy + k * 0.8, E[1]);
  });
  // lagged exhaust riser: out of the manifold, up to the deckhead and forward through the bulkhead
  const lag = (x: number, y: number, band: boolean, horiz: boolean, t: number) => b.set(x, y, band ? ramp(P.metal, horiz ? 4 - t * 2 : 5 - t * 3) : ramp(P.lag, (horiz ? 4.4 - t * 3 : 4.6 - t * 3.4) + dith(x, y, 0.4)));
  for (let y = 128; y < 152; y++) for (let x = 181; x < 187; x++) lag(x, y, (y - 128) % 7 === 0, false, (x - 181) / 5);
  for (let x = 181; x < 216; x++) {
    const y0 = lowCeil(x) + 3;
    for (let y = y0; y < y0 + 6; y++) lag(x, y, (x - 181) % 8 === 0, true, (y - y0) / 5);
  }
  for (let y = lowCeil(214) - 1; y < lowCeil(214) + 9; y++) for (let x = 211; x < 217; x++) lag(x, y, y === lowCeil(214) + 8, false, (x - 211) / 5);
  // sea-water pipe with the red valve wheel at the forward end of the room
  for (let y = lowCeil(192) + 14; y < LOW_FLOOR - 1; y++) { b.set(191, y, P.pipeRed[4]); b.set(192, y, P.pipeRed[3]); b.set(193, y, P.pipeRed[1]); }
  for (const fy of [150, 188]) { hline(b, 190, 194, fy, P.metal[5]); hline(b, 190, 194, fy + 1, P.metal[2]); b.set(190, fy, P.metal[7]); }
  sticker(b, 186, 166, 11, 11, o => {
    o.ell(5.5, 5.5, 5.5, 5.5, (nx, ny) => {
      const r = Math.hypot(nx, ny);
      if (r > 0.72) return nx + ny < 0 ? P.red[5] : P.red[2];
      if (r < 0.26) return P.metal[5];
      const a = Math.atan2(ny, nx);
      return Math.abs(Math.sin(a * 2)) < 0.28 ? P.red[3] : -1;
    });
  });
  // a hose coiled on a hook, and a spare cable loop
  ring(b, 118, 132, 2.2, 4, (a, t, x, y) => ramp(P.metal, 1.6 - Math.cos(a + 2) * 1 + (t > 0.5 ? -0.4 : 0.3) + dith(x, y, 0.3)));
  b.set(118, 127, P.brass[5]);
  // oil stain on the wall under the fuel line
  for (let k = 0; k < 14; k++) tint(b, 152 + (k > 7 ? 1 : 0), 146 + k, P.grime[0], 0.35 * (1 - k / 14));
}

// ------------------------------------------------------------------ galley & mess (196..336)

function paintGalley(b: PixelBuffer, G: GlowFn) {
  // --- wall cupboards with brass knobs and a plate rail
  sticker(b, 199, 124, 20, 16, o => {
    o.rect(0, 0, 20, 16, (x, y) => (y === 0 ? P.cream[5] : y === 15 ? P.cream[1] : x === 0 ? P.cream[4] : x === 19 ? P.cream[1] : rq(P.cream, 3, x, y, 0.3)));
    for (const dx of [1, 10]) o.rect(dx, 2, 9, 12, (x, y) => (x === 0 || y === 0 ? P.cream[4] : x === 8 || y === 11 ? P.cream[1] : y === 1 || x === 1 ? P.cream[3] : rq(P.cream, 2.6, x, y, 0.3)));
    o.px(8, 8, P.brass[6]); o.px(12, 8, P.brass[6]); o.px(8, 9, P.brass[2]); o.px(12, 9, P.brass[2]);
  });
  // shelf of spice jars under the cupboards, with a fiddle rail
  hline(b, 199, 218, 150, P.wood[5]); hline(b, 199, 218, 151, P.wood[2]);
  sticker(b, 200, 142, 18, 8, o => {
    const cols = [P.red, P.yellow, P.green, P.orange, P.navy];
    for (let i = 0; i < 5; i++) {
      const x = i * 4 - (i > 2 ? 1 : 0), h = 5 + (i % 2) * 2, c = cols[i];
      o.rect(x, 8 - h, 3, h, (xx, yy) => (yy === 0 ? P.metal[5] : yy === 1 ? P.brass[3] : xx === 0 ? c[5] ?? c[4] : yy === h - 2 ? P.paper[4] : c[3]));
      o.px(x + 1, 8 - h + 3, P.white[4]);
    }
  });
  hline(b, 199, 218, 146, P.brass[3]);
  // --- counter: butcher-block top, cupboard with drawer, sink with a swan-neck tap
  sticker(b, 199, 176, 20, 26, o => {
    o.rect(0, 0, 20, 3, (x, y) => (y === 0 ? P.wood[6] : y === 1 ? (x % 3 === 0 ? P.wood[4] : P.wood[5]) : P.wood[3]));
    o.rect(0, 3, 20, 23, (x, y) => (y === 22 ? P.metal[0] : y > 19 ? P.navy[0] : x === 0 ? P.navy[4] : x === 19 ? P.navy[1] : rq(P.navy, 2.6, x, y, 0.3)));
    o.rect(1, 4, 18, 4, (x, y) => (y === 0 ? P.navy[4] : y === 3 ? P.navy[1] : P.navy[3]));
    o.hline(8, 11, 5, P.brass[5]);
    o.rect(1, 9, 18, 11, (x, y) => (x === 0 || y === 0 ? P.navy[4] : x === 17 || y === 10 ? P.navy[1] : x === 2 || y === 2 ? P.navy[3] : P.navy[2]));
    o.px(15, 13, P.brass[6]); o.px(15, 14, P.brass[2]);
    // sink basin rim on the right half
    o.hline(10, 18, 0, P.metal[7]); o.hline(10, 18, 1, P.metal[4]);
  });
  // tap
  sticker(b, 214, 169, 4, 7, o => { o.vline(0, 1, 6, P.metal[6]); o.hline(0, 3, 0, P.metal[6]); o.px(3, 1, P.metal[4]); o.px(1, 5, P.red[4]); });
  // noodle stash: instant noodle cups stacked on the counter by the sink
  sticker(b, 200, 161, 9, 15, o => {
    const cup = (x: number, y: number, c: C[]) => o.rect(x, y, 4, 5, (i, j) => (j === 0 ? P.white[4] : j === 1 ? c[4] : j === 2 ? P.white[3] : i === 3 ? P.white[1] : P.white[2]));
    cup(0, 10, P.red); cup(5, 10, P.orange); cup(0, 5, P.yellow); cup(5, 5, P.red); cup(2, 0, P.green);
  });
  // --- stove: cream enamel range with an oven window, knobs, a sea rail round the hob and a flue
  for (let y = lowCeil(259); y < 172; y++) { b.set(258, y, P.metal[4]); b.set(259, y, P.metal[3]); b.set(260, y, P.metal[1]); }
  for (const cy of [140, 158]) { hline(b, 257, 261, cy, P.metal[5]); b.set(257, cy, P.metal[7]); }
  sticker(b, 232, 172, 30, 30, o => {
    const W = 30;
    // sea rail on posts
    o.hline(0, W - 1, 0, P.metal[6]);
    for (const x of [0, 9, 20, W - 1]) o.vline(x, 1, 3, P.metal[4]);
    // hob and body
    o.rect(0, 4, W, 3, (x, y) => (y === 0 ? P.metal[2] : y === 1 ? P.metal[1] : P.metal[0]));
    o.rect(0, 7, W, 23, (x, y) => (y === 22 ? P.metal[0] : x === 0 ? P.cream[5] : x === W - 1 ? P.cream[1] : y === 0 ? P.cream[5] : rq(P.cream, 3.5 - y * 0.02, x, y, 0.3)));
    // control strip with four knobs
    o.rect(1, 8, W - 2, 4, (x, y) => (y === 3 ? P.cream[1] : P.cream[3]));
    for (let k = 0; k < 4; k++) { o.px(4 + k * 7, 9, P.metal[1]); o.px(5 + k * 7, 9, P.metal[2]); o.px(4 + k * 7, 10, P.metal[2]); o.px(5 + k * 7, 10, P.metal[3]); }
    // oven door with a window and a chrome bar handle
    o.hline(3, W - 4, 13, P.metal[7]); o.hline(3, W - 4, 14, P.metal[3]);
    o.rect(3, 15, W - 6, 12, (x, y) => (x === 0 || y === 0 ? P.cream[4] : x === W - 7 || y === 11 ? P.cream[1] : P.cream[3]));
    o.rect(6, 17, W - 12, 7, (x, y) => (y === 0 ? P.metal[0] : x === 0 ? P.metal[2] : (x + y) % 7 === 0 ? P.orange[4] : P.orange[1]));
    o.px(7, 18, P.white[4]);
    // plinth
    o.hline(1, W - 2, 28, P.metal[1]);
  });
  G(244, 190, [1, 0.55, 0.2], 150); G(248, 191, [1, 0.6, 0.25], 150); G(252, 190, [1, 0.55, 0.2], 150);
  // utensil rail over the stove: ladle, spatula, whisk, tongs
  hline(b, 233, 256, 153, P.metal[6]); hline(b, 233, 256, 154, P.metal[2]);
  sticker(b, 234, 155, 21, 13, o => {
    o.vline(1, 0, 8, P.metal[5]); o.ell(1.5, 10, 2, 2, (nx, ny) => (ny < 0 ? P.metal[3] : P.metal[5]));
    o.vline(7, 0, 7, P.wood[5]); o.rect(6, 8, 3, 4, (x) => (x === 0 ? P.metal[6] : P.metal[4]));
    o.vline(12, 0, 5, P.metal[5]); o.ell(12.5, 8, 2, 3, (nx, ny) => (Math.hypot(nx, ny) > 0.55 || Math.abs(nx) < 0.2 ? P.metal[6] : -1));
    o.line(17, 0, 16, 10, P.metal[5]); o.line(18, 0, 19, 10, P.metal[3]);
  });
  // --- hanging pot rack: a brass bar on two chains, pans below
  const rackY = 131;
  for (const cx of [266, 290]) for (let y = lowCeil(cx) + 5; y < rackY; y++) b.set(cx, y, (y & 1) ? P.metal[5] : P.metal[2]);
  hline(b, 264, 292, rackY, P.brass[6]); hline(b, 264, 292, rackY + 1, P.brass[2]);
  sticker(b, 265, rackY + 2, 27, 16, o => {
    // frying pan hung by its handle
    o.vline(3, 0, 5, P.metal[2]);
    o.ell(3.5, 10, 4, 4.4, (nx, ny) => (Math.hypot(nx, ny) > 0.78 ? (nx + ny < 0 ? P.metal[4] : P.metal[1]) : nx + ny < -0.5 ? P.metal[3] : P.metal[2]));
    // copper saucepan
    o.vline(11, 0, 3, P.metal[2]);
    o.rect(9, 4, 6, 7, (x, y) => (y === 0 ? P.copper[6] : x === 0 ? P.copper[5] : x === 5 ? P.copper[2] : rq(P.copper, 4, x, y, 0.4)));
    o.px(10, 6, P.copper[6]);
    // colander
    o.vline(19, 0, 2, P.metal[2]);
    o.ell(19.5, 6, 3.5, 3.5, (nx, ny) => ((Math.round((nx + 1) * 4) + Math.round((ny + 1) * 4)) % 3 === 0 ? P.metal[1] : ny < 0 ? P.metal[6] : P.metal[4]));
    // wooden spoon and a small pan
    o.vline(24, 0, 9, P.wood[6]); o.ell(24.5, 11, 1.4, 2, P.wood[5]);
  });
  // the galley towel hung over the oven handle
  sticker(b, 252, 185, 5, 8, o => o.rect(0, 0, 5, 8, (x, y) => (y === 0 ? P.white[4] : y % 3 === 2 ? P.red[3] : x === 4 ? P.white[1] : P.white[3])));
  // stockpot and kettle on the hob (the pot sits on the mount the old boat scene uses)
  sticker(b, 235, 167, 12, 9, o => {
    o.rect(1, 1, 10, 8, (x, y) => (y === 0 ? P.metal[7] : x === 0 ? P.metal[6] : x === 9 ? P.metal[2] : y === 7 ? P.metal[2] : rq(P.metal, 5 - x * 0.25, x, y, 0.4)));
    o.hline(0, 11, 1, P.metal[6]); o.px(0, 3, P.metal[4]); o.px(11, 3, P.metal[4]);
    o.hline(4, 7, 0, P.metal[3]);
    o.hline(2, 9, 4, P.metal[4]);
  });
  sticker(b, 250, 169, 9, 7, o => {
    o.ell(4, 4.5, 3.6, 2.8, (nx, ny) => (nx + ny < -0.5 ? P.brass[6] : nx + ny < 0.4 ? P.brass[4] : P.brass[2]));
    o.line(7, 3, 8, 1, P.brass[3]);
    o.hline(2, 6, 0, P.metal[1]); o.px(1, 1, P.metal[1]); o.px(7, 1, P.metal[1]);
    o.px(4, 1, P.metal[3]);
  });
}

function paintMess(b: PixelBuffer, G: GlowFn) {
  // --- ship's clock and a barometer on the bulkhead panel, brass rims
  for (const [cx, cy, baro] of [[282, 137, false], [282, 152, true]] as const) {
    ring(b, cx, cy, 3.2, 5.2, (a, _t, x, y) => ramp(P.brass, 3.2 - Math.cos(a + 2.3) * 2 + dith(x, y, 0.3)));
    b.discFn(cx, cy, 3.3, (_x, _y, _nx, ny) => (ny > 0.4 ? P.cream[3] : P.cream[5]));
    if (baro) { b.set(cx - 1, cy - 1, P.metal[0]); b.set(cx - 2, cy - 2, P.metal[0]); b.set(cx + 2, cy, P.red[3]); }
    else { b.set(cx, cy - 1, P.metal[0]); b.set(cx, cy - 2, P.metal[0]); b.set(cx + 1, cy, P.metal[0]); b.set(cx + 2, cy, P.metal[0]); }
    b.set(cx, cy, P.brass[1]);
  }
  // --- framed chart of the southern ocean with the route pencilled on it
  sticker(b, 294, 137, 29, 19, o => {
    o.rect(0, 0, 29, 19, (x, y) => (x === 0 || y === 0 ? P.varnish[5] : x === 28 || y === 18 ? P.varnish[1] : P.varnish[3]));
    o.rect(2, 2, 25, 15, (x, y) => {
      // sea tint with depth contours
      const d = noise2(x * 0.2, y * 0.25, 5);
      if (x > 14 && y < 9 - (x - 14) * 0.3 + Math.sin(x) * 1.2) return (x + y) % 2 ? P.green[4] : P.moss[5]; // coast
      if (Math.abs(d - 0.5) < 0.03) return P.quiltB[4];
      return y === 0 ? P.paper[3] : P.paper[4];
    });
    // compass rose
    o.px(6, 11, P.red[3]); o.px(5, 11, P.navy[3]); o.px(7, 11, P.navy[3]); o.px(6, 10, P.navy[3]); o.px(6, 12, P.navy[3]);
    // the route: dashes toward the island with an X
    for (let k = 0; k < 16; k += 2) o.px(4 + k, 5 + Math.round(Math.sin(k * 0.4) * 2 + k * 0.25), P.red[3]);
    o.px(21, 8, P.red[4]); o.px(22, 9, P.red[4]); o.px(22, 7, P.red[4]); o.px(20, 9, P.red[4]);
  });
  // --- dinette settee along the ship's side: buttoned back cushions, seat, locker base
  sticker(b, 289, 166, 46, 36, o => {
    for (let i = 0; i < 3; i++) {
      const cx = i * 15 + 1;
      o.rect(cx, 0, 14, 16, (x, y) => {
        if ((x === 0 || x === 13) && (y === 0 || y === 15)) return -1;
        let f = 3 - y * 0.04 + (x === 0 || y === 0 ? 1 : 0) + (x === 13 || y === 15 ? -1.2 : 0);
        if ((x === 4 || x === 9) && (y === 5 || y === 10)) f -= 1.4; // buttons
        if ((x === 4 || x === 9) && (y === 6 || y === 11)) f += 0.6;
        return rq(P.cushion, f, x, y, 0.3);
      });
    }
    o.rect(0, 16, 46, 4, (x, y) => (y === 0 ? P.cushion[4] : y === 3 ? P.cushion[1] : rq(P.cushion, 3, x, y, 0.3)));
    o.rect(0, 20, 46, 16, (x, y) => (y === 15 ? P.wood[0] : y === 0 ? P.wood[5] : x === 45 ? P.wood[2] : rq(P.wood, 3.2, x, y, 0.3)));
    for (const lx of [4, 30]) { o.rect(lx, 23, 12, 10, (x, y) => (x === 0 || y === 0 ? P.wood[2] : x === 11 || y === 9 ? P.wood[5] : P.wood[3])); o.px(lx + 6, 27, P.brass[5]); }
  });
  // --- mess table with a gingham cloth, a pedestal leg; mugs, a teapot and a fruit bowl
  sticker(b, 289, 180, 42, 22, o => {
    // cloth top and drape (red / white checks, darker in the folds)
    o.rect(0, 0, 42, 7, (x, y) => {
      if (y === 0) return P.gingham[4];
      if (y >= 5 && (x % 9 === 0)) return -1; // scalloped hem
      const chk = ((x >> 1) + (y >> 1)) % 2 === 0;
      const warp = (x >> 1) % 2 === 0, weft = ((y - 1) >> 1) % 2 === 0;
      let c = warp && weft ? P.gingham[1] : warp || weft ? P.gingham[2] : P.gingham[4];
      if (!chk && !(warp && weft)) c = warp || weft ? P.gingham[2] : P.gingham[3];
      if (y > 2) c = shade(c, -0.12 * (y - 2));
      return c;
    });
    // pedestal leg and foot
    o.rect(19, 7, 4, 13, (x) => (x === 0 ? P.teak[5] : x === 3 ? P.teak[1] : P.teak[3]));
    o.rect(13, 19, 16, 3, (x, y) => (y === 0 ? P.teak[5] : y === 2 ? P.teak[0] : P.teak[3]));
    o.px(20, 12, P.brass[5]);
  });
  sticker(b, 292, 175, 6, 5, o => { o.rect(0, 0, 5, 5, (x) => (x === 0 ? P.white[4] : x === 4 ? P.white[1] : P.white[3])); o.px(5, 1, P.white[2]); o.px(5, 3, P.white[2]); o.hline(0, 4, 1, P.navy[3]); });
  sticker(b, 323, 172, 8, 8, o => {
    o.ell(3.5, 5, 3.5, 3, (nx, ny) => (nx + ny < -0.4 ? P.navy[4] : nx + ny < 0.5 ? P.navy[3] : P.navy[1]));
    o.px(7, 3, P.navy[2]); o.px(7, 4, P.navy[2]); o.hline(2, 5, 1, P.navy[4]); o.px(3, 0, P.navy[4]);
  });

  // steam from the teapot
  G(326, 168, [1, 1, 1], 70); G(327, 165, [1, 1, 1], 50); G(326, 162, [1, 1, 1], 35);
}

// ------------------------------------------------------------------ bunk room (336..424)

function patchQuilt(o: Obj, x0: number, y0: number, w: number, h: number, cols: C[][], seed: number) {
  o.rect(x0, y0, w, h, (x, y) => {
    const px = Math.floor(x / 4), py = Math.floor(y / 3);
    const c = cols[Math.floor(hash2(px, py, seed) * cols.length)];
    let f = y === 0 ? 4 : 3;
    if (x % 4 === 0) f -= 1; // stitch lines between patches
    if (y === h - 1) f -= 1.4;
    if ((x + y * 2) % 7 === 0 && x % 4 !== 0) f += 0.6; // tiny print
    return ramp(c, f);
  });
}

function paintBunks(b: PixelBuffer, G: GlowFn) {
  const bx0 = 344, bx1 = 404;
  // --- bunk posts
  for (const px of [bx0, bx1 - 2]) sticker(b, px, 142, 2, 60, o => o.rect(0, 0, 2, 60, (x, y) => (y === 0 ? P.teak[6] : x === 0 ? P.teak[5] : P.teak[2])));
  // --- upper bunk: frame, blue starry quilt with a white turn-down, pillow, reading curtain
  sticker(b, bx0 + 2, 149, bx1 - bx0 - 4, 12, o => {
    const w = bx1 - bx0 - 4;
    o.rect(0, 9, w, 3, (x, y) => (y === 0 ? P.teak[6] : y === 2 ? P.teak[1] : P.teak[4]));
    o.rect(0, 5, w, 4, (x, y) => (y === 3 ? P.white[1] : P.white[3]));
    // quilt: navy with little stars and a stripe
    o.rect(12, 2, w - 13, 7, (x, y) => {
      if (y === 0) return P.quiltB[4];
      if (y === 6) return P.quiltB[1];
      if ((x * 7 + y * 3) % 11 === 0) return P.white[4];
      if (y === 3) return P.mustard[4];
      return (x >> 2) % 2 ? P.quiltB[3] : P.quiltB[2];
    });
    o.rect(12, 2, 3, 7, (x, y) => (x === 2 ? P.white[1] : y === 0 ? P.white[4] : P.white[3]));
    o.ell(6, 4, 5, 2.6, (nx, ny) => (ny < -0.2 ? P.white[4] : ny > 0.4 ? P.white[1] : P.white[3]));
  });
  // curtain on a rail over the upper bunk, tied back
  hline(b, bx0 + 2, bx1 - 3, 144, P.brass[5]);
  sticker(b, bx0 + 3, 145, 6, 9, o => o.rect(0, 0, 6, 9, (x, y) => (y > 4 && x > 2 + (y - 4) * 0.4 ? -1 : y === 4 ? P.mustard[4] : x % 2 ? P.plum[2] : P.plum[3])));
  // --- lower bunk: patchwork quilt, pillow at the forward end, drawers underneath
  sticker(b, bx0 + 2, 173, bx1 - bx0 - 4, 29, o => {
    const w = bx1 - bx0 - 4;
    o.rect(0, 9, w, 4, (x, y) => (y === 0 ? P.teak[6] : y === 3 ? P.teak[1] : P.teak[4]));
    o.rect(0, 5, w, 4, (x, y) => (y === 3 ? P.white[1] : P.white[3]));
    patchQuilt(o, 0, 2, w - 12, 7, [P.quiltR, P.quiltR, P.mustard, P.gingham.slice(1), P.quiltB], 7);
    o.vline(w - 13, 2, 8, P.quiltR[1]);
    o.ell(w - 6, 4, 5, 2.6, (nx, ny) => (ny < -0.2 ? P.white[4] : ny > 0.4 ? P.white[1] : ny > 0 && Math.abs(nx) < 0.5 ? P.quiltB[3] : P.white[3]));
    // drawers
    for (let i = 0; i < 2; i++) {
      const dx = 1 + i * Math.floor(w / 2);
      const dw = Math.floor(w / 2) - 2;
      o.rect(dx, 14, dw, 14, (x, y) => (x === 0 || y === 0 ? P.teak[4] : x === dw - 1 || y === 13 ? P.teak[0] : x === 1 || y === 1 ? P.teak[3] : rq(P.teak, 2.3 + (noise1(x * 0.35 + y * 0.1 + dx, 8) - 0.5) * 0.9, x, y, 0.3)));
      o.hline(dx + Math.floor(dw / 2) - 2, dx + Math.floor(dw / 2) + 2, 20, P.brass[5]);
      o.hline(dx + Math.floor(dw / 2) - 2, dx + Math.floor(dw / 2) + 2, 21, P.brass[2]);
    }
  });
  // a striped jumper hung over the upper bunk's rail, sea boots under it
  sticker(b, 390, 158, 8, 10, o => o.rect(0, 0, 8, 10, (x, y) => (y > 6 && (x < 2 || x > 5) ? -1 : y % 3 === 0 ? P.white[3] : x === 7 ? P.navy[1] : P.navy[3])));
  // reading lamp inside the lower bunk
  sticker(b, 396, 163, 5, 5, o => { o.rect(0, 0, 2, 5, P.brass[2]); o.poly([1, 1, 5, 0, 5, 4, 1, 3], (x) => (x > 3 ? P.brass[5] : P.brass[3])); });
  G(401, 165, [1, 0.8, 0.5], 230); G(401, 166, [1, 0.8, 0.5], 200);
  // --- bookshelf of field guides above the top bunk, with bookends
  sticker(b, 338, 129, 24, 13, o => {
    o.rect(0, 11, 24, 2, (x, y) => (y === 0 ? P.teak[6] : P.teak[2]));
    const books: [number, number, C[]][] = [[2, 9, P.green], [2, 10, P.navy], [3, 8, P.red], [2, 9, P.mustard], [2, 10, P.quiltB], [2, 7, P.plum], [3, 9, P.orange], [2, 8, P.green]];
    let x = 1;
    for (const [bw, bh, c] of books) {
      o.rect(x, 11 - bh, bw, bh, (i, j) => (i === 0 ? c[4] : j === 1 ? c[5] ?? c[4] : j === bh - 2 ? c[1] : c[3]));
      x += bw;
    }
    // a leaning book and a brass bookend
    o.line(x + 1, 10, x + 4, 3, P.red[3]); o.line(x + 2, 10, x + 5, 4, P.red[2]);
    o.rect(21, 4, 2, 7, (i) => (i === 0 ? P.brass[5] : P.brass[2]));
  });
  // --- a humpback poster taped up between the shelf and the porthole
  sticker(b, 363, 127, 10, 14, o => {
    o.rect(0, 0, 10, 14, (x, y) => (x === 0 || y === 0 ? P.paper[5] : x === 9 || y === 13 ? P.paper[2] : y > 10 ? P.paper[4] : y < 4 ? P.quiltB[3] : P.quiltB[2]));
    o.ell(5, 6.5, 4, 1.8, (nx, ny) => (ny < 0 ? P.navy[4] : P.white[3]));
    o.poly([1, 5, 2, 7, 0, 8], P.navy[4]);
    o.px(7, 6, P.white[4]);
    o.hline(2, 7, 12, P.navy[2]);
    o.px(1, 0, P.paper[3]); o.px(8, 0, P.paper[3]);
  });
  // --- oilskin jacket and a beanie on hooks by the porthole
  sticker(b, 388, 126, 11, 26, o => {
    o.hline(2, 8, 0, P.wood[4]); o.px(4, 1, P.brass[5]); o.px(7, 1, P.brass[5]);
    o.ell(4, 4, 3, 2.4, (nx, ny) => (ny < -0.2 ? P.red[4] : P.red[2]));
    o.hline(1, 7, 5, P.white[3]);
    o.poly([4, 3, 10, 3, 11, 25, 3, 25], (x, y) => (x < 6 ? P.yellow[5] : x > 9 ? P.yellow[2] : y > 22 ? P.yellow[2] : P.yellow[4]));
    o.vline(7, 5, 24, P.yellow[2]);
    o.line(4, 8, 3, 18, P.yellow[3]);
    for (const y of [9, 14, 19]) o.px(8, y, P.metal[2]);
  });
  // --- tall locker with louvres, a towel over the door
  sticker(b, 406, 149, 16, 50, o => {
    o.rect(0, 0, 16, 50, (x, y) => (y === 0 ? P.teak[6] : x === 0 ? P.teak[5] : x === 15 || y === 49 ? P.teak[0] : rq(P.teak, 3, x, y, 0.3)));
    o.rect(2, 3, 12, 44, (x, y) => (x === 0 || y === 0 ? P.teak[1] : x === 11 || y === 43 ? P.teak[4] : P.teak[3]));
    for (let y = 6; y < 16; y += 2) { o.hline(4, 11, y, P.teak[1]); o.hline(4, 11, y + 1, P.teak[4]); }
    o.rect(11, 24, 2, 3, P.brass[5]); o.px(11, 26, P.brass[2]);
    // towel
    o.rect(3, 17, 7, 9, (x, y) => (y === 8 || x === 6 ? P.cushion[1] : y % 4 === 1 ? P.white[3] : P.cushion[3]));
  });
}

// ------------------------------------------------------------------ hold & lab (424..496)

function crate(o: Obj, x0: number, y0: number, w: number, h: number, label: string, t: C[] = P.wood) {
  o.rect(x0, y0, w, h, (x, y) => {
    const board = Math.floor(y / 4);
    let f = 4 + (noise1(x * 0.4 + board * 9 + x0, 11) - 0.5) * 1.1 + (y % 4 === 0 ? -1.3 : 0);
    if (x < 2 || y < 1) f += 0.8;
    if (x > w - 3 || y > h - 2) f -= 1.2;
    return ramp(t, f);
  });
  // corner battens with nail heads
  for (const bx of [x0, x0 + w - 2]) o.rect(bx, y0, 2, h, (x, y) => ramp(t, (x === 0 ? 5.6 : 3.6) - y * 0.04));
  for (const bx of [x0, x0 + w - 2]) { o.px(bx + 1, y0 + 1, P.metal[5]); o.px(bx + 1, y0 + h - 2, P.metal[5]); }
  // stencilled label
  if (label) pixelText(o, label, x0 + 3, y0 + Math.floor(h / 2) - 1, t === P.wood ? P.wood[1] : shade(t[1], -0.3), undefined, true);
}

function paintHold(b: PixelBuffer, G: GlowFn) {
  // --- a trawl net slung under the deckhead between two hooks: corkline with floats, mesh bellying down
  sticker(b, 466, 116, 28, 22, o => {
    const sag = (x: number) => 2 + Math.sin((x / 27) * Math.PI) * 9;
    for (let x = 0; x < 28; x++) {
      const top = Math.round(Math.sin((x / 27) * Math.PI) * 3), bot = Math.round(sag(x) + 8 + Math.sin(x * 0.9) * 1.5);
      for (let y = top; y <= bot && y < 22; y++) {
        const mesh = (x + y) % 3 === 0 || (x - y + 99) % 3 === 0;
        if (mesh) o.px(x, y, y > bot - 2 ? P.net[1] : P.net[4]);
        else if (y > top + 1 && y < bot - 1) o.px(x, y, P.net[2]);
      }
      o.px(x, top, P.rope[3]);
    }
    for (const fx of [3, 9, 15, 21]) { const ty = Math.round(Math.sin((fx / 27) * Math.PI) * 3); o.ell(fx + 0.5, ty + 1.5, 1.8, 1.8, (nx, ny) => (nx + ny < 0 ? P.orange[5] : P.orange[3])); }
  });
  b.set(466, 115, P.brass[5]); b.set(493, 114, P.brass[5]);
  // --- rack above the tank with two stencilled sample crates on it
  hline(b, 436, 458, 140, P.wood[5]); hline(b, 436, 458, 141, P.wood[2]);
  for (const kx of [438, 456]) { b.set(kx, 142, P.wood[3]); b.set(kx, 143, P.wood[2]); }
  sticker(b, 437, 128, 21, 12, o => {
    crate(o, 0, 0, 14, 12, 'LAB');
    crate(o, 14, 4, 7, 8, '', P.teak);
    o.px(17, 6, P.red[4]); o.px(16, 7, P.red[4]); o.px(18, 7, P.red[4]); o.px(17, 8, P.red[4]); o.px(17, 9, P.red[4]); // "this way up" arrow
  });
  // --- lab bench: white laminate top, steel legs, shelf of sample jars above
  hline(b, 466, 494, 151, P.wood[5]); hline(b, 466, 494, 152, P.wood[2]);
  for (const kx of [468, 492]) { b.set(kx, 153, P.wood[3]); b.set(kx, 154, P.wood[1]); }
  sticker(b, 467, 141, 26, 10, o => {
    const liq = [P.glass, P.green, P.mustard, P.glass, P.quiltB, P.moss];
    for (let i = 0; i < 6; i++) {
      const x = i * 4 + (i > 2 ? 2 : 0), h = 6 + ((i * 5) % 4), c = liq[i];
      o.rect(x, 10 - h, 3, h, (xx, yy) => (yy === 0 ? P.metal[3] : yy === 1 ? P.white[4] : xx === 0 ? c[4] : yy > h - 3 ? c[1] : c[3]));
      if (i % 2 === 0) o.px(x + 1, 10 - h + 3 + (i % 3), P.orange[4]); // a specimen
      o.px(x + 2, 10 - h + 2, P.white[4]);
    }
  });
  sticker(b, 465, 176, 30, 20, o => {
    o.rect(0, 0, 30, 3, (x, y) => (y === 0 ? P.white[4] : y === 1 ? P.white[3] : P.white[1]));
    o.rect(1, 3, 2, 17, (x) => (x === 0 ? P.metal[5] : P.metal[2]));
    o.rect(27, 3, 2, 17, (x) => (x === 0 ? P.metal[5] : P.metal[2]));
    o.hline(3, 26, 15, P.metal[4]);
  });
  // --- the forepeak: chain from the navel pipe to the chain locker, paint tins
  for (let y = lowCeil(492) + 1; y < 184; y++) {
    const x = 491 + (y % 2);
    b.set(x, y, (y % 4) < 2 ? P.metal[5] : P.metal[2]);
    b.set(x + 1 - (y % 2), y, P.metal[1]);
  }
  sticker(b, 486, 184, 9, 12, o => {
    o.rect(0, 0, 9, 12, (x, y) => (y === 0 ? P.wood[5] : x === 8 ? P.wood[1] : rq(P.wood, 2.4, x, y, 0.3)));
    o.rect(1, 1, 7, 3, P.metal[0]);
    for (let k = 0; k < 4; k++) o.px(2 + k * 2, 2, P.metal[4]);
  });
  sticker(b, 488, 179, 5, 5, o => o.rect(0, 0, 5, 5, (x, y) => (y === 0 ? P.metal[6] : x === 0 ? P.quiltB[4] : y === 2 ? P.white[3] : P.quiltB[2])));
  void G;
}

// ------------------------------------------------------------------ wheelhouse (214..334, 24..102)

const WH_WINDOWS = [222, 252, 282];

function paintWheelhouse(b: PixelBuffer, G: GlowFn) {
  const x0 = WH_X0 + 2, x1 = WH_X1 - 2, y0 = WH_CEIL + 2, y1 = WH_FLOOR - 1;
  // mahogany panelling: vertical boards below a rail, frame-and-panel above; translucent windows
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let win = -1;
    for (const wx of WH_WINDOWS) if (x >= wx && x < wx + 25 && y >= 32 && y < 59) win = wx;
    if (win >= 0) {
      const u = (x - win) / 25, v = (y - 32) / 27;
      const d = u + v * 0.8;
      let a = 70, f = 4.2 - v * 1.2;
      if (d > 0.25 && d < 0.36) { a = 150; f = 5; }
      else if (d > 0.5 && d < 0.54) { a = 120; f = 5; }
      if (y === 32 || x === win) { a = 230; f = 1; }
      b.set(x, y, withAlpha(ramp(P.glass, f), a));
      continue;
    }
    let f: number;
    if (y < 62) {
      const sx = (x - x0) % 30;
      f = 3.4 + (sx < 2 ? 0.5 : 0) + (noise1(x * 0.3 + y * 0.02, 4) - 0.5) * 0.5;
    } else if (y < 66) f = y === 62 ? 6 : y === 63 ? 4.6 : y === 64 ? 2.6 : 1.8; // chair rail
    else {
      const bx = (x - x0) % 5;
      f = 3.2 + (hash2(Math.floor((x - x0) / 5), 5, 1) - 0.5) * 0.6 + (noise1(y * 0.3 + x * 5.1, 2) - 0.5) * 0.6;
      if (bx === 0) f -= 1.3;
      else if (bx === 1) f += 0.6;
      f -= smoothstep(y1 - 12, y1, y) * 0.8;
    }
    // deckhead shadow
    f -= Math.max(0, 1 - (y - y0) / 8) * 1.2;
    b.set(x, y, ramp(P.mahog, f + dith(x, y, 0.4)));
  }
  // window frames (inside): varnished, lit top-left, a sill shelf under each
  for (const wx of WH_WINDOWS) {
    for (let x = wx - 2; x < wx + 27; x++) { b.set(x, 30, P.mahog[6]); b.set(x, 31, P.mahog[4]); b.set(x, 59, P.mahog[7]); b.set(x, 60, P.mahog[5]); b.set(x, 61, P.mahog[1]); }
    for (let y = 30; y < 60; y++) { b.set(wx - 2, y, P.mahog[6]); b.set(wx - 1, y, P.mahog[4]); b.set(wx + 25, y, P.mahog[2]); b.set(wx + 26, y, P.mahog[1]); }
    // mullion and a brass window catch
    b.set(wx + 12, 58, P.brass[5]); b.set(wx + 12, 57, P.brass[3]);
  }
  // deckhead: white painted boards with beams and a cable run
  for (let x = x0; x <= x1; x++) {
    b.set(x, y0, P.cream[1]);
    b.set(x, y0 + 1, (x - x0) % 20 < 3 ? P.mahog[5] : P.cream[2]);
    if ((x - x0) % 20 < 3) { b.set(x, y0 + 2, P.mahog[(x - x0) % 20 === 0 ? 6 : 3]); b.set(x, y0 + 3, P.mahog[1]); }
  }
  // floor (sole boards) in the same perspective band as below decks
  for (let x = WH_X0 + 1; x <= WH_X1 - 1; x++) {
    for (let r = 0; r < 4; r++) {
      const y = WH_FLOOR - 4 + r;
      const butt = (x + r * 19) % 37;
      let f = 2.8 + r * 0.55 + (noise1(x * 0.23 + r * 29, 14) - 0.5) * 0.9;
      if (butt === 0) f -= 1.4;
      if (r === 0) f -= 0.7;
      b.set(x, y, ramp(P.teak, f + dith(x, y, 0.4)));
    }
    b.set(x, WH_FLOOR, P.teak[6]);
    b.set(x, WH_FLOOR + 1, P.teak[3]);
  }
  // companionway hatch coaming in the sole
  for (let x = 218; x <= 230; x++) { b.set(x, WH_FLOOR - 4, P.varnish[6]); b.set(x, WH_FLOOR - 3, P.metal[0]); b.set(x, WH_FLOOR - 2, P.metal[0]); b.set(x, WH_FLOOR - 1, P.metal[1]); }
  // brass grab rail over the companionway
  hline(b, 218, 230, 66, P.brass[6]); hline(b, 218, 230, 67, P.brass[2]);
  b.set(218, 68, P.brass[3]); b.set(230, 68, P.brass[3]);

  // --- Joshu's settee berth, made up tight: navy cushion, a tartan blanket folded square, a pillow
  sticker(b, 231, 86, 22, 16, o => {
    o.rect(0, 5, 22, 11, (x, y) => (y === 10 ? P.mahog[0] : x === 0 ? P.mahog[6] : x === 21 ? P.mahog[2] : y === 0 ? P.mahog[5] : rq(P.mahog, 4, x, y, 0.3)));
    o.rect(2, 7, 18, 7, (x, y) => (x === 0 || y === 0 ? P.mahog[3] : x === 17 || y === 6 ? P.mahog[6] : P.mahog[4]));
    o.rect(0, 2, 22, 3, (x, y) => (y === 0 ? P.navy[4] : y === 2 ? P.navy[1] : P.navy[3]));
    // folded tartan: green with red / mustard lines, crisp hospital corner
    o.rect(8, -1, 14, 4, (x, y) => (x === 13 && y < 2 ? -1 : x === 3 || x === 9 ? P.red[3] : y === 1 ? P.mustard[4] : y === 0 ? P.green[5] : y === 3 ? P.green[1] : P.green[3]));
    o.line(8, 3, 11, 0, P.green[1]);
    o.ell(4, 1, 3.8, 2, (nx, ny) => (ny < -0.1 ? P.white[4] : ny > 0.5 ? P.white[1] : P.white[3]));
  });
  // shelf over the settee for the model ship
  hline(b, 230, 266, 85, P.mahog[7]); hline(b, 230, 266, 86, P.mahog[3]);
  // --- chart table with the chart, dividers and a parallel rule; drawers; gooseneck chart lamp
  sticker(b, 254, 80, 22, 22, o => {
    o.rect(0, 1, 22, 3, (x, y) => (y === 0 ? P.mahog[7] : y === 2 ? P.mahog[2] : P.mahog[5]));
    o.rect(1, 0, 19, 2, (x, y) => (y === 0 ? P.paper[5] : P.paper[3]));
    o.line(3, 0, 16, 0, P.quiltB[3]);
    o.px(12, 0, P.red[4]);
    for (let i = 0; i < 3; i++) o.rect(1, 5 + i * 5, 20, 4, (x, y) => (y === 0 ? P.mahog[6] : y === 3 ? P.mahog[1] : x === 19 ? P.mahog[2] : P.mahog[4]));
    for (let i = 0; i < 3; i++) { o.hline(9, 12, 7 + i * 5, P.brass[5]); }
    o.rect(0, 20, 22, 2, P.mahog[1]);
  });
  sticker(b, 257, 76, 9, 4, o => { o.line(0, 3, 4, 0, P.metal[6]); o.line(4, 0, 6, 3, P.metal[4]); o.hline(1, 8, 3, P.white[3]); });
  sticker(b, 271, 68, 5, 12, o => { o.vline(1, 3, 11, P.metal[3]); o.line(1, 3, 3, 0, P.metal[3]); o.rect(2, 0, 3, 2, P.red[3]); o.px(4, 1, P.yellow[6]); });
  G(275, 70, [1, 0.5, 0.35], 220);
  // --- helm console: angled instrument face, echo sounder, radar scope, gauges, throttle, compass, coffee
  sticker(b, 276, 74, 30, 28, o => {
    const W = 30;
    o.poly([0, 8, W, 3, W, 28, 0, 28], (x, y) => (y > 26 ? P.mahog[0] : x === 0 ? P.mahog[6] : x === W - 1 ? P.mahog[2] : rq(P.mahog, 4.2 - y * 0.03, x, y, 0.3)));
    // instrument face (black panel on the slope)
    o.poly([2, 10, W - 2, 6, W - 2, 16, 2, 18], (x, y) => (y < 11 && (x + y) % 9 === 0 ? P.metal[3] : P.metal[1]));
    // echo sounder screen
    o.rect(4, 11, 8, 6, (x, y) => (x === 0 || y === 0 ? P.metal[0] : y > 3 ? (x % 2 ? P.green[3] : P.green[2]) : P.green[1]));
    // radar scope
    o.ell(18, 12, 3.4, 3.4, (nx, ny) => (Math.hypot(nx, ny) > 0.75 ? P.metal[4] : Math.abs(nx) < 0.18 || Math.abs(ny) < 0.18 ? P.green[4] : P.green[1]));
    // rpm gauge
    o.ell(25, 11, 2.4, 2.4, (nx, ny) => (Math.hypot(nx, ny) > 0.7 ? P.brass[5] : ny > 0.3 ? P.cream[3] : P.cream[5]));
    o.px(25, 10, P.red[4]);
    // row of switches with little lamps
    for (let k = 0; k < 6; k++) { o.px(4 + k * 4, 21, P.metal[5]); o.px(4 + k * 4, 22, P.metal[2]); }
    // lower cupboard
    o.rect(3, 20, W - 6, 1, P.mahog[2]);
    o.rect(3, 24, W - 6, 3, (x, y) => (y === 0 ? P.mahog[2] : P.mahog[3]));
  });
  G(282, 88, [0.3, 1, 0.5], 230); G(284, 89, [0.3, 1, 0.5], 200); G(294, 86, [0.4, 1, 0.6], 230);
  G(280, 95, [1, 0.3, 0.2], 255); G(288, 95, [0.3, 1, 0.4], 255); G(296, 95, [1, 0.8, 0.2], 255);
  // wheel pedestal behind the wheel (the wheel itself is an animated part)
  sticker(b, 303, 66, 6, 36, o => {
    o.rect(1, 0, 4, 34, (x) => (x === 0 ? P.mahog[7] : x === 3 ? P.mahog[2] : P.mahog[5]));
    o.rect(0, 32, 6, 4, (x, y) => (y === 0 ? P.brass[5] : P.brass[2]));
    o.ell(3, 1.5, 3, 2, (nx, ny) => (nx + ny < 0 ? P.brass[6] : P.brass[3]));
  });
  // compass binnacle and the throttle on the console top
  sticker(b, 294, 70, 7, 7, o => {
    o.ell(3.5, 2.5, 3.5, 2.6, (nx, ny) => (Math.hypot(nx, ny) < 0.5 && ny < 0.2 ? P.glass[4] : nx + ny < -0.3 ? P.brass[6] : nx + ny < 0.4 ? P.brass[4] : P.brass[2]));
    o.rect(1, 4, 5, 3, (x, y) => (x === 0 ? P.brass[5] : y === 2 ? P.brass[1] : P.brass[3]));
  });
  sticker(b, 287, 70, 5, 7, o => { o.line(1, 6, 3, 0, P.metal[5]); o.px(3, 0, P.red[4]); o.px(4, 0, P.red[3]); o.rect(0, 5, 5, 2, P.metal[2]); });
  // the coffee mug (steaming)
  sticker(b, 279, 76, 5, 5, o => { o.rect(0, 0, 4, 5, (x, y) => (y === 0 ? P.metal[1] : x === 0 ? P.white[4] : x === 3 ? P.white[1] : y === 2 ? P.red[3] : P.white[3])); o.px(4, 1, P.white[2]); o.px(4, 3, P.white[2]); });
  G(281, 72, [1, 1, 1], 60); G(282, 69, [1, 1, 1], 40);
  // --- overhead radio console with the VHF set: amber display, knobs, handset on a curly cord
  sticker(b, 240, 27, 24, 10, o => {
    o.rect(0, 0, 24, 10, (x, y) => (y === 0 ? P.metal[2] : x === 0 ? P.metal[4] : x === 23 || y === 9 ? P.metal[0] : P.metal[2]));
    o.rect(2, 2, 20, 6, (x, y) => (y === 0 ? P.metal[4] : y === 5 ? P.metal[0] : P.metal[1]));
    o.rect(4, 3, 7, 3, P.orange[4]);
    o.hline(5, 9, 4, P.yellow[6]);
    for (const kx of [14, 18]) { o.px(kx, 4, P.metal[6]); o.px(kx + 1, 4, P.metal[4]); o.px(kx, 5, P.metal[3]); }
    o.px(12, 3, P.red[5]);
  });
  G(244, 30, [1, 0.6, 0.2], 230); G(247, 30, [1, 0.7, 0.3], 230); G(250, 30, [1, 0.6, 0.2], 230); G(252, 31, [1, 0.3, 0.2], 255);
  for (let k = 0; k < 10; k++) b.set(262 + (k % 2), 37 + k, P.metal[k % 2 ? 1 : 3]);
  sticker(b, 261, 47, 3, 6, o => o.rect(0, 0, 3, 6, (x, y) => (x === 0 ? P.metal[4] : y === 2 ? P.metal[5] : P.metal[2])));
  // rolled charts in the overhead rack
  for (let k = 0; k < 3; k++) sticker(b, 266 + k * 5, 27, 4, 4, o => o.ell(2, 2, 2, 2, (nx, ny) => (Math.hypot(nx, ny) < 0.4 ? P.paper[1] : ny < 0 ? P.paper[5] : P.paper[3])));
  hline(b, 264, 281, 31, P.mahog[6]);
  // --- forward panel: ship's clock and barometer, binoculars hung on a hook
  for (const [cx, cy, baro] of [[324, 70, false], [324, 84, true]] as const) {
    ring(b, cx, cy, 3.6, 5.6, (a, _t, x, y) => ramp(P.brass, 3.2 - Math.cos(a + 2.3) * 2 + dith(x, y, 0.3)));
    b.discFn(cx, cy, 3.7, (_x, _y, _nx, ny) => (ny > 0.4 ? P.cream[3] : P.cream[5]));
    if (baro) { b.set(cx - 1, cy - 1, P.metal[0]); b.set(cx - 2, cy - 2, P.metal[0]); b.set(cx + 2, cy, P.red[3]); }
    else { b.set(cx, cy - 1, P.metal[0]); b.set(cx, cy - 2, P.metal[0]); b.set(cx + 1, cy, P.metal[0]); b.set(cx + 2, cy, P.metal[0]); }
  }
  sticker(b, 312, 88, 8, 8, o => {
    o.line(1, 0, 3, 3, P.metal[2]); o.line(6, 0, 4, 3, P.metal[2]);
    o.rect(0, 3, 3, 5, (x) => (x === 0 ? P.metal[3] : P.metal[1])); o.rect(5, 3, 3, 5, (x) => (x === 0 ? P.metal[3] : P.metal[1]));
    o.hline(3, 4, 5, P.metal[1]); o.px(1, 7, P.glass[4]); o.px(6, 7, P.glass[4]);
  });
  // forward (raked) wall section seen end-on, and the aft door frame
  for (let y = y0; y <= y1; y++) { b.set(x1, y, P.mahog[2]); b.set(x1 - 1, y, P.mahog[5]); b.set(x0, y, P.mahog[6]); b.set(x0 + 1, y, P.mahog[3]); }
}

// ------------------------------------------------------------------ lamps & ladders

type GlowFn = (x: number, y: number, c: [number, number, number], a?: number) => void;

function paintLamps(b: PixelBuffer, g: PixelBuffer, lamps: Lamp[], G: GlowFn) {
  // warm halos for the interior rooms (drawn additively)
  for (const L of lamps.slice(0, 6)) {
    for (let y = -11; y <= 11; y++) for (let x = -11; x <= 11; x++) {
      const d = Math.hypot(x, y) / 11;
      if (d < 1) { const a = Math.round((1 - d) * (1 - d) * 130); if (a > (g.get(L.x + x, L.y + y) >>> 24)) G(L.x + x, L.y + y, L.color, a); }
    }
  }
  // brass cage lamps on flex from the deckhead: cap, glass globe with a bright filament, wire guard
  for (const L of lamps.slice(0, 6)) {
    const top = L.name === 'wheelhouse' ? WH_CEIL + 2 : lowCeil(L.x) + 2;
    for (let y = top; y < L.y - 3; y++) b.set(L.x, y, (y & 1) ? P.metal[1] : P.metal[2]);
    sticker(b, L.x - 3, L.y - 4, 7, 8, o => {
      o.rect(1, 0, 5, 2, (x, y) => (y === 0 ? P.brass[6] : x === 4 ? P.brass[2] : P.brass[4]));
      o.ell(3.5, 4.6, 3.2, 3, (nx, ny) => (Math.hypot(nx, ny) < 0.4 ? hex('#fff6d8') : ny < -0.2 ? hex('#ffe9ae') : hex('#f2c878')));
      o.vline(3, 2, 7, P.brass[3]);
      o.hline(1, 5, 4, P.brass[3]);
      o.rect(2, 7, 3, 1, P.brass[2]);
    });
    G(L.x, L.y, [1, 0.95, 0.8], 255); G(L.x, L.y + 1, [1, 0.9, 0.7], 255);
  }
}

function paintLadders(b: PixelBuffer, ladders: Ladder[]) {
  for (const ld of ladders) {
    const x0 = ld.x - 5, x1 = ld.x + 5;
    for (let y = ld.y0; y <= ld.y1; y++) {
      for (const rx of [x0, x1]) {
        b.set(rx, y, P.wood[6]);
        b.set(rx + 1, y, P.wood[3]);
        b.set(rx + 2, y, withAlpha(P.wood[0], 150));
      }
    }
    for (let y = ld.y0 + 3; y < ld.y1; y += 6) {
      for (let x = x0 + 2; x < x1; x++) {
        const worn = Math.abs(x - ld.x) < 3;
        b.set(x, y, worn ? P.wood[7] : P.wood[5]);
        b.set(x, y + 1, P.wood[2]);
        b.set(x, y + 2, withAlpha(P.wood[0], 110));
      }
    }
    // brass grab handles where the ladder meets the hatch
    for (const hx of [x0 - 1, x1 + 2]) { vline(b, hx, ld.y0 - 6, ld.y0 + 4, P.brass[5]); b.set(hx, ld.y0 - 7, P.brass[6]); }
  }
}

// ------------------------------------------------------------------ entry point

/** Paint the cutaway rooms into `b` (opaque, behind actors) and their emissive bits into `g`. */
export function paintInterior(b: PixelBuffer, g: PixelBuffer, lamps: Lamp[], ladders: Ladder[], storm: boolean) {
  const G: GlowFn = (x, y, c, a = 200) => g.set(x, y, withAlpha(rgba(Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255)), a));
  const rng = new Rng(21);
  paintWalls(b);
  paintCeiling(b);
  occlude(b);
  paintFloors(b);
  paintServices(b);
  paintBulkheads(b);
  // portholes on the back wall (you see the sea through them)
  for (const px of [140, 262, 380, 452]) porthole(b, px, 146, 5.5, null, false, true);
  paintEngineRoom(b, G);
  paintGalley(b, G);
  paintMess(b, G);
  paintBunks(b, G);
  paintHold(b, G);
  paintWheelhouse(b, G);
  paintLamps(b, g, lamps, G);
  paintLadders(b, ladders);
  // galley steam
  for (let i = 0; i < 6; i++) { const x = 238 + i; for (let k = 0; k < 4; k++) if (rng.chance(0.5)) g.set(x, 160 - k * 3 - (i % 2), withAlpha(rgba(255, 255, 255), 90)); }
  void storm;
}

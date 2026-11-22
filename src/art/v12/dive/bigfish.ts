// V12 Te Moana Rimurimu: the kelp dive's big fish, in the user's reference fish style (src/art/v9/fish.ts,
// through the dive's posable fish kit ./fishkit.ts): a solid lit volume in a few clean bands, hinted
// scale rows, a modelled bony head with the gill cover's lit rim, graded fins with their own rays and a
// hand-placed wet eye. All are real fish of these waters, painted big enough to read in the water.
//
//   hapuku       Hāpuku, the giant groper of the drop-off caves: a massive slate-and-bronze grouper,
//                the head a third of the fish, the lower jaw jutting, a bony ridge on the gill cover,
//                eleven stout dorsal spines and a broad square tail; faint dark mottling.
//                idle (hovering at the cave mouth, pectorals sculling, the gills pumping), swim, gulp
//                (the huge mouth thrown open), back (backing into the cave, fins reversing).
//   kingfish     Haku, the yellowtail kingfish: a torpedo in blue-green over silver with the brassy
//                stripe from snout to tail and the yellow forked tail. idle, swim, fast, turn.
//   bluecod      Rāwaru, the blue cod: a round-bodied bottom fish, blue-green mottled bronze over white,
//                big lips, eyes high on the head, a long low dorsal, the pelvics forward as props.
//                idle (propped on the reef, gills going), swim, turn.
//   sunfish      Kōtiri, the ocean sunfish: a leathery silver disc that ends in the clavus (a scalloped
//                rudder instead of a tail), the tall dorsal and anal fins beating together, a beak of a
//                mouth, a small round pectoral, blotched and scarred skin. idle (sculling), turn.
//   cleanerfish  Crimson cleanerfish: a slim pink-white wrasse with a crimson stripe that picks the
//                sunfish clean. idle, swim, peck.

import { hex } from '../../color';
import { pal, tone, body, fin, blob, fan, dorsal, tail, softH, spiny, pose, pk, frac, hash, fishDef, fishStill, renderFish } from './fishkit';
import type { FishArt, FishPose, Pt, Part } from './fishkit';
import type { AnimDef } from '../../beasts-core';
import type { PixelBuffer } from '../../pixel';
import { fbm } from '../../v9/fish-skin';

const TAU = Math.PI * 2;
const A = (frames: number, fps: number, loop = true): AnimDef => ({ frames, fps, loop });

// ==================================================================== Hāpuku
function hapuku(): FishArt {
  const back = pal('#0c1216', '#141d23', '#1e2a32', '#2a3942', '#384a54', '#4a5e68');
  const side = pal('#262d30', '#363f43', '#4a5457', '#606b6d', '#7a8485', '#98a19e');
  const belly = pal('#5e6461', '#7e8580', '#9ea59e', '#bcc2b9', '#d6dbd2', '#eceee6');
  const sheen = pal('#352f24', '#4b4433', '#645b44', '#7f7556', '#9c916c', '#bcb088');
  const blot = pal('#080c0e', '#0e1418', '#151d22', '#1d282e', '#27343b', '#324048');
  const finM = pal('#0a1013', '#11191d', '#1a252b', '#253239', '#33434a', '#455760');
  const finR = pal('#2a363c', '#3a4a51', '#4e6068', '#667a81', '#82969b', '#a2b4b6');
  const lip = pal('#5a5a52', '#7a786c', '#9a9686', '#b8b4a2', '#d2cebc', '#e8e4d4');
  const top: Pt[] = [[0.19, -0.062], [0.26, -0.08], [0.34, -0.112], [0.44, -0.146], [0.54, -0.166], [0.62, -0.172], [0.7, -0.166], [0.77, -0.148], [0.84, -0.12], [0.9, -0.088], [0.945, -0.056], [0.978, -0.024], [0.996, 0.004]];
  const bot: Pt[] = [[0.19, 0.058], [0.26, 0.072], [0.34, 0.098], [0.44, 0.122], [0.54, 0.136], [0.64, 0.14], [0.72, 0.136], [0.8, 0.122], [0.87, 0.102], [0.92, 0.08], [0.96, 0.056], [0.985, 0.036], [0.996, 0.02]];
  const spineR = pal('#1a2226', '#26323a', '#36464e', '#4a5c64', '#62767c', '#7e9296');
  const parts: Part[] = [
    fin({ ...tail(0.205, 0.052, 0.13, 0.04, 14, 0.02), ramp: finM, rayRamp: finR, z: 4, t: 2.2, grad: 1.1 }),
    fin({ ...dorsal(top, 0.27, 0.5, softH(0.085, 0.55), -1, 0.32, 13), ramp: finM, rayRamp: finR, z: 4, t: 2.2, alpha: 215 }),
    fin({ ...dorsal(top, 0.49, 0.74, spiny(0.075, 11, undefined, 0.3), -1, 0.2, 0, 11), ramp: finM, rayRamp: spineR, z: 4, spines: true, alpha: 230, minPx: 0.5 }),
    fin({ ...dorsal(bot, 0.27, 0.43, softH(0.08, 0.6), 1, 0.36, 9), ramp: finM, rayRamp: finR, z: 4, t: 2.3 }),
    fin({ ...fan([0.7, 0.118], [0.75, 0.112], [[0.67, 0.17], [0.645, 0.196], [0.67, 0.2], [0.71, 0.17]], 5), ramp: finM, rayRamp: finR, z: 4, t: 2.4 }),
    body({
      top, bot, back, side, belly, zb: 0.42, zl: 0.72, gill: 0.745, bow: 0.12, pre: 0.065,
      mouth: [0.99, 0.014, 0.14, 0.026], hints: 4, hintDark: true, lat: [0.26, 0.42, 0.06], spec: 0.6, light: 1.05,
      mark: (p, b) => {
        // the bony ridge on the gill cover: a raised bar with a lit top and a shadow under it
        if (b.head && p.x < 0.84 && p.x > 0.765) {
          const d = (p.y - (-0.024 + (p.x - 0.765) * 0.12)) * p.S;
          if (d > -0.5 && d < 0.6) return tone(b.ramp, b.t + 1.1);
          if (d >= 0.6 && d < 1.6) return tone(b.ramp, b.t - 1);
        }
        // the gill cover's lower edge and the flap
        if (b.head && b.v > 0.8 && p.x < 0.8) return tone(b.ramp, b.t - 0.6);
        // a bronze cast over the shoulder and cheek
        if (b.zone === 1 && fbm(p.x * 6, p.y * 6, 7) > 0.6) return tone(sheen, b.t - 0.4);
        // dark mottling: cloudy blotches over the back and flank, none on the belly
        if (b.v < 0.7) {
          const n = fbm(p.x * 10, p.y * 12, 4);
          if (n > 0.6 - b.v * 0.05) return tone(blot, b.t + 0.8 + (n > 0.68 ? -0.6 : 0));
        }
        // the brow and the top of the head a shade darker, the nape humped with muscle
        if (b.head && b.v < 0.25) return tone(back, b.t - 0.3);
        return null;
      },
    }),
    // the jutting lower jaw: a heavy chin under the snout, pale lips, hinged for the gulp
    blob({
      pts: [[0.88, 0.05], [0.93, 0.036], [0.97, 0.024], [1.006, 0.014], [1.018, 0.024], [1.01, 0.044], [0.97, 0.068], [0.93, 0.084], [0.89, 0.088], [0.866, 0.074]],
      ramp: belly, z: 12, t: 2.6, dome: 0.8, ink: true,
      move: () => { const g = pose().gape ?? 0; return g > 0 ? { cx: 0.875, cy: 0.05, a: g * 0.55 } : null; },
      mark: (p, t) => (p.y < 0.03 + (1.004 - p.x) * 0.2 && p.x > 0.95 ? tone(lip, t + 0.5) : p.y > 0.066 ? tone(side, t - 0.6) : null),
    }),
    // the throat when it gapes
    blob({
      pts: [[0.885, 0.05], [0.92, 0.03], [0.96, 0.018], [0.99, 0.014], [0.99, 0.06], [0.95, 0.09], [0.9, 0.09]],
      ramp: pal('#14080a', '#24100f', '#3a1a16', '#562a20', '#74402e', '#965840'), z: 11, t: 1.4, dome: 0.9, ink: false,
      when: () => (pose().gape ?? 0) > 0.05,
    }),
    // the pectoral: a broad rounded fan behind the gill cover
    fin({
      ...fan([0.735, 0.012], [0.73, 0.074], [[0.67, -0.008], [0.622, 0.014], [0.6, 0.046], [0.61, 0.08], [0.66, 0.1]], 10),
      ramp: finM, rayRamp: finR, z: 14, ink: true, t: 2.4, alpha: 200,
      move: () => ({ cx: 0.733, cy: 0.04, a: pose().pec ?? 0, sy: 1 - Math.abs(pk('scull')) * 0.35 }),
    }),
  ];
  return {
    x0: 0, x1: 1, ink: hex('#060a0c'), parts, sweepX: 0.55, sweepA: 0.6, head: [0.95, -0.02],
    eye: { x: 0.9, y: -0.045, r: 0.028, iris: hex('#b48838'), ring: hex('#5a4a24') },
  };
}

// ==================================================================== Kingfish
function kingfish(): FishArt {
  const back = pal('#061a22', '#0b2630', '#123644', '#1b4858', '#265c6c', '#337282');
  const side = pal('#3c5a5e', '#567678', '#749494', '#96b2b0', '#bcd2ce', '#e2f0ec');
  const belly = pal('#7e8a8a', '#a2acac', '#c4ccca', '#dee4e2', '#f0f4f2', '#ffffff');
  const brass = pal('#5a4a12', '#7e6a1c', '#a68c28', '#cab03a', '#e6cc54', '#f8e682');
  const finY = pal('#3a3008', '#5a4c0e', '#806e18', '#a69224', '#cab438', '#e8d45a');
  const finM = pal('#0a1a20', '#12262e', '#1c3640', '#284a54', '#386068', '#4c787e');
  const finR = pal('#28444a', '#3a5a60', '#527a7e', '#6e989a', '#90b8b8', '#b8d8d6');
  const top: Pt[] = [[0.19, -0.028], [0.28, -0.044], [0.4, -0.074], [0.52, -0.094], [0.64, -0.1], [0.75, -0.094], [0.85, -0.075], [0.92, -0.05], [0.965, -0.026], [0.992, -0.006]];
  const bot: Pt[] = [[0.19, 0.026], [0.28, 0.04], [0.4, 0.065], [0.52, 0.083], [0.64, 0.088], [0.75, 0.08], [0.85, 0.062], [0.92, 0.042], [0.965, 0.022], [0.992, 0.006]];
  const stripe = (u: number) => 0.44 - Math.sin(u * Math.PI) * 0.02;
  return {
    x0: 0, x1: 1, ink: hex('#04121a'), sweepX: 0.58, sweepA: 0.75, head: [0.97, 0],
    eye: { x: 0.92, y: -0.02, r: 0.02, iris: hex('#d6cc9a'), ring: hex('#6a6440') },
    parts: [
      fin({ ...tail(0.215, 0.024, 0.15, 0.74, 13), ramp: finY, rayRamp: brass, z: 4, t: 2.4, grad: 1.2, alpha: 230 }),
      fin({ ...dorsal(top, 0.3, 0.6, s => 0.07 * Math.pow(1 - s, 1.6) * Math.min(1, s * 8) + 0.016, -1, 0.42, 14), ramp: finM, rayRamp: finR, z: 4, t: 2, alpha: 230 }),
      fin({ ...dorsal(top, 0.6, 0.7, spiny(0.03, 5), -1, 0.2, 0, 5), ramp: finM, rayRamp: finR, z: 4, spines: true, alpha: 200, minPx: 0.5 }),
      fin({ ...dorsal(bot, 0.3, 0.5, s => 0.05 * Math.pow(1 - s, 1.4) * Math.min(1, s * 8) + 0.012, 1, 0.42, 10), ramp: finY, rayRamp: brass, z: 4, t: 1.8, alpha: 220 }),
      fin({ ...fan([0.7, 0.084], [0.74, 0.08], [[0.66, 0.11], [0.645, 0.12], [0.67, 0.116]], 3), ramp: finY, rayRamp: brass, z: 4 }),
      body({
        top, bot, back, side, belly, zb: 0.4, zl: 0.58, gill: 0.83, pre: 0.045, mouth: [0.99, 0.008, 0.075, 0.008], hints: 3, lat: [0.3, 0.46, 0.06], spec: 0.85,
        mark: (p, b) => {
          // the brassy stripe from the snout through the eye to the tail
          const sv = stripe(b.u);
          if (Math.abs(b.v - sv) * b.Hpx < 0.6) return tone(brass, b.t + 0.6);
          // the dark line through the eye
          if (b.head && Math.abs(p.y - (-0.02 + (p.x - 0.92) * 0.35)) * p.S < 0.6 && p.x > 0.85 && p.x < 0.9) return tone(back, 1);
          return null;
        },
      }),
      fin({ ...fan([0.82, 0.02], [0.82, 0.042], [[0.75, 0.012], [0.71, 0.03], [0.75, 0.05]], 5), ramp: finM, rayRamp: finR, z: 14, ink: true, t: 2.6, alpha: 190, move: () => ({ cx: 0.82, cy: 0.03, a: pose().pec ?? 0 }) }),
    ],
  };
}

// ==================================================================== Blue cod
function bluecod(): FishArt {
  const back = pal('#081a2a', '#0e2c44', '#163e5e', '#205478', '#2c6c92', '#3c86ac');
  const side = pal('#1a3c56', '#24526e', '#326a88', '#4686a2', '#62a2bc', '#88c0d4');
  const belly = pal('#8a948e', '#aab4ae', '#c8d0ca', '#e0e6e0', '#f0f4f0', '#fcfffc');
  const mott = pal('#3a2410', '#523418', '#6c4622', '#885a2c', '#a4703a', '#c0884a');
  const finM = pal('#0c2026', '#143038', '#1e444c', '#2a5a62', '#3a727a', '#4e8c92');
  const finR = pal('#2e5a60', '#3e727a', '#548e96', '#6eaab0', '#90c6ca', '#b8e0e2');
  const lip = pal('#4e5850', '#6c7a70', '#8c9a90', '#acbab0', '#cad6ce', '#e4ece6');
  const top: Pt[] = [[0.19, -0.026], [0.3, -0.04], [0.45, -0.058], [0.6, -0.072], [0.72, -0.082], [0.82, -0.088], [0.9, -0.078], [0.95, -0.056], [0.985, -0.024], [0.998, 0.004]];
  const bot: Pt[] = [[0.19, 0.024], [0.3, 0.036], [0.45, 0.05], [0.6, 0.062], [0.72, 0.072], [0.82, 0.078], [0.9, 0.072], [0.95, 0.058], [0.985, 0.04], [0.998, 0.022]];
  return {
    x0: 0, x1: 1, ink: hex('#061216'), sweepX: 0.55, sweepA: 0.7, head: [0.97, 0],
    eye: { x: 0.9, y: -0.046, r: 0.03, iris: hex('#6ab89e'), ring: hex('#2a5a4c') },
    parts: [
      fin({ ...tail(0.2, 0.024, 0.085, 0.1, 11, 0.02), ramp: finM, rayRamp: finR, z: 4, t: 3, grad: 1.4, alpha: 210 }),
      fin({ ...dorsal(top, 0.24, 0.8, s => (s > 0.78 ? 0.02 : 0.03) * Math.min(1, s * 14, (1 - s) * 20), -1, 0.25, 0, 22), ramp: finM, rayRamp: finR, z: 4, t: 3, alpha: 170, spines: false }),
      fin({ ...dorsal(bot, 0.24, 0.62, s => 0.028 * Math.min(1, s * 12, (1 - s) * 16), 1, 0.28, 16), ramp: finM, rayRamp: finR, z: 4, t: 3.2, alpha: 170 }),
      // the pelvics, set forward under the throat: the props it rests on
      fin({ ...fan([0.83, 0.066], [0.86, 0.062], [[0.8, 0.1], [0.8, 0.112], [0.83, 0.106]], 3), ramp: finM, rayRamp: finR, z: 4, t: 2.5, move: () => ({ cx: 0.845, cy: 0.064, a: pk('prop') * 0.5 }) }),
      body({
        top, bot, back, side, belly, zb: 0.32, zl: 0.52, gill: 0.83, pre: 0.04, mouth: [0.998, 0.02, 0.07, 0.012], hints: 3, lat: [0.2, 0.36, 0.04], spec: 0.8,
        mark: (p, b) => {
          // bronze-brown mottling over the blue-green upper half (the bold male pattern)
          if (b.v < 0.62 && !b.head) {
            const n = fbm(p.x * 16, p.y * 20, 9);
            if (n > 0.56) return tone(mott, b.t + 0.3);
          }
          // fleshy pale lips
          if (p.x > 0.965 && p.y > 0.008) return tone(lip, b.t);
          // a blue scribble of lines on the cheek
          if (b.head && b.v > 0.4 && b.v < 0.8 && Math.abs(frac(p.x * 70 + b.v * 3) - 0.5) < 0.08 && p.S > 30) return tone(side, b.t + 1.2);
          return null;
        },
      }),
      fin({ ...fan([0.82, 0.008], [0.82, 0.05], [[0.75, -0.004], [0.71, 0.02], [0.71, 0.046], [0.75, 0.066]], 7), ramp: finM, rayRamp: finR, z: 14, ink: true, t: 2.6, alpha: 200, move: () => ({ cx: 0.82, cy: 0.03, a: pose().pec ?? 0 }) }),
    ],
  };
}

// ==================================================================== Ocean sunfish
function sunfish(): FishArt {
  const back = pal('#262c30', '#353d42', '#475055', '#5c666a', '#747e82', '#8e989a');
  const side = pal('#4a5458', '#5e696c', '#768184', '#909a9b', '#acb5b4', '#c8cfcc');
  const belly = pal('#6e7676', '#8a9292', '#a8b0ae', '#c4cac6', '#dce0da', '#eef0ea');
  const blotch = pal('#5a6266', '#727b7e', '#8c9596', '#a8b0ae', '#c6ccc8', '#e2e6e0');
  const dark = pal('#1a1f22', '#232a2e', '#2e373b', '#3b464a', '#4a5559', '#5c676a');
  const finM = pal('#1c2226', '#283034', '#363f43', '#465054', '#586266', '#6c767a');
  const finR = pal('#3a4448', '#4c575b', '#606c70', '#788488', '#929ea0', '#b0babb');
  const scarC = hex('#d4dad6');
  // the disc: deep and short, cut off square behind where the clavus takes over
  const top: Pt[] = [[0.06, -0.25], [0.12, -0.3], [0.22, -0.345], [0.34, -0.37], [0.46, -0.372], [0.58, -0.35], [0.68, -0.31], [0.77, -0.255], [0.85, -0.19], [0.91, -0.125], [0.955, -0.065], [0.985, -0.02], [0.998, 0.008]];
  const bot: Pt[] = [[0.06, 0.24], [0.12, 0.29], [0.22, 0.33], [0.34, 0.35], [0.46, 0.348], [0.58, 0.325], [0.68, 0.285], [0.77, 0.232], [0.85, 0.172], [0.91, 0.114], [0.955, 0.066], [0.985, 0.036], [0.998, 0.022]];
  // the clavus: a scalloped rudder of fin rays, lobed with little ossicles along its edge
  const clav: Pt[] = [[0.075, -0.26]];
  const nL = 9;
  for (let i = 0; i <= nL * 4; i++) {
    const s = i / (nL * 4), y = -0.26 + s * 0.5, lobe = Math.abs(Math.sin(s * nL * Math.PI));
    clav.push([0.04 - Math.sin(s * Math.PI) * 0.055 - lobe * 0.022, y]);
  }
  clav.push([0.075, 0.24]);
  const clavRays: [Pt, Pt][] = [];
  for (let i = 0; i < nL; i++) { const s = (i + 0.5) / nL, y = -0.26 + s * 0.5; clavRays.push([[0.09, y * 0.92], [0.02 - Math.sin(s * Math.PI) * 0.055, y]]); }
  // copepods and scars (hand-placed)
  const LICE: Pt[] = [[0.3, -0.12], [0.34, -0.1], [0.52, 0.18], [0.2, 0.05], [0.62, -0.22]];
  const SCARS: [Pt, Pt][] = [[[0.42, -0.06], [0.5, -0.02]], [[0.26, 0.14], [0.3, 0.2]], [[0.6, 0.06], [0.66, 0.04]]];
  const segD = (x: number, y: number, a: Pt, b: Pt) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t);
  };
  return {
    x0: 0, x1: 1, ink: hex('#0e1214'), sweepX: 0.2, sweepA: 0.3, head: [0.95, -0.02],
    eye: { x: 0.85, y: -0.08, r: 0.032, iris: hex('#8a9a9a'), ring: hex('#3a4444') },
    parts: [
      fin({ pts: clav, rays: clavRays, ramp: finM, rayRamp: finR, z: 4, t: 2.4, grad: 0.8, alpha: 255, rayK: 0.8, ink: true }),
      // the dorsal fin: tall, sickle-shaped, raked back, beating from side to side with the anal
      fin({
        ...fan([0.36, -0.37], [0.13, -0.31], [[0.34, -0.5], [0.31, -0.66], [0.27, -0.8], [0.235, -0.86], [0.215, -0.83], [0.2, -0.7], [0.17, -0.52], [0.14, -0.36]], 10, [[0.27, -0.8], [0.235, -0.86], [0.215, -0.83], [0.2, -0.7], [0.17, -0.52], [0.14, -0.36]]),
        ramp: finM, rayRamp: finR, z: 4, t: 2.9, grad: 0.9, alpha: 255, rayK: 0.7, ink: true,
        move: () => ({ cx: 0.25, cy: -0.35, sy: Math.cos(pk('beat') * 0.85), a: -pk('beat') * 0.08 }),
      }),
      fin({
        ...fan([0.35, 0.345], [0.13, 0.3], [[0.33, 0.48], [0.3, 0.63], [0.26, 0.76], [0.225, 0.82], [0.205, 0.79], [0.19, 0.66], [0.16, 0.48], [0.135, 0.34]], 10, [[0.26, 0.76], [0.225, 0.82], [0.205, 0.79], [0.19, 0.66], [0.16, 0.48], [0.135, 0.34]]),
        ramp: finM, rayRamp: finR, z: 4, t: 3, grad: 0.9, alpha: 255, rayK: 0.7, ink: true,
        move: () => ({ cx: 0.25, cy: 0.33, sy: Math.cos(pk('beat') * 0.85), a: pk('beat') * 0.08 }),
      }),
      body({
        top, bot, back, side, belly, zb: 0.3, zl: 0.7, light: 0.95, spec: 0.5, headRound: 0.4,
        mark: (p, b) => {
          // the beak: fused teeth at the tip of the snout
          if (p.x > 0.975 && p.y > -0.006 && p.y < 0.03) return hex('#d6d2c4');
          if (p.x > 0.965 && Math.abs(p.y - 0.012) * p.S < 0.6) return tone(dark, 0);
          // the gill opening: a small dark hole ahead of the pectoral
          if (Math.hypot(p.x - 0.745, (p.y + 0.02) * 0.7) * p.S < Math.max(0.9, p.S * 0.012)) return tone(dark, 0);
          // copepod lice: dark specks with a pale rim
          for (const q of LICE) { const d = Math.hypot(p.x - q[0], p.y - q[1]) * p.S; if (d < 0.9) return tone(dark, 1); if (d < 1.6 && p.y < q[1]) return tone(blotch, 4); }
          // old scars: pale scratches
          for (const [a, c] of SCARS) if (segD(p.x, p.y, a, c) * p.S < 0.55) return scarC;
          // the blotched leathery skin: big pale patches and dark clouds
          const n = fbm(p.x * 9, p.y * 9, 13);
          if (n > 0.66) return tone(blotch, b.t + 0.3);
          if (n < 0.27 && b.v < 0.7) return tone(b.ramp, b.t - 0.6);
          // the rough skin's grain: a few raised wrinkles running back from the head
          if (p.S > 50 && b.u < 0.85 && Math.abs(frac(p.y * 26 + Math.sin(p.x * 9) * 0.6) - 0.5) < 0.05 && hash(Math.floor(p.x * 60), Math.floor(p.y * 26), 3) < 0.5) return tone(b.ramp, b.t - 0.7);
          // the rim where the body meets the clavus
          if (p.x < 0.1 && (p.x - 0.06) * p.S < 2) return tone(b.ramp, b.t - 0.8);
          return null;
        },
      }),
      // the pectoral: small, round, set high behind the eye, sculling
      fin({
        ...fan([0.73, -0.06], [0.73, 0.02], [[0.68, -0.07], [0.65, -0.04], [0.645, -0.01], [0.66, 0.02], [0.69, 0.035]], 6),
        ramp: finM, rayRamp: finR, z: 14, ink: true, t: 3.2, alpha: 230,
        move: () => ({ cx: 0.73, cy: -0.02, a: pose().pec ?? 0, sy: 1 - Math.abs(pk('beat')) * 0.25 }),
      }),
    ],
  };
}

// ==================================================================== Crimson cleanerfish
function cleaner(): FishArt {
  const back = pal('#5a3a18', '#7a5426', '#9c7034', '#bc9046', '#d6ae5e', '#ecca7c');
  const side = pal('#a46a6a', '#c48a86', '#dcaaa4', '#ecc6c0', '#f8e0dc', '#fff4f2');
  const belly = pal('#b49c9a', '#cebab6', '#e2d2ce', '#f0e6e2', '#faf4f2', '#ffffff');
  const crim = pal('#4a0a10', '#700e18', '#981c22', '#c02a2a', '#de4434', '#f46a48');
  const finM = pal('#7a4a3a', '#9a604a', '#ba7c5e', '#d49a78', '#eab894', '#f8d4b4');
  const top: Pt[] = [[0.2, -0.03], [0.32, -0.048], [0.5, -0.066], [0.68, -0.07], [0.82, -0.06], [0.92, -0.04], [0.97, -0.02], [0.995, -0.004]];
  const bot: Pt[] = [[0.2, 0.028], [0.32, 0.042], [0.5, 0.058], [0.68, 0.062], [0.82, 0.054], [0.92, 0.036], [0.97, 0.018], [0.995, 0.004]];
  return {
    x0: 0, x1: 1, ink: hex('#2a0e0a'), sweepX: 0.6, sweepA: 0.7, head: [0.98, 0],
    eye: { x: 0.9, y: -0.016, r: 0.024, iris: hex('#e84a2a') },
    parts: [
      fin({ ...tail(0.22, 0.026, 0.08, 0.05, 8, 0.02), ramp: finM, z: 4, t: 2.6, alpha: 200 }),
      fin({ ...dorsal(top, 0.26, 0.82, softH(0.034, 0.3), -1, 0.2, 14), ramp: finM, z: 4, t: 2.4, alpha: 190 }),
      fin({ ...dorsal(bot, 0.26, 0.56, softH(0.03, 0.3), 1, 0.2, 9), ramp: finM, z: 4, t: 2.6, alpha: 190 }),
      body({
        top, bot, back, side, belly, zb: 0.32, zl: 0.62, gill: 0.82, spec: 0.9,
        mark: (p, b) => (Math.abs(b.v - 0.52) * b.Hpx < 0.5 && b.u > 0.04 && b.u < 0.92 ? tone(crim, b.t + 0.5) : null),
      }),
    ],
  };
}

// ==================================================================== poses and defs
const swimPose = (t: number, amp: number, extra: FishPose = {}): FishPose => ({ sweep: Math.sin(t * TAU) * amp, pec: 0.1 * Math.cos(t * TAU), ...extra });

export const HAPUKU_ANIMS: Record<string, AnimDef> = { idle: A(6, 4), swim: A(6, 6), gulp: A(5, 6, false), back: A(4, 4) };
export const HAPUKU = fishDef({
  name: 'Hāpuku', len: 80, height: 24, art: hapuku, anims: HAPUKU_ANIMS, w: 120, h: 70,
  pose(anim, f, n) {
    const t = f / n, s = Math.sin(t * TAU);
    if (anim === 'idle') return { sweep: s * 0.15, gape: 0.06 + 0.06 * Math.max(0, s), pec: 0.12 * Math.sin(t * TAU), k: { scull: Math.sin(t * TAU) } };
    if (anim === 'swim') return swimPose(t, 0.45, { gape: 0.05 });
    if (anim === 'gulp') return { gape: [0.2, 0.7, 1, 0.6, 0.1][f], sweep: 0.1, pec: 0.3, eye: f === 2 ? 'narrow' : 'open' };
    return { sweep: -s * 0.12, pec: -0.35 + 0.2 * Math.sin(t * TAU), gape: 0.08, k: { scull: Math.cos(t * TAU) } };
  },
});

export const KING_ANIMS: Record<string, AnimDef> = { idle: A(4, 5), swim: A(6, 9), fast: A(4, 14), turn: A(3, 12, false) };
export const KINGFISH = fishDef({
  name: 'Kingfish', len: 46, height: 10, art: kingfish, anims: KING_ANIMS, w: 64, h: 30,
  pose(anim, f, n) {
    const t = f / n;
    if (anim === 'idle') return swimPose(t, 0.35);
    if (anim === 'swim') return swimPose(t, 0.6);
    if (anim === 'fast') return swimPose(t, 1, { pec: -0.3 });
    return { sx: [0.75, 0.5, 0.32][f], sweep: [0.6, 0.9, 1][f], pec: 0.4 };
  },
});

export const COD_ANIMS: Record<string, AnimDef> = { idle: A(4, 3), swim: A(4, 8), turn: A(3, 10, false) };
export const BLUECOD = fishDef({
  name: 'Blue cod', len: 36, height: 8, art: bluecod, anims: COD_ANIMS, w: 52, h: 26,
  pose(anim, f, n) {
    const t = f / n;
    if (anim === 'idle') return { sweep: Math.sin(t * TAU) * 0.12, pec: 0.25 * Math.sin(t * TAU), k: { prop: 0.6 }, gape: f % 2 ? 0.1 : 0 };
    if (anim === 'swim') return swimPose(t, 0.7, { pec: -0.3 });
    return { sx: [0.72, 0.48, 0.32][f], sweep: [0.6, 0.9, 1][f], pec: 0.4 };
  },
});

export const SUN_ANIMS: Record<string, AnimDef> = { idle: A(8, 5), turn: A(4, 5, false) };
export const SUNFISH = fishDef({
  name: 'Ocean sunfish', len: 84, height: 140, art: sunfish, anims: SUN_ANIMS, w: 130, h: 200,
  anchor: [0.5, 0],
  pose(anim, f, n) {
    const t = f / n;
    if (anim === 'idle') return { k: { beat: Math.sin(t * TAU) }, pec: 0.3 * Math.sin(t * TAU + 1), sweep: 0 };
    return { sx: [0.8, 0.6, 0.45, 0.35][f], k: { beat: [0.5, 0.9, 1, 0.8][f] }, pec: 0.3 };
  },
});

export const CLEAN_ANIMS: Record<string, AnimDef> = { idle: A(4, 6), swim: A(4, 10), peck: A(4, 8) };
export const CLEANER = fishDef({
  name: 'Crimson cleanerfish', len: 18, height: 4, art: cleaner, anims: CLEAN_ANIMS, w: 30, h: 20,
  pose(anim, f, n) {
    const t = f / n;
    if (anim === 'peck') return { swing: [0, 0.2, 0, -0.1][f], rot: [0.25, 0.45, 0.3, 0.2][f] };
    return { swing: Math.sin(t * TAU) * (anim === 'swim' ? 0.35 : 0.18) };
  },
});

export const DIVE_FISH: Record<string, ReturnType<typeof fishDef>> = { hapuku: HAPUKU, kingfish: KINGFISH, bluecod: BLUECOD, sunfish: SUNFISH, cleanerfish: CLEANER };

/** a still of one of the dive's fish (item art, the catch on the spear line) */
export function diveFishStill(id: keyof typeof DIVE_FISH | string, len: number): PixelBuffer {
  const d = DIVE_FISH[id] ?? KINGFISH;
  return fishStill(d.fishArt(), len, { sweep: 0.15 });
}

const heldCache = new Map<string, { buf: PixelBuffer; ax: number; ay: number }>();
/** one of the dive's fish turned to angle rot (radians; -PI/2 = head up), the fish point at fraction u of
 *  its length (0 tail .. 1 snout) at (ax, ay): a fish held in a beak or jaws */
export function diveFishHeld(id: string, len: number, rot: number, u = 0.85): { buf: PixelBuffer; ax: number; ay: number } {
  const k = `${id}:${len}:${rot.toFixed(2)}:${u}`;
  let c = heldCache.get(k);
  if (!c) {
    const d = DIVE_FISH[id] ?? BLUECOD, w = Math.ceil(len * 2.4) + 8, h = w;
    const r = renderFish(d.fishArt(), len, w, h, Math.round(w / 2), Math.round(h / 2), [u, 0], { rot, sweep: 0.3 });
    c = { buf: r.buf, ax: Math.round(w / 2), ay: Math.round(h / 2) };
    heldCache.set(k, c);
  }
  return c;
}

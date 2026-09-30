// V4 island geometry: one long side-view shoreline. The sea is behind the walker, the land (dunes,
// palms, bush) is in front of the camera. The cast walks the firm wet sand at the water's edge, so
// the band just in front of their feet is a mirror.
//
//   0 ─ west rocks ─ 420 ─ wreck of the Kittiwake ─ 1400 ─ landing beach (camp) ─ 2600 ─ palm grove
//   and tide pools ─ 3300 ─ stream mouth ─ 4000 ─ seal rocks ─ 4700 ─ under the cliffs ─ 5050 ─ sea cave
//   ─ 5450 ─ hidden cove ─ 5900 ─ bush track uphill ─ 6900

import { clamp, noise1, smoothstep } from '../../core/math';

export const ISL = {
  W: 6900,
  /** walk line of the beach (world y on the gameplay plane) */
  GY: 210,
  /** bottom of the painted ground */
  BOT: 390,
  /** height of the forest plateau above the beach */
  RISE: 62,
};

export type Zone = 'rocks' | 'wreck' | 'landing' | 'grove' | 'stream' | 'seal' | 'cliffs' | 'cave' | 'cove' | 'forest';
export const ZONES: [Zone, number, number][] = [
  ['rocks', 0, 420], ['wreck', 420, 1400], ['landing', 1400, 2600], ['grove', 2600, 3300], ['stream', 3300, 4000],
  ['seal', 4000, 4700], ['cliffs', 4700, 5050], ['cave', 5050, 5450], ['cove', 5450, 5900], ['forest', 5900, 6900],
];
export function zoneAt(x: number): Zone {
  for (const [z, a, b] of ZONES) if (x >= a && x < b) return z;
  return x < 0 ? 'rocks' : 'forest';
}

/** the wreck: ship-local x (Kittiwake art) maps to island x = sx + WRECK.dx; ship y + WRECK.dy */
export const WRECK = { x0: 470, sx0: 24, sx1: 560, dx: 394, dy: -12, floor: 190, w: 416, breach: [780, 818] as [number, number], climbX: 799 };

export const SPOT = {
  moriWake: 1760,
  jenna: 2010,
  chunkEat: 856,
  tank: 838,
  engine: 554,
  camp: 1980,
  fire: 1990,
  stream: 3780,
  sealRock: 4330,
  sealTired: 4990,
  caveIn: 5060,
  caveOut: 5440,
  boots: 5640,
  trail: 5800,
  joshu: 6640,
  creek: 6560,
};

/** world y of the walkable surface at x */
export function groundY(x: number): number {
  const G = ISL.GY;
  if (x < 420) {
    // rock shelf, a little higher and lumpy, easing down to the sand
    const k = smoothstep(300, 420, x);
    const lump = (noise1(x / 38, 3) - 0.5) * 7 + (noise1(x / 11, 8) - 0.5) * 2;
    return G - 5 * (1 - k) + lump * (1 - k);
  }
  if (x < 5050) {
    let y = G + Math.sin(x * 0.011) * 1.2 + Math.sin(x * 0.037 + 1) * 0.5;
    // the stream mouth: a shallow ford
    const s = Math.abs(x - SPOT.stream);
    if (s < 60) y += 5 * (1 - smoothstep(20, 60, s));
    return y;
  }
  if (x < 5450) {
    // inside the sea cave: uneven wet rock, a pool in the middle
    const k = Math.min(smoothstep(5050, 5110, x), 1 - smoothstep(5390, 5450, x));
    const pool = Math.abs(x - 5250) < 50 ? 4 * (1 - smoothstep(20, 50, Math.abs(x - 5250))) : 0;
    return G - 3 * k + (noise1(x / 24, 5) - 0.5) * 5 * k + pool;
  }
  if (x < 5900) return G + Math.sin(x * 0.02) * 1;
  // the bush track: up the bank from the cove, then the forest floor on the plateau
  const up = smoothstep(5900, 6260, x);
  let y = G - ISL.RISE * up + (noise1(x / 60, 12) - 0.5) * 8 * up;
  const c = Math.abs(x - SPOT.creek);
  if (c < 50) y += 7 * (1 - smoothstep(14, 50, c));
  return y;
}

/** how reflective the ground just in front of the walk line is (wet sand, pools) */
export function wetAt(x: number): number {
  const z = zoneAt(x);
  if (z === 'forest') return Math.abs(x - SPOT.creek) < 40 ? 1 : 0;
  if (z === 'cave') return Math.abs(x - 5250) < 44 ? 1 : 0.35;
  if (z === 'rocks') return clamp((x - 330) / 90);
  return 1;
}

/** fraction of forest canopy overhead (leaf shadows, god rays, shade) */
export function canopyAt(x: number): number {
  const grove = Math.max(0, 1 - Math.abs(x - 2950) / 380);
  const forest = smoothstep(5880, 6180, x);
  return clamp(Math.max(grove * 0.8, forest));
}

/** 0..1 how enclosed the sea cave is at x */
export function caveAt(x: number): number {
  return Math.min(smoothstep(5030, 5110, x), 1 - smoothstep(5390, 5470, x));
}

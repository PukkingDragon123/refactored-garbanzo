// Region Map geography for the painter (map pixels, MAP_W x MAP_H, north up). Everything here is
// written in the design grid of the place table (atlas.ts GRID_W x GRID_H, 960 x 640) and scaled to
// map pixels on load, so it lines up with the places; heights are in map pixels of lift (the painted
// map is a 3/4 "diorama" view: a point at height h is drawn h pixels above where it stands).
// The coastline, islets and rivers stay in src/game/v10/atlas.ts (the game's data); this is only how
// the map looks.
//
// The land, roughly:
//   north shore     the home beach (the wreck on the west point, camp, the palm grove, the stream
//                   mouth, seal rocks), the headland with the glowworm cave, the hidden cove and the
//                   sea grotto, the Serpent Coast to the north-east
//   Te Wao Nui      the great forest behind the beaches, wrapping the Fernwood valley, the tableland
//                   of giant kauri (the Emerald Canopy) and the old pā on its terraced hill
//   Te Wai Pango    the black-water mangroves, down the Awa Pango to the west inlet; Te Kāinga upriver
//   the high east   Ngā Puke Kōhatu (tussock, tors and scree) above Thunder Falls; the gorge of the
//                   Bone Cliffs climbing to Ngā Maunga Hukarere, the snowy range
//   the south       the glowing valley under the range, the hot valley, the sinkhole (Te Korokoro),
//                   the southern bush and the sea cliffs of the Far Coast

import { GRID_K } from '../../game/v10/atlasgeo';

/** design grid -> map pixels */
export const S = GRID_K;
type P2 = [number, number];
const G = (x: number, y: number): P2 => [x * S, y * S];
const GP = (pts: P2[]): P2[] => pts.map(([x, y]) => G(x, y));

export enum B {
  sea = 0, meadow, forest, fern, canopy, beech, swamp, garden, terraces, hills, mountain, gorge, glow, thermal, sink, plain, scrub, dunes, beach, rock,
  coastal, wetland,
}
export const BIOME_N = 22;

/** a biome blob: an ellipse (cx, cy, rx, ry, rotation in degrees) or a thick polyline (pts, radius) */
export type Shape = { b: B; e: [number, number, number, number, number?] } | { b: B; s: P2[]; r: number };
const E = (b: B, cx: number, cy: number, rx: number, ry: number, rot = 0): Shape => ({ b, e: [cx * S, cy * S, rx * S, ry * S, rot] });
const L = (b: B, r: number, ...pts: P2[]): Shape => ({ b, s: GP(pts), r: r * S });

export const SHAPES: Shape[] = [
  // ---- Te Wao Nui, the great forest
  E(B.forest, 158, 156, 104, 30), E(B.forest, 300, 176, 92, 54), E(B.forest, 398, 172, 52, 30), E(B.forest, 92, 232, 44, 64),
  L(B.forest, 14, [66, 140], [130, 138], [210, 136], [262, 134]), E(B.forest, 232, 290, 30, 22), E(B.forest, 120, 196, 40, 30),
  E(B.fern, 444, 200, 44, 27), E(B.fern, 262, 196, 22, 16, 20),
  E(B.canopy, 388, 252, 94, 31),
  // ---- the coastal fringe behind the beaches: pōhutukawa, nīkau, flax
  L(B.coastal, 9, [96, 120], [150, 122], [210, 121], [262, 121], [300, 124]), L(B.coastal, 8, [646, 106], [700, 106], [732, 100]),
  L(B.coastal, 8, [200, 520], [270, 530], [350, 536]), L(B.coastal, 7, [630, 520], [700, 530], [750, 522]),
  // ---- the black-water mangroves and the inlet, raupō wetland at their head
  L(B.swamp, 30, [228, 168], [208, 210], [186, 252], [168, 292], [150, 318]), E(B.swamp, 124, 314, 30, 16),
  E(B.wetland, 232, 176, 16, 11),
  // ---- Te Kāinga and the old pā
  E(B.garden, 212, 360, 40, 20, 8), E(B.terraces, 316, 306, 22, 30),
  // ---- the southern bush
  E(B.beech, 332, 446, 126, 70), E(B.beech, 118, 452, 58, 56), E(B.beech, 212, 482, 60, 38), E(B.forest, 782, 432, 78, 72),
  E(B.beech, 470, 410, 50, 30),
  // ---- the high east
  E(B.hills, 576, 192, 74, 46, -8), E(B.hills, 528, 214, 30, 18), E(B.plain, 596, 292, 54, 24, -10), E(B.plain, 520, 350, 82, 46),
  E(B.mountain, 770, 224, 120, 108, 12), E(B.mountain, 848, 388, 40, 70),
  L(B.gorge, 12, [540, 262], [580, 254], [612, 246], [646, 238]),
  E(B.glow, 676, 302, 30, 50, 6), E(B.thermal, 648, 408, 66, 38, -6), E(B.sink, 522, 470, 62, 32),
];

/** the kind of shore along the coast: anchor points (grid) blended between neighbours, so beaches
 *  narrow into rocks and cliffs rise out of them; p: beach width or cliff height (map px) */
export type Shore = 'beach' | 'rock' | 'cliff' | 'mangrove';
export const SHORE_PTS: { x: number; y: number; k: Shore; p: number }[] = ([
  [50, 90, 'rock', 8], [90, 92, 'rock', 6], [120, 102, 'beach', 40], [176, 106, 'beach', 52], [240, 101, 'beach', 48], [285, 99, 'beach', 30],
  [306, 90, 'cliff', 26], [334, 106, 'beach', 12], [360, 96, 'cliff', 30], [392, 78, 'cliff', 38], [430, 97, 'rock', 14], [470, 86, 'rock', 16],
  [510, 77, 'cliff', 30], [560, 92, 'rock', 12], [596, 100, 'beach', 22], [650, 89, 'beach', 36], [700, 89, 'beach', 34], [740, 76, 'cliff', 30],
  [790, 61, 'cliff', 40], [840, 92, 'cliff', 50], [890, 140, 'cliff', 56], [920, 212, 'cliff', 60], [930, 240, 'cliff', 50], [886, 300, 'beach', 14],
  [910, 330, 'cliff', 52], [904, 390, 'cliff', 56], [866, 450, 'beach', 16], [868, 500, 'rock', 14], [876, 546, 'cliff', 30], [820, 548, 'rock', 10],
  [760, 556, 'beach', 34], [690, 561, 'beach', 38], [630, 565, 'beach', 24], [600, 563, 'cliff', 50], [540, 568, 'cliff', 66], [470, 574, 'cliff', 70],
  [400, 564, 'cliff', 60], [372, 552, 'rock', 20], [330, 542, 'beach', 40], [260, 546, 'beach', 40], [200, 532, 'beach', 34], [150, 540, 'beach', 26],
  [100, 570, 'beach', 24], [64, 566, 'rock', 12], [66, 520, 'rock', 10], [56, 460, 'beach', 26], [62, 400, 'beach', 22], [90, 354, 'mangrove', 0],
  [150, 320, 'mangrove', 0], [100, 296, 'mangrove', 0], [64, 262, 'beach', 20], [54, 206, 'beach', 14], [42, 160, 'beach', 24], [42, 124, 'rock', 8],
  [132, 44, 'beach', 16], [214, 30, 'rock', 18], [808, 44, 'cliff', 20], [920, 600, 'rock', 8], [38, 560, 'rock', 8],
] as [number, number, Shore, number][]).map(([x, y, k, p]) => ({ x: x * S, y: y * S, k, p }));

/** extra land and water carved into the coastline: headlands, spits, coves, the inlet (ellipses in the
 *  grid; +1 land, -1 sea) */
export const COAST_EDITS: { e: [number, number, number, number, number?]; k: 1 | -1 }[] = ([
  { e: [96, 100, 9, 4, -10], k: 1 },      // the west point's reef rocks the wreck lies on
  { e: [870, 462, 9, 7], k: -1 },          // a sea cave cove on the east coast
  { e: [580, 558, 7, 4], k: -1 },          // a notch in the far coast cliffs
] as { e: [number, number, number, number, number?]; k: 1 | -1 }[]).map(c => ({ ...c, e: [c.e[0] * S, c.e[1] * S, c.e[2] * S, c.e[3] * S, c.e[4] ?? 0] as [number, number, number, number, number] }));

/** relief (map px of lift): plateaus with sheer edges, rolling hills, the range, sunken valleys */
export type Relief =
  | { k: 'plateau'; e: [number, number, number, number, number?]; h: number; edge: number }
  | { k: 'dome'; e: [number, number, number, number, number?]; h: number }
  | { k: 'terrace'; e: [number, number, number, number, number?]; h: number; step: number }
  | { k: 'basin'; e: [number, number, number, number, number?]; h: number; edge: number }
  | { k: 'rolling'; e: [number, number, number, number, number?]; h: number; f: number }
  | { k: 'poly'; pts: P2[]; edge: number[]; h: number; e: [number, number, number, number, number?] };
const RE = (e: [number, number, number, number, number?]): [number, number, number, number, number] => [e[0] * S, e[1] * S, e[2] * S, e[3] * S, e[4] ?? 0];
/** a plateau outlined by a polygon (grid x, y, edge width in map px at that vertex) */
const POLY = (v: [number, number, number][], h: number): Relief => {
  const pts = v.map(([x, y]) => G(x, y)), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return { k: 'poly', pts, edge: v.map(q => q[2]), h, e: [(x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, 0] };
};
export const RELIEF: Relief[] = [
  { k: 'rolling', e: RE([250, 180, 190, 90]), h: 22, f: 0.012 },      // Te Wao Nui's low hills
  { k: 'rolling', e: RE([300, 450, 200, 100]), h: 34, f: 0.01 },      // the southern bush
  { k: 'rolling', e: RE([790, 440, 90, 90]), h: 40, f: 0.011 },
  { k: 'plateau', e: RE([388, 254, 96, 32]), h: 58, edge: 0.05 },     // the tableland
  POLY([[468, 214, 5], [490, 232, 5], [506, 244, 4], [520, 254, 4], [536, 266, 5], [552, 282, 8], [574, 304, 30], [606, 320, 40],
    [646, 332, 50], [694, 338, 50], [728, 322, 60], [746, 282, 60], [748, 232, 60], [734, 186, 60], [706, 152, 70], [656, 140, 70], [604, 148, 70],
    [548, 166, 60], [504, 188, 30]], 88),                              // the highland above the falls (its west edge a sheer scarp)
  { k: 'plateau', e: RE([566, 196, 88, 54, -8]), h: 34, edge: 0.4 },  // the rocky hills rise out of it
  { k: 'dome', e: RE([316, 304, 23, 30]), h: 34 },                     // the pā hill
  { k: 'terrace', e: RE([316, 304, 20, 27]), h: 0, step: 7 },
  { k: 'basin', e: RE([676, 302, 27, 46, 6]), h: 46, edge: 0.1 },     // the sunken glowing valley
  { k: 'basin', e: RE([648, 408, 60, 34, -6]), h: 18, edge: 0.45 },   // the hot valley
  { k: 'basin', e: RE([522, 470, 38, 17]), h: 84, edge: 0.05 },       // Te Korokoro
  { k: 'rolling', e: RE([526, 360, 100, 60]), h: 26, f: 0.014 },
  { k: 'dome', e: RE([212, 356, 34, 20, 8]), h: 10 },                 // the village terrace
];

/** the range: ridge spines (knots) and peak height along them; the painter grows ridged rock around */
export const RANGE: { pts: P2[]; h: number[]; w: number }[] = [
  { pts: GP([[700, 168], [740, 186], [774, 212], [806, 246], [832, 290], [846, 336], [852, 380]]), h: [70, 150, 220, 236, 196, 150, 96], w: 34 * S },
  { pts: GP([[742, 124], [784, 136], [824, 158], [860, 188]]), h: [60, 110, 128, 96], w: 22 * S },
  { pts: GP([[712, 248], [742, 266], [774, 284], [806, 300]]), h: [80, 130, 150, 120], w: 22 * S },
  { pts: GP([[866, 214], [880, 254], [886, 300]]), h: [100, 120, 90], w: 18 * S },
  { pts: GP([[832, 362], [846, 404], [850, 444]]), h: [110, 96, 60], w: 22 * S },
];
/** the range's footprint (ridged noise and snow live inside it) */
export const RANGE_E: [number, number, number, number, number] = RE([780, 262, 122, 150, 12]);

/** the camp, the wreck and the other landmarks (where they stand on the ground) */
export const LM = {
  tent: G(170, 115), fire: G(180, 117), flag: G(163, 113), table: G(190, 114), boatyard: G(148, 113), signpost: G(198, 121),
  wreck: G(88, 92),
  grove: G(218, 112), stream: G(248, 108), seals: G(276, 108),
  cave: G(312, 112), cove: G(340, 110), track: G(356, 128),
  arch: G(406, 70), grotto: G(380, 100), stacks: GP([[420, 82], [372, 74], [516, 70], [530, 74], [796, 54], [930, 262], [600, 576], [356, 562], [880, 560]]),
  village: G(208, 354), wharenui: G(206, 349),
  pa: G(316, 304),
  falls: G(534, 264), plunge: G(526, 271),
  whale: G(686, 92),
  bones: G(596, 264),
  volcano: G(808, 44),
  sink: G(522, 470),
  farfall: G(470, 572),
  stack: G(214, 30),
  lookout: G(300, 186),
  bridge: G(336, 274),
};

/** mud wallows in the great forest (the tiger's favourite): x, y, r (map px) */
export const WALLOWS: [number, number, number][] = ([[288, 184, 5], [262, 158, 4], [328, 202, 4], [452, 212, 3]] as [number, number, number][]).map(([x, y, r]) => [x * S, y * S, r * S]);

/** hot pools in the hot valley (x, y, r, kind: 0 turquoise, 1 orange, 2 mud) */
export const POOLS: [number, number, number, number][] = ([
  [622, 402, 4, 0], [640, 394, 3, 1], [656, 410, 5, 0], [668, 400, 3, 2], [648, 420, 3, 2], [678, 412, 4, 1], [632, 418, 3, 0], [690, 398, 2, 2],
] as [number, number, number, number][]).map(([x, y, r, k]) => [x * S, y * S, r * S, k]);

/** smoke (wood fire), steam (white) and spray emitters (ground points; the live map lifts them) */
export const SMOKES: { at: P2; kind: 'smoke' | 'steam' | 'spray' | 'ash'; rate: number; loc: string }[] = ([
  { at: [180, 110], kind: 'smoke', rate: 1.8, loc: 'camp' },
  { at: [200, 350], kind: 'smoke', rate: 1.1, loc: 'village' },
  { at: [219, 356], kind: 'smoke', rate: 0.9, loc: 'village' },
  { at: [231, 349], kind: 'smoke', rate: 0.8, loc: 'village' },
  { at: [808, 40], kind: 'ash', rate: 1.6, loc: 'motuahi' },
  { at: [626, 400], kind: 'steam', rate: 1.3, loc: 'geovalley' },
  { at: [644, 392], kind: 'steam', rate: 1.0, loc: 'geovalley' },
  { at: [660, 407], kind: 'steam', rate: 1.5, loc: 'geovalley' },
  { at: [676, 398], kind: 'steam', rate: 0.9, loc: 'geovalley' },
  { at: [651, 418], kind: 'steam', rate: 1.0, loc: 'geovalley' },
  { at: [636, 424], kind: 'steam', rate: 0.8, loc: 'geovalley' },
  { at: [526, 270], kind: 'spray', rate: 3.2, loc: 'falls' },
  { at: [470, 578], kind: 'spray', rate: 2.2, loc: 'farcoast' },
  { at: [522, 474], kind: 'steam', rate: 1.8, loc: 'unknown' },
] as { at: P2; kind: 'smoke' | 'steam' | 'spray' | 'ash'; rate: number; loc: string }[]).map(s => ({ ...s, at: G(s.at[0], s.at[1]) }));

/** where the Kitten sails from camp to each boat destination (sea, so no lift) */
export const SEA_LANES: Record<string, P2[]> = {
  fishgrounds: GP([[184, 100], [196, 82], [240, 62], [300, 44]]),
  glassreef: GP([[184, 100], [206, 80], [244, 56]]),
  motuahi: GP([[184, 100], [226, 76], [320, 62], [460, 56], [640, 48], [780, 46], [796, 52]]),
  farcoast: GP([[184, 100], [150, 84], [84, 82], [34, 118], [24, 200], [24, 300], [28, 400], [44, 500], [110, 572], [220, 586], [340, 588], [462, 578]]),
};

/** big names across the land (shown once the place under them is coloured in), ground points */
export const REGION_NAMES: { text: string; at: P2; size: number }[] = [
  { text: 'TE WAO NUI', at: G(252, 150), size: 2 },
  { text: 'TE WAI PANGO', at: G(150, 262), size: 1 },
  { text: 'NGĀ PUKE KŌHATU', at: G(586, 172), size: 1 },
  { text: 'NGĀ MAUNGA HUKARERE', at: G(780, 200), size: 2 },
  { text: 'THE SOUTHERN BUSH', at: G(330, 440), size: 1 },
  { text: 'THE TABLELAND', at: G(400, 262), size: 1 },
];
/** the seas' names (on the paper, always) */
export const SEA_NAMES: { text: string; at: P2 }[] = [
  { text: 'TE MOANA NUI', at: G(560, 22) },
  { text: 'TE MOANA NUI', at: G(110, 606) },
];

/** wildlife vignettes: where each little animal lives (ground, map px) */
export const CRITTERS = {
  seals: GP([[272, 107], [278, 105], [284, 108]]),
  whale: G(604, 40),
  leviathan: GP([[470, 72], [540, 64], [610, 68]]),
  fin: GP([[700, 72], [730, 66], [760, 74]]),
  tiger: G(288, 184),
  croc: GP([[204, 226], [196, 240], [188, 254]]),
  stork: G(214, 214),
  bonefaces: GP([[448, 206], [456, 209], [452, 214]]),
  hawks: ([[566, 186, 16], [612, 170, 12]] as [number, number, number][]).map(([x, y, r]) => [x * S, y * S, r * S] as [number, number, number]),
  gulls: GP([[150, 94], [236, 92], [300, 98]]),
  auks: G(530, 256),
  colony: G(808, 44),
  waka: [GP([[96, 318], [124, 324], [146, 318]]), GP([[196, 362], [214, 368], [234, 372]])],
  kitten: G(186, 97),
  people: GP([[177, 118], [184, 119], [182, 115]]),
};

/** how far either side of the trail Mori sees (map px) as he walks a place */
export const REVEAL_R: Record<string, number> = Object.fromEntries(Object.entries({
  hills: 44, canopy: 36, ruins: 34, falls: 34, fossils: 34, coast: 36, unknown: 36, geovalley: 34, forest: 34, fernwood: 32, mangrove: 30, village: 32, glowforest: 28, deep: 30, grotto: 24,
}).map(([k, v]) => [k, v * S]));
/** what a place shows once it has been well walked (half explored): the land seen from it (ground) */
export const VISTAS: Record<string, [number, number, number, number][]> = Object.fromEntries(Object.entries({
  camp: [[176, 108, 60, 16]],
  'isle-wreck': [[100, 110, 30, 16]],
  'isle-grove': [[226, 108, 30, 12]],
  'isle-stream': [[252, 108, 28, 12]],
  'isle-seals': [[278, 108, 28, 12]],
  'isle-cave': [[316, 114, 30, 12]],
  'isle-track': [[352, 132, 30, 18]],
  forest: [[158, 150, 98, 26], [306, 172, 82, 48]],
  fernwood: [[444, 200, 42, 24], [398, 172, 46, 26]],
  canopy: [[388, 252, 90, 28]],
  falls: [[506, 242, 30, 20]],
  mangrove: [[214, 194, 24, 32], [190, 250, 26, 34], [164, 300, 30, 22]],
  village: [[212, 358, 42, 22], [128, 312, 30, 16]],
  ruins: [[316, 306, 24, 30], [300, 382, 58, 28]],
  fossils: [[596, 270, 54, 20], [600, 292, 48, 20]],
  hills: [[576, 192, 72, 44], [700, 150, 56, 36], [640, 240, 40, 24]],
  glowforest: [[676, 302, 28, 48]],
  geovalley: [[648, 408, 64, 36]],
  unknown: [[522, 470, 60, 30]],
  coast: [[680, 90, 68, 18]],
  deep: [[534, 64, 92, 20]],
  grotto: [[400, 104, 40, 12]],
  fishgrounds: [[300, 40, 48, 14]],
  glassreef: [[244, 54, 30, 12]],
  motuahi: [[808, 44, 30, 22]],
  farcoast: [[470, 548, 88, 22]],
} as Record<string, [number, number, number, number][]>).map(([k, v]) => [k, v.map(([a, b, c, d]) => [a * S, b * S, c * S, d * S] as [number, number, number, number])]));

/** extra streams (beyond atlas RIVERS): east-side torrents and the southern rivers */
export const EXTRA_RIVERS: P2[][] = [
  GP([[836, 300], [858, 326], [878, 342], [906, 352]]),
  GP([[502, 488], [490, 512], [478, 534], [471, 556], [470, 578]]),
  GP([[338, 418], [306, 404], [276, 392], [250, 378]]),
  GP([[734, 250], [714, 270], [698, 288], [686, 300]]),
  GP([[760, 310], [772, 350], [780, 390], [792, 430], [812, 476], [824, 516], [826, 552]]),
  GP([[160, 440], [140, 470], [122, 500], [100, 512], [80, 514], [60, 514]]),
];

/** the reef, the shelf's drop-off and the Deep (sea features; ellipses in map px) */
export const SEAFLOOR = {
  reef: RE([244, 54, 44, 12, -6]),
  reefOuter: RE([236, 46, 70, 20, -6]),
  shelf: RE([300, 36, 56, 16]),
  deep: RE([534, 62, 100, 24]),
  kelp: RE([470, 572, 44, 10]),
};

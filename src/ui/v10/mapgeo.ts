// Region Map geography for the painter (map pixels, MAP_W x MAP_H, north up): which biome covers
// which part of the land, the mountain ridges and the rocky hills, landmarks, wildlife vignettes,
// smoke and steam, the sea lanes the Kitten sails and the hand-written region names. The coastline,
// islets and rivers stay in src/game/v10/atlas.ts (the game's data); this is only how the map looks.
//
// The land, roughly:
//   north shore     the home beach (camp, the wreck on the west point, palms, seal rocks), the
//                   headland with the glowworm cave and the sea grotto, the Serpent Coast to the NE
//   Te Wao Nui      the great forest: everything behind the beaches, wrapping the Fernwood valley,
//                   the tableland of giant kauri (the Emerald Canopy) and the old pā to the south
//   Te Wai Pango    the black-water mangroves, down the Awa Pango to the west inlet; Te Kāinga upriver
//   the high east   Ngā Puke Kōhatu (rocky hills: tors, scree, tussock) above Thunder Falls; the gorge
//                   of the Bone Cliffs climbing to Ngā Maunga Hukarere, the snowy range
//   the south       the glowing valley under the range, the hot valley, the sinkhole (Te Korokoro),
//                   the southern bush and the sea cliffs of the Far Coast

export enum B {
  sea = 0, meadow, forest, fern, canopy, beech, swamp, garden, terraces, hills, mountain, gorge, glow, thermal, sink, plain, scrub, dunes, beach, rock,
}
export const BIOME_N = 20;

/** a biome blob: an ellipse (cx, cy, rx, ry, rotation in degrees) or a thick polyline (pts, radius) */
export type Shape = { b: B; e: [number, number, number, number, number?] } | { b: B; s: [number, number][]; r: number };

export const SHAPES: Shape[] = [
  // ---- Te Wao Nui, the great forest
  { b: B.forest, e: [158, 150, 104, 30] },
  { b: B.forest, e: [306, 172, 88, 54] },
  { b: B.forest, e: [398, 172, 52, 30] },
  { b: B.forest, e: [92, 232, 44, 64] },
  { b: B.forest, s: [[66, 138], [130, 136], [210, 134], [262, 132]], r: 14 },
  { b: B.forest, e: [232, 290, 30, 22] },
  { b: B.fern, e: [444, 200, 42, 26] },
  { b: B.canopy, e: [388, 252, 94, 31] },
  // ---- the black-water mangroves and the inlet
  { b: B.swamp, s: [[228, 168], [208, 210], [186, 252], [168, 292], [150, 318]], r: 30 },
  { b: B.swamp, e: [124, 312, 30, 16] },
  // ---- Te Kāinga and the old pā
  { b: B.garden, e: [212, 358, 40, 20, 8] },
  { b: B.terraces, e: [316, 306, 22, 30] },
  // ---- the southern bush
  { b: B.beech, e: [332, 446, 126, 70] },
  { b: B.beech, e: [118, 452, 58, 56] },
  { b: B.beech, e: [212, 482, 60, 38] },
  { b: B.forest, e: [782, 432, 78, 72] },
  // ---- the high east
  { b: B.hills, e: [576, 192, 74, 46, -8] },
  { b: B.hills, e: [528, 214, 30, 18] },
  { b: B.plain, e: [596, 292, 54, 24, -10] },
  { b: B.plain, e: [520, 350, 82, 46] },
  { b: B.mountain, e: [770, 224, 120, 108, 12] },
  { b: B.mountain, e: [848, 388, 40, 70] },
  { b: B.gorge, s: [[544, 284], [582, 272], [612, 258], [646, 244]], r: 13 },
  { b: B.glow, e: [676, 302, 30, 50, 6] },
  { b: B.thermal, e: [648, 408, 66, 38, -6] },
  { b: B.sink, e: [522, 470, 62, 32] },
];

/** elevation features (0..1 added to a gentle base): plateaus with steep edges, hills, the range */
export const HEIGHTS: { e: [number, number, number, number]; h: number; edge: number }[] = [
  { e: [388, 252, 96, 33], h: 0.32, edge: 0.18 },   // the tableland
  { e: [600, 282, 84, 42], h: 0.36, edge: 0.3 },    // the highland above the falls
  { e: [576, 194, 80, 52], h: 0.3, edge: 0.6 },     // the rocky hills
  { e: [770, 224, 128, 116], h: 0.5, edge: 0.8 },   // the range
  { e: [316, 306, 24, 32], h: 0.18, edge: 0.6 },    // the pā hill
  { e: [522, 470, 40, 18], h: -0.5, edge: 0.15 },   // the sinkhole
  { e: [676, 302, 26, 44], h: -0.16, edge: 0.4 },   // the sunken valley
];

/** the escarpments: rock faces where the high ground drops (polyline, face height) */
export const CLIFFS: { pts: [number, number][]; h: number }[] = [
  { pts: [[296, 226], [326, 220], [356, 218], [390, 216], [424, 216], [452, 220], [476, 228]], h: 5 },   // the tableland's north edge
  { pts: [[488, 236], [504, 244], [516, 250], [528, 256], [542, 266], [556, 276]], h: 7 },               // Thunder Falls
  { pts: [[290, 286], [300, 278]], h: 3 },
];

/** mountain ridges: [x, y] knots and the size along them (w, h at each knot) */
export const RIDGES: { pts: [number, number][]; size: [number, number][] }[] = [
  { pts: [[668, 152], [710, 170], [750, 190], [786, 214], [816, 250], [838, 294], [850, 340]], size: [[38, 31], [55, 47], [78, 70], [82, 75], [65, 57], [50, 42], [38, 31]] },
  { pts: [[704, 120], [748, 128], [796, 140], [844, 164]], size: [[38, 29], [50, 39], [55, 44], [40, 31]] },
  { pts: [[706, 248], [738, 266], [772, 284], [806, 300]], size: [[38, 29], [50, 39], [55, 44], [40, 31]] },
  { pts: [[862, 210], [878, 252], [884, 300]], size: [[35, 29], [38, 31], [32, 26]] },
  { pts: [[836, 360], [848, 404], [852, 440]], size: [[42, 34], [38, 29], [30, 23]] },
];

/** the camp, the wreck and the other landmarks (painted where they stand) */
export const LM = {
  tent: [172, 106] as const, fire: [181, 108] as const, flag: [165, 104] as const,
  wreck: [100, 106] as const,
  village: [210, 354] as const,
  pa: [316, 304] as const,
  cave: [313, 112] as const,
  arch: [392, 92] as const,
  falls: [521, 250] as const, plunge: [510, 244] as const,
  whale: [686, 94] as const,
  bones: [596, 264] as const,
  volcano: [808, 44] as const,
  sink: [522, 470] as const,
  farfall: [470, 551] as const,
  signpost: [362, 140] as const,
  stack: [214, 30] as const,
};

/** mud wallows in the great forest (the tiger's favourite) */
export const WALLOWS: [number, number, number][] = [[288, 184, 5], [262, 158, 4], [328, 202, 4], [452, 212, 3]];

/** hot pools in the hot valley (x, y, r, kind: 0 turquoise, 1 orange, 2 mud) */
export const POOLS: [number, number, number, number][] = [
  [622, 402, 4, 0], [640, 394, 3, 1], [656, 410, 5, 0], [668, 400, 3, 2], [648, 420, 3, 2], [678, 412, 4, 1], [632, 418, 3, 0], [690, 398, 2, 2],
];

/** smoke (wood fire), steam (white) and spray emitters */
export const SMOKES: { at: [number, number]; kind: 'smoke' | 'steam' | 'spray' | 'ash'; rate: number; loc: string }[] = [
  { at: [181, 106], kind: 'smoke', rate: 1.6, loc: 'camp' },
  { at: [200, 348], kind: 'smoke', rate: 1.1, loc: 'village' },
  { at: [218, 354], kind: 'smoke', rate: 0.9, loc: 'village' },
  { at: [231, 347], kind: 'smoke', rate: 0.8, loc: 'village' },
  { at: [808, 33], kind: 'ash', rate: 1.5, loc: 'motuahi' },
  { at: [626, 400], kind: 'steam', rate: 1.2, loc: 'geovalley' },
  { at: [644, 392], kind: 'steam', rate: 0.9, loc: 'geovalley' },
  { at: [660, 407], kind: 'steam', rate: 1.4, loc: 'geovalley' },
  { at: [676, 398], kind: 'steam', rate: 0.8, loc: 'geovalley' },
  { at: [651, 418], kind: 'steam', rate: 0.9, loc: 'geovalley' },
  { at: [509, 243], kind: 'spray', rate: 2.2, loc: 'falls' },
  { at: [470, 554], kind: 'spray', rate: 1.6, loc: 'farcoast' },
  { at: [522, 474], kind: 'steam', rate: 1.6, loc: 'unknown' },
];

/** where the Kitten sails from camp to each boat destination */
export const SEA_LANES: Record<string, [number, number][]> = {
  fishgrounds: [[184, 100], [196, 82], [240, 62], [300, 44]],
  glassreef: [[184, 100], [206, 80], [244, 56]],
  motuahi: [[184, 100], [226, 76], [320, 62], [460, 56], [640, 48], [780, 44], [800, 48]],
  farcoast: [[184, 100], [150, 84], [84, 82], [40, 118], [30, 200], [30, 300], [34, 400], [48, 500], [110, 562], [220, 576], [340, 578], [462, 570]],
};

/** big hand-written names across the land (shown once the place under them is coloured in) */
export const REGION_NAMES: { text: string; at: [number, number]; rot: number; size: number; spread?: number }[] = [
  { text: 'Te Wao Nui', at: [300, 160], rot: -5, size: 34, spread: 0.18 },
  { text: 'Te Wai Pango', at: [196, 262], rot: -64, size: 22, spread: 0.12 },
  { text: 'Ngā Puke Kōhatu', at: [584, 176], rot: -4, size: 22, spread: 0.1 },
  { text: 'Ngā Maunga Hukarere', at: [770, 182], rot: 14, size: 26, spread: 0.14 },
  { text: 'the southern bush', at: [330, 432], rot: 3, size: 22 },
  { text: 'the tableland', at: [392, 262], rot: -2, size: 18 },
];

/** wildlife vignettes: where each little animal lives (map px) and the location that reveals it */
export const CRITTERS = {
  seals: [[271, 103], [277, 101], [283, 104]] as [number, number][],
  whale: [604, 40] as [number, number],
  leviathan: [[470, 74], [540, 66], [610, 70]] as [number, number][],
  fin: [[700, 72], [730, 66], [760, 74]] as [number, number][],
  tiger: [288, 184] as [number, number],
  croc: [[204, 226], [196, 240], [188, 254]] as [number, number][],
  stork: [214, 214] as [number, number],
  bonefaces: [[448, 206], [456, 209], [452, 214]] as [number, number][],
  hawks: [[566, 186, 16], [612, 170, 12]] as [number, number, number][],
  gulls: [[150, 94], [236, 92], [300, 98]] as [number, number][],
  auks: [518, 240] as [number, number],
  colony: [808, 44] as [number, number],
  waka: [[[96, 318], [124, 324], [146, 318]], [[196, 352], [214, 362], [234, 368]]] as [number, number][][],
  kitten: [190, 98] as [number, number],
};

/** how far either side of the trail Mori sees (map px) as he walks a place */
export const REVEAL_R: Record<string, number> = {
  hills: 44, canopy: 36, ruins: 34, falls: 34, fossils: 34, coast: 36, unknown: 36, geovalley: 34, forest: 34, fernwood: 32, mangrove: 30, village: 32, glowforest: 28, deep: 30, grotto: 24,
};
/** what a place shows once it has been well walked (half explored): the land seen from it */
export const VISTAS: Record<string, [number, number, number, number][]> = {
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
};

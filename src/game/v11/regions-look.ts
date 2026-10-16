// V11 region looks: every place on the Region Map gets its own atmosphere pack, so no two feel alike.
// A pack is plain data: a colour grade laid over the scene's own light (ambient tint, fog colour,
// saturation, contrast, exposure, bloom, vignette, warmth), the air (spores, pollen, sea spray, ash,
// embers, drizzle, drips, dust, mist, marine snow...), ambient sounds layered over the base bed, small
// ambient wildlife (flocks crossing the far sky, gulls, swifts, bats, a soaring hawk, crabs and skinks
// on the ground, fish jumping, insects) and a few signature plants along the walk line. The runtime
// (regions-lookfx.ts) applies it when a field scene opens (v10/field10.ts onFieldEnter); on the home
// island the pack follows Mori along the shore, blending from one stretch into the next.

import type { Sfx } from '../../core/audio';
import type { TimeOfDay } from '../../world/timeofday';
import type { InsectKind } from '../wild/insects';
import type { PlantKind, FungusKind } from '../../art/jungle-plants';

export type RGB = [number, number, number];

export interface Grade {
  /** ambient light multiplier */
  amb?: RGB;
  /** fog / haze colour (its brightness follows the time of day) and how far to pull toward it */
  fog?: RGB;
  fogK?: number;
  sat?: number;
  contrast?: number;
  exposure?: number;
  bloom?: number;
  vignette?: number;
  /** colour balance of the highlights (warm > 1 red, < 1 blue) */
  gain?: RGB;
}

export type AirKind =
  | 'pollen' | 'spores' | 'glowspores' | 'motes' | 'dust' | 'grit' | 'spray' | 'ash' | 'embers' | 'drizzle'
  | 'drips' | 'mist' | 'petals' | 'leaves' | 'seeds' | 'snow' | 'bubbles' | 'midges' | 'smoke';
export interface AirSpec { kind: AirKind; rate: number; times?: TimeOfDay[] }

export interface SoundSpec { sfx: Sfx; every: [number, number]; vol: number; pitch?: [number, number]; times?: TimeOfDay[] }

export type CritterKind = 'flock' | 'parakeets' | 'gulls' | 'seabirds' | 'swifts' | 'swallows' | 'bats' | 'hawk' | 'crabs' | 'skinks' | 'fish' | 'shoal';
export interface CritterSpec { kind: CritterKind; n: number; times?: TimeOfDay[] }

export interface PlantSpec {
  kind: 'plant' | 'fungus';
  id: PlantKind | FungusKind;
  size: [number, number];
  /** per 1000 px of walk line */
  per: number;
  /** in front of the walk line (over the feet) instead of behind it */
  front?: boolean;
  /** glowing kinds light up at dusk and night */
  glow?: boolean;
}

export interface Look {
  grade?: Grade;
  air?: AirSpec[];
  sounds?: SoundSpec[];
  critters?: CritterSpec[];
  insects?: { kind: InsectKind; n: number; times?: TimeOfDay[] }[];
  plants?: PlantSpec[];
  /** a one-line description for the developer panel / docs */
  note: string;
}

const DAY: TimeOfDay[] = ['dawn', 'day', 'dusk'];
const DARK: TimeOfDay[] = ['dusk', 'night'];
const LIGHT: TimeOfDay[] = ['dawn', 'day'];

export const LOOKS: Record<string, Look> = {
  // ---------------------------------------------------------------- the home island (blended along the shore)
  camp: {
    note: 'Golden, homely: warm light, butterflies over the dunes, gulls far out, the odd tūī.',
    grade: { gain: [1.04, 1.01, 0.95], sat: 1.04 },
    air: [{ kind: 'motes', rate: 0.5, times: LIGHT }],
    critters: [{ kind: 'gulls', n: 2, times: DAY }],
    sounds: [{ sfx: 'callTrill', every: [14, 30], vol: 0.06, pitch: [1.3, 1.6], times: LIGHT }],
  },
  'isle-wreck': {
    note: 'Grey and wind-blown: salt spray off the rocks, cooler light, gulls and crabs, the surf booming.',
    grade: { fog: [0.74, 0.82, 0.88], fogK: 0.16, sat: 0.9, gain: [0.97, 1, 1.04], contrast: 1.04 },
    air: [{ kind: 'spray', rate: 1.2 }],
    critters: [{ kind: 'gulls', n: 4, times: DAY }, { kind: 'crabs', n: 5, times: DAY }],
    sounds: [{ sfx: 'waveCrash', every: [7, 15], vol: 0.18, pitch: [0.8, 1] }, { sfx: 'gust', every: [10, 22], vol: 0.12, pitch: [0.8, 1.1] }],
  },
  'isle-grove': {
    note: 'Lush and tropical: saturated greens, pollen in the palm light, butterflies and bees, birdsong.',
    grade: { sat: 1.1, gain: [1.04, 1.02, 0.94], bloom: 0.05 },
    air: [{ kind: 'pollen', rate: 0.8, times: LIGHT }],
    insects: [{ kind: 'butterfly', n: 6, times: DAY }, { kind: 'bee', n: 3, times: ['day'] }],
    critters: [{ kind: 'crabs', n: 2, times: DAY }],
    sounds: [{ sfx: 'birdCall', every: [4, 10], vol: 0.07, pitch: [1, 1.3], times: LIGHT }],
  },
  'isle-stream': {
    note: 'Fresh and green: dragonflies over the ford, the stream chattering, frogs at dusk.',
    grade: { amb: [0.97, 1.02, 1], sat: 1.04, fog: [0.7, 0.84, 0.8], fogK: 0.08 },
    air: [{ kind: 'motes', rate: 0.5, times: LIGHT }],
    insects: [{ kind: 'dragonfly', n: 6, times: DAY }],
    sounds: [{ sfx: 'trickle', every: [5, 10], vol: 0.12, pitch: [0.9, 1.2] }, { sfx: 'callCroak', every: [3, 9], vol: 0.07, pitch: [0.9, 1.3], times: DARK }],
  },
  'isle-seals': {
    note: 'Cold black basalt: spray, a blue-grey haze, gulls wheeling, seal barks over the surf.',
    grade: { fog: [0.66, 0.76, 0.86], fogK: 0.14, sat: 0.92, gain: [0.96, 1, 1.05] },
    air: [{ kind: 'spray', rate: 1.6 }],
    critters: [{ kind: 'gulls', n: 5, times: DAY }, { kind: 'crabs', n: 3, times: DAY }],
    sounds: [{ sfx: 'waveCrash', every: [6, 12], vol: 0.2 }, { sfx: 'callBark', every: [9, 20], vol: 0.08, pitch: [0.6, 0.75], times: DAY }],
  },
  'isle-cave': {
    note: 'Teal and dripping: a dim cool light, drips falling through the dark, dust turning in the shafts.',
    grade: { amb: [0.86, 0.94, 1.02], fog: [0.2, 0.32, 0.34], fogK: 0.12, vignette: 0.1 },
    air: [{ kind: 'drips', rate: 0.8 }, { kind: 'dust', rate: 0.4 }],
    sounds: [{ sfx: 'drip', every: [1, 3.5], vol: 0.1, pitch: [0.8, 1.4] }],
  },
  'isle-track': {
    note: 'The forest edge: green shade, pollen and falling leaves, bellbirds.',
    grade: { amb: [0.94, 1.02, 0.95], fog: [0.56, 0.7, 0.62], fogK: 0.1 },
    air: [{ kind: 'leaves', rate: 0.4 }, { kind: 'pollen', rate: 0.4, times: LIGHT }],
    critters: [{ kind: 'flock', n: 1, times: LIGHT }],
    sounds: [{ sfx: 'callTrill', every: [6, 14], vol: 0.07, pitch: [1.4, 1.8], times: LIGHT }],
  },
  // ---------------------------------------------------------------- the forest
  forest: {
    note: 'Te Wao Nui: the scene keeps its own light; on top, rātā petals and leaves, bellbirds by day, a ruru at night, bats at dusk.',
    air: [{ kind: 'petals', rate: 0.25 }],
    critters: [{ kind: 'flock', n: 1, times: LIGHT }, { kind: 'bats', n: 2, times: DARK }],
    sounds: [{ sfx: 'callTrill', every: [7, 16], vol: 0.06, pitch: [1.5, 1.9], times: LIGHT }, { sfx: 'callHoot', every: [14, 30], vol: 0.06, pitch: [0.9, 1.1], times: ['night'] }],
  },
  fernwood: {
    note: 'Fernwood Floor: deep humid green, pale fern spores hanging in the air, drips, tūī calls, giant ferns.',
    grade: { amb: [0.88, 1.0, 0.9], fog: [0.48, 0.64, 0.56], fogK: 0.2, sat: 1.06, bloom: 0.06 },
    air: [{ kind: 'spores', rate: 0.9 }, { kind: 'leaves', rate: 0.25 }],
    critters: [{ kind: 'bats', n: 2, times: DARK }],
    sounds: [{ sfx: 'drip', every: [2, 6], vol: 0.06, pitch: [0.9, 1.3] }, { sfx: 'callTrill', every: [8, 18], vol: 0.07, pitch: [1.1, 1.4], times: LIGHT }, { sfx: 'callClick', every: [12, 26], vol: 0.05, pitch: [1.2, 1.5], times: LIGHT }],
    plants: [{ kind: 'plant', id: 'fiddlehead', size: [14, 20], per: 5 }, { kind: 'plant', id: 'umbrellafern', size: [26, 34], per: 3 }],
  },
  canopy: {
    note: 'The Emerald Canopy: airy and bright, high haze, gold pollen and red rātā petals, parakeets and swifts.',
    grade: { exposure: 1.05, bloom: 0.1, fog: [0.78, 0.88, 0.86], fogK: 0.12, sat: 1.05 },
    air: [{ kind: 'pollen', rate: 1, times: LIGHT }, { kind: 'petals', rate: 0.5 }],
    critters: [{ kind: 'parakeets', n: 2, times: DAY }, { kind: 'swifts', n: 3, times: DAY }, { kind: 'bats', n: 2, times: DARK }],
    sounds: [{ sfx: 'gust', every: [12, 26], vol: 0.07, pitch: [1, 1.3] }, { sfx: 'callChirp', every: [3, 8], vol: 0.06, pitch: [1.2, 1.6], times: DAY }],
    plants: [{ kind: 'plant', id: 'lanternpod', size: [16, 22], per: 3 }, { kind: 'plant', id: 'astelia', size: [20, 28], per: 3 }],
  },
  falls: {
    note: 'Thunder Falls: cool blue-green, drifting spray and fine drizzle, swifts round the cliff, fish jumping in the pool.',
    grade: { fog: [0.72, 0.85, 0.9], fogK: 0.18, bloom: 0.12, amb: [0.95, 1, 1.04] },
    air: [{ kind: 'mist', rate: 1 }, { kind: 'drizzle', rate: 0.5 }],
    critters: [{ kind: 'swifts', n: 4, times: DAY }, { kind: 'fish', n: 1 }],
    sounds: [{ sfx: 'birdCall', every: [8, 16], vol: 0.06, pitch: [1.1, 1.4], times: LIGHT }],
    plants: [{ kind: 'plant', id: 'kidneyfern', size: [12, 18], per: 6 }, { kind: 'plant', id: 'moss', size: [12, 18], per: 6, front: true }],
  },
  mangrove: {
    note: 'Blackwater: murky olive haze, clouds of midges, fish jumping, frogs and bubbles, a ruru at night.',
    grade: { amb: [0.92, 0.94, 0.8], fog: [0.42, 0.44, 0.32], fogK: 0.25, sat: 0.88, vignette: 0.12 },
    air: [{ kind: 'midges', rate: 1 }],
    insects: [{ kind: 'dragonfly', n: 4, times: DAY }],
    critters: [{ kind: 'fish', n: 2 }, { kind: 'bats', n: 3, times: DARK }],
    sounds: [{ sfx: 'callCroak', every: [3, 8], vol: 0.07, pitch: [0.7, 1] }, { sfx: 'bubble', every: [4, 10], vol: 0.06, pitch: [0.4, 0.6] }, { sfx: 'callHoot', every: [16, 32], vol: 0.06, times: ['night'] }],
    plants: [{ kind: 'plant', id: 'pitcher', size: [16, 22], per: 3 }, { kind: 'plant', id: 'lily', size: [14, 20], per: 3, front: true }],
  },
  coast: {
    note: 'Serpent Coast: bright and salty, spray over the rocks, gulls, crabs on the sand, the swell.',
    grade: { fog: [0.8, 0.88, 0.94], fogK: 0.12, exposure: 1.04, gain: [0.98, 1, 1.03] },
    air: [{ kind: 'spray', rate: 1.2 }],
    critters: [{ kind: 'gulls', n: 5, times: DAY }, { kind: 'crabs', n: 4, times: DAY }],
    sounds: [{ sfx: 'gust', every: [10, 20], vol: 0.1 }],
    plants: [{ kind: 'plant', id: 'flax', size: [24, 32], per: 2 }],
  },
  deep: {
    note: 'The Deep: blue twilight, marine snow sinking, bubbles, shoals turning in the distance.',
    grade: { fog: [0.1, 0.3, 0.42], fogK: 0.18, bloom: 0.08 },
    air: [{ kind: 'snow', rate: 1.2 }, { kind: 'bubbles', rate: 0.5 }],
    critters: [{ kind: 'shoal', n: 3 }],
    sounds: [{ sfx: 'bubble', every: [3, 7], vol: 0.06, pitch: [0.6, 1] }],
  },
  // ---------------------------------------------------------------- the deeper places
  grotto: {
    note: 'Sea Grotto: dark teal, drips into the pools, dust in the light from the chimneys, the sea breathing.',
    grade: { amb: [0.84, 0.94, 1.02], fog: [0.12, 0.22, 0.26], fogK: 0.14, vignette: 0.08 },
    air: [{ kind: 'drips', rate: 1.2 }, { kind: 'dust', rate: 0.5 }],
    sounds: [{ sfx: 'drip', every: [0.8, 2.6], vol: 0.1, pitch: [0.7, 1.4] }, { sfx: 'trickle', every: [8, 16], vol: 0.06, pitch: [0.7, 0.9] }],
  },
  fossils: {
    note: 'Bone Cliffs: dry and dusty, warm stone light, grit on the wind, swifts and skinks, a hawk calling.',
    grade: { sat: 0.88, gain: [1.05, 1.0, 0.9], fog: [0.8, 0.72, 0.6], fogK: 0.15, contrast: 1.04 },
    air: [{ kind: 'grit', rate: 1 }],
    critters: [{ kind: 'swifts', n: 3, times: DAY }, { kind: 'skinks', n: 4, times: ['day'] }, { kind: 'hawk', n: 1, times: LIGHT }],
    sounds: [{ sfx: 'gust', every: [9, 18], vol: 0.1 }, { sfx: 'callScreech', every: [18, 36], vol: 0.05, pitch: [1.2, 1.4], times: LIGHT }],
    plants: [{ kind: 'plant', id: 'astelia', size: [16, 22], per: 2 }],
  },
  glowforest: {
    note: 'The Glowing Forest: violet-cyan dusk all day, glowing spores rising, glowing moths, strange clicks.',
    grade: { amb: [0.8, 0.86, 1.06], fog: [0.12, 0.2, 0.26], fogK: 0.25, bloom: 0.2, sat: 1.08 },
    air: [{ kind: 'glowspores', rate: 1.4 }],
    insects: [{ kind: 'skymoth', n: 5 }, { kind: 'firefly', n: 14 }],
    sounds: [{ sfx: 'callClick', every: [5, 12], vol: 0.06, pitch: [0.7, 1] }, { sfx: 'drip', every: [3, 7], vol: 0.06, pitch: [0.6, 0.9] }],
    plants: [{ kind: 'fungus', id: 'lantern', size: [12, 18], per: 4, glow: true }, { kind: 'fungus', id: 'bluecap', size: [10, 14], per: 4, front: true, glow: true }],
  },
  geovalley: {
    note: 'The Hot Valley: sulphur-yellow haze, ash flakes and the odd ember, hissing vents and bubbling mud, heat-loving skinks.',
    grade: { gain: [1.06, 1.02, 0.86], fog: [0.86, 0.8, 0.56], fogK: 0.2, sat: 1.04 },
    air: [{ kind: 'ash', rate: 0.8 }, { kind: 'embers', rate: 0.3 }],
    critters: [{ kind: 'skinks', n: 4, times: DAY }],
    insects: [{ kind: 'dragonfly', n: 3, times: ['day'] }],
    sounds: [{ sfx: 'hiss', every: [3, 8], vol: 0.06, pitch: [0.6, 0.9] }, { sfx: 'bubble', every: [2, 6], vol: 0.07, pitch: [0.35, 0.55] }],
    plants: [{ kind: 'fungus', id: 'coral', size: [10, 14], per: 3, front: true }],
  },
  ruins: {
    note: 'The Old Pā: mossy, hushed, a green haze; dust motes in the light, falling leaves, a ruru at dusk.',
    grade: { sat: 0.92, fog: [0.62, 0.7, 0.62], fogK: 0.18, amb: [0.96, 1, 0.96] },
    air: [{ kind: 'motes', rate: 0.8 }, { kind: 'leaves', rate: 0.3 }],
    insects: [{ kind: 'skymoth', n: 3, times: DARK }],
    critters: [{ kind: 'flock', n: 1, times: LIGHT }],
    sounds: [{ sfx: 'woodCreak', every: [14, 30], vol: 0.05, pitch: [0.7, 1] }, { sfx: 'callHoot', every: [12, 26], vol: 0.06, times: DARK }],
    plants: [{ kind: 'plant', id: 'flowers', size: [12, 16], per: 3 }, { kind: 'plant', id: 'kawakawa', size: [20, 26], per: 2 }],
  },
  unknown: {
    note: 'Te Korokoro: drained, eerie grey-green mist, drizzle out of nowhere, a moan from the deep.',
    grade: { sat: 0.75, fog: [0.55, 0.62, 0.6], fogK: 0.3, vignette: 0.18, contrast: 1.05 },
    air: [{ kind: 'mist', rate: 1.4 }, { kind: 'drizzle', rate: 0.6 }],
    critters: [{ kind: 'bats', n: 3, times: DARK }],
    sounds: [{ sfx: 'callWhale', every: [24, 48], vol: 0.05, pitch: [0.4, 0.55] }, { sfx: 'drip', every: [3, 7], vol: 0.06, pitch: [0.5, 0.8] }],
  },
  village: {
    note: 'Te Kāinga: warm hearth light, woodsmoke drifting, swallows over the gardens.',
    grade: { gain: [1.05, 1.01, 0.93], fog: [0.76, 0.72, 0.66], fogK: 0.08 },
    air: [{ kind: 'smoke', rate: 0.6 }, { kind: 'motes', rate: 0.3, times: LIGHT }],
    critters: [{ kind: 'swallows', n: 3, times: DAY }],
  },
  hills: {
    note: 'The Rocky Hills: big sky and wind (gusts, streaks, seed fluff, mist over the ridge are in the scene); on top, a hawk circling and its cry.',
    critters: [{ kind: 'hawk', n: 1, times: LIGHT }, { kind: 'skinks', n: 3, times: ['day'] }],
    sounds: [{ sfx: 'callScreech', every: [20, 40], vol: 0.05, pitch: [0.9, 1.05], times: LIGHT }],
  },
  // ---------------------------------------------------------------- by boat
  motuahi: {
    note: 'Motu Ahi: volcanic grey haze, ash and embers in the air, seabirds wheeling, the cone rumbling.',
    grade: { fog: [0.6, 0.55, 0.52], fogK: 0.18, sat: 0.9, gain: [1.03, 0.99, 0.96] },
    air: [{ kind: 'ash', rate: 1 }, { kind: 'embers', rate: 0.25 }],
    critters: [{ kind: 'seabirds', n: 4, times: DAY }],
    sounds: [{ sfx: 'thunder', every: [30, 60], vol: 0.06, pitch: [0.4, 0.55] }],
  },
  farcoast: {
    note: 'The Far Coast: wild and wet, spray and drizzle, a blue-grey haze, gulls on the wind.',
    grade: { fog: [0.7, 0.78, 0.82], fogK: 0.2, sat: 0.92, gain: [0.97, 1, 1.03] },
    air: [{ kind: 'spray', rate: 1.2 }, { kind: 'drizzle', rate: 0.6 }],
    critters: [{ kind: 'gulls', n: 4, times: DAY }],
    sounds: [{ sfx: 'gust', every: [8, 16], vol: 0.1 }],
  },
  glassreef: {
    note: 'Glass Reef: clear turquoise, sparkling motes and bubbles.',
    grade: { bloom: 0.06, sat: 1.06 },
    air: [{ kind: 'bubbles', rate: 0.6 }, { kind: 'snow', rate: 0.4 }],
  },
};

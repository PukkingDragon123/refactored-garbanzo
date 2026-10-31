// V12 Te Repo Raupō, the raupō swamp: where Te Wao Nui's wallows drain away south-east, through a
// kahikatea swamp forest and the bulrush beds, past a dark hollow pool and a stand of drowned trees,
// to the channel round a hidden island and out at the mangroves. One continuous map (9,800 px).
// Plain data and the walk line (no game imports) so anything can ask where a place is.
//
//   ╬ a signposted crossroads, ↑↓ its tier, ⇠⇢ the trails out (Te Wao Nui's wallows, the mangroves)
//
//   HIGH                            the maimai catwalk
//                                   3270-3560
//                                     ↑
//   MAIN  ⇠ edge ╬═ boardwalk ════ raupō ═ logs ═╬ bank ══╬═ fallen kahikatea ═╬ stones ═ drowned ═╬═ swing bridge ═ mudflats ═ edge ⇢
//                ↓                                        ↓                                    ↓
//   LOW      the black water                        the dark pool                         the channel and
//            under the boardwalk                    (the giant toad's island)             the hidden island hut
//            790-2240                               4410-4870                             7150-7870
//   x     0      700          2300           3900       4300         4980   5300        6800  7040    7960 8300        9800
//         └ Te Kūwaha ┘└ Ngā Kahikatea ┘└ Te Raupō ┘└── Te Roto Pōuri ──┘└ Ngā Rākau Mate ┘└ Te Motu Huna ┘└ Te Ngutu Awa ┘

import { clamp, noise1, smoothstep } from '../../../core/math';

export const SW = { W: 9800, minY: -140, maxY: 430 };
export const SW_ZONES: [number, number, string, string][] = [
  [0, 700, 'Te Kūwaha', 'The swamp edge'],
  [700, 2300, 'Ngā Kahikatea', 'The white pine swamp'],
  [2300, 3900, 'Te Raupō', 'The bulrush beds'],
  [3900, 5300, 'Te Roto Pōuri', 'The dark pool'],
  [5300, 6800, 'Ngā Rākau Mate', 'The drowned trees'],
  [6800, 8300, 'Te Motu Huna', 'The hidden island'],
  [8300, 9801, 'Te Ngutu Awa', 'Where the swamp drains to the mangroves'],
];
export function swZone(x: number): [string, string] {
  for (const [a, b, n, s] of SW_ZONES) if (x >= a && x < b) return [n, s];
  return ['Te Repo Raupō', 'The raupō swamp'];
}

/** the dark hollow pool: the walk line drops into it; the giant toad's mud island in the middle; the
 *  main path crosses on a fallen kahikatea from rim to rim */
export const POOL = { x0: 4300, x1: 4980, dip: 70, ramp: 112, isle0: 4540, isle1: 4660, stage: 4598, log: [4236, 5044] as [number, number] };
/** the channel round the hidden island: a swing bridge from bank to bank; the island and its hut are
 *  down in the channel, near the east bank, screened by raupō */
export const CHANNEL = { x0: 7040, x1: 7980, dip: 50, ramp: 112, isle0: 7630, isle1: 7850, hut: 7740 };
/** boardwalks of old planks on stilts (main path): x0, x1, deck height over the water */
export const WALKS: [number, number, number][] = [[742, 2290, 9], [2300, 2700, 8], [8476, 9124, 6]];
/** stepping logs across the deep water in the bulrush beds: x, length */
export const LOGS: [number, number][] = [[2716, 66], [2806, 58], [2890, 74], [2990, 62], [3074, 52]];
/** stepping stones across the deep holes in the drowned trees: x, width */
export const STONES: [number, number][] = [[5476, 22], [5520, 18], [5562, 24], [5608, 20], [5652, 22], [5700, 18], [6078, 20], [6122, 24], [6166, 18], [6210, 22], [6256, 20], [6300, 18]];
/** the maimai (an old hunters' hide) on poles, and its catwalk over the raupō: the high way */
export const MAIMAI = { x0: 3270, x1: 3560, up: 3290, down: 3540, rise: 82 };
/** where things are */
export const SW_SPOT = {
  enter: 90, exit: 30,
  /** the crossroads */
  postBoard: 700, postMaimai: 3200, postPool: 4180, postChannel: 6960,
  /** the trail ends: up into Te Wao Nui's wallows (W edge), down to the mangroves (E edge) */
  hut: CHANNEL.hut, stage: POOL.stage,
  /** where the poison toads live: the moss hummocks among the drowned trees (and round the pool rim) */
  embers: [[5380, 5470], [5780, 5900], [6400, 6540], [5020, 5180]] as [number, number][],
  /** the hide in the raupō on the pool's west margin, where you watch the giant toad from */
  poolHide: 4396,
};

/** the walk line without the dips: the banks and the water surface of the open swamp */
export function swBase0(x: number): number {
  return 216 + Math.sin(x * 0.0037 + 0.6) * 3 + Math.sin(x * 0.011 + 2) * 1.4 + (noise1(x / 110, 29) - 0.5) * 3 - 3 * smoothstep(9300, 9700, x) + 2 * (1 - smoothstep(0, 400, x));
}
const basin = (x: number, a: number, b: number, d: number, r: number) => d * smoothstep(a, a + r, x) * (1 - smoothstep(b - r, b, x));
/** the walk line: the water surface or the bank (down into the hollow and the channel) */
export function swBase(x: number): number {
  return swBase0(x) + basin(x, POOL.x0, POOL.x1, POOL.dip, POOL.ramp) + basin(x, CHANNEL.x0, CHANNEL.x1, CHANNEL.dip, CHANNEL.ramp);
}

// ---------------------------------------------------------------- the water
/** [x0, x1, depth] stretches of water at the walk line (wading depth, px); negative: an island */
const WET: [number, number, number][] = [
  [790, 2252, 9], [2330, 2700, 5], [2700, 3130, 11], [3480, 3930, 4], [POOL.x0 + POOL.ramp - 12, POOL.x1 - POOL.ramp + 12, 4], [4432, 4850, 12],
  [5300, 6800, 4], [5470, 5720, 11], [6070, 6320, 11], [CHANNEL.x0 + CHANNEL.ramp - 2, CHANNEL.x1 - CHANNEL.ramp + 2, 11], [8300, 9460, 3],
];
/** dry ground in the water: the toad's mud island, moss hummocks, the hidden island */
const DRY: [number, number, number][] = [
  [POOL.isle0, POOL.isle1, -8], [8446, 8496, -1], [9104, 9154, -1], [5370, 5470, -2], [5770, 5910, -2], [6390, 6550, -2], [6620, 6700, 0], [CHANNEL.isle0, CHANNEL.isle1, -4],
];
const edge = (x: number, a: number, b: number, r = 22) => smoothstep(a - r, a + 2, x) * (1 - smoothstep(b - 2, b + r, x));
/** wading depth at the walk line (0 on the banks, < 0 on an island) */
export function swDepth(x: number): number {
  let d = 0;
  for (const [a, b, k] of WET) if (x > a - 24 && x < b + 24) {
    // (the swamp forest's water is uneven: knee-deep holes between the buttresses)
    const v = a === 790 ? 5 + (noise1(x / 60, 31) * 7) : k;
    d = Math.max(d, v * edge(x, a, b));
  }
  for (const [a, b, k] of DRY) if (x > a - 24 && x < b + 24) { const e = edge(x, a, b, 18); d = d * (1 - e) + k * e; }
  return d;
}
/** the terrain: the bed under the water, the banks, the islands */
export const swGround = (x: number) => swBase(x) + swDepth(x);
/** 0..1 how much of the floor in front of the walk line is open water */
export function swWet(x: number): number {
  const d = swDepth(x);
  const zone = x > 760 && x < 2300 ? 0.75 : x > 2300 && x < 3900 ? 0.62 : x > POOL.x0 + 60 && x < POOL.x1 - 60 ? 1 : x > 5300 && x < 6800 ? 0.72 : x > CHANNEL.x0 + 60 && x < CHANNEL.x1 - 60 ? 1 : x > 8300 && x < 9460 ? 0.55 : 0.18;
  return clamp(Math.max(zone, d > 1 ? 0.85 : 0), 0, 1);
}
/** canopy cover overhead (the kahikatea stands close it, the raupō beds are open sky) */
export function swCanopy(x: number): number {
  const k = (a: number, b: number, v: number) => v * smoothstep(a - 120, a + 120, x) * (1 - smoothstep(b - 120, b + 120, x));
  return clamp(0.12 + k(0, 760, 0.5) + k(760, 2300, 0.66) + k(3900, 5300, 0.34) + k(5300, 6800, 0.12) + k(6800, 8300, 0.3), 0, 0.85);
}
/** the boardwalk deck's top at x (null off the boardwalks) */
export function deckY(x: number): number | null {
  for (const [a, b, h] of WALKS) if (x >= a && x <= b) {
    // (it comes down to the bank at a dry end; over the water an end just stops, broken off)
    const ramp = Math.min(1, swDepth(a) < 1 ? (x - a) / 26 : 1, swDepth(b) < 1 ? (b - x) / 26 : 1);
    const sag = Math.sin((x - a) * 0.21) * 0.35 + (noise1(x / 40, 37) - 0.5) * 1.2;
    return swBase(x) - h * clamp(ramp, 0, 1) + sag * clamp(ramp, 0, 1);
  }
  return null;
}
/** world y of the maimai catwalk */
export const maimaiY = (x: number) => swBase0(MAIMAI.x0) - MAIMAI.rise + (x - MAIMAI.x0) * 0.012;

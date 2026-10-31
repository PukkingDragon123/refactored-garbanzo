// V12 Te Rua Pōuri, the deep dark cave: behind the glowworms of the sea cave a dry passage climbs into
// the headland and then drops, tier under tier, into the dark, down to a black lake under a sky of
// glowworms where the Ghost Gulper lives. One map, mostly vertical (about six screens deep, five wide).
// Plain data and the walk lines (no game imports) so anything can ask where a place is.
//
//   ╬ a signposted crossroads   ‖ a ladder   ┆ a rope (climbing rope)   ⟋ the scree chute   ≈ water
//
//  y  160  ⇠ glowworm cave ═ T0 Te Kūaha (the mouth: moths, twilight) ═════════╬═══‖ 1690
//                                                                                   ‖
//     480              ⟋═╬═ T1 Ngā Wētā (the wētā hall: wētā walls, the big wētā) ═══‖╬══════ 1960
//                     ⟋  440
//     740  100 ╬═ T2 ═ squeeze ═ Te Harore (the fungus hall) ═╬═[planks]══════════╬═┆ 2194
//                     560-800                                  ‖ 1500             ┆
//     930                                     G Te Ana Tioata ═╧═ crystals, ★ rare ┆
//                                             1330-1780                            ┆
//    1200                         ┆ 766 ╬═ T3 Te Awa Pōuri (the dark stream, ≈ pools: blind salamanders) ╬ 2280
//                    falls ≈      ┆ W1 ┄┄┄┄
//    1380                   ≈     ┆ 600-780                      (rock)
//    1556                ≈ ┆ W2 ┄┄┄┄                               the glowworm sky
//    1740  camp ═ ≈plunge ═┆═ T4 shore ═╬═ pole ┃≈≈≈≈≈≈≈≈ Te Waha o te Pō, the lake ≈≈≈≈≈≈≈≈≈≈≈≈
//          100-300  400-480  486            772  790                                       2360
//
// Every way down is also the way back up: Mori has to climb out again before dark. The climbing rope
// opens the rope pitch (T2 to T3) and the wet pitch beside the falls (T3 to the shore).

import { noise1 } from '../../../core/math';

export const DC = { W: 2400, minY: -70, maxY: 1950, zoom: 1.4 };

type K = [number, number][];
/** a smooth walk line through hand-placed knots (cosine between them, a little grit on top) */
function line(k: K, seed: number, grit = 1.4) {
  return (x: number): number => {
    let i = 1;
    while (i < k.length - 1 && x > k[i][0]) i++;
    const [x0, y0] = k[i - 1], [x1, y1] = k[i];
    const t = Math.max(0, Math.min(1, (x - x0) / Math.max(1, x1 - x0)));
    const s = (1 - Math.cos(t * Math.PI)) / 2;
    return Math.round(y0 + (y1 - y0) * s + (noise1(x / 9, seed) - 0.5) * grit);
  };
}

export interface Tier {
  id: string;
  /** the walkable stretch (Mori can't step off it except where a way goes on) */
  x0: number; x1: number;
  floor: (x: number) => number;
  /** the height of the passage over the floor at x */
  height: (x: number) => number;
  name: string; sub: string;
}

const T = (id: string, x0: number, x1: number, fk: K, hk: K, seed: number, name: string, sub: string): Tier => ({ id, x0, x1, floor: line(fk, seed), height: line(hk, seed + 7, 6), name, sub });

/** the tiers, top to bottom */
export const TIERS: Tier[] = [
  T('t0', 0, 1700,
    [[0, 160], [110, 164], [240, 172], [380, 168], [520, 178], [660, 186], [800, 182], [940, 192], [1080, 188], [1220, 196], [1360, 192], [1500, 198], [1620, 200], [1700, 202]],
    [[0, 150], [180, 132], [320, 98], [500, 112], [700, 86], [900, 120], [1050, 74], [1200, 92], [1400, 128], [1560, 120], [1700, 112]],
    11, 'Te Kūaha', 'The mouth of the dark'),
  T('t1', 440, 1960,
    [[440, 470], [560, 476], [700, 484], [840, 478], [1000, 490], [1160, 486], [1320, 494], [1480, 488], [1600, 482], [1700, 478], [1820, 484], [1960, 476]],
    [[440, 104], [600, 140], [800, 186], [1000, 236], [1200, 256], [1400, 214], [1600, 150], [1760, 160], [1960, 116]],
    12, 'Ngā Wētā', 'The wētā hall'),
  T('t2', 96, 2200,
    [[96, 724], [200, 728], [320, 734], [460, 730], [560, 738], [700, 742], [820, 736], [960, 748], [1100, 744], [1240, 752], [1380, 748], [1478, 754], [1522, 754], [1640, 748], [1780, 756], [1920, 750], [2060, 758], [2200, 760]],
    [[96, 200], [300, 124], [500, 80], [556, 46], [800, 46], [850, 86], [960, 168], [1200, 204], [1350, 168], [1480, 124], [1700, 140], [1900, 112], [2200, 128]],
    13, 'Te Kūititanga', 'The squeeze, and the fungus hall'),
  T('g', 1330, 1780,
    [[1330, 926], [1420, 932], [1500, 930], [1600, 936], [1700, 930], [1780, 924]],
    [[1330, 70], [1450, 96], [1560, 124], [1680, 110], [1780, 74]],
    14, 'Te Ana Tioata', 'The crystal gallery'),
  T('t3', 760, 2280,
    [[760, 1198], [880, 1202], [1000, 1206], [1140, 1200], [1260, 1208], [1400, 1204], [1540, 1212], [1680, 1206], [1820, 1212], [1960, 1204], [2100, 1210], [2194, 1200], [2280, 1196]],
    [[760, 150], [900, 118], [1050, 150], [1200, 112], [1400, 170], [1600, 150], [1800, 118], [2000, 140], [2280, 160]],
    15, 'Te Awa Pōuri', 'The dark stream'),
  T('w1', 600, 780, [[600, 1380], [690, 1383], [780, 1378]], [[600, 160], [780, 160]], 16, 'Te Tāheke', 'The wet pitch'),
  T('w2', 480, 640, [[480, 1556], [560, 1559], [640, 1554]], [[480, 160], [640, 160]], 17, 'Te Tāheke', 'The wet pitch'),
  T('t4', 100, 790,
    [[100, 1730], [180, 1734], [260, 1736], [340, 1738], [400, 1740], [440, 1742], [480, 1738], [560, 1736], [640, 1740], [720, 1744], [790, 1750]],
    [[100, 140], [300, 260], [500, 330], [790, 360]],
    18, 'Te Waha o te Pō', 'The lake at the bottom of the dark'),
];
export const TIER: Record<string, Tier> = Object.fromEntries(TIERS.map(t => [t.id, t]));

/** pools in a tier's walk line (the floor dips; water to the rim): x0, x1, depth */
export const POOLS: { tier: string; x0: number; x1: number; d: number }[] = [
  { tier: 't3', x0: 920, x1: 1030, d: 10 },
  { tier: 't3', x0: 1180, x1: 1330, d: 14 },
  { tier: 't3', x0: 1440, x1: 1560, d: 12 },
  { tier: 't4', x0: 396, x1: 486, d: 11 },
  { tier: 'g', x0: 1640, x1: 1720, d: 8 },
];
/** a pool's water level: the lower of its two lips (so the water never stands above the rock) */
export const poolTop = (p: { tier: string; x0: number; x1: number }) => Math.max(TIER[p.tier].floor(p.x0), TIER[p.tier].floor(p.x1));
/** the walk line of a tier at x, pools included (the bed scooped under a flat water level) */
export const floorOf = (tier: string, x: number) => {
  const y = TIER[tier].floor(x);
  for (const p of POOLS) {
    if (p.tier !== tier || x <= p.x0 || x >= p.x1) continue;
    const t = (x - p.x0) / (p.x1 - p.x0);
    const dip = p.d * Math.min(1, Math.sin(t * Math.PI) * 1.5) * (0.85 + 0.15 * Math.sin(t * 9 + p.x0));
    return Math.max(y, Math.round(poolTop(p) + dip));
  }
  return y;
};
/** the water surface of the pool at x on a tier (null: no pool) */
export function poolAt(tier: string, x: number): { x0: number; x1: number; top: number; d: number } | null {
  for (const p of POOLS) if (p.tier === tier && x > p.x0 && x < p.x1) return { x0: p.x0, x1: p.x1, top: poolTop(p), d: p.d };
  return null;
}

/** the ways between the tiers */
export const LADDERS = {
  /** the old caver's iron ladder from the mouth down into the wētā hall */
  t0: { x: 1690, top: 't0', bot: 't1' },
  /** down through the caver's planks into the crystal gallery */
  g: { x: 1500, top: 't2', bot: 'g' },
};
export const ROPES = {
  /** the rope pitch: T2's end down to the dark stream */
  pitch: { x: 2194, top: 't2', bot: 't3' },
  /** the wet pitch beside the falls, three drops ledge to ledge */
  wetA: { x: 766, top: 't3', bot: 'w1' },
  wetB: { x: 606, top: 'w1', bot: 'w2' },
  wetC: { x: 486, top: 'w2', bot: 't4' },
};
export const climbOf = (c: { x: number; top: string; bot: string }) => ({ x: c.x, y0: floorOf(c.top, c.x), y1: floorOf(c.bot, c.x) });
/** the plank bridge over the hole down to the crystal gallery */
export const PLANKS = { x0: 1478, x1: 1522 };

/** the scree chute from the wētā hall's west end down to T2 (its foot hangs just over T2's floor) */
export const CHUTE: K = [[130, 710], [168, 694], [206, 676], [238, 654], [276, 630], [314, 604], [346, 574], [376, 542], [408, 506], [440, 470]];
export const chuteY = line(CHUTE, 19, 2);

/** the lake: its surface, the bed under it (deep in the middle) */
export const LAKE = { x0: 790, x1: 2360, top: 1756, bed: (x: number) => Math.round(1756 + Math.max(4, Math.min(150, (x - 790) * 0.9, (2360 - x) * 0.6)) + (noise1(x / 30, 5) - 0.5) * 8) };
/** the underground waterfall: out of a crack in the shaft wall, down into the plunge pool */
export const FALLS = { x: 418, top: 1222, bottom: 1738, w: 20 };

/** places along the way */
export const SPOT = {
  enter: 30, exit: 14,
  aroha: 66,
  postT0: 1560, postT1a: 600, postT1b: 1600, postT2a: 220, postT2b: 1420, postT2c: 2080, postT3a: 2080, postT3b: 880, postT4: 640,
  squeeze: [560, 800] as [number, number],
  fungus: [950, 1360] as [number, number],
  camp: 196, journal: 236, pole: 772, hide: 680, shoreEdge: 790,
  bigWeta: 1240, rare: 1590, crystals: 1660,
};

/** the open space of the cave (where there is no rock): the passages, the shafts, the lake chamber */
export interface Hole { x0: number; x1: number; top: (x: number) => number; bot: (x: number) => number }
const tierHole = (t: Tier, pad0 = 0, pad1 = 0): Hole => ({ x0: t.x0 - pad0, x1: t.x1 + pad1, top: x => t.floor(Math.max(t.x0, Math.min(t.x1, x))) - t.height(Math.max(t.x0, Math.min(t.x1, x))), bot: x => floorOf(t.id, Math.max(t.x0, Math.min(t.x1, x))) });
const box = (x0: number, x1: number, y0: number, y1: number, seed: number, wob = 10): Hole => ({ x0, x1, top: x => y0 + (noise1(x / 23, seed) - 0.5) * wob, bot: x => y1 + (noise1(x / 19, seed + 3) - 0.5) * wob });
const T0 = TIER.t0, T1 = TIER.t1, T2 = TIER.t2, TG = TIER.g, T3 = TIER.t3, T4 = TIER.t4;
export const HOLES: Hole[] = [
  // the mouth: open to the glowworm cave at the west edge
  { ...tierHole(T0, 60, 10) },
  tierHole(T1, 0, 30),
  tierHole(T2, 40, 40),
  tierHole(TG, 10, 10),
  tierHole(T3, 0, 30),
  // the ladder shaft (T0 to T1), the gallery hole, the rope pitch shaft
  { ...box(1681, 1752, 206, 486, 31, 6), top: x => (x < 1702 ? 206 : 196) + (noise1(x / 7, 31) - 0.5) * 3 },
  box(1486, 1516, 757, 934, 32, 2),
  { ...box(2186, 2290, 766, 1206, 33, 8), top: x => (x < 2204 ? 766 : 750) + (noise1(x / 7, 33) - 0.5) * 3 },
  // the scree chute: a band over the slope
  { x0: 110, x1: 470, top: x => chuteY(Math.max(130, Math.min(440, x))) - 92, bot: x => (x < 130 ? T2.floor(x) : chuteY(Math.min(440, x))) },
  // the wet pitch shaft, beside the falls, and the lake chamber under its glowworm sky
  { ...box(372, 792, 1206, 1745, 34, 16), top: x => (x > 760 ? 1212 : 1196 + (noise1(x / 21, 34) - 0.5) * 14) },
  { x0: 80, x1: 2390, top: x => 1500 - Math.sin(Math.min(1, Math.max(0, (x - 80) / 2310)) * Math.PI) * 130 + (noise1(x / 40, 35) - 0.5) * 34 + (x < 300 ? (300 - x) * 0.8 : 0), bot: x => (x < 790 ? floorOf('t4', Math.max(100, x)) : LAKE.bed(Math.min(2360, x))) },
];

/** where the tiers and their places are named (floating over the HUD) */
export function zoneAt(x: number, y: number): [string, string] {
  let best: Tier | null = null, bd = 1e9;
  for (const t of TIERS) {
    if (x < t.x0 - 60 || x > t.x1 + 60) continue;
    const d = Math.abs(y - t.floor(Math.max(t.x0, Math.min(t.x1, x))));
    if (d < bd) { bd = d; best = t; }
  }
  if (!best || bd > 260) return ['Te Rua Pōuri', 'The deep dark cave'];
  if (best.id === 't2' && x >= SPOT.squeeze[0] && x <= SPOT.squeeze[1]) return ['Te Kūititanga', 'The squeeze'];
  if (best.id === 't2' && x > SPOT.fungus[0]) return ['Te Harore', 'The fungus hall'];
  return [best.name, best.sub];
}

/** 0 at the mouth .. 1 at the lake: how deep (cold, far from the sun) Mori is */
export const depthK = (y: number) => Math.max(0, Math.min(1, (y - 180) / 1560));

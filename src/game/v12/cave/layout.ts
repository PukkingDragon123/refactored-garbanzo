// V12 Te Rua Pōuri, the deep dark cave: behind the glowworms of the sea cave a dry passage climbs into
// the headland and then drops, tier under tier, into the dark: down to a black lake under a sky of
// glowworms where the Ghost Gulper lives, and on below the lake, through gear-gated pitches and
// squeezes, to the deepest chamber, Te Puna Tioata. One map, mostly vertical (about four screens
// deep, five wide). Plain data and the walk lines (no game imports) so anything can ask where a place
// is, and so the terrain can be checked headlessly (see limitsAt and STEPS).
//
//   ╬ crossroads   ‖ ladder   ┆ rope (climbing rope)   ⌇ hand-over-hand scramble   ⟋ slope   ≈ water
//   ▓ the choke (heave the boulder)   ⌒ crawl / squeeze (crouch)   ∵ loose roof   ⊔ the crack (jump it)
//
//  y  160 ⇠ T0 Te Kūaha ⟋ ▓430 ⌒crawl⌒ ╗hop  bat roost  ⊔1176  ╗hop ╗hop ══‖1703
//                                                                          ‖
//     470   ⟋═ T1 Ngā Wētā ⌇690 chimney ═ ╔hop ═ the breakdown pile ═╗⌇1340 ∵pit∵ ⌇ ╔hop ═‖╬══ 1960
//          ⟋ 440                                                      (the big wētā)
//     720 ╬═ T2 ⌒squeeze⌒ drip pools  Te Harore (fungus terraces)  [planks]‖  ⟋heap ⌇1900 ═┆2193
//                                                                    ‖ 1500                 ┆
//     930                                        G Te Ana Tioata ═══╧═ crystals, ★ rare      ┆
//    1060                       ┆766 ═ T3 Te Awa Pōuri ≈pools≈ rimstone steps ═════════════════╛
//    1190          falls ≈  W1 ┆┄┄┄┄
//    1262               ≈ ┆┄┄┄┄ W2
//    1330  ⌇131 camp ═ ≈plunge ┆═ T4 shore ═ pole ┃≈≈≈≈≈≈ Te Waha o te Pō, the lake ≈≈≈≈≈≈≈≈≈≈≈≈≈≈
//          ⌇ (grip soles: the wet flowstone wall)
//    1532  ⌇═ T5 drips ∵loose∵ ╗hop ⌒crystal squeeze⌒ (gloves) ═ moonmilk ═╗ Te Paru, the mud slope
//                                                                       ⟍ (trail boots)
//    1776                                                                ⟍≈≈≈ Te Ruku, the sump ≈≈≈
//                                                                 (wetsuit or snorkel) ≈≈≈╗
//    1880                                            Te Puna Tioata, the deepest chamber ═══╝═╗hop═≈nursery≈═
//
// Every way down is also the way back up: Mori has to climb out again before dark. Steps up to 7 px
// are walked, up to 16 px jumped (his jump clears about 23), anything higher has a hand-over-hand
// scramble beside it; drops deeper than 34 px stop him at the edge (climb down, or jump a gap).

import { noise1 } from '../../../core/math';

export const DC = { W: 2400, minY: -70, maxY: 1990, zoom: 1.4 };

/** walking up a step this high happens on its own; up to HOP it takes a jump; deeper drops than EDGE stop Mori at the edge */
export const STEP_WALK = 7, STEP_HOP = 16, STEP_EDGE = 34;
/** how far a high surface reaches out over a climbable edge (so the top of the climb has ground under it) */
export const LIP = 5;

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

/** one continuous stretch of a tier's floor (its own walk surface); between pieces the floor steps */
export interface Piece { x0: number; x1: number; f: (x: number) => number; bridge?: boolean }

export interface Tier {
  id: string;
  /** the walkable stretch */
  x0: number; x1: number;
  pieces: Piece[];
  /** the floor at x (steps between the pieces), without the pools */
  floor: (x: number) => number;
  /** the roof over the floor at x (absolute) */
  roof: (x: number) => number;
  /** the height of the passage over the floor at x */
  height: (x: number) => number;
  name: string; sub: string;
}

function T(id: string, name: string, sub: string, seed: number, pk: (K | { k: K; bridge: true })[], rk: K): Tier {
  const pieces: Piece[] = pk.map((p, i) => {
    const k = Array.isArray(p) ? p : p.k;
    return { x0: k[0][0], x1: k[k.length - 1][0], f: line(k, seed + i * 31), bridge: !Array.isArray(p) || undefined };
  });
  const x0 = pieces[0].x0, x1 = pieces[pieces.length - 1].x1;
  const fl = new Int16Array(x1 - x0 + 1);
  for (let x = x0; x <= x1; x++) {
    let p = pieces[pieces.length - 1];
    for (const q of pieces) if (x < q.x1) { p = q; break; }
    fl[x - x0] = p.f(x);
  }
  const floor = (x: number) => fl[Math.max(0, Math.min(fl.length - 1, Math.round(x) - x0))];
  const roofL = line(rk, seed + 7, 5);
  return { id, x0, x1, pieces, floor, roof: roofL, height: (x: number) => floor(x) - roofL(x), name, sub };
}

/** the tiers, top to bottom */
export const TIERS: Tier[] = [
  T('t0', 'Te Kūaha', 'The mouth of the dark', 11, [
    [[0, 160], [60, 162], [140, 154], [220, 142], [300, 136]],
    [[300, 136], [370, 134], [440, 138], [470, 141]],
    [[470, 150], [520, 154], [580, 153]],
    [[580, 153], [650, 157], [720, 151], [760, 150]],
    [[760, 150], [800, 154], [826, 156]],
    [[826, 170], [880, 180], [940, 188], [1000, 190], [1060, 186], [1110, 180], [1176, 178]],
    [[1176, 214], [1187, 216], [1198, 213]],
    [[1198, 182], [1260, 188], [1340, 198], [1420, 204]],
    [[1420, 216], [1500, 222], [1580, 226]],
    [[1580, 237], [1640, 241], [1700, 244]],
  ], [[0, 0], [120, 16], [240, 40], [330, 66], [400, 78], [430, 76], [470, 80], [520, 92], [575, 108], [590, 114], [716, 114], [745, 92], [800, 74], [880, 60], [1000, 56], [1120, 84], [1200, 104], [1300, 110], [1400, 120], [1500, 150], [1600, 156], [1700, 160]]),
  T('t1', 'Ngā Wētā', 'The wētā hall', 12, [
    [[440, 470], [520, 474], [600, 478], [690, 472]],
    [[690, 532], [760, 534], [860, 530], [940, 526], [990, 524]],
    [[990, 512], [1060, 508], [1140, 502], [1240, 498], [1340, 500]],
    [[1340, 546], [1400, 550], [1460, 552], [1540, 548]],
    [[1540, 524], [1580, 522], [1620, 518]],
    [[1620, 504], [1690, 502], [1760, 498], [1860, 492], [1960, 488]],
  ], [[440, 380], [560, 392], [650, 404], [686, 404], [712, 406], [724, 462], [800, 464], [900, 458], [960, 440], [1000, 420], [1100, 320], [1200, 270], [1300, 250], [1400, 280], [1500, 330], [1560, 380], [1620, 420], [1700, 430], [1800, 420], [1960, 410]]),
  T('t2', 'Te Kūititanga', 'The squeeze, and the fungus hall', 13, [
    [[96, 716], [130, 712], [200, 716], [320, 722], [460, 720], [560, 726]],
    [[560, 726], [680, 730], [800, 728]],
    [[800, 728], [860, 734], [920, 736], [980, 738]],
    [[980, 738], [1060, 744], [1140, 740], [1220, 748], [1300, 744], [1380, 750], [1478, 754]],
    { k: [[1478, 754], [1522, 754]], bridge: true },
    [[1522, 754], [1600, 752], [1700, 742], [1780, 728], [1860, 720], [1900, 718]],
    [[1900, 736], [1980, 742], [2080, 748], [2190, 752]],
  ], [[96, 600], [180, 560], [280, 490], [380, 420], [432, 396], [446, 500], [480, 640], [540, 680], [556, 684], [800, 684], [850, 660], [960, 610], [1100, 586], [1200, 574], [1350, 596], [1478, 624], [1600, 630], [1700, 640], [1800, 650], [1900, 640], [2050, 640], [2190, 640]]),
  T('g', 'Te Ana Tioata', 'The crystal gallery', 14, [
    [[1330, 920], [1400, 928], [1460, 934], [1500, 932], [1560, 938], [1640, 934], [1720, 933], [1780, 924]],
  ], [[1330, 850], [1450, 830], [1560, 806], [1680, 820], [1780, 846]]),
  T('t3', 'Te Awa Pōuri', 'The dark stream', 15, [
    [[766, 1124], [840, 1122], [900, 1122], [960, 1124], [1030, 1120], [1100, 1118]],
    [[1100, 1112], [1160, 1112], [1250, 1112], [1330, 1110], [1370, 1108]],
    [[1370, 1096], [1440, 1096], [1500, 1094], [1560, 1094], [1640, 1090]],
    [[1640, 1082], [1700, 1082], [1820, 1084], [1900, 1080]],
    [[1900, 1070], [1960, 1070], [2100, 1066], [2193, 1062], [2280, 1060]],
  ], [[760, 1000], [900, 986], [1050, 996], [1200, 966], [1400, 984], [1600, 972], [1800, 990], [2000, 984], [2280, 990]]),
  T('w1', 'Te Tāheke', 'The wet pitch', 16, [[[604, 1190], [690, 1193], [780, 1188]]], [[604, 1100], [780, 1110]]),
  T('w2', 'Te Tāheke', 'The wet pitch', 17, [[[492, 1262], [560, 1265], [640, 1260], [780, 1258]]], [[492, 1160], [780, 1180]]),
  T('t4', 'Te Waha o te Pō', 'The lake at the bottom of the dark', 18, [
    [[134, 1322], [180, 1324], [260, 1328], [340, 1330], [400, 1332], [440, 1334], [480, 1330], [560, 1328], [640, 1332], [720, 1336], [790, 1342]],
  ], [[134, 1240], [300, 1200], [500, 1170], [790, 1166]]),
  T('t5', 'Te Pakitara Wai', 'The water wall', 19, [
    [[72, 1528], [131, 1532], [200, 1536], [280, 1544], [340, 1548], [400, 1550], [540, 1552]],
    [[540, 1566], [620, 1570], [700, 1574]],
    [[700, 1574], [780, 1578], [868, 1582]],
    [[868, 1582], [960, 1588], [1040, 1594], [1134, 1600]],
    [[1134, 1600], [1200, 1622], [1280, 1672], [1360, 1730], [1440, 1772]],
    [[1440, 1772], [1570, 1774], [1700, 1776]],
    [[1700, 1776], [1760, 1790], [1840, 1814], [1920, 1838], [2000, 1856]],
    [[2000, 1866], [2060, 1876], [2140, 1880], [2220, 1878], [2300, 1872], [2380, 1868]],
  ], [[72, 1440], [160, 1466], [300, 1480], [420, 1486], [540, 1490], [620, 1500], [690, 1512], [700, 1534], [868, 1540], [900, 1526], [1000, 1528], [1134, 1534], [1200, 1540], [1300, 1580], [1400, 1640], [1446, 1700], [1500, 1764], [1560, 1790], [1640, 1788], [1690, 1730], [1720, 1640], [1800, 1580], [1900, 1560], [2000, 1550], [2100, 1548], [2200, 1560], [2300, 1580], [2380, 1620]]),
];
export const TIER: Record<string, Tier> = Object.fromEntries(TIERS.map(t => [t.id, t]));

export type PoolKind = 'pool' | 'drip' | 'sump' | 'nursery';
/** pools in a tier's walk line (the floor dips; water to the rim): x0, x1, depth */
export const POOLS: { tier: string; x0: number; x1: number; d: number; kind?: PoolKind }[] = [
  { tier: 't3', x0: 920, x1: 1030, d: 10 },
  { tier: 't3', x0: 1180, x1: 1330, d: 14 },
  { tier: 't3', x0: 1440, x1: 1560, d: 12 },
  { tier: 't4', x0: 396, x1: 486, d: 11 },
  { tier: 'g', x0: 1640, x1: 1720, d: 8 },
  // drip pools: shallow, fed from the roof, cold water to the ankles
  { tier: 't2', x0: 836, x1: 922, d: 5, kind: 'drip' },
  { tier: 't5', x0: 286, x1: 352, d: 5, kind: 'drip' },
  { tier: 't5', x0: 960, x1: 1030, d: 4, kind: 'drip' },
  // the sump: the passage goes under the water (the roof dips below it in the middle)
  { tier: 't5', x0: 1446, x1: 1700, d: 72, kind: 'sump' },
  // the deepest chamber's rimstone pool: crystal water, the salamanders' nursery
  { tier: 't5', x0: 2062, x1: 2218, d: 12, kind: 'nursery' },
];
/** a pool's water level: the lower of its two lips (so the water never stands above the rock) */
export const poolTop = (p: { tier: string; x0: number; x1: number }) => Math.max(TIER[p.tier].floor(p.x0), TIER[p.tier].floor(p.x1));
/** the walk line of a tier at x, pools included (the bed scooped under a flat water level) */
export const floorOf = (tier: string, x: number) => {
  const y = TIER[tier].floor(x);
  for (const p of POOLS) {
    if (p.tier !== tier || x <= p.x0 || x >= p.x1) continue;
    const t = (x - p.x0) / (p.x1 - p.x0);
    const steep = p.kind === 'sump' ? 1.1 : 1.5;
    const dip = p.d * Math.min(1, Math.sin(t * Math.PI) * steep) * (0.85 + 0.15 * Math.sin(t * 9 + p.x0));
    return Math.max(y, Math.round(poolTop(p) + dip));
  }
  return y;
};
/** the water surface of the pool at x on a tier (null: no pool) */
export function poolAt(tier: string, x: number): { x0: number; x1: number; top: number; d: number; kind: PoolKind } | null {
  for (const p of POOLS) if (p.tier === tier && x > p.x0 && x < p.x1) return { x0: p.x0, x1: p.x1, top: poolTop(p), d: p.d, kind: p.kind ?? 'pool' };
  return null;
}

// ---------------------------------------------------------------- the ways between the tiers
export type LinkKind = 'ladder' | 'rope' | 'flow';
export type CaveGate = 'rope' | 'grip' | 'gloves' | 'boots' | 'sump';
export interface Link { id: string; kind: LinkKind; x: number; top: string; bot: string; gate?: CaveGate; hard?: number }
/** ladders, ropes and the flowstone wall: each from the edge (or a hole) of one tier down to the next */
export const LINKS: Link[] = [
  /** the old caver's iron ladder from the mouth down into the wētā hall */
  { id: 'ladder0', kind: 'ladder', x: 1703, top: 't0', bot: 't1' },
  /** down through the caver's planks into the crystal gallery */
  { id: 'ladderG', kind: 'ladder', x: 1500, top: 't2', bot: 'g' },
  /** the rope pitch: T2's end down the shaft to the dark stream */
  { id: 'pitch', kind: 'rope', x: 2193, top: 't2', bot: 't3', gate: 'rope' },
  /** the wet pitch beside the falls, three drops ledge to ledge */
  { id: 'wetA', kind: 'rope', x: 763, top: 't3', bot: 'w1', gate: 'rope' },
  { id: 'wetB', kind: 'rope', x: 601, top: 'w1', bot: 'w2', gate: 'rope' },
  { id: 'wetC', kind: 'rope', x: 489, top: 'w2', bot: 't4', gate: 'rope' },
  /** the water wall: wet flowstone down from the shore's west end, below the lake (grip soles) */
  { id: 'flow', kind: 'flow', x: 131, top: 't4', bot: 't5', gate: 'grip', hard: 1 },
];
export const LINK: Record<string, Link> = Object.fromEntries(LINKS.map(l => [l.id, l]));
/** the hand-holds on the flowstone wall where Mori can hang still and get his breath back */
export const FLOW_KNOBS = [1392, 1462];
export const climbOf = (c: { x: number; top: string; bot: string }) => ({ x: c.x, y0: floorOf(c.top, c.x), y1: floorOf(c.bot, c.x) });
/** the plank bridge over the hole down to the crystal gallery */
export const PLANKS = { x0: 1478, x1: 1522 };

/** the scree chute: a ramp of scree up the back wall of the scree hall, from T2's floor at its foot
 *  (x 150) to the wētā hall's west end (x 440). It is a switchback (T2 runs on under it, nearer the
 *  camera): coming down, Mori steps off its foot onto T2; going up, he steps onto it at the foot. */
export const CHUTE: K = [[150, 712], [180, 700], [212, 684], [244, 664], [278, 640], [314, 612], [346, 582], [376, 548], [408, 510], [440, 470]];
export const CHUTE_FOOT = { x0: 146, x1: 176 };
export const chuteY = line(CHUTE, 19, 2);

// ---------------------------------------------------------------- the steps inside a tier
export type StepKind = 'walk' | 'hop' | 'scramble';
export interface Step {
  tier: string; x: number;
  /** the floor on the high side and the low side */
  hi: number; lo: number;
  /** +1: the low side is to the right of x */
  dir: 1 | -1;
  kind: StepKind;
  /** stop Mori at the brink (too deep to drop) */
  edge: boolean;
  /** a scramble's climb: hugging the riser on the low side */
  climb?: { x: number; y0: number; y1: number; hard: number };
}
/** the hard scrambles (more breath per second on them) */
const HARD: Record<string, number> = { 't1:690': 1, 't1:1340': 0.6 };
export const STEPS: Step[] = [];
for (const t of TIERS) for (let i = 1; i < t.pieces.length; i++) {
  const A = t.pieces[i - 1], B = t.pieces[i], x = B.x0;
  const ya = A.f(x), yb = B.f(x), d = Math.abs(yb - ya);
  const dir: 1 | -1 = yb > ya ? 1 : -1;
  const kind: StepKind = d <= STEP_WALK - 1 ? 'walk' : d <= STEP_HOP ? 'hop' : 'scramble';
  const s: Step = { tier: t.id, x, hi: Math.min(ya, yb), lo: Math.max(ya, yb), dir, kind, edge: d > STEP_EDGE };
  if (kind === 'scramble') {
    const cx = x + dir * 3;
    const lo = dir > 0 ? B : A;
    s.climb = { x: cx, y0: Math.min(ya, yb), y1: lo.f(cx), hard: HARD[`${t.id}:${x}`] ?? 0.3 };
  }
  STEPS.push(s);
}

/** the walk surfaces of a tier: one per piece, reaching LIP px out over a scramble or a link at its ends */
export function tierSurfaces(t: Tier): { piece: Piece; pts: [number, number][] }[] {
  return t.pieces.map((p, i) => {
    let a = p.x0, b = p.x1;
    const left = STEPS.find(s => s.tier === t.id && s.x === p.x0 && s.dir < 0 && s.kind === 'scramble');
    const right = STEPS.find(s => s.tier === t.id && s.x === p.x1 && s.dir > 0 && s.kind === 'scramble');
    if (left) a -= LIP;
    if (right) b += LIP;
    if (i === 0 && LINKS.some(l => l.top === t.id && l.x < p.x0 && p.x0 - l.x < LIP)) a -= LIP;
    if (i === t.pieces.length - 1 && LINKS.some(l => l.top === t.id && l.x > p.x1 && l.x - p.x1 < LIP)) b += LIP;
    const pts: [number, number][] = [];
    for (let x = a; x < b; x += 4) pts.push([x, floorOfPiece(t, p, x)]);
    pts.push([b, floorOfPiece(t, p, b)]);
    return { piece: p, pts };
  });
}
/** a piece's own walk line at x (its pools scooped in; past its ends it carries on level) */
function floorOfPiece(t: Tier, p: Piece, x: number) {
  if (x > p.x0 && x < p.x1) return floorOf(t.id, x);
  return p.f(x);
}

// ---------------------------------------------------------------- obstacles and gates
/** low roofs: Mori goes on hands and knees (crawl), wriggles with the pack ahead (squeeze), or
 *  crawls between crystal blades (gloves) */
export const CRAWLS: { tier: string; x0: number; x1: number; kind: 'crawl' | 'squeeze' | 'crystal' }[] = [
  { tier: 't0', x0: 586, x1: 716, kind: 'crawl' },
  { tier: 't2', x0: 560, x1: 800, kind: 'squeeze' },
  { tier: 't5', x0: 702, x1: 866, kind: 'crystal' },
];
/** cracked roofs: a rattle and a trickle of grit, then a rock comes down */
export const LOOSE: { tier: string; x0: number; x1: number }[] = [
  { tier: 't1', x0: 1378, x1: 1506 },
  { tier: 't5', x0: 410, x1: 530 },
];
/** the gear walls: without the gear Mori stops at x (coming from the side `from`) */
export const GATEWALLS: { id: string; tier: string; x: number; gate: CaveGate; from: -1 | 1 }[] = [
  { id: 'crystal', tier: 't5', x: 694, gate: 'gloves', from: -1 },
  { id: 'mud', tier: 't5', x: 1132, gate: 'boots', from: -1 },
  { id: 'sump', tier: 't5', x: 1452, gate: 'sump', from: -1 },
];
/** the boulder wedged in the mouth's narrows: heave it (a mash) and it rolls into the hollow beyond */
export const CHOKE = { tier: 't0', x: 432, wall: 414, rest: 512, w: 46, h: 46 };
/** the crack across T0: jump it (fall in and there's a scramble out either side) */
export const CRACK = { tier: 't0', x0: 1176, x1: 1198 };
/** the mud slope and the sump (what's underfoot) */
export const MUD = { tier: 't5', x0: 1134, x1: 1440 };
export const SUMP = POOLS.find(p => p.kind === 'sump')!;
export const NURSERY = POOLS.find(p => p.kind === 'nursery')!;

/** the lake: its surface, the bed under it (deep in the middle) */
export const LAKE = { x0: 790, x1: 2360, top: 1348, bed: (x: number) => Math.round(1348 + Math.max(4, Math.min(150, (x - 790) * 0.9, (2360 - x) * 0.6)) + (noise1(x / 30, 5) - 0.5) * 8) };
/** the underground waterfall: out of a crack in the shaft wall, down into the plunge pool */
export const FALLS = { x: 418, top: 1132, bottom: 1334, w: 20 };

/** places along the way */
export const SPOT = {
  enter: 30, exit: 14,
  aroha: 66,
  postT0: 1560, postT1a: 560, postT1b: 1760, postT2a: 220, postT2b: 1420, postT2c: 2080, postT3a: 2080, postT3b: 880, postT4: 640, postT4w: 160, postT5: 210,
  squeeze: [560, 800] as [number, number],
  fungus: [950, 1360] as [number, number],
  camp: 250, journal: 304, pole: 772, hide: 680, shoreEdge: 790,
  bigWeta: 1240, rare: 1590, crystals: 1660,
  roost: 940,
  moonmilk: 1086, deep: 1960, pearls: 2120, giant: 2280,
};

/** the open space of the cave (where there is no rock): the passages, the shafts, the lake chamber */
export interface Hole { x0: number; x1: number; top: (x: number) => number; bot: (x: number) => number }
const cl = (t: Tier, x: number) => Math.max(t.x0, Math.min(t.x1, x));
const tierHole = (t: Tier, pad0 = 0, pad1 = 0): Hole => ({ x0: t.x0 - pad0, x1: t.x1 + pad1, top: x => t.roof(cl(t, x)), bot: x => floorOf(t.id, cl(t, x)) });
const box = (x0: number, x1: number, y0: number, y1: number, seed: number, wob = 10): Hole => ({ x0, x1, top: x => y0 + (noise1(x / 23, seed) - 0.5) * wob, bot: x => y1 + (noise1(x / 19, seed + 3) - 0.5) * wob });
const T0 = TIER.t0, T1 = TIER.t1, T2 = TIER.t2, TG = TIER.g, T3 = TIER.t3, T4 = TIER.t4, T5 = TIER.t5;
/** the roof of the lake chamber: the glowworm sky */
export const lakeRoof = line([[80, 1250], [140, 1236], [250, 1200], [400, 1170], [600, 1160], [800, 1166], [1000, 1180], [1200, 1176], [1400, 1180], [1600, 1170], [1800, 1180], [2000, 1190], [2200, 1210], [2390, 1250]], 35, 30);
export const HOLES: Hole[] = [
  // the mouth: open to the glowworm cave at the west edge
  tierHole(T0, 60, 4),
  tierHole(T1, 0, 30),
  tierHole(T2, 40, 4),
  tierHole(TG, 10, 10),
  tierHole(T3, 4, 30),
  tierHole(T5, 0, 20),
  // the ladder shaft (T0 to T1), the gallery hole, the rope pitch shaft
  { ...box(1700, 1754, 200, 436, 31, 6), top: x => 200 + (noise1(x / 7, 31) - 0.5) * 3 },
  box(1486, 1516, 757, 830, 32, 2),
  { ...box(2190, 2292, 700, 1064, 33, 8), top: x => 690 + (noise1(x / 7, 33) - 0.5) * 3 },
  // the scree hall: open up over the ramp to the wētā hall's west end
  { x0: 110, x1: 446, top: x => chuteY(Math.max(150, Math.min(440, x))) - 96, bot: x => T2.floor(Math.max(96, x)) },
  // the wet pitch shaft, beside the falls, and the lake chamber under its glowworm sky
  { ...box(372, 766, 1110, 1345, 34, 16), top: x => 1110 + (noise1(x / 21, 34) - 0.5) * 14 },
  { x0: 80, x1: 2390, top: x => lakeRoof(x), bot: x => (x < 790 ? floorOf('t4', Math.max(134, x)) : LAKE.bed(Math.min(2360, x))) },
  // the water wall: the flowstone shaft from the shore's west end down to T5
  { ...box(66, 134, 1300, 1534, 36, 6), bot: x => T5.floor(Math.max(96, x)) },
];

/** rock inside the open: the wet pitch's ledges, each growing out of the shaft's east wall and
 *  thinning to its tip (the floor painter gives their tops a floor) */
export const SOLIDS: Hole[] = (['w1', 'w2'] as const).map((id, i) => {
  const t = TIER[id];
  return { x0: t.x0 - 1, x1: 776, top: (x: number) => t.floor(cl(t, x)), bot: (x: number) => t.floor(cl(t, x)) + 2 + Math.min(20, (x - t.x0 + 1) * 0.5) + (noise1(x / 5, 40 + i) - 0.5) * 6 + (noise1(x / 17, 42 + i) - 0.5) * 6 };
});

/** what the floor is made of (the floor painter's palette): by tier and stretch */
export type FloorMat = 'dry' | 'rubble' | 'guano' | 'wet' | 'flow' | 'mud' | 'crystal' | 'shingle' | 'rim' | 'moon';
export const FLOORMAT: { tier: string; x0: number; x1: number; mat: FloorMat }[] = [
  { tier: 't0', x0: -80, x1: 300, mat: 'rubble' }, { tier: 't0', x0: 300, x1: 840, mat: 'dry' }, { tier: 't0', x0: 840, x1: 1060, mat: 'guano' },
  { tier: 't0', x0: 1060, x1: 1710, mat: 'dry' },
  { tier: 't1', x0: 400, x1: 700, mat: 'dry' }, { tier: 't1', x0: 700, x1: 990, mat: 'rubble' }, { tier: 't1', x0: 990, x1: 1340, mat: 'rubble' },
  { tier: 't1', x0: 1340, x1: 1540, mat: 'rubble' }, { tier: 't1', x0: 1540, x1: 2000, mat: 'dry' },
  { tier: 't2', x0: 50, x1: 800, mat: 'wet' }, { tier: 't2', x0: 800, x1: 980, mat: 'wet' }, { tier: 't2', x0: 980, x1: 1480, mat: 'flow' },
  { tier: 't2', x0: 1480, x1: 1900, mat: 'rubble' }, { tier: 't2', x0: 1900, x1: 2240, mat: 'wet' },
  { tier: 'g', x0: 1300, x1: 1800, mat: 'crystal' },
  { tier: 't3', x0: 740, x1: 2300, mat: 'rim' },
  { tier: 'w1', x0: 590, x1: 800, mat: 'wet' }, { tier: 'w2', x0: 470, x1: 660, mat: 'wet' },
  { tier: 't4', x0: 80, x1: 800, mat: 'shingle' },
  { tier: 't5', x0: 60, x1: 690, mat: 'flow' }, { tier: 't5', x0: 690, x1: 880, mat: 'crystal' }, { tier: 't5', x0: 880, x1: 1134, mat: 'moon' },
  { tier: 't5', x0: 1134, x1: 1700, mat: 'mud' }, { tier: 't5', x0: 1700, x1: 2400, mat: 'rim' },
];
/** the floor material under (x, y): the tier whose floor is nearest under that point */
export function floorMatAt(x: number, y: number): FloorMat {
  let best: Tier | null = null, bd = 1e9;
  for (const t of TIERS) {
    if (x < t.x0 - 80 || x > t.x1 + 80) continue;
    const d = Math.abs(y - floorOf(t.id, cl(t, x)));
    if (d < bd) { bd = d; best = t; }
  }
  if (!best || bd > 60) return y > LAKE.top - 40 && x > LAKE.x0 ? 'wet' : 'dry';
  for (const m of FLOORMAT) if (m.tier === best.id && x >= m.x0 && x < m.x1) return m.mat;
  return 'dry';
}

/** where the tiers and their places are named (floating over the HUD) */
const SUBZONES: { tier: string; x0: number; x1: number; name: string; sub: string }[] = [
  { tier: 't0', x0: 380, x1: 480, name: 'Te Kūaha', sub: 'The choke' },
  { tier: 't0', x0: 570, x1: 730, name: 'Te Kūaha', sub: 'The crawl' },
  { tier: 't0', x0: 840, x1: 1060, name: 'Te Kūaha', sub: 'The bat roost' },
  { tier: 't0', x0: 1140, x1: 1230, name: 'Te Kūaha', sub: 'The crack' },
  { tier: 't1', x0: 640, x1: 730, name: 'Ngā Wētā', sub: 'The chimney' },
  { tier: 't1', x0: 1340, x1: 1540, name: 'Ngā Wētā', sub: 'The rockfall pit' },
  { tier: 't2', x0: 560, x1: 800, name: 'Te Kūititanga', sub: 'The squeeze' },
  { tier: 't2', x0: 950, x1: 2200, name: 'Te Harore', sub: 'The fungus hall' },
  { tier: 't5', x0: 690, x1: 880, name: 'Te Kūiti Tioata', sub: 'The crystal squeeze' },
  { tier: 't5', x0: 880, x1: 1134, name: 'Te Ana Waiū', sub: 'The moonmilk cave' },
  { tier: 't5', x0: 1134, x1: 1446, name: 'Te Paru', sub: 'The mud slope' },
  { tier: 't5', x0: 1446, x1: 1700, name: 'Te Ruku', sub: 'The sump' },
  { tier: 't5', x0: 1700, x1: 2400, name: 'Te Puna Tioata', sub: 'The deepest chamber' },
];
export function zoneAt(x: number, y: number): [string, string] {
  const best = tierAt(x, y, 260);
  if (!best) return ['Te Rua Pōuri', 'The deep dark cave'];
  for (const z of SUBZONES) if (z.tier === best.id && x >= z.x0 && x < z.x1) return [z.name, z.sub];
  return [best.name, best.sub];
}
/** the tier whose floor is nearest (x, y), within `reach` px */
export function tierAt(x: number, y: number, reach = 40): Tier | null {
  let best: Tier | null = null, bd = 1e9;
  for (const t of TIERS) {
    if (x < t.x0 - 6 || x > t.x1 + 6) continue;
    const d = Math.abs(y - floorOf(t.id, cl(t, x)));
    if (d < bd) { bd = d; best = t; }
  }
  return bd <= reach ? best : null;
}
/** the tier Mori is standing on (or about to land on): the floor at or just under his feet */
export function tierUnder(x: number, y: number): Tier | null {
  let best: Tier | null = null, bd = 1e9;
  for (const t of TIERS) {
    if (x < t.x0 - LIP - 1 || x > t.x1 + LIP + 1) continue;
    const d = floorOf(t.id, cl(t, x)) - y;
    if (d >= -8 && d < bd) { bd = d; best = t; }
  }
  return best;
}

/** 0 at the mouth .. 1 at the bottom: how deep (cold, far from the sun) Mori is */
export const depthK = (y: number) => Math.max(0, Math.min(1, (y - 180) / 1690));

// ---------------------------------------------------------------- how far Mori may go
/**
 * The walls round Mori on tier `t` standing at (x, y): [lo, hi]. On the ground he stops at any rise
 * of more than STEP_WALK and at any drop deeper than STEP_EDGE (he climbs those); in the air only the
 * rock itself stops him (so a jump carries him up a hop, or over the crack). `shut(x)` adds the gear
 * walls and the choke: true where he can't pass. The tier's ends stop him unless a link goes on there.
 * `surf(x)`: the height of the surface he stands on at x, where it reaches (a lip over an edge).
 */
export function limitsAt(t: Tier, x: number, y: number, grounded: boolean, shut?: (x: number, dir: 1 | -1) => boolean, surf?: (x: number) => number | null): [number, number] {
  const R = 40;
  const at = (xx: number) => (grounded && surf ? surf(xx) ?? floorOf(t.id, xx) : floorOf(t.id, xx));
  const scan = (dir: 1 | -1): number => {
    let prev = grounded ? y : at(cl(t, x));
    for (let k = 1; k <= R; k++) {
      const xx = Math.round(x) + dir * k;
      if (shut && shut(xx, dir)) return xx - dir;
      if (xx < t.x0 || xx > t.x1) {
        // the tier's end: a link climb just beyond it may be stood at, nothing further
        const link = LINKS.find(l => l.top === t.id && Math.abs(l.x - xx) <= LIP && (dir > 0 ? l.x > t.x1 : l.x < t.x0));
        if (link) return link.x;
        if (t.id === 't0' && dir < 0) return 4;
        if (t.id === 't1' && dir < 0) return t.x0 - 30;
        return xx - dir;
      }
      const fy = at(xx);
      if (grounded) {
        if (fy < prev - STEP_WALK) return xx - dir;
        if (fy - prev > STEP_EDGE) {
          // stop at the brink: a scramble's climb, if there is one, is just over it
          const s = STEPS.find(q => q.tier === t.id && q.climb && Math.abs(q.climb.x - xx) <= LIP + 1);
          return s?.climb && (s.climb.x - x) * dir >= 0 ? s.climb.x : xx - dir;
        }
      } else if (fy < y - 1) return xx - dir;
      prev = fy;
    }
    return Math.round(x) + dir * R;
  };
  return [scan(-1), scan(1)];
}

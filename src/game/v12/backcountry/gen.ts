// V12 Te Tuawhenua, the backcountry: one very wide map (14,000 px) laid out by a deterministic generator
// from a seed, so the land is big and still worked out in every corner. It fills the blank south
// interior of the Region Map: from the crossroads behind Te Kāinga's market lane east through six
// stretches of country to the end of the claw gorge, where the steam of the Hot Valley rises.
//
// It is the home ground of two big animals, and the land tells their story: the giant feathered boa
// lives in the wet fern gully (its wallow in the crushed ferns, a shed skin draped over a log, plume
// feathers lying in the grass, its drag trail across the river gravel); the Bearer, the serpent-eating
// bear with one massive hooked claw, dens in the gorge (claw-scored trunks marking its ground, kill
// sites of picked-clean ribs and skulls, its food cache, its den mouth under the rock overhang).
//
//   ⇠ village (TE KĀINGA, its market-lane crossroads)                             the Hot Valley ⇢
//   ╬ a signposted crossroads, ↑ a tier (the ledge over the den)
//
//                                         crest                                          ↑ the ledge
//   ⇠ W ═ Ngā Mānuka ══╬═ Te Awa Whiri ═══╬═ Te Hiwi Pango ═╬═ Te Kōawa Huruhuru ═╬═ Ngā Pātītī ═╬═ Te Kapiti Matikuku ═ E ⇢
//        kānuka scrub     braided river      the burnt ridge    the feathered gully   tussock       the claw gorge
//        cairns, scored   wading channels,   charred trunks,    tree ferns, the       clearings,    cliffs both sides,
//        kānuka           gravel bars, the   ash, regrowth,     creek, the arena,     kill sites    the den, the cache
//                         boa's drag trail   a kill site        the wallow, a skin
//   x  0               ~2200            ~4800            ~7000                 ~9800          ~11600                  14000
//
// Plain data and the walk line (no game imports) so anything can ask where a place is. Same seed, same
// map: every list below comes out of one Rng and the noise functions, in a fixed order.

import { Rng, clamp, fbm1, noise1, smoothstep } from '../../../core/math';

/** the map's seed: change it and the whole backcountry is laid out afresh */
export const TUA_SEED = 0x7a5e11;
export const TUA_W = 14000;
/** camera bounds (world y) */
export const TUA_MIN_Y = -170, TUA_MAX_Y = 470;
/** the nominal walk line */
export const TUA_B0 = 214;

export type Biome = 'scrub' | 'flats' | 'burnt' | 'boa' | 'tussock' | 'gorge';
export const BIOMES: Biome[] = ['scrub', 'flats', 'burnt', 'boa', 'tussock', 'gorge'];
export const BIO_I: Record<Biome, number> = { scrub: 0, flats: 1, burnt: 2, boa: 3, tussock: 4, gorge: 5 };

export interface Stretch { b: Biome; x0: number; x1: number; name: string; sub: string }
/** a stream crossing the walk line and running off toward the camera (wading depth at the walk line) */
export interface Stream { x: number; hw: number; depth: number; skew: number; kind: 'braid' | 'creek' | 'gorge'; seed: number }
/** a braid of the river that splits off in front of the walk line (floor only, never crossed) */
export interface Braid { x: number; hw: number; dd0: number; skew: number; seed: number }
export interface Rock { x: number; w: number; h: number; seed: number }
export interface Log { x: number; len: number; seed: number }
export interface Track { x: number; kind: 'boa' | 'bearer'; len: number; seed: number }

const NAMES: Record<Biome, [string, string]> = {
  scrub: ['Ngā Mānuka', 'The kānuka scrub'],
  flats: ['Te Awa Whiri', 'The braided river flats'],
  burnt: ['Te Hiwi Pango', 'The burnt ridge'],
  boa: ['Te Kōawa Huruhuru', 'The feathered gully'],
  tussock: ['Ngā Pātītī', 'The tussock clearings'],
  gorge: ['Te Kapiti Matikuku', 'The claw gorge'],
};
/** rough widths of the stretches (jittered by the seed, then scaled to the map) */
const WIDTHS: Record<Biome, [number, number]> = {
  scrub: [2050, 2350], flats: [2450, 2800], burnt: [2050, 2350], boa: [2650, 3000], tussock: [1750, 1950], gorge: [2350, 2600],
};

// ---------------------------------------------------------------- the generator
function generate(seed: number) {
  const rng = new Rng(seed);
  // ---- the stretches
  const raw = BIOMES.map(b => rng.range(WIDTHS[b][0], WIDTHS[b][1]));
  const k = TUA_W / raw.reduce((a, b) => a + b, 0);
  const stretches: Stretch[] = [];
  let x = 0;
  BIOMES.forEach((b, i) => {
    const x1 = i === BIOMES.length - 1 ? TUA_W : Math.round((x + raw[i] * k) / 10) * 10;
    stretches.push({ b, x0: x, x1, name: NAMES[b][0], sub: NAMES[b][1] });
    x = x1;
  });
  const S = Object.fromEntries(stretches.map(s => [s.b, s])) as Record<Biome, Stretch>;
  const at = (b: Biome, u: number) => Math.round(S[b].x0 + (S[b].x1 - S[b].x0) * u);

  // ---- the big shapes: control points of the walk line (offsets from the nominal line, - is up)
  const K: [number, number][] = [[0, 0], [160, 0]];
  const add = (xx: number, y: number) => { if (xx > K[K.length - 1][0] + 24) K.push([xx, y]); };
  {
    // the kānuka scrub: rolling, climbing a little away from the village
    const s = S.scrub;
    for (let xx = s.x0 + 360; xx < s.x1 - 260; xx += rng.range(260, 420)) add(xx, rng.range(-20, 2) - 6 * ((xx - s.x0) / (s.x1 - s.x0)));
    add(s.x1 - 120, -8);
  }
  {
    // down onto the river terrace: dead flat
    const s = S.flats;
    add(s.x0 + rng.range(180, 260), 8);
    for (let xx = s.x0 + 600; xx < s.x1 - 300; xx += rng.range(420, 620)) add(xx, 10 + rng.range(-1.5, 1.5));
    add(s.x1 - 160, 9);
  }
  // (the burnt ridge's crest and the gully's arena are needed for the spots below)
  const crest = [at('burnt', 0.5 + rng.range(-0.03, 0.03)), 0] as [number, number];
  crest[1] = crest[0] + Math.round(rng.range(140, 200));
  {
    // the burnt ridge: a long climb to the crest, a short level top, down the far side into the gully
    const s = S.burnt;
    add(at('burnt', 0.14), 2);
    add(at('burnt', 0.3), -18 + rng.range(-3, 3));
    add(crest[0] - 140, -42 + rng.range(-3, 3));
    add(crest[0], -60);
    add((crest[0] + crest[1]) / 2, -62 + rng.range(-2, 2));
    add(crest[1], -58);
    add(at('burnt', 0.86), -18);
    add(s.x1 - 70, 16);
  }
  const arena: [number, number] = [0, 0];
  const creekX = at('boa', 0.7 + rng.range(-0.03, 0.03));
  {
    // the feathered gully: down to a fern flat (the arena), across the creek, up the far bank
    const s = S.boa;
    add(at('boa', 0.1), 30);
    arena[0] = Math.round(at('boa', 0.3 + rng.range(-0.02, 0.02)) / 10) * 10;
    arena[1] = arena[0] + 400;
    add(arena[0] - 120, 32);
    add(arena[0] + 200, 33);
    add(arena[1] + 120, 33);
    add(creekX - 200, 38);
    add(creekX + 220, 36);
    add(at('boa', 0.9), 14);
    add(s.x1 - 60, 2);
  }
  {
    // the tussock clearings: open and rolling
    const s = S.tussock;
    for (let xx = s.x0 + 260; xx < s.x1 - 160; xx += rng.range(280, 420)) add(xx, rng.range(-14, 0));
    add(s.x1 - 80, -2);
  }
  const steps: number[] = [];
  {
    // the claw gorge: a stony floor climbing east in rock steps toward the Hot Valley
    const s = S.gorge;
    let y = 4;
    add(s.x0 + 140, y);
    for (let xx = s.x0 + 420; xx < s.x1 - 300; xx += rng.range(300, 460)) {
      const up = rng.chance(0.62);
      if (up) {
        add(xx, y);
        y -= rng.range(9, 13);
        add(xx + 34, y);
        steps.push(xx + 17);
      } else {
        y += rng.range(-3, 3);
        add(xx, y);
      }
    }
    add(s.x1 - 160, y - 8);
  }
  add(TUA_W - 20, K[K.length - 1][1] - 2);
  K.push([TUA_W + 200, K[K.length - 1][1]]);

  // ---- the streams
  const streams: Stream[] = [];
  const braids: Braid[] = [];
  {
    const s = S.flats;
    const n = rng.int(5, 6);
    const span = s.x1 - s.x0 - 640;
    for (let i = 0; i < n; i++) {
      const xx = Math.round(s.x0 + 320 + (span * (i + 0.5)) / n + rng.range(-70, 70));
      const wide = i === Math.floor(n / 2);
      streams.push({ x: xx, hw: wide ? rng.range(34, 42) : rng.range(12, 28), depth: wide ? rng.range(6, 7.5) : rng.range(2.6, 5), skew: rng.range(-0.55, 0.55), kind: 'braid', seed: rng.int(1, 9999) });
    }
    // braids splitting off in front of the walk line, between the channels
    for (let i = 0; i < n + 2; i++) braids.push({ x: Math.round(s.x0 + 260 + rng.range(0, s.x1 - s.x0 - 520)), hw: rng.range(6, 18), dd0: rng.range(26, 80), skew: rng.range(-0.8, 0.8), seed: rng.int(1, 9999) });
  }
  streams.push({ x: creekX, hw: rng.range(13, 16), depth: rng.range(5.5, 6.5), skew: rng.range(0.15, 0.35), kind: 'creek', seed: rng.int(1, 9999) });
  const gorgeStream = at('gorge', 0.22 + rng.range(-0.02, 0.02));
  streams.push({ x: gorgeStream, hw: rng.range(15, 19), depth: rng.range(4, 5), skew: rng.range(-0.3, -0.1), kind: 'gorge', seed: rng.int(1, 9999) });

  // ---- the gorge's den, the cache, the ledge over the den
  let den = at('gorge', 0.56 + rng.range(-0.02, 0.02));
  while (steps.some(q => Math.abs(q - den) < 110)) den += 40;
  const cache = den + Math.round(rng.range(170, 210));
  const ledge = { x0: den - 300, x1: den - 100, climb: den - 320, rise: 70 };

  // ---- the crossroads between the stretches (on level ground, off the water)
  const posts: number[] = [];
  for (let i = 1; i < stretches.length; i++) {
    let px = stretches[i].x0 + Math.round(rng.range(-40, 40));
    while (streams.some(q => Math.abs(q.x - px) < q.hw + 60) || steps.some(q => Math.abs(q - px) < 60)) px += 30;
    posts.push(px);
  }

  // ---- the story on the ground
  const kills = [at('burnt', 0.9), at('tussock', 0.3 + rng.range(-0.04, 0.04)), at('tussock', 0.74 + rng.range(-0.04, 0.04)), den + 360];
  const wallow = arena[1] + Math.round(rng.range(170, 230));
  const skins = [at('boa', 0.14), Math.round(creekX - rng.range(320, 380))];
  const feathers: number[] = [];
  for (let i = 0; i < 9; i++) feathers.push(Math.round(rng.range(S.boa.x0 + 120, S.boa.x1 - 120)));
  feathers.push(kills[1] + 26, kills[2] - 30, at('flats', 0.56), at('scrub', 0.92));
  const tracks: Track[] = [
    { x: at('flats', 0.42 + rng.range(-0.03, 0.03)), kind: 'boa', len: 0, seed: rng.int(1, 9999) },
    { x: at('flats', 0.78 + rng.range(-0.03, 0.03)), kind: 'bearer', len: 0, seed: rng.int(1, 9999) },
    { x: at('burnt', 0.66), kind: 'bearer', len: 0, seed: rng.int(1, 9999) },
    { x: at('tussock', 0.52), kind: 'boa', len: 0, seed: rng.int(1, 9999) },
  ];
  // (a track crosses dry ground: nudge it off the channels)
  for (const t of tracks) { while (streams.some(q => Math.abs(q.x - t.x) < q.hw + 70)) t.x += 50; t.len = Math.round(rng.range(90, 140)); }
  const scored: number[] = [at('scrub', 0.78), at('scrub', 0.9), at('burnt', 0.38), at('burnt', 0.74), at('boa', 0.08), arena[1] + 60, den - 450, den + 110, den + 470, at('tussock', 0.9)];
  const cairns: number[] = [at('scrub', 0.18), at('scrub', 0.52), at('flats', 0.18), at('flats', 0.62), at('tussock', 0.12), at('gorge', 0.08), at('gorge', 0.86)];
  for (let i = 0; i < cairns.length; i++) while (streams.some(q => Math.abs(q.x - cairns[i]) < q.hw + 50) || posts.some(q => Math.abs(q - cairns[i]) < 80)) cairns[i] += 40;

  // ---- rocks and wood
  const boulders: Rock[] = [], outcrops: Rock[] = [], logs: Log[] = [];
  const free = (xx: number, r: number) => !streams.some(q => Math.abs(q.x - xx) < q.hw + r) && !posts.some(q => Math.abs(q - xx) < r + 40) && Math.abs(xx - den) > r + 120 && Math.abs(xx - cache) > r + 50
    && !(xx > arena[0] - r && xx < arena[1] + r) && !(xx > ledge.climb - r - 20 && xx < ledge.x1 + r);
  for (const s of stretches) {
    const per = s.b === 'gorge' ? 260 : s.b === 'flats' ? 420 : s.b === 'tussock' ? 520 : s.b === 'scrub' ? 700 : s.b === 'burnt' ? 760 : 900;
    for (let xx = s.x0 + rng.range(80, per); xx < s.x1 - 60; xx += rng.range(per * 0.6, per * 1.4)) {
      const big = s.b === 'gorge' ? rng.chance(0.5) : rng.chance(0.25);
      const w = big ? rng.range(56, 92) : rng.range(24, 46), h = w * rng.range(0.5, 0.8);
      if (free(xx, w / 2)) boulders.push({ x: Math.round(xx), w: Math.round(w), h: Math.round(h), seed: rng.int(1, 9999) });
    }
    const operK = s.b === 'gorge' ? 520 : s.b === 'tussock' ? 900 : s.b === 'burnt' ? 1100 : s.b === 'scrub' ? 1300 : 0;
    if (operK) for (let xx = s.x0 + rng.range(200, operK); xx < s.x1 - 200; xx += rng.range(operK * 0.7, operK * 1.3)) {
      const w = rng.range(90, 150), h = rng.range(70, 130);
      if (free(xx, w / 2 + 20)) outcrops.push({ x: Math.round(xx), w: Math.round(w), h: Math.round(h), seed: rng.int(1, 9999) });
    }
    const logK = s.b === 'flats' ? 520 : s.b === 'burnt' ? 600 : s.b === 'boa' ? 760 : 0;
    if (logK) for (let xx = s.x0 + rng.range(120, logK); xx < s.x1 - 120; xx += rng.range(logK * 0.7, logK * 1.3)) {
      const len = rng.range(60, 120);
      if (free(xx + len / 2, len / 2 + 10) && !skins.some(q => Math.abs(q - xx) < 200)) logs.push({ x: Math.round(xx), len: Math.round(len), seed: rng.int(1, 9999) });
    }
  }

  return { seed, stretches, S, K, crest, arena, creekX, steps, streams, braids, den, cache, ledge, posts, kills, wallow, skins, feathers, tracks, scored, cairns, boulders, outcrops, logs, gorgeStream };
}

/** the generated map (plain data) */
export const TUA = generate(TUA_SEED);
export const TUA_STRETCHES: Stretch[] = TUA.stretches;

// ---------------------------------------------------------------- the biomes along the walk
const BLEND = 130;
/** 0..1 how much of biome `b` there is at x (they blend over ~260 px at each boundary) */
export function bioW(x: number, b: Biome): number {
  const s = TUA.S[b];
  const a = s.x0 <= 0 ? -1e9 : s.x0, e = s.x1 >= TUA_W ? 1e9 : s.x1;
  return smoothstep(a - BLEND, a + BLEND, x) * (1 - smoothstep(e - BLEND, e + BLEND, x));
}
/** the biome at x */
export function bioAt(x: number): Biome {
  for (const s of TUA.stretches) if (x < s.x1) return s.b;
  return 'gorge';
}
/** pick a biome at x for a 0..1 dither value (the boundaries dissolve into each other, never a seam) */
export function bioPick(x: number, r: number): Biome {
  const s = stretchAt(x);
  const i = TUA.stretches.indexOf(s);
  const prev = TUA.stretches[i - 1], next = TUA.stretches[i + 1];
  if (prev && x < s.x0 + BLEND) return r < 1 - smoothstep(s.x0 - BLEND, s.x0 + BLEND, x) ? prev.b : s.b;
  if (next && x > s.x1 - BLEND) return r < smoothstep(s.x1 - BLEND, s.x1 + BLEND, x) ? next.b : s.b;
  return s.b;
}
export function stretchAt(x: number): Stretch {
  for (const s of TUA.stretches) if (x < s.x1) return s;
  return TUA.stretches[TUA.stretches.length - 1];
}
/** the place name at x (the HUD's banner) */
export function tuaZone(x: number): [string, string] {
  const s = stretchAt(x);
  if (s.b === 'gorge' && Math.abs(x - TUA.den) < 260) return ['Te Rua Matikuku', 'The den under the overhang'];
  if (s.b === 'boa' && x > TUA.arena[0] - 60 && x < TUA.arena[1] + 60) return ['Te Ātea', 'The fern clearing'];
  if (s.b === 'burnt' && x > TUA.crest[0] - 80 && x < TUA.crest[1] + 80) return ['Te Tihi Pango', 'The crest of the burnt ridge'];
  return [s.name, s.sub];
}

// ---------------------------------------------------------------- the walk line
/** monotone cubic through the control points (no overshoot: the land never bulges past a point) */
function pchip(K: [number, number][]) {
  const n = K.length, d = new Float64Array(n), m = new Float64Array(n);
  for (let i = 0; i < n - 1; i++) d[i] = (K[i + 1][1] - K[i][1]) / (K[i + 1][0] - K[i][0]);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (d[i - 1] + d[i])) / ((2 * d[i] + d[i - 1]) / d[i - 1] + (d[i] + 2 * d[i - 1]) / d[i]);
  let j = 0;
  return (x: number) => {
    if (x <= K[0][0]) return K[0][1];
    if (x >= K[n - 1][0]) return K[n - 1][1];
    if (x < K[j][0] || x > K[j + 1][0]) { j = 0; while (j < n - 2 && x > K[j + 1][0]) j++; }
    const h = K[j + 1][0] - K[j][0], t = (x - K[j][0]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * K[j][1] + (t3 - 2 * t2 + t) * h * m[j] + (-2 * t3 + 3 * t2) * K[j + 1][1] + (t3 - t2) * h * m[j + 1];
  };
}
const SHAPE = pchip(TUA.K);
/** how rough each biome's ground is (px of small rises and dips) */
const ROUGH: Record<Biome, number> = { scrub: 3.4, flats: 0.9, burnt: 3.6, boa: 2.6, tussock: 3.4, gorge: 2.6 };
const plateau = (x: number, a: number, b: number, r: number) => smoothstep(a - r, a, x) * (1 - smoothstep(b, b + r, x));
/** level patches: the arena, the crossroads, the den mouth and the cache, the kill sites */
const FLATS: [number, number, number][] = [
  [TUA.arena[0] - 10, TUA.arena[1] + 10, 70],
  ...TUA.posts.map((p): [number, number, number] => [p - 34, p + 34, 40]),
  [TUA.den - 70, TUA.den + 70, 40], [TUA.cache - 34, TUA.cache + 34, 30],
  ...TUA.kills.map((k): [number, number, number] => [k - 26, k + 26, 30]),
  [TUA.ledge.climb - 16, TUA.ledge.climb + 16, 20],
];
const raw = (x: number) => {
  let r = 0;
  for (const b of BIOMES) { const w = bioW(x, b); if (w > 0.001) r += w * ROUGH[b]; }
  return TUA_B0 + SHAPE(x) + (fbm1(x / 96, 3, TUA.seed % 997) - 0.5) * 2 * r + (bioW(x, 'gorge') > 0 ? (noise1(x / 21, 77) - 0.5) * 2.4 * bioW(x, 'gorge') : 0);
};
const STEP = 2;
const BASE = new Float32Array(Math.ceil(TUA_W / STEP) + 2);
const DEPTH = new Float32Array(BASE.length);
{
  for (let i = 0; i < BASE.length; i++) {
    const x = i * STEP;
    let y = raw(x);
    for (const [a, b, r] of FLATS) {
      if (x < a - r || x > b + r) continue;
      const w = plateau(x, a, b, r);
      const lv = TUA_B0 + SHAPE((a + b) / 2);
      y = y * (1 - w) + lv * w;
    }
    BASE[i] = y;
    let d = 0;
    for (const s of TUA.streams) {
      const e = Math.abs(x - s.x);
      if (e > s.hw + 20) continue;
      d = Math.max(d, s.depth * (1 - smoothstep(s.hw * 0.55, s.hw + 18, e)));
    }
    DEPTH[i] = d;
  }
}
const lerpArr = (a: Float32Array, x: number) => {
  const f = clamp(x, 0, TUA_W) / STEP, i = Math.floor(f), t = f - i;
  return a[i] + (a[Math.min(a.length - 1, i + 1)] - a[i]) * t;
};
/** the water surface and the banks (the walk line without the stream beds) */
export const tuaBase = (x: number): number => lerpArr(BASE, x);
/** wading depth at the walk line (0 on dry ground) */
export const tuaDepth = (x: number): number => lerpArr(DEPTH, x);
/** the walk line: the ground Mori and the animals stand on (stream beds included) */
export function tuaGround(x: number): number { return lerpArr(BASE, x) + lerpArr(DEPTH, x); }

/** canopy cover overhead (only the gully closes over; a little kānuka shade in the scrub) */
export function tuaCanopy(x: number): number {
  const boa = bioW(x, 'boa');
  const gap = Math.abs(x - TUA.arena[0] - 200) < 260 ? 0.45 : 1;
  return clamp(boa * 0.72 * gap + bioW(x, 'scrub') * 0.06 + (noise1(x / 70, 41) - 0.5) * 0.12 * boa, 0, 0.85);
}
/** how exposed to the wind the walk line is (the ridge top windiest, the gully still) */
export function tuaWind(x: number): number {
  const top = 1 + 0.5 * plateau(x, TUA.crest[0] - 200, TUA.crest[1] + 200, 200);
  return bioW(x, 'scrub') * 0.85 + bioW(x, 'flats') * 1 + bioW(x, 'burnt') * 1.1 * top + bioW(x, 'boa') * 0.25 + bioW(x, 'tussock') * 1 + bioW(x, 'gorge') * 0.6;
}

// ---------------------------------------------------------------- where things are
/** the spots the creatures module (the Bearer, the feathered boa) builds on: world x on the walk line */
export const TUA_SPOT = {
  /** the Bearer's den mouth, under the rock overhang in the claw gorge */
  den: TUA.den,
  /** its food cache: a raked-over mound beside the den */
  cache: TUA.cache,
  /** a ~400 px level fern clearing in the boa ground (where the two can meet) */
  arena: TUA.arena as [number, number],
  /** kill sites with bone piles */
  kills: TUA.kills,
  /** the feathered boa's ground: the wet fern gully */
  boaGround: [TUA.S.boa.x0, TUA.S.boa.x1] as [number, number],
  /** the claw gorge */
  gorge: [TUA.S.gorge.x0, TUA.S.gorge.x1] as [number, number],
};
/** more anchors: the crossroads, the ledge over the den, the wallow, the creek, the crest */
export const TUA_MORE = {
  enter: 92, exit: 30,
  posts: TUA.posts,
  ledge: TUA.ledge,
  wallow: TUA.wallow,
  creek: TUA.creekX,
  crest: TUA.crest,
  skins: TUA.skins,
};

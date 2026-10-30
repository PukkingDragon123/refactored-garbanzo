// Banded sedimentary rock, the way a pixel artist builds a cliff: a column of real beds (thick buff
// sandstone with cross-bedding and honeycomb hollows, purple mudstone with rills, laminated shale,
// pale ash, rusty ironstone, pebbly conglomerate), dipping and gently folded. The hard beds stand out
// as ledges (a sky-lit lip on top, a dark band of shadow under them), the soft ones are recessed; the
// face is broken into jointed buttresses that each catch the light on their left edge; rust and dark
// varnish streak down from the ledges; fossils weather out of the mudstone; the skyline steps back
// bed by bed at the joints; talus cones heap at the foot. Used by the Bone Cliffs.

import { PixelBuffer } from './pixel';
import type { C } from './color';
import { hex, mix } from './color';
import { Rng, bayer, clamp, fbm1, fbm2, hash2, smoothstep } from '../core/math';

export type BedKind = 'sand' | 'grey' | 'mud' | 'ash' | 'iron' | 'cong' | 'shale';
const r = (...h: string[]): C[] => h.map(x => hex(x));
export const BEDS: Record<BedKind, C[]> = {
  sand: r('#2e211c', '#46322a', '#634636', '#7f5c44', '#9c7656', '#b8926a', '#d0ac82', '#e4c69e', '#f2dcb8'),
  grey: r('#1e2120', '#2e3330', '#434a44', '#59615a', '#707870', '#899084', '#a2a898', '#bcc0ae'),
  mud: r('#1e1519', '#2e2026', '#432e32', '#5a3e40', '#70504e', '#86645e', '#9c7a70'),
  ash: r('#4a4640', '#6a645a', '#8e877a', '#b0a898', '#ccc4b2', '#e2dcca', '#f2eee0'),
  iron: r('#2a0f08', '#45190c', '#642512', '#843418', '#a44820', '#c0602c', '#d87e3e'),
  cong: r('#24201e', '#38322e', '#504842', '#6a6058', '#847a6e', '#a09486', '#bcb0a0'),
  shale: r('#161418', '#221f24', '#302c32', '#403b42', '#524c52', '#655e64', '#7a7278'),
};
const HARD: Record<BedKind, boolean> = { sand: true, grey: true, mud: false, ash: true, iron: true, cong: true, shale: false };
const BONE = r('#5a4a38', '#8a7658', '#b8a27e', '#dccaa4', '#f0e4c8');

interface Bed { kind: BedKind; top: number; bot: number; seed: number; cross: boolean; tone: number; pack: number }

export interface StrataOpts {
  /** mean skyline row, and how far it wanders */
  top: number;
  amp?: number;
  /** dip (rows per column) and fold amplitude (rows) */
  dip?: number;
  fold?: number;
  /** bed thickness multiplier (smaller = finer beds, for distant walls) */
  scale?: number;
  /** step the skyline down to the base over this many columns at each end (0 = cut square) */
  taperL?: number;
  taperR?: number;
  /** talus cones heaped along the foot (their height in rows) */
  talus?: number;
  /** aerial perspective: mix toward the fog colour by k (stepped, dithered) */
  fog?: C;
  haze?: number;
  /** fossils weathering out of the soft beds (0..1) */
  fossils?: number;
  /** grass along the skyline */
  grass?: C[];
}

/** a stable 0..1 hash for integer pixel coords */
const hp = (x: number, y: number, s: number) => hash2(Math.floor(x), Math.floor(y), s);
const pick = (ramp: C[], v: number) => ramp[clamp(Math.round(v), 0, ramp.length - 1)];

/** Paint a banded cliff (top-left anchored, transparent above its skyline). */
export function paintStrataCliff(w: number, h: number, seed: number, o: StrataOpts): PixelBuffer {
  const rng = new Rng(seed * 101 + 7);
  const b = new PixelBuffer(w, h);
  const dip = o.dip ?? 0.03, fold = o.fold ?? 8, sc = o.scale ?? 1;
  const off = (x: number) => dip * x + Math.sin(x * 0.006 + seed) * fold + (fbm1(x * 0.01, 2, seed + 3) - 0.5) * fold * 0.6;
  // the column of beds, top to bottom, in "bed space" (yy = y - off(x)), covering every row
  let minOff = Infinity, maxOff = -Infinity;
  for (let x = 0; x < w; x += 4) { const v = off(x); minOff = Math.min(minOff, v); maxOff = Math.max(maxOff, v); }
  const y0 = -maxOff - 4, y1 = h - minOff + 4;
  const beds: Bed[] = [];
  let y = y0, last: BedKind = 'mud';
  while (y < y1) {
    const k = rng.next();
    let kind: BedKind = k < 0.26 ? 'sand' : k < 0.36 ? 'grey' : k < 0.6 ? 'mud' : k < 0.75 ? 'shale' : k < 0.83 ? 'cong' : k < 0.92 ? 'ash' : 'iron';
    if (kind === last && kind !== 'sand' && kind !== 'mud') kind = 'sand';
    const t = kind === 'sand' || kind === 'grey' ? rng.range(9, 24) : kind === 'mud' ? rng.range(6, 16) : kind === 'shale' ? rng.range(4, 10) : kind === 'cong' ? rng.range(6, 12) : rng.range(2, 4);
    const th = Math.max(2, Math.round(t * (kind === 'ash' || kind === 'iron' ? Math.max(0.7, sc) : sc)));
    // beds come in packages that break along their own joints
    const pack = beds.length === 0 || rng.chance(0.4) ? (beds.length ? beds[beds.length - 1].pack + 1 : 0) : beds[beds.length - 1].pack;
    beds.push({ kind, top: y, bot: y + th, seed: seed * 13 + beds.length * 7, cross: (kind === 'sand' || kind === 'grey') && rng.chance(0.55), tone: rng.range(-0.8, 0.8), pack });
    y += th;
    last = kind;
  }
  const lut = new Int16Array(Math.ceil(y1 - y0) + 2);
  for (let i = 0; i < beds.length; i++) for (let yy = Math.floor(beds[i].top - y0); yy < Math.ceil(beds[i].bot - y0) && yy < lut.length; yy++) if (yy >= 0) lut[yy] = i;
  const bedAt = (yy: number) => lut[clamp(Math.floor(yy - y0), 0, lut.length - 1)];

  // the big jointed buttresses (through-going joints): blocks along x, each a little proud or set back
  const joints: number[] = [0];
  for (let x = 0; x < w;) { x += Math.round(rng.range(80, 200) * Math.max(0.6, sc)); joints.push(Math.min(w, x)); }
  const blockOf = new Int16Array(w);
  for (let j = 0; j + 1 < joints.length; j++) for (let x = joints[j]; x < joints[j + 1]; x++) blockOf[x] = j;
  const proud = joints.map((_, j) => hp(j, 1, seed) - 0.5);
  // and each package of beds breaks along its own, staggered joints
  const nPack = beds[beds.length - 1].pack + 1;
  const pj = new Uint8Array(w * nPack);
  for (let p = 0; p < nPack; p++) {
    const pr = new Rng(seed * 7 + p * 31);
    if (pr.chance(0.45)) continue;
    for (let x = Math.round(pr.range(0, 60)); x < w; x += Math.round(pr.range(50, 150) * Math.max(0.6, sc))) { pj[p * w + x] = 1; if (x + 1 < w) pj[p * w + x + 1] = 2; }
  }

  // the skyline: it wanders, but each stretch tops out on a hard bed (the rim steps back bed by bed),
  // then every step's shoulder is eroded back into a crumbling slope; the ends step down to the base
  const raw = new Float32Array(w).fill(h);
  const amp = o.amp ?? 20;
  for (let x = 0; x < w; x++) {
    let target = o.top + (fbm1(x * 0.012, 3, seed + 5) - 0.5) * amp * 2.4;
    const tj = (hp(x >> 3, 14, seed) - 0.5) * 18;
    if (o.taperL) target += Math.pow(Math.max(0, 1 - (x + tj) / o.taperL), 0.7) * (h - o.top) * 1.08;
    if (o.taperR) target += Math.pow(Math.max(0, 1 - (w - x + tj) / o.taperR), 0.7) * (h - o.top) * 1.08;
    if (target >= h - 2) continue;
    let bi = bedAt(target - off(x));
    for (let k = 0; k < 3 && bi + 1 < beds.length && !HARD[beds[bi].kind]; k++) bi++;
    raw[x] = beds[bi].top + off(x);
  }
  // no slivers: a run of rock narrower than 5 columns falls down
  for (let x = 0; x < w;) {
    if (raw[x] >= h) { x++; continue; }
    let e = x;
    while (e < w && raw[e] < h) e++;
    if (e - x < 5) for (let k = x; k < e; k++) raw[k] = h;
    x = e;
  }
  const sky = new Float32Array(w);
  // crumbs: chips out of the rim
  for (let x = 0; x < w; x++) sky[x] = raw[x] + (hp(x >> 1, 3, seed) < 0.22 ? 1 : 0) + (hp(x, 13, seed) < 0.05 ? 2 : 0);
  // weathering at every exposed edge: the soft beds retreat under the hard ones, so each step of the
  // skyline (and each end) turns into a stair of jutting ledges over recessed slopes
  const solid = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) for (let y = Math.max(0, Math.floor(sky[x])); y < h; y++) solid[y * w + x] = 1;
  const carve = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid[y * w + x]) continue;
      const bed = beds[bedAt(y - off(x))];
      const d = (HARD[bed.kind] ? Math.floor(hp(x >> 5, 0, bed.seed + 7) * 5) : 3 + Math.floor(hp(x >> 5, 0, bed.seed + 6) * 7)) + (hp(x, y >> 1, bed.seed) < 0.3 ? 1 : 0);
      if (!d) continue;
      for (let k = 1; k <= d; k++) {
        if ((x - k >= 0 && !solid[y * w + x - k] && sky[x - k] < h) || (x + k < w && !solid[y * w + x + k] && sky[x + k] < h)) { carve[y * w + x] = 1; break; }
        if ((x - k >= 0 && !solid[y * w + x - k]) || (x + k < w && !solid[y * w + x + k])) { carve[y * w + x] = 1; break; }
      }
    }
  }

  // talus cones at the foot, under the joints (where the blocks come down)
  const tal = new Float32Array(w);
  if (o.talus) for (let xc = hp(0, 4, seed) * 50; xc < w + 40; xc += 60 + hp(xc, 4, seed) * 90) {
    const ht = o.talus * (0.3 + hp(xc, 5, seed) * 0.8), sl = 0.4 + hp(xc, 6, seed) * 0.45;
    for (let x = Math.max(0, Math.floor(xc - ht / sl)); x < Math.min(w, xc + ht / sl); x++) tal[x] = Math.max(tal[x], ht - Math.abs(x - xc) * sl + (fbm1(x * 0.15, 2, seed + 18) - 0.5) * 8 + (hp(x >> 1, 19, seed) < 0.2 ? 2 : 0));
  }

  const fog = o.fog, haze = o.haze ?? 0;
  for (let x = 0; x < w; x++) {
    const ox = off(x), blk = blockOf[x], ja = joints[blk], jb = joints[blk + 1] ?? w;
    const ex = x - ja, ex2 = jb - 1 - x;
    for (let y = Math.max(0, Math.floor(sky[x])); y < h; y++) {
      const yy = y - ox, bi = bedAt(yy), bed = beds[bi], R = BEDS[bed.kind], N = R.length - 1;
      const inBed = yy - bed.top, fromBot = bed.bot - yy;
      let l = N * 0.5 + proud[blk] * 1.2 + bed.tone;
      // the package's own joints: a dark crack (jittered row by row) with a lit lip on its left
      const jx = clamp(x + (hp(x >> 3, y >> 1, bed.seed + 8) < 0.2 ? 1 : 0), 0, w - 1), jv = pj[bed.pack * w + jx];
      if (HARD[bed.kind] && hp(x, bed.pack, bed.seed + 9) < 0.85) { if (jv === 1) l -= 2.6; else if (jv === 2) l += 0.9; }
      if (carve[y * w + x]) continue;
      // a ledge's exposed end catches the light on the left, falls into shade on the right
      if (x > 0 && carve[y * w + x - 1]) l += 1.4;
      else if (x + 1 < w && carve[y * w + x + 1]) l -= 1.2;
      // the buttress: its left edge catches the light, its right edge turns into shade, the joint is a dark crack
      const jit = hp(y >> 2, blk, seed + 14) < 0.3 ? 1 : 0;
      if (HARD[bed.kind] && hp(blk, bi, seed + 17) < 0.6) { if (ex < 2 + jit) l += 1.2; else if (ex < 4) l += 0.5; }
      const showJ = HARD[bed.kind] && hp(blk, bi, seed + 17) < 0.6;
      if (showJ && ex2 < 1 - jit) l -= 3; else if (ex2 < 4) l -= 0.8;
      // hard beds stand out: a sky-lit lip on top; the soft beds are recessed, in the hard bed's shadow
      if (HARD[bed.kind]) {
        if (inBed < 1.2) l += 2.2; else if (inBed < 2.5) l += 1;
        if (fromBot < 1.2) l -= 1;
      } else {
        l -= 0.8;
        const above = bi > 0 ? beds[bi - 1] : null;
        if (above && HARD[above.kind] && inBed < 3.5) l -= inBed < 1.5 ? 2.4 : 1.4;
        // rills washed down the soft beds
        if (fbm2(x * 0.22, yy * 0.03, 2, bed.seed) > 0.62) l -= 1;
        // laminae
        if (bed.kind === 'shale' && Math.floor(yy) % 2 === 0) l -= 0.7;
        if (bed.kind === 'mud' && Math.floor(yy) % 4 === 0 && hp(x >> 3, yy, bed.seed) < 0.7) l -= 0.6;
      }
      // cross-bedding: faint slanting sets inside the sandstone
      if (bed.cross && inBed > 2.5 && fromBot > 1.5) {
        const set = Math.floor((x + inBed * 3) / 34);
        const v = ((x * 0.5 + inBed * (hp(set, 2, bed.seed) < 0.5 ? 1.4 : -1.4)) % 5 + 5) % 5;
        if (v < 0.8) l -= 0.8;
      }
      // the face's grain and big weathering patches
      l += (fbm2(x * 0.06, y * 0.06, 3, seed + 9) - 0.5) * 1.2 + (bayer(x, y) - 0.5) * 0.8;
      let c = pick(R, l);
      // honeycomb hollows (tafoni) in the sandstone: a dark pocket under a lit upper rim
      if ((bed.kind === 'sand' || bed.kind === 'grey') && inBed > 3 && fromBot > 3) {
        const cx = Math.floor(x / 7), cy = Math.floor(yy / 5);
        const hh = hp(cx, cy, bed.seed + 1);
        if (hh < 0.2 && fbm2(x * 0.03, yy * 0.06, 2, bed.seed + 4) > 0.58) {
          const px = cx * 7 + 3.5 + (hp(cx, cy, bed.seed + 2) - 0.5) * 2, py = cy * 5 + 2.5;
          const d = ((x - px) / 2.6) ** 2 + ((yy - py) / 1.8) ** 2;
          if (d < 1) c = pick(R, 1 + (yy < py - 0.8 ? 0 : 0.5) + (x < px ? 0 : 0.6));
          else if (d < 1.7 && yy > py) c = pick(R, l + 1.4);
        }
      }
      // pebbles in the conglomerate
      if (bed.kind === 'cong' && inBed > 1) {
        const cx = Math.floor(x / 4), cy = Math.floor(yy / 3);
        const hh = hp(cx, cy, bed.seed + 3);
        if (hh < 0.55) {
          const px = cx * 4 + 2, py = cy * 3 + 1.5, rr = 1.2 + hh * 1.6;
          const d = ((x - px) ** 2 + (yy - py) ** 2) / (rr * rr);
          if (d < 1) c = pick(hh < 0.2 ? BEDS.ash : hh < 0.35 ? BEDS.iron : BEDS.cong, 3 + (x < px ? 1 : 0) + (yy < py ? 1 : -1) + (bayer(x, y) - 0.5) * 0.6);
        }
      }
      // rust bleeding down out of the ironstone, dark varnish streaking down off the ledges
      const stain = fbm2(x * 0.18, 0.5, 2, seed + 11);
      if (!HARD[bed.kind] && bi > 0 && stain > 0.6) {
        const above = beds[bi - 1];
        const len = (stain - 0.6) * 60;
        if (inBed < len) {
          const k = Math.round((1 - inBed / len) * 3) / 3;
          if (above.kind === 'iron') c = mix(c, BEDS.iron[3], 0.45 * k);
          else if (HARD[above.kind] && hp(x, 6, seed) < 0.8) c = mix(c, hex('#1a1216'), 0.4 * k);
        }
      }
      // fossils weathering out of the soft beds: bone sticks and little coiled shells
      if (o.fossils && !HARD[bed.kind] && inBed > 1 && fromBot > 1) {
        const cx = Math.floor(x / 11), cy = Math.floor(yy / 7);
        const hh = hp(cx, cy, bed.seed + 5);
        if (hh < o.fossils * 0.12) {
          const px = cx * 11 + 5, py = cy * 7 + 3, dx = x - px, dy = Math.floor(yy) - py;
          if (hh < o.fossils * 0.05) {
            // a coiled shell (5x5)
            const ring = Math.abs(Math.hypot(dx, dy) - 1.8) < 0.7 || (dx === 0 && dy === 0);
            if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2 && ring) c = pick(BONE, 2 + (dx < 0 ? 1 : 0) - (dy > 0 ? 1 : 0));
          } else if (dy === 0 && Math.abs(dx) <= 3) c = pick(BONE, 2.5 + (dx < 0 ? 1 : 0) + (Math.abs(dx) === 3 ? 0.6 : 0));
          else if (dy === 1 && Math.abs(dx) <= 3) c = pick(R, 0.5);
        }
      }
      // the talus: angular blocks heaped at the foot, each lit along its top edge
      if (tal[x] > 0 && y > h - tal[x]) {
        const d = y - (h - tal[x]);
        const by = Math.floor(y / 3), bw = 3 + Math.floor(hp(by, 1, seed + 12) * 3), bx = Math.floor((x + by * 2) / bw);
        const hh = hp(bx, by, seed + 13), uu = ((x + by * 2) % bw) / bw, vv = (y % 3) / 3;
        const ramp = hh < 0.5 ? BEDS.sand : hh < 0.78 ? BEDS.mud : hh < 0.93 ? BEDS.grey : BEDS.cong;
        c = pick(ramp, 1.2 + hh * 2 + (vv < 0.34 ? 1.3 : 0) - (uu > 0.7 ? 1.2 : 0) + (d < 1.5 ? 1 : 0) - smoothstep(h - 6, h, y) + (bayer(x, y) - 0.5) * 0.6);
        // a few big fallen blocks lie on the heap
        if (hp(x >> 3, y >> 2, seed + 20) < 0.07) c = pick(BEDS.sand, 3 + (vv < 0.34 ? 2 : 0) - (uu > 0.8 ? 1.5 : 0));
      }
      // grass on the rim
      if (o.grass && y - sky[x] < 2 && hp(x, 9, seed) < 0.6) c = pick(o.grass, o.grass.length - 2 - (y - sky[x]));
      if (fog && haze > 0) {
        const hz = Math.round((haze + (bayer(x, y) - 0.5) * 0.18) * 6) / 6;
        if (hz > 0) c = mix(c, fog, clamp(hz, 0, 1));
      }
      b.data[y * w + x] = c;
    }
    // grass blades standing up off the rim
    if (o.grass && sky[x] < h && hp(x, 10, seed) < 0.35) {
      const bh = 1 + Math.floor(hp(x, 11, seed) * 4), sy = Math.floor(sky[x]);
      for (let k = 1; k <= bh; k++) b.set(x + (k > 2 ? 1 : 0), sy - k, pick(o.grass, o.grass.length - 1 - k * 0.6));
    }
  }
  // plants on the ledges: tufts on the hard beds' exposed tops
  if (o.grass) {
    for (let y = 2; y < h; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!(b.data[i] >>> 24) || (b.data[i - w] >>> 24) || hp(x, y, seed + 15) > 0.3) continue;
      const bed = beds[bedAt(y - off(x))];
      if (!HARD[bed.kind]) continue;
      const bh = 1 + Math.floor(hp(x, y, seed + 16) * 3);
      for (let k = 1; k <= bh; k++) b.set(x + (k > 1 && hp(x, k, seed) < 0.5 ? 1 : 0), y - k, pick(o.grass, o.grass.length - 1 - k * 0.7));
    }
  }
  b.outline(hex('#140e0c'));
  return b;
}

/**
 * A hard sandstone bed standing out of the cliff as a ledge you can walk along: a sky-lit top
 * surface, a cross-bedded face, a ragged underside with blocks about to drop, roots and drips
 * hanging off it, and a band of dithered shadow on the rock below (anchor: top-left of the walking
 * surface at row 1).
 */
export function paintLedgeBed(w: number, th: number, seed: number): PixelBuffer {
  const R = BEDS.sand, S = th + 9;
  const b = new PixelBuffer(w, S);
  const shade = hex('#120c0e');
  for (let x = 0; x < w; x++) {
    const endK = Math.min(1, Math.min(x, w - 1 - x) / 10);
    const bot = Math.round(th - 3 + (fbm1(x * 0.09, 2, seed) - 0.4) * 7 * endK + (hp(x >> 2, 1, seed) < 0.2 ? 2 : 0));
    const top = endK < 1 && hp(x, 2, seed) < 0.5 ? 1 : 0;
    for (let y = top; y < bot; y++) {
      let l: number;
      if (y < 2) l = 7 - y * 0.6;
      else if (y < 4) l = 5.2;
      else l = 4.4 - (y - 4) * 0.25 + (fbm2(x * 0.1, y * 0.2, 2, seed + 1) - 0.5) * 1.6;
      // cross-bedding and the odd joint
      if (y > 4 && ((x * 0.5 + y * 1.4) % 6 + 6) % 6 < 0.8) l -= 0.8;
      if (y > 2 && hp(x >> 0, 3, seed) < 0.04) l -= 2.6;
      if (y === bot - 1) l -= 1.4;
      // stones and grit on the walking surface
      if (y === 0 && hp(x, 4, seed) < 0.12) l = 8;
      b.set(x, y, pick(R, l + (bayer(x, y) - 0.5) * 0.8));
    }
    // roots and drips hanging from the underside
    if (endK > 0.5 && hp(x, 5, seed) < 0.06) {
      const len = 2 + Math.floor(hp(x, 6, seed) * 6);
      for (let k = 0; k < len; k++) b.set(x, bot + k, k % 3 === 2 ? hex('#3e3020') : hex('#5a4630'));
    }
  }
  b.outline(shade);
  // the shadow it throws on the rock below: dithered, fading out in steps
  for (let x = 0; x < w; x++) {
    let bot = S;
    for (let y = S - 1; y >= 0; y--) if (b.data[y * w + x] >>> 24) { bot = y + 1; break; }
    for (let k = 0; k < 7; k++) {
      const yy = bot + k;
      if (yy >= S) break;
      if (bayer(x, yy) < 0.7 - k * 0.1) b.set(x, yy, ((shade & 0x00ffffff) | (150 << 24)) >>> 0);
    }
  }
  return b;
}

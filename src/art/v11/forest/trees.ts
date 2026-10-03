// V11 Te Wao Nui, the giants: colossal trunks that rise straight out of the frame (kauri with grey
// hammered-flake bark, rimu with peeling red-brown strips, kahikatea on great buttresses, gnarled
// rātā), their root flare and buttress roots sprawling over the forest floor, moss and lichen, perching
// lilies and nest ferns in the folds, a supplejack vine spiralling up and old-man's-beard hanging off
// them. Lit from the upper left; the top fades into canopy shade so it meets the ceiling cleanly.

import { PixelBuffer } from '../../pixel';
import type { C } from '../../color';
import { mix, shade } from '../../color';
import { Rng, clamp, hash2, noise1, noise2, smoothstep } from '../../../core/math';
import type { Sprite } from '../../jungle-core';
import { JP, tube, vine, mossBlob, outlineSel, leafStamp, stampW } from '../../jungle-core';
import type { P } from '../../jungle-core';
import { astelia, nestFern, beard } from '../../jungle-trees';
import { FP, pick } from './kit';

export type GiantKind = 'kauri' | 'rimu' | 'kahikatea' | 'rata';

export interface GiantOpts {
  epiphytes?: number;
  vines?: number;
  moss?: number;
  /** extra rows under the anchor (root flare sunk into the ground) */
  sink?: number;
  /** how far the top fades into canopy shade (rows) */
  fadeTop?: number;
}

const RAMP: Record<GiantKind, C[]> = { kauri: FP.kauri, rimu: FP.podo, kahikatea: FP.kauri, rata: FP.rata };

/** voronoi-ish bark flakes: CEL.e = distance to the cell edge (0 at the seam), CEL.id */
const CEL = { e: 0, id: 0 };
function flakes(u: number, v: number, su: number, sv: number, seed: number) {
  const gx = Math.floor(u / su), gy = Math.floor(v / sv);
  let d1 = 9, d2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = gx + i, cy = gy + j;
    const px = (cx + 0.15 + hash2(cx, cy, seed) * 0.7) * su, py = (cy + 0.15 + hash2(cx, cy, seed + 1) * 0.7) * sv;
    const dx = (u - px) / su, dy = (v - py) / sv;
    const d = dx * dx + dy * dy;
    if (d < d1) { d2 = d1; d1 = d; id = hash2(cx, cy, seed + 2); } else if (d < d2) d2 = d;
  }
  CEL.e = Math.sqrt(d2) - Math.sqrt(d1);
  CEL.id = id;
}

export function paintGiant(kind: GiantKind, seed: number, w: number, H: number, o: GiantOpts = {}): Sprite {
  const rng = new Rng(seed * 131 + 7);
  const sink = o.sink ?? 6;
  const flareK = kind === 'kahikatea' ? 0.75 : kind === 'rata' ? 0.55 : kind === 'rimu' ? 0.32 : 0.4;
  const BW = Math.ceil(w * (2.2 + flareK * 0.9) + 60), BH = Math.ceil(H + sink);
  const buf = new PixelBuffer(BW, BH);
  const cx0 = BW / 2, gy = H;
  const rp = RAMP[kind], n = rp.length - 1;
  const lean = rng.range(-0.012, 0.012);
  const cxAt = (y: number) => cx0 + lean * (gy - y) + (noise1(y * 0.006, seed) - 0.5) * w * 0.12;
  const hwAt = (y: number) => {
    const up = gy - y;
    return (w / 2) * (1 + Math.exp(-up / (w * 0.3)) * flareK + Math.exp(-up / (w * 1.4)) * flareK * 0.25) * (1 - (up / Math.max(1, H)) * 0.05) + (noise1(y * 0.05, seed + 3) - 0.5) * 2;
  };
  const moss = o.moss ?? 1;
  const fadeTop = o.fadeTop ?? 70;
  const shadeC = FP.canopy[1];
  // ---- the trunk
  for (let y = 0; y < Math.min(BH, gy + 3); y++) {
    const cx = cxAt(y), hw = hwAt(y), up = gy - y;
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
      const nx = (x + 0.5 - cx) / hw;
      if (nx < -1 || nx > 1) continue;
      const u = Math.asin(nx) * hw;
      // cylinder light from the upper left, a cool bounce along the far edge
      let l = -nx * 1.0 + Math.sqrt(Math.max(0, 1 - nx * nx)) * 0.32 - 0.12;
      if (nx > 0.88) l += 0.32;
      let c: C;
      if (kind === 'kauri' || kind === 'kahikatea') {
        flakes(u, y, kind === 'kauri' ? 9 : 6, kind === 'kauri' ? 13 : 8, seed + 11);
        l += (CEL.id - 0.5) * 0.45 + (CEL.e < 0.07 ? -0.75 : CEL.e < 0.14 ? -0.2 : 0.08);
        c = pick(rp, n * 0.42 + l * n * 0.22);
        // pale lichen blotches
        const lc = noise2(u / 7 + 30, y / 9, seed + 13);
        if (lc > 0.76 && l > -0.5) c = mix(c, pick(FP.lichen, (lc - 0.76) * 10 + l), 0.42);
      } else if (kind === 'rimu') {
        // long peeling strips, red-brown, darker in the grooves
        const s = Math.sin(u * 0.55 + noise1(y * 0.018, seed + 17) * 4);
        const strip = noise2(u / 5, y / 26, seed + 19);
        l += s > 0.75 ? -0.8 : s < -0.6 ? 0.18 : 0;
        l += (strip - 0.5) * 0.5;
        // flaking: a lighter fresh patch where a strip has come away
        if (noise2(u / 6, y / 14, seed + 21) > 0.74) l += 0.35;
        c = pick(rp, n * 0.48 + l * n * 0.24);
      } else {
        // rātā: fused stems twisting up the host, deep folds between them
        const s = Math.sin(u * 0.32 + y * 0.035 + noise1(y * 0.02, seed + 23) * 3);
        l += s > 0.55 ? -0.9 : s < -0.5 ? 0.25 : 0;
        l += (noise2(u / 4, y / 6, seed + 25) - 0.5) * 0.4;
        c = pick(rp, n * 0.5 + l * n * 0.22);
      }
      // moss: up from the root flare, in streaks down from the folds, on the wet side
      if (moss > 0) {
        const m = noise2(u / 12, y / 22, seed + 31) * 0.7 + noise2(u / 4, y / 6, seed + 33) * 0.2 + Math.max(0, 1 - up / (w * 1.4)) * 0.45 + (nx > 0.2 ? 0.06 : 0);
        if (m > 1.02 - moss * 0.32) c = pick(FP.moss, 3 + l * 2.6 + (m - 1) * 8 + (bayer2(x, y) - 0.5) * 0.8);
      }
      // ambient occlusion at the ground, canopy shade at the top
      if (up < 10) c = shade(c, -(1 - up / 10) * 0.25);
      if (y < fadeTop) c = mix(c, shadeC, (1 - y / fadeTop) * 0.85);
      buf.data[y * BW + x] = c;
    }
  }
  // ---- buttress roots sprawling over the floor
  const roots = kind === 'kahikatea' ? 6 : kind === 'rimu' ? 3 : 4;
  for (let i = 0; i < roots; i++) {
    const side = i % 2 ? 1 : -1;
    const len = w * rng.range(0.8, 1.4) * (kind === 'kahikatea' ? 1.3 : 1);
    const y0 = gy - w * rng.range(0.55, 0.95) * (kind === 'kahikatea' ? 1.3 : 1);
    const x0 = cx0 + side * w * rng.range(0.2, 0.4);
    const pts: P[] = [[x0, y0], [x0 + side * len * 0.35, gy - w * 0.22], [x0 + side * len * 0.75, gy - 3], [x0 + side * len, gy + 2]];
    tube(buf, pts, t => w * (0.24 - t * 0.17) + 2, rp, n * 0.55, { spread: 3.2, texture: (x, y) => (noise2(x / 5, y / 3, seed + 41 + i) - 0.5) * 0.6 });
    // moss carpets the top of each root
    for (let t = 0.2; t < 1; t += 0.12) {
      const q = pts[Math.min(pts.length - 1, Math.floor(t * (pts.length - 1)))];
      if (rng.chance(0.7 * moss)) mossBlob(buf, rng, q[0] + rng.range(-4, 4), q[1] - w * 0.08, rng.range(4, 9), rng.range(2, 4), JP.moss, rng.int(4, 6));
    }
  }
  // moss cushions and fallen bark at the foot
  for (let i = 0; i < 9; i++) mossBlob(buf, rng, cx0 + rng.range(-w * 0.9, w * 0.9), gy - rng.range(0, 10), rng.range(5, 11), rng.range(2, 4.5), JP.moss, rng.int(4, 6), true);
  // ---- a supplejack vine spiralling up the trunk
  const vines = o.vines ?? 1;
  for (let v = 0; v < Math.round(vines * rng.range(0.6, 1.8)); v++) {
    const ph = rng.range(0, 6.28), turns = rng.range(1.5, 3.5);
    const y0 = gy - rng.range(0, 30), y1 = rng.range(0, gy * 0.4);
    // only the stretches on the near side of the trunk show
    const segs: P[][] = [[]];
    for (let k = 0; k <= 80; k++) {
      const t = k / 80, y = y0 + (y1 - y0) * t;
      const a = ph + t * turns * 6.28;
      if (Math.cos(a) < -0.15) { if (segs[segs.length - 1].length) segs.push([]); continue; }
      const px = cxAt(y) + Math.sin(a) * hwAt(y) * 0.98;
      segs[segs.length - 1].push([px, y]);
      if (k % 4 === 0 && rng.chance(0.6)) stampW(buf, leafStamp('heart', rng.range(4, 7), 3, Math.PI / 2 + rng.range(-1, 1)), px, y + 1, JP.kawakawa, rng.int(3, 6), undefined, 10);
    }
    for (const s of segs) if (s.length > 1) tube(buf, s, () => 1.3, JP.bark, 4, { rim: false });
  }
  // ---- epiphytes: perching lilies and nest ferns in the folds, beards of lichen
  const ep = o.epiphytes ?? 1;
  for (let i = 0; i < Math.round(ep * rng.range(2, 5)); i++) {
    const y = rng.range(gy * 0.08, gy - w * 0.9);
    const side = rng.sign();
    const x = cxAt(y) + side * hwAt(y) * rng.range(0.55, 0.92);
    // a little shelf of humus they sit on
    mossBlob(buf, rng, x, y + 2, rng.range(4, 8), 2.5, JP.moss, 4, true);
    if (rng.chance(0.55)) astelia(buf, rng, x, y, rng.range(14, 26));
    else nestFern(buf, rng, x, y, rng.range(12, 20));
    if (rng.chance(0.5)) beard(buf, rng, x - 4, y + 3, rng.range(5, 9), rng.range(10, 28));
  }
  for (let i = 0; i < Math.round(ep * 2); i++) {
    const y = rng.range(gy * 0.05, gy * 0.6);
    vine(buf, rng, cxAt(y) + rng.range(-hwAt(y) * 0.8, hwAt(y) * 0.8), y, rng.range(30, 110), JP.fern, rng.int(3, 5), { leafEvery: 4, leafLen: 4 });
  }
  outlineSel(buf, 0.5);
  return { buf, ax: Math.round(cx0), ay: gy + 1 };
}

const bayer2 = (x: number, y: number) => ((x & 1) * 2 + (y & 1) * 3) % 4 / 4;
void clamp; void smoothstep;

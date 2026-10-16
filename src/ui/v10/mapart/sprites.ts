// Region Map sprite painting: everything that stands on the ground (trees, palms, ferns, rocks, huts,
// the wreck) is painted straight into the screen buffer at its lifted position, back to front, with a
// depth test against the terrain (a ridge in front hides what stands behind it). Each painted pixel
// records how high above the ground it stands; once everything is in, shadows are cast from that
// height field toward the lower right (the sun is in the north-west), so crowns shade the crowns and
// the ground beside them and palms throw star-shaped shadows on the sand.

import { C, hex, mix } from '../../../art/color';
import { bayer, clamp, hash2 } from '../../../core/math';
import { W, H, N, Scr, TAG, shadowed, slice } from './kit';

/** the sprite layer: height above ground (px) and an owner id per pixel */
export class Layer {
  readonly zb = new Uint8Array(N);
  readonly sid = new Uint8Array(N);
  id = 0;
  /** ground row of the sprite being painted */
  gy = 0;
  constructor(readonly scr: Scr) {}
  begin(gy: number) { this.gy = gy; this.id = (this.id % 250) + 1; }
  /** paint a pixel of the current sprite: z = height above the ground it stands on */
  px(x: number, y: number, c: C, z = 0, tag = 0, edge = 0) {
    x = x | 0; y = y | 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const s = this.scr, j = y * W + x;
    if (s.gy[j] > this.gy + 3) return;
    s.col[j] = c; s.tag[j] = tag; s.edge[j] = edge; s.kind[j] = 3; s.wat[j] = 0; s.gy[j] = this.gy; s.shd[j] = 0;
    this.zb[j] = Math.max(0, Math.min(255, Math.round(z))); this.sid[j] = this.id;
  }
  /** is this pixel free for the current sprite (not hidden by terrain in front) */
  free(x: number, y: number) { x = x | 0; y = y | 0; return x >= 0 && y >= 0 && x < W && y < H && this.scr.gy[y * W + x] <= this.gy + 3; }
  /** darken what is already there (a sprite's contact shadow on the ground) */
  dim(x: number, y: number, k = 0.7) {
    x = x | 0; y = y | 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const j = y * W + x, s = this.scr;
    if (s.gy[j] > this.gy + 3 || s.shd[j]) return;
    s.shd[j] = 1; s.col[j] = shadowed(s.col[j], k);
  }
}

/** shadows from the sprite layer onto everything lower beside it (toward the lower right) */
export async function castShadows(l: Layer) {
  const s = l.scr, zb = l.zb, sid = l.sid;
  const mark = new Uint8Array(N);
  // (rows of the height field, scanned once; each pixel looks up-left for something taller)
  for (let y = 2; y < H; y++) {
    if ((y & 63) === 0) await slice();
    for (let x = 2; x < W; x++) {
      const j = y * W + x;
      const zp = zb[j], me = sid[j];
      for (let k = 1; k <= 16; k++) {
        const qx = x - k, qy = y - ((k * 13) >> 4);
        if (qx < 0 || qy < 0) break;
        const q = qy * W + qx;
        const zq = zb[q];
        if (!zq || (me && sid[q] === me)) continue;
        if (zq > zp + k * 1.05 + 1) { mark[j] = 1; break; }
      }
    }
  }
  for (let j = 0; j < N; j++) if (mark[j] && !s.shd[j]) s.col[j] = shadowed(s.col[j], s.kind[j] === 3 ? 0.74 : 0.68);
}

// ------------------------------------------------------------------ shading helpers
/** ramp index from a 0..1 light with a dithered seam */
export function shadeIdx(n: number, v: number, x: number, y: number): number {
  const f = clamp(v) * (n - 1);
  const i = Math.floor(f);
  return Math.min(n - 1, i + ((f - i) * 2.2 - 0.6 > bayer(x, y) ? 1 : 0));
}

// light direction in sprite space (upper left, toward the viewer a little)
const SLX = -0.62, SLY = -0.58, SLZ = 0.53;

export interface CrownOpts {
  /** vertical squash of the crown (3/4 view) */
  squash?: number;
  /** number of leaf clumps */
  clumps?: number;
  /** flowers on the sunny clumps */
  bloom?: C[];
  bloomK?: number;
  /** glowing specks */
  glow?: number;
  /** drooping streaks (podocarps) */
  weep?: boolean;
  /** dark outline on the shadow side */
  rim?: boolean;
  /** extra light (sunny edge of a stand, a lone tree) */
  lift?: number;
  /** top clumps flattened (kauri) */
  flat?: boolean;
  /** clumps spread wider than the crown's radius (spreading trees) */
  spread?: number;
}

interface Clump { x: number; y: number; r: number; z: number }
let BI = new Int8Array(4096), BZ = new Float32Array(4096), BS = new Float32Array(4096);
const CL: Clump[] = [];

/** a leafy crown: a dome of overlapping clumps, each lit from the north-west, creases between them,
 *  leaf speckle, a dark rim on the shadow side; z0 = height of the crown's base above the ground */
export function crown(l: Layer, cx: number, cy: number, r: number, pal: C[], light: number, seed: number, z0: number, o: CrownOpts = {}) {
  const squash = o.squash ?? 0.82, spread = o.spread ?? 1;
  const n = pal.length;
  const nc = o.clumps ?? Math.max(1, Math.min(9, Math.round(r * 0.9)));
  CL.length = 0;
  const h0 = hash2(seed, 1, 301);
  CL.push({ x: (hash2(seed, 2, 301) - 0.5) * r * 0.2, y: -r * 0.12 * squash, r: r * (o.flat ? 0.55 : 0.64), z: r * 0.55 });
  for (let k = 1; k < nc; k++) {
    const a = h0 * 6.28 + (k / (nc - 1)) * 6.28 + (hash2(seed, k, 302) - 0.5) * 0.9;
    const d = r * (0.42 + hash2(seed, k, 303) * 0.2) * spread;
    const rr = r * (o.flat ? 0.4 : 0.42 + hash2(seed, k, 304) * 0.16);
    CL.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * squash, r: rr, z: r * (o.flat ? 0.5 : 0.25) + Math.max(0, -Math.sin(a)) * r * 0.12 });
  }
  const ext = 1.25 * spread;
  const x0 = Math.floor(cx - r * ext), x1 = Math.ceil(cx + r * ext), y0 = Math.floor(cy - r * 1.2), y1 = Math.ceil(cy + r * 1.1 * spread);
  const bw = x1 - x0 + 3, bh = y1 - y0 + 3;
  if (BI.length < bw * bh) { BI = new Int8Array(bw * bh * 2); BZ = new Float32Array(bw * bh * 2); BS = new Float32Array(bw * bh * 2); }
  // pass 1: which clump is on top at each pixel (and how close the next one is: the creases)
  for (let ly = 0; ly < bh; ly++) for (let lx = 0; lx < bw; lx++) {
    const x = x0 - 1 + lx, y = y0 - 1 + ly, li = ly * bw + lx;
    let best = -1e9, second = -1e9, bi = -1;
    const px = x + 0.5 - cx, py = y + 0.5 - cy;
    for (let k = 0; k < CL.length; k++) {
      const c = CL[k];
      const dx = (px - c.x) / c.r, dy = (py - c.y) / (c.r * squash);
      const d2 = dx * dx + dy * dy;
      if (d2 > 1 + (hash2(x * 7 + k, y * 5, seed) - 0.5) * 0.28) continue;
      const hz = Math.sqrt(Math.max(0, 1 - d2)) * c.r + c.z;
      if (hz > best) { second = best; best = hz; bi = k; } else if (hz > second) second = hz;
    }
    BI[li] = bi; BZ[li] = best; BS[li] = second;
  }
  const lightK = (light - 0.5) * 0.55 + (o.lift ?? 0);
  // pass 2: shade
  for (let ly = 1; ly < bh - 1; ly++) for (let lx = 1; lx < bw - 1; lx++) {
    const li = ly * bw + lx, bi = BI[li];
    if (bi < 0) continue;
    const x = x0 - 1 + lx, y = y0 - 1 + ly;
    if (!l.free(x, y)) continue;
    const best = BZ[li], second = BS[li];
    const c = CL[bi];
    const px = x + 0.5 - cx, py = y + 0.5 - cy;
    const nx = (px - c.x) / c.r, ny = (py - c.y) / (c.r * squash);
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    // the clump's own light, the whole crown's (darker toward its lower right), the ground's
    const gx = px / r, gyy = py / (r * squash);
    let v = 0.36 + (nx * SLX + ny * SLY + nz * SLZ) * 0.6 - (gx + gyy) * 0.14 + lightK;
    if (second > best - 0.9) v -= 0.24;
    const hh = hash2(x, y, seed + 7);
    if (hh > 0.9) v += 0.1; else if (hh < 0.12) v -= 0.14;
    if (o.weep && ((x + Math.floor(y / 3)) % 3 === 0)) v -= 0.12;
    let idx = shadeIdx(n, v, x, y);
    const outR = BI[li + 1] < 0 || BI[li + bw] < 0 || BI[li + bw + 1] < 0;
    if (o.rim !== false && outR && gx + gyy > -0.2) idx = Math.min(idx, 1);
    let col = pal[idx];
    let tag: number = TAG.crown;
    if (idx >= n - 2 && nx < -0.1 && ny < -0.1) tag = TAG.gust;
    if (o.bloom && idx >= n - 4 && hash2(x >> 1, y >> 1, seed + 9) < (o.bloomK ?? 0.4)) { col = o.bloom[clamp(idx - (n - o.bloom.length), 0, o.bloom.length - 1)]; tag = TAG.crown; }
    if (o.glow && hash2(x, y, seed + 11) < o.glow) { col = hash2(x, y, seed + 12) < 0.5 ? hex('#7affe6') : hex('#3fd8c8'); tag = TAG.glow; }
    l.px(x, y, col, z0 + best, tag, BI[li - bw] < 0 ? 1 : 0);
  }
}

/** a trunk from the ground up (w px wide), lit on the left */
export function trunk(l: Layer, x: number, y: number, h: number, pal: C[], w = 1, lean = 0) {
  for (let k = 0; k < h; k++) {
    const xx = Math.round(x + lean * k);
    for (let i = 0; i < w; i++) {
      const c = pal[Math.max(0, Math.min(pal.length - 1, w === 1 ? 2 : i === 0 ? 3 : i === w - 1 ? 1 : 2))];
      l.px(xx + i - Math.floor(w / 2), y - k, k === 0 ? pal[0] : c, k);
    }
  }
}

/** a dithered blend helper for flowers and specks */
export const speck = (a: C, b: C, x: number, y: number, k: number) => (bayer(x, y) < k ? b : a);
export { mix };

// Big trees for the V2 jungle: kauri, rātā, tree ferns, nīkau, coconut palms, strangler figs and
// broadleaf canopy trees, plus free-standing canopy clumps. See jungle.ts for the public API docs.

import { PixelBuffer } from './pixel';
import { C } from './color';
import { Rng, clamp, hash2, fbm2, noise2, TAU } from '../core/math';
import {
  Sprite, JP, Ramp, P, rc, crown, Clump, leafMass, frond, blade, tube, vine, mossBlob, leafStamp, drawStamp,
  sag, arc, outlineSel, despeckle, n1, occlude, trimSprite, mix, shade, hex, along,
} from './jungle-core';

export type TreeKind = 'kauri' | 'rata' | 'treefern' | 'nikau' | 'palm' | 'fig' | 'broadleaf';

export interface TreeOpts {
  /** trunk width in px (defaults per kind: kauri 50, rata 34, fig 48, broadleaf 30, treefern 10, nikau 8, palm 11) */
  width?: number;
  /** paint the crown (default true). Without it the trunk ends in a ragged top at y = 0. */
  crown?: boolean;
  /** rātā blossoms / nīkau berries / coconuts (default true) */
  flowers?: boolean;
  /** liana / vine multiplier (default 1) */
  vines?: number;
  /** epiphyte multiplier (default 1) */
  epiphytes?: number;
  /** moss multiplier (default 1) */
  moss?: number;
  /** horizontal lean of the top relative to the base, px (palms, tree ferns) */
  lean?: number;
}

/** Default trunk heights per kind (px from ground to crown base). */
export const TREE_HEIGHT: Record<TreeKind, number> = { kauri: 520, rata: 420, fig: 460, broadleaf: 380, treefern: 150, nikau: 190, palm: 210 };
export const TREE_KINDS: TreeKind[] = ['kauri', 'rata', 'treefern', 'nikau', 'palm', 'fig', 'broadleaf'];

/** Rows of soil / root flare kept below the anchor so trees can be sunk into the ground. */
const SINK = 4;

// ------------------------------------------------------------------ bark

type Bark = 'kauri' | 'rata' | 'fig' | 'broad' | 'fern' | 'nikau' | 'palm';

interface TrunkGeo {
  top: number;
  bot: number;
  cx: (y: number) => number;
  hw: (y: number) => number;
}

/** Voronoi-ish flake cells: id (0..1), edge distance and offset from the cell centre. */
function flake(x: number, y: number, sx: number, sy: number, seed: number) {
  const gx = Math.floor(x / sx), gy = Math.floor(y / sy);
  let d1 = 1e9, d2 = 1e9, id = 0, ox = 0, oy = 0;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const cx = gx + i, cy = gy + j;
      const px = (cx + 0.15 + hash2(cx, cy, seed) * 0.7) * sx, py = (cy + 0.15 + hash2(cx, cy, seed + 1) * 0.7) * sy;
      const dx = (x - px) / sx, dy = (y - py) / sy;
      const d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; id = hash2(cx, cy, seed + 2); ox = dx; oy = dy; }
      else if (d < d2) d2 = d;
    }
  return { id, e: Math.sqrt(d2) - Math.sqrt(d1), ox, oy };
}

interface BarkOpts {
  /** moss cushion amount (0..1+) */
  moss?: number;
  /** lichen patch amount (0..1+) */
  lichen?: number;
  /** extra brightness (tone) */
  bias?: number;
  /** multiply the cylinder band contrast */
  contrast?: number;
  /** darken edges for separation (default true) */
  edge?: boolean;
}

/** Tone offset for a cylinder lit from the left: clean bands plus bounce light on the far edge. */
function cylBand(nx: number): number {
  if (nx < -0.8) return 1.6;
  if (nx < -0.46) return 1.0;
  if (nx < -0.04) return 0.3;
  if (nx < 0.38) return -0.5;
  if (nx < 0.78) return -1.3;
  return -0.85;
}

/** Paint a cylindrical trunk with species bark texture, then lichen patches and moss cushions. */
function paintTrunk(buf: PixelBuffer, g: TrunkGeo, rp: Ramp, style: Bark, seed: number, o: BarkOpts = {}, rng?: Rng) {
  const n = rp.length - 1;
  const mid = n * 0.5 + (o.bias ?? 0);
  const kc = o.contrast ?? 1;
  const y0 = Math.max(0, Math.floor(g.top)), y1 = Math.min(buf.h, Math.ceil(g.bot));
  const moss = o.moss ?? 0;
  const mask = new Uint8Array(moss > 0 ? buf.w * Math.max(1, y1 - y0) : 1);
  for (let y = y0; y < y1; y++) {
    const cx = g.cx(y), hw = g.hw(y);
    if (hw < 0.5) continue;
    const fromBot = g.bot - y;
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
      if (x < 0 || x >= buf.w) continue;
      const nx = (x + 0.5 - cx) / hw;
      if (nx < -1 || nx > 1) continue;
      const u = Math.asin(nx) * hw; // arc-length coordinate: texture wraps around the cylinder
      const wob = (noise2(u * 0.14 + 50, y * 0.04, seed + 9) - 0.5) * 0.3;
      let t = cylBand(nx + wob) * kc;
      switch (style) {
        case 'kauri': {
          // hammered: mottled round patches, a subset with lifted scale edges
          const f = flake(u + 400, y, 10, 13, seed);
          t += f.id < 0.33 ? -0.5 : f.id > 0.7 ? 0.5 : 0;
          if (f.id > 0.52 && f.e < 0.1) t += f.oy > 0.05 ? -1.3 : f.oy < -0.1 ? 0.6 : 0;
          break;
        }
        case 'rata': {
          const rr = u * 0.4 + fbm2(u * 0.04, y * 0.011, 2, seed) * 5;
          const fr = rr - Math.floor(rr);
          if (fr < 0.2) t -= 1.3;
          else if (fr < 0.36) t += 0.55;
          if (fbm2(u * 0.18, y * 0.06, 2, seed + 3) > 0.67) t -= 0.6;
          break;
        }
        case 'fig': {
          const wr = Math.sin(y * 0.45 + fbm2(u * 0.07, y * 0.04, 2, seed) * 6);
          if (wr > 0.88) t -= 0.9;
          else if (wr > 0.7) t += 0.4;
          if (fbm2(u * 0.09, y * 0.025, 2, seed + 2) > 0.63) t += 0.4;
          break;
        }
        case 'broad': {
          // shallow vertical ridges with the odd horizontal crack and warm/cool mottling
          const rr = u * 0.3 + fbm2(u * 0.03, y * 0.008, 2, seed) * 4;
          const fr = rr - Math.floor(rr);
          if (fr < 0.14) t -= 1.1;
          else if (fr < 0.28) t += 0.45;
          if (fbm2(u * 0.1, y * 0.03, 2, seed + 4) > 0.64) t += 0.45;
          if ((y + Math.floor(rr) * 7) % 23 === 0 && fr > 0.3) t -= 0.8;
          break;
        }
        case 'fern': {
          if (Math.sin(u * 1.3 + fbm2(u * 0.3, y * 0.1, 2, seed) * 4) > 0.5) t -= 0.8;
          const lat = ((Math.floor((y + (Math.floor(u / 3) & 1) * 2) / 4) + Math.floor(u / 3)) & 1) === 0;
          if (lat && fromBot > (g.bot - g.top) * 0.4) t += 0.7;
          break;
        }
        case 'nikau': {
          const ring = (y + Math.round(n1(u * 0.2, seed) * 1.2)) % 5;
          if (ring === 0) t += 0.8;
          else if (ring === 1) t -= 1.0;
          break;
        }
        case 'palm': {
          const ring = mod6(y + Math.round(nx * 2));
          if (ring === 0) t -= 1.1;
          else if (ring === 1) t += 0.6;
          if (fbm2(u * 0.35, y * 0.2, 2, seed) > 0.66) t -= 0.5;
          break;
        }
      }
      let k = mid + t;
      if (o.edge !== false && (nx > 0.93 || nx < -0.97)) k -= 1;
      buf.data[y * buf.w + x] = rc(rp, k);
      if (moss > 0) {
        const m = fbm2(u * 0.06 + 30, y * 0.013, 2, seed + 11) + (nx < 0 ? 0.05 : -0.12) + Math.max(0, 1 - fromBot / 70) * 0.22;
        if (m > 1 - moss * 0.62) mask[(y - y0) * buf.w + x] = 1 + Math.round(clamp(cylBand(nx + wob) + 1.3, 0, 3));
      }
    }
  }
  if (moss > 0) {
    // raised moss: lit top edge, dark underside and a thin shadow cast on the bark below
    const W = buf.w;
    for (let y = y0; y < y1; y++)
      for (let x = 0; x < W; x++) {
        const m = mask[(y - y0) * W + x];
        const above = y > y0 ? mask[(y - 1 - y0) * W + x] : 0;
        const below = y + 1 < y1 ? mask[(y + 1 - y0) * W + x] : 0;
        if (!m) {
          if (above && buf.opaque(x, y)) buf.data[y * W + x] = shade(buf.data[y * W + x], -0.35);
          continue;
        }
        let k = 2.4 + m * 1.1;
        if (!above) k += 1.3;
        else if (!below) k -= 1.4;
        buf.data[y * W + x] = rc(JP.moss, k);
      }
    // raised cushion lumps inside the moss
    const mr = new Rng(seed + 77);
    for (let y = y0 + 1; y < y1 - 1; y += 2)
      for (let x = 1; x < W - 1; x += 2) {
        const m = mask[(y - y0) * W + x];
        if (!m || !mr.chance(0.16)) continue;
        const r0 = mr.range(1.2, 2.3);
        const kb = 2.6 + m * 1.1;
        buf.discFn(x + mr.range(-1, 1), y, r0, (px, py, dx, dy) => {
          if (!mask[(py - y0) * W + px] || py < y0 || py >= y1) return -1;
          const l = -dx * 0.55 - dy * 0.85;
          return rc(JP.moss, kb + (l > 0.35 ? 1 : l < -0.45 ? -1 : 0));
        });
      }
  }
  if (rng) {
    if (o.lichen) trunkLichen(buf, rng, g, o.lichen);
    if (o.moss) trunkMoss(buf, rng, g, o.moss, seed);
  }
}
const mod6 = (v: number) => ((v % 6) + 6) % 6;

/** Sparse pale lichen patches, mostly on the lit half. */
function trunkLichen(buf: PixelBuffer, rng: Rng, g: TrunkGeo, amount: number) {
  const H = g.bot - g.top;
  const n = Math.round(H * amount * 0.03 * Math.max(0.6, g.hw(g.bot - H / 2) / 12));
  for (let i = 0; i < n; i++) {
    const y = g.top + rng.next() * H;
    const nx = rng.range(-0.9, 0.3);
    const x = g.cx(y) + nx * g.hw(y);
    const rr = rng.range(1.6, 3.6);
    mossBlob(buf, rng, x, y, rr * 1.3, rr, JP.lichen, nx < -0.45 ? 1 : 0);
  }
}

/** Moss cushions clustered in wet bands on the lit side and around the base. */
function trunkMoss(buf: PixelBuffer, rng: Rng, g: TrunkGeo, amount: number, seed: number) {
  const H = g.bot - g.top;
  const n = Math.round(H * amount * 0.035);
  for (let i = 0; i < n; i++) {
    const y = g.bot - H * Math.pow(rng.next(), 2.2);
    if (n1(y * 0.018, seed + 31) < 0.42 && g.bot - y > 30) continue; // clustered bands
    const nx = rng.range(-1.05, 0.3);
    const x = g.cx(y) + nx * g.hw(y);
    const rx = rng.range(2.5, 6.5), ry = rng.range(1.6, 3.2);
    mossBlob(buf, rng, x, y, rx, ry, JP.moss, 4 + (nx < -0.45 ? 1 : 0) - (nx > 0.1 ? 1 : 0), nx < -0.8);
    if (rng.chance(0.3)) for (let k = 0; k < rx; k += 2) {
      const L = rng.range(2, 7);
      for (let s = 1; s < L; s++) buf.paint(x - rx * 0.5 + k, y + ry + s, rc(JP.moss, 3 - (s > L - 2 ? 1 : 0)));
    }
  }
}

/** Burls: gaussian bulges on a trunk silhouette. */
function withBurls(g: TrunkGeo, rng: Rng, n: number, k = 0.14): TrunkGeo {
  const H = g.bot - g.top;
  const b = Array.from({ length: n }, () => ({ y: g.top + H * rng.range(0.08, 0.85), s: rng.range(6, 18), a: rng.range(0.5, 1) * k * rng.sign() }));
  return { ...g, hw: y => { let f = 1; for (const q of b) { const d = (y - q.y) / q.s; f += q.a * Math.exp(-d * d); } return g.hw(y) * f; } };
}

/** Knots, broken branch stubs and hollows on a trunk. */
function trunkDetails(buf: PixelBuffer, rng: Rng, g: TrunkGeo, rp: Ramp, o: { knots?: number; stubs?: number; holes?: number }) {
  const n = rp.length - 1, mid = n * 0.5;
  const H = g.bot - g.top;
  for (let i = 0; i < (o.knots ?? 3); i++) {
    const y = g.top + H * rng.range(0.1, 0.85);
    const nx = rng.range(-0.6, 0.45);
    const x = g.cx(y) + nx * g.hw(y);
    const rx = rng.range(1.8, 3.5), ry = rx * rng.range(1.3, 1.9);
    buf.ellipseFn(x, y, rx + 1, ry + 1, (px, py, ex, ey) => {
      if (!buf.opaque(px, py)) return -1;
      const d = Math.sqrt(ex * ex + ey * ey);
      const lit = -ex * 0.6 - ey * 0.8;
      if (d > 0.78) return rc(rp, mid + (lit > 0 ? 0.8 : -1.2) + cylBand(nx) * 0.6);
      if (d > 0.45) return rc(rp, mid - 1.6 + cylBand(nx) * 0.5);
      return rc(rp, mid - 2.6);
    });
  }
  for (let i = 0; i < (o.stubs ?? 1); i++) {
    const y = g.top + H * rng.range(0.15, 0.7);
    const side = rng.sign();
    const x0 = g.cx(y) + side * g.hw(y) * 0.75;
    const len = rng.range(6, 14), r = rng.range(2, 3.6);
    const a = side > 0 ? -0.45 : Math.PI + 0.45;
    const x1 = x0 + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
    tube(buf, [[x0, y], [x1, y1]], t => r * (1 - t * 0.2), rp, mid, { spread: 2.2 });
    buf.ellipseFn(x1, y1, r * 0.55, r, (_x, _y, ex) => rc(JP.wood, 5 + (ex < 0 ? 1 : -1)));
    if (rng.chance(0.6)) mossBlob(buf, rng, (x0 + x1) / 2, Math.min(y, y1) - r * 0.6, len * 0.35, 1.6, JP.moss, 5, true);
  }
  for (let i = 0; i < (o.holes ?? 0); i++) {
    const y = g.top + H * rng.range(0.25, 0.75);
    const nx = rng.range(-0.35, 0.25);
    const x = g.cx(y) + nx * g.hw(y);
    const rx = Math.min(g.hw(y) * 0.35, rng.range(3, 6)), ry = rx * rng.range(1.4, 1.8);
    buf.ellipseFn(x, y, rx + 1.2, ry + 1.2, (px, py, ex, ey) => {
      if (!buf.opaque(px, py)) return -1;
      const d = Math.sqrt(ex * ex + ey * ey);
      if (d > 0.8) return rc(rp, mid + (ey > 0.2 ? 1.2 : -1.2));
      return ey < -0.2 ? rc(rp, 0) : rc(rp, 1);
    });
  }
}

// ------------------------------------------------------------------ buttresses and roots

/**
 * Root flare / plank buttresses: side planks (dark web + lit ridge tube) and front feet (tubes
 * sweeping toward the viewer, below the ground line).
 */
function buttresses(buf: PixelBuffer, rng: Rng, cx: number, gy: number, hw: number, rp: Ramp, o: { side?: number; front?: number; height?: number; reach?: number; moss?: number }) {
  const n = rp.length - 1;
  const H = o.height ?? hw * 2.2;
  const reach = o.reach ?? hw * 2.2;
  const count = o.side ?? 2;
  for (const side of [-1, 1]) {
    for (let i = count - 1; i >= 0; i--) {
      const h = H * rng.range(0.7, 1) * (i === 0 ? 1 : 0.62);
      const L = reach * rng.range(0.75, 1.05) * (i === 0 ? 1 : 0.7);
      const x0 = cx + side * hw * (0.55 + i * 0.1);
      const span = hw * 0.25 + L;
      const ridge = (t: number): P => [x0 + side * span * t, gy - h * Math.pow(1 - t, 2.1) + t * 1.5];
      // plank web: dark face under the ridge
      const pts: number[] = [];
      for (let s = 0; s <= 20; s++) { const [x, y] = ridge(s / 20); pts.push(x, y); }
      pts.push(x0 + side * span, gy + SINK, x0 - side * hw * 0.35, gy + SINK, x0 - side * hw * 0.35, gy - h);
      const face = side < 0 ? -0.3 : -1.2;
      buf.polyFn(pts, (x, y) => {
        const dt = clamp(Math.abs(x - x0) / span, 0, 1);
        const top = ridge(dt)[1];
        const d = (y - top) / Math.max(3, gy - top);
        let k = n * 0.5 + face - d * 1.3 - (i ? 0.5 : 0);
        if (Math.sin((y - top) * 0.9 + x * 0.15) > 0.85 && d > 0.2) k -= 0.7;
        return rc(rp, k);
      });
      // lit ridge
      const rpts: P[] = [];
      for (let s = 0; s <= 16; s++) rpts.push(ridge(s / 16));
      tube(buf, rpts, t => Math.max(1, hw * 0.3 * (1 - t) + 1), rp, n * 0.5 + (side < 0 ? 0.6 : -0.4) - (i ? 0.5 : 0), { spread: 2.2 });
      if ((o.moss ?? 0) > 0) for (let s = 0.15; s < 0.9; s += 0.18) {
        if (!rng.chance(0.6 * (o.moss ?? 0))) continue;
        const [x, y] = ridge(s);
        mossBlob(buf, rng, x, y - 1, rng.range(2.5, 5), 1.6, JP.moss, 5, true);
      }
    }
  }
  // front feet
  const nf = o.front ?? 2;
  for (let i = 0; i < nf; i++) {
    const off = hw * (nf === 1 ? rng.range(-0.25, 0.25) : ((i + 0.5) / nf - 0.5) * 1.35) + rng.range(-1.5, 1.5);
    const h = H * rng.range(0.4, 0.7);
    const pts: P[] = [];
    for (let s = 0; s <= 12; s++) {
      const t = s / 12;
      pts.push([cx + off * (1 + t * t * 0.9), gy - h * (1 - t) + t * (SINK - 0.5)]);
    }
    tube(buf, pts, t => hw * (0.16 + t * t * 0.3) + 0.8, rp, n * 0.5 + 0.2, { spread: 2.3 });
  }
  // contact shadow along the ground
  occlude(buf, cx, gy + 1, hw * 2.4 + reach * 0.4, 3.5, 0.35);
}

/** Surface roots snaking away from the base along the ground (drawn in front). */
function groundRoots(buf: PixelBuffer, rng: Rng, cx: number, gy: number, hw: number, rp: Ramp, count: number) {
  for (let i = 0; i < count; i++) {
    const side = i % 2 ? 1 : -1;
    const pts: P[] = [];
    let x = cx + side * hw * rng.range(0.2, 0.8), y = gy - rng.range(1, 4);
    const L = hw * rng.range(1.5, 3.2);
    for (let s = 0; s <= L; s += 2) {
      pts.push([x, y]);
      x += side * 2;
      y += rng.range(-0.3, 0.55) + (s < 6 ? 0.4 : 0);
      y = Math.min(y, gy + SINK - 1);
    }
    tube(buf, pts, t => (1 - t) * rng.range(1.8, 3.2) + 0.8, rp, rp.length * 0.5, { spread: 2 });
  }
}

// ------------------------------------------------------------------ epiphytes & vines

/** Perching lily / kiekie tuft: spray of arching strap leaves from (x, y). */
export function astelia(buf: PixelBuffer, rng: Rng, x: number, y: number, size: number, rp: Ramp = JP.astelia, base = 5) {
  const n = rng.int(9, 14);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + ((i + 0.5) / n - 0.5) * 3.0 + rng.range(-0.15, 0.15);
    const back = i % 2 === 0;
    blade(buf, { x: x + rng.range(-1, 1), y, ang: a, len: size * rng.range(0.7, 1.1), droop: 0.9 + Math.abs(Math.cos(a)) * 0.9, w0: Math.max(2, size * 0.16), ramp: rp, base: base + (back ? -1 : 1) });
  }
}

/** Bird's-nest fern (Asplenium): rosette of broad bright strap fronds. */
export function nestFern(buf: PixelBuffer, rng: Rng, x: number, y: number, size: number) {
  const n = rng.int(8, 12);
  for (let pass = 0; pass < 2; pass++)
    for (let i = 0; i < n; i++) {
      if (i % 2 !== pass) continue;
      const a = -Math.PI / 2 + ((i + 0.5) / n - 0.5) * 3.2 + rng.range(-0.1, 0.1);
      const L = size * rng.range(0.75, 1.1);
      const pts = arc(x, y, a, L, 0.55 + Math.abs(Math.cos(a)) * 0.7);
      for (let k = 0; k < pts.length; k++) {
        const t = k / (pts.length - 1);
        const w = Math.max(0.8, size * 0.13 * Math.sin(Math.min(1, t * 1.3 + 0.1) * Math.PI) + 0.5);
        const [px, py] = pts[k];
        const base = pass === 0 ? 4 : 6;
        buf.discFn(px, py, w, (_x, _y, dx, dy) => rc(JP.kawakawa, base + (dy < -0.2 ? 1 : dy > 0.4 ? -1 : 0) + (dx < -0.5 ? 0 : 0)));
        if (w > 1.5) buf.set(px, py, rc(JP.kawakawa, base - 2)); // dark midrib
      }
    }
}

/** Small bromeliad rosette with a red heart. */
export function bromeliad(buf: PixelBuffer, rng: Rng, x: number, y: number, size: number) {
  const n = rng.int(7, 10);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + ((i + 0.5) / n - 0.5) * 3.1;
    blade(buf, { x, y, ang: a, len: size * rng.range(0.7, 1), droop: 0.5 + Math.abs(Math.cos(a)) * 0.8, w0: size * 0.28, ramp: JP.taro, base: 5 + (i % 2) });
  }
  buf.discFn(x, y - 1, size * 0.18, (_x, _y, dx, dy) => rc(JP.red, 5 + (dy < 0 ? 1 : 0) - (dx > 0.3 ? 1 : 0)));
}

/** Orchid spray: thin arching stem with pale flowers. */
export function orchid(buf: PixelBuffer, rng: Rng, x: number, y: number, len: number, flower: Ramp = JP.pink) {
  const pts = arc(x, y, rng.range(-0.4, 0.4) + (rng.chance(0.5) ? 0 : Math.PI), len, 1.4);
  for (const [px, py] of pts) buf.set(px, py, rc(JP.moss, 3));
  for (let t = 0.35; t <= 1; t += 0.16) {
    const p = along(pts, t);
    buf.set(p.x, p.y + 1, rc(flower, 6));
    buf.set(p.x - 1, p.y + 1, rc(flower, 5));
    buf.set(p.x + 1, p.y + 1, rc(flower, 5));
    buf.set(p.x, p.y + 2, rc(flower, 4));
    buf.set(p.x, p.y, rc(flower, 7));
  }
}

/** Old-man's-beard: pale hanging lichen / moss strands. */
export function beard(buf: PixelBuffer, rng: Rng, x: number, y: number, w: number, len: number, rp: Ramp = JP.lichen) {
  for (let i = 0; i < w; i += 1) {
    if (!rng.chance(0.75)) continue;
    const L = len * rng.range(0.35, 1);
    for (let s = 0; s < L; s++) buf.set(x + i + Math.sin(s * 0.3 + i) * 0.6, y + s, rc(rp, s > L - 3 ? 1 : 2 + ((i + s) % 3 === 0 ? 1 : 0)));
  }
}

/** Woody liana hanging in a loop between two points, with a twisted-rope texture. */
export function liana(buf: PixelBuffer, rng: Rng, x0: number, y0: number, x1: number, y1: number, depth: number, r: number, rp: Ramp = JP.bark) {
  const pts = sag(x0, y0, x1, y1, depth, 40);
  tube(buf, pts, () => r, rp, rp.length * 0.45, { spread: 1.8, texture: (x, y) => (((x + y) >> 1) % 3 === 0 ? -0.6 : 0) });
  // leaves along the liana
  for (let t = 0.05; t < 1; t += rng.range(0.03, 0.08)) {
    const p = along(pts, t);
    const a = Math.PI / 2 + rng.range(-1, 1);
    const st = leafStamp('heart', rng.range(4, 7), 3, a);
    drawStamp(buf, st, p.x, p.y + r, JP.kawakawa, rng.int(3, 6));
  }
}

/** Hanging vine curtain from a branch. */
function hangingVines(buf: PixelBuffer, rng: Rng, x: number, y: number, w: number, maxLen: number, rp: Ramp = JP.fern) {
  const n = Math.max(1, Math.round(w / 5));
  for (let i = 0; i < n; i++) vine(buf, rng, x + rng.range(0, w), y, maxLen * rng.range(0.3, 1), rp, rng.int(3, 5), { leafEvery: rng.int(3, 5), leafLen: rng.range(3, 5) });
}

/** Climbing vine winding up a trunk (x = cx(y) ± hw), with heart leaves. */
function climbingVine(buf: PixelBuffer, rng: Rng, g: TrunkGeo, y0: number, y1: number) {
  const ph = rng.range(0, TAU);
  const freq = rng.range(0.012, 0.028);
  const stem = rc(JP.fern, 3), stemD = rc(JP.fern, 1);
  let side = 1;
  for (let y = Math.round(y0); y > y1; y--) {
    const cx = g.cx(y), hw = g.hw(y);
    const s = Math.sin(y * freq + ph);
    const front = Math.cos(y * freq + ph) > -0.2;
    if (!front) continue; // passing behind the trunk
    const x = cx + s * hw * 0.97;
    buf.set(x, y, stem);
    buf.set(x + 1, y, stemD);
    if (y % 4 === 0 && rng.chance(0.85)) {
      side = -side;
      const a = (side < 0 ? Math.PI * 0.85 : Math.PI * 0.15) + rng.range(-0.5, 0.5);
      const st = leafStamp('heart', rng.range(5, 8), rng.range(3.5, 5), a);
      drawStamp(buf, st, x, y, JP.kawakawa, 3 + (side < 0 ? 2 : 0) + (s < 0 ? 1 : 0));
    }
  }
}

// ------------------------------------------------------------------ helpers

function newCanvas(w: number, h: number) {
  return new PixelBuffer(Math.ceil(w), Math.ceil(h));
}

/** A branch limb as a tapered bark tube, returns end point. */
function limb(buf: PixelBuffer, x0: number, y0: number, ang: number, len: number, r0: number, rp: Ramp, bend = -0.4, mossy = 0, seed = 0): P {
  const pts: P[] = [];
  let a = ang, x = x0, y = y0;
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    pts.push([x, y]);
    x += Math.cos(a) * (len / steps);
    y += Math.sin(a) * (len / steps);
    a += bend * (0.6 / steps) * Math.sign(Math.cos(ang)) * -1 * (Math.cos(ang) === 0 ? 0 : 1);
  }
  tube(buf, pts, t => r0 * (1 - t * 0.55), rp, rp.length * 0.5, {
    spread: 2.2,
    texture: (px, py) => (mossy > 0 && fbm2(px * 0.12, py * 0.12, 2, seed) > 1 - mossy * 0.5 ? 0.9 : 0),
  });
  return pts[pts.length - 1];
}

/** Mossy top pass: lumps along the top surface of a limb polyline. */
function mossOnTop(buf: PixelBuffer, rng: Rng, pts: P[], r: number, amount: number) {
  for (let t = 0; t < 1; t += 0.08) {
    if (!rng.chance(amount)) continue;
    const p = along(pts, t);
    mossBlob(buf, rng, p.x, p.y - r * 0.8, rng.range(3, 6), 1.8, JP.moss, 5, true);
  }
}

// ------------------------------------------------------------------ shared crown scaffolding

interface Limb { pts: P[]; r: number }

/** Grow limbs from inside the trunk top, up and outward; returns limbs plus clump seats. */
function growLimbs(rng: Rng, x0: number, y0: number, hw0: number, tw: number, crownRX: number, n: number, gnarl = 0.06): { limbs: Limb[]; seats: { x: number; y: number; rx: number; ry: number }[] } {
  const limbs: Limb[] = [];
  const seats: { x: number; y: number; rx: number; ry: number }[] = [];
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const spreadA = rng.range(0.35, 1.05) * (i < 2 ? 0.8 : 1);
    let a = -Math.PI / 2 + side * spreadA;
    let x = x0 + side * hw0 * rng.range(0.1, 0.4), y = y0 + rng.range(0, tw * 0.25);
    const len = crownRX * rng.range(0.5, 0.92) * (i < 2 ? 1 : 0.8);
    const pts: P[] = [];
    for (let k = 0; k <= 12; k++) {
      pts.push([x, y]);
      x += (Math.cos(a) * len) / 12;
      y += (Math.sin(a) * len) / 12;
      a += side * 0.028 + rng.range(-gnarl, gnarl); // arch outward
    }
    const r = hw0 * rng.range(0.4, 0.55);
    limbs.push({ pts, r });
    const e = pts[pts.length - 1];
    seats.push({ x: e[0], y: e[1] - tw * 0.2, rx: tw * rng.range(0.95, 1.3), ry: tw * rng.range(0.6, 0.8) });
    const m = along(pts, rng.range(0.45, 0.65));
    seats.push({ x: m.x + rng.range(-5, 5), y: m.y - tw * 0.45, rx: tw * rng.range(0.75, 1.0), ry: tw * rng.range(0.5, 0.65) });
  }
  return { limbs, seats };
}

/** Paint limbs as textured bark tubes. */
function paintLimbs(buf: PixelBuffer, limbs: Limb[], rp: Ramp, seed: number, rough = 0.6) {
  const n = rp.length - 1;
  for (const l of limbs) tube(buf, l.pts, t => l.r * (1 - t * 0.62) + 0.5, rp, n * 0.45, {
    spread: 2.4,
    texture: (x, y) => { const f = noise2(x * 0.25, y * 0.25, seed); return f > 0.66 ? rough : f < 0.33 ? -rough : 0; },
  });
}

// ------------------------------------------------------------------ kauri

function kauri(seed: number, H: number, o: TreeOpts): Sprite {
  const rng = new Rng(seed * 7 + 1);
  const tw = Math.round(o.width ?? rng.range(44, 56));
  const hw0 = tw / 2;
  const crownOn = o.crown !== false;
  const crownRX = crownOn ? tw * rng.range(2.3, 2.8) : 0;
  const crownH = crownOn ? tw * 2.5 : 0;
  const W = Math.ceil(Math.max(crownRX * 2 + 100, tw * 6)), Hh = Math.ceil(H + crownH + SINK + 8);
  const buf = newCanvas(W, Hh);
  const cx = Math.round(W / 2), gy = Hh - SINK - 1;
  const top = gy - H;
  const g: TrunkGeo = {
    top: crownOn ? top - 2 : 0, bot: gy + SINK,
    cx: y => cx + (n1(y * 0.004, seed) - 0.5) * 6,
    hw: y => hw0 * (1 + Math.exp(-(gy - y) / (tw * 0.45)) * 0.5) * (1 - ((gy - y) / H) * 0.06) + (n1(y * 0.05, seed + 3) - 0.5) * 1.4,
  };
  const ep = o.epiphytes ?? 1, mo = o.moss ?? 1, vi = o.vines ?? 1;
  let limbs: Limb[] = [];
  let seats: { x: number; y: number; rx: number; ry: number }[] = [];
  if (crownOn) {
    ({ limbs, seats } = growLimbs(rng, g.cx(top), top + tw * 0.35, hw0, tw, crownRX, rng.int(4, 6)));
    seats.push({ x: g.cx(top), y: top - tw * 1.35, rx: tw * 1.25, ry: tw * 0.7 });
    seats.push({ x: g.cx(top) + rng.range(-tw, tw), y: top - tw * 1.9, rx: tw * 0.95, ry: tw * 0.5 });
    crown(buf, rng, { cx, cy: top - tw * 1.2, rx: crownRX * 0.9, ry: crownH * 0.4, ramp: JP.kauriLeaf, n: 6, lo: 0, hi: 2, len: [4, 6], wid: [2.5, 3.5], density: 0.8 });
  }
  const gk = withBurls(g, rng, 3, 0.06);
  paintTrunk(buf, gk, JP.kauri, 'kauri', seed, { moss: 0.3 * mo, lichen: 0.6 }, rng);
  trunkDetails(buf, rng, gk, JP.kauri, { knots: 2, stubs: 1, holes: 0 });
  if (crownOn) {
    paintLimbs(buf, limbs, JP.kauri, seed);
    for (const l of limbs) mossOnTop(buf, rng, l.pts, l.r, 0.3 * mo);
    for (let i = 0; i < Math.round(4 * ep); i++) {
      const l = limbs[i % limbs.length];
      const p = along(l.pts, rng.range(0.15, 0.5));
      if (i % 3 === 2) nestFern(buf, rng, p.x, p.y - l.r * 0.6, rng.range(12, 18));
      else astelia(buf, rng, p.x, p.y - l.r * 0.6, rng.range(16, 24));
    }
    crown(buf, rng, { cx, cy: top - tw, rx: crownRX, ry: crownH * 0.45, ramp: JP.kauriLeaf, clumps: seats, lo: 1, hi: 4, len: [4, 7], wid: [2.5, 3.5], density: 0.8, flatBottom: 0.5 });
  }
  // shed-bark mound, moss and the root flare at the base
  for (let i = 0; i < 16; i++) {
    const x = cx + rng.range(-hw0 * 2.2, hw0 * 2.2), y = gy + rng.range(-2, SINK);
    buf.ellipseFn(x, y, rng.range(1.5, 3.5), rng.range(1, 1.8), (_x, _y, nx, ny) => rc(JP.kauri, 4 + (ny < -0.2 ? 2 : 0) + (nx > 0.4 ? -1 : 0)));
  }
  buttresses(buf, rng, cx, gy, hw0 * 1.1, JP.kauri, { side: 1, front: 2, height: tw * 0.85, reach: tw * 0.55, moss: 0.6 * mo });
  for (let i = 0; i < 7; i++) mossBlob(buf, rng, cx + rng.range(-hw0 * 1.4, hw0 * 1.4), gy - rng.range(0, 12), rng.range(4, 8), rng.range(2, 3.5), JP.moss, rng.int(4, 6), true);
  for (let i = 0; i < Math.round(2 * vi); i++) climbingVine(buf, rng, g, gy - rng.range(0, 30), gy - H * rng.range(0.3, 0.8));
  for (let i = 0; i < Math.round(3 * ep); i++) {
    const y = gy - H * rng.range(0.25, 0.85);
    const x = g.cx(y) + rng.range(-0.7, 0.1) * g.hw(y);
    astelia(buf, rng, x, y, rng.range(14, 22));
  }
  if (crownOn) for (let i = 0; i < Math.round(3 * vi); i++) {
    const l = limbs[rng.int(0, limbs.length - 1)];
    const p = along(l.pts, rng.range(0.3, 0.9));
    if (rng.chance(0.5)) beard(buf, rng, p.x - 3, p.y + l.r * 0.5, 7, rng.range(10, 26));
    else hangingVines(buf, rng, p.x - 4, p.y + l.r * 0.3, 10, rng.range(40, 140));
  }
  outlineSel(buf, 0.5);
  return trimSprite({ buf, ax: cx, ay: gy + 1 });
}

// ------------------------------------------------------------------ rātā

function rataFlowers(buf: PixelBuffer, rng: Rng, cl: Clump[], count: number) {
  for (let i = 0; i < count; i++) {
    const c = cl[rng.int(0, cl.length - 1)];
    const a = rng.range(0, TAU), d = Math.sqrt(rng.next()) * 0.85;
    const x = c.x + Math.cos(a) * c.rx * d, y = c.y + Math.sin(a) * c.ry * d;
    if (!buf.opaque(x, y)) continue;
    const r = rng.range(2.2, 3.8);
    const lit = clamp(c.lit + (-(Math.cos(a) * d) * 0.3 - Math.sin(a) * d * 0.4), -1, 1);
    const base = 3 + Math.round((lit + 1) * 1.4);
    // pom-pom: radiating stamens with brighter tips
    for (let s = 0; s < 14; s++) {
      const aa = (s / 14) * TAU + rng.range(-0.2, 0.2);
      const rr = r * rng.range(0.7, 1.15);
      const ex = x + Math.cos(aa) * rr, ey = y + Math.sin(aa) * rr * 0.85;
      buf.line(x, y, ex, ey, rc(JP.red, base + (Math.sin(aa) < -0.2 ? 1 : Math.sin(aa) > 0.4 ? -1 : 0)));
      if (rng.chance(0.4)) buf.set(ex, ey, rc(JP.red, base + 2));
    }
    buf.set(x, y, rc(JP.red, base + 1));
    buf.set(x - 1, y - 1, rc(JP.red, base + 2));
  }
}

function rata(seed: number, H: number, o: TreeOpts): Sprite {
  const rng = new Rng(seed * 13 + 5);
  const tw = Math.round(o.width ?? rng.range(30, 38));
  const hw0 = tw / 2;
  const crownOn = o.crown !== false;
  const crownRX = crownOn ? tw * rng.range(2.6, 3.1) : 0, crownH = crownOn ? tw * 2.8 : 0;
  const W = Math.ceil(Math.max(crownRX * 2 + 50, tw * 7)), Hh = Math.ceil(H + crownH + SINK + 8);
  const buf = newCanvas(W, Hh);
  const cx = Math.round(W / 2), gy = Hh - SINK - 1, top = gy - H;
  const ep = o.epiphytes ?? 1, mo = o.moss ?? 1, vi = o.vines ?? 1;
  const ns = rng.int(3, 4);
  const stems = Array.from({ length: ns }, (_, i) => ({
    ph: rng.range(0, TAU), f: rng.range(0.008, 0.016), amp: hw0 * rng.range(0.35, 0.6), off: ((i + 0.5) / ns - 0.5) * hw0 * 0.9, r: hw0 * rng.range(0.42, 0.58), depth: rng.next(),
  })).sort((a, b) => a.depth - b.depth);
  const lean = rng.range(-8, 8);
  const cxAt = (y: number) => cx + lean * ((gy - y) / H) ** 2;
  let limbs: Limb[] = [];
  let seats: { x: number; y: number; rx: number; ry: number }[] = [];
  if (crownOn) {
    crown(buf, rng, { cx: cxAt(top), cy: top - tw * 1.1, rx: crownRX * 0.9, ry: crownH * 0.42, ramp: JP.canopy, n: 7, lo: 0, hi: 2, shape: 'point', len: [4, 6], wid: [2.5, 3], density: 0.8 });
    ({ limbs, seats } = growLimbs(rng, cxAt(top), top + tw * 0.4, hw0, tw, crownRX, rng.int(4, 6), 0.22));
    seats.push({ x: cxAt(top), y: top - tw * 1.2, rx: tw * 1.1, ry: tw * 0.75 });
  }
  for (const st of stems) {
    const g: TrunkGeo = {
      top: crownOn ? top - 2 : 0, bot: gy + SINK,
      cx: y => cxAt(y) + st.off + Math.sin(y * st.f + st.ph) * st.amp,
      hw: y => st.r * (1 + Math.exp(-(gy - y) / (tw * 0.6)) * 0.7) * (0.85 + 0.15 * Math.sin(y * 0.03 + st.ph)),
    };
    paintTrunk(buf, g, JP.rata, 'rata', seed + Math.round(st.ph * 10), { moss: 0.45 * mo, lichen: 0.35, bias: (st.depth - 0.5) * 1.2 }, rng);
    if (st.depth > 0.5) trunkDetails(buf, rng, g, JP.rata, { knots: 2, stubs: 0, holes: 0 });
  }
  if (crownOn) {
    paintLimbs(buf, limbs, JP.rata, seed, 0.8);
    for (const l of limbs) mossOnTop(buf, rng, l.pts, l.r, 0.5 * mo);
  }
  buttresses(buf, rng, cx, gy, hw0, JP.rata, { side: 2, front: 2, height: tw * 1.5, reach: tw * 1.3, moss: 0.8 * mo });
  groundRoots(buf, rng, cx, gy, hw0, JP.rata, 4);
  for (let i = 0; i < 8; i++) mossBlob(buf, rng, cx + rng.range(-hw0 * 2, hw0 * 2), gy - rng.range(0, 14), rng.range(3, 7), rng.range(2, 3), JP.moss, rng.int(4, 6), true);
  const g0: TrunkGeo = { top, bot: gy, cx: cxAt, hw: () => hw0 };
  for (let i = 0; i < Math.round(3 * vi); i++) climbingVine(buf, rng, g0, gy - rng.range(0, 30), gy - H * rng.range(0.4, 0.95));
  for (let i = 0; i < Math.round(3 * ep); i++) {
    const y = gy - H * rng.range(0.2, 0.9);
    const x = cxAt(y) + rng.range(-hw0, hw0 * 0.3);
    if (i % 2) nestFern(buf, rng, x, y, rng.range(10, 16));
    else { bromeliad(buf, rng, x, y, rng.range(8, 12)); orchid(buf, rng, x + 3, y - 2, rng.range(8, 14), JP.pink); }
  }
  if (crownOn) {
    const cl = crown(buf, rng, { cx: cxAt(top), cy: top - tw, rx: crownRX, ry: crownH * 0.45, ramp: JP.canopy, clumps: seats, lo: 1, hi: 5, shape: 'point', len: [4, 7], wid: [2.5, 3.5], density: 0.85 });
    if (o.flowers !== false) rataFlowers(buf, rng, cl, Math.round(crownRX * 0.9));
    for (let i = 0; i < Math.round(3 * vi); i++) {
      const l = limbs[rng.int(0, limbs.length - 1)];
      const p = along(l.pts, rng.range(0.3, 0.9));
      hangingVines(buf, rng, p.x - 5, p.y, 12, rng.range(40, 160));
    }
    const a = along(limbs[0].pts, 0.7), b = along(limbs[1 % limbs.length].pts, 0.7);
    liana(buf, rng, a.x, a.y, b.x, b.y, rng.range(40, 120), 1.6);
  }
  outlineSel(buf, 0.5);
  return trimSprite({ buf, ax: cx, ay: gy + 1 });
}

// ------------------------------------------------------------------ strangler fig

function fig(seed: number, H: number, o: TreeOpts): Sprite {
  const rng = new Rng(seed * 17 + 3);
  const tw = Math.round(o.width ?? rng.range(42, 56));
  const hw0 = tw / 2;
  const crownOn = o.crown !== false;
  const crownRX = crownOn ? tw * rng.range(2.5, 3.0) : 0, crownH = crownOn ? tw * 2.6 : 0;
  const W = Math.ceil(Math.max(crownRX * 2 + 60, tw * 6.5)), Hh = Math.ceil(H + crownH + SINK + 8);
  const buf = newCanvas(W, Hh);
  const cx = Math.round(W / 2), gy = Hh - SINK - 1, top = gy - H;
  const ep = o.epiphytes ?? 1, mo = o.moss ?? 1, vi = o.vines ?? 1;
  let limbs: Limb[] = [];
  let seats: { x: number; y: number; rx: number; ry: number }[] = [];
  if (crownOn) {
    crown(buf, rng, { cx, cy: top - tw, rx: crownRX * 0.9, ry: crownH * 0.4, ramp: JP.canopy, n: 7, lo: 0, hi: 2, len: [5, 8], wid: [3, 4.5], density: 0.75 });
    ({ limbs, seats } = growLimbs(rng, cx, top + tw * 0.3, hw0 * 0.9, tw, crownRX, rng.int(4, 5), 0.08));
    seats.push({ x: cx, y: top - tw * 1.3, rx: tw * 1.2, ry: tw * 0.7 });
  }
  // host trunk: dark, rotting, mostly hidden behind the lattice
  const host: TrunkGeo = { top: crownOn ? top : 0, bot: gy, cx: y => cx + (n1(y * 0.01, seed) - 0.5) * 4, hw: () => hw0 * 0.78 };
  paintTrunk(buf, host, JP.fig.map(c => shade(c, -0.5)), 'broad', seed, { bias: -1.8, contrast: 0.7 });
  if (crownOn) paintLimbs(buf, limbs, JP.fig, seed);
  // root lattice
  const nr = rng.int(9, 13);
  const roots: P[][] = [];
  for (let i = 0; i < nr; i++) {
    const pts: P[] = [];
    let x = cx + ((i + 0.5) / nr - 0.5) * tw * 0.95 + rng.range(-2, 2);
    const drift = rng.range(-0.5, 0.5);
    for (let y = crownOn ? top - 2 : 0; y <= gy + SINK; y += 4) {
      pts.push([x, y]);
      x += drift * 2 + Math.sin(y * 0.02 + i * 1.7) * 1.4 + rng.range(-0.8, 0.8);
      const lim = hw0 * (1 + Math.exp(-(gy - y) / (tw * 0.8)) * 1.6);
      x = clamp(x, cx - lim, cx + lim);
    }
    roots.push(pts);
  }
  for (let i = 0; i < roots.length; i++) {
    const r0 = rng.range(1.8, 4.2);
    tube(buf, roots[i], t => r0 * (0.8 + t * 0.5), JP.fig, 5 + (i % 3 === 0 ? 1 : 0), { spread: 2.3, texture: (x, y) => (noise2(x * 0.22, y * 0.06, seed + i) > 0.68 ? -0.7 : 0) });
  }
  for (let i = 0; i < 16; i++) {
    const a = roots[rng.int(0, roots.length - 1)], b = roots[rng.int(0, roots.length - 1)];
    if (a === b) continue;
    const t0 = rng.range(0.1, 0.8), t1 = clamp(t0 + rng.range(0.03, 0.12), 0, 1);
    const p = along(a, t0), q = along(b, t1);
    if (Math.abs(p.x - q.x) > tw * 0.8) continue;
    tube(buf, [[p.x, p.y], [(p.x + q.x) / 2, (p.y + q.y) / 2 + 3], [q.x, q.y]], () => rng.range(1.4, 2.4), JP.fig, 5, { spread: 2 });
  }
  // aerial roots dangling from limbs
  if (crownOn) for (const l of limbs) {
    const e = l.pts[l.pts.length - 1];
    for (let k = 0; k < 3; k++) {
      const x = e[0] + rng.range(-12, 12), y0 = e[1] + 4, L = rng.range(40, H * 0.6);
      const pts: P[] = [];
      for (let s = 0; s <= L; s += 4) pts.push([x + Math.sin(s * 0.04 + k) * 1.5, y0 + s]);
      tube(buf, pts, t => 0.9 + t * 0.3, JP.fig, 4, { spread: 1.5, rim: false });
    }
  }
  buttresses(buf, rng, cx, gy, hw0 * 1.2, JP.fig, { side: 2, front: 3, height: tw * 1.2, reach: tw * 1.3, moss: 0.6 * mo });
  groundRoots(buf, rng, cx, gy, hw0, JP.fig, 5);
  for (let i = 0; i < 8; i++) mossBlob(buf, rng, cx + rng.range(-hw0 * 2, hw0 * 2), gy - rng.range(0, 12), rng.range(3, 7), rng.range(2, 3), JP.moss, rng.int(4, 6), true);
  for (let i = 0; i < Math.round(3 * ep); i++) {
    const y = gy - H * rng.range(0.25, 0.9), x = cx + rng.range(-hw0, hw0);
    if (i % 2) nestFern(buf, rng, x, y, rng.range(12, 18));
    else bromeliad(buf, rng, x, y, rng.range(8, 12));
  }
  if (crownOn) {
    crown(buf, rng, { cx, cy: top - tw, rx: crownRX, ry: crownH * 0.45, ramp: JP.canopy, clumps: seats, lo: 2, hi: 5, len: [5, 8], wid: [3, 4.5], density: 0.8 });
    for (let i = 0; i < Math.round(2 * vi); i++) {
      const la = limbs[rng.int(0, limbs.length - 1)].pts, lb = limbs[rng.int(0, limbs.length - 1)].pts;
      if (la === lb) continue;
      const a = along(la, 0.8), b = along(lb, 0.8);
      liana(buf, rng, a.x, a.y + 4, b.x, b.y + 4, rng.range(60, 160), 1.5);
    }
  }
  outlineSel(buf, 0.5);
  return trimSprite({ buf, ax: cx, ay: gy + 1 });
}

// ------------------------------------------------------------------ broadleaf canopy tree

function broadleaf(seed: number, H: number, o: TreeOpts): Sprite {
  const rng = new Rng(seed * 19 + 11);
  const tw = Math.round(o.width ?? rng.range(24, 34));
  const hw0 = tw / 2;
  const crownOn = o.crown !== false;
  const crownRX = crownOn ? tw * rng.range(3.2, 3.8) : 0, crownH = crownOn ? tw * 3.4 : 0;
  const W = Math.ceil(Math.max(crownRX * 2 + 60, tw * 7)), Hh = Math.ceil(H + crownH + SINK + 8);
  const buf = newCanvas(W, Hh);
  const cx = Math.round(W / 2), gy = Hh - SINK - 1, top = gy - H;
  const ep = o.epiphytes ?? 1, mo = o.moss ?? 1, vi = o.vines ?? 1;
  const lean = rng.range(-10, 10);
  const g: TrunkGeo = {
    top: crownOn ? top - 2 : 0, bot: gy + SINK,
    cx: y => cx + lean * ((gy - y) / H) ** 1.5 + (n1(y * 0.01, seed) - 0.5) * 5,
    hw: y => hw0 * (1 + Math.exp(-(gy - y) / (tw * 0.7)) * 0.9) * (1 - ((gy - y) / H) * 0.2),
  };
  let limbs: Limb[] = [];
  let seats: { x: number; y: number; rx: number; ry: number }[] = [];
  if (crownOn) {
    crown(buf, rng, { cx: g.cx(top), cy: top - tw * 1.3, rx: crownRX * 0.9, ry: crownH * 0.4, ramp: JP.canopy, n: 8, lo: 0, hi: 2, len: [5, 8], wid: [3, 4.5], density: 0.75 });
    ({ limbs, seats } = growLimbs(rng, g.cx(top), top + tw * 0.5, hw0 * 0.85, tw, crownRX, rng.int(4, 6), 0.1));
    seats.push({ x: g.cx(top), y: top - tw * 1.6, rx: tw * 1.4, ry: tw * 0.9 });
    seats.push({ x: g.cx(top) + rng.range(-tw, tw), y: top - tw * 2.2, rx: tw * 1.1, ry: tw * 0.7 });
  }
  const gb = withBurls(g, rng, 4, 0.12);
  paintTrunk(buf, gb, JP.bark, 'broad', seed, { moss: 0.5 * mo, lichen: 0.7 }, rng);
  trunkDetails(buf, rng, gb, JP.bark, { knots: 3, stubs: rng.int(1, 2), holes: rng.chance(0.5) ? 1 : 0 });
  if (crownOn) {
    paintLimbs(buf, limbs, JP.bark, seed);
    for (const l of limbs) mossOnTop(buf, rng, l.pts, l.r, 0.45 * mo);
  }
  buttresses(buf, rng, g.cx(gy), gy, hw0, JP.bark, { side: 2, front: 2, height: tw * 1.8, reach: tw * 1.6, moss: 0.7 * mo });
  groundRoots(buf, rng, g.cx(gy), gy, hw0, JP.bark, 4);
  for (let i = 0; i < 6; i++) mossBlob(buf, rng, g.cx(gy) + rng.range(-hw0 * 2, hw0 * 2), gy - rng.range(0, 12), rng.range(3, 7), rng.range(2, 3), JP.moss, rng.int(4, 6), true);
  for (let i = 0; i < Math.round(2 * vi); i++) climbingVine(buf, rng, g, gy - rng.range(0, 20), gy - H * rng.range(0.4, 1));
  for (let i = 0; i < Math.round(3 * ep); i++) {
    const y = gy - H * rng.range(0.3, 0.95), x = g.cx(y) + rng.range(-0.7, 0.3) * g.hw(y);
    if (i % 3 === 0) nestFern(buf, rng, x, y, rng.range(12, 20));
    else if (i % 3 === 1) astelia(buf, rng, x, y, rng.range(12, 18), JP.fern, 5);
    else { bromeliad(buf, rng, x, y, rng.range(7, 10)); orchid(buf, rng, x - 2, y - 1, 10, rng.chance(0.5) ? JP.pink : JP.cream); }
  }
  if (crownOn) {
    for (let i = 0; i < Math.round(3 * ep); i++) {
      const l = limbs[i % limbs.length];
      const p = along(l.pts, rng.range(0.25, 0.6));
      if (i % 2) nestFern(buf, rng, p.x, p.y - l.r * 0.5, rng.range(12, 18));
      else bromeliad(buf, rng, p.x, p.y - l.r * 0.5, rng.range(8, 11));
    }
    crown(buf, rng, { cx: g.cx(top), cy: top - tw * 1.2, rx: crownRX, ry: crownH * 0.45, ramp: JP.canopy, clumps: seats, lo: 2, hi: 5, len: [5, 8], wid: [3, 4.5], density: 0.8 });
    for (let i = 0; i < Math.round(4 * vi); i++) {
      const l = limbs[rng.int(0, limbs.length - 1)];
      const p = along(l.pts, rng.range(0.4, 1));
      hangingVines(buf, rng, p.x - 6, p.y + 2, 14, rng.range(60, H * 0.7));
    }
    for (let i = 0; i < Math.round(2 * vi); i++) {
      const a = along(limbs[rng.int(0, limbs.length - 1)].pts, rng.range(0.5, 1));
      liana(buf, rng, a.x, a.y, a.x + rng.range(-60, 60), gy - rng.range(40, H * 0.5), rng.range(30, 100), 1.5);
    }
  }
  outlineSel(buf, 0.5);
  return trimSprite({ buf, ax: g.cx(gy), ay: gy + 1 });
}

// ------------------------------------------------------------------ tree fern

function koru(buf: PixelBuffer, x: number, y: number, size: number, rp: Ramp, hairy: boolean) {
  // stalk rising then a spiral curling outward
  const stalk = size * 0.9;
  for (let s = 0; s < stalk; s += 0.5) buf.set(x + Math.sin(s * 0.15) * 0.8, y - s, rc(rp, 5));
  const cx = x + size * 0.28, cy = y - stalk - size * 0.25;
  for (let a = 0; a < TAU * 1.6; a += 0.12) {
    const rr = size * 0.42 * (1 - a / (TAU * 1.9));
    const px = cx + Math.cos(a + Math.PI) * rr, py = cy + Math.sin(a + Math.PI) * rr;
    buf.set(px, py, rc(rp, a < 3 ? 6 : 7));
    buf.set(px + 1, py, rc(rp, 5));
    if (hairy && Math.floor(a * 10) % 4 === 0) buf.set(px, py - 1, rc(JP.skirt, 5));
  }
}

function treefern(seed: number, H: number, o: TreeOpts): Sprite {
  const rng = new Rng(seed * 23 + 7);
  const variant = seed % 3; // 0 ponga (silver), 1 wheki (skirt), 2 mamaku (tall, black stipes)
  const tw = o.width ?? (variant === 2 ? rng.range(11, 13) : rng.range(8, 10));
  const hw0 = tw / 2;
  const span = (variant === 2 ? 1.25 : 1) * (H * 0.35 + 50);
  const W = Math.ceil(span * 2 + 40), Hh = Math.ceil(H + span * 0.7 + SINK + 10);
  const buf = newCanvas(W, Hh);
  const cx = Math.round(W / 2), gy = Hh - SINK - 1;
  const lean = o.lean ?? rng.range(-14, 14);
  const cxAt = (y: number) => cx + lean * ((gy - y) / H) ** 1.6;
  const top = gy - H;
  const tx = cxAt(top);
  const R = JP.fern;
  const nf = rng.int(11, 15);
  const fronds: { a: number; len: number; droop: number; layer: number }[] = [];
  for (let i = 0; i < nf; i++) {
    const a = -Math.PI / 2 + ((i + 0.5) / nf - 0.5) * 3.5 + rng.range(-0.08, 0.08);
    const side = Math.abs(Math.cos(a));
    fronds.push({ a, len: span * rng.range(0.82, 1.0), droop: 0.55 + side * 0.9, layer: i % 3 });
  }
  const drawFronds = (layer: number) => {
    for (const f of fronds) {
      if (f.layer !== layer) continue;
      const back = layer === 0, front = layer === 2;
      const base = back ? 4 : front ? 7 : 6;
      frond(buf, {
        x: tx, y: top - 2, ang: f.a + (back ? 0 : 0), len: f.len * (back ? 0.92 : 1), droop: f.droop * (front ? 1.35 : 1),
        ramp: R, base, pinna: span * 0.13, pinnaW: 2.5, gap: 2.1, sweep: 0.85, hang: front ? 0.2 : 0.1,
        under: variant === 0 ? JP.silver : R, underBase: variant === 0 ? (back ? 3 : 4) : base - 2,
        rachis: variant === 2 ? rc(JP.fernTrunk, 1) : rc(R, base - 2), bare: 0.1,
      });
    }
  };
  drawFronds(0);
  // trunk
  const g: TrunkGeo = { top: top - 2, bot: gy + SINK, cx: cxAt, hw: y => hw0 * (1 + Math.exp(-(gy - y) / 10) * 0.5) * (0.95 + 0.05 * Math.sin(y * 0.1)) };
  paintTrunk(buf, g, JP.fernTrunk, 'fern', seed, { moss: 0.3 * (o.moss ?? 1), contrast: 1.1 }, rng);
  if (variant === 1) {
    // skirt of dead hanging fronds
    const ns = rng.int(10, 15);
    const skirtL = H * rng.range(0.22, 0.35);
    for (let i = 0; i < ns; i++) {
      const off = ((i + 0.5) / ns - 0.5) * tw * 3.2;
      const len = skirtL * rng.range(0.6, 1);
      const x0 = tx + off * 0.4;
      const pts: P[] = [];
      for (let s = 0; s <= len; s += 1) pts.push([x0 + off * 0.5 * (s / len) + Math.sin(s * 0.2 + i) * 0.8, top + 2 + s]);
      const col = rng.int(2, 5);
      for (let k = 0; k < pts.length; k++) {
        const [px, py] = pts[k];
        buf.set(px, py, rc(JP.skirt, col - 1));
        if (k % 2 === 0 && k > 2) {
          buf.set(px - 1, py + 1, rc(JP.skirt, col));
          buf.set(px + 1, py + 1, rc(JP.skirt, col - (off > 0 ? 1 : 0)));
          if (k % 4 === 0) { buf.set(px - 2, py + 2, rc(JP.skirt, col + 1)); buf.set(px + 2, py + 2, rc(JP.skirt, col - 1)); }
        }
      }
    }
  }
  if (variant === 2) {
    // black stipe bases around the crown
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + ((i + 0.5) / 10 - 0.5) * 3.2;
      buf.thickLine(tx, top, tx + Math.cos(a) * 7, top + Math.sin(a) * 5, 1, rc(JP.fernTrunk, 1));
    }
  }
  drawFronds(1);
  // unfurling koru
  const nk = rng.int(1, 3);
  for (let i = 0; i < nk; i++) koru(buf, tx + rng.range(-4, 4), top - 1, rng.range(8, 12), R, variant !== 0);
  drawFronds(2);
  // moss & ferns at the base
  for (let i = 0; i < 4; i++) mossBlob(buf, rng, cxAt(gy) + rng.range(-8, 8), gy - rng.range(0, 6), rng.range(3, 6), 2, JP.moss, rng.int(4, 6));
  outlineSel(buf, 0.45);
  return trimSprite({ buf, ax: cxAt(gy), ay: gy + 1 });
}

// ------------------------------------------------------------------ nīkau

function nikau(seed: number, H: number, o: TreeOpts): Sprite {
  const rng = new Rng(seed * 29 + 13);
  const tw = o.width ?? rng.range(7, 9);
  const hw0 = tw / 2;
  const span = H * 0.3 + 44;
  const W = Math.ceil(span * 2 + 30), Hh = Math.ceil(H + span + SINK + 10);
  const buf = newCanvas(W, Hh);
  const cx = Math.round(W / 2), gy = Hh - SINK - 1;
  const lean = o.lean ?? rng.range(-8, 8);
  const cxAt = (y: number) => cx + lean * ((gy - y) / H);
  const shaftL = rng.range(20, 26);
  const top = gy - H; // top of the ringed trunk / base of crown shaft
  const tx = cxAt(top);
  const R = JP.canopyOlive;
  const nf = rng.int(9, 12);
  const fr: { a: number; len: number; layer: number }[] = [];
  for (let i = 0; i < nf; i++) fr.push({ a: -Math.PI / 2 + ((i + 0.5) / nf - 0.5) * 2.6 + rng.range(-0.06, 0.06), len: span * rng.range(0.85, 1.05), layer: i % 2 });
  const fy = top - shaftL;
  const drawF = (layer: number) => {
    for (const f of fr) if (f.layer === layer) {
      const side = Math.abs(Math.cos(f.a));
      frond(buf, { x: tx, y: fy, ang: f.a, len: f.len, droop: 0.5 + side * 1.2, ramp: JP.palmLeaf, base: layer ? 6 : 4, pinna: span * 0.22, pinnaW: 2, gap: 2.2, sweep: 0.42, hang: 0.28, rachis: rc(JP.nikauShaft, 5), underBase: layer ? 4 : 2, bare: 0.06 });
    }
  };
  drawF(0);
  const g: TrunkGeo = { top: top, bot: gy + SINK, cx: cxAt, hw: y => hw0 * (1 + Math.exp(-(gy - y) / 8) * 0.35) };
  paintTrunk(buf, g, JP.nikau, 'nikau', seed, { moss: 0.15 * (o.moss ?? 1), lichen: 0.5 }, rng);
  // crown shaft: bulging smooth glossy green
  const gs: TrunkGeo = { top: fy, bot: top + 2, cx: y => cxAt(y), hw: y => hw0 * (1.05 + Math.sin(((y - fy) / (top + 2 - fy)) * Math.PI) * 0.45) };
  paintTrunk(buf, gs, JP.nikauShaft, 'fig', seed + 1, { contrast: 1.2, bias: 0.4 });
  // inflorescence / berries under the crown shaft
  if (o.flowers !== false) {
    const by = top + 3;
    for (let i = 0; i < 9; i++) {
      const a = Math.PI / 2 + (i / 8 - 0.5) * 2.2;
      const L = rng.range(6, 12);
      for (let s = 0; s < L; s++) {
        const px = tx + Math.cos(a) * s * 0.9, py = by + Math.sin(a) * s * 0.6 + s * 0.3;
        buf.set(px, py, rc(JP.pink, 4));
        if (s % 2 === 1) buf.set(px + (i % 2 ? 1 : -1), py, rc(i % 3 === 0 ? JP.red : JP.pink, 5 + (s % 3 === 0 ? 1 : 0)));
      }
    }
  }
  drawF(1);
  outlineSel(buf, 0.45);
  return trimSprite({ buf, ax: cxAt(gy), ay: gy + 1 });
}

// ------------------------------------------------------------------ coconut palm

function palm(seed: number, H: number, o: TreeOpts): Sprite {
  const rng = new Rng(seed * 31 + 17);
  const tw = o.width ?? rng.range(10, 12);
  const hw0 = tw / 2;
  const span = H * 0.32 + 50;
  const lean = o.lean ?? rng.sign() * rng.range(20, 50);
  const W = Math.ceil(span * 2 + Math.abs(lean) * 2 + 30), Hh = Math.ceil(H + span * 0.6 + SINK + 12);
  const buf = newCanvas(W, Hh);
  const cx = Math.round(W / 2), gy = Hh - SINK - 1;
  const cxAt = (y: number) => cx + lean * Math.pow((gy - y) / H, 1.8);
  const top = gy - H, tx = cxAt(top);
  const nf = rng.int(12, 16);
  const fr: { a: number; len: number; layer: number; dead: boolean }[] = [];
  for (let i = 0; i < nf; i++) {
    const a = -Math.PI / 2 + ((i + 0.5) / nf - 0.5) * 3.6 + rng.range(-0.08, 0.08);
    fr.push({ a, len: span * rng.range(0.8, 1.02), layer: i % 3, dead: false });
  }
  for (let i = 0; i < rng.int(1, 3); i++) fr.push({ a: Math.PI / 2 + rng.range(-0.7, 0.7), len: span * 0.6, layer: 0, dead: true });
  const drawF = (layer: number) => {
    for (const f of fr) if (f.layer === layer) {
      const side = Math.abs(Math.cos(f.a));
      if (f.dead) frond(buf, { x: tx, y: top, ang: f.a, len: f.len, droop: 0.3, ramp: JP.skirt, base: 4, pinna: span * 0.18, pinnaW: 1.5, gap: 2.2, sweep: 0.3, hang: 0.6, underBase: 3 });
      else frond(buf, { x: tx, y: top, ang: f.a, len: f.len, droop: 1.0 + side * 1.1, ramp: JP.palmLeaf, base: 3 + layer * 2, pinna: span * 0.24, pinnaW: 2, gap: 2, sweep: 0.55, hang: 0.62, bare: 0.05, underBase: 2 + layer * 2 });
    }
  };
  drawF(0);
  const g: TrunkGeo = { top: top, bot: gy + SINK, cx: cxAt, hw: y => hw0 * (1 + Math.exp(-(gy - y) / 14) * 0.6) * (1 - ((gy - y) / H) * 0.15) };
  paintTrunk(buf, g, JP.palmTrunk, 'palm', seed, { contrast: 1.1 });
  drawF(1);
  if (o.flowers !== false) {
    const n = rng.int(4, 7);
    for (let i = 0; i < n; i++) {
      const x = tx + rng.range(-6, 6), y = top + rng.range(1, 6);
      const green = rng.chance(0.6);
      buf.shadedEllipse(x, y, 3.2, 3.4, green ? JP.palmLeaf.slice(2, 8) : JP.tan.slice(1, 7));
    }
  }
  drawF(2);
  outlineSel(buf, 0.45);
  return trimSprite({ buf, ax: cxAt(gy), ay: gy + 1 });
}

// ------------------------------------------------------------------ public

/**
 * A big tree sprite. `height` is the trunk height (ground to crown base) in px; the crown adds
 * roughly 2–3 trunk widths above it. Anchor: bottom-centre of the trunk at the ground line
 * (SINK = 4 px of root flare and soil sit below ay so it can be sunk into the terrain).
 */
export function tree(kind: TreeKind, seed: number, height?: number, o: TreeOpts = {}): Sprite {
  const H = Math.round(height ?? TREE_HEIGHT[kind]);
  switch (kind) {
    case 'kauri': return kauri(seed, H, o);
    case 'rata': return rata(seed, H, o);
    case 'fig': return fig(seed, H, o);
    case 'broadleaf': return broadleaf(seed, H, o);
    case 'treefern': return treefern(seed, H, o);
    case 'nikau': return nikau(seed, H, o);
    case 'palm': return palm(seed, H, o);
  }
}

/**
 * Free-standing broadleaf canopy clump (no trunk) of about w × h px, for stacking overhead or in
 * canopy layers. `flowers` scatters rātā blossoms. Anchor: centre of the bottom edge.
 */
export function canopyClump(seed: number, w = 180, h = 110, o: { ramp?: Ramp; flowers?: boolean; vines?: boolean; shape?: 'oval' | 'point'; above?: number } = {}): Sprite {
  const rng = new Rng(seed * 37 + 19);
  // `above`: px of deeper canopy (and the limbs the clump hangs from) continuing up out of the clump,
  // so a clump hung at the top of the frame never shows a top edge when the view looks up
  const above = Math.max(0, Math.round(o.above ?? 0));
  const buf = newCanvas(w + 20, h + 90 + above);
  const cx = (w + 20) / 2, cy = h / 2 + 8 + above;
  const rp = o.ramp ?? JP.canopy;
  if (above > 0) {
    const ur = new Rng(seed * 41 + 7);
    // the limbs it hangs from, rising out of the top
    for (let i = 0; i < 3; i++) {
      const x = cx + (i - 1) * w * 0.26 + ur.range(-10, 10);
      tube(buf, [[x, cy], [x + ur.range(-20, 20), cy - h * 0.6], [x + ur.range(-30, 30), 0]], t => 3 + t * 4, JP.bark, 3);
    }
    // deeper canopy above: overlapping dark leaf masses, widening upward, right up to the top
    for (let y = cy - h * 0.25; y > -20; y -= ur.range(22, 32)) {
      const k = clamp((cy - y) / (above + h * 0.5));
      for (let x = cx - w * (0.36 + k * 0.1); x <= cx + w * (0.36 + k * 0.1); x += ur.range(26, 40)) {
        const r = ur.range(20, 30);
        leafMass(buf, ur, { cx: x, cy: y, rx: r * 1.25, ry: r, ramp: rp, base: ur.int(0, 1), steps: 2, shape: o.shape ?? 'oval', len: [5, 8], wid: [3, 4.5], density: 0.85, jag: 0.45 });
      }
    }
  }
  crown(buf, rng, { cx, cy: cy - 4, rx: w * 0.44, ry: h * 0.38, ramp: rp, n: 6, lo: 0, hi: 2, shape: o.shape ?? 'oval', len: [5, 8], wid: [3, 4.5], density: 0.8 });
  // a few branch stubs peeking out
  for (let i = 0; i < 3; i++) {
    const x = cx + rng.range(-w * 0.3, w * 0.3);
    tube(buf, [[x, cy + h * 0.1], [x + rng.range(-12, 12), cy + h * 0.42]], t => 3 - t * 1.5, JP.bark, 4);
  }
  const cl = crown(buf, rng, { cx, cy, rx: w * 0.46, ry: h * 0.42, ramp: rp, n: rng.int(9, 13), lo: 1, hi: 5, shape: o.shape ?? 'oval', len: [5, 8], wid: [3, 4.5], density: 0.8 });
  if (o.flowers) rataFlowers(buf, rng, cl, Math.round(w * 0.4));
  if (o.vines !== false) for (let i = 0; i < 4; i++) vine(buf, rng, cx + rng.range(-w * 0.35, w * 0.35), cy + h * 0.25, rng.range(20, 80), JP.fern, rng.int(3, 5));
  outlineSel(buf, 0.5);
  return trimSprite({ buf, ax: cx, ay: h + 8 + above });
}

export { despeckle, occlude, leafMass, mix, hex };
export type { C };

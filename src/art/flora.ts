// Mid-ground and near vegetation sprites for Zealandia: tree ferns, kauri, nikau palms,
// canopy giants, mangroves, ground ferns, bushes, grasses, flowers, fungi, rocks and logs.

import { PixelBuffer } from './pixel';
import { C, hex, mix, shade, withAlpha } from './color';
import { PAL, OUTLINE } from './palettes';
import { Rng, bayer, clamp, fbm2, noise1, TAU } from '../core/math';

type P = [number, number];

/** Dense leaf mass: many small shaded leaves inside an ellipse, lit from upper-left. */
export function foliage(
  buf: PixelBuffer, cx: number, cy: number, rx: number, ry: number, ramp: C[], rng: Rng,
  leaf = 2.2, density = 1, lx = -0.55, bias = 0,
) {
  const n = Math.floor((rx * ry * 3.1) / (leaf * leaf) * 0.9 * density) + 4;
  const leaves: { x: number; y: number; r: number; l: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), d = Math.sqrt(rng.next());
    const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
    const nx = (x - cx) / rx, ny = (y - cy) / ry;
    const l = -ny * 0.55 + nx * lx * 0.45 + (1 - d) * 0.25 + rng.range(-0.18, 0.18) + bias;
    leaves.push({ x, y, r: leaf * rng.range(0.7, 1.35), l });
  }
  leaves.sort((a, b) => a.l - b.l);
  const top = ramp.length - 1;
  for (const lf of leaves) {
    const idx = clamp(Math.round((lf.l * 0.5 + 0.5) * top), 0, top);
    const base = ramp[idx];
    const hi = ramp[Math.min(top, idx + 1)];
    buf.ellipseFn(lf.x, lf.y, lf.r * 1.25, lf.r * 0.85, (x, y, nx, ny) => (ny < -0.3 && nx < 0.4 && idx < top ? hi : base));
    void bayer;
  }
}

/**
 * A leafy frond: an arching rachis with short forward-swept pinnae on both sides, which
 * together form a serrated, feathery silhouette. `droop` controls how much gravity bends it.
 */
function frond(
  buf: PixelBuffer, x0: number, y0: number, ang: number, len: number, droop: number,
  top: C, mid: C, under: C, pinna = 1, curlTip = false,
) {
  const pts: P[] = [];
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const steps = Math.ceil(len * 2);
  for (let i = 0; i <= steps; i++) {
    const s = (i / steps) * len;
    const t = s / len;
    // ballistic arc: launch direction + gravity, stronger toward the tip
    let x = x0 + dx * s;
    let y = y0 + dy * s + droop * len * 0.16 * t * t * (0.7 + t * 0.3);
    if (curlTip && t > 0.85) y -= (t - 0.85) * len * 0.3;
    pts.push([x, y]);
  }
  const maxP = Math.max(1.5, len * 0.15 * pinna);
  for (let i = 3; i < pts.length - 1; i += 4) {
    const t = i / (pts.length - 1);
    const [px, py] = pts[i];
    const [qx, qy] = pts[Math.min(pts.length - 1, i + 2)];
    const ta = Math.atan2(qy - py, qx - px);
    const pl = maxP * Math.pow(Math.sin(Math.min(1, t * 1.35 + 0.05) * Math.PI), 0.7) * (1 - t * 0.35) + 0.8;
    for (const side of [-1, 1]) {
      const pa = ta + side * 0.8;
      // the side facing the sky is lit; the underside is darker (or silver)
      const upward = Math.sin(pa) < 0;
      const col = upward ? top : under;
      for (let s = 0.8; s < pl; s += 0.6) {
        const f = s / pl;
        const sx = px + Math.cos(pa) * s;
        const sy = py + Math.sin(pa) * s + f * f * 1.6;
        buf.set(sx, sy, col);
      }
    }
  }
  for (const [px, py] of pts) buf.set(px, py, mid);
  return pts;
}

export interface TreeFernOpts {
  height: number;
  span?: number;
  fronds?: number;
  lean?: number;
  ramp?: C[];
  bark?: C[];
  silver?: boolean;
  skirt?: boolean;
  koru?: boolean;
}

/** New Zealand-style tree fern (ponga) with dead-frond skirt and a koru at the crown. */
export function paintTreeFern(seed: number, o: TreeFernOpts) {
  const rng = new Rng(seed);
  const span = o.span ?? o.height * 0.55 + 16;
  const W = Math.ceil(span * 2 + 12), H = Math.ceil(o.height + span * 0.5 + 8);
  const buf = new PixelBuffer(W, H);
  const R = o.ramp ?? PAL.fern;
  const BK = o.bark ?? PAL.bark;
  const cx = W / 2, baseY = H - 1;
  const lean = o.lean ?? rng.range(-6, 6);
  const topX = cx + lean, topY = baseY - o.height;
  // trunk with frond-base lattice
  const tw = Math.max(2.5, o.height / 34);
  for (let y = baseY; y >= topY; y--) {
    const t = (baseY - y) / o.height;
    const x = cx + lean * t * t;
    const r = tw * (1.15 - t * 0.3);
    for (let dx = -r; dx <= r; dx++) {
      const nx = dx / r;
      const lat = ((Math.floor(y / 3) + Math.floor((dx + 10) / 2)) & 1) === 0;
      let c = nx < -0.35 ? BK[4] : nx > 0.45 ? BK[1] : BK[3];
      if (lat && (y % 3 === 0)) c = BK[1];
      if (rng.chance(0.04)) c = BK[5];
      buf.set(x + dx, y, c);
    }
  }
  // dead frond skirt: brown fronds hanging down around the trunk top
  if (o.skirt ?? true) {
    const n = rng.int(5, 8);
    for (let i = 0; i < n; i++) {
      const off = ((i + 0.5) / n - 0.5) * tw * 3.2;
      const len = o.height * rng.range(0.16, 0.3);
      const x0 = topX + off, y0 = topY + 2;
      const c1 = rng.chance(0.5) ? PAL.bark[4] : PAL.bark[5], c2 = PAL.bark[2];
      for (let s = 0; s < len; s += 0.7) {
        const px = x0 + off * 0.35 * (s / len) + Math.sin(s * 0.5 + i) * 0.4, py = y0 + s;
        buf.set(px, py, c1);
        if (Math.floor(s) % 3 === 0 && s > 1) {
          buf.set(px - 1, py + 1, c2);
          buf.set(px + 1, py + 1, c2);
        }
      }
    }
  }
  // crown fronds: back (dark) then front (light)
  const nf = o.fronds ?? rng.int(8, 11);
  const angles: number[] = [];
  for (let i = 0; i < nf; i++) angles.push(-Math.PI / 2 + ((i + 0.5) / nf - 0.5) * 3.25 + rng.range(-0.1, 0.1));
  const order = angles.map((a, i) => ({ a, back: i % 2 === 0 }));
  for (const pass of [true, false]) {
    for (const f of order) {
      if (f.back !== pass) continue;
      const len = span * rng.range(0.78, 1.0);
      const dk = pass ? 1 : 0;
      const top = R[Math.max(0, 5 - dk * 2)], mid = R[Math.max(0, 4 - dk * 2)];
      const under = o.silver ? mix(PAL.white[4], R[3], 0.35) : R[Math.max(0, 3 - dk * 2)];
      frond(buf, topX, topY, f.a, len, 1.2 + Math.abs(Math.cos(f.a)) * 2.6, top, mid, under, 1);
    }
  }
  // highlight flecks on front fronds
  buf.map((c, x, y) => (c === R[5] && fbm2(x * 0.3, y * 0.3, 2, seed) > 0.64 ? R[6] : c));
  // koru
  if (o.koru ?? true) {
    const kx = topX + rng.range(-2, 2), ky = topY - 2;
    for (let s = 0; s < 8; s += 0.5) buf.set(kx, ky - s, R[5]);
    for (let a = 0; a < TAU * 1.1; a += 0.2) {
      const rr = 2.6 - a * 0.33;
      buf.set(kx + 1 + Math.cos(a - Math.PI) * rr, ky - 9 + Math.sin(a - Math.PI) * rr, R[6]);
    }
  }
  return { buf, ax: cx, ay: baseY + 1 };
}

export interface TrunkOpts {
  width: number;
  height: number;
  bark?: C[];
  moss?: number;
  flare?: number;
  seed: number;
  smooth?: boolean;
  vines?: number;
}

/** Tall straight trunk segment (kauri / canopy giant) with cylinder shading & bark texture. */
export function paintTrunk(o: TrunkOpts) {
  const rng = new Rng(o.seed);
  const flare = o.flare ?? o.width * 0.6;
  const W = Math.ceil(o.width + flare * 2 + 6), H = o.height;
  const buf = new PixelBuffer(W, H);
  const BK = o.bark ?? PAL.barkGrey;
  const cx = W / 2;
  for (let y = 0; y < H; y++) {
    const fromBase = H - y;
    const f = flare * Math.exp(-fromBase / (o.width * 0.9));
    const half = o.width / 2 + f + (noise1(y * 0.05, o.seed) - 0.5) * 2;
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      const nx = (x + 0.5 - cx) / half;
      if (Math.abs(nx) > 1) continue;
      // cylinder light from upper left
      let l = -nx * 0.75 + Math.sqrt(1 - nx * nx) * 0.4 - 0.1;
      const tex = o.smooth
        ? (fbm2(x * 0.18, y * 0.05, 3, o.seed) - 0.5) * 0.7
        : (fbm2(x * 0.35, y * 0.08, 3, o.seed) - 0.5) * 1.1 + (noise1(x * 0.9 + (y >> 3), o.seed) > 0.8 ? -0.35 : 0);
      l += tex + (bayer(x, y) - 0.5) * 0.25;
      const i = clamp(Math.round((l * 0.5 + 0.5) * (BK.length - 2)) + 1, 0, BK.length - 1);
      let c = BK[i];
      // moss on the lit/top-facing side
      if (o.moss) {
        const m = fbm2(x * 0.2, y * 0.03, 3, o.seed + 11);
        if (m > 1 - o.moss * 0.55 && nx < 0.3) c = PAL.moss[clamp(Math.round(2 + l * 2), 1, 5)];
      }
      if (Math.abs(nx) > 0.92) c = BK[0];
      buf.data[y * W + x] = c;
    }
  }
  // hanging vines
  for (let v = 0; v < (o.vines ?? 0); v++) {
    const vx = cx + rng.range(-o.width * 0.5, o.width * 0.5);
    const len = rng.range(H * 0.3, H * 0.9);
    const y0 = rng.range(0, H * 0.2);
    for (let s = 0; s < len; s++) {
      const x = vx + Math.sin(s * 0.08 + v) * 2.5;
      buf.set(x, y0 + s, PAL.leafDeep[2]);
      if (s % 5 === 0) {
        buf.set(x + 1, y0 + s, PAL.leafDeep[4]);
        buf.set(x - 1, y0 + s + 1, PAL.leafDeep[3]);
      }
    }
  }
  return { buf, ax: cx, ay: H };
}

/** A big broadleaf canopy crown (for canopy giants / mid layers). */
export function paintCrown(seed: number, w: number, h: number, ramp: C[] = PAL.leafDeep, leaf = 2.4) {
  const rng = new Rng(seed);
  const buf = new PixelBuffer(w, h);
  const blobs = rng.int(5, 8);
  const list: { x: number; y: number; rx: number; ry: number }[] = [];
  for (let i = 0; i < blobs; i++) {
    const rx = rng.range(w * 0.18, w * 0.3), ry = rx * rng.range(0.55, 0.8);
    list.push({ x: rng.range(rx, w - rx), y: rng.range(ry, h - ry), rx, ry });
  }
  list.sort((a, b) => b.y - a.y);
  for (const b of list) foliage(buf, b.x, b.y, b.rx, b.ry, ramp, rng, leaf, 1, -0.55, (h / 2 - b.y) / h * 0.6);
  return buf;
}

/** Kauri-like giant: trunk + branch arms + clumped crown. */
export function paintKauri(seed: number, height: number, width: number) {
  const rng = new Rng(seed);
  const crownH = Math.round(height * 0.35), crownW = Math.round(width * 7);
  const W = Math.max(crownW, width * 3), H = height + 4;
  const buf = new PixelBuffer(W, H);
  const trunk = paintTrunk({ width, height: height - crownH * 0.5, seed, bark: PAL.barkGrey, smooth: true, moss: 0.35, flare: width * 0.5 });
  buf.blit(trunk.buf, W / 2 - trunk.buf.w / 2, H - trunk.buf.h);
  const topY = H - trunk.buf.h;
  // branch arms
  const arms = rng.int(3, 5);
  const clumps: P[] = [];
  for (let i = 0; i < arms; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const y0 = topY + rng.range(0, crownH * 0.4);
    const len = rng.range(crownW * 0.25, crownW * 0.45);
    const pts: P[] = [];
    for (let s = 0; s <= 1; s += 0.05) pts.push([W / 2 + side * len * s, y0 - len * 0.45 * Math.sin(s * 1.4)]);
    buf.stroke(pts, t => (width * 0.28) * (1 - t * 0.6), (t, x, y) => PAL.barkGrey[clamp(Math.round(4 - t + (bayer(x, y) - 0.5)), 1, 6)]);
    clumps.push(pts[pts.length - 1]);
    clumps.push(pts[Math.floor(pts.length * 0.6)]);
  }
  clumps.push([W / 2, topY - crownH * 0.2]);
  for (const [x, y] of clumps) foliage(buf, x, y - 4, rng.range(crownW * 0.1, crownW * 0.16), rng.range(8, 13), PAL.leafOlive, rng, 1.7, 1.1);
  // astelia epiphytes (spiky tufts)
  for (let i = 0; i < 3; i++) {
    const [x, y] = clumps[rng.int(0, clumps.length - 1)];
    astelia(buf, x + rng.range(-6, 6), y + 6, rng);
  }
  return { buf, ax: W / 2, ay: H };
}

function astelia(buf: PixelBuffer, x: number, y: number, rng: Rng) {
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i / 8 - 0.5) * 2.6;
    const len = rng.range(5, 9);
    for (let s = 0; s < len; s += 0.6) buf.set(x + Math.cos(a) * s, y + Math.sin(a) * s + (s / len) * 2, s < len * 0.6 ? PAL.leafOlive[5] : PAL.leafOlive[6]);
  }
}

/** Nikau-style palm. */
export function paintNikau(seed: number, height: number) {
  const rng = new Rng(seed);
  const span = height * 0.4 + 14;
  const W = Math.ceil(span * 2 + 8), H = Math.ceil(height + span * 0.8);
  const buf = new PixelBuffer(W, H);
  const cx = W / 2, baseY = H - 1;
  const lean = rng.range(-5, 5);
  const topY = baseY - height;
  for (let y = baseY; y >= topY; y--) {
    const t = (baseY - y) / height;
    const x = cx + lean * t;
    const ring = y % 4 === 0;
    for (let dx = -2; dx <= 2; dx++) buf.set(x + dx, y, ring ? PAL.barkGrey[3] : dx < 0 ? PAL.barkGrey[6] : dx > 0 ? PAL.barkGrey[4] : PAL.barkGrey[5]);
  }
  const tx = cx + lean;
  // crown shaft bulge
  buf.shadedEllipse(tx, topY - 3, 4, 7, PAL.leafOlive.slice(2, 7));
  // fronds: feather-duster
  for (let i = 0; i < 11; i++) {
    const a = -Math.PI / 2 + (i / 10 - 0.5) * 2.0 + rng.range(-0.08, 0.08);
    frond(buf, tx, topY - 8, a, span * rng.range(0.85, 1.05), 1.0 + Math.abs(Math.cos(a)) * 2.4, PAL.leafOlive[5], PAL.leafOlive[4], PAL.leafOlive[2], 1.4);
  }
  return { buf, ax: cx, ay: baseY + 1 };
}

/** Low crown fern / ground fern rosette. */
export function paintGroundFern(seed: number, size: number, ramp: C[] = PAL.fern) {
  const rng = new Rng(seed);
  const W = Math.ceil(size * 2.4), H = Math.ceil(size * 1.3);
  const buf = new PixelBuffer(W, H);
  const cx = W / 2, cy = H - 2;
  const n = rng.int(7, 10);
  for (const pass of [0, 1]) {
    for (let i = 0; i < n; i++) {
      if (i % 2 !== pass) continue;
      const a = -Math.PI / 2 + ((i + 0.5) / n - 0.5) * 3.1;
      const d = pass === 0 ? 2 : 0;
      frond(buf, cx, cy, a, size * rng.range(0.85, 1.15), 2.4, ramp[5 - d], ramp[4 - d], ramp[3 - d], 1.3);
    }
  }
  return { buf, ax: cx, ay: H };
}

/** Round leafy bush - also used as a hiding spot. */
export function paintBush(seed: number, w: number, h: number, ramp: C[] = PAL.leafDeep, flowers?: C[]) {
  const rng = new Rng(seed);
  const buf = new PixelBuffer(w, h);
  const n = rng.int(3, 5);
  for (let i = 0; i < n; i++) {
    const rx = w * rng.range(0.22, 0.34), ry = h * rng.range(0.32, 0.45);
    const x = w * (0.2 + (i / (n - 1 || 1)) * 0.6) + rng.range(-3, 3);
    const y = h - ry - rng.range(0, h * 0.25);
    foliage(buf, x, y, rx, ry, ramp, rng, 2.1, 1.2);
  }
  // flatten bottom
  for (let y = h - 2; y < h; y++) for (let x = 0; x < w; x++) if (buf.opaque(x, y - 2)) buf.set(x, y, ramp[1]);
  if (flowers) {
    for (let i = 0; i < w / 5; i++) {
      const x = rng.range(3, w - 3), y = rng.range(3, h * 0.7);
      if (!buf.opaque(x, y)) continue;
      buf.set(x, y, flowers[5]);
      buf.set(x + 1, y, flowers[4]);
      buf.set(x, y + 1, flowers[3]);
    }
  }
  buf.outline(c => shade(c, -0.55));
  return { buf, ax: w / 2, ay: h };
}

export function paintGrassTuft(seed: number, h: number, ramp: C[] = PAL.moss, blades = 7) {
  const rng = new Rng(seed);
  const W = Math.ceil(h * 1.3) + 4;
  const buf = new PixelBuffer(W, h + 1);
  for (let i = 0; i < blades; i++) {
    const x0 = W / 2 + rng.range(-h * 0.35, h * 0.35);
    const len = h * rng.range(0.55, 1);
    const bend = rng.range(-0.6, 0.6);
    const col = ramp[rng.int(3, ramp.length - 1)];
    for (let s = 0; s < len; s += 0.5) {
      const t = s / len;
      buf.set(x0 + bend * t * t * len * 0.6, h - s, t > 0.8 ? shade(col, 0.2) : t < 0.25 ? ramp[2] : col);
    }
  }
  return { buf, ax: W / 2, ay: h + 1 };
}

export function paintFlowerClump(seed: number, ramp: C[], n = 5) {
  const rng = new Rng(seed);
  const W = 16, H = 14;
  const buf = new PixelBuffer(W, H);
  for (let i = 0; i < n; i++) {
    const x = rng.range(3, W - 3), top = rng.range(2, 7);
    for (let y = H - 1; y > top; y--) buf.set(x + (y - top) * 0.08, y, PAL.moss[3]);
    buf.set(x, top, ramp[5]);
    buf.set(x - 1, top, ramp[4]);
    buf.set(x + 1, top, ramp[4]);
    buf.set(x, top - 1, ramp[4]);
    buf.set(x, top + 1, ramp[3]);
    buf.set(x, top, ramp[6]);
  }
  return { buf, ax: W / 2, ay: H };
}

/** Rata-style flowering vine cluster (red pom-poms) for trunks & canopy. */
export function paintRata(seed: number, w: number, h: number) {
  const rng = new Rng(seed);
  const buf = new PixelBuffer(w, h);
  foliage(buf, w / 2, h / 2, w * 0.45, h * 0.4, PAL.leafOlive, rng, 1.6);
  for (let i = 0; i < (w * h) / 40; i++) {
    const x = rng.range(2, w - 2), y = rng.range(2, h - 2);
    if (!buf.opaque(x, y)) continue;
    buf.discFn(x, y, 1.6, (_x, _y, nx, ny) => (ny < 0 ? PAL.red[6] : nx > 0 ? PAL.red[4] : PAL.red[5]));
  }
  return buf;
}

export function paintMushrooms(seed: number, glow = false) {
  const rng = new Rng(seed);
  const W = 18, H = 12;
  const buf = new PixelBuffer(W, H);
  const n = rng.int(2, 4);
  for (let i = 0; i < n; i++) {
    const x = 3 + i * 4 + rng.range(-1, 1), hgt = rng.range(3, 8), cr = rng.range(1.8, 3.2);
    for (let y = H - 1; y > H - hgt; y--) buf.set(x, y, glow ? PAL.glowCyan[4] : PAL.white[5]);
    const cy = H - hgt;
    buf.ellipseFn(x, cy, cr, cr * 0.6, (_x, _y, nx, ny) => {
      if (ny > 0.3) return -1;
      if (glow) return ny < -0.3 ? PAL.glowCyan[6] : PAL.glowCyan[5];
      return ny < -0.35 ? PAL.canvasOrange[6] : nx > 0.3 ? PAL.canvasOrange[3] : PAL.canvasOrange[5];
    });
  }
  return { buf, ax: W / 2, ay: H };
}

export function paintRock(seed: number, w: number, h: number, ramp: C[] = PAL.stone, moss = 0.5) {
  const rng = new Rng(seed);
  const buf = new PixelBuffer(w, h);
  const cx = w / 2, cy = h * 0.62;
  buf.ellipseFn(cx, cy, w / 2 - 1, h * 0.62 - 1, (x, y, nx, ny) => {
    const e = Math.hypot(nx, ny) + (fbm2(x * 0.2, y * 0.2, 2, seed) - 0.5) * 0.3;
    if (e > 1 || y > h - 1) return -1;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    let l = -nx * 0.5 - ny * 0.6 + nz * 0.4 + (fbm2(x * 0.3, y * 0.3, 2, seed + 1) - 0.5) * 0.5 + (bayer(x, y) - 0.5) * 0.3;
    let c = ramp[clamp(Math.round((l * 0.5 + 0.5) * (ramp.length - 1)), 0, ramp.length - 1)];
    if (moss > 0 && ny < -0.2 && fbm2(x * 0.25, y * 0.5, 2, seed + 2) > 1 - moss) c = PAL.moss[clamp(Math.round(3 + l * 2), 2, 6)];
    return c;
  });
  // crack lines
  for (let i = 0; i < rng.int(0, 2); i++) {
    let x = rng.range(w * 0.3, w * 0.7), y = rng.range(h * 0.3, h * 0.6);
    for (let s = 0; s < h * 0.4; s++) {
      buf.paint(x, y, ramp[1]);
      x += rng.range(-0.8, 0.8);
      y += 1;
    }
  }
  buf.outline(c => shade(c, -0.6));
  return { buf, ax: w / 2, ay: h };
}

export function paintLog(seed: number, len: number, r: number) {
  const W = Math.ceil(len + 4), H = Math.ceil(r * 2 + 6);
  const buf = new PixelBuffer(W, H);
  const cy = H - r - 1;
  for (let x = 2; x < W - 2; x++) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      const ny = (y + 0.5 - cy) / r;
      if (Math.abs(ny) > 1) continue;
      let l = -ny * 0.8 + (fbm2(x * 0.1, y * 0.4, 3, seed) - 0.5) * 1.0 + (bayer(x, y) - 0.5) * 0.3;
      let c = PAL.bark[clamp(Math.round((l * 0.5 + 0.5) * 6), 1, 6)];
      if (ny < -0.35 && fbm2(x * 0.08, y * 0.2, 2, seed + 7) > 0.42) c = PAL.moss[clamp(Math.round(3 + l * 2 - ny), 2, 6)];
      buf.set(x, y, c);
    }
  }
  // end cap rings
  buf.ellipseFn(W - 3, cy, 2.5, r, (_x, _y, nx, ny) => {
    const d = Math.hypot(nx, ny);
    return d > 0.8 ? PAL.bark[2] : Math.floor(d * 4) % 2 ? PAL.bark[5] : PAL.bark[6];
  });
  buf.outline(c => shade(c, -0.6));
  return { buf, ax: W / 2, ay: H };
}

/** Hanging liana / vine strand. */
export function paintVine(seed: number, len: number, ramp: C[] = PAL.leafDeep) {
  const rng = new Rng(seed);
  const W = 14, H = len;
  const buf = new PixelBuffer(W, H);
  const cx = W / 2;
  for (let y = 0; y < H; y++) {
    const x = cx + Math.sin(y * 0.06 + seed) * 2.5;
    buf.set(x, y, ramp[2]);
    if (rng.chance(0.3)) {
      const side = rng.sign();
      buf.set(x + side, y, ramp[4]);
      buf.set(x + side * 2, y + 1, ramp[5]);
      if (rng.chance(0.5)) buf.set(x + side * 3, y + 1, ramp[3]);
    }
  }
  return { buf, ax: W / 2, ay: 0 };
}

/** Mangrove tree with arching prop roots. */
export function paintMangrove(seed: number, w: number, h: number) {
  const rng = new Rng(seed);
  const buf = new PixelBuffer(w, h);
  const cx = w / 2;
  const rootTop = h * 0.62;
  // roots
  const roots = rng.int(6, 9);
  for (let i = 0; i < roots; i++) {
    const endX = cx + ((i + 0.5) / roots - 0.5) * w * 0.9;
    const pts: P[] = [];
    for (let t = 0; t <= 1; t += 0.05) {
      const x = cx + (endX - cx) * t;
      const y = rootTop + (h - rootTop) * (t * t) - Math.sin(t * Math.PI) * h * 0.08;
      pts.push([x, y]);
    }
    buf.stroke(pts, t => 2.2 - t * 1.2, (t, x, y) => PAL.bark[clamp(Math.round(4 - t * 2 + (bayer(x, y) - 0.5)), 1, 6)]);
  }
  // trunk
  buf.stroke([[cx, rootTop + 4], [cx + 2, h * 0.3]], () => 3.2, (_t, x, y) => PAL.bark[x < cx ? 5 : 3 + (bayer(x, y) > 0.5 ? 1 : 0)]);
  // canopy
  foliage(buf, cx, h * 0.25, w * 0.42, h * 0.2, PAL.leafOlive, rng, 2.0, 1.1);
  foliage(buf, cx - w * 0.2, h * 0.3, w * 0.25, h * 0.14, PAL.leafOlive, rng, 2.0, 1.1, -0.55, -0.1);
  foliage(buf, cx + w * 0.22, h * 0.28, w * 0.25, h * 0.14, PAL.leafOlive, rng, 2.0, 1.1, -0.55, -0.1);
  return { buf, ax: cx, ay: h };
}

/** Big foreground leaf silhouette (for depth framing). */
export function paintBigLeaf(seed: number, len: number, ramp: C[] = PAL.leafDeep) {
  const rng = new Rng(seed);
  const W = Math.ceil(len * 0.55) + 4, H = Math.ceil(len) + 4;
  const buf = new PixelBuffer(W, H);
  const cx = W / 2;
  const bend = rng.range(-0.25, 0.25);
  for (let y = 0; y < len; y++) {
    const t = y / len;
    const half = Math.sin(Math.min(1, t * 1.15) * Math.PI) * W * 0.45 * (1 - t * 0.3);
    const mx = cx + bend * t * t * len * 0.5;
    for (let x = Math.floor(mx - half); x <= mx + half; x++) {
      const side = x < mx ? -1 : 1;
      const vein = Math.abs(x - mx) < 0.8;
      const rib = Math.abs(((Math.abs(x - mx) * 0.9 + y * 0.5) % 6) - 0) < 0.7;
      let c = side < 0 ? ramp[3] : ramp[2];
      if (rib) c = shade(c, -0.15);
      if (vein) c = ramp[4];
      buf.set(x, H - 2 - y, c);
    }
  }
  return { buf, ax: cx, ay: H - 1 };
}

/** Moss / leaf-litter strip used along ground tops. */
export function paintLitterDots(buf: PixelBuffer, seed: number, y0: number, y1: number, cols: C[], density = 0.08) {
  const rng = new Rng(seed);
  const n = Math.floor(buf.w * (y1 - y0) * density);
  for (let i = 0; i < n; i++) {
    const x = rng.range(0, buf.w), y = rng.range(y0, y1);
    buf.paint(x, y, rng.pick(cols));
  }
}

export { hex, withAlpha, OUTLINE };

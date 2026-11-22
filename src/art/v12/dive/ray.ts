// V12 Te Moana Rimurimu: the eagle ray (whai repo, Myliobatis tenuicaudatus) gliding over the sand.
//
// A side-view game sees a ray edge on, a line, so the ray is painted as a solid seen a little from above
// (the camera's elevation, as the beasts' wings are): its body is a real 3D surface over its planform,
// projected and lit per pixel. The planform is one outline through the landmarks of the disc: the
// rounded "eagle" head jutting ahead of the wings with the eyes and spiracles on its sides, the long
// straight leading edges out to the pointed wingtips, the concave trailing edges back to the pelvic fins,
// and the whip of a tail with its little dorsal fin and the sting at its root. Over it the body rises in
// a dome: the raised shoulders over the pectoral girdle, the spine ridge, the wings thinning to a knife
// edge. The wings beat in a wave that runs from the leading edge back to the tips (the flap is a height
// field added to the dome), so the near wing swings down past the body and the far wing rises behind it.
// Skin: olive-grey with the NZ eagle ray's pattern of pale blue-grey spots and wavy bars, darker along
// the spine, the head a shade warmer; the white underside shows only along a lifted wing's rim.
//
// Anims (anchor: the middle of the disc, facing right): swim (the wingbeat), glide, feed (nose down in
// the sand, wings fanning to blow it clear), turn (banking: it rolls toward us; play it, flip, play it back).

import { PixelBuffer } from '../../pixel';
import { C, hex } from '../../color';
import { lmix } from '../../beasts-core';
import type { Sk, SpeciesDef, AnimDef } from '../../beasts-core';
import { inPoly, hash } from '../../v9/fish-skin';
import { fbm } from '../../v9/fish-skin';

type V2 = [number, number];
const TAU = Math.PI * 2;
const ramp = (...h: string[]) => h.map(x => hex(x));
const TOP = ramp('#16180f', '#22261a', '#303626', '#414833', '#545c43', '#6a7356', '#83896c');
const SPOT = ramp('#4e626a', '#677e86', '#829aa0', '#a0b6ba', '#bed0d0');
const BELLY = ramp('#8a8e88', '#aeb2aa', '#cfd2c8', '#e8eae2', '#f8f8f2');
const INK = hex('#0a0b07');

// the half planform (z >= 0), head to tail: one outline through the landmarks
const HALF: V2[] = [
  [0.335, 0.0], [0.33, 0.026], [0.315, 0.046], [0.29, 0.06], [0.255, 0.066], [0.22, 0.062], [0.2, 0.064],
  [0.15, 0.15], [0.09, 0.25], [0.02, 0.35], [-0.05, 0.44], [-0.1, 0.49], [-0.125, 0.505],
  [-0.14, 0.485], [-0.16, 0.43], [-0.19, 0.34], [-0.23, 0.23], [-0.27, 0.15], [-0.31, 0.1],
  [-0.35, 0.085], [-0.4, 0.06], [-0.42, 0.03], [-0.43, 0.0],
];
const OUT: V2[] = [...HALF, ...HALF.slice(1, -1).reverse().map(([x, z]) => [x, -z] as V2)];
const inside = (x: number, z: number) => inPoly(OUT, x, z);

export interface RayPose { flap: number; phase: number; pitch?: number; roll?: number; tailSway?: number }
const PHI = 0.62;
const CP = Math.cos(PHI), SP = Math.sin(PHI);

/** the top surface height at planform (x, z) */
function heightAt(x: number, z: number, P: RayPose): number {
  const az = Math.abs(z);
  // the body dome: thick along the middle, the shoulders over the pectoral girdle, thin wings
  const along = Math.exp(-(((x + 0.02) / 0.26) ** 2));
  let y = 0.075 * Math.exp(-((az / 0.11) ** 2)) * (0.45 + 0.55 * along);
  y += 0.012 * Math.exp(-(((az - 0.09) / 0.05) ** 2)) * Math.exp(-(((x - 0.06) / 0.1) ** 2));
  // the head: a rounded bulb a little lower than the disc
  if (x > 0.19) y = 0.045 * Math.sqrt(Math.max(0, 1 - ((x - 0.25) / 0.09) ** 2)) * Math.exp(-((az / 0.07) ** 2)) + 0.012;
  y += 0.008 * (1 - Math.min(1, az / 0.5));
  // the wingbeat: a wave running from the leading edge back to the tips
  const w = Math.pow(Math.min(1, az / 0.5), 1.5);
  y += P.flap * Math.sin(P.phase * TAU - (0.2 - x) * 3 - az * 1.6) * w;
  // pitch (nose down) and roll (toward the viewer) as shears
  y += -(P.pitch ?? 0) * x;
  y -= (P.roll ?? 0) * z;
  return y;
}

interface Hit { x: number; z: number; y: number; d: number; nx: number; ny: number; nz: number; part: number }
/** paint one frame: span px from wingtip to wingtip; the anchor (disc middle) lands at (ax, ay) */
export function paintRay(span: number, w: number, h: number, ax: number, ay: number, P: RayPose): PixelBuffer {
  const S = span;
  const buf = new PixelBuffer(w, h);
  const zb: (Hit | null)[] = new Array(w * h).fill(null);
  const proj = (x: number, y: number, z: number): [number, number, number] => [ax + x * S, ay + (-(y * CP) + z * SP) * S, z * CP + y * SP];
  // the tail: a thin whip behind (drawn first, under the disc)
  const sway = P.tailSway ?? 0;
  const tailPts: [number, number, number][] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, x = -0.42 - t * 0.7, y = 0.012 - t * 0.02 + Math.sin(t * 3 + sway) * 0.02 * t, z = Math.sin(t * 2.4 + sway) * 0.04 * t;
    tailPts.push(proj(x, y - (P.pitch ?? 0) * x, z));
  }
  const step = 1 / (S * 2.2);
  // the disc
  for (let x = -0.44; x <= 0.34; x += step) for (let z = -0.51; z <= 0.51; z += step) {
    if (!inside(x, z)) continue;
    const y = heightAt(x, z, P);
    const [sx, sy, d] = proj(x, y, z);
    const px = Math.floor(sx), py = Math.floor(sy);
    if (px < 0 || py < 0 || px >= w || py >= h) continue;
    const i = py * w + px, o = zb[i];
    if (o && o.d >= d) continue;
    if (o) { o.x = x; o.z = z; o.y = y; o.d = d; } else zb[i] = { x, z, y, d, nx: 0, ny: 1, nz: 0, part: z >= 0 ? 1 : 2 };
  }
  // the surface normal of each pixel's winning sample (one gradient per pixel, not per sample)
  for (const q of zb) {
    if (!q) continue;
    const e = 0.004;
    const dx = (heightAt(q.x + e, q.z, P) - heightAt(q.x - e, q.z, P)) / (2 * e), dz = (heightAt(q.x, q.z + e, P) - heightAt(q.x, q.z - e, P)) / (2 * e);
    const nl = Math.hypot(dx, 1, dz);
    q.nx = -dx / nl; q.ny = 1 / nl; q.nz = -dz / nl;
  }
  // the light: from above, ahead and a little toward us (body frame: x fwd, y up, z to the viewer)
  const L = (() => { const l = [0.35, 0.85, 0.4]; const n = Math.hypot(l[0], l[1], l[2]); return l.map(v => v / n); })();
  // the tail line
  for (let i = 1; i < tailPts.length; i++) {
    const [x0, y0] = tailPts[i - 1], [x1, y1] = tailPts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let k = 0; k <= n; k++) {
      const X = Math.floor(x0 + (x1 - x0) * (k / n)), Y = Math.floor(y0 + (y1 - y0) * (k / n));
      if (X < 0 || Y < 0 || X >= w || Y >= h || zb[Y * w + X]) continue;
      buf.data[Y * w + X] = i < 24 ? TOP[3] : i < 44 ? TOP[2] : TOP[4];
    }
  }
  // the little dorsal fin at the tail root and the sting
  {
    const [bx, by] = tailPts[5];
    for (let k = 0; k < 4; k++) for (let j = 0; j <= k; j++) {
      const X = Math.floor(bx - 3 + k), Y = Math.floor(by - 1 - (3 - k) + j - 1);
      if (X >= 0 && Y >= 0 && X < w && Y < h && !zb[Y * w + X]) buf.data[Y * w + X] = TOP[3];
    }
  }
  // shade the disc
  const eyeZ = 0.064, eyeX = 0.252;
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const q = zb[py * w + px];
    if (!q) continue;
    const lam = q.nx * L[0] + q.ny * L[1] + q.nz * L[2];
    // a few clean bands: lit shoulders and leading edges, mid wings, shadowed trailing edges
    let t = 0.5 + lam * 5.4;
    if (q.ny < 0.2) t -= 0.6;
    const az = Math.abs(q.z);
    // darker along the spine ridge, warmer head
    if (az < 0.018 && q.x < 0.2 && q.x > -0.4) t -= 0.9;
    let c: C;
    // the spots and wavy bars of pale blue-grey on the wings and back (fixed to the skin)
    const n = fbm(q.x * 14 + 3, q.z * 14, 5);
    // pale spots on a jittered lattice fixed to the skin, each a cluster several pixels across
    const K = 11, gx = (q.x + 1) * K, gz = (q.z + 1) * K, ix = Math.floor(gx), iz = Math.floor(gz);
    let spot = false;
    for (let j = -1; j <= 1 && !spot; j++) for (let i = -1; i <= 1 && !spot; i++) {
      const hx = ix + i, hz = iz + j;
      if (hash(hx, hz, 7) > 0.55) continue;
      const ox = hx + 0.25 + hash(hx, hz, 8) * 0.5, oz = hz + 0.25 + hash(hx, hz, 9) * 0.5;
      if (Math.hypot(gx - ox, (gz - oz) * 1.3) < 0.2 + hash(hx, hz, 10) * 0.14) spot = true;
    }
    spot = spot && q.x < 0.19 && az > 0.035;
    // and the wavy pale bars across the outer wings
    const bar = Math.abs(Math.sin(q.x * 13 + Math.sin(q.z * 7) * 1.6)) < 0.09 && az > 0.22 && az < 0.47 && q.x < 0.06;
    if ((spot && S > 40) || bar) c = SPOT[Math.max(0, Math.min(SPOT.length - 1, Math.round(t * 0.7)))];
    else c = TOP[Math.max(0, Math.min(TOP.length - 1, Math.round(t + (n - 0.5) * 0.8)))];
    // the white underside showing along the rim of a wing lifted edge-on
    if (q.ny < 0.05 && q.nz * (q.z > 0 ? 1 : -1) > 0.4) c = BELLY[2];
    buf.data[py * w + px] = c;
  }
  // inner ink: where the near wing passes over the body or the far wing (a depth step)
  const src = buf.data.slice();
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const i = py * w + px, q = zb[i];
    if (!q) continue;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const X = px + dx, Y = py + dy;
      if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
      const o = zb[Y * w + X];
      if (o && q.d - o.d > 0.06 && Math.abs(q.z - o.z) > 0.08) { buf.data[i] = lmix(INK, src[i], 0.45); break; }
    }
  }
  // the eyes on the sides of the head and the spiracles behind them
  for (const s of [1, -1]) {
    const ey = heightAt(eyeX, s * eyeZ, P) + 0.006;
    const [ex, eyy] = proj(eyeX, ey, s * eyeZ);
    const X = Math.floor(ex), Y = Math.floor(eyy);
    if (s > 0 || zb[Y * w + X]?.z! < 0) {
      if (X >= 0 && Y >= 0 && X < w && Y < h) {
        buf.data[Y * w + X] = hex('#08090a');
        if (X + 1 < w) buf.data[Y * w + X + 1] = hex('#c89a3a');
        if (Y - 1 >= 0) buf.data[(Y - 1) * w + X] = lmix(TOP[1], INK, 0.3);
      }
    }
    const [spx, spy] = proj(eyeX - 0.04, heightAt(eyeX - 0.04, s * 0.05, P), s * 0.05);
    const X2 = Math.floor(spx), Y2 = Math.floor(spy);
    if (s > 0 && X2 >= 0 && Y2 >= 0 && X2 < w && Y2 < h && zb[Y2 * w + X2]) buf.data[Y2 * w + X2] = TOP[0];
  }
  // the outline: a darker hue of what it wraps, lighter where the light grazes the top edge
  const s2 = buf.data.slice();
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const i = py * w + px;
    if (s2[i] >>> 24) continue;
    const lo = py + 1 < h && s2[i + w] >>> 24, up = py > 0 && s2[i - w] >>> 24, le = px > 0 && s2[i - 1] >>> 24, ri = px + 1 < w && s2[i + 1] >>> 24;
    if (!(lo || up || le || ri)) continue;
    const k = lo ? i + w : ri ? i + 1 : up ? i - w : i - 1;
    buf.data[i] = lmix(INK, s2[k] | 0xff000000, lo && !up ? 0.4 : 0.18);
  }
  return buf;
}

const A = (frames: number, fps: number, loop = true): AnimDef => ({ frames, fps, loop });
export const RAY_ANIMS: Record<string, AnimDef> = { idle: A(4, 3), swim: A(8, 7), glide: A(4, 3), feed: A(6, 7), turn: A(4, 8, false) };
function rayPose(anim: string, f: number, n: number): RayPose {
  const t = f / n;
  switch (anim) {
    case 'swim': return { flap: 0.13, phase: t, tailSway: t * TAU };
    case 'feed': return { flap: 0.05, phase: t * 2, pitch: 0.34, tailSway: t * TAU };
    case 'turn': return { flap: 0.04, phase: t, roll: [0.15, 0.35, 0.55, 0.7][f], tailSway: f };
    default: return { flap: 0.022, phase: t, tailSway: t * TAU };
  }
}
export const RAY_SPAN = 72;
const RW = 170, RH = 96, ROX = 108, ROY = 46;
export const EAGLERAY: SpeciesDef = {
  name: 'Eagle ray', kind: 'fish', len: 110, height: 30, anims: RAY_ANIMS,
  anchor: Object.fromEntries(Object.keys(RAY_ANIMS).map(k => [k, 'centre'])) as Record<string, 'centre'>,
  canvas: () => ({ w: RW, h: RH, ox: ROX, oy: ROY }),
  draw(sk: Sk, anim: string, frame: number) {
    const n = RAY_ANIMS[anim]?.frames ?? 1;
    const b = paintRay(RAY_SPAN, RW, RH, ROX, ROY, rayPose(anim, ((frame % n) + n) % n, n));
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) { const c = b.data[y * b.w + x]; if (c >>> 24) sk.over(x - sk.ox, y - sk.oy, c); }
    return { head: [RAY_SPAN * 0.3, -4], eye: [RAY_SPAN * 0.25, -2] };
  },
};

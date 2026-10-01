// V9 Trycop crab: a big rock-pool crab drawn as a live procedural 3D rig with the beast sketch core.
// "Trycop" is tri + kopis (Greek: chopper): it works three claws, a massive black-tipped CRUSHER,
// a long serrated CUTTER and a small median FORK that grows out of its mouthparts and picks algae
// like a fork. It is seen from the front (it scuttles sideways along the shore) and a little from
// above, so the ringed round spots across the carapace read. Every part is posed per frame: eight
// walking legs on an alternating tetrapod gait (IK from coxa to dactyl tip), both chelae (raise,
// open, strike), the fork, swivelling eye stalks, parting maxillipeds and flicking antennules, and
// the whole body bobbing, rolling and rearing. The same rig paints the 36 px crab in the world
// (k = 1) and the full-screen close-up (k ~ 4.5, detail 2: granules, setae, teeth, wet speculars and
// the root-barnacle parasite under the abdomen).
//
// Body space: x lateral (screen right), y up, z toward the camera; the origin is the ground under
// the body centre. The camera looks down by `phi`. Screen: sx = x, sy = -(y cos phi - z sin phi).

import { Sk, V2, V3, rmp, lumN, SpeciesDef, BeastEye, hh, sm } from '../../beasts-core';
import { hex, C } from '../../color';
import { clamp } from '../../../core/math';

export interface ClawP {
  /** -0.5 lowered to the ground (scraping) .. 0 held before the face .. 1 raised high in threat */
  raise: number;
  /** 0 closed .. 1 gaping */
  open: number;
  /** 0 .. 1 striking forward (snap) */
  reach: number;
}
export interface EyeP {
  /** swivel -1 (look screen-left) .. 1 (look screen-right) */
  sw: number;
  /** 0 upright .. 1 folded down into the orbit */
  fold: number;
}
export interface TrycopPose {
  /** gait phase in cycles, advanced by distance travelled */
  gait: number;
  /** 0 standing .. 1 full stepping */
  step: number;
  /** travel direction (the leading legs reach further) */
  dir: number;
  /** body height offset (px at k=1, + up) */
  bob: number;
  /** roll (rad, + = screen-right side lower) */
  roll: number;
  /** 0..1 rearing up (threat): body high, front pitched up, underside showing */
  rear: number;
  /** 0..1 hunkered down (foraging, hiding) */
  low: number;
  crush: ClawP;
  cut: ClawP;
  /** the fork: ext 0 tucked .. 1 reaching the rock; open 0..1; side -1..1 where it reaches; lift 0..1 bringing food up */
  fork: { ext: number; open: number; side: number; lift: number };
  eyes: [EyeP, EyeP];
  /** maxillipeds parted 0..1 */
  mouth: number;
  /** antennule flick phase (radians) */
  flick: number;
  /** extra lift per walking leg [L0..L3, R0..R3] for idle shuffles */
  shuffle: number[];
  /** 0..1 sunk into a crevice (legs tucked, clipped below the rock lip by the caller) */
  sink: number;
  /** seconds, for small secondary motion */
  t: number;
}

export function trycopRest(): TrycopPose {
  return {
    gait: 0, step: 0, dir: 1, bob: 0, roll: 0, rear: 0, low: 0,
    crush: { raise: 0, open: 0.15, reach: 0 }, cut: { raise: 0, open: 0.1, reach: 0 },
    fork: { ext: 0, open: 0, side: 0, lift: 0 },
    eyes: [{ sw: 0, fold: 0 }, { sw: 0, fold: 0 }],
    mouth: 0, flick: 0, shuffle: [0, 0, 0, 0, 0, 0, 0, 0], sink: 0, t: 0,
  };
}

export interface TrycopOpts {
  /** scale: 1 = in-world size */
  k: number;
  /** camera tilt (rad) */
  phi?: number;
  /** 0 world sprite .. 2 close-up (granules, setae, teeth, speculars) */
  detail?: number;
  /** the root-barnacle parasite under the abdomen */
  parasite?: boolean;
  /** colour variant 0 (vermilion) .. 1 (deep wine) */
  hue?: number;
}

/** what the painter reports back (canvas-local screen coords) */
export interface TrycopOut {
  eyes: [V2, V2];
  mouth: V2;
  crushTip: V2;
  cutTip: V2;
  forkTip: V2;
  /** where the parasite sac shows (null when hidden) */
  sac: V2 | null;
  /** body centre */
  body: V2;
}

// ------------------------------------------------------------------ dimensions (k = 1)
const W = 10, D = 7.6, H = 5.2;
const COXA_Z = [2.4, 0, -2.4, -4.5];
const FOOT_X = [6.8, 8.0, 7.8, 6.4];
const FOOT_Z = [6.8, 2.6, -2.4, -7.0];
const GROUP_B = [false, true, false, true]; // left side; the right side is the opposite group

// round ringed spots across the carapace: (u = x/W, v = z/D, r in W units)
/** the world sprite: five bold spots */
const SPOTS_SMALL: [number, number, number][] = [[0, 0.3, 0.19], [-0.52, 0.3, 0.15], [0.52, 0.3, 0.15], [-0.27, 0.74, 0.12], [0.27, 0.74, 0.12], [-0.84, 0.18, 0.09], [0.84, 0.18, 0.09]];
const SPOTS: [number, number, number][] = [[0, 0.06, 0.25], [0, -0.7, 0.13]];
for (const s of [-1, 1]) SPOTS.push([s * 0.4, 0.5, 0.15], [s * 0.56, -0.02, 0.19], [s * 0.3, -0.46, 0.17], [s * 0.83, -0.18, 0.1], [s * 0.64, -0.62, 0.11], [s * 0.78, 0.38, 0.08], [s * 0.15, 0.7, 0.08]);

// ------------------------------------------------------------------ small 3D maths
const v3 = (x: number, y: number, z: number): V3 => [x, y, z];
const vadd = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vsub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vmul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const vlerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const vdot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vlen = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const vnorm = (a: V3): V3 => { const l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** two-bone IK in 3D: the knee bends toward `hint`; returns [knee, reached end] */
function ik3(a: V3, b: V3, l1: number, l2: number, hint: V3): [V3, V3] {
  const d = vsub(b, a);
  const L0 = vlen(d) || 1e-4;
  const L = clamp(L0, Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  const dn = vmul(d, 1 / L0);
  let h = vsub(hint, vmul(dn, vdot(hint, dn)));
  h = vlen(h) < 1e-4 ? [0, 1, 0] : vnorm(h);
  const x = (l1 * l1 - l2 * l2 + L * L) / (2 * L);
  const y = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const knee = vadd(vadd(a, vmul(dn, x)), vmul(h, y));
  const end = vadd(knee, vmul(vnorm(vsub(vadd(a, vmul(dn, L)), knee)), l2));
  return [knee, end];
}

/** body transform: pitch (front up) then roll, then translate */
class Xf {
  cp: number; sp: number; cr: number; sr: number;
  constructor(readonly c: V3, pitch: number, roll: number) {
    this.cp = Math.cos(pitch); this.sp = Math.sin(pitch); this.cr = Math.cos(roll); this.sr = Math.sin(roll);
  }
  dir(p: V3): V3 {
    const y1 = p[1] * this.cp + p[2] * this.sp, z1 = -p[1] * this.sp + p[2] * this.cp;
    return [p[0] * this.cr + y1 * this.sr, -p[0] * this.sr + y1 * this.cr, z1];
  }
  pt(p: V3): V3 { return vadd(this.dir(p), this.c); }
}

// ------------------------------------------------------------------ the carapace point cloud (cached per k/detail)
interface Cloud {
  /** local positions and normals, packed */
  pos: Float32Array;
  nrm: Float32Array;
  /** material slot (see SLOT) */
  mat: Uint8Array;
  /** lighting bias */
  bias: Float32Array;
  n: number;
}
const enum SLOT { shell, shellDark, spotC, spotR, spotRim, belly, abdo, sac, sacDark, rim }

/** normalised footprint distance (<1 inside): a broad oval, flatter in front, scalloped anterolateral margins */
function footD(x: number, z: number): number {
  const v = z / D;
  const wz = W * (1 + 0.08 * v - 0.16 * Math.max(0, -v) * Math.max(0, -v));
  const u = x / wz;
  const e = v > 0 ? 2.5 : 2.1;
  let d = Math.pow(Math.pow(Math.abs(u), e) + Math.pow(Math.abs(v), e), 1 / e);
  const a = Math.atan2(v, Math.abs(u) + 1e-6);
  if (a > 0.08 && a < 1.18) d *= 1 - 0.035 * Math.pow(Math.max(0, Math.sin((a - 0.08) / 1.1 * Math.PI * 4.5)), 2);
  // a shallow frontal notch between the eyes
  if (v > 0.6 && Math.abs(u) < 0.12) d *= 1 + 0.05 * (1 - Math.abs(u) / 0.12);
  return d;
}

function heightTop(x: number, z: number, detail: number, k: number): number {
  const d = footD(x, z);
  if (d >= 1) return -1e9;
  const u = x / W, v = z / D;
  let y = -H * 0.25 + H * Math.pow(Math.max(0, 1 - d * d), 0.5);
  // gastric and branchial swellings
  y += H * 0.12 * Math.exp(-((u * u) / 0.05 + ((v - 0.15) * (v - 0.15)) / 0.1));
  y += H * 0.06 * Math.exp(-(((Math.abs(u) - 0.5) ** 2) / 0.04 + (v * v) / 0.12));
  if (detail > 0) {
    // the H-shaped groove between the regions
    const g1 = Math.exp(-((Math.abs(u) - 0.3) ** 2) / 0.0025) * (v < 0.35 && v > -0.55 ? 1 : 0);
    const g2 = Math.exp(-((v + 0.08 + 0.25 * u * u) ** 2) / 0.003) * (Math.abs(u) < 0.3 ? 1 : 0);
    y -= H * 0.05 * Math.max(g1, g2);
  }
  if (detail > 1) {
    // granules: tiny domes on a jittered grid (world scale so they stay pixel sized)
    const s = 1.35 / 1, gx = x * k / (s * k * 0.9), gz = z * k / (s * k * 0.9);
    const ix = Math.floor(gx), iz = Math.floor(gz);
    const cx = ix + 0.3 + hh(ix, iz, 11) * 0.4, cz = iz + 0.3 + hh(iz, ix, 12) * 0.4;
    const q = (gx - cx) ** 2 + (gz - cz) ** 2;
    if (q < 0.09 && hh(ix, iz, 13) < 0.55) y += H * 0.018 * (1 - q / 0.09);
  }
  return y;
}

function heightBot(x: number, z: number): number {
  const d = footD(x * 1.04, z * 1.04);
  if (d >= 1) return 1e9;
  return -H * 0.25 - H * 0.42 * Math.pow(Math.max(0, 1 - d * d), 0.45);
}

const clouds = new Map<string, Cloud>();
function cloudFor(k: number, detail: number, parasite: boolean): Cloud {
  const key = k.toFixed(2) + '|' + detail + '|' + (parasite ? 1 : 0);
  const hit = clouds.get(key);
  if (hit) return hit;
  const pos: number[] = [], nrm: number[] = [], mat: number[] = [], bias: number[] = [];
  const step = 0.42 / k;
  const e = 0.18 / k;
  const push = (x: number, y: number, z: number, n: V3, m: SLOT, b: number) => { pos.push(x, y, z); nrm.push(n[0], n[1], n[2]); mat.push(m); bias.push(b); };
  const spotPx = (r: number) => r * W * k;
  for (let z = -D * 1.08; z <= D * 1.08; z += step)
    for (let x = -W * 1.12; x <= W * 1.12; x += step) {
      const y = heightTop(x, z, detail, k);
      if (y < -1e8) continue;
      const dx = (heightTop(x + e, z, detail, k) - heightTop(x - e, z, detail, k)) / (2 * e);
      const dz = (heightTop(x, z + e, detail, k) - heightTop(x, z - e, detail, k)) / (2 * e);
      const n = vnorm([Number.isFinite(dx) ? -dx : 0, 1, Number.isFinite(dz) ? -dz : 0]);
      const d = footD(x, z);
      let m: SLOT = SLOT.shell, b = 0;
      // spots: cream centre, orange ring, maroon rim (the ring only when the spot is big enough in pixels)
      for (const [su, sv, sr] of k < 2 ? SPOTS_SMALL : SPOTS) {
        // small sprites: stretch along z so the spots stay round after the foreshortening
        const q = Math.hypot(x - su * W, (z - sv * D) * (k < 2 ? 0.72 : 1)) / (sr * W);
        if (q >= 1) continue;
        const px = spotPx(sr);
        const rim = k < 2 ? 0 : Math.max(0.12, Math.min(0.42, 0.8 / px));
        const ring = k < 2 ? 0 : px > 2.6 ? Math.max(0.16, Math.min(0.3, 1.4 / px)) : 0;
        m = q > 1 - rim ? SLOT.spotRim : q > 1 - rim - ring ? SLOT.spotR : SLOT.spotC;
        b = m === SLOT.spotC ? 0.06 : 0;
        break;
      }
      if (m === SLOT.shell) {
        if (d > (k < 2 ? 0.9 : 0.93)) m = SLOT.rim;
        else if (detail > 0) {
          const u = x / W, v = z / D;
          const g1 = Math.abs(Math.abs(u) - 0.3) < 0.035 && v < 0.35 && v > -0.55;
          const g2 = Math.abs(v + 0.08 + 0.25 * u * u) < 0.04 && Math.abs(u) < 0.3;
          if (g1 || g2) { m = SLOT.shellDark; b = -0.04; }
          // a darker saddle toward the back and the flanks
          else if (v < -0.62 || Math.abs(u) > 0.86) b = -0.05;
          if (detail > 1 && hh(Math.floor(x * k * 0.8), Math.floor(z * k * 0.8), 21) < 0.06) b += 0.08;
        }
      }
      push(x, y, z, n, m, b);
      // the underside (seen only when the crab rears): pale sternum, the folded abdomen flap and the parasite
      const yb = heightBot(x, z);
      if (yb < 1e8 && d < 0.97) {
        const dbx = (heightBot(x + e, z) - heightBot(x - e, z)) / (2 * e);
        const dbz = (heightBot(x, z + e) - heightBot(x, z - e)) / (2 * e);
        const nb = vnorm([Number.isFinite(dbx) ? dbx : 0, -1, Number.isFinite(dbz) ? dbz : 0]);
        const u = x / W, v = z / D;
        const abdoW = 0.3 - (v + 0.8) * 0.06;
        let mb: SLOT = SLOT.belly, bb = 0;
        if (v < 0.45 && v > -0.95 && Math.abs(u) < abdoW) {
          mb = SLOT.abdo;
          // segment lines across the flap
          if (Math.abs(((v + 1) * 5.5) % 1 - 0.5) > 0.42 && detail > 0) bb = -0.1;
        } else if (Math.abs(((u + 1) * 4) % 1 - 0.5) > 0.44 && detail > 0) bb = -0.06;
        push(x, yb, z, nb, mb, bb + 0.24);
      }
    }
  if (parasite) {
    // root-barnacle externa: a smooth wrinkled sac bulging from under the abdomen flap
    const c: V3 = [0, -H * 0.72, -D * 0.28];
    const rx = 3.1, ry = 1.9, rz = 2.4;
    for (let z = -rz; z <= rz; z += step)
      for (let x = -rx; x <= rx; x += step) {
        const q = (x / rx) ** 2 + (z / rz) ** 2;
        if (q >= 1) continue;
        const h = ry * Math.sqrt(1 - q);
        const n = vnorm([x / (rx * rx) * ry, -1 / ry * ry, z / (rz * rz) * ry]);
        const wr = Math.sin((x * 2.2 + z * 1.1) * k * 0.9) > 0.7 && detail > 0;
        push(c[0] + x, c[1] - h, c[2] + z, vnorm([n[0], -Math.abs(n[1]) - 0.4, n[2]]), wr || q > 0.8 ? SLOT.sacDark : SLOT.sac, q > 0.8 ? 0.2 : 0.32);
      }
  }
  const cl: Cloud = { pos: new Float32Array(pos), nrm: new Float32Array(nrm), mat: new Uint8Array(mat), bias: new Float32Array(bias), n: mat.length };
  if (clouds.size > 12) clouds.clear();
  clouds.set(key, cl);
  return cl;
}

// ------------------------------------------------------------------ palettes
interface Pal { shell: string; shellDark: string; spotC: string; spotR: string; spotRim: string; leg: string; band: string; tip: string; claw: string; crushTip: string; tooth: string; eye: string; stalk: string; mouth: string; fork: string; belly: string; abdo: string; sac: string }
const PAL_A: Pal = {
  shell: '#bc2e2a', shellDark: '#6e1c2c', spotC: '#f8e6b0', spotR: '#ee9038', spotRim: '#4e121c',
  leg: '#e47a44', band: '#f6e0b4', tip: '#3a1a2a', claw: '#b02e28', crushTip: '#1c1418', tooth: '#fff2d8',
  eye: '#161622', stalk: '#e0864a', mouth: '#6a4c96', fork: '#8e76c8', belly: '#f2e2c8', abdo: '#e8c6a0', sac: '#f2a228',
};
const PAL_B: Pal = { ...PAL_A, shell: '#8c2438', shellDark: '#4e1428', leg: '#a03040', claw: '#8a2436', spotR: '#e0703a' };

function mix(a: string, b: string, t: number): C {
  const A = hex(a), B = hex(b);
  const ch = (s: number) => Math.round(((A >>> s) & 255) * (1 - t) + ((B >>> s) & 255) * t);
  return (255 << 24 | ch(16) << 16 | ch(8) << 8 | ch(0)) >>> 0;
}

interface Mats { [k: string]: number }
function mats(sk: Sk, hue: number, detail: number, small = false): Mats {
  const P = PAL_A, Q = PAL_B;
  const c = (key: keyof Pal) => (hue > 0 ? mix(P[key], Q[key], hue) : hex(P[key]));
  const n = detail > 1 ? 7 : detail > 0 ? 6 : small ? 4 : 5;
  return {
    shell: sk.m(rmp(c('shell'), { n, dark: 0.62, light: 0.3, cool: 0.35, warm: 0.35, sat: 0.3 }), { edge: 2 }),
    shellDark: sk.m(rmp(c('shellDark'), { n: 5, dark: 0.6, light: 0.35, cool: 0.4 }), { edge: 1 }),
    rim: sk.m(rmp(c('shellDark'), { n: 5, dark: 0.55, light: 0.55, cool: 0.4 }), { edge: 1 }),
    spotC: sk.m(rmp(c('spotC'), { n: 5, dark: 0.35, light: 0.6, warm: 0.3 }), { edge: 1, noRim: true }),
    spotR: sk.m(rmp(c('spotR'), { n: 5, dark: 0.5, light: 0.45 }), { edge: 1, noRim: true }),
    spotRim: sk.m(rmp(c('spotRim'), { n: 4, dark: 0.5, light: 0.3 }), { edge: 1, noRim: true }),
    leg: sk.m(rmp(c('leg'), { n, dark: 0.65, light: 0.45, cool: 0.45 }), { edge: 2 }),
    band: sk.m(rmp(c('band'), { n: 5, dark: 0.5, light: 0.4 }), { edge: 1 }),
    tip: sk.m(rmp(c('tip'), { n: 4, dark: 0.5, light: 0.5 }), { edge: 1 }),
    claw: sk.m(rmp(c('claw'), { n, dark: 0.66, light: 0.5, cool: 0.45 }), { edge: 2 }),
    crushTip: sk.m(rmp(c('crushTip'), { n: 4, dark: 0.4, light: 0.32 }), { edge: 1 }),
    tooth: sk.m(rmp(c('tooth'), { n: 4, dark: 0.35, light: 0.4 }), { edge: 1, noRim: true }),
    eye: sk.m(rmp(c('eye'), { n: 4, dark: 0.4, light: 1.2 }), { edge: 0, k: 1.3 }),
    stalk: sk.m(rmp(c('stalk'), { n: 5, dark: 0.6, light: 0.45 }), { edge: 1 }),
    mouth: sk.m(rmp(c('mouth'), { n: 5, dark: 0.6, light: 0.5 }), { edge: 1 }),
    fork: sk.m(rmp(c('fork'), { n: 5, dark: 0.6, light: 0.5 }), { edge: 1 }),
    belly: sk.m(rmp(c('belly'), { n: 5, dark: 0.45, light: 0.4 }), { edge: 1 }),
    abdo: sk.m(rmp(c('abdo'), { n: 5, dark: 0.5, light: 0.4 }), { edge: 1 }),
    sac: sk.m(rmp(c('sac'), { n: 5, dark: 0.5, light: 0.55, warm: 0.4 }), { edge: 1, noRim: true }),
    sacDark: sk.m(rmp('#b8641c', { n: 4, dark: 0.5, light: 0.4 }), { edge: 1, noRim: true }),
    maw: sk.m(rmp('#2a1020', { n: 3, dark: 0.4, light: 0.3 }), { edge: 0, noRim: true }),
    mand: sk.m(rmp('#d89a4a', { n: 4, dark: 0.5 }), { edge: 1 }),
  };
}

// ------------------------------------------------------------------ the painter

/** canvas that fits every pose at scale k: origin (ox, oy) is the ground under the body centre */
export function trycopCanvas(k: number): { w: number; h: number; ox: number; oy: number } {
  return { w: Math.ceil(76 * k), h: Math.ceil(58 * k), ox: Math.round(38 * k), oy: Math.round(44 * k) };
}

const LX = -0.52, LY = -0.74, LZ = 0.42;

export function drawTrycop(sk: Sk, P: TrycopPose, o: TrycopOpts): TrycopOut {
  /** world-size sprite: a lower camera, thinner legs, eyes up on stalks, a plain mouth, fewer tones */
  const small = o.k < 2;
  const k = o.k, detail = o.detail ?? 0, phi = o.phi ?? 0.6;
  const cph = Math.cos(phi), sph = Math.sin(phi);
  const M = mats(sk, o.hue ?? 0, detail, small);
  // projection (body-space units at k=1 -> canvas-local px)
  const pr = (p: V3): V3 => [p[0] * k, -(p[1] * cph - p[2] * sph) * k, (p[2] * cph + p[1] * sph) * k];
  const s2 = (p: V3): V2 => { const q = pr(p); return [q[0], q[1]]; };
  const sink = P.sink;
  // ---- body transform
  const h0 = 6.4 + P.bob - P.low * 2.5 + P.rear * 5.2 - sink * 4.2;
  const X = new Xf([0, h0, 0], P.rear * 0.95, P.roll);
  const spec = detail > 1 ? 0.55 : detail > 0 ? 0.3 : 0.08;
  const light = (n: V3, b: number) => {
    // world normal -> screen normal
    const nx = n[0], ny = -(n[1] * cph - n[2] * sph), nz = n[2] * cph + n[1] * sph;
    let l = lumN(nx, ny, nz) + b;
    const nl = nx * LX + ny * LY + nz * LZ;
    const rz = 2 * nl * nz - LZ;
    if (rz > 0) l += Math.pow(rz, 12) * spec;
    return l;
  };
  // ---- carapace (splatted point cloud)
  sk.np();
  const cl = cloudFor(k, detail, !!o.parasite);
  const slotMat = [M.shell, M.shellDark, M.spotC, M.spotR, M.spotRim, M.belly, M.abdo, M.sac, M.sacDark, M.rim];
  let sacShown = false;
  const under = P.rear > 0.3;
  for (let i = 0; i < cl.n; i++) {
    const i3 = i * 3;
    if (!under && cl.mat[i] >= SLOT.belly && cl.mat[i] <= SLOT.sacDark) continue;
    const n = X.dir([cl.nrm[i3], cl.nrm[i3 + 1], cl.nrm[i3 + 2]]);
    // back-face cull (the underside only shows when rearing)
    if (n[2] * cph + n[1] * sph <= -0.05) continue;
    const p = X.pt([cl.pos[i3], cl.pos[i3 + 1], cl.pos[i3 + 2]]);
    const q = pr(p);
    const m = cl.mat[i];
    if (m === SLOT.sac) sacShown = true;
    sk.dot(q[0], q[1], slotMat[m], light(n, cl.bias[i]), q[2]);
  }
  const bodyPart = sk.pid;
  // the front face below the rim, down to the mouth frame (epistome)
  sk.np();
  for (let yy = -H * 0.28; yy >= -H * 0.78; yy -= 0.4 / k)
    for (let xx = -3.4; xx <= 3.4; xx += 0.4 / k) {
      const zz = D * 0.93 - (yy + H * 0.28) * 0.25 - (xx * xx) * 0.04;
      const nn = X.dir(vnorm([xx * 0.08, 0.3, 1]));
      const q = pr(X.pt([xx, yy, zz]));
      sk.dot(q[0], q[1], Math.abs(xx) > 3 ? M.rim : M.shellDark, light(nn, -0.06), q[2]);
    }
  // ---- mouthparts: the third maxillipeds part like doors over the mandibles
  const mouthC = X.pt([0, -H * 0.66, D * 0.99]);
  const mc = s2(mouthC);
  {
    const gap = P.mouth;
    sk.np(true);
    const g = s2(X.pt([0, -H * 0.66, D * 0.98]));
    if (!small || gap > 0.5) sk.ell(g[0], g[1], (0.6 + gap * 0.9) * k, (small ? 1 : 1.5) * k, M.maw, { z: pr(mouthC)[2] - 0.2 * k, rz: 0.2 * k });
    if (gap > 0.3 && !small) { sk.np(); sk.ell(g[0], g[1] + 0.2 * k, 0.55 * k * gap, 0.7 * k, M.mand, { z: pr(mouthC)[2] - 0.1 * k }); }
    for (const s of [-1, 1]) {
      sk.np();
      const c = s2(X.pt([s * (1.05 + gap * 0.75), -H * 0.66, D * 1.0]));
      const zc = pr(X.pt([s * 1.2, -H * 0.66, D * 1.02]))[2];
      sk.ell(c[0], c[1], (small ? 0.85 : 1.05) * k, (small ? 1.3 : 1.75) * k, (p) => (small ? M.shellDark : detail > 0 && Math.abs(p.u * s + 0.7) < 0.22 ? M.fork : M.mouth), { z: zc, rz: 0.5 * k, rot: s * 0.12 });
      if (detail > 1) for (let j = 0; j < 5; j++) sk.over(c[0] + s * (1.1 * k) + Math.sin(P.t * 9 + j) * 0.5, c[1] - 1.2 * k + j * 0.6 * k, hex('#e8d8f8', 170));
    }
  }
  // ---- eye stalks
  const eyeOut: V2[] = [];
  for (const side of [0, 1] as const) {
    const s = side === 0 ? -1 : 1;
    const e = P.eyes[side];
    // (the small sprite cheats like a pixel artist would: the stalks rise from the top of the dome and
    // lean back, so the eyes break the silhouette instead of sitting on the shell like a face)
    const base = X.pt(small ? [s * 2.4, H * 0.62, D * 0.56] : [s * 2.2, H * 0.28, D * 0.86]);
    const up = vnorm([s * 0.16 + e.sw * 0.55, 1, (small ? -0.5 : 0.3) - Math.abs(e.sw) * 0.1]);
    const down = vnorm([s * 1, 0.12, 0.4]);
    const dir = X.dir(vnorm(vlerp(up, down, sm(e.fold))));
    const L = (small ? 4.2 : 4.3) * (1 - e.fold * 0.35);
    const tip = vadd(base, vmul(dir, L));
    sk.np();
    const b2 = pr(base), t2 = pr(tip);
    sk.tube([[b2[0], b2[1]], [t2[0], t2[1]]], t => (0.72 - t * 0.12) * k, (p) => (detail > 0 && Math.abs(p.t - 0.55) < 0.06 ? M.shellDark : M.stalk), { z: t => b2[2] + (t2[2] - b2[2]) * t });
    // the cornea: a dark kidney bulb at the tip with a wet glint
    sk.np();
    const ec = vadd(tip, vmul(dir, 0.55));
    const e2 = pr(ec);
    const er = (small ? 1.05 : 1.3) * k;
    sk.ell(e2[0], e2[1], er * 1.05, er, M.eye, { z: e2[2] + 0.5 * k, rz: er });
    const hx = Math.floor(e2[0] - er * 0.35), hy = Math.floor(e2[1] - er * 0.45);
    sk.over(hx, hy, hex('#ffffff'));
    if (k > 2) { sk.over(hx + 1, hy, hex('#ffffff')); sk.over(hx, hy + 1, hex('#d8e8ff')); sk.over(Math.floor(e2[0] + er * 0.3), Math.floor(e2[1] + er * 0.35), hex('#6a7ab0')); }
    eyeOut.push([e2[0], e2[1]]);
  }
  // antennules: two short feathered whips between the eyes
  if (!small) {
    for (const s of [-1, 1]) {
      const b = X.pt([s * 0.7, -H * 0.05, D * 0.95]);
      const fl = Math.sin(P.flick + s) * 0.4;
      const t = vadd(b, X.dir(vnorm([s * 0.3 + fl, 0.8, 0.6])));
      const t2 = vadd(t, vmul(X.dir(vnorm([s * 0.5 + fl * 1.5, 0.5, 0.4])), 1.3));
      sk.np(true);
      const a = pr(b), c = pr(t), d = pr(t2);
      sk.tube([[a[0], a[1]], [c[0], c[1]], [d[0], d[1]]], t => (0.36 - t * 0.2) * k, M.fork, { z: t => a[2] + (d[2] - a[2]) * t + 0.4 * k });
    }
  }
  // ---- walking legs
  const liftH = 2.2;
  const stride = 5.4;
  for (const side of [0, 1] as const) {
    const s = side === 0 ? -1 : 1;
    for (let i = 0; i < 4; i++) {
      const li = side * 4 + i;
      const zc = COXA_Z[i];
      const xc = s * (W * Math.sqrt(Math.max(0, 1 - (zc / D) ** 2)) * 0.86);
      const coxa = X.pt([xc, -H * 0.42, zc]);
      const grp = GROUP_B[i] !== (side === 1);
      const ph = P.gait + (grp ? 0.5 : 0) + i * 0.07;
      const f = ph - Math.floor(ph), duty = 0.58;
      let dx = 0, lift = 0;
      if (f < duty) dx = stride * (0.5 - f / duty);
      else { const q = (f - duty) / (1 - duty); dx = stride * (-0.5 + sm(q)); lift = liftH * Math.sin(Math.PI * q); }
      const lead = s === Math.sign(P.dir) ? 1 : -0.6;
      const reach = FOOT_X[i] + P.step * lead * 0.8 - sink * 3.5 - P.low * 0.6 + P.rear * (i === 0 ? 1.8 : i === 3 ? -0.6 : 0.4);
      const foot: V3 = [
        s * (W + reach) + dx * P.step * Math.sign(P.dir || 1),
        lift * P.step + (P.shuffle[li] ?? 0) + P.rear * (i === 0 ? 2.4 : 0) + sink * 1.6,
        FOOT_Z[i] + P.rear * (i === 0 ? 1.5 : i === 3 ? -2 : 0) * 1 - sink * Math.sign(FOOT_Z[i]) * 1.5,
      ];
      const ankle: V3 = [foot[0] - s * 1.05, foot[1] + 3.1, foot[2] * 0.96];
      const hint: V3 = [s * 0.3, 1, zc * 0.05];
      const [knee, ank] = ik3(coxa, ankle, 5.9, 5.3, hint);
      const tip = vadd(ank, vmul(vnorm(vsub(foot, ankle)), 3.1));
      sk.np();
      const c2 = pr(coxa), k2 = pr(knee), a2 = pr(ank), f2 = pr(tip);
      const zfn = (a: V3, b: V3) => (t: number) => a[2] + (b[2] - a[2]) * t;
      const legFill = (band0: number) => (p: { t: number; v: number; l: number }) => {
        if (p.t > band0) return M.band;
        if (detail > 0 && Math.abs(p.v) > 0.8 && p.t > 0.1) p.l -= 0.05;
        return M.leg;
      };
      const lr = small ? 0.72 : 1;
      sk.tube([[c2[0], c2[1]], [k2[0], k2[1]]], t => (1.2 - t * 0.12) * k * lr, legFill(0.86), { z: zfn(c2, k2) });
      sk.tube([[k2[0], k2[1]], [a2[0], a2[1]]], t => (1.02 - t * 0.2) * k * lr, legFill(0.84), { z: zfn(k2, a2) });
      sk.tube([[a2[0], a2[1]], [f2[0], f2[1]]], t => (0.78 - t * 0.58) * k * lr + 0.18, (p) => (p.t > 0.55 ? M.tip : M.leg), { z: zfn(a2, f2) });
      // setae: a fringe of short hairs along the back of the leg (close-up)
      if (detail > 1) {
        const segs: [V3, V3, number][] = [[k2, a2, 1.0], [a2, f2, 0.7]];
        for (const [a, b, rr] of segs) {
          const n = 5;
          for (let j = 1; j < n; j++) {
            const t = j / n;
            const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
            const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) - s * 1.9;
            const r0 = rr * k * 0.95, L = 0.55 * k;
            sk.overLine(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0, x + Math.cos(ang) * (r0 + L), y + Math.sin(ang) * (r0 + L) + Math.sin(P.t * 3 + j) * 0.3, hex('#f0c898', 110));
          }
        }
      }
    }
  }
  // ---- the fork: a small median claw on a jointed stalk from the mouth
  let forkTip: V2 = mc;
  {
    const F = P.fork;
    const base = X.pt([0, -H * 0.72, D * 0.98]);
    const tucked = X.pt([F.side * 0.4, -H * 0.9, D * 1.25]);
    const ground: V3 = [F.side * 3.2, 0.5 + F.lift * 2.4, D + 3.4 - P.rear * 1.5];
    const atMouth = X.pt([F.side * 0.2, -H * 0.55, D * 1.2]);
    let target = vlerp(tucked, ground, sm(F.ext));
    target = vlerp(target, atMouth, sm(F.lift) * F.ext);
    if (F.ext > 0.04) {
      const [kn, end] = ik3(base, target, 2.8, 2.9, X.dir([0, 0.7, 0.8]));
      const b2 = pr(base), k2 = pr(kn), e2 = pr(end);
      sk.np();
      sk.tube([[b2[0], b2[1]], [k2[0], k2[1]], [e2[0], e2[1]]], t => (0.62 - t * 0.2) * k, M.fork, { z: t => b2[2] + (e2[2] - b2[2]) * t + 0.6 * k });
      const ang = Math.atan2(e2[1] - k2[1], e2[0] - k2[0]);
      const op = 0.2 + F.open * 0.7;
      for (const sd of [-1, 1]) {
        const a = ang + sd * op;
        sk.np();
        sk.blade(e2[0], e2[1], e2[0] + Math.cos(a) * 1.7 * k, e2[1] + Math.sin(a) * 1.7 * k, t => (1 - t) * 0.45 * k + 0.2, M.fork, { z0: e2[2] + 0.8 * k, z1: e2[2] + 0.9 * k });
      }
      forkTip = [e2[0] + Math.cos(ang) * 1.6 * k, e2[1] + Math.sin(ang) * 1.6 * k];
    }
  }
  // ---- chelipeds
  const claw = (side: 0 | 1): V2 => {
    const s = side === 0 ? -1 : 1;
    const crusher = side === 0;
    const C0 = crusher ? P.crush : P.cut;
    const sh = X.pt([s * 4.6, -H * 0.3, D * 0.72]);
    // wrist and palm axis for rest / scraping / raised / striking, blended. At rest the palms fold in
    // before the mouth, fingers angled down and in; raised they stand up and out, gaping.
    const lo = Math.max(0, -C0.raise), up = Math.max(0, C0.raise);
    let wr: V3 = [s * 10.2, -H * 0.28, D + 1.0];
    let ax: V3 = [-s * 0.74, -0.46, 0.26];
    wr = vlerp(wr, [s * 6.4, -H * 1.05, D + 4.2], clamp(lo * 2));
    ax = vlerp(ax, [-s * 0.42, -0.86, 0.28], clamp(lo * 2));
    wr = vlerp(wr, [s * 12.4, 6.2, D * 0.5 + 1.4], sm(up));
    ax = vlerp(ax, [s * 0.34, 0.93, 0.12], sm(up));
    wr = vlerp(wr, [s * 3.6, -1.4, D + 9.4], sm(C0.reach));
    ax = vlerp(ax, [-s * 0.2, -0.12, 1], sm(C0.reach));
    const wrist = X.pt(wr);
    const axis = X.dir(vnorm(ax));
    const [elb] = ik3(sh, wrist, 5.6, 4.8, X.dir([s * 1, 0.3, -0.25]));
    const s0 = pr(sh), e0 = pr(elb), w0 = pr(wrist);
    const armR = crusher ? 1.7 : 1.4;
    sk.np();
    sk.tube([[s0[0], s0[1]], [e0[0], e0[1]]], t => (armR - t * 0.15) * k, (p) => (p.t > 0.86 ? M.band : M.claw), { z: t => s0[2] + (e0[2] - s0[2]) * t });
    sk.np();
    sk.tube([[e0[0], e0[1]], [w0[0], w0[1]]], t => (armR * (1.05 - t * 0.1)) * k, M.claw, { z: t => e0[2] + (w0[2] - e0[2]) * t });
    // the palm (propodus), laid along the projected axis
    // pl: palm length, ph: half its height
    const pl = crusher ? 9.2 : 9.4, ph = crusher ? 3.1 : 2.15;
    const pc = vadd(wrist, vmul(axis, pl * 0.5));
    const pc2 = pr(pc);
    const ae = pr(vadd(pc, axis));
    let ux = ae[0] - pc2[0], uy = ae[1] - pc2[1];
    const al = Math.hypot(ux, uy) / k;
    if (al < 0.05) { ux = -s * k; uy = 0; }
    const ul = Math.hypot(ux, uy);
    ux /= ul; uy /= ul;
    // the dactyl side: the perpendicular pointing up and outward
    let nx = -uy, ny = ux;
    if (nx * s * 0.5 - ny < 0) { nx = -nx; ny = -ny; }
    const aS = Math.atan2(uy, ux);
    const fore = clamp(al, 0.45, 1);
    const rx = Math.max(ph * 1.02, pl * 0.5 * fore) * k, ry = ph * k * 0.92;
    sk.np();
    const spots: [number, number, number][] = crusher ? [[-0.3, -0.25, 0.24], [0.25, 0.1, 0.22], [-0.45, 0.42, 0.14], [0.55, -0.35, 0.13]] : [[-0.2, -0.15, 0.26], [0.42, 0.22, 0.17]];
    const palmFill = (p: { u: number; v: number; l: number }) => {
      for (const [u, v, r] of spots) {
        const q = Math.hypot(p.u - u, (p.v - v) * (ry / rx)) / r;
        if (q < 1) return q > 0.7 ? M.spotRim : q > 0.5 && r * rx > 2.6 ? M.spotR : M.spotC;
      }
      if (detail > 0 && Math.abs(p.v) > 0.78) p.l -= 0.05;
      return M.claw;
    };
    // v = +1 is the dactyl (upper) side when the ellipse is rotated by aS; flip the fill's v to match n
    const vs = (-Math.sin(aS) * nx + Math.cos(aS) * ny) > 0 ? 1 : -1;
    sk.ell(pc2[0], pc2[1], rx, ry, (p) => { p.v *= vs; return palmFill(p); }, { rot: aS, z: pc2[2] + 0.6 * k, rz: ry * 1.15 });
    // fingers: the fixed pollex continues the lower edge, the dactyl hinges on the upper corner
    const fl = (crusher ? 6.0 : 7.2) * k * (0.7 + fore * 0.3);
    const fw = (crusher ? 1.55 : 1.0) * k;
    const openA = 0.08 + C0.open * (crusher ? 0.72 : 0.9);
    const distal: V2 = [pc2[0] + ux * rx * 0.72, pc2[1] + uy * rx * 0.72];
    const pollexB: V2 = [distal[0] - nx * ry * 0.3, distal[1] - ny * ry * 0.3];
    const dacB: V2 = [distal[0] + nx * ry * 0.46, distal[1] + ny * ry * 0.46];
    const cf = Math.cos(0.1), sf = Math.sin(0.1);
    const pd: V2 = [ux * cf + nx * sf, uy * cf + ny * sf];
    const co = Math.cos(openA), so = Math.sin(openA);
    const dd: V2 = [ux * co + nx * so, uy * co + ny * so];
    // bias the dactyl down to close on the pollex when shut
    const dd2: V2 = C0.open < 0.15 ? [dd[0] - nx * 0.08, dd[1] - ny * 0.08] : dd;
    const fingerFill = (dac: boolean) => (p: { t: number; v: number; l: number }) => {
      if (crusher && p.t > 0.58) return M.crushTip;
      if (!crusher && p.t > 0.84) return M.tip;
      // teeth on the biting edge: molar knobs on the crusher, a saw edge on the cutter
      const biting = dac ? p.v < -0.35 : p.v > 0.35;
      if (biting && p.t > 0.08) {
        if (crusher && Math.abs(((p.t * 3) % 1) - 0.5) < 0.28 && p.t < 0.56) return M.tooth;
        if (!crusher && ((p.t * (detail > 1 ? 9 : 5)) % 1) < 0.5 && p.t < 0.84) return M.tooth;
      }
      if (p.v * (dac ? 1 : -1) > 0.6) p.l += 0.07;
      return M.claw;
    };
    const blade = (b: V2, d: V2, len: number, dac: boolean, z0: number) => {
      sk.np();
      const e: V2 = [b[0] + d[0] * len, b[1] + d[1] * len];
      // blade v is measured left of travel: flip so +v means the dactyl side for both fingers
      const sideV = (-d[1] * nx + d[0] * ny) > 0 ? 1 : -1;
      const f = fingerFill(dac);
      sk.blade(b[0], b[1], e[0], e[1], t => (1 - t * 0.74) * fw * (dac ? 1 : 1.08) + 0.3, (p) => { p.v *= sideV; return f(p); },
        { z0, z1: z0 - 0.2 * k, bend: (dac ? -1 : 1) * sideV * 0.28 * k, n: [0, -0.3, 1] });
      return e;
    };
    const fe = blade(pollexB, pd, fl, false, pc2[2] + 0.7 * k);
    const de = blade(dacB, dd2, fl * 1.03, true, pc2[2] + 1.1 * k);
    return [(fe[0] + de[0]) / 2, (fe[1] + de[1]) / 2];
  };
  const crushTip = claw(0), cutTip = claw(1);
  void bodyPart;
  const sacP = o.parasite && sacShown ? s2(X.pt([0, -H * 0.9, -D * 0.28])) : null;
  return { eyes: [eyeOut[0], eyeOut[1]], mouth: mc, crushTip, cutTip, forkTip, sac: sacP, body: s2(X.pt([0, 0, 0])) };
}

/** Paint a pose to a trimmed-free buffer (canvas-sized, origin at trycopCanvas(k)). */
export function paintTrycop(P: TrycopPose, o: TrycopOpts, clipY = Infinity) {
  const cv = trycopCanvas(o.k);
  const sk = new Sk(cv.w, cv.h, cv.ox, cv.oy);
  sk.clipY = clipY;
  const out = drawTrycop(sk, P, o);
  const small = o.k < 2;
  return { buf: sk.resolve({ rim: small ? 0.06 : 0.12, bounce: small ? 0.04 : 0.08 }), out, ox: cv.ox, oy: cv.oy };
}

// ------------------------------------------------------------------ named poses for sheets / the field guide
export function trycopPoseAt(name: string, f: number, n: number): TrycopPose {
  const P = trycopRest();
  const t = f / n;
  P.t = t * 2;
  switch (name) {
    case 'idle':
      P.bob = Math.sin(t * Math.PI * 2) * 0.3;
      P.mouth = f % 2 ? 0.5 : 0.1;
      P.eyes[0].sw = Math.sin(t * 6.28) * 0.4; P.eyes[1].sw = Math.sin(t * 6.28 + 1) * 0.4;
      P.flick = t * 12;
      break;
    case 'walk':
      P.gait = t; P.step = 1; P.dir = 1;
      P.bob = Math.cos(t * Math.PI * 4) * 0.35;
      P.roll = Math.sin(t * Math.PI * 2) * 0.04;
      P.crush.raise = 0.1; P.cut.raise = 0.1;
      break;
    case 'forage':
      P.low = 0.5;
      P.fork = { ext: 1, open: f % 2 ? 0.2 : 0.9, side: -0.4, lift: [0, 0, 0.6, 1][f % 4] };
      P.mouth = f % 4 === 3 ? 1 : 0.3;
      P.cut.raise = -0.3;
      P.eyes[0].sw = -0.3; P.eyes[1].sw = 0.3;
      break;
    case 'threat':
      P.rear = 0.85 + Math.sin(t * 6.28) * 0.1;
      P.crush = { raise: 1, open: 0.9 + Math.sin(t * 12.5) * 0.1, reach: 0 };
      P.cut = { raise: 1, open: 1, reach: 0 };
      P.mouth = 0.6;
      P.eyes[0].sw = 0.2; P.eyes[1].sw = -0.2;
      break;
    case 'snap':
      P.rear = 0.4;
      P.crush = { raise: 0.3, open: f === 0 ? 1 : 0, reach: f === 0 ? 0.3 : 1 };
      P.cut = { raise: 0.8, open: 0.8, reach: 0 };
      break;
    case 'hide':
      P.sink = 0.8; P.low = 1;
      P.eyes[0].fold = 0.2; P.eyes[1].fold = 0.1;
      P.crush.raise = -0.2;
      break;
  }
  return P;
}

const GUIDE_ANIMS = { idle: { frames: 4, fps: 3, loop: true }, walk: { frames: 8, fps: 10, loop: true }, threat: { frames: 2, fps: 3, loop: true } };

/** field-guide / sheet registration (the world uses the live rig) */
export const TRYCOP_DEF: SpeciesDef = {
  name: 'Trycop Crab', kind: 'crustacean', len: 36, height: 22,
  anims: GUIDE_ANIMS,
  canvas: () => trycopCanvas(1.4),
  draw(sk: Sk, anim: string, frame: number, eye: BeastEye) {
    void eye;
    const n = GUIDE_ANIMS[anim as keyof typeof GUIDE_ANIMS]?.frames ?? 1;
    const o = drawTrycop(sk, trycopPoseAt(anim, frame, n), { k: 1.4, detail: 1 });
    return { head: o.body, eye: o.eyes[0] };
  },
};

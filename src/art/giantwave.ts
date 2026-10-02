// art/giantwave.ts: the rogue wave, painted as pixel art in the storm sea's own colours.
//
// Side view, the wave rolling in toward -x: a long back slope, a concave face that steepens as it comes,
// and a lip that grows out of the crest and pitches forward into a hooked curl. Its leading edge breaks
// into claw-like foam fingers (branching tendrils with hooked tips); the face and the curl are banded in
// dark and mid water with white foam veins following the flow; a hollow barrel sits in shadow under the
// lip; smaller foam-crested waves run ahead of it. Every colour is taken from the near band's storm
// palette (bandPalette(STORM, near.p)) and the storm whitecaps' foam, and on the flatter water at the
// wave's feet the sea's own storm strip is painted in, so it rises seamlessly out of the normal waves.
//
// API
//   export const TX: number                 // world px per texel (the art is painted at half resolution)
//   export const HMAX: number               // the tallest wave the buffers are sized for (world px)
//   export const BODY: { u0, u1, v0, v1 }   // body buffer extent, wave-local world coords
//   export const LIP:  { u0, u1, v0, v1 }   // lip buffer extent
//     wave-local: u = x - crest x (negative = in front, toward the boat), v = height above the still sea
//     texel (i, j) of a buffer covers u in [u0 + i*TX, +TX), v in (v1 - (j+1)*TX, v1 - j*TX]
//   export class GiantWaveArt
//     body: PixelBuffer                     // face, back, barrel, foot (behind the boat)
//     lip: PixelBuffer                      // the curl and its fingers (in front of everything)
//     faceTop: Int16Array                   // per body column: first row of face water (below the barrel)
//     tips: { u, v, dx, dy }[]              // finger tips of the last paint (spray comes off them)
//     H, c, t                               // the shape of the last paint
//     profile(u): number                    // surface height of the body at u for the last paint's shape
//     paint(H, c, t, x0, strip?)            // repaint both buffers. x0: world x of the crest (strip phase);
//                                           // strip: { buf, scroll, texW } from Ocean.stormStrip('near')

import { PixelBuffer } from './pixel';
import type { C } from './color';
import { BAND_SPECS, STORM, STORM_WHITECAP, bandPalette } from './ocean';
import { clamp, hash2, smoothstep } from '../core/math';

export const TX = 2;
export const HMAX = 430;
export const BODY = { u0: -560, u1: 580, v0: -110, v1: HMAX + 24 };
const ev = (x: number) => Math.round(x / TX) * TX;
export const LIP = { u0: ev(-HMAX * 0.98), u1: ev(HMAX * 0.42), v0: ev(HMAX * 0.12), v1: ev(HMAX * 1.26) };

const PI = Math.PI;
/** 4x4 ordered dither thresholds (0..1) */
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const bay = (i: number, j: number) => B4[((j & 3) << 2) | (i & 3)];

/** a tileable 256 x 256 smooth value-noise tile (lattice 16): cheap smooth noise by integer lookup */
let NT: Float32Array | null = null;
function noiseTile() {
  if (NT) return NT;
  const N = new Float32Array(256 * 256);
  const L = 16, P = 256 / L;
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      let s = 0, a = 0.62, n = 0;
      for (let o = 0; o < 2; o++) {
        const f = 1 << o, px = (x * f) / L, py = (y * f) / L, per = P * f;
        const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
        const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
        const h = (X: number, Y: number) => hash2(((X % per) + per) % per, ((Y % per) + per) % per, 91 + o);
        const v = (h(ix, iy) * (1 - ux) + h(ix + 1, iy) * ux) * (1 - uy) + (h(ix, iy + 1) * (1 - ux) + h(ix + 1, iy + 1) * ux) * uy;
        s += v * a; n += a; a *= 0.5;
      }
      N[(y << 8) | x] = s / n;
    }
  return (NT = N);
}
const nt = (N: Float32Array, x: number, y: number) => N[((Math.floor(y) & 255) << 8) | (Math.floor(x) & 255)];

/** a ramp of 256 values of t^0.85 over t in [0, 1.28] (the band strip's depth curve) */
const POW = (() => { const a = new Float32Array(257); for (let i = 0; i <= 256; i++) a[i] = Math.pow(i / 200, 0.85); return a; })();

export interface WavePalette {
  face: C[]; glow: C[]; foam: C[]; white: C[];
  rim: C; lightLine: C; lightLine2: C; darkLine: C; deep: C;
}
/** the near band's storm palette and the storm whitecaps' foam: nothing else */
export function wavePalette(): WavePalette {
  const p = bandPalette(STORM, BAND_SPECS.near.p);
  return { face: p.face, glow: p.glow, foam: p.foam, white: STORM_WHITECAP, rim: p.rim, lightLine: p.lightLine, lightLine2: p.lightLine2, darkLine: p.darkLine, deep: p.deep };
}

interface Strip { buf: PixelBuffer; scroll: number; texW: number }

export class GiantWaveArt {
  readonly body: PixelBuffer;
  readonly lip: PixelBuffer;
  readonly faceTop: Int16Array;
  tips: { u: number; v: number; dx: number; dy: number; body: boolean }[] = [];
  H = 0;
  c = 0;
  t = 0;
  readonly pal = wavePalette();
  private cl: Curl | null = null;
  private colH: Float32Array;
  private colS: Float32Array;
  private rowU: Float32Array;
  private rowK: Float32Array;
  private rowA: Float32Array;

  constructor() {
    this.body = new PixelBuffer((BODY.u1 - BODY.u0) / TX, (BODY.v1 - BODY.v0) / TX);
    this.lip = new PixelBuffer((LIP.u1 - LIP.u0) / TX, (LIP.v1 - LIP.v0) / TX);
    this.faceTop = new Int16Array(this.body.w);
    this.colH = new Float32Array(this.body.w);
    this.colS = new Float32Array(this.body.w);
    this.rowU = new Float32Array(this.body.h);
    this.rowK = new Float32Array(this.body.h);
    this.rowA = new Float32Array(this.body.h);
  }

  // ---------------------------------------------------------------- shape

  /** the face's reach in front of the crest, and the back slope's length */
  private lens(H: number) {
    return { Lf: 130 + 0.32 * H, Lb: 360 + 0.5 * H };
  }

  /** the curl's root: where it leaves the crest. The lip's outer skin starts at the crest (0, H) and its
   *  underside at the throat, low on the face: the face sweeps up into the curl's underside */
  private root(H: number, c: number) {
    const g = 0.25 + 0.75 * c;
    const T0 = 0.3 * H * g, Rx0 = 0.4 * H * g, Ry0 = 0.36 * H * g, th0 = 0.24 * PI;
    // the ellipse's outward normal at th0
    let nu = Math.cos(th0) / Rx0, nv = Math.sin(th0) / Ry0;
    const nl = Math.hypot(nu, nv); nu /= nl; nv /= nl;
    return { g, T0, Rx0, Ry0, th0, nu, nv, uT: -nu * T0, vT: H - nv * T0 };
  }

  /** surface height above the still sea at wave-local u (the body: no lip) */
  profile(u: number, H = this.H, c = this.c, t = this.t): number {
    if (H < 0.5) return 0;
    const { Lf, Lb } = this.lens(H);
    if (u >= 0) {
      const k = u / Lb;
      if (k >= 1) return 0;
      // the back: a long rounded slope, with the swell it overran still heaving on it
      return H * (1 - k * k * (3 - 2 * k)) + H * 0.022 * Math.sin(u / 34 - t * 1.1) * smoothstep(0.12, 0.35, k) * (1 - k);
    }
    const { uT, vT } = this.root(H, c);
    // over the throat, up to the crest (under the curl's root)
    if (u >= uT) return vT + (H - vT) * Math.pow((u - uT) / -uT, 0.7);
    // the face: concave, sweeping up ever steeper into the curl as it comes (sucked flat at its foot)
    const s = (uT - u) / (Lf + uT);
    if (s <= 1) return vT * Math.pow(1 - s, 1.4 + 0.9 * c);
    // in front: the drawdown trough, then two smaller waves running ahead of it
    const x = -u - Lf;
    let v = x < 95 ? -0.07 * H * Math.sin((PI * x) / 95) : 0;
    v += 0.1 * H * peak(x - 128, 80, 40) + 0.06 * H * peak(x - 228, 60, 28);
    return v * (1 - smoothstep(262, 300, x));
  }
  /** where the face reaches height v (v in 0..H; the inverse of the face part of profile) */
  private faceU(v: number, H: number, c: number) {
    const { Lf } = this.lens(H);
    const { uT, vT } = this.root(H, c);
    if (v >= vT) return uT - uT * Math.pow(clamp((v - vT) / (H - vT)), 1 / 0.7);
    return uT - (1 - Math.pow(clamp(v / vT), 1 / (1.4 + 0.9 * c))) * (Lf + uT);
  }
  /** crest positions (u) of the two waves running ahead */
  private aheadU(H: number) {
    const { Lf } = this.lens(H);
    return [-(Lf + 128), -(Lf + 228)];
  }

  /** the curl: centreline points, thickness and outward normals, sampled densely along it */
  private curl(H: number, c: number): Curl {
    const { g, T0, Rx0, Ry0, th0, nu: n0u, nv: n0v } = this.root(H, c);
    // a big forward-leaning hook: it rises above the crest, reaches out ahead and comes over
    const ths = th0 - 0.035 * PI, Th = PI * (0.3 + 0.68 * c), the = th0 + Th;
    const cu = -n0u * T0 * 0.5 - Rx0 * Math.cos(th0), cv = H - n0v * T0 * 0.5 - Ry0 * Math.sin(th0);
    const at = (th: number): [number, number] => {
      const k = 1 - (0.36 * Math.max(0, th - th0)) / PI;
      return [cu + Rx0 * k * Math.cos(th), cv + Ry0 * k * Math.sin(th)];
    };
    // sample finely enough for the outer edge (no holes when it's stamped)
    const n = Math.max(40, Math.ceil(((the - ths) * (Rx0 + T0) * 1.1) / 0.9));
    const P: Curl['P'] = [];
    let s = 0, pu = 0, pv = 0;
    for (let i = 0; i <= n; i++) {
      const th = ths + ((the - ths) * i) / n;
      const [u, v] = at(th);
      const [u1, v1] = at(th + 0.002), [u0, v0] = at(th - 0.002);
      const tu = u1 - u0, tv = v1 - v0, tl = Math.hypot(tu, tv) || 1;
      if (i > 0) s += Math.hypot(u - pu, v - pv);
      pu = u; pv = v;
      const tau = clamp((th - th0) / Th);
      const T = T0 * (1 - 0.74 * tau) * (1 - 0.45 * smoothstep(0.84, 1, tau));
      // outward normal: right of the direction of travel (the curl turns counter-clockwise, v up);
      // `fade` dithers the root into the body it grows out of
      P.push({ u, v, nu: tv / tl, nv: -tu / tl, T, tau, s, th, fade: smoothstep(ths, th0, th) });
    }
    return { P, g, th0, the };
  }

  // ---------------------------------------------------------------- painting

  /** repaint both buffers for this shape (see paintBody and paintLip) */
  paint(H: number, c: number, t: number, x0: number, strip?: Strip) {
    this.paintBody(H, c, t, x0, strip);
    this.paintLip();
  }

  /** take on a new shape and repaint the body (paintLip then repaints the curl to match: the two can be
   *  painted on separate frames) */
  paintBody(Hin: number, c: number, t: number, x0: number, strip?: Strip) {
    const H = Math.min(HMAX, Hin);
    this.H = H; this.c = c; this.t = t;
    this.tips = [];
    const cl = (this.cl = H >= 20 ? this.curl(H, c) : null);
    const b = this.body, D = b.data, W = b.w, Hh = b.h, N = noiseTile(), P = this.pal;
    const F = P.face, deep = P.deep;
    D.fill(0);
    const colH = this.colH, colS = this.colS, top = this.faceTop;
    for (let i = 0; i < W; i++) colH[i] = this.profile(BODY.u0 + (i + 0.5) * TX, H, c, t);
    // the slope over a few texels (the bands follow the surface without a seam over the sharp crest)
    for (let i = 0; i < W; i++) colS[i] = (colH[Math.min(W - 1, i + 4)] - colH[Math.max(0, i - 4)]) / (8 * TX);
    const sb = strip?.buf, sw = sb?.w ?? 0, sh = sb ? Math.min(118, sb.h - 1) : 0;
    const ahead = this.aheadU(H);
    // the face under the curl lies in its shadow
    let shU0 = 0;
    if (cl && c > 0.05) for (const p of cl.P) if (p.th >= cl.th0) shU0 = Math.min(shU0, p.u);
    const shK = Math.min(1, c * 3);
    // the face, row by row: where it is and how steep (inside the body, the bands keep their distance
    // from the nearest surface: under the steep face that's the face beside, not the surface above)
    const rows = this.rowU, rowK = this.rowK, rowA = this.rowA;
    for (let j = 0; j < Hh; j++) {
      const v = BODY.v1 - (j + 0.5) * TX;
      if (v <= 1 || v >= H) { rows[j] = -1e9; rowK[j] = 1; continue; }
      const uf = this.faceU(v, H, c);
      const sl = (this.profile(uf + 1.5, H, c, t) - this.profile(uf - 1.5, H, c, t)) / 3;
      rows[j] = uf; rowK[j] = Math.abs(sl) / Math.sqrt(1 + sl * sl); rowA[j] = (H - v) - uf * 0.3;
    }
    for (let i = 0; i < W; i++) {
      const u = BODY.u0 + (i + 0.5) * TX, h = colH[i], sl = colS[i];
      const j0 = Math.max(0, Math.ceil((BODY.v1 - h) / TX - 0.5));
      top[i] = j0;
      if (j0 >= Hh) continue;
      const kS = 1 / Math.sqrt(1 + sl * sl);
      const hp = Math.max(0, h);
      const Dsc = 120 + 0.55 * hp;
      const front = u < 0;
      // flat, low water: the sea's own strip; tall or steep water: the banded face
      const wStrip = sb ? (1 - smoothstep(0.7, 1.8, Math.abs(sl))) * (1 - smoothstep(60, 150, hp)) : 0;
      const sc = sb ? ((Math.floor(x0 + u + strip!.scroll) % strip!.texW) + strip!.texW) % strip!.texW : 0;
      // the bands: parallel to the surface, broken along it, flowing down the face
      const sk = smoothstep(30, 150, hp) * (front ? 1 : 1 - 0.45 * smoothstep(0, 0.3 * H, u));
      const bw = 1 / (10 + 0.05 * hp);
      const a = front ? (H - h) - u * 0.3 : u + (H - h) * 0.3;
      const warp = 0.9 * nt(N, a * 0.09, 37);
      const lee = front ? 0 : smoothstep(0.08, 0.7, -sl);
      const under = shU0 < 0 && front && u > shU0 ? smoothstep(shU0, shU0 * 0.55, u) * (1 - smoothstep(-0.05 * H, 0, u)) * shK : 0;
      // light through the thin water under the crest
      const glowD = under > 0.3 ? 0 : front && h > 0.5 * H ? (6 + 0.05 * H) * smoothstep(0.5 * H, 0.85 * H, h) : u >= 0 && u < 0.2 * H ? (4 + 0.03 * H) * (1 - u / (0.2 * H)) * smoothstep(0.6 * H, 0.9 * H, h) : 0;
      // whitewater streaming down the upper face
      const laceD = front ? (3 + 0.035 * hp) * smoothstep(0.25 * H, 0.6 * H, h) * (1 - under * 0.6) : 0;
      // foam caps on the waves running ahead, and the crown's foam spilling back over the crest
      let cap = u > -0.02 * H && u < 0.22 * H && h > 0.7 * H ? (4 + 0.05 * H * (0.4 + 0.6 * c)) * (1 - u / (0.22 * H)) : 0;
      for (const ua of ahead) {
        const du = u - ua;
        if (du > -26 && du < 18) cap = Math.max(cap, (du < 0 ? 1 + du / 26 : 1 - du / 18) * (3 + 0.018 * H));
      }
      for (let j = j0; j < Hh; j++) {
        const v = BODY.v1 - (j + 0.5) * TX, d = h - v;
        let dn = d * kS, aa = a;
        const dh = (u - rows[j]) * rowK[j];
        if (dh < dn + 24) {
          // a smooth minimum of the two distances: the bands round the corner under the crest
          const k = clamp(0.5 + (dn - dh) / 48);
          aa = a + (rowA[j] - a) * k;
          dn = dh * k + dn * (1 - k) - 24 * k * (1 - k);
        }
        let col: C;
        if (wStrip > 0 && d < sh && bay(i + 1, j + 2) < wStrip) {
          col = sb!.data[Math.max(0, Math.floor(d - 1)) * sw + sc];
        } else {
          const tD = dn / Dsc;
          if (tD > 1.25) { D[j * W + i] = deep; continue; }
          let f = POW[Math.min(256, (tD * 200) | 0)] * 5.4 + (nt(N, u * 0.25, dn * 0.5) - 0.5) * 1.5;
          const a = aa;
          let line = -1;
          if (sk > 0.01) {
            const skk = sk * clamp((0.62 - tD) * 4);
            const q = dn * bw + warp;
            const k = Math.floor(q), fr = q - k;
            const light = (k & 1) === 0;
            f += skk * (light ? -0.6 : 1.1);
            if (skk > 0.2 && fr < 0.18) {
              // the edges of the bands: white veins along the light ones, a dark line over the dark ones
              const seg = hash2(k, Math.floor((a - t * 42 + k * 37) / (60 + 90 * hash2(k, 1, 5))), 5);
              if (light) {
                if (fr < 0.1) line = seg > 0.5 ? (tD < 0.35 ? P.white[1] : P.foam[1]) : seg > 0.22 ? P.lightLine : -1;
                else if (seg > 0.5) line = P.foam[0];
              } else if (fr < 0.07 && seg > 0.35) line = P.darkLine;
            }
          }
          if (lee > 0) f += lee * clamp(1 - dn / 60) * 1.3;
          if (v < 0) { f += smoothstep(0, -60, v) * 2 * smoothstep(20, 150, hp); if (v < -8) line = -1; }
          if (under > 0) f += under * clamp(1.4 - dn / 90) * 1.6;
          const fi = Math.round(f + bay(i, j) - 0.5);
          col = line >= 0 ? line : fi <= 0 ? F[0] : fi >= 6 ? deep : F[fi];
          if (glowD > 0 && dn < glowD) {
            const g = 1 - dn / glowD;
            if (g + (bay(i + 2, j) - 0.5) * 0.5 > 0.3) col = g > 0.72 ? P.glow[0] : g > 0.45 ? P.glow[1] : P.glow[2];
          }
          if (laceD > 0 && dn < laceD) {
            const n = nt(N, u * 0.6 + 11, (a * 0.5 - t * 22) * 0.7);
            const thr = 0.5 + (dn / laceD) * 0.25;
            if (n > thr) col = n > thr + 0.12 && under < 0.4 ? P.white[2] : P.foam[1];
          }
          // the surface skin: the storm rim, as on the band
          if (d < 2.2) col = under > 0.4 ? P.foam[0] : nt(N, u * 0.8, 3) > 0.35 ? P.foam[2] : P.foam[1];
        }
        if (cap > 0 && d < cap) {
          const n = nt(N, u * 1.2, d * 1.5 + 70);
          if (d < cap * 0.5 || n > 0.45) col = d < 2.2 || n > 0.72 ? P.white[2] : n > 0.55 ? P.white[1] : P.white[0];
        }
        D[j * W + i] = col;
      }
    }
    // the waves running ahead break too: little hooked fingers off their crests
    for (const [k, ua] of ahead.entries()) {
      const hv = this.profile(ua, H, c, t);
      if (hv < 8) continue;
      for (let m = 0; m < 3; m++) {
        const L = hv * (0.45 + 0.3 * hash2(k, m, 3)) * (0.8 + 0.3 * Math.sin(t * 2.3 + m * 2 + k));
        this.finger(b, BODY.u0, BODY.v1, ua - 3 - m * 7, hv + 1 - m * 2, -0.9, 0.45 - m * 0.1, L, 1.5 + (2 - m) * 0.5, 0.8, k * 10 + m, t, m === 0);
      }
    }
    if (cl && c > 0.05) this.paintBarrel(cl, t);
  }

  /** the hollow under the curl: the face's inner wall in shadow, with drips falling from the lip */
  private paintBarrel(cl: Curl, t: number) {
    const { P, th0 } = cl;
    const tx = (u: number) => (u - BODY.u0) / TX, ty = (v: number) => (BODY.v1 - v) / TX;
    const pts: [number, number][] = [];
    for (const p of P) if (p.th >= th0) pts.push([tx(p.u - p.nu * p.T * 0.5), ty(p.v - p.nv * p.T * 0.5)]);
    if (pts.length < 3) return;
    const root = P.find(p => p.th >= th0)!;
    const E = pts[pts.length - 1];
    const uRoot = root.u - root.nu * root.T * 0.5;
    // the open mouth: from the lip's tip across to the face, partway back toward the inner wall
    const uM = Math.min(uRoot - 4, (P[P.length - 1].u + uRoot) * 0.5);
    const M: [number, number] = [tx(uM), ty(this.profile(uM))];
    pts.push(M);
    for (let u = uM + 4; u < uRoot; u += 4) pts.push([tx(u), ty(this.profile(u))]);
    pts.push([tx(uRoot), ty(this.profile(uRoot))]);
    const b = this.body, D = b.data, W = b.w, Pal = this.pal, top = this.faceTop;
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const mx = M[0] - E[0], my = M[1] - E[1], ml = Math.hypot(mx, my) || 1;
    // which side of the mouth is inside: the root's side
    const rs = Math.sign(mx * (pts[0][1] - E[1]) - my * (pts[0][0] - E[0])) || 1;
    const xs: number[] = [];
    for (let j = Math.max(0, Math.floor(y0)); j <= Math.min(b.h - 1, Math.ceil(y1)); j++) {
      const y = j + 0.5;
      xs.length = 0;
      for (let k = 0; k < pts.length; k++) {
        const [ax, ay] = pts[k], [bx, by] = pts[(k + 1) % pts.length];
        if ((ay <= y) !== (by <= y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let i = Math.max(0, Math.ceil(xs[k] - 0.5)); i <= Math.min(W - 1, Math.floor(xs[k + 1] - 0.5)); i++) {
          if (j >= top[i]) continue;
          // fade out toward the open mouth (dithered, no soft edge)
          const m = (rs * (mx * (y - E[1]) - my * (i + 0.5 - E[0]))) / ml;
          if (m < 10 && bay(i, j) * 10 > m) continue;
          const e = top[i] - j;
          let col = e < 3 ? Pal.face[5] : e < 9 || m < 16 ? (((i + j) & 1) ? Pal.darkLine : Pal.deep) : Pal.deep;
          // a curtain of drips falling off the underside of the lip
          const hd = hash2(i, 77, 3);
          if (hd > 0.9 && e > 14 && ((j + Math.floor(t * 34 + hd * 97)) % 29) < 3 + (hd > 0.97 ? 2 : 0)) col = ((i + j) & 1) ? Pal.foam[0] : Pal.face[3];
          D[j * W + i] = col;
        }
      }
    }
  }

  /** repaint the curl and its claws for the shape of the last paintBody */
  paintLip() {
    const H = this.H, c = this.c, t = this.t, cl = this.cl;
    this.tips = this.tips.filter(tp => tp.body);
    const b = this.lip, D = b.data, W = b.w, Hh = b.h, N = noiseTile(), P = this.pal, F = P.face;
    D.fill(0);
    if (!cl) return;
    const { P: C, g } = cl;
    // the curl's body: stamped across its thickness, coloured by where across (q) and along (s) it is
    for (const p of C) {
      if (p.T < 0.6) continue;
      const half = p.T * 0.5;
      const steps = Math.max(2, Math.ceil(p.T / 1.1));
      for (let k = 0; k <= steps; k++) {
        const q = -1 + (2 * k) / steps;
        const u = p.u + p.nu * half * q, v = p.v + p.nv * half * q;
        const i = Math.floor((u - LIP.u0) / TX), j = Math.floor((LIP.v1 - v) / TX);
        if (i < 0 || j < 0 || i >= W || j >= Hh) continue;
        if (p.fade < 1 && bay(i, j) >= p.fade) continue;
        const s = p.s;
        let col: C;
        const qf = 0.34 + 0.36 * nt(N, s * 0.12 - t * 9, 7) + p.tau * 0.1;
        if (q > qf) {
          // the white crown of the curl, with holes of bright water in its lace
          const n = nt(N, s * 0.45 + 40, q * 10 + t * 3);
          if (n < 0.2 && q < 0.9) col = P.glow[1];
          else col = q > qf + 0.14 ? (n > 0.74 ? P.white[3] : P.white[2]) : n > 0.5 ? P.white[1] : P.foam[1];
        } else if (q < -0.8) {
          // the underside in shadow, its very edge catching a little light
          col = q < -0.93 && hash2(Math.floor(s / 5), 3, 9) > 0.45 ? P.foam[0] : ((i + j) & 1) && q > -0.9 ? F[5] : P.darkLine;
        } else {
          // bands following the curl, with white veins streaming along them
          const qq = (q + 1) * 2.4 + 0.6 * nt(N, s * 0.05, 3);
          const kq = Math.floor(qq), fr = qq - kq;
          const f = 0.4 + (1 - q) * 1.5 + ((kq & 1) ? 1.1 : -0.4) + p.tau * 0.6;
          const fi = Math.round(f + bay(i, j) - 0.5);
          col = fi <= 0 ? F[0] : fi >= 6 ? P.deep : F[fi];
          if (p.tau < 0.4 && !(kq & 1) && q > -0.3) col = fi <= 1 ? P.glow[1] : P.glow[2];
          if (fr < 0.16) {
            const seg = hash2(kq, Math.floor((s - t * 55) / (50 + 60 * hash2(kq, 2, 11))), 11);
            if (!(kq & 1)) col = seg > 0.42 ? (q > 0 ? P.white[1] : P.foam[1]) : seg > 0.2 ? P.lightLine2 : col;
            else if (fr < 0.08 && seg > 0.3) col = P.darkLine;
          }
        }
        D[j * W + i] = col;
      }
    }
    const curlK = 0.25 + 0.75 * c;
    const at = (tau: number) => C[Math.min(C.length - 1, Math.max(0, C.findIndex(q => q.tau >= tau)))];
    const claw = (f: number, tau: number, L: number, r0: number, hook: number, branch: boolean) => {
      const p = at(tau);
      if (!p || p.T < 2) return;
      const tu = -p.nv, tv = p.nu; // the direction of travel along the curl
      const lean = tau < 0.15 ? 0.45 : 0.9;
      let dx = p.nu + tu * lean, dy = p.nv + tv * lean;
      const l = Math.hypot(dx, dy); dx /= l; dy /= l;
      this.finger(b, LIP.u0, LIP.v1, p.u + p.nu * p.T * 0.4, p.v + p.nv * p.T * 0.4, dx, dy, L, r0, hook, f, t, branch);
    };
    const flick = (f: number, sp: number) => 0.72 + 0.4 * (0.5 + 0.5 * Math.sin(t * (sp + hash2(f, 4, 7)) + f * 5.1));
    // small tufts of torn foam all along the crown...
    for (let f = 0; f < 9; f++) {
      const tau = 0.03 + 0.97 * ((f + 0.5 + 0.7 * (hash2(f, 11, 7) - 0.5)) / 9) + 0.01 * Math.sin(t * 0.9 + f);
      claw(100 + f, tau, H * (0.03 + 0.03 * hash2(f, 12, 7)) * curlK * flick(f + 50, 2.1), 1.2 + 0.9 * hash2(f, 13, 7), 1.5, false);
    }
    // ...and the claws: big branching tendrils along the leading edge, hooking over
    const NF = 10;
    for (let f = 0; f < NF; f++) {
      const tau = 0.14 + 0.86 * ((f + 0.5 + 0.6 * (hash2(f, 1, 7) - 0.5)) / NF) + 0.012 * Math.sin(t * 0.7 + f);
      const L = H * (0.1 + 0.1 * hash2(f, 3, 7)) * curlK * flick(f, 1.3) * (0.7 + 0.5 * tau);
      claw(f, tau, L, (3.6 + 2.4 * hash2(f, 5, 7)) * (0.55 + 0.45 * g), 1.45, true);
    }
    // the tip of the curl fans out into a hand of hooked claws
    const e = C[C.length - 1], e2 = C[Math.max(0, C.length - 8)];
    let ex = e.u - e2.u, ey = e.v - e2.v;
    const el = Math.hypot(ex, ey) || 1; ex /= el; ey /= el;
    for (let f = 0; f < 5; f++) {
      const a = -0.95 + f * 0.42 + 0.15 * Math.sin(t * 1.7 + f * 2);
      const ca = Math.cos(a), sa = Math.sin(a);
      const L = H * (0.09 + 0.06 * hash2(f, 8, 7)) * curlK * flick(f + 30, 1.9);
      this.finger(b, LIP.u0, LIP.v1, e.u, e.v, ex * ca - ey * sa, ex * sa + ey * ca, L, (2.6 + 1.2 * hash2(f, 9, 7)) * (0.55 + 0.45 * g), 1.15, 40 + f, t, f !== 2);
    }
    // droplets hanging in the air around the claws (re-scattered every paint)
    const seedT = Math.floor(t * 8);
    const put = (u: number, v: number, col: C) => {
      const i = Math.floor((u - LIP.u0) / TX), j = Math.floor((LIP.v1 - v) / TX);
      if (i >= 0 && j >= 0 && i < W && j < Hh) D[j * W + i] = col;
    };
    for (const tp of this.tips) {
      for (let k = 0; k < 3; k++) {
        if (hash2(Math.floor(tp.u), k, seedT) > 0.55) continue;
        const dd = 3 + hash2(k, Math.floor(tp.v), seedT) * 10;
        put(tp.u + tp.dx * dd + (hash2(k, 5, seedT) - 0.5) * 12, tp.v + tp.dy * dd + (hash2(k, 6, seedT) - 0.5) * 12, k ? P.white[2] : P.white[3]);
      }
    }
  }

  /**
   * One claw of foam, stamped into `buf` (whose texel (0,0) is at wave-local (u0, v1)): it starts at
   * (u, v) heading (dx, dy), tapers from radius r0 (texels), and turns ever harder counter-clockwise
   * toward its hooked tip; most branch once or twice. `k` makes it its own (stable) shape.
   */
  private finger(buf: PixelBuffer, u0: number, v1: number, u: number, v: number, dx: number, dy: number, L: number, r0: number, hook: number, k: number, t: number, branch: boolean, depth = 0) {
    const P = this.pal, D = buf.data, W = buf.w, Hh = buf.h;
    const disc = (cu: number, cv: number, r: number, col: C) => {
      const ci = (cu - u0) / TX, cj = (v1 - cv) / TX;
      const R = Math.max(0.5, r), R2 = R * R;
      for (let j = Math.floor(cj - R); j <= Math.ceil(cj + R); j++) {
        if (j < 0 || j >= Hh) continue;
        for (let i = Math.floor(ci - R); i <= Math.ceil(ci + R); i++) {
          if (i < 0 || i >= W) continue;
          const ddx = i + 0.5 - ci, ddy = j + 0.5 - cj;
          if (ddx * ddx + ddy * ddy <= R2) D[j * W + i] = col;
        }
      }
    };
    const n = 12;
    const step = L / n;
    let a = Math.atan2(dy, dx);
    const kh = (0.7 + 0.6 * hash2(k, 21, 7)) * hook * (1 + 0.25 * Math.sin(t * 2.1 + k));
    const bAt = branch && depth === 0 && hash2(k, 23, 7) > 0.15 ? 2 + Math.floor(hash2(k, 24, 7) * 3) : -1;
    const bAt2 = branch && depth === 0 && hash2(k, 25, 7) > 0.45 ? 6 + Math.floor(hash2(k, 26, 7) * 2) : -1;
    let x = u, y = v;
    for (let s = 0; s < n; s++) {
      const r = r0 * Math.pow(1 - s / n, depth ? 0.8 : 1.25) + 0.5;
      const sub = Math.max(1, Math.ceil(step / TX / Math.max(0.6, r * 0.6)));
      for (let m = 0; m < sub; m++) {
        x += (Math.cos(a) * step) / sub; y += (Math.sin(a) * step) / sub;
        // shaded on the inside of the hook, white on the outside, a bright glint near the tip
        const lu = -Math.sin(a), lv = Math.cos(a);
        disc(x + lu * TX * 0.8, y + lv * TX * 0.8, r, P.white[0]);
        disc(x - lu * TX * 0.25, y - lv * TX * 0.25, r * 0.82, s > n - 4 ? P.white[3] : P.white[2]);
      }
      a += (0.05 + 0.36 * Math.pow(s / n, 2)) * kh;
      if (s === bAt || s === bAt2) {
        const ba = a - 0.7 - 0.45 * hash2(k, s, 27);
        this.finger(buf, u0, v1, x, y, Math.cos(ba), Math.sin(ba), L * (0.66 - s * 0.03), Math.max(1.2, r * 0.8), hook * 1.15, k * 7 + s, t, false, depth + 1);
      }
    }
    this.tips.push({ u: x, v: y, dx: Math.cos(a), dy: Math.sin(a), body: buf === this.body });
  }
}

interface Curl { P: { u: number; v: number; nu: number; nv: number; T: number; tau: number; s: number; th: number; fade: number }[]; g: number; th0: number; the: number }

/** one small wave's shape: a rounded back of width wb, a steep front of width wf (toward -u) */
function peak(d: number, wb: number, wf: number) {
  if (d < 0) return d > -wb ? 0.5 + 0.5 * Math.cos((PI * d) / wb) : 0;
  return d < wf ? Math.pow(1 - d / wf, 1.7) : 0;
}

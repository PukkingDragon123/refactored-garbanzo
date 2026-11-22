// V12 wild birds: shared contour parts for the small high-country birds painted in ./birds.ts (the kea
// and the ruru). Everything is built for a sprite only a couple of dozen pixels long, on the relief layer
// (beasts-relief.ts) of the beast sketch core: one continuous contour per mass, the plumage as texture.
//
//   cwing     a spread wing as ONE contour: shoulder, the leading edge to the wrist, out to the tip of the
//             outer primary, back along the primaries' tips (notched where the fingers part) and the
//             secondaries' scalloped edge to the body. The interior is split into tracts by the nearest
//             flight-feather shaft: marginal / lesser, median and greater coverts in rows over the
//             bases, then the secondaries and primaries, each feather parted from the next by a seam.
//             The 3D pose (elevation, hand, fold, sweep) projects with the camera tilt, as the shared
//             bird rig does (beasts-bird.ts spreadWing, whose math this follows).
//   cell2     tiny imbricated feathers (rows of scallops) for body plumage at a 2-3 px pitch.

import { Sk, V2, V3, proj } from '../../beasts-core';
import { Relief, spline } from '../../beasts-relief';
import type { LM, Tx } from '../../beasts-relief';
import type { WingPose } from '../../beasts-bird';
import { hash2 } from '../../../core/math';

export interface CWingLook {
  /** shoulder -> wrist, wrist -> outer primary base line, secondary and longest primary length (px) */
  arm: number; hand: number; sec: number; prim: number;
  nS: number; nP: number;
  /** 0 a closed tip .. 1 deeply slotted fingers; 0 pointed .. 1 rounded wingtip */
  finger: number; round: number;
}
export type Tract = 'L' | 'M' | 'G' | 'S' | 'P';
/** what a wing texture sees at a pixel */
export interface WPx {
  tract: Tract;
  /** feather index (in its row), fraction along it (0 base .. 1 tip), across it (-1..1) */
  i: number; u: number; v: number;
  /** we see the upper surface here; the pixel sits on the seam between two feathers / two covert rows */
  top: boolean; seam: boolean; rowEdge: boolean;
}
export type WFill = (q: WPx, o: Tx) => void;

const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * A spread wing (see the header). `o` is the screen origin of body space, `sh` the shoulder in body
 * space (x forward, y up, z toward the viewer), side +1 the near wing, -1 the far one; z is the depth
 * the wing sits at (it z-sorts with the rest of the sketch). Returns the wrist and tip on screen.
 */
export function cwing(sk: Sk, o: V2, sh: V3, W: CWingLook, P: WingPose, side: 1 | -1, k: number, fill: WFill, z: number, bias = 0) {
  const fold = P.fold;
  const armL = W.arm * k * (1 - fold * 0.35), handL = W.hand * k * (1 - fold * 0.5);
  const th = P.th, thH = P.th + P.hand;
  const sw = P.sweep, swH = P.sweep - fold * 0.9;
  const dir = (el: number, swp: number): V3 => [Math.sin(swp) * Math.cos(el), Math.sin(el), side * Math.cos(swp) * Math.cos(el)];
  const dA = dir(th, sw), dH = dir(thH, swH);
  const wrist: V3 = [sh[0] + dA[0] * armL, sh[1] + dA[1] * armL, sh[2] + dA[2] * armL];
  const chordOf = (d: V3): V3 => {
    const dot = -d[0];
    const c: V3 = [-1 - dot * d[0], -dot * d[1], -dot * d[2]];
    const l = Math.hypot(c[0], c[1], c[2]) || 1;
    return [c[0] / l, c[1] / l, c[2] / l];
  };
  const cA = chordOf(dA), cH = chordOf(dH);
  const faces = (d: V3, c: V3) => {
    let n: V3 = [d[1] * c[2] - d[2] * c[1], d[2] * c[0] - d[0] * c[2], d[0] * c[1] - d[1] * c[0]];
    if (n[1] * side < 0) n = [-n[0], -n[1], -n[2]];
    const q = proj(n), q0 = proj([0, 0, 0]);
    return q[2] - q0[2] >= 0;
  };
  const topA = faces(dA, cA), topH = faces(dH, cH);
  const S2 = (p: V3): V2 => { const q = proj(p); return [q[0] + o[0], q[1] + o[1]]; };
  const at = (a: V3, d: V3, L: number): V3 => [a[0] + d[0] * L, a[1] + d[1] * L, a[2] + d[2] * L];

  // the flight feathers' shafts on screen: secondaries along the arm, primaries fanned off the hand
  type F = { b: V2; t: V2; prim: boolean; i: number };
  const fs: F[] = [];
  for (let i = 0; i < W.nS; i++) {
    const t = (i + 0.5) / W.nS;
    const b = at(sh, dA, armL * (0.06 + t * 0.94));
    const a = -0.06 + (i / W.nS) * 0.12;
    const d: V3 = [cA[0] * Math.cos(a) + dA[0] * Math.sin(a), cA[1] * Math.cos(a) + dA[1] * Math.sin(a), cA[2] * Math.cos(a) + dA[2] * Math.sin(a)];
    const L = W.sec * k * (i === 0 ? 0.86 : 1) * (1 + 0.06 * Math.sin(t * Math.PI));
    fs.push({ b: S2(b), t: S2(at(b, d, L)), prim: false, i });
  }
  const spreadK = P.spread ?? 1;
  for (let i = 0; i < W.nP; i++) {
    const t = i / Math.max(1, W.nP - 1);
    const b = at(wrist, dH, handL * (0.04 + t * 0.92));
    const a = (0.12 + t * 1.02 * spreadK) * (1 - fold * 0.75);
    const d: V3 = [cH[0] * Math.cos(a) + dH[0] * Math.sin(a), cH[1] * Math.cos(a) + dH[1] * Math.sin(a), cH[2] * Math.cos(a) + dH[2] * Math.sin(a)];
    const L = W.prim * k * (0.62 + 0.38 * Math.sin(Math.min(1, t * 1.25 + 0.1) * Math.PI * (0.5 + W.round * 0.3))) * (1 - fold * 0.12);
    fs.push({ b: S2(b), t: S2(at(b, d, L)), prim: true, i });
  }
  const shS = S2(sh), wrS = S2(wrist);
  const P0 = fs.filter(f => f.prim), S0 = fs.filter(f => !f.prim);
  const outer = P0[P0.length - 1];
  // ---- the one contour: leading edge, the fingertips, the scalloped trailing edge, back into the body
  const lerp = (a: V2, b: V2, t: number): V2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const fw = (f: F) => { const dx = f.t[0] - f.b[0], dy = f.t[1] - f.b[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l, l] as const; };
  // the leading edge bows forward of the bones (away from the trailing side)
  const tr0 = fw(S0[Math.floor(S0.length / 2)]);
  const lead = (p: V2, d: number): LM => [p[0] - tr0[0] * d * k, p[1] - tr0[1] * d * k, 0];
  const out: LM[] = [lead(shS, 0.6), lead(lerp(shS, wrS, 0.5), 0.9), [...lead(wrS, 0.8).slice(0, 2), 0.35] as LM, lead(lerp(wrS, outer.b, 0.6), 0.5)];
  for (let i = P0.length - 1; i >= 0; i--) {
    const f = P0[i];
    out.push([f.t[0], f.t[1], i >= P0.length - 3 ? 0.7 : 0.4]);
    if (i > 0) {
      const g = P0[i - 1], slot = W.finger * Math.max(0, (i / (P0.length - 1) - 0.4) / 0.6);
      const q = 0.86 - slot * 0.32;
      const m = lerp(lerp(f.b, f.t, q), lerp(g.b, g.t, q), 0.5);
      out.push([m[0], m[1], 0.6]);
    }
  }
  for (let i = S0.length - 1; i >= 0; i--) {
    const f = S0[i];
    if (i < S0.length - 1) { const g = S0[i + 1]; const m = lerp(lerp(f.b, f.t, 0.9), lerp(g.b, g.t, 0.9), 0.5); out.push([m[0], m[1], 0.5]); }
    out.push([f.t[0], f.t[1], 0.3]);
  }
  const inner = S0[0];
  out.push([...lerp(inner.b, inner.t, 0.45), 0] as LM);
  const poly = spline(out, 0.4);

  // ---- the interior: tract by the nearest shaft
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of poly) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
  const R = new Relief(sk, x0 - 1, y0 - 1, x1 + 1, y1 + 1);
  const Q: WPx = { tract: 'S', i: 0, u: 0, v: 0, top: true, seam: false, rowEdge: false };
  const meta = fs.map(f => { const [dx, dy, l] = fw(f); return { f, dx, dy, l }; });
  R.region(poly, {
    z, R: 1.1 * k, H: 1.2 * k, id: 1,
    tex: (p, oo) => {
      let b1 = 1e9, b2 = 1e9, m1 = meta[0], u1 = 0, c1 = 0;
      for (const m of meta) {
        const px = p.x - m.f.b[0], py = p.y - m.f.b[1];
        const a = px * m.dx + py * m.dy, c = -px * m.dy + py * m.dx;
        const u = a / m.l;
        const uc = u < 0 ? -u * m.l : u > 1 ? (u - 1) * m.l : 0;
        const d = Math.hypot(c, uc);
        if (d < b1) { b2 = b1; b1 = d; m1 = m; u1 = u; c1 = c; } else if (d < b2) b2 = d;
      }
      const prim = m1.f.prim;
      const u = u1;
      // the covert rows lie over the flight feathers' bases (shorter on the hand)
      const g = prim ? [0.08, 0.16, 0.3] : [0.16, 0.28, 0.46];
      let tract: Tract = u < g[0] ? 'L' : u < g[1] ? 'M' : u < g[2] ? 'G' : prim ? 'P' : 'S';
      if (u < 0) tract = 'L';
      Q.tract = tract; Q.i = m1.f.i; Q.u = u; Q.v = c1 / Math.max(0.6, (b1 + b2) * 0.5 + 0.3);
      Q.top = prim ? topH : topA;
      Q.seam = (tract === 'S' || tract === 'P') && b2 - b1 < 0.7;
      Q.rowEdge = tract !== 'S' && tract !== 'P' && [g[0], g[1], g[2]].some(e => u < e && u > e - 0.07 * (prim ? 0.8 : 1));
      fill(Q, oo);
    },
  });
  R.emit({ bias, drop: 1.2, seam: 0.8, seamDark: 0.25 });
  return { wrist: wrS, tip: outer.t, top: topA };
}

/**
 * Tiny imbricated feathers: rows across `ang` (the way the feathers point), cw px across, rh px along.
 * Returns 2 on a feather's dark tip edge, 1 on the lit body just inside it, 0 elsewhere.
 */
export function cell2(x: number, y: number, ang: number, cw: number, rh: number, seed: number): number {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const a = x * ca + y * sa, c = -x * sa + y * ca;
  const r = Math.floor(a / rh);
  const off = (r & 1) * 0.5 + (hash2(r, 1, seed) - 0.5) * 0.2;
  const fc = c / cw + off, q = Math.floor(fc), u = fc - q - 0.5;
  const fa = a / rh - r;
  const tip = 0.66 + 0.34 * (1 - 4 * u * u);
  if (fa > tip) return 2;
  if (fa > tip - 0.4) return 1;
  return 0;
}
export const clamp01 = cl;

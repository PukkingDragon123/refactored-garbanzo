// Bird rig for the V2 beasts: egg body, neck chain, head frame, IK legs with toes, fanned tail,
// a layered folded wing, and a 3D spread wing (projected with the camera tilt) built from separate
// primaries, secondaries and covert rows. Every feather is its own part, so the resolve pass draws
// crisp separation lines where feathers overlap.

import { Sk, V2, V3, Px, TAU, ik2, proj, cbez, lumN, hh } from './beasts-core';
import { Frame2 } from './beasts-rig';

export type FeatherFill = (p: Px, row: 'P' | 'S' | 'G' | 'M' | 'L' | 'T', i: number, under: boolean) => number;

export interface WingLook {
  arm: number;       // shoulder -> wrist (px)
  hand: number;      // wrist -> tip of the outer primary base line
  sec: number;       // secondary length
  prim: number;      // longest primary
  nS: number; nP: number;
  finger: number;    // 0 closed tip .. 1 deeply slotted fingers
  pw: number;        // primary half width
  sw: number;        // secondary half width
  round: number;     // wing tip roundness (0 pointed, 1 round)
  fill: FeatherFill;
}

export interface WingPose {
  th: number;     // arm elevation (rad, + up)
  hand: number;   // extra hand elevation relative to arm
  fold: number;   // 0 spread .. 1 folded toward the body
  sweep: number;  // + forward
  spread?: number; // primary fan spread multiplier
}

/**
 * Spread wing. `side` +1 = near wing (toward the viewer), -1 = far wing. The shoulder is given in
 * body space 3D (x fwd, y up, z toward viewer) relative to `o` (screen origin of body space).
 */
export function spreadWing(sk: Sk, o: V2, sh: V3, W: WingLook, P: WingPose, side: 1 | -1, k: number, bias = 0) {
  const fold = P.fold;
  const armL = W.arm * k * (1 - fold * 0.35), handL = W.hand * k * (1 - fold * 0.5);
  const th = P.th, thH = P.th + P.hand;
  const sw = P.sweep, swH = P.sweep - fold * 0.9;
  // direction of arm and hand in 3D
  const dir = (el: number, swp: number): V3 => [Math.sin(swp) * Math.cos(el), Math.sin(el), side * Math.cos(swp) * Math.cos(el)];
  const dA = dir(th, sw), dH = dir(thH, swH);
  const wrist: V3 = [sh[0] + dA[0] * armL, sh[1] + dA[1] * armL, sh[2] + dA[2] * armL];
  const tip: V3 = [wrist[0] + dH[0] * handL, wrist[1] + dH[1] * handL, wrist[2] + dH[2] * handL];
  // chord direction: backward, perpendicular to the span direction, lying in the wing plane
  const chordOf = (d: V3): V3 => {
    // project (-1,0,0) onto the plane perpendicular to d
    const dot = -d[0];
    let c: V3 = [-1 - dot * d[0], -dot * d[1], -dot * d[2]];
    const l = Math.hypot(c[0], c[1], c[2]) || 1;
    c = [c[0] / l, c[1] / l, c[2] / l];
    return c;
  };
  const cA = chordOf(dA), cH = chordOf(dH);
  // wing plane normal (top side) and whether we see the top
  const nA: V3 = [dA[1] * cA[2] - dA[2] * cA[1], dA[2] * cA[0] - dA[0] * cA[2], dA[0] * cA[1] - dA[1] * cA[0]];
  // make it point "up" (y>0 when level)
  const up = nA[1] * side >= 0 ? 1 : -1;
  const nTop: V3 = [nA[0] * up * side, nA[1] * up * side, nA[2] * up * side];
  void nTop;
  const nScreen = (d: V3, c: V3): V3 => {
    let n: V3 = [d[1] * c[2] - d[2] * c[1], d[2] * c[0] - d[0] * c[2], d[0] * c[1] - d[1] * c[0]];
    if (n[1] * side < 0) n = [-n[0], -n[1], -n[2]]; // top-side normal
    const q = proj([n[0], n[1], n[2]]);
    const q0 = proj([0, 0, 0]);
    return [q[0] - q0[0], q[1] - q0[1], q[2] - q0[2]];
  };
  const nsA = nScreen(dA, cA), nsH = nScreen(dH, cH);
  const topA = nsA[2] >= 0, topH = nsH[2] >= 0;
  const P2 = (p: V3): V3 => { const q = proj(p); return [q[0] + o[0], q[1] + o[1], q[2]]; };

  // one feather: base (3D), direction (3D unit), length, half width, material fill
  const feather = (base: V3, d: V3, L: number, hw: number, row: 'P' | 'S' | 'G' | 'M' | 'L', i: number, top: boolean, layer: number, ns: V3, pointed: number) => {
    const tipP: V3 = [base[0] + d[0] * L, base[1] + d[1] * L, base[2] + d[2] * L];
    const b2 = P2(base), t2 = P2(tipP);
    // projected width: use the in-plane perpendicular (cross of normal and dir) projected
    const scr = Math.hypot(t2[0] - b2[0], t2[1] - b2[1]);
    if (scr < 0.5) return;
    // foreshortening of width: how much the wing plane faces the camera
    const face = Math.max(0.25, Math.abs(ns[2]));
    const w = hw * k * (0.45 + 0.55 * face);
    sk.np();
    const lsh = top ? 0 : 1;
    const zl = layer * 1.6 * (top ? 1 : -1);
    const nn: V3 = top ? ns : [-ns[0], -ns[1], -ns[2]];
    const nv: V3 = nn[2] < 0 ? [-nn[0], -nn[1], -nn[2]] : nn;
    sk.blade(b2[0], b2[1], t2[0], t2[1], s => {
      // feather outline: full width, then taper to the tip
      const tt = pointed;
      const body = s < 0.55 ? 1 : 1 - Math.pow((s - 0.55) / 0.45, 1.6 - tt * 0.8) * (0.55 + tt * 0.45);
      return Math.max(0.35, w * body);
    }, (p) => W.fill(p, row, i, !top), { z0: b2[2] + zl + lsh, z1: t2[2] + zl + lsh, n: nv, curl: 0.2, bias });
  };
  // --- flight feathers
  const secs: V3[] = [];
  for (let i = 0; i < W.nS; i++) {
    const t = (i + 0.5) / W.nS;
    const b: V3 = [sh[0] + dA[0] * armL * (0.08 + t * 0.92), sh[1] + dA[1] * armL * (0.08 + t * 0.92), sh[2] + dA[2] * armL * (0.08 + t * 0.92)];
    secs.push(b);
  }
  const prims: { b: V3; d: V3; L: number }[] = [];
  const spreadK = P.spread ?? 1;
  for (let i = 0; i < W.nP; i++) {
    const t = i / Math.max(1, W.nP - 1); // 0 inner .. 1 outer
    const bt = 0.05 + t * 0.9;
    const b: V3 = [wrist[0] + dH[0] * handL * bt, wrist[1] + dH[1] * handL * bt, wrist[2] + dH[2] * handL * bt];
    // fan from chordwise (inner) to spanwise (outer); folding closes the fan
    const a = (0.12 + t * 1.02 * spreadK) * (1 - fold * 0.75);
    const d: V3 = [cH[0] * Math.cos(a) + dH[0] * Math.sin(a), cH[1] * Math.cos(a) + dH[1] * Math.sin(a), cH[2] * Math.cos(a) + dH[2] * Math.sin(a)];
    const Lr = W.prim * (0.62 + 0.38 * Math.sin(Math.min(1, t * 1.25 + 0.1) * Math.PI * (0.5 + W.round * 0.3))) * (1 - fold * 0.12);
    prims.push({ b, d, L: Lr * k });
  }
  // draw order depends on which side we see: from the top, flight feathers are under the coverts
  const drawFlight = () => {
    // secondaries (inner to outer so outer overlaps), then primaries (outer under inner when seen from top)
    for (let i = 0; i < W.nS; i++) {
      const b = secs[i];
      const a = -0.06 + (i / W.nS) * 0.12;
      const d: V3 = [cA[0] * Math.cos(a) + dA[0] * Math.sin(a), cA[1] * Math.cos(a) + dA[1] * Math.sin(a), cA[2] * Math.cos(a) + dA[2] * Math.sin(a)];
      feather(b, d, W.sec * k * (1 - (i === 0 ? 0.1 : 0)), W.sw, 'S', i, topA, 0.1 + (i % 2) * 0.05, nsA, 0);
    }
    for (let i = W.nP - 1; i >= 0; i--) {
      const q = prims[i];
      const outer = i / Math.max(1, W.nP - 1);
      const slot = W.finger * Math.max(0, (outer - 0.45) / 0.55);
      feather(q.b, q.d, q.L, W.pw * (1 - slot * 0.45), 'P', i, topH, 0.2 + (W.nP - i) * 0.04, nsH, 0.35 + slot * 0.65);
    }
  };
  const drawCoverts = () => {
    // greater coverts over the secondaries & primary bases, then median, then lesser along the leading edge
    const rows: ['G' | 'M' | 'L', number, number, number][] = [['G', 0.46, 1.25, 1], ['M', 0.3, 1.1, 2], ['L', 0.18, 1.05, 3]];
    for (const [row, frac, wk, layer] of rows) {
      const n = row === 'L' ? W.nS + 2 : W.nS + 1;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.3) / n;
        const onHand = t > 0.82;
        const b: V3 = onHand
          ? [wrist[0] + dH[0] * handL * (t - 0.82) * 1.6, wrist[1] + dH[1] * handL * (t - 0.82) * 1.6, wrist[2] + dH[2] * handL * (t - 0.82) * 1.6]
          : [sh[0] + dA[0] * armL * (t / 0.82), sh[1] + dA[1] * armL * (t / 0.82), sh[2] + dA[2] * armL * (t / 0.82)];
        const c = onHand ? cH : cA;
        const L = W.sec * k * frac * (onHand ? 0.9 : 1);
        feather(b, c, L, W.sw * wk, row, i, onHand ? topH : topA, layer + 0.4, onHand ? nsH : nsA, 0);
      }
    }
  };
  // seen from above: flight feathers first then coverts on top; from below the underwing coverts are
  // still on the near side of the flight feathers (depth offsets handle it), so the order is the same
  drawFlight();
  drawCoverts();
  return { wrist: P2(wrist), tip: P2(tip), top: topA };
}

/** Folded wing lying on the body side, in body frame B (x fwd, y down, px). */
export function foldedWing(sk: Sk, B: Frame2, rx: number, ry: number, W: WingLook, z: (x: number, y: number) => number, o: { ext?: number; droop?: number; lift?: number; bias?: number; nP?: number; nS?: number } = {}) {
  const ext = o.ext ?? W.prim * 0.35, droop = o.droop ?? 0, lift = o.lift ?? 0, bias = o.bias ?? 0;
  const nP = o.nP ?? 4, nS = o.nS ?? 4;
  const blade = (bx: number, by: number, tx: number, ty: number, hw: number, row: 'P' | 'S' | 'G' | 'M' | 'L', i: number, pointed: number, dz: number) => {
    const b = B.p(bx, by), t = B.p(tx, ty);
    sk.np();
    const zz = z(b[0], b[1]) + dz;
    sk.blade(b[0], b[1], t[0], t[1], s => {
      const body = s < 0.5 ? 1 : 1 - Math.pow((s - 0.5) / 0.5, 1.5 - pointed * 0.7) * (0.6 + pointed * 0.4);
      return Math.max(0.35, hw * B.k * body);
    }, (p) => W.fill(p, row, i, false), { z0: zz, z1: zz + 0.3, n: [-0.15, -0.45, 0.88], curl: 0.3, bias });
  };
  // primaries: long, pointed, stacked, projecting past the rump
  for (let i = 0; i < nP; i++) {
    const y0 = -ry * 0.42 + i * 0.7 + lift * -2;
    blade(rx * 0.05 - i * 0.6, y0, -rx - ext + i * 1.3, -ry * 0.3 + i * 0.75 + droop * (4 + i) + lift * -3, W.pw * 1.1, 'P', i, 0.6, 0.3 + i * 0.15);
  }
  // secondaries / tertials: shorter, rounded tips forming the lower-rear edge
  for (let i = 0; i < nS; i++) {
    const t = i / Math.max(1, nS - 1);
    const bx = rx * (0.3 - t * 0.5), by = -ry * 0.28 + t * 1.2;
    blade(bx, by, bx - rx * 0.62, by + ry * (0.38 - t * 0.12) + droop * 2, W.sw * 1.15, 'S', i, 0, 1.8 + i * 0.25);
  }
  // greater coverts: a row of rounded feathers
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const bx = rx * (0.5 - t * 0.62), by = -ry * 0.18 + Math.sin(t * Math.PI) * -ry * 0.12;
    blade(bx, by, bx - rx * 0.3, by + ry * 0.22, W.sw * 1.1, 'G', i, 0, 3.6 + i * 0.2);
  }
  // median / lesser coverts: small scales over the shoulder
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < 4 - r; i++) {
      const bx = rx * (0.52 - i * 0.2 - r * 0.08), by = -ry * (0.5 - r * 0.2);
      blade(bx, by, bx - rx * 0.2, by + ry * 0.18, W.sw * 0.95, r ? 'M' : 'L', i, 0, 5.4 + r * 1.6 + i * 0.1);
    }
}

/** Bird leg: hip (inside body) -> ankle (backward joint) -> foot; toes forward + hallux. */
export interface BirdLegLook { tib: number; tar: number; rT: number; rt: number; toe: number; nToes?: number; talon?: number; web?: boolean; feathered?: number }
export function birdLeg(sk: Sk, hip: V2, foot: V2, L: BirdLegLook, k: number, fills: { tib: number; tar: (p: Px) => number; toe: number; claw: number; web?: number }, z: number, bias = 0, grip = 0, curl = 0) {
  const [ankle, end] = ik2(hip, foot, L.tib * k, L.tar * k, 1);
  sk.tube([hip, ankle], t => (L.rT * (1 - t * 0.35)) * k, fills.tib, { z, bias });
  sk.tube([ankle, end], L.rt * k, fills.tar, { z: z + 0.3, bias });
  // toes: three forward, hallux back; `grip` curls them (perching / clutching), `curl` tucks (flight)
  const toeL = L.toe * k;
  const n = L.nToes ?? 3;
  const f = end;
  const talon = (L.talon ?? 0.8) * k;
  const toeDirs: number[] = [];
  for (let i = 0; i < n; i++) toeDirs.push(-0.05 + (i - (n - 1) / 2) * 0.22 + grip * 0.9 + curl * 1.2);
  if (L.web && fills.web) {
    const a0 = toeDirs[0], a1 = toeDirs[n - 1];
    sk.poly([f[0], f[1], f[0] + Math.cos(a0 - 0.1) * toeL, f[1] + Math.sin(a0 - 0.1) * toeL + 0.4, f[0] + Math.cos(a1) * toeL * 0.9, f[1] + Math.sin(a1) * toeL * 0.9], fills.web, { z: z + 0.4, bias });
  }
  toeDirs.forEach((a, i) => {
    const tx = f[0] + Math.cos(a) * toeL, ty = f[1] + Math.sin(a) * toeL * (curl ? 1 : 0.3);
    sk.tube([f, [tx, Math.min(ty, curl || grip ? ty : f[1] + 0.2)]], (L.rt * 0.7) * k, fills.toe, { z: z + 0.6 + i * 0.05, bias });
    // talon
    sk.blade(tx, Math.min(ty, curl || grip ? ty : f[1] + 0.2), tx + Math.cos(a + 0.9 + grip) * talon * 1.4, ty + Math.sin(a + 0.9 + grip) * talon * 1.4, s => (1 - s) * 0.55 * k + 0.2, fills.claw, { z0: z + 1, z1: z + 1, bias });
  });
  // hallux
  const ha = Math.PI - 0.1 - grip * 0.8 - curl * 1.2;
  const hx = f[0] + Math.cos(ha) * toeL * 0.55, hy = f[1] + Math.sin(ha) * toeL * 0.3;
  sk.tube([f, [hx, hy]], L.rt * 0.65 * k, fills.toe, { z: z + 0.5, bias });
  sk.blade(hx, hy, hx + Math.cos(ha - 0.9) * talon * 1.2, hy + Math.sin(ha - 0.9) * talon * 1.2 + 0.3, s => (1 - s) * 0.5 * k + 0.2, fills.claw, { z0: z + 1, z1: z + 1, bias });
  return { ankle, foot: end };
}

/** Fanned tail from the rump in body frame B: n feathers spread over `spread` rad around angle `a`. */
export function tailFan(sk: Sk, root: V2, a: number, L: number, hw: number, n: number, spread: number, fill: (p: Px, i: number) => number, z: number, k: number, bias = 0, pointed = 0) {
  for (let j = 0; j < n; j++) {
    // draw outer feathers first so the central ones sit on top
    const i = j % 2 === 0 ? j / 2 : n - 1 - (j - 1) / 2;
    const t = n === 1 ? 0.5 : i / (n - 1);
    const aa = a + (t - 0.5) * spread;
    const LL = L * (1 - Math.abs(t - 0.5) * 0.18);
    const tip: V2 = [root[0] + Math.cos(aa) * LL, root[1] + Math.sin(aa) * LL];
    sk.np();
    const center = 1 - Math.abs(t - 0.5) * 2;
    sk.blade(root[0], root[1], tip[0], tip[1], s => Math.max(0.4, hw * k * (0.55 + s * 0.45) * (s > 0.85 ? 1 - (s - 0.85) * (3 + pointed * 3) : 1)), (p) => fill(p, i), { z0: z + center * 1.6, z1: z + center * 1.6, curl: 0.25, bias });
  }
}

/** Scalloped feather texture for body plumage: returns lighting offset (feather lower edges darker). */
export function scallop(x: number, y: number, sx = 3, sy = 2.4, seed = 0): number {
  const row = Math.floor(y / sy);
  const xx = x / sx + (row % 2) * 0.5;
  const col = Math.floor(xx);
  const fx = xx - col - 0.5, fy = y / sy - row;
  const edge = fy > 0.62 + Math.abs(fx) * 0.4;
  return (edge ? -0.12 : 0) + (hh(col, row, seed) - 0.5) * 0.04;
}

export { lumN, cbez, TAU };
export type { V3 };

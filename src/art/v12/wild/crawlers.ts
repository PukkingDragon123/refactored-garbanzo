// V12 the crawlers: two animals of the wet bush, sculpted with the beast sketch (shared shading, edge
// lines and rim light with every other animal).
//
// Tuna, the New Zealand longfin eel (Anguilla dieffenbachii), about 1.4 m: a thick, smooth, heavy body
// with a wet sheen along the back; dark olive-brown above grading to a pale grey-brown belly; a broad
// head with thick fleshy lips and a wide mouth whose corner reaches back past the small dark eye; tubular
// nostrils on the snout; a small gill slit in front of a small rounded pectoral fin. The dorsal fin starts
// far forward (a third of the way down the body, well ahead of the anal fin: the longfin's tell) and both
// run back and merge round the tail into one paddle. Anims: idle (hanging in the water, fins sculling),
// swim (the S-wave running down the body), dash (the same, flat out), lurk (in its hole under the bank:
// the head out, the rest coiled back into the dark, the mouth breathing slowly), rise (angled up toward
// the surface), take (the head breaking the surface, the mouth gaping, the snap and the swirl), turn (the
// head swinging round toward us and the body following it), sleep (lying in a loose curl on the bed).
// Anchor: the body centre (the eel's balance point, 21 px behind the snout); see TUNA_HEAD for where the
// head is in each anim, and TUNA_SURF for the water line in 'take'.
//
// Ngaokeoke, a giant velvet worm (Peripatoides titan), 35 cm: a plump soft caterpillar of a body clothed
// in velvet (fine ring-wrinkles, tiny papillae catching the light), deep indigo-blue shading to blue-green
// on the flanks and a pale lilac-grey underside, an orange diamond row down a dark back stripe, sixteen
// pairs of stubby conical lobopod legs with pale clawed feet, a pair of ringed antennae always feeling the
// air with a tiny eye at the base of each, and the oral papillae beside the mouth. Its trick: two jets of
// sticky white slime squirted from the papillae in wiggling arcs. Anims: idle, crawl (= walk: a slow wave
// running forward along the legs, the antennae sweeping), curl (rolled up in a spiral on the ground),
// squirt (it rears and fires the jets up to 34 px forward of the anchor; they droop and set), feed (head
// down over a wētā glued in slime), hide / peek (under cover: only the antennae and the tip of the head),
// sleep. Anchor: the ground under the middle of the body.

import { Sk, V2, rmp, SpeciesDef, TAU, sm, hh } from '../../beasts-core';
import type { Px, BeastEye, AnimDef } from '../../beasts-core';
import { hex } from '../../color';
import { clamp } from '../../../core/math';

type V3 = [number, number, number];
const A = (frames: number, fps: number, loop = true): AnimDef => ({ frames, fps, loop });
/** piecewise-linear table lookup */
function tab(T: [number, number][], u: number): number {
  if (u <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) if (u <= T[i][0]) { const [a, va] = T[i - 1], [b, vb] = T[i]; return va + (vb - va) * (u - a) / (b - a); }
  return T[T.length - 1][1];
}
const nrm = (v: V2): V2 => { const l = Math.hypot(v[0], v[1]) || 1e-6; return [v[0] / l, v[1] / l]; };

/**
 * A body along a spine sampled from the snout (u 0) to the tail (u 1), built in 3D and projected:
 * screen points, depth, the direction toward the tail and the dorsal side in screen space.
 */
interface Spine { p: V2[]; z: number[]; t: V2[]; d: V2[]; sg: number[]; n: number; fwd: V3 }
function project(P3: V3[], tilt: number, lift: V2): Spine {
  const n = P3.length - 1;
  const p: V2[] = P3.map(q => [q[0] + lift[0], q[1] + q[2] * tilt + lift[1]]);
  const z = P3.map(q => q[2]);
  const t: V2[] = [], d: V2[] = [], sg: number[] = [];
  for (let i = 0; i <= n; i++) {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(n, i + 1)];
    const tt = nrm([b[0] - a[0], b[1] - a[1]]);
    t.push(tt);
    const perp: V2 = [-tt[1], tt[0]];
    // the back is the side that faces up
    if (perp[1] > 0) { d.push([-perp[0], -perp[1]]); sg.push(-1); } else { d.push(perp); sg.push(1); }
  }
  // the head's direction in 3D (a head turned toward us is drawn face-on)
  const fx = P3[0][0] - P3[2][0], fy = P3[0][1] - P3[2][1], fz = P3[0][2] - P3[2][2], fl = Math.hypot(fx, fy, fz) || 1;
  return { p, z, t, d, sg, n, fwd: [fx / fl, fy / fl, fz / fl] };
}
/** a point on the body: u along it, `across` radii toward the back (negative: toward the belly) */
function at(S: Spine, R: (u: number) => number, u: number, across: number): V2 {
  const f = clamp(u) * S.n, i = Math.min(S.n - 1, Math.floor(f)), k = f - i;
  const x = S.p[i][0] + (S.p[i + 1][0] - S.p[i][0]) * k, y = S.p[i][1] + (S.p[i + 1][1] - S.p[i][1]) * k;
  const dx = S.d[i][0] + (S.d[i + 1][0] - S.d[i][0]) * k, dy = S.d[i][1] + (S.d[i + 1][1] - S.d[i][1]) * k;
  const r = R(u) * across;
  return [x + dx * r, y + dy * r];
}
const zAt = (S: Spine, u: number) => { const f = clamp(u) * S.n, i = Math.min(S.n - 1, Math.floor(f)); return S.z[i] + (S.z[i + 1] - S.z[i]) * (f - i); };

/**
 * Draw the body as a tube (in chunks when it overlaps itself, so the depth test sorts the coils and the
 * nearer coil gets a separation line); fill gets the body u and +1 back .. -1 belly.
 */
function bodyTube(sk: Sk, S: Spine, R: (u: number) => number, fill: (p: Px, u: number, dors: number) => number, o: { chunk: number; u0?: number; zb?: number }) {
  const n = S.n, i0 = Math.round((o.u0 ?? 0) * n), step = o.chunk > 0 ? o.chunk : n;
  for (let a = i0; a < n; a += step) {
    const b = Math.min(n, a + step);
    sk.np();
    const pts = S.p.slice(a, b + 1);
    // map the tube's arc-length t back to the sample index
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const tot = cum[cum.length - 1] || 1;
    const idx = (t: number) => {
      const d = t * tot;
      for (let i = 1; i < cum.length; i++) if (d <= cum[i]) return a + i - 1 + (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
      return b;
    };
    sk.tube(pts, t => R(idx(t) / n), (p: Px) => {
      const f = idx(p.t), i = Math.min(n, Math.round(f));
      return fill(p, f / n, p.v * S.sg[i]);
    }, { z: t => { const f = idx(t), i = Math.min(n - 1, Math.floor(f)); return S.z[i] + (S.z[i + 1] - S.z[i]) * (f - i) + (o.zb ?? 0); } });
  }
}

// ================================================================== Tuna, the longfin eel
export const TUNA_ANIMS: Record<string, AnimDef> = {
  idle: A(4, 2.5),
  swim: A(6, 8),
  dash: A(6, 15),
  lurk: A(4, 1.5),
  rise: A(4, 7),
  take: A(5, 9, false),
  turn: A(5, 10, false),
  sleep: A(2, 0.6),
};
const EEL_L = 50;
/** the anchor: the balance point, this far back from the snout */
const EEL_C = 0.42;
/** we look very slightly down into the pool: what is nearer sits lower */
const EEL_TILT = 0.3;
/** radius (px) along the body: blunt snout, a broad head, the thick barrel of the body, the long taper */
const EEL_R: [number, number][] = [[0, 1.05], [0.02, 1.6], [0.05, 2.05], [0.09, 2.3], [0.14, 2.45], [0.3, 2.62], [0.45, 2.58], [0.6, 2.3], [0.75, 1.86], [0.88, 1.28], [0.96, 0.84], [1, 0.58]];
/** the dorsal fin starts a quarter of the way down; the anal fin not until halfway (the longfin's tell) */
const DORSAL0 = 0.25, ANAL0 = 0.47;

interface EP {
  pitch: number; bend: number;
  amp: number; ph: number; wl: number;
  /** 0 none, else 0..1 progress of the turn (yaw sweeping from the head back) */
  turn: number;
  /** lurk: the rear body coils back into the dark; sleep: a loose curl */
  coil: number; curl: number;
  /** lurk: the rear body bending down and away into the hole */
  droop: number;
  jaw: number; throat: number; pec: number;
  /** lurk: how dark the body is behind the head (in the hole) */
  shade: number;
  swirl: number; lift: V2;
}
function eelPose(anim: string, f: number, n: number): EP {
  const t = f / n;
  const p: EP = { pitch: 0, bend: 0, amp: 0.06, ph: t * TAU, wl: 0.95, turn: 0, coil: 0, curl: 0, droop: 0, jaw: 0, throat: 0, pec: Math.sin(t * TAU), shade: 0, swirl: 0, lift: [0, 0] };
  switch (anim) {
    case 'idle': p.amp = 0.07; p.pitch = 0.03; p.wl = 1.1; break;
    case 'swim': p.amp = 0.27; p.wl = 0.85; break;
    case 'dash': p.amp = 0.38; p.wl = 0.75; p.pitch = -0.04; p.pec = -0.8; break;
    case 'rise': p.amp = 0.14; p.wl = 0.85; p.pitch = 0.55; p.bend = 0.25; break;
    case 'take': {
      p.pitch = [0.86, 0.9, 0.82, 0.7, 0.6][f];
      p.bend = 0.55; p.amp = 0.08; p.wl = 0.9;
      p.jaw = [0.55, 1, 0.15, 0, 0][f];
      p.swirl = [0.25, 0.5, 0.8, 1.05, 1.3][f];
      p.lift = [[0, 0], [0.6, -1.2], [0.3, -0.2], [0, 2.2], [-0.4, 4.6]][f] as V2;
      p.pec = 0.6;
      break;
    }
    case 'turn': p.turn = (f + 0.5) / n; p.amp = 0.06; break;
    case 'lurk': p.coil = 1; p.amp = 0.02; p.pitch = 0.06; p.jaw = [0.05, 0.18, 0.28, 0.14][f]; p.throat = [0, 0.5, 1, 0.5][f]; p.shade = 1; p.pec = [0, 0.4, 0.8, 0.4][f]; p.droop = 3.1; break;
    case 'sleep': p.curl = 1; p.amp = 0; p.throat = f * 0.4; p.pec = 0; break;
  }
  return p;
}
function eelSpine(P: EP, k: number): Spine {
  const N = 30, L = EEL_L * k, ds = L / N, ic = Math.round(EEL_C * N);
  const dir = (u: number): V3 => {
    const env = 0.3 + 0.7 * u;
    const a = P.pitch - P.bend * (u - EEL_C) + P.amp * env * Math.sin(TAU * u / P.wl - P.ph) + P.droop * sm((u - 0.3) / 0.4);
    let b = 0;
    if (P.turn > 0) b = Math.PI * sm(P.turn * 1.8 - u * 0.8);
    b += P.coil * sm((u - 0.34) / 0.5) * 1.0;
    b += P.curl * (Math.sin(u * Math.PI * 1.25) * 1.2 - 0.25);
    return [Math.cos(a) * Math.cos(b), -Math.sin(a), Math.cos(a) * Math.sin(b)];
  };
  const P3: V3[] = new Array(N + 1);
  P3[ic] = [0, 0, 0];
  for (let i = ic + 1; i <= N; i++) { const d = dir((i - 0.5) / N), q = P3[i - 1]; P3[i] = [q[0] - d[0] * ds, q[1] - d[1] * ds, q[2] - d[2] * ds]; }
  for (let i = ic - 1; i >= 0; i--) { const d = dir((i + 0.5) / N), q = P3[i + 1]; P3[i] = [q[0] + d[0] * ds, q[1] + d[1] * ds, q[2] + d[2] * ds]; }
  return project(P3, EEL_TILT, [P.lift[0] * k, P.lift[1] * k]);
}

/** where the head (the eye) is, relative to the anchor, facing right, in an anim's first frame */
export function tunaHead(anim: string, frame = 0): V2 {
  const n = TUNA_ANIMS[anim]?.frames ?? 1;
  const S = eelSpine(eelPose(TUNA_ANIMS[anim] ? anim : 'idle', frame, n), 1);
  return at(S, u => tab(EEL_R, u), 0.047, 0.4);
}
/** where the snout tip is, relative to the anchor, facing right */
export function tunaSnout(anim: string, frame = 0): V2 {
  const n = TUNA_ANIMS[anim]?.frames ?? 1;
  return eelSpine(eelPose(TUNA_ANIMS[anim] ? anim : 'idle', frame, n), 1).p[0];
}
/** 'take': the local y of the water line (the swirl is painted there; the snout and the gape break through above it) */
export const TUNA_SURF = (() => Math.round(tunaHead('take', 0)[1] + 1))();

function edraw(sk: Sk, anim: string, frame: number, _eye: BeastEye, juv: boolean) {
  const n = TUNA_ANIMS[anim]?.frames ?? 1;
  const P = eelPose(anim, frame, n);
  const k = juv ? 0.6 : 1;
  const S = eelSpine(P, k);
  const M = {
    // low contrast: the countershading reads first and the light second (a dark back stays dark)
    back: sk.m(rmp('#36331f', { n: 5, dark: 0.4, light: 0.32, cool: 0.08, warm: 0.2 }), { edge: 1, k: 0.4, noRim: true, bias: -0.13 }),
    sheen: sk.m(rmp('#86845f', { n: 4, dark: 0.3, light: 0.35, cool: 0.05 }), { edge: 1, k: 0.35 }),
    flank: sk.m(rmp('#5a533a', { n: 5, dark: 0.4, light: 0.32, cool: 0.08, warm: 0.2 }), { edge: 1, k: 0.4 }),
    belly: sk.m(rmp('#9e967b', { n: 5, dark: 0.35, light: 0.3, cool: 0.05 }), { edge: 1, k: 0.4, bias: 0.04 }),
    fin: sk.m(rmp('#625a3a', { n: 4, dark: 0.4, light: 0.3, cool: 0.05, warm: 0.3 }), { edge: 0, k: 0.3, bias: -0.06 }),
    pec: sk.m(rmp('#8a8262', { n: 4, dark: 0.35, light: 0.35, cool: 0.05 }), { edge: 1, k: 0.5 }),
    mouth: sk.m(rmp('#8e6458', { n: 4, dark: 0.5, light: 0.3, cool: 0.05 }), { edge: 0, noRim: true }),
  };
  const throat = (u: number) => 1 + P.throat * 0.12 * Math.max(0, 1 - Math.abs(u - 0.11) / 0.06);
  const R = (u: number) => tab(EEL_R, u) * k * throat(u);
  // the dark of the hole under the bank, deepening down the body behind the head
  const dark = (u: number) => P.shade * sm((u - 0.16) / 0.5) * 0.55;
  const chunked = P.turn > 0 || P.coil > 0 || P.curl > 0;

  // ---- the fins: one long ribbon above from a quarter of the way down, one below from halfway, merging
  // round the tail into a paddle; behind the body so the body's edge draws a fine line along them
  sk.np();
  const hD = (u: number) => (u < DORSAL0 ? 0 : (1.45 * sm((u - DORSAL0) / 0.07) + 0.15 * sm((u - 0.7) / 0.3)) * k);
  const hA = (u: number) => (u < ANAL0 ? 0 : (1.3 * sm((u - ANAL0) / 0.07) + 0.15 * sm((u - 0.72) / 0.28)) * k);
  const finFill = (u: number) => (p: Px) => { p.l -= dark(u); return M.fin; };
  const strip = (h: (u: number) => number, side: 1 | -1, from: number) => {
    const N = S.n;
    for (let i = Math.floor(from * N); i < N; i++) {
      const u0 = i / N, u1 = (i + 1) / N;
      if (h(u1) <= 0.05) continue;
      const a0 = at(S, R, u0, side * 0.2), b0 = at(S, R, u0, side * (1 + h(u0) / Math.max(0.3, R(u0))));
      const a1 = at(S, R, u1, side * 0.2), b1 = at(S, R, u1, side * (1 + h(u1) / Math.max(0.3, R(u1))));
      sk.poly([a0[0], a0[1], b0[0], b0[1], b1[0], b1[1], a1[0], a1[1]], finFill((u0 + u1) / 2), { z: (S.z[i] + S.z[i + 1]) / 2 - 2.6 });
    }
  };
  strip(hD, 1, DORSAL0);
  strip(hA, -1, ANAL0);
  {
    // the paddle round the tail tip
    const N = S.n, tp = S.p[N], tt = S.t[N], dd = S.d[N];
    const up = at(S, R, 1, 1 + hD(1) / R(1)), dn = at(S, R, 1, -1 - hA(1) / R(1));
    const e = 3.2 * k;
    const q = (fx: number, fy: number): number[] => [tp[0] + tt[0] * fx + dd[0] * fy, tp[1] + tt[1] * fx + dd[1] * fy];
    sk.poly([tp[0], tp[1], up[0], up[1], ...q(e * 0.45, 1.55 * k), ...q(e * 0.85, 0.75 * k), ...q(e, 0), ...q(e * 0.85, -0.7 * k), ...q(e * 0.45, -1.45 * k), dn[0], dn[1]], finFill(1), { z: S.z[N] - 2.6 });
  }

  // ---- the body: dark olive-brown back, the flank, a pale grey-brown belly; a broken wet sheen on top
  const bodyFill = (p: Px, u: number, dors: number) => {
    p.l -= dark(u);
    // countershaded in bands: the back, a wet highlight running along it (broken here and there), the
    // dark back again, the olive flank with the faint dotted lateral line, and the pale belly
    if (dors > 0.62) return M.back;
    if (dors > 0.26) return u > 0.01 && u < 0.88 && hh(Math.floor(u * EEL_L / 3.2), 1, 3) > 0.2 && dark(u) < 0.2 ? M.sheen : M.back;
    if (dors > -0.12) return M.back;
    if (dors > -0.5) { if (u > 0.16 && u < 0.86 && Math.floor(u * EEL_L) % 3 === 0) p.l += 0.12; return M.flank; }
    return M.belly;
  };
  bodyTube(sk, S, R, bodyFill, { chunk: chunked ? 5 : 0 });

  // ---- the head
  const fwd = S.fwd;
  const side = Math.abs(fwd[0]) > 0.42 || Math.abs(fwd[1]) > 0.5;
  const F: V2 = [-S.t[0][0], -S.t[0][1]];
  const D0 = S.d[0];
  const zh = zAt(S, 0.05) + R(0.05) + 1.5;
  if (side) {
    // the gill slit, just in front of the pectoral fin
    for (let s = -0.1; s >= -0.65; s -= 0.28) { const g = at(S, R, 0.128, s); sk.paint(g[0], g[1], 0, -0.3); }
    // the mouth: thick lips from the snout tip back past the eye; open, the lower jaw drops
    const corner = at(S, R, 0.098, -0.2);
    const tipU: V2 = [S.p[0][0] + F[0] * 0.55 * k - D0[0] * 0.15 * R(0), S.p[0][1] + F[1] * 0.55 * k - D0[1] * 0.15 * R(0)];
    if (P.jaw > 0.04) {
      sk.np();
      const al = P.jaw * 0.8;
      const vx = tipU[0] - corner[0], vy = tipU[1] - corner[1];
      // rotate the jaw away from the back
      const cs = Math.cos(al), sn = Math.sin(al);
      const away: V2 = [-D0[0], -D0[1]];
      const jx = vx * cs + away[0] * Math.hypot(vx, vy) * sn, jy = vy * cs + away[1] * Math.hypot(vx, vy) * sn;
      const jtip: V2 = [corner[0] + jx * 0.95, corner[1] + jy * 0.95];
      sk.poly([corner[0], corner[1], tipU[0] + F[0] * 0.2, tipU[1] + F[1] * 0.2, jtip[0] + F[0] * 0.4, jtip[1] + F[1] * 0.4], (p: Px) => { p.l = 0.32 + (hh(p.x, p.y, 5) - 0.5) * 0.1; return M.mouth; }, { z: zh + 1 });
      sk.np();
      sk.tube([[corner[0] - F[0] * 0.3, corner[1] - F[1] * 0.3], [corner[0] + jx * 0.5, corner[1] + jy * 0.5], jtip], t => (1.05 - t * 0.3) * k, (p: Px) => (p.v * Math.sign(-(jx * away[1] - jy * away[0]) || 1) > 0.2 ? M.belly : M.flank), { z: zh + 2 });
      // a pale row of tiny teeth along the upper jaw
      for (let i = 1; i <= 3; i++) { const q: V2 = [corner[0] + vx * i / 4, corner[1] + vy * i / 4]; sk.over(q[0] - away[0] * 0.6, q[1] - away[1] * 0.6, hex('#d8cfb6')); }
    } else {
      const steps = Math.ceil(Math.hypot(tipU[0] - corner[0], tipU[1] - corner[1]) * 1.5) + 1;
      for (let i = 0; i <= steps; i++) {
        const q: V2 = [corner[0] + (tipU[0] - corner[0]) * i / steps, corner[1] + (tipU[1] - corner[1]) * i / steps];
        sk.over(q[0], q[1], hex('#1c160e'));
        // the fleshy lips either side of it
        if (i > 0 && i < steps) { sk.paint(q[0] + D0[0], q[1] + D0[1], 0, 0.12); sk.paint(q[0] - D0[0], q[1] - D0[1], 0, 0.08); }
      }
    }
    // the eye: small and dark, a bronze glint
    const E = at(S, R, 0.047, 0.42);
    sk.over(E[0], E[1], hex('#0c0a08'));
    sk.over(E[0] - F[0], E[1] - F[1], hex('#3a2e1a'));
    // the nostrils: a tube at the very tip of the snout, a pore in front of the eye
    const ns = at(S, R, 0.004, 0.55);
    sk.dot(ns[0] + F[0] * 0.7, ns[1] + F[1] * 0.7, M.back, 0.62, zh);
    const pn = at(S, R, 0.026, 0.5);
    sk.paint(pn[0], pn[1], 0, -0.22);
  } else {
    // seen head-on in the turn: two small eyes over a wide mouth
    const c = S.p[0];
    sk.over(c[0] - 1.2 * k, c[1] - 0.9 * k, hex('#0c0a08'));
    sk.over(c[0] + 1.2 * k, c[1] - 0.9 * k, hex('#0c0a08'));
    for (let i = -1; i <= 1; i++) sk.over(c[0] + i * k, c[1] + 0.9 * k, hex('#1c160e'));
  }
  // ---- the pectoral fin, small and rounded, sculling
  if (side) {
    sk.np();
    const B = at(S, R, 0.142, -0.18);
    const tt = S.t[Math.round(0.142 * S.n)], dd = S.d[Math.round(0.142 * S.n)];
    const ang = 0.35 + P.pec * 0.3;
    const dir = nrm([tt[0] * Math.cos(ang) - dd[0] * Math.sin(ang), tt[1] * Math.cos(ang) - dd[1] * Math.sin(ang)]);
    const L = 2.7 * k;
    sk.blade(B[0], B[1], B[0] + dir[0] * L, B[1] + dir[1] * L, s => (0.5 + Math.sin(Math.min(1, s * 1.15) * Math.PI) * 0.78) * k, (p: Px) => { p.l -= dark(0.14) * 0.5; return M.pec; },
      { z0: zAt(S, 0.142) + R(0.142) + 1, z1: zAt(S, 0.142) + R(0.142) + 0.6, n: [0, -0.3, 1] });
  }
  // ---- the swirl on the surface as it takes
  if (P.swirl > 0) {
    const hx = S.p[0][0], sy = TUNA_SURF;
    const rx = (4 + P.swirl * 7) * k, ry = (0.8 + P.swirl * 0.9) * k;
    const bright = hex('#e4f2ee', 235), mid = hex('#b6d4d0', 200), foam = hex('#f6fbf8', 255);
    const cx = hx - 1.5 * k;
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const q = (x + 0.5 - cx) / rx;
      if (Math.abs(q) > 1) continue;
      const h = Math.sqrt(1 - q * q) * ry;
      // the near arc (a crest of churned water) and the far arc, broken
      if (hh(x, frame, 41) > 0.18) sk.over(x, Math.round(sy + h), Math.abs(q) < 0.55 ? bright : mid);
      if (hh(x, frame, 43) > 0.4) sk.over(x, Math.round(sy - h), mid);
    }
    // the second, outer ring once it spreads
    if (P.swirl > 0.75) {
      const r2 = rx + 4 * k;
      for (let x = Math.floor(cx - r2); x <= Math.ceil(cx + r2); x++) {
        const q = (x + 0.5 - cx) / r2;
        if (Math.abs(q) > 1 || Math.abs(q) < 0.45 || hh(x, frame, 47) < 0.45) continue;
        sk.over(x, Math.round(sy + Math.sqrt(1 - q * q) * (ry + 0.8)), hex('#cfe4e0', 160));
      }
    }
    // the slurp: spray and drops thrown up as the jaws shut
    if (frame === 1 || frame === 2) {
      for (let i = 0; i < 7; i++) {
        const dx = (hh(i, frame, 51) - 0.4) * 9 * k, dy = -1 - hh(i, frame, 53) * (frame === 1 ? 6 : 4) * k;
        sk.over(hx + dx, sy + dy, i % 3 ? bright : foam);
      }
    }
    // white water hugging the head where it breaks through
    if (frame <= 2) for (let i = -2; i <= 2; i++) sk.over(hx + i - 2.5 * k, sy, foam);
  }
  const E = at(S, R, 0.047, 0.42);
  return { head: [S.p[0][0], S.p[0][1] - 4 * k] as V2, eye: E };
}

export const TUNA: SpeciesDef = {
  name: 'Tuna', kind: 'fish', len: 50, height: 6,
  anims: TUNA_ANIMS,
  canvas: () => ({ w: 128, h: 100, ox: 64, oy: 46 }),
  draw: edraw,
  eyeFor: () => 'open',
  anchor: Object.fromEntries(Object.keys(TUNA_ANIMS).map(a => [a, 'centre'])) as Record<string, 'centre'>,
};

// ================================================================== Ngaokeoke, the giant velvet worm
export const WORM_ANIMS: Record<string, AnimDef> = {
  idle: A(4, 3),
  crawl: A(6, 6),
  walk: A(6, 6),
  curl: A(2, 2),
  squirt: A(6, 10, false),
  feed: A(4, 4),
  hide: A(4, 2),
  peek: A(4, 2),
  sleep: A(2, 0.5),
};
/** how far forward of the anchor the slime jets reach at full stretch (px) */
export const WORM_REACH = 34;
const WORM_L = 16;
/** the legs take the bottom two rows; the body sits on them */
const WORM_LEG = 2;
/** radius (px) along the worm: a rounded head, the plump body, a blunt rounded rear */
const WORM_R: [number, number][] = [[0, 1.05], [0.04, 1.5], [0.12, 1.86], [0.82, 1.92], [0.93, 1.6], [1, 1.05]];
const WORM_TILT = 0.42;
/** the curl: the ring's centre height and where the head starts round it */
const CURL_CY = -5.4, CURL_A0 = -1.25;

interface WP {
  /** crawl wave phase and how much the legs step */
  ph: number; step: number;
  /** how far the front is reared up (px) and lowered (feed) */
  rear: number; low: number;
  /** antennae: sweep angle and how far they lie back */
  ant: number; fold: number;
  /** the body's telescoping */
  stretch: number;
  /** rolled up in a spiral; curled to sleep */
  curl: number; bend: number;
  /** slime jets: reach 0..1, droop 0..1, and the strands lying set on the ground */
  jet: number; droop: number; set: number;
  /** hide: draw only the antennae and the head tip */
  peek: boolean;
  /** feeding: a wētā glued down in front of the head; the head working */
  prey: boolean; chew: number;
  breathe: number;
}
function wpose(anim: string, f: number, n: number): WP {
  const t = f / n;
  const p: WP = { ph: 0, step: 0, rear: 0, low: 0, ant: Math.sin(t * TAU) * 0.22, fold: 0, stretch: 0, curl: 0, bend: 0, jet: 0, droop: 0, set: 0, peek: false, prey: false, chew: 0, breathe: 0 };
  switch (anim) {
    case 'idle': p.ant = Math.sin(t * TAU) * 0.32; p.breathe = Math.sin(t * TAU) * 0.5; break;
    case 'crawl': case 'walk': p.ph = t * TAU; p.step = 1; p.stretch = Math.sin(t * TAU) * 0.04; p.ant = Math.sin(t * TAU + 1) * 0.35; break;
    case 'curl': p.curl = 1; p.breathe = f * 0.6; break;
    case 'squirt':
      p.rear = [0.9, 1.4, 1.5, 1.5, 1.2, 0.7][f];
      p.jet = [0, 0.3, 0.68, 1, 1, 1][f];
      p.droop = [0, 0, 0.04, 0.12, 0.55, 1][f];
      p.set = f === 5 ? 1 : 0;
      p.ant = [-0.35, -0.5, -0.55, -0.55, -0.45, -0.3][f];
      break;
    case 'feed': p.low = 1; p.prey = true; p.chew = [0, 0.6, 1, 0.4][f]; p.ant = Math.sin(t * TAU * 2) * 0.2 + 0.25; break;
    case 'hide': case 'peek': p.peek = true; p.ant = Math.sin(t * TAU) * 0.4; break;
    case 'sleep': p.fold = 1; p.bend = 0.55; p.breathe = f * 0.6; break;
  }
  return p;
}
function wspine(P: WP, k: number): Spine {
  const N = 20, L = WORM_L * k * (1 + P.stretch), ds = L / N, ic = Math.round(0.5 * N);
  const P3: V3[] = new Array(N + 1);
  if (P.curl > 0) {
    // rolled onto its side in a tight spiral, back outward and legs in, the head tucked into the middle
    const cy = CURL_CY * k;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const ang = CURL_A0 - u * TAU * 0.93;
      const r = (2.5 + u * 1.1) * k;
      P3[i] = [Math.cos(ang) * r, cy + Math.sin(ang) * r, u * 5];
    }
    const S = project(P3, 0, [0, 0]);
    // the back faces out of the spiral
    for (let i = 0; i <= N; i++) {
      const o = nrm([S.p[i][0], S.p[i][1] - cy]);
      S.d[i] = o;
      S.sg[i] = -S.t[i][1] * o[0] + S.t[i][0] * o[1] > 0 ? 1 : -1;
    }
    return S;
  }
  const dir = (u: number): V3 => {
    // the reared front (squirt) and the lowered head (feed); a slow ripple running along it as it crawls
    const rearA = P.rear * 0.42 * (1 - sm(u / 0.34));
    const lowA = -P.low * 0.32 * (1 - sm(u / 0.2));
    const a = rearA + lowA + P.step * 0.06 * Math.sin(u * TAU * 1.4 - P.ph);
    const b = P.bend * Math.sin((u - 0.5) * Math.PI);
    return [Math.cos(a) * Math.cos(b), -Math.sin(a), Math.cos(a) * Math.sin(b)];
  };
  const cy = -(WORM_LEG + 1.9) * k + (P.fold ? 0.8 * k : 0);
  P3[ic] = [0, cy, 0];
  for (let i = ic + 1; i <= N; i++) { const d = dir((i - 0.5) / N), q = P3[i - 1]; P3[i] = [q[0] - d[0] * ds, q[1] - d[1] * ds, q[2] - d[2] * ds]; }
  for (let i = ic - 1; i >= 0; i--) { const d = dir((i + 0.5) / N), q = P3[i + 1]; P3[i] = [q[0] + d[0] * ds, q[1] + d[1] * ds, q[2] + d[2] * ds]; }
  // a soft arch to the back, like a caterpillar's
  for (let i = 0; i <= N; i++) P3[i][1] -= Math.sin(Math.PI * i / N) * 0.45 * k * (P.fold ? 0.5 : 1);
  return project(P3, P.bend ? WORM_TILT * 0.6 : 0, [0, 0]);
}

function wdraw(sk: Sk, anim: string, frame: number, _eye: BeastEye, juv: boolean) {
  const n = WORM_ANIMS[anim]?.frames ?? 1;
  const P = wpose(anim, frame, n);
  const k = juv ? 0.7 : 1;
  const S = wspine(P, k);
  const M = {
    // matte velvet: low contrast, the dorsal stripe and its diamonds kept crisp (no rim)
    stripe: sk.m(rmp('#1d1f48', { n: 5, dark: 0.4, light: 0.45, cool: 0.05, warm: 0.5 }), { edge: 1, k: 0.4, noRim: true }),
    diamond: sk.m(rmp('#f08a2e', { n: 4, dark: 0.32, light: 0.35, warm: 0.4, cool: 0.05 }), { edge: 1, k: 0.4, noRim: true }),
    back: sk.m(rmp('#2d3c92', { n: 5, dark: 0.45, light: 0.32, cool: 0.05, warm: 0.1 }), { edge: 1, k: 0.4 }),
    teal: sk.m(rmp('#1d6a76', { n: 5, dark: 0.45, light: 0.32, cool: 0.05, warm: 0.1 }), { edge: 1, k: 0.4 }),
    under: sk.m(rmp('#5e6290', { n: 4, dark: 0.4, light: 0.3, cool: 0.05 }), { edge: 1, k: 0.4 }),
    leg: sk.m(rmp('#2a5f86', { n: 4, dark: 0.4, light: 0.3, cool: 0.05 }), { edge: 0, k: 0.3, noRim: true }),
    legF: sk.m(rmp('#1b3354', { n: 4, dark: 0.4, light: 0.3, cool: 0.05 }), { edge: 0, k: 0.3, noRim: true }),
    foot: sk.m(rmp('#8e8cb0', { n: 4, dark: 0.35, light: 0.3, cool: 0.05 }), { edge: 0, k: 0.3, noRim: true }),
    papilla: sk.m(rmp('#d0b4c4', { n: 4, dark: 0.35, light: 0.35, cool: 0.05 }), { edge: 1, k: 0.5 }),
    preyB: sk.m(rmp('#86562a', { n: 5, dark: 0.5, light: 0.4, warm: 0.4, cool: 0.1 }), { edge: 1, k: 0.6 }),
    preyL: sk.m(rmp('#a87a44', { n: 4, dark: 0.45, light: 0.35, cool: 0.1 }), { edge: 0, k: 0.5 }),
  };
  const R = (u: number) => tab(WORM_R, u) * k * (1 + P.breathe * 0.03);
  const head = S.p[0], F: V2 = [-S.t[0][0], -S.t[0][1]];
  const zTop = Math.max(...S.z) + 4;
  const SLIME = hex('#f4f5ee'), SLIME2 = hex('#c4c8bc', 230), SLIME3 = hex('#9ea494', 170);

  /** a fine antenna, ringed light and dark, curving forward and up from its base, the tip drooping */
  const ANT = [hex('#262c62'), hex('#a8b4ec')], ANTF = [hex('#1a1e46'), hex('#5a6498')];
  const antenna = (b: V2, near: boolean) => {
    let a = Math.atan2(F[1], F[0]) - (near ? 0.5 : 0.85) + P.ant * (near ? 1 : -0.8) - P.fold * 2.2;
    let q: V2 = b;
    const L = 5.2 * k * (P.fold ? 0.85 : 1);
    let lastC = '';
    let i = 0;
    for (let d = 0; d < L; d += 0.35) {
      a += (d < 1.6 ? -0.035 : 0.075) * (P.fold ? -0.5 : 1);
      q = [q[0] + Math.cos(a) * 0.35, q[1] + Math.sin(a) * 0.35];
      const c = Math.floor(q[0]) + ',' + Math.floor(q[1]);
      if (c === lastC) continue;
      lastC = c;
      sk.over(q[0], q[1], (near ? ANT : ANTF)[i++ % 2]);
    }
  };

  if (P.peek) {
    // under cover: the round tip of the head low by the ground, and the antennae feeling the air
    sk.np();
    const hx = 5.5 * k, hy = -2.1 * k;
    sk.ell(hx, hy, 2.2 * k, 1.7 * k, (p: Px) => (p.v < -0.45 ? M.stripe : p.v > 0.4 ? M.teal : M.back), { z: 2 });
    antenna([hx + 0.3, hy - 1.3 * k], false);
    antenna([hx + 1.2, hy - 1.1 * k], true);
    sk.over(hx + 0.8, hy - 0.6 * k, hex('#04050a'));
    return { head: [hx, hy - 6] as V2, eye: [hx + 0.8, hy - 0.6] as V2 };
  }

  // ---- antennae (the far one first, behind the head)
  const ab = at(S, R, 0.035, 0.62);
  antenna([ab[0] - 0.7, ab[1] - 0.9], false);

  // ---- legs: a pixel column each, sixteen pairs: the near legs (paler, clawed feet) alternating with the
  // far ones (darker, in the gaps); a wave of lifted feet runs forward along them as it crawls
  if (!P.curl) {
    const x0 = Math.ceil(S.p[S.n][0] + 0.8 * k), x1 = Math.floor(head[0] - 0.6 * k);
    for (let x = x0; x <= x1; x++) {
      // the body's underside above this column
      let bu = 0.5, by = 0;
      for (let i = 0; i < S.n; i++) {
        const a = S.p[i], b = S.p[i + 1];
        if ((x + 0.5 - a[0]) * (x + 0.5 - b[0]) <= 0) { const t = (x + 0.5 - a[0]) / ((b[0] - a[0]) || 1e-6); bu = (i + t) / S.n; by = a[1] + (b[1] - a[1]) * t; break; }
      }
      const bottom = by + R(bu) * 0.9;
      const near = (x & 1) === 0;
      const ph = P.ph - x * 0.75 + (near ? 0 : Math.PI);
      const lifted = P.step > 0 && Math.sin(ph) > 0.45;
      const reach = Math.min(-0.5, bottom + 2.6 * k);
      const footY = P.fold ? Math.min(-0.5, bottom + 1) : lifted ? Math.min(reach, -1.5) : reach;
      const z = zAt(S, bu) - 1;
      for (let y = Math.floor(bottom - 0.5); y <= Math.floor(footY); y++) {
        const foot = y === Math.floor(footY) && near && !P.fold;
        sk.dot(x + 0.5, y + 0.5, near ? (foot ? M.foot : M.leg) : M.legF, 0.5, z);
      }
    }
  }

  // ---- the body: velvet in rings with papillae catching the light; indigo above, teal on the flanks, a pale
  // underside; a dark dorsal stripe with the orange diamonds down it
  const fill = (p: Px, u: number, dors: number) => {
    const along = u * WORM_L;
    const col = Math.floor(p.x + 64);
    if (col % 2) p.l -= 0.07;
    if (hh(p.x * 1.7, p.y * 1.3, 61) < 0.07) p.l += 0.16;
    if (u < 0.05) return dors > -0.35 ? M.back : M.teal;
    const cell = (along - 0.4) / 2.7, fq = cell - Math.floor(cell);
    if (dors > 0.55 && u < 0.95) {
      // the diamonds: a bead of orange in the dark stripe, its edges glowing into it
      if (u > 0.1 && u < 0.92 && fq > 0.32 && fq < 0.7) return M.diamond;
      if (u > 0.1 && u < 0.92 && (fq > 0.15 && fq < 0.85)) { p.l += 0.35; return M.stripe; }
      return M.stripe;
    }
    if (dors > 0.02) { if (fq > 0.35 && fq < 0.67 && u > 0.1 && u < 0.9) p.l += 0.16; return M.back; }
    // indigo melts into blue-green down the flank (dithered)
    if (dors > -0.18 || (dors > -0.3 && (Math.floor(p.x) + Math.floor(p.y)) % 2 === 0)) return M.back;
    if (dors > -0.62) return M.teal;
    return M.under;
  };
  bodyTube(sk, S, R, fill, { chunk: P.curl || P.bend ? 4 : 0 });

  // ---- the head: a tiny eye at the base of the antenna, the oral papillae either side of the mouth
  const eye = at(S, R, 0.07, 0.42);
  if (!P.curl) {
    sk.over(eye[0], eye[1], hex('#04050a'));
    const pap = at(S, R, 0.012, -0.55);
    sk.np();
    sk.ell(pap[0] + F[0] * (0.7 + P.jet * 0.5) * k, pap[1] + F[1] * 0.7 * k + 0.3, 0.75 * k, 0.6 * k, M.papilla, { z: zTop - 1 });
    antenna(ab, true);
  } else {
    // rolled up: the legs folded in, their pale feet ringing the hole in the middle; the head tucked against
    // the tail, an antenna tip still feeling the air
    const cy = CURL_CY * k;
    for (let u = 0.08; u < 0.97; u += 0.055) {
      const ang = CURL_A0 - u * TAU * 0.93, r = (2.5 + u * 1.1) * k - R(u) * 0.95;
      if (r < 0.6) continue;
      sk.over(Math.cos(ang) * r, cy + Math.sin(ang) * r, Math.floor(u * 18) % 2 ? hex('#8e8cb0') : hex('#2a5f86'));
    }
    const c = S.p[0], e = at(S, R, 0.06, 0.45);
    sk.over(e[0], e[1], hex('#04050a'));
    antenna([c[0] + F[0] * 0.8, c[1] + F[1] * 0.8 - 0.5], true);
  }

  // ---- the prey: a wētā glued down in a net of slime, the head bent over it, working
  if (P.prey) {
    sk.np();
    const px = head[0] + 2.8 * k, py = -1.5 * k;
    sk.ell(px + 0.6, py, 2.5 * k, 1.2 * k, M.preyB, { z: zTop - 2, rot: 0.1 });
    sk.ell(px + 3.1 * k, py + 0.1, 1.15 * k, 1.0 * k, M.preyB, { z: zTop - 1.8 });
    // the big spiny hind leg folded up, a feeler
    sk.line(px - 1.2, py + 0.6, px - 2.6, py - 1.4, M.preyL, 0.6, zTop - 2.2, true);
    sk.line(px - 2.6, py - 1.4, px - 3.6, py + 0.8, M.preyL, 0.5, zTop - 2.2, true);
    sk.line(px + 3.8, py - 0.6, px + 6.2, py - 2.4, M.preyL, 0.6, zTop - 2.2, true);
    // the slime: pale threads stuck across it and down to the ground
    for (let i = 0; i < 4; i++) sk.over(px - 1.2 + i * 1.3, py - 1 + (i % 2), SLIME);
    sk.over(px - 2.2, -0.5, SLIME2); sk.over(px + 4.4, -0.5, SLIME2); sk.over(px + 1.6, -0.5, SLIME3);
    if (P.chew > 0.5) sk.over(head[0] + 1, head[1] + 1.6 * k, hex('#d0b4c4'));
  }

  // ---- the slime jets: two fine sticky strands thrown forward from the papillae in wiggling arcs that cross
  if (P.jet > 0) {
    const pap = at(S, R, 0.012, -0.55);
    const q0: V2 = [pap[0] + F[0] * 1.4 * k, pap[1] + 0.4];
    const full = Math.max(1, WORM_REACH - q0[0]), reach = full * P.jet;
    for (let s = 0; s < 2; s++) {
      const sgn = s ? -1 : 1;
      let last: [number, number] | null = null;
      for (let d = 0; d <= reach; d += 0.3) {
        const e = d / full;
        // the arc, the wiggle from the swinging papillae, and the droop as the slime sets
        let y = q0[1] - d * 0.3 + d * d * 0.0085 + Math.sin(d * 0.62 + s * 2.2 + frame * 1.7) * Math.min(1.25, 0.2 + d * 0.05) * sgn;
        y += P.droop * e * e * 6 * k;
        y = Math.min(-0.5, y);
        const x = q0[0] + d;
        const cx = Math.floor(x), cy = Math.floor(y);
        // set strands lie broken in beads along the ground
        if (P.set && hh(Math.floor(d * 0.6), s, 71) < 0.35) continue;
        if (last && last[0] === cx && last[1] === cy) continue;
        last = [cx, cy];
        sk.over(cx, cy, SLIME);
        if (cy + 1 < 0) sk.over(cx, cy + 1, SLIME3);
      }
      // a sticky blob at the end of each strand
      if (P.jet >= 0.3 && last) { sk.over(last[0] + 1, last[1], SLIME); sk.over(last[0], last[1] + 1 < 0 ? last[1] + 1 : last[1], SLIME2); }
    }
  }
  return { head: [head[0], head[1] - 5 * k] as V2, eye };
}

export const NGAOKEOKE: SpeciesDef = {
  name: 'Ngaokeoke', kind: 'other', len: 16, height: 6,
  anims: WORM_ANIMS,
  canvas: (anim) => (anim === 'squirt' ? { w: 66, h: 28, ox: 18, oy: 21 } : { w: 40, h: 24, ox: 18, oy: 18 }),
  draw: wdraw,
  eyeFor: () => 'open',
};

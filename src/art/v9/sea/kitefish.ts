// Whiptail Kitefish: a flying fish with FOUR wings (huge pectoral fins and a smaller pelvic pair,
// the membranes barred like a kite) and a tail whose lower lobe runs out into a long whip. It
// bursts out of the swell by sculling the whip at the surface, glides on the four wings, and
// "skips": it drops the whip back into a wave crest and sculls again without landing, so a single
// flight can hop across several waves. Cobalt back, a silver belly, a big silver-ringed eye and
// an orange flag at the whip's tip.
//
// Seen from above (we look down from the deck); all anims anchor on the body centre.

import { Sk, V2, V3, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, AnimDef, TAU, hh } from '../../beasts-core';
import { HField, crv, ribbon, spline, arcs, along, lineDist } from '../../beasts-hfield';
import { hex } from '../../color';
import { View3 } from './seabird';

const A = (frames: number, fps: number, loop = true): AnimDef => ({ frames, fps, loop });
const ANIMS: Record<string, AnimDef> = {
  idle: A(2, 3),
  glide: A(3, 8),
  launch: A(4, 10, false),
  skip: A(3, 10),
  dive: A(2, 8),
  swim: A(2, 6),
};

const EYE: EyeSpec = { r: 1.05, iris: hex('#101418'), lash: hex('#101418'), ring: hex('#e8eef2'), dark: true };

function mats(sk: Sk) {
  return {
    back: sk.m(rmp('#2c64b8', { n: 6, dark: 0.55, light: 0.45, warm: 0, cool: 0.1 }), { edge: 1, spec: 0.5 }),
    belly: sk.m(rmp('#dde8f0', { n: 5, dark: 0.35, at: 3, warm: 0 }), { edge: 1, spec: 0.6, bias: 0.08 }),
    fin: sk.m(rmp('#8cbce6', { n: 6, dark: 0.4, light: 0.45, warm: 0 }), { edge: 1, bias: 0.06 }),
    ray: sk.m(rmp('#5a88c0', { n: 5, dark: 0.45, light: 0.4, warm: 0 }), { edge: 0 }),
    edge: sk.m(rmp('#c8e4f8', { n: 5, dark: 0.35, light: 0.4, warm: 0 }), { edge: 0 }),
    bar: sk.m(rmp('#1e4482', { n: 5, dark: 0.45, light: 0.35, warm: 0 }), { edge: 0 }),
    irid: sk.m(rmp('#4a9ad8', { n: 5, dark: 0.45, light: 0.45, warm: 0, cool: 0.1 }), { edge: 1 }),
    head: sk.m(rmp('#1e4a8e', { n: 6, dark: 0.5, light: 0.4, warm: 0 }), { edge: 1 }),
    spine: sk.m(rmp('#f4c640', { n: 4, dark: 0.4 }), { edge: 0, spec: 0.3 }),
    whip: sk.m(rmp('#2c4a78', { n: 4, dark: 0.45, warm: 0 }), { edge: 1 }),
    flag: sk.m(rmp('#f27a38', { n: 4, dark: 0.45 }), { edge: 1 }),
    mouth: sk.m(rmp('#1a2432', { n: 3, dark: 0.4 }), { edge: 0, noRim: true }),
  };
}
type M = ReturnType<typeof mats>;

interface Pose {
  bank: number; pitch: number; yaw: number;
  /** wing spread: 1 open .. 0 folded back along the body */
  open: number;
  /** membrane flutter phase */
  ripple: number;
  /** whip: sculling amplitude and phase, and how far it droops (skip: dipped into the wave) */
  scull: number; ph: number; droop: number;
}

function pose(anim: string, f: number, n: number): Pose {
  const t = f / n;
  const p: Pose = { bank: 0.95, pitch: 0, yaw: 0.12, open: 1, ripple: t, scull: 0.25, ph: t, droop: 0.2 };
  switch (anim) {
    case 'idle':
    case 'glide':
      p.bank = 0.95 + Math.sin(t * TAU) * 0.05;
      p.scull = 0.18;
      break;
    case 'launch':
      // bursting out tail-first sculling, wings unfurling
      p.bank = 0.45 + t * 0.4; p.pitch = 0.55 - t * 0.45;
      p.open = 0.25 + t * 0.85;
      p.scull = 1; p.droop = 0.9 - t * 0.5;
      break;
    case 'skip':
      // nose up, wings full, the whip dropped into the crest and flicking
      p.bank = 0.7; p.pitch = 0.22;
      p.scull = 1; p.droop = 1;
      break;
    case 'dive':
      p.bank = 0.6; p.pitch = -0.5;
      p.open = 0.15;
      p.scull = 0.3; p.droop = 0.1;
      break;
    case 'swim':
      p.bank = 0.35; p.pitch = 0;
      p.open = 0.05;
      p.scull = 0.6; p.droop = 0;
      break;
  }
  return p;
}

/**
 * A fin membrane in the body's horizontal plane, drawn as its outline: the spiny leading ray running out
 * to the tip, then the fan of rays whose tips scallop the trailing edge back to the root. Rays, the two
 * dark bars and the translucent edge are painted from where a pixel sits in the fan.
 */
function wing(F: HField, V: View3, M: M, side: 1 | -1, root: V3, span: number, chord: number, P: Pose, dih: number, id: number, rays: number) {
  const o = P.open;
  const sw = -0.25 - (1 - o) * 1.2;
  const fl = Math.sin(P.ripple * TAU) * 0.3;
  // the fan: ray f (0 the leading ray .. 1 the last, lying back along the flank), its direction and length
  const ray = (f: number): V3 => {
    const a = sw - f * (1.25 - (1 - o) * 0.4);
    const L = span * (1 - f * 0.55) * (0.9 + 0.1 * Math.sin(f * Math.PI)) + chord * 0.15 * f;
    const lift = Math.sin(dih) * L + fl * Math.sin(f * Math.PI * 2) * 0.6;
    return [root[0] + Math.sin(a) * L - f * chord * 0.35, root[1] + lift, root[2] + Math.cos(a) * L * side];
  };
  const pts3: V3[] = [];
  // the leading edge bowed a touch forward, out to the tip
  for (let i = 0; i <= 4; i++) { const t = i / 4, q = ray(0); pts3.push([root[0] + (q[0] - root[0]) * t + Math.sin(t * Math.PI) * 0.5, root[1] + (q[1] - root[1]) * t, root[2] + (q[2] - root[2]) * t]); }
  // ray tips and the scallops between them
  for (let i = 1; i <= rays; i++) {
    const f0 = (i - 1) / rays, f1 = i / rays, fm = (f0 + f1) / 2;
    const m = ray(fm), mid: V3 = [root[0] + (m[0] - root[0]) * 0.86, root[1] + (m[1] - root[1]) * 0.86, root[2] + (m[2] - root[2]) * 0.86];
    pts3.push(mid, ray(f1));
  }
  pts3.push([root[0] - chord * 0.9, root[1], root[2] + side * 0.3]);
  const sp = pts3.map(q => V.s(q));
  const cont = spline(sp.map(q => [q[0], q[1]] as V2), 2, true);
  // a depth plane through the root, the tip and the back of the fan
  const r0 = V.s(root), t0 = sp[4], b0 = sp[sp.length - 1];
  const e1x = t0[0] - r0[0], e1y = t0[1] - r0[1], e2x = b0[0] - r0[0], e2y = b0[1] - r0[1];
  const det = e1x * e2y - e1y * e2x || 1e-6;
  const zp = (x: number, y: number) => { const rx = x - r0[0], ry = y - r0[1]; const u = (rx * e2y - ry * e2x) / det, v = (e1x * ry - e1y * rx) / det; return r0[2] + (t0[2] - r0[2]) * u + (b0[2] - r0[2]) * v; };
  const lead = spline([[r0[0], r0[1]], [t0[0], t0[1]]], 1);
  const ra = Math.atan2(t0[1] - r0[1], t0[0] - r0[0]), rb = Math.atan2(b0[1] - r0[1], b0[0] - r0[0]);
  let span2 = rb - ra; while (span2 > Math.PI) span2 -= TAU; while (span2 < -Math.PI) span2 += TAU;
  F.inflate(cont, 0.7, zp, id, 0, (x, y, d, s, tx) => {
    const ang = Math.atan2(y - r0[1], x - r0[0]);
    let df = ang - ra; while (df > Math.PI) df -= TAU; while (df < -Math.PI) df += TAU;
    const f = Math.abs(span2) > 0.05 ? Math.max(0, Math.min(1, df / span2)) : 0;
    const rr = Math.hypot(x - r0[0], y - r0[1]);
    const q = ray(f), qs = V.s(q), Lf = Math.max(1, Math.hypot(qs[0] - r0[0], qs[1] - r0[1]));
    const u = rr / Lf;
    tx.m = M.fin;
    tx.t = side < 0 ? -0.1 : 0;
    // the rays: fine dark ribs fanning from the root
    if (Math.abs(((f * rays) % 1) - 0.5) > 0.38 && u > 0.12) { tx.z += 0.25; tx.m = M.ray; }
    // two dark bars across the membrane
    if ((u > 0.3 && u < 0.46) || (u > 0.64 && u < 0.78)) tx.m = M.bar;
    // the thin edge glows paler
    if (d < 0.6 && u > 0.5) tx.m = M.edge;
    if (lineDist(lead, x, y)[0] < 0.7) tx.m = M.spine;
  }, 0.3);
}

function drawKite(sk: Sk, M: M, P: Pose, eye: BeastEye): { head: V2; eye: V2 } {
  const V = new View3(P.bank, P.pitch, P.yaw, [0, 0], 1);
  const F = HField.full(sk);
  // far wings first
  wing(F, V, M, -1, [2.4, 0.2, -1.2], 11.5, 5.2, P, 0.06, 2, 9);
  wing(F, V, M, -1, [-5.4, -0.2, -0.8], 6.8, 3.4, P, 0.02, 3, 6);
  // the tail: the upper lobe a short stiff spike, the lower lobe running out into the sculling whip
  const pts: V2[] = [];
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    const x = -7.2 - u * 15;
    const y = -u * u * 5 * P.droop - u * 0.8;
    const z = Math.sin(P.ph * TAU + u * 5) * P.scull * u * 2.4;
    pts.push(V.s2([x, y, z]));
  }
  const wc = arcs(pts);
  const ww = (t: number) => (t < 0.86 ? 0.75 - t * 0.5 : 0.32);
  F.inflate(ribbon(pts.slice(0, 15), (t) => ww(t * 14 / 16), (t) => ww(t * 14 / 16), 40, 0.6, 0.6), 0.6, -0.5, 4, 0, (x, y, d, s, tx) => {
    const t = lineDist(pts, x, y, wc)[1];
    tx.m = M.whip;
    if (Math.floor(t * 22) % 2 === 0) tx.z -= 0.2;
  }, 0.7);
  // the orange flag at the whip's tip, a little pennant
  {
    const a = pts[14], b = pts[16];
    const dx = b[0] - a[0], dy = b[1] - a[1], dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl;
    const flag = spline([[a[0], a[1]], [a[0] + dx * 0.5 + nx * 1.6, a[1] + dy * 0.5 + ny * 1.6], [b[0] + dx * 0.4 + nx * 0.6, b[1] + dy * 0.4 + ny * 0.6], [b[0], b[1]], [a[0] + dx * 0.5 - nx * 0.9, a[1] + dy * 0.5 - ny * 0.9]], 3, true);
    F.inflate(flag, 0.8, 0, 5, 0, (x, y, d, s, tx) => { tx.m = M.flag; if (d < 0.5) tx.t = -0.1; }, 0.5);
  }
  {
    const up0 = V.s2([-6.6, 0.3, 0]), up1 = V.s2([-10.2, 1.9, 0]);
    const spike = spline([[up0[0], up0[1] - 0.9], [up1[0], up1[1]], [up0[0] + (up1[0] - up0[0]) * 0.4, up0[1] + (up1[1] - up0[1]) * 0.4 + 0.7], [up0[0], up0[1] + 0.9]], 3, true);
    F.inflate(spike, 0.7, 0.3, 6, 0, (x, y, d, s, tx) => { tx.m = M.back; }, 0.6);
  }
  // the body: one outline round its spine, cobalt above, silver below
  const line3: V3[] = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; line3.push([7.4 - t * 15, 0.2 - t * 0.2 + Math.sin(t * Math.PI) * 0.1, 0]); }
  const sp3 = line3.map(q => V.s(q));
  const spine = sp3.map(q => [q[0], q[1]] as V2);
  const sc = arcs(spine);
  const BW: [number, number][] = [[0, 0.7], [0.08, 1.4], [0.18, 2.0], [0.32, 2.45], [0.5, 2.3], [0.7, 1.6], [0.88, 1.0], [1, 0.75]];
  const bw = (t: number) => crv(BW, t);
  const zs = (t: number) => { const f = t * 12, i = Math.min(11, Math.floor(f)); return sp3[i][2] + (sp3[i + 1][2] - sp3[i][2]) * (f - i); };
  F.inflate(ribbon(spine, bw, bw, 60, 0.7, 0.3), 2.1, (x, y) => zs(lineDist(spine, x, y, sc)[1]), 1, 0, (x, y, d, s, tx) => {
    const t = lineDist(spine, x, y, sc)[1];
    const q = along(spine, t, sc);
    const off = (x - q.p[0]) * q.n[0] + (y - q.p[1]) * q.n[1];
    // which way the surface faces in the body: up (the back) or down (the belly), from the bank
    const v = Math.max(-1, Math.min(1, off / Math.max(0.5, bw(t))));
    const dors = -v * Math.cos(P.bank) * 0 + Math.sqrt(Math.max(0, 1 - v * v)) * Math.sin(P.bank) + (-v) * Math.cos(P.bank);
    tx.m = dors > -0.05 ? M.back : M.belly;
    // the scales: a net of small cycloid scales, each lit on its front edge
    const sx = t * 20, sy = v * 3;
    const cx2 = sx - Math.floor(sx), cy2 = sy + (Math.floor(sx) % 2) * 0.5;
    const r = Math.hypot(cx2 - 0.5, (cy2 - Math.round(cy2)) * 1.4);
    if (t > 0.18 && r > 0.42) tx.z -= 0.18;
    if (dors > 0.4 && t > 0.2 && t < 0.85 && hh(Math.floor(sx), Math.floor(sy + 9), 3) > 0.7) tx.m = M.irid;
    if (t < 0.17 && dors > -0.05) tx.m = M.head;
  }, 0.8);
  // near wings over the body
  wing(F, V, M, 1, [-5.4, -0.2, 0.8], 6.8, 3.4, P, 0.02, 7, 6);
  wing(F, V, M, 1, [2.4, 0.2, 1.2], 11.5, 5.2, P, 0.06, 8, 9);
  sk.np();
  F.emit({ seam: 0.8, seamDark: 0.3, ao: 0.05, aoR: 2, shadow: 0.16, shadowR: 6,
    spec: (m) => (m === M.back || m === M.irid || m === M.head ? 0.6 : m === M.belly ? 0.7 : m === M.fin || m === M.edge ? 0.3 : 0), specPow: 18 });
  // eye and mouth
  const ep0 = V.s2([4.8, 0.6, 1.3]);
  const ep = V.faces([0.2, 0.3, 1], 0) ? drawEye(sk, ep0[0], ep0[1], EYE, eye) : ep0;
  const m0 = V.s([6.4, -0.4, 0.8]), m1 = V.s([7.4, -0.2, 0.5]);
  sk.overLine(m0[0], m0[1], m1[0], m1[1], hex('#1a2432'));
  return { head: V.s2([5, 4, 0]), eye: ep };
}

export const KITEFISH: SpeciesDef = {
  name: 'Whiptail Kitefish', kind: 'fish', len: 16, height: 6,
  anims: ANIMS,
  canvas: () => ({ w: 60, h: 44, ox: 30, oy: 22 }),
  draw(sk, anim, frame, eye) {
    const n = ANIMS[anim]?.frames ?? 1;
    return drawKite(sk, mats(sk), pose(anim, frame, n), eye);
  },
  eyeFor: () => 'open',
  anchor: Object.fromEntries(Object.keys(ANIMS).map(a => [a, 'centre'])) as Record<string, 'centre'>,
};

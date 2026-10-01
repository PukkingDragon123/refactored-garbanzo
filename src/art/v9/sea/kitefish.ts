// Whiptail Kitefish: a flying fish with FOUR wings (huge pectoral fins and a smaller pelvic pair,
// the membranes barred like a kite) and a tail whose lower lobe runs out into a long whip. It
// bursts out of the swell by sculling the whip at the surface, glides on the four wings, and
// "skips": it drops the whip back into a wave crest and sculls again without landing, so a single
// flight can hop across several waves. Cobalt back, a silver belly, a big silver-ringed eye and
// an orange flag at the whip's tip.
//
// Seen from above (we look down from the deck); all anims anchor on the body centre.

import { Sk, V2, V3, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, AnimDef, TAU } from '../../beasts-core';
import { hex } from '../../color';
import { View3, body3, plate3, rows } from './seabird';

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
    fin: sk.m(rmp('#a4d2f2', { n: 5, dark: 0.35, light: 0.5, warm: 0 }), { edge: 1, bias: 0.12 }),
    bar: sk.m(rmp('#224c88', { n: 5, dark: 0.45, warm: 0 }), { edge: 0 }),
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

/** a fin membrane in the body's horizontal plane: base along the flank, a spiny leading edge, a scalloped trailing edge */
function wing(sk: Sk, V: View3, M: M, side: 1 | -1, root: V3, span: number, chord: number, P: Pose, dih: number) {
  const o = P.open;
  // folding sweeps the membrane back along the body
  const sw = -0.25 - (1 - o) * 1.2;
  const d: V3 = [Math.sin(sw), Math.sin(dih), Math.cos(sw) * side];
  const tip: V3 = [root[0] + d[0] * span, root[1] + d[1] * span, root[2] + d[2] * span];
  const back: V3 = [root[0] - chord, root[1], root[2]];
  // a broad, rounded fan: the trailing edge bulges back between tip and root
  const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const fl = Math.sin(P.ripple * TAU) * 0.3;
  const m1 = lerp3(tip, back, 0.3), m2 = lerp3(tip, back, 0.68);
  m1[0] -= chord * 0.55; m2[0] -= chord * 0.45; m1[1] += fl; m2[1] -= fl;
  sk.np();
  plate3(sk, V, [root, tip, m1, m2, back], (p) => {
    // radiating fin rays and two dark bars across the membrane
    const r = p.u * 7 + p.v * 1.2;
    p.l += rows(r, 1, 0.3) * 0.5;
    const band = p.u + p.v * 0.35;
    if ((band > 0.26 && band < 0.42) || (band > 0.6 && band < 0.76)) return M.bar;
    return M.fin;
  }, [0, 1, 0], { bias: side < 0 ? -0.1 : 0 });
  const a = V.s(root), b = V.s(tip);
  sk.tube([[a[0], a[1]], [b[0], b[1]]], t => 0.55 - t * 0.25, M.spine, { z: t => a[2] + (b[2] - a[2]) * t + 0.6 });
}

function drawKite(sk: Sk, M: M, P: Pose, eye: BeastEye): { head: V2; eye: V2 } {
  const V = new View3(P.bank, P.pitch, P.yaw, [0, 0], 1);
  // far wings first
  wing(sk, V, M, -1, [2.4, 0.2, -1.2], 11.5, 5.2, P, 0.06);
  wing(sk, V, M, -1, [-5.4, -0.2, -0.8], 6.8, 3.4, P, 0.02);
  // the whip: upper lobe a short spike, the lower lobe a long sculling lash
  sk.np();
  const tb: V3 = [-7.2, 0, 0];
  const pts: V2[] = [];
  for (let i = 0; i <= 14; i++) {
    const u = i / 14;
    const x = tb[0] - u * 15;
    const y = -u * u * 5 * P.droop - u * 0.8;
    const z = Math.sin(P.ph * TAU + u * 5) * P.scull * u * 2.4;
    pts.push(V.s2([x, y, z]));
  }
  sk.tube(pts, t => 0.72 - t * 0.45, (p) => (p.t > 0.86 ? M.flag : M.whip), { z: -0.5 });
  const up0 = V.s2([-7, 0.4, 0]), up1 = V.s2([-10, 1.8, 0]);
  sk.blade(up0[0], up0[1], up1[0], up1[1], s => (1 - s) * 1.1 + 0.3, M.back, { z0: 0, z1: 0 });
  // body: cobalt back, silver belly, a pointed snout
  sk.np();
  body3(sk, V, [[-7.4, 0, 0], [-4, 0.1, 0], [0, 0.2, 0], [4, 0.2, 0], [7.2, -0.1, 0]],
    t => (t < 0.6 ? 1.1 + t * 2.2 : 2.42 - (t - 0.6) * 4), (p, nb) => {
      if (nb[1] > -0.05) { p.l += rows(p.x * 0.8, 1, 0.2) * 0.3; return M.back; }
      return M.belly;
    });
  // near wings over the body
  wing(sk, V, M, 1, [-5.4, -0.2, 0.8], 6.8, 3.4, P, 0.02);
  wing(sk, V, M, 1, [2.4, 0.2, 1.2], 11.5, 5.2, P, 0.06);
  // eye and mouth
  const ep0 = V.s2([4.8, 0.6, 1.3]);
  const ep = V.faces([0.2, 0.3, 1], 0) ? drawEye(sk, ep0[0], ep0[1], EYE, eye) : ep0;
  const m0 = V.s([6.4, -0.4, 0.8]), m1 = V.s([7.4, -0.2, 0.5]);
  sk.line(m0[0], m0[1], m1[0], m1[1], M.mouth, 0.3, Math.max(m0[2], m1[2]) + 3, true);
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

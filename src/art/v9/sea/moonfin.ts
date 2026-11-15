// Moonfin Porpoise: a small, stocky porpoise of cold seas. On its back it carries a round, pale
// "moon" fin, a disc of skin over a mesh of blood vessels that dumps heat after a sprint and flags
// the pod's position; along each flank run two lines of glowing photophores (symbiotic
// bacteria) that let the pod keep formation and herd lanternfish in the dark. Blunt melon, a short
// smiling beak, a dark eye mask, a dusky slate back, a pale grey flank and a white belly.
//
// All anims face right and anchor on the body centre. 'leap' runs from nose-up (frame 0) through
// level to nose-down (last frame); the game picks the frame from the arc of the jump.

import { Sk, V2, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, AnimDef, TAU, hh, cbez } from '../../beasts-core';
import { HField, crv, ribbon, spline, arcs, along, lineDist, fbm } from '../../beasts-hfield';
import { hex } from '../../color';

const A = (frames: number, fps: number, loop = true): AnimDef => ({ frames, fps, loop });
export const MOONFIN_LEAP = 7;
const ANIMS: Record<string, AnimDef> = {
  idle: A(2, 2),
  swim: A(6, 8),
  leap: A(MOONFIN_LEAP, 1),
  bowride: A(4, 4),
  breach: A(6, 8, false),
  tailslap: A(4, 8, false),
};
export const moonfinLeapPitch = (f: number) => 0.95 - (f / (MOONFIN_LEAP - 1)) * 1.9;
/** the photophore glow colours (seafauna draws them again as an emissive overlay) */
export const MOONFIN_GLOW = rmp('#86f6e4', { n: 4, dark: 0.25, light: 0.6, at: 2 });

const EYE: EyeSpec = { r: 0.7, iris: hex('#0e1218'), lash: hex('#0e1218'), ring: hex('#9fb4c2') };

function mats(sk: Sk) {
  return {
    back: sk.m(rmp('#283646', { n: 7, dark: 0.55, light: 0.34, warm: 0.0, cool: 0.2 }), { edge: 1, bias: -0.06 }),
    flank: sk.m(rmp('#506478', { n: 7, dark: 0.5, light: 0.38, warm: 0.0, cool: 0.2 }), { edge: 1 }),
    belly: sk.m(rmp('#e6ecef', { n: 5, dark: 0.35, at: 3 }), { edge: 1, bias: 0.1 }),
    mask: sk.m(rmp('#1c2430', { n: 6, dark: 0.5, light: 0.3, warm: 0 }), { edge: 0 }),
    glow: sk.m(MOONFIN_GLOW, { edge: 0, noRim: true, bias: 0.3 }),
    moon: sk.m(rmp('#d8d6cc', { n: 6, dark: 0.4, light: 0.45 }), { edge: 1 }),
    crater: sk.m(rmp('#b4b2b0', { n: 5, dark: 0.4 }), { edge: 0 }),
    vein: sk.m(rmp('#a05a64', { n: 5, dark: 0.45, light: 0.35 }), { edge: 0 }),
    rim: sk.m(rmp('#9aa2c0', { n: 5, dark: 0.45, light: 0.4 }), { edge: 0 }),
    rake: sk.m(rmp('#7a889a', { n: 5, dark: 0.45, light: 0.3 }), { edge: 0 }),
    flip: sk.m(rmp('#2c3848', { n: 6, dark: 0.5, light: 0.35, warm: 0 }), { edge: 1 }),
    mouth: sk.m(rmp('#1c222c', { n: 3, dark: 0.4 }), { edge: 0, noRim: true }),
    hole: sk.m(rmp('#10141a', { n: 3, dark: 0.3 }), { edge: 0, noRim: true }),
  };
}
type M = ReturnType<typeof mats>;

interface Pose {
  pitch: number;   // + nose up
  bend: number;    // spine curvature (+ arched up in the middle)
  tail: number;    // tail stock beat (+ up)
  roll: number;    // 0 upright .. PI belly up
  flip: number;    // flipper angle (+ spread)
  open: number;
}

function pose(anim: string, f: number, n: number): Pose {
  const t = f / n;
  const p: Pose = { pitch: 0, bend: 0, tail: 0, roll: 0, flip: 0.2, open: 0 };
  switch (anim) {
    case 'idle':
      p.tail = f ? 0.15 : -0.1; p.bend = 0.05;
      break;
    case 'swim':
      p.tail = Math.sin(t * TAU) * 0.45;
      p.bend = Math.sin(t * TAU - 1.2) * 0.12;
      p.pitch = Math.sin(t * TAU + 0.6) * 0.04;
      break;
    case 'leap':
      p.pitch = moonfinLeapPitch(f);
      p.bend = 0.18;
      p.tail = -p.pitch * 0.35;
      p.flip = 0.05;
      break;
    case 'bowride':
      // surfing the pressure wave: flukes still, body leaning to show the glowing flank lines
      p.pitch = -0.08 + Math.sin(t * TAU) * 0.03;
      p.roll = 0.35 + Math.sin(t * TAU) * 0.1;
      p.tail = Math.sin(t * TAU) * 0.08;
      p.flip = 0.5;
      break;
    case 'breach': {
      // a spinning leap: up out of the water, rolling belly-up at the top, over and back in
      p.pitch = [1.25, 1.05, 0.55, -0.1, -0.7, -1.2][f];
      p.roll = t * TAU * 0.9;
      p.bend = [0.1, 0.2, 0.3, 0.3, 0.2, 0.1][f];
      p.tail = [-0.5, -0.2, 0.1, 0.3, 0.4, 0.2][f];
      p.flip = 0.6;
      break;
    }
    case 'tailslap':
      // head down, tail thrown up and slapped flat on the water
      p.pitch = -0.35;
      p.bend = -0.25;
      p.tail = [0.3, 1.1, 1.3, -0.4][f];
      p.flip = 0.7;
      break;
  }
  return p;
}

const L = 40;
/** half-heights of the body above and below its spine, nose (0) to tail (1): the short beak, the
 * bulging melon, the deep chest, the keeled tail stock */
const TOPH: [number, number][] = [[0, 0.9], [0.03, 1.3], [0.07, 1.5], [0.1, 2.7], [0.14, 4.4], [0.2, 5.4], [0.3, 5.9], [0.42, 6.1], [0.55, 5.4], [0.68, 4.2], [0.8, 3.1], [0.9, 2.5], [0.97, 1.9], [1, 1.5]];
const BOTH: [number, number][] = [[0, 0.9], [0.03, 1.2], [0.07, 1.6], [0.11, 2.4], [0.16, 3.9], [0.25, 5.2], [0.36, 6.0], [0.48, 5.8], [0.6, 4.7], [0.72, 3.5], [0.82, 2.8], [0.9, 2.3], [0.97, 1.7], [1, 1.3]];
function drawMoonfin(sk: Sk, M: M, P: Pose, eye: BeastEye): { head: V2; eye: V2 } {
  const F = HField.full(sk);
  const cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
  const B = (x: number, y: number): V2 => [x * cp + y * sp, -x * sp + y * cp];
  const tailY = -P.tail * 6;
  const spine = cbez(B(19.5, 0.6), B(8, -1.2 - P.bend * 6), B(-9, -0.8 - P.bend * 4), B(-17, 1 + tailY * 0.7), 20);
  const cum = arcs(spine), SL = cum[cum.length - 1];
  const cr = Math.cos(P.roll), sr = Math.sin(P.roll);
  // the silhouette as it rolls: dorsal and ventral half-heights blend with the half-width
  const W = (t: number) => (crv(TOPH, t) + crv(BOTH, t)) * 0.48;
  const up = (t: number) => { const a = crv(TOPH, t), b = crv(BOTH, t), w = W(t); return Math.sqrt((a * cr) ** 2 + (w * sr) ** 2) * (cr >= 0 ? 1 : 1) + (cr < 0 ? (b - a) * (-cr) * 0 : 0); };
  const dn = (t: number) => { const a = crv(TOPH, t), b = crv(BOTH, t), w = W(t); return Math.sqrt((b * cr) ** 2 + (w * sr) ** 2); };
  const upH = (t: number) => (cr >= 0 ? up(t) : dn(t));
  const dnH = (t: number) => (cr >= 0 ? dn(t) : up(t));
  /** body-space dorsal-ness of a screen offset v (+1 top of silhouette .. -1 bottom) */
  const side = (v: number) => { const z = Math.sqrt(Math.max(0, 1 - v * v)); return v * cr + z * sr; };
  // the spine runs beak -> tail (leftward): the ribbon's left edge is the bottom, the right the top
  const outline = ribbon(spine, dnH, upH, 90, 0, 0);
  const where = (x: number, y: number): [number, number] => {
    const [, t] = lineDist(spine, x, y, cum);
    const q = along(spine, t, cum);
    const off = -((x - q.p[0]) * q.n[0] + (y - q.p[1]) * q.n[1]);
    const h = off >= 0 ? upH(t) : dnH(t);
    return [t, Math.max(-1, Math.min(1, off / Math.max(0.5, h)))];
  };
  // ---- the far flipper and the far fluke lobe
  const flipper = (near: boolean) => {
    const root = along(spine, 0.27, cum).p;
    const a = P.pitch - 2.55 + P.flip * 0.6;
    const len = 6.4 * (near ? 1 : 0.8);
    const base: V2 = [root[0] - 0.5, root[1] + 2.4 * (cr >= 0 ? 1 : -1)];
    const tip: V2 = [base[0] + Math.cos(-a) * len, base[1] + Math.sin(-a) * len * (cr >= 0 ? 1 : -1) + 1.4];
    const lead = (s: number) => (Math.sin(Math.min(1, s * 1.2 + 0.1) * Math.PI) * 1.7 + 0.35) * (1 - s * 0.3);
    const trail = (s: number) => Math.sin(Math.min(1, s * 1.1 + 0.05) * Math.PI) * 1.0 + 0.3;
    F.inflate(ribbon([base, tip], lead, trail, 12, 0.6, 0.5), 1.1, near ? 6 : -6, near ? 5 : 4, 0, (x, y, d, s, o) => {
      o.m = M.flip; o.t = near ? 0 : -0.16;
      if (d < 0.5 && near) o.t += 0.05;
    }, 0.6);
  };
  const stock = spine[spine.length - 1];
  const ta = Math.atan2(spine[spine.length - 1][1] - spine[spine.length - 3][1], spine[spine.length - 1][0] - spine[spine.length - 3][0]);
  const lobe = (s: 1 | -1) => {
    // a fluke lobe as an outline: the leading edge sweeping out to a pointed tip, the trailing edge
    // bowed in to the median notch (the flukes are horizontal: seen from the side they spread back)
    const fl = 11.5, spread = 0.3 + Math.abs(sr) * 0.55;
    const ang = ta + s * spread;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const nx = -dy * s, ny = dx * s;
    const P0: V2 = [stock[0] - Math.cos(ta) * 1.2, stock[1] - Math.sin(ta) * 1.2];
    const at2 = (u: number, w: number): V2 => [stock[0] + dx * fl * u + nx * w, stock[1] + dy * fl * u + ny * w];
    const notch: V2 = [stock[0] + Math.cos(ta) * 3.2, stock[1] + Math.sin(ta) * 3.2];
    const c = spline([P0, at2(0.25, -2.6), at2(0.6, -2.5), at2(0.9, -1.1), at2(1.0, 0.1), at2(0.82, 0.7), at2(0.55, 0.5), notch], 4, true);
    F.inflate(c, 1.1, s > 0 ? -2 : 2, 6 + (s > 0 ? 1 : 0), 0, (x, y, d, sh, o) => { o.m = s > 0 ? M.flank : M.back; o.t = s > 0 ? -0.12 : 0; }, 0.45);
  };
  flipper(false);
  lobe(1);
  // ---- the body: one outline
  F.inflate(outline, 4.6, 0, 1, 0, (x, y, d, s, o) => {
    const [t, v] = where(x, y);
    const dd = side(v);
    // the skin: smooth, a faint grain, healed tooth-rakes from its podmates
    o.m = M.flank;
    if (hh(Math.floor(x * 1.6), Math.floor(y * 1.6), 3) > 0.92) o.z -= 0.2;
    // photophore lines: two rows of glowing pockets along the dark flank, converging toward the tail
    if (t > 0.19 && t < 0.84) {
      const kk = (t - 0.19) / 0.65;
      const pocket = ((t * L * 1.05) % 1) < 0.62;
      if (Math.abs(dd - (0.3 - kk * 0.2)) < 0.085 && pocket) { o.m = M.glow; return; }
      if (t > 0.28 && t < 0.74 && Math.abs(dd - (-0.02 - kk * 0.1)) < 0.07 && pocket) { o.m = M.glow; return; }
    }
    // the white belly patch from the chin to the vent, its edge feathered
    const edge = -0.36 + (fbm(t * 9, 1, 5, 2) - 0.5) * 0.18;
    if (dd < edge && t > 0.04 && t < 0.74) { o.m = M.belly; return; }
    // the dark eye mask over the beak and melon
    if (t < 0.2 && dd > -0.25 && dd < 0.55) { o.m = M.mask; return; }
    if (dd > 0.08) o.m = M.back;
    // rake scars: fine pale parallel scratches slanting across the back and flanks
    const rk = t * L * 0.9 + dd * 3;
    if (t > 0.25 && t < 0.7 && Math.abs(rk - Math.round(rk)) < 0.07 && hh(Math.round(rk), 1, 7) > 0.65) { o.m = M.rake; o.z -= 0.15; }
  }, 0.9);
  // anatomy: the melon's bulge, the beak's crease, the mouth line (the smile), the blowhole, the keel
  const mel = along(spine, 0.12, cum).p;
  F.bump(mel[0] - sp * 1.5 * cr, mel[1] - cp * 1.5 * cr, 3.2, 0.8, 0, 0.04, 2.4);
  const beak = along(spine, 0.015, cum).p, mEnd = along(spine, 0.135, cum).p, mMid = along(spine, 0.07, cum).p;
  const mdir = cr >= 0 ? 1 : -1;
  const mouth: V2[] = [[beak[0] - 0.4, beak[1] + 0.9 * mdir], [mMid[0], mMid[1] + 1.4 * mdir], [mEnd[0] + 0.4, mEnd[1] + 1.4 * mdir], [mEnd[0] - 0.6, mEnd[1] + 0.8 * mdir]];
  F.groove(spline(mouth, 3), 0.55, 0.5, M.mouth, -0.12, 1);
  const crease = along(spine, 0.075, cum).p;
  F.groove([[crease[0] - 0.4, crease[1] - 1.6 * mdir], [crease[0], crease[1] - 0.2 * mdir]], 0.6, 0.45, 0, -0.06, 1);
  // ---- the moon fin: a broad round radiator on a short thick base, veined, its edge thin and pale
  const finBase = along(spine, 0.44, cum).p;
  const upv: V2 = [-Math.sin(P.pitch), -Math.cos(P.pitch)];
  const fwd: V2 = [Math.cos(P.pitch), -Math.sin(P.pitch)];
  const ud = cr;
  let finC: V2 | null = null;
  if (Math.abs(ud) > 0.08) {
    const sq = Math.max(0.32, Math.abs(ud)), sg = ud > 0 ? 1 : -1;
    const fp = (f: number, u: number): V2 => [finBase[0] + fwd[0] * f + upv[0] * u * sg * sq, finBase[1] + fwd[1] * f + upv[1] * u * sg * sq];
    // the outline: a broad base rising, the disc swelling forward and back, a notch in its trailing edge
    const fin = spline([fp(-3.2, 3.6), fp(-1.6, 5.4), fp(-3.6, 7.4), fp(-3.4, 10.4), fp(-1.2, 12.4), fp(1.6, 12.6), fp(3.8, 10.8), fp(4.4, 8.2), fp(3.2, 6.0), fp(1.8, 5.0), fp(2.8, 3.4)], 4, true);
    finC = fp(0.3, 9.2);
    const fc = finC;
    F.inflate(fin, 1.6, ud > 0 ? (sr > 0 ? -1.5 : 1.2) : -1.5, 3, 0.8, (x, y, d, s, o) => {
      const r = Math.hypot(x - fc[0], (y - fc[1]) / sq);
      o.m = d < 0.55 ? M.rim : M.moon;
      // the vessels: dark red channels branching out from the base across the pale disc
      const ang = Math.atan2((y - fc[1]) / sq, x - fc[0]);
      const br = Math.abs(Math.sin(ang * 3.5 + Math.sin(r * 1.3) * 0.5));
      if (r > 0.8 && br < 0.2 && d > 0.6) { o.m = M.vein; o.z -= 0.2; }
      else if (fbm(x * 0.8, y * 0.8, 21, 2) > 0.66 && d > 0.8) o.m = M.crater;
    }, 0.35);
  }
  flipper(true);
  lobe(-1);
  sk.np();
  F.emit({ seam: 1.0, seamDark: 0.3, ao: 0.06, aoR: 2, shadow: 0.18, shadowR: 7,
    spec: (m) => (m === M.back || m === M.mask || m === M.flank ? 0.55 : m === M.belly ? 0.25 : 0), specPow: 26 });
  // the blowhole and the eye
  const bh = along(spine, 0.2, cum).p;
  if (cr > 0.4) sk.over(bh[0] + upv[0] * (upH(0.2) - 0.6), bh[1] + upv[1] * (upH(0.2) - 0.6), hex('#10141a'));
  const eyeP = along(spine, 0.14, cum).p;
  const ep = side(0.05) > -0.9 ? drawEye(sk, eyeP[0] - 0.4, eyeP[1] - 0.4 * mdir, EYE, eye) : eyeP;
  void finC;
  return { head: [eyeP[0], eyeP[1] - 8], eye: ep };
}

export const MOONFIN: SpeciesDef = {
  name: 'Moonfin Porpoise', kind: 'mammal', len: L, height: 12,
  anims: ANIMS,
  canvas: () => ({ w: 64, h: 60, ox: 32, oy: 30 }),
  draw(sk, anim, frame, eye) {
    const n = ANIMS[anim]?.frames ?? 1;
    return drawMoonfin(sk, mats(sk), pose(anim, frame, n), eye);
  },
  eyeFor: () => 'open',
  anchor: Object.fromEntries(Object.keys(ANIMS).map(a => [a, 'centre'])) as Record<string, 'centre'>,
};

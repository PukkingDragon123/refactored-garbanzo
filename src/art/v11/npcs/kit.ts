// V11 NPCs: shared bits for the new people of Zealandia (rangers, the Helix team, hunters, the
// craftspeople, the naturalist). Each person is a V7 rig character (body, head, own idle / walk clips)
// registered at runtime into the cast tables (register.ts); this file holds the palettes, a few head
// pieces (brimmed hats, beards, spectacles) and the small things they hold (binoculars, a tablet, a
// chisel, a magnifier on a stick, a bug jar, a strip of flax).

import { hex } from '../../color';
import type { C } from '../../color';
import { cel, Ramp6, Scene3D, V3, Hit, vadd, vsc, vnorm, vsub, vcross } from '../../v7/raster';
import type { Part } from '../../v7/body';
import type { HeadOpts7 } from '../../v7/head';
import type { Build } from '../../people-rig';
import { HELD7 } from '../../v7/held';

export const R6 = (...h: string[]): Ramp6 => h.map(v => hex(v));
export const L = (p: Part) => p.hit.l;
/** far limbs sit in the body's shadow */
export const lb = (p: Part) => (p.near ? 0 : -0.28);
export const frac = (v: number) => v - Math.floor(v);
export const smooth = (u: number) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
/** 0 → 1 → 0 over [a, b] with eased ramps of width w */
export const bump = (t: number, a: number, b: number, w: number) => smooth((t - a) / w) * (1 - smooth((t - (b - w)) / w));
export const K = (b: Build) => b.torso / 15;
export const TAU = Math.PI * 2;

// ------------------------------------------------------------------ skins
export const SKIN = {
  /** warm brown (Hine, Tīpene, Ngaio, Rua) */
  brown: R6('#2a140c', '#5a3020', '#7c482e', '#a0663e', '#bd8255', '#d79e70'),
  brownDeep: R6('#22100a', '#4a2618', '#683c26', '#8a5634', '#a66e48', '#c28a60'),
  /** Pacific brown (Sunny) */
  pacific: R6('#26120a', '#52301c', '#74482a', '#96603a', '#b47a50', '#cc966a'),
  /** fair, freckly, sunburnt (Doug, Rosie, Teo) */
  fair: R6('#3a1810', '#a8564a', '#d68e74', '#f4b896', '#fad2b4', '#ffe8d4'),
  /** olive (Celeste) */
  olive: R6('#2e1a12', '#7a4e3a', '#b07e60', '#d8a684', '#e8bea0', '#f6dcc4'),
  /** pale and papery (Marge) */
  pale: R6('#3a2420', '#a07a70', '#cca496', '#ecccbc', '#f6e0d4', '#fff4ec'),
};

// ------------------------------------------------------------------ cloth
export const CL = {
  khaki: R6('#1c1a0c', '#3c3a1e', '#5e5a32', '#7e7a48', '#9a9660', '#b6b27e'),
  ranger: R6('#0e1408', '#1e2a12', '#30401c', '#44582a', '#5a703a', '#76904e'),
  tan: R6('#24180c', '#4e3a20', '#76583a', '#9a7a52', '#b8986a', '#d4b888'),
  denim: R6('#080c16', '#141e34', '#22304e', '#34466a', '#4a5e86', '#6a7ea4'),
  navy: R6('#05070e', '#0e1222', '#181e34', '#242c48', '#323c5c', '#465274'),
  white: R6('#3a3e44', '#7c828a', '#b0b6bc', '#dce0e4', '#eef0f2', '#ffffff'),
  yellow: R6('#2a2006', '#6a5410', '#b08c14', '#e0b41e', '#f4d040', '#fff080'),
  charcoal: R6('#060608', '#101014', '#1c1c22', '#2a2a32', '#3a3a44', '#4e4e5a'),
  grey: R6('#1a1c1e', '#36393c', '#52565a', '#6e7378', '#8c9196', '#aeb3b8'),
  olive: R6('#0c0e06', '#1e2410', '#30381a', '#444e26', '#5a6634', '#748248'),
  blueCheck: R6('#04080e', '#0c1a2c', '#16304e', '#22466e', '#325e8e', '#4a7aac'),
  red: R6('#2a0606', '#5e0e0c', '#8e1c16', '#b82c22', '#d8483a', '#f07060'),
  mustard: R6('#2a1c04', '#5e400a', '#8e6412', '#ba8a1e', '#d6a838', '#eec662'),
  rust: R6('#200a04', '#4a1a0a', '#743014', '#9a4620', '#b85e30', '#d47e48'),
  leather: R6('#140a06', '#301a10', '#4a2a1a', '#643a24', '#7e4e32', '#9a6646'),
  boot: R6('#0c0607', '#2a1612', '#3e2218', '#583224', '#744434', '#8e5a44'),
  black: R6('#050506', '#0c0d10', '#16181c', '#212429', '#2e3238', '#40454d'),
  rubberRed: R6('#200404', '#4a0a08', '#781410', '#a0201a', '#c43228', '#e05444'),
  flax: R6('#2a1e0c', '#5a4418', '#86692a', '#b08e40', '#caa85a', '#e4c67c'),
  net: R6('#04121a', '#0a2a3a', '#14465e', '#226282', '#3680a2', '#5aa2c0'),
  cream: R6('#5a5040', '#8a8068', '#b8ae92', '#efe4cc', '#fff6e0', '#ffffff'),
  stripe: R6('#2a0e04', '#6a2a0a', '#a04414', '#c05a1c', '#e8782e', '#ffa860'),
  wool: R6('#1a1a1c', '#3a3a3e', '#5a5a60', '#7c7c82', '#9c9ca2', '#c0c0c6'),
  brass: R6('#2a1a06', '#5a3a10', '#8a6220', '#b88a34', '#d8ac50', '#f6d888'),
  steel: R6('#1a1e22', '#3a4248', '#5e6a72', '#8a969e', '#b4c0c6', '#e6eef2'),
  wood: R6('#1c1008', '#3e2614', '#5e3c20', '#7e5530', '#9a6e42', '#b88a58'),
  glass: R6('#0a1a14', '#1a3a2c', '#2a6a4c', '#4a9a70', '#7ac8a0', '#c8f4dc'),
};

// ------------------------------------------------------------------ hair
export const HAIR = {
  black: R6('#060304', '#140c0a', '#221410', '#321e18', '#4a2e24', '#6a4434'),
  greyBlack: R6('#1a1a1c', '#2e2c2e', '#48464a', '#646266', '#8a888c', '#b0aeb2'),
  white: R6('#5a5452', '#8a8480', '#b8b2ac', '#dcd6ce', '#f0ebe4', '#ffffff'),
  ginger: R6('#2a0e04', '#5a2410', '#8a3e1c', '#b4582c', '#d07a44', '#e8a068'),
  gingerGrey: R6('#3a2a24', '#6a4a3a', '#946a52', '#b48c70', '#ccac90', '#e4ccb4'),
  blond: R6('#3a2a10', '#7a5a24', '#ae8a3e', '#d4b05c', '#ead07e', '#f8eaa8'),
  raven: R6('#020206', '#08080e', '#121220', '#1e1e32', '#2e2e4a', '#464668'),
  brown: R6('#120806', '#2a160e', '#422418', '#5a3424', '#744634', '#905c46'),
};

// ------------------------------------------------------------------ head pieces

type W3 = (p: V3) => V3;
export type HeadPiece = (s: Scene3D, W: W3, o: HeadOpts7) => void;

/**
 * A brimmed hat: a crown (ellipsoid, flattened top or a pinched ranger crease) over a flat brim.
 * y: brim height (head space), r: brim radius, crown: [height, radius], tilt: forward pitch of the brim.
 */
export function brimHat(o: { y: number; r: number; crown: [number, number]; col: Ramp6; band?: Ramp6 | C; tilt?: number; droop?: number; pinch?: boolean; x?: number; g?: number }): HeadPiece {
  return (s, W) => {
    const g = o.g ?? 12, x0 = o.x ?? 0.2;
    const [ch, cr] = o.crown;
    // the crown
    s.ellipsoid(W([x0 - 0.2, o.y + ch * 0.55, 0]), W([cr, 0, 0]), W([0, ch * 0.62, 0]), W([0, 0, cr * 0.98]), g, h => {
      if (h.q[1] < -0.2) return -1;
      if (o.pinch && h.q[1] > 0.55 && Math.abs(h.q[2]) < 0.18) return cel(o.col, h.l, -0.45);
      if (o.band && h.q[1] < 0.12) return typeof o.band === 'number' ? o.band : cel(o.band, h.l, 0);
      return cel(o.col, h.l, 0.05);
    });
    // the brim: a thin disc, tipped forward, the edge drooping a touch
    const t = o.tilt ?? 0.1, dr = o.droop ?? 0;
    const fx = vnorm([Math.cos(t), -Math.sin(t), 0]), up = vnorm([Math.sin(t), Math.cos(t), 0]);
    s.ellipsoid(W([x0 + 0.3, o.y, 0]), W(vsc(fx, o.r)), W(vsc(up, 0.42 + dr)), W([0, 0, o.r * 0.94]), g + 1, h => (h.q[1] < -0.3 ? cel(o.col, h.l, -0.55) : cel(o.col, h.l, -0.05)));
  };
}

/** a beard: cheeks, jaw and chin wrapped in a fuzzy mass; `long` drops it toward the chest */
export function beard(col: Ramp6, o: { long?: number; moustache?: boolean; goatee?: boolean; w?: number } = {}): HeadPiece {
  return (s, W) => {
    const w = o.w ?? 1;
    const m = (h: Hit) => { const curl = Math.sin(h.x * 1.9 + h.y * 1.1) > 0.7; return curl ? col[2] : cel(col, h.l, 0.12); };
    if (o.goatee) {
      s.ellipsoid(W([3.4, 2.0, 0]), W([1.6, 0, 0]), [0, 2.2, 0], W([0, 0, 1.5]), 10, m);
    } else {
      s.ellipsoid(W([2.2, 3.4, 0]), W([3.6 * w, 0, 0]), [0, 3.2, 0], W([0, 0, 4.4 * w]), 10, m);
      s.ellipsoid(W([2.8, 1.2 - (o.long ?? 0) * 0.5, 0]), W([3.2 * w, 0, 0]), [0, 2.8 + (o.long ?? 0), 0], W([0, 0, 3.4 * w]), 10, m);
    }
    if (o.moustache !== false) s.ellipsoid(W([4.9, 4.4, 0]), W([1.2, 0, 0]), [0, 0.8, 0], W([0, 0, 2.4]), 11, h => cel(col, h.l, 0.22));
  };
}

/** round spectacles: two rims at the eyes and a bridge (head space eye point) */
export function specs(eye: V3, col: Ramp6, o: { r?: number; sun?: boolean } = {}): HeadPiece {
  return (s, W) => {
    const r = o.r ?? 1.25;
    for (const z of [eye[2], -eye[2]]) {
      const c: V3 = [eye[0] + 0.55, eye[1], z];
      if (o.sun) { s.ellipsoid(W(c), W([0.35, 0, 0]), W([0, r * 0.85, 0]), W([0, 0, r * 1.05]), 13, h => cel(CL.black, h.l, h.q[1] > 0.3 ? 0.4 : 0, true)); continue; }
      for (let i = 0; i < 10; i++) {
        const a0 = (i / 10) * TAU, a1 = ((i + 1) / 10) * TAU;
        s.limb(W(vadd(c, [0, Math.sin(a0) * r, Math.cos(a0) * r])), W(vadd(c, [0, Math.sin(a1) * r, Math.cos(a1) * r])), 0.2, 0.2, 13, h => cel(col, h.l, 0.1));
      }
    }
    s.limb(W([eye[0] + 0.8, eye[1] + 0.2, eye[2] - r]), W([eye[0] + 0.8, eye[1] + 0.2, -eye[2] + r]), 0.2, 0.2, 13, h => cel(col, h.l, 0.1));
  };
}

// ------------------------------------------------------------------ held objects

const plainM = (r: Ramp6, bias = 0, shine = false) => (h: Hit) => cel(r, h.l, bias, shine);
const GH = 54;
const UP: V3 = [0, 1, 0];

/** binoculars: raised to the eyes in both hands (v 1) or hanging at the chest on a strap (held only when raised) */
HELD7.binoculars = (s, J, _P, _ch, hN, hF) => {
  const a = hN ? hN.palm : J.wrN, b = hF ? hF.palm : J.wrF;
  const c = vadd(vadd(a, b), [0, 0, 0]).map(v => v / 2) as V3;
  const fw = J.fwd;
  for (const sd of [-1, 1]) {
    const o = vadd(c, vsc(J.lat, sd * 1.05));
    s.solid('cyl', vadd(o, vsc(fw, 0.6)), vsc(UP, 0.95), vsc(J.lat, 0.95), vsc(fw, 1.9), GH, h => (h.t === 2 && h.q[2] > 0 ? hex('#3a6a8a') : cel(CL.black, h.l, 0.1, true)));
  }
};
/** a tablet in the far hand, screen up toward her, the near hand tapping it */
HELD7.tablet = (s, J, P, _ch, hN, hF) => {
  const base = hF ? hF.palm : J.wrF;
  const c = vadd(base, vadd(vsc(UP, 1.2), vsc(J.fwd, 0.6)));
  const tilt = vnorm(vadd(vsc(UP, 0.75), vsc(J.fwd, -0.66)));
  const along = vnorm(vcross(tilt, J.lat));
  s.solid('box', c, vsc(along, 2.6), vsc(tilt, 0.3), vsc(J.lat, 1.9), GH, h => {
    if (h.t === 1 && h.q[1] > 0) {
      const glow = (P.held?.t ?? 0) * 6;
      return Math.abs(h.q[0]) < 0.82 && Math.abs(h.q[2]) < 0.8 ? hex(frac(h.q[0] * 2 + glow) < 0.3 ? '#9ae8ff' : '#3aa0d8') : hex('#e8e8ea');
    }
    return cel(CL.white, h.l, 0.1);
  });
  void hN;
};
/** a carving chisel in the near fist, the blade up */
HELD7.chisel = (s, J, _P, _ch, hN) => {
  if (!hN) return;
  const g = hN.grip;
  const dir = vnorm(vadd(vsc(hN.d, 0.2), vadd(vsc(UP, 1), vsc(J.fwd, 0.35))));
  s.limb(vsub(g, vsc(dir, 1.6)), vadd(g, vsc(dir, 1.6)), 0.55, 0.5, GH, plainM(CL.wood, 0.05));
  s.limb(vadd(g, vsc(dir, 1.6)), vadd(g, vsc(dir, 4.4)), 0.3, 0.24, GH + 1, plainM(CL.steel, 0.25, true));
};
/** a walking stick with a brass magnifier at its head: planted on the ground, or lifted to an eye (v 1) */
HELD7.magnifier = (s, J, P, _ch, hN) => {
  if (!hN) return;
  const g = hN.grip, up = (P.held?.v ?? 0) > 0.5;
  const dir: V3 = up ? vnorm(vadd(vsc(J.fwd, 0.25), UP)) : vnorm(vadd(vsc(J.fwd, 0.18), [0, -1, 0]));
  const len = up ? 4.5 : 22;
  const end = vadd(g, vsc(dir, up ? len : Math.max(4, g[1] - 0.5)));
  s.limb(vsub(g, vsc(dir, up ? 9 : 1.5)), up ? vsub(g, vsc(dir, 0.2)) : end, 0.42, 0.36, GH, plainM(CL.wood, 0.05));
  // the lens on top of the stick (above the hand when walking, at the eye when looking)
  const top = up ? vadd(g, vsc(dir, 2.2)) : vsub(g, vsc(dir, 2.4));
  s.limb(up ? vadd(g, vsc(dir, 0)) : vsub(g, vsc(dir, 1.4)), top, 0.3, 0.3, GH, plainM(CL.brass, 0.2, true));
  s.ellipsoid(vadd(top, vsc(up ? dir : [0, 1, 0], 1.1)), vsc(J.fwd, 0.4), vsc(UP, 1.2), vsc(J.lat, 1.2), GH + 1, h => (Math.hypot(h.q[1], h.q[2]) > 0.72 ? cel(CL.brass, h.l, 0.2, true) : hex(h.l > 0.4 ? '#e8f6ff' : '#9ac4dc')));
};
/** a jam jar with a bug in it, held up close to the face in both hands */
HELD7.bugjar = (s, J, P, _ch, hN, hF) => {
  const a = hN ? hN.palm : J.wrN, b = hF ? hF.palm : J.wrF;
  const c: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.6, (a[2] + b[2]) / 2];
  s.solid('cyl', c, vsc(J.fwd, 1.25), vsc(J.lat, 1.25), vsc(UP, 1.6), GH, h => {
    if (h.t === 2 && h.q[2] > 0) return cel(CL.red, h.l, 0.1);
    const bug = Math.hypot(h.q[0] - Math.sin((P.held?.t ?? 0) * TAU) * 0.3, h.q[2] + 0.1) < 0.35 && h.t === 1;
    return bug ? hex('#3a8a3a') : cel(CL.glass, h.l, 0.35, true);
  });
};
/** a strip of flax between the fingers, being plaited */
HELD7.flaxstrip = (s, J, P, _ch, hN, hF) => {
  const a = hN ? hN.grip : J.wrN, b = hF ? hF.grip : J.wrF;
  const t = (P.held?.t ?? 0) * TAU;
  const m: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 1.4, (a[2] + b[2]) / 2];
  for (let i = 0; i < 3; i++) {
    const off = Math.sin(t + i * 2.1) * 0.5;
    s.limb(vadd(a, [0, -0.2, i * 0.2]), vadd(m, [off, -2.4, 0.3]), 0.3, 0.28, GH, h => cel(CL.flax, h.l, i === 1 ? 0.15 : -0.05));
    s.limb(vadd(b, [0, -0.2, i * 0.2]), vadd(m, [off, -2.4, 0.3]), 0.3, 0.28, GH, h => cel(R6('#081008', '#14260e', '#24401a', '#386028', '#52803a', '#7aa458'), h.l, i === 1 ? 0.15 : -0.05));
  }
};
/** a whittling knife and a stick (the hunter's idle) */
HELD7.whittle = (s, J, P, _ch, hN, hF) => {
  if (!hN || !hF) return;
  const t = (P.held?.t ?? 0) * TAU;
  const st = hF.grip, d = vnorm(vadd(J.fwd, [0, 0.5, 0]));
  s.limb(vsub(st, vsc(d, 1.2)), vadd(st, vsc(d, 5)), 0.48, 0.4, GH, h => (h.t > 0.75 ? cel(CL.cream, h.l, 0.1) : cel(CL.wood, h.l, 0.05)));
  const k = hN.grip, kd = vnorm(vadd(vsc(d, 1), [0, -0.3 + Math.sin(t) * 0.2, 0]));
  s.limb(k, vadd(k, vsc(kd, 2.6)), 0.25, 0.12, GH + 1, plainM(CL.steel, 0.3, true));
};

// Periscope Octopus: a rock-pool octopus in a suit of armour. Its mantle is plated with overlapping
// shell scutes grown from its own skin, crusted with pink coralline and the odd barnacle, so that
// pulled down in its pool it is just another rock. Its eyes sit on long retractable stalks it raises
// out of the water like periscopes while the rest of it stays hidden; it hunts crabs on the rim with a
// long arm and, cornered, flashes rings of electric blue across its skin.
//
// Painted on the Relief layer (beasts-relief): the mantle is one lumpy, rock-like contour; its armour
// is rows of overlapping scutes laid like roof tiles over the dome (each tile rises to a lit free edge
// that throws a shadow on the row behind it, with growth lines across it), crusted with knobbly pink
// coralline and two volcano-shaped barnacles with dark slits. Under its front lip sits the soft head
// (orange-red skin, mottled, with the funnel), and from it rise the eyestalks: ringed soft stalks,
// each ending in a golden eye with a dark bar pupil under a heavy lid. The arms are each one tapering
// contour (thick at the web, a curled tip), lined with a row of pale sucker cups along the under edge;
// the hunting arm snakes along the rim. The flash puts black-edged electric blue rings over the skin
// between the plates and down the arms.
//
// Faces right, anchored on the water surface of its pool: anything below y = 0 is under water (the
// game draws that part tinted). Anims: hide, periscope, peek, reach, flash.

import { Sk, V2, rmp, BeastEye, SpeciesDef, TAU, hh } from '../../beasts-core';
import { Relief, Sp, Tx, LM, spline, cell, W as WC } from '../../beasts-relief';
import { hex } from '../../color';
import { strip } from '../wild/contour';
import { arcs, onPath, atPath, frac, stamp } from './shore-kit';

const A = (frames: number, fps: number, loop = true) => ({ frames, fps, loop });
const ANIMS = { hide: A(2, 1), periscope: A(4, 3), peek: A(4, 3), reach: A(6, 7), flash: A(4, 8), idle: A(4, 3) };

interface P {
  rise: number;        // mantle top above the water (px)
  stalk: number;       // eyestalk length above the head (px)
  look: number;        // eyestalk swivel -1..1
  drape: number;       // arms draped over the rim 0..1
  reach: number;       // hunting arm extension 0..1
  grab: number;        // arm tip curled 0..1
  rings: number;       // blue ring flash 0..1
  spread: number;      // arms spread wide (threat)
  breathe: number;
  prey: boolean;
}
function pose(anim: string, f: number, n: number): P {
  const t = f / n, s = Math.sin(t * TAU);
  const p: P = { rise: 4, stalk: 2, look: 0, drape: 0.6, reach: 0, grab: 0, rings: 0, spread: 0, breathe: s, prey: false };
  switch (anim) {
    case 'hide': p.rise = 2.5 + f * 0.3; p.stalk = 0; p.drape = 0; break;
    case 'periscope': p.rise = 1.4; p.stalk = 7 + Math.abs(s) * 0.8; p.look = [0, 1, 0, -1][f]; p.drape = 0; break;
    case 'idle':
    case 'peek': p.rise = 7 + s * 0.4; p.stalk = 4 + (f === 2 ? 1 : 0); p.look = [0, 0.4, 0, -0.5][f]; p.drape = 1; break;
    case 'reach': {
      const K = [0.2, 0.55, 0.9, 1, 0.7, 0.3][f];
      p.rise = 6.5; p.stalk = 4.5; p.drape = 0.8; p.reach = K; p.grab = f >= 3 ? 1 : 0; p.look = 0.6; p.prey = f >= 3 && f <= 5;
      break;
    }
    case 'flash': p.rise = 8.5; p.stalk = 5; p.drape = 0.4; p.spread = 1; p.rings = f % 2 ? 1 : 0.35; p.look = f % 2 ? 0.2 : -0.2; break;
  }
  return p;
}

const ID = { FARARM: 1, MANTLE: 2, HEAD: 3, BARN: 4, ARM: 5, STALK: 6, EYE: 7, CRAB: 8 };
const C = {
  ring: hex('#36d8ff'), ringL: hex('#b4f4ff'), ringK: hex('#0a1a3a'),
  pupil: hex('#140e08'), wet: hex('#fff8e0'), slit: hex('#2a2420'),
  crabEye: hex('#140e10'),
};

function draw(sk: Sk, anim: string, frame: number, _eye: BeastEye, juv: boolean) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const P = pose(anim, frame, n);
  const k = juv ? 0.7 : 1;
  const M = {
    plate: sk.m(rmp('#a8957a', { n: 7, dark: 0.62, light: 0.42, cool: 0.25, warm: 0.15 }), { edge: 1 }),
    plateD: sk.m(rmp('#6e5c4c', { n: 6, dark: 0.6, light: 0.35, cool: 0.2 }), { edge: 1 }),
    coral: sk.m(rmp('#c86e86', { n: 6, dark: 0.5, light: 0.45, cool: 0.1 }), { edge: 1 }),
    coralL: sk.m(rmp('#f0b4c0', { n: 4, dark: 0.35, light: 0.35 }), { edge: 1 }),
    barn: sk.m(rmp('#e4dccc', { n: 5, dark: 0.45, light: 0.35 }), { edge: 1 }),
    skin: sk.m(rmp('#b8482a', { n: 7, dark: 0.6, light: 0.45, cool: 0.15, warm: 0.15 }), { edge: 1 }),
    skinD: sk.m(rmp('#7a2a1c', { n: 5, dark: 0.55, light: 0.35 }), { edge: 1 }),
    sucker: sk.m(rmp('#f0c4a2', { n: 4, dark: 0.4, light: 0.35 }), { edge: 1 }),
    eye: sk.m(rmp('#e2b236', { n: 5, dark: 0.45, light: 0.45, warm: 0.2 }), { edge: 1 }),
    crab: sk.m(rmp('#dceaec', { n: 4, dark: 0.35, light: 0.4 }), { edge: 1 }),
  };
  // the mantle: a lumpy armoured dome, its top `rise` px above the water
  const MW = 8 * k, MH = 6.6 * k;
  const cx = -1 * k, cy = -P.rise + MH * (1 + P.breathe * 0.02);
  const mp = (x: number, y: number, sh = 0): LM => [cx + x * k, cy + y * k, sh];
  const mantle: LM[] = [
    mp(7.4, 1.6), mp(8.1, -1.3), mp(6.7, -4.4), mp(3.6, -6.2), mp(0.4, -6.7), mp(-3.4, -6.1, 0.2), mp(-6.2, -4.4),
    mp(-7.9, -1.6), mp(-8.3, 1.4), mp(-6.4, 4.6), mp(-2, 6.2), mp(2.6, 6), mp(6.2, 4.2),
  ];
  // the head under the front lip, the eyestalk roots on its top
  const hx = cx + 7.2 * k, hy = cy + 0.6 * k;
  const head: LM[] = [[hx - 3.2 * k, hy - 2.4 * k, 0], [hx + 0.4 * k, hy - 3.1 * k, 0], [hx + 3.2 * k, hy - 1.4 * k, 0], [hx + 3.6 * k, hy + 1.4 * k, 0], [hx + 1 * k, hy + 3.4 * k, 0], [hx - 2.6 * k, hy + 3 * k, 0]];

  /** soft skin: mottled orange-red, the blue rings in a flash */
  const skinTex = (p: Sp, o: Tx) => {
    const m = hh(p.x / 2, p.y / 2, 61);
    o.m = m < 0.25 ? M.skinD : M.skin;
    o.z += (hh(p.x, p.y, 63) - 0.5) * 0.35;
  };

  // ---------------------------------------------------------------- arms
  type Arm = { pts: V2[]; w0: number };
  const armPath = (x0: number, y0: number, a0: number, len: number, curl: number, rim: boolean): V2[] => {
    const pts: V2[] = [[x0, y0]];
    let a = a0, x = x0, y = y0;
    const N = 12;
    for (let i = 0; i < N; i++) {
      const u = i / N;
      a += curl * u * u * 0.16;
      x += Math.cos(a) * len / N; y += Math.sin(a) * len / N;
      if (rim && i > 2) y = Math.min(y, -0.8 + Math.sin(u * 7) * 0.3); // lies along the rim above the water
      pts.push([x, y]);
    }
    return pts;
  };
  const armOf = (pts: V2[], w0: number): Arm => ({ pts, w0 });
  const paintArm = (R: Relief, A: Arm, z: number, id: number) => {
    const wU = (t: number) => (A.w0 * Math.pow(1 - t, 0.85) + 0.35) * k;
    const poly = strip(A.pts, wU, wU, { capA: 1, capB: 1 });
    const cum = arcs(A.pts);
    R.region(poly, {
      z, R: 1.2 * k, H: 1.6 * k, id, tex: (p, o) => {
        const q = onPath(A.pts, cum, p.x, p.y);
        const w = wU(q.t);
        skinTex(p, o);
        // the sucker row along the under edge (screen-lower side), bigger toward the web
        const under = -q.ax * q.c > w * 0.3 || (Math.abs(q.ax) < 0.4 && q.ay * q.c > w * 0.3);
        if (under && q.t > 0.06) {
          const per = Math.max(1.4, 2.4 * (1 - q.t * 0.55)) * k;
          const f = frac(q.s / per);
          if (f < 0.55) { o.m = M.sucker; o.z += f < 0.3 ? 0.3 : -0.2; if (f > 0.38) o.t -= 0.15; else o.t += 0.05; }
        }
      },
    });
    return { poly, cum };
  };
  const rings: V2[] = [];

  // the far arms, draped back over the rim behind the mantle
  {
    const R = Relief.full(sk);
    if (P.drape > 0) {
      const L1 = (17 + P.spread * 3) * P.drape * k, L2 = (13 + P.spread * 2) * P.drape * k;
      const a1 = armOf(armPath(cx - 3 * k, cy + 1 * k, Math.PI - 0.3 + P.spread * 0.6, L1, 2.6 + P.spread * 0.4, true), 1.9);
      const a2 = armOf(armPath(cx + 0 * k, cy + 2 * k, Math.PI - 0.15 + P.spread * 0.9, L2, 3.6, true), 1.7);
      paintArm(R, a1, -6, ID.FARARM); paintArm(R, a2, -7, ID.FARARM);
      if (P.rings > 0.3) for (const a of [a1, a2]) for (const i of [4, 8]) rings.push(a.pts[i]);
    }
    sk.np();
    R.emit({ bias: -0.12, drop: 1.4, seam: 0.5, seamDark: 0.3 });
  }

  // ---------------------------------------------------------------- the mantle, its armour, the head
  const BR = Relief.full(sk);
  BR.region(spline(head, 0.5), { z: 2 * k, R: 2 * k, H: 3 * k, id: ID.HEAD, tex: skinTex });
  // the funnel (siphon) under the head
  { const f0: V2 = [hx + 1.6 * k, hy + 2.2 * k]; BR.cap(f0, [f0[0] + 2.2 * k, f0[1] + 0.8 * k], 1.1 * k, 0.8 * k, { z: 3 * k, id: ID.HEAD, tex: skinTex }); }
  // the mantle's soft skin under the armour (only seen in the seams between the scutes)
  BR.region(spline(mantle, 0.5), { z: 0, R: 3 * k, H: 4.4 * k, id: ID.MANTLE, tex: (p, o) => { o.m = M.skinD; o.t -= 0.1; void p; }, pow: 0.85 });
  // the armour: scutes laid like roof tiles, each a shield whose free edge points back over the base
  // of the one behind it (front scutes on top); the free edges scallop the dome's outline
  // [x, y, length, width, tilt, crust, barnacle]
  const SC: [number, number, number, number, number, number, number][] = juv
    ? [[4.4, -2.6, 4, 4.6, 0.3, 0, 0], [4.6, 1.8, 3.6, 4, -0.2, 0, 0], [0.6, -4.2, 4.4, 4.4, 0.25, 1, 0], [0.8, 0.6, 4.4, 5, 0, 0, 0], [-3.6, -2.4, 4.4, 5, 0.1, 0, 1], [-3.8, 2.6, 4, 4.6, -0.15, 0, 0]]
    : [
      [-6.6, -2.8, 3.4, 4.2, 0.45, 0, 0], [-6.8, 1.6, 3.4, 4.4, -0.25, 0, 0],
      [-3.6, -5, 3.8, 3.6, 0.5, 0, 1], [-3.4, -1.2, 4, 4.2, 0.1, 1, 0], [-3.6, 3, 3.8, 4, -0.2, 0, 0],
      [0.4, -5.6, 3.8, 3.4, 0.35, 1, 0], [0.6, -2, 4, 4.2, 0.12, 0, 0], [0.4, 2.4, 4, 4.2, -0.15, 0, 0],
      [4.2, -4.4, 3.6, 3.6, 0.55, 0, 1], [4.4, -0.8, 3.6, 4, 0.1, 0, 0], [4.2, 3, 3.4, 3.6, -0.3, 1, 0],
    ];
  const barn: V2[] = [];
  SC.forEach(([sx, sy, len, wid, tilt, crust, bar], i) => {
    const o: V2 = [cx + sx * k, cy + sy * k];
    const ca = Math.cos(Math.PI + tilt), sa = Math.sin(Math.PI + tilt);       // pointing back (free edge)
    const sp = (u: number, v: number, sh = 0): LM => [o[0] + (ca * u - sa * v) * k, o[1] + (sa * u + ca * v) * k, sh];
    const L = len, Wd = wid / 2, j = (q: number) => (hh(i, q, 81) - 0.5) * 0.5;
    // the shield: a narrow base tucked under the scute in front, a broad rounded free edge behind
    const sh: LM[] = [sp(-L * 0.45, -Wd * 0.55), sp(L * 0.15, -Wd * (1 + j(1) * 0.2)), sp(L * 0.5, -Wd * 0.75 + j(2)), sp(L * 0.62 + j(3), 0, 0.15), sp(L * 0.5, Wd * 0.75 + j(4)), sp(L * 0.15, Wd * (1 + j(5) * 0.2)), sp(-L * 0.45, Wd * 0.55)];
    const zt = (sx + 8) * 0.5 * k;
    BR.region(spline(sh, 0.4), {
      z: 2 * k + zt, R: 1.3 * k, H: 1.8 * k, id: 10 + i, tex: (p, q) => {
        const dx = (p.x - o[0]) / k, dy = (p.y - o[1]) / k;
        const u = dx * ca + dy * sa;                       // toward the free edge
        q.m = M.plate;
        q.z += u * 0.22;                                   // the free edge lifts
        if (u > L * 0.42 && p.s < 1.4) q.t += 0.1;        // its lit rim
        else if (frac(u * 0.75) < 0.2 && u > -L * 0.3) q.t -= 0.07; // growth lines parallel to it
        if (p.s < 0.8 && u < 0) q.m = M.plateD;            // the dark base edge
        if (crust) {
          // knobbly pink coralline over the middle of the scute
          cell(p.x, p.y, 1.5, 1.4, 73 + i, 0.9);
          if (Math.hypot(u - L * 0.05, (-dx * sa + dy * ca) * 0.9) < Wd * 0.75) { q.m = WC.f1 < 0.42 ? M.coralL : M.coral; q.z += WC.f1 < 0.45 ? 0.35 : 0; }
        }
        if (p.y > 0.5) q.t -= 0.06;                         // under the water line: darker, slimed
      },
    });
    if (bar) barn.push(sp(L * 0.05, 0) as unknown as V2);
  });
  // the barnacles: little volcanoes with a dark slit
  for (const b of barn) {
    const sh: LM[] = [[b[0] - 1.6, b[1] + 0.8, 0], [b[0] - 0.9, b[1] - 1, 0], [b[0] + 0.9, b[1] - 1.1, 0], [b[0] + 1.6, b[1] + 0.7, 0]];
    BR.region(spline(sh, 0.4), { z: 9.5 * k, R: 1, H: 1.4, id: ID.BARN, tex: (p, o) => { o.m = M.barn; if (Math.abs(p.x - b[0]) < 0.6 && p.y < b[1]) { o.z -= 1; o.t -= 0.2; } } });
  }
  for (let i = 0; i < SC.length; i++) BR.shadow(10 + i, 0.7, 0.9, 0.12, 0, 1);
  BR.shadow(ID.MANTLE, 0.8, 1.2, 0.14, ID.HEAD, 1);
  sk.np();
  BR.emit({ drop: 2, seam: 0.5, seamDark: 0.34, ao: 0.08, aoR: 2 });
  for (const b of barn) sk.overPaint(b[0], b[1] - 0.5, C.slit);
  if (P.rings > 0.3) for (const [rx, ry] of [[-5.2, -0.6], [-1.6, -3.4], [2.4, 0.4], [6.2, -2.4]] as V2[]) rings.push([cx + rx * k, cy + ry * k]);
  if (P.rings > 0.3) rings.push([hx + 1.5 * k, hy + 0.5 * k]);

  // ---------------------------------------------------------------- the eyestalks (periscopes)
  let eyeP: V2 = [hx, hy - 4];
  for (const side of [-1, 1]) {
    const b: V2 = [hx + (side * 1.3 - 0.4) * k, hy - 2.4 * k];
    const L = (1.2 + P.stalk) * k;
    const a = -Math.PI / 2 + side * 0.3 + P.look * 0.25;
    const e: V2 = [b[0] + Math.cos(a) * L, b[1] + Math.sin(a) * L];
    const mid: V2 = [b[0] + Math.cos(a) * L * 0.5 - P.look * 0.4, b[1] + Math.sin(a) * L * 0.5];
    const R = Relief.full(sk);
    const z = side > 0 ? 9 : 4;
    if (L > 1.5) {
      const path: V2[] = [b, mid, e];
      const cum = arcs(path);
      const w = (t: number) => (0.95 - t * 0.2) * k;
      R.region(strip(path, w, w, { capA: 1, capB: 0.5 }), { z, R: 0.8, H: 1.1, id: ID.STALK, tex: (p, o) => { skinTex(p, o); if (frac(onPath(path, cum, p.x, p.y).s / 1.5) < 0.3) o.z -= 0.35; } });
    }
    // the eye: a golden ball on the stalk's tip, under a heavy lid
    const er = (juv ? 1.3 : 1.7) * k;
    const eb: LM[] = [];
    for (let i = 0; i < 8; i++) { const q = (i / 8) * TAU; eb.push([e[0] + Math.cos(q) * er * 1.1, e[1] - 0.5 + Math.sin(q) * er, 0]); }
    R.region(spline(eb, 0.4), { z: z + 1, R: 1.2, H: 1.6, id: ID.EYE, tex: (p, o) => { o.m = p.y < e[1] - 0.5 - er * 0.55 ? M.skin : M.eye; } });
    sk.np();
    R.emit({ drop: 1.4, seam: 0.5, bias: side > 0 ? 0 : -0.1 });
    // the bar pupil, a wet highlight
    const px = Math.round(e[0] + P.look * 0.6 - 0.5), py = Math.round(e[1] - 0.5);
    for (let dx = -1; dx <= (juv ? 0 : 1); dx++) sk.overPaint(px + dx, py, C.pupil);
    sk.overPaint(px - 1, py - 1, C.wet);
    if (side > 0) eyeP = e;
  }

  // ---------------------------------------------------------------- near arms: the one along the rim, the hunter
  let tipE: V2 | null = null;
  {
    const R = Relief.full(sk);
    if (P.drape > 0) {
      const a3 = armOf(armPath(hx - 1 * k, hy + 2.8 * k, 0.25 - P.spread * 0.5, 9 * k, -2.2, true), 1.8);
      paintArm(R, a3, 6, ID.ARM);
      if (P.rings > 0.3) rings.push(a3.pts[4], a3.pts[8]);
    }
    if (P.reach > 0.05) {
      const pts: V2[] = [];
      const L = (5 + P.reach * 15) * k;
      for (let i = 0; i <= 12; i++) {
        const u = i / 12;
        const x = hx + 1 + u * L;
        let y = -1 - Math.sin(u * Math.PI) * 2.4 * k + Math.sin(u * 9 + P.reach * 4) * 0.5;
        if (u > 0.82 && P.grab) y -= (u - 0.82) * 14 * P.grab;
        pts.push([x, Math.min(-0.6, y)]);
      }
      paintArm(R, armOf(pts, 1.8), 12, ID.ARM);
      if (P.prey) {
        // a glass crab caught in the curled tip
        const e = pts[12];
        tipE = e;
        const cb: LM[] = [[e[0] - 2.4, e[1] - 1.4, 0], [e[0] - 1, e[1] - 3, 0], [e[0] + 1.2, e[1] - 3, 0], [e[0] + 2.2, e[1] - 1.4, 0], [e[0], e[1] - 0.4, 0]];
        R.region(spline(cb, 0.4), { z: 14, R: 0.8, H: 1.2, id: ID.CRAB, tex: M.crab });
      }
    }
    sk.np();
    R.emit({ drop: 1.4, seam: 0.5, seamDark: 0.3 });
  }
  if (tipE) { const [ex, ey] = tipE as V2; sk.over(ex - 1, ey - 3.6, C.crabEye); sk.over(ex + 1, ey - 3.6, C.crabEye); }
  // the flash: black-edged electric blue rings blink open over the skin and down the arms
  if (P.rings > 0.3) {
    const big = P.rings > 0.7;
    for (const r of rings) {
      if (r[1] > 0.5) continue;
      stamp(sk, r[0], r[1], big ? ['.k.', 'kLk', 'kBk', '.k.'] : ['.k.', 'kBk', '.k.'], { k: C.ringK, B: C.ring, L: C.ringL }, { ax: 1, ay: 1, onlyOpaque: true });
    }
  }
  void atPath;
  return { head: [eyeP[0], eyeP[1] - 2] as V2, eye: eyeP };
}

export const PERISCOPE: SpeciesDef = {
  name: 'Periscope Octopus', kind: 'mollusc', len: 14, height: 10,
  anims: ANIMS,
  canvas: () => ({ w: 56, h: 36, ox: 22, oy: 20 }),
  draw,
  eyeFor: () => 'open',
};

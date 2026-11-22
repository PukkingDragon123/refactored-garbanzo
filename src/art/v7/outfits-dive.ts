// V7 dive outfits (V12 Te Moana Rimurimu, the kelp-forest dive): what Mori wears under water.
//  wetsuit  Jenna's patched wetsuit (bpdata 'wetsuit'): black neoprene, sage panels down the flanks,
//           the arms and the legs (his field tunic's colour, so he still reads as Mori), a front zip
//           and a neck seal, and the patches: kelp sheet and inner-tube rubber, cross-stitched on with
//           yellow twine; ribbed knee pads; bare hands; neoprene booties
//  dive     the same suit and the full kit (the 'scuba' gate): the Kittiwake's old yellow cylinder on
//           his back on a black harness (stencilled band, chipped paint, a chrome valve and first
//           stage), a weight belt of lead blocks, the regulator hose over his shoulder, a gauge
//           console on its hose at his far hip, fanshell-ribbed fins on his feet, and on his head a
//           low-volume mask (rubber skirt, glass with a glint, the split strap round his hair) and the
//           regulator in his mouth
// The suit and the kit are drawn by the same z-buffered rasteriser as the body, so they foreshorten,
// overlap and get inked like the rest of the figure (outfits.ts registers them for Mori).

import { hex } from '../color';
import type { C } from '../color';
import { cel, vadd, vsc, vnorm, vsub, vcross } from './raster';
import type { Ramp6, Scene3D, V3, Hit } from './raster';
import type { Char7, Part, J3 } from './body';
import type { Pose } from '../people-rig';
import type { HeadDef7, HeadWear7 } from './head';
import { R6, PAL, GG, lb, tEll, tLimb, onStraps, hash2, wear } from './gear';

const L = (p: Part) => p.hit.l;
const frac = (v: number) => v - Math.floor(v);

const D = {
  // black neoprene, a cool blue-grey where the wet surface takes the light
  neo: R6('#050608', '#0c0e12', '#15181e', '#20252d', '#2e3540', '#4a5868'),
  // the sage of Mori's field tunic (cast.ts), on the panels
  sage: R6('#161a16', '#2e3830', '#4c5a50', '#6c7c6e', '#8e9e8c', '#b0bca8'),
  // the patches: a sheet of dried kelp, a slab of red-brown inner tube
  kelp: R6('#1a1606', '#3e360e', '#625618', '#8a7a26', '#ac9a36', '#d0c060'),
  tube: R6('#1e0806', '#46180c', '#702a16', '#984022', '#b85a32', '#d8804e'),
  // the cylinder's chipped yellow paint, the steel under it
  tank: R6('#2a1e04', '#6a4e08', '#b08812', '#e0b420', '#f4d040', '#fff4a0'),
  rust: R6('#1a0804', '#3e160a', '#5e2412', '#7e381c', '#9a5028', '#b46a3a'),
  // the fins: grey tender-floor rubber, orange fanshell ribs
  fin: R6('#08090a', '#15171a', '#22262a', '#323840', '#465058', '#66727c'),
  shell: R6('#2a1006', '#6a2a0c', '#b04e14', '#e07a26', '#f4a44a', '#ffd89a'),
  lead: R6('#14161a', '#2a2e34', '#40464e', '#585f68', '#727a84', '#a0a8b0'),
};
const TWINE = hex('#e8c860');
/** the near side of the body in world space (the 3/4 turn), for the panels down the outsides of the limbs */
const LAT: V3 = vnorm([-0.62, 0, 0.78]);
const outward = (p: Part) => {
  const n = p.hit.n, d = n[0] * LAT[0] + n[2] * LAT[2];
  return p.near ? d : -d;
};
/** wet neoprene: soft cel shading with a hard little sheen where it faces the light */
const neo = (l: number, bias = 0): C => (l + bias > 0.82 ? D.neo[5] : cel(D.neo, l, bias));

/** an irregular patch (u, v in its own frame, ~-1..1): kelp sheet or rubber, cross-stitched round the edge */
function patch(r: Ramp6, l: number, u: number, v: number, seed: number, bias = 0): C | null {
  const a = Math.atan2(v, u), rr = Math.hypot(u, v);
  // a torn, hand-cut outline
  const edge = 1 + Math.sin(a * 3 + seed) * 0.12 + Math.sin(a * 7 + seed * 2.3) * 0.07;
  if (rr > edge + 0.18) return null;
  if (rr > edge) {
    // the stitches over the seam: short yellow bars every few degrees
    return frac(a * 2.6 + seed) < 0.38 ? TWINE : neo(l, bias - 0.35);
  }
  // kelp: long veins; rubber: a scuffed matte sheet with a patch-glue rim
  const vein = r === D.kelp ? frac(u * 1.6 + v * 0.4 + seed) < 0.16 : rr > edge - 0.14;
  return cel(r, l, bias + (vein ? -0.32 : 0.04));
}

// ------------------------------------------------------------------ the suit
function wetsuitBody(base: Char7, kit: boolean): Char7 {
  const torso = (p: Part): C | -1 => {
    const l = L(p), hh = p.hh, f = p.f, z = p.z;
    // the weight belt (kit): black webbing, lead blocks, a steel quick-release buckle at the front
    if (kit && hh > 0.06 && hh < 0.17) {
      if (f > 1.6 && Math.abs(z - 0.3) < 0.9) return Math.abs(z - 0.3) > 0.62 || hh < 0.085 || hh > 0.145 ? cel(PAL.steel, l, 0.25, true) : cel(PAL.steel, l, -0.25);
      const blk = frac((Math.atan2(z, f) + 3.2) * 1.15);
      if (blk > 0.18 && blk < 0.42 && hh > 0.075 && hh < 0.155) return cel(D.lead, l, Math.abs(blk - 0.3) < 0.05 ? 0.2 : -0.05, true);
      return cel(PAL.webbing, l, hh < 0.08 || hh > 0.15 ? -0.3 : 0.05);
    }
    // the harness (kit): two black shoulder straps, chest strap with a buckle, a cummerbund
    if (kit) {
      if (onStraps(p, base, 0.72)) return Math.abs(hh - 0.66) < 0.03 ? cel(PAL.steel, l, 0.3, true) : cel(PAL.webbing, l, 0.08);
      if (f > 0.4 && Math.abs(hh - 0.66) < 0.022 && Math.abs(z) < base.shW * 0.52) return cel(PAL.webbing, l, -0.08);
      if (Math.abs(hh - 0.3) < 0.06 && f < 2.2 && Math.abs(z) > base.waist[1] * 0.55) return cel(PAL.webbing, l, Math.abs(hh - 0.3) > 0.045 ? -0.35 : 0);
    }
    // the neck seal: a thick rolled collar, lit on its rim
    if (hh > 0.93) return Math.abs(hh - 0.95) < 0.016 ? neo(l, 0.4) : neo(l, -0.08);
    // the front zip: steel teeth up the middle, the pull tab hanging at the top
    if (f > 1 && hh > 0.2 && hh < 0.93 && Math.abs(z) < 0.32) {
      if (hh > 0.85 && hh < 0.9 && Math.abs(z) < 0.22) return cel(PAL.steel, l, 0.4, true);
      return Math.abs(z) < 0.12 ? (Math.floor(hh * 70) % 2 ? cel(PAL.steel, l, 0.1) : cel(PAL.steel, l, -0.3)) : neo(l, -0.3);
    }
    // patches: a sheet of kelp over the near belly, a slab of inner tube high on the far chest
    if (f > 0) {
      const k = patch(D.kelp, l, (z - 1.9) / 1.15, (hh - 0.42) / 0.085, 1.3);
      if (k !== null) return k;
      const t = patch(D.tube, l, (z + 2.1) / 1.0, (hh - 0.64) / 0.07, 4.1);
      if (t !== null) return t;
    }
    // the sage panels: the yoke over the shoulders (a curved seam), and down each flank
    const yoke = 0.77 - Math.abs(z) * 0.035;
    if (hh > yoke) return Math.abs(hh - yoke) < 0.018 ? neo(l, -0.45) : cel(D.sage, l, 0.02);
    const side = Math.abs(z) - base.chest[1] * (0.62 + (1 - hh) * 0.08);
    if (side > 0 && f < 1.4) return side < 0.18 ? neo(l, -0.45) : cel(D.sage, l, -0.06);
    return neo(l);
  };
  // a sage panel down the outside of an arm or leg, seamed on both edges
  const stripe = (p: Part, base0: C): C => {
    const o = outward(p);
    if (o > 0.52 && o < 0.86) return Math.abs(o - 0.52) < 0.05 || Math.abs(o - 0.86) < 0.05 ? neo(L(p), lb(p) - 0.45) : cel(D.sage, L(p), lb(p));
    return base0;
  };
  return {
    ...base,
    // skin-tight: a hair over the bare body
    chest: [base.chest[0] + 0.1, base.chest[1] + 0.1], waist: [base.waist[0] + 0.1, base.waist[1] + 0.1], pelvis: [base.pelvis[0] + 0.1, base.pelvis[1] + 0.1],
    torso,
    upperArm(p) {
      const l = L(p);
      // the shoulder panel is sage to the deltoid
      if (p.t < 0.26) return cel(D.sage, l, lb(p));
      if (Math.abs(p.t - 0.26) < 0.03) return neo(l, lb(p) - 0.45);
      return stripe(p, neo(l, lb(p)));
    },
    foreArm(p) {
      const l = L(p);
      // a rubber patch on the far forearm, the cuffs
      if (!p.near && p.t > 0.3 && p.t < 0.55 && p.hit.n[2] > 0.2) {
        const pc = patch(D.tube, l, (p.t - 0.42) / 0.12, (p.hit.n[0]) / 0.5, 2.2, lb(p));
        if (pc !== null) return pc;
      }
      if (p.t > 0.9) return Math.abs(p.t - 0.92) < 0.02 ? neo(l, lb(p) - 0.45) : neo(l, lb(p) + 0.12);
      return stripe(p, neo(l, lb(p)));
    },
    // bare hands (Mori's own; the fingerless gloves stay on the boat)
    hands(p) { return cel(base.skin, L(p), lb(p) + 0.1); },
    fingers: undefined,
    cuff: undefined,
    fingerK: 1,
    thigh(p) {
      const l = L(p);
      // a slab of inner tube over a tear on the near thigh
      if (p.near && p.hit.n[2] > 0.3) {
        const pc = patch(D.tube, l, (p.t - 0.55) / 0.13, (outward(p) - 0.1) / 0.32, 6.7, lb(p));
        if (pc !== null) return pc;
      }
      return stripe(p, neo(l, lb(p)));
    },
    shin(p) {
      const l = L(p);
      // ribbed knee pads: grippy rubber, dotted
      if (p.t < 0.2 && outward(p) < 0.55 && p.hit.n[2] > -0.1) return Math.abs(p.t - 0.2) < 0.03 ? neo(l, lb(p) - 0.4) : cel(D.fin, l, lb(p) + ((p.hit.x + p.hit.y * 2) % 3 === 0 ? 0.28 : 0.02));
      if (p.t > 0.9) return neo(l, lb(p) + 0.1);
      return stripe(p, neo(l, lb(p)));
    },
    // neoprene booties (the fins' foot pockets with the kit): a grey sole, a heel strap
    shoe(p) {
      const l = L(p), q = p.hit.q;
      if (q[1] < -0.42) return cel(D.fin, l, -0.2);
      if (kit && q[0] < -0.35 && Math.abs(q[1] - 0.1) < 0.18) return cel(PAL.webbing, l, 0.1);
      return neo(l, lb(p) + 0.04);
    },
    shoeK: kit ? [1.05, 0.95, 1.05] : [1, 0.94, 0.96],
    skirt: undefined,
    bootTop: undefined,
    extras(s, J, P, c) {
      // the suit's neck seal over the neck, up under the jaw
      s.limb(J.neckBase, vadd(J.neckBase, vsc(vnorm(vsub(J.neckTop, J.neckBase)), vlen3(vsub(J.neckTop, J.neckBase)) * 0.92)), c.neckR * 1.12, c.neckR * 1.02, GG.collar, (h: Hit) => (h.t > 0.86 ? neo(h.l, 0.35) : neo(h.l, -0.05)));
      if (kit) diveKit(s, J, P, c);
    },
  };
}

// ------------------------------------------------------------------ the kit on his back and feet
const flat = (v: V3): V3 => vnorm([v[0], 0, v[2]]);
const vlen3 = (v: V3) => Math.hypot(v[0], v[1], v[2]);
function diveKit(s: Scene3D, J: J3, P: Pose, ch: Char7) {
  const T = ch.build.torso;
  // (shifted toward the near side, so it shows past the body in the 3/4 turn, like the packs)
  const R = 2.3, back = -(ch.chest[0] + R * 1.02), Z = 2.2;
  // the cylinder: chipped yellow paint over steel, a black stencilled band, rust at the chips
  tLimb(s, J, [T * 0.14, back, Z], [T * 0.94, back, Z], R, R, GG.pack, h => {
    const t = h.t, l = h.l;
    if (Math.abs(t - 0.8) < 0.045) return frac(h.q[1] * 1.3) < 0.5 && Math.abs(t - 0.8) < 0.02 ? cel(D.tank, l, 0.1) : cel(PAL.black, l, 0.1);
    const n = hash2(Math.floor(h.p[0] * 2.2), Math.floor(h.p[1] * 2.2));
    if (n > 0.93 && t > 0.12 && t < 0.92) return n > 0.97 ? cel(PAL.steel, l, 0.2, true) : cel(D.rust, l, 0.05);
    // a long scuff where it's been dragged across the deck
    if (Math.abs(t - 0.36 - h.q[1] * 0.03) < 0.012 && h.q[1] > -0.5 && h.q[1] < 1.4) return cel(PAL.steel, l, 0);
    return cel(D.tank, l, 0.04, true);
  });
  // the tank's cam bands to the backplate
  for (const t of [0.34, 0.62]) tLimb(s, J, [T * (0.14 + t * 0.8), back, Z], [T * (0.14 + t * 0.8) + 0.9, back, Z], R + 0.22, R + 0.22, GG.strap, h => cel(PAL.webbing, h.l, 0.1));
  // the valve, its handwheel and the first stage on top
  const top: V3 = [T * 0.94 + R * 0.85, back, Z];
  tLimb(s, J, top, [top[0] + 1.3, top[1], top[2]], 0.75, 0.7, GG.tool, h => cel(PAL.steel, h.l, 0.25, true));
  tEll(s, J, [top[0] + 1.6, top[1] - 0.3, top[2] - 1.2], [0.9, 0.9, 0.5], GG.tool, h => (Math.floor(Math.atan2(h.q[1], h.q[0]) * 2.5) & 1 ? cel(PAL.black, h.l, 0.2) : cel(PAL.black, h.l, -0.1)));
  tEll(s, J, [top[0] + 1.4, top[1] + 0.6, top[2] + 1.0], [0.9, 0.8, 0.9], GG.tool, h => cel(PAL.steel, h.l, 0.15, true));
  // the regulator hose: from the first stage, round over the near shoulder to the mouth
  const hose: V3[] = [
    [top[0] + 1.4, top[1] + 0.9, top[2] + 1.6],
    [T + 1.6, back * 0.4, ch.shW * 0.7],
    [T + 1.4, ch.chest[0] * 0.55, ch.shW * 0.62],
    [T + 1.6, ch.chest[0] + 1.0, ch.shW * 0.25],
  ];
  for (let i = 0; i < hose.length - 1; i++) tLimb(s, J, hose[i], hose[i + 1], 0.42, 0.42, GG.coil, h => cel(PAL.black, h.l, frac(h.t * 3) < 0.1 ? -0.3 : 0.12));
  // the gauge console on its hose, clipped at the far hip: a white dial in a black boot
  tLimb(s, J, [top[0] + 1.0, top[1], top[2] - 1.6], [T * 0.35, back * 0.3, -ch.hipW - 1.6], 0.36, 0.36, GG.coil, h => cel(PAL.black, h.l, 0.1));
  tEll(s, J, [T * 0.3, 0.2, -ch.hipW - 1.9], [1.3, 1.3, 0.7], GG.clip, h => {
    if (h.q[2] < 0.45 || Math.hypot(h.q[0], h.q[1]) > 0.72) return cel(PAL.black, h.l, 0.15);
    // the needle, in the green
    return Math.abs(h.q[0] + h.q[1] * 0.6) < 0.12 && h.q[1] > -0.1 ? hex('#c82a1a') : hex('#eef2ea');
  });
  // the fins: a blade off each foot pocket, two orange fanshell rails, a darker scuffed tip
  for (const near of [false, true]) {
    const an = near ? J.anN : J.anF;
    const fa = (near ? P.fl.fa : P.bl.fa) ?? 0;
    const fd = vnorm(vadd(vsc(flat(J.legFwd), Math.cos(fa)), [0, Math.sin(fa), 0]));
    const upv = vnorm(vsub([0, 1, 0], vsc(fd, fd[1])));
    const lt = vnorm(vcross(fd, upv));
    const c = vadd(an, vadd(vsc(fd, 7.4), vsc(upv, -1.6)));
    const g = (near ? GG.clip + 40 : GG.clip + 41);
    s.ellipsoid(c, vsc(fd, 5.6), vsc(upv, 0.5), vsc(lt, 2.4), g, (h: Hit) => {
      const u = h.q[0], w = Math.abs(h.q[2]), l = h.l + (near ? 0 : -0.28);
      if (u < -0.62) return -1; // (the foot pocket is the shoe)
      if (Math.abs(w - 0.62) < 0.13 && u < 0.86) return cel(D.shell, l, frac(u * 6) < 0.2 ? -0.25 : 0.08, true);
      if (u > 0.78) return cel(D.fin, l, -0.2);
      // the tender floor's diamond grip, and a soft flex line across the blade
      const grip = ((h.x + h.y) % 4 === 0) || ((h.x - h.y + 400) % 4 === 0);
      return cel(D.fin, l, Math.abs(u - 0.15) < 0.05 ? -0.3 : grip ? 0.14 : 0);
    });
  }
}

// ------------------------------------------------------------------ the mask and the regulator
const GLASS = hex('#d6f2ff'), GLASS2 = hex('#8ccbe8');
function diveMask(s: Scene3D, W: (p: V3) => V3, d: HeadDef7) {
  const [ex, ey, ez] = d.eye;
  const c: V3 = [ex + 0.35, ey - 0.45, 0], r: V3 = [1.45, 1.85, Math.abs(ez) + 1.45];
  // the frame and skirt: a black silicone rim round the glass, the nose pocket between the lenses;
  // the glass itself is clear (the face shows through), a streak of glint on its upper corner
  s.ellipsoid(W(c), W([r[0], 0, 0]), W([0, r[1], 0]), W([0, 0, r[2]]), 32, (h: Hit) => {
    const qy = h.q[1], qz = h.q[2];
    if (h.q[0] < -0.15) return -1;
    const rad = Math.hypot(qy * 1.05, qz);
    if (rad > 0.97) return -1;
    if (rad > 0.8) return rad > 0.92 ? cel(PAL.black, h.l, -0.25) : cel(PAL.black, h.l, 0.25, true);
    // the nose pocket
    if (Math.abs(qz) < 0.16 && qy < 0.05) return cel(PAL.black, h.l, 0.15);
    // a glint across the upper outside of each lens
    const g = qy + Math.abs(qz) * 0.55;
    if (g > 0.52 && g < 0.66) return (h.x + h.y) & 1 ? GLASS : GLASS2;
    return -1;
  });
  // the split strap round the back of the head, over the hair
  const [c0, r0] = d.shell;
  for (let i = 0; i <= 20; i++) {
    const a = -Math.PI + (i / 20) * Math.PI * 2;
    if (Math.cos(a) > 0.45) continue;
    for (const dy of [-0.55, 0.55]) {
      const p: V3 = [c0[0] + Math.cos(a) * r0[0] * 1.03, ey - 0.2 + dy - Math.cos(a) * 0.5, Math.sin(a) * r0[2] * 1.05];
      s.ellipsoid(W(p), W([0.62, 0, 0]), W([0, 0.42, 0]), W([0, 0, 0.62]), 33, h => cel(PAL.black, h.l, 0.18));
    }
  }
  // the buckles where the strap meets the skirt
  for (const z of [-1, 1]) s.ellipsoid(W([ex - 0.6, ey - 0.4, z * (Math.abs(ez) + 1.6)]), W([0.6, 0, 0]), W([0, 0.7, 0]), W([0, 0, 0.45]), 34, h => cel(D.tank, h.l, 0.1, true));
}
function regulator(s: Scene3D, W: (p: V3) => V3, d: HeadDef7) {
  const [mx, my] = d.mouth;
  // the second stage in his teeth: a black body, the yellow purge cover facing out, the exhaust tee
  s.ellipsoid(W([mx + 0.85, my - 0.1, 0]), W([0.85, 0, 0]), W([0, 1.0, 0]), W([0, 0, 1.05]), 35, (h: Hit) => {
    if (h.q[0] > 0.5) return Math.hypot(h.q[1], h.q[2]) < 0.5 ? cel(D.tank, h.l, 0.2, true) : cel(PAL.black, h.l, 0.3);
    return cel(PAL.black, h.l, 0.12);
  });
  s.ellipsoid(W([mx + 0.7, my - 1.2, 0]), W([0.6, 0, 0]), W([0, 0.5, 0]), W([0, 0, 1.35]), 36, h => cel(PAL.black, h.l, 0.05));
  // the hose leaving it to the near side, down toward the shoulder
  s.limb(W([mx + 0.4, my - 0.3, 0.9]), W([mx - 0.8, my - 1.7, 2.4]), 0.36, 0.36, 37, h => cel(PAL.black, h.l, 0.12));
}

// ------------------------------------------------------------------ the outfits
const DIVE_HEAD: HeadWear7 = wear([diveMask, regulator]);
export const DIVE_OUTFITS: Record<string, Record<string, { body(base: Char7): Char7; head?: HeadWear7 }>> = {
  mori: {
    wetsuit: { body: b => wetsuitBody(b, false) },
    dive: { body: b => wetsuitBody(b, true), head: DIVE_HEAD },
  },
};

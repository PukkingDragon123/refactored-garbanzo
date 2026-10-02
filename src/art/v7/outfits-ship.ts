// V7 'ship' outfits: what the crew wear about the Kittiwake on an ordinary day at sea.
//  Jenna  an oversized pastel-lavender hoodie (kangaroo pocket, cream drawstrings, sweater-paw cuffs,
//         the hood bunched behind her neck), charcoal leggings, chunky white sneakers with pink soles,
//         and her mint cat-ear headphones round her neck ('shipPhones': on her head, listening)
//  Mori   an oatmeal henley with the sleeves rolled up, an olive field vest with chest pockets, a red
//         lanyard with his research ID, stone cargo trousers cuffed at the ankle, brown trail shoes
//  Joshu  a deep-teal ribbed fisherman's knit with the cuffs rolled thick, tan canvas work trousers,
//         brown leather boots, his red skipper's cap (that never comes off)
//  Aroha  a deep-teal sleeveless top with a cream koru print, a woven flax belt, olive shorts, sandals

import { hex, C } from '../color';
import { cel, Ramp6, Scene3D, V3 } from './raster';
import type { Char7, Part, J3 } from './body';
import type { HeadDef7, HeadWear7 } from './head';
import { CAST7 } from './cast';
import { R6, lb, knit, plain, tEll, tLimb, collar, GG, wear } from './gear';
import { arohaDayBody } from './aroha7';

const L = (p: Part) => p.hit.l;
const frac = (v: number) => v - Math.floor(v);

const S = {
  lav: R6('#2a2238', '#544870', '#7e70a4', '#a898cc', '#c4b8e4', '#e2daf6'),
  mint: R6('#123a32', '#2a6a5a', '#4a9a84', '#72c2a8', '#9ce0c8', '#d0f6e8'),
  pinkSoft: R6('#3a1020', '#7a2a48', '#c04a78', '#e86a98', '#f498bc', '#ffc8dc'),
  cream: R6('#4a3e34', '#8a7a68', '#bcaa92', '#e0d2bc', '#f0e6d4', '#fffaf0'),
  legging: R6('#08080c', '#121218', '#1c1c26', '#282834', '#363644', '#484858'),
  white: R6('#3a3a44', '#7a7a88', '#b4b4c0', '#dcdce4', '#f0f0f4', '#ffffff'),
  oat: R6('#2a2420', '#5a4c40', '#8c7c6a', '#b8a890', '#d4c6ae', '#ece0ca'),
  olive: R6('#101408', '#242c14', '#3a4622', '#526232', '#6a7c42', '#88985a'),
  stone: R6('#1a1712', '#36301f', '#544a34', '#726648', '#8e825e', '#aca07a'),
  trail: R6('#120a06', '#2e1a10', '#4a2c1a', '#664028', '#82563a', '#a0704e'),
  red: R6('#2a0606', '#5e0e0c', '#8e1c16', '#b82c22', '#d8483a', '#f07060'),
  teal: R6('#04100f', '#0a1e1c', '#12302c', '#1c443e', '#285a52', '#387268'),
  canvas: R6('#1a140c', '#36281a', '#523e28', '#6c5436', '#866c46', '#a08658'),
  leather: R6('#120806', '#2a160e', '#422416', '#5c3420', '#76462e', '#925e40'),
  flax: R6('#2a1e0c', '#5a4418', '#86692a', '#b08e40', '#caa85a', '#e4c67c'),
  khaki: R6('#141408', '#2a2a16', '#424224', '#5a5a32', '#727242', '#8c8c56'),
  ateal: R6('#041214', '#0a2428', '#12383e', '#1e5058', '#2c6a72', '#40868e'),
};

// ------------------------------------------------------------------ headphones

const cupMat = (h: { l: number; q: V3 }, side: number): C => {
  // the ear cup: mint shell, a pink cushion on the inner face, a little glowing paw on the outside
  if (h.q[2] * side < -0.35) return cel(S.pinkSoft, h.l, 0.1);
  if (h.q[2] * side > 0.75 && Math.abs(h.q[0]) < 0.3 && Math.abs(h.q[1]) < 0.3) return hex('#fff2fa');
  return cel(S.mint, h.l, 0.08, true);
};

/** cat-ear headphones round the neck: the band behind the neck, the cups resting on the collarbones */
function neckPhones(s: Scene3D, J: J3, c: Char7) {
  const T = c.build.torso, rf = c.chest[0] * 0.55 + c.neckR * 0.6, rz = c.shW * 0.3 + c.neckR * 0.8;
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * 0.55 + (i / 12) * Math.PI * 0.9;
    tEll(s, J, [T + 1.0, Math.cos(a) * rf, Math.sin(a) * rz], [0.7, 0.6, 0.7], GG.collar + 30, h => cel(S.mint, h.l, 0.1));
  }
  for (const z of [-1, 1]) tEll(s, J, [T + 0.3, c.chest[0] * 0.6 + 0.4, z * (rz + 0.5)], [1.6, 1.4, 1.4], GG.collar + 31, h => cupMat(h, z));
}

/** the same headphones on: the band over the crown with cat ears on it, the cups over the ears */
const headPhones = (s: Scene3D, W: (p: V3) => V3, d: HeadDef7) => {
  const [c0, r0] = d.shell;
  const cx = d.ear[0][0] + 0.4;
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI;
    const p: V3 = [cx, c0[1] + Math.sin(a) * (r0[1] * 1.02 + 0.5), Math.cos(a) * (r0[2] * 1.02 + 0.5)];
    s.ellipsoid(W(p), W([0.75, 0, 0]), W([0, 0.6, 0]), W([0, 0, 0.75]), 30, h => cel(S.mint, h.l, 0.12));
  }
  // cat ears on the band (pink inside)
  for (const z of [-1, 1]) {
    const a = Math.PI * (0.5 + z * 0.22);
    const base: V3 = [cx, c0[1] + Math.sin(a) * (r0[1] + 0.9), Math.cos(a) * (r0[2] + 0.9)];
    const tip: V3 = [cx + 0.3, base[1] + 2.6, base[2] * 1.18];
    s.limb(W(base), W(tip), 1.35, 0.3, 31, h => (h.q[0] > 0.3 && h.t > 0.2 && h.t < 0.8 ? cel(S.pinkSoft, h.l, 0.15) : cel(S.mint, h.l, 0.05)));
  }
  for (const z of [-1, 1]) {
    const e = d.ear[0];
    const p: V3 = [e[0] + 0.2, e[1] + 0.4, z * (r0[2] + 0.6)];
    s.ellipsoid(W(p), W([2.1, 0, 0]), W([0, 2.4, 0]), W([0, 0, 1.3]), 32, h => cupMat(h, z));
  }
};
export const PHONES_HEAD: HeadWear7 = wear([headPhones]);

// ------------------------------------------------------------------ Jenna

function jennaShip(phones: boolean) {
  return (b: Char7): Char7 => {
    const hoodie = (p: Part, bias = 0) => cel(S.lav, L(p), bias);
    return {
      ...b,
      // oversized: roomy through the body and the sleeves
      chest: [b.chest[0] + 0.6, b.chest[1] + 0.7], waist: [b.waist[0] + 1.0, b.waist[1] + 1.0], pelvis: [b.pelvis[0] + 0.5, b.pelvis[1] + 0.5],
      armR: [b.armR[0] + 0.45, b.armR[1] + 0.45, b.armR[2] + 0.4],
      shoeK: [1.18, 1.28, 1.2],
      cuff: { r: b.armR[2] + 0.75, len: 1.6, mat: p => knit(S.lav, L(p), p.hit.q[1] * 3, lb(p) - 0.12) },
      torso(p) {
        const l = L(p);
        // ribbed waistband
        if (p.hh < 0.1) return knit(S.lav, l, p.z * 1.4, -0.15);
        // the kangaroo pocket across the tummy: a seam round it, the openings in shadow
        if (p.f > 0.6 && p.hh > 0.12 && p.hh < 0.4 && Math.abs(p.z) < 2.6) {
          if (Math.abs(Math.abs(p.z) - 2.4) < 0.25 || Math.abs(p.hh - 0.39) < 0.02) return hoodie(p, -0.35);
          if (Math.abs(p.z) > 1.9 && p.hh > 0.2) return hoodie(p, -0.5);
          // a little white paw print on the pocket
          if (Math.abs(p.z + 0.6) < 0.7 && Math.abs(p.hh - 0.26) < 0.05) return cel(S.white, l, 0.2);
          return hoodie(p, -0.05);
        }
        // the drawstrings, cream with aglets
        if (p.f > 1 && p.hh > 0.6 && p.hh < 0.92 && Math.abs(Math.abs(p.z) - 0.85) < 0.28) return p.hh < 0.64 ? cel(S.mint, l, 0.2) : cel(S.cream, l, 0.15);
        // the neckline
        if (p.hh > 0.93) return hoodie(p, -0.25);
        return hoodie(p);
      },
      upperArm(p) { return cel(S.lav, L(p), lb(p)); },
      // a soft fold where the long sleeve bunches at the elbow
      foreArm(p) { return Math.abs(p.t - 0.35) < 0.05 ? cel(S.lav, L(p), lb(p) - 0.3) : cel(S.lav, L(p), lb(p)); },
      hands(p) { return cel(b.skin, L(p), lb(p) + 0.1); },
      thigh(p) { return cel(S.legging, L(p), lb(p) + 0.12); },
      shin(p) { return p.t > 0.88 ? cel(S.white, L(p), lb(p) - 0.1) : cel(S.legging, L(p), lb(p) + 0.12); },
      shoe(p) {
        const l = L(p), q = p.hit.q;
        if (q[1] < -0.38) return cel(S.pinkSoft, l, 0.05);
        if (q[0] > 0.7) return cel(S.white, l, lb(p) - 0.12);
        if (Math.abs(q[1] + 0.05) < 0.12 && Math.abs(q[0]) < 0.55) return cel(S.lav, l, lb(p));
        return cel(S.white, l, lb(p) + 0.05);
      },
      // the hoodie's long hem over the hips, ribbed at the bottom
      skirt: { len: 4.8, flare: 0.9, top: 3.2, mat: p => (p.t > 0.8 ? knit(S.lav, L(p), Math.atan2(p.z, p.f) * 8, -0.15) : cel(S.lav, L(p), Math.sin(Math.atan2(p.z, p.f) * 3) > 0.85 ? -0.2 : 0)) },
      extras(s, J, _P, c) {
        // the hood bunched up behind the neck
        collar(s, J, c, { r: 1.25, rise: 0.2, back: 1.5, mat: h => cel(S.lav, h.l, -0.05) });
        if (!phones) neckPhones(s, J, c);
      },
    };
  };
}

// ------------------------------------------------------------------ Mori

const moriShip = (b: Char7): Char7 => ({
  ...b,
  torso(p) {
    const l = L(p);
    // belt over the trousers' waistband
    if (p.hh < 0.12) return cel(S.stone, l, 0);
    if (p.hh < 0.19) return p.f > 2 && Math.abs(p.z) < 0.9 ? cel(S.trail, l, 0.5, true) : cel(S.trail, l, 0.05);
    const front = p.f > 0;
    // the henley shows down the front between the vest's open panels: a three-button placket
    if (front && Math.abs(p.z) < 1.15) {
      if (p.hh > 0.94) return cel(S.oat, l, -0.25);
      // the lanyard's ID card on its clip
      if (p.hh > 0.42 && p.hh < 0.57 && Math.abs(p.z + 0.15) < 0.9) return p.hh > 0.53 ? cel(S.red, l, 0.1) : Math.abs(p.hh - 0.47) < 0.02 ? hex('#3a6a9a') : cel(S.white, l, 0.15);
      if (p.hh > 0.66 && Math.abs(p.z - 0.2) < 0.3) return ((p.hh * 40) | 0) % 3 === 0 ? cel(S.cream, l, 0.3) : cel(S.oat, l, -0.3);
      return cel(S.oat, l, 0.02);
    }
    // the lanyard cord from behind the neck down to the card
    if (front && p.hh > 0.56 && p.hh < 0.95) {
      const zc = 0.9 + (p.hh - 0.56) * 3.2;
      if (Math.abs(Math.abs(p.z) - zc) < 0.22 && p.z < 0.6) return cel(S.red, l, 0.1);
    }
    if (p.hh > 0.96 && p.f > -1) return cel(S.oat, l, -0.1); // the henley's collar
    // the vest: chest pockets with flaps, a seam down each panel's edge, lower patch pockets
    if (front && Math.abs(p.z) < 1.5) return cel(S.olive, l, -0.35);
    if (front && Math.abs(Math.abs(p.z) - 2.6) < 1.0 && p.hh > 0.58 && p.hh < 0.78) {
      if (p.hh > 0.73) return cel(S.olive, l, -0.25);
      return Math.abs(p.hh - 0.735) < 0.02 ? cel(S.olive, l, -0.5) : cel(S.olive, l, 0.12);
    }
    if (front && Math.abs(Math.abs(p.z) - 2.4) < 1.2 && p.hh > 0.22 && p.hh < 0.4) return Math.abs(p.hh - 0.39) < 0.02 ? cel(S.olive, l, -0.45) : cel(S.olive, l, 0.08);
    return cel(S.olive, l, 0);
  },
  upperArm(p) { return cel(S.oat, L(p), lb(p)); },
  // sleeves rolled to just below the elbow, the roll a thick lighter band
  foreArm(p) {
    if (p.t < 0.14) return cel(S.oat, L(p), lb(p));
    if (p.t < 0.26) return Math.abs(p.t - 0.2) < 0.03 ? cel(S.oat, L(p), lb(p) - 0.35) : cel(S.oat, L(p), lb(p) + 0.2);
    return cel(b.skin, L(p), lb(p));
  },
  hands(p) { return cel(b.skin, L(p), lb(p) + 0.1); },
  thigh(p) {
    const l = L(p);
    // a cargo pocket on the outside of the thigh, its flap a shade darker
    if (p.t > 0.38 && p.t < 0.7 && p.hit.n[2] > 0.5) return p.t < 0.46 ? cel(S.stone, l, lb(p) - 0.3) : cel(S.stone, l, lb(p) + 0.1);
    return cel(S.stone, l, lb(p));
  },
  shin(p) { return p.t > 0.8 ? (Math.abs(p.t - 0.84) < 0.035 ? cel(S.stone, L(p), lb(p) - 0.35) : cel(S.stone, L(p), lb(p) + 0.15)) : cel(S.stone, L(p), lb(p)); },
  shoe(p) {
    const l = L(p), q = p.hit.q;
    if (q[1] < -0.42) return cel(S.trail, l, -0.4);
    if (q[1] > 0.05 && p.hit.n[0] > 0.45 && q[0] < 0.55) return (p.hit.x + p.hit.y) % 2 === 0 ? cel(S.cream, l, 0) : cel(S.trail, l, -0.3);
    return cel(S.trail, l, lb(p) + 0.05);
  },
  shoeK: [1.12, 1.15, 1.1],
  skirt: undefined,
  extras: undefined,
});

// ------------------------------------------------------------------ Joshu

const tealKnit = (p: Part, bias = 0): C => knit(S.teal, L(p), p.z * 1.3 + Math.sin(p.hh * 24) * 0.2, bias);
const joshuShip = (b: Char7): Char7 => ({
  ...b,
  torso(p) {
    if (p.hh < 0.1) return cel(S.teal, L(p), -0.3);
    // the belt under the belly showing below the hem at the front
    if (p.hh < 0.16 && p.f > 0) return p.f > 3.4 && Math.abs(p.z) < 1.1 ? hex('#b08a3a') : cel(S.leather, L(p), 0.1);
    // a thick rolled collar
    if (p.hh > 0.9) return cel(S.teal, L(p), Math.abs(p.hh - 0.95) < 0.02 ? -0.4 : 0.05);
    // a ribbed band across the chest (a fisherman's yoke)
    if (p.hh > 0.68 && p.hh < 0.74) return cel(S.teal, L(p), frac(p.z * 2) < 0.4 ? -0.3 : 0.1);
    return tealKnit(p);
  },
  upperArm(p) { return tealKnit(p, lb(p)); },
  foreArm(p) {
    // cuffs rolled thick halfway up the forearm
    if (p.t < 0.16) return tealKnit(p, lb(p));
    if (p.t < 0.32) return Math.abs(p.t - 0.24) < 0.03 ? cel(S.teal, L(p), lb(p) - 0.4) : cel(S.teal, L(p), lb(p) + 0.18);
    return b.foreArm({ ...p, t: Math.max(0.3, p.t) });
  },
  thigh(p) { return Math.abs(p.t - 0.5) < 0.04 && p.hit.n[2] > 0.4 ? cel(S.canvas, L(p), lb(p) - 0.4) : cel(S.canvas, L(p), lb(p)); },
  shin(p) { return p.t > 0.62 ? (Math.abs(p.t - 0.68) < 0.04 ? cel(S.leather, L(p), lb(p) - 0.3) : cel(S.leather, L(p), lb(p) + 0.1)) : cel(S.canvas, L(p), lb(p)); },
  shoe(p) {
    const l = L(p), q = p.hit.q;
    if (q[1] < -0.45) return S.leather[0];
    if (q[1] > 0.05 && p.hit.n[0] > 0.45 && q[0] < 0.55) return (p.hit.x + p.hit.y) % 2 === 0 ? cel(S.flax, l, 0) : cel(S.leather, l, -0.3);
    return cel(S.leather, l, lb(p) + 0.1);
  },
});

// ------------------------------------------------------------------ Aroha
// her everyday clothes from Day 2 on: a deep teal tank with a koru, the same kit (aroha7.ts)
const arohaShip = arohaDayBody;

export const SHIP_OUTFITS: Record<string, Record<string, { body(base: Char7): Char7; head?: HeadWear7 }>> = {
  jenna: { ship: { body: jennaShip(false) }, shipPhones: { body: jennaShip(true), head: PHONES_HEAD } },
  mori: { ship: { body: moriShip } },
  joshu: { ship: { body: joshuShip } },
  aroha: { ship: { body: arohaShip } },
};
void CAST7; void plain; void tLimb;

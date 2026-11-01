// V7 cast bodies: builds (longer, stylish anime proportions), volumes and outfit materials.
//  Mori  - grey field tunic with a belt and a cross strap, dark shorts, tall brown boots, gloves
//  Jenna - mauve sweater with a cream collar, pleated navy skirt, dark tights, brown shoes
//  Aroha - bush-green tank with a tāniko band, flax belt and kete, a bush shirt knotted at the waist,
//          canvas shorts, paraerae (aroha7.ts)
//  Joshu - navy cable-knit gansey over a big belly, dark trousers, black sea boots; tall and broad

import { hex, mix, C } from '../color';
import { cel, Ramp6 } from './raster';
import type { Char7, Part } from './body';
import { AROHA7 } from './aroha7';
export { AROHA7 };

const R6 = (...h: string[]): Ramp6 => h.map(v => hex(v));
const L = (p: Part) => p.hit.l;
/** far limbs sit in the body's shadow */
const lb = (p: Part) => (p.near ? 0 : -0.28);

const BOY_SKIN = R6('#3a1810', '#9a4a36', '#c8805e', '#f0a878', '#f8c090', '#ffe0b8');
const GIRL_SKIN = R6('#3a1c1c', '#b86a60', '#d8907e', '#f6b8a4', '#fad0bc', '#ffe8dc');
const JOSHU_SKIN = R6('#3a1810', '#a04a3a', '#d08064', '#f2aa86', '#f8c49c', '#ffe0c4');

// ------------------------------------------------------------------ Mori
const M = {
  // a sage field grey (brighter for the cartoon cast; it was a charcoal grey)
  tunic: R6('#161a16', '#2e3830', '#4c5a50', '#6c7c6e', '#8e9e8c', '#b0bca8'),
  belt: R6('#1d0e0f', '#4d2c25', '#61372d', '#7a4c32', '#946246', '#b07c58'),
  shorts: R6('#08070c', '#161826', '#22243a', '#30344c', '#40465e', '#565c76'),
  boot: R6('#0c0607', '#2a1612', '#3e2218', '#583224', '#744434', '#a0705a'),
  glove: R6('#0c0607', '#1d0e0f', '#2b2122', '#3a2f30', '#4d3a38', '#6e5a56'),
};
/** brass hardware (buckle, ring, studs, eyelets) and horn buttons */
const BRASS = R6('#1a1004', '#4a3010', '#7a5418', '#b08430', '#d8b050', '#fff0b0');
const HORN = R6('#0a0606', '#1e1412', '#2e201c', '#3e2c26', '#5a443a', '#7a6458');
const STITCH = hex('#b89a74');
const fr = (v: number) => v - Math.floor(v);
/** a seam: a dark line, then a lit ridge beside it toward the light */
const seam = (r: Ramp6, l: number, d: number, w = 0.12) => (Math.abs(d) < w ? cel(r, l, -0.45) : d > 0 && d < w * 2.4 ? cel(r, l, 0.22) : -1);
export const MORI7: Char7 = {
  id: 'mori',
  // a man's frame: broad shoulders over narrow hips, a thicker neck and arms
  build: { hipH: 27.5, thigh: 13, shin: 12.8, ankleH: 2.2, torso: 19, neck: 1.2, shY: 2.4, shF: 0, shB: 0, upArm: 9.6, foreArm: 8.6, legF: 0, legB: 0 },
  shW: 5.8, hipW: 2.8, chest: [3.4, 4.9], waist: [2.8, 3.6], pelvis: [3.0, 3.5],
  armR: [2.1, 1.75, 1.5], legR: [2.45, 1.95, 1.65], neckR: 1.8, hand: 1.16,
  skin: BOY_SKIN, ink: hex('#1a0e10'),
  torso(p) {
    const l = L(p), hh = p.hh, f = p.f, z = p.z, front = f > 1.1;
    // the belt: stitched leather, two loops of the shirt over it, a brass buckle with its prong
    if (hh > 0.14 && hh < 0.24) {
      if (front && Math.abs(z - 0.2) < 1.05) {
        const rim = Math.abs(z - 0.2) > 0.6 || hh < 0.163 || hh > 0.217;
        return rim ? cel(BRASS, l, 0.25, true) : Math.abs(z - 0.2) < 0.18 ? cel(BRASS, l, -0.1) : cel(M.belt, l, -0.5);
      }
      if (front && (Math.abs(z - 2.5) < 0.32 || Math.abs(z + 2.1) < 0.32)) return cel(M.tunic, l, 0.12);
      if (hh < 0.152 || hh > 0.228) return cel(M.belt, l, -0.3);
      if ((hh < 0.163 || hh > 0.217) && Math.floor(z * 3.2) % 2 === 0) return mix(cel(M.belt, l, 0), STITCH, 0.45);
      return cel(M.belt, l, 0.1, true);
    }
    // the camera strap from the far shoulder to the near hip: stitched edges, a brass ring on the chest
    const sz = -4.6 + ((0.92 - hh) / 0.7) * 7.2, ds = Math.abs(z - sz);
    if (f > 0 && hh > 0.22 && hh < 0.94 && ds < 0.95) {
      if (Math.abs(hh - 0.6) < 0.045 && ds < 0.9) return Math.abs(hh - 0.6) < 0.02 && ds < 0.45 ? cel(M.tunic, l, -0.35) : cel(BRASS, l, 0.2, true);
      if (ds > 0.72) return cel(M.belt, l, -0.4);
      if (ds > 0.5 && Math.floor(hh * 48) % 2 === 0) return mix(cel(M.belt, l, 0), STITCH, 0.5);
      return cel(M.belt, l, -0.05, true);
    }
    // the open collar: a V of skin at the throat, the folded collar points either side, inked at the fold
    if (hh > 0.9 && f > 1.4 && Math.abs(z) < (hh - 0.9) * 22) return cel(BOY_SKIN, l, -0.15);
    if (hh > 0.8 && f > 0.6) {
      const edge = (hh - 0.8) * 30 + 1.1 - Math.abs(z);
      if (edge > 0) return edge < 0.32 ? cel(M.tunic, l, -0.5) : cel(M.tunic, l, 0.28);
    }
    if (hh > 0.93) return cel(M.tunic, l, 0.15); // the collar band round the back of the neck
    // breast pockets with buttoned flaps (box-stitched), each side of the placket
    for (const side of [1, -1]) {
      const pz = side * 2.25, dz = Math.abs(z - pz);
      if (front && dz < 1.05 && hh > 0.54 && hh < 0.75) {
        if (hh > 0.68) {
          if (hh < 0.692) return cel(M.tunic, l, -0.55); // under the flap
          if (dz < 0.24 && Math.abs(hh - 0.705) < 0.02) return cel(HORN, l, 0.2, true);
          return dz > 0.86 || hh > 0.736 ? cel(M.tunic, l, -0.5) : cel(M.tunic, l, 0.22);
        }
        if (dz > 0.86 || hh < 0.558) return cel(M.tunic, l, -0.55);
        return cel(M.tunic, l, 0.06);
      }
    }
    // the placket down the front with horn buttons
    if (front && hh > 0.26 && hh < 0.9) {
      const dz = z - 0.35;
      if (Math.abs(dz) < 0.3 && [0.42, 0.58, 0.74].some(b => Math.abs(hh - b) < 0.022)) return cel(HORN, l, 0.25, true);
      const sm = seam(M.tunic, l, dz - 0.38, 0.1);
      if (sm !== -1) return sm;
    }
    // the yoke seam across the chest above the pockets
    if (front && Math.abs(hh - 0.8) < 0.012) return cel(M.tunic, l, -0.4);
    return cel(M.tunic, l);
  },
  upperArm(p) { return cel(M.tunic, L(p), lb(p)); },
  // sleeves rolled to the forearm, then the leather gauntlet of the glove with a strap and a stud
  foreArm(p) {
    const l = L(p), t = p.t, b = lb(p);
    if (t > 0.62) {
      if (t > 0.72 && t < 0.8) return Math.sin(p.hit.q[1]) < -0.75 && t > 0.74 && t < 0.78 ? cel(BRASS, l, b + 0.2, true) : cel(M.glove, l, b - 0.25);
      return t < 0.645 ? cel(M.glove, l, b - 0.4) : cel(M.glove, l, b + 0.05, true);
    }
    if (t > 0.42) return t < 0.45 || t > 0.595 ? cel(M.tunic, l, b - 0.42) : fr(t * 22) < 0.18 ? cel(M.tunic, l, b - 0.2) : cel(M.tunic, l, b + 0.2);
    return cel(M.tunic, l, b);
  },
  hands(p) { return cel(M.glove, L(p), lb(p) + 0.1, true); },
  // fingerless field gloves: the fingers and thumb are bare from the first knuckle
  fingers(p) { return p.t < 0.2 ? cel(M.glove, L(p), lb(p) + 0.1) : cel(BOY_SKIN, L(p), lb(p) + 0.12); },
  // canvas shorts to the knee: a slant pocket on the front, a turned-up hem
  thigh(p) {
    const l = L(p), t = p.t, b = lb(p), a = p.hit.q[1];
    if (t > 0.86) return t < 0.885 ? cel(M.shorts, l, b - 0.4) : t > 0.97 ? cel(M.shorts, l, b - 0.25) : cel(M.shorts, l, b + 0.2);
    if (p.near && Math.sin(a) < -0.1 && t < 0.34 && Math.abs(t - (0.04 + 0.13 * (1 - Math.cos(a)))) < 0.024) return cel(M.shorts, l, b - 0.45);
    return cel(M.shorts, l, b);
  },
  // the knee, then tall leather boots: a turned-down cuff, laces up the front through brass eyelets, a polish streak
  shin(p) {
    const l = L(p), t = p.t, b = lb(p), a = p.hit.q[1], fa = -Math.sin(a), ac = Math.cos(a);
    if (t < 0.1) return cel(BOY_SKIN, l, b);
    if (t < 0.25) return t < 0.12 ? cel(M.boot, l, b + 0.3) : t > 0.235 ? cel(M.boot, l, b - 0.5) : cel(M.boot, l, b + 0.18);
    if (fa > 0.45 && t > 0.3 && t < 0.92) {
      const tri = Math.abs(fr((t - 0.3) * 11) - 0.5) * 2 - 0.5;
      if (Math.abs(Math.abs(ac) * 1.8 - Math.abs(tri) * 1.1) < 0.2 && Math.abs(ac) < 0.42) return mix(cel(M.boot, l, b + 0.4), STITCH, 0.5);
      if (Math.abs(Math.abs(ac) - 0.45) < 0.08 && fr((t - 0.3) * 11) < 0.25) return cel(BRASS, l, b, true);
    }
    if (l + b > 0.62 && fa > 0.2 && Math.abs(ac + 0.45) < 0.12) return M.boot[5];
    return cel(M.boot, l, b);
  },
  shoe(p) {
    const q = p.hit.q, l = L(p), b = lb(p);
    if (q[1] < -0.45) return M.boot[0];
    if (q[1] < -0.28) return Math.floor(p.hit.x / 2) % 2 ? mix(cel(M.boot, l, b - 0.2), STITCH, 0.35) : cel(M.boot, l, b - 0.3);
    if (q[0] > 0.45 && l + b > 0.5) return M.boot[5]; // the polished toe cap
    return cel(M.boot, l, b + 0.05);
  },
  // the shirt's tails at the hips: a stitched hem, a few soft folds
  skirt: { len: 4.2, flare: 0.5, mat: p => (p.t > 0.84 ? cel(M.tunic, L(p), -0.35) : p.t > 0.76 && p.t < 0.8 ? mix(cel(M.tunic, L(p), 0), STITCH, 0.2) : Math.sin(Math.atan2(p.z, p.f) * 5) > 0.8 ? cel(M.tunic, L(p), -0.25) : cel(M.tunic, L(p))) },
};

// ------------------------------------------------------------------ Jenna
const J = {
  top: R6('#1c1111', '#3a2630', '#584050', '#7a5a6a', '#946e7c', '#ae8894'),
  collar: R6('#6a5a54', '#a8968c', '#cab8ac', '#e6d6ca', '#f4e8de', '#ffffff'),
  skirt: R6('#040103', '#0e0c18', '#181628', '#24203a', '#302a4a', '#3e365c'),
  legs: R6('#040103', '#0c0a12', '#16121e', '#1e1a2a', '#2a2438', '#363046'),
  shoe: R6('#1c1111', '#3a2420', '#54302a', '#6e4234', '#8a5842', '#a47052'),
};
export const JENNA7: Char7 = {
  id: 'jenna',
  build: { hipH: 25, thigh: 11.8, shin: 11.6, ankleH: 2.1, torso: 17, neck: 1.3, shY: 2.2, shF: 0, shB: 0, upArm: 8.6, foreArm: 7.8, legF: 0, legB: 0 },
  shW: 4.5, hipW: 2.8, chest: [3.2, 4.0], waist: [2.5, 3.1], pelvis: [3.0, 3.7],
  armR: [1.8, 1.55, 1.25], legR: [2.2, 1.6, 1.3], neckR: 1.3, hand: 1.0,
  skin: GIRL_SKIN, ink: hex('#24141a'),
  torso(p) {
    const l = L(p);
    // the big cream sailor collar: a navy stripe round its edge, a red ribbon bow at the front
    if (p.hh > 0.8 && (p.f > 0.5 || p.hh > 0.9)) {
      if (p.f > 2.2 && Math.abs(p.hh - 0.8) < 0.05 && Math.abs(p.z) < 1.3) return Math.abs(p.z) < 0.35 ? cel(RIBBON, l, -0.2) : cel(RIBBON, l, 0.15, true);
      if (p.hh < 0.83) return cel(J.collar, l, -0.45);
      if (p.hh < 0.86 && p.hh > 0.84) return cel(J.skirt, l, 0.2);
      return cel(J.collar, l, 0.1);
    }
    // the ribbed hem and the sweater's soft knit (a fine rib up the body)
    if (p.hh < 0.2) return fr((p.z + 10) * 1.4) < 0.5 ? cel(J.top, l, -0.25) : cel(J.top, l, 0.05);
    // a little cat print on the chest: a cream cat face with two ears
    if (p.f > 2.4 && p.hh > 0.52 && p.hh < 0.68 && Math.abs(p.z + 0.8) < 1.1) {
      if (p.hh > 0.64 && Math.abs(Math.abs(p.z + 0.8) - 0.7) > 0.28) return cel(J.top, l);
      return Math.abs(p.hh - 0.58) < 0.015 && Math.abs(Math.abs(p.z + 0.8) - 0.4) < 0.15 ? cel(J.skirt, l, 0) : cel(J.collar, l, 0.2);
    }
    if (fr((p.z + 10) * 1.6) < 0.16 && l > -0.3) return cel(J.top, l, -0.14);
    return cel(J.top, l);
  },
  upperArm(p) { return cel(J.top, L(p), lb(p)); },
  // ribbed cuffs pushed up a little
  foreArm(p) { return p.t > 0.8 ? (fr(p.hit.q[1] * 1.6) < 0.4 ? cel(J.top, L(p), lb(p) - 0.38) : cel(J.top, L(p), lb(p) - 0.12)) : cel(J.top, L(p), lb(p)); },
  hands(p) { return cel(GIRL_SKIN, L(p), lb(p) + 0.1); },
  // dark tights with a soft sheen down the lit side of the leg
  thigh(p) { return sheen(J.legs, p); },
  shin(p) { return sheen(J.legs, p); },
  // Mary-Jane shoes: a strap over the instep, a buttoned side, a stitched sole, a polished toe
  shoe(p) {
    const q = p.hit.q, l = L(p), b = lb(p);
    if (q[1] < -0.45) return J.shoe[1];
    if (q[1] < -0.3) return cel(J.shoe, l, b - 0.3);
    if (Math.abs(q[0] + 0.1) < 0.14 && q[1] > -0.1) return Math.abs(q[2]) < 0.3 && q[2] > 0 ? cel(BRASS, l, 0.2, true) : cel(J.shoe, l, b - 0.25);
    if (q[0] > 0.5 && l + b > 0.45) return J.shoe[5];
    return cel(J.shoe, l, b + 0.1);
  },
  // the pleated skirt: each pleat a lit face, a shadowed face and a crisp fold line, a white stripe above the hem
  skirt: {
    len: 9, flare: 3.2, top: 3.6, mat: p => {
      const l = L(p), u = fr((Math.atan2(p.z, p.f) / (Math.PI * 2)) * 14);
      if (p.t > 0.8 && p.t < 0.85) return cel(J.collar, l, -0.1);
      if (p.t > 0.94) return cel(J.skirt, l, -0.35);
      if (u < 0.1) return cel(J.skirt, l, -0.55);
      return u < 0.5 ? cel(J.skirt, l, 0.18) : cel(J.skirt, l, -0.12);
    },
  },
};
const RIBBON = R6('#200406', '#4a0c12', '#7a1820', '#a8262e', '#cc4040', '#ee7a6a');
/** stockings and tights: a streak of sheen down the leg where it faces the light */
function sheen(r: Ramp6, p: Part): C {
  const l = L(p), b = lb(p) + 0.1;
  if (l + b > 0.55 && Math.abs(Math.cos(p.hit.q[1]) + 0.35) < 0.14) return r[5];
  return cel(r, l, b);
}

// ------------------------------------------------------------------ Aroha
// (her body, kit and moves live in aroha7.ts)

// ------------------------------------------------------------------ Joshu
const Jo = {
  // a charcoal-black fisherman's knit (cool, nearly black: the white beard and red cap pop off it)
  knit: R6('#050507', '#0d0e13', '#17191f', '#22252d', '#2f333d', '#3e434f'),
  trousers: R6('#0c0a08', '#1c1914', '#2c2720', '#3c352c', '#4c4438', '#5c5346'),
  boot: R6('#040304', '#0e0a0c', '#1a1416', '#262022', '#342c2e', '#443a3c'),
  belt: R6('#0e0806', '#241410', '#361e16', '#4a2a1c', '#5e3a28', '#744c34'),
};
const knitM = (p: Part, bias = 0): C => {
  // cable-knit: twisted ropes running down the gansey, a moss-stitch fleck between them
  const rope = Math.abs(Math.sin((p.z * 1.6) + Math.sin(p.hh * 30) * 0.6)) > 0.93;
  if (rope) return cel(Jo.knit, L(p), bias - 0.35);
  const fleck = ((p.hit.x * 3 + p.hit.y * 5) % 7) === 0 && L(p) + bias > 0.1;
  return fleck ? cel(Jo.knit, L(p), bias + 0.3) : cel(Jo.knit, L(p), bias);
};
export const JOSHU7: Char7 = {
  id: 'joshu',
  // big and strong: broad square shoulders, thick arms and neck, big hands, the round belly
  build: { hipH: 28.6, thigh: 13.6, shin: 13.2, ankleH: 2.4, torso: 24, neck: 1, shY: 3.2, shF: 0, shB: 0, upArm: 11.2, foreArm: 10, legF: 0, legB: 0 },
  shW: 8.3, hipW: 3.9, chest: [5.1, 7.2], waist: [4.9, 5.9], pelvis: [4.3, 5.1], belly: 3.4,
  armR: [3.4, 3.0, 2.45], legR: [3.4, 2.7, 2.2], neckR: 2.9, hand: 1.6,
  skin: JOSHU_SKIN, ink: hex('#140c0e'),
  torso(p) {
    if (p.hh < 0.1) return cel(Jo.knit, L(p), -0.3); // ribbed hem
    // a worn leather belt under the belly, just showing below the hem at the front
    if (p.hh > 0.1 && p.hh < 0.16 && p.f > 0) return p.f > 3.4 && Math.abs(p.z) < 1.1 ? hex('#b08a3a') : cel(Jo.belt, L(p), 0.1);
    if (p.hh > 0.92) return cel(Jo.knit, L(p), -0.2); // roll collar
    return knitM(p);
  },
  upperArm(p) { return knitM(p, lb(p)); },
  // sleeves shoved up past the elbow: thick hairy forearms with an anchor tattoo on the near one
  foreArm(p) {
    if (p.t < 0.28) return cel(Jo.knit, L(p), lb(p) + 0.15);
    if (p.near && p.t > 0.45 && p.t < 0.65 && Math.abs(p.hit.q[1] - 0.6) < 0.5) return hex('#34507a');
    const hair = p.t > 0.34 && ((p.hit.x * 7 + p.hit.y * 3) % 5) === 0 && L(p) > -0.2;
    return hair ? cel(JOSHU_SKIN, L(p), lb(p) - 0.45) : cel(JOSHU_SKIN, L(p), lb(p));
  },
  hands(p) { return cel(JOSHU_SKIN, L(p), lb(p) + 0.05); },
  // heavy wool trousers with a side seam, tucked into sea boots with a turned-down top and a rubber shine
  thigh(p) { return Math.abs(Math.cos(p.hit.q[1]) - 0.9) < 0.06 ? cel(Jo.trousers, L(p), lb(p) - 0.4) : cel(Jo.trousers, L(p), lb(p)); },
  shin(p) {
    const l = L(p), t = p.t, b = lb(p);
    if (t < 0.38) return cel(Jo.trousers, l, b);
    if (t < 0.45) return t < 0.4 ? cel(Jo.trousers, l, b - 0.45) : cel(Jo.trousers, l, b + 0.15); // the trouser leg bunched over the boot
    if (t < 0.55) return t > 0.53 ? cel(Jo.boot, l, b - 0.5) : cel(Jo.boot, l, b + 0.3, true); // the boot's turned-down top
    if (l + b > 0.55 && Math.abs(Math.cos(p.hit.q[1]) + 0.4) < 0.12) return Jo.boot[5];
    return cel(Jo.boot, l, b + 0.1);
  },
  shoe(p) { return p.hit.q[1] < -0.45 ? Jo.boot[0] : p.hit.q[1] < -0.3 ? cel(Jo.boot, L(p), lb(p) - 0.3) : cel(Jo.boot, L(p), lb(p) + 0.1, true); },
};

export const CAST7: Record<string, Char7> = { mori: MORI7, jenna: JENNA7, aroha: AROHA7, joshu: JOSHU7 };

export const INFO7: Record<string, { name: string; short: string; voice: number; height: number }> = {
  mori: { name: 'Mori', short: 'Mori', voice: 1, height: 66 },
  jenna: { name: 'Jenna', short: 'Jenna', voice: 1.5, height: 57 },
  joshu: { name: 'Joshu', short: 'Joshu', voice: 0.62, height: 72 },
  aroha: { name: 'Aroha', short: 'Aroha', voice: 1.12, height: 61 },
  chunk: { name: 'Chunk', short: 'Chunk', voice: 1.3, height: 16 },
};

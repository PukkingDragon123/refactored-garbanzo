// V7 cast bodies: builds (longer, stylish anime proportions), volumes and outfit materials.
//  Mori  - grey field tunic with a belt and a cross strap, dark shorts, tall brown boots, gloves
//  Jenna - mauve sweater with a cream collar, pleated navy skirt, dark tights, brown shoes
//  Aroha - ochre woven top with a taniko band, olive skirt, bare legs, flax sandals
//  Joshu - navy cable-knit gansey over a big belly, dark trousers, black sea boots; tall and broad

import { hex, C } from '../color';
import { cel, Ramp6 } from './raster';
import type { Char7, Part } from './body';

const R6 = (...h: string[]): Ramp6 => h.map(v => hex(v));
const L = (p: Part) => p.hit.l;
/** far limbs sit in the body's shadow */
const lb = (p: Part) => (p.near ? 0 : -0.28);

const BOY_SKIN = R6('#3a1810', '#9a4a36', '#c8805e', '#f0a878', '#f8c090', '#ffe0b8');
const GIRL_SKIN = R6('#3a1c1c', '#b86a60', '#d8907e', '#f6b8a4', '#fad0bc', '#ffe8dc');
const DARK_SKIN = R6('#2a1610', '#5e3624', '#80502e', '#a06a46', '#bc855e', '#d49c74');
const JOSHU_SKIN = R6('#3a1810', '#a04a3a', '#d08064', '#f2aa86', '#f8c49c', '#ffe0c4');

// ------------------------------------------------------------------ Mori
const M = {
  tunic: R6('#16100f', '#2c2426', '#453c3e', '#5e5456', '#786e70', '#948a8c'),
  belt: R6('#1d0e0f', '#4d2c25', '#61372d', '#7a4c32', '#946246', '#b07c58'),
  shorts: R6('#08070c', '#141420', '#1e1e2c', '#2a2c3c', '#383a4e', '#4a4c62'),
  boot: R6('#0c0607', '#2a1612', '#3e2218', '#583224', '#744434', '#8e5a44'),
  glove: R6('#0c0607', '#1d0e0f', '#2b2122', '#3a2f30', '#4d3a38', '#5e4a46'),
};
export const MORI7: Char7 = {
  id: 'mori',
  build: { hipH: 27.5, thigh: 13, shin: 12.8, ankleH: 2.2, torso: 19, neck: 1.2, shY: 2.4, shF: 0, shB: 0, upArm: 9.6, foreArm: 8.6, legF: 0, legB: 0 },
  shW: 5.2, hipW: 2.9, chest: [3.3, 4.4], waist: [2.8, 3.5], pelvis: [3.1, 3.7],
  armR: [1.9, 1.6, 1.4], legR: [2.4, 1.9, 1.6], neckR: 1.5, hand: 1,
  skin: BOY_SKIN, ink: hex('#1a0e10'),
  torso(p) {
    const l = L(p);
    // belt with a brass buckle
    if (p.hh > 0.14 && p.hh < 0.24) return p.f > 2 && Math.abs(p.z) < 1 ? hex('#d8a848') : cel(M.belt, l, 0.1);
    // cross strap from the far shoulder to the near hip, over the front
    const sz = -4.6 + ((0.92 - p.hh) / 0.7) * 7.2;
    if (p.f > 0 && p.hh > 0.22 && p.hh < 0.94 && Math.abs(p.z - sz) < 0.95) return cel(M.belt, l, -0.05);
    // collar: a V of skin at the neck
    if (p.hh > 0.9 && p.f > 1.6 && Math.abs(p.z) < (p.hh - 0.9) * 22) return cel(BOY_SKIN, l, -0.2);
    // placket seam and hem fold
    if (p.f > 2.2 && Math.abs(p.z - 0.4) < 0.35 && p.hh > 0.3) return cel(M.tunic, l, -0.3);
    return cel(M.tunic, l);
  },
  upperArm(p) { return cel(M.tunic, L(p), lb(p)); },
  foreArm(p) { return p.t > 0.62 ? cel(M.glove, L(p), lb(p)) : p.t > 0.5 ? cel(M.tunic, L(p), lb(p) - 0.3) : cel(M.tunic, L(p), lb(p)); },
  hands(p) { return cel(M.glove, L(p), lb(p) + 0.1); },
  thigh(p) { return cel(M.shorts, L(p), lb(p)); },
  shin(p) { return p.t < 0.18 ? cel(BOY_SKIN, L(p), lb(p)) : p.t < 0.28 ? cel(M.boot, L(p), lb(p) + 0.25) : cel(M.boot, L(p), lb(p)); },
  shoe(p) { return p.hit.q[1] < -0.45 ? M.boot[0] : cel(M.boot, L(p), lb(p) + 0.05); },
  skirt: { len: 7, flare: 1.8, mat: p => (p.t > 0.86 ? cel(M.tunic, L(p), -0.35) : Math.sin(Math.atan2(p.z, p.f) * 5) > 0.75 ? cel(M.tunic, L(p), -0.25) : cel(M.tunic, L(p))) },
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
  armR: [1.8, 1.55, 1.25], legR: [2.2, 1.6, 1.3], neckR: 1.3, hand: 0.9,
  skin: GIRL_SKIN, ink: hex('#24141a'),
  torso(p) {
    const l = L(p);
    // big cream sailor-ish collar and the sweater's ribbed hem
    if (p.hh > 0.8 && (p.f > 0.5 || p.hh > 0.9)) return cel(J.collar, l, 0.1);
    if (p.hh < 0.2) return (Math.floor((p.z + 10) * 1.4) % 2 === 0) ? cel(J.top, l, -0.25) : cel(J.top, l);
    // a little cat print on the chest
    if (p.f > 2.4 && p.hh > 0.52 && p.hh < 0.66 && Math.abs(p.z + 0.8) < 1.1) return cel(J.collar, l, 0.2);
    return cel(J.top, l);
  },
  upperArm(p) { return cel(J.top, L(p), lb(p)); },
  foreArm(p) { return p.t > 0.8 ? cel(J.top, L(p), lb(p) - 0.3) : cel(J.top, L(p), lb(p)); },
  hands(p) { return cel(GIRL_SKIN, L(p), lb(p) + 0.1); },
  thigh(p) { return cel(J.legs, L(p), lb(p) + 0.1); },
  shin(p) { return cel(J.legs, L(p), lb(p) + 0.1); },
  shoe(p) { return p.hit.q[1] < -0.45 ? J.shoe[1] : cel(J.shoe, L(p), lb(p) + 0.1); },
  skirt: { len: 9, flare: 3.2, top: 3.6, mat: p => (Math.sin(Math.atan2(p.z, p.f) * 7) > 0.55 ? cel(J.skirt, L(p), -0.3) : cel(J.skirt, L(p), 0.05)) },
};

// ------------------------------------------------------------------ Aroha
const A = {
  top: R6('#2a2014', '#4a3820', '#6e5434', '#9c7a4c', '#b8945e', '#d0ae78'),
  skirt: R6('#141408', '#262618', '#3a3a24', '#4c4c30', '#60603e', '#76764e'),
  sandal: R6('#1a0e08', '#3a2414', '#50321c', '#6a4428', '#845a38', '#a0744a'),
};
export const AROHA7: Char7 = {
  id: 'aroha',
  build: { hipH: 26.4, thigh: 12.4, shin: 12.2, ankleH: 2.1, torso: 17.8, neck: 1.3, shY: 2.2, shF: 0, shB: 0, upArm: 9, foreArm: 8.2, legF: 0, legB: 0 },
  shW: 4.6, hipW: 2.8, chest: [3.3, 4.1], waist: [2.5, 3.1], pelvis: [3.0, 3.7],
  armR: [1.75, 1.5, 1.25], legR: [2.2, 1.65, 1.3], neckR: 1.3, hand: 0.9,
  skin: DARK_SKIN, ink: hex('#140a08'),
  torso(p) {
    const l = L(p);
    // sleeveless: shoulders bare; a taniko band (red, black, white zigzag) across the chest
    if (p.hh > 0.86 && Math.abs(p.z) > 2.6) return cel(DARK_SKIN, l);
    if (p.hh > 0.9 && p.f > 1.2) return cel(DARK_SKIN, l, -0.1);
    if (p.hh > 0.62 && p.hh < 0.74) {
      const k = Math.floor((p.z + 20) * 1.2);
      const zig = Math.abs(((p.hh - 0.62) / 0.12) * 4 - ((k % 4) < 2 ? k % 2 : 1 - (k % 2)) * 4) < 1.4;
      return zig ? hex('#1e1418') : (p.hh < 0.64 || p.hh > 0.72) ? hex('#f0e2c8') : hex('#b8342a');
    }
    // pounamu on its cord
    if (p.f > 2.8 && p.hh > 0.74 && p.hh < 0.82 && Math.abs(p.z) < 0.7) return hex('#3aa06c');
    return cel(A.top, l);
  },
  upperArm(p) { return cel(DARK_SKIN, L(p), lb(p)); },
  foreArm(p) { return p.t > 0.84 ? cel(A.skirt, L(p), lb(p)) : cel(DARK_SKIN, L(p), lb(p)); },
  hands(p) { return cel(DARK_SKIN, L(p), lb(p) + 0.1); },
  thigh(p) { return cel(DARK_SKIN, L(p), lb(p)); },
  shin(p) { return p.t > 0.9 ? cel(A.sandal, L(p), lb(p)) : cel(DARK_SKIN, L(p), lb(p)); },
  shoe(p) { return p.hit.q[1] < -0.35 ? cel(A.sandal, L(p), lb(p)) : Math.abs(p.hit.q[0]) < 0.25 ? cel(A.sandal, L(p), lb(p) + 0.2) : cel(DARK_SKIN, L(p), lb(p)); },
  skirt: { len: 8, flare: 2.6, top: 3.4, mat: p => (p.t > 0.88 ? hex('#8a2e22') : Math.sin(Math.atan2(p.z, p.f) * 4 + p.t * 3) > 0.8 ? cel(A.skirt, L(p), -0.3) : cel(A.skirt, L(p))) },
};

// ------------------------------------------------------------------ Joshu
const Jo = {
  knit: R6('#0a0c16', '#161a2c', '#222a44', '#303a5a', '#3e4a70', '#4e5c86'),
  trousers: R6('#0c0a08', '#1a1814', '#2a2620', '#3a342c', '#4a4238', '#5a5246'),
  boot: R6('#040304', '#0e0a0c', '#1a1416', '#262022', '#342c2e', '#443a3c'),
};
const knitM = (p: Part, bias = 0): C => {
  // cable-knit: twisted ropes running down the gansey
  const rope = Math.abs(Math.sin((p.z * 1.6) + Math.sin(p.hh * 30) * 0.6)) > 0.93;
  return rope ? cel(Jo.knit, L(p), bias - 0.35) : cel(Jo.knit, L(p), bias);
};
export const JOSHU7: Char7 = {
  id: 'joshu',
  build: { hipH: 28.6, thigh: 13.6, shin: 13.2, ankleH: 2.4, torso: 23.5, neck: 1, shY: 3, shF: 0, shB: 0, upArm: 10.8, foreArm: 9.6, legF: 0, legB: 0 },
  shW: 7.4, hipW: 3.8, chest: [4.6, 6.4], waist: [4.8, 5.6], pelvis: [4.2, 5.0], belly: 3.4,
  armR: [2.9, 2.5, 2.1], legR: [3.2, 2.5, 2.1], neckR: 2.3, hand: 1.35,
  skin: JOSHU_SKIN, ink: hex('#1c1012'),
  torso(p) {
    if (p.hh < 0.1) return cel(Jo.knit, L(p), -0.3); // ribbed hem
    if (p.hh > 0.92) return cel(Jo.knit, L(p), -0.2); // roll collar
    return knitM(p);
  },
  upperArm(p) { return knitM(p, lb(p)); },
  // rolled sleeves: hairy forearms with an anchor tattoo on the near one
  foreArm(p) {
    if (p.t < 0.28) return cel(Jo.knit, L(p), lb(p) + 0.15);
    if (p.near && p.t > 0.45 && p.t < 0.65 && Math.abs(p.hit.q[1] - 0.6) < 0.5) return hex('#3a5a8a');
    return cel(JOSHU_SKIN, L(p), lb(p));
  },
  hands(p) { return cel(JOSHU_SKIN, L(p), lb(p) + 0.1); },
  thigh(p) { return cel(Jo.trousers, L(p), lb(p)); },
  shin(p) { return p.t > 0.45 ? cel(Jo.boot, L(p), lb(p) + 0.1) : cel(Jo.trousers, L(p), lb(p)); },
  shoe(p) { return p.hit.q[1] < -0.45 ? Jo.boot[0] : cel(Jo.boot, L(p), lb(p) + 0.1, true); },
};

export const CAST7: Record<string, Char7> = { mori: MORI7, jenna: JENNA7, aroha: AROHA7, joshu: JOSHU7 };

export const INFO7: Record<string, { name: string; short: string; voice: number; height: number }> = {
  mori: { name: 'Mori', short: 'Mori', voice: 1, height: 62 },
  jenna: { name: 'Jenna', short: 'Jenna', voice: 1.5, height: 57 },
  joshu: { name: 'Joshu', short: 'Joshu', voice: 0.62, height: 72 },
  aroha: { name: 'Aroha', short: 'Aroha', voice: 1.12, height: 59 },
  chunk: { name: 'Chunk', short: 'Chunk', voice: 1.3, height: 16 },
};

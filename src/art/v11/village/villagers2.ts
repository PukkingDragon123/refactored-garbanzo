// V11: more people of Te Kāinga, built like the V10 villagers (src/art/v10/villagers.ts) on the V7
// cast: bodies from the pose library lifted into 3D, small 3D heads, registered into the cast tables
// at runtime so actors, bubbles and the pose library treat them like anyone else.
//   Hēmi     - Rāwiri's father, the carver: big and broad, a grey crop and goatee, a black singlet,
//              canvas shorts, a carver's leather apron, bare feet
//   Ngaio    - Aroha's aunty (her mother's younger sister), the musician who keeps the hue kiri songs:
//              long braid, a tāniko headband, a deep teal wrap top, a long striped skirt
//   Nanny Huia - Koro's sister, the kuia who runs the hāngī: silver hair in a bun under a scarf, a
//              black dress with little flowers, a maroon cardigan, slippers
//   Tamati   - Whaea Mere's husband, the gardener: black curls, a red-checked bush shirt, dark work
//              trousers and black gumboots
//   Tipene   - Mere and Tamati's son, fifteen, who looks after the animals: a backwards cap, a grey
//              hoodie, board shorts, jandals
//   Mikaere  - a small boy, always running: blue t-shirt, shorts, bare feet
//   Ani      - a girl of ten, Pīpī's best friend and rival: two puffs of hair, a purple dress

import { hex } from '../../color';
import { cel } from '../../v7/raster';
import type { Ramp6 } from '../../v7/raster';
import type { Char7, Part } from '../../v7/body';
import { CAST7, INFO7, AROHA7, JOSHU7, MORI7, JENNA7 } from '../../v7/cast';
import { HEADS7 } from '../../v7/head';
import type { HeadDef7, Lock } from '../../v7/head';
import { CHAR_INFO, CHAR_ANIMS } from '../../v7';
import { CHAR_NAMES, CHAR_COLORS, CHAR_VOICE } from '../../../world/actor';
import { registerVillagers } from '../../v10/villagers';
import { registerVillageAnims } from './anims';

const R6 = (...h: string[]): Ramp6 => h.map(v => hex(v));
const L = (p: Part) => p.hit.l;
const lb = (p: Part) => (p.near ? 0 : -0.28);

const SKIN_A = R6('#2a1610', '#5e3624', '#80502e', '#a06a46', '#bc855e', '#d49c74');
const SKIN_B = R6('#26120c', '#52301c', '#74462a', '#94603e', '#b07a54', '#c8926a');
const SKIN_C = R6('#2e1a12', '#64402a', '#8a5a38', '#aa7650', '#c48e66', '#daa880');
const SKIN_KID = R6('#2c1812', '#603a26', '#865632', '#a8724c', '#c48c62', '#dca67c');

// ------------------------------------------------------------------ Hēmi, the carver
const SINGLET = R6('#060606', '#101012', '#1a1a1e', '#26262c', '#34343c', '#44444e');
const CANVAS = R6('#1e1a10', '#3a3420', '#5a5030', '#7a6c44', '#968858', '#b0a272');
const APRON = R6('#1a0c06', '#3a2010', '#5a3418', '#7a4a24', '#966034', '#b07a48');
const HEMI: Char7 = {
  ...JOSHU7, id: 'hemi',
  build: { ...JOSHU7.build, torso: 22, hipH: 27.4 },
  belly: 2.2,
  skin: SKIN_B, ink: hex('#120806'),
  torso: p => {
    // the apron's bib over the singlet, a neck strap, the singlet's scoop showing skin above
    if (p.hh > 0.88 && p.f > 0.8) return cel(SKIN_B, L(p), -0.1);
    if (p.f > 1.4 && p.hh < 0.8 && Math.abs(p.z) < 3.4) return Math.floor(p.hh * 30) % 9 === 0 ? cel(APRON, L(p), -0.3) : cel(APRON, L(p));
    if (p.hh > 0.78 && Math.abs(p.z) > 2.6 && Math.abs(p.z) < 3.6) return cel(APRON, L(p), -0.2);
    return cel(SINGLET, L(p));
  },
  upperArm: p => (p.t < 0.12 ? cel(SINGLET, L(p), lb(p)) : cel(SKIN_B, L(p), lb(p))),
  foreArm: p => cel(SKIN_B, L(p), lb(p)),
  hands: p => cel(SKIN_B, L(p), lb(p) + 0.1),
  thigh: p => cel(CANVAS, L(p), lb(p)),
  shin: p => cel(SKIN_B, L(p), lb(p)),
  shoe: p => cel(SKIN_B, L(p), lb(p) - 0.15),
  skirt: { len: 9, flare: 1.4, top: 3, mat: p => (p.f > 0.6 ? cel(APRON, L(p), Math.sin(p.z * 2) > 0.8 ? -0.25 : 0) : cel(CANVAS, L(p), -0.1)) },
};

// ------------------------------------------------------------------ Ngaio, the musician
const TEAL = R6('#04141a', '#0a2a34', '#14424e', '#1e5c68', '#2c7a84', '#46a0a4');
const STRIPE = R6('#0c0806', '#1e1410', '#30201a', '#442e24', '#5a3e30', '#725040');
const NGAIO: Char7 = {
  ...AROHA7, id: 'ngaio',
  build: { ...AROHA7.build, torso: 18.4 },
  chest: [3.5, 4.4], waist: [2.8, 3.4], pelvis: [3.3, 4.0],
  skin: SKIN_A, ink: hex('#120806'),
  extras: undefined,
  torso: p => {
    // a wrap top crossing over the front, a pounamu pendant on a cord at the neck
    if (p.hh > 0.86 && p.f > 1.0 && Math.abs(p.z) < (p.hh - 0.82) * 26) return Math.abs(p.z) < 0.6 && p.hh < 0.92 ? hex('#3aa86a') : cel(SKIN_A, L(p), -0.1);
    const wrap = Math.abs(p.z - (p.hh - 0.5) * 6) < 0.5 && p.f > 0.5;
    return cel(TEAL, L(p), wrap ? -0.3 : 0);
  },
  upperArm: p => cel(TEAL, L(p), lb(p)),
  foreArm: p => (p.t > 0.35 ? cel(SKIN_A, L(p), lb(p)) : cel(TEAL, L(p), lb(p) - 0.1)),
  hands: p => cel(SKIN_A, L(p), lb(p) + 0.1),
  thigh: p => cel(STRIPE, L(p), lb(p)),
  shin: p => cel(SKIN_A, L(p), lb(p)),
  shoe: p => cel(STRIPE, L(p), lb(p) + 0.2),
  // a long skirt with a red and cream tāniko band near the hem
  skirt: { len: 19, flare: 3.0, top: 3.4, mat: p => {
    if (p.t > 0.78 && p.t < 0.9) { const k = Math.floor((Math.atan2(p.z, p.f) + 4) * 5); return k % 3 === 0 ? hex('#1a1010') : k % 3 === 1 ? hex('#a8322a') : hex('#e8dcc0'); }
    return Math.floor(p.t * 14) % 3 === 0 ? cel(STRIPE, L(p), 0.25) : cel(STRIPE, L(p));
  } },
};

// ------------------------------------------------------------------ Nanny Huia, the kuia
const DRESS = R6('#060406', '#100c10', '#1a141a', '#262028', '#342c36', '#443a46');
const CARDI = R6('#1a0608', '#3a0e14', '#5a1820', '#78242c', '#94323a', '#ae4650');
const HUIA: Char7 = {
  ...AROHA7, id: 'huia',
  build: { ...AROHA7.build, hipH: 24.4, thigh: 11.6, shin: 11.2, torso: 17.6, upArm: 8.6, foreArm: 7.8 },
  shW: 4.8, hipW: 3.1, chest: [3.8, 4.6], waist: [3.6, 4.4], pelvis: [3.8, 4.5], belly: 1.4,
  armR: [1.9, 1.6, 1.3], legR: [2.3, 1.8, 1.4], neckR: 1.4,
  skin: SKIN_C, ink: hex('#140a08'),
  extras: undefined,
  torso: p => {
    // the cardigan open over the dress; little pink flowers on the black
    if (p.f > 1.2 && Math.abs(p.z) < 1.8) return ((Math.floor(p.hh * 40) + Math.floor(p.z * 3)) % 7 === 0) ? hex('#d07898') : cel(DRESS, L(p));
    if (p.hh > 0.9 && p.f > 0.8) return cel(SKIN_C, L(p), -0.1);
    return cel(CARDI, L(p), Math.floor(p.hh * 30) % 6 === 0 ? -0.2 : 0);
  },
  upperArm: p => cel(CARDI, L(p), lb(p)),
  foreArm: p => (p.t > 0.8 ? cel(SKIN_C, L(p), lb(p)) : cel(CARDI, L(p), lb(p))),
  hands: p => cel(SKIN_C, L(p), lb(p) + 0.1),
  thigh: p => cel(DRESS, L(p), lb(p)),
  shin: p => cel(SKIN_C, L(p), lb(p)),
  shoe: p => cel(R6('#140a0c', '#2a1418', '#40202a', '#58303c', '#704050', '#885466'), L(p), lb(p)),
  skirt: { len: 15, flare: 3.0, top: 3.4, mat: p => ((Math.floor(p.t * 30) + Math.floor(Math.atan2(p.z, p.f) * 6)) % 9 === 0 ? hex('#d07898') : cel(DRESS, L(p))) },
};

// ------------------------------------------------------------------ Tamati, the gardener
const CHECK_A = R6('#1a0404', '#3e0a08', '#64140e', '#8a2016', '#ac3020', '#cc4a30');
const CHECK_B = R6('#060404', '#120c0a', '#1e1612', '#2a201a', '#382a22', '#46362c');
const WORK = R6('#06080a', '#101418', '#1a2026', '#262e36', '#323c46', '#424e5a');
const GUMBOOT = R6('#020203', '#08080a', '#101114', '#1a1b20', '#26282e', '#36383e');
const check = (p: Part, bias = 0) => ((Math.floor(p.hh * 22 + 40) + Math.floor(p.z * 1.4 + 40)) % 2 === 0 ? cel(CHECK_A, L(p), bias) : cel(CHECK_B, L(p), bias + 0.1));
const TAMATI: Char7 = {
  ...MORI7, id: 'tamati',
  build: { ...MORI7.build, torso: 19.6 },
  chest: [3.7, 5.2], waist: [3.4, 4.2], belly: 1,
  skin: SKIN_A, ink: hex('#120806'),
  torso: p => (p.hh > 0.9 && p.f > 1.6 && Math.abs(p.z) < (p.hh - 0.9) * 18 ? cel(SKIN_A, L(p), -0.2) : check(p)),
  upperArm: p => check({ ...p, hh: p.t * 0.5 }, lb(p)),
  foreArm: p => (p.t > 0.4 ? cel(SKIN_A, L(p), lb(p)) : check({ ...p, hh: p.t }, lb(p) - 0.15)),
  hands: p => cel(SKIN_A, L(p), lb(p) + 0.1),
  fingers: undefined,
  thigh: p => cel(WORK, L(p), lb(p)),
  shin: p => (p.t > 0.3 ? cel(GUMBOOT, L(p), lb(p) + 0.2, true) : cel(WORK, L(p), lb(p))),
  shoe: p => cel(GUMBOOT, L(p), lb(p) + 0.1, true),
  shoeK: [1.1, 1.15, 1.1],
  skirt: { len: 4, flare: 0.6, mat: p => check(p, -0.1) },
};

// ------------------------------------------------------------------ Tipene, the teenager
const HOODIE = R6('#14161a', '#2c3036', '#464c54', '#626a72', '#808892', '#a0a8b0');
const BOARD = R6('#04081a', '#0a1434', '#12224e', '#1c3268', '#2a4686', '#3e5ea4');
const TIPENE: Char7 = {
  ...MORI7, id: 'tipene',
  build: { ...MORI7.build, hipH: 24.6, thigh: 11.8, shin: 11.4, torso: 16.6, upArm: 8.6, foreArm: 7.8 },
  shW: 4.8, hipW: 2.5, chest: [2.9, 4.1], waist: [2.5, 3.2], pelvis: [2.7, 3.2],
  armR: [1.7, 1.45, 1.25], legR: [2.1, 1.7, 1.4], neckR: 1.5, hand: 1.02,
  skin: SKIN_KID, ink: hex('#120806'),
  torso: p => {
    // the hoodie: a front pocket, drawstrings
    if (p.f > 2 && p.hh > 0.2 && p.hh < 0.42 && Math.abs(p.z) < 2.4) return cel(HOODIE, L(p), -0.25);
    if (p.f > 2 && p.hh > 0.7 && p.hh < 0.9 && Math.abs(Math.abs(p.z) - 0.8) < 0.25) return hex('#e8e8e8');
    return cel(HOODIE, L(p));
  },
  upperArm: p => cel(HOODIE, L(p), lb(p)),
  foreArm: p => (p.t > 0.85 ? cel(HOODIE, L(p), lb(p) - 0.3) : cel(HOODIE, L(p), lb(p))),
  hands: p => cel(SKIN_KID, L(p), lb(p) + 0.1),
  fingers: undefined,
  thigh: p => (p.t > 0.7 ? cel(SKIN_KID, L(p), lb(p)) : cel(BOARD, L(p), lb(p))),
  shin: p => cel(SKIN_KID, L(p), lb(p)),
  shoe: p => (p.hit.q[1] < -0.3 ? hex('#1a1a1a') : cel(SKIN_KID, L(p), lb(p) - 0.15)),
  skirt: { len: 3, flare: 0.5, mat: p => cel(HOODIE, L(p), -0.25) },
};

// ------------------------------------------------------------------ the kids
const TEE = R6('#04101e', '#0a2040', '#123266', '#1c468a', '#2c5eaa', '#4a7ec8');
const KHAKI = R6('#14120a', '#2a2616', '#423c24', '#5a5232', '#746a44', '#8e8458');
const kid = (b: Char7) => ({ ...b.build, hipH: 15.6, thigh: 7.4, shin: 7.2, torso: 11.6, upArm: 5.8, foreArm: 5.2 });
const MIKAERE: Char7 = {
  ...JENNA7, id: 'mikaere',
  build: kid(JENNA7),
  shW: 3.3, hipW: 2.1, chest: [2.5, 3.1], waist: [2.4, 2.9], pelvis: [2.4, 2.9],
  armR: [1.3, 1.15, 1.0], legR: [1.6, 1.25, 1.05], neckR: 1.05, hand: 0.82,
  skin: SKIN_KID, ink: hex('#140a08'),
  torso: p => (p.f > 2 && p.hh > 0.45 && p.hh < 0.62 && Math.abs(p.z) < 1.2 ? hex('#f0c040') : cel(TEE, L(p))),
  upperArm: p => (p.t < 0.5 ? cel(TEE, L(p), lb(p)) : cel(SKIN_KID, L(p), lb(p))),
  foreArm: p => cel(SKIN_KID, L(p), lb(p)),
  hands: p => cel(SKIN_KID, L(p), lb(p) + 0.1),
  thigh: p => (p.t < 0.6 ? cel(KHAKI, L(p), lb(p)) : cel(SKIN_KID, L(p), lb(p))),
  shin: p => cel(SKIN_KID, L(p), lb(p)),
  shoe: p => cel(SKIN_KID, L(p), lb(p) - 0.15),
  skirt: { len: 2.6, flare: 0.6, top: 2.4, mat: p => cel(TEE, L(p), -0.2) },
};
const PURPLE = R6('#16061e', '#2e0e40', '#4a1a62', '#682a84', '#8640a4', '#a85ec4');
const ANI: Char7 = {
  ...JENNA7, id: 'ani',
  build: { ...kid(JENNA7), hipH: 17.2, thigh: 8.2, shin: 8.0, torso: 12.6 },
  shW: 3.4, hipW: 2.2, chest: [2.6, 3.2], waist: [2.4, 2.9], pelvis: [2.5, 3.0],
  armR: [1.35, 1.15, 1.0], legR: [1.65, 1.3, 1.05], neckR: 1.1, hand: 0.84,
  skin: SKIN_KID, ink: hex('#140a08'),
  torso: p => cel(PURPLE, L(p), p.hh > 0.85 ? 0.2 : 0),
  upperArm: p => (p.t < 0.3 ? cel(PURPLE, L(p), lb(p)) : cel(SKIN_KID, L(p), lb(p))),
  foreArm: p => cel(SKIN_KID, L(p), lb(p)),
  hands: p => cel(SKIN_KID, L(p), lb(p) + 0.1),
  thigh: p => cel(SKIN_KID, L(p), lb(p)),
  shin: p => cel(SKIN_KID, L(p), lb(p)),
  shoe: p => (p.hit.q[1] < -0.3 ? hex('#f0f0f0') : cel(R6('#0a0a10', '#c0c0d0', '#d8d8e4', '#e8e8f0', '#f4f4f8', '#ffffff'), L(p), lb(p))),
  skirt: { len: 7, flare: 2.4, top: 2.4, mat: p => (p.t > 0.86 ? cel(PURPLE, L(p), 0.3) : cel(PURPLE, L(p))) },
};

// ------------------------------------------------------------------ heads
const BLACK = R6('#060304', '#140c0a', '#221410', '#321e18', '#4a2e24', '#6a4434');
const GREY = R6('#3a3634', '#5e5a56', '#86827c', '#aaa6a0', '#ccc8c2', '#ebe8e2');
const SILVER = R6('#4a4648', '#76726e', '#a29e98', '#c6c2bc', '#e2ded8', '#f8f6f2');
const hemiHead: HeadDef7 = {
  ...HEADS7.joshu, skin: SKIN_B, hair: GREY, ink: hex('#120806'), eyeStyle: 'dot', eyeCol: '#120806', brow: '#3a3634', blush: '#b0604a',
  // a close grey crop over the skull (no cap), a short grey goatee
  shell: [[-0.8, 8.9, 0], [5.8, 5.5, 5.5]],
  cut: q => q[0] > 0.25 || q[1] < 0.2,
  locks: [],
  extras: (s, W) => {
    s.ellipsoid(W([3.6, 1.6, 0]), W([2.2, 0, 0]), [0, 2.8, 0], W([0, 0, 2.2]), 10, h => cel(GREY, h.l, Math.sin(h.y * 2.1) > 0.7 ? -0.3 : 0.1));
    s.ellipsoid(W([5.2, 4.2, 0]), W([1.2, 0, 0]), [0, 0.7, 0], W([0, 0, 2.6]), 11, h => cel(GREY, h.l, 0.1));
  },
};
const longBraid: Lock[] = [
  { a: [-3.2, 9.6, 0], b: [-5.4, 4.4, 0.4], r0: 1.9, r1: 1.4, sway: 0.6 },
  { a: [-5.4, 4.4, 0.4], b: [-6.0, -2.4, 0.8], r0: 1.4, r1: 1.0, sway: 1 },
  { a: [-6.0, -2.4, 0.8], b: [-5.8, -8.0, 1.0], r0: 1.0, r1: 0.5, sway: 1 },
];
const ngaioHead: HeadDef7 = {
  ...HEADS7.aroha, skin: SKIN_A, hair: BLACK, ink: hex('#120806'),
  locks: [...HEADS7.aroha.locks.slice(0, 5), ...longBraid],
  // a red and black tāniko headband across the crown
  extras: (s, W) => {
    s.ellipsoid(W([-0.3, 11.6, 0]), W([5.4, 0, 0]), [0, 0.9, 0], W([0, 0, 5.0]), 12, h => (Math.floor((h.x + h.y) / 2) % 3 === 0 ? hex('#e8dcc0') : Math.floor((h.x + h.y) / 2) % 3 === 1 ? hex('#a8322a') : hex('#1a1010')));
  },
};
const huiaHead: HeadDef7 = {
  ...HEADS7.aroha, skin: SKIN_C, hair: SILVER, ink: hex('#140a08'), brow: '#c8c4be', blush: '#b0604a',
  locks: [...HEADS7.aroha.locks.slice(0, 5), { a: [-3, 11, 0], b: [-5.8, 12.4, 0], r0: 3.0, r1: 2.4 }],
  // a dark headscarf tied at the back over the bun
  extras: (s, W) => {
    s.ellipsoid(W([-0.6, 11.4, 0]), W([5.3, 0, 0]), [0, 3.4, 0], W([0, 0, 5.1]), 12, h => (h.q[1] < -0.2 ? -1 : cel(R6('#0a0812', '#1a1430', '#2a2048', '#3a2e60', '#4c3e78', '#5e5090'), h.l, Math.floor(h.x / 2) % 3 === 0 ? 0.3 : 0)));
  },
};
const tamatiHead: HeadDef7 = {
  ...HEADS7.mori, skin: SKIN_A, hair: BLACK, ink: hex('#120806'),
  // short black curls
  locks: [
    { a: [2.6, 12.8, 1.8], b: [3.6, 12.2, 2.6], r0: 1.8, r1: 1.2 }, { a: [2.6, 13.2, -1.2], b: [3.8, 12.6, -1.6], r0: 1.8, r1: 1.2 },
    { a: [0, 13.8, 1.6], b: [0.4, 14.6, 2.2], r0: 1.9, r1: 1.3 }, { a: [-1.6, 13.4, -1.4], b: [-2.2, 14.2, -1.8], r0: 1.9, r1: 1.3 },
    { a: [-3.4, 11.6, 1.8], b: [-4.4, 11.4, 2.4], r0: 1.8, r1: 1.2 }, { a: [-3.6, 10, -1.6], b: [-4.6, 9.4, -2.2], r0: 1.8, r1: 1.2 },
  ],
};
const tipeneHead: HeadDef7 = {
  ...HEADS7.mori, skin: SKIN_KID, hair: BLACK, ink: hex('#120806'),
  locks: HEADS7.mori.locks.slice(0, 4).map(l => ({ ...l, b: [l.b[0] - 0.6, l.b[1] + 0.6, l.b[2]] as Lock['b'] })),
  // a cap on backwards: the crown and the peak over the nape
  extras: (s, W) => {
    const cap = R6('#020812', '#06142a', '#0c2242', '#14325c', '#20467a', '#305e98');
    s.ellipsoid(W([-0.4, 12.8, 0]), W([5.6, 0, 0]), [0, 3.0, 0], W([0, 0, 5.4]), 12, h => (h.q[1] < -0.1 ? -1 : cel(cap, h.l, 0)));
    s.ellipsoid(W([-5.6, 12.4, 0]), W([2.6, 0.4, 0]), [0, 0.35, 0], W([0, 0, 3.6]), 13, h => cel(cap, h.l, -0.3));
    s.dot(W([-0.2, 15.6, 0]), hex('#f0f0f0'), 1);
  },
};
const mikaereHead: HeadDef7 = {
  ...HEADS7.jenna, skin: SKIN_KID, hair: BLACK, ink: hex('#140a08'), blush: '#d07060',
  // a short mop, cowlick at the crown
  locks: [
    ...[-2, 0, 2].map((z): Lock => ({ a: [2.4, 12.4, z], b: [4.6, 10.2, z * 1.1], r0: 1.5, r1: 0.5 })),
    { a: [-1, 13.4, 0], b: [-1.6, 15.6, 0.6], r0: 1.2, r1: 0.3 },
    { a: [-3.4, 10.6, 1.6], b: [-4.8, 8.2, 2.2], r0: 1.6, r1: 0.5, sway: 0.5 }, { a: [-3.4, 10.6, -1.6], b: [-4.8, 8.2, -2.2], r0: 1.6, r1: 0.5, sway: 0.5 },
  ],
  browHidden: false,
};
const aniHead: HeadDef7 = {
  ...HEADS7.jenna, skin: SKIN_KID, hair: BLACK, ink: hex('#140a08'), blush: '#d07060',
  locks: [...[-2.4, -0.8, 0.8, 2.4].map((z): Lock => ({ a: [2.6, 12.2, z], b: [4.8, 10, z * 1.1], r0: 1.4, r1: 0.5 }))],
  // two puffs of hair, high on each side
  extras: (s, W) => {
    const m = (h: { l: number }) => cel(BLACK, h.l, 0.05);
    s.ellipsoid(W([-1.4, 13.8, 4.2]), W([2.4, 0, 0]), [0, 2.4, 0], W([0, 0, 2.4]), 12, m);
    s.ellipsoid(W([-1.4, 13.8, -4.2]), W([2.4, 0, 0]), [0, 2.4, 0], W([0, 0, 2.4]), 12, m);
    s.dot(W([-0.6, 13.6, 2.6]), hex('#f0c040'), 1);
  },
};

/** everyone at Te Kāinga: id -> name, look, and how they are described (the village module reads it) */
export const VILLAGERS2: Record<string, { name: string; age: string; role: string }> = {
  hemi: { name: 'Uncle Hēmi', age: 'fifties', role: 'the carver, Rāwiri’s father' },
  ngaio: { name: 'Aunty Ngaio', age: 'thirties', role: 'the musician, Aroha’s aunty' },
  huia: { name: 'Nanny Huia', age: 'seventies', role: 'the kuia, Koro’s sister, keeper of the hāngī' },
  tamati: { name: 'Tamati', age: 'forties', role: 'the gardener, Whaea Mere’s husband' },
  tipene: { name: 'Tipene', age: '15', role: 'Mere and Tamati’s son, keeps the animals' },
  mikaere: { name: 'Mikaere', age: '7', role: 'a small boy, always running' },
  ani: { name: 'Ani', age: '10', role: 'Pīpī’s best friend and rival' },
};

let done = false;
/** add every villager (the V10 four and these seven) to the cast tables (idempotent) */
export function registerAllVillagers() {
  registerVillagers();
  registerVillageAnims();
  if (done) return;
  done = true;
  const add = (id: string, ch: Char7, head: HeadDef7, name: string, height: number, voice: number, color: string, like: string) => {
    CAST7[id] = ch;
    HEADS7[id] = head;
    INFO7[id] = { name, short: name, voice, height };
    CHAR_INFO[id] = INFO7[id];
    CHAR_ANIMS[id] = CHAR_ANIMS[like];
    CHAR_NAMES[id] = name;
    CHAR_COLORS[id] = color;
    CHAR_VOICE[id] = voice;
  };
  add('hemi', HEMI, hemiHead, 'Uncle Hēmi', 68, 0.66, '#5a3418', 'joshu');
  add('ngaio', NGAIO, ngaioHead, 'Aunty Ngaio', 61, 1.05, '#1e5c68', 'aroha');
  add('huia', HUIA, huiaHead, 'Nanny Huia', 55, 0.92, '#78242c', 'aroha');
  add('tamati', TAMATI, tamatiHead, 'Tamati', 63, 0.8, '#8a2016', 'mori');
  add('tipene', TIPENE, tipeneHead, 'Tipene', 56, 1.05, '#464c54', 'mori');
  add('mikaere', MIKAERE, mikaereHead, 'Mikaere', 38, 1.8, '#1c468a', 'jenna');
  add('ani', ANI, aniHead, 'Ani', 42, 1.65, '#682a84', 'jenna');
  // the anims registered after the cast tables were built join every human's list
  for (const id of Object.keys(CHAR_ANIMS)) {
    if (id === 'chunk') continue;
    const list = CHAR_ANIMS[id];
    for (const a of ['strum', 'strumSit', 'snakeDance', 'storyTell', 'offer', 'bless']) if (!list.includes(a)) list.push(a);
  }
}

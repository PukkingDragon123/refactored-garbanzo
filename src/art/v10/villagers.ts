// V10: the people of Te Kāinga, Aroha's whānau, built on the V7 anime cast (bodies from the pose
// library lifted into 3D, small 3D heads). Registered at runtime into the cast tables so actors, the
// speech bubbles and the pose library treat them like anyone else (their dialogue portraits fall back
// to the default design; close-ups stay with the main cast).
//   Koro Wiremu - Aroha's grandfather, white hair and beard, a feather cloak over a flax skirt, a staff
//   Whaea Mere  - Aroha's aunt, the weaver: hair in a bun, a red taniko top, a long dark skirt
//   Rāwiri      - her cousin, a fisherman: topknot, a green work shirt rolled up, dark shorts
//   Pīpī        - her little cousin, small, quick and very curious

import { hex } from '../color';
import { cel } from '../v7/raster';
import type { Ramp6 } from '../v7/raster';
import type { Char7, Part } from '../v7/body';
import { CAST7, INFO7, AROHA7, JOSHU7, MORI7, JENNA7 } from '../v7/cast';
import { HEADS7 } from '../v7/head';
import type { HeadDef7, Lock } from '../v7/head';
import { CHAR_INFO, CHAR_ANIMS } from '../v7';
import { CHAR_NAMES, CHAR_COLORS, CHAR_VOICE } from '../../world/actor';

const R6 = (...h: string[]): Ramp6 => h.map(v => hex(v));
const L = (p: Part) => p.hit.l;
const lb = (p: Part) => (p.near ? 0 : -0.28);
const SKIN = R6('#2a1610', '#5e3624', '#80502e', '#a06a46', '#bc855e', '#d49c74');
const SKIN2 = R6('#2a1410', '#56301e', '#784a2a', '#966040', '#b27a56', '#c8906a');

const FLAX = R6('#2a2010', '#4a3a1c', '#6a5428', '#8c7238', '#ac904c', '#c8aa62');
const CLOAK = R6('#3a3228', '#6a5e4c', '#9a8c74', '#c4b69a', '#e2d6bc', '#f6eedc');
const KORO: Char7 = {
  ...JOSHU7, id: 'koro',
  build: { ...JOSHU7.build, torso: 21, hipH: 27.6 },
  shW: 6.8, hipW: 3.2, chest: [4.2, 5.8], waist: [3.8, 4.8], pelvis: [3.6, 4.4], belly: 1.2,
  armR: [2.6, 2.2, 1.9], legR: [2.8, 2.2, 1.8], neckR: 2.2, hand: 1.3,
  skin: SKIN2, ink: hex('#140a08'),
  // a feather cloak (korowai): cream with dark tassel rows and a taniko border at the hem
  torso: p => { if (p.hh < 0.12) return (Math.floor((p.z + 20) * 1.5) % 3 === 0 ? hex('#1e1418') : hex('#b8342a')); return Math.floor(p.hh * 22) % 4 === 0 && (Math.floor(p.z * 2) % 2 === 0) ? cel(CLOAK, L(p), -0.5) : cel(CLOAK, L(p)); },
  upperArm: p => cel(CLOAK, L(p), lb(p) - 0.1),
  foreArm: p => (p.t > 0.4 ? cel(SKIN2, L(p), lb(p)) : cel(CLOAK, L(p), lb(p) - 0.1)),
  hands: p => cel(SKIN2, L(p), lb(p) + 0.1),
  thigh: p => cel(FLAX, L(p), lb(p)),
  shin: p => (p.t > 0.9 ? cel(FLAX, L(p), lb(p) - 0.3) : cel(SKIN2, L(p), lb(p))),
  shoe: p => cel(FLAX, L(p), lb(p) - 0.2),
  skirt: { len: 12, flare: 2.4, top: 3, mat: p => (Math.sin(Math.atan2(p.z, p.f) * 9) > 0.6 ? cel(FLAX, L(p), -0.35) : cel(FLAX, L(p))) },
};
const RED = R6('#2a0806', '#5a1410', '#8a2218', '#a8342c', '#c84a3a', '#e06a50');
const SKIRT = R6('#0c0a08', '#1a1612', '#28221c', '#362e26', '#463c32', '#584c40');
const MERE: Char7 = {
  ...AROHA7, id: 'mere',
  build: { ...AROHA7.build, torso: 18.4 },
  chest: [3.6, 4.4], waist: [3.0, 3.6], pelvis: [3.4, 4.1],
  skin: SKIN, ink: hex('#140a08'),
  torso: p => {
    if (p.hh > 0.6 && p.hh < 0.72) { const k = Math.floor((p.z + 20) * 1.2); return (k % 3 === 0) ? hex('#1e1418') : (k % 3 === 1 ? hex('#f0e2c8') : hex('#1e1418')); }
    if (p.hh > 0.88 && p.f > 1.2) return cel(SKIN, L(p), -0.1);
    return cel(RED, L(p));
  },
  upperArm: p => cel(RED, L(p), lb(p)),
  foreArm: p => (p.t > 0.5 ? cel(SKIN, L(p), lb(p)) : cel(RED, L(p), lb(p))),
  hands: p => cel(SKIN, L(p), lb(p) + 0.1),
  thigh: p => cel(SKIRT, L(p), lb(p)),
  shin: p => cel(SKIN, L(p), lb(p)),
  shoe: p => cel(FLAX, L(p), lb(p)),
  skirt: { len: 16, flare: 2.8, top: 3.4, mat: p => (p.t > 0.9 ? hex('#8a2e22') : cel(SKIRT, L(p))) },
};
const GREEN = R6('#0c1a10', '#1a3420', '#28502e', '#386c3c', '#4c8a4c', '#68a864');
const SHORTS = R6('#08070c', '#141420', '#1e1e2c', '#2a2c3c', '#383a4e', '#4a4c62');
const RAWIRI: Char7 = {
  ...MORI7, id: 'rawiri',
  skin: SKIN, ink: hex('#140a08'),
  torso: p => (p.hh > 0.9 && p.f > 1.6 && Math.abs(p.z) < (p.hh - 0.9) * 22 ? cel(SKIN, L(p), -0.2) : cel(GREEN, L(p))),
  upperArm: p => cel(GREEN, L(p), lb(p)),
  foreArm: p => (p.t > 0.25 ? cel(SKIN, L(p), lb(p)) : cel(GREEN, L(p), lb(p) - 0.2)),
  hands: p => cel(SKIN, L(p), lb(p) + 0.1),
  thigh: p => cel(SHORTS, L(p), lb(p)),
  shin: p => cel(SKIN, L(p), lb(p)),
  shoe: p => cel(FLAX, L(p), lb(p)),
  skirt: { len: 3, flare: 0.5, mat: p => cel(GREEN, L(p), -0.2) },
  cuff: undefined,
};
const YELLOW = R6('#3a2a08', '#6a4c10', '#9a7018', '#c49428', '#e0b444', '#f4d06a');
const PIPI: Char7 = {
  ...JENNA7, id: 'pipi',
  build: { ...JENNA7.build, hipH: 17, thigh: 8, shin: 7.8, torso: 12.5, upArm: 6.2, foreArm: 5.6 },
  shW: 3.4, hipW: 2.2, chest: [2.6, 3.2], waist: [2.4, 2.9], pelvis: [2.5, 3.0],
  armR: [1.4, 1.2, 1.0], legR: [1.7, 1.3, 1.1], neckR: 1.1, hand: 0.85,
  skin: SKIN, ink: hex('#140a08'),
  torso: p => cel(YELLOW, L(p)),
  upperArm: p => cel(SKIN, L(p), lb(p)),
  foreArm: p => cel(SKIN, L(p), lb(p)),
  hands: p => cel(SKIN, L(p), lb(p) + 0.1),
  thigh: p => cel(SKIN, L(p), lb(p)),
  shin: p => cel(SKIN, L(p), lb(p)),
  shoe: p => cel(SKIN, L(p), lb(p) - 0.15),
  skirt: { len: 6, flare: 2, top: 2.6, mat: p => cel(SHORTS, L(p)) },
};

// ---- heads
const WHITE = R6('#5a5452', '#8a8480', '#b8b2ac', '#dcd6ce', '#f0ebe4', '#ffffff');
const BLACK = R6('#060304', '#140c0a', '#221410', '#321e18', '#4a2e24', '#6a4434');
const koroHead: HeadDef7 = {
  ...HEADS7.mori, skin: SKIN2, hair: WHITE, ink: hex('#140a08'), eyeCol: '#140a08', brow: '#e8e2d8', blush: '#c86a5a',
  locks: HEADS7.mori.locks.filter((_, i) => i >= 4 && i < 10).map(l => ({ ...l, b: [l.a[0] + (l.b[0] - l.a[0]) * 0.5, l.a[1] + (l.b[1] - l.a[1]) * 0.5, l.a[2] + (l.b[2] - l.a[2]) * 0.5] as Lock['b'] })),
  extras: (s, W) => { s.ellipsoid(W([2.6, 2.8, 0]), W([3.4, 0, 0]), [0, 3.2, 0], W([0, 0, 3.8]), 10, h => cel(WHITE, h.l, 0.1)); },
};
const mereHead: HeadDef7 = {
  ...HEADS7.aroha, skin: SKIN, hair: BLACK,
  // hair swept back into a bun
  locks: [...HEADS7.aroha.locks.slice(0, 2), { a: [-3, 11, 0], b: [-6.2, 12.4, 0], r0: 3.4, r1: 2.6 }],
  extras: undefined,
};
const rawiriHead: HeadDef7 = {
  ...HEADS7.mori, skin: SKIN, hair: BLACK, ink: hex('#140a08'),
  // short sides and a topknot
  locks: [{ a: [0, 13.4, 0], b: [-0.6, 16.6, 0], r0: 2.4, r1: 1.6 }, { a: [2.4, 12.4, 1.6], b: [4.6, 10.2, 2], r0: 1.2, r1: 0.4 }],
};
const pipiHead: HeadDef7 = { ...HEADS7.jenna, skin: SKIN, hair: BLACK, blush: '#d87060' };

let done = false;
/** add the villagers to the cast tables (idempotent) */
export function registerVillagers() {
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
  add('koro', KORO, koroHead, 'Koro Wiremu', 64, 0.7, '#6a5e4c', 'joshu');
  add('mere', MERE, mereHead, 'Whaea Mere', 60, 1.0, '#a8342c', 'aroha');
  add('rawiri', RAWIRI, rawiriHead, 'Rāwiri', 63, 0.85, '#386c3c', 'mori');
  add('pipi', PIPI, pipiHead, 'Pīpī', 42, 1.7, '#c49428', 'jenna');
}

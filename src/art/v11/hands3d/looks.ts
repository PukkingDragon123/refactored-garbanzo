// Who the hands belong to: proportions, skin, sleeves and cuffs, what they wear on the wrist, and the
// gloves that go with the winter and storm outfits (from the wardrobe, so the hands dress with the
// sprites). Colours are sRGB hex; the renderer linearizes them.

import type { Build } from './rig';

export type Who = 'mori' | 'jenna' | 'joshu' | 'aroha';
export type SleeveKind = 'rolled' | 'hoodie' | 'pushed' | 'parka' | 'oilskin' | 'none';
export type GloveKind = 'knit' | 'leather' | 'rubber';

export interface Look {
  who: Who;
  build: Build;
  skin: {
    /** the back of the hand and the forearm */
    base: string;
    /** palms and finger pads (lighter and pinker, most of all on darker skin) */
    palm: string;
    /** knuckles, fingertips, creases: the blood colour that shows where skin is thin */
    flush: string;
    /** what light picks up scattering under the skin */
    sss: string;
    nail: string;
    vein: string;
    /** skin roughness 0.3 (oily) .. 0.7 (dry, chalky) */
    rough: number;
  };
  /** forearm hair density 0..1 and colour */
  hair: [number, string];
  /** sun damage, scars, deeper creases 0..1 */
  weathered: number;
  /** grease and engine muck on the fingers 0..1 */
  grease: number;
  freckles: number;
  tattoo: 'anchor' | null;
  sleeve: SleeveKind;
  /** fabric colours: shadow, base, highlight */
  cloth: [string, string, string];
  /** cuff / trim colour (rib knit, the rolled lining) */
  cuff: string;
  /** a watch on this side ('left' | 'right') */
  watch: 'left' | 'right' | null;
  /** a woven taniko band on this side */
  bracelet: 'left' | 'right' | 'both' | null;
  gloves: { kind: GloveKind; col: [string, string, string]; cuff: string } | null;
}

const MORI_BUILD: Build = { size: 1, breadth: 1, fingers: 1, girth: 1, arm: 1, foreLen: 25.5, upperLen: 29, bony: 1, veins: 1, muscle: 1 };
const JENNA_BUILD: Build = { size: 0.87, breadth: 0.92, fingers: 1.0, girth: 0.86, arm: 0.8, foreLen: 22.5, upperLen: 26, bony: 0.55, veins: 0.3, muscle: 0.35 };
const JOSHU_BUILD: Build = { size: 1.16, breadth: 1.12, fingers: 0.98, girth: 1.2, arm: 1.3, foreLen: 28, upperLen: 32, bony: 1.25, veins: 1.35, muscle: 1.35 };
const AROHA_BUILD: Build = { size: 0.9, breadth: 0.93, fingers: 1.05, girth: 0.87, arm: 0.84, foreLen: 23.5, upperLen: 27, bony: 0.85, veins: 0.55, muscle: 0.7 };

export const LOOKS: Record<Who, Look> = {
  mori: {
    who: 'mori', build: MORI_BUILD,
    skin: { base: '#c48e74', palm: '#d4a08c', flush: '#c4675a', sss: '#d2502e', nail: '#e2aca4', vein: '#5a6a8a', rough: 0.52 },
    hair: [0.45, '#3a2418'], weathered: 0.25, grease: 0, freckles: 0.15, tattoo: null,
    sleeve: 'rolled', cloth: ['#2c2628', '#4a4244', '#6e6466'], cuff: '#5e5050',
    watch: 'left', bracelet: null, gloves: null,
  },
  jenna: {
    who: 'jenna', build: JENNA_BUILD,
    skin: { base: '#e6b39e', palm: '#eeb8a8', flush: '#e07f78', sss: '#e65a3c', nail: '#f0c2bc', vein: '#9aa2c0', rough: 0.46 },
    hair: [0, '#000000'], weathered: 0, grease: 0.75, freckles: 0.35, tattoo: null,
    sleeve: 'hoodie', cloth: ['#3e2a38', '#6a4c5e', '#8e7082'], cuff: '#5e4254',
    watch: null, bracelet: null, gloves: null,
  },
  joshu: {
    who: 'joshu', build: JOSHU_BUILD,
    skin: { base: '#b9735a', palm: '#cc8e76', flush: '#b04c40', sss: '#c8402a', nail: '#d8a898', vein: '#6e7488', rough: 0.6 },
    hair: [0.85, '#4a2a1c'], weathered: 0.85, grease: 0.15, freckles: 0.4, tattoo: 'anchor',
    sleeve: 'pushed', cloth: ['#0d0e13', '#1d2027', '#353a46'], cuff: '#22252d',
    watch: null, bracelet: null, gloves: null,
  },
  aroha: {
    who: 'aroha', build: AROHA_BUILD,
    skin: { base: '#82563e', palm: '#b88672', flush: '#8a4434', sss: '#a0402a', nail: '#cca090', vein: '#5a4a52', rough: 0.44 },
    hair: [0.05, '#1a0e08'], weathered: 0.1, grease: 0, freckles: 0, tattoo: null,
    sleeve: 'none', cloth: ['#4a3820', '#6e5434', '#9c7a4c'], cuff: '#6e5434',
    watch: null, bracelet: 'both', gloves: null,
  },
};

/** winter / storm variants: parka or oilskin sleeves and gloves, following the wardrobe */
const COLD: Record<Who, Record<string, Partial<Look>>> = {
  mori: {
    winter: { sleeve: 'parka', cloth: ['#1e2a14', '#364a24', '#5a7438'], cuff: '#272a32', gloves: { kind: 'knit', col: ['#121418', '#272b33', '#464d5a'], cuff: '#272a32' }, watch: null },
    storm: { sleeve: 'oilskin', cloth: ['#6a5410', '#e0b41e', '#fff080'], cuff: '#866618', gloves: { kind: 'rubber', col: ['#0c0d10', '#212429', '#40454d'], cuff: '#16181c' }, watch: null },
  },
  jenna: {
    winter: { sleeve: 'parka', cloth: ['#5e1838', '#c04478', '#f498bc'], cuff: '#443462', gloves: { kind: 'knit', col: ['#5e1838', '#c04478', '#f498bc'], cuff: '#5e4a82' } },
    storm: { sleeve: 'oilskin', cloth: ['#6a2a08', '#d8621a', '#ffb060'], cuff: '#84340e', gloves: { kind: 'rubber', col: ['#0c0d10', '#212429', '#40454d'], cuff: '#16181c' } },
  },
  joshu: {
    winter: { sleeve: 'parka', cloth: ['#0a0b0d', '#20232a', '#4a5260'], cuff: '#6e4426', gloves: { kind: 'leather', col: ['#4a2c16', '#8e5e38', '#c69464'], cuff: '#6e4426' } },
    storm: { sleeve: 'oilskin', cloth: ['#0e1410', '#243226', '#4a6250'], cuff: '#16181c', gloves: { kind: 'rubber', col: ['#0c0d10', '#212429', '#40454d'], cuff: '#16181c' } },
  },
  aroha: {
    winter: { sleeve: 'parka', cloth: ['#481a10', '#924028', '#cc7a50'], cuff: '#341e12', gloves: { kind: 'leather', col: ['#22140c', '#48291a', '#744832'], cuff: '#341e12' }, bracelet: null },
    storm: { sleeve: 'oilskin', cloth: ['#0e1410', '#243226', '#4a6250'], cuff: '#16181c', gloves: { kind: 'leather', col: ['#22140c', '#48291a', '#744832'], cuff: '#341e12' }, bracelet: null },
  },
};

/** the look for a character in an outfit ('casual' | 'ship' | 'winter' | 'winterHood' | 'storm');
 *  gloves: true forces the outfit's gloves on (or plain work gloves), false takes them off */
export function lookFor(who: Who, outfit = 'casual', gloves?: boolean): Look {
  const base = LOOKS[who];
  const key = outfit === 'winterHood' ? 'winter' : outfit;
  const cold = COLD[who][key];
  let l: Look = cold ? { ...base, ...cold } : { ...base };
  if (gloves === false) l = { ...l, gloves: null };
  else if (gloves === true && !l.gloves) l = { ...l, gloves: COLD[who].winter.gloves ?? null };
  return l;
}

export const lookKey = (l: Look, side: 'left' | 'right') =>
  [l.who, l.sleeve, l.cloth.join(''), l.watch === side ? 'w' : '', l.bracelet === side || l.bracelet === 'both' ? 'b' : '', l.gloves ? l.gloves.kind + l.gloves.col[1] : ''].join('|');

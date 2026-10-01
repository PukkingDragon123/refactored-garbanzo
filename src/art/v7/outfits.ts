// V7 outfits: what the cast can wear besides their everyday clothes.
//  casual      the everyday clothes (cast.ts)
//  winter      expedition gear, hood down: an insulated parka (quilted panels and seams, a zip, cargo
//              pockets, reflective tape), insulated trousers, snow boots with laces and gaiters, gloves
//              with fingers and a cuff over the wrist, a beanie or cap with goggles pushed up, and each
//              one's kit (Mori: pack with a bedroll and thermos, specimen jars, camera bag, field
//              notebook, radio; Jenna: daypack with an antenna, laptop sling covered in stickers, a
//              coil of cable; Joshu: a heavy waxed parka, a rope coil, a sheath knife, a carabiner, his
//              cap; Aroha: her woven kete, slingshot in the belt, pounamu over the zip, taniko trim)
//  winterHood  the same with the fur-trimmed hood up (goggles on the hood; Joshu's cap under it)
//  ship        the everyday ship clothes aboard the Kittiwake (outfits-ship.ts); 'shipPhones' is the
//              same with Jenna's cat-ear headphones on her head
//  storm       foul-weather gear: oilskins with a hard sheen, a life-jacket harness, sea boots, hoods up
// An outfit rebuilds the character (bulkier volumes, new part materials, gear as extras) and gives
// the head its wear. The facade (index.ts) dresses ids like 'mori@winter' and caches per outfit.

import { C, hex } from '../color';
import { cel, Ramp6, Scene3D } from './raster';
import type { Char7, Part, PartMat, J3 } from './body';
import type { Pose } from '../people-rig';
import { CAST7 } from './cast';
import { SHIP_OUTFITS } from './outfits-ship';
import type { HeadWear7, Lock } from './head';
import { R6, PAL, GG, lb, quilt, tape, gloss, furMat, knit, plain, backpack, pouch, radio, ropeCoil, carabiner, knife, collar, onStraps, onSash, tEll, tLimb, beanie, hood, goggles, headlamp, wear, hash2, ropeMat } from './gear';

export const OUTFIT_NAMES = ['casual', 'ship', 'shipPhones', 'winter', 'winterHood', 'storm'] as const;
export interface Outfit7 { body(base: Char7): Char7; head?: HeadWear7 }

const L = (p: Part) => p.hit.l;
const frac = (v: number) => v - Math.floor(v);

// ------------------------------------------------------------------ the parka / oilskin builder

interface ParkaO {
  shell: Ramp6; panel: Ramp6; trim: Ramp6;
  /** puffer baffles down the body (count over the torso) and along the sleeves */
  quilt?: number; sleeveQuilt?: number;
  /** waxed / rubberised: a hard sheen instead of soft cloth */
  gloss?: boolean;
  /** reflective tape on the forearms and across the chest (and shoulder patches) */
  strips?: boolean; patches?: boolean;
  /** pack straps painted down the front */
  straps?: Ramp6;
  /** a life-jacket harness: red straps and an inflatable tube round the collar */
  lifejacket?: boolean;
  hem?: number;
  bulk?: number;
  pants: Ramp6; knee?: Ramp6; pantsGloss?: boolean;
  boot: Ramp6; gaiter?: Ramp6; lace?: C; tallBoot?: boolean; sock?: Ramp6;
  glove: Ramp6; cuff?: Ramp6;
  /** hood down (bunched behind the neck), with a fur ruff; or up (only a high collar here) */
  hoodDown?: Ramp6; fur?: Ramp6; hoodUp?: boolean;
  /** per-character painting first (pounamu, notebook, stickers), on the torso and the hem */
  deco?(p: Part): C | -1 | undefined;
  hemDeco?(p: Part): C | undefined;
  cuffDeco?(p: Part): C | undefined;
  extras?(s: Scene3D, J: J3, P: Pose, ch: Char7): void;
}

function parka(base: Char7, o: ParkaO): Char7 {
  const k = o.bulk ?? 0.7;
  const sh = (p: Part, bias = 0): C => (o.gloss ? gloss(o.shell, L(p), bias) : cel(o.shell, L(p), bias));
  const body = (p: Part, u: number, n: number, bias = 0): C => (o.gloss || !n ? sh(p, bias) : quilt(o.shell, L(p), u, n, bias));
  const torso: PartMat = p => {
    const d = o.deco?.(p);
    if (d !== undefined) return d;
    const l = L(p);
    if (o.lifejacket) {
      if (onStraps(p, base, 0.9)) return cel(PAL.red, l, 0.05);
      if (p.f > 0 && Math.abs(p.hh - 0.34) < 0.035) return cel(PAL.webbing, l, 0.1);
    }
    if (o.straps && onStraps(p, base)) return Math.abs(p.hh - 0.62) < 0.03 ? cel(PAL.steel, l, 0.3) : cel(o.straps, l, 0.05);
    if (o.straps && p.f > 0.5 && Math.abs(p.hh - 0.68) < 0.025 && Math.abs(p.z) < base.shW * 0.52) return cel(o.straps, l, -0.05);
    // the zip up the front, a pull at the top; storm flap over it
    if (p.f > 0 && Math.abs(p.z) < 0.34 && p.hh > 0.1) return p.hh > 0.84 && p.hh < 0.9 ? cel(PAL.steel, l, 0.35) : cel(o.trim, l, -0.05);
    if (p.f > 0 && Math.abs(p.z - 0.62) < 0.18 && p.hh > 0.1) return sh(p, -0.35);
    if (o.strips && Math.abs(p.hh - 0.58) < 0.035 && p.f > -1) return tape(l);
    if (o.patches && p.hh > 0.8 && Math.abs(p.z) > base.shW * 0.55 && Math.abs(p.z) < base.shW * 0.85 && p.f > -0.5 && p.f < 1.5) return tape(l);
    // a quilted yoke over the shoulders
    if (p.hh > 0.78) return Math.abs(p.hh - 0.78) < 0.025 ? cel(o.panel, l, -0.4) : (o.gloss ? gloss(o.panel, l) : quilt(o.panel, l, p.z / 3 + 10, 1, 0));
    // a drawcord at the waist
    if (Math.abs(p.hh - 0.3) < 0.02) return sh(p, -0.4);
    return body(p, p.hh, o.quilt ?? 0);
  };
  const ch: Char7 = {
    ...base,
    chest: [base.chest[0] + k, base.chest[1] + k * 0.9], waist: [base.waist[0] + k * 1.1, base.waist[1] + k], pelvis: [base.pelvis[0] + k * 0.9, base.pelvis[1] + k * 0.9],
    armR: [base.armR[0] + k * 0.55, base.armR[1] + k * 0.5, base.armR[2] + k * 0.35], legR: [base.legR[0] + 0.35, base.legR[1] + 0.3, base.legR[2] + 0.25],
    shoeK: o.tallBoot ? [1.12, 1.2, 1.12] : [1.18, 1.32, 1.22], fingerK: 1.22,
    cuff: { r: base.armR[2] + k * 0.35 + 0.55, len: 1.8, mat: p => (o.cuffDeco?.(p) ?? (p.t < 0.3 ? cel(o.cuff ?? o.glove, L(p), lb(p) - 0.3) : cel(o.cuff ?? o.glove, L(p), lb(p) + 0.05))) },
    torso,
    upperArm(p) {
      const l = L(p);
      if (o.lifejacket && p.t < 0.12) return cel(PAL.red, l, lb(p));
      if (p.t < 0.3) return o.gloss ? gloss(o.panel, l, lb(p)) : quilt(o.panel, l, p.t, 3, lb(p));
      return o.gloss ? sh(p, lb(p)) : quilt(o.shell, l, p.t, o.sleeveQuilt ?? 3, lb(p));
    },
    foreArm(p) {
      const l = L(p);
      const dd = o.cuffDeco?.(p);
      if (dd !== undefined && p.t > 0.8) return dd;
      if (o.strips && p.t > 0.5 && p.t < 0.62) return tape(l + lb(p));
      if (p.t > 0.84) return cel(o.trim, l, lb(p));
      return o.gloss ? sh(p, lb(p)) : quilt(o.shell, l, p.t, o.sleeveQuilt ?? 3, lb(p));
    },
    hands(p) { const l = L(p); return frac(p.t * 2.2) < 0.12 && p.t > 0.2 ? cel(o.glove, l, lb(p) - 0.35) : cel(o.glove, l, lb(p) + 0.05); },
    thigh(p) {
      const l = L(p);
      if (o.knee && p.t > 0.84 && p.hit.n[0] > 0.3) return cel(o.knee, l, lb(p));
      if (Math.abs(p.t - 0.45) < 0.04 && p.hit.n[0] < -0.2) return cel(o.pants, l, lb(p) - 0.4);
      return o.pantsGloss ? gloss(o.pants, l, lb(p)) : cel(o.pants, l, lb(p));
    },
    shin(p) {
      const l = L(p);
      if (o.knee && p.t < 0.12 && p.hit.n[0] > 0.3) return cel(o.knee, l, lb(p));
      return o.pantsGloss ? gloss(o.pants, l, lb(p)) : cel(o.pants, l, lb(p));
    },
    bootTop: o.tallBoot
      ? { t: 0.3, r: 0.45, mat: p => (o.sock && p.t < 0.4 ? knit(o.sock, L(p), p.hit.x * 0.5, lb(p)) : gloss(o.boot, L(p), lb(p))) }
      : { t: 0.5, r: 0.5, mat: p => {
        const l = L(p);
        // a gaiter: a strap under the instep, a hook at the top of the laces
        if (p.t < 0.58) return cel(o.gaiter ?? o.boot, l, lb(p) - 0.3);
        if (Math.abs(p.t - 0.78) < 0.05) return cel(PAL.webbing, l, lb(p));
        return cel(o.gaiter ?? o.boot, l, lb(p));
      } },
    shoe(p) {
      const l = L(p), q = p.hit.q;
      if (q[1] < -0.42) return cel(PAL.rubber, l, 0.1);
      if (o.tallBoot) return gloss(o.boot, l, lb(p));
      // laces criss-crossing up the front, a toe cap
      if (o.lace !== undefined && q[1] > 0.05 && p.hit.n[0] > 0.45 && q[0] < 0.55) return (p.hit.x + p.hit.y) % 2 === 0 ? o.lace : cel(o.boot, l, -0.35);
      if (q[0] > 0.72) return cel(o.boot, l, lb(p) - 0.12);
      return cel(o.boot, l, lb(p) + 0.05);
    },
    skirt: {
      len: o.hem ?? 6.6, flare: 0.75, top: 3.6,
      mat: p => {
        const hd = o.hemDeco?.(p);
        if (hd !== undefined) return hd;
        const l = L(p), ang = Math.atan2(p.z, p.f);
        if (p.t > 0.86) return cel(o.trim, l, -0.05);
        // cargo pockets on the hips, with flaps and a press stud
        const pk = Math.abs(Math.abs(ang) - 0.75) < 0.42 && p.t > 0.3 && p.t < 0.8;
        if (pk) return p.t < 0.42 ? (Math.abs(Math.abs(ang) - 0.75) < 0.06 && p.t > 0.36 ? cel(PAL.steel, l, 0.3) : sh(p, -0.15)) : Math.abs(Math.abs(ang) - 0.75) > 0.36 ? sh(p, -0.4) : sh(p, 0.04);
        if (o.strips && Math.abs(p.t - 0.7) < 0.05 && !pk) return tape(l);
        if (p.f > 0 && Math.abs(p.z) < 0.34) return cel(o.trim, l, -0.05);
        return body(p, p.t, o.quilt ? 2 : 0);
      },
    },
    extras(s, J, P, c) {
      if (o.hoodDown) {
        collar(s, J, c, { r: 1.5, rise: 0.4, back: 1.6, mat: h => (o.gloss ? gloss(o.hoodDown!, h.l) : cel(o.hoodDown!, h.l, 0.02)) });
        if (o.fur) collar(s, J, c, { r: 1.05, rise: 1.2, back: 0.6, mat: furMat(o.fur, 0.6), g: GG.collar + 20, n: 20 });
      } else if (o.hoodUp) collar(s, J, c, { r: 1.25, rise: 0.6, mat: h => (o.gloss ? gloss(o.shell, h.l) : cel(o.shell, h.l, -0.1)) });
      if (o.lifejacket) collar(s, J, c, { r: 1.25, rise: -0.2, back: 0.3, mat: h => cel(PAL.red, h.l, 0.1, true), g: GG.collar + 21 });
      o.extras?.(s, J, P, c);
    },
  };
  return ch;
}

// ------------------------------------------------------------------ palettes

const P = {
  moss: R6('#121a0c', '#243218', '#364a24', '#4c6432', '#647e40', '#86a05a'),
  char: R6('#0c0d10', '#1a1c22', '#272a32', '#353944', '#444a56', '#58606e'),
  graphite: R6('#08090b', '#121418', '#1c1f25', '#272b33', '#343a44', '#464d5a'),
  bootBrown: R6('#1a0e08', '#3a2214', '#56321e', '#70442a', '#8a5a3a', '#a8744e'),
  rust: R6('#2a0e06', '#5a2010', '#86321a', '#a84a26', '#c46636', '#de8a52'),
  packBrown: R6('#1a120a', '#342414', '#4c3820', '#644c2c', '#7c623a', '#98804e'),
  matYellow: R6('#2a2008', '#5a4614', '#8a6c1e', '#b8922c', '#d4b044', '#ecd070'),
  pink: R6('#2a0a1a', '#5e1838', '#8e2a56', '#c04478', '#de6a98', '#f498bc'),
  lilac: R6('#140e1c', '#2c2040', '#443462', '#5e4a82', '#7a64a0', '#9a86be'),
  plum: R6('#0e0a14', '#1e1628', '#2e223c', '#40304e', '#544064', '#6c547c'),
  snowWhite: R6('#34343e', '#6e7080', '#a4a6b4', '#d0d2dc', '#e8eaf0', '#ffffff'),
  mint: R6('#0a201c', '#16443c', '#246a5c', '#3a9480', '#5ab8a0', '#8ad8c0'),
  navyBag: R6('#06070e', '#10142a', '#1a2040', '#262e56', '#343e6e', '#46528a'),
  wax: R6('#040405', '#0a0b0d', '#15171b', '#20232a', '#2e333c', '#4a5260'),
  navyWool: R6('#06070c', '#10121c', '#1a1d2c', '#25293c', '#31364e', '#404766'),
  tanLeather: R6('#1e1008', '#4a2c16', '#6e4426', '#8e5e38', '#aa784c', '#c69464'),
  sock: R6('#2a2a2c', '#555558', '#7e7e82', '#a2a2a6', '#bcbcc0', '#d6d6da'),
  oilGreen: R6('#060806', '#0e1410', '#18221a', '#243226', '#304234', '#4a6250'),
  ochre: R6('#200a06', '#481a10', '#6e2a1a', '#924028', '#b05a38', '#cc7a50'),
  olive: R6('#0c0e08', '#1a1e12', '#282e1c', '#363e26', '#464f32', '#5a6442'),
  darkLeather: R6('#0e0806', '#22140c', '#341e12', '#48291a', '#5c3624', '#744832'),
};

/** a taniko band (red, black and white zigzag) along a strip: u across the strip 0..1, k around it */
function taniko(u: number, k: number): C {
  if (u < 0.14 || u > 0.86) return hex('#f0e2c8');
  const i = Math.floor(k * 1.2), w = (i % 4) < 2 ? i % 2 : 1 - (i % 2);
  return Math.abs(((u - 0.14) / 0.72) * 3 - w * 3) < 1.1 ? hex('#1e1418') : hex('#b8342a');
}

// ------------------------------------------------------------------ Mori

const moriWinter = (hoodUp: boolean): Outfit7['body'] => b => parka(b, {
  shell: P.moss, panel: P.char, trim: P.graphite, quilt: 5, strips: true, straps: PAL.webbing,
  pants: P.char, boot: P.bootBrown, gaiter: P.graphite, lace: hex('#c84a2a'), glove: P.graphite, cuff: P.char,
  hoodDown: hoodUp ? undefined : P.moss, fur: hoodUp ? undefined : PAL.fur, hoodUp,
  deco(p) {
    // the field notebook in the chest pocket: a buttoned flap, the notebook's spine poking out
    if (p.f > 1.2 && p.z < -0.8 && p.z > -2.6 && p.hh > 0.6 && p.hh < 0.74) return p.hh > 0.71 ? cel(PAL.wood, L(p), 0.3) : p.hh > 0.68 ? cel(P.moss, L(p), -0.3) : cel(P.moss, L(p), 0.1);
    // the camera bag's strap across the chest
    if (onSash(p, -b.shW * 0.5, b.hipW + 1.2, 0.6)) return cel(PAL.leather, L(p), 0.15);
    return undefined;
  },
  extras(s, J, _P, c) {
    const T = c.build.torso;
    backpack(s, J, c, { h: T * 1.02, w: 8.4, d: 5.6, top: 1.3, col: P.packBrown, lid: P.rust, roll: P.matYellow, bottle: PAL.steel, jars: 2, z: 2.6 });
    pouch(s, J, [T * 0.06, 1.0, c.hipW + 2.0], [1.4, 1.6, 1.2], PAL.black, PAL.leather);
    radio(s, J, [T * 0.7, c.chest[0] + 0.5, c.shW * 0.5]);
    carabiner(s, J, [T * 0.02, 1.6, -c.hipW - 1.4]);
  },
});
const moriStorm: Outfit7['body'] = b => parka(b, {
  shell: PAL.yellow, panel: PAL.yellow, trim: R6('#2a2006', '#5a4410', '#866618', '#a88222', '#c09a30', '#dcbc50'), gloss: true, patches: true, lifejacket: true, hoodUp: true,
  pants: PAL.yellow, pantsGloss: true, boot: PAL.rubber, tallBoot: true, glove: PAL.black, hem: 7.4,
});
const MORI_HAIR_UNDER_HAT = (l: Lock) => l.a[0] < 1 && l.a[1] > 10;
const BANGS_ONLY = (l: Lock) => !(l.b[0] > 4.2);

// ------------------------------------------------------------------ Jenna

const jennaWinter = (hoodUp: boolean): Outfit7['body'] => b => parka(b, {
  shell: P.pink, panel: P.lilac, trim: P.plum, quilt: 7, sleeveQuilt: 4, bulk: 0.85,
  pants: P.plum, boot: P.snowWhite, gaiter: P.lilac, lace: hex('#f06aa0'), glove: P.pink, cuff: P.lilac,
  hoodDown: hoodUp ? undefined : P.pink, fur: hoodUp ? undefined : PAL.furWhite, hoodUp, hem: 6,
  deco(p) {
    // the laptop sling's strap across her chest
    if (onSash(p, b.shW * 0.5, -b.hipW - 1.4, 0.65)) return cel(P.navyBag, L(p), 0.15);
    return undefined;
  },
  extras(s, J, _P, c) {
    const T = c.build.torso;
    backpack(s, J, c, { h: T * 0.7, w: 6.6, d: 4.6, top: 1.08, col: P.mint, lid: P.lilac, antenna: true, z: 2 });
    // the laptop sling on her far hip, covered in stickers
    const stick = [hex('#f8d040'), hex('#58c8f0'), hex('#f06aa0'), hex('#ffffff'), hex('#8ae070')];
    tEll(s, J, [T * 0.1, 0.6, -(c.hipW + 1.6)], [1.1, 3.0, 3.2], GG.bag, h => {
      const n = hash2(Math.floor(h.x / 2), Math.floor(h.y / 2));
      if (h.q[2] > -0.2 && n > 0.72) return stick[Math.floor(n * 97) % stick.length];
      return h.q[1] > 0.5 ? cel(P.navyBag, h.l, -0.1) : cel(P.navyBag, h.l, 0.05);
    });
    // a coil of orange cable hanging off the strap
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2, a1 = ((i + 1) / 12) * Math.PI * 2;
      const pt = (a: number): [number, number, number] => [T * 0.42 + Math.sin(a) * 1.6, c.chest[0] + 0.9 + Math.cos(a) * 0.4, c.shW * 0.2 + Math.cos(a) * 1.4];
      tLimb(s, J, pt(a0), pt(a1), 0.36, 0.36, GG.clip, plain(PAL.orange, 0.1));
    }
  },
});
const jennaStorm: Outfit7['body'] = b => parka(b, {
  shell: PAL.orange, panel: PAL.orange, trim: R6('#2a1004', '#5a2208', '#84340e', '#a84816', '#c45e22', '#e08040'), gloss: true, patches: true, lifejacket: true, hoodUp: true,
  pants: PAL.orange, pantsGloss: true, boot: PAL.rubber, tallBoot: true, glove: PAL.black, hem: 7, bulk: 0.8,
});

// ------------------------------------------------------------------ Joshu

const joshuWinter = (hoodUp: boolean): Outfit7['body'] => b => parka(b, {
  shell: P.wax, panel: PAL.leather, trim: PAL.black, gloss: true, bulk: 0.8, hem: 8,
  pants: P.navyWool, boot: PAL.rubber, tallBoot: true, sock: P.sock, glove: P.tanLeather, cuff: P.tanLeather,
  hoodDown: hoodUp ? undefined : P.wax, fur: hoodUp ? undefined : PAL.furBrown, hoodUp,
  deco(p) {
    // a heavy belt over the parka with a brass buckle
    if (p.hh > 0.14 && p.hh < 0.22) return p.f > 3 && Math.abs(p.z) < 1.2 ? cel(PAL.brass, L(p), 0.2, true) : cel(PAL.leather, L(p), 0.05);
    return undefined;
  },
  extras(s, J, _P, c) {
    const T = c.build.torso;
    ropeCoil(s, J, c, true);
    knife(s, J, [T * 0.12, 1.4, c.hipW + 2.2]);
    carabiner(s, J, [T * 0.12, 2.4, -c.hipW - 1.8]);
    // a thermos on his belt at the back
    tLimb(s, J, [T * 0.02, -c.waist[0] - 0.4, -c.hipW], [T * 0.28, -c.waist[0] - 0.4, -c.hipW], 1.1, 1.05, GG.bottle, h => (h.t > 0.84 ? cel(PAL.black, h.l, 0.1) : cel(PAL.steel, h.l, 0.05, true)));
  },
});
const joshuStorm: Outfit7['body'] = b => parka(b, {
  shell: P.oilGreen, panel: P.oilGreen, trim: PAL.black, gloss: true, patches: true, lifejacket: true, bulk: 0.7, hem: 8,
  pants: P.oilGreen, pantsGloss: true, boot: PAL.rubber, tallBoot: true, sock: P.sock, glove: PAL.black,
  hoodDown: P.oilGreen,
  extras(s, J, _P, c) { knife(s, J, [c.build.torso * 0.12, 1.4, c.hipW + 2.2]); },
});

// ------------------------------------------------------------------ Aroha

const arohaKit = (s: Scene3D, J: J3, c: Char7) => {
  const T = c.build.torso;
  // her woven flax kete on the near hip
  tEll(s, J, [T * 0.02, 0.9, c.hipW + 2.0], [1.3, 2.6, 2.8], GG.bag, h => {
    const w = (Math.floor(h.x / 1) + Math.floor(h.y / 1)) % 2 === 0;
    return h.q[1] > 0.7 ? cel(PAL.flax, h.l, -0.25) : cel(PAL.flax, h.l, w ? 0.12 : -0.12);
  });
  // the slingshot tucked in the back of her belt: handle and fork
  const base: [number, number, number] = [T * 0.12, -c.waist[0] - 0.6, -0.6];
  tLimb(s, J, [base[0] - 2.4, base[1], base[2]], base, 0.42, 0.42, GG.tool, plain(PAL.wood, 0.05));
  for (const z of [-1, 1]) tLimb(s, J, base, [base[0] + 2, base[1] - 0.4, base[2] + z * 1.2], 0.36, 0.3, GG.tool, plain(PAL.wood, 0.1));
};
const arohaWinter = (hoodUp: boolean): Outfit7['body'] => b => parka(b, {
  shell: P.ochre, panel: P.darkLeather, trim: PAL.black, quilt: 4,
  pants: P.olive, boot: P.bootBrown, gaiter: P.darkLeather, lace: hex('#d8b070'), glove: P.darkLeather,
  hoodDown: hoodUp ? undefined : P.ochre, fur: hoodUp ? undefined : PAL.furBrown, hoodUp, hem: 7,
  deco(p) {
    // pounamu on its cord, worn over the zip
    if (p.f > 2.4 && p.hh > 0.68 && p.hh < 0.8 && Math.abs(p.z) < 0.75) return p.hh > 0.77 ? hex('#3a2418') : cel(PAL.glassGreen, L(p), 0.2, true);
    // the kete's flax strap across her body
    if (onSash(p, -b.shW * 0.5, b.hipW + 1.4, 0.55)) return cel(PAL.flax, L(p), 0.1);
    return undefined;
  },
  hemDeco: p => (p.t > 0.66 && p.t < 0.86 ? taniko((p.t - 0.66) / 0.2, Math.atan2(p.z, p.f) * 6 + 20) : undefined),
  cuffDeco: p => (p.t > 0.8 && p.t < 0.95 ? taniko((p.t - 0.8) / 0.15, p.hit.q[1] * 2 + 20) : undefined),
  extras: (s, J, _P, c) => arohaKit(s, J, c),
});
const arohaStorm: Outfit7['body'] = b => parka(b, {
  shell: P.oilGreen, panel: P.oilGreen, trim: PAL.black, gloss: true, patches: true, hoodUp: true,
  pants: P.olive, boot: PAL.rubber, tallBoot: true, glove: P.darkLeather, hem: 7.4,
  extras: (s, J, _P, c) => arohaKit(s, J, c),
});

// ------------------------------------------------------------------ head wear

const fierceHood = (col: Ramp6, fur?: Ramp6, k = 1, open?: { top: number; w: number; low: number }, oil = false) =>
  hood({ col, fur, k, open, mat: oil ? (h => gloss(col, h.l, 0)) : undefined });

export const OUTFITS7: Record<string, Record<string, Outfit7>> = {
  mori: {
    winter: { body: moriWinter(false), head: wear([beanie({ col: P.rust, fold: P.rust, y: 11.2, drop: 2.4 }), headlamp({ y: 12.2, k: 1.12 })], { hideLock: MORI_HAIR_UNDER_HAT, tuck: 11.2 }) },
    winterHood: { body: moriWinter(true), head: wear([fierceHood(P.moss, PAL.fur), goggles({ y: 13.8, lens: PAL.lensOrange, k: 1.24 })], { hideShell: true, hideLock: BANGS_ONLY, tuck: 11 }) },
    storm: { body: moriStorm, head: wear([fierceHood(PAL.yellow, undefined, 1, undefined, true)], { hideShell: true, hideLock: BANGS_ONLY, tuck: 11 }) },
  },
  jenna: {
    winter: { body: jennaWinter(false), head: wear([beanie({ col: P.mint, fold: P.mint, y: 11.6, drop: 2, ears: P.mint, k: 1.04 }), goggles({ y: 13.2, lens: PAL.lensBlue, band: P.lilac, k: 1.12 })], { hideLock: l => l.a[1] > 13, tuck: 11.6 }) },
    winterHood: { body: jennaWinter(true), head: wear([fierceHood(P.pink, PAL.furWhite, 1.02), goggles({ y: 13.4, lens: PAL.lensBlue, band: P.lilac, k: 1.28 })], { hideShell: true, hideLock: l => !(l.b[0] > 4.2 || (l.a[0] > 1 && l.b[1] < 4)), tuck: 11 }) },
    storm: { body: jennaStorm, head: wear([fierceHood(PAL.orange, undefined, 1.02, undefined, true)], { hideShell: true, hideLock: BANGS_ONLY, tuck: 11 }) },
  },
  joshu: {
    // his red skipper's cap stays on; with the hood up it sits under the hood, brim out
    winter: { body: joshuWinter(false) },
    winterHood: { body: joshuWinter(true), head: wear([fierceHood(P.wax, PAL.furBrown, 1.42, { top: 6.8, w: 6.8, low: 13 }, true)]) },
    storm: { body: joshuStorm },
  },
  aroha: {
    winter: { body: arohaWinter(false) },
    winterHood: { body: arohaWinter(true), head: wear([fierceHood(P.ochre, PAL.furBrown, 1.04)], { hideShell: true, hideExtras: true, hideLock: l => !(l.a[0] > 2.5), tuck: 11 }) },
    storm: { body: arohaStorm, head: wear([fierceHood(P.oilGreen, undefined, 1.04, undefined, true)], { hideShell: true, hideExtras: true, hideLock: l => !(l.a[0] > 2.5), tuck: 11 }) },
  },
};

for (const [id, o] of Object.entries(SHIP_OUTFITS)) Object.assign(OUTFITS7[id], o);

const dressed = new Map<string, Char7>();
/** a character in an outfit (unknown outfits fall back to their everyday clothes) */
export function dress(id: string, outfit: string): { ch: Char7; wear?: HeadWear7; key: string } {
  const base = CAST7[id] ?? CAST7.mori;
  const o = OUTFITS7[id]?.[outfit];
  if (!o) return { ch: base, key: '' };
  const key = `${id}@${outfit}`;
  let ch = dressed.get(key);
  if (!ch) { ch = o.body(base); dressed.set(key, ch); }
  return { ch, wear: o.head, key: outfit };
}
void ropeMat;

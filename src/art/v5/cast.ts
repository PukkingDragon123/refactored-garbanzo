// V5 cast bodies in the reference style: chunky 3/4-view figures about 3.3 heads tall, boxy
// clothes with seams and fold lines, muted hue-shifted palettes. The torso faces the viewer and
// the right: the near arm and leg sit on the left (back) side, the far ones on the right, so both
// legs show side by side and the far arm peeks past the chest. Clothes are shaded as volumes: the
// back edge turns into shadow, the front and shoulders catch the light.
//
//  Mori  - naturalist: olive field vest over a khaki shirt, camera strap, belt, cargo trousers,
//          laced boots, a big field pack on his back
//  Jenna - engineer/coder: oversized lavender hoodie (cat print, drawstrings, kangaroo pocket),
//          headphones round her neck, pleated navy skirt, striped socks, sneakers
//  Joshu - skipper: navy cable-knit gansey with a ribbed hem, rolled sleeves and an anchor tattoo,
//          dark work trousers, black sea boots
//  Aroha - islander: woven sleeveless top with a taniko hem, pounamu on a cord, olive shorts with
//          a kete at the hip and her slingshot, flax sandals

import type { Sample, P2 } from '../people-rig';
import { Ctx, torsoFrame, footFrame, polyIn } from '../people-parts';
import { hex, C } from '../color';
import { ramp, tn, Ramp } from './tone';
import type { V5Char } from './body';
import { merge5 } from './body';

const R6 = (...h: string[]): Ramp => h.map(v => hex(v)) as Ramp;

/** distance from p to segment a-b */
function dseg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}
/** on a 1 px fold line through the given points */
const onLine = (lx: number, ly: number, pts: number[], w = 0.5) => {
  for (let i = 0; i + 3 < pts.length; i += 2) if (dseg(lx, ly, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]) < w) return true;
  return false;
};

/**
 * torso form light: s.u runs 0 (back edge, turned from the light) → 1 (front edge); shoulders catch
 * the light, the belly turns down. Stronger than the raw normal so clothes read as volumes.
 */
function formL(s: Sample, top: number, o = 0) {
  const topK = Math.max(0, (s.ly - (top - 3.2)) / 3.2);
  const botK = Math.max(0, (2.6 - s.ly) / 3.4);
  return (s.u - 0.44) * 1.55 + topK * 0.5 - botK * 0.28 + o;
}
/** limb bias: the near limb is on the shadow side, the far one behind the body */
const lb = (nr: boolean) => (nr ? -0.12 : -0.3);

interface ShoeSpec {
  /** side profile polygon in foot space: x forward from the ankle, y up from the sole bottom */
  shape: number[];
  ah: number;
  body: Ramp;
  sole: Ramp;
  soleH?: number;
  /** collar / cuff band at the top */
  cuff?: Ramp;
  cuffH?: number;
  toe?: Ramp;
  lace?: C;
}

/** shoe or boot from a side profile, shaded in clean bands: lit top and toe, dark heel, dark sole */
function shoe5(x: Ctx, an: P2, pitch: number, nr: boolean, o: ShoeSpec) {
  const sh = o.shape;
  let minX = 1e9, maxX = -1e9, maxY = 0;
  for (let i = 0; i < sh.length; i += 2) { minX = Math.min(minX, sh[i]); maxX = Math.max(maxX, sh[i]); maxY = Math.max(maxY, sh[i + 1]); }
  const soleH = o.soleH ?? 1;
  const bias = lb(nr) + 0.1;
  footFrame(x.c, an, pitch, [minX - 1, maxX + 1, -o.ah - 1, maxY - o.ah + 1], (fx, fy) => {
    const y = fy + o.ah;
    if (!polyIn(sh, fx, y)) return -1;
    if (y < soleH) return fx > maxX - 1.4 ? o.sole[3] : o.sole[2];
    if (o.cuff && y > maxY - (o.cuffH ?? 1)) return tn(o.cuff, 0.1 + (fx > 0.5 ? 0.35 : -0.25), bias, true);
    if (o.lace && fx > 0.4 && fx < 2.2 && y > maxY * 0.42 && y < maxY - 0.6 && ((Math.floor(y * 1.3) + Math.floor(fx * 1.2)) % 2 === 0)) return o.lace;
    if (o.toe && fx > maxX - 2 && y < soleH + 1.7) return tn(o.toe, 0.55 + (y > soleH + 0.9 ? 0.3 : 0), bias, true);
    // form light: the instep/top faces up, the toe faces forward, the heel is in shadow
    const top = y > maxY - 1.3 || (fx > 1 && y > (maxY - (fx - 1) * 0.55) - 1.1);
    const l = (top ? 0.5 : -0.05) + (fx > maxX - 1.5 ? 0.3 : 0) + (fx < minX + 1.1 ? -0.55 : 0);
    return tn(o.body, l, bias, true);
  });
  merge5(x.c, 0.4, 0.16);
}

// ================================================================== outfits cloned from the reference sheets
// The idle / walk / run clips are the cloned frames themselves (clone.ts); these rig bodies cover every
// other pose with the same proportions, outfits and colours so the two never look like different people.

interface TunicPal { skin: Ramp; tunic: Ramp; belt: Ramp; shorts: Ramp; boot: Ramp; glove: Ramp; sole: Ramp }
interface DressPal { skin: Ramp; top: Ramp; collar: C; skirt: Ramp; legs: Ramp; shoe: Ramp; sole: Ramp; bareLegs?: boolean }

const BOY_BUILD = { hipH: 17, thigh: 7.6, shin: 7.6, ankleH: 1.8, torso: 21, neck: 1, shY: 2.6, shF: -5, shB: 5.2, upArm: 8.2, foreArm: 7.2, legF: -2.8, legB: 2.8 };
const GIRL_BUILD = { hipH: 25, thigh: 11.4, shin: 11.2, ankleH: 2.4, torso: 20, neck: 1, shY: 2.4, shF: -5.6, shB: 5.8, upArm: 8.6, foreArm: 7.8, legF: -2.8, legB: 2.8 };

/** the boy's outfit: long tunic, a strap across the chest, belt, knee shorts, tall boots, gloves */
function tunicChar(id: string, P: TunicPal): V5Char {
  return {
    id,
    build: { ...BOY_BUILD },
    skin: P.skin, handK: 0.8, neckR: 1.8,
    face: { eye: [3, 9], mouth: [6, 4], chin: [5, 1], top: 16 },
    leg: {
      rThigh: 2.9, rKnee: 2.4, rAnkle: 2,
      mat(s: Sample, nr) {
        const l = s.l + lb(nr);
        if (s.u < 0.5) return tn(P.shorts, l + (s.u > 0.44 ? 0.35 : 0));
        return tn(P.boot, l + (s.u < 0.62 ? 0.45 : 0), 0, true);
      },
      foot(x, an, pitch, nr) {
        shoe5(x, an, pitch, nr, { shape: [-2.2, 0, 3.6, 0, 4.2, 1, 4, 2.1, 2.4, 2.8, 1.6, 3.6, -2.2, 3.6, -2.5, 2], ah: 2, body: P.boot, sole: P.sole });
      },
    },
    arm: {
      rSh: 2.2, rEl: 2, rWr: 1.8,
      upper(s, nr) { return tn(P.tunic, s.l + lb(nr) - (Math.abs(s.u - 0.5) < 0.05 && s.v < 0 ? 0.5 : 0)); },
      fore(s, nr) { return s.u > 0.5 ? tn(P.glove, s.l + lb(nr), 0, true) : tn(P.tunic, s.l + lb(nr)); },
    },
    torso: {
      prof: [[-4.4, -7.2, 7.4], [-2, -6.8, 7], [2, -6, 6.2], [8, -6, 6.1], [14, -6.2, 6.2], [18.6, -5.8, 5.6], [20.2, -4.2, 4], [21, -2.4, 2.2]],
      mat(s, x) {
        const lx = s.lx, ly = s.ly, top = x.b.torso;
        const l = formL(s, top);
        // belt with a brass buckle
        if (ly > 2.2 && ly < 4.2) {
          if (lx > 0.8 && lx < 3) return lx > 1.4 && lx < 2.4 ? P.belt[1] : tn(P.belt, l + 0.6, 0, true);
          return tn(P.belt, l + (ly > 3.5 ? 0.35 : 0), 0, true);
        }
        // strap across the chest, far shoulder to near hip, with a round clasp
        if (onLine(lx, ly, [5, top - 1, -5.4, 5], 0.55)) return tn(P.belt, l - 0.2);
        if ((lx - 2) ** 2 + (ly - (top - 5)) ** 2 < 0.8) return tn(P.belt, 0.8, 0, true);
        // folds: under the far arm, the tunic skirt below the belt
        if (onLine(lx, ly, [5.2, 16, 4.2, 11], 0.45) || onLine(lx, ly, [-2, 2, -3, -3.6], 0.42) || onLine(lx, ly, [3.2, 2, 4, -3.6], 0.42)) return P.tunic[1];
        return tn(P.tunic, l);
      },
    },
  };
}

/** the girl's outfit: baggy sweater with a cream collar, pleated skirt, dark tights, shoes */
function dressChar(id: string, P: DressPal): V5Char {
  return {
    id,
    build: { ...GIRL_BUILD },
    skin: P.skin, handK: 0.72, neckR: 1.8,
    face: { eye: [3, 9], mouth: [6, 4], chin: [5, 1], top: 16 },
    leg: {
      rThigh: 2.5, rKnee: 2, rAnkle: 1.7,
      mat(s, nr) {
        const l = s.l + lb(nr);
        return tn(P.legs, l - (P.bareLegs ? 0 : 0.1));
      },
      foot(x, an, pitch, nr) {
        shoe5(x, an, pitch, nr, { shape: [-2, 0, 3.8, 0, 4.4, 1, 4.2, 2, 2.4, 2.6, 1, 3.2, -1.8, 3.2, -2.3, 1.8], ah: 2, body: P.shoe, sole: P.sole });
      },
    },
    arm: {
      rSh: 2.4, rEl: 2.2, rWr: 2,
      foreR: u => 2 + Math.max(0, u - 0.5) * 0.9,
      upper(s, nr) { return tn(P.top, s.l + lb(nr) - (Math.abs(s.u - 0.6) < 0.06 && s.v < 0.1 ? 0.6 : 0)); },
      fore(s, nr) { return tn(P.top, s.l + lb(nr) + (s.u > 0.86 ? -0.4 : 0) - (Math.abs(s.u - 0.35) < 0.06 && s.v > -0.2 ? 0.6 : 0)); },
    },
    torso: {
      prof: [[-3.4, -7.4, 7.4], [0, -7.2, 7.3], [5, -7, 7], [11, -6.8, 6.8], [16.4, -6.4, 6.2], [18.8, -5, 4.8], [20, -2.6, 2.4]],
      mat(s, x) {
        const lx = s.lx, ly = s.ly, top = x.b.torso;
        const l = formL(s, top);
        if (ly > top - 1.4 && Math.abs(lx - 0.6) < 2.8) return P.collar;
        // the sweater's long diagonal folds
        if (onLine(lx, ly, [-6, 17, -3.6, 12.6, -4.2, 7], 0.45) || onLine(lx, ly, [-1, 15.4, 1.6, 11], 0.42) || onLine(lx, ly, [5.6, 15, 4.4, 9.4], 0.42) || onLine(lx, ly, [-5, 4, -6, -1.6], 0.45)) return P.top[1];
        return tn(P.top, l);
      },
    },
    afterLegs(x) {
      // pleated skirt flaring from under the sweater
      torsoFrame(x, [-13, 13, -10, 2], (lx, ly) => {
        if (ly > 0.5 || ly < -8) return -1;
        const k = (0.5 - ly) * 0.5;
        if (lx < -7 - k || lx > 7.2 + k) return -1;
        const pl = (lx * (1 - ly * 0.04) + 40) % 2.4;
        if (ly < -7.2) return pl < 1.2 ? P.skirt[2] : P.skirt[1];
        if (pl > 2.1) return P.skirt[1];
        return tn(P.skirt, (pl < 1.1 ? 0.3 : -0.25) + (lx > 3.5 ? 0.3 : lx < -4 ? -0.45 : 0), 0, true);
      });
      merge5(x.c, 0.44, 0.26);
    },
  };
}

const BOY_SKIN = R6('#3a1810', '#8c392f', '#ba805d', '#f3a572', '#f8c090', '#ffe0b8');
const GIRL_SKIN = R6('#3a1c1c', '#c27369', '#d4887d', '#f4b3a2', '#f8c8b8', '#ffe4d8');

export const MORI5 = tunicChar('mori', {
  skin: BOY_SKIN,
  tunic: R6('#1d0e0f', '#2f1617', '#453a3a', '#5b4b4b', '#635c5d', '#756e6f'),
  belt: R6('#1d0e0f', '#4d2c25', '#61372d', '#744830', '#825643', '#9a664a'),
  shorts: R6('#0c0607', '#0f0c14', '#1b1b23', '#252633', '#2e3040', '#3a3c4e'),
  boot: R6('#0c0607', '#1d0e0f', '#231518', '#2f1617', '#3a2f30', '#4a3a3a'),
  glove: R6('#0c0607', '#1d0e0f', '#2b2122', '#3a2f30', '#4d3a38', '#5e4a46'),
  sole: R6('#050303', '#0c0607', '#140a0a', '#1d0e0f', '#2a1818', '#382424'),
});
export const JOSHU5 = tunicChar('joshu', {
  skin: BOY_SKIN,
  tunic: R6('#10121e', '#181a2a', '#232a44', '#303a5a', '#3a486a', '#46557a'),
  belt: R6('#1d0e0f', '#4d2c25', '#61372d', '#744830', '#825643', '#9a664a'),
  shorts: R6('#0c0a08', '#1e1a16', '#2e2a24', '#3e3830', '#4c463c', '#5a5448'),
  boot: R6('#0c0607', '#1d0e0f', '#231518', '#2f1617', '#3a2f30', '#4a3a3a'),
  glove: R6('#0c0a10', '#141828', '#1a1e2e', '#20263a', '#2a3048', '#343c58'),
  sole: R6('#050303', '#0c0607', '#140a0a', '#1d0e0f', '#2a1818', '#382424'),
});
export const JENNA5 = dressChar('jenna', {
  skin: GIRL_SKIN,
  top: R6('#1c1111', '#372329', '#513f45', '#6d4855', '#7b5459', '#876465'),
  collar: hex('#e1c7bc'),
  skirt: R6('#040103', '#0d0b17', '#161422', '#1f1c2f', '#281e3a', '#342a48'),
  legs: R6('#040103', '#0c0609', '#0d0b17', '#161422', '#1f1c2f', '#2a2638'),
  shoe: R6('#1c1111', '#372329', '#442c32', '#54302e', '#6a4038', '#80524a'),
  sole: R6('#040103', '#1c1111', '#281a1a', '#372329', '#442c32', '#54302e'),
});
export const AROHA5 = dressChar('aroha', {
  skin: R6('#2a1610', '#6a3e2c', '#7a4a32', '#9a6446', '#bc855e', '#d49c74'),
  top: R6('#2a2014', '#40301e', '#6e5434', '#9c7a4c', '#b08c5c', '#c4a070'),
  collar: hex('#a8342c'),
  skirt: R6('#141408', '#262618', '#3a3a24', '#4c4c30', '#5c5c3c', '#6e6e4a'),
  legs: R6('#2a1610', '#6a3e2c', '#7a4a32', '#9a6446', '#bc855e', '#d49c74'),
  shoe: R6('#1a0e08', '#3a2414', '#50321c', '#6a4428', '#845a38', '#a0744a'),
  sole: R6('#0a0604', '#1a0e08', '#2a1a10', '#3a2414', '#50321c', '#6a4428'),
  bareLegs: true,
});

export const V5_CHARS: Record<string, V5Char> = { mori: MORI5, jenna: JENNA5, joshu: JOSHU5, aroha: AROHA5 };

export const V5_INFO: Record<string, { name: string; short: string; voice: number; height: number }> = {
  mori: { name: 'Mori', short: 'Mori', voice: 1, height: 56 },
  jenna: { name: 'Jenna', short: 'Jenna', voice: 1.5, height: 63 },
  joshu: { name: 'Joshu', short: 'Joshu', voice: 0.62, height: 56 },
  aroha: { name: 'Aroha', short: 'Aroha', voice: 1.12, height: 63 },
  chunk: { name: 'Chunk', short: 'Chunk', voice: 1.3, height: 16 },
};

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

// ================================================================== MORI

const MO = {
  skin: R6('#3a1e18', '#9a5440', '#d08a66', '#f2b48a', '#fcd6b4', '#fff0dc'),
  vest: R6('#1a1a12', '#2e3222', '#434a30', '#5a6240', '#747c52', '#8e9668'),
  shirt: R6('#2a2218', '#6a5a40', '#8e7c5a', '#ae9c76', '#c8b890', '#e0d4ac'),
  pants: R6('#1c1612', '#3a2e24', '#50402f', '#665240', '#7e6850', '#968064'),
  boot: R6('#140c0a', '#2a1a14', '#3c2820', '#52382a', '#6c4c38', '#8a6448'),
  sole: R6('#0c0808', '#161010', '#201818', '#2e2424', '#3e3232', '#4e4040'),
  belt: R6('#140e0c', '#241a14', '#34261c', '#463226', '#5c4432', '#765a42'),
  brass: ramp('#c8a050', { lift: 1.3 }),
  pack: R6('#1e140e', '#4a3020', '#62422c', '#7c5638', '#96704a', '#b08a5e'),
  lid: R6('#1a100c', '#3a261a', '#4e3424', '#644430', '#7c583e', '#946c4e'),
  strap: R6('#100e0e', '#1e1c1c', '#2a2828', '#383434', '#4a4444', '#5e5656'),
  mat: R6('#141a12', '#2a3422', '#3a4630', '#4c5a3e', '#62724e', '#7a8a62'),
  cam: R6('#0e0e12', '#1e1e24', '#2a2a32', '#3a3a44', '#50505c', '#6a6a78'),
};

export const MORI5: V5Char = {
  id: 'mori',
  build: { hipH: 30, thigh: 13.8, shin: 13.6, ankleH: 2.4, torso: 19.5, neck: 0.3, shY: 2.6, shF: -4, shB: 4.4, upArm: 10.2, foreArm: 9.2, legF: -2.1, legB: 2.1 },
  skin: MO.skin, handK: 0.78, neckR: 1.9,
  face: { eye: [3, 9], mouth: [6, 4], chin: [5, 1], top: 16 },
  leg: {
    rThigh: 2.5, rKnee: 2, rAnkle: 1.8,
    mat(s: Sample, nr) {
      const l = s.l + lb(nr);
      // side cargo pocket on the thigh: flap seam, a shadowed opening
      if (s.u > 0.16 && s.u < 0.38 && s.v > 0) {
        if (s.u < 0.19) return MO.pants[1];
        return tn(MO.pants, l - 0.3);
      }
      // knee crease and a fold at the boot top
      if (Math.abs(s.u - 0.5) < 0.025 && s.v < 0.4) return MO.pants[1];
      if (s.u > 0.8) return tn(MO.pants, l + (s.u < 0.84 ? -0.4 : 0.15));
      return tn(MO.pants, l);
    },
    foot(x, an, pitch, nr) {
      shoe5(x, an, pitch, nr, { shape: [-2.3, 0, 3.4, 0, 4, 0.9, 3.9, 2, 2.6, 2.6, 1.6, 3.4, 1.4, 5, -2.2, 5, -2.5, 2.2], ah: 2.2, body: MO.boot, sole: MO.sole, lace: hex('#9a7a52'), cuff: MO.boot, cuffH: 0.9 });
    },
  },
  arm: {
    rSh: 1.9, rEl: 1.6, rWr: 1.3,
    upper(s, nr) {
      const l = s.l + lb(nr);
      // khaki sleeve rolled above the elbow: a lighter, thicker cuff band
      if (s.u > 0.76) return tn(MO.shirt, l + (s.u < 0.82 ? 0.45 : 0.1), 0, true);
      if (Math.abs(s.u - 0.4) < 0.05 && s.v < 0) return MO.shirt[2];
      return tn(MO.shirt, l);
    },
    fore(s, nr) {
      // field watch on the near wrist
      if (nr && s.u > 0.8 && s.u < 0.94) return s.v > 0.2 ? hex('#5a9a92') : hex('#262428');
      return tn(MO.skin, s.l + lb(nr));
    },
  },
  torso: {
    prof: [[-3, -4.2, 4.4], [0, -4.3, 4.5], [5, -4, 4.2], [11, -4.5, 4.8], [16.5, -4.8, 5], [18.6, -4, 3.8], [19.5, -2.2, 2]],
    mat(s, x) {
      const lx = s.lx, ly = s.ly, top = x.b.torso;
      const l = formL(s, top);
      if (ly < 0.3) return tn(MO.pants, l - 0.1);
      if (ly < 2) {
        // belt with a brass buckle
        if (lx > 1.1 && lx < 3.3) return lx > 1.7 && lx < 2.7 && ly > 0.7 && ly < 1.5 ? MO.belt[1] : tn(MO.brass, l + 0.3, 0, true);
        return tn(MO.belt, l + (ly > 1.4 ? 0.35 : 0), 0, true);
      }
      // open vest: the shirt shows in a V down the chest, collar points at the top
      const cx = 1.4, vw = 0.45 + (ly - 2) * 0.075;
      if (Math.abs(lx - cx) < vw) {
        if (ly > top - 1.8) return tn(MO.shirt, l + 0.4, 0, true);
        if (Math.abs(lx - cx) < 0.45 && Math.floor(ly) % 3 === 0) return MO.shirt[2];
        return tn(MO.shirt, l + 0.05);
      }
      // camera strap: far shoulder across the chest to the near hip
      const cam = x.anim === 'camera' || x.anim === 'cameraCrouch' || x.anim === 'photograph';
      if (!cam && onLine(lx, ly, [4.2, top - 0.6, -3.8, 2.6], 0.55)) return tn(MO.strap, l + 0.3, 0, true);
      // lapel edge catches the light
      if (lx > cx && Math.abs(lx - cx) < vw + 0.8) return tn(MO.vest, l + 0.45, 0, true);
      // chest pocket on the far side: flap line + button
      if (lx > 2.4 && lx < 4.4 && ly > 11.4 && ly < 14.2) {
        if (ly > 13.3) return MO.vest[1];
        if (Math.abs(lx - 3.4) < 0.5 && ly > 12.5) return tn(MO.brass, 0.2);
        return tn(MO.vest, l - 0.1);
      }
      // pack strap over the near shoulder
      if (lx > -3.8 && lx < -2.4 && ly > 8 && ly < top) return tn(MO.strap, l + (ly > top - 2 ? 0.5 : 0.1), 0, true);
      // folds: under the far arm, above the belt, the near side seam
      if (onLine(lx, ly, [4.2, 15, 3.4, 10.6], 0.45) || onLine(lx, ly, [-1.2, 2.2, -2, 5], 0.45) || onLine(lx, ly, [2.8, 2.2, 3.6, 5.2], 0.45)) return MO.vest[1];
      return tn(MO.vest, l);
    },
  },
  behind(x) {
    // big field pack on the back: canvas body, darker lid with a buckle, rolled mat on top
    const sw = x.P.sway ?? 0, bo = x.P.bounce ?? 0;
    torsoFrame(x, [-12, -1, 2, 24], (lx0, ly0) => {
      const lx = lx0 + sw * 0.4, ly = ly0 - bo * 0.3;
      const inPack = lx < -3.4 && lx > -9.6 && ly > 5 && ly < 18.4 && !(lx < -8.8 && (ly < 5.8 || ly > 17.6));
      const inMat = ly >= 18.4 && ly < 21.2 && lx > -9.8 && lx < -3.2;
      if (inMat) {
        if (Math.abs(lx + 6.6) < 0.45 || Math.abs(lx + 4.2) < 0.45) return MO.strap[2];
        return tn(MO.mat, ly > 20.4 ? 0.55 : ly < 19 ? -0.5 : 0.05, 0, true);
      }
      if (!inPack) return -1;
      const lid = ly > 14.4;
      if (Math.abs(lx + 6.6) < 0.55 && ly > 11.6 && ly < 15.4) return MO.strap[2];
      if (Math.abs(lx + 6.6) < 0.7 && Math.abs(ly - 11.4) < 0.6) return tn(MO.brass, 0.4, 0, true);
      // side pocket
      if (lx > -5.6 && ly > 5.6 && ly < 10.8) return ly > 10.2 ? MO.pack[1] : tn(MO.pack, lx > -4.3 ? -0.4 : 0.1);
      const edge = lx > -4.3 ? -0.5 : lx < -8.8 ? -0.3 : lx < -7.6 ? 0.35 : 0;
      return lid ? tn(MO.lid, edge + (ly > 17.4 ? 0.5 : 0), 0, true) : tn(MO.pack, edge + (ly < 6 ? -0.4 : 0));
    });
    merge5(x.c, 0.42, 0.1);
  },
  afterTorso(x) {
    // the camera at the near hip on its strap
    if (x.anim === 'camera' || x.anim === 'cameraCrouch' || x.anim === 'photograph') return;
    torsoFrame(x, [-8, -1, -1, 6], (lx, ly) => {
      if (lx > -6.6 && lx < -2.8 && ly > 0.6 && ly < 3.8) {
        if (lx < -5.6 && ly > 1.4 && ly < 3) return hex('#6ab8d0');
        if (ly > 3.1) return tn(MO.cam, 0.6, 0, true);
        return tn(MO.cam, lx > -4.2 ? -0.3 : 0.1, 0, true);
      }
      return -1;
    });
    merge5(x.c, 0.36, 0.14);
  },
};

// ================================================================== JENNA

const JE = {
  skin: R6('#3a1e1c', '#b0645a', '#dc8c7c', '#f8c0a8', '#fcdcc8', '#fff2e6'),
  hood: R6('#1c1624', '#3e3454', '#584c74', '#72669a', '#8c80b2', '#a89cc8'),
  cat: R6('#3a1a26', '#8a4a62', '#b0667e', '#d08aa2', '#e8aabe', '#f8cad6'),
  skirt: R6('#0c0c16', '#161626', '#222236', '#2e2e48', '#3e3e5c', '#525272'),
  sockA: R6('#0e0c14', '#1a1826', '#24223a', '#2e2c48', '#3a3858', '#48466a'),
  sockB: R6('#2a1620', '#5a3444', '#744458', '#8c566c', '#a46c82', '#bc869a'),
  shoe: R6('#26222a', '#7a7280', '#a29aa8', '#c4bcc8', '#dcd6e0', '#f0ecf2'),
  sole: R6('#2a141e', '#5a2e40', '#7a4058', '#944e6a', '#ae6a84', '#c88aa0'),
  phones: R6('#0e0c12', '#1c1a24', '#2a2632', '#3a3444', '#4e4858', '#666070'),
  cup: R6('#2a1018', '#6a2e40', '#8e4058', '#a8566e', '#c47088', '#dc8ea2'),
};

export const JENNA5: V5Char = {
  id: 'jenna',
  build: { hipH: 27.4, thigh: 12.6, shin: 12.4, ankleH: 2.2, torso: 17.2, neck: 0.3, shY: 2.3, shF: -3.7, shB: 4, upArm: 9, foreArm: 8.2, legF: -1.9, legB: 1.9 },
  skin: JE.skin, handK: 0.7, neckR: 1.7,
  face: { eye: [3, 9], mouth: [6, 4], chin: [5, 1], top: 16 },
  leg: {
    rThigh: 2.2, rKnee: 1.7, rAnkle: 1.4,
    mat(s, nr) {
      const l = s.l + lb(nr);
      if (s.u < 0.36) return tn(JE.skin, l);
      // striped over-knee socks with a plain cuff
      if (s.u < 0.42) return tn(JE.sockB, l + 0.35);
      const band = Math.floor((s.u - 0.42) * 15) % 2 === 0;
      return tn(band ? JE.sockA : JE.sockB, l - (band ? 0 : 0.1));
    },
    foot(x, an, pitch, nr) {
      shoe5(x, an, pitch, nr, { shape: [-2, 0, 3.6, 0, 4.2, 1, 4, 2.2, 2.4, 2.8, 1, 3.4, -1.6, 3.4, -2.3, 2], ah: 2, body: JE.shoe, sole: JE.sole, soleH: 1.1, lace: hex('#a8566e'), toe: JE.shoe });
    },
  },
  arm: {
    rSh: 1.9, rEl: 1.7, rWr: 1.6,
    // baggy hoodie sleeves bunch at the cuff
    foreR: u => 1.65 + Math.max(0, u - 0.55) * 1,
    upper(s, nr) {
      const l = s.l + lb(nr);
      if (Math.abs(s.u - 0.62) < 0.06 && s.v < 0.1) return JE.hood[1];
      return tn(JE.hood, l);
    },
    fore(s, nr) {
      const l = s.l + lb(nr);
      if (s.u > 0.84) return tn(JE.hood, l + (s.u < 0.9 ? -0.35 : 0.3));
      if (Math.abs(s.u - 0.36) < 0.06 && s.v > -0.2) return JE.hood[1];
      return tn(JE.hood, l);
    },
  },
  torso: {
    prof: [[-3.4, -4.8, 4.9], [0, -4.8, 5], [5, -4.5, 4.7], [11, -4.4, 4.6], [15.4, -4.3, 4.3], [16.6, -3.4, 3.2], [17.2, -2, 1.9]],
    mat(s, x) {
      const lx = s.lx, ly = s.ly, top = x.b.torso;
      const l = formL(s, top);
      // ribbed hem
      if (ly < -2.2) return tn(JE.hood, l + (Math.floor(lx + 20) % 2 ? -0.35 : 0.1));
      // kangaroo pocket: stitched top edge and side openings
      if (lx > -2 && lx < 3.8 && ly > -1.4 && ly < 3.4) {
        if (ly > 2.8) return JE.hood[1];
        if (lx < -1.4 || lx > 3.2) return JE.hood[2];
        return tn(JE.hood, l - 0.2);
      }
      // cat face print on the chest (ears, face, two eyes)
      const cx = 1.4, cy = 9.6;
      const dx = lx - cx, dy = ly - cy;
      if (Math.abs(dx) < 1.6 && dy > -1.3 && dy < 1.6) {
        if (dy > 0.6 && Math.abs(dx) > 0.8) return tn(JE.cat, 0.2);
        if (dy <= 0.6) return Math.abs(dy + 0.1) < 0.45 && Math.abs(Math.abs(dx) - 0.8) < 0.4 ? JE.cat[1] : tn(JE.cat, 0.3, 0, true);
      }
      // drawstrings hanging from the neck
      if ((Math.abs(lx - 0.1) < 0.4 || Math.abs(lx - 2.5) < 0.4) && ly > top - 4.6 && ly < top - 1) return ly < top - 3.8 ? hex('#cfc4d8') : hex('#ece4f0');
      // folds: from the near armpit, a long drape at the front, at the hem
      if (onLine(lx, ly, [-4.2, 14, -2.6, 10.6, -3, 6.4], 0.45) || onLine(lx, ly, [4.2, 13, 3.4, 8.8], 0.42) || onLine(lx, ly, [-3.4, 3.4, -4.2, -1], 0.45) || onLine(lx, ly, [4.4, 3.6, 4.2, -1.2], 0.42)) return JE.hood[1];
      return tn(JE.hood, l);
    },
  },
  behind(x) {
    // the hood bunched behind the neck
    const hy = x.b.torso - 1.4;
    torsoFrame(x, [-8, 1, hy - 4, hy + 4], (lx, ly) => {
      const hood = (lx + 2.8) ** 2 / 6 + (ly - hy) ** 2 / 3.6 < 1;
      if (!hood) return -1;
      if ((lx + 2.8) ** 2 / 2.2 + (ly - hy - 0.3) ** 2 / 1.2 < 1) return JE.hood[1];
      return tn(JE.hood, ly > hy + 0.8 ? 0.3 : -0.3);
    });
    merge5(x.c, 0.4, 0.08);
  },
  afterLegs(x) {
    // pleated skirt flaring from under the hoodie hem
    torsoFrame(x, [-12, 12, -10, 2], (lx, ly) => {
      if (ly > 0.5 || ly < -8.6) return -1;
      const k = (0.5 - ly) * 0.42;
      if (lx < -5 - k || lx > 5.1 + k) return -1;
      // pleats fan out toward the hem
      const pl = (lx * (1 - ly * 0.04) + 40) % 2.4;
      if (ly < -7.8) return pl < 1.2 ? JE.skirt[2] : JE.skirt[1];
      if (pl > 2.1) return JE.skirt[1];
      const side = lx > 3 ? 0.3 : lx < -3.4 ? -0.45 : 0;
      return tn(JE.skirt, (pl < 1.1 ? 0.3 : -0.25) + side, 0, true);
    });
    merge5(x.c, 0.44, 0.26);
  },
  afterTorso(x) {
    // headphones resting round the neck, one pink ear cup at the front
    const top = x.b.torso;
    torsoFrame(x, [-6, 7, top - 3, top + 2], (lx, ly) => {
      if (lx > 1.8 && lx < 4.4 && ly > top - 2.4 && ly < top + 0.2) return lx > 3.7 ? JE.cup[1] : tn(JE.cup, ly > top - 0.8 ? 0.5 : 0, 0, true);
      if (ly > top - 0.9 && ly < top + 0.3 && lx > -3.6 && lx <= 1.8) return tn(JE.phones, 0.3, 0, true);
      return -1;
    });
    merge5(x.c, 0.4, 0.14);
  },
};

// ================================================================== JOSHU

const JO = {
  skin: R6('#3a1c16', '#8a4a3a', '#c07c60', '#e8a47e', '#f6c49e', '#ffe0c4'),
  knit: R6('#0e1018', '#1a2034', '#242c46', '#303a5a', '#404c72', '#56648c'),
  pants: R6('#141210', '#26221e', '#34302a', '#443e36', '#564e44', '#6a6054'),
  boot: R6('#0a0a0c', '#141418', '#1e1e24', '#2a2a30', '#3a3a42', '#50505a'),
  sole: R6('#060608', '#0e0e10', '#161618', '#202022', '#2a2a2c', '#343436'),
  ink: hex('#3a5a86'),
};

export const JOSHU5: V5Char = {
  id: 'joshu',
  build: { hipH: 31, thigh: 14.2, shin: 14, ankleH: 2.6, torso: 25, neck: 0.4, shY: 3.2, shF: -5.6, shB: 6, upArm: 11.6, foreArm: 10.4, legF: -3, legB: 3 },
  skin: JO.skin, handK: 0.95, neckR: 2.6,
  face: { eye: [3, 9], mouth: [6, 4], chin: [5, 1], top: 16 },
  leg: {
    rThigh: 3.1, rKnee: 2.6, rAnkle: 2.3,
    mat(s, nr) {
      const l = s.l + lb(nr);
      // sea boots to below the knee with a turned-down top
      if (s.u > 0.62) {
        if (s.u < 0.68) return tn(JO.boot, l + 0.55, 0, true);
        return tn(JO.boot, l + (s.v > 0.35 ? 0.45 : 0), 0, true);
      }
      if (Math.abs(s.u - 0.3) < 0.03 && s.v < 0.2) return JO.pants[1];
      return tn(JO.pants, l);
    },
    foot(x, an, pitch, nr) {
      shoe5(x, an, pitch, nr, { shape: [-3, 0, 4.6, 0, 5.3, 1.1, 5, 2.5, 3.2, 3.4, 2.4, 4.6, 2.4, 5.2, -3, 5.2, -3.3, 2.6], ah: 2.6, body: JO.boot, sole: JO.sole, soleH: 1.2 });
    },
  },
  arm: {
    rSh: 2.8, rEl: 2.4, rWr: 1.9,
    upper(s, nr) {
      const l = s.l + lb(nr);
      // rolled sleeve bunched above the elbow
      if (s.u > 0.74) return tn(JO.knit, l + 0.4 + (Math.floor(s.v * 3 + 3) % 2 ? -0.35 : 0), 0, true);
      // cable down the sleeve
      if (Math.abs(s.v - 0.1) < 0.22 && Math.floor(s.u * 10) % 2 === 0) return tn(JO.knit, l + 0.4);
      return tn(JO.knit, l);
    },
    fore(s, nr) {
      // anchor tattoo on the near forearm
      if (nr && s.u > 0.28 && s.u < 0.62 && Math.abs(s.v) < 0.42 && (Math.abs(s.v) < 0.13 || s.u > 0.54 || (s.u < 0.34 && Math.abs(s.v) < 0.3))) return JO.ink;
      return tn(JO.skin, s.l + lb(nr));
    },
  },
  torso: {
    prof: [[-3.2, -6.2, 6.6], [0, -6.4, 6.9], [6, -6.6, 7.4], [12, -6.8, 7.4], [18, -6.9, 7.1], [22.4, -6.4, 6.4], [24.2, -4.6, 4.3], [25, -2.6, 2.5]],
    mat(s, x) {
      const lx = s.lx, ly = s.ly, top = x.b.torso;
      const l = formL(s, top);
      // ribbed hem
      if (ly < -0.4) return tn(JO.knit, l + (Math.floor(lx + 30) % 2 ? -0.35 : 0.1));
      if (ly < 0.4) return JO.knit[1];
      // three cables down the front, twisting every two rows
      for (const c of [-2.8, 0.9, 4.6]) {
        const d = lx - c;
        if (Math.abs(d) < 1.3) {
          const tw = Math.floor(ly / 2) % 2 === 0;
          if (Math.abs(d) > 0.9) return JO.knit[1];
          return tn(JO.knit, l + ((tw ? d > 0 : d <= 0) ? 0.45 : -0.15), 0, true);
        }
      }
      // folds under the arms and across the belly
      if (onLine(lx, ly, [-6, 18, -5, 12], 0.45) || onLine(lx, ly, [6.6, 17, 5.8, 11.6], 0.45) || onLine(lx, ly, [-5.2, 3.4, -2.2, 2.2], 0.42)) return JO.knit[1];
      // moss-stitch fill: a quiet texture
      const moss = (Math.floor(lx) + Math.floor(ly)) % 2 === 0;
      return tn(JO.knit, l + (moss ? 0.08 : -0.08));
    },
  },
};

// ================================================================== AROHA

const AR = {
  skin: R6('#2a1610', '#6a3e2c', '#9a6446', '#bc855e', '#d49c74', '#e8b890'),
  top: R6('#2a2014', '#6a5438', '#8a7050', '#a88c66', '#c4a880', '#dcc49c'),
  shorts: R6('#141408', '#2a2a18', '#3a3a24', '#4c4c30', '#606040', '#787852'),
  belt: R6('#140c08', '#2a1c12', '#3a281a', '#4a3222', '#5e4230', '#765640'),
  sandal: R6('#1a0e08', '#3a2414', '#50321c', '#6a4428', '#845a38', '#a0744a'),
  kete: R6('#2a1e0c', '#5a4222', '#7a5a30', '#98723e', '#b08a4e', '#c8a462'),
  pounamu: ramp('#3a8a6a', { lift: 1.5 }),
  sling: R6('#1e140c', '#4a3020', '#62422c', '#7c5838', '#96704a', '#b08a5e'),
};

export const AROHA5: V5Char = {
  id: 'aroha',
  build: { hipH: 29, thigh: 13.3, shin: 13.2, ankleH: 2.2, torso: 17.6, neck: 0.3, shY: 2.3, shF: -3.6, shB: 3.9, upArm: 9.6, foreArm: 8.6, legF: -1.9, legB: 1.9 },
  skin: AR.skin, handK: 0.74, neckR: 1.6,
  face: { eye: [3, 9], mouth: [6, 4], chin: [5, 1], top: 16 },
  leg: {
    rThigh: 2.3, rKnee: 1.8, rAnkle: 1.5,
    mat(s, nr) {
      const l = s.l + lb(nr);
      if (s.u < 0.26) {
        // shorts leg with a rolled hem
        if (s.u > 0.2) return tn(AR.shorts, l + 0.45);
        return tn(AR.shorts, l - 0.05);
      }
      // flax ties wrapping the ankle
      if (s.u > 0.9 && Math.floor(s.u * 44) % 2 === 0) return tn(AR.sandal, l + 0.25);
      return tn(AR.skin, l);
    },
    foot(x, an, pitch, nr) {
      // bare foot on a sandal sole with a toe strap
      const bias = lb(nr) + 0.1;
      footFrame(x.c, an, pitch, [-3, 5, -3, 3], (fx, fy) => {
        const y = fy + 2;
        const inFoot = polyIn([-2, 0, 3.6, 0, 4.2, 0.8, 3.6, 1.6, 1, 2.2, -1.4, 2.6, -2.1, 1.4], fx, y);
        if (!inFoot) return -1;
        if (y < 0.8) return AR.sandal[2];
        if (fx > 1.8 && fx < 2.8) return tn(AR.sandal, 0.3, bias, true);
        return tn(AR.skin, (y > 1.5 ? 0.4 : 0) + (fx > 3 ? 0.2 : 0) + (fx < -1.2 ? -0.5 : 0), bias);
      });
      merge5(x.c, 0.38, 0.14);
    },
  },
  arm: {
    rSh: 1.7, rEl: 1.45, rWr: 1.25,
    upper(s, nr) { return tn(AR.skin, s.l + lb(nr)); },
    fore(s, nr) {
      // plaited flax wristband on the near wrist
      if (nr && s.u > 0.82 && s.u < 0.95) return (Math.floor(s.v * 3 + 3) % 2) ? hex('#a8443a') : hex('#d8c8a0');
      return tn(AR.skin, s.l + lb(nr));
    },
  },
  torso: {
    prof: [[-3, -4.3, 4.6], [0, -4.5, 4.8], [5, -3.6, 3.9], [11, -4.1, 4.6], [15.6, -4.1, 4.3], [16.9, -3.3, 3.1], [17.6, -1.9, 1.8]],
    mat(s, x) {
      const lx = s.lx, ly = s.ly, top = x.b.torso;
      const l = formL(s, top);
      if (ly < 0.4) return tn(AR.shorts, l - 0.1);
      if (ly < 1.8) {
        // woven belt with a bone toggle
        if (lx > 2.2 && lx < 3.4) return tn(AR.top, 0.7, 0, true);
        return tn(AR.belt, l + ((Math.floor(lx * 1.5) % 2) ? 0.2 : -0.1), 0, true);
      }
      // taniko band along the hem: stepped red / black / cream triangles
      if (ly < 3.8) {
        const u = (lx + 20) * 1.1;
        const cell = Math.floor(u), f = u - cell;
        const tri = f < (ly - 1.8) / 2;
        const dark = s.u < 0.2;
        return cell % 2 ? (tri ? hex(dark ? '#7a2622' : '#a8342c') : hex('#1e1416')) : (tri ? hex('#1e1416') : hex(dark ? '#a8987e' : '#e0d2b4'));
      }
      // bare shoulders and collarbone above the top
      if (ly > top - 1.6 && Math.abs(lx - 0.8) < 3.4) return tn(AR.skin, l);
      // pounamu pendant on a cord
      const px = 1.9, py = top - 5.4;
      if ((lx - px) ** 2 / 0.9 + (ly - py) ** 2 / 1.6 < 1) return tn(AR.pounamu, (lx < px ? 0.5 : -0.1) + (ly > py ? 0.3 : 0), 0, true);
      if (onLine(lx, ly, [px, py + 1.1, 0, top - 1.2], 0.38) || onLine(lx, ly, [px, py + 1.1, 3.6, top - 1.4], 0.38)) return hex('#2a1810');
      // woven texture: a quiet diagonal twill, folds under the arms
      if (onLine(lx, ly, [-3.8, 13.6, -2.8, 10], 0.42) || onLine(lx, ly, [4.2, 12.6, 3.6, 9.4], 0.42)) return AR.top[1];
      const tw = (Math.floor(lx * 1.2 + ly) % 3 + 3) % 3 === 0;
      return tn(AR.top, l + (tw ? -0.14 : 0.04));
    },
  },
  afterTorso(x) {
    // kete (flax bag) at the near hip, the slingshot tucked in the belt at the back
    torsoFrame(x, [-10, 3, -6, 6], (lx, ly) => {
      if (lx > -6.2 && lx < -2.6 && ly > -4.4 && ly < 1) {
        const weave = (Math.floor(lx * 1.5) + Math.floor(ly * 1.5)) % 2 === 0;
        if (ly > 0.3) return AR.kete[1];
        return tn(AR.kete, (weave ? 0.3 : -0.15) + (lx > -3.6 ? -0.3 : 0), 0, true);
      }
      if (onLine(lx, ly, [-4.8, 1, -3, 5], 0.4)) return AR.kete[2];
      if (x.anim !== 'slingAim' && x.anim !== 'slingshot') {
        if (Math.abs(lx + 6.2) < 0.55 && ly > -1 && ly < 3.6) return tn(AR.sling, 0.1);
        if (ly >= 3.6 && ly < 5.4 && (Math.abs(lx + 6.2 - (ly - 3.6) * 0.8) < 0.5 || Math.abs(lx + 6.2 + (ly - 3.6) * 0.8) < 0.5)) return tn(AR.sling, 0.4);
      }
      return -1;
    });
    merge5(x.c, 0.4, 0.14);
  },
};

export const V5_CHARS: Record<string, V5Char> = { mori: MORI5, jenna: JENNA5, joshu: JOSHU5, aroha: AROHA5 };

export const V5_INFO: Record<string, { name: string; short: string; voice: number; height: number }> = {
  mori: { name: 'Mori', short: 'Mori', voice: 1, height: 70 },
  jenna: { name: 'Jenna', short: 'Jenna', voice: 1.5, height: 65 },
  joshu: { name: 'Joshu', short: 'Joshu', voice: 0.62, height: 74 },
  aroha: { name: 'Aroha', short: 'Aroha', voice: 1.12, height: 69 },
  chunk: { name: 'Chunk', short: 'Chunk', voice: 1.3, height: 16 },
};

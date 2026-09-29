// V4 anime cast bodies: Mori (naturalist), Jenna (pink-haired coder), Joshu (sailor dad) and Aroha.
// Built on the V2 skeleton with anime proportions (~4 heads tall with the head templates on top).

import type { Build, Sample } from '../people-rig';
import { at } from '../people-rig';
import { Ctx, torsoFrame, footFrame, polyIn } from '../people-parts';
import type { AnimeChar } from './body';
import { flat } from './body';
import { tones } from '../portrait/kit';
import { hex, mix, C } from '../color';
import type { AnimeId } from './heads';

type Pal = [C, C, C, C];
const T = (h: string, o: Parameters<typeof tones>[1] = {}): Pal => tones(h, o);
const FACE = { eye: [3, 9] as [number, number], mouth: [6, 4] as [number, number], chin: [5, 1] as [number, number], top: 16 };

/** simple shoe/boot from a side profile polygon (foot space: x forward from the ankle, y up from the sole) */
function shoe(x: Ctx, an: [number, number], pitch: number, near: boolean, o: { shape: number[]; ah: number; body: Pal; sole: C; lace?: C; cuff?: Pal; cuffH?: number; toe?: Pal }) {
  const sh = o.shape;
  let minX = 1e9, maxX = -1e9, maxY = 0;
  for (let i = 0; i < sh.length; i += 2) { minX = Math.min(minX, sh[i]); maxX = Math.max(maxX, sh[i]); maxY = Math.max(maxY, sh[i + 1]); }
  footFrame(x.c, an, pitch, [minX - 1, maxX + 1, -o.ah - 1, maxY - o.ah + 1], (fx, fy) => {
    const y = fy + o.ah;
    if (!polyIn(sh, fx, y)) return -1;
    if (y < 1) return o.sole;
    if (o.cuff && y > maxY - (o.cuffH ?? 1)) return flat(o.cuff, 0.3, near);
    if (o.toe && fx > maxX - 1.8 && y < 2.2) return flat(o.toe, 0.2, near);
    if (o.lace && fx > 0.4 && fx < 1.6 && y > 2 && y < 3.2) return o.lace;
    return flat(o.body, y > maxY - 1.2 ? 0.7 : fx > maxX - 1.2 ? 0.2 : fx < minX + 0.8 ? -0.5 : 0, near);
  });
}

// ------------------------------------------------------------------ MORI

const M = {
  skin: T('#f4c8a6', { sh: 0.12, deep: 0.26, hi: 0.08 }), shirt: T('#dccca2'), vest: T('#5e6e3c'), pants: T('#7a5a3a'),
  boot: T('#5a3a28'), sole: hex('#2a2024'), pack: T('#d0642a'), packG: T('#44503a'), strap: T('#3a3634'), mat: T('#6a7a4a'),
  bottle: T('#4aa0c8'), card: T('#f4f4ee'), camera: T('#3a3a44'),
};

export const MORI: AnimeChar = {
  id: 'mori',
  build: { hipH: 26.5, thigh: 12.2, shin: 11.8, ankleH: 2.4, torso: 15, neck: 1.6, shY: 2.4, shF: -1.3, shB: 2.4, upArm: 8.4, foreArm: 7.8, legF: -1.6, legB: 1.6 },
  skin: M.skin, handPal: M.skin, handK: 0.72,
  neckR: 1.6,
  face: FACE,
  leg: {
    rThigh: 2.5, rKnee: 2.1, rAnkle: 1.8, cuff: 0.6,
    mat(s: Sample, nr) {
      // cargo pants with a side pocket, tucked into the boots
      if (s.u > 0.2 && s.u < 0.36 && s.v > -0.2) return flat(M.pants, s.l - 0.35, nr);
      if (Math.abs(s.u - 0.2) < 0.02 && s.v > -0.2) return M.pants[0];
      return flat(M.pants, s.l, nr);
    },
    foot(x, an, pitch, nr) {
      shoe(x, an, pitch, nr, { shape: [-2.2, 0, 3.6, 0, 4.2, 1, 4, 2.2, 2.6, 2.8, 1.2, 3.2, 1, 4.6, -2, 4.6, -2.4, 2.4], ah: 2.4, body: M.boot, sole: M.sole, lace: hex('#e8c060'), cuff: M.boot, cuffH: 0.8 });
    },
  },
  arm: {
    rSh: 1.8, rEl: 1.5, rWr: 1.25,
    upper(s, nr) {
      // khaki shirt sleeve rolled up above the elbow
      if (s.u > 0.8) return flat(M.shirt, s.l + 0.45, nr);
      return flat(M.shirt, s.l, nr);
    },
    fore(s, nr) {
      if (nr && s.u > 0.86 && s.u < 0.96) return s.v > 0 ? hex('#2a2a30') : hex('#6ad0c8');
      return flat(M.skin, s.l, nr);
    },
    hand: M.skin,
  },
  torso: {
    prof: [[-3, -3.4, 3.6], [0, -3.7, 3.8], [5, -3.4, 3.4], [10, -3.9, 4.1], [13.6, -3.5, 3.4], [15, -2.4, 2.2]],
    mat(s, x) {
      const lx = s.lx, ly = s.ly, top = x.b.torso;
      if (ly < 1.1) return ly > 0.2 ? (Math.abs(lx - 2.6) < 0.7 ? hex('#e8c060') : hex('#3a2a22')) : flat(M.pants, s.l);
      // shirt collar showing at the open vest front
      const collar = lx > 0.6 && ly > top - 4.2 + (3.6 - lx) * 0.1;
      if (collar) return ly > top - 1 ? flat(M.shirt, s.l + 0.3) : flat(M.shirt, s.l);
      // research badge: ID card on a blue lanyard, plus one enamel pin
      const cardTop = top - 8.4;
      if (lx > 1.2 && lx < 3.4 && ly > cardTop - 2.6 && ly < cardTop) return ly > cardTop - 0.8 ? hex('#3a78c0') : M.card[2];
      if (Math.abs(lx - (2.2 + (ly - cardTop) * 0.2)) < 0.4 && ly >= cardTop && ly < top - 4.2) return hex('#3a78c0');
      if (Math.abs(lx - 0.8) < 0.5 && Math.abs(ly - (top - 5.6)) < 0.5) return hex('#e8483a');
      return flat(M.vest, s.l);
    },
  },
  behind(x) {
    // big field backpack: orange pack with a darker lid and a buckle strap, rolled mat on top
    torsoFrame(x, [-11, -1, 0, 19], (lx, ly) => {
      const pack = lx < -2.6 && lx > -8.6 && ly > 2.6 && ly < 14.4 && !(lx < -7.8 && (ly < 3.4 || ly > 13.6));
      const mat = ly >= 14.4 && ly < 17.2 && lx > -8.8 && lx < -3;
      if (mat) return flat(M.mat, (ly > 16.2 ? 0.7 : 0) + (Math.abs(lx + 5.9) < 0.45 ? -0.6 : 0));
      if (!pack) return -1;
      const lid = ly > 10.6;
      if (Math.abs(lx + 5.4) < 0.5 && ly > 7.6 && ly < 11.6) return M.strap[1];
      if (Math.abs(lx + 5.4) < 0.6 && Math.abs(ly - 7.4) < 0.6) return hex('#e8c060');
      const edge = lx > -3.4 ? -0.45 : lx < -7.6 ? -0.35 : 0.15;
      return flat(M.pack, edge + (lid ? (ly > 13.6 ? 0.55 : -0.25) : ly < 3.6 ? -0.5 : 0));
    });
    x.c.merge({ line: 0.35, ao: 0.1 });
  },
  afterTorso(x) {
    // shoulder straps + the camera hanging at the hip
    torsoFrame(x, [-5, 5, 0, 16], (lx, ly) => {
      const st = Math.abs(lx - (-1.4 + (ly - 14) * 0.08)) < 0.6 && ly > 6 && ly < 14.4;
      if (st) return M.strap[2];
      if (x.anim !== 'camera' && x.anim !== 'cameraCrouch' && x.anim !== 'photograph') {
        const strap = Math.abs(lx - (-1 + (13 - ly) * 0.34)) < 0.45 && ly > 4 && ly < 13;
        if (strap) return hex('#2a2a30');
        if (lx > 1.2 && lx < 4.6 && ly > 1.2 && ly < 4) return lx > 3.6 && ly > 1.8 && ly < 3.4 ? hex('#5ab8e0') : flat(M.camera, ly > 3.4 ? 0.7 : 0);
      }
      return -1;
    });
    x.c.merge({ line: 0.3, ao: 0.12 });
  },
};

// ------------------------------------------------------------------ JENNA

const J = {
  skin: T('#fcd8c2', { sh: 0.1, deep: 0.22, hi: 0.06 }), hood: T('#b8a0e8'), heart: T('#f472b0'), skirt: T('#2a2436'),
  sockA: T('#f8f4f6'), sockB: T('#f472b0'), shoe: T('#f4f0f4'), sole: hex('#f472b0'), phones: T('#3a3a4a'),
};

export const JENNA: AnimeChar = {
  id: 'jenna',
  build: { hipH: 23.2, thigh: 10.8, shin: 10.4, ankleH: 2.2, torso: 12.8, neck: 1.3, shY: 2.2, shF: -1.1, shB: 2.1, upArm: 7.4, foreArm: 6.8, legF: -1.3, legB: 1.3 },
  skin: J.skin, handPal: J.skin, handK: 0.66,
  neckR: 1.3,
  face: FACE,
  leg: {
    rThigh: 2.1, rKnee: 1.7, rAnkle: 1.5, cuff: 0,
    mat(s, nr) {
      if (s.u < 0.3) return flat(J.skin, s.l, nr);
      // striped thigh-highs
      const band = Math.floor((s.u - 0.3) * 22) % 2 === 0;
      if (s.u < 0.34) return flat(J.sockB, s.l + 0.2, nr);
      return flat(band ? J.sockA : J.sockB, s.l, nr);
    },
    foot(x, an, pitch, nr) {
      shoe(x, an, pitch, nr, { shape: [-2.2, 0, 3.8, 0, 4.4, 1.2, 4.2, 2.4, 2.4, 3, 1, 3.8, -1.8, 3.8, -2.4, 2.2], ah: 2.2, body: J.shoe, sole: J.sole, lace: hex('#f472b0'), toe: J.shoe });
    },
  },
  arm: {
    rSh: 1.6, rEl: 1.4, rWr: 1.3,
    upper(s, nr) { return flat(J.hood, s.l, nr); },
    fore(s, nr) { return s.u > 0.82 ? flat(J.hood, s.l + 0.5, nr) : flat(J.hood, s.l, nr); },
    hand: J.skin,
  },
  torso: {
    prof: [[-3, -3.4, 3.4], [0, -3.4, 3.6], [5, -3.6, 3.8], [9, -3.6, 3.8], [11.6, -3.2, 3], [12.8, -2.2, 2]],
    mat(s, x) {
      const lx = s.lx, ly = s.ly, top = x.b.torso;
      // oversized hoodie: heart on the chest, kangaroo pocket, drawstrings
      if ((Math.abs(lx - 1.8) + Math.abs(ly - (top - 5)) * 1.1) < 1.6 && ly > top - 6.6) return ly > top - 4.2 && Math.abs(lx - 1.8) < 0.5 ? flat(J.heart, 0.9) : flat(J.heart, 0);
      if (lx > 0 && lx < 3.6 && ly > 1.4 && ly < 4.6) return ly > 4 ? flat(J.hood, s.l - 0.4) : flat(J.hood, s.l - 0.15);
      if (Math.abs(lx - 2.2) < 0.35 && ly > top - 3.6 && ly < top - 1) return hex('#ffffff');
      if (ly < 1.4) return flat(J.hood, s.l + 0.3);
      return flat(J.hood, s.l);
    },
  },
  behind(x) {
    // the hood hanging behind the neck, with little cat ears
    torsoFrame(x, [-7, 1, 8, 17], (lx, ly) => {
      const hood = (lx + 2.6) ** 2 / 7 + (ly - 12.6) ** 2 / 5 < 1;
      const ear = (ly > 14 && ly < 16.4 && Math.abs(lx + 4.2 - (ly - 14) * 0.2) < 0.9 - (ly - 14) * 0.3);
      if (ear) return flat(J.hood, 0.1);
      return hood ? flat(J.hood, -0.4) : -1;
    });
    x.c.merge({ line: 0.3, ao: 0.08 });
  },
  afterTorso(x) {
    // pleated skirt + headphones around the neck
    torsoFrame(x, [-10, 10, -8, 16], (lx, ly) => {
      if (ly > x.b.torso - 1.6 && ly < x.b.torso + 0.6) {
        if (lx > 1 && lx < 3.2 && ly > x.b.torso - 1.4) return flat(J.heart, 0.3);
        if (lx > -2.4 && lx < 3.2) return J.phones[2];
      }
      if (ly > 1.6 || ly < -5.4) return -1;
      const k = (1.6 - ly) * 0.36;
      if (lx < -3.6 - k || lx > 3.8 + k) return -1;
      const pleat = ((lx + 40) % 2) < 1;
      return flat(J.skirt, (pleat ? 0.3 : -0.2) + (ly < -4.6 ? -0.5 : 0));
    });
    x.c.merge({ line: 0.3, ao: 0.2 });
  },
};

// ------------------------------------------------------------------ JOSHU

const O = {
  skin: T('#f0b494', { sh: 0.12, deep: 0.26, hi: 0.08 }), knit: T('#e2d6b8'), pants: T('#2e3654'), boot: T('#2a2a2e'),
  sole: hex('#161618'), susp: T('#b8342a'), ink: hex('#3a5a86'),
};

export const JOSHU: AnimeChar = {
  id: 'joshu',
  build: { hipH: 26.4, thigh: 12.2, shin: 11.6, ankleH: 2.6, torso: 19.4, neck: 1.2, shY: 3.2, shF: -2.6, shB: 5.4, upArm: 9.8, foreArm: 9.2, legF: -3.4, legB: 3.4 },
  skin: O.skin, handPal: O.skin, handK: 0.95,
  neckR: 3.2,
  face: FACE,
  leg: {
    rThigh: 4.6, rKnee: 3.9, rAnkle: 3.3, cuff: 0,
    mat(s, nr) {
      // rubber boots up to the knee
      if (s.u > 0.56) return flat(O.boot, s.l + (s.u < 0.6 ? 0.5 : 0), nr);
      return flat(O.pants, s.l, nr);
    },
    foot(x, an, pitch, nr) {
      shoe(x, an, pitch, nr, { shape: [-3, 0, 4.6, 0, 5.4, 1.2, 5.2, 2.6, 3.4, 3.6, 2, 4.4, 2, 5.4, -3, 5.4, -3.4, 2.8], ah: 2.6, body: O.boot, sole: O.sole });
    },
  },
  arm: {
    rSh: 3.5, rEl: 3.2, rWr: 2.6,
    upper(s, nr) { return s.u > 0.78 ? flat(O.knit, s.l + 0.45, nr) : flat(O.knit, s.l + ((Math.floor(s.u * 9) % 2) ? 0.1 : -0.1), nr); },
    fore(s, nr) {
      // anchor tattoo on the near forearm
      if (nr && s.u > 0.3 && s.u < 0.62 && Math.abs(s.v) < 0.4 && (Math.abs(s.v) < 0.12 || s.u > 0.55)) return O.ink;
      return flat(O.skin, s.l, nr);
    },
    hand: O.skin,
  },
  torso: {
    prof: [[-4, -6.6, 6.8], [0, -7.2, 9.2], [4, -7.8, 11], [8, -8, 11.2], [12, -7.8, 10], [15.6, -7.2, 8], [18.2, -5.8, 5.8], [19.4, -4.2, 4.2]],
    mat(s, x) {
      const lx = s.lx, ly = s.ly;
      if (ly < 0.4) return flat(O.pants, s.l);
      // suspenders
      if (Math.abs(lx - (1.6 + ly * 0.04)) < 0.7 || Math.abs(lx - (-2.8 + ly * 0.02)) < 0.6) return flat(O.susp, s.l);
      // cable knit: vertical cables
      const cable = Math.abs(((lx + 20) % 3) - 1.5) < 0.45;
      const twist = cable && Math.floor(ly * 1.2) % 2 === 0;
      return flat(O.knit, s.l + (twist ? -0.35 : cable ? -0.12 : 0.05));
    },
  },
};

// ------------------------------------------------------------------ AROHA

const R = {
  skin: T('#c8885e', { sh: 0.12, deep: 0.26, hi: 0.1 }), top: T('#ece0c4'), shorts: T('#4a4a30'), belt: T('#5a3a24'),
  sandal: T('#6a4428'), pouch: T('#7a5a3a'), pounamu: T('#3a9a6a'),
};

export const AROHA: AnimeChar = {
  id: 'aroha',
  build: { hipH: 26.6, thigh: 12.2, shin: 12, ankleH: 2.3, torso: 14.2, neck: 1.8, shY: 2.3, shF: -1.2, shB: 2.2, upArm: 8.2, foreArm: 7.6, legF: -1.4, legB: 1.4 },
  skin: R.skin, handPal: R.skin, handK: 0.68,
  neckR: 1.5,
  face: FACE,
  leg: {
    rThigh: 2.3, rKnee: 1.8, rAnkle: 1.5, cuff: 0,
    mat(s, nr) {
      if (s.u < 0.26) return flat(R.shorts, s.l + (s.u > 0.22 ? 0.4 : 0), nr);
      // sandal straps wrapping the ankle
      if (s.u > 0.9 && Math.floor(s.u * 40) % 2 === 0) return flat(R.sandal, s.l, nr);
      return flat(R.skin, s.l, nr);
    },
    foot(x, an, pitch, nr) {
      shoe(x, an, pitch, nr, { shape: [-2, 0, 3.8, 0, 4.2, 0.9, 3.4, 1.8, 1, 2.4, -1.6, 2.6, -2.2, 1.4], ah: 2.2, body: R.skin, sole: R.sandal[1], lace: R.sandal[2] });
    },
  },
  arm: {
    rSh: 1.6, rEl: 1.4, rWr: 1.2,
    upper(s, nr) { return s.u < 0.2 ? flat(R.top, s.l, nr) : flat(R.skin, s.l, nr); },
    fore(s, nr) {
      if (nr && s.u > 0.84 && s.u < 0.94) return (Math.floor(s.v * 3 + 3) % 2) ? hex('#c8342a') : hex('#e8e0c8');
      return flat(R.skin, s.l, nr);
    },
    hand: R.skin,
  },
  torso: {
    prof: [[-3, -3.4, 3.6], [0, -3.4, 3.6], [4, -3, 3.2], [9, -3.4, 3.8], [12.6, -3.2, 3.2], [14.2, -2.2, 2]],
    mat(s, x) {
      const lx = s.lx, ly = s.ly, top = x.b.torso;
      if (ly < 0.6) return flat(R.shorts, s.l);
      if (ly < 1.8) return Math.abs(lx - 2.8) < 0.6 ? hex('#d8b060') : flat(R.belt, s.l);
      // pounamu pendant on a cord
      if (Math.abs(lx - (1 + (top - ly) * 0.25)) < 0.35 && ly > top - 4 && ly < top - 0.6) return hex('#3a2418');
      if ((lx - 2) ** 2 + (ly - (top - 4.8)) ** 2 < 1) return flat(R.pounamu, lx < 2 ? 0.8 : 0);
      if (ly < 3.6) return flat(R.skin, s.l);
      // woven top with a taniko band (red / black / white triangles) along the hem
      if (ly < 5.4) {
        const u = Math.floor((lx + 20) * 1.2);
        const tri = ((lx + 20) * 1.2 - u) < (ly - 3.6) / 1.8;
        return u % 2 ? (tri ? hex('#c8342a') : hex('#1e1418')) : hex('#f0e6d0');
      }
      return flat(R.top, s.l + ((Math.floor(lx * 2 + ly) % 3 === 0) ? -0.15 : 0));
    },
  },
  afterTorso(x) {
    // ammo pouch on the belt and the slingshot tucked at the back hip
    torsoFrame(x, [-8, 6, -4, 6], (lx, ly) => {
      if (lx > -1.6 && lx < 1.2 && ly > -1.8 && ly < 1.6) return flat(R.pouch, ly > 1 ? 0.6 : 0);
      if (lx > -0.8 && lx < 0.4 && ly > -1.2 && ly < 0) return hex('#ff9a3a');
      if (x.anim !== 'slingAim' && x.anim !== 'slingshot') {
        if (Math.abs(lx + 4) < 0.5 && ly > -2 && ly < 3) return flat(T('#8a5a34'), 0);
        if (ly >= 3 && ly < 5 && (Math.abs(lx + 4 - (ly - 3) * 0.8) < 0.5 || Math.abs(lx + 4 + (ly - 3) * 0.8) < 0.5)) return flat(T('#8a5a34'), 0.2);
      }
      return -1;
    });
    x.c.merge({ line: 0.3, ao: 0.12 });
  },
};

export const ANIME_CHARS: Record<AnimeId, AnimeChar> = { mori: MORI, jenna: JENNA, joshu: JOSHU, aroha: AROHA };

export const ANIME_INFO: Record<string, { name: string; short: string; voice: number; height: number }> = {
  mori: { name: 'Mori', short: 'Mori', voice: 1, height: 58 },
  jenna: { name: 'Jenna', short: 'Jenna', voice: 1.5, height: 52 },
  joshu: { name: 'Joshu', short: 'Joshu', voice: 0.62, height: 64 },
  aroha: { name: 'Aroha', short: 'Aroha', voice: 1.12, height: 57 },
  chunk: { name: 'Chunk', short: 'Chunk', voice: 1.3, height: 16 },
};

void mix; void at;
export type { Build };

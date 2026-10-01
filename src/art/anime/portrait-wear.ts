// Portrait outfits: the dialogue portraits and the HD close-up busts dressed to match the sprites
// (outfits.ts). Each outfit swaps the bust's clothes (a parka or an oilskin: quilted shoulders, a
// zip, reflective tape, pack straps, a hood bunched behind the neck with a fur ruff, or a high storm
// collar with a life-jacket tube) and adds head wear over the hair (a beanie with a head lamp or cat
// ears and goggles, or a hood up framing the face in fur, goggles pushed up on it). Drawn with the
// portrait kit in design units, so the 2x busts get the same shapes with more detail.

import { Pic, Pt, tones } from '../portrait/kit';
import { hex, mix, C } from '../color';

const PW = 56, CX = 28;
type Tone = [C, C, C, C];
const T = (h: string, o: Parameters<typeof tones>[1] = {}): Tone => tones(h, o);
const col = (h: string) => hex(h);
const hash = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export interface WearMats { skin: number; neck: number; hair: number; cloth: number; cloth2: number; acc: number; beard: number; hairB: number }
export interface PortraitWear {
  /** skip the design's own back hair (a hood up hides it) */
  hideBack?: boolean;
  back?(p: Pic, m: WearMats): void;
  /** replaces the design's clothes */
  body(p: Pic, m: WearMats): void;
  /** over the front hair: hats, hoods, goggles */
  front?(p: Pic, m: WearMats): void;
}

interface BustO {
  shell: string; panel: string; trim: string;
  fur?: string;
  /** oilskin sheen */
  gloss?: boolean;
  /** shoulder width scale (Joshu is huge) */
  wide?: number;
  /** 'hood': the hood bunched behind the neck (fur ruff if fur); 'high': a standing storm collar */
  collar: 'hood' | 'high';
  strips?: boolean;
  straps?: string;
  life?: boolean;
  quilt?: number;
  gear?(p: Pic, m: WearMats): void;
}

/** a parka / oilskin bust */
function bust(o: BustO) {
  return (p: Pic, m: WearMats) => {
    const sh = T(o.shell, { sh: 0.18, hi: o.gloss ? 0.3 : 0.14 }), pn = T(o.panel, { sh: 0.18 }), tr = T(o.trim);
    const w = o.wide ?? 1, X = (u: number) => CX + (u - CX) * w;
    const furM = p.m(9, true, 0.45);
    // the hood bunched up behind the neck (behind everything already drawn)
    if (o.collar === 'hood') p.fill([[X(5), 50], [X(9), 41.6], [CX, 38.4], [X(PW - 9), 41.6], [X(PW - 5), 50]], sh[1], m.cloth2, { under: true });
    // shoulders: bulky, a quilted yoke
    p.fill([[X(-4), 60], [X(-2.4), 51.6], [X(2.6), 47.2], [X(11), 44.6], [CX - 8.6, 43.6], [CX, 43.4], [CX + 8.6, 43.6], [X(PW - 11), 44.6], [X(PW - 2.6), 47.2], [X(PW + 2.4), 51.6], [X(PW + 4), 60]], sh[2], m.cloth);
    p.where([m.cloth], (u, v) => u > CX + 14 * w || v > 58.4, sh[1]);
    p.where([m.cloth], (u, v) => v < 50.4 - Math.abs(u - CX) * 0.08 && Math.abs(u - CX) > 9, pn[2]);
    p.where([m.cloth], (u, v) => Math.abs(v - (50.4 - Math.abs(u - CX) * 0.08)) < 0.45 && Math.abs(u - CX) > 9, pn[0]);
    p.where([m.cloth], (u, v) => v < 50 && Math.abs(u - CX) > 9 && u > CX + 14 * w, pn[1]);
    if (o.quilt) p.where([m.cloth], (u, v) => v > 51 && ((v - 51) % o.quilt!) < 0.5, sh[1]);
    if (o.gloss) {
      // oilskin: hard streaks of light down the folds
      p.where([m.cloth], (u, v) => u < CX - 4 && Math.abs(((u * 0.6 + v * 0.35) % 7) - 3.5) < 0.45 && v > 47, sh[3]);
      p.where([m.cloth], (u, v) => u < CX - 8 && v > 46 && v < 48.5 && Math.abs(u - (CX - 16)) < 4, mix(sh[3], 0xffffffff >>> 0, 0.4));
    }
    if (o.strips) p.where([m.cloth], (u, v) => Math.abs(v - 56.4) < 0.7 && Math.abs(u - CX) > 5, col('#dfe8ec'));
    // the zip up the front with its storm flap and a pull
    p.fill([[CX - 1.4, 43.4], [CX + 1.4, 43.4], [CX + 1.2, 60], [CX - 1.2, 60]], tr[1], m.cloth2, { sharp: true });
    p.where([m.cloth2], (u, v) => Math.abs(u - CX) < 0.5 && v > 44, tr[0]);
    p.where([m.cloth], (u, v) => Math.abs(u - CX - 2.2) < 0.4 && v > 45, sh[1]);
    if (o.straps) {
      const st = T(o.straps);
      p.fill([[X(9.4), 48], [X(13.6), 46], [X(15.4), 60], [X(10.6), 60]], st[2], m.acc, { sharp: true });
      p.fill([[X(PW - 9.4), 48], [X(PW - 13.6), 46], [X(PW - 15.4), 60], [X(PW - 10.6), 60]], st[1], m.acc, { sharp: true });
      p.where([m.acc], (u, v) => Math.abs(v - 55.2) < 0.6, col('#8a969e'));
    }
    if (o.life) {
      // a life-jacket harness: red straps and the inflatable tube round the collar
      const r = T('#c8302a', { sh: 0.2, hi: 0.2 });
      p.fill([[CX - 11, 47], [CX - 7.6, 46], [CX - 6.4, 60], [CX - 10.4, 60]], r[2], m.acc, { sharp: true });
      p.fill([[CX + 11, 47], [CX + 7.6, 46], [CX + 6.4, 60], [CX + 10.4, 60]], r[1], m.acc, { sharp: true });
    }
    // the collar
    if (o.collar === 'high' || o.life) {
      p.fill([[CX - 9, 48], [CX - 9.6, 41.4], [CX - 4, 42.6], [CX, 43], [CX + 4, 42.6], [CX + 9.6, 41.4], [CX + 9, 48], [CX, 46.6]], sh[2], m.cloth2);
      p.where([m.cloth2], (u, v) => u > CX + 2 && v < 47, sh[1]);
      if (o.life) {
        const r = T('#c8302a', { sh: 0.2, hi: 0.24 });
        p.fill([[CX - 12, 48.6], [CX - 10, 45], [CX, 46.6], [CX + 10, 45], [CX + 12, 48.6], [CX, 50.6]], r[2], m.acc);
        p.where([m.acc], (u, v) => v < 47 && u < CX, r[3]);
      }
    } else if (o.fur) {
      // the hood's fur ruff round the collar
      const f = T(o.fur, { sh: 0.2, hi: 0.14 });
      for (let i = 0; i <= 14; i++) {
        const t = i / 14, u = X(6 + t * (PW - 12)), v = 44.6 + Math.abs(t - 0.5) * 2 - Math.sin(t * Math.PI) * 1.4;
        p.ell(u, v, 2.4 + hash(i, 3) * 0.8, 2 + hash(i, 5) * 0.6, f[2], furM);
      }
      p.where([furM], (u, v, x, y) => hash(x, y) > 0.78, f[3]);
      p.where([furM], (u, v, x, y) => hash(x + 7, y) > 0.82 || u > CX + 9, f[1]);
    }
    o.gear?.(p, m);
  };
}

/** a beanie over the hair: a dome, a folded ribbed brim, then extras (lamp, goggles, ears) */
function beanieF(c: string, o: { brim?: number; lamp?: boolean; goggles?: string; ears?: boolean; wide?: number } = {}) {
  return (p: Pic, m: WearMats) => {
    const k = T(c, { sh: 0.2, hi: 0.16 }), w = o.wide ?? 1, by = o.brim ?? 14.4;
    const bm = p.m(10, true, 0.5);
    if (o.ears) {
      p.fill([[CX - 13 * w, 8], [CX - 14 * w, -1], [CX - 6 * w, 4]], k[2], bm, { sharp: true });
      p.fill([[CX + 13 * w, 8], [CX + 14 * w, -1], [CX + 6 * w, 4]], k[1], bm, { sharp: true });
    }
    p.fill([[CX - 15.6 * w, by + 1], [CX - 15.4 * w, 8], [CX - 10 * w, 2.6], [CX, 0.8], [CX + 10 * w, 2.6], [CX + 15.4 * w, 8], [CX + 15.6 * w, by + 1], [CX, by - 0.6]], k[2], bm);
    p.where([bm], (u, v) => u > CX + 8 * w, k[1]);
    // the fold: a band of ribs along the brim
    p.where([bm], (u, v) => v > by - 4.4 + Math.abs(u - CX) * 0.04, k[3]);
    p.where([bm], (u, v) => v > by - 4.4 + Math.abs(u - CX) * 0.04 && ((u + 40) % 2) < 0.7, k[2]);
    p.where([bm], (u, v) => Math.abs(v - (by - 4.4 + Math.abs(u - CX) * 0.04)) < 0.45, k[0]);
    p.where([bm], (u, v) => v < by - 4.4 && ((u * 0.5 + 40) % 2.2) < 0.5, k[1]);
    if (o.lamp) {
      const lm = p.m(11, true, 0.5);
      p.fill([[CX - 3, by - 3.6], [CX + 3, by - 3.6], [CX + 2.6, by - 0.2], [CX - 2.6, by - 0.2]], col('#24262c'), lm, { sharp: true });
      p.ell(CX - 0.4, by - 1.9, 1.5, 1.2, col('#fff2b8'), lm);
      p.dot(CX - 1, by - 2.5, col('#ffffff'));
    }
    if (o.goggles) goggleF(o.goggles, by - 6.4, 1)(p, m);
  };
}

/** goggles pushed up: a strap across, two tinted lenses with glints */
function goggleF(lens: string, y: number, w = 1) {
  return (p: Pic, m: WearMats) => {
    void m;
    const gm = p.m(12, true, 0.5), L = T(lens, { hi: 0.3 });
    p.fill([[CX - 15 * w, y + 0.6], [CX + 15 * w, y + 0.6], [CX + 15 * w, y + 2.4], [CX - 15 * w, y + 2.4]], col('#2c2f36'), gm, { sharp: true });
    for (const s of [-1, 1]) {
      p.ell(CX + s * 5.4 * w, y + 1.4, 4.6 * w, 3.2, col('#5e6a72'), gm);
      p.ell(CX + s * 5.4 * w, y + 1.4, 3.6 * w, 2.3, L[2], gm);
      p.where([gm], (u, v) => (u - (CX + s * 5.4 * w)) ** 2 / (3.6 * w) ** 2 + (v - y - 1.4) ** 2 / 5.3 < 1 && v < y + 0.6, L[3]);
      p.dot(CX + s * 5.4 * w - 1.6, y + 0.4, col('#ffffff'));
    }
  };
}

/** a hood up: the shell behind the head, its rim down the sides, a fur ruff framing the face */
function hoodF(c: string, o: { fur?: string; gloss?: boolean; rx?: number; ry?: number; cy?: number; goggles?: string; low?: number } = {}) {
  const rx = o.rx ?? 18.6, ry = o.ry ?? 20.4, cy = o.cy ?? 23.6;
  return {
    back(p: Pic, m: WearMats) {
      const h = T(c, { sh: 0.2, hi: o.gloss ? 0.3 : 0.14 });
      p.ell(CX, cy, rx, ry, h[2], m.hairB);
      p.where([m.hairB], (u, v) => u > CX + rx * 0.45, h[1]);
      if (o.gloss) p.where([m.hairB], (u, v) => Math.abs(((u - CX + 30) * 0.7 + v * 0.3) % 9 - 4.5) < 0.5 && u < CX - 4, h[3]);
      // the dark lining round the face
      p.ell(CX, cy + 2.4, rx - 3.2, ry - 2.6, col('#1a1214'), m.hairB);
    },
    front(p: Pic, m: WearMats) {
      const h = T(c, { sh: 0.2, hi: o.gloss ? 0.3 : 0.14 });
      const rim = p.m(13, true, 0.5);
      // hair can't poke out through the hood: clear any outside its outline
      for (let y = 0; y < p.H; y++) for (let x = 0; x < p.W; x++) {
        const i = y * p.W + x;
        if (p.mat[i] !== m.hair && p.mat[i] !== m.hairB) continue;
        if (((p.U(x) - CX) / rx) ** 2 + ((p.V(y) - cy) / ry) ** 2 > 1) { p.mat[i] = 0; p.col[i] = 0; }
      }
      // the hood's rim: over the hair at the sides and the crown, leaving the face clear
      const low = o.low ?? 44;
      const pts: Pt[] = [];
      for (let i = 0; i <= 20; i++) { const a = Math.PI * (1 + i / 20); pts.push([CX + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
      pts.push([CX + rx, low], [CX + rx - 4.6, low], [CX + rx - 4.8, cy]);
      for (let i = 20; i >= 0; i--) { const a = Math.PI * (1 + i / 20); pts.push([CX + Math.cos(a) * (rx - 4.8), cy + 1.6 + Math.sin(a) * (ry - 5.4)]); }
      pts.push([CX - rx + 4.8, cy], [CX - rx + 4.6, low], [CX - rx, low]);
      p.fill(pts, h[2], rim, { sharp: true });
      p.where([rim], (u, v) => u > CX + rx * 0.4, h[1]);
      if (o.gloss) p.where([rim], (u, v) => u < CX - 6 && v < cy - ry * 0.4 && ((u + v) % 6) < 0.6, h[3]);
      if (o.fur) {
        const f = T(o.fur, { sh: 0.22, hi: 0.14 }), fm = p.m(9, true, 0.45);
        for (let i = 0; i <= 26; i++) {
          const a = Math.PI * (0.78 + (i / 26) * 1.44);
          const r = 1 + (hash(i, 9) - 0.5) * 0.06;
          p.ell(CX + Math.cos(a) * (rx - 3.2) * r, cy + 1.4 + Math.sin(a) * (ry - 3.8) * r, 2.6 + hash(i, 4) * 0.9, 2.4 + hash(i, 6) * 0.8, f[2], fm);
        }
        p.where([fm], (u, v, x, y) => hash(x, y) > 0.8, f[3]);
        p.where([fm], (u, v, x, y) => hash(x + 3, y + 1) > 0.84 || u > CX + 10, f[1]);
      }
      if (o.goggles) goggleF(o.goggles, cy - ry + 3.4, 0.95)(p, m);
      void m;
    },
  };
}

// ------------------------------------------------------------------ the cast

const moriGear = (p: Pic, m: WearMats) => {
  // the radio on his strap, the field notebook in the chest pocket
  p.fill([[CX - 13.4, 50], [CX - 10.6, 50], [CX - 10.6, 55.6], [CX - 13.4, 55.6]], col('#1e2024'), m.acc, { sharp: true });
  p.stroke([[CX - 12.4, 50], [CX - 12.8, 45.6]], 0.8, 0.6, col('#1e2024'), m.acc);
  p.dot(CX - 12.8, 45.2, col('#f08432'));
  p.where([m.acc], (u, v) => Math.abs(u - (CX - 12)) < 0.7 && Math.abs(v - 52) < 0.6, col('#8ad0a0'));
  p.fill([[CX + 4.6, 50.6], [CX + 9.4, 50.6], [CX + 9.4, 55], [CX + 4.6, 55]], T('#4c6432')[1], m.cloth2, { sharp: true });
  p.fill([[CX + 5.4, 49.2], [CX + 8.8, 49.2], [CX + 8.8, 50.8], [CX + 5.4, 50.8]], col('#c8a070'), m.acc, { sharp: true });
};
const jennaGear = (p: Pic, m: WearMats) => {
  // the laptop sling's strap across her chest, stickers on it, a coil of cable
  p.stroke([[CX + 14, 44.6], [CX + 2, 52], [CX - 10, 60]], 2.6, 2.6, col('#262e56'), m.acc);
  for (const [u, v, c] of [[CX + 9, 48, '#f8d040'], [CX + 3.4, 51.4, '#58c8f0'], [CX - 3, 55.2, '#8ae070']] as [number, number, string][]) p.ell(u, v, 1, 0.9, col(c), m.acc);
  p.ell(CX - 12, 52, 2.6, 2.2, col('#e86a20'), m.acc);
  p.ell(CX - 12, 52, 1.4, 1.1, T('#c04478')[2], m.cloth);
};
const joshuGear = (p: Pic, m: WearMats) => {
  // the coil of rope over his near shoulder
  for (let k = 0; k < 3; k++) p.stroke([[CX - 24 + k, 46 + k * 0.6], [CX - 17 + k, 49.6], [CX - 13 + k * 0.4, 60]], 1.6, 1.6, col(k % 2 ? '#aa8c5c' : '#c6a878'), m.acc);
  p.where([m.acc], (u, v, x, y) => (x + y) % 3 === 0, col('#846840'));
};
const arohaGear = (p: Pic, m: WearMats) => {
  // pounamu on its cord over the zip, the kete's flax strap
  p.stroke([[CX + 14, 44.6], [CX + 4, 52], [CX - 8, 60]], 2, 2, col('#b08e40'), m.acc);
  p.where([m.acc], (u, v, x, y) => (x + y) % 2 === 0, col('#86692a'));
  p.stroke([[CX - 4.6, 44.6], [CX - 2, 48.6], [CX, 49.6]], 0.8, 0.8, col('#3a2418'), m.beard);
  p.stroke([[CX + 4.6, 44.6], [CX + 2, 48.6], [CX, 49.6]], 0.8, 0.8, col('#3a2418'), m.beard);
  p.fill([[CX - 1.6, 49.4], [CX + 1.6, 49.4], [CX + 2, 52.8], [CX, 54.6], [CX - 2, 52.8]], col('#3a9a6a'), m.beard);
  p.where([m.beard], (u, v) => u < CX && v > 50 && v < 52.4, col('#7ad0a0'));
};

const MORI_W = { shell: '#4c6432', panel: '#353944', trim: '#272b33' };
const JENNA_W = { shell: '#c04478', panel: '#5e4a82', trim: '#40304e' };
const JOSHU_W = { shell: '#22252c', panel: '#643a24', trim: '#121418' };
const AROHA_W = { shell: '#924028', panel: '#48291a', trim: '#1c1f25' };

// ------------------------------------------------------------------ ship clothes (outfits-ship.ts)

/** Jenna's cat-ear headphones round her neck: the band across the collar, a cup either side */
const neckPhonesF = (p: Pic, m: WearMats) => {
  void m;
  const mn = T('#72c2a8', { sh: 0.2, hi: 0.2 }), pk = T('#e86a98'), pm = p.m(14, true, 0.5);
  p.stroke([[CX - 11, 46.4], [CX - 6, 49.4], [CX, 50.2], [CX + 6, 49.4], [CX + 11, 46.4]], 1.6, 1.6, mn[2], pm);
  for (const s of [-1, 1]) {
    p.ell(CX + s * 12, 48.6, 3.4, 2.8, s < 0 ? mn[3] : mn[1], pm);
    p.ell(CX + s * 12, 48.2, 1.7, 1.2, pk[2], pm);
  }
  p.where([pm], (u, v) => v > 50.6 && Math.abs(Math.abs(u - CX) - 12) < 3, mn[0]);
};
/** the same headphones on: a band over the crown with two cat ears, the big cups over the ears */
const headPhonesF = (p: Pic, m: WearMats) => {
  void m;
  const mn = T('#72c2a8', { sh: 0.2, hi: 0.2 }), pk = T('#e86a98', { hi: 0.18 }), pm = p.m(14, true, 0.5);
  // cat ears standing up off the band
  for (const s of [-1, 1]) {
    p.fill([[CX + s * 5, 4.4], [CX + s * 12.6, -1.8], [CX + s * 13.4, 7.6]], s < 0 ? mn[2] : mn[1], pm, { sharp: true });
    p.fill([[CX + s * 7.4, 4.6], [CX + s * 12, 0.8], [CX + s * 12.4, 6.4]], pk[2], pm, { sharp: true });
  }
  const arc: Pt[] = [];
  for (let i = 0; i <= 16; i++) { const a = Math.PI * (1 + i / 16); arc.push([CX + Math.cos(a) * 17.4, 25 + Math.sin(a) * 21.4]); }
  p.stroke(arc, 2.6, 2.6, mn[2], pm);
  p.where([pm], (u, v) => v < 8 && u < CX, mn[3]);
  for (const s of [-1, 1]) {
    p.ell(CX + s * 17.6, 27.4, 3.8, 5.6, s < 0 ? mn[2] : mn[1], pm);
    p.ell(CX + s * 18.6, 27.4, 1.6, 2.6, s < 0 ? mn[3] : mn[2], pm);
    p.dot(CX + s * 18.6, 27, col('#fff2fa'));
  }
};
const jennaHoodie = (phones: boolean) => (p: Pic, m: WearMats) => {
  const h = T('#a898cc', { sh: 0.16, hi: 0.14 }), cr = T('#e0d2bc');
  // the hood bunched behind the neck, then the roomy shoulders
  p.fill([[CX - 16, 47.4], [CX - 13, 42.6], [CX - 6, 45], [CX + 6, 45], [CX + 13, 42.6], [CX + 16, 47.4]], h[1], m.cloth2);
  p.fill([[1, 60], [4, 51], [13, 46.2], [CX, 45.4], [PW - 13, 46.2], [PW - 4, 51], [PW - 1, 60]], h[2], m.cloth);
  p.where([m.cloth], (u, v) => u > PW - 14 || v > 58.6, h[1]);
  p.where([m.cloth], (u, v) => Math.abs(u - 8 - (v - 50) * 0.3) < 0.5 && v > 51, h[1]);
  // the neckline, cream drawstrings with mint tips
  p.fill([[CX - 6, 45], [CX, 48.6], [CX + 6, 45], [CX + 6, 46.6], [CX, 50], [CX - 6, 46.6]], h[1], m.cloth2);
  p.stroke([[CX - 3.2, 48.6], [CX - 3.6, 56]], 0.9, 0.9, cr[2], m.acc);
  p.stroke([[CX + 3.2, 48.6], [CX + 3.6, 56]], 0.9, 0.9, cr[1], m.acc);
  p.ell(CX - 3.6, 56.6, 0.8, 1, col('#72c2a8'), m.acc);
  p.ell(CX + 3.6, 56.6, 0.8, 1, col('#4a9a84'), m.acc);
  // a white paw print on the chest
  for (const [u, v, r] of [[CX + 10, 55.6, 1.6], [CX + 8, 53, 0.7], [CX + 10, 52.4, 0.7], [CX + 12, 53, 0.7]] as [number, number, number][]) p.ell(u, v, r, r * 0.9, col('#f4f0fa'), m.acc);
  if (!phones) neckPhonesF(p, m);
};

const moriShipBust = (p: Pic, m: WearMats) => {
  const vest = T('#526232', { sh: 0.18 }), oat = T('#b8a890', { sh: 0.16 }), red = T('#b82c22');
  // broad shoulders in the olive vest over an oatmeal henley
  p.fill([[-3, 60], [-1.4, 52.6], [3, 49], [11, 47], [CX - 8.4, 45.8], [CX, 45.6], [CX + 8.4, 45.8], [PW - 11, 47], [PW - 3, 49], [PW + 1.4, 52.6], [PW + 3, 60]], vest[2], m.cloth);
  p.where([m.cloth], (u, v) => u > PW - 15 || v > 57.4, vest[1]);
  // the henley at the arms (the vest is sleeveless) and down the open front
  p.where([m.cloth], (u, v) => (u < 6.4 - (v - 49.4) * 0.2 || u > PW - 6.4 + (v - 49.4) * 0.2) && v > 49.8, oat[2]);
  p.where([m.cloth], (u, v) => u > PW - 6.4 + (v - 49.4) * 0.2 && v > 49.8, oat[1]);
  p.fill([[CX - 7.4, 45.4], [CX + 7.4, 45.4], [CX + 6, 60], [CX - 6, 60]], oat[2], m.cloth2, { sharp: true });
  p.where([m.cloth2], (u, v) => u > CX + 2, oat[1]);
  // the henley's round neck and its three-button placket
  p.fill([[CX - 6.4, 45.2], [CX, 48.4], [CX + 6.4, 45.2], [CX + 6.4, 46.4], [CX, 49.6], [CX - 6.4, 46.4]], oat[0], m.cloth2);
  p.stroke([[CX + 0.6, 49.6], [CX + 0.6, 56]], 0.7, 0.7, oat[0], m.cloth2);
  for (const v of [51, 53.2, 55.4]) p.dot(CX + 1.6, v, col('#f0e6d4'));
  // the vest's panels: edges, chest pockets with flaps
  p.where([m.cloth], (u, v) => Math.abs(Math.abs(u - CX) - 7.6) < 0.5 && v > 46, vest[0]);
  for (const s of [-1, 1]) {
    p.fill([[CX + s * 9, 51], [CX + s * 15, 51], [CX + s * 15, 56.6], [CX + s * 9, 56.6]], s < 0 ? vest[3] : vest[2], m.acc, { sharp: true });
    p.fill([[CX + s * 8.6, 50], [CX + s * 15.4, 50], [CX + s * 15.4, 52.4], [CX + s * 8.6, 52.4]], vest[1], m.acc, { sharp: true });
  }
  // the red lanyard down to his research ID
  p.stroke([[CX - 6, 46], [CX - 2.4, 52], [CX - 1.2, 57]], 0.8, 0.8, red[2], m.beard);
  p.stroke([[CX + 6, 46], [CX + 2.4, 52], [CX + 1.2, 57]], 0.8, 0.8, red[1], m.beard);
  p.fill([[CX - 3, 56.6], [CX + 3, 56.6], [CX + 3, 61], [CX - 3, 61]], col('#f4f0e6'), m.beard, { sharp: true });
  p.where([m.beard], (u, v) => v > 56.8 && v < 58 && Math.abs(u - CX) < 2.6, col('#3a6a9a'));
};

const joshuShipBust = (p: Pic, m: WearMats) => {
  const k = T('#1c443e', { sh: 0.16 });
  // the deep-teal fisherman's knit on those shoulders: vertical ribs, a ribbed yoke, a thick roll collar
  p.fill([[-3, 60], [-1, 47.6], [8, 42], [CX, 40.6], [PW - 8, 42], [PW + 1, 47.6], [PW + 3, 60]], k[2], m.cloth);
  p.where([m.cloth], (u, v) => u > PW - 12 || v > 58.4, k[1]);
  p.where([m.cloth], (u, v) => v > 47 && ((u + 40) % 2.6) < 0.7, k[1]);
  p.where([m.cloth], (u, v) => Math.abs(v - 50) < 1.2 && ((u + 40) % 1.6) < 0.6, k[3]);
  p.fill([[CX - 14, 41.4], [CX, 39.6], [CX + 14, 41.4], [CX + 14, 44.4], [CX, 42.6], [CX - 14, 44.4]], k[1], m.cloth2);
  p.where([m.cloth2], (u, v) => v < 42, k[3]);
};

const arohaShipBust = (p: Pic, m: WearMats) => {
  const top = T('#1e5058', { sh: 0.14 }), skin = T('#c8885e', { sh: 0.12 }), cr = col('#f0e6d4');
  // a deep-teal sleeveless top, bare shoulders, a cream koru printed on the chest
  p.fill([[2, 60], [4, 51], [10, 47.4], [CX - 7, 46], [CX, 49], [CX + 7, 46], [PW - 10, 47.4], [PW - 4, 51], [PW - 2, 60]], skin[2], m.neck);
  p.where([m.neck], (u, v) => u > PW - 12, skin[1]);
  p.fill([[8, 60], [9.6, 51.4], [13, 47.6], [CX - 5.6, 46.4], [CX, 50.4], [CX + 5.6, 46.4], [PW - 13, 47.6], [PW - 9.6, 51.4], [PW - 8, 60]], top[2], m.cloth);
  p.where([m.cloth], (u, v) => u > PW - 16 || v > 58.4, top[1]);
  const kx = CX + 8, ky = 55;
  p.where([m.cloth], (u, v) => {
    const x = u - kx, y = v - ky, r = Math.hypot(x, y);
    if (r > 3.8) return false;
    const a = Math.atan2(y, x);
    return Math.abs((((r - a * 0.62) / 1.9) % 1 + 1) % 1 - 0.5) < 0.16;
  }, cr);
  // pounamu on its cord
  p.stroke([[CX - 5, 45], [CX - 2.4, 49], [CX, 50.4]], 0.9, 0.9, col('#3a2418'), m.acc);
  p.stroke([[CX + 5, 45], [CX + 2.4, 49], [CX, 50.4]], 0.9, 0.9, col('#3a2418'), m.acc);
  p.fill([[CX - 1.6, 50], [CX + 1.6, 50], [CX + 2, 53.4], [CX, 55.2], [CX - 2, 53.4]], col('#3a9a6a'), m.acc);
  p.where([m.acc], (u, v) => u < CX && v > 50.6 && v < 53, col('#7ad0a0'));
};

export const PORTRAIT_WEAR: Record<string, Record<string, PortraitWear>> = {
  // (the ship clothes are merged in below)
  mori: {
    winter: { body: bust({ ...MORI_W, fur: '#cdc2b2', collar: 'hood', strips: true, straps: '#2c2f36', gear: moriGear }), front: beanieF('#a84a26', { lamp: true }) },
    winterHood: (() => { const h = hoodF('#4c6432', { fur: '#cdc2b2', goggles: '#e8761e' }); return { hideBack: true, back: h.back, body: bust({ ...MORI_W, collar: 'high', strips: true, straps: '#2c2f36', gear: moriGear }), front: h.front }; })(),
    storm: (() => { const h = hoodF('#e0b41e', { gloss: true }); return { hideBack: true, back: h.back, body: bust({ shell: '#e0b41e', panel: '#e0b41e', trim: '#a88222', gloss: true, collar: 'high', life: true }), front: h.front }; })(),
  },
  jenna: {
    winter: { body: bust({ ...JENNA_W, fur: '#e2e2ea', collar: 'hood', quilt: 3, gear: jennaGear }), front: beanieF('#3a9480', { ears: true, goggles: '#3a7ab0', brim: 13.6 }) },
    winterHood: (() => { const h = hoodF('#c04478', { fur: '#e2e2ea', goggles: '#3a7ab0' }); return { hideBack: true, back: h.back, body: bust({ ...JENNA_W, collar: 'high', quilt: 3, gear: jennaGear }), front: h.front }; })(),
    storm: (() => { const h = hoodF('#d8621a', { gloss: true }); return { hideBack: true, back: h.back, body: bust({ shell: '#d8621a', panel: '#d8621a', trim: '#a84816', gloss: true, collar: 'high', life: true }), front: h.front }; })(),
  },
  joshu: {
    winter: { body: bust({ ...JOSHU_W, fur: '#8e6e4e', collar: 'hood', gloss: true, wide: 1.25, gear: joshuGear }) },
    winterHood: (() => { const h = hoodF('#22252c', { fur: '#8e6e4e', gloss: true, rx: 23, ry: 25, cy: 25, low: 50 }); return { back: h.back, body: bust({ ...JOSHU_W, collar: 'hood', gloss: true, wide: 1.25, gear: joshuGear }), front: h.front }; })(),
    storm: { body: bust({ shell: '#243226', panel: '#243226', trim: '#121418', gloss: true, collar: 'high', life: true, wide: 1.25 }) },
  },
  aroha: {
    winter: { body: bust({ ...AROHA_W, fur: '#8e6e4e', collar: 'hood', quilt: 4, gear: arohaGear }) },
    winterHood: (() => { const h = hoodF('#924028', { fur: '#8e6e4e' }); return { hideBack: true, back: h.back, body: bust({ ...AROHA_W, collar: 'high', quilt: 4, gear: arohaGear }), front: h.front }; })(),
    storm: (() => { const h = hoodF('#243226', { gloss: true }); return { hideBack: true, back: h.back, body: bust({ shell: '#243226', panel: '#243226', trim: '#121418', gloss: true, collar: 'high', gear: arohaGear }), front: h.front }; })(),
  },
};

PORTRAIT_WEAR.jenna.ship = { body: jennaHoodie(false) };
PORTRAIT_WEAR.jenna.shipPhones = { body: jennaHoodie(true), front: headPhonesF };
PORTRAIT_WEAR.mori.ship = { body: moriShipBust };
PORTRAIT_WEAR.joshu.ship = { body: joshuShipBust };
PORTRAIT_WEAR.aroha.ship = { body: arohaShipBust };

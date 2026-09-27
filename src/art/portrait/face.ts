// Shared 3/4 face (looking right) for the portrait kit: skull + jaw, ear, nose, eyes, brows and
// mouth with a full expression set, cel shadows and highlights. Characters customise the
// proportions through FaceSpec and add hair / clothes / props around it.

import { Pic, Pt, tones } from './kit';
import { hex, mix, shade, C } from '../color';

export type PExpr = 'neutral' | 'happy' | 'laugh' | 'surprised' | 'shocked' | 'angry' | 'grumpy' | 'sad' | 'worried' | 'scared' | 'thinking' | 'tired' | 'teasing' | 'serious' | 'smug' | 'determined' | 'sleep' | 'eat';

export interface FaceSpec {
  skin: string;
  /** chin forward / down offsets and jaw width */
  chin?: Pt;
  jawW?: number;
  cheek?: number;
  /** nose: length, size */
  nose?: { len?: number; size?: number; bump?: number };
  eyes: { style: 'soft' | 'bold' | 'lash' | 'narrow'; iris: string; size?: number; y?: number };
  brow: { col: string; w: number; y?: number; len?: number; arch?: number };
  lip?: string;
  /** older faces: nasolabial + eye bags */
  lines?: boolean;
  blushCol?: string;
  /** draw coloured lips (upper + fuller lower lip) */
  lips?: boolean;
  /** skip the neck (in-game heads sit on the body's own neck) */
  noNeck?: boolean;
}

export interface FaceParams {
  eye: 'open' | 'wide' | 'half' | 'happy' | 'closed' | 'squint' | 'sad';
  /** brow offsets: inner, outer (+ = up) */
  bIn: number;
  bOut: number;
  mouth: 'line' | 'smile' | 'grin' | 'open' | 'o' | 'shout' | 'frown' | 'grit' | 'smirk' | 'wavy' | 'chew';
  look: [number, number];
  blush?: number;
  sweat?: boolean;
  tear?: boolean;
  pale?: boolean;
}

export const EXPR_PARAMS: Record<PExpr, FaceParams> = {
  neutral: { eye: 'open', bIn: 0, bOut: 0, mouth: 'line', look: [1, 0] },
  happy: { eye: 'happy', bIn: 2, bOut: 1, mouth: 'smile', look: [1, 0], blush: 1 },
  laugh: { eye: 'closed', bIn: 3, bOut: 2, mouth: 'shout', look: [1, 0], blush: 1 },
  surprised: { eye: 'wide', bIn: 5, bOut: 4, mouth: 'o', look: [1, 0] },
  shocked: { eye: 'wide', bIn: 6, bOut: 4, mouth: 'shout', look: [0, 0], pale: true, sweat: true },
  angry: { eye: 'squint', bIn: -5, bOut: 2, mouth: 'grit', look: [1, 0] },
  grumpy: { eye: 'half', bIn: -3, bOut: 0, mouth: 'frown', look: [1, 0] },
  sad: { eye: 'sad', bIn: 4, bOut: -2, mouth: 'frown', look: [0.5, 0.6], tear: true },
  worried: { eye: 'open', bIn: 5, bOut: -1, mouth: 'wavy', look: [0.6, 0], sweat: true },
  scared: { eye: 'wide', bIn: 6, bOut: 1, mouth: 'wavy', look: [-0.4, 0], sweat: true, pale: true },
  thinking: { eye: 'open', bIn: 3, bOut: -2, mouth: 'smirk', look: [0.6, -0.8] },
  tired: { eye: 'half', bIn: -1, bOut: -2, mouth: 'line', look: [0.6, 0.6] },
  teasing: { eye: 'half', bIn: 3, bOut: 3, mouth: 'smirk', look: [1, 0], blush: 0.6 },
  serious: { eye: 'open', bIn: -2, bOut: -0.5, mouth: 'line', look: [1, 0] },
  smug: { eye: 'half', bIn: 2, bOut: 2.5, mouth: 'smirk', look: [1, 0] },
  determined: { eye: 'squint', bIn: -3, bOut: 1.5, mouth: 'grin', look: [1, 0] },
  sleep: { eye: 'closed', bIn: 0, bOut: -1, mouth: 'line', look: [0, 0] },
  eat: { eye: 'happy', bIn: 2, bOut: 1, mouth: 'chew', look: [0, 0], blush: 0.8 },
};

export interface FaceMats { skin: number; feat: number; hair: number; ink: C }
export interface FaceGeo { eyeN: Pt; eyeF: Pt; mouth: Pt; nose: Pt; chin: Pt; jawBack: Pt; ear: Pt; crown: Pt }

/** Paint neck + skull + face. Returns materials and landmarks for the character's extras. */
export function paintFace(p: Pic, f: FaceSpec, ex: FaceParams, talk: 0 | 1 | 2, blink: boolean): { M: FaceMats; G: FaceGeo; S: [C, C, C, C] } {
  const skinBase = ex.pale ? mix(hex(f.skin), hex('#c8d4dc'), 0.22) : hex(f.skin);
  const S = tones(skinBase, { sh: 0.13, deep: 0.26, hi: 0.08, warm: '#9a4a4a' });
  const skin = p.m(1, true, 0.5), feat = p.m(1, false), hair = p.m(2, true, 0.45);
  const ink = hex('#20141a');
  const [cx, cy] = f.chin ?? [0, 0];
  const jw = f.jawW ?? 1, ch = f.cheek ?? 0;
  // neck (front edge under the chin, back edge down from the skull)
  if (!f.noNeck) p.fill([[74, 96], [110, 116], [112, 150], [72, 150]], S[2], skin, { sharp: true });
  // ear
  const ear: Pt = [66, 84];
  p.ell(ear[0], ear[1], 7, 10.5, S[2], skin);
  p.ell(ear[0] + 0.5, ear[1] + 0.5, 3.6, 6.4, S[1], skin, { clip: [skin] });
  p.stroke([[ear[0] - 2, ear[1] - 6], [ear[0] + 2, ear[1] - 4], [ear[0] + 3, ear[1] + 2]], 1.2, 1, S[0], skin, { clip: [skin] });
  // skull + 3/4 face: far contour = forehead → brow ridge → cheekbone → cheek hollow → jaw → chin
  const face: Pt[] = [
    [54, 66], [58, 40], [80, 22], [106, 19], [124, 28], [131, 46], [134, 64], [133 + ch * 0.2, 74], [134 + ch, 86], [135 + ch, 98],
    [132 + cx * 0.6, 106 + cy * 0.5], [130 + cx, 115 + cy], [123 + cx, 123 + cy], [108, 124 + cy], [88 - (jw - 1) * 18, 114 + cy * 0.4], [74 - (jw - 1) * 10, 102], [62, 90],
  ];
  p.fill(face, S[2], skin);
  const chinP: Pt = [120 + cx, 123 + cy];
  // nose: breaks the far contour (DtD-style 3/4), bridge starts between the eyes
  const nl = f.nose?.len ?? 1, ns = f.nose?.size ?? 1, bump = f.nose?.bump ?? 0;
  const tip: Pt = [138 + 6 * nl, 93 + 1.5 * nl];
  const nose: Pt[] = [[128, 70], [134 + bump, 80], [tip[0] - 1, tip[1] - 3], tip, [tip[0] - 1.2, tip[1] + 3 * ns], [tip[0] - 6 * ns, tip[1] + 4 * ns], [128, tip[1] + 2], [124, 86]];
  p.fill(nose, S[2], skin);
  // cel shadows (key light from the upper left): under the nose tip, nostril, far wing
  p.fill([[tip[0] - 1, tip[1] + 1], [tip[0] - 1.2, tip[1] + 3 * ns], [tip[0] - 6 * ns, tip[1] + 4 * ns], [128, tip[1] + 2.5], [130, tip[1] - 1]], S[1], skin, { clip: [skin] });
  p.ell(tip[0] - 4.5 * ns, tip[1] + 2.2 * ns, 1.8 * ns, 1.1, S[0], feat, { clip: [skin], retag: true });
  p.stroke([[124, 88], [126, 94], [129, tip[1] + 2]], 1.4, 1.2, S[1], skin, { clip: [skin] });
  // far cheek plane
  p.fill([[134, 100], [136 + ch, 100], [133 + cx * 0.6, 108 + cy * 0.5], [131 + cx, 115 + cy], [128 + cx, 110]], S[1], skin, { clip: [skin] });
  // eye sockets (soft)
  p.ell(101, 79, 11.5, 6.2, S[1], skin, { clip: [skin] });
  p.ell(126, 79, 6, 5.5, S[1], skin, { clip: [skin] });
  // jaw underside + neck under the chin
  // jaw line plane + neck in the jaw's shadow
  p.fill([[66, 96], [80, 108], [96, 117], [110, 123 + cy], [96, 124 + cy], [76, 114], [64, 102]], S[1], skin, { clip: [skin] });
  p.where([skin], (u, v) => u < 114 && v > 100 && v > 114 + (u - 90) * 0.4 + cy * 0.6 && v < 132 + cy - (u - 80) * 0.1, S[1]);
  p.where([skin], (u, v) => u < 114 && v > 100 && v > 114 + (u - 90) * 0.4 + cy * 0.6 && v < 118 + (u - 90) * 0.4 + cy * 0.6, S[0]);
  // under lower lip / chin dimple
  p.stroke([[118, 114 + cy * 0.5], [124, 114.5 + cy * 0.5], [129, 113.5 + cy * 0.5]], 2, 1.5, S[1], skin, { clip: [skin] });
  // highlights: cheekbone, nose bridge, forehead
  p.ell(108, 90, 6, 3.2, S[3], skin, { clip: [skin] });
  p.stroke([[130, 74], [134, 82], [138, 89]], 1.8, 1.4, S[3], skin, { clip: [skin] });
  p.ell(106, 42, 7, 4, S[3], skin, { clip: [skin] });
  if (f.lines) {
    p.stroke([[120, 99], [115, 106], [113, 112]], 1.5, 1.1, S[1], skin, { clip: [skin] });
    p.stroke([[90, 88], [98, 90.5], [106, 89]], 1.4, 1, S[1], skin, { clip: [skin] });
    p.stroke([[86, 60], [100, 58], [112, 60]], 1.2, 1, S[1], skin, { clip: [skin] });
  }
  // blush
  if (ex.blush) {
    const bc = mix(S[2], hex(f.blushCol ?? '#e8746a'), 0.5 * ex.blush);
    p.ell(104, 93, 7.5, 3, bc, skin, { clip: [skin] });
    p.ell(131, 92, 3, 2.6, bc, skin, { clip: [skin] });
  }
  // eyes
  const ey = f.eyes.y ?? 0;
  const eyeN: Pt = [102, 80 + ey], eyeF: Pt = [126, 79.5 + ey];
  const es = f.eyes.size ?? 1;
  const shape = blink && ex.eye !== 'closed' && ex.eye !== 'happy' ? 'closed' : ex.eye;
  eye(p, eyeN, 16 * es, 8.6 * es, shape, f, ex, S, skin, feat, ink, true);
  eye(p, eyeF, 8 * es, 7.8 * es, shape, f, ex, S, skin, feat, ink, false);
  // brows (thick, expressive)
  const by = (f.brow.y ?? 0) + ey;
  const bc = hex(f.brow.col), bw = f.brow.w, bl = f.brow.len ?? 1, ar = f.brow.arch ?? 1;
  const bN: Pt[] = [[88 - 3 * bl, 72 + by - ex.bOut], [100, 67 + by - (ex.bOut + ex.bIn) / 2 - ar], [113, 69 + by - ex.bIn]];
  const bF: Pt[] = [[121, 69 + by - ex.bIn], [127, 67.5 + by - (ex.bIn + ex.bOut) / 2 - ar * 0.6], [132, 69.5 + by - ex.bOut]];
  p.stroke(bN, bw * 0.8, bw, bc, feat);
  p.stroke(bF, bw * 0.85, bw * 0.55, bc, feat);
  // mouth
  const mc: Pt = [123 + cx * 0.5, 106 + cy * 0.4];
  const closedish = talk === 0 && (ex.mouth === 'line' || ex.mouth === 'smile' || ex.mouth === 'smirk' || ex.mouth === 'frown' || ex.mouth === 'wavy');
  if (f.lips && closedish) {
    const L = hex(f.lip ?? '#b5584e');
    const [x, y] = mc;
    const up = ex.mouth === 'smile' ? -1.2 : ex.mouth === 'frown' ? 1 : 0;
    p.fill([[x - 9, y + up], [x - 3, y - 2.6], [x, y - 1.8], [x + 3, y - 2.6], [x + 6.5, y - 0.4 + up * 0.6], [x, y + 0.4]], shade(L, -0.12), feat);
    p.fill([[x - 8, y + 0.4 + up], [x, y + 0.6], [x + 6, y + up * 0.6], [x + 3, y + 3.6], [x - 3, y + 4]], L, feat);
    p.ell(x - 1.5, y + 2, 2.2, 0.9, shade(L, 0.25), feat, { clip: [feat] });
  }
  mouth(p, mc, ex.mouth, talk, f, S, skin, feat, ink);
  // sweat / tear
  if (ex.sweat) {
    const W = [hex('#2e6fa8'), hex('#7cc4f0'), hex('#e8f8ff')];
    p.fill([[140, 46], [144, 55], [142, 59], [138, 59], [137, 55]], W[1], p.m(9, true, 0.4));
    p.dot(139, 54, W[2]);
  }
  if (ex.tear && !blink) p.stroke([[102, 86], [103, 94], [102, 100]], 2.2, 1.5, hex('#8fd4f6'), feat);
  return { M: { skin, feat, hair, ink }, G: { eyeN, eyeF, mouth: [119, 106], nose: tip, chin: chinP, jawBack: [66, 96], ear, crown: [88, 20] }, S };
}

function eye(p: Pic, c: Pt, w: number, h: number, shape: FaceParams['eye'], f: FaceSpec, ex: FaceParams, S: C[], skin: number, feat: number, ink: C, near: boolean) {
  const [x, y] = c;
  const lash = f.eyes.style === 'lash';
  const lidW = lash ? 2.4 : f.eyes.style === 'bold' ? 2 : 1.6;
  const iris = hex(f.eyes.iris);
  const white = hex('#f6f2ee');
  const hw = w / 2;
  // socket shade
  p.ell(x, y - 1, hw + 1.5, h * 0.62 + 1.2, S[1], skin, { clip: [skin] });
  if (shape === 'closed' || shape === 'happy') {
    const up = shape === 'happy' ? -1 : 1;
    p.stroke([[x - hw, y + 0.5 * up], [x, y - 2.2 * up], [x + hw, y + 0.5 * up]], lidW, lidW * 0.8, ink, feat);
    if (lash && near) p.stroke([[x - hw, y + 0.5 * up], [x - hw - 2.5, y - 1.2]], 1.6, 1, ink, feat);
    return;
  }
  const top = shape === 'half' ? 0.15 : shape === 'squint' ? 0.35 : shape === 'wide' ? 1.25 : shape === 'sad' ? 0.8 : 1;
  const hh = h * 0.5 * (shape === 'wide' ? 1.25 : 1);
  // almond
  const almond: Pt[] = [[x - hw, y], [x - hw * 0.4, y - hh * top], [x + hw * 0.5, y - hh * top * (shape === 'sad' ? 0.7 : 1)], [x + hw, y - hh * 0.1], [x + hw * 0.4, y + hh * 0.75], [x - hw * 0.4, y + hh * 0.7]];
  p.fill(almond, white, feat, { clip: [skin, feat], retag: true });
  // iris + pupil + glints
  const [lx, ly] = ex.look;
  const ix = x + lx * hw * 0.3 + (near ? 1 : 0.5), iy = y + ly * hh * 0.3 + (shape === 'wide' ? 0 : 0.2);
  const ir = Math.min(hw * 0.62, hh * (shape === 'wide' ? 0.7 : 1.05));
  const small = shape === 'wide' && ex.pale;
  p.ell(ix, iy, small ? ir * 0.5 : ir * 0.85, small ? ir * 0.55 : ir, iris, feat, { clip: [feat] });
  p.ell(ix, iy + 0.2, small ? ir * 0.28 : ir * 0.46, small ? ir * 0.3 : ir * 0.55, mix(iris, ink, 0.75), feat, { clip: [feat] });
  if (!small) {
    p.ell(ix - ir * 0.35, iy - ir * 0.4, Math.max(0.9, ir * 0.28), Math.max(0.9, ir * 0.28), hex('#ffffff'), feat, { clip: [feat] });
    if (near) p.dot(ix + ir * 0.35, iy + ir * 0.45, shade(iris, 0.35));
  }
  // lids: heavy upper lash line, faint lower lid
  const lidTop: Pt[] = [[x - hw - 0.6, y + 0.3], [x - hw * 0.4, y - hh * top - 0.3], [x + hw * 0.5, y - hh * top * (shape === 'sad' ? 0.7 : 1) - 0.3], [x + hw + 0.4, y - hh * 0.05]];
  p.stroke(lidTop, lidW, lidW * (lash ? 1.1 : 0.8), ink, feat);
  if (lash && near) p.stroke([[x + hw * 0.1, y - hh * top - 0.4], [x + hw + 0.8, y - hh * 0.2], [x + hw + 3, y - hh * 0.9]], 1.4, 0.8, ink, feat);
  if (lash && !near) p.stroke([[x + hw, y - hh * 0.3], [x + hw + 2, y - hh * 1.1]], 1.2, 0.7, ink, feat);
  p.stroke([[x - hw * 0.5, y + hh * 0.8], [x + hw * 0.5, y + hh * 0.78]], 0.9, 0.7, S[0], feat);
}

function mouth(p: Pic, c: Pt, kind: FaceParams['mouth'], talk: 0 | 1 | 2, f: FaceSpec, S: C[], skin: number, feat: number, ink: C) {
  let k = kind;
  // talking flaps open the mouth
  if (talk === 1 && (k === 'line' || k === 'smile' || k === 'smirk' || k === 'frown' || k === 'wavy')) k = k === 'smile' ? 'grin' : 'open';
  if (talk === 2 && k !== 'shout' && k !== 'grit') k = k === 'o' ? 'shout' : k === 'smile' || k === 'grin' ? 'shout' : 'open';
  const [x, y] = c;
  const lip = hex(f.lip ?? '#b5584e');
  void lip;
  const inside = hex('#5a1620'), tongue = hex('#d0506a'), teeth = hex('#fbf6ee');
  const line = mix(ink, lip, 0.35);
  switch (k) {
    case 'line': p.stroke([[x - 9.1, y], [x, y + 0.4], [x + 6.5, y - 0.4]], 1.6, 1.2, line, feat); p.stroke([[x - 5.2, y + 3], [x + 2.6, y + 3.2]], 1.2, 1, S[1], feat, { clip: [skin] }); break;
    case 'smile': p.stroke([[x - 10.4, y - 2], [x - 3.9, y + 1.6], [x + 5.2, y + 0.8], [x + 9.1, y - 2]], 1.8, 1.4, line, feat); p.stroke([[x - 3.9, y + 4.4], [x + 3.9, y + 4.2]], 1.2, 1, S[1], feat, { clip: [skin] }); break;
    case 'smirk': p.stroke([[x - 7.8, y + 0.6], [x + 1.3, y + 0.4], [x + 7.8, y - 2.4]], 1.6, 1.3, line, feat); break;
    case 'frown': p.stroke([[x - 9.1, y + 1.6], [x - 1.3, y - 0.6], [x + 6.5, y + 1.8]], 1.6, 1.3, line, feat); break;
    case 'wavy': p.stroke([[x - 9.1, y + 0.5], [x - 4.55, y - 1], [x, y + 1], [x + 4.55, y - 1], [x + 7.8, y + 0.5]], 1.4, 1.2, line, feat); break;
    case 'o': p.ell(x, y + 1, 4, 4.6, inside, feat); p.ell(x, y + 2.6, 2, 1.4, tongue, feat, { clip: [feat] }); break;
    case 'chew': p.ell(x - 1.3, y + 0.6, 5, 2.4, inside, feat); p.ell(x, y + 1.4, 3, 1.1, tongue, feat, { clip: [feat] }); p.ell(113, 98, 5, 4, S[3], skin, { clip: [skin] }); break;
    case 'grin': case 'open': {
      const H = k === 'grin' ? 4.2 : 5.5;
      p.fill([[x - 10.4, y - 1.5], [x, y - 1], [x + 7.8, y - 2], [x + 5.2, y + H * 0.6], [x - 1.3, y + H], [x - 7.8, y + H * 0.5]], inside, feat);
      p.fill([[x - 9.1, y - 1.2], [x + 6.5, y - 1.6], [x + 5.2, y + 0.8], [x - 7.8, y + 0.8]], teeth, feat, { clip: [feat] });
      if (k === 'open') p.ell(x - 1.3, y + H - 1, 3.5, 1.6, tongue, feat, { clip: [feat] });
      break;
    }
    case 'shout': {
      // big DtD-style open yell: dark oval, top teeth, tongue
      p.fill([[x - 13.0, y - 3], [x - 2.6, y - 3.5], [x + 9.1, y - 3], [x + 9.1, y + 4], [x + 2.6, y + 11], [x - 6.5, y + 10], [x - 13.0, y + 3]], inside, feat);
      p.fill([[x - 11.7, y - 2.6], [x + 7.8, y - 2.6], [x + 7.15, y], [x - 11.05, y]], teeth, feat, { clip: [feat] });
      p.ell(x - 1.95, y + 8, 5, 2.6, tongue, feat, { clip: [feat] });
      break;
    }
    case 'grit': {
      p.fill([[x - 10.4, y - 2], [x + 7.8, y - 2.4], [x + 7.8, y + 2.8], [x - 9.1, y + 3]], teeth, feat);
      p.stroke([[x - 10.4, y + 0.4], [x + 7.8, y + 0.2]], 0.9, 0.9, hex('#b8a8a0'), feat);
      for (let i = -5; i <= 4; i += 3) p.stroke([[x + i, y - 2], [x + i, y + 2.8]], 0.8, 0.8, hex('#c8b8b0'), feat);
      p.stroke([[x - 11.05, y - 2.5], [x + 8.45, y - 2.8], [x + 8.45, y + 3.2], [x - 9.75, y + 3.4], [x - 11.05, y - 2.5]], 1, 1, line, feat, { sharp: true });
      break;
    }
  }
}

/** Generic hair clump: a tapered lock from root to tip with a light strip. */
export function lock(p: Pic, root: Pt, mid: Pt, tip: Pt, w: number, H: C[], m: number, light = true) {
  const n: Pt = [-(mid[1] - root[1]), mid[0] - root[0]];
  const L = Math.hypot(n[0], n[1]) || 1;
  const k = w / 2 / L;
  p.fill([[root[0] + n[0] * k, root[1] + n[1] * k], [mid[0] + n[0] * k * 0.8, mid[1] + n[1] * k * 0.8], tip, [mid[0] - n[0] * k * 0.8, mid[1] - n[1] * k * 0.8], [root[0] - n[0] * k, root[1] - n[1] * k]], H[2], m);
  if (light) p.stroke([[root[0] + n[0] * k * 0.3, root[1] + n[1] * k * 0.3], [mid[0] + n[0] * k * 0.35, mid[1] + n[1] * k * 0.35], [(mid[0] + tip[0]) / 2, (mid[1] + tip[1]) / 2]], w * 0.18, w * 0.05, H[3], m, { clip: [m] });
}

export { shade, mix, hex };

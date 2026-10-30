// V7 heads: small 3D heads (skull, a narrow jaw with a pointed chin, nose, ears) under anime hair
// built from a shell and tapered spiky locks, turned toward the camera like the bodies. Faces are
// sprite-simple on purpose: single-pixel dot eyes, short brows, a one or two pixel mouth, blush,
// so the expression reads at game scale (the detailed faces live in the dialogue close-ups).
// Head space: origin at the neck top, x forward (the face), y up, z lateral (+ toward the viewer).

import { PixelBuffer } from '../pixel';
import { C, hex, mix } from '../color';
import { Scene3D, V3, Hit, cel, Ramp6, vadd } from './raster';
import { YAW, BACK_YAW, PX7 } from './body';
import { paintFace7 } from './face7';
import { trimPair } from '../people-rig';
import { AROHA_HEAD } from './aroha7';

const R6 = (...h: string[]): Ramp6 => h.map(v => hex(v));
export type Look = 'fwd' | 'up' | 'down' | 'back' | 'cam' | 'away';
const frac = (v: number) => v - Math.floor(v);
export interface HeadOpts7 { expr: string; mouth: 0 | 1 | 2; blink: boolean; look: Look; hair?: number }

export interface Lock { a: V3; b: V3; r0: number; r1: number; sway?: number }

/**
 * Outfit head wear (beanies, hoods, goggles, head lamps): drawn over the head, with the hair it
 * covers tucked away (locks, the whole shell under a hood) and the character's own extras
 * optionally hidden (Aroha's headband under a hood; Joshu's cap and beard stay).
 */
export interface HeadWear7 {
  hideLock?(l: Lock, i: number): boolean;
  /** locks rooted above this height (head space) start from it instead: bangs come out from under the brim */
  tuck?: number;
  hideShell?: boolean;
  hideExtras?: boolean;
  draw(s: Scene3D, W: (p: V3) => V3, o: HeadOpts7, d: HeadDef7): void;
}

export interface HeadDef7 {
  skin: Ramp6;
  hair: Ramp6;
  ink: C;
  /** skull radii and centre */
  skull: [V3, V3];
  jaw: [V3, V3];
  chin: [V3, V3];
  nose: [V3, V3];
  ear: [V3, V3];
  eye: V3;
  mouth: V3;
  eyeCol: string;
  brow: string;
  blush: string;
  /** hair shell (centre, radii) and a cut-out test in its unit-sphere frame (true = removed: the face) */
  shell: [V3, V3];
  cut(q: V3): boolean;
  locks: Lock[];
  /** extra pieces drawn after the head (caps, beards, headbands) */
  extras?(s: Scene3D, W: (p: V3) => V3, o: HeadOpts7): void;
  /** a lower fringe line the brows hide behind (y), if the bangs cover the brows */
  browHidden?: boolean;
  /** 'slit': always narrowed eyes, short dark slits sunk under a heavy brow ridge (Joshu) */
  eyeStyle?: 'dot' | 'slit';
  /** a character's own eye + brow painter (replaces the dot eyes; `inner` is the screen direction to the nose, `far` the far eye) */
  eyePaint?(mark: FaceMark, x: number, y: number, inner: 1 | -1, far: boolean, eye: HeadExpr7['eye'], ex: HeadExpr7, d: HeadDef7): void;
  /** a character's own mouth painter (mouth: the expression's shape, or the talking flap) */
  mouthPaint?(mark: FaceMark, x: number, y: number, mouth: HeadExpr7['mouth'], ex: HeadExpr7, d: HeadDef7): void;
  /**
   * The anime face (face7.ts) that the sprites now wear (eyePaint / mouthPaint are kept for the
   * older low-density painters): iris colours [dark, lit], lash style ('f' flicks up and out, with a
   * lower lash), freckles.
   */
  face?: { iris?: [string, string]; lash?: 'm' | 'f'; freckles?: boolean };
}
export type FaceMark = (x: number, y: number, c: C) => void;

// ------------------------------------------------------------------ expressions

export type HeadExpr7 = Ex;
interface Ex { eye: 'dot' | 'closed' | 'happy' | 'wide' | 'half' | 'sad' | 'angry'; brow: number; browTilt: number; mouth: 'none' | 'smile' | 'open' | 'o' | 'frown' | 'grit' | 'shout'; blush?: boolean; sweat?: boolean }
const EXPR: Record<string, Ex> = {
  neutral: { eye: 'dot', brow: 0, browTilt: 0, mouth: 'none' },
  happy: { eye: 'happy', brow: 1, browTilt: 0, mouth: 'smile', blush: true },
  laugh: { eye: 'happy', brow: 1, browTilt: 0, mouth: 'shout', blush: true },
  excited: { eye: 'wide', brow: 1, browTilt: 0, mouth: 'open', blush: true },
  surprised: { eye: 'wide', brow: 2, browTilt: 0, mouth: 'o' },
  shocked: { eye: 'wide', brow: 2, browTilt: 1, mouth: 'shout', sweat: true },
  angry: { eye: 'angry', brow: 0, browTilt: -1, mouth: 'grit' },
  grumpy: { eye: 'half', brow: 0, browTilt: -1, mouth: 'frown' },
  sad: { eye: 'sad', brow: 1, browTilt: 1, mouth: 'frown' },
  worried: { eye: 'dot', brow: 1, browTilt: 1, mouth: 'frown', sweat: true },
  scared: { eye: 'wide', brow: 2, browTilt: 1, mouth: 'o', sweat: true },
  thinking: { eye: 'half', brow: 1, browTilt: -1, mouth: 'none' },
  tired: { eye: 'half', brow: 0, browTilt: 1, mouth: 'none' },
  teasing: { eye: 'half', brow: 1, browTilt: 0, mouth: 'smile', blush: true },
  serious: { eye: 'dot', brow: 0, browTilt: -1, mouth: 'none' },
  smug: { eye: 'half', brow: 1, browTilt: -1, mouth: 'smile' },
  determined: { eye: 'angry', brow: 0, browTilt: -1, mouth: 'smile' },
  sleep: { eye: 'closed', brow: 0, browTilt: 0, mouth: 'none' },
  eat: { eye: 'happy', brow: 1, browTilt: 0, mouth: 'o', blush: true },
  injured: { eye: 'closed', brow: 1, browTilt: 1, mouth: 'grit', sweat: true },
  cry: { eye: 'sad', brow: 1, browTilt: 1, mouth: 'frown' },
  wow: { eye: 'wide', brow: 2, browTilt: 0, mouth: 'o', blush: true },
};
export const HEAD_EXPRS7 = Object.keys(EXPR);
/** an expression's face settings (neutral for unknown names); the HUD bust (bust.ts) paints from these */
export const headExpr7 = (name: string): HeadExpr7 => EXPR[name] ?? EXPR.neutral;

// ------------------------------------------------------------------ cast heads

const BOY_SKIN = R6('#3a1810', '#9a4a36', '#c8805e', '#f0a878', '#f8c090', '#ffe0b8');
const GIRL_SKIN = R6('#3a1c1c', '#b86a60', '#d8907e', '#f6b8a4', '#fad0bc', '#ffe8dc');
const JOSHU_SKIN = R6('#3a1810', '#a04a3a', '#d08064', '#f2aa86', '#f8c49c', '#ffe0c4');

const MORI: HeadDef7 = {
  skin: BOY_SKIN,
  hair: R6('#0a0608', '#1a1216', '#2a2024', '#3c3034', '#5a5262', '#8a86a0'),
  face: { iris: ['#3e2a22', '#8e6a4c'], lash: 'm' },
  ink: hex('#1a0e10'),
  skull: [[0.1, 8.0, 0], [4.8, 5.4, 4.2]],
  // a squarer jaw and a broad chin (a man's head, even at sprite scale)
  jaw: [[1.6, 4.3, 0], [3.5, 3.1, 3.25]],
  chin: [[3.6, 2.2, 0], [1.5, 1.2, 1.8]],
  nose: [[4.9, 5.9, 0], [1.0, 0.9, 0.6]],
  ear: [[-0.4, 6.4, 4.0], [1.0, 1.5, 0.7]],
  eye: [4.0, 6.8, 2.3],
  mouth: [4.6, 3.8, 0.3],
  eyeCol: '#1a0e10', brow: '#1a1216', blush: '#e89078',
  shell: [[-0.5, 9.1, 0], [5.5, 5.8, 4.9]],
  cut: q => q[0] > 0.3 && q[1] < 0.3,
  locks: [
    // messy bangs sweeping across the forehead
    { a: [2.2, 12.6, 2.6], b: [5.2, 9.4, 3.4], r0: 1.6, r1: 0.3 }, { a: [2.8, 13, 1], b: [5.8, 9.2, 1.4], r0: 1.7, r1: 0.3 },
    { a: [2.8, 13, -1], b: [5.6, 9.6, -1.2], r0: 1.6, r1: 0.3 }, { a: [2.2, 12.6, -2.6], b: [4.8, 9.8, -3.4], r0: 1.5, r1: 0.3 },
    // spiky crown and back
    { a: [0.5, 13.6, 1.2], b: [1.4, 16.2, 2], r0: 1.6, r1: 0.3 }, { a: [-1.2, 13.6, -0.8], b: [-2.4, 16, -1.4], r0: 1.6, r1: 0.3, sway: 1 },
    { a: [-3, 12.4, 1.6], b: [-6.6, 13.6, 2.4], r0: 1.8, r1: 0.3, sway: 1 }, { a: [-3.6, 10.4, -1.6], b: [-7.4, 10.4, -2.4], r0: 1.8, r1: 0.3, sway: 1 },
    { a: [-3.6, 8.4, 1.8], b: [-6.4, 6.6, 3], r0: 1.6, r1: 0.3, sway: 1 }, { a: [-3.4, 7.6, -1.6], b: [-5.8, 5.4, -2.8], r0: 1.5, r1: 0.3, sway: 1 },
    // sideburns over the ears
    { a: [0.6, 9.6, 4.6], b: [1.4, 5.4, 4.8], r0: 1.2, r1: 0.3 }, { a: [0.6, 9.6, -4.6], b: [1.4, 5.4, -4.8], r0: 1.2, r1: 0.3 },
  ],
};

const JENNA: HeadDef7 = {
  skin: GIRL_SKIN,
  hair: R6('#241a1a', '#4a3434', '#6a5050', '#8a6c6a', '#a88a86', '#c8aca6'),
  ink: hex('#24141a'),
  skull: [[0.1, 7.8, 0], [4.6, 5.2, 4.1]],
  jaw: [[1.5, 4.4, 0], [3.2, 2.9, 2.8]],
  chin: [[3.4, 2.5, 0], [1.2, 1.1, 1.2]],
  nose: [[4.6, 5.8, 0], [0.7, 0.7, 0.5]],
  ear: [[-0.4, 6.2, 4.1], [0.9, 1.3, 0.6]],
  eye: [3.9, 6.7, 2.2],
  mouth: [4.2, 4.0, 0.3],
  eyeCol: '#24141a', brow: '#4a3434', blush: '#f49a90',
  face: { iris: ['#4a3a56', '#9e88b4'], lash: 'f' },
  shell: [[-0.5, 8.9, 0], [5.4, 5.9, 5.0]],
  cut: q => q[0] > 0.22 && q[1] < 0.34,
  locks: [
    // blunt bangs
    ...[-3, -1.5, 0, 1.5, 3].map((z): Lock => ({ a: [2.6, 12.4, z], b: [5.1, 9.4, z * 1.1], r0: 1.6, r1: 0.6 })),
    // the bob: long side and back locks down to the jaw, flicking out at the ends
    { a: [1.2, 10, 4.6], b: [2.2, 2.6, 5.4], r0: 1.8, r1: 0.7, sway: 0.5 }, { a: [1.2, 10, -4.6], b: [2.2, 2.6, -5.4], r0: 1.8, r1: 0.7, sway: 0.5 },
    { a: [-1.4, 10, 4.4], b: [-1.6, 1.8, 5.6], r0: 2.2, r1: 0.8, sway: 1 }, { a: [-1.4, 10, -4.4], b: [-1.6, 1.8, -5.6], r0: 2.2, r1: 0.8, sway: 1 },
    { a: [-3.8, 9.6, 2], b: [-5, 1.6, 2.8], r0: 2.4, r1: 0.9, sway: 1 }, { a: [-3.8, 9.6, -2], b: [-5, 1.6, -2.8], r0: 2.4, r1: 0.9, sway: 1 },
    { a: [-2.6, 13.4, 0], b: [-3.2, 14.6, 0.6], r0: 1.2, r1: 0.3 },
  ],
  browHidden: true,
};

const JOSHU: HeadDef7 = {
  skin: JOSHU_SKIN,
  hair: R6('#5a5452', '#8a8480', '#b8b2ac', '#dcd6ce', '#f0ebe4', '#ffffff'),
  ink: hex('#1c1012'),
  skull: [[0.2, 8.6, 0], [5.6, 6.0, 5.3]],
  jaw: [[1.4, 4.8, 0], [4.4, 3.6, 4.2]],
  chin: [[3.2, 2.8, 0], [2.0, 1.8, 2.2]],
  nose: [[5.9, 6.4, 0], [1.5, 1.3, 1.2]],
  ear: [[-0.4, 6.8, 5.0], [1.1, 1.6, 0.8]],
  eye: [4.8, 7.8, 2.8],
  mouth: [5.4, 3.6, 0.3],
  eyeCol: '#140a0c', brow: '#e8e2d8', blush: '#f08a80',
  face: { iris: ['#283442', '#6a8498'], lash: 'm' },
  shell: [[-0.8, 8.4, 0], [5.8, 5.2, 5.8]],
  cut: q => q[0] > 0.1 || q[1] > 0.55,
  locks: [],
  eyeStyle: 'slit',
  extras(s, W) {
    // the full Santa beard, moustache and the red skipper's cap
    const beard = R6('#6a6462', '#9a948e', '#c8c2ba', '#ece6de', '#f8f4ee', '#ffffff');
    const bm = (h: Hit) => { const curl = Math.sin(h.x * 1.7 + h.y * 0.9) > 0.6; return curl ? beard[2] : cel(beard, h.l, 0.1, true); };
    s.ellipsoid(W([2.4, 3.2, 0]), W([4.2, 0, 0]), [0, 4.2, 0], W([0, 0, 5.0]), 10, bm);
    s.ellipsoid(W([2.6, -0.8, 0]), W([4.4, 0, 0]), [0, 4.0, 0], W([0, 0, 4.4]), 10, bm);
    s.ellipsoid(W([3.4, -4.2, 0]), W([3.2, 0, 0]), [0, 2.8, 0], W([0, 0, 3.2]), 10, bm);
    s.ellipsoid(W([5.6, 4.8, 0]), W([1.6, 0, 0]), [0, 1.0, 0], W([0, 0, 3.0]), 11, h => cel(beard, h.l, 0.25, true));
    const cap = R6('#2a0808', '#5a1410', '#8a2218', '#b0342a', '#cc4a3a', '#e8705a');
    s.ellipsoid(W([-0.2, 13.2, 0]), W([6.0, 0, 0]), [0, 3.0, 0], W([0, 0, 5.8]), 12, h => (h.q[1] < -0.1 ? -1 : cel(cap, h.l, 0)));
    s.ellipsoid(W([0.1, 13.2, 0]), W([6.1, 0, 0]), [0, 0.8, 0], W([0, 0, 5.9]), 12, h => cel(cap, h.l, -0.5));
    s.ellipsoid(W([5.0, 13.0, 0]), W([2.4, -0.5, 0]), [0, 0.35, 0], W([0, 0, 4.0]), 13, h => cel(R6('#000', '#0c0808', '#181214', '#241c1e', '#342a2c', '#443a3c'), h.l, 0));
    s.dot(W([5.4, 14.2, 0.6]), hex('#f0c040'), 2);
  },
};

export const HEADS7: Record<string, HeadDef7> = { mori: MORI, jenna: JENNA, aroha: AROHA_HEAD, joshu: JOSHU };

// ------------------------------------------------------------------ render

const cache = new Map<string, { buf: PixelBuffer; ax: number; ay: number; k: number }>();
/** head-space canvas (head units): the buffer is this times the head's pixel density */
const HW = 48, HH = 56, HOX = 24, HOY = 40;
/**
 * Grown-ups' heads are drawn at this fraction of the head volumes' size: the anime-realistic
 * proportions (about six heads tall, the head kept a touch large so faces read at game scale).
 * Children (index.ts passes their own) keep rounder, larger heads.
 */
export const HEAD_SCALE7 = 0.8;

/**
 * A head, optionally dressed in outfit head wear (`wk` names it for the cache), at `hs` of its
 * volumes' size. The buffer is at the rig's pixel density (PX7 px per world px; `k` says so).
 */
export function renderHead7(id: string, o: HeadOpts7, wear?: HeadWear7, wk = '', hs = HEAD_SCALE7): { buf: PixelBuffer; ax: number; ay: number; k: number } {
  const key = `${id}|${wk}|${o.expr}|${o.mouth}|${o.blink ? 1 : 0}|${o.look}|${o.hair ?? 0}|${hs}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const d = HEADS7[id] ?? MORI;
  const ex = EXPR[o.expr] ?? EXPR.neutral;
  // buffer px per head unit
  const k = PX7 * hs;
  const BW = Math.ceil(HW * k), BH = Math.ceil(HH * k), BOX = Math.round(HOX * k), BOY = Math.round(HOY * k);
  const s = new Scene3D(BW, BH, BOX, BOY, k);
  // the head turns a little further toward the camera than the body, so both eyes read; 'cam' looks
  // straight out at the viewer, 'away' glances back over the shoulder (at someone behind)
  const back = o.look === 'back';
  const HY = back ? BACK_YAW - 0.1 : o.look === 'cam' ? Math.PI / 2 - 0.16 : o.look === 'away' ? Math.PI - YAW - 0.12 : YAW + 0.25, ca = Math.cos(HY), sa = Math.sin(HY);
  const pitch = o.look === 'up' || back ? 0.2 : o.look === 'down' ? -0.24 : 0;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  // head space → world: pitch about the neck (z axis), then yaw toward the camera
  const W = (p: V3): V3 => {
    const x = p[0] * cp - p[1] * sp, y = p[0] * sp + p[1] * cp, z = p[2];
    return [x * ca - z * sa, y, x * sa + z * ca];
  };
  const Wv = (v: V3): V3 => W(v); // (linear)
  const E = (c: V3, r: V3, g: number, m: (h: Hit) => C | -1) => s.ellipsoid(W(c), Wv([r[0], 0, 0]), Wv([0, r[1], 0]), Wv([0, 0, r[2]]), g, m);
  const skinM = (bias = 0) => (h: Hit) => cel(d.skin, h.l, bias + 0.18);
  // face volumes
  E(d.skull[0], d.skull[1], 1, skinM());
  E(d.jaw[0], d.jaw[1], 1, skinM(0.05));
  E(d.chin[0], d.chin[1], 1, skinM(0.1));
  E(d.nose[0], d.nose[1], 1, skinM(0.2));
  E(d.ear[0], d.ear[1], 2, skinM(-0.05));
  // hair in strand clusters: dark grooves between the clumps, a broken two-tone angel ring across the
  // crown and a fainter second band, lit tips on the locks (the rim light comes in the finish pass)
  const HR = d.hair;
  // the angel ring: one band at a fixed height round the head, across the shell and every lock alike,
  // its lower edge cut into teeth along the strands; a thinner second band lower on the bangs
  const ringY = d.skull[0][1] + d.skull[1][1] * 0.52;
  const ring = (h: Hit, groove: boolean, strand: number): C | 0 => {
    if (groove || h.l < 0.18) return 0;
    const y = h.p[1], saw = frac(strand);
    if (y < ringY + 0.75 && y > ringY - 0.35 - saw * 0.9) return h.l > 0.55 && y > ringY - 0.1 && y < ringY + 0.45 ? HR[5] : HR[4];
    if (h.l > 0.42 && y < ringY - 2.3 && y > ringY - 2.75 - saw * 0.5) return mix(cel(HR, h.l, 0.05), HR[4], 0.55);
    return 0;
  };
  const shellM = (h: Hit): C | -1 => {
    if (d.cut(h.q)) return -1;
    const q = h.q, lat = q[1];
    // strands fan out from the whorl at the back of the crown
    const ang = Math.atan2(q[2], q[0] + 0.45);
    const groove = lat < 0.92 && Math.sin(ang * 8 + lat * 2.4) > 0.8;
    const rg = ring(h, groove, ang * 2.6);
    if (rg) return rg;
    const c = cel(HR, h.l, 0.05);
    return groove ? mix(c, HR[1], 0.55) : c;
  };
  const lockM = (i: number) => (h: Hit): C => {
    const t = h.t;
    const groove = Math.sin(h.q[1] * 2.6 + i * 1.9) > 0.8;
    const rg = ring(h, groove, h.q[1] * 0.8 + i * 0.37);
    if (rg) return rg;
    const c = cel(HR, h.l, 0.05);
    if (groove) return mix(c, HR[1], 0.6);
    if (t > 0.84 && h.l > -0.1) return mix(c, HR[4], 0.35); // fine tips catch the light
    return c;
  };
  if (!wear?.hideShell) s.ellipsoid(W(d.shell[0]), Wv([d.shell[1][0], 0, 0]), Wv([0, d.shell[1][1], 0]), Wv([0, 0, d.shell[1][2]]), 3, shellM);
  const sway = o.hair ?? 0;
  d.locks.forEach((l, i) => {
    if (wear?.hideLock?.(l, i)) return;
    const tip: V3 = vadd(l.b, [-(l.sway ?? 0) * sway * 1.2, (l.sway ?? 0) * sway * 0.3, 0]);
    let a = l.a, r0 = l.r0;
    const tk = wear?.tuck;
    if (tk !== undefined && a[1] > tk) {
      if (tip[1] >= tk) return;
      const u = (a[1] - tk) / (a[1] - tip[1]);
      a = [a[0] + (tip[0] - a[0]) * u, tk, a[2] + (tip[2] - a[2]) * u];
      r0 = l.r0 + (l.r1 - l.r0) * u;
    }
    s.limb(W(a), W(tip), r0, l.r1, 3, lockM(i));
  });
  if (!wear?.hideExtras) d.extras?.(s, W, o);
  wear?.draw(s, W, o, d);
  // the face (face7.ts), projected onto the surface and painted after the ink
  const px = (p: V3): [number, number, number] => { const w = W(p); return [BOX + w[0] * k, BOY - w[1] * k, w[2]]; };
  const marks: [number, number, C][] = [];
  const onFace = (x: number, y: number) => x >= 0 && y >= 0 && x < BW && y < BH && s.grp[y * BW + x] === 1;
  const put = (x: number, y: number, c: C) => { x = Math.floor(x); y = Math.floor(y); if (onFace(x, y)) marks.push([x, y, c]); };
  const visible = (p: V3) => { const [x, y, z] = px(p); const i = Math.floor(y) * BW + Math.floor(x); return x >= 0 && y >= 0 && x < BW && y < BH && s.grp[i] === 1 && s.z[i] <= z + 2.2; };
  const eyeA: V3 = [d.eye[0], d.eye[1], d.eye[2]], eyeB: V3 = [d.eye[0], d.eye[1], -d.eye[2]];
  const [nearE, farE] = W(eyeA)[2] >= W(eyeB)[2] ? [eyeA, eyeB] : [eyeB, eyeA];
  const eye = o.blink && ex.eye !== 'happy' ? 'closed' : ex.eye;
  const mouth = o.mouth === 2 ? 'shout' : o.mouth === 1 ? (ex.mouth === 'none' || ex.mouth === 'smile' || ex.mouth === 'frown' ? 'open' : ex.mouth) : ex.mouth;
  const at2 = (p: V3): [number, number] => { const q = px(p); return [q[0], q[1]]; };
  if (!back) {
    paintFace7(put, {
      near: visible(nearE) ? at2(nearE) : null, far: visible(farE) ? at2(farE) : null,
      mouth: at2(d.mouth), nose: at2([d.nose[0][0] + d.nose[1][0] * 0.85, d.nose[0][1] - d.nose[1][1] * 0.3, 0]),
      dir: ca * cp >= 0 ? 1 : -1, eye, mouthShape: mouth, ex, d,
    });
    if (ex.sweat) {
      const [sx, sy] = px([0, 11, d.skull[1][2] * 0.9]);
      const drop = ['.w', 'wb', 'bb', '.b'], dc: Record<string, C> = { w: hex('#e8f8ff'), b: hex('#5ab0ec') };
      drop.forEach((row, j) => { for (let i = 0; i < 2; i++) if (row[i] !== '.') { const X = Math.floor(sx) + i, Y = Math.floor(sy) - 2 + j; if (X >= 0 && Y >= 0 && X < BW && Y < BH && s.grp[Y * BW + X]) marks.push([X, Y, dc[row[i]]]); } });
    }
  }
  const r = s.finish({ ink: d.ink, depthLine: 1.6, rim: 0.55 });
  for (const [x, y, c] of marks) r.back.data[y * BW + x] = c;
  const tr = trimPair(r.back, null, 1);
  const out = { buf: tr.a, ax: BOX - tr.ox, ay: BOY - tr.oy, k: PX7 };
  if (cache.size > 600) cache.clear();
  cache.set(key, out);
  return out;
}

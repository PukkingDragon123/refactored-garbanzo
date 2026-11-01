// V7 heads: small 3D heads (skull, a narrow jaw with a pointed chin, nose, ears) under anime hair
// built from a shell and tapered spiky locks, turned toward the camera like the bodies. Faces are
// sprite-simple on purpose: single-pixel dot eyes, short brows, a one or two pixel mouth, blush,
// so the expression reads at game scale (the detailed faces live in the dialogue close-ups).
// Head space: origin at the neck top, x forward (the face), y up, z lateral (+ toward the viewer).

import { PixelBuffer } from '../pixel';
import { C, hex, mix } from '../color';
import { Scene3D, V3, Hit, cel, Ramp6, vadd, vsub, vsc, vlen, vnorm, vlerp, TOON7, popBuf } from './raster';
import { YAW, BACK_YAW, dens7 } from './body';
import { isFem7 } from './face7';
import { trimPair } from '../people-rig';
import { AROHA_HEAD } from './aroha7';
import { paintFaceMid7 } from './facemid';
import { paintFaceToon7 } from './facetoon';

const R6 = (...h: string[]): Ramp6 => h.map(v => hex(v));
export type Look = 'fwd' | 'up' | 'down' | 'back' | 'cam' | 'away';
const frac = (v: number) => v - Math.floor(v);
/**
 * `hair`: how far the hair trails behind (-1 flicked forward .. 2 streaming back), `hairY`: how far it
 * lifts (-1 slammed down .. 1 floating up). Both come quantised from the Actor's hair spring
 * (src/world/hairphys.ts), so the head cache stays bounded.
 */
export interface HeadOpts7 { expr: string; mouth: 0 | 1 | 2; blink: boolean; look: Look; hair?: number; hairY?: number }

/**
 * A lock of hair: a tapered tube from its root `a` (radius r0) to its tip `b` (r1). `sway` is the old
 * single-axis push of the tip (kept for the heads that use it). The rest opt into the hair physics:
 *  - `m` bends the lock through a mid point (radius `rm` there: puffy tails pinched at the tie);
 *  - `dyn` (0 stiff .. 1 free) lets it swing with the head's hair state: it rotates about its root
 *    toward the pull (back and forth on screen, up on a jump, down on a landing), the tip half more
 *    than the root half so it curves, splays out as it lifts, and never sinks into the skull;
 *  - `tie` ties a ribbon bow round the root in that ramp; `band` lays an anime shine band across it at t.
 */
export interface Lock { a: V3; b: V3; r0: number; r1: number; sway?: number; m?: V3; rm?: number; dyn?: number; tie?: Ramp6; band?: number }

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
  // near-black, a cool navy shine in the light
  hair: R6('#060408', '#100c12', '#1a161e', '#28242c', '#3c3a48', '#5e5e74'),
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
  shell: [[-0.5, 9.0, 0], [5.4, 5.6, 4.85]],
  cut: q => q[0] > 0.3 && q[1] < 0.33,
  locks: [
    // a swept fringe: pointed locks of uneven length over the forehead, clear of the brows, one dipping
    // between them
    { a: [2.4, 13.2, 2.6], b: [5.5, 10.5, 3.7], r0: 1.7, r1: 0.3 }, { a: [3.0, 13.5, 0.9], b: [6.0, 10.1, 1.6], r0: 1.8, r1: 0.3 },
    { a: [3.0, 13.4, -0.8], b: [6.0, 9.5, -0.3], r0: 1.7, r1: 0.25 }, { a: [2.4, 13, -2.6], b: [5.1, 10.3, -3.5], r0: 1.6, r1: 0.3 },
    // spiky crown and back
    { a: [0.5, 13.6, 1.2], b: [1.4, 16.2, 2], r0: 1.6, r1: 0.3 }, { a: [-1.2, 13.6, -0.8], b: [-2.4, 16, -1.4], r0: 1.6, r1: 0.3, sway: 1 },
    { a: [-3, 12.4, 1.6], b: [-6.6, 13.6, 2.4], r0: 1.8, r1: 0.3, sway: 1 }, { a: [-3.6, 10.4, -1.6], b: [-7.4, 10.4, -2.4], r0: 1.8, r1: 0.3, sway: 1 },
    { a: [-3.6, 8.4, 1.8], b: [-6.4, 6.6, 3], r0: 1.6, r1: 0.3, sway: 1 }, { a: [-3.4, 7.6, -1.6], b: [-5.8, 5.4, -2.8], r0: 1.5, r1: 0.3, sway: 1 },
    // short sideburns in front of the ears (the ear shows under them)
    { a: [0.7, 9.8, 4.6], b: [1.5, 7.0, 4.7], r0: 1.2, r1: 0.3 }, { a: [0.7, 9.8, -4.6], b: [1.5, 7.0, -4.7], r0: 1.2, r1: 0.3 },
    // layered clumps at the top front, lifting off the crown over the fringe
    { a: [1.0, 14.0, 2.2], b: [4.4, 14.7, 3.2], r0: 1.6, r1: 0.3 }, { a: [1.4, 14.4, -1.4], b: [4.6, 15.2, -2.2], r0: 1.6, r1: 0.3 },
  ],
};

/** Jenna's ribbons: the same red as the bow on her sailor collar */
const JENNA_RIBBON = R6('#200406', '#4a0c12', '#7a1820', '#a8262e', '#cc4040', '#ee7a6a');
/** one of her twin tails (side s: +1 near, -1 far): a puffy main clump and a thinner one flicking out past it */
const jennaTail = (s: 1 | -1): Lock[] => [
  { a: [-2.5, 5.7, 4.0 * s], m: [-3.3, 2.5, 5.3 * s], b: [-3.7, -2.6, 5.5 * s], r0: 1.15, rm: 2.15, r1: 0.3, dyn: 1, tie: JENNA_RIBBON, band: 0.34 },
  { a: [-2.4, 5.3, 4.3 * s], m: [-2.9, 1.6, 6.0 * s], b: [-2.2, -1.3, 6.7 * s], r0: 0.9, rm: 1.3, r1: 0.25, dyn: 0.9 },
];

/**
 * Jenna: soft side-swept bangs from a parting on the far side, a little ahoge springing off the crown,
 * cheek-length locks framing the face, and two short low twin tails tied with red ribbons. Grey-brown,
 * cool mauve in the shadows and warm toward the light, with a bright shine band.
 */
const JENNA: HeadDef7 = {
  skin: GIRL_SKIN,
  hair: R6('#221820', '#46303a', '#6a4e52', '#8e6e6a', '#b6927e', '#e8cca8'),
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
    // side-swept bangs: clumps of uneven length sweeping from the parting across the forehead, the
    // longest curling down past the near brow (rooted under 13, so they show under a beanie)
    { a: [2.0, 12.9, -2.0], m: [4.2, 12.0, -0.6], b: [5.3, 9.9, 0.6], r0: 1.9, rm: 1.5, r1: 0.3, dyn: 0.12, band: 0.3 },
    { a: [2.4, 12.8, -0.6], m: [4.6, 11.5, 1.0], b: [5.2, 9.1, 2.2], r0: 1.8, rm: 1.4, r1: 0.3, dyn: 0.12, band: 0.3 },
    { a: [2.4, 12.6, 0.8], m: [4.4, 11.0, 2.5], b: [4.7, 8.5, 3.5], r0: 1.7, rm: 1.3, r1: 0.3, dyn: 0.15, band: 0.3 },
    { a: [2.0, 12.4, 2.4], m: [3.4, 10.6, 3.8], b: [3.5, 8.0, 4.5], r0: 1.5, rm: 1.2, r1: 0.3, dyn: 0.15, band: 0.26 },
    { a: [2.6, 12.6, -1.4], b: [5.4, 10.5, -1.9], r0: 1.3, r1: 0.3, dyn: 0.1, band: 0.25 },
    { a: [2.2, 12.8, -3.0], m: [3.9, 11.6, -3.4], b: [4.6, 10.0, -3.8], r0: 1.5, rm: 1.2, r1: 0.35, dyn: 0.12, band: 0.3 },
    // cheek-length locks framing the face, tips curling in toward the chin, a finer strand in front
    { a: [1.6, 10.6, 4.4], m: [2.2, 6.8, 5.0], b: [3.0, 3.8, 4.4], r0: 1.6, rm: 1.3, r1: 0.3, dyn: 0.3, band: 0.22 },
    { a: [1.6, 10.6, -4.4], m: [2.2, 7.0, -5.0], b: [3.0, 4.4, -4.4], r0: 1.5, rm: 1.2, r1: 0.3, dyn: 0.3, band: 0.22 },
    { a: [2.4, 10.4, 3.9], b: [3.4, 5.4, 4.5], r0: 1.0, r1: 0.25, dyn: 0.25 },
    { a: [2.4, 10.4, -3.9], b: [3.2, 6.0, -4.5], r0: 0.9, r1: 0.25, dyn: 0.25 },
    // the back gathered down toward the ties, covering the head down to the nape
    { a: [-4.0, 9.6, 1.8], b: [-3.0, 4.8, 3.4], r0: 2.2, r1: 1.3 },
    { a: [-4.0, 9.6, -1.8], b: [-3.0, 4.8, -3.4], r0: 2.2, r1: 1.3 },
    { a: [-4.6, 9.2, 0], b: [-3.4, 3.8, 0], r0: 2.2, r1: 1.4 },
    // the twin tails
    ...jennaTail(1), ...jennaTail(-1),
    // a little ahoge springing up off the crown and hooking over
    { a: [0.2, 14.3, -0.2], m: [0.5, 16.9, 0.6], b: [0.6, 16.5, 2.5], r0: 0.55, rm: 0.5, r1: 0.2, dyn: 0.7 },
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
    // wavy strands of beard falling in clumps (at the sprite's pixel density)
    const bm = (h: Hit) => { const curl = Math.sin(h.x * 0.75 + Math.sin(h.y * 0.5) * 1.6) > 0.7; return curl ? (h.l > 0.3 ? beard[3] : beard[2]) : cel(beard, h.l, 0.1, true); };
    s.ellipsoid(W([2.4, 3.2, 0]), W([4.2, 0, 0]), [0, 4.2, 0], W([0, 0, 5.0]), 10, bm);
    s.ellipsoid(W([2.6, -0.8, 0]), W([4.4, 0, 0]), [0, 4.0, 0], W([0, 0, 4.4]), 10, bm);
    s.ellipsoid(W([3.4, -4.2, 0]), W([3.2, 0, 0]), [0, 2.8, 0], W([0, 0, 3.2]), 10, bm);
    // (the cartoon cast: one beard group, so no ink line cuts the moustache off the beard)
    s.ellipsoid(W([5.6, 4.8, 0]), W([1.6, 0, 0]), [0, 1.0, 0], W([0, 0, 3.0]), TOON7 ? 10 : 11, h => cel(beard, h.l, 0.25, true));
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
/**
 * Joshu's eyes are always narrowed: a short dark slit sunk under a heavy brow ridge (a shadow row)
 * with bushy pale brows pressing down on it. Anger slants the slit and drives the inner brow down onto
 * it, sorrow lifts the inner brow and droops the outer corner, surprise raises the brows and opens
 * the slit a pixel, a grin squeezes it into a crinkled arc, sleep is a soft lid line.
 * `inner` is the screen direction toward the nose.
 */
function slitEye(mark: FaceMark, x: number, y: number, inner: 1 | -1, eye: HeadExpr7['eye'], ex: HeadExpr7, d: HeadDef7, eyeC: C, browC: C) {
  const o = -inner;
  const lid = mix(d.skin[1], eyeC, 0.35), browS = mix(browC, d.skin[1], 0.4), crease = mix(d.skin[2], d.skin[1], 0.6);
  const t = ex.browTilt;
  if (eye === 'wide') {
    // brows up, the eye opened to a taller dot: about as wide-eyed as he gets
    mark(x + inner, y - 3, browC); mark(x, y - 3, browC); mark(x + o, y - 2, browS);
    mark(x, y, eyeC); mark(x, y - 1, eyeC);
    return;
  }
  if (eye === 'happy') {
    // squeezed into a grin: an arc under the brow, crow's feet at the outer corner
    mark(x + inner, y - 2, browC); mark(x, y - 2, browC); mark(x + o, y - 2, browS);
    mark(x, y - 1, eyeC); mark(x + inner, y, eyeC); mark(x + o, y, eyeC); mark(x + o * 2, y + 1, crease);
    return;
  }
  // the heavy brow sits right on the eye: angry slants it down to the nose, sad lifts its inner end
  if (t < 0) { mark(x + inner, y, browC); mark(x, y - 1, browC); mark(x + o, y - 2, browS); }
  else if (t > 0) { mark(x + inner, y - 2, browC); mark(x, y - 1, browC); mark(x + o, y - 1, browS); }
  else { mark(x + inner, y - 1, browC); mark(x, y - 1, browC); mark(x + o, y - 1, browS); }
  if (eye === 'closed') { mark(x, y, lid); mark(x + o, y, lid); return; }
  if (eye === 'sad') { mark(x, y, eyeC); mark(x + o, y + 1, lid); return; }
  // the narrowed glare (neutral, half, angry): a two-pixel slit, its outer corner creased
  mark(x, y, eyeC); mark(x + o, y, eyeC);
  if (eye === 'angry') mark(x + o * 2, y - 1, crease);
}

/**
 * Head sizes (fractions of the head volumes). The cartoon cast wears larger heads (about five heads
 * tall, never chibi) so the face reads at the world's pixel size; the painted anime cast was about six
 * and a half (0.8 / 0.75 / 0.78).
 */
export const HEAD_SCALE7 = TOON7 ? 1.0 : 0.8;
/** grown men's heads (a touch smaller on the broader build) and women's */
export const HEAD_SCALE_MAN7 = TOON7 ? 0.95 : 0.75, HEAD_SCALE_WOMAN7 = TOON7 ? 0.98 : 0.78;
/** which sprite face: 'mid' (facemid.ts, the V12 face at 1.5x), 'simple' (the old dot face, kept);
 *  the cartoon cast at the world's pixel size wears the cartoon face (facetoon.ts) */
const FACE_STYLE7: 'mid' | 'simple' = 'mid';

/**
 * Whether a head (as worn: hoods hide locks) has locks that swing with the hair physics. The Actor
 * runs its 2D hair spring only for these, so every other head keeps its single sway and its cache.
 */
export function hairDyn7(id: string, wear?: HeadWear7): boolean {
  const d = HEADS7[id];
  return !!d && d.locks.some((l, i) => (l.dyn ?? 0) > 0 && !wear?.hideLock?.(l, i));
}

/**
 * A lock's centre line (root, bend, tip) under the hair physics. `F` is the pull in head space (the
 * screen-space swing and lift turned into the head's frame). Each half of the lock turns about its
 * start toward the pull (the tip half twice as far, so the lock curves the way real hair lags), the
 * tip half stretches a touch when the hair slams down, and the bend and the tip are kept out of the
 * skull (never deeper in than they rest) and on their own side of the head (twin tails don't swing
 * across the throat).
 */
function bendLock(l: Lock, F: V3, lift: number, d: HeadDef7): [V3, V3, V3] {
  const m0 = l.m ?? vlerp(l.a, l.b, 0.5);
  const w = l.dyn ?? 0;
  if (w <= 0 || (!F[0] && !F[1] && !F[2])) return [l.a, m0, l.b];
  // a lift splays a lock out from the middle of the head, a slam pulls it in a little
  const side = Math.sign(l.b[2]) * Math.min(1, Math.abs(l.b[2]) / 3);
  const Fl: V3 = [F[0], F[1], F[2] + side * lift * (lift > 0 ? 0.5 : 0.25)];
  const turn = (dir: V3, k: number): V3 => {
    let v = vadd(dir, vsc(Fl, w * k));
    if (vlen(v) < 0.35) v = vadd(v, vsc(dir, 0.35));
    return vnorm(v);
  };
  const [sc, sr] = d.skull;
  const R: V3 = [sr[0] + 0.7, sr[1] + 0.7, sr[2] + 0.7];
  const depth = (p: V3) => Math.hypot((p[0] - sc[0]) / R[0], (p[1] - sc[1]) / R[1], (p[2] - sc[2]) / R[2]);
  const keep = (p: V3, rest: V3): V3 => {
    let q = p;
    const r0 = Math.min(1, depth(rest)), r1 = depth(q);
    if (r1 < r0 && r1 > 1e-3) { const f = r0 / r1; q = [sc[0] + (q[0] - sc[0]) * f, sc[1] + (q[1] - sc[1]) * f, sc[2] + (q[2] - sc[2]) * f]; }
    const zmin = Math.abs(l.a[2]) > 2 ? 0.75 * Math.min(Math.abs(l.a[2]), Math.abs(rest[2])) : 0;
    if (zmin && Math.sign(q[2]) * Math.sign(l.a[2]) * Math.abs(q[2]) < zmin) q = [q[0], q[1], Math.sign(l.a[2]) * zmin];
    return q;
  };
  const L1 = vlen(vsub(m0, l.a)), L2 = vlen(vsub(l.b, m0)) * (1 + Math.max(0, -lift) * 0.08 * w);
  const m = keep(vadd(l.a, vsc(turn(vnorm(vsub(m0, l.a)), 0.5), L1)), m0);
  const b = keep(vadd(m, vsc(turn(vnorm(vsub(l.b, m0)), 1), L2)), l.b);
  return [l.a, m, b];
}

/**
 * A head, optionally dressed in outfit head wear (`wk` names it for the cache), at `hs` of its
 * volumes' size. The buffer is at the rig's pixel density (PX7 px per world px; `k` says so).
 */
export function renderHead7(id: string, o: HeadOpts7, wear?: HeadWear7, wk = '', hs = HEAD_SCALE7): { buf: PixelBuffer; ax: number; ay: number; k: number } {
  const key = `${id}|${wk}|${o.expr}|${o.mouth}|${o.blink ? 1 : 0}|${o.look}|${o.hair ?? 0}|${o.hairY ?? 0}|${hs}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const d = HEADS7[id] ?? MORI;
  const ex = EXPR[o.expr] ?? EXPR.neutral;
  // buffer px per head unit (at the character's own density)
  const D = dens7(id), k = D * hs;
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
  // face volumes: a man's jaw and chin a little broader and squarer (user: "men more manly")
  const fem = isFem7(id, d);
  E(d.skull[0], d.skull[1], 1, skinM());
  // (children, drawn at a larger head scale, keep the soft round face)
  if (fem || hs > 0.85) {
    E(d.jaw[0], d.jaw[1], 1, skinM(0.05));
    E(d.chin[0], d.chin[1], 1, skinM(0.1));
  } else {
    // a man's lower face (anime-realistic): a slimmer jaw mass, the two sides of the jawbone running
    // from a defined angle under the ear forward and down to a firm chin, and a cheekbone over each
    // cheek, so the jaw reads from the silhouette and the cel shadow under it, never a painted line
    const [jc, jr] = d.jaw, [cc, cr] = d.chin;
    E([jc[0] + 0.3, jc[1] + 0.4, 0], [jr[0] * 0.92, jr[1] * 0.85, jr[2] * 0.85], 1, skinM(0.05));
    for (const z of [-1, 1]) {
      const gon: V3 = [jc[0] - jr[0] * 0.45, jc[1] - jr[1] * 0.3, z * jr[2] * 0.8];
      const tip: V3 = [cc[0] - 0.05, cc[1] - cr[1] * 0.25, z * cr[2] * 0.5];
      s.limb(W(gon), W(tip), jr[1] * 0.33, cr[1] * 0.7, 1, skinM(0.05));
    }
    E([cc[0] + 0.15, cc[1] - 0.1, 0], [cr[0] * 1.0, cr[1] * 1.05, cr[2] * 0.85], 1, skinM(0.1));
    const ey = d.eye;
    for (const z of [-1, 1]) E([ey[0] - 1.1, ey[1] - 1.15, z * (ey[2] + 0.75)], [1.3, 0.8, 1.0], 1, skinM(0.28));
  }
  E(d.nose[0], d.nose[1], 1, skinM(0.2));
  // the ear: rim lit, the bowl inside it in shadow
  // (in the face group: no ink seam between the ear and the cheek, only its outline against the hair)
  E(d.ear[0], d.ear[1], 1, h => {
    const q = h.q;
    if (Math.abs(q[2]) > 0.8 && q[0] > -0.45 && q[0] < 0.25 && q[1] > -0.4 && q[1] < 0.3) return mix(d.skin[2], d.skin[3], 0.25);
    return cel(d.skin, h.l, 0.13);
  });
  // hair in strand clusters: dark grooves between the clumps, a broken two-tone angel ring across the
  // crown and a fainter second band, lit tips on the locks (the rim light comes in the finish pass)
  const HR = d.hair;
  // (cartoon hair keeps its light to the crown's shine band and the top edges, so it reads as its own colour)
  const HAIR_B = TOON7 ? -0.22 : 0.05;
  // the angel ring: one band at a fixed height round the head, across the shell and every lock alike,
  // its lower edge cut into teeth along the strands; a thinner second band lower on the bangs
  const ringY = d.skull[0][1] + d.skull[1][1] * 0.52;
  const ring = (h: Hit, groove: boolean, strand: number): C | 0 => {
    if (groove || h.l < 0.18) return 0;
    const y = h.p[1], saw = frac(strand);
    // the cartoon shine: one flat light band with a toothed lower edge
    if (TOON7) return y < ringY + 0.8 && y > ringY - 0.5 - saw * 0.9 ? HR[4] : 0;
    if (y < ringY + 0.75 && y > ringY - 0.35 - saw * 0.9) return h.l > 0.55 && y > ringY - 0.1 && y < ringY + 0.45 ? HR[5] : HR[4];
    return 0;
  };
  const shellM = (h: Hit): C | -1 => {
    if (d.cut(h.q)) return -1;
    const q = h.q, lat = q[1];
    // strands fan out from the whorl at the back of the crown
    const ang = Math.atan2(q[2], q[0] + 0.45);
    const groove = !TOON7 && lat < 0.92 && Math.sin(ang * 8 + lat * 2.4) > 0.8;
    const rg = ring(h, groove, ang * 2.6);
    if (rg) return rg;
    const c = cel(HR, h.l, HAIR_B);
    return groove ? mix(c, HR[1], 0.55) : c;
  };
  const lockM = (i: number) => (h: Hit): C => {
    const t = h.t;
    const groove = !TOON7 && Math.sin(h.q[1] * 2.6 + i * 1.9) > 0.8;
    const rg = ring(h, groove, h.q[1] * 0.8 + i * 0.37);
    if (rg) return rg;
    const c = cel(HR, h.l, HAIR_B);
    if (TOON7) return c;
    if (groove) return mix(c, HR[1], 0.6);
    if (t > 0.84 && h.l > -0.1) return mix(c, HR[4], 0.35); // fine tips catch the light
    return c;
  };
  if (!wear?.hideShell) s.ellipsoid(W(d.shell[0]), Wv([d.shell[1][0], 0, 0]), Wv([0, d.shell[1][1], 0]), Wv([0, 0, d.shell[1][2]]), 3, shellM);
  const sway = o.hair ?? 0, lift = o.hairY ?? 0;
  // world → head space for directions (undo the yaw, then the pitch)
  const Winv = (v: V3): V3 => {
    const x = v[0] * ca + v[2] * sa, z = -v[0] * sa + v[2] * ca, y = v[1];
    return [x * cp + y * sp, -x * sp + y * cp, z];
  };
  // the hair physics' pull in head space: the swing trails the hair behind her ON SCREEN (the buffer's
  // -x, whichever way the head is turned), the lift raises it
  const pull: V3 = sway || lift ? Winv([-sway * 0.5, lift * 0.65, 0]) : [0, 0, 0];
  /** a physics lock's material: the strand grooves (finer on fat clumps) and its shine band, `t` along the whole lock */
  const dynM = (l: Lock, i: number, ta: number, tb: number) => {
    const base = lockM(i), gk = 2.6 * Math.max(1, (l.rm ?? l.r0) / 1.4);
    return (h: Hit): C => {
      h.t = ta + h.t * (tb - ta);
      const groove = !TOON7 && Math.sin(h.q[1] * gk + i * 1.9) > 0.78;
      if (groove) return mix(cel(HR, h.l, 0.05), HR[1], 0.6);
      if (l.band !== undefined && h.l > 0.12) {
        const dt = h.t - l.band, saw = frac(h.q[1] * 0.9 + i * 0.37) * 0.06;
        if (dt > -0.05 - saw && dt < 0.045) return !TOON7 && h.l > 0.5 && dt > -0.02 && dt < 0.025 ? HR[5] : HR[4];
      }
      return base(h);
    };
  };
  /** a ribbon bow tied round a lock's root, facing the viewer: two loops (a dark eye in each), the knot, two short ends */
  const bow = (p: V3, side: number, R: Ramp6) => {
    const u = vnorm(Winv([1, 0, 0])), view = vnorm(Winv([0, 0, 1]));
    // the near bow sits on the viewer's side of its tail; the far one stays round the back of the head
    // (it only peeks out past the silhouette, never through the cheek)
    const near = W([0, 0, side])[2] > -0.1;
    const kn = vadd(vadd(p, [near ? 0 : -0.4, 0, side * (near ? 0.6 : 0.8)]), vsc(view, near ? 0.8 : 0));
    const loopM = (h: Hit): C => (h.n[2] > 0.84 ? R[1] : cel(R, h.l, 0.12, true));
    for (const g of [-1, 1]) {
      const ax = vnorm(vadd(vsc(u, g), [0, 0.4, 0]));
      const c = vadd(kn, vsc(ax, 1.25));
      s.ellipsoid(W(c), W(vsc(ax, 1.2)), W([0, 0.85, 0]), W(vsc(view, 0.6)), 6, loopM);
      s.limb(W(vadd(kn, vsc(u, g * 0.3))), W(vadd(vadd(kn, vsc(u, g * 0.9)), [0, -1.7, 0])), 0.45, 0.3, 6, h => cel(R, h.l, 0));
    }
    s.ellipsoid(W(kn), W([0.65, 0, 0]), W([0, 0.65, 0]), W([0, 0, 0.65]), 6, h => cel(R, h.l, 0.3, true));
  };
  /** a lock that bends (and swings with the physics): two tapered halves through its bend point */
  const dynLock = (l: Lock, i: number) => {
    let [a, m, b] = bendLock(l, pull, lift, d);
    let r0 = l.r0, rm = l.rm ?? (l.r0 + l.r1) / 2, ta = 0, tm = 0.5;
    const tk = wear?.tuck;
    if (tk !== undefined && a[1] > tk) {
      // tucked under a brim: the lock starts where it comes out from under it
      if (m[1] < tk) {
        const u = (a[1] - tk) / (a[1] - m[1]);
        a = vlerp(a, m, u); r0 += (rm - r0) * u; ta = u * 0.5;
      } else if (b[1] < tk) {
        const u = (m[1] - tk) / (m[1] - b[1]);
        a = vlerp(m, b, u); r0 = rm + (l.r1 - rm) * u; ta = 0.5 + u * 0.5;
        m = vlerp(a, b, 0.5); rm = (r0 + l.r1) / 2; tm = (ta + 1) / 2;
      } else return;
    }
    s.limb(W(a), W(m), r0, rm, 3, dynM(l, i, ta, tm));
    s.limb(W(m), W(b), rm, l.r1, 3, dynM(l, i, tm, 1));
    if (l.tie && ta === 0) bow(a, Math.sign(a[2]) || 1, l.tie);
  };
  d.locks.forEach((l, i) => {
    if (wear?.hideLock?.(l, i)) return;
    if (l.m || l.dyn || l.tie || l.band !== undefined) { dynLock(l, i); return; }
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
  if (!back && FACE_STYLE7 === 'mid') {
    // the V12 face (facemid.ts): clean clusters on the buffer grid
    const dirX = W([1, 0, 0])[0];
    const nt: V3 = [d.nose[0][0] + d.nose[1][0] * 0.85, d.nose[0][1] - d.nose[1][1] * 0.1, d.nose[0][2]];
    (TOON7 ? paintFaceToon7 : paintFaceMid7)(put, {
      near: visible(nearE) ? at2(nearE) : null,
      far: visible(farE) ? at2(farE) : null,
      nose: at2(nt),
      mouth: at2(d.mouth),
      dir: dirX >= 0 ? 1 : -1,
      eye, mouthShape: mouth, ex, d, fem,
    });
  }
  if (!back && FACE_STYLE7 === 'mid' && ex.sweat) {
    const [sx, sy] = px([0, 11, d.skull[1][2] * 0.9]);
    const drop = ['.w', 'wb', 'bb', '.b'], dc: Record<string, C> = { w: hex('#e8f8ff'), b: hex('#5ab0ec') };
    drop.forEach((row, j) => { for (let i = 0; i < 2; i++) if (row[i] !== '.') { const X = Math.floor(sx) + i, Y = Math.floor(sy) - 2 + j; if (X >= 0 && Y >= 0 && X < BW && Y < BH && s.grp[Y * BW + X]) marks.push([X, Y, dc[row[i]]]); } });
  }
  if (!back && FACE_STYLE7 === 'simple') {
    // the old simple face (user: "the old simple face before"): dot eyes, two-pixel brows, a
    // small mouth, each face pixel a PX7 x PX7 block so it reads at the body's world-pixel size.
    // (paintFace7, the anime face, is kept unused in face7.ts.)
    const B = Math.max(1, Math.round(D));
    const blk = (cx: number, cy: number): FaceMark => (dx, dy, c) => {
      const X = Math.round(cx) + Math.round(dx) * B, Y = Math.round(cy) + Math.round(dy) * B;
      for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) put(X + i, Y + j, c);
    };
    const eyeC = hex(d.eyeCol), browC = hex(d.brow);
    for (const e of [nearE, farE]) {
      if (!visible(e)) continue;
      const [ex0, ey0] = at2(e);
      const m = blk(ex0, ey0);
      const inner = (e[2] > 0 ? 1 : -1) as 1 | -1;
      if (d.eyeStyle === 'slit') { slitEye(m, 0, 0, inner, eye, ex, d, eyeC, browC); continue; }
      if (d.eyePaint) { d.eyePaint(m, 0, 0, inner, e[2] < 0, eye, ex, d); continue; }
      if (eye === 'dot' || eye === 'angry' || eye === 'sad' || eye === 'half') m(0, 0, eyeC);
      else if (eye === 'wide') { m(0, 0, eyeC); m(0, -1, eyeC); }
      else if (eye === 'closed') { m(0, 0, eyeC); m(-1, 0, eyeC); }
      else if (eye === 'happy') { m(0, -1, eyeC); m(-1, 0, eyeC); m(1, 0, eyeC); }
      else m(0, 0, eyeC);
      // brows: two pixels, raised / tilted by the expression
      if (!d.browHidden || ex.brow > 1) {
        const by = -2 - (ex.brow > 1 ? 1 : 0), t = ex.browTilt;
        m(-1, by + (t < 0 ? 0 : t > 0 ? 1 : 0), browC);
        m(0, by + (t < 0 ? 1 : 0), browC);
      }
      if (ex.blush) m(0, 2, mix(hex(d.blush), d.skin[3], 0.2));
    }
    {
      const [mx0, my0] = at2(d.mouth);
      const m = blk(mx0, my0);
      const lip = mix(d.skin[1], hex('#6a2020'), 0.4), dark = hex('#4a1418');
      if (d.mouthPaint) d.mouthPaint(m, 0, 0, mouth, ex, d);
      else if (mouth === 'smile') { m(0, 0, lip); m(-1, -1, lip); }
      else if (mouth === 'frown') { m(0, 0, lip); m(-1, 1, lip); }
      else if (mouth === 'open' || mouth === 'o') m(0, 0, dark);
      else if (mouth === 'grit') { m(0, 0, dark); m(-1, 0, dark); }
      else if (mouth === 'shout') { m(0, 0, dark); m(0, 1, dark); m(-1, 0, dark); }
    }
    if (ex.sweat) {
      const [sx, sy] = px([0, 11, d.skull[1][2] * 0.9]);
      const drop = ['.w', 'wb', 'bb', '.b'], dc: Record<string, C> = { w: hex('#e8f8ff'), b: hex('#5ab0ec') };
      drop.forEach((row, j) => { for (let i = 0; i < 2; i++) if (row[i] !== '.') { const X = Math.floor(sx) + i, Y = Math.floor(sy) - 2 + j; if (X >= 0 && Y >= 0 && X < BW && Y < BH && s.grp[Y * BW + X]) marks.push([X, Y, dc[row[i]]]); } });
    }
  }
  // the hair's edge over the face is inked in the hair's own dark, not the skin's red-brown (no streak down the cheek)
  const r = s.finish({ ink: mix(d.ink, d.hair[0], 0.6), depthLine: 1.6, rim: 0.55, inkK: { 1: 0.8, 3: 0.6, 6: 0.75 } });
  for (const [x, y, c] of marks) r.back.data[y * BW + x] = c;
  popBuf(r.back);
  const tr = trimPair(r.back, null, 1);
  const out = { buf: tr.a, ax: BOX - tr.ox, ay: BOY - tr.oy, k: D };
  if (cache.size > 600) cache.clear();
  cache.set(key, out);
  return out;
}

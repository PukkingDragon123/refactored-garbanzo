// V7 heads: small 3D heads (skull, a narrow jaw with a pointed chin, nose, ears) under anime hair
// built from a shell and tapered spiky locks, turned toward the camera like the bodies. Faces are
// sprite-simple on purpose: single-pixel dot eyes, short brows, a one or two pixel mouth, blush,
// so the expression reads at game scale (the detailed faces live in the dialogue close-ups).
// Head space: origin at the neck top, x forward (the face), y up, z lateral (+ toward the viewer).

import { PixelBuffer } from '../pixel';
import { C, hex, mix } from '../color';
import { Scene3D, V3, Hit, cel, Ramp6, vadd } from './raster';
import { YAW, BACK_YAW } from './body';
import { trimPair } from '../people-rig';

const R6 = (...h: string[]): Ramp6 => h.map(v => hex(v));
export type Look = 'fwd' | 'up' | 'down' | 'back';
export interface HeadOpts7 { expr: string; mouth: 0 | 1 | 2; blink: boolean; look: Look; hair?: number }

interface Lock { a: V3; b: V3; r0: number; r1: number; sway?: number }
interface HeadDef7 {
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
}

// ------------------------------------------------------------------ expressions

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

// ------------------------------------------------------------------ cast heads

const BOY_SKIN = R6('#3a1810', '#9a4a36', '#c8805e', '#f0a878', '#f8c090', '#ffe0b8');
const GIRL_SKIN = R6('#3a1c1c', '#b86a60', '#d8907e', '#f6b8a4', '#fad0bc', '#ffe8dc');
const DARK_SKIN = R6('#2a1610', '#5e3624', '#80502e', '#a06a46', '#bc855e', '#d49c74');
const JOSHU_SKIN = R6('#3a1810', '#a04a3a', '#d08064', '#f2aa86', '#f8c49c', '#ffe0c4');

const MORI: HeadDef7 = {
  skin: BOY_SKIN,
  hair: R6('#0a0608', '#1a1216', '#2a2024', '#3c3034', '#564a4e', '#7a6c70'),
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

const AROHA: HeadDef7 = {
  skin: DARK_SKIN,
  hair: R6('#060304', '#140c0a', '#221410', '#321e18', '#4a2e24', '#6a4434'),
  ink: hex('#140a08'),
  skull: [[0.1, 7.9, 0], [4.7, 5.3, 4.2]],
  jaw: [[1.5, 4.4, 0], [3.3, 3.0, 2.9]],
  chin: [[3.5, 2.5, 0], [1.3, 1.2, 1.3]],
  nose: [[4.8, 5.8, 0], [0.8, 0.8, 0.6]],
  ear: [[-0.4, 6.2, 4.2], [0.9, 1.3, 0.6]],
  eye: [4.0, 6.9, 2.3],
  mouth: [4.3, 4.0, 0.3],
  eyeCol: '#140a08', brow: '#140c0a', blush: '#d87060',
  shell: [[-0.5, 8.9, 0], [5.4, 5.9, 5.0]],
  cut: q => q[0] > 0.34 && q[1] < 0.42,
  locks: [
    // centre-parted hair swept back from the face, falling long down the back
    { a: [3, 12.4, 1.6], b: [3.6, 9.6, 4.6], r0: 1.6, r1: 0.6 }, { a: [3, 12.4, -1.6], b: [3.6, 9.6, -4.6], r0: 1.6, r1: 0.6 },
    { a: [0.2, 10, 4.5], b: [-1.2, 0, 4.8], r0: 1.9, r1: 1.0, sway: 0.6 }, { a: [0.2, 10, -4.5], b: [-1.2, 0, -4.8], r0: 1.9, r1: 1.0, sway: 0.6 },
    { a: [-3, 10, 2.6], b: [-5.6, -3, 3], r0: 2.4, r1: 1.2, sway: 1 }, { a: [-3, 10, -2.6], b: [-5.6, -3, -3], r0: 2.4, r1: 1.2, sway: 1 },
    { a: [-4, 10, 0], b: [-6.8, -4, 0], r0: 2.4, r1: 1.2, sway: 1 },
  ],
  extras(s, W) {
    // woven red headband with a dark pattern
    const band = R6('#2a0806', '#5a1410', '#8a2218', '#a8342c', '#c84a3a', '#e06a50');
    for (let i = 0; i <= 16; i++) {
      const a = -Math.PI + (i / 16) * Math.PI * 2;
      const p: V3 = [0.2 + Math.cos(a) * 5.35, 11.2 - Math.cos(a) * 0.5, Math.sin(a) * 5.05];
      s.ellipsoid(W(p), W([0.9, 0, 0]) as V3, [0, 0.8, 0], W([0, 0, 0.9]) as V3, 9, h => ((i % 3) === 0 ? band[1] : cel(band, h.l, 0.05)));
    }
  },
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

const HEADS7: Record<string, HeadDef7> = { mori: MORI, jenna: JENNA, aroha: AROHA, joshu: JOSHU };

/**
 * Joshu's eyes are always narrowed: a short dark slit sunk under a heavy brow ridge (a shadow row)
 * with bushy pale brows pressing down on it. Anger slants the slit and drives the inner brow down onto
 * it, sorrow lifts the inner brow and droops the outer corner, surprise raises the brows and opens
 * the slit a pixel, a grin squeezes it into a crinkled arc, sleep is a soft lid line.
 * `inner` is the screen direction toward the nose.
 */
function slitEye(mark: (x: number, y: number, c: C) => void, x: number, y: number, inner: 1 | -1, eye: Ex['eye'], ex: Ex, d: HeadDef7, eyeC: C, browC: C) {
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

// ------------------------------------------------------------------ render

const cache = new Map<string, { buf: PixelBuffer; ax: number; ay: number }>();
const HW = 48, HH = 56, HOX = 24, HOY = 40;

export function renderHead7(id: string, o: HeadOpts7): { buf: PixelBuffer; ax: number; ay: number } {
  const key = `${id}|${o.expr}|${o.mouth}|${o.blink ? 1 : 0}|${o.look}|${o.hair ?? 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const d = HEADS7[id] ?? MORI;
  const ex = EXPR[o.expr] ?? EXPR.neutral;
  const s = new Scene3D(HW, HH, HOX, HOY);
  // the head turns a little further toward the camera than the body, so both eyes read
  const back = o.look === 'back';
  const HY = back ? BACK_YAW - 0.1 : YAW + 0.25, ca = Math.cos(HY), sa = Math.sin(HY);
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
  // hair: shell with the face cut out, then the locks (tips trail back with `hair`)
  const hairM = (h: Hit) => {
    const band = h.n[1] > 0.35 && h.n[1] < 0.7 && h.l > 0.45;
    return band ? d.hair[4] : cel(d.hair, h.l, 0.05);
  };
  s.ellipsoid(W(d.shell[0]), Wv([d.shell[1][0], 0, 0]), Wv([0, d.shell[1][1], 0]), Wv([0, 0, d.shell[1][2]]), 3, h => (d.cut(h.q) ? -1 : hairM(h)));
  const sway = o.hair ?? 0;
  for (const l of d.locks) {
    const tip: V3 = vadd(l.b, [-(l.sway ?? 0) * sway * 1.2, (l.sway ?? 0) * sway * 0.3, 0]);
    s.limb(W(l.a), W(tip), l.r0, l.r1, 3, hairM);
  }
  d.extras?.(s, W, o);
  // face details (dot eyes, brows, mouth, blush) projected onto the surface
  const px = (p: V3): [number, number, number] => { const w = W(p); return [HOX + w[0], HOY - w[1], w[2]]; };
  const marks: [number, number, C][] = [];
  const mark = (x: number, y: number, c: C) => { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < HW && y < HH && s.grp[y * HW + x]) marks.push([x, y, c]); };
  const eyeC = hex(d.eyeCol), browC = hex(d.brow);
  const eyes = [[d.eye[0], d.eye[1], d.eye[2]], [d.eye[0], d.eye[1], -d.eye[2]]] as V3[];
  const eye = o.blink && ex.eye !== 'happy' ? 'closed' : ex.eye;
  const visible = (p: V3) => { const [x, y, z] = px(p); const i = Math.floor(y) * HW + Math.floor(x); return x >= 0 && y >= 0 && x < HW && y < HH && s.grp[i] === 1 && s.z[i] <= z + 2.2; };
  for (const e of eyes) {
    if (!visible(e)) continue;
    const [x, y] = px(e);
    if (d.eyeStyle === 'slit') { slitEye(mark, x, y, e[2] > 0 ? 1 : -1, eye, ex, d, eyeC, browC); continue; }
    if (eye === 'dot' || eye === 'angry' || eye === 'sad' || eye === 'half') mark(x, y, eyeC);
    else if (eye === 'wide') { mark(x, y, eyeC); mark(x, y - 1, eyeC); }
    else if (eye === 'closed') { mark(x, y, eyeC); mark(x - 1, y, eyeC); }
    else if (eye === 'happy') { mark(x, y - 1, eyeC); mark(x - 1, y, eyeC); mark(x + 1, y, eyeC); }
    // brows: two pixels, raised / tilted by the expression (inner end toward the nose)
    if (!d.browHidden || ex.brow > 1) {
      const by = y - 2 - (ex.brow > 1 ? 1 : 0);
      const inner = e[2] > 0 ? 1 : -1; // toward the face centre on screen
      void inner;
      const t = ex.browTilt;
      mark(x - 1, by + (t < 0 ? 0 : t > 0 ? 1 : 0), browC);
      mark(x, by + (t < 0 ? 1 : 0), browC);
    }
    if (ex.blush) mark(x, y + 2, mix(hex(d.blush), d.skin[3], 0.2));
  }
  // mouth
  const [mx, my] = px(d.mouth);
  const lip = mix(d.skin[1], hex('#6a2020'), 0.4), dark = hex('#4a1418');
  const mouth = o.mouth === 2 ? 'shout' : o.mouth === 1 ? (ex.mouth === 'none' || ex.mouth === 'smile' || ex.mouth === 'frown' ? 'open' : ex.mouth) : ex.mouth;
  if (mouth === 'smile') { mark(mx, my, lip); mark(mx - 1, my - 1, lip); }
  else if (mouth === 'frown') { mark(mx, my, lip); mark(mx - 1, my + 1, lip); }
  else if (mouth === 'open' || mouth === 'o') mark(mx, my, dark);
  else if (mouth === 'grit') { mark(mx, my, dark); mark(mx - 1, my, dark); }
  else if (mouth === 'shout') { mark(mx, my, dark); mark(mx, my + 1, dark); mark(mx - 1, my, dark); }
  if (ex.sweat) { const [sx, sy] = px([0, 11, d.skull[1][2] * 0.9]); mark(sx, sy, hex('#9ad8ff')); mark(sx, sy + 1, hex('#4a9ad8')); }
  const r = s.finish({ ink: d.ink, depthLine: 1.6 });
  if (!back) for (const [x, y, c] of marks) r.back.data[y * HW + x] = c;
  const tr = trimPair(r.back, null, 1);
  const out = { buf: tr.a, ax: HOX - tr.ox, ay: HOY - tr.oy };
  if (cache.size > 600) cache.clear();
  cache.set(key, out);
  return out;
}

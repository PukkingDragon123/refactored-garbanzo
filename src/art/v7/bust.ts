// V7 HUD bust: the player's head and shoulders for the status medallion, rendered from the same 3D rig
// as the in-game sprite (head.ts HEADS7 volumes and expressions, cast.ts outfit materials and build), so
// it always matches the walking Mori and follows any change to his design, but at k times the
// resolution (about 2.3x) with the face drawn properly for that size:
//   - eyes with a lash line, a dark iris, a lit lower iris and a catch-light, per expression (open,
//     half-lidded, blinking, happy arcs, wide and small-pupilled when scared, sad, angry)
//   - brows that lift and tilt, a nose with a shadowed tip and a lit bridge, a mouth with lips, teeth
//     and a tongue when it opens, blush hatching, a sweat drop
//   - hair in clusters: the shell and every lock with strand grooves and a broken shine band, the
//     lock tips pushed by the wind (o.wind) so it stirs
//   - the shoulders in his outfit (the rig's own torso material: the field tunic, the cross strap,
//     the V of the collar), a folded collar, and the camera's leather strap round his neck
// The head is turned a little to the viewer's right, the body a little more (a portrait pose).
// Painted on the pixel grid: cel tones, inked edges from the rasteriser, single pixels for the face.

import { PixelBuffer } from '../pixel';
import { C, hex, mix } from '../color';
import { Scene3D, V3, Hit, cel, Ramp6, vadd } from './raster';
import { HEADS7, headExpr7 } from './head';
import type { HeadExpr7 } from './head';
import { CAST7 } from './cast';

export interface BustOpts {
  expr: string;
  blink: boolean;
  /** 0 shut, 1 open (talking, a yawn, a growl), 2 wide */
  mouth?: 0 | 1 | 2;
  /** hair stirring in the wind, -1..1 (a sideways push on the lock tips) */
  wind?: number;
}
export interface Bust {
  buf: PixelBuffer;
  /** where the neck meets the head, in the buffer */
  ox: number;
  oy: number;
  /** the temple (a sweat drop) and the stomach (growl marks), in the buffer */
  temple: [number, number];
  belly: [number, number];
}

const HEAD_YAW = Math.PI / 2 - 0.3, BODY_YAW = Math.PI / 2 - 0.62, HEAD_PITCH = -0.04;
const R6 = (...h: string[]): Ramp6 => h.map(v => hex(v));
/** the camera strap: woven oxblood webbing with cream edge stitching */
const STRAP = R6('#1a0606', '#3e0e0c', '#5e1a14', '#7e2a1e', '#a03c28', '#c4583a');
const STITCH = hex('#e8d4a8');
/** the head is drawn a touch larger than life against the shoulders (a portrait, not a body sprite) */
const HEAD_K = 1.14, HEAD_DROP = 1.3;

function rot(yaw: number, pitch = 0) {
  const ca = Math.cos(yaw), sa = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return (p: V3): V3 => {
    const x = p[0] * cp - p[1] * sp, y = p[0] * sp + p[1] * cp, z = p[2];
    return [x * ca - z * sa, y, x * sa + z * ca];
  };
}
/** world -> body space (yaw only) */
function unrot(yaw: number) {
  const ca = Math.cos(yaw), sa = Math.sin(yaw);
  return (p: V3): V3 => [p[0] * ca + p[2] * sa, p[1], -p[0] * sa + p[2] * ca];
}

// ------------------------------------------------------------------ the face, pixel by pixel
// Eye rows run from the OUTER corner (column 0) to the INNER corner (toward the nose), anchored on the
// eye's centre (ar, ac). K lash ink, I iris, B the lit lower iris, H catch-light, W the white,
// L a soft lower lid, S a shadow under the eye.
interface Tpl { rows: string[]; ar: number; ac: number }
const EYE: Record<HeadExpr7['eye'], Tpl> = {
  dot: { rows: ['KKKKK', 'KIHIW', '.IIIW', '.BBB.'], ar: 2, ac: 2 },
  half: { rows: ['.....', 'KKKKK', 'KIHIW', '.BBB.', '.SSS.'], ar: 2, ac: 2 },
  closed: { rows: ['.....', '.....', 'KK...', '.KKKK'], ar: 2, ac: 2 },
  happy: { rows: ['.....', '..KK.', '.K..K', 'K....'], ar: 2, ac: 2 },
  wide: { rows: ['.KKK.', 'KWWWK', 'KWIWK', 'KWBWK', '.LLL.'], ar: 2, ac: 2 },
  sad: { rows: ['..KKK', '.KIHW', 'KIIIW', '.BBB.'], ar: 2, ac: 2 },
  angry: { rows: ['KK...', '.KKKK', '.IHIW', '..BB.'], ar: 2, ac: 2 },
};
// mouths, centred on the mouth point: L lip line, D the dark inside, T tongue, W teeth, h a lit lower lip
type MouthK = HeadExpr7['mouth'];
const MOUTH: Record<MouthK, Tpl> = {
  none: { rows: ['LLL', '.h.'], ar: 0, ac: 1 },
  smile: { rows: ['L...L', '.LLL.', '..h..'], ar: 1, ac: 2 },
  open: { rows: ['DDD', 'DTD', '.D.'], ar: 1, ac: 1 },
  o: { rows: ['.D.', 'DTD', '.D.'], ar: 1, ac: 1 },
  frown: { rows: ['.LLL.', 'L...L'], ar: 0, ac: 2 },
  grit: { rows: ['DDDD', 'WWWW', 'DDDD'], ar: 1, ac: 1 },
  shout: { rows: ['.DDD.', 'DWWWD', 'DDDDD', 'DTTTD', '.DDD.'], ar: 2, ac: 2 },
};

const cache = new Map<string, Bust>();

/** the player's bust at k x the sprite's resolution (cached per expression, blink, mouth and wind step) */
export function renderBust7(id: string, o: BustOpts, k = 2.3): Bust {
  const wind = Math.round((o.wind ?? 0) * 3) / 3;
  const key = `${id}|${o.expr}|${o.blink ? 1 : 0}|${o.mouth ?? 0}|${wind}|${k}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const d = HEADS7[id] ?? HEADS7.mori;
  const ch = CAST7[id] ?? CAST7.mori;
  const ex = headExpr7(o.expr);
  const BW = Math.round(36 * k), BH = Math.round(36 * k);
  const OX = Math.round(BW / 2), OY = Math.round(19.5 * k);
  const s = new Scene3D(BW, BH, OX, OY);
  const RH = rot(HEAD_YAW, HEAD_PITCH), RB = rot(BODY_YAW), UB = unrot(BODY_YAW);
  const hk = k * HEAD_K;
  // head space is linear (the rig's extras take it); the body is lifted instead, which shortens the neck
  const H = (p: V3): V3 => { const w = RH(p); return [w[0] * hk, w[1] * hk, w[2] * hk]; };
  const Hv = H;
  const B = (p: V3): V3 => { const w = RB(p); return [w[0] * k, w[1] * k + HEAD_DROP * k, w[2] * k]; };
  const Bv = (p: V3): V3 => { const w = RB(p); return [w[0] * k, w[1] * k, w[2] * k]; };
  const EH = (c: V3, r: V3, g: number, m: (h: Hit) => C | -1) => s.ellipsoid(H(c), Hv([r[0], 0, 0]), Hv([0, r[1], 0]), Hv([0, 0, r[2]]), g, m);
  const EB = (c: V3, r: V3, g: number, m: (h: Hit) => C | -1) => s.ellipsoid(B(c), Bv([r[0], 0, 0]), Bv([0, r[1], 0]), Bv([0, 0, r[2]]), g, m);

  // ---- the shoulders, in the rig's own outfit material
  const NECK_BASE = -2.2;
  const torsoAt = (h: Hit, hh?: number, f?: number, z?: number): C | -1 => {
    const p = UB([h.p[0] / k, h.p[1] / k - HEAD_DROP, h.p[2] / k]);
    return ch.torso({ hit: h, near: (z ?? p[2]) > 0, t: 0, hh: hh ?? 1 + (p[1] - NECK_BASE) / ch.build.torso, f: f ?? p[0], z: z ?? p[2] });
  };
  const plainCloth = (h: Hit) => torsoAt(h, 0.62, -1, 4.5);
  EB([0.2, -10.2, 0], [ch.chest[0] + 0.3, 8.2, ch.chest[1] + 0.7], 5, h => torsoAt(h));
  EB([-0.4, -3.1, 0], [2.6, 1.9, ch.shW * 0.86], 5, h => torsoAt(h));
  for (const side of [-1, 1]) {
    EB([-0.2, -4.9, side * ch.shW * 0.95], [2.7, 2.6, 2.9], 5, h => torsoAt(h));
    s.limb(B([-0.2, -5.4, side * (ch.shW + 0.6)]), B([0.5, -18, side * (ch.shW + 1.4)]), ch.armR[0] * 1.1 * k, ch.armR[0] * k, 8,
      h => ch.upperArm({ hit: h, near: side > 0, t: h.t, hh: 0, f: 0, z: 0 }));
  }
  // the neck, shaded under the jaw
  s.limb(B([0.1, -3.4, 0]), H([0.3, 2.2, 0]), ch.neckR * 1.08 * k, ch.neckR * k, 4, h => (h.t > 0.62 ? d.skin[2] : cel(d.skin, h.l, -0.15)));
  // the collar: a band round the back of the neck and two folded points at the front
  EB([-0.5, -2.2, 0], [2.6, 1.25, 2.95], 6, h => (h.q[0] > 0.3 ? -1 : plainCloth(h)));
  for (const side of [-1, 1]) s.limb(B([0.2, -1.7, side * 2.5]), B([3.0, -4.7, side * 0.75]), 1.05 * k, 0.45 * k, 6, h => plainCloth(h));
  // the camera's strap: leather round the back of the neck and down his chest, stitched
  for (const side of [-1, 1]) {
    const a: V3 = [-0.5, -1.3, side * 2.9], m: V3 = [2.9, -6.2, side * 2.7], b: V3 = [3.8, -13, side * 1.5];
    const strapM = (h: Hit) => {
      const edge = Math.abs(Math.abs(h.q[1]) - 1.1) < 0.28;
      if (edge && Math.round(h.t * 30) % 3 !== 0) return mix(STITCH, cel(STRAP, h.l, 0.1), h.l < 0 ? 0.5 : 0.15);
      return Math.round(h.t * 30 + h.q[1] * 2) % 4 === 0 ? cel(STRAP, h.l, -0.25) : cel(STRAP, h.l, 0.15);
    };
    s.limb(B(a), B(m), 0.48 * k, 0.48 * k, 7, strapM);
    s.limb(B(m), B(b), 0.48 * k, 0.48 * k, 7, strapM);
  }

  // ---- the head (head.ts volumes)
  const skinM = (bias = 0) => (h: Hit) => cel(d.skin, h.l, bias + 0.18);
  EH(d.skull[0], d.skull[1], 1, skinM());
  EH(d.jaw[0], d.jaw[1], 1, skinM(0.05));
  EH(d.chin[0], d.chin[1], 1, skinM(0.1));
  EH(d.nose[0], d.nose[1], 1, skinM(0.2));
  EH(d.ear[0], d.ear[1], 2, skinM(-0.05));
  EH([d.ear[0][0], d.ear[0][1], -d.ear[0][2]], d.ear[1], 2, skinM(-0.1));
  // hair: a broken shine band across the crown, strand grooves along every lock
  const hairBase = (h: Hit) => {
    const band = h.n[1] > 0.3 && h.n[1] < 0.66 && h.l > 0.38 && (h.x * 5 + h.y * 3) % 9 > 1;
    return band ? (h.n[1] > 0.48 && h.l > 0.6 ? d.hair[5] : d.hair[4]) : cel(d.hair, h.l, 0.05);
  };
  s.ellipsoid(H(d.shell[0]), Hv([d.shell[1][0], 0, 0]), Hv([0, d.shell[1][1], 0]), Hv([0, 0, d.shell[1][2]]), 3, h => {
    if (d.cut(h.q)) return -1;
    const c = hairBase(h);
    return Math.sin(h.x * 0.9 - h.y * 0.35) > 0.86 ? mix(c, d.hair[1], 0.55) : c;
  });
  d.locks.forEach((l, i) => {
    const sw = l.sway ?? 0.45;
    const tip: V3 = vadd(l.b, [-sw * Math.abs(wind) * 0.5, sw * Math.abs(wind) * 0.3, -wind * (0.5 + sw) * 1.1]);
    s.limb(H(l.a), H(tip), l.r0 * hk, l.r1 * hk, 3, h => {
      let c = hairBase(h);
      if (Math.sin(h.q[1] * 3 + i * 1.7) > 0.84) c = mix(c, d.hair[1], 0.6);
      else if (h.t > 0.82 && h.l > 0) c = mix(c, d.hair[4], 0.35);
      return c;
    });
  });
  d.extras?.(s, H, { expr: o.expr, mouth: 0, blink: o.blink, look: 'cam' });

  // ---- ink, then the face on top
  const r = s.finish({ ink: d.ink, depthLine: 1.1 * k });
  const out = r.back;
  const proj = (p: V3): [number, number, number] => { const w = H(p); return [OX + w[0], OY - w[1], w[2]]; };
  const onFace = (x: number, y: number) => x >= 0 && y >= 0 && x < BW && y < BH && s.grp[y * BW + x] === 1;
  const put = (x: number, y: number, c: C, any = false) => {
    x = Math.round(x); y = Math.round(y);
    if (any ? x >= 0 && y >= 0 && x < BW && y < BH && s.grp[y * BW + x] !== 0 : onFace(x, y)) out.data[y * BW + x] = c;
  };
  const ink = mix(hex(d.eyeCol), hex('#000000'), 0.25);
  const iris = mix(hex(d.eyeCol), hex('#5a3420'), 0.55), irisL = mix(hex(d.eyeCol), hex('#a0683a'), 0.7);
  const PAL: Record<string, C> = {
    K: ink, I: iris, B: irisL, H: hex('#ffffff'), W: hex('#fff4e6'), L: mix(d.skin[1], ink, 0.25), S: mix(d.skin[2], d.skin[1], 0.4),
    D: hex('#3a0e12'), T: hex('#c8505a'), h: d.skin[4],
  };
  PAL.L = mix(d.skin[1], hex('#6a2020'), 0.45);
  const stamp = (t: Tpl, x: number, y: number, dir: 1 | -1, drop = -1, pal = PAL) => {
    t.rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        if (i === drop) continue;
        const c = row[i];
        if (c === '.') continue;
        const cc = c === 'L' && t === EYE.wide ? mix(d.skin[1], ink, 0.3) : pal[c];
        put(x + (i - t.ac) * dir, y + (j - t.ar), cc);
      }
    });
  };
  const eye = o.blink && ex.eye !== 'happy' ? 'closed' : ex.eye;
  const browC = hex(d.brow);
  const visible = (p: V3) => { const [x, y, z] = proj(p); const i = Math.floor(y) * BW + Math.floor(x); return x >= 0 && y >= 0 && x < BW && y < BH && s.grp[i] === 1 && s.z[i] <= z + 2.2 * hk; };
  for (const side of [1, -1] as const) {
    const e: V3 = [d.eye[0], d.eye[1], d.eye[2] * side];
    if (!visible(e)) continue;
    const [fx, fy] = proj(e);
    const x = Math.round(fx), y = Math.round(fy);
    const inner: 1 | -1 = side > 0 ? 1 : -1, far = side < 0;
    // the far eye is foreshortened: its outer column goes
    stamp(EYE[eye], x, y, inner, far ? 0 : -1);
    // brows: five pixels, the inner three doubled; lifted by surprise, tilted by worry or anger
    if (!d.browHidden || ex.brow > 1) {
      const lift = ex.brow > 1 ? -1 : 0, t = ex.browTilt;
      const ys = t > 0 ? [-3, -3, -4, -4, -5] : t < 0 ? [-5, -5, -4, -3, -3] : [-4, -4, -4, -4, -4];
      for (let i = far ? 1 : 0; i < 5; i++) {
        const bx = x + (i - 2) * inner, by = y + ys[i] + lift;
        put(bx, by, browC);
        if (i >= 2) put(bx, by - 1, mix(browC, d.skin[2], 0.35));
      }
    }
    if (ex.blush) for (let i = 0; i < 3; i++) put(x + (i - 1) * inner, y + 3 - (i === 1 ? 0 : 0), mix(hex(d.blush), d.skin[3], i === 1 ? 0.1 : 0.45));
  }
  // the nose: a shadow under the tip toward the far cheek, a lit bridge
  const nTip = proj([d.nose[0][0] + d.nose[1][0] * 0.8, d.nose[0][1] - 0.2, 0]);
  put(nTip[0] + 1, nTip[1] + 1, d.skin[1]);
  put(nTip[0], nTip[1] + 1, mix(d.skin[2], d.skin[1], 0.5));
  const nBr = proj([d.nose[0][0] + 0.3, d.nose[0][1] + 0.9, 0]);
  put(nBr[0] - 1, nBr[1], d.skin[5]);
  // the mouth
  const [mx, my] = proj(d.mouth);
  const mouth: MouthK = o.mouth === 2 ? 'shout' : o.mouth === 1 ? (ex.mouth === 'none' || ex.mouth === 'smile' || ex.mouth === 'frown' ? 'open' : ex.mouth) : ex.mouth;
  stamp(MOUTH[mouth], Math.round(mx), Math.round(my), 1);
  // a sweat drop on the temple
  const tp = proj([0.6, 10.2, d.skull[1][2] * 0.92]);
  if (ex.sweat) {
    const drop = ['.w.', 'wbb', 'bbb', '.b.'];
    const pal: Record<string, C> = { w: hex('#e8f8ff'), b: hex('#5ab0ec') };
    drop.forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] !== '.') put(tp[0] - 1 + i, tp[1] - 2 + j, pal[row[i]], true); });
  }
  const belly = proj([0, 0, 0]);
  const bl = B([3.4, -11, 0]);
  const res: Bust = { buf: out, ox: OX, oy: OY, temple: [Math.round(tp[0]), Math.round(tp[1])], belly: [Math.round(OX + bl[0]), Math.round(OY - bl[1])] };
  void belly;
  if (cache.size > 240) cache.clear();
  cache.set(key, res);
  return res;
}

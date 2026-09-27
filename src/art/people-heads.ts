// V2 people: heads (face, hair, hats, beards, glasses) with expressions, look directions and
// talking mouths. Drawn in HEAD UNITS relative to the neck anchor (x forward, y up) and scaled by
// S (1 = in-game, 2 = portrait), so the same painter produces the sprite head and the bust.

import { PixelBuffer } from './pixel';
import { C, hex, shade, mix } from './color';
import { Canvas, P2, tone, rampOf, at, finish, light3 } from './people-rig';
import { PALS } from './people-cast';
import type { CharId } from './people-parts';
import { renderBust, DESIGNS, BustId } from './portrait/cast';
import { EXPR_PARAMS } from './portrait/face';
import type { PExpr } from './portrait/face';

export type Expr = 'neutral' | 'happy' | 'laugh' | 'surprised' | 'shocked' | 'angry' | 'grumpy' | 'sad' | 'worried' | 'scared' | 'thinking' | 'tired' | 'teasing' | 'serious' | 'smug' | 'determined' | 'sleep' | 'eat';
export type Look = 'fwd' | 'up' | 'down';
export interface HeadOpts { expr: Expr; mouth: 0 | 1 | 2; blink: boolean; look: Look }

export const EXPRS: Expr[] = ['neutral', 'happy', 'laugh', 'surprised', 'shocked', 'angry', 'grumpy', 'sad', 'worried', 'scared', 'thinking', 'tired', 'teasing', 'serious', 'smug', 'determined', 'sleep', 'eat'];

// ------------------------------------------------------------------ expression model

type EyeShape = 'open' | 'wide' | 'half' | 'squint' | 'happy' | 'arc' | 'closed' | 'sleep' | 'sad';
type MouthShape =
  | 'line' | 'small' | 'open' | 'smile' | 'smileO' | 'smileB' | 'laughS' | 'laugh' | 'laughB' | 'o' | 'oM' | 'O' | 'OB'
  | 'frown' | 'frownO' | 'grit' | 'gritO' | 'shout' | 'wavy' | 'wavyO' | 'wobble' | 'wobbleO' | 'scream' | 'purse' | 'smirk' | 'smirkO' | 'grin'
  | 'flat' | 'yawn' | 'chew' | 'chewO' | 'bite' | 'snore' | 'set' | 'setO';

interface FaceState {
  eye: EyeShape;
  eyeF?: EyeShape;
  pupil: 'n' | 's' | 't';
  /** pupil offset in units (x forward, y up) */
  pdx: number;
  pdy: number;
  /** brow offsets (units, + = up): [inner, outer] per brow */
  bn: [number, number];
  bf: [number, number];
  mouth: [MouthShape, MouthShape, MouthShape];
  blush?: number;
  sweat?: boolean;
  tear?: boolean;
  pale?: boolean;
  puff?: boolean;
  bags?: boolean;
  noPipe?: boolean;
}

const FACES: Record<Expr, FaceState> = {
  neutral: { eye: 'open', pupil: 'n', pdx: 0, pdy: 0, bn: [0, 0], bf: [0, 0], mouth: ['line', 'small', 'open'] },
  happy: { eye: 'happy', pupil: 'n', pdx: 0, pdy: 0, bn: [0.6, 0.3], bf: [0.6, 0.3], mouth: ['smile', 'smileO', 'smileB'], blush: 1 },
  laugh: { eye: 'arc', pupil: 'n', pdx: 0, pdy: 0, bn: [1, 0.5], bf: [1, 0.5], mouth: ['laughS', 'laugh', 'laughB'], blush: 1, noPipe: true },
  surprised: { eye: 'wide', pupil: 'n', pdx: 0, pdy: 0, bn: [2, 1.6], bf: [2, 1.6], mouth: ['o', 'oM', 'O'] },
  shocked: { eye: 'wide', pupil: 't', pdx: 0, pdy: 0, bn: [2.6, 2], bf: [2.6, 2], mouth: ['O', 'OB', 'scream'], pale: true, noPipe: true },
  angry: { eye: 'squint', pupil: 'n', pdx: 0, pdy: 0, bn: [-2, 0.6], bf: [-2, 0.6], mouth: ['grit', 'gritO', 'shout'] },
  grumpy: { eye: 'half', pupil: 'n', pdx: 0, pdy: 0, bn: [-1.2, 0], bf: [-1.2, 0], mouth: ['frown', 'frownO', 'gritO'] },
  sad: { eye: 'sad', pupil: 'n', pdx: 0, pdy: -0.5, bn: [1.4, -0.6], bf: [1.4, -0.6], mouth: ['frown', 'frownO', 'wobbleO'], tear: true },
  worried: { eye: 'open', pupil: 's', pdx: 0, pdy: 0, bn: [1.8, -0.2], bf: [1.8, -0.2], mouth: ['wavy', 'wavyO', 'oM'], sweat: true },
  scared: { eye: 'wide', pupil: 't', pdx: 0, pdy: 0, bn: [2.4, 0.4], bf: [2.4, 0.4], mouth: ['wobble', 'wobbleO', 'scream'], sweat: true, pale: true, noPipe: true },
  thinking: { eye: 'open', pupil: 'n', pdx: 0.5, pdy: 1, bn: [1.6, 1.2], bf: [-0.8, -0.2], mouth: ['purse', 'small', 'open'] },
  tired: { eye: 'half', pupil: 'n', pdx: 0, pdy: -0.5, bn: [-0.2, -0.8], bf: [-0.2, -0.8], mouth: ['flat', 'small', 'yawn'], bags: true },
  teasing: { eye: 'half', eyeF: 'happy', pupil: 'n', pdx: 0.5, pdy: 0, bn: [1.4, 1.4], bf: [0, 0.2], mouth: ['smirk', 'smirkO', 'grin'], blush: 0.5 },
  serious: { eye: 'open', pupil: 'n', pdx: 0, pdy: 0, bn: [-0.8, -0.2], bf: [-0.8, -0.2], mouth: ['flat', 'small', 'open'] },
  smug: { eye: 'half', pupil: 'n', pdx: 0.3, pdy: 0, bn: [1, 1], bf: [1, 1], mouth: ['smirk', 'smirkO', 'grin'] },
  determined: { eye: 'squint', pupil: 'n', pdx: 0.3, pdy: 0, bn: [-1.4, 0.4], bf: [-1.4, 0.4], mouth: ['set', 'setO', 'shout'] },
  sleep: { eye: 'sleep', pupil: 'n', pdx: 0, pdy: 0, bn: [0.2, -0.3], bf: [0.2, -0.3], mouth: ['line', 'small', 'snore'], noPipe: true },
  eat: { eye: 'arc', pupil: 'n', pdx: 0, pdy: 0, bn: [0.8, 0.4], bf: [0.8, 0.4], mouth: ['chew', 'chewO', 'bite'], puff: true, blush: 0.6, noPipe: true },
};

// ------------------------------------------------------------------ head canvas helpers

export class HeadCtx {
  constructor(readonly c: Canvas, readonly S: number, readonly ax: number, readonly ay: number) {}
  X(u: number) { return this.ax + u * this.S; }
  Y(v: number) { return this.ay - v * this.S; }
  P(u: number, v: number): P2 { return [this.X(u), this.Y(v)]; }
  /** paint a unit-space pixel block (S×S) into the part layer */
  dot(u: number, v: number, c: C) {
    const S = this.S;
    const x = Math.round(this.X(u)), y = Math.round(this.Y(v));
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) this.c.px(x + i, y - S + 1 + j, c);
  }
  /** paint over existing pixels of the layer */
  pdot(u: number, v: number, c: C) {
    const S = this.S;
    const x = Math.round(this.X(u)), y = Math.round(this.Y(v));
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) this.c.pp(x + i, y - S + 1 + j, c);
  }
  blob(u: number, v: number, ru: number, rv: number, sh: (l: number, nx: number, ny: number, x: number, y: number) => C | -1, rot = 0) {
    this.c.blob(this.X(u), this.Y(v), ru * this.S, rv * this.S, s => sh(s.l, s.u, s.v, s.x, s.y), rot);
  }
  poly(pts: number[], sh: (x: number, y: number) => C | -1) {
    const q: number[] = [];
    for (let i = 0; i < pts.length; i += 2) q.push(this.X(pts[i]), this.Y(pts[i + 1]));
    this.c.poly(q, s => sh(s.x, s.y));
  }
  limb(a: P2, b: P2, ra: number, rb: number, sh: (l: number, u: number, v: number) => C | -1) {
    this.c.limb(this.P(a[0], a[1]), this.P(b[0], b[1]), ra * this.S, rb * this.S, s => sh(s.l, s.u, s.v));
  }
  /** unit coords of a buffer pixel */
  U(x: number) { return (x + 0.5 - this.ax) / this.S; }
  V(y: number) { return (this.ay - (y + 0.5)) / this.S; }
  merge(line = 0.25, ao = 0.18, lineLit = 0.08) { this.c.merge({ line, ao, lineLit }); }
}

/** Paint a pixel template (rows top→bottom) with its reference cell at (u, v). */
function tpl(h: HeadCtx, rows: string[], u: number, v: number, pal: Record<string, C>, refCol = -1, overOnly = false) {
  const w = Math.max(...rows.map(r => r.length));
  const rc = refCol >= 0 ? refCol : Math.floor(w / 2);
  for (let j = 0; j < rows.length; j++)
    for (let i = 0; i < rows[j].length; i++) {
      const ch = rows[j][i];
      if (ch === '.' || ch === ' ') continue;
      const col = pal[ch];
      if (col === undefined) continue;
      if (overOnly) h.pdot(u + i - rc, v - j, col);
      else h.dot(u + i - rc, v - j, col);
    }
}

// ------------------------------------------------------------------ face features (S = 1 templates, S >= 2 scaled detail)

export interface FaceGeo {
  skin: C[];
  eyeN: P2;
  eyeF: P2;
  browY: number;
  /** [outer end / shadow, main, top highlight] */
  brow: [C, C, C];
  browThick: number;
  nose: P2;
  mouth: P2;
  iris: C;
  lash: C;
  sclera: C;
  lip: C;
  mouthIn: C;
  blush: C;
  noseCol?: C;
  /** near brow length (default 4) */
  browLen?: number;
  teeth?: C;
}

/** Eye templates (rows top→bottom, col 0 = back/outer side of the near eye). */
function eyeTemplate(shape: EyeShape, nearEye: boolean, pupil: FaceState['pupil'], look: number, blink: boolean): string[] {
  if (blink && shape !== 'arc' && shape !== 'sleep' && shape !== 'closed') shape = 'closed';
  if (nearEye) {
    switch (shape) {
      case 'closed': return ['....', '....', 'LLLL', '.ss.'];
      case 'sleep': return ['....', '....', 'L..L', '.LL.'];
      case 'arc': return ['....', '.LL.', 'L..L', '....'];
      case 'wide':
        if (pupil === 't') return ['.LLL', 'LWWW', 'WWWI', 'WWWW', '.WW.'];
        return look > 0 ? ['.LLL', 'LWIH', 'WWII', 'WWWW', '.WW.'] : look < 0 ? ['.LLL', 'LWWW', 'WWWW', 'WWIH', '.WII'] : ['.LLL', 'LWWW', 'WWIH', 'WWII', '.WW.'];
      case 'half': return look < 0 ? ['....', '....', 'LLLL', '.WII'] : ['....', 'LLLL', 'WWIH', '.WII'];
      case 'squint': return ['.L..', 'LWLL', 'WWIH', '.WII'];
      case 'sad': return ['..LL', 'LLIH', 'WWII', '.WII'];
      case 'happy': return look < 0 ? ['....', '.LLL', 'LWIH', '.ss.'] : ['.LLL', 'LWIH', 'WWII', '.ss.'];
      default:
        if (pupil === 't') return ['.LLL', 'LWWW', 'WWWI', '.WWW'];
        if (pupil === 's') return ['.LLL', 'LWWW', 'WWIH', '.WII'];
        return look > 0 ? ['.LLL', 'LWIH', 'WWII', '.WWW'] : look < 0 ? ['....', '.LLL', 'LWIH', '.WII'] : ['.LLL', 'LWIH', 'WWII', '.WII'];
    }
  }
  switch (shape) {
    case 'closed': return ['...', '...', 'LLL', '.s.'];
    case 'sleep': return ['...', '...', 'L.L', '.L.'];
    case 'arc': return ['...', '.L.', 'L.L', '...'];
    case 'wide':
      if (pupil === 't') return ['LLL', 'WWW', 'WIW', 'WWW', '.W.'];
      return look > 0 ? ['LLL', 'WIH', 'WII', 'WWW', '.W.'] : look < 0 ? ['LLL', 'WWW', 'WWW', 'WIH', '.I.'] : ['LLL', 'WWW', 'WIH', 'WII', '.W.'];
    case 'half': return look < 0 ? ['...', '...', 'LLL', 'WI.'] : ['...', 'LLL', 'WIH', 'WI.'];
    case 'squint': return ['..L', 'LLL', 'WIH', 'WI.'];
    case 'sad': return ['LL.', 'LIH', 'WII', 'WI.'];
    case 'happy': return look < 0 ? ['...', 'LLL', 'WIH', '.s.'] : ['LLL', 'WIH', 'WII', '.s.'];
    default:
      if (pupil === 't') return ['LLL', 'WWW', 'WIW', 'WWW'];
      if (pupil === 's') return ['LLL', 'WWW', 'WIH', 'WI.'];
      return look > 0 ? ['LLL', 'WIH', 'WII', 'WW.'] : look < 0 ? ['...', 'LLL', 'WIH', 'WI.'] : ['LLL', 'WIH', 'WII', 'WI.'];
  }
}

function browDraw(h: HeadCtx, g: FaceGeo, nearB: boolean, off: [number, number], look: number) {
  const [inner, outer] = off;
  const e = nearB ? g.eyeN : g.eyeF;
  const len: number = nearB ? (g.browLen ?? 4) : 3;
  // inner end toward the nose: near brow's inner end is on its right; far brow's on its left
  const x0 = nearB ? e[0] - 2 - (len - 4) : e[0] - 1;
  const by = g.browY + look;
  const [cEdge, cMain, cTop] = g.brow;
  for (let i = 0; i < len; i++) {
    const t = len === 1 ? 0 : i / (len - 1);
    const tIn = nearB ? t : 1 - t;
    const dy = outer + (inner - outer) * tIn;
    const y = Math.round(by + dy);
    const outerEnd = nearB ? i === 0 : i === len - 1;
    h.dot(x0 + i, y, outerEnd ? cEdge : cMain);
    if (g.browThick > 1) h.dot(x0 + i, y + 1, outerEnd ? cMain : cTop);
  }
}

function mouthTemplate(m: MouthShape): { rows: string[]; ref: number } {
  // palette: L lip/line, D dark interior, T teeth, R tongue/red, l light lip
  switch (m) {
    case 'line': return { rows: ['LLL'], ref: 1 };
    case 'flat': return { rows: ['LLLL'], ref: 2 };
    case 'small': return { rows: ['LLL', '.D.'], ref: 1 };
    case 'open': return { rows: ['LDDL', '.DR.'], ref: 2 };
    case 'smile': return { rows: ['L..L', '.LL.'], ref: 2 };
    case 'smileO': return { rows: ['LTTL', '.DD.'], ref: 2 };
    case 'smileB': return { rows: ['LTTTL', 'LDDDL', '.DRD.'], ref: 2 };
    case 'laughS': return { rows: ['LTTL', 'LDDL', '.DD.'], ref: 2 };
    case 'laugh': return { rows: ['LTTTL', 'DDDDD', '.DRD.'], ref: 2 };
    case 'laughB': return { rows: ['LTTTL', 'DDDDD', 'DDRRD', '.DDD.'], ref: 2 };
    case 'o': return { rows: ['.L.', 'LDL', '.L.'], ref: 1 };
    case 'oM': return { rows: ['.LL.', 'LDDL', '.LL.'], ref: 2 };
    case 'O': return { rows: ['.LL.', 'LDDL', 'LDDL', '.LL.'], ref: 2 };
    case 'OB': return { rows: ['.LLL.', 'LDDDL', 'LDDDL', 'LDRDL', '.LLL.'], ref: 2 };
    case 'scream': return { rows: ['LTTTL', 'DDDDD', 'DDDDD', 'DRRRD', '.DDD.'], ref: 2 };
    case 'frown': return { rows: ['.LL.', 'L..L'], ref: 2 };
    case 'frownO': return { rows: ['.LL.', 'LDDL'], ref: 2 };
    case 'grit': return { rows: ['LLLL', 'TLTT', 'LLLL'], ref: 2 };
    case 'gritO': return { rows: ['LLLLL', 'LTTTL', 'LDDDL', '.LLL.'], ref: 2 };
    case 'shout': return { rows: ['LTTTL', 'DDDDD', 'DDRDD', 'DDDDD', '.DDD.'], ref: 2 };
    case 'wavy': return { rows: ['L.L.', '.L.L'], ref: 2 };
    case 'wavyO': return { rows: ['LLLL', 'D.DD'], ref: 2 };
    case 'wobble': return { rows: ['.L.L.', 'L.L.L'], ref: 2 };
    case 'wobbleO': return { rows: ['.L.L.', 'LDLDL', 'LDDDL', '.LLL.'], ref: 2 };
    case 'purse': return { rows: ['.LL'], ref: 1 };
    case 'smirk': return { rows: ['...L', 'LLL.'], ref: 1 };
    case 'smirkO': return { rows: ['...L', 'LTT.', '.DD.'], ref: 1 };
    case 'grin': return { rows: ['L...L', 'LTTTL', '.LDL.'], ref: 2 };
    case 'yawn': return { rows: ['.LL.', 'LDDL', 'LDRL', 'LDDL', '.LL.'], ref: 2 };
    case 'chew': return { rows: ['.LL.'], ref: 2 };
    case 'chewO': return { rows: ['.LL.', 'LDDL'], ref: 2 };
    case 'bite': return { rows: ['LTTL', 'DDDD', '.DD.'], ref: 2 };
    case 'snore': return { rows: ['.L.', 'LDL', 'LDL', '.L.'], ref: 1 };
    case 'set': return { rows: ['LTTL'], ref: 2 };
    case 'setO': return { rows: ['LTTTL', '.DDD.'], ref: 2 };
  }
}

export interface FaceOpts {
  st: FaceState;
  mouth: 0 | 1 | 2;
  blink: boolean;
  look: Look;
  /** skip the mouth (drawn later over a beard) */
  noMouth?: boolean;
}

export function mouthPal(g: FaceGeo): Record<string, C> {
  return { L: g.lip, D: g.mouthIn, T: g.teeth ?? hex('#f2ede2'), R: hex('#b8484a'), l: g.skin[5] };
}

export function paintMouth(h: HeadCtx, g: FaceGeo, o: FaceOpts, overOnly = true, dy = 0) {
  const fy = o.look === 'up' ? 1 : o.look === 'down' ? -1 : 0;
  const m = o.st.mouth[o.mouth];
  const t = mouthTemplate(m);
  tpl(h, t.rows, g.mouth[0], Math.round(g.mouth[1] + fy + dy), mouthPal(g), t.ref, overOnly);
  return m;
}

/** Features painted over the face skin of the current layer. */
function paintFace(h: HeadCtx, g: FaceGeo, o: FaceOpts) {
  const st = o.st;
  const lk = o.look === 'up' ? 1 : o.look === 'down' ? -1 : 0;
  const pdy = st.pdy + lk;
  const pal: Record<string, C> = {
    L: g.lash, W: g.sclera, I: g.iris, H: hex('#ffffff'), s: g.skin[3], c: shade(g.skin[4], -0.05),
  };
  const fy = lk;
  const eN = eyeTemplate(st.eye, true, st.pupil, Math.sign(Math.round(pdy)), o.blink);
  const eF = eyeTemplate(st.eyeF ?? st.eye, false, st.pupil, Math.sign(Math.round(pdy)), o.blink);
  const drawEye = (rows: string[], e: P2, nearEye: boolean) => {
    const top = e[1] + 1.5 + fy;
    tpl(h, rows, e[0] - (nearEye ? 2 : 1), Math.round(top), pal, 0, true);
  };
  drawEye(eN, g.eyeN, true);
  drawEye(eF, g.eyeF, false);
  // nose: shadow under/behind the tip, highlight on the bridge
  const nx = g.nose[0], ny = g.nose[1] + fy;
  h.pdot(nx - 1, ny - 1, g.noseCol ?? shade(g.skin[3], -0.18));
  h.pdot(nx, ny, g.skin[5]);
  if (!o.noMouth) paintMouth(h, g, o);
  if (st.blush) {
    const bc = mix(g.skin[4], g.blush, 0.55 * st.blush);
    h.pdot(g.eyeN[0] - 1, g.eyeN[1] - 3 + fy, bc);
    h.pdot(g.eyeN[0], g.eyeN[1] - 3 + fy, bc);
    h.pdot(g.eyeF[0] + 1, g.eyeF[1] - 3 + fy, bc);
  }
  if (st.bags) {
    h.pdot(g.eyeN[0] - 1, g.eyeN[1] - 2.5 + fy, shade(g.skin[3], -0.2));
    h.pdot(g.eyeN[0], g.eyeN[1] - 2.5 + fy, shade(g.skin[3], -0.2));
  }
}

/** Brows go on top of fringes so they always read. */
function paintBrows(h: HeadCtx, g: FaceGeo, o: FaceOpts) {
  const fy = o.look === 'up' ? 1 : o.look === 'down' ? -1 : 0;
  browDraw(h, g, true, o.st.bn, fy);
  browDraw(h, g, false, o.st.bf, fy);
  h.merge(0.05, 0.05, 0);
}

function paintSweat(h: HeadCtx, u: number, v: number) {
  const W = rampOf('#1f5a8a', '#4f9fd8', '#a8dcf8', '#ffffff');
  tpl(h, ['.b.', 'bcb', 'bdb', '.b.'], u, v, { b: W[0], c: W[2], d: W[1] }, 1);
  h.dot(u - 0, v - 1, W[3]);
}

function paintTear(h: HeadCtx, u: number, v: number) {
  const W = rampOf('#2e6fa8', '#7cc4f0', '#e0f6ff');
  h.pdot(u, v, W[2]);
  h.pdot(u, v - 1, W[1]);
}

// ------------------------------------------------------------------ skull

function skull(h: HeadCtx, skin: C[], cr: [number, number, number, number], jaw: [number, number, number, number], pale: boolean, extra?: (u: number, v: number) => boolean) {
  const sk = pale ? skin.map(c => mix(c, hex('#b8c8d0'), 0.22)) : skin;
  const [cx, cy, rx, ry] = cr;
  const [jx, jy, jrx, jry] = jaw;
  const r = Math.max(rx, ry, jrx, jry) + 2;
  const S = h.S;
  const x0 = Math.floor(h.X(Math.min(cx - rx, jx - jrx) - 1)), x1 = Math.ceil(h.X(Math.max(cx + rx, jx + jrx) + 1));
  const y0 = Math.floor(h.Y(Math.max(cy + ry, jy + jry) + 1)), y1 = Math.ceil(h.Y(Math.min(cy - ry, jy - jry) - 1));
  void r;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const u = h.U(x), v = h.V(y);
      const a = ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2;
      const b = ((u - jx) / jrx) ** 2 + ((v - jy) / jry) ** 2;
      if (a > 1 && b > 1 && !(extra && extra(u, v))) continue;
      // normal from the cranium sphere blended with the jaw
      let nx: number, ny: number;
      if (a <= b * 0.8) { nx = (u - cx) / rx; ny = -(v - cy) / ry; }
      else { nx = (u - jx) / jrx; ny = -(v - jy) / jry; }
      const d = Math.min(1, nx * nx + ny * ny);
      const nz = Math.sqrt(1 - d);
      let l = light3(nx * 0.85, ny * 0.85, nz);
      // under-jaw shadow
      if (v < jy - jry * 0.8) l -= 0.2;
      h.c.px(x, y, tone(sk, l, 0.12, 1.15));
    }
  void S;
}

// ------------------------------------------------------------------ hair clumps

interface Clump { u: number; v: number; r: number; ry?: number; rot?: number }

function clumps(h: HeadCtx, list: Clump[], ramp: C[], bias = 0, separate = true) {
  for (const k of list) {
    h.blob(k.u, k.v, k.r, k.ry ?? k.r, (l, nx, ny) => {
      // strand hint: lighter crescent on the lit upper-left
      const rim = nx < -0.2 && ny < -0.1 && nx * nx + ny * ny > 0.35 ? 0.35 : 0;
      return tone(ramp, l + rim, bias, 1.2);
    }, k.rot ?? 0);
    if (separate) h.merge(0.28, 0.14, 0.1);
  }
  if (!separate) h.merge(0.25, 0.14, 0.08);
}

/**
 * One hair mass: `inside(u, v)` defines coverage in head units; lit as a sphere around
 * (cx, cy, r). Curl texture adds lit crescents on a jittered grid (clean clusters).
 */
function hairMass(h: HeadCtx, inside: (u: number, v: number) => boolean, ramp: C[], o: {
  sphere: [number, number, number]; bias?: number; k?: number; curl?: number; curlR?: number; seed?: number; strand?: number; ext: [number, number, number, number];
}) {
  const [scx, scy, sr] = o.sphere;
  const [u0, u1, v0, v1] = o.ext;
  const x0 = Math.floor(h.X(u0)), x1 = Math.ceil(h.X(u1)), y0 = Math.floor(h.Y(v1)), y1 = Math.ceil(h.Y(v0));
  const cs = o.curl ?? 0, cr = o.curlR ?? cs * 0.48, seed = o.seed ?? 1;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const u = h.U(x), v = h.V(y);
      if (!inside(u, v)) continue;
      const nx = (u - scx) / sr, ny = (v - scy) / sr;
      const d = Math.min(1, nx * nx + ny * ny);
      let l = light3(nx * 0.9, -ny * 0.9, Math.sqrt(1 - d));
      if (cs > 0) {
        // nearest jittered curl centre
        const gi = Math.floor(u / cs), gj = Math.floor(v / cs);
        let best = 1e9, bu = 0, bv = 0;
        for (let j = gj - 1; j <= gj + 1; j++)
          for (let i = gi - 1; i <= gi + 1; i++) {
            const ju = (i + 0.2 + hash01(i, j, seed) * 0.6 + (j & 1) * 0.5) * cs;
            const jv = (j + 0.2 + hash01(j, i, seed + 7) * 0.6) * cs;
            const dd = (u - ju) ** 2 + (v - jv) ** 2;
            if (dd < best) { best = dd; bu = ju; bv = jv; }
          }
        const du = (u - bu) / cr, dv = (v - bv) / cr;
        const dist = Math.sqrt(du * du + dv * dv);
        if (dist > 0.3 && dist < 1.05 && du < 0.35 && dv > -0.2) l += 0.42;
        else if (dist >= 1.05 && du > -0.2 && dv < 0.2) l -= 0.3;
      }
      if (o.strand) {
        const sv = Math.sin((u * 1.7 + v * 0.35) * o.strand);
        if (sv > 0.75) l += 0.3;
      }
      h.c.px(x, y, tone(ramp, l, o.bias ?? -0.2, o.k ?? 1.1));
    }
}

/**
 * Designed hair clumps: the union of circles is the silhouette; each pixel is shaded by its
 * nearest clump (sphere light + lit crescent) and clump borders become dark separation lines.
 */
export interface HClump { u: number; v: number; r: number; ry?: number; hi?: number }
/**
 * Hair as designed clumps drawn back-to-front. Each clump: base tone from the head sphere,
 * a clean lit crescent on its upper-left, and a contact line where it overlaps earlier clumps
 * on the shadow side. Keeps clusters clean (no per-pixel noise).
 */
function clumpHair(h: HeadCtx, list: HClump[], ramp: C[], o: {
  sphere: [number, number, number]; bias?: number; k?: number; mask?: (u: number, v: number) => boolean; hi?: number; line?: number; merge?: boolean;
}) {
  const [scx, scy, sr] = o.sphere;
  const hiK = o.hi ?? 1;
  for (const k of list) {
    const ry = k.ry ?? k.r;
    const x0 = Math.floor(h.X(k.u - k.r)) - 1, x1 = Math.ceil(h.X(k.u + k.r)) + 1;
    const y0 = Math.floor(h.Y(k.v + ry)) - 1, y1 = Math.ceil(h.Y(k.v - ry)) + 1;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const u = h.U(x), v = h.V(y);
        const nx = (u - k.u) / k.r, ny = (v - k.v) / ry;
        const d = nx * nx + ny * ny;
        if (d > 1) continue;
        if (o.mask && !o.mask(u, v)) continue;
        const gx = (u - scx) / sr, gy = (v - scy) / sr;
        const gd = Math.min(1, gx * gx + gy * gy);
        let l = light3(gx * 0.85, -gy * 0.85, Math.sqrt(1 - gd));
        // crescent: upper-left rim band of the clump
        const dd = Math.sqrt(d);
        if (dd > 0.42 && dd < 0.88 && nx < 0.2 && ny > 0.05 && ny > -nx * 0.3 - 0.1) l += 0.5 * (k.hi ?? hiK);
        else if (dd > 0.7 && nx > 0.2 && ny < -0.2) l -= 0.25;
        h.c.px(x, y, tone(ramp, l, o.bias ?? -0.2, o.k ?? 1.1));
      }
    if (o.merge !== false) h.merge(o.line ?? 0.42, 0.12, 0);
  }
  if (o.merge === false) h.merge(o.line ?? 0.3, 0.12, 0);
}

function hash01(i: number, j: number, s: number) {
  let n = (i * 374761393 + j * 668265263 + s * 2147483647) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

// ------------------------------------------------------------------ characters

interface HeadDraw { (h: HeadCtx, o: FaceOpts): void }

const ROWAN_GEO = (): FaceGeo => ({
  skin: PALS.skinRowan, eyeN: [3, 10], eyeF: [9, 10], browY: 14, brow: [PALS.hairRowan[0], PALS.hairRowan[1], PALS.hairRowan[3]], browThick: 1,
  nose: [10, 7], mouth: [7, 4], iris: hex('#24140f'), lash: hex('#1d1014'), sclera: hex('#f6f2ea'), lip: hex('#8a4a3a'),
  mouthIn: hex('#4a1a1a'), blush: hex('#e86a5a'),
});

const rowanHead: HeadDraw = (h, o) => {
  const H = PALS.hairRowan;
  const g = ROWAN_GEO();
  const lk = o.look === 'up' ? 1 : o.look === 'down' ? -1 : 0;
  // skull + face features
  skull(h, g.skin, [0.8, 11.8, 8.8, 9.4], [4.4, 6.6, 6.8, 6.1], !!o.st.pale, (u, v) => ((u - 10.6) / 1.3) ** 2 + ((v - 7 - lk) / 1.4) ** 2 <= 1);
  paintFace(h, g, o);
  h.merge(0.2, 0.15);
  // ear (mostly under the curls)
  h.blob(-2.2, 8.2, 1.5, 2.1, l => tone(g.skin, l - 0.5, -0.1, 0.8));
  h.merge(0.3, 0.12);
  const fl = -lk * 0.8;
  clumpHair(h, [
    // back of the head down to the nape
    { u: -5, v: 4.6, r: 2 }, { u: -2.9, v: 3.4, r: 1.6 }, { u: -6.7, v: 7.6, r: 2.4 },
    { u: -7.7, v: 11.4, r: 2.5 }, { u: -7.4, v: 15.4, r: 2.7 },
    // crown and cap
    { u: -4.6, v: 15.6, r: 3.1 }, { u: -4.4, v: 11.2, r: 2.6 }, { u: -4.2, v: 7.8, r: 1.9 }, { u: -5.4, v: 19.2, r: 2.8 },
    { u: -1.6, v: 20.4, r: 3 }, { u: 2.4, v: 20.6, r: 3 }, { u: 5.9, v: 19.4, r: 2.7 },
    // side lock
    { u: -1.3, v: 14.4, r: 2 }, { u: -0.9, v: 11.2, r: 1.6 }, { u: -0.5, v: 8.4, r: 1.4, ry: 1.6 },
    // fringe
    { u: 8.8, v: 16.6 + fl, r: 1.9 }, { u: 6.4, v: 17.6 + fl, r: 2.4 }, { u: 3.4, v: 18 + fl, r: 2.6 }, { u: 0.6, v: 17.8 + fl, r: 2.5 },
  ], H, { sphere: [0, 15, 11], bias: -0.5, k: 1.15, hi: 0.9 });
  // top-knot bun on the crown with a blue hair tie
  clumpHair(h, [{ u: -8.2, v: 22, r: 1.5, ry: 1.2 }, { u: -5.8, v: 21.8, r: 2.5, ry: 2.1 }], H, { sphere: [-5.8, 22.4, 3.4], bias: -0.35, hi: 1.1 });
  h.blob(-4.4, 20.2, 1.5, 0.8, l => tone(PALS.parka, l + 0.3, 0.15), -0.5);
  h.merge(0.25, 0.1);
  paintBrows(h, g, o);
  // glasses: round black frames, the eyes stay visible behind them
  const fr = hex('#120e11'), frL = hex('#4a4046'), glint = hex('#dff1f6');
  const ring = (cu: number, cv: number, ru: number, rv: number) => {
    const x0 = Math.floor(h.X(cu - ru - 1)), x1 = Math.ceil(h.X(cu + ru + 1));
    const y0 = Math.floor(h.Y(cv + rv + 1)), y1 = Math.ceil(h.Y(cv - rv - 1));
    const t = 1.05 / h.S;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const du = (h.U(x) - cu) / ru, dv = (h.V(y) - cv) / rv;
        const d = Math.sqrt(du * du + dv * dv);
        if (d <= 1 && d > 1 - t / Math.min(ru, rv)) h.c.px(x, y, dv > 0.2 && du < -0.2 ? frL : fr);
        else if (d < 0.5 && du < -0.1 && dv > 0.25 && h.S >= 2) h.c.px(x, y, glint);
      }
  };
  const gy = g.eyeN[1] - 0.5 + lk;
  ring(g.eyeN[0] + 0.5, gy, 3.3, 3.6);
  ring(g.eyeF[0] + 0.5, gy, 2.2, 3.5);
  h.dot(6, g.eyeN[1] + lk, fr);
  h.dot(-0.2, g.eyeN[1] + lk, fr);
  h.dot(-1, g.eyeN[1] + lk, fr);
  h.merge(0.1, 0.08);
};

// ------------------------------------------------------------------ CROWE

const CROWE_GEO = (): FaceGeo => ({
  skin: PALS.skinCrowe, eyeN: [3.4, 10], eyeF: [9.4, 10], browY: 12.8, brow: [PALS.beard[3], PALS.beard[5], PALS.beard[6]], browThick: 2, browLen: 5,
  nose: [10.6, 7.2], mouth: [8, 3], iris: hex('#2a1c18'), lash: hex('#2a1412'), sclera: hex('#efe4d6'), lip: hex('#4a1e1a'),
  mouthIn: hex('#321010'), blush: hex('#d8584a'), teeth: hex('#eee4cc'),
});
const NOSE_CROWE = rampOf('#6a2a22', '#9a3e30', '#c25a46', '#dc7a62', '#eea08a');

/** Pipe (crowe) with the stem entering the mouth corner at (u, v) head units. */
export function paintPipe(h: HeadCtx, u: number, v: number, ember = true) {
  const W = PALS.pipeWood;
  // stem
  h.limb([u, v], [u + 3.6, v - 0.8], 0.55, 0.6, l => tone(W, l, -0.1));
  h.merge(0.25, 0.1);
  // bowl
  h.blob(u + 4.9, v + 0.9, 1.7, 2.1, l => tone(W, l + 0.1, 0.1, 1.1));
  h.dot(u + 4.4, v + 2.8, W[0]);
  h.dot(u + 5.4, v + 2.8, W[0]);
  if (ember) h.dot(u + 4.9, v + 2.9, hex('#f08a3a'));
  h.merge(0.3, 0.15);
}

const croweHead: HeadDraw = (h, o) => {
  const g = CROWE_GEO();
  const lk = o.look === 'up' ? 1 : o.look === 'down' ? -1 : 0;
  const Bd = PALS.beard;
  // hair tufts sticking out behind (under the beanie)
  clumpHair(h, [{ u: -8.4, v: 9.6, r: 1.9 }, { u: -7.6, v: 13, r: 2.2 }, { u: -6, v: 7.4, r: 1.6 }], Bd, { sphere: [0, 14, 11], bias: -0.2 });
  // skull, ruddy nose bulb
  skull(h, g.skin, [1, 11.6, 9.4, 9.4], [4.8, 6.6, 7, 6.2], !!o.st.pale);
  paintFace(h, g, { ...o, noMouth: true });
  // weathered: crow's feet at the outer corner, cheek colour
  h.pdot(g.eyeN[0] - 3, g.eyeN[1] + lk, shade(g.skin[3], -0.2));
  h.pdot(g.eyeN[0] - 3, g.eyeN[1] - 1 + lk, shade(g.skin[3], -0.1));
  const ch = mix(g.skin[4], hex('#d0463c'), 0.35);
  h.pdot(g.eyeN[0] - 1, g.eyeN[1] - 3 + lk, ch);
  h.pdot(g.eyeN[0], g.eyeN[1] - 3 + lk, ch);
  h.merge(0.2, 0.15);
  h.blob(10.9, 7.4 + lk, 1.8, 1.7, l => tone(NOSE_CROWE, l, 0.15, 1.1));
  h.merge(0.28, 0.12);
  // ear
  h.blob(-2.3, 8, 1.6, 2.2, l => tone(g.skin, l - 0.3, 0, 0.9));
  h.pdot(-2.5, 8, g.skin[2]);
  h.merge(0.3, 0.12);
  // beard: big white, sideburns → jaw → below the chin over the chest
  clumpHair(h, [
    { u: -0.8, v: 9, r: 1.7 }, { u: -0.2, v: 6.2, r: 2.1 },
    { u: 1.6, v: 3.4, r: 2.8 }, { u: 9.6, v: -3.4, r: 2.2 }, { u: 3, v: -1.4, r: 3 }, { u: 6.8, v: -5.4, r: 2.3 },
    { u: 4.4, v: -4.4, r: 2.4 }, { u: 10.8, v: 1.6, r: 2 }, { u: 7.4, v: -2.6, r: 3.1 }, { u: 4.6, v: 1.6, r: 3 },
    { u: 8.2, v: 1.2 + lk * 0.4, r: 2.8 },
  ], Bd, { sphere: [4, 4, 10], bias: 0.15, k: 1.1, hi: 0.7 });
  // mouth (under the moustache, over the beard)
  const m = o.st.mouth[o.mouth];
  const shut = m === 'line' || m === 'flat' || m === 'smile' || m === 'frown' || m === 'purse' || m === 'smirk' || m === 'chew' || m === 'wavy' || m === 'set';
  if (!shut) {
    paintMouth(h, g, o, false, -0.5);
    h.merge(0.15, 0.05);
  }
  // moustache: walrus, droops over the mouth corners
  clumpHair(h, [
    { u: 12.1, v: 3.6 + lk, r: 1.5, ry: 1.4 }, { u: 5.6, v: 4.5 + lk, r: 1.8, ry: 1.3 }, { u: 7.9, v: 5 + lk, r: 2.1, ry: 1.4 },
    { u: 10.4, v: 4.8 + lk, r: 2.1, ry: 1.4 },
  ], Bd, { sphere: [8, 6, 5], bias: 0.3, k: 1, hi: 0.8 });
  // knit beanie: ribbed cuff and a slouchy crown
  const Bn = PALS.beanie;
  const crown = (u: number, v: number) => ((u + 0.2) / 9.5) ** 2 + ((v - 17.6) / 6.6) ** 2 <= 1 && v > 17 || (((u + 5) / 3) ** 2 + ((v - 22.4) / 2.2) ** 2 <= 1);
  const x0 = Math.floor(h.X(-12)), x1 = Math.ceil(h.X(12)), y0 = Math.floor(h.Y(27)), y1 = Math.ceil(h.Y(12));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const u = h.U(x), v = h.V(y);
      if (!crown(u, v)) continue;
      const nx = (u + 0.4) / 10, ny = (v - 18.2) / 8;
      const d = Math.min(1, nx * nx + ny * ny);
      let l = light3(nx * 0.9, -ny * 0.9, Math.sqrt(1 - d));
      // knit rows (every 2 units), slightly curved
      if (((Math.floor(v - u * 0.08 + 0.5) % 2) + 2) % 2 === 0) l -= 0.18;
      h.c.px(x, y, tone(Bn, l, -0.05, 1.1));
    }
  h.merge(0.3, 0.1);
  // cuff (folded brim)
  const cuffTop = (u: number) => 18.2 - (u < -2 ? (-2 - u) * 0.12 : 0);
  const cuffBot = (u: number) => 14.1 - (u < 2 ? (2 - u) * 0.1 : 0) + (u > 7 ? (u - 7) * 0.12 : 0);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const u = h.U(x), v = h.V(y);
      if (u < -10.2 || u > 10.9 || v > cuffTop(u) || v < cuffBot(u)) continue;
      const nx = (u + 0.2) / 10.6;
      let l = light3(nx * 0.95, -0.15, Math.sqrt(Math.max(0, 1 - nx * nx)));
      const rib = ((Math.floor(u * 1.0 + 100) % 2) + 2) % 2;
      if (rib === 0) l -= 0.25;
      if (v > cuffTop(u) - 0.9) l += 0.25;
      h.c.px(x, y, tone(Bn, l, 0.05, 1.1));
    }
  h.merge(0.4, 0.2);
  paintBrows(h, g, o);
  if (!o.st.noPipe) paintPipe(h, 11.6, 3 + lk * 0.5);
};

// ------------------------------------------------------------------ AROHA

const AROHA_GEO = (): FaceGeo => ({
  skin: PALS.skinAroha, eyeN: [3.2, 10], eyeF: [9.2, 10], browY: 13.6, brow: [PALS.hairAroha[0], PALS.hairAroha[1], PALS.hairAroha[2]], browThick: 1,
  nose: [10.4, 6.8], mouth: [7.4, 3.8], iris: hex('#1c100b'), lash: hex('#120806'), sclera: hex('#f4ece0'), lip: hex('#4a1c16'),
  mouthIn: hex('#320e0c'), blush: hex('#c8504a'),
});

function feather(h: HeadCtx, u: number, v: number, ang: number, len: number, w: number) {
  const F = PALS.feather, T = PALS.featherTip;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const x0 = Math.floor(h.X(u - len - 1)), x1 = Math.ceil(h.X(u + len + 1)), y0 = Math.floor(h.Y(v + len + 1)), y1 = Math.ceil(h.Y(v - len - 1));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const du = h.U(x) - u, dv = h.V(y) - v;
      const a = du * ca + dv * sa, b = -du * sa + dv * ca;
      if (a < 0 || a > len) continue;
      const t = a / len;
      const half = w * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (t > 0.85 ? (1 - t) / 0.15 : 1);
      if (Math.abs(b) > Math.max(0.35, half)) continue;
      let c = b > 0 ? F[4] : F[2];
      if (Math.abs(b) < 0.3) c = F[5];
      if (t > 0.72) c = b > 0 ? T[2] : T[1];
      h.c.px(x, y, c);
    }
  h.merge(0.3, 0.1);
}

const arohaHead: HeadDraw = (h, o) => {
  const g = AROHA_GEO();
  const Hr = PALS.hairAroha;
  const lk = o.look === 'up' ? 1 : o.look === 'down' ? -1 : 0;
  // feathers tucked into the topknot (behind the bun)
  feather(h, -4, 24.2, Math.PI * 0.86, 9.6, 1.25);
  feather(h, -3.4, 25, Math.PI * 0.7, 8, 1.15);
  feather(h, -4.4, 23.2, Math.PI * 1.0, 7.4, 1.05);
  // skull + face
  skull(h, g.skin, [0.8, 11.8, 9, 9.6], [4.4, 6.4, 6.7, 6], !!o.st.pale, (u, v) => ((u - 10.4) / 1.2) ** 2 + ((v - 7 - lk) / 1.3) ** 2 <= 1);
  paintFace(h, g, o);
  // kauae: subtle chin moko lines, a darker tone of her skin
  const mk = mix(g.skin[2], hex('#1a2030'), 0.35);
  const cy = 1.6 + lk * 0.6;
  h.pdot(5.6, cy + 0.6, mk); h.pdot(5.6, cy - 0.4, mk);
  h.pdot(7.6, cy, mk);
  h.pdot(9.2, cy + 0.6, mk); h.pdot(9.2, cy - 0.4, mk);
  h.merge(0.2, 0.15);
  // ear + earring
  h.blob(-2.3, 8.2, 1.5, 2.1, l => tone(g.skin, l - 0.3, 0, 0.9));
  h.pdot(-2.5, 8.2, g.skin[1]);
  h.merge(0.3, 0.12);
  // hair: pulled back smoothly into a high topknot; strand highlights
  const hairIn = (u: number, v: number) => {
    const du = u - 0.2, dv = v - 12.6;
    if ((du / 10) ** 2 + (dv / 10.6) ** 2 > 1) return false;
    // hairline: forehead then temple down to the ear
    const hl = u > 1 ? 16.4 - lk * 0.8 - (u > 7 ? (u - 7) * 0.5 : 0) : 16.4 - (1 - u) * 3.6;
    if (u > -0.9 && v < hl) return false;
    if (u > -3.8 && u <= -0.9 && v < 10.6) return false;
    return v > 3.2;
  };
  hairMass(h, hairIn, Hr, { sphere: [0.2, 13.6, 10.6], bias: -0.25, k: 1.2, strand: 2.2, ext: [-11, 12, 2, 24] });
  h.merge(0.3, 0.2);
  // topknot bun with a flax tie
  h.blob(-2.6, 24.4, 3.3, 2.8, (l, nx, ny) => tone(Hr, l + (Math.abs(nx - ny * 0.4) < 0.18 ? 0.35 : 0), -0.1, 1.2));
  h.merge(0.35, 0.15);
  h.blob(-2.2, 21.8, 2.2, 0.9, l => tone(PALS.flax, l + 0.2, 0.1));
  h.merge(0.3, 0.1);
  // loose lock hanging from behind the ear
  h.limb([-3.4, 9.4], [-3.8, -2.6], 1.5, 1.2, (l, u2) => tone(Hr, l + (u2 > 0.3 && u2 < 0.4 ? 0.3 : 0), -0.2, 1.1));
  h.merge(0.3, 0.15);
  // earring: bone/shell drop on a small gold ring
  h.dot(-1.9, 5.4 + lk * 0.5, PALS.brass[4]);
  h.dot(-1.9, 4.4 + lk * 0.5, PALS.cloakCream[3]);
  h.dot(-1.9, 3.4 + lk * 0.5, PALS.cloakCream[1]);
  h.merge(0.25, 0.1);
  paintBrows(h, g, o);
};

// ------------------------------------------------------------------ LOU

const LOU_GEO = (): FaceGeo => ({
  skin: PALS.skinLou, eyeN: [3.4, 10], eyeF: [9.4, 10], browY: 13.4, brow: [hex('#140c0a'), hex('#1e1410'), hex('#3a2a20')], browThick: 1,
  nose: [10.8, 6.8], mouth: [7.6, 3.8], iris: hex('#1c100c'), lash: hex('#140908'), sclera: hex('#f4ece2'), lip: hex('#5a2420'),
  mouthIn: hex('#3a1010'), blush: hex('#e05a50'),
});

const louHead: HeadDraw = (h, o) => {
  const g = LOU_GEO();
  const lk = o.look === 'up' ? 1 : o.look === 'down' ? -1 : 0;
  const Sc = PALS.scarf;
  // scarf tails hanging behind the knot
  h.limb([-6.4, 17.6], [-9.6, 9.4], 1.6, 2.1, (l, u2, v2) => tone(Sc, l + (Math.abs(v2) < 0.25 ? -0.3 : 0), -0.05, 1.1));
  h.merge(0.3, 0.1);
  h.limb([-5.2, 18.4], [-7.4, 11.4], 1.5, 1.9, l => tone(Sc, l + 0.1, 0, 1.1));
  h.merge(0.35, 0.12);
  // round face with full cheeks
  skull(h, g.skin, [1, 11.6, 9.4, 9.4], [4.8, 6.8, 7.2, 6.4], !!o.st.pale, (u, v) => ((u - 10.9) / 1.3) ** 2 + ((v - 7 - lk) / 1.4) ** 2 <= 1);
  paintFace(h, { ...g }, { ...o, st: { ...o.st, blush: Math.max(o.st.blush ?? 0, 0.45) } });
  h.merge(0.2, 0.15);
  // dark curls peeking at the nape and temple
  clumpHair(h, [{ u: -5.6, v: 5.4, r: 1.8 }, { u: -3.6, v: 4.2, r: 1.5 }, { u: -7.4, v: 8, r: 1.7 }, { u: -0.4, v: 13.4, r: 1.3 }], PALS.hairAroha, { sphere: [0, 12, 11], bias: -0.1 });
  // ear + gold hoop
  h.blob(-2.2, 8.2, 1.6, 2.2, l => tone(g.skin, l - 0.3, 0, 0.9));
  h.pdot(-2.4, 8.2, g.skin[1]);
  h.merge(0.3, 0.12);
  h.dot(-2.2, 5.2, PALS.brass[4]);
  h.dot(-2.9, 4.4, PALS.brass[3]);
  h.dot(-2.2, 3.6, PALS.brass[2]);
  h.merge(0.2, 0.05);
  // headscarf: wrapped dome with a folded front band, dots and a coral stripe
  const dome = (u: number, v: number) => ((u - 0.3) / 10.1) ** 2 + ((v - 14.8) / 9.6) ** 2 <= 1 && v > 14.6 - (u < -2 ? (-2 - u) * 0.7 : 0) - (u > 8 ? (u - 8) * 0.4 : 0);
  const x0 = Math.floor(h.X(-12)), x1 = Math.ceil(h.X(12)), y0 = Math.floor(h.Y(27)), y1 = Math.ceil(h.Y(6));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const u = h.U(x), v = h.V(y);
      if (!dome(u, v)) continue;
      const nx = (u - 0.3) / 10.4, ny = (v - 14.8) / 10;
      const d = Math.min(1, nx * nx + ny * ny);
      let l = light3(nx * 0.9, -ny * 0.9, Math.sqrt(1 - d));
      // wrap folds radiating from the knot at the top-back
      const ang = Math.atan2(v - 23, u + 4);
      if (Math.abs(Math.sin(ang * 5.2)) < 0.12 && v < 22) l -= 0.3;
      let c = tone(Sc, l, 0, 1.15);
      const band = v < 17.4 - (u < -2 ? (-2 - u) * 0.7 : 0) - (u > 8 ? (u - 8) * 0.4 : 0);
      if (band) {
        c = tone(PALS.scarfCoral, l + 0.1, 0.05, 1);
        if (Math.abs(v - (16 - (u < -2 ? (-2 - u) * 0.7 : 0) - (u > 8 ? (u - 8) * 0.4 : 0))) < 0.5 && ((Math.floor(u) & 1) === 0)) c = PALS.scarfDot[2];
      } else {
        // polka dots
        const gu = Math.round(u / 3.2) * 3.2 + (Math.round(v / 3) & 1) * 1.6, gv = Math.round(v / 3) * 3;
        if ((u - gu) ** 2 + (v - gv) ** 2 < 0.55) c = tone(PALS.scarfDot, l, 0.2);
      }
      h.c.px(x, y, c);
    }
  h.merge(0.35, 0.2);
  // knot on top (two loops)
  h.blob(-5.4, 22.6, 2.6, 2, (l, nx) => tone(Sc, l + (nx > 0.6 ? -0.3 : 0), 0.05, 1.1), 0.5);
  h.merge(0.35, 0.12);
  h.blob(-2.8, 23.4, 2.3, 1.8, l => tone(Sc, l, 0.1, 1.1), -0.4);
  h.merge(0.35, 0.12);
  // hibiscus tucked in at the side
  const Fp = PALS.flowerPink, Fy = PALS.flowerY;
  tpl(h, ['.p.', 'pyp', '.P.'], -1.6, 16.4, { p: Fp[4], P: Fp[3], y: Fy[2] }, 1);
  h.merge(0.25, 0.1);
  paintBrows(h, g, o);
};

// ------------------------------------------------------------------ PIP

const PIP_GEO = (): FaceGeo => ({
  skin: PALS.skinPip, eyeN: [3.2, 9.6], eyeF: [9, 9.6], browY: 13.2, brow: [PALS.hairPip[0], PALS.hairPip[1], PALS.hairPip[2]], browThick: 1,
  nose: [10.2, 6.6], mouth: [7.2, 3.6], iris: hex('#2a1a14'), lash: hex('#140c10'), sclera: hex('#f8f4ee'), lip: hex('#7a3a34'),
  mouthIn: hex('#4a1616'), blush: hex('#f07a6a'),
});

const pipHead: HeadDraw = (h, o) => {
  const g = PIP_GEO();
  const Hr = PALS.hairPip;
  const lk = o.look === 'up' ? 1 : o.look === 'down' ? -1 : 0;
  skull(h, g.skin, [0.8, 11.6, 9, 9.3], [4.2, 6.2, 6.3, 5.7], !!o.st.pale, (u, v) => ((u - 10) / 1.1) ** 2 + ((v - 6.8 - lk) / 1.2) ** 2 <= 1);
  paintFace(h, g, o);
  // grease smudge on the near cheek
  h.pdot(1, 6 + lk, mix(g.skin[3], PALS.grease, 0.55));
  h.pdot(2, 5.5 + lk, mix(g.skin[3], PALS.grease, 0.4));
  h.merge(0.2, 0.15);
  h.blob(-2.1, 8, 1.5, 2.1, l => tone(g.skin, l - 0.3, 0, 0.9));
  h.pdot(-2.3, 8, g.skin[2]);
  h.merge(0.3, 0.12);
  // short choppy hair: cap + angular fringe spikes, teal streaks
  const fl = -lk * 0.8;
  const spikes: number[][] = [
    [-1.8, 16.4, 1.8, 16.8, 0.4, 11.6],
    [1.2, 17, 5, 17.2, 3.4, 12.8 + fl],
    [4.2, 17.2, 8, 16.8, 6.8, 13.2 + fl],
    [7.2, 16.8, 10.2, 15.2, 9.6, 12.6 + fl],
    [-4, 12, -1, 13, -2.4, 7.4],
  ];
  const capIn = (u: number, v: number) => {
    const du = u - 0.2, dv = v - 12.8;
    const r = Math.hypot(du, dv), th = Math.atan2(dv, du);
    const R = 9.7 + 0.9 * Math.max(0, Math.cos(th * 7 + 0.4)) - (u < -6 ? (-6 - u) * 0.35 : 0);
    if (r > R) return false;
    const hl = 16.2 - (u > 8 ? (u - 8) * 0.7 : 0);
    if (u > -0.8 && v < hl) return false;
    if (u > -3.6 && u <= -0.8 && v < 10.2) return false;
    return v > 3.6 + (u > -3 ? 3 : 0);
  };
  const inSpike = (u: number, v: number) => {
    for (const t of spikes) if (triIn(t, u, v)) return true;
    return false;
  };
  hairMass(h, (u, v) => capIn(u, v) || inSpike(u, v), Hr, { sphere: [0.2, 13.8, 10.6], bias: -0.05, k: 1.3, strand: 2.6, ext: [-11, 12, 3, 24] });
  // teal streak over the fringe
  const x0 = Math.floor(h.X(0)), x1 = Math.ceil(h.X(6)), y0 = Math.floor(h.Y(22)), y1 = Math.ceil(h.Y(12));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const u = h.U(x), v = h.V(y);
      if (Math.abs(u - 3.2 - (v - 17) * 0.25) < 0.9 && (capIn(u, v) || inSpike(u, v))) h.c.pp(x, y, tone(PALS.hairTeal, (v - 15) * 0.12, 0, 1));
    }
  h.merge(0.3, 0.2);
  // welding goggles pushed up: strap around the head, brass cups, tinted lenses
  const strapV = (u: number) => 18.2 + (u < 0 ? u * 0.18 : 0);
  const sx0 = Math.floor(h.X(-10.5)), sx1 = Math.ceil(h.X(10.5));
  for (let y = y0 - 6; y <= y1 + 4; y++)
    for (let x = sx0; x <= sx1; x++) {
      const u = h.U(x), v = h.V(y);
      if (Math.abs(v - strapV(u)) > 0.9) continue;
      if (!capIn(u, v) && !(u > 8 && u < 10.6)) continue;
      h.c.px(x, y, tone(PALS.charcoal, v > strapV(u) ? 0.4 : -0.2, 0.1));
    }
  h.merge(0.3, 0.15);
  const cup = (cu: number, cv: number, ru: number, rv: number) => {
    h.blob(cu, cv, ru, rv, (l, nx, ny) => {
      const d = nx * nx + ny * ny;
      if (d > 0.5) return tone(PALS.goggle, l, 0.15, 1.1);
      if (nx < -0.1 && ny < -0.1) return PALS.lensT[4];
      return tone(PALS.lensT, l, -0.1, 1);
    });
    h.merge(0.35, 0.15);
  };
  cup(2.8, 18.6, 2.6, 2.4);
  cup(7.8, 18.4, 1.9, 2.3);
  h.dot(5.1, 18.4, PALS.goggle[1]);
  h.merge(0.1, 0.05);
  paintBrows(h, g, o);
};

function triIn(t: number[], u: number, v: number) {
  const [ax, ay, bx, by, cx, cy] = t;
  const d1 = (u - bx) * (ay - by) - (ax - bx) * (v - by);
  const d2 = (u - cx) * (by - cy) - (bx - cx) * (v - cy);
  const d3 = (u - ax) * (cy - ay) - (cx - ax) * (v - ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

const HEADS: Partial<Record<CharId, HeadDraw>> = { rowan: rowanHead, crowe: croweHead, aroha: arohaHead, lou: louHead, pip: pipHead };

// ------------------------------------------------------------------ public

const HW = 56, HH = 60, HAX = 26, HAY = 46;

export function drawHeadInto(id: CharId, o: HeadOpts, S: number, w = HW * S, hgt = HH * S, ax = HAX * S, ay = HAY * S): { buf: PixelBuffer; ax: number; ay: number } {
  const c = new Canvas(w, hgt, 0, 0);
  const h = new HeadCtx(c, S, ax, ay);
  const st = FACES[o.expr] ?? FACES.neutral;
  const fn = HEADS[id] ?? rowanHead;
  fn(h, { st, mouth: o.mouth, blink: o.blink, look: o.look });
  if (st.sweat) {
    paintSweat(h, 13, 16);
    h.merge(0.1, 0);
  }
  if (st.tear && !o.blink) {
    const g = ROWAN_GEO();
    paintTear(h, g.eyeN[0] + 1, g.eyeN[1] - 2);
    h.merge(0, 0);
  }
  finish(c.back, 0.12);
  return { buf: c.back, ax, ay };
}

/**
 * In-world head size relative to the S=1 painter. Heads are painted at portrait detail (S=2) and
 * shrunk with a feature-preserving filter, which gives realistic ~7-heads-tall proportions while
 * keeping readable eyes, brows and hair shapes.
 */
export const HEAD_K = 0.66;

const lum = (c: number) => (c & 255) * 0.3 + ((c >>> 8) & 255) * 0.55 + ((c >>> 16) & 255) * 0.15;

/** Area-average downscale that snaps to source colours and keeps small dark features (eyes, lashes, outlines). */
export function shrinkPixels(src: PixelBuffer, sax: number, say: number, k: number): { buf: PixelBuffer; ax: number; ay: number } {
  const inv = 1 / k;
  // align the grid so the anchor lands exactly on a target pixel corner
  const tax = Math.ceil(sax * k) + 1, tay = Math.ceil(say * k) + 1;
  const gx = sax - tax * inv, gy = say - tay * inv;
  const W = Math.ceil((src.w - gx) * k) + 1, H = Math.ceil((src.h - gy) * k) + 1;
  const out = new PixelBuffer(W, H);
  const cols: number[] = [], ws: number[] = [];
  for (let j = 0; j < H; j++) {
    const y0 = gy + j * inv, y1 = y0 + inv;
    for (let i = 0; i < W; i++) {
      const x0 = gx + i * inv, x1 = x0 + inv;
      let A = 0, T = 0, r = 0, g = 0, b = 0;
      cols.length = 0; ws.length = 0;
      for (let y = Math.floor(y0); y < y1; y++) {
        const wy = Math.min(y + 1, y1) - Math.max(y, y0);
        if (wy <= 0) continue;
        for (let x = Math.floor(x0); x < x1; x++) {
          const wx = Math.min(x + 1, x1) - Math.max(x, x0);
          if (wx <= 0) continue;
          const w = wx * wy;
          T += w;
          const c = src.get(x, y);
          const a = (c >>> 24) / 255;
          if (a <= 0) continue;
          const wa = w * a;
          A += wa;
          r += (c & 255) * wa; g += ((c >>> 8) & 255) * wa; b += ((c >>> 16) & 255) * wa;
          const idx = cols.indexOf(c);
          if (idx < 0) { cols.push(c); ws.push(wa); } else ws[idx] += wa;
        }
      }
      if (T <= 0 || A / T < 0.42) continue;
      r /= A; g /= A; b /= A;
      const al = r * 0.3 + g * 0.55 + b * 0.15;
      // darkest feature colour in the box
      let dk = -1, dl = 1e9;
      for (let n = 0; n < cols.length; n++) { const l = lum(cols[n]); if (l < dl) { dl = l; dk = n; } }
      let pick = -1;
      if (dk >= 0 && ws[dk] / A > 0.2 && dl < al - 55) pick = dk;
      else {
        let best = 1e9;
        for (let n = 0; n < cols.length; n++) {
          const c = cols[n];
          const d = ((c & 255) - r) ** 2 + (((c >>> 8) & 255) - g) ** 2 + (((c >>> 16) & 255) - b) ** 2;
          if (d < best) { best = d; pick = n; }
        }
      }
      out.set(i, j, (cols[pick] | 0xff000000) >>> 0);
    }
  }
  return { buf: out, ax: tax, ay: tay };
}

const GEOS: Record<CharId, () => FaceGeo> = { rowan: ROWAN_GEO, crowe: CROWE_GEO, aroha: AROHA_GEO, lou: LOU_GEO, pip: PIP_GEO };

/** Re-draw crisp mini eyes and brows over a shrunk head so faces stay clear and expressive. */
function miniFace(buf: PixelBuffer, ax: number, ay: number, id: CharId, o: HeadOpts) {
  const g = (GEOS[id] ?? ROWAN_GEO)();
  const st = FACES[o.expr] ?? FACES.neutral;
  const lk = o.look === 'up' ? 1 : o.look === 'down' ? -1 : 0;
  const K = HEAD_K;
  const pal: Record<string, number> = { L: g.lash, I: g.iris, W: g.sclera, B: g.brow[1], b: g.brow[0] };
  const eye = (e: P2, near: boolean, shape: EyeShape, bo: [number, number]) => {
    const px = Math.round(ax + e[0] * K), py = Math.round(ay - (e[1] + lk * 0.6) * K);
    const skin = buf.get(px, py + 2) >>> 24 ? buf.get(px, py + 2) : g.skin[3];
    let sh: EyeShape = o.blink && shape !== 'arc' && shape !== 'sleep' ? 'closed' : shape;
    if (st.pupil === 't' && sh === 'open') sh = 'wide';
    const rows: Record<string, string[]> = near
      ? { open: ['LL', 'WI'], half: ['LL', 'LI'], squint: ['LL', 'LI'], sad: ['.L', 'WI'], wide: ['LL', 'WI', 'WW'], happy: ['LL', '..'], arc: ['LL', '..'], closed: ['..', 'LL'], sleep: ['..', 'LL'] }
      : { open: ['L', 'I'], half: ['L', 'I'], squint: ['L', 'I'], sad: ['L', 'I'], wide: ['L', 'I', 'W'], happy: ['L', '.'], arc: ['L', '.'], closed: ['.', 'L'], sleep: ['.', 'L'] };
    const t = rows[sh] ?? rows.open;
    const x0 = near ? px - 1 : px;
    t.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const x = x0 + i, y = py - 1 + j;
        if (!(buf.get(x, y) >>> 24)) continue;
        buf.set(x, y, row[i] === '.' ? skin : pal[row[i]]);
      }
    });
    // brow: inner end toward the nose (right)
    const by = py - 3;
    const w = near ? 2 : 2;
    for (let i = 0; i < w; i++) {
      const inner = near ? i === w - 1 : i === 0;
      const d = inner ? bo[0] : bo[1];
      const y = by - Math.round(Math.max(-1.4, Math.min(2.2, d)) * 0.55);
      const x = x0 + i - (near ? 0 : 0);
      if (buf.get(x, y) >>> 24) buf.set(x, y, inner ? pal.B : pal.b);
    }
  };
  eye(g.eyeN, true, st.eye, st.bn);
  eye(g.eyeF, false, st.eyeF ?? st.eye, st.bf);
}

/** crisp sprite-size eyes, brows and mouth over a shrunk portrait-design head */
function miniFaceDtd(buf: PixelBuffer, ax: number, ay: number, id: BustId, o: HeadOpts) {
  const d = DESIGNS[id];
  const ex = EXPR_PARAMS[o.expr as PExpr] ?? EXPR_PARAMS.neutral;
  const K = DTD_K;
  const ey = d.face.eyes.y ?? 0, by = (d.face.brow.y ?? 0) + ey;
  const P = (u: number, v: number): [number, number] => [Math.round(ax + (u - 90) * K), Math.round(ay + (v - 112) * K)];
  const ink = hex('#1a1016'), white = hex('#f6f2ee'), iris = hex(d.face.eyes.iris), brow = hex(d.face.brow.col);
  const set = (x: number, y: number, c: number) => { if (buf.get(x, y) >>> 24) buf.set(x, y, c); };
  const skinAt = (x: number, y: number) => { const c = buf.get(x, y + 2); return c >>> 24 ? c : buf.get(x, y + 1); };
  const shape = o.blink && ex.eye !== 'closed' && ex.eye !== 'happy' ? 'closed' : ex.eye;
  const eye = (u: number, v: number, near: boolean) => {
    const [x, y] = P(u, v);
    const sk = skinAt(x, y);
    const cells: [number, number, number][] = [];
    const w = near ? 2 : 1;
    if (shape === 'closed' || shape === 'happy') {
      for (let i = 0; i < w; i++) cells.push([x - (near ? 1 : 0) + i, y, ink], [x - (near ? 1 : 0) + i, y - 1, sk]);
      if (shape === 'happy' && near) cells.push([x - 1, y, sk], [x - 1, y - 1, ink], [x, y - 1, ink]);
    } else {
      const x0 = near ? x - 1 : x;
      if (near) cells.push([x0, y - 1, ink], [x0 + 1, y - 1, ink], [x0, y, shape === 'half' || shape === 'squint' ? ink : white], [x0 + 1, y, iris]);
      else cells.push([x0, y - 1, ink], [x0, y, iris]);
      if (shape === 'wide') { if (near) cells.push([x0, y + 1, white], [x0 + 1, y + 1, white]); else cells.push([x0, y + 1, white]); }
    }
    for (const [cx, cy, c] of cells) set(cx, cy, c);
  };
  const an = !!d.face.anime;
  eye(an ? 104 : 102, (an ? 84 : 80) + ey, true);
  eye(an ? 127 : 126, (an ? 83 : 79.5) + ey, false);
  if (id === 'pip') {
    // glasses: the frame rim doubles as the lash line so the eyes stay visible
    const g = hex('#d0407e');
    const [nx, ny] = P(104, 84), [qx, qy] = P(127.5, 83);
    for (let i = -2; i <= 1; i++) set(nx + i, ny - 1, g);
    set(nx - 1, ny, white); set(nx, ny, iris); set(nx - 2, ny, g); set(nx + 1, ny, g);
    for (let x = nx + 2; x < qx; x++) set(x, ny - 1, g);
    set(qx, qy - 1, g); set(qx + 1, qy - 1, g); set(qx, qy, iris); set(qx + 1, qy, g);
    set(nx - 3, ny - 1, g);
  }
  // brows: near 3 px, far 2 px; inner end rises/falls with the expression
  const bOff = (k: number) => Math.round(Math.max(-1.5, Math.min(2, k)) * 0.45);
  const [bx, byy] = P(100, 68 + by);
  set(bx - 2, byy - bOff(ex.bOut), brow); set(bx - 1, byy - bOff((ex.bOut + ex.bIn) / 2), brow); set(bx, byy - bOff(ex.bIn), brow);
  const [fx, fy] = P(127, 68 + by);
  set(fx, fy - bOff(ex.bIn), brow); set(fx + 1, fy - bOff(ex.bOut), brow);
  // mouth
  const [mx, my] = P(123, 106.5);
  const inside = hex('#5a1620');
  const open = o.mouth === 2 || ex.mouth === 'shout' ? 2 : o.mouth === 1 || ex.mouth === 'o' || ex.mouth === 'open' || ex.mouth === 'grin' ? 1 : 0;
  if (id === 'crowe' && !open) return; // the mustache hides a closed mouth
  if (open === 2) { set(mx - 1, my, inside); set(mx, my, inside); set(mx - 1, my + 1, inside); set(mx, my + 1, hex('#c04a5a')); set(mx - 1, my - 1, white); set(mx, my - 1, white); }
  else if (open === 1) { set(mx - 1, my, inside); set(mx, my, inside); }
  else if (ex.mouth === 'smile' || ex.mouth === 'smirk') { set(mx - 1, my, shade(skinAt(mx, my), -0.35)); set(mx, my, shade(skinAt(mx, my), -0.35)); set(mx + 1, my - 1, shade(skinAt(mx, my), -0.35)); }
  else if (ex.mouth === 'frown' || ex.mouth === 'grit') { set(mx - 1, my, shade(skinAt(mx, my), -0.35)); set(mx, my - (ex.mouth === 'frown' ? 1 : 0), ex.mouth === 'grit' ? white : shade(skinAt(mx, my), -0.35)); }
}

/** in-game head size: design units → sprite pixels (crown-to-chin ≈ 103 units ≈ 16 px) */
export const DTD_K = 0.178;
const DTD_S = 0.6;

export function renderHeadRaw(id: CharId, o: HeadOpts) {
  if (id in DESIGNS) {
    // Dave-the-Diver-style head from the portrait designs, shrunk to sprite size
    const big = renderBust(id as BustId, o.expr as PExpr, { scale: DTD_S, headOnly: true, noNeck: true, talk: o.mouth, blink: o.blink });
    const sm = shrinkPixels(big, 90 * DTD_S, 112 * DTD_S, DTD_K / DTD_S);
    miniFaceDtd(sm.buf, sm.ax, sm.ay, id as BustId, o);
    const t = sm.buf.trim(0);
    return { buf: t.buf, ax: sm.ax - t.ox, ay: sm.ay - t.oy };
  }
  const r = drawHeadInto(id, o, 2);
  const sm = shrinkPixels(r.buf, r.ax, r.ay, HEAD_K / 2);
  miniFace(sm.buf, sm.ax, sm.ay, id, o);
  const t = sm.buf.trim(0);
  return { buf: t.buf, ax: sm.ax - t.ox, ay: sm.ay - t.oy };
}

export { FACES };
export type { FaceState };
void at;

// V2 people: skeleton, pose interpolation, shaded rasterizers and part compositing.
//
// Coordinates: poses are authored in GROUND space (x forward = facing right, y up, origin = the
// anchor on the ground between the feet). Drawing happens in BUFFER space (y down); `Canvas`
// converts. Every body part is rasterized into a scratch layer and merged into the target buffer
// with an interior contact line (darker local colour) and a soft cast shadow on what lies beneath,
// which gives clean separation between overlapping limbs without black outlines everywhere.

import { PixelBuffer } from './pixel';
import { C, hex, shade, mix, rgba, R, G, B } from './color';

export type P2 = [number, number];

// ------------------------------------------------------------------ light

/** Key light direction (screen space, y down, z toward viewer): from the top-left. */
export const LIGHT = { x: -0.56, y: -0.64, z: 0.53 };
export const light3 = (nx: number, ny: number, nz: number) => nx * LIGHT.x + ny * LIGHT.y + nz * LIGHT.z;

/** Pick a tone from a dark→light ramp. `l` is roughly -1..1; bias shifts, k scales contrast. */
export function tone(r: C[], l: number, bias = 0, k = 1): C {
  const t = (l * k + bias) * 0.5 + 0.5;
  const n = r.length;
  if (n >= 4 && FLAT.on) {
    // Dave-the-Diver-style cel shading: one shadow, a broad base and a thin highlight
    const mid = Math.round((n - 1) * 0.66), lo = n >= 6 ? mid - 1 : Math.round((n - 1) * 0.4), hi = Math.round((n - 1) * 0.88);
    return r[t < 0.12 ? Math.max(0, lo - 1) : t < 0.36 ? lo : t < 0.84 ? mid : hi];
  }
  let i = Math.floor(t * n);
  if (i < 0) i = 0;
  else if (i >= n) i = n - 1;
  return r[i];
}
/** global switch for the flat (cel) people style */
export const FLAT = { on: true };
export const rampOf = (...h: string[]): C[] => h.map(x => hex(x));
export const clampi = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const at = (r: C[], i: number) => r[clampi(Math.round(i), 0, r.length - 1)];

// ------------------------------------------------------------------ skeleton

export type Hand = 'fist' | 'open' | 'grip' | 'point' | 'flat' | 'pinch' | 'relax' | 'none' | 'wave' | 'cup' | 'hook' | 'claw' | 'thumb';

export interface ArmP {
  /** FK: shoulder angle, 0 = hanging down, + swings forward (toward facing), PI = straight up */
  a?: number;
  /** FK: elbow bend added to `a` for the forearm (+ = forearm folds forward/up) */
  e?: number;
  /** IK: hand (wrist) target in ground space */
  ik?: P2;
  /** IK: bend the elbow forward/down instead of back/out */
  flip?: boolean;
  hand?: Hand;
  /** hand angle override (ground space radians, 0 = pointing forward, + = up) */
  ha?: number;
  /** V7 hands (src/art/v7/hands.ts): where the palm faces ('in' toward the body by default) */
  palm?: 'in' | 'out' | 'up' | 'down' | 'fwd' | 'back' | 'cam';
  /** V7 hands: wrist flex in radians (+ tips the hand toward the palm, - bends it back) */
  flex?: number;
  /** V7 hands: wrist tilt toward the thumb (radians) */
  dev?: number;
  /** V7 hands: how far the fingers fan (1 = the shape's own splay) */
  spread?: number;
}

export interface LegP {
  /** ankle position in ground space */
  f: P2;
  /** foot pitch (+ = toe up) */
  fa?: number;
  /** knee bends backward (rare: e.g. legs tucked behind) */
  kb?: boolean;
}

export interface PropP {
  kind: string;
  x: number;
  y: number;
  a?: number;
  s?: number;
  /** frame / variant parameter */
  t?: number;
  /** draw stage: 'back' (behind everything), 'mid' (after torso), 'hand' (after front arm, default) */
  z?: 'back' | 'mid' | 'hand' | 'top';
  /** goes to the front buffer */
  front?: boolean;
}

export interface Pose {
  hip: P2;
  lean: number;
  /** torso squash (1 = normal): <1 squashes (land) */
  sq?: number;
  /** head offset from the neck top (ground px) */
  hd?: P2;
  fa: ArmP;
  ba: ArmP;
  fl: LegP;
  bl: LegP;
  props?: PropP[];
  look?: 'fwd' | 'up' | 'down';
  /** parts routed to the front buffer: 'armF', 'armB' */
  front?: string[];
  /** draw the front leg after the torso (knee in front of the belly) */
  legFwd?: boolean;
  /** draw the back leg after the torso too */
  legBFwd?: boolean;
  /** draw the back arm after the torso (reaching across the front) */
  armBFwd?: boolean;
  /** secondary motion: trailing offset for cloak/pack/hair (px, + = trails backward) */
  sway?: number;
  /** secondary vertical offset for pack/cloak (px, + = up) */
  bounce?: number;
  headBehind?: boolean;
  /** pose flavour flags for per-character painters */
  flags?: Record<string, number>;
  /** V7: a real object in the hands (src/art/v7/held.ts draws it where the pose put the hands) */
  held?: { kind: string; /** fill level, count, open/closed... per kind */ v?: number; /** animation phase 0..1 */ t?: number };
}

export interface Build {
  hipH: number;
  thigh: number;
  shin: number;
  ankleH: number;
  torso: number;
  neck: number;
  shY: number;
  shF: number;
  shB: number;
  upArm: number;
  foreArm: number;
  legF: number;
  legB: number;
}

export interface Joints {
  hip: P2;
  up: P2;
  fwd: P2;
  lean: number;
  sq: number;
  neckBase: P2;
  neckTop: P2;
  shF: P2;
  shB: P2;
  elF: P2;
  wrF: P2;
  elB: P2;
  wrB: P2;
  hipF: P2;
  hipB: P2;
  knF: P2;
  anF: P2;
  knB: P2;
  anB: P2;
}

/** 2-bone IK in ground space. s = +1 bends the middle joint to the left of root→target (forward for a leg). */
export function ik2(root: P2, target: P2, l1: number, l2: number, s: number): [P2, P2] {
  let dx = target[0] - root[0], dy = target[1] - root[1];
  let d = Math.hypot(dx, dy);
  const maxd = l1 + l2 - 0.01;
  let tx = target[0], ty = target[1];
  if (d > maxd) {
    const k = maxd / d;
    dx *= k; dy *= k;
    d = maxd;
    tx = root[0] + dx; ty = root[1] + dy;
  }
  const mind = Math.abs(l1 - l2) + 0.01;
  if (d < mind) {
    const k = mind / Math.max(d, 1e-4);
    dx *= k; dy *= k;
    if (d < 1e-4) { dx = 0; dy = -mind; }
    d = mind;
    tx = root[0] + dx; ty = root[1] + dy;
  }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const mx = root[0] + (dx * a) / d, my = root[1] + (dy * a) / d;
  // perpendicular (rotate dir by +90° in y-up space = to the left)
  const px = -dy / d, py = dx / d;
  return [[mx + s * px * h, my + s * py * h], [tx, ty]];
}

const rot = (v: P2, a: number): P2 => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
const add = (a: P2, b: P2): P2 => [a[0] + b[0], a[1] + b[1]];
const sc = (a: P2, k: number): P2 => [a[0] * k, a[1] * k];

/** Resolve a pose into joint positions (ground space). */
export function solve(b: Build, p: Pose): Joints {
  const lean = p.lean;
  const sq = p.sq ?? 1;
  // torso up vector in ground space (y up): lean forward rotates clockwise
  const up: P2 = [Math.sin(lean), Math.cos(lean)];
  const fwd: P2 = [Math.cos(lean), -Math.sin(lean)];
  const hip = p.hip;
  const T = b.torso * sq;
  const local = (x: number, y: number): P2 => add(hip, add(sc(fwd, x), sc(up, y)));
  const neckBase = local(0, T);
  const hd = p.hd ?? [0, 0];
  // the neck leans a little less than the torso
  const nUp: P2 = [Math.sin(lean * 0.6), Math.cos(lean * 0.6)];
  const neckTop = add(add(neckBase, sc(nUp, b.neck)), hd);
  const shF = local(b.shF, T - b.shY);
  const shB = local(b.shB, T - b.shY + 0.5);
  const arm = (sh: P2, a: ArmP): [P2, P2] => {
    if (a.ik) return ik2(sh, a.ik, b.upArm, b.foreArm, a.flip ? 1 : -1);
    const A = a.a ?? 0, E = a.e ?? 0;
    const el: P2 = [sh[0] + Math.sin(A) * b.upArm, sh[1] - Math.cos(A) * b.upArm];
    const wr: P2 = [el[0] + Math.sin(A + E) * b.foreArm, el[1] - Math.cos(A + E) * b.foreArm];
    return [el, wr];
  };
  const [elF, wrF] = arm(shF, p.fa);
  const [elB, wrB] = arm(shB, p.ba);
  const hipF = local(b.legF, 0);
  const hipB = local(b.legB, 0.5);
  const [knF, anF] = ik2(hipF, p.fl.f, b.thigh, b.shin, p.fl.kb ? -1 : 1);
  const [knB, anB] = ik2(hipB, p.bl.f, b.thigh, b.shin, p.bl.kb ? -1 : 1);
  return { hip, up, fwd, lean, sq, neckBase, neckTop, shF, shB, elF, wrF, elB, wrB, hipF, hipB, knF, anF, knB, anB };
}

// ------------------------------------------------------------------ pose interpolation

function lerpN(a: number | undefined, b: number | undefined, t: number, d = 0) {
  const x = a ?? d, y = b ?? d;
  return x + (y - x) * t;
}
function lerpP(a: P2 | undefined, b: P2 | undefined, t: number): P2 | undefined {
  if (!a && !b) return undefined;
  const x = a ?? b!, y = b ?? a!;
  return [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t];
}
function lerpArm(a: ArmP, b: ArmP, t: number): ArmP {
  const hand = t < 0.5 ? a.hand : b.hand;
  if (a.ik && b.ik) return { ik: lerpP(a.ik, b.ik, t), flip: t < 0.5 ? a.flip : b.flip, hand, ha: a.ha !== undefined || b.ha !== undefined ? lerpN(a.ha, b.ha, t, a.ha ?? b.ha) : undefined };
  if (a.ik || b.ik) return t < 0.5 ? a : b;
  return { a: lerpN(a.a, b.a, t), e: lerpN(a.e, b.e, t), hand, ha: a.ha !== undefined || b.ha !== undefined ? lerpN(a.ha, b.ha, t, a.ha ?? b.ha) : undefined };
}
function lerpLeg(a: LegP, b: LegP, t: number): LegP {
  return { f: lerpP(a.f, b.f, t)!, fa: lerpN(a.fa, b.fa, t), kb: t < 0.5 ? a.kb : b.kb };
}
function lerpProps(a: PropP[] | undefined, b: PropP[] | undefined, t: number): PropP[] | undefined {
  if (!a || !b) return t < 0.5 ? a : b;
  return a.map((pa, i) => {
    const pb = b.find(q => q.kind === pa.kind) ?? b[i];
    if (!pb || pb.kind !== pa.kind) return pa;
    return { ...pa, x: lerpN(pa.x, pb.x, t), y: lerpN(pa.y, pb.y, t), a: lerpN(pa.a, pb.a, t), s: lerpN(pa.s, pb.s, t, 1), t: lerpN(pa.t, pb.t, t) };
  });
}
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const pick = <T>(x: T, y: T) => (t < 0.5 ? x : y);
  return {
    hip: lerpP(a.hip, b.hip, t)!,
    lean: lerpN(a.lean, b.lean, t),
    sq: lerpN(a.sq, b.sq, t, 1),
    hd: lerpP(a.hd, b.hd, t),
    fa: lerpArm(a.fa, b.fa, t),
    ba: lerpArm(a.ba, b.ba, t),
    fl: lerpLeg(a.fl, b.fl, t),
    bl: lerpLeg(a.bl, b.bl, t),
    props: lerpProps(a.props, b.props, t),
    look: pick(a.look, b.look),
    front: pick(a.front, b.front),
    legFwd: pick(a.legFwd, b.legFwd),
    legBFwd: pick(a.legBFwd, b.legBFwd),
    armBFwd: pick(a.armBFwd, b.armBFwd),
    sway: lerpN(a.sway, b.sway, t),
    bounce: lerpN(a.bounce, b.bounce, t),
    headBehind: pick(a.headBehind, b.headBehind),
    flags: pick(a.flags, b.flags),
  };
}

const easeIO = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/**
 * Sample keyframes at phase t (0..1). Keys are evenly spaced; loop wraps the last key back to
 * the first. Interpolation is eased so poses hold a little at each key.
 */
export function keys(t: number, ks: Pose[], loop = true, eased = true): Pose {
  const n = ks.length;
  if (n === 1) return ks[0];
  const span = loop ? n : n - 1;
  let f = t * span;
  if (!loop) f = Math.min(f, n - 1);
  const i = Math.floor(f) % n;
  const j = loop ? (i + 1) % n : Math.min(i + 1, n - 1);
  const u = f - Math.floor(f);
  return lerpPose(ks[i], ks[j], eased ? easeIO(u) : u);
}

// ------------------------------------------------------------------ canvas & compositing

export interface Sample {
  x: number;
  y: number;
  /** along-part coordinate (0..1) */
  u: number;
  /** across-part coordinate (-1..1) */
  v: number;
  /** light (-1..1) */
  l: number;
  /** part-local pixel coords (torso: lx forward, ly up) */
  lx: number;
  ly: number;
}
export type Shader = (s: Sample) => C | -1;

export interface MergeOpts {
  /** interior contact line strength on the shadow side (bottom/right) */
  line?: number;
  /** interior line strength on the lit side (top/left) */
  lineLit?: number;
  /** cast shadow strength on pixels beneath (down/right of the part) */
  ao?: number;
  /** custom interior line colour (V5 sprites): pixel colour + strength -> line colour */
  lineFn?: (c: C, k: number) => C;
  /** custom cast shadow colour on the pixel beneath */
  aoFn?: (c: C, k: number) => C;
}

export class Canvas {
  readonly w: number;
  readonly h: number;
  readonly back: PixelBuffer;
  front: PixelBuffer | null = null;
  readonly tmp: PixelBuffer;
  target: PixelBuffer;
  private x0 = 1e9;
  private y0 = 1e9;
  private x1 = -1;
  private y1 = -1;
  private readonly S: Sample = { x: 0, y: 0, u: 0, v: 0, l: 0, lx: 0, ly: 0 };
  constructor(w: number, h: number, readonly ox: number, readonly oy: number) {
    this.w = w;
    this.h = h;
    this.back = new PixelBuffer(w, h);
    this.tmp = new PixelBuffer(w, h);
    this.target = this.back;
  }
  /** ground → buffer */
  X(x: number) { return this.ox + x; }
  Y(y: number) { return this.oy - y; }
  B(p: P2): P2 { return [this.ox + p[0], this.oy - p[1]]; }

  useFront(on: boolean) {
    if (on) {
      if (!this.front) this.front = new PixelBuffer(this.w, this.h);
      this.target = this.front;
    } else this.target = this.back;
  }

  touch(x0: number, y0: number, x1: number, y1: number) {
    if (x0 < this.x0) this.x0 = Math.max(0, Math.floor(x0));
    if (y0 < this.y0) this.y0 = Math.max(0, Math.floor(y0));
    if (x1 > this.x1) this.x1 = Math.min(this.w - 1, Math.ceil(x1));
    if (y1 > this.y1) this.y1 = Math.min(this.h - 1, Math.ceil(y1));
  }
  /** write one pixel into the current part layer */
  px(x: number, y: number, c: C) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.tmp.data[y * this.w + x] = c;
    this.touch(x, y, x, y);
  }
  /** paint only over pixels already in the current part */
  pp(x: number, y: number, c: C) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (this.tmp.data[i] >>> 24) this.tmp.data[i] = c;
  }
  /** read from the current part layer */
  tg(x: number, y: number): C {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.tmp.data[y * this.w + x];
  }
  line(x0: number, y0: number, x1: number, y1: number, c: C) {
    x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.floor(x1); y1 = Math.floor(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let g = 0; g < 4000; g++) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /** line painted only over the part */
  pline(x0: number, y0: number, x1: number, y1: number, c: C) {
    x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.floor(x1); y1 = Math.floor(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let g = 0; g < 4000; g++) {
      this.pp(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  rect(x: number, y: number, w: number, h: number, c: C) {
    for (let yy = Math.floor(y); yy < Math.floor(y + h); yy++) for (let xx = Math.floor(x); xx < Math.floor(x + w); xx++) this.px(xx, yy, c);
  }

  /** Capsule from a to b (buffer space) with radii ra→rb, cylinder-shaded. capB=false: flat end at b. */
  limb(a: P2, b: P2, ra: number, rb: number, sh: Shader, capA = true, capB = true) {
    const ax = a[0], ay = a[1], bx = b[0], by = b[1];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const len = Math.sqrt(len2) || 1e-4;
    const ux = dx / len, uy = dy / len;
    const pxv = -uy, pyv = ux;
    const rmax = Math.max(ra, rb);
    const x0 = Math.floor(Math.min(ax, bx) - rmax - 1), x1 = Math.ceil(Math.max(ax, bx) + rmax + 1);
    const y0 = Math.floor(Math.min(ay, by) - rmax - 1), y1 = Math.ceil(Math.max(ay, by) + rmax + 1);
    const S = this.S;
    for (let y = Math.max(0, y0); y <= Math.min(this.h - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(this.w - 1, x1); x++) {
        const rx = x + 0.5 - ax, ry = y + 0.5 - ay;
        let t = len2 > 1e-6 ? (rx * dx + ry * dy) / len2 : 0;
        if ((!capA && t < 0) || (!capB && t > 1)) continue;
        const tc = t < 0 ? 0 : t > 1 ? 1 : t;
        const r = ra + (rb - ra) * tc;
        const cx = ax + dx * tc, cy = ay + dy * tc;
        const ex = x + 0.5 - cx, ey = y + 0.5 - cy;
        const d2 = ex * ex + ey * ey;
        if (d2 > r * r) continue;
        const nx = ex / r, ny = ey / r;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        S.x = x; S.y = y; S.u = t; S.v = (rx * pxv + ry * pyv) / r;
        S.l = light3(nx, ny, nz);
        S.lx = rx * ux + ry * uy; S.ly = rx * pxv + ry * pyv;
        const c = sh(S);
        if (c === -1) continue;
        this.tmp.data[y * this.w + x] = c;
        this.touch(x, y, x, y);
      }
  }

  /** Ellipse (buffer space) with sphere shading; u/v = normalised offsets. */
  blob(cx: number, cy: number, rx: number, ry: number, sh: Shader, rotA = 0) {
    const r = Math.max(rx, ry);
    const ca = Math.cos(rotA), sa = Math.sin(rotA);
    const S = this.S;
    for (let y = Math.max(0, Math.floor(cy - r - 1)); y <= Math.min(this.h - 1, Math.ceil(cy + r + 1)); y++)
      for (let x = Math.max(0, Math.floor(cx - r - 1)); x <= Math.min(this.w - 1, Math.ceil(cx + r + 1)); x++) {
        const qx = x + 0.5 - cx, qy = y + 0.5 - cy;
        const lx = qx * ca + qy * sa, ly = -qx * sa + qy * ca;
        const nx = lx / rx, ny = ly / ry;
        const d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2);
        // rotate normal back to screen
        const sx = nx * ca - ny * sa, sy = nx * sa + ny * ca;
        S.x = x; S.y = y; S.u = nx; S.v = ny; S.l = light3(sx * 0.9, sy * 0.9, nz); S.lx = lx; S.ly = ly;
        const c = sh(S);
        if (c === -1) continue;
        this.tmp.data[y * this.w + x] = c;
        this.touch(x, y, x, y);
      }
  }

  /** Polygon (buffer space). Shader gets x/y; u/v are 0. */
  poly(pts: number[], sh: Shader) {
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < pts.length; i += 2) { minY = Math.min(minY, pts[i]); maxY = Math.max(maxY, pts[i]); }
    const n = pts.length / 2;
    const xs: number[] = [];
    const S = this.S;
    for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(this.h - 1, Math.ceil(maxY)); y++) {
      const sy = y + 0.5;
      xs.length = 0;
      for (let i = 0; i < n; i++) {
        const ax = pts[i * 2], ay = pts[i * 2 + 1];
        const bx = pts[((i + 1) % n) * 2], by = pts[((i + 1) % n) * 2 + 1];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.round(xs[k])), xb = Math.min(this.w - 1, Math.round(xs[k + 1]) - 1);
        for (let x = xa; x <= xb; x++) {
          S.x = x; S.y = y; S.u = 0; S.v = 0; S.l = 0; S.lx = x; S.ly = y;
          const c = sh(S);
          if (c === -1) continue;
          this.tmp.data[y * this.w + x] = c;
          this.touch(x, y, x, y);
        }
      }
    }
  }

  /**
   * Generic local-frame shape: iterate the bbox, map each pixel to a local frame (origin o,
   * forward axis f, up axis u in buffer space) and let `inside` + `sh` decide.
   */
  frame(o: P2, fx: P2, uy: P2, ext: [number, number, number, number], sh: (lx: number, ly: number, S: Sample) => C | -1) {
    // ext = [minLx, maxLx, minLy, maxLy] in local units
    const corners: P2[] = [];
    for (const lx of [ext[0], ext[1]]) for (const ly of [ext[2], ext[3]]) corners.push([o[0] + fx[0] * lx + uy[0] * ly, o[1] + fx[1] * lx + uy[1] * ly]);
    const bx0 = Math.floor(Math.min(...corners.map(c => c[0]))) - 1, bx1 = Math.ceil(Math.max(...corners.map(c => c[0]))) + 1;
    const by0 = Math.floor(Math.min(...corners.map(c => c[1]))) - 1, by1 = Math.ceil(Math.max(...corners.map(c => c[1]))) + 1;
    // inverse of [fx uy] basis (assumed orthonormal)
    const S = this.S;
    for (let y = Math.max(0, by0); y <= Math.min(this.h - 1, by1); y++)
      for (let x = Math.max(0, bx0); x <= Math.min(this.w - 1, bx1); x++) {
        const qx = x + 0.5 - o[0], qy = y + 0.5 - o[1];
        const lx = qx * fx[0] + qy * fx[1];
        const ly = qx * uy[0] + qy * uy[1];
        S.x = x; S.y = y;
        const c = sh(lx, ly, S);
        if (c === -1) continue;
        this.tmp.data[y * this.w + x] = c;
        this.touch(x, y, x, y);
      }
  }

  /** Merge the current part layer into the target with contact lines and cast shadow. */
  merge(o: MergeOpts = {}) {
    if (this.x1 < 0) return;
    const line = o.line ?? 0.3, lineLit = o.lineLit ?? 0.1, ao = o.ao ?? 0.22;
    const w = this.w, T = this.target.data, P = this.tmp.data;
    const x0 = Math.max(0, this.x0 - 2), y0 = Math.max(0, this.y0 - 2), x1 = Math.min(w - 1, this.x1 + 2), y1 = Math.min(this.h - 1, this.y1 + 2);
    const inP = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < this.h && P[y * w + x] >>> 24 > 0;
    const inT = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < this.h && T[y * w + x] >>> 24 > 0;
    // cast shadow onto existing pixels not covered by the part
    if (ao > 0)
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const i = y * w + x;
          if (P[i] >>> 24 || !(T[i] >>> 24)) continue;
          const near = inP(x - 1, y) || inP(x, y - 1) || inP(x - 1, y - 1);
          if (near) T[i] = o.aoFn ? o.aoFn(T[i], ao) : shade(T[i], -ao);
        }
    for (let y = this.y0; y <= this.y1; y++)
      for (let x = this.x0; x <= this.x1; x++) {
        const i = y * w + x;
        let c = P[i];
        if (!(c >>> 24)) continue;
        // interior edges (part boundary over existing art)
        let k = 0;
        if (!inP(x + 1, y) && inT(x + 1, y)) k = Math.max(k, line);
        if (!inP(x, y + 1) && inT(x, y + 1)) k = Math.max(k, line);
        if (!inP(x - 1, y) && inT(x - 1, y)) k = Math.max(k, lineLit);
        if (!inP(x, y - 1) && inT(x, y - 1)) k = Math.max(k, lineLit);
        if (k > 0) c = o.lineFn ? o.lineFn(c, k) : FLAT.on ? (k >= 0.25 && k === line ? mix(shade(c, -0.3), rgba(40, 26, 34), 0.38) : c) : shade(c, -k);
        T[i] = c;
        P[i] = 0;
      }
    // clear any remaining (e.g. transparent writes)
    for (let y = this.y0; y <= this.y1; y++) P.fill(0, y * w + this.x0, y * w + this.x1 + 1);
    this.x0 = 1e9; this.y0 = 1e9; this.x1 = -1; this.y1 = -1;
  }
}

// ------------------------------------------------------------------ finishing passes

/** Tinted dark outline derived from the neighbouring colour (sel-out). */
export function outlineColor(inner: C, lit: boolean): C {
  const d = shade(inner, FLAT.on ? -0.78 : lit ? -0.62 : -0.8);
  // pull toward a deep, slightly cool/warm tinted base so outlines stay coherent
  const base = rgba(24, 16, 22);
  return mix(d, base, FLAT.on ? 0.62 : lit ? 0.35 : 0.55);
}

/**
 * Finish a sprite layer: rim light on exposed top/back (left) edges, then a selective outline
 * whose colour follows the local colour (lighter on the lit top-left side).
 */
export function finish(buf: PixelBuffer, rimK = 0.16) {
  if (FLAT.on) rimK = Math.min(rimK, 0.04);
  const w = buf.w, h = buf.h, d = buf.data;
  const src = d.slice();
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] >>> 24 > 0;
  // rim: pixels whose left or top neighbour is empty
  if (rimK > 0)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const c = src[i];
        if (!(c >>> 24)) continue;
        const L = !op(x - 1, y), U = !op(x, y - 1), Rr = !op(x + 1, y), D = !op(x, y + 1);
        if ((L && !Rr) || (U && !D)) {
          // skip very dark details (pupils, lines) to keep features crisp
          const lum = R(c) * 0.3 + G(c) * 0.59 + B(c) * 0.11;
          if (lum > 40) d[i] = shade(c, rimK * (U && L ? 1.2 : 1));
        }
      }
  const src2 = d.slice();
  const op2 = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src2[y * w + x] >>> 24 > 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (src2[i] >>> 24) continue;
      let nb = -1, lit = false;
      if (op2(x + 1, y)) { nb = i + 1; lit = true; }
      else if (op2(x, y + 1)) { nb = i + w; lit = true; }
      else if (op2(x - 1, y)) nb = i - 1;
      else if (op2(x, y - 1)) nb = i - w;
      if (nb >= 0) d[i] = outlineColor(src2[nb], lit);
    }
}

/** Union bbox trim of two same-size buffers. */
export function trimPair(a: PixelBuffer, b: PixelBuffer | null, pad = 0) {
  let x0 = a.w, y0 = a.h, x1 = -1, y1 = -1;
  const scan = (p: PixelBuffer) => {
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < p.w; x++)
        if (p.data[y * p.w + x] >>> 24) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
  };
  scan(a);
  if (b) scan(b);
  if (x1 < 0) { x0 = 0; y0 = 0; x1 = 0; y1 = 0; }
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(a.w - 1, x1 + pad); y1 = Math.min(a.h - 1, y1 + pad);
  const cut = (p: PixelBuffer) => {
    const o = new PixelBuffer(x1 - x0 + 1, y1 - y0 + 1);
    for (let y = y0; y <= y1; y++) o.data.set(p.data.subarray(y * p.w + x0, y * p.w + x1 + 1), (y - y0) * o.w);
    return o;
  };
  return { a: cut(a), b: b ? cut(b) : null, ox: x0, oy: y0 };
}

export { shade, mix, hex, rgba };
export type { C };

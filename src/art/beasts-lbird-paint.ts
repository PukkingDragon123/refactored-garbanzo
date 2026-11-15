// The sculpted bird painter for the Gale Hawk, Crag Auk, Torrent Dipper, Thunder Stork and Nutcracker
// (beasts-birds.ts). It is driven by the same pose library as before (body centre and pitch, neck, head,
// beak, legs, wing poses), but every mass is painted on the Relief layer (beasts-relief.ts) from one
// continuous contour drawn through anatomical landmarks, as the Monarch is:
//   - the body: one contour from the rump over the back and mantle to the base of the neck, then down the
//     breast, the belly and the vent, the feather tips breaking it on the flanks and the belly;
//   - the neck: a contour along its curve that flares into the shoulders and the breast;
//   - the head: each species' own skull through its landmarks (forehead, brow, crown, occiput, nape,
//     throat, chin), never a ball;
//   - the beak: the upper and lower mandibles as their own contours (culmen, hook, tomium, gonys, gape),
//     a cere, a nostril, growth lines and the mouth when it opens;
//   - the folded wing: scapulars over the shoulder, lesser, median and greater covert rows, the tertials,
//     the secondaries and the primaries projecting past them with separated, stepped tips;
//   - the spread wing: one contour along the leading edge out to the wrist and the hand, round every
//     primary tip (slotted into fingers on broad-winged birds) and back along the secondaries;
//   - the tail: a fan of separate feathers with notched tips, its own bars and tip band;
//   - the legs: feathered thighs, a tarsus plated with scutes (its front edge scalloped by them), toes
//     with pads and knuckle rings, curved talons that grip.
// The species' looks (beasts-lbird-looks.ts) give the landmarks, the palette and the plumage patterns.

import { Sk, V2, V3, rmp, RampOpt, BeastEye, proj, lumN, ik2, hh, fr } from './beasts-core';
import { Frame2 } from './beasts-rig';
import { Relief, Sp, Tx, LM, spline, fringe, along } from './beasts-relief';
import { hex } from './color';

// ------------------------------------------------------------------ pose and geometry
export type WP = { th: number; hand: number; fold: number; sweep: number; spread?: number };
/** the fields of the shared bird pose (beasts-birds.ts BP) this painter reads */
export interface LBPose {
  air: boolean; b: V2; ba: number; na: number; nl: number; nc: number; ha: number; open: number;
  feet: [V2, V2]; tuck: number; grip: number; reach: number;
  wing: 'fold' | [WP, WP];
  droop: number; lift: number; tailA: number; tailSp: number;
  crest: number; throat: number; lid: boolean; sink: number;
  prey?: string; preyA?: number; ruffle: number; eye?: BeastEye;
}
/** the geometry of the shared look (beasts-birds.ts BirdLook) */
export interface LBGeom {
  rx: number; ry: number; neckL: number; neckR0: number; neckR1: number; hrx: number; hry: number; hipX: number;
  leg: { tib: number; tar: number; rT: number; rt: number; toe: number; talon?: number; web?: boolean };
  tail: { L: number; hw: number; n: number; spread: number; cock?: number };
  wing: { arm: number; hand: number; sec: number; prim: number; nP: number; nS: number; finger: number; round: number; foldExt: number };
}

/** a landmark in a local frame (px at k = 1), optionally with a sharpness */
export type LMp = [number, number] | [number, number, number];

/** what a species' texture hooks get */
export interface Ctx {
  sk: Sk;
  M: (name: string) => number;
  k: number; juv: boolean; P: LBPose;
  rx: number; ry: number;
  /** body frame angle (screen) */
  ba: number;
  /** head frame angle (screen) and facing (+1 the beak to the right, -1 turned back) */
  ha: number; face: number;
}

export interface LBEye {
  at: V2;               // head frame px
  size: 1 | 2;          // 1: a one-pixel eye, 2: a 2x2 eye
  iris: string;
  ring?: string;        // the eye ring (bare skin or feathers)
  ringFull?: boolean;   // ring all round (else only behind and below)
  brow?: string;        // the shadow of a brow ridge over the eye
  lid?: string;         // the lid (closed / blink), default dark
  shine?: boolean;      // catch-light (2x2 eyes)
}

export interface LBBeak {
  /** the upper mandible's contour (head frame px), from the forehead along the culmen to the tip and back along the tomium */
  upper: LMp[];
  /** the lower mandible's contour, closed */
  lower: LMp[];
  /** the gape corner: the lower jaw swings about it */
  hinge: V2;
  /** radians per unit of `open` */
  gape: number;
  cere?: LMp[];
  nostril?: [V2, V2];
  /** paint the beak: material name at head-frame (hx, hy) */
  paint: (hx: number, hy: number, upper: boolean) => string;
  /** grooves across the bill (auk), as x positions */
  grooves?: number[];
  /** growth lines along the bill */
  lines?: number;
  /** the culmen ridge highlight */
  ridge?: boolean;
}

export interface LBFold {
  front: number;  // wrist (carpal) x, rx units
  top: number;    // leading edge, ry units
  bot: number;    // lower (trailing) edge, ry units
  ext: number;    // primary projection behind the rump, px
  tips: number;   // primary tips visible
  tert: number;   // tertial length (fraction of the wing)
  scap: number;   // scapular depth (px)
  sec?: number; tertN?: number; gcN?: number; mcN?: number;
  /** false: the feathers share one element (small birds: no seam between every feather) */
  seams?: boolean;
  /** scapular count and, for plumes, their extra length (rx units) */
  scapN?: number; scapLen?: number;
  round?: number; // primary tips (0 pointed .. 1 round)
}

export interface LBDesign {
  /** drawing scale over the shared look's px (small birds are drawn a little larger to carry detail) */
  scale?: number;
  /** the spread wing's length over the look's (keeps the scaled-up small birds inside their flight canvas) */
  flyWing?: number;
  pal: Record<string, string>;
  /** the default ramp for this species' materials */
  ramp?: RampOpt;
  ramps?: Record<string, RampOpt>;
  /** the body's contour: the top line from the rump to the base of the neck, the bottom line from the breast to the vent (rx / ry units) */
  bodyTop: LMp[];
  bodyBot: LMp[];
  /** the neck's root on the body (rx / ry units) and how much it flares into it */
  neckRoot: V2;
  neckFlare: number;
  /** feather tips breaking the body's edge (px) */
  tuft: number;
  /** the breast mass (u, v, r in rx units, height) */
  breast?: [number, number, number, number];
  /** the head contour (head frame px) */
  head: LMp[];
  /** where the neck ends in the head frame (px) */
  neckEnd?: V2;
  eye: LBEye;
  beak: LBBeak;
  fold: LBFold;
  tail: { tips: number; notch: number; w0: number; w1: number; bars: number; tip: boolean; shaft?: boolean; round?: number; edge?: string };
  leg: { thigh: number; trousers?: boolean; bareTib?: number; scute: number; armour?: boolean; toeW: number; talon: number; hallux: number; web?: boolean };
  /** storks fly with their legs trailing behind */
  trailLegs?: boolean;
  wingTop: { gc: number; covTip: number; secTip?: string; bars?: number; panel?: string; primTip?: string; median?: string };
  wingUnder: { lining: string; liningM?: string; flight: string; bars?: number; tip?: string; carpal?: boolean };
  // ---- texture hooks
  bodyTex: (c: Ctx, p: Sp, o: Tx, u: number, v: number) => void;
  neckTex: (c: Ctx, p: Sp, o: Tx, t: number, side: number) => void;
  headTex: (c: Ctx, p: Sp, o: Tx, hx: number, hy: number) => void;
  thighTex?: (c: Ctx, p: Sp, o: Tx, t: number) => void;
  /** one feather of the folded wing (row P primaries, S secondaries, T tertials, G greater coverts, L lesser /
   *  median coverts, X scapulars; i of n; t 0 base .. 1 tip; c across, px; s distance to its edge, px) */
  feather: (c: Ctx, p: Sp, o: Tx, row: string, i: number, n: number, t: number, cx: number, s: number) => void;
  /** extra head parts (crests, plumes, throat sacs), drawn into the main relief after the head */
  headExtra?: (c: Ctx, R: Relief, H: Frame2, hz: number) => void;
  /** extra body parts (ruffs, hackles) drawn after the neck */
  neckExtra?: (c: Ctx, R: Relief, nb: V2, hp: V2, z: number) => void;
  /** this species' own adjustments to the shared pose (wing dihedral when soaring, a folded stoop) */
  pose?: (anim: string, f: number, n: number, P: LBPose) => void;
  /** hand-placed overlay details after the relief is emitted (bib edges, spots, eye stripes) */
  detail?: (c: Ctx, H: Frame2, B: Frame2) => void;
}

// ------------------------------------------------------------------ helpers
const ID = { BODY: 1, NECK: 2, HEAD: 3, BEAK: 4, JAW: 5, CERE: 6, WING: 7, SCAP: 8, TAIL: 9, THIGH: 10, LEG: 11, TOE: 12, CLAW: 13, CREST: 14, THROAT: 15, PREY: 16, RUFF: 17, MOUTH: 18 };
export { ID as LBID };

/** inverse of a Frame2: screen (local sketch coords) -> frame coords (px at k = 1) */
export function invFrame(F: Frame2) {
  const c = Math.cos(F.a), s = Math.sin(F.a), k = F.k, mx = F.mx;
  return (x: number, y: number): V2 => {
    const dx = x - F.o[0], dy = y - F.o[1];
    return [((dx * c + dy * s) / k) * mx, (-dx * s + dy * c) / k];
  };
}

const DEF_RAMP: RampOpt = { n: 6, dark: 0.6, light: 0.4, cool: 0.15, warm: 0.25 };
function mkMat(sk: Sk, D: LBDesign, name: string, juv: boolean): number {
  let col = D.pal[name];
  if (!col) col = D.pal[FALL[name] ?? ''] ?? D.pal.mantle ?? '#808080';
  const ro = D.ramps?.[name] ?? D.ramp ?? DEF_RAMP;
  // juveniles are duller: a touch paler and greyer
  const c = juv ? dull(col) : col;
  const edge = name === 'mouth' || name === 'water' ? 0 : 1;
  const spec = name.startsWith('beak') || name === 'cere' || name === 'claw' ? 0.35 : 0;
  return sk.m(rmp(c, ro), { edge, spec, noRim: name === 'water' });
}
const FALL: Record<string, string> = {
  mantleF: 'mantle', mantleD: 'mantle', scap: 'mantle', scapF: 'mantleF', underM: 'under', throat: 'under', head: 'mantle', headD: 'head',
  face: 'head', faceM: 'headD', cov: 'mantle', covF: 'mantleF', covD: 'cov', sec: 'cov', secF: 'covF', prim: 'sec', primF: 'secF', primD: 'prim',
  tert: 'sec', tertF: 'secF', tail: 'mantle', tailBar: 'tail', tailTip: 'tailF', tailF: 'tail', uwing: 'under', uwingM: 'underM', uflight: 'under',
  thigh: 'under', thighM: 'underM', leg: 'beak', legD: 'leg', legL: 'leg', claw: 'beakD', beakD: 'beak', beakL: 'beak', cere: 'beak', skin: 'cere',
  crest: 'head', ring: 'under', vent: 'under',
};
const dullCache = new Map<string, string>();
function dull(col: string): string {
  let r = dullCache.get(col);
  if (r) return r;
  const c = hex(col);
  const R = c & 255, G = (c >>> 8) & 255, B = (c >>> 16) & 255;
  const l = (R + G + B) / 3;
  const f = (v: number) => Math.round(Math.min(255, (v * 0.72 + l * 0.28) * 1.04 + 6)).toString(16).padStart(2, '0');
  r = '#' + f(R) + f(G) + f(B);
  dullCache.set(col, r);
  return r;
}

/**
 * Contour feathers: rows of feathers lying along `ang` (screen rad, pointing from the base to the tip),
 * `sx` long and `sy` wide, each domed to its rounded tip, the tip a paler fringe (`edge`), the next
 * row's base in its shadow. Returns the position within the feather (0 base .. 1 tip) for patterns.
 */
export const FT = { fu: 0, fv: 0, row: 0, col: 0, tip: false };
export function feathers(o: Tx, x: number, y: number, ang: number, sx: number, sy: number, seed: number, base: number, edge: number, amp = 1, point = 0) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const u = x * c + y * s, v = -x * s + y * c;
  const row = Math.floor(v / sy), fv = v / sy - row - 0.5;
  const uu = u / sx + (row & 1) * 0.5 + hh(row, 0, seed) * 0.3;
  const col = Math.floor(uu), fu = uu - col;
  const tipAt = point ? 1 - Math.abs(fv * 2) * 0.7 : 1 - fv * fv * 4 * 0.35;
  FT.fu = fu; FT.fv = fv; FT.row = row; FT.col = col; FT.tip = false;
  o.m = base;
  if (fu > tipAt) { o.z -= 0.45 * amp; o.t -= 0.06 * amp; }
  else if (fu > tipAt - 0.24) { o.m = edge; o.z += 0.35 * amp; FT.tip = true; }
  else o.z += (fu * 0.45 + Math.cos(fv * Math.PI) * 0.2) * amp;
  if (hh(col, row, seed + 1) < 0.08) o.t -= 0.04 * amp;
  return fu;
}

/**
 * The standard folded-wing feather: its row's colour, a pale fringe round the tip (along the outer
 * vane only on the primaries), a darker base where the next feather's tip shades it, and optional bars.
 */
export interface FeatherCfg {
  mats?: Partial<Record<string, [string, string]>>;
  bars?: Partial<Record<string, number>>;
  barMat?: string;
  fringeW?: number;
  fringeT?: number;
  scale?: [number, number];
}
export function stdFeather(cfg: FeatherCfg = {}) {
  const MS: Record<string, [string, string]> = { P: ['prim', 'primF'], S: ['sec', 'secF'], T: ['tert', 'tertF'], G: ['cov', 'covF'], L: ['cov', 'covF'], X: ['scap', 'scapF'], ...(cfg.mats as Record<string, [string, string]>) };
  const fw = cfg.fringeW ?? 0.85;
  return (c: Ctx, p: Sp, o: Tx, row: string, i: number, _n: number, t: number, cx: number, s: number) => {
    const [base, edge] = MS[row] ?? MS.G;
    if (row === 'L') {
      const sc = cfg.scale ?? [1.9, 1.4];
      feathers(o, p.x, p.y, c.ba + Math.PI + 0.55, sc[0] * c.k, sc[1] * c.k, 97 + i, c.M(base), c.M(base), 0.25);
      if (FT.fu > 0.72 && FT.fu < 0.95 && Math.abs(FT.fv) < 0.3 && hh(FT.col, FT.row, 91) < 0.7) o.m = c.M(edge);
      return;
    }
    o.m = c.M(base);
    const bars = cfg.bars?.[row];
    if (bars && t > 0.12 && t < 0.86 && fr(t * bars + i * 0.37) < 0.3) o.m = c.M(cfg.barMat ?? 'tailBar');
    if (row === 'P') { if (s < fw * 0.7 && cx < 0 && t > 0.55) o.m = c.M(edge); }
    else if (s < fw && t > (cfg.fringeT ?? 0.72)) o.m = c.M(edge);
    if (t < 0.18) o.t -= 0.05;
  };
}

/** nearest point on a polyline: distance and arc fraction 0..1 */
export function nearest(pts: V2[], x: number, y: number): [number, number] {
  let best = Infinity, bs = 0;
  let tot = 0;
  const seg: number[] = [0];
  for (let i = 1; i < pts.length; i++) { tot += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(tot); }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], c = pts[i], ex = c[0] - a[0], ey = c[1] - a[1], l2 = ex * ex + ey * ey || 1;
    let kk = ((x - a[0]) * ex + (y - a[1]) * ey) / l2; kk = kk < 0 ? 0 : kk > 1 ? 1 : kk;
    const d = Math.hypot(x - a[0] - ex * kk, y - a[1] - ey * kk);
    if (d < best) { best = d; bs = (seg[i - 1] + (seg[i] - seg[i - 1]) * kk) / (tot || 1); }
  }
  return [best, bs];
}

const lmOf = (F: Frame2, q: LMp, kx = 1, ky = 1): LM => { const r = F.p(q[0] * kx, q[1] * ky); return [r[0], r[1], q[2] ?? 0]; };

/** Relief.shadow for a range of element ids (the wing's feathers) */
function shadowFrom(R: Relief, from0: number, from1: number, dx: number, dy: number, amt: number, onto: number, soft: number) {
  const { w, h, z, id, t } = R;
  const mark = new Uint8Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const q = j * w + i;
      if (z[q] < -1e8 || id[q] !== onto) continue;
      for (let s = 1; s <= soft + 1; s++) {
        const si = Math.round(i - (dx * s) / (soft + 1)), sj = Math.round(j - (dy * s) / (soft + 1));
        if (si < 0 || sj < 0 || si >= w || sj >= h) continue;
        const r = sj * w + si;
        if (id[r] >= from0 && id[r] <= from1 && z[r] > z[q] - 0.5) { mark[q] = Math.max(mark[q], soft + 2 - s); break; }
      }
    }
  for (let q = 0; q < w * h; q++) if (mark[q]) t[q] -= amt * (mark[q] / (soft + 1));
}

// ------------------------------------------------------------------ eye
function birdEye(sk: Sk, x: number, y: number, E: LBEye, st: BeastEye, size: 1 | 2): V2 {
  const iris = hex(E.iris), pupil = hex('#0c0a0e'), shine = hex('#fffdf4');
  // a closed eye shows the lid (the dipper's is white); an angry one is shaded by a dark brow
  const lid = hex(st === 'closed' ? E.lid ?? '#16120f' : E.brow ?? '#16120f');
  const ring = E.ring ? hex(E.ring) : 0, brow = E.brow ? hex(E.brow) : 0, white = hex('#f2efe6');
  if (size === 1) {
    const cx = Math.floor(x), cy = Math.floor(y);
    const o = (dx: number, dy: number, c: number) => { if (c) sk.overPaint(cx + dx, cy + dy, c); };
    if (st === 'closed') { o(0, 0, lid); o(-1, 0, lid); if (ring) o(1, 0, ring); return [cx + 0.5, cy + 0.5]; }
    if (ring) { o(-1, 0, ring); o(0, 1, ring); if (E.ringFull) { o(1, 0, ring); o(0, -1, ring); } }
    if (st === 'scared') { o(-1, 0, white); o(1, 0, white); o(0, -1, white); }
    o(0, 0, st === 'alert' || st === 'scared' ? pupil : iris);
    if (st === 'alert') o(0, -1, ring || iris);
    if (st === 'angry') { o(-1, -1, lid); o(0, -1, lid); o(1, -1, lid); }
    else if (brow) { o(0, -1, brow); o(1, -1, brow); }
    return [cx + 0.5, cy + 0.5];
  }
  const X = Math.floor(x - 0.5), Y = Math.floor(y - 0.5);
  const q = (dx: number, dy: number, c: number) => { if (c) sk.overPaint(X + dx, Y + dy, c); };
  if (st === 'closed') {
    if (ring) { q(-1, 0, ring); q(2, 0, ring); }
    q(-1, 1, lid); q(0, 1, lid); q(1, 1, lid); q(2, 1, lid);
    return [X + 1, Y + 1];
  }
  if (ring) {
    q(-1, 0, ring); q(-1, 1, ring); q(0, 2, ring); q(1, 2, ring);
    if (E.ringFull) { q(2, 0, ring); q(2, 1, ring); q(0, -1, ring); q(1, -1, ring); }
  }
  if (st === 'scared') { q(-1, 0, white); q(-1, 1, white); q(2, 0, white); q(2, 1, white); q(0, -1, white); q(1, -1, white); }
  q(0, 0, iris); q(1, 0, iris); q(0, 1, iris); q(1, 1, iris);
  if (st === 'alert' || st === 'scared') { q(1, 0, pupil); q(0, -1, ring || iris); q(1, -1, ring || iris); }
  else q(1, 1, pupil);
  if (st === 'angry') { q(-1, -1, lid); q(0, -1, lid); q(1, -1, lid); q(2, -1, lid); q(0, 0, lid); q(1, 0, lid); q(2, 0, lid); }
  else {
    if (brow) { q(-1, -1, brow); q(0, -1, brow); q(1, -1, brow); q(2, -1, brow); }
    if (E.shine !== false) q(0, 0, shine);
  }
  return [X + 1, Y + 1];
}

// ------------------------------------------------------------------ the painter
export function drawLBird(sk: Sk, L: LBGeom, D: LBDesign, P: LBPose, eyeSt: BeastEye, juv: boolean): { head: V2; eye: V2 } {
  const k = (juv ? 0.7 : 1) * (D.scale ?? 1);
  const Mc = new Map<string, number>();
  const M = (n: string): number => { let id = Mc.get(n); if (id === undefined) { id = mkMat(sk, D, n, juv); Mc.set(n, id); } return id; };
  const ruff = P.ruffle;
  const b: V2 = [P.b[0] * k, P.b[1] * k];
  const rx = L.rx * (1 + ruff * 0.08), ry = L.ry * (1 + ruff * 0.14);
  const grounded = !P.air && P.sink === Infinity && P.tuck === 0;
  if (grounded) {
    // a crouched pose (sleeping, sitting) never sinks the belly below the ground line
    const c = Math.cos(P.ba), s = Math.sin(P.ba);
    let low = -Infinity;
    for (const q of D.bodyBot) low = Math.max(low, b[1] + (q[0] * rx * s + q[1] * ry * c) * k);
    low += D.tuft * k * (1 + ruff * 1.2) * 0.7;
    if (low > -0.6) b[1] -= low + 0.6;
  }
  const B = new Frame2(b, P.ba, k);
  const bp = (u: number, v: number, sh = 0): LM => { const q = B.p(u * rx, v * ry); return [q[0], q[1], sh]; };
  const bInv = invFrame(B);
  const buv = (x: number, y: number): V2 => { const q = bInv(x, y); return [q[0] / rx, q[1] / ry]; };
  const flying = P.wing !== 'fold';
  // a stoop: wings folded in the air, the feet pulled up into the belly feathers
  const stoop = P.air && !flying;
  const back = Math.cos(P.ha) < -0.15;
  const C0: Ctx = { sk, M, k, juv, P, rx, ry, ba: P.ba, ha: P.ha, face: back ? -1 : 1 };
  if (P.sink !== Infinity) sk.clipY = P.sink;

  // ---------------------------------------------------------------- legs
  const hip = B.p(L.hipX, ry * 0.45);
  const legLen = (L.leg.tib + L.leg.tar) * k;
  const footOf = (near: boolean): { h: V2; foot: V2; curl: number; trail: boolean } => {
    const h: V2 = [hip[0] + (near ? 0.5 : -0.5) * k, hip[1]];
    if (P.air && D.trailLegs && P.reach < 0.3) {
      const a = B.ang(Math.PI - 0.22 + (near ? 0.02 : -0.03));
      return { h, foot: [h[0] + Math.cos(a) * legLen * 0.985, h[1] + Math.sin(a) * legLen * 0.985], curl: 0.5, trail: true };
    }
    if (P.air || P.tuck > 0) {
      const bk = B.p(-rx * 0.9, ry * 0.9), fw = B.p(rx * 1.2, ry * 1.6);
      let foot: V2 = [bk[0] + (fw[0] - bk[0]) * P.reach + (near ? 1 : -1) * k, bk[1] + (fw[1] - bk[1]) * P.reach + (1 - P.tuck) * 3 * k];
      if (!P.air) foot = [P.feet[near ? 0 : 1][0] * k, P.feet[near ? 0 : 1][1] * k];
      return { h, foot, curl: P.tuck * (1 - P.reach), trail: false };
    }
    const f = P.feet[near ? 0 : 1];
    return { h, foot: [f[0] * k + L.hipX * k * 0.3, f[1] * k], curl: 0, trail: false };
  };
  const drawLeg = (R: Relief, near: boolean, z: number) => {
    const { h, foot, curl, trail } = footOf(near);
    const tib = L.leg.tib * k, tar = L.leg.tar * k;
    // a leg that cannot quite reach the ground (a pose raised a little) stretches rather than floats
    const reach = Math.hypot(foot[0] - h[0], foot[1] - h[1]), sx = reach > (tib + tar) * 0.985 ? reach / ((tib + tar) * 0.985) : 1;
    const [ank, end] = ik2(h, foot, tib * sx, tar * sx, 1);
    const onGround = !P.air && P.tuck === 0 && end[1] > -0.6 * k;
    const grip = P.grip;
    const rT = L.leg.rT * k, rt = L.leg.rt * k;
    // the thigh: feathered (a drumstick, or raptor "trousers" that cover the top of the tarsus)
    const thighEnd = D.leg.trousers ? along(ank, end, 0.28, 0) : along(h, ank, D.leg.thigh, 0);
    const te: V2 = [thighEnd[0], thighEnd[1]];
    {
      const r0 = rT * 1.55, r1 = D.leg.trousers ? rt * 1.5 : rT * 0.7;
      const th: LM[] = [along(h, te, -0.2, r0 * 0.9), along(h, te, 0.45, r0), along(h, te, 0.85, r1 * 1.1), along(h, te, 1.06, 0, 0.3), along(h, te, 0.85, -r1 * 1.15), along(h, te, 0.45, -r0 * 0.95), along(h, te, -0.2, -r0 * 0.9)];
      const thp = fringe(spline(th, 0.5), Math.max(1.2, 1.6 * k), near ? 41 : 43, (_x, _y, _nx, ny) => (ny > -0.3 ? [0.9 * k, 0.4] : null));
      const tht = D.thighTex;
      R.region(thp, { z: z - 1.2 * k, R: Math.max(1, r0 * 0.8), H: r0 * 0.9, id: ID.THIGH, blend: 0.6 * k, tex: (p, o) => {
        const dx = p.x - h[0], dy = p.y - h[1], lx = te[0] - h[0], ly = te[1] - h[1];
        const t = (dx * lx + dy * ly) / (lx * lx + ly * ly || 1);
        if (tht) tht(C0, p, o, t); else { o.m = M('thigh'); feathers(o, p.x, p.y, Math.atan2(ly, lx), 2.2 * k, 1.5 * k, 51, M('thigh'), M('thighM'), 0.8); }
      } });
    }
    // the bare lower tibia (storks)
    if (D.leg.bareTib) {
      const s0 = D.leg.thigh * 0.92;
      const a0 = along(h, ank, s0, 0);
      const bt: LM[] = [along(h, ank, s0, rT * 0.62), along(h, ank, 0.8, rt * 1.15), along(h, ank, 1.04, rt * 1.45), along(h, ank, 1.04, -rt * 1.5), along(h, ank, 0.8, -rt * 1.15), along(h, ank, s0, -rT * 0.62)];
      void a0;
      R.region(spline(bt, 0.5), { z: z - 0.4 * k, R: Math.max(0.8, rt), H: rt * 1.1, id: ID.LEG, tex: (p, o) => {
        o.m = M('leg');
        const t = Math.hypot(p.x - ank[0], p.y - ank[1]);
        if (fr(t / (2.2 * k)) < 0.18) { o.z -= 0.35; o.t -= 0.03; }
      } });
      // the knee (intertarsal joint): a knob
      R.bump(ank[0], ank[1], rt * 1.6, rt * 1.6, rt * 0.9, 0, ID.LEG);
    }
    // the tarsus: plated with scutes, its front edge scalloped by them
    {
      const len = Math.hypot(end[0] - ank[0], end[1] - ank[1]) || 1;
      const sc = Math.max(1.1, D.leg.scute * k);
      const n = Math.max(2, Math.round(len / sc));
      const rTop = rt * (D.leg.armour ? 1.25 : 1.1), rBot = rt * (D.leg.armour ? 1.05 : 0.9);
      const front: LM[] = [], backE: LM[] = [];
      const t0 = D.leg.trousers ? 0.16 : -0.04;
      for (let i = 0; i <= n; i++) {
        const t = t0 + (1.02 - t0) * (i / n);
        const r = rTop + (rBot - rTop) * Math.max(0, t);
        front.push(along(ank, end, t, r));
        if (i < n) front.push(along(ank, end, t + (1.02 - t0) * 0.5 / n, r + (D.leg.armour ? 0.42 : 0.3) * k, 0.2));
        backE.push(along(ank, end, t, -r * (D.leg.armour ? 1 : 0.95)));
      }
      const lm: LM[] = [...front, ...backE.reverse()];
      R.region(spline(lm, 0.4), { z, R: Math.max(0.7, rt * 0.9), H: rt * 1.1, id: ID.LEG, tex: (p, o) => {
        o.m = M('leg');
        // position along the tarsus and across it (+ front)
        const dx = p.x - ank[0], dy = p.y - ank[1], ex = (end[0] - ank[0]) / len, ey = (end[1] - ank[1]) / len;
        const s = dx * ex + dy * ey, c = dx * ey - dy * ex; // c > 0: front (right of travel downward)
        const ti = (s / len - t0) / (1.02 - t0) * n;
        const f = fr(ti);
        if (c > -rt * 0.2) {
          // transverse scutes on the front: a groove between each, the plate domed
          if (f < 0.2) { o.z -= 0.5; o.m = M('legD'); }
          else { o.z += Math.sin(((f - 0.2) / 0.8) * Math.PI) * 0.3; if (f > 0.35 && f < 0.6 && c > rt * 0.4) o.m = M('legL'); }
        } else {
          // the back of the tarsus: small reticulate scales
          const g = hh(Math.floor(s / (0.9 * k)), Math.floor(c / (0.9 * k)) + 7, 61);
          if (g < 0.3) { o.z -= 0.25; o.t -= 0.03; }
        }
      } });
      if (D.leg.armour) {
        // armour: a second column of plates on the outer face, offset half a scute
        for (let i = 0; i < n; i++) {
          const t = t0 + (1.02 - t0) * ((i + 0.5) / n);
          const q = along(ank, end, t, -rt * 0.15);
          R.bump(q[0], q[1], rt * 0.85, sc * 0.42, rt * 0.35, Math.atan2(end[1] - ank[1], end[0] - ank[0]), ID.LEG);
        }
      }
    }
    // the toes: three forward, the hallux back; pads, knuckle rings and curved talons
    const toeL = L.leg.toe * k, talon = D.leg.talon * k, tw = D.leg.toeW * k;
    const footP = end;
    const toes: { a: number; L: number; dz: number }[] = [];
    const down = trail ? 0.5 : curl * 1.25 + grip * 0.95;
    toes.push({ a: 0.12 + down, L: toeL * 0.82, dz: -0.6 }); // inner (far)
    toes.push({ a: -0.02 + down, L: toeL, dz: 0.2 });        // middle
    toes.push({ a: 0.22 + down * 1.05, L: toeL * 0.86, dz: 0.8 }); // outer (near)
    const hA = Math.PI - 0.12 - grip * 0.85 - curl * 1.15 - (trail ? 0.4 : 0);
    toes.push({ a: hA, L: toeL * D.leg.hallux, dz: -0.3 });
    if (trail) for (const t of toes) t.a += Math.atan2(end[1] - ank[1], end[0] - ank[0]) - Math.PI / 2;
    if (D.leg.web && L.leg.web && !grip) {
      const a0 = toes[1].a, a1 = toes[2].a;
      const wl: LM[] = [[footP[0], footP[1] - 0.3 * k, 0.5], [footP[0] + Math.cos(a0) * toeL * 0.95, footP[1] + Math.sin(a0) * toeL * (onGround ? 0.3 : 0.95) - 0.2 * k, 0.6], [footP[0] + Math.cos(a1) * toeL * 0.82, footP[1] + Math.sin(a1) * toeL * (onGround ? 0.3 : 0.95) + 0.3 * k, 0.6]];
      R.region(spline(wl, 0.4), { z: z + 0.3, R: 0.6, H: 0.4, id: ID.TOE, tex: (p, o) => { o.m = M('web'); if (fr((p.x - footP[0]) * 0.9) < 0.25) o.t -= 0.04; } });
    }
    toes.forEach((t, i) => {
      const hallux = i === 3;
      const w0g = tw * (hallux ? 0.9 : 1), w1g = tw * 0.7;
      const flat = onGround && !grip;
      // standing, the toes lie flat on the ground line (their underside in the ground row, like every
      // beast's feet); the far toe sits a little higher (it is further back)
      const GY = 0.62 - t.dz * 0.22 * (t.dz < 0 ? 1 : 0);
      let tip: V2 = [footP[0] + Math.cos(t.a) * t.L, footP[1] + Math.sin(t.a) * t.L];
      if (flat) tip = [footP[0] + Math.cos(t.a) * t.L * (hallux ? 1 : 0.98), GY - w1g * 0.8];
      const base: V2 = flat ? [footP[0], GY - w0g * 0.95] : [footP[0], footP[1]];
      const w0 = tw * (hallux ? 0.9 : 1), w1 = tw * 0.7;
      const tl: LM[] = [along(base, tip, -0.15, w0), along(base, tip, 0.55, w1 * 1.05), along(base, tip, 1.02, w1 * 0.7, 0.4), along(base, tip, 1.02, -w1 * 0.75, 0.4), along(base, tip, 0.5, -w1), along(base, tip, -0.15, -w0)];
      R.region(spline(tl, 0.35), { z: z + 0.5 + t.dz * 0.4, R: Math.max(0.5, w1 * 0.8), H: w1, id: ID.TOE, tex: (p, o) => {
        o.m = M('leg');
        const d = Math.hypot(p.x - base[0], p.y - base[1]) / Math.max(0.5, t.L);
        // knuckle rings (the toe's phalanges) and the pads under them
        if (fr(d * (hallux ? 2 : 3) + 0.15) < 0.22) { o.z -= 0.4; o.m = M('legD'); }
      } });
      // the talon: a curved, pointed hook from the toe tip
      const ca = t.a + (hallux ? -0.85 : 0.85) * (1 + grip * 0.4);
      const ct: V2 = [tip[0] + Math.cos(ca) * talon * 1.3, tip[1] + Math.sin(ca) * talon * 1.3];
      if (flat) { ct[0] = tip[0] + (hallux ? -1 : 1) * talon * 1.15; ct[1] = Math.min(ct[1], 0.55); }
      const mid: V2 = [(tip[0] + ct[0]) / 2 + Math.cos(t.a) * talon * 0.35, (tip[1] + ct[1]) / 2 + Math.sin(t.a) * talon * 0.35 - (hallux ? 0 : talon * 0.15)];
      const cl: LM[] = [along(tip, ct, -0.25, talon * 0.42), [mid[0], mid[1], 0], [ct[0], ct[1], 0.9], along(tip, ct, 0.2, -talon * 0.38)];
      if (talon > 0.25) R.region(spline(cl, 0.3), { z: z + 0.8 + t.dz * 0.4, R: 0.5, H: 0.6, id: ID.CLAW, tex: M('claw') });
    });
  };

  // ---------------------------------------------------------------- the spread wing
  const shoulder3 = (side: 1 | -1): V3 => [rx * 0.3 * k, ry * 0.35 * k, side * ry * 0.45 * k];
  const spreadWing = (side: 1 | -1, W: WP, bias: number) => {
    const G = L.wing, wk = D.flyWing ?? 1;
    const armL = G.arm * k * wk * (1 - W.fold * 0.35), handL = G.hand * k * wk * (1 - W.fold * 0.5);
    const th = W.th, thH = W.th + W.hand, sw = W.sweep, swH = W.sweep - W.fold * 0.9;
    const dir = (el: number, swp: number): V3 => [Math.sin(swp) * Math.cos(el), Math.sin(el), side * Math.cos(swp) * Math.cos(el)];
    const dA = dir(th, sw), dH = dir(thH, swH);
    const sh = shoulder3(side);
    const add = (a: V3, d: V3, s: number): V3 => [a[0] + d[0] * s, a[1] + d[1] * s, a[2] + d[2] * s];
    const wrist = add(sh, dA, armL), tip = add(wrist, dH, handL);
    const chordOf = (d: V3): V3 => { const dot = -d[0]; const c: V3 = [-1 - dot * d[0], -dot * d[1], -dot * d[2]]; const l = Math.hypot(c[0], c[1], c[2]) || 1; return [c[0] / l, c[1] / l, c[2] / l]; };
    const cA = chordOf(dA), cH = chordOf(dH);
    const P2 = (q: V3): V2 => { const r = proj(q); return [r[0] + b[0], r[1] + b[1]]; };
    const Z = (q: V3) => proj(q)[2];
    const nA: V3 = [dA[1] * cA[2] - dA[2] * cA[1], dA[2] * cA[0] - dA[0] * cA[2], dA[0] * cA[1] - dA[1] * cA[0]];
    // the top surface's normal: span x chord points down for the near wing and up for the far one
    let n: V3 = [-side * nA[0], -side * nA[1], -side * nA[2]];
    const q0 = proj([0, 0, 0]), q1 = proj(n);
    n = [q1[0] - q0[0], q1[1] - q0[1], q1[2] - q0[2]];
    const top = n[2] >= 0;
    const nv: V3 = top ? n : [-n[0], -n[1], -n[2]];
    const lt = (lumN(nv[0], nv[1], nv[2]) - 0.62) * 0.4;
    const sec = G.sec * k * wk, prim = G.prim * k * wk, nP = G.nP, spread = W.spread ?? 1;
    const nF = Math.round(G.finger * nP * 0.85);
    const s2 = (q: V3, sharp = 0): LM => { const r = P2(q); return [r[0], r[1], sharp]; };
    const lead: LM[] = [];
    lead.push(s2(add(sh, cA, -0.8 * k)));
    lead.push(s2(add(add(sh, dA, armL * 0.45), cA, -1.4 * k * Math.min(1, G.arm / 10))));
    lead.push(s2(add(wrist, cA, -0.8 * k), 0.2));
    const prims: { b3: V3; d: V3; L: number }[] = [];
    for (let i = 0; i < nP; i++) {
      const t = i / (nP - 1);
      const b3 = add(wrist, dH, handL * (0.05 + t * 0.9));
      const a = (0.1 + t * (0.75 + G.round * 0.4) * spread) * (1 - W.fold * 0.75);
      const d: V3 = [cH[0] * Math.cos(a) + dH[0] * Math.sin(a), cH[1] * Math.cos(a) + dH[1] * Math.sin(a), cH[2] * Math.cos(a) + dH[2] * Math.sin(a)];
      const Lr = prim * (0.62 + 0.38 * Math.sin(Math.min(1, t * 1.25 + 0.1) * Math.PI * (0.5 + G.round * 0.3))) * (1 - W.fold * 0.12);
      prims.push({ b3, d, L: Lr });
    }
    lead.push(s2(add(tip, cH, -0.5 * k)));
    for (let i = nP - 1; i >= 0; i--) {
      const p = prims[i];
      const tp = add(p.b3, p.d, p.L);
      const slotted = i >= nP - nF && i > 0;
      lead.push(s2(add(tp, dH, 0.45 * k), slotted ? 0.5 : 0.25));
      lead.push(s2(add(tp, cH, 0.3 * k), slotted ? 0.85 : 0.35));
      if (slotted) {
        const nx = prims[i - 1];
        const mid = add(p.b3, nx.d, p.L * (0.62 - G.finger * 0.08));
        lead.push(s2(add(mid, cH, 0.3 * k), 0.45));
      } else if (i > 0) {
        // the trailing edge of the hand: each primary's rounded tip, a small notch between them
        const nx = prims[i - 1];
        const m3 = add(add(p.b3, p.d, p.L * 0.5), nx.d, nx.L * 0.47);
        lead.push(s2(add(m3, cH, -0.15 * k), 0.3));
      }
    }
    // the secondaries' trailing edge back to the body, each feather tip a gentle scallop
    const nS = Math.max(4, G.nS);
    for (let i = nS; i >= 0; i--) {
      const t = i / nS;
      const base3 = add(sh, dA, armL * (0.06 + t * 0.94));
      const Ls = sec * (1 - Math.abs(t - 0.45) * 0.2);
      lead.push(s2(add(base3, cA, Ls), 0.15));
      if (i > 0) lead.push(s2(add(add(sh, dA, armL * (0.06 + (t - 0.5 / nS) * 0.94)), cA, Ls * 0.92)));
    }
    lead.push(s2(add(sh, cA, sec * 0.6)));
    const poly = spline(lead, 0.5);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of poly) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    const R = new Relief(sk, x0 - 2, y0 - 2, x1 + 2, y1 + 2);
    const LE: V2[] = [P2(sh), P2(add(sh, dA, armL * 0.5)), P2(wrist), P2(add(wrist, dH, handL * 0.5)), P2(tip)];
    const ch = (a: V3, c: V3, l: number) => { const p0 = P2(a), p1 = P2(add(a, c, l)); return Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); };
    const chordPx = [ch(sh, cA, sec), ch(wrist, cH, prim)];
    const zW = (Z(sh) + Z(wrist) + Z(tip)) / 3;
    const WT = D.wingTop, WU = D.wingUnder;
    const carp = P2(wrist);
    R.region(poly, { z: zW, R: 1.2 * k, H: 1.1 * k, id: ID.WING, lt: lt + bias, tex: (p, o) => {
      const [d, bs] = nearest(LE, p.x, p.y);
      const hand = bs > 0.5;
      const cf = d / Math.max(3, hand ? chordPx[1] : chordPx[0]);
      if (!top) {
        // the underside: pale lining coverts, a dark carpal crescent, barred flight feathers, dark tips
        if (cf < 0.3) {
          o.m = M(WU.lining);
          if (WU.liningM) {
            if (WU.carpal && Math.hypot(p.x - carp[0], p.y - carp[1]) < 1.9 * k && cf > 0.06) o.m = M(WU.liningM);
            else if (fr(cf * 6.5) < 0.22 && hh(Math.floor(bs * 24), 3, 71) < 0.55) o.m = M(WU.liningM);
          }
          return;
        }
        o.m = M(WU.flight);
        if (WU.bars && cf < 0.86 && fr(cf * WU.bars) < 0.24) o.m = M('uwingM');
        if (WU.tip && (cf > 0.86 || (hand && bs > 0.86 && cf > 0.45))) o.m = M(WU.tip);
        return;
      }
      // the upper side: lesser coverts, a paler median band, greater coverts with pale tips, the flight feathers
      if (cf < 0.13) { o.m = M('cov'); if (hh(Math.floor(p.x / 1.5), Math.floor(p.y / 1.5), 93) < 0.12) o.m = M('covF'); return; }
      if (cf < WT.gc * 0.62) { o.m = M(WT.median ?? 'cov'); return; }
      if (cf < WT.gc) { o.m = cf > WT.gc - WT.covTip ? M('covF') : M('cov'); return; }
      if (!hand) {
        o.m = M(WT.panel ?? 'sec');
        if (WT.bars && cf < 0.9 && fr(cf * WT.bars) < 0.22) o.m = M('secB');
        if (WT.secTip && cf > 0.86) o.m = M(WT.secTip);
        return;
      }
      o.m = M('prim');
      if (WT.bars && cf < 0.75 && bs < 0.8 && fr(cf * WT.bars) < 0.2) o.m = M('secB');
      if (WT.primTip && (cf > 0.8 || bs > 0.9)) o.m = M(WT.primTip);
    } });
    // the feathers' edges: a groove between neighbouring flight feathers and along the coverts' tips
    {
      const gap = (a3: V3, b3: V3) => { const pa = P2(a3), pb = P2(b3); return Math.hypot(pa[0] - pb[0], pa[1] - pb[1]); };
      const fw = gap(prims[0].b3, add(prims[0].b3, prims[0].d, prims[0].L)) > 4 * k;
      for (let i = 0; i < nP - 1; i++) {
        const q = prims[i], q2 = prims[i + 1];
        const md: V3 = [(q.d[0] + q2.d[0]) / 2, (q.d[1] + q2.d[1]) / 2, (q.d[2] + q2.d[2]) / 2];
        const mb: V3 = [(q.b3[0] + q2.b3[0]) / 2, (q.b3[1] + q2.b3[1]) / 2, (q.b3[2] + q2.b3[2]) / 2];
        const Lm = Math.min(q.L, q2.L) * 0.97;
        if (gap(add(mb, md, Lm), add(q.b3, q.d, q.L)) < 1.2 * k || !fw) continue;
        R.line([P2(add(mb, md, Lm * (top ? WT.gc * 0.7 : 0.3))), P2(add(mb, md, Lm))], 0.75 * k, -0.6 * k, { only: ID.WING });
      }
      const nSg = Math.max(3, Math.min(G.nS, Math.floor(gap(sh, wrist) / (2.2 * k))));
      for (let i = 1; i < nSg; i++) {
        const b3 = add(sh, dA, armL * (0.06 + (i / nSg) * 0.94));
        R.line([P2(add(b3, cA, sec * (top ? WT.gc : 0.32))), P2(add(b3, cA, sec * 0.97))], 0.7 * k, -0.5 * k, { only: ID.WING });
      }
      // the coverts' trailing edge
      const cl: V2[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const q3 = t < 0.6 ? add(add(sh, dA, armL * (0.08 + (t / 0.6) * 0.92)), cA, sec * (top ? WT.gc : 0.3)) : add(add(wrist, dH, handL * ((t - 0.6) / 0.4) * 0.55), cH, prim * (top ? WT.gc : 0.3) * 0.7);
        cl.push(P2(q3));
      }
      R.line(cl, 0.9 * k, -0.6 * k, { fold: true, only: ID.WING });
    }
    sk.np();
    R.emit({ bias: 0, drop: 1.4, seam: 0.5, seamDark: 0.25, contrast: 0.9 });
  };

  // ---------------------------------------------------------------- the far side
  if (flying && P.wing !== 'fold') spreadWing(-1, P.wing[1], -0.1);
  {
    const R = new Relief(sk, b[0] - (rx + legLen + 8) * k, b[1] - (ry + 6) * k, b[0] + (rx + legLen + 8) * k, b[1] + (ry + legLen + 6) * k);
    if (!stoop) drawLeg(R, false, -6 * k);
    sk.np();
    R.emit({ bias: -0.16, drop: 1.3, seam: 0.5, seamDark: 0.2 });
  }

  // ---------------------------------------------------------------- body, tail, wing, neck and head
  const BR = Relief.full(sk);
  // ---- tail: a fan of separate feathers (the outer ones under the central pair), each with its own
  // rounded or pointed tip, so the end is notched between them; bars and a tip band from the species
  {
    const T = D.tail;
    const rump = B.p(-rx * 0.86, -ry * 0.1);
    let tA = B.ang(Math.PI + 0.15 + P.tailA - (L.tail.cock ?? 0) + (P.air ? 0 : Math.min(0, P.ba) * 0.7));
    const Lt = L.tail.L * k, n = Math.max(2, T.tips);
    // on the ground the tail rests on it rather than passing through it
    if (!P.air && P.sink === Infinity && P.tuck === 0) {
      const floor = -1.2 * k;
      if (rump[1] + Math.sin(tA) * Lt > floor && Math.cos(tA) < 0) {
        const s0 = Math.max(-1, Math.min(1, (floor - rump[1]) / Lt));
        tA = Math.PI - Math.asin(s0);
      }
    }
    const sp = L.tail.spread * P.tailSp * (P.air ? 1.6 : 1);
    const hw = (T.w1 * 2 / n) * 1.05 * k;
    let tid = 120;
    for (let j = 0; j < n; j++) {
      // outer feathers first, the central ones last (on top)
      const i = j % 2 === 0 ? j / 2 : n - 1 - (j - 1) / 2;
      const f = n === 1 ? 0.5 : i / (n - 1);
      const centre = 1 - Math.abs(f - 0.5) * 2;
      const a = tA + (f - 0.5) * sp;
      const off = (f - 0.5) * T.w0 * 2 * k;
      const bx = rump[0] - Math.sin(tA) * off, by = rump[1] + Math.cos(tA) * off;
      const Lf = Lt * (1 - (1 - centre) * T.notch * 2);
      const tx = bx + Math.cos(a) * Lf, ty = grounded ? Math.min(by + Math.sin(a) * Lf, -0.8) : by + Math.sin(a) * Lf;
      const dx = tx - bx, dy = ty - by, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      const w = hw * (1 + centre * 0.12);
      const Q = (t: number, o: number, sh = 0): LM => [bx + dx * t + nx * o, by + dy * t + ny * o, sh];
      const round = T.round ?? 1;
      const lm: LM[] = [Q(-0.05, -w * 0.7), Q(0.5, -w * 0.95), Q(0.9, -w), Q(1, -w * 0.45, 0.1), Q(1.02, 0, round > 0.5 ? 0 : 0.8), Q(1, w * 0.45, 0.1), Q(0.9, w), Q(0.5, w * 0.95), Q(-0.05, w * 0.7)];
      const id = tid++;
      BR.region(spline(lm, 0.35), { z: (-2.4 + centre * 0.8) * k, R: Math.max(0.6, w * 0.8), H: 0.9 * k, id, tex: (p, o) => {
        const t = ((p.x - bx) * dx + (p.y - by) * dy) / (l * l);
        const c = ((p.x - bx) * ny - (p.y - by) * nx);
        o.m = M('tail');
        if (T.shaft && Math.abs(c) < 0.45 && t > 0.2 && t < 0.92 && w > 1.1 * k) o.m = M('tailF');
        if (T.bars && t > 0.18 && t < 0.88 && fr(t * T.bars + 0.35) < 0.3) o.m = M('tailBar');
        if (T.tip && t > 0.88) o.m = M('tailTip');
        if (T.edge && p.s < 0.8 && t > 0.3 && c < 0) o.m = M(T.edge);
      } });
    }
  }

  // ---- the body: one contour from the rump over the back to the neck's root, down the breast to the vent
  {
    const lm: LM[] = [];
    for (const q of D.bodyTop) lm.push(bp(q[0], q[1], q[2] ?? 0));
    for (const q of D.bodyBot) lm.push(bp(q[0], q[1], q[2] ?? 0));
    const tuft = D.tuft * k * (1 + ruff * 1.2);
    const ca = Math.cos(P.ba), sa = Math.sin(P.ba);
    const op = fringe(spline(lm, 0.5), Math.max(1.3, 1.9 * k), 17, (_x, _y, nx, ny) => {
      // body-frame normal: down (belly, flanks) is fluffy, the back sleek
      const bnv = -nx * sa + ny * ca, bnu = nx * ca + ny * sa;
      if (bnv > 0.15 || bnu < -0.75) return [tuft * (0.6 + Math.max(0, bnv) * 0.5), bnu > 0 ? 0.5 : -0.4];
      return ruff > 0.5 ? [tuft * 0.6, 0.3] : null;
    });
    BR.region(op, { z: 0, R: ry * 0.75 * k, H: ry * 0.95 * k, id: ID.BODY, tex: (p, o) => { const q = buv(p.x, p.y); D.bodyTex(C0, p, o, q[0], q[1]); } });
    if (D.breast) { const [u, v, r, hgt] = D.breast; const q = B.p(u * rx, v * ry); BR.bump(q[0], q[1], r * rx * k, r * rx * 0.85 * k, hgt * k, P.ba, ID.BODY); }
  }

  // ---- the near leg
  if (!stoop) drawLeg(BR, true, ry * 0.55 * k);

  // ---- the neck: along its curve, flaring into the shoulders and breast
  const nr = D.neckRoot;
  const nb = B.p(rx * nr[0], ry * nr[1]);
  const nl = L.neckL * P.nl * k;
  const hpos: V2 = [nb[0] + Math.cos(P.na) * nl, nb[1] + Math.sin(P.na) * nl];
  const H = back ? new Frame2(hpos, P.ha - Math.PI, k, -1) : new Frame2(hpos, P.ha, k);
  const hInv = invFrame(H);
  const ne = D.neckEnd ?? [-L.hrx * 0.35, L.hry * 0.15];
  const nEnd = H.p(ne[0], ne[1]);
  const perp: V2 = [-Math.sin(P.na), Math.cos(P.na)];
  const ctrl: V2 = [(nb[0] + nEnd[0]) / 2 + perp[0] * P.nc * nl * 0.5, (nb[1] + nEnd[1]) / 2 + perp[1] * P.nc * nl * 0.5];
  const bez = (t: number): V2 => { const u = 1 - t; return [u * u * nb[0] + 2 * u * t * ctrl[0] + t * t * nEnd[0], u * u * nb[1] + 2 * u * t * ctrl[1] + t * t * nEnd[1]]; };
  const neckZ = ry * 0.5 * k;
  const nlen = Math.hypot(nEnd[0] - nb[0], nEnd[1] - nb[1]);
  if (nlen > 0.6 * k) {
    const left: LM[] = [], right: LM[] = [];
    const N = Math.max(4, Math.min(12, Math.round(nlen / 2.5)));
    for (let i = 0; i <= N; i++) {
      const t = i / N, q = bez(t), q2 = bez(Math.min(1, t + 0.04)), q1 = bez(Math.max(0, t - 0.04));
      const dx = q2[0] - q1[0], dy = q2[1] - q1[1], l = Math.hypot(dx, dy) || 1;
      const fl = 1 + D.neckFlare * Math.max(0, 1 - t / 0.35) ** 2;
      const r = (L.neckR0 + (L.neckR1 - L.neckR0) * t) * k * (1 + ruff * 0.25) * fl;
      left.push([q[0] + (dy / l) * r, q[1] - (dx / l) * r, 0]);
      right.push([q[0] - (dy / l) * r, q[1] + (dx / l) * r, 0]);
    }
    const ol = [...left, ...right.reverse()];
    const ax = nEnd[0] - nb[0], ay = nEnd[1] - nb[1];
    BR.region(spline(ol, 0.5), { z: neckZ, R: Math.max(1, L.neckR0 * 0.7 * k), H: L.neckR0 * 0.9 * k, id: ID.NECK, blend: 1.4 * k, tex: (p, o) => {
      const dx = p.x - nb[0], dy = p.y - nb[1];
      const t = (dx * ax + dy * ay) / (ax * ax + ay * ay || 1);
      // + toward the throat (ventral), - toward the nape
      const side = ((dx * ay - dy * ax) / (Math.sqrt(ax * ax + ay * ay) || 1)) / Math.max(0.5, (L.neckR0 + (L.neckR1 - L.neckR0) * Math.max(0, Math.min(1, t))) * k);
      D.neckTex(C0, p, o, t, -side);
    } });
  }
  if (D.neckExtra) D.neckExtra(C0, BR, nb, hpos, neckZ + 1);

  // ---- the folded wing, feather by feather: the primaries stacked with stepped tips, the secondaries
  // forming the lower edge, the tertials over them, the greater and median covert rows, the lesser coverts
  // along the leading edge and the scapulars over the shoulder. Each feather is its own element, so a
  // seam separates it from the one it overlaps and its own rounded form catches the light.
  if (!flying) {
    const F = D.fold;
    const lift = P.lift, droop = P.droop;
    // body-frame px (k = 1) -> screen landmark, with the wing lifted (mantling) or drooped
    const W2 = (x: number, y: number, sh = 0): LM => {
      const yy = y - lift * Math.max(0, -x + rx * 0.9) * 0.16 + droop * Math.max(0, -x - rx * 0.6) * 0.16;
      const q = B.p(x, yy);
      return [q[0], grounded ? Math.min(q[1], -0.9) : q[1], sh];
    };
    const X0 = F.front * rx, Yt = F.top * ry, Yb = F.bot * ry, Dp = Yb - Yt;
    const ext = F.ext * (1 + droop * 0.1);
    const Xe = -rx - ext, Ye = Yt + Dp * 0.32;
    const wz = ry * 0.95 * k;
    let fid = 40;
    const FT2 = D.feather;
    /** one feather: base -> tip, half widths at the base and near the tip, round (0 pointed .. 1 round) */
    const blade = (bx: number, by: number, tx: number, ty: number, w0: number, w1: number, round: number, z: number, row: string, i: number, n: number) => {
      const dx = tx - bx, dy = ty - by, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      const Q = (t: number, off: number, sh = 0) => W2(bx + dx * t + nx * off, by + dy * t + ny * off, sh);
      const tipR = round > 0.5 ? w1 * 0.75 : w1 * 0.35;
      const lm: LM[] = [Q(-0.06, -w0 * 0.9), Q(0.45, -w0), Q(0.82, -w1), Q(1 - tipR / l, -w1 * 0.7, 0.1), Q(1, 0, round > 0.5 ? 0 : 0.7), Q(1 - tipR / l, w1 * 0.7, 0.1), Q(0.82, w1), Q(0.45, w0), Q(-0.06, w0 * 0.9)];
      const poly = spline(lm, 0.35);
      const id = F.seams === false ? 40 : fid++;
      const b0 = W2(bx, by), t0 = W2(tx, ty);
      const ax = t0[0] - b0[0], ay = t0[1] - b0[1], al = Math.hypot(ax, ay) || 1;
      const one = F.seams === false;
      BR.region(poly, { z: wz + (one ? z * 0.3 : z) * k, R: one ? 1.4 * k : Math.max(0.6, Math.min(w0, w1) * 0.6 * k), H: (one ? 1 : 0.7) * k, id, blend: one ? 1.6 * k : 0, tex: (p, o) => {
        const t = ((p.x - b0[0]) * ax + (p.y - b0[1]) * ay) / (al * al);
        const c = ((p.x - b0[0]) * ay - (p.y - b0[1]) * ax) / al;
        FT2(C0, p, o, row, i, n, t, c, p.s);
      } });
    };
    // primaries: the longest lowest, each shorter one on top of it, its tip stepping forward and down
    const nP = Math.max(1, F.tips);
    const stepX = (ext + rx * 0.25) / (nP + 0.6), stepY = Dp * 0.09;
    for (let i = 0; i < nP; i++) {
      const tx = Xe + i * stepX, ty = Ye + i * stepY;
      const bx = X0 - rx * 0.45 - i * 0.3, by = Yt + Dp * (0.36 + i * 0.05);
      blade(bx, by, tx, ty, Dp * 0.17, Dp * 0.14, D.fold.round ?? 0.3, -0.6 + i * 0.12, 'P', i, nP);
    }
    // secondaries: lying across the arm, their rounded tips the wing's lower edge
    const nS = Math.max(2, F.sec ?? 4);
    for (let i = nS - 1; i >= 0; i--) {
      const f = i / Math.max(1, nS - 1);
      const bx = X0 - rx * 0.2 - f * (X0 + rx * 0.62), by = Yt + Dp * 0.32;
      const tx = bx - Dp * 0.32, ty = Yb - f * Dp * 0.06;
      blade(bx, by, tx, ty, (X0 + rx * 0.6) / nS * 0.62, (X0 + rx * 0.6) / nS * 0.6, 1, 0.1 + (nS - i) * 0.02, 'S', i, nS);
    }
    // tertials: broad feathers at the back, covering the secondaries' rear and the primaries' bases
    const nT = F.tertN ?? 2;
    for (let i = 0; i < nT; i++) {
      const f = nT > 1 ? i / (nT - 1) : 0;
      const bx = -rx * (0.05 + f * 0.18), by = Yt + Dp * (0.2 + f * 0.06);
      const tx = -rx * (0.98 + F.tert * 0.4) + f * rx * 0.22, ty = Yt + Dp * (0.62 + f * 0.18);
      blade(bx, by, tx, ty, Dp * 0.2, Dp * 0.21, 1, 0.4 + i * 0.12, 'T', i, nT);
    }
    // greater coverts: a row of broad, rounded feathers with pale tips (the wing bar)
    const nG = F.gcN ?? 5;
    for (let i = nG - 1; i >= 0; i--) {
      const f = i / Math.max(1, nG - 1);
      const bx = X0 - rx * 0.08 - f * (X0 + rx * 0.32), by = Yt + Dp * 0.1;
      const tx = bx - Dp * 0.22, ty = Yt + Dp * (D.wingTop.gc + 0.04);
      blade(bx, by, tx, ty, (X0 + rx * 0.35) / nG * 0.62, (X0 + rx * 0.35) / nG * 0.6, 1, 0.8 + (nG - i) * 0.02, 'G', i, nG);
    }
    // the lesser and median coverts: small scale-like feathers along the leading edge, round the wrist
    if ((F.mcN ?? 4) > 0) {
      const lm: LM[] = [W2(X0 + 0.2, Yt + Dp * 0.3, 0.3), W2(X0 - rx * 0.06, Yt + Dp * 0.02), W2(X0 - rx * 0.4, Yt - 0.2), W2(-rx * 0.5, Yt + Dp * 0.06)];
      const nM = F.mcN ?? 4;
      for (let i = 0; i <= nM; i++) {
        const f = i / nM;
        const x = -rx * 0.5 + f * (X0 + rx * 0.45);
        lm.push(W2(x, Yt + Dp * (0.26 + (i % 2 ? -0.06 : 0.02)), i % 2 ? 0.5 : 0));
      }
      const lead0 = W2(X0, Yt), lead1 = W2(-rx * 0.5, Yt);
      BR.region(spline(lm, 0.35), { z: wz + 1.2 * k, R: Math.max(0.8, Dp * 0.12 * k), H: 0.8 * k, id: fid++, tex: (p, o) => {
        const [d] = nearest([[lead0[0], lead0[1]], [lead1[0], lead1[1]]], p.x, p.y);
        D.feather(C0, p, o, 'L', 0, 1, d / Math.max(1, Dp * 0.28 * k), 0, p.s);
      } });
    }
    // the scapulars: the shoulder's feathers lying back over the top of the folded wing
    if (F.scap > 0) {
      const nX = F.scapN ?? 3, sl = F.scapLen ?? 0;
      for (let i = 0; i < nX; i++) {
        const f = i / (nX - 1);
        const bx = X0 * 0.7 - f * rx * 0.55, by = Yt - F.scap * 0.55;
        // plumes (sl > 0) are long and lance-tipped, drooping back over the tertials
        const tx = bx - rx * (0.42 + f * 0.15 + sl), ty = Yt + F.scap * (0.55 + f * 0.25) + sl * ry * (0.35 + f * 0.25);
        blade(bx, by, tx, ty, F.scap * (sl ? 0.5 : 0.62), F.scap * (sl ? 0.38 : 0.55), sl ? 0 : 1, 1.6 + i * 0.12, 'X', i, nX);
      }
    }
  }

  // ---- the head: the species' own skull
  const hz = ry * 1.1 * k + 2 * k;
  {
    const hl: LM[] = D.head.map(q => lmOf(H, q));
    BR.region(spline(hl, 0.4), { z: hz, R: Math.max(1.2, L.hry * 0.75 * k), H: L.hry * 0.95 * k, id: ID.HEAD, blend: 1.2 * k, tex: (p, o) => {
      const q = hInv(p.x, p.y);
      D.headTex(C0, p, o, q[0], q[1]);
    } });
    // the eye socket and the brow over it
    const E = D.eye;
    const ec = H.p(E.at[0], E.at[1]);
    BR.bump(ec[0], ec[1], 1.6 * k, 1.3 * k, -0.5 * k, H.a, ID.HEAD);
    if (E.brow) {
      const b0 = H.p(E.at[0] - 1.4, E.at[1] - 1.5), b1 = H.p(E.at[0] + 0.6, E.at[1] - 1.7), b2 = H.p(E.at[0] + 1.8, E.at[1] - 1.1);
      BR.line([b0, b1, b2], 1.1 * k, 0.7 * k, { only: ID.HEAD });
    }
  }
  if (D.headExtra) D.headExtra(C0, BR, H, hz);

  // ---- the beak
  const BK = D.beak;
  const openA = P.open * BK.gape;
  const bz = hz + L.hry * 1.0 * k;
  const tucked = back && P.eye === 'closed';
  {
    const hinge = BK.hinge;
    const rot = (q: LMp): LMp => {
      const dx = q[0] - hinge[0], dy = q[1] - hinge[1], c = Math.cos(openA), s = Math.sin(openA);
      return [hinge[0] + dx * c - dy * s, hinge[1] + dx * s + dy * c, q[2] ?? 0];
    };
    // turned back into the plumage (preening, sleeping) the bill slips in among the feathers
    const zb = tucked ? hz - 3 * k : back ? ry * 0.8 * k : bz;
    // the mouth: the dark gape between the opened mandibles
    if (P.open > 0.2) {
      const tipU = BK.upper.reduce((a, q) => (q[0] > a[0] ? q : a), BK.upper[0]);
      const tipL = rot(BK.lower.reduce((a, q) => (q[0] > a[0] ? q : a), BK.lower[0]));
      const mm: LMp[] = [[hinge[0] - 0.3, hinge[1] - 0.2], [tipU[0] - 0.8, tipU[1] - 0.2], [tipL[0] - 0.8, tipL[1]], [hinge[0] - 0.2, hinge[1] + 0.5]];
      BR.region(spline(mm.map(q => lmOf(H, q)), 0.4), { z: zb - 0.3 * k, R: 0.6, H: 0.3, id: ID.MOUTH, tex: (p, o) => { o.m = M('mouth'); const q = hInv(p.x, p.y); if (q[1] > hinge[1] + 0.6) o.t -= 0.05; } });
    }
    if (BK.cere) BR.region(spline(BK.cere.map(q => lmOf(H, q)), 0.4), { z: zb + 0.2 * k, R: 0.7 * k, H: 0.9 * k, id: ID.CERE, tex: M('cere') });
    // the lower mandible
    const lowerL = BK.lower.map(rot);
    BR.region(spline(lowerL.map(q => lmOf(H, q)), 0.4), { z: zb + 0.4 * k, R: 0.7 * k, H: 0.9 * k, id: ID.JAW, tex: (p, o) => {
      const q = hInv(p.x, p.y);
      // back into the jaw's frame
      const dx = q[0] - hinge[0], dy = q[1] - hinge[1], c = Math.cos(-openA), s = Math.sin(-openA);
      const jx = hinge[0] + dx * c - dy * s, jy = hinge[1] + dx * s + dy * c;
      o.m = M(BK.paint(jx, jy, false));
      if (BK.lines && fr(jx * BK.lines) < 0.14) o.z -= 0.25;
    } });
    // the upper mandible
    BR.region(spline(BK.upper.map(q => lmOf(H, q)), 0.4), { z: zb + 1 * k, R: 0.9 * k, H: 1.3 * k, id: ID.BEAK, tex: (p, o) => {
      const q = hInv(p.x, p.y);
      o.m = M(BK.paint(q[0], q[1], true));
      if (BK.lines && fr(q[0] * BK.lines) < 0.12) o.z -= 0.25;
      if (BK.grooves) for (const gx of BK.grooves) if (Math.abs(q[0] - gx) < 0.42) { o.z -= 0.5; o.m = M('beakL'); }
    } });
    if (BK.nostril && !tucked) {
      const n0 = H.p(BK.nostril[0][0], BK.nostril[0][1]), n1 = H.p(BK.nostril[1][0], BK.nostril[1][1]);
      BR.line([n0, n1], 0.8 * k, -0.9 * k, { taper: false });
    }
    if (BK.ridge) {
      // the culmen: a ridge along the top of the upper mandible
      const top = BK.upper.filter(q => q[1] < (BK.hinge[1] - 0.2)).map(q => H.p(q[0], q[1] + 0.55));
      if (top.length > 1) BR.line(top, 0.7 * k, 0.35 * k, { only: ID.BEAK });
    }
  }

  // ---- prey held in the bill
  if (P.prey === 'seed') {
    const q = H.p(BK.hinge[0] + (L.hrx * 0.5 + 1.2), BK.hinge[1] + 0.4);
    const sl: LM[] = [[q[0] - 1.3 * k, q[1] - 0.8 * k, 0.2], [q[0] + 0.4 * k, q[1] - 1.3 * k, 0], [q[0] + 1.5 * k, q[1] - 0.2 * k, 0.4], [q[0] + 0.6 * k, q[1] + 1.1 * k, 0], [q[0] - 1.1 * k, q[1] + 0.8 * k, 0.2]];
    BR.region(spline(sl, 0.3), { z: bz + 2 * k, R: 0.8, H: 1, id: ID.PREY, tex: (p, o) => { o.m = M('seed'); if (Math.abs(p.x - q[0] + (p.y - q[1]) * 0.6) < 0.4) { o.m = M('seedL'); o.z += 0.3; } } });
  }
  BR.shadow(ID.HEAD, 0.8 * k, 1.2 * k, 0.09, ID.BODY, 1);
  shadowFrom(BR, 40, 119, 0.7 * k, 1.2 * k, 0.1, ID.BODY, 1);
  BR.shadow(ID.BEAK, 0.6 * k, 0.9 * k, 0.1, ID.HEAD, 1);
  sk.np();
  BR.emit({ drop: 1.5, seam: 0.55 * k, seamDark: 0.26, ao: 0.05, aoR: 2 });

  // ---- the eye, and hand-placed details
  const E = D.eye;
  const ecen = H.p(E.at[0], E.at[1]);
  let eyeP: V2;
  const est = P.eye ?? eyeSt;
  if (P.lid && E.lid) {
    // the dipper's white eyelid flash
    const c = hex(E.lid);
    const ex = Math.floor(ecen[0]), ey = Math.floor(ecen[1]);
    sk.overPaint(ex, ey, c); sk.overPaint(ex - 1, ey, c); if (!juv) sk.overPaint(ex, ey - 1, c);
    eyeP = [ex + 0.5, ey + 0.5];
  } else eyeP = birdEye(sk, ecen[0], ecen[1], E, tucked ? 'closed' : est, juv && E.size === 2 ? 1 : E.size);
  if (D.detail) D.detail(C0, H, B);

  // ---- the near wing in flight
  if (flying && P.wing !== 'fold') spreadWing(1, P.wing[0], 0);

  // ---- a serpent carried in the talons: gripped mid-body, the head end hanging forward, the long
  // tail trailing behind in loose waves; olive with dark saddles and a pale belly
  if (P.prey === 'snake') {
    const g = B.p(-rx * 0.1, ry * 1.25);
    const ph = (P.preyA ?? 0) * 4;
    const pts: V2[] = [];
    const N = 22;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      // t 0: the head (in front, hanging), ~0.22: the grip, 1: the tail tip
      const u = t - 0.22;
      const x = u < 0 ? -u * 14 * k : -u * 20 * k;
      const y = u < 0 ? -u * 20 * k : u * 7 * k + Math.sin(u * 9 + ph) * 2.2 * k * Math.min(1, u * 3);
      pts.push([g[0] + x + Math.sin(t * 5 + ph * 0.5) * 0.6 * k, g[1] + y]);
    }
    const rad = (t: number) => (t < 0.06 ? 1.05 + t * 4 : 1.55 - Math.max(0, t - 0.06) * 1.45) * k;
    const left: LM[] = [], right: LM[] = [];
    for (let i = 0; i <= N; i++) {
      const a = pts[Math.max(0, i - 1)], c = pts[Math.min(N, i + 1)];
      const dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy) || 1;
      const r = rad(i / N);
      left.push([pts[i][0] + (dy / l) * r, pts[i][1] - (dx / l) * r, i === 0 ? 0.3 : 0]);
      right.push([pts[i][0] - (dy / l) * r, pts[i][1] + (dx / l) * r, i === 0 ? 0.3 : 0]);
    }
    left[N][2] = 0.9;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of pts) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    const SR = new Relief(sk, x0 - 3, y0 - 3, x1 + 3, y1 + 3);
    SR.region(spline([...left, ...right.reverse()], 0.4), { z: 14 * k, R: 1, H: 1.2, id: ID.PREY, tex: (p, o) => {
      const [, t] = nearest(pts, p.x, p.y);
      const i = Math.min(N - 1, Math.floor(t * N)), a = pts[i], c = pts[i + 1];
      const dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy) || 1;
      const side = ((p.x - a[0]) * dy - (p.y - a[1]) * dx) / l; // + : the right of travel (its belly here)
      o.m = side > rad(t) * 0.35 ? M('snakeB') : M('snake');
      const band = fr(t * 13);
      if (side <= rad(t) * 0.35 && band < 0.32) o.m = M('snakeD');
      if (fr(t * 40) < 0.25) o.z -= 0.25;
    } });
    sk.np();
    SR.emit({ drop: 1.2, seam: 0.5 });
    // the head's eye
    const hd = pts[1];
    sk.overPaint(Math.floor(hd[0]), Math.floor(hd[1]), hex('#18160c'));
  }
  // ---- bubbles streaming from the plumage under water
  if (P.prey === 'bubbles') {
    const bub = hex('#e8f8fc'), bub2 = hex('#a8dce8');
    const t = P.preyA ?? 0;
    const src = H.p(0, -L.hry * 0.6), src2 = B.p(-rx * 0.4, -ry * 0.9);
    for (let i = 0; i < 5; i++) {
      const ph = fr(t + i * 0.23);
      const s0 = i % 2 ? src : src2;
      const x = s0[0] - ph * 3 * k + Math.sin((ph + i) * 6) * 0.8, y = s0[1] - ph * 7 * k - 1;
      if (y < -sk.oy + 1) continue;
      sk.over(Math.floor(x), Math.floor(y), i % 3 ? bub : bub2);
      if (i === 1 && ph > 0.4) sk.over(Math.floor(x) + 1, Math.floor(y), bub2);
    }
  }
  // ---- the water line
  if (P.sink !== Infinity) {
    sk.clipY = Infinity;
    const y = P.sink + 0.5;
    const wl = hex('#e4f6fa'), wd = hex('#8ec8d8');
    for (let x = -rx * 1.4; x < rx * 1.7; x += 1) {
      const X = b[0] + x * k;
      if (sk.has(X, y - 1) || hh(x, 1, 4) > 0.45) sk.over(X, y, hh(x, 2, 5) > 0.3 ? wl : wd);
    }
  }
  const top = H.p(0, -L.hry - 1.5);
  return { head: [top[0], top[1] - 2 * k], eye: eyeP };
}

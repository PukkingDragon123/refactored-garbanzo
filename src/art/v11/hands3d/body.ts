// The sculpt: a realistic forearm and hand as a signed distance field built on the rig's bind pose
// (forearm with its muscle masses, wrist bones and tendons; the palm from its metacarpals with the
// thenar and hypothenar pads and the knuckle heads; fingers with joint bulges, finger pads and nail
// plates; the thumb with its web; extensor tendons and veins laid onto the surface), then the
// sleeves, cuffs, watch, taniko band and gloves as separate parts. Also the skin weights and the
// per-vertex anatomical coordinates the shader uses for nails, creases and wrinkles.

import { Sdf, cone, ell, limb, project, snoise3, Prim } from './sdf';
import { Rig, B, FINGERS, THUMB, NB } from './rig';
import { V3, qrot, vadd, vsub, vscale, vdot, vnorm, vcross, sstep } from './math3';
import type { Look } from './looks';

/** materials (the shader switches on these) */
export const MAT = { skin: 0, sleeve: 1, rib: 2, roll: 3, strap: 4, metal: 5, glass: 6, taniko: 7, glove: 8, gcuff: 9 } as const;

export interface PartSpec {
  name: string;
  sdf: Sdf;
  mat: number;
  /** grid step (cm) */
  h: number;
  box: [number, number, number, number, number, number];
  /** pull this part's surface in a hair (so a finer neighbour wins where they overlap) */
  inset?: number;
  /** clip the mesh to y >= yCut (open end hidden inside a sleeve) */
  yCut?: number;
  /** used for the AO bake (the whole skin, so a sleeve darkens the arm at the cuff) */
  aoSdf?: Sdf;
}

const pt = (rig: Rig, i: number, x: number, y: number, z: number): V3 => vadd(rig.bind[i].t, qrot(rig.bind[i].q, [x, y, z]));
const axis = (rig: Rig, i: number, a: V3): V3 => qrot(rig.bind[i].q, a);

/** the forearm cross-section knots: y, half-width, half-depth, centre x, centre z */
function armKnots(rig: Rig) {
  const b = rig.build, LF = rig.foreLen, s = b.size, bw = b.breadth, A = b.arm, M = 0.88 + 0.12 * b.muscle;
  const ys = [-LF - 1.5, -LF * 0.86, -LF * 0.68, -LF * 0.48, -LF * 0.28, -LF * 0.12, -0.6 * s, 0.35 * s];
  const as = [3.95 * A, 4.35 * A * M, 4.15 * A * M, 3.65 * A, 3.2 * A, 2.95 * A, 2.94 * s * bw, 2.62 * s * bw];
  const bs = [3.7 * A, 3.62 * A * M, 3.15 * A * M, 2.62 * A, 2.2 * A, 1.95 * A, 1.84 * s, 1.42 * s];
  const xs = [0.25 * A, 0.18 * A, 0.08 * A, 0, 0, 0, 0, 0];
  const zs = [0.25 * A, 0.28 * A, 0.22 * A, 0.12 * A, 0.04, 0, -0.02 * s, -0.1 * s];
  return { ys, as, bs, xs, zs };
}
/** the arm's surface radius (half-width, half-depth) at y, for sleeves and bands */
function armAt(rig: Rig, y: number): [number, number, number, number] {
  const k = armKnots(rig);
  const n = k.ys.length;
  if (y <= k.ys[0]) return [k.as[0], k.bs[0], k.xs[0], k.zs[0]];
  if (y >= k.ys[n - 1]) return [k.as[n - 1], k.bs[n - 1], 0, k.zs[n - 1]];
  let i = 0;
  while (i < n - 2 && y > k.ys[i + 1]) i++;
  const t = (y - k.ys[i]) / (k.ys[i + 1] - k.ys[i]);
  const L = (v: number[]) => v[i] + (v[i + 1] - v[i]) * t;
  return [L(k.as), L(k.bs), L(k.xs), L(k.zs)];
}

/** a tube around the arm's axis following its cross-section, inflated by `extra(y)`, from ya to yb */
function sleeveTube(rig: Rig, ya: number, yb: number, extra: (y: number) => number, n = 9, k = 0): Prim {
  const ys: number[] = [], as: number[] = [], bs: number[] = [], xs: number[] = [], zs: number[] = [];
  for (let i = 0; i < n; i++) {
    const y = ya + (yb - ya) * (i / (n - 1));
    const [a, b, x, z] = armAt(rig, y);
    const e = extra(y);
    ys.push(y); as.push(a + e); bs.push(b + e * 0.92); xs.push(x); zs.push(z);
  }
  return limb(ys, as, bs, xs, zs, k);
}

export interface SkinBuild { sdf: Sdf; hand: Sdf; veins: V3[][]; tendons: V3[][] }

/** the bare-skin arm and hand */
export function skinSdf(rig: Rig, look: Look): SkinBuild {
  const b = rig.build, s = b.size, bw = b.breadth, g = b.girth, A = b.arm, LF = rig.foreLen, LU = rig.upperLen;
  const bony = b.bony, M = b.muscle;
  // ---------------------------------------------------------------- forearm and upper arm
  const arm = new Sdf(0);
  const kn = armKnots(rig);
  arm.add(limb(kn.ys, kn.as, kn.bs, kn.xs, kn.zs, 0));
  // muscle masses: brachioradialis and the extensors on the back, the flexors underneath
  arm.add(ell([-2.55 * A, -LF * 0.7, 1.05 * A], [1.55 * A * (0.7 + 0.3 * M), LF * 0.3, 1.5 * A * (0.7 + 0.3 * M)], [0.06, 1, 0.05], [1, 0, 0], 1.6));
  arm.add(ell([1.05 * A, -LF * 0.7, 1.75 * A], [1.7 * A, LF * 0.3, 1.25 * A * (0.75 + 0.25 * M)], [-0.03, 1, 0.04], [1, 0, 0], 1.6));
  arm.add(ell([0.95 * A, -LF * 0.66, -1.55 * A], [2.25 * A, LF * 0.33, 1.4 * A * (0.75 + 0.25 * M)], [-0.05, 1, -0.05], [1, 0, 0], 1.7));
  // the elbow point
  arm.add(ell([0.75 * A, -LF + 0.3, 2.75 * A], [1.45 * A, 1.7, 1.0 * A], [0, 1, 0.2], [1, 0, 0], 1.3));
  // the upper arm (only shows on bare arms)
  arm.add(cone([0, -LF - 1, 0.2 * A], [0, -LF - LU + 3, 0], 4.05 * A, 4.7 * A, 2.4));
  // ---------------------------------------------------------------- palm
  const palm = new Sdf(1.15);
  const mcp = FINGERS.map(ch => rig.bind[ch[0]].t);
  const fdir = FINGERS.map(ch => axis(rig, ch[0], [0, 1, 0]));
  const cmc: V3[] = [[-1.45 * s * bw, 2.4 * s, 0.05 * s], [-0.35 * s * bw, 2.55 * s, 0.1 * s], rig.bind[B.cup4].t, rig.bind[B.cup5].t];
  palm.add(ell([-0.15 * s * bw, 5.35 * s, -0.32 * s], [3.5 * s * bw, 3.55 * s, 1.02 * s], [0, 1, 0], [1, 0, 0], 0));
  for (let k = 0; k < 4; k++) {
    const r0 = rig.rad[FINGERS[k][0]][0];
    palm.add(cone(cmc[k], vsub(mcp[k], vscale(fdir[k], 0.2 * s)), 0.62 * s, r0 * 0.9, 0.8));
  }
  // heel of the hand over the carpus
  palm.add(ell([0.05 * s * bw, 1.45 * s, -0.12 * s], [2.85 * s * bw, 1.95 * s, 1.55 * s], [0, 1, 0], [1, 0, 0], 1.0));
  // thenar eminence (the fleshy mound at the base of the thumb) and the hypothenar along the edge
  const tcmc = rig.bind[B.th0].t;
  palm.add(ell([tcmc[0] + 0.05 * s, tcmc[1] + 1.75 * s, tcmc[2] - 0.95 * s], [1.5 * s, 2.35 * s, 1.15 * s], [-0.42, 0.9, -0.08], [1, 0, 0], 0.95));
  palm.add(ell([2.72 * s * bw, 4.25 * s, -0.6 * s], [1.12 * s, 2.95 * s, 1.0 * s], [0.1, 1, 0], [1, 0, 0], 0.95));
  // the pads under the knuckles, across the top of the palm
  palm.add(cone([mcp[0][0] - 0.1 * s, mcp[0][1] - 0.9 * s, -0.88 * s], [mcp[3][0] - 0.05 * s, mcp[3][1] - 0.75 * s, -0.86 * s], 0.8 * s, 0.7 * s, 0.75));
  // knuckle heads: the metacarpal ends show through on the back, most of all with the fist closed
  for (let k = 0; k < 4; k++) {
    const r0 = rig.rad[FINGERS[k][0]][0];
    palm.add(ell(vadd(mcp[k], [0, -0.16 * s, 0.24 * s * bony]), [r0 * 0.96, r0 * 0.9, r0 * (0.76 + 0.06 * bony)], fdir[k], [1, 0, 0], 0.4));
  }
  // ---------------------------------------------------------------- fingers (each its own group, so they only web at the palm)
  const fingers = new Sdf(0.62);
  for (let k = 0; k < 4; k++) {
    const f = new Sdf(0.03);
    for (let j = 0; j < 3; j++) {
      const i = FINGERS[k][j], L = rig.len[i], [r0, r1] = rig.rad[i];
      const end = j === 2 ? L - r1 * 0.92 : L;
      f.add(cone(rig.bind[i].t, pt(rig, i, 0, end, 0), r0, r1, j === 0 ? 0 : 0.12));
      // the pad of each phalanx
      const pr = j === 2 ? r1 : (r0 + r1) / 2;
      f.add(ell(pt(rig, i, 0, L * (j === 2 ? 0.6 : 0.52), -pr * 0.3), [pr * 0.88, L * (j === 2 ? 0.4 : 0.36), pr * 0.68], axis(rig, i, [0, 1, 0]), axis(rig, i, [1, 0, 0]), 0.22));
      // joint knuckles (middle and end joints): a little wider and higher on the back
      if (j > 0) f.add(ell(pt(rig, i, 0, 0.0, r0 * 0.1 * bony), [r0 * (1.0 + 0.03 * bony), r0 * 0.75, r0 * 0.86], axis(rig, i, [0, 1, 0]), axis(rig, i, [1, 0, 0]), 0.34));
    }
    // the nail plate, a hair proud of the nail bed
    const i3 = FINGERS[k][2], L3 = rig.len[i3], rt = rig.rad[i3][1];
    f.add(ell(pt(rig, i3, 0, L3 * 0.52, rt * 0.68), [rt * 0.74, L3 * 0.32, rt * 0.36], axis(rig, i3, [0, 1, 0]), axis(rig, i3, [1, 0, 0]), 0.12));
    fingers.add(f);
  }
  // ---------------------------------------------------------------- thumb
  const thumb = new Sdf(1.0);
  {
    const [t0, t1, t2] = THUMB;
    thumb.add(cone(rig.bind[t0].t, rig.bind[t1].t, 1.2 * s * g, 1.02 * s * g, 0));
    thumb.add(cone(rig.bind[t1].t, rig.bind[t2].t, rig.rad[t1][0], rig.rad[t1][1], 0.2));
    const L2 = rig.len[t2], r2 = rig.rad[t2][1];
    thumb.add(cone(rig.bind[t2].t, pt(rig, t2, 0, L2 - r2 * 0.9, 0), rig.rad[t2][0], r2, 0.14));
    // the MCP knuckle, the pads, the nail
    thumb.add(ell(pt(rig, t1, 0, 0.1 * s, 0.12 * s * bony), [rig.rad[t1][0] * 1.08, rig.rad[t1][0] * 0.7, rig.rad[t1][0] * 1.0], axis(rig, t1, [0, 1, 0]), axis(rig, t1, [1, 0, 0]), 0.25));
    thumb.add(ell(pt(rig, t1, 0, rig.len[t1] * 0.5, -rig.rad[t1][0] * 0.3), [rig.rad[t1][0] * 0.86, rig.len[t1] * 0.36, rig.rad[t1][0] * 0.66], axis(rig, t1, [0, 1, 0]), axis(rig, t1, [1, 0, 0]), 0.24));
    thumb.add(ell(pt(rig, t2, 0, L2 * 0.58, -r2 * 0.34), [r2 * 0.98, L2 * 0.42, r2 * 0.72], axis(rig, t2, [0, 1, 0]), axis(rig, t2, [1, 0, 0]), 0.24));
    thumb.add(ell(pt(rig, t2, 0, L2 * 0.52, r2 * 0.68), [r2 * 0.76, L2 * 0.33, r2 * 0.36], axis(rig, t2, [0, 1, 0]), axis(rig, t2, [1, 0, 0]), 0.12));
  }
  // the first web: the dorsal muscle between thumb and index, and the fold of skin on the palm side
  const web = new Sdf(0.9);
  {
    const tm = rig.bind[B.th1].t, im = mcp[0];
    const d = vnorm(vsub(im, tm));
    web.add(ell(vadd(vadd(tm, vscale(vsub(im, tm), 0.4)), [0.15 * s, -1.05 * s, 0.38 * s]), [0.92 * s, 1.85 * s, 0.82 * s], d, [0, 0, 1], 0));
    web.add(ell(vadd(vadd(tm, vscale(vsub(im, tm), 0.52)), [0.2 * s, 0.05 * s, -0.42 * s]), [0.42 * s, 1.55 * s, 0.42 * s], d, [0, 0, 1], 0));
  }
  // ---------------------------------------------------------------- wrist bones
  const bones = new Sdf(0.65);
  bones.add(ell([2.4 * s * bw, -0.6 * s, 0.95 * s], [0.46 * s, 0.6 * s, 0.36 * s * (0.7 + 0.3 * bony)], [0, 1, 0], [1, 0, 0], 0));
  bones.add(ell([-2.62 * s * bw, -0.35 * s, 0.15 * s], [0.48 * s, 0.75 * s, 0.5 * s], [0, 1, 0], [1, 0, 0], 0));

  // the hand blends into the end of the forearm over the wrist
  const hand = new Sdf(1.1).add(palm, fingers, thumb, web);
  const base = new Sdf(0).add(arm, hand, bones);
  // ---------------------------------------------------------------- tendons and veins laid onto the surface
  const lay = (pts: number[][], r: number, proud: number): V3[] => pts.map(p0 => {
    const q = project(base, [p0[0], p0[1], p0[2]], 8);
    // push the centre in so it stands `proud` above the skin
    const e = 0.02;
    const nx = base.eval(q[0] + e, q[1], q[2]) - base.eval(q[0] - e, q[1], q[2]);
    const ny = base.eval(q[0], q[1] + e, q[2]) - base.eval(q[0], q[1] - e, q[2]);
    const nz = base.eval(q[0], q[1], q[2] + e) - base.eval(q[0], q[1], q[2] - e);
    const n = vnorm([nx, ny, nz]);
    return vsub(q as V3, vscale(n, r - proud));
  });
  const tendons: V3[][] = [];
  const tg = new Sdf(0.5);
  for (let k = 0; k < 4; k++) {
    const m = mcp[k];
    // under the wrist band they lie flat; they rise toward the knuckles
    const path = lay([[m[0] * 0.25, 1.2 * s, 3], [m[0] * 0.58, 3.8 * s, 3], [m[0] * 0.88, 6.4 * s, 3], [m[0], m[1] - 0.7 * s, 3]], 0.26 * s, 0.045 * s * bony);
    tendons.push(path);
    for (let i = 0; i + 1 < path.length; i++) tg.add(cone(path[i], path[i + 1], i === 0 ? 0.2 * s : 0.26 * s, 0.26 * s, 0));
  }
  // the wrist flexor tendons on the inside of the wrist
  for (const x of [0.2, -1.05]) {
    const path = lay([[x * s * bw, -LF * 0.22, -6], [x * s * bw, -LF * 0.13, -6], [x * s * bw, -2.4 * s, -6], [x * s * bw, -1.2 * s, -6]], 0.22 * s, 0.016 * s * bony);
    tendons.push(path);
    for (let i = 0; i + 1 < path.length; i++) tg.add(cone(path[i], path[i + 1], 0.2 * s, 0.2 * s, 0));
  }
  const veins: V3[][] = [];
  const vg = new Sdf(0.34);
  const vr = 0.13 * s, vp = 0.042 * s * b.veins;
  const vlines: number[][][] = [
    // from between the index and middle knuckles across the back of the hand to the thumb side of the wrist, then up the forearm
    [[-2.1, 7.7, 3], [-1.6, 5.9, 3], [-1.85, 3.8, 3], [-2.1, 1.6, 3], [-2.3, -1.2, 3], [-2.55, -LF * 0.25, 3], [-2.9, -LF * 0.5, 2], [-2.6, -LF * 0.75, 2]],
    // the little-finger side
    [[1.85, 7.4, 3], [1.5, 5.4, 3], [1.25, 3.4, 3], [1.55, 1.2, 3], [2.0, -1.5, 3], [2.4, -LF * 0.22, 2]],
    // a short branch across the back of the hand
    [[-1.75, 3.6, 3], [-0.7, 2.9, 3], [0.4, 2.7, 3]],
  ];
  if (b.veins > 0.2) for (const vl of vlines) {
    const path = lay(vl.map(([x, y, z]) => [x * s * bw, y > 0 ? y * s : y, z]), vr, vp);
    veins.push(path);
    for (let i = 0; i + 1 < path.length; i++) vg.add(cone(path[i], path[i + 1], vr, vr * 0.92, 0));
  }
  const sdf = new Sdf(0).add(base, tg, vg);
  return { sdf, hand, veins, tendons };
}

// ------------------------------------------------------------------ sleeves
export interface SleeveBuild { parts: { sdf: Sdf; mat: number }[]; skinFrom: number }

/** the sleeve for a look and where the skin can stop (inside it) */
export function sleeveSdf(rig: Rig, look: Look): SleeveBuild {
  const LF = rig.foreLen, LU = rig.upperLen, A = rig.build.arm, s = rig.build.size;
  const top = -LF - LU + 2;
  const parts: { sdf: Sdf; mat: number }[] = [];
  const th = (x: number, z: number) => Math.atan2(z, x);
  switch (look.sleeve) {
    case 'rolled': {
      // a heavy jacket sleeve shoved up and rolled twice just below the elbow... well, mid-forearm
      const yc = -LF * 0.47;
      const roll = new Sdf(0);
      const r = sleeveTube(rig, yc - 2.6, yc + 0.5, y => {
        const u = (y - (yc - 2.6)) / 3.1;
        return 0.42 + Math.sin(Math.min(1, u * 1.05) * Math.PI) * 0.78 + (u > 0.5 ? (0.5 - u) * 0.3 : 0);
      }, 11, 0);
      r.disp = (x, y, z) => Math.sin(th(x, z) * 3 + y * 0.6) * 0.35 + snoise3(x * 0.8, y * 0.8, z * 0.8) * 0.6;
      r.dispAmp = 0.12;
      roll.add(r);
      // the seam between the two turns of the roll
      const seam = sleeveTube(rig, yc - 1.25, yc - 1.05, () => 1.3, 3, 0);
      seam.sub = true; seam.k = 0.25;
      roll.add(seam);
      parts.push({ sdf: roll, mat: MAT.roll });
      const sl = new Sdf(0);
      const body = sleeveTube(rig, top, yc - 2.2, y => 1.15 + (y > -LF + 4 ? 0.25 : 0), 12, 0);
      body.disp = (x, y, z) => {
        const a = th(x, z);
        return Math.sin(y * 0.9 + Math.sin(a * 2 + y * 0.3) * 1.6) * 0.5 + Math.sin(a * 5 + y * 0.25) * 0.25 + snoise3(x * 0.5, y * 0.35, z * 0.5) * 0.8;
      };
      body.dispAmp = 0.32;
      sl.add(body);
      parts.push({ sdf: sl, mat: MAT.sleeve });
      return { parts, skinFrom: yc - 2.4 };
    }
    case 'hoodie': {
      // rib-knit cuff snug on the wrist, the sleeve bagging above it
      const cuff = new Sdf(0);
      const c = sleeveTube(rig, -5.2 * s, -0.35 * s, y => 0.3 + sstep(-1.2 * s, -0.4 * s, y) * -0.04 + (y < -4.6 * s ? (-4.6 * s - y) * 0.35 : 0), 7, 0);
      c.disp = (x, _y, z) => Math.cos(th(x, z) * 34) * 0.5 + 0.5;
      c.dispAmp = 0.05;
      cuff.add(c);
      parts.push({ sdf: cuff, mat: MAT.rib });
      const sl = new Sdf(0);
      const body = sleeveTube(rig, top, -4.4 * s, y => 0.65 + sstep(-4.4 * s, -9 * s, y) * 1.15, 12, 0);
      body.disp = (x, y, z) => {
        const a = th(x, z);
        return Math.sin(y * 0.55 + Math.sin(a * 2 + y * 0.2) * 2.2) * 0.6 + snoise3(x * 0.4, y * 0.3, z * 0.4) * 0.9;
      };
      body.dispAmp = 0.42;
      sl.add(body);
      parts.push({ sdf: sl, mat: MAT.sleeve });
      return { parts, skinFrom: -3.8 * s };
    }
    case 'pushed': {
      // a knit gansey sleeve shoved up past the elbow into a thick bunched roll
      const y0 = -LF - 8.5, y1 = -LF - 0.8;
      const roll = new Sdf(0);
      const r = sleeveTube(rig, y0, y1, y => 1.2 + Math.sin(((y - y0) / (y1 - y0)) * Math.PI) * 0.75, 9, 0);
      r.disp = (x, y, z) => { const a = th(x, z); return Math.sin(y * 1.9 + Math.sin(a * 3) * 1.2) * 0.6 + Math.cos(a * 26) * 0.25 + snoise3(x, y, z) * 0.5; };
      r.dispAmp = 0.3;
      roll.add(r);
      parts.push({ sdf: roll, mat: MAT.roll });
      const sl = new Sdf(0);
      const body = sleeveTube(rig, top, y0 + 0.5, () => 0.95 * A, 8, 0);
      body.disp = (x, y, z) => Math.cos(th(x, z) * 26) * 0.4 + Math.sin(y * 0.7) * 0.3;
      body.dispAmp = 0.2;
      sl.add(body);
      parts.push({ sdf: sl, mat: MAT.sleeve });
      return { parts, skinFrom: y0 + 1.5 };
    }
    case 'parka':
    case 'oilskin': {
      const puffy = look.sleeve === 'parka';
      const cuff = new Sdf(0);
      cuff.add(sleeveTube(rig, -3.6 * s, -0.55 * s, () => 0.42, 5, 0));
      parts.push({ sdf: cuff, mat: MAT.rib });
      const sl = new Sdf(0);
      const body = sleeveTube(rig, top, -1.6 * s, y => (puffy ? 2.1 : 1.35) + sstep(-1.6 * s, -6 * s, y) * 0.4, 12, 0);
      body.disp = puffy
        ? (x, y, z) => { const q = Math.cos(y * 1.05); return q * q * q * q * -1 + 0.5 + snoise3(x * 0.4, y * 0.4, z * 0.4) * 0.5; }
        : (x, y, z) => { const a = th(x, z); return Math.sin(y * 0.6 + Math.sin(a * 2) * 1.4) * 0.6 + snoise3(x * 0.3, y * 0.25, z * 0.3); };
      body.dispAmp = puffy ? 0.2 : 0.3;
      sl.add(body);
      parts.push({ sdf: sl, mat: MAT.sleeve });
      return { parts, skinFrom: -3.2 * s };
    }
    default:
      return { parts, skinFrom: -LF - LU + 4 };
  }
}

// ------------------------------------------------------------------ wrist things
export function accessorySdfs(rig: Rig, look: Look, side: 'left' | 'right'): { sdf: Sdf; mat: number; h: number }[] {
  const out: { sdf: Sdf; mat: number; h: number }[] = [];
  const s = rig.build.size;
  if (look.watch === side && !look.gloves) {
    const yw = -2.1 * s;
    const [, bD, , zc] = armAt(rig, yw);
    const strap = new Sdf(0);
    strap.add(sleeveTube(rig, yw - 0.95 * s, yw + 0.95 * s, () => 0.24, 3, 0));
    out.push({ sdf: strap, mat: MAT.strap, h: 0.13 });
    const zt = zc + bD + 0.12;
    const cas = new Sdf(0);
    cas.add(cone([0, yw, zt - 0.3], [0, yw, zt + 0.42], 1.72 * s, 1.62 * s, 0));
    // lugs to the strap and the crown on the side
    for (const sy of [-1, 1]) cas.add(cone([0, yw + sy * 1.45 * s, zt - 0.05], [0, yw + sy * 1.95 * s, zt - 0.25], 0.42 * s, 0.32 * s, 0.15));
    cas.add(cone([-1.65 * s, yw, zt + 0.05], [-2.0 * s, yw, zt + 0.05], 0.22, 0.2, 0.05));
    // the bezel lip round the glass
    const well = cone([0, yw, zt + 0.32], [0, yw, zt + 0.7], 1.36 * s, 1.36 * s, 0);
    well.sub = true; well.k = 0.06;
    cas.add(well);
    out.push({ sdf: cas, mat: MAT.metal, h: 0.085 });
    const glass = new Sdf(0);
    glass.add(cone([0, yw, zt + 0.12], [0, yw, zt + 0.36], 1.38 * s, 1.33 * s, 0));
    out.push({ sdf: glass, mat: MAT.glass, h: 0.1 });
  }
  if ((look.bracelet === side || look.bracelet === 'both') && !look.gloves) {
    const yb = side === 'left' ? -1.9 * s : -2.4 * s;
    const band = new Sdf(0);
    const t = sleeveTube(rig, yb - 1.05 * s, yb + 1.05 * s, y => 0.24 - ((y - yb) / (1.05 * s)) ** 6 * 0.1, 5, 0);
    band.add(t);
    out.push({ sdf: band, mat: MAT.taniko, h: 0.13 });
  }
  return out;
}

/** gloves: the hand inflated, the fingers a touch blunter, with a cuff over the wrist */
export function gloveSdf(rig: Rig, skin: SkinBuild, look: Look): { glove: Sdf; cuff: Sdf } {
  const s = rig.build.size;
  const kind = look.gloves?.kind ?? 'knit';
  const inflate = kind === 'knit' ? 0.24 * s : kind === 'leather' ? 0.17 * s : 0.14 * s;
  const h = skin.hand;
  const glove = new Sdf(0);
  const inflated = new Sdf(0).add(h);
  inflated.offset = inflate;
  glove.add(inflated);
  glove.add(sleeveTube(rig, -2.4 * s, 1.4 * s, y => inflate + 0.12 + sstep(0.2 * s, 1.4 * s, y) * -0.06, 5, 0.6));
  const cuff = new Sdf(0);
  const c = sleeveTube(rig, -7.2 * s, -1.4 * s, y => inflate + (kind === 'knit' ? 0.28 : 0.52) + (y < -6.5 * s ? (-6.5 * s - y) * 0.5 : 0), 6, 0);
  if (kind === 'knit') { c.disp = (x, _y, z) => Math.cos(Math.atan2(z, x) * 30) * 0.5 + 0.5; c.dispAmp = 0.05; }
  cuff.add(c);
  return { glove, cuff };
}

// ------------------------------------------------------------------ skin weights and anatomical coordinates
/** a polyline as flat xyz plus segment lengths, for allocation-free projection */
class Chain {
  readonly p: Float64Array;
  readonly len: Float64Array;
  constructor(pts: V3[]) {
    this.p = new Float64Array(pts.length * 3);
    pts.forEach((q, i) => this.p.set(q, i * 3));
    this.len = new Float64Array(pts.length - 1);
    for (let i = 0; i + 1 < pts.length; i++) this.len[i] = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1], pts[i + 1][2] - pts[i][2]);
  }
  // results of the last projection
  s = 0; d = 0; seg = 0; t = 0;
  /** project (x, y, z): s = arc length at the nearest point (negative before the start) */
  project(x: number, y: number, z: number) {
    const P = this.p;
    let best = 1e9, acc = 0;
    for (let i = 0; i < this.len.length; i++) {
      const ax = P[i * 3], ay = P[i * 3 + 1], az = P[i * 3 + 2];
      const bx = P[i * 3 + 3] - ax, by = P[i * 3 + 4] - ay, bz = P[i * 3 + 5] - az, L = this.len[i];
      const t = ((x - ax) * bx + (y - ay) * by + (z - az) * bz) / (L * L);
      const tc = i === 0 ? (t > 1 ? 1 : t) : t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = x - ax - bx * tc, qy = y - ay - by * tc, qz = z - az - bz * tc;
      const d = Math.sqrt(qx * qx + qy * qy + qz * qz);
      if (d < best) { best = d; this.s = acc + tc * L; this.seg = i; this.t = tc; }
      acc += L;
    }
    this.d = best;
  }
}

export interface Bake {
  bones: Uint8Array; weights: Float32Array;
  /** s along the digit, dorsal (-1..1), lateral (-1..1), region (0 thumb, 1..4 fingers, 5 palm, 6 arm) */
  detail: Float32Array;
}

export class Skinner {
  private chains: Chain[] = [];
  private tchain: Chain;
  private flen: number[][] = [];
  private tlen: number[] = [];
  private dist = [0, 0, 0, 0];
  private sel = [0, 0, 0, 0];
  private F = [0, 0, 0, 0];
  constructor(readonly rig: Rig) {
    for (const ch of FINGERS) {
      const pts = ch.map(i => rig.bind[i].t);
      pts.push(pt(rig, ch[2], 0, rig.len[ch[2]], 0));
      this.chains.push(new Chain(pts));
      this.flen.push(ch.map(i => rig.len[i]));
    }
    const tp = THUMB.map(i => rig.bind[i].t);
    tp.push(pt(rig, B.th2, 0, rig.len[B.th2], 0));
    this.tchain = new Chain(tp);
    this.tlen = THUMB.map(i => rig.len[i]);
  }

  /** weights for a bind-space point (into w: NB floats) and its anatomical coordinates */
  weigh(p: V3, w: Float32Array, det: number[]) {
    const rig = this.rig, b = rig.build, s = b.size, bw = b.breadth, LF = rig.foreLen;
    w.fill(0);
    const x = p[0], y = p[1], z = p[2];
    // ---- arm part
    const wHand = sstep(-2.1 * s, 0.45 * s, y);
    const wUpper = 1 - sstep(-LF - 3.2, -LF + 2.6, y);
    const wFore = Math.max(0, 1 - wHand - wUpper);
    w[B.upper] += wUpper; w[B.fore] += wFore;
    if (wHand <= 0) { det[0] = y; det[1] = 0; det[2] = x; det[3] = 6; return; }
    // ---- fingers: soft nearest-finger choice, then along the chain
    const dist = this.dist, sel = this.sel, F = this.F;
    let dmin = 1e9;
    for (let k = 0; k < 4; k++) {
      const c = this.chains[k];
      c.project(x, y, z);
      if (c.s < -2.6 * s) { dist[k] = 1e9; continue; }
      const r = rig.rad[FINGERS[k][c.seg < 2 ? c.seg : 2]];
      dist[k] = c.d - (r[0] + (r[1] - r[0]) * c.t);
      if (dist[k] < dmin) dmin = dist[k];
    }
    let ssum = 0;
    for (let k = 0; k < 4; k++) { sel[k] = dist[k] > 1e8 ? 0 : Math.exp(-(dist[k] - dmin) / (0.17 * s)); ssum += sel[k]; }
    if (ssum <= 0) ssum = 1;
    let Fs = 0;
    for (let k = 0; k < 4; k++) {
      const r0 = rig.rad[FINGERS[k][0]][0], c = this.chains[k];
      F[k] = dist[k] > 1e8 ? 0 : (sel[k] / ssum) * sstep(-0.95 * r0, 0.55 * r0, c.s) * (1 - sstep(0.9 * s, 2.4 * s, dist[k]));
      Fs += F[k];
    }
    // ---- thumb
    const tc = this.tchain;
    tc.project(x, y, z);
    const tr = rig.rad[THUMB[tc.seg < 2 ? tc.seg : 2]];
    const td = tc.d - (tr[0] + (tr[1] - tr[0]) * tc.t);
    let T = sstep(-0.5 * s, 1.25 * s, tc.s) * (1 - sstep(0.35 * s, 2.0 * s, td));
    if (T + Fs > 1) {
      const k = (1 - T) / Math.max(1e-6, Fs);
      if (k < 0) { T = 1; Fs = 0; F[0] = F[1] = F[2] = F[3] = 0; } else { for (let i = 0; i < 4; i++) F[i] *= k; Fs *= k; }
    }
    const P = Math.max(0, 1 - T - Fs);
    // palm share: the ring and little metacarpals fold with the cupping bones
    const yc = sstep(2.5 * s, 5.6 * s, y);
    const c5 = sstep(1.25 * s * bw, 2.45 * s * bw, x) * yc;
    const c4 = sstep(-0.15 * s * bw, 0.85 * s * bw, x) * (1 - sstep(1.25 * s * bw, 2.45 * s * bw, x)) * yc * 0.85;
    w[B.cup5] += wHand * P * c5; w[B.cup4] += wHand * P * c4; w[B.hand] += wHand * P * Math.max(0, 1 - c4 - c5);
    // each finger along its chain; what's left at the root goes to its metacarpal
    for (let k = 0; k < 4; k++) {
      if (F[k] <= 1e-5) continue;
      const c = this.chains[k], L = this.flen[k], r0 = rig.rad[FINGERS[k][0]][0];
      const wm = 0.72 * r0, wp = 0.44 * r0, wd = 0.36 * r0;
      const a1 = sstep(-wm, wm, c.s), a2 = sstep(L[0] - wp, L[0] + wp, c.s), a3 = sstep(L[0] + L[1] - wd, L[0] + L[1] + wd, c.s);
      const fw = wHand * F[k];
      w[k === 2 ? B.cup4 : k === 3 ? B.cup5 : B.hand] += fw * (1 - a1);
      w[FINGERS[k][0]] += fw * (a1 - a2 > 0 ? a1 - a2 : 0);
      w[FINGERS[k][1]] += fw * (a2 - a3 > 0 ? a2 - a3 : 0);
      w[FINGERS[k][2]] += fw * a3;
    }
    if (T > 1e-5) {
      const L = this.tlen;
      const a1 = sstep(L[0] - 0.55 * s, L[0] + 0.45 * s, tc.s), a2 = sstep(L[0] + L[1] - 0.4 * s, L[0] + L[1] + 0.36 * s, tc.s);
      const tw = wHand * T;
      w[B.th0] += tw * (1 - a1); w[B.th1] += tw * Math.max(0, a1 - a2); w[B.th2] += tw * a2;
    }
    // ---- anatomical coordinates for the shader
    let region = 5, ds = y, dd = 0, dl = x;
    let bestF = -1, kf = -1;
    for (let k = 0; k < 4; k++) if (F[k] > bestF) { bestF = F[k]; kf = k; }
    if (wHand < 0.5 && y < 0.5) region = 6;
    else if (T >= 0.5 || (T > bestF && T > P)) {
      region = 0;
      this.radial(THUMB[tc.seg < 2 ? tc.seg : 2], x, y, z);
      ds = tc.s; dd = this.rd; dl = this.rl;
    } else if (bestF >= P && kf >= 0) {
      region = kf + 1;
      const c = this.chains[kf];
      this.radial(FINGERS[kf][c.seg < 2 ? c.seg : 2], x, y, z);
      ds = c.s; dd = this.rd; dl = this.rl;
    }
    det[0] = ds; det[1] = dd; det[2] = dl; det[3] = region;
  }
  private rd = 0; private rl = 0;
  /** dorsal and lateral components of the direction from bone i's axis to the point */
  private radial(i: number, x: number, y: number, z: number) {
    const f = this.rig.bind[i], loc = qrot([-f.q[0], -f.q[1], -f.q[2], f.q[3]], [x - f.t[0], y - f.t[1], z - f.t[2]]);
    const l = Math.hypot(loc[0], loc[2]) || 1;
    this.rd = loc[2] / l; this.rl = loc[0] / l;
  }
}

/** keep the 4 heaviest bones, normalized */
export function top4(w: Float32Array, bones: Uint8Array, weights: Float32Array, o: number) {
  const idx = [0, 0, 0, 0], val = [0, 0, 0, 0];
  for (let i = 0; i < NB; i++) {
    const v = w[i];
    if (v <= val[3]) continue;
    let j = 3;
    while (j > 0 && v > val[j - 1]) { val[j] = val[j - 1]; idx[j] = idx[j - 1]; j--; }
    val[j] = v; idx[j] = i;
  }
  const sum = val[0] + val[1] + val[2] + val[3] || 1;
  for (let j = 0; j < 4; j++) { bones[o + j] = idx[j]; weights[o + j] = val[j] / sum; }
}

export const vcrossU = vcross;

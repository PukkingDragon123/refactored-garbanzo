// V12 Te Ara Matatū, chapter 5: Te Wheke Kōhatu, the stone-den octopus of the Deep (Enteroctopus
// lithophilus), painted on the Relief layer (beasts-relief): every arm, the web, the mantle, the head
// and the horn is its own contour (v9/wild/contour strip for the swept arms and sac), lit from its
// height field.
//
// A giant octopus, its arms longer than Mori is tall: a heavy, wrinkled, warty mantle in brick red, a
// big gold eye with a dark bar pupil under a twisted horn of skin (the supra-ocular papilla), the white
// funnel under it, and eight thick tapering arms, each lined with a double row of pale cream suckers,
// joined at their roots by a deep web. Its skin is never still: chromatophores make dark mottled
// clouds over the brick, the warts lift and flatten, and when it is cornered it goes ghost-pale with
// a dark ring round the eye and its arms flung wide (the deimatic display).
//
// The skin carries the detail: brick red gathered into dark colour patches netted by paler lines,
// papillae standing up as lit warts (more when it is tense), soft wrinkles ringing the heavy sac,
// the eye's gold iris barred by a black pupil whose lower edge dips into a W, the ridged horn, the
// lipped funnel. Each arm tapers from a thick root to a coiling tip, two staggered rows of sucker
// cups (a pale rim round a dark cup, smaller toward the tip) along its inner edge, and a membrane web
// with radial folds and a sagging scalloped edge joins the roots.
//
// Anims (anchor: the eye's middle, facing right = the eye's side; a jetting octopus goes mantle first,
// and the art turns it so that mantle-first is also +x): idle (hovering, arms curling slowly), crawl
// (walking on its arm tips over the bed), jet (mantle forward, arms streamed behind, pulsing), display
// (pale, arms spread, the eye ringed dark), grab (two arms shooting forward, suckers out), ink (a jet
// and a cloud of dark ink thrown behind), den (squeezed into its den: the eye up over coiled arms, the
// mantle tucked back into the dark), flash (a dark wave of colour passing over it, the "passing cloud").

import { Sk, V2, rmp, SpeciesDef, TAU, sm, hh, chain } from '../../beasts-core';
import type { BeastEye, AnimDef } from '../../beasts-core';
import { Relief, Sp, Tx, LM, spline as cspline, cell, W as WC, vn } from '../../beasts-relief';
import { strip } from '../../v9/wild/contour';
import { arcs, onPath, frac } from '../../v9/shore/shore-kit';
import { hex } from '../../color';
import { clamp } from '../../../core/math';

const A = (frames: number, fps: number, loop = true): AnimDef => ({ frames, fps, loop });
export const WHEKE_ANIMS: Record<string, AnimDef> = {
  idle: A(6, 4),
  crawl: A(6, 6),
  jet: A(4, 7),
  display: A(4, 5),
  grab: A(5, 9, false),
  ink: A(5, 9, false),
  den: A(4, 2),
  flash: A(6, 8),
  swim: A(4, 7),
};

interface Arm {
  /** heading at the root (radians, screen space) and the curl along it (total turn) */
  ang: number; curl: number;
  /** a wave running down it: amplitude, phase */
  wa: number; wp: number;
  /** length factor; near (in front of the body) or far (behind, darker) */
  len: number; near: boolean;
  /** which side the suckers are on (+1: left of travel) */
  suck: 1 | -1;
}
interface OP {
  /** mantle axis angle from the head (where it points), how long and how full */
  mAng: number; mLen: number; mFull: number;
  arms: Arm[];
  /** 0 brick, 1 ghost pale */
  pale: number;
  /** the passing cloud: position of the dark band along the body (-1 off) */
  cloud: number;
  /** dark ring round the eye */
  ring: number;
  ink: number;
  /** tucked in its den: the far half fades into the dark */
  den: number;
  /** horn up (0 flat .. 1 raised) and warts raised */
  horn: number; warts: number;
  eyeK: number;
}

const ARM_L = 46;
function arms8(base: number, spread: number, curl: number, o: { ph?: number; wa?: number; len?: number } = {}): Arm[] {
  // four far arms behind the body, four near ones in front; fanned round `base`
  const out: Arm[] = [];
  for (let i = 0; i < 8; i++) {
    const near = i % 2 === 0;
    const k = (i - 3.5) / 3.5;
    out.push({
      ang: base + k * spread * (near ? 0.8 : 1) + (hh(i, 9, 17) - 0.5) * spread * 0.25,
      curl: curl * (0.55 + 0.9 * hh(i, 3, 11)) * (k < 0 ? 1 : 1.15),
      wa: o.wa ?? 0.5, wp: (o.ph ?? 0) + i * 0.8,
      len: (o.len ?? 1) * (0.86 + 0.24 * hh(i, 5, 13)),
      near, suck: k < 0 ? -1 : 1,
    });
  }
  return out;
}

function opose(anim: string, f: number, n: number): OP {
  const t = f / n, s = Math.sin(t * TAU), c = Math.cos(t * TAU);
  const p: OP = { mAng: -2.35, mLen: 26, mFull: 1, arms: [], pale: 0, cloud: -1, ring: 0, ink: 0, den: 0, horn: 0.5, warts: 0.5, eyeK: 1 };
  switch (anim) {
    case 'idle': case 'flash':
      p.mAng = -2.3 + s * 0.06; p.mFull = 1 + s * 0.05;
      p.arms = arms8(1.4, 0.95, 3.2, { ph: t * TAU, wa: 0.7 });
      p.arms.forEach((a, i) => { if (i === 1 || i === 6) { a.curl *= -0.6; } if (i === 0) { a.ang = 2.6; a.curl = 2.5; } });
      if (anim === 'flash') p.cloud = -0.3 + t * 1.7;
      break;
    case 'crawl': {
      p.mAng = -2.55 + s * 0.05; p.mFull = 1;
      p.arms = arms8(1.45, 0.95, 0.5, { ph: t * TAU * 1.0, wa: 0.35 });
      // arm tips planted and stepping: alternate arms swing forward
      p.arms.forEach((a, i) => { const ph = t * TAU + (i % 2) * Math.PI; a.ang += Math.sin(ph) * 0.22; a.curl = 0.5 + Math.max(0, Math.cos(ph)) * 0.9; });
      break;
    }
    case 'jet': case 'swim': {
      // mantle first (+x), the arms streaming out behind; the mantle squeezes (jet) and refills
      const pulse = anim === 'jet' ? [1.12, 0.86, 0.92, 1.05][f] : 1 + s * 0.05;
      p.mAng = 0.08; p.mLen = 28 * (2 - pulse) * 0.95; p.mFull = pulse;
      p.arms = arms8(Math.PI - 0.06, 0.07 + (pulse - 0.86) * 0.55, 0.15, { ph: t * TAU, wa: 0.55, len: 1.08 });
      p.arms.forEach((a, i) => { a.curl = (i - 3.5) * -0.09; });
      p.warts = 0.1; p.horn = 0.1;
      break;
    }
    case 'display':
      p.mAng = -2.0 + s * 0.04; p.mFull = 1.08;
      p.arms = arms8(1.2, 2.25, 0.9 + c * 0.15, { ph: t * TAU * 0.5, wa: 0.25, len: 1.02 });
      p.pale = 1; p.ring = 1; p.horn = 1; p.warts = 0.1;
      break;
    case 'grab': {
      const k = [0.2, 0.7, 1, 1, 0.6][f];
      p.mAng = -2.5 + k * 0.25;
      p.arms = arms8(1.3, 1.0, 1.4 - k * 0.6, { ph: f * 0.7, wa: 0.35 });
      // two near arms shoot forward at the target
      for (const i of [4, 6]) { const a = p.arms[i]; a.ang = 0.15 + (i - 5) * 0.08 - k * 0.1; a.curl = 0.25 * (1 - k) + (f === 4 ? 1.2 : 0); a.len = 1.05 + k * 0.35; a.wa = 0.1; }
      p.horn = 1; p.warts = 0.8;
      break;
    }
    case 'ink': {
      const pulse = [1.15, 0.8, 0.9, 1, 1.05][f];
      p.mAng = 0.1; p.mLen = 28 * (2 - pulse) * 0.95; p.mFull = pulse;
      p.arms = arms8(Math.PI - 0.06, 0.22, 0.1, { ph: f, wa: 0.3, len: 1.05 });
      p.ink = [0.25, 0.6, 0.9, 1.1, 1.25][f];
      p.pale = 0.35;
      break;
    }
    case 'den':
      p.mAng = -2.75 + s * 0.04; p.mLen = 22; p.mFull = 0.92 + s * 0.04;
      p.arms = arms8(1.6, 0.7, 4.4, { ph: t * TAU, wa: 0.25, len: 0.82 });
      p.den = 1; p.horn = 0.8; p.warts = 0.9;
      break;
  }
  return p;
}

const lerpC = (a: number, b: number, k: number) => a + (b - a) * k;
const ID = { FAR: 1, WEB: 2, MANTLE: 3, HEAD: 4, FUNNEL: 5, HORN: 6, NEAR: 7 };

function odraw(sk: Sk, anim: string, frame: number, _eye: BeastEye, juv: boolean) {
  const n = WHEKE_ANIMS[anim]?.frames ?? 1;
  const P = opose(WHEKE_ANIMS[anim] ? anim : 'idle', frame, n);
  const k = juv ? 0.55 : 1;
  const pale = P.pale;
  const M = {
    skin: sk.m(rmp(pale > 0.6 ? '#d8c4b2' : pale > 0.2 ? '#b0604a' : '#93382a', { n: 7, dark: 0.58, light: 0.42, cool: 0.18, warm: 0.3 }), { edge: 1 }),
    deep: sk.m(rmp(pale > 0.6 ? '#a88e80' : '#5a1c16', { n: 6, dark: 0.52, light: 0.32, cool: 0.2, warm: 0.2 }), { edge: 1 }),
    wart: sk.m(rmp(pale > 0.6 ? '#f2e6d6' : '#cc7a5c', { n: 5, dark: 0.4, light: 0.4, warm: 0.3 }), { edge: 1 }),
    sucker: sk.m(rmp('#ead2b8', { n: 5, dark: 0.4, light: 0.4, warm: 0.2, cool: 0.1 }), { edge: 1 }),
    cup: sk.m(rmp('#b08068', { n: 4, dark: 0.45, light: 0.3 }), { edge: 1 }),
    web: sk.m(rmp(pale > 0.6 ? '#c4ab9a' : '#76281f', { n: 5, dark: 0.5, light: 0.32, cool: 0.2 }), { edge: 1 }),
    funnel: sk.m(rmp('#d8b8a4', { n: 5, dark: 0.45, light: 0.35, cool: 0.1 }), { edge: 1 }),
    rim: sk.m(rmp(pale > 0.6 ? '#3a2018' : '#4e1a12', { n: 4, dark: 0.45, light: 0.3 }), { edge: 1 }),
  };
  const H: V2 = [0, 0];
  const mdx = Math.cos(P.mAng), mdy = Math.sin(P.mAng);
  // the passing cloud: a darkening band moving along the body (0 at the arm tips' end .. 1 the mantle's)
  const cloud = (q: number) => (P.cloud < -0.5 ? 0 : Math.max(0, 1 - Math.abs(q - P.cloud) / 0.22) * 0.42);
  /**
   * The skin: brick red, its chromatophores gathered into dark patches netted by paler lines, the
   * papillae standing up as lit warts (more when it is tense), the passing cloud, ghost-pale in the
   * display, sunk in shadow at the back of its den.
   */
  const skinTex = (q: number, far: boolean, wartK = 1) => (p: Sp, o: Tx) => {
    o.m = M.skin;
    o.t -= cloud(q) + (far ? 0.16 : 0);
    if (P.den) o.t -= sm((q - 0.55) / 0.4) * 0.35;
    // colour patches: big soft blotches, and inside them the reticulated net of the colour cells
    const blot = vn(p.x / 9, p.y / 9);
    cell(p.x, p.y, 3.4 * k + 0.6, 3 * k + 0.6, 71);
    const net = WC.f2 - WC.f1;
    if (pale < 0.5 && !far && blot > 0.56) { o.m = M.deep; if (net < 0.12) o.m = M.skin; }
    else if (pale >= 0.5 && net < 0.08) o.t -= 0.06;
    // papillae: little domes, lit on the crown
    const pap = cell(p.x + 31, p.y + 17, 2.6 * k + 0.6, 2.4 * k + 0.6, 77);
    const isP = pap.ci < (0.22 + P.warts * 0.3) * wartK && pap.f1 < 0.34;
    if (isP) { o.z += (0.36 - pap.f1) * 4.2 * (0.5 + P.warts); if (pap.f1 < 0.2) { o.m = M.wart; o.t += 0.05; } }
    else o.z += (hh(p.x, p.y, 79) - 0.5) * 0.25;
  };

  // ---------------------------------------------------------------- the arms
  const rootC: V2 = [H[0] - mdx * 5 * k, H[1] - mdy * 5 * k];
  const armPts: V2[][] = [];
  const armR = (t: number) => (3.9 * Math.pow(1 - t, 1.1) + 0.45 + (t < 0.12 ? (0.12 - t) * 6 : 0)) * k;
  P.arms.forEach((a, idx) => {
    const N = 18, L = ARM_L * a.len * k;
    const sp = P.mAng > -1 && P.mAng < 1 ? 0.25 : 0.55;
    const off: V2 = [Math.cos(a.ang + Math.PI / 2) * (idx - 3.5) * sp * k, Math.sin(a.ang + Math.PI / 2) * (idx - 3.5) * sp * k];
    const start: V2 = [rootC[0] + off[0] + Math.cos(a.ang) * 1.5, rootC[1] + off[1] + Math.sin(a.ang) * 1.5];
    // the curl gathers toward the tip (tips coil tighter), with a travelling wave
    armPts[idx] = chain(start, a.ang, N, i => L / N * (1 - i / N * 0.3), i => {
      const u = i / N;
      return (a.curl * u * u * u * 3.4) / N * (a.suck > 0 ? 1 : -1) + Math.sin(u * 5 - a.wp) * a.wa * 0.07;
    });
  });
  /** one arm as a tapering contour: skin on the outer side, two staggered rows of sucker cups inside */
  // streamed back in a jet the arms lie in a bundle, suckers turned in (only the splayed tips show them)
  const bundled = P.mAng > -1 && P.mAng < 1;
  const paintArm = (R: Relief, idx: number, z: number) => {
    const a = P.arms[idx], pts = armPts[idx];
    const cum = arcs(pts), Lr = cum[cum.length - 1];
    const side = a.suck > 0 ? 1 : -1;
    // the sucker edge is scalloped: each cup stands proud of the arm's outline
    const rsAt = (t: number) => Math.max(0.7, Math.min(1.5 * k + 0.2, armR(t) * 0.4));
    const cupEdge = (t: number) => {
      const rs = rsAt(t), per = rs * 2.3, f = frac((t * Lr) / per);
      return armR(t) + (t > 0.04 && t < 0.92 ? Math.pow(Math.sin(f * Math.PI), 2) * rs * 0.55 : 0);
    };
    const poly = strip(pts, side > 0 ? cupEdge : armR, side > 0 ? armR : cupEdge, { capA: 0.4, capB: 1, n: Math.ceil(Lr * 2) + 6 });
    const sk0 = skinTex(0.5, !a.near);
    R.region(poly, {
      z: z, R: 2 * k + 0.6, H: 2.6 * k + 0.6, id: a.near ? ID.NEAR : ID.FAR, tex: (p, o) => {
        const q = onPath(pts, cum, p.x, p.y);
        const w = armR(q.t), c = q.c * side / w; // +1 the sucker edge .. -1 the outer edge
        if (c > 0.22 && q.t > (bundled ? 0.45 : 0.03)) {
          // the suckers: discs along the inner edge (staggered in two rows near the root), a pale
          // rim round a dark cup, shrinking toward the tip, dark skin between them
          const rs = rsAt(q.t);
          const per = rs * 2.3;
          const two = w > 2.6 * k;
          const row = two && c > 0.66 ? 1 : 0;
          const cy = two ? (row ? 0.8 : 0.48) : 0.62;
          const f = frac(q.s / per + row * 0.5);
          const rr = Math.hypot((f - 0.5) * per, (c - cy) * w) / rs;
          if (rr < 1) {
            o.m = rr < 0.45 && rs > 0.9 ? M.cup : M.sucker;
            o.z += rr < 0.45 ? -0.2 : 0.5;
            if (rr > 0.7) o.t -= 0.06;
            if (!a.near) o.t -= 0.16;
            if (P.den) o.t -= sm((0.5 - q.t * 0.5 - 0.55) / 0.4) * 0.3;
            return;
          }
          o.m = M.web; o.t -= 0.12 + (a.near ? 0 : 0.12);
          return;
        }
        sk0(p, o);
        if (pale > 0.6 && c < -0.72) { o.m = M.rim; o.t -= 0.1; }   // the display's dark arm edges
        o.t -= cloud(0.5 - q.t * 0.5);
      },
    });
  };
  const far = P.arms.map((a, i) => [a, i] as const).filter(([a]) => !a.near);
  const near = P.arms.map((a, i) => [a, i] as const).filter(([a]) => a.near);
  {
    const R = Relief.full(sk);
    for (const [, i] of far) paintArm(R, i, -8);
    // the web between the arm roots, its free edge sagging in a scallop between each pair
    const order = P.arms.map((a, i) => ({ a, i })).sort((x, y) => x.a.ang - y.a.ang);
    for (let j = 0; j + 1 < order.length; j++) {
      const A0 = armPts[order[j].i], A1 = armPts[order[j + 1].i];
      const d = Math.round(A0.length * (P.pale ? 0.32 : 0.24));
      const pts: LM[] = [[rootC[0], rootC[1], 0.5]];
      for (let q = 1; q <= d; q++) pts.push([A0[q][0], A0[q][1], 0]);
      const e0 = A0[d], e1 = A1[d];
      pts.push([(e0[0] + e1[0]) / 2 - (e0[0] + e1[0] - 2 * rootC[0]) * 0.18, (e0[1] + e1[1]) / 2 - (e0[1] + e1[1] - 2 * rootC[1]) * 0.18, 0]);
      for (let q = d; q >= 1; q--) pts.push([A1[q][0], A1[q][1], 0]);
      R.region(cspline(pts, 0.8), {
        z: -3, R: 1.5, H: 1.2, id: ID.WEB, tex: (p, o) => {
          // thin membrane: radial folds out from the mouth, a darker free edge
          const ang = Math.atan2(p.y - rootC[1], p.x - rootC[0]);
          o.m = M.web;
          o.z += Math.sin(ang * 22) * 0.35;
          if (p.s < 1.2) o.t -= 0.1;
          o.t -= 0.06 + cloud(0.45) + (P.den ? 0.1 : 0);
        },
      });
    }
    sk.np();
    R.emit({ drop: 1.8, seam: 0.8, seamDark: 0.3, ao: 0.05, aoR: 2, bias: -0.04 });
  }

  // ---------------------------------------------------------------- the mantle, the head
  const BR = Relief.full(sk);
  const perpU: V2 = (() => { const q: V2 = [-mdy, mdx]; return q[1] < 0 ? q : [mdy, -mdx]; })();
  const E: V2 = [H[0] + perpU[0] * 1.5 * k, H[1] + perpU[1] * 1.5 * k];
  {
    const N = 12, L = P.mLen * k;
    const base: V2 = [H[0] + mdx * 3 * k, H[1] + mdy * 3 * k];
    // it sags under its own weight away from the axis (gravity, not in the jet)
    const sag = P.mAng < -1 ? 0.025 : 0;
    const pts = chain(base, P.mAng, N, L / N, () => sag * (Math.cos(P.mAng) < 0 ? -1 : 1));
    const cum = arcs(pts);
    // the sac: a narrow neck behind the eyes, swelling to the heavy, rounded, slightly pointed end
    const rad = (t: number) => (t < 0.18 ? 6 + t * 16 : t < 0.68 ? 8.9 + Math.sin((t - 0.18) / 0.5 * Math.PI) * 0.9 : 8.9 * Math.sqrt(Math.max(0, 1 - ((t - 0.68) / 0.32) ** 2)) + 0.8) * k * P.mFull;
    const poly = strip(pts, rad, (t) => rad(t) * (P.mAng < -1 ? 1.04 : 1), { capA: 0.5, capB: 1 });
    const tx = skinTex(0.75, false, 1.4);
    BR.region(poly, { z: 1, R: 6 * k, H: 8 * k, id: ID.MANTLE, pow: 0.9, tex: (p, o) => { tx(p, o); const q = onPath(pts, cum, p.x, p.y); o.t -= cloud(0.5 + q.t * 0.5); if (P.den) o.t -= sm((0.5 + q.t * 0.5 - 0.55) / 0.4) * 0.3; } });
    // the wrinkles: soft folds ringing the sac, uneven
    for (let i = 1; i <= 3; i++) {
      const t = 0.12 + i * 0.17 + (hh(i, 3, 5) - 0.5) * 0.06;
      const c = pts[Math.round(t * N)], r = rad(t);
      const nx = -mdy, ny = mdx;
      const bow = (i % 2 ? 1 : -1) * 1.2;
      const sl = (hh(i, 7, 5) - 0.5) * 3 * k;
      BR.line([[c[0] + nx * r * 0.9 + mdx * sl, c[1] + ny * r * 0.9 + mdy * sl], [c[0] + mdx * bow, c[1] + mdy * bow], [c[0] - nx * r * 0.7 - mdx * sl * 0.5, c[1] - ny * r * 0.7 - mdy * sl * 0.5]], 1.5 * k + 0.4, -(0.5 + (1 - P.mFull) * 4) * k, { fold: true, only: ID.MANTLE });
    }
    // the head: eye bulge over the arm crown, merged into the sac's neck
    const head: LM[] = [];
    for (let i = 0; i < 10; i++) { const q = (i / 10) * TAU; head.push([E[0] + Math.cos(q) * 6 * k * (1 + (hh(i, 1, 9) - 0.5) * 0.12), E[1] + Math.sin(q) * 5.2 * k, 0]); }
    BR.region(cspline(head, 0.6), { z: 5, R: 3.5 * k, H: 4 * k, id: ID.HEAD, blend: 3 * k, tex: skinTex(0.55, false) });
    BR.bump(E[0], E[1], 4 * k, 3.6 * k, 1.6 * k);
    // the funnel (siphon) under the eye, its open end lipped
    const perp: V2 = [-mdy, mdx];
    const sgn = perp[1] > 0 ? 1 : -1;
    const f0: V2 = [H[0] + perp[0] * sgn * 4.5 * k + mdx * 2, H[1] + perp[1] * sgn * 4.5 * k + mdy * 2];
    const f1: V2 = [f0[0] + mdx * 6 * k + perp[0] * sgn * 1.2, f0[1] + mdy * 6 * k + perp[1] * sgn * 1.2];
    BR.cap(f0, f1, 1.9 * k, 1.4 * k, { z: 7, id: ID.FUNNEL, tex: (p, o) => { o.m = M.funnel; if (Math.hypot(p.x - f1[0], p.y - f1[1]) < 1.2 * k) { o.z -= 1; o.t -= 0.2; } } });
    // the horn of skin over the eye, twisted up and back, ridged
    if (P.horn > 0.05) {
      const hb: V2 = [E[0] + mdx * 1.4 + perpU[0] * 3 * k, E[1] + mdy * 1.4 + perpU[1] * 3 * k];
      const ha = Math.atan2(perpU[1], perpU[0]) + (mdx < 0 ? 0.5 : -0.5) * (1 - P.horn * 0.4);
      const L = (2.4 + P.horn * 3) * k;
      const c = Math.cos(ha), s = Math.sin(ha), nx = -s, ny = c;
      const tw = (mdx < 0 ? 1 : -1) * 0.5;
      const hp = (u: number, v: number, sh = 0): LM => [hb[0] + c * u + nx * (v + tw * u * u / L), hb[1] + s * u + ny * (v + tw * u * u / L), sh];
      const horn: LM[] = [hp(-0.5, -1.5 * k), hp(L * 0.5, -0.9 * k), hp(L, 0, 0.8), hp(L * 0.5, 0.9 * k), hp(-0.5, 1.5 * k)];
      BR.region(cspline(horn, 0.4), { z: 9, R: 1, H: 1.6, id: ID.HORN, tex: (p, o) => { o.m = pale > 0.6 ? M.wart : M.skin; o.t += 0.06; if (frac((p.x * c + p.y * s) / 1.4 + (p.x * nx + p.y * ny) * 0.4) < 0.3) o.z -= 0.4; } });
    }
  }
  BR.shadow(ID.HEAD, 1.2, 1.6, 0.1, ID.MANTLE, 1);
  sk.np();
  BR.emit({ drop: 2.4, seam: 1, seamDark: 0.3, ao: 0.06, aoR: 2 });

  // ---------------------------------------------------------------- the eye: gold iris, the barred W pupil
  {
    const ex = Math.round(E[0] + 0.4), ey = Math.round(E[1]);
    const ring = hex(P.ring ? '#1e0c0a' : '#3e1610');
    const gold = hex('#e0aa3c'), gold2 = hex('#a87424'), gold3 = hex('#f2d27a'), bar = hex('#0c0606'), wet = hex('#fffbe8');
    // the lids: a fleshy rim round the eye, darker in the display
    for (const [dx, dy] of [[-3, 0], [3, 0], [-3, -1], [3, -1], [-3, 1], [3, 1], [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2], [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2]] as const) sk.over(ex + dx, ey + dy, ring);
    if (P.ring) for (const [dx, dy] of [[-4, 0], [4, 0], [-4, -1], [4, 1], [-4, 1], [4, -1], [-3, -2], [3, -2], [-3, 2], [3, 2], [-2, -3], [-1, -3], [0, -3], [1, -3], [2, -3], [-2, 3], [-1, 3], [0, 3], [1, 3], [2, 3]] as const) sk.over(ex + dx, ey + dy, hex('#2a1410'));
    for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) sk.over(ex + dx, ey + dy, dy < 0 ? gold : dy > 0 ? gold2 : gold);
    sk.over(ex - 1, ey - 1, gold3);
    // the pupil: a horizontal bar whose lower edge dips at both ends and in the middle (a W)
    sk.over(ex - 2, ey, bar); sk.over(ex - 1, ey, bar); sk.over(ex, ey, bar); sk.over(ex + 1, ey, bar); sk.over(ex + 2, ey, bar);
    sk.over(ex - 2, ey + 1, bar); sk.over(ex, ey + 1, bar); sk.over(ex + 2, ey + 1, bar);
    sk.over(ex - 2, ey - 1, wet);
    // the heavy brow fold over it
    for (let dx = -2; dx <= 2; dx++) sk.over(ex + dx, ey - 3, hex(P.ring ? '#3a2018' : '#5a1e16'));
  }

  // ---------------------------------------------------------------- the near arms
  {
    const R = Relief.full(sk);
    for (const [, i] of near) paintArm(R, i, 9);
    sk.np();
    R.emit({ drop: 1.8, seam: 0.8, seamDark: 0.3, ao: 0.05, aoR: 2 });
  }

  // ---------------------------------------------------------------- the ink cloud
  if (P.ink > 0) {
    const cx = -30 * k * P.ink, cy = 2;
    const R0 = (6 + P.ink * 14) * k;
    const c0 = hex('#160c14', 235), c1 = hex('#2a1826', 200), c2 = hex('#46303e', 150), c3 = hex('#5c4652', 90);
    for (let y = Math.floor(cy - R0); y <= Math.ceil(cy + R0); y++) for (let x = Math.floor(cx - R0 * 1.4); x <= Math.ceil(cx + R0 * 1.2); x++) {
      const dx = (x - cx) / (R0 * 1.3), dy = (y - cy) / R0;
      const n2 = hh(x / 4, y / 4, 91) * 0.55 + hh(x / 2, y / 2, 93) * 0.25 + hh(x, y, 95) * 0.2;
      const d = Math.hypot(dx, dy) - (n2 - 0.5) * 0.7;
      if (d > 1) continue;
      // curling plumes: denser in the core, broken lacy edges
      const col = d < 0.45 ? c0 : d < 0.7 ? c1 : d < 0.88 ? c2 : c3;
      if (d > 0.88 && hh(x, y, 97) < 0.5) continue;
      if (!sk.has(x, y)) sk.over(x, y, col);
    }
  }
  return { head: [E[0], E[1] - 6 * k] as V2, eye: E };
}

export const WHEKE: SpeciesDef = {
  name: 'Te Wheke Kōhatu', kind: 'mollusc', len: 90, height: 40,
  anims: WHEKE_ANIMS,
  canvas: () => ({ w: 180, h: 150, ox: 90, oy: 70 }),
  draw: odraw,
  eyeFor: () => 'open',
  anchor: Object.fromEntries(Object.keys(WHEKE_ANIMS).map(a => [a, 'centre'])) as Record<string, 'centre'>,
};
void clamp; void lerpC;

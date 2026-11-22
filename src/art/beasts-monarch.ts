// The Monarch (Regivultur immensus): the largest flying animal anyone has ever seen, a soaring
// scavenger with a five-metre span. Painted from real vulture and condor anatomy on the Relief layer
// (beasts-relief.ts), every mass one continuous contour through hand-placed landmarks:
//   - a massive, hunched body in sooty brown-black contour feathers, each one scalloped with a paler
//     fringe, the outline broken by their tips;
//   - a thick collar of long, white, lance-shaped feathers round the base of the neck (the ruff);
//   - the bare neck: pale pink-cream skin hanging in loose folds and rings, flushing red toward the head;
//   - the bare head: a fleshy, wrinkled orange-red comb of caruncles over the cere, red skin round the
//     red eye, a pale lid; a huge ivory beak with a dark hooked tip, an orange cere and a slot nostril;
//   - the folded wing: rows of pale-fringed coverts, the silvery-grey panel of the secondaries (its
//     signature, a flash of silver on a black bird), black primaries reaching past the tail;
//   - in flight, wings like boards: the silver secondary panel on top, coverts in rows, and seven black
//     primaries splayed into separate fingers at the tip; a short wedge of a tail;
//   - feathered dark "trousers", grey scaled shanks and long toes with blunt talons.
//
// It is driven by the shared bird pose library in beasts-birds.ts (body centre, pitch, neck, head, beak,
// legs, wing poses, droop / lift for mantling over a carcass); only the painting is its own.

import { Sk, V2, V3, rmp, drawEye, EyeSpec, BeastEye, TAU, proj, lumN, ik2, hh, fr } from './beasts-core';
import { Frame2 } from './beasts-rig';
import { Relief, Sp, Tx, LM, spline, fringe, along, strands, FS } from './beasts-relief';
import { hex } from './color';

/** the fields of the shared bird pose (beasts-birds.ts BP) the Monarch painter reads */
export interface MonarchPose {
  air: boolean; b: V2; ba: number; na: number; nl: number; nc: number; ha: number; open: number;
  feet: [V2, V2]; tuck: number; grip: number; reach: number;
  wing: 'fold' | [{ th: number; hand: number; fold: number; sweep: number; spread?: number }, { th: number; hand: number; fold: number; sweep: number; spread?: number }];
  droop: number; lift: number; tailA: number; tailSp: number; ruffle: number; prey?: string; eye?: BeastEye;
}
type WP = { th: number; hand: number; fold: number; sweep: number; spread?: number };

const EYE: EyeSpec = { r: 1.3, iris: hex('#c02818'), lash: hex('#2a1010'), pupil: hex('#140606'), brow: hex('#7a2a1a') };
// body proportions (px at k = 1), matching the shared look in beasts-birds.ts
const RX = 16, RY = 10, NECK_L = 8;

function mats(sk: Sk, juv: boolean) {
  return {
    plume: sk.m(rmp(juv ? '#4a3a30' : '#2c2220', { n: 7, dark: 0.62, light: 0.3, warm: 0.3, cool: 0.35 }), { edge: 1 }),
    fringe: sk.m(rmp(juv ? '#8a7462' : '#6e5848', { n: 6, dark: 0.55, light: 0.4 }), { edge: 1 }),
    cov: sk.m(rmp('#362c26', { n: 7, dark: 0.6, light: 0.3, warm: 0.3 }), { edge: 1 }),
    covF: sk.m(rmp('#8a7868', { n: 6, dark: 0.55, light: 0.42 }), { edge: 1 }),
    silver: sk.m(rmp(juv ? '#8a8078' : '#b4b0a8', { n: 7, dark: 0.6, light: 0.45, cool: 0.4 }), { edge: 1 }),
    prim: sk.m(rmp('#1c1818', { n: 6, dark: 0.55, light: 0.45, cool: 0.4 }), { edge: 1 }),
    shaft: sk.m(rmp('#8a8480', { n: 5, dark: 0.5, light: 0.35 }), { edge: 0 }),
    under: sk.m(rmp('#4a403c', { n: 6, dark: 0.55, light: 0.4 }), { edge: 1 }),
    ruff: sk.m(rmp('#ece6da', { n: 7, dark: 0.5, light: 0.32, at: 4, cool: 0.4 }), { edge: 1 }),
    ruffD: sk.m(rmp('#a8a094', { n: 6, dark: 0.5, light: 0.35, cool: 0.4 }), { edge: 1 }),
    skin: sk.m(rmp('#e2b8a4', { n: 7, dark: 0.55, light: 0.38, warm: 0.4 }), { edge: 1 }),
    skinR: sk.m(rmp('#c8604a', { n: 7, dark: 0.55, light: 0.4, warm: 0.4 }), { edge: 1 }),
    comb: sk.m(rmp('#d8582c', { n: 7, dark: 0.58, light: 0.42, warm: 0.45 }), { edge: 1 }),
    beak: sk.m(rmp('#e4d8bc', { n: 7, dark: 0.55, light: 0.4, at: 4 }), { edge: 1, spec: 0.4 }),
    beakD: sk.m(rmp('#3a3430', { n: 5, dark: 0.5, light: 0.5 }), { edge: 1 }),
    cere: sk.m(rmp('#e08a3c', { n: 6, dark: 0.55, light: 0.4 }), { edge: 1 }),
    leg: sk.m(rmp('#8e8884', { n: 6, dark: 0.55, light: 0.42, cool: 0.3 }), { edge: 1 }),
    claw: sk.m(rmp('#2a2422', { n: 5, dark: 0.5, light: 0.45 }), { edge: 1 }),
    mouth: sk.m(rmp('#7a2a2a', { n: 4, dark: 0.45 }), { edge: 0 }),
    meat: sk.m(rmp('#9a3a34', { n: 5, dark: 0.55, light: 0.4 }), { edge: 1 }),
  };
}
type M = ReturnType<typeof mats>;
const ID = { BODY: 1, RUFF: 2, NECK: 3, HEAD: 4, BEAK: 5, JAW: 6, COMB: 7, CERE: 8, WING: 9, LEG: 10, TOE: 11, CLAW: 12, TAIL: 13, MEAT: 14, TROUSER: 15 };

/**
 * Contour feathers: overlapping rows of feathers lying back along `ang`, each one domed, rising to its
 * rounded (or, with `point`, lance-shaped) tip with a paler fringe, the next row's base in its shadow.
 */
function plumage(M: M, ang: number, sx: number, sy: number, seed: number, base: number, edgeM: number, point = 0, shade = 0) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return (p: Sp, o: Tx) => {
    const u = p.x * c + p.y * s, v = -p.x * s + p.y * c;
    const row = Math.floor(v / sy), fv = v / sy - row - 0.5;
    const uu = u / sx + (row & 1) * 0.5 + hh(row, 0, seed) * 0.3;
    const col = Math.floor(uu), fu = uu - col;
    const tipAt = point ? 1 - Math.abs(fv * 2) * 0.75 : 1 - fv * fv * 4 * 0.4;
    o.m = base;
    if (fu > tipAt) { o.z -= 0.5; o.t -= 0.07; if (shade) o.m = shade; }
    else if (fu > tipAt - 0.26) { o.m = edgeM; o.z += 0.45; }
    else { o.z += fu * 0.5 + Math.cos(fv * Math.PI) * 0.25; if (shade && fu < 0.25) o.m = shade; }
    if (hh(col, row, seed + 1) < 0.07) o.t -= 0.05;
  };
}

export function drawMonarch(sk: Sk, P: MonarchPose, eyeSt: BeastEye, juv: boolean): { head: V2; eye: V2 } {
  const M = mats(sk, juv);
  const k = juv ? 0.7 : 1;
  const ruff = P.ruffle;
  const b: V2 = [P.b[0] * k, P.b[1] * k];
  const B = new Frame2(b, P.ba, k);
  const rx = RX * (1 + ruff * 0.08), ry = RY * (1 + ruff * 0.12);
  const bp = (x: number, y: number, sh = 0): LM => { const q = B.p(x, y); return [q[0], q[1], sh]; };
  const flying = P.wing !== 'fold';

  // ---------------------------------------------------------------- legs
  const hip = B.p(-2, ry * 0.45);
  const leg = (R: Relief, near: boolean, z: number) => {
    let foot: V2;
    if (P.air || P.tuck > 0) {
      const back = B.p(-rx * 0.9, ry * 0.9), fwd = B.p(rx * 1.2, ry * 1.6);
      foot = [back[0] + (fwd[0] - back[0]) * P.reach + (near ? 1 : -1) * k, back[1] + (fwd[1] - back[1]) * P.reach + (1 - P.tuck) * 3 * k];
      if (!P.air) foot = [P.feet[near ? 0 : 1][0] * k, P.feet[near ? 0 : 1][1] * k];
    } else {
      const f = P.feet[near ? 0 : 1];
      foot = [f[0] * k - 2 * k * 0.3, f[1] * k];
    }
    const h: V2 = [hip[0] + (near ? 0.5 : -0.5) * k, hip[1]];
    const [ank] = ik2(h, foot, 9 * k, 8 * k, 1);
    // the feathered thigh ("trousers") down to the ankle
    const th: LM[] = [along(h, ank, -0.15, 4.4 * k), along(h, ank, 0.5, 3.8 * k), along(h, ank, 0.92, 2.4 * k), along(h, ank, 1.05, 0, 0.3), along(h, ank, 0.92, -2.4 * k), along(h, ank, 0.5, -3.6 * k), along(h, ank, -0.15, -4.2 * k)];
    const thp = fringe(spline(th, 0.6), 1.4, near ? 3 : 5, (_x, _y, _nx, ny) => (ny > -0.2 ? [1.3 * k, 0.4] : null));
    R.region(thp, { z: z - 1, R: 2 * k, H: 2.6 * k, id: ID.TROUSER, tex: plumage(M, Math.atan2(ank[1] - h[1], ank[0] - h[0]), 2.4, 1.8, 91, M.plume, M.fringe) });
    // the bare shank, scaled
    const sh: LM[] = [along(ank, foot, 0, 1.7 * k), along(ank, foot, 0.5, 1.3 * k), along(ank, foot, 1, 1.3 * k), along(ank, foot, 1.05, -1.3 * k), along(ank, foot, 0.5, -1.3 * k), along(ank, foot, 0, -1.7 * k)];
    R.region(spline(sh, 0.5), { z, R: 1 * k, H: 1.4 * k, id: ID.LEG, tex: (p, o) => { o.m = M.leg; const t = Math.hypot(p.x - ank[0], p.y - ank[1]); if (fr(t / (1.3 * k)) < 0.3) o.z -= 0.5; } });
    // toes: three long ones forward, the hind toe back; blunt talons
    const curl = P.air ? P.tuck * (1 - P.reach) : 0, grip = P.grip;
    for (let i = 0; i < 4; i++) {
      const hind = i === 3;
      const a = hind ? Math.PI - 0.15 - grip * 0.8 - curl * 1.2 : -0.05 + (i - 1) * 0.22 + grip * 0.9 + curl * 1.2;
      const L = (hind ? 2.8 : 5 - Math.abs(i - 1) * 0.8) * k;
      const tip: V2 = [foot[0] + Math.cos(a) * L, foot[1] + Math.sin(a) * L * (curl || grip ? 1 : 0.25)];
      if (!P.air && !grip) tip[1] = Math.min(tip[1], -0.6 * k);
      const tl: LM[] = [along(foot, tip, -0.1, 0.9 * k), along(foot, tip, 0.6, 0.8 * k), along(foot, tip, 1, 0.6 * k, 0.3), along(foot, tip, 1, -0.6 * k, 0.3), along(foot, tip, 0.3, -0.9 * k)];
      R.region(spline(tl, 0.4), { z: z + 0.5 + i * 0.1, R: 0.6, H: 0.9, id: ID.TOE, tex: (p, o) => { o.m = M.leg; if (fr(Math.hypot(p.x - foot[0], p.y - foot[1]) / (1.1 * k)) < 0.3) o.z -= 0.4; } });
      const ca = a + (hind ? -0.9 : 0.9) + grip;
      const ct: V2 = [tip[0] + Math.cos(ca) * 1.8 * k, tip[1] + Math.sin(ca) * 1.8 * k];
      const cl: LM[] = [along(tip, ct, -0.2, 0.6 * k), [ct[0], P.air || grip ? ct[1] : Math.min(ct[1], -0.2), 0.8], along(tip, ct, -0.2, -0.6 * k)];
      R.region(spline(cl, 0.3), { z: z + 1, R: 0.4, H: 0.6, id: ID.CLAW, tex: M.claw });
    }
  };

  // ---------------------------------------------------------------- spread wing (flight)
  const shoulder3 = (side: 1 | -1): V3 => [rx * 0.3 * k, ry * 0.35 * k, side * ry * 0.45 * k];
  const spreadWing = (side: 1 | -1, W: WP, bias: number) => {
    const armL = 40 * k * (1 - W.fold * 0.35), handL = 38 * k * (1 - W.fold * 0.5);
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
    // the facing of the wing plane: top or underside, and its light
    const nA: V3 = [dA[1] * cA[2] - dA[2] * cA[1], dA[2] * cA[0] - dA[0] * cA[2], dA[0] * cA[1] - dA[1] * cA[0]];
    let n: V3 = nA[1] * side < 0 ? [-nA[0], -nA[1], -nA[2]] : nA; // the top-side normal
    const q0 = proj([0, 0, 0]), q1 = proj(n);
    n = [q1[0] - q0[0], q1[1] - q0[1], q1[2] - q0[2]];
    const top = n[2] >= 0;
    const nv: V3 = top ? n : [-n[0], -n[1], -n[2]];
    const lt = (lumN(nv[0], nv[1], nv[2]) - 0.62) * 0.7;
    const sec = 18 * k, prim = 30 * k, nP = 7, spread = W.spread ?? 1;
    // the outline: leading edge out to the wrist and along the hand, the fingered primaries, the
    // secondaries' trailing edge back to the body
    const lead: LM[] = [];
    const s2 = (q: V3, sharp = 0): LM => { const r = P2(q); return [r[0], r[1], sharp]; };
    lead.push(s2(add(sh, cA, -1.5 * k)));
    lead.push(s2(add(add(sh, dA, armL * 0.45), cA, -2.6 * k)));
    lead.push(s2(add(wrist, cA, -1.6 * k), 0.2));
    const prims: { b3: V3; d: V3; L: number }[] = [];
    for (let i = 0; i < nP; i++) {
      const t = i / (nP - 1);
      const b3 = add(wrist, dH, handL * (0.05 + t * 0.9));
      const a = (0.1 + t * 1.05 * spread) * (1 - W.fold * 0.75);
      const d: V3 = [cH[0] * Math.cos(a) + dH[0] * Math.sin(a), cH[1] * Math.cos(a) + dH[1] * Math.sin(a), cH[2] * Math.cos(a) + dH[2] * Math.sin(a)];
      const L = prim * (0.62 + 0.38 * Math.sin(Math.min(1, t * 1.25 + 0.1) * Math.PI * 0.71)) * (1 - W.fold * 0.12);
      prims.push({ b3, d, L });
    }
    lead.push(s2(add(tip, cH, -0.8 * k)));
    // fingers from the outermost in
    for (let i = nP - 1; i >= 0; i--) {
      const p = prims[i];
      const tp = add(p.b3, p.d, p.L);
      const side2 = add(tp, cH, 0.9 * k);
      lead.push(s2(add(tp, dH, 0.6 * k), 0.5));
      lead.push(s2(add(tp, cH, 0.4 * k), 0.85));
      if (i > 0 && i >= nP - 5) {
        // the slot between this finger and the next: the outer vane narrows (emarginated)
        const nx = prims[i - 1];
        const mid = add(add(p.b3, p.d, p.L * 0.58), nx.d, 0);
        lead.push(s2(add(mid, cH, 0.4 * k), 0.4));
      }
      void side2;
    }
    // secondaries' trailing edge, gently scalloped, back to the body
    const nS = 10;
    for (let i = nS; i >= 0; i--) {
      const t = i / nS;
      const base3 = add(sh, dA, armL * (0.06 + t * 0.94));
      const L = sec * (1 - Math.abs(t - 0.45) * 0.2);
      lead.push(s2(add(base3, cA, L), 0.15));
      if (i > 0) lead.push(s2(add(add(sh, dA, armL * (0.06 + (t - 0.5 / nS) * 0.94)), cA, L * 0.93)));
    }
    lead.push(s2(add(sh, cA, sec * 0.6)));
    const poly = spline(lead, 0.6);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of poly) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    const R = new Relief(sk, x0 - 2, y0 - 2, x1 + 2, y1 + 2);
    // texture coords: nearest point on the leading edge (span s 0..2: arm then hand) and the chord fraction
    const LE: V2[] = [P2(sh), P2(add(sh, dA, armL * 0.5)), P2(wrist), P2(add(wrist, dH, handL * 0.5)), P2(tip)];
    const chordPx = [Math.hypot(...(sub2(P2(add(sh, cA, sec)), P2(sh)))), Math.hypot(...(sub2(P2(add(wrist, cH, prim)), P2(wrist))))];
    const zW = (Z(sh) + Z(wrist) + Z(tip)) / 3;
    R.region(poly, { z: zW, R: 1.4 * k, H: 1.2 * k, id: ID.WING, lt: lt + bias, tex: (p, o) => {
      let best = Infinity, bs = 0, bd = 0;
      for (let i = 1; i < LE.length; i++) {
        const a = LE[i - 1], c = LE[i], ex = c[0] - a[0], ey = c[1] - a[1], l2 = ex * ex + ey * ey || 1;
        let kk = ((p.x - a[0]) * ex + (p.y - a[1]) * ey) / l2; kk = kk < 0 ? 0 : kk > 1 ? 1 : kk;
        const d = Math.hypot(p.x - a[0] - ex * kk, p.y - a[1] - ey * kk);
        if (d < best) { best = d; bs = (i - 1 + kk) / (LE.length - 1); bd = d; }
      }
      const hand = bs > 0.5;
      const cf = bd / Math.max(4, hand ? chordPx[1] : chordPx[0]);
      if (!top) {
        // the underside: black lining coverts with a pale stripe, grey flight feathers, dark tips
        o.m = cf < 0.3 ? M.plume : cf < 0.4 ? M.covF : cf > 0.82 ? M.prim : M.under;
        if (cf > 0.4 && fr(bs * (hand ? 14 : 22)) < 0.12) { o.z -= 0.4; o.m = M.prim; }
        return;
      }
      if (cf < 0.14) { plumage(M, 0, 2.2, 1.6, 93, M.cov, M.covF)(p, o); return; }
      if (cf < 0.34) {
        // greater coverts: a row of broad feathers, each with a pale tip
        const f = fr(bs * (hand ? 16 : 26));
        o.m = cf > 0.28 ? M.covF : M.cov;
        if (f < 0.14) o.z -= 0.5; else o.z += (f - 0.5) * 0.5;
        return;
      }
      if (!hand) {
        // the silver panel: secondaries pale grey with dark shafts and darker inner webs
        const f = fr(bs * 22);
        o.m = M.silver;
        if (f < 0.1) { o.m = M.shaft; o.z -= 0.3; } else if (f > 0.7) o.t -= 0.06;
        if (cf > 0.9) o.t -= 0.05;
        return;
      }
      // primaries: black, a paler shaft down each
      const f = fr(bs * 13);
      o.m = M.prim;
      if (f < 0.08) o.m = M.shaft;
      else if (f > 0.75) o.z -= 0.4;
    } });
    sk.np();
    R.emit({ bias: 0, drop: 1.4, seam: 0.5, seamDark: 0.25, contrast: 0.9 });
  };

  // ---------------------------------------------------------------- the far side
  if (flying && P.wing !== 'fold') spreadWing(-1, P.wing[1], -0.08);
  {
    const R = new Relief(sk, b[0] - 30 * k, b[1] - 20 * k, b[0] + 30 * k, b[1] + 30 * k);
    leg(R, false, -6);
    sk.np();
    R.emit({ bias: -0.15, drop: 1.4, seam: 0.5 });
  }

  // ---------------------------------------------------------------- body, tail, folded wing, ruff, neck and head
  const BR = Relief.full(sk);
  // the tail: a short wedge of broad, dark feathers
  {
    const rump = B.p(-rx * 0.82, -ry * 0.05);
    const tA = B.ang(Math.PI + 0.15 + P.tailA + (P.air ? 0 : Math.min(0, P.ba) * 0.7));
    const L = 14 * k, sp = 0.45 * P.tailSp;
    const c = Math.cos(tA), s = Math.sin(tA), nx = -s, ny = c;
    const T = (t: number, w: number, sh = 0): LM => [rump[0] + (c * t + nx * w) * L, rump[1] + (s * t + ny * w) * L, sh];
    const ol: LM[] = [T(-0.1, -0.2), T(0.75, -0.24 - sp * 0.3), T(1, -0.1 - sp * 0.2, 0.5), T(1.03, 0.02, 0.5), T(0.98, 0.12 + sp * 0.2, 0.5), T(0.72, 0.24 + sp * 0.3), T(-0.1, 0.22)];
    const tp = fringe(spline(ol, 0.6), 2.4, 13, (x, y) => (Math.hypot(x - rump[0], y - rump[1]) > L * 0.82 ? [1.6 * k, 0] : null));
    BR.region(tp, { z: -2 * k, R: 2 * k, H: 2 * k, id: ID.TAIL, tex: (p, o) => {
      const a = Math.atan2(p.y - rump[1], p.x - rump[0]) - tA;
      o.m = M.plume;
      if (fr(a * 9) < 0.14) { o.m = M.shaft; o.z -= 0.3; }
      if (Math.hypot(p.x - rump[0], p.y - rump[1]) > L * 0.86) o.t -= 0.05;
    } });
  }
  // the body: a massive, hunched mass of contour feathers
  {
    const ol: LM[] = [bp(-rx * 0.95, -ry * 0.25), bp(-rx * 0.55, -ry * 0.9), bp(0, -ry * 1.05), bp(rx * 0.5, -ry * 0.95), bp(rx * 0.86, -ry * 0.55), bp(rx * 1.02, 0), bp(rx * 0.86, ry * 0.62), bp(rx * 0.35, ry * 1.02), bp(-rx * 0.3, ry * 0.98), bp(-rx * 0.8, ry * 0.6)];
    const op = fringe(spline(ol, 0.6), 2.2, 17, (_x, _y, nx, ny) => [1.3 * k + ruff * 1.2, (nx * Math.cos(P.ba) + ny * Math.sin(P.ba)) > 0 ? -0.6 : 0.6]);
    BR.region(op, { z: 0, R: 6 * k, H: ry * 0.9 * k, id: ID.BODY, tex: plumage(M, P.ba + 0.25, 3.8, 2.8, 95, M.plume, M.fringe) });
    const br2 = B.p(rx * 0.55, ry * 0.3); BR.bump(br2[0], br2[1], 7 * k, 6 * k, 1.6 * k);
  }
  // legs on the near side
  leg(BR, true, 8 * k);
  // the folded wing lying along the side, mantled up (lift) or drooped over a carcass
  if (!flying) {
    const lift = P.lift, droop = P.droop;
    const W = (x: number, y: number, sh = 0): LM => {
      // lift raises the wing about the wrist; droop drops the primaries
      const yy = y - lift * Math.max(0, -x + 8) * 0.18 + droop * Math.max(0, -x - 6) * 0.14;
      return bp(x, yy, sh);
    };
    const ext = 10;
    const ol: LM[] = [W(rx * 0.7, -ry * 0.1), W(rx * 0.55, -ry * 0.62), W(rx * 0.1, -ry * 0.82), W(-rx * 0.5, -ry * 0.7), W(-rx - ext * 0.6, -ry * 0.2), W(-rx - ext, ry * 0.15, 0.85), W(-rx - ext * 0.55, ry * 0.42), W(-rx * 0.5, ry * 0.62), W(rx * 0.05, ry * 0.68), W(rx * 0.55, ry * 0.42)];
    const op = fringe(spline(ol, 0.6), 2.6, 19, (x, y, nx, ny) => {
      const [, ly] = [x, y];
      void ly;
      return ny > 0.3 && nx < 0.6 ? [1.4 * k, 0.7] : null;
    });
    const lead: V2[] = [B.p(rx * 0.62, -ry * 0.55), B.p(-rx * 0.4, -ry * 0.72), B.p(-rx - ext, ry * 0.12)];
    BR.region(op, { z: ry * 0.9 * k - 1, R: 2.4 * k, H: 3.4 * k, id: ID.WING, blend: 0, tex: (p, o) => {
      // rows by distance below the leading edge: lesser coverts, greater coverts, the silver
      // secondaries, and the black primaries sweeping back past the tail
      let best = Infinity, bs = 0;
      for (let i = 1; i < lead.length; i++) {
        const a = lead[i - 1], c = lead[i], ex = c[0] - a[0], ey = c[1] - a[1], l2 = ex * ex + ey * ey || 1;
        let kk = ((p.x - a[0]) * ex + (p.y - a[1]) * ey) / l2; kk = kk < 0 ? 0 : kk > 1 ? 1 : kk;
        const d = Math.hypot(p.x - a[0] - ex * kk, p.y - a[1] - ey * kk);
        if (d < best) { best = d; bs = (i - 1 + kk) / 2; }
      }
      const d = best / k;
      const back = bs > 0.62;
      if (d < 3.8 && !back) { plumage(M, P.ba + 0.5, 3.6, 2.6, 97, M.cov, M.covF)(p, o); return; }
      if (d < 7.2 && !back) {
        const f = fr(bs * 16 + d * 0.05);
        o.m = d > 6 ? M.covF : M.cov;
        if (f < 0.14) o.z -= 0.6; else o.z += (f - 0.5) * 0.4;
        return;
      }
      if (!back && bs < 0.55) {
        const f = fr(bs * 22 + d * 0.08);
        o.m = M.silver;
        if (f < 0.14) { o.m = M.shaft; o.z -= 0.4; } else if (f > 0.7) o.t -= 0.07;
        return;
      }
      // primaries: long black feathers, stacked, each edge catching a little light
      const f = fr(d * 0.42 + bs * 2);
      o.m = M.prim;
      if (f < 0.16) { o.z -= 0.5; } else if (f < 0.3) o.m = M.shaft;
    } });
  }
  // ---- the neck and head frames
  const nb = B.p(rx * 0.62, -ry * 0.28);
  const nl = NECK_L * P.nl * k;
  const hpos: V2 = [nb[0] + Math.cos(P.na) * nl, nb[1] + Math.sin(P.na) * nl];
  const perp: V2 = [-Math.sin(P.na), Math.cos(P.na)];
  const ctrl: V2 = [(nb[0] + hpos[0]) / 2 + perp[0] * P.nc * nl * 0.5, (nb[1] + hpos[1]) / 2 + perp[1] * P.nc * nl * 0.5];
  const H = new Frame2(hpos, P.ha, k);
  const hp = (x: number, y: number, sh = 0): LM => { const q = H.p(x, y); return [q[0], q[1], sh]; };
  const hz = 10 * k;
  // the bare neck: loose pale skin, ringed with folds, flushing red toward the head
  if (nl > 0.8) {
    const bez = (t: number): V2 => { const u = 1 - t; return [u * u * nb[0] + 2 * u * t * ctrl[0] + t * t * hpos[0], u * u * nb[1] + 2 * u * t * ctrl[1] + t * t * hpos[1]]; };
    const left: LM[] = [], right: LM[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6, q = bez(t), q2 = bez(Math.min(1, t + 0.05)), q1 = bez(Math.max(0, t - 0.05));
      const dx = q2[0] - q1[0], dy = q2[1] - q1[1], l = Math.hypot(dx, dy) || 1;
      const r = (4.6 - t * 1.9 + (i % 2 ? 0.25 : 0) + ruff * 0.6) * k;
      left.push([q[0] + (dy / l) * r, q[1] - (dx / l) * r, 0]);
      right.push([q[0] - (dy / l) * r, q[1] + (dx / l) * r, 0]);
    }
    const ol = [...left, ...right.reverse()];
    BR.region(spline(ol, 0.6), { z: 4 * k, R: 2.6 * k, H: 3.4 * k, id: ID.NECK, blend: 1.4 * k, tex: (p, o) => {
      const dx = p.x - nb[0], dy = p.y - nb[1], hx = hpos[0] - nb[0], hy = hpos[1] - nb[1];
      const t = (dx * hx + dy * hy) / (hx * hx + hy * hy || 1);
      o.m = t > 0.62 ? M.skinR : M.skin;
      // ring folds and loose wrinkles
      const r = fr(t * 6 + Math.sin((dx * hy - dy * hx) * 0.4) * 0.15);
      if (r < 0.2) { o.z -= 0.8; o.t -= 0.04; } else if (r < 0.4) o.z += 0.3;
      if (hh(Math.floor(p.x), Math.floor(p.y), 7) < 0.05) o.t -= 0.08;
    } });
  }
  // the ruff: a collar of long white lance-shaped feathers at the base of the neck
  {
    const rc = B.p(rx * 0.6, -ry * 0.25);
    const a0 = P.na;
    const c = Math.cos(a0), s = Math.sin(a0), nx = -s, ny = c;
    const R2 = (t: number, w: number, sh = 0): LM => [rc[0] + (c * t + nx * w) * k, rc[1] + (s * t + ny * w) * k, sh];
    const ol: LM[] = [R2(-4, -6.6), R2(1.6, -6.4), R2(3.6, -3.6), R2(4, 0), R2(3.4, 4.2), R2(0.6, 7.2), R2(-4.4, 6.4), R2(-5.6, 0)];
    const op = fringe(spline(ol, 0.5), 1.6, 21, (_x, _y, nx2, ny2) => [2 * k + ruff * 1.4 + 0.4, (nx2 * c + ny2 * s) > 0 ? 0.9 : -0.6]);
    const ruffTex = plumage(M, a0 + Math.PI, 4.4, 2, 23, M.ruff, M.ruff, 1, M.ruffD);
    BR.region(op, { z: 6 * k, R: 2.6 * k, H: 4 * k, id: ID.RUFF, blend: 1 * k, tex: (p, o) => {
      ruffTex(p, o);
    } });
  }
  // the head: bare and wrinkled, a fleshy comb over the cere
  const openA = P.open * 0.45;
  {
    const faceTex = (p: Sp, o: Tx) => {
      const dx = (p.x - hpos[0]) / k, dy = (p.y - hpos[1]) / k, c = Math.cos(-P.ha), s = Math.sin(-P.ha);
      const hx = dx * c - dy * s, hy = dx * s + dy * c;
      o.m = M.skinR;
      if (Math.hypot(hx - 1.4, hy + 0.9) < 2) o.m = M.comb; // red bare skin round the eye
      if (hx < -1.4 || hy > 2.2) o.m = M.skin;
      // wrinkles running back from the gape and down the cheek
      if (fr((hx * 0.3 - hy) * 0.9) < 0.2) o.z -= 0.5;
    };
    const head: LM[] = [hp(-4.4, 0.4), hp(-3.6, -2.8), hp(-0.6, -4.2), hp(2.6, -3.6), hp(4.6, -2.4), hp(4.6, 1.8), hp(2.6, 3.4), hp(-0.6, 4), hp(-3.4, 3)];
    BR.region(spline(head, 0.5), { z: hz, R: 2.4 * k, H: 3.6 * k, id: ID.HEAD, blend: 1 * k, tex: faceTex });
    // the comb: fleshy wrinkled lobes over the crown and the cere
    const lobes: [number, number, number][] = [[-1.6, -4.2, 1.5], [0.6, -4.8, 1.7], [2.8, -4.4, 1.6], [4.6, -3.4, 1.4]];
    for (const [x, y, r] of lobes) {
      const c0 = H.p(x, y);
      const lo: LM[] = [];
      for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; const rr = r * k * (0.85 + hh(i, Math.floor(x * 3), 31) * 0.3); lo.push([c0[0] + Math.cos(a) * rr, c0[1] + Math.sin(a) * rr * 0.85, 0]); }
      BR.region(spline(lo, 0.4), { z: hz + 3.4 * k, R: 0.9 * k, H: 1.4 * k, id: ID.COMB, blend: 0.6 * k, tex: (p, o) => { o.m = M.comb; if (hh(Math.floor(p.x * 1.5), Math.floor(p.y * 1.5), 33) < 0.25) o.z -= 0.5; } });
    }
    // the cere: orange, the slot nostril in it
    const ce: LM[] = [hp(3.6, -2.6), hp(6, -2.7), hp(6.3, 0.2), hp(3.8, 1)];
    BR.region(spline(ce, 0.4), { z: hz + 3 * k, R: 0.9 * k, H: 1.2 * k, id: ID.CERE, tex: M.cere });
    // the lower mandible, opened with the gape
    const lc = Math.cos(P.ha + openA), ls = Math.sin(P.ha + openA);
    const lo0 = H.p(3.4, 1.4);
    const LP = (x: number, y: number, sh = 0): LM => [lo0[0] + (x * lc - y * ls) * k, lo0[1] + (x * ls + y * lc) * k, sh];
    if (P.open > 0.25) {
      const gm: LM[] = [hp(3.6, 1.2), hp(9.6, 1.2), LP(6, 1.2), LP(1, 1.2)];
      BR.region(spline(gm, 0.4), { z: hz + 2.6 * k, R: 0.6, H: 0.4, id: ID.HEAD, tex: M.mouth });
    }
    const lm: LM[] = [LP(0, -0.4), LP(6.2, -0.2), LP(7.6, 0.4, 0.4), LP(6, 1.6), LP(0.4, 1.6)];
    BR.region(spline(lm, 0.4), { z: hz + 3.4 * k, R: 0.8 * k, H: 1.2 * k, id: ID.JAW, tex: M.beak });
    // the beak: heavy, ivory, a dark hook
    const bk: LM[] = [hp(5.6, -2.8), hp(8.6, -2.6), hp(10.6, -1.4), hp(11.4, 0.8, 0.3), hp(10.8, 2.6, 0.85), hp(9.8, 1.2, 0.3), hp(8, 1.1), hp(5.6, 1.2)];
    BR.region(spline(bk, 0.4), { z: hz + 4 * k, R: 1.2 * k, H: 2 * k, id: ID.BEAK, tex: (p, o) => {
      const dx = (p.x - hpos[0]) / k, dy = (p.y - hpos[1]) / k, c = Math.cos(-P.ha), s = Math.sin(-P.ha);
      const hx = dx * c - dy * s;
      o.m = hx > 9.6 ? M.beakD : M.beak;
      if (fr(hx * 1.3) < 0.15 && hx < 9.4) o.z -= 0.3; // growth lines
    } });
    const ns = H.p(5.2, -0.6);
    BR.line([[ns[0] - 0.8 * k, ns[1]], [ns[0] + 0.8 * k, ns[1] + 0.2 * k]], 0.8 * k, -0.9 * k);
    // carrion held in the beak
    if (P.prey === 'meat') {
      const q = H.p(10, 2.8);
      const mt: LM[] = [[q[0] - 1.4 * k, q[1] - 1 * k, 0], [q[0] + 1.6 * k, q[1] - 0.6 * k, 0.3], [q[0] + 1.2 * k, q[1] + 1.6 * k, 0], [q[0] - 1.6 * k, q[1] + 1.2 * k, 0.3]];
      BR.region(spline(mt, 0.4), { z: hz + 6 * k, R: 0.8, H: 1, id: ID.MEAT, tex: (p, o) => { o.m = M.meat; if (hh(Math.floor(p.x), Math.floor(p.y), 3) < 0.3) o.t -= 0.1; } });
    }
  }
  BR.shadow(ID.RUFF, 1 * k, 1.4 * k, 0.1, ID.BODY, 1);
  BR.shadow(ID.WING, 0.8 * k, 1.4 * k, 0.1, ID.BODY, 1);
  BR.shadow(ID.HEAD, 0.8 * k, 1.2 * k, 0.1, ID.NECK, 1);
  sk.np();
  BR.emit({ drop: 1.6, seam: 0.6 * k, seamDark: 0.28, ao: 0.06, aoR: 2 });
  const ec = H.p(1.4, -0.9);
  const eye = drawEye(sk, ec[0], ec[1], { ...EYE, r: juv ? 0.9 : 1.1 }, P.eye ?? eyeSt);
  // ---- the near wing in flight
  if (flying && P.wing !== 'fold') spreadWing(1, P.wing[0], 0);
  const top = H.p(0, -6);
  return { head: [top[0], top[1] - 2 * k], eye };
}

const sub2 = (a: V2, b: V2): [number, number] => [a[0] - b[0], a[1] - b[1]];

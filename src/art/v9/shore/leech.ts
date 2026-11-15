// Crown Leech: an amphibious leech that lives in the neck creases of the Corvex Seal. A glossy
// indigo body with pale lateral stripes, a rear sucker, and at the head a crown of feathery
// gill-fronds it opens like a tiny sea anemone to breathe while its host sleeps. Shaken off onto the
// sand it loops along like an inchworm, rearing up to "taste" the air for its seal.
//
// Painted from leech anatomy on one organic contour (v9/wild/contour strip + Field): a flattened,
// ringed body that is fattest in its rear third and narrows to the oral sucker, the broad caudal disc
// splayed on the sand under the rear end; fine annuli (every fifth one carries a pale sensilla), a
// pale stripe along each flank, a paler violet sole, the wet gloss along the back, two pairs of
// eyespots on the head, and the crown: seven feathery gill-fronds (a stem with alternate pinnules and
// pale tips) that fan open round the mouth and fold flat into a pale tuft when it moves.
//
// Faces right, anchored on the ground under the rear sucker. Anims: idle, inch, rear, curl.

import { Sk, V2, rmp, SpeciesDef, TAU, sm, qbez } from '../../beasts-core';
import { hex } from '../../color';
import { Field, strip } from '../wild/contour';
import { arcs, onPath, frac } from './shore-kit';

const A = (frames: number, fps: number, loop = true) => ({ frames, fps, loop });
const ANIMS = { idle: A(4, 4), inch: A(6, 7), rear: A(4, 4), curl: A(2, 2) };

interface P { pts: V2[]; crown: number; crownA: number; wave: number; fat: number }

const S = 1.16; // drawn a little larger than the old blob so the anatomy reads
const sc = (q: V2): V2 => [q[0] * S, q[1] * S];

/** body centreline from the rear sucker (at the anchor) to the head */
function pose(anim: string, f: number, n: number): P {
  const t = f / n;
  switch (anim) {
    case 'inch': {
      // loop: the head reaches forward and plants, the rear sucker is pulled up behind it in an arch
      const reach = [0.2, 0.6, 1, 1, 0.55, 0.2][f];     // body extension
      const arch = [0.9, 0.5, 0.05, 0.3, 0.95, 1][f];   // loop height
      const rearX = [0, 0, 0, 1.5, 3.5, 5][f];          // rear sucker creeping forward
      const L = 5 + reach * 3.9;
      const a: V2 = [rearX, -1], b: V2 = [rearX + L, -1];
      const c: V2 = [(a[0] + b[0]) / 2, -1 - arch * 6];
      return { pts: qbez(a, c, b, 10).map(sc), crown: reach > 0.8 ? 0.35 : 0, crownA: 0, wave: 0, fat: 1 - reach * 0.16 };
    }
    case 'rear': {
      // anchored by the rear sucker, head raised and swaying, crown open to taste the air
      const sw = Math.sin(t * TAU) * 0.35;
      const head: V2 = [5.4 + sw * 2.6, -5.4 + Math.abs(sw) * 1];
      return { pts: qbez([0, -1], [5, -1.4], head, 10).map(sc), crown: 1, crownA: -1.1 + sw, wave: t, fat: 0.95 };
    }
    case 'curl': {
      const pts: V2[] = [];
      for (let i = 0; i <= 10; i++) { const a = Math.PI * 0.95 - (i / 10) * TAU * 0.82; pts.push([3.5 + Math.cos(a) * 3.2 * (1 - i * 0.025), -3.3 + Math.sin(a) * 2.4]); }
      return { pts: pts.map(sc), crown: 0, crownA: 0, wave: 0, fat: 1.05 + (f ? 0.06 : 0) };
    }
    default: {
      // resting stretched out on the sand, crown open and gently waving
      const pts: V2[] = [];
      for (let i = 0; i <= 10; i++) { const u = i / 10; pts.push([u * 8.2, -1.2 - Math.sin(u * Math.PI) * 0.8 - sm((u - 0.7) / 0.3) * 1.7]); }
      return { pts: pts.map(sc), crown: 1, crownA: -0.4 + Math.sin(t * TAU) * 0.2, wave: t, fat: 1 };
    }
  }
}

const PAL = {
  eyespot: hex('#0a0614'),
  sens: hex('#b8c4ff'),
  pinna: hex('#c8f6fc', 215),
};

function draw(sk: Sk, anim: string, frame: number) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const P = pose(anim, frame, n);
  const M = {
    body: sk.m(rmp('#2c2282', { n: 6, dark: 0.62, light: 0.5, cool: 0.4, warm: 0.1 }), { edge: 1, bias: -0.04 }),
    back: sk.m(rmp('#1e1660', { n: 5, dark: 0.6, light: 0.55, cool: 0.4 }), { edge: 1 }),
    stripe: sk.m(rmp('#8a9ae8', { n: 5, dark: 0.45, light: 0.45 }), { edge: 1 }),
    sole: sk.m(rmp('#58408e', { n: 5, dark: 0.5, light: 0.4 }), { edge: 1 }),
    disc: sk.m(rmp('#7a5aa8', { n: 5, dark: 0.55, light: 0.4 }), { edge: 1 }),
    lip: sk.m(rmp('#9a6aa6', { n: 4, dark: 0.45, light: 0.4 }), { edge: 1 }),
    gill: sk.m(rmp('#8fdcec', { n: 5, dark: 0.45, light: 0.6, cool: 0.2 }), { edge: 1, noRim: true }),
    gillT: sk.m(rmp('#e4fcff', { n: 3, dark: 0.25, light: 0.3 }), { edge: 1, noRim: true }),
  };
  sk.clipY = 0;
  const pts = P.pts, cum = arcs(pts), L = cum[cum.length - 1];
  const f = P.fat;
  // the radius profile: the caudal disc, fattest in the rear third, tapering to the oral sucker
  const up = (t: number) => (0.55 + 1.55 * Math.sin(Math.min(1, (t + 0.08) * 1.25) * Math.PI * 0.5) * (1 - sm((t - 0.4) / 0.62) * 0.62)) * f;
  const dn = (t: number) => (t < 0.12 ? 1.05 + (0.12 - t) * 9 : 0) + up(t) * 0.82;
  const poly = strip(pts, up, dn, { capA: 0.5, capB: 0.9 });
  const F = new Field(sk, [poly], { round: 1.4, dome: 0.8 });
  sk.np();
  F.emit(p => {
    const q = onPath(pts, cum, p.x, p.y);
    const t = q.t, w = q.c >= 0 ? up(t) : dn(t);
    const v = q.c / Math.max(0.5, w); // -1 sole .. +1 back
    // annuli: a groove every 1.3 px along the body, every fifth ring carrying a pale sensilla
    const ring = frac(q.s / 1.3);
    if (ring < 0.3 && t > 0.06 && t < 0.94) p.l -= 0.13;
    else if (ring > 0.65) p.l += 0.04;
    if (t < 0.1 && v < 0.2) { p.l += 0.05; return M.disc; }
    if (t > 0.93) { p.l += 0.05; return M.lip; }
    if (v < -0.45) return M.sole;
    if (Math.abs(v + 0.08) < 0.17 && t > 0.12 && t < 0.9) return M.stripe;
    if (v > 0.55) return M.back;
    return M.body;
  }, { z: 1, spec: 0.55, specPow: 10 });
  // the sensillae: pale dots on every fifth annulus along the back, and the eyespots on the head
  for (let s = 2.2; s < L - 2; s += 1.3 * 5) {
    const i = Math.min(pts.length - 2, Math.floor((s / L) * (pts.length - 1)));
    const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const k = s / L * (pts.length - 1) - i;
    const c = up(s / L) * 0.55;
    sk.overPaint(a[0] + dx * k + (dy / l) * c, a[1] + dy * k - (dx / l) * c, PAL.sens);
  }
  const h = pts[pts.length - 1], h0 = pts[pts.length - 3];
  const ha = Math.atan2(h[1] - h0[1], h[0] - h0[0]);
  const nx = Math.sin(ha), ny = -Math.cos(ha); // dorsal normal
  for (const back of [1.4, 2.6]) sk.overPaint(h[0] - Math.cos(ha) * back + nx * 0.6, h[1] - Math.sin(ha) * back + ny * 0.6, PAL.eyespot);

  // the crown of gill-fronds round the mouth
  const tip: V2 = [h[0] + Math.cos(ha) * 0.8, h[1] + Math.sin(ha) * 0.8];
  sk.np(true);
  if (P.crown > 0.1) {
    const nF = 6;
    for (let i = 0; i < nF; i++) {
      const k = (i - (nF - 1) / 2) / ((nF - 1) / 2);
      const a0 = ha + P.crownA * 0.25 + k * 1.25 * P.crown + Math.sin((P.wave + i * 0.17) * TAU) * 0.12;
      const len = (2.6 + (i % 2) * 0.9 + (1 - Math.abs(k)) * 0.7) * P.crown;
      // each frond arcs outward from the fan's middle, like a feather-duster worm's radiole
      const curl = k * 0.16 + Math.sin((P.wave + i * 0.3) * TAU) * 0.05;
      let x = tip[0], y = tip[1], a = a0;
      const steps = Math.max(2, Math.round(len));
      for (let s = 1; s <= steps; s++) {
        a += curl;
        x += Math.cos(a); y += Math.sin(a);
        const last = s === steps;
        sk.dot(x, y, last ? M.gillT : M.gill, 0.42 + (s / steps) * 0.35, 10 + i * 0.01);
        // pinnules: pale side twigs on the frond's outer side (overlay, so the fan stays airy)
        if (s > 1 && !last && (s + i) % 2 === 0) {
          const side = k >= 0 ? 1 : -1;
          sk.over(x - Math.sin(a) * side * 0.9 + Math.cos(a) * 0.5, y + Math.cos(a) * side * 0.9 + Math.sin(a) * 0.5, PAL.pinna);
        }
      }
    }
  } else {
    // folded: the fronds lie flat in their groove, a pale tuft along the top of the head
    for (let s = 0; s < 3; s++) sk.dot(tip[0] - Math.cos(ha) * s + nx * 0.9, tip[1] - Math.sin(ha) * s + ny * 0.9, s ? M.gill : M.gillT, 0.6 - s * 0.08, 10);
  }
  return { head: [h[0], h[1] - 3] as V2, eye: h };
}

export const CROWNLEECH: SpeciesDef = {
  name: 'Crown Leech', kind: 'other', len: 9, height: 3,
  anims: ANIMS,
  canvas: () => ({ w: 24, h: 16, ox: 7, oy: 13 }),
  draw: (sk, anim, frame) => draw(sk, anim, frame),
  eyeFor: () => 'open',
};

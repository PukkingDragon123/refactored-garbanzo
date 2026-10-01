// Crown Leech: an amphibious leech that lives in the neck creases of the Corvex Seal. A glossy
// indigo body with pale lateral stripes, a rear sucker, and at the head a crown of feathery
// gill-fronds it opens like a tiny sea anemone to breathe while its host sleeps. Shaken off onto the
// sand it loops along like an inchworm, rearing up to "taste" the air for its seal.
//
// Faces right, anchored on the ground under the rear sucker. Anims: idle, inch, rear, curl.

import { Sk, V2, rmp, SpeciesDef, TAU, sm, lerp2, qbez } from '../../beasts-core';
import { hex } from '../../color';

const A = (frames: number, fps: number, loop = true) => ({ frames, fps, loop });
const ANIMS = { idle: A(4, 4), inch: A(6, 7), rear: A(4, 4), curl: A(2, 2) };

interface P { pts: V2[]; crown: number; crownA: number; wave: number; fat: number }

/** body centreline from the rear sucker (at the anchor) to the head */
function pose(anim: string, f: number, n: number): P {
  const t = f / n;
  switch (anim) {
    case 'inch': {
      // loop: the head reaches forward and plants, the rear sucker is pulled up behind it in an arch
      const reach = [0.2, 0.6, 1, 1, 0.55, 0.2][f];     // body extension
      const arch = [0.9, 0.5, 0.05, 0.3, 0.95, 1][f];   // loop height
      const rearX = [0, 0, 0, 1.5, 3.5, 5][f];          // rear sucker creeping forward
      const L = 5 + reach * 5;
      const a: V2 = [rearX, -1], b: V2 = [rearX + L, -1];
      const c: V2 = [(a[0] + b[0]) / 2, -1 - arch * 6];
      return { pts: qbez(a, c, b, 8), crown: reach > 0.8 ? 0.4 : 0, crownA: 0, wave: 0, fat: 1 - reach * 0.18 };
    }
    case 'rear': {
      // anchored by the rear sucker, head raised and swaying, crown open to taste the air
      const sw = Math.sin(t * TAU) * 0.35;
      const head: V2 = [6 + sw * 3, -8 + Math.abs(sw) * 1.5];
      return { pts: qbez([0, -1], [5, -1.5], head, 8), crown: 1, crownA: -1.2 + sw, wave: t, fat: 0.95 };
    }
    case 'curl': {
      const pts: V2[] = [];
      for (let i = 0; i <= 8; i++) { const a = Math.PI * 0.95 - (i / 8) * TAU * 0.85; pts.push([3.5 + Math.cos(a) * 3.2 * (1 - i * 0.03), -3.3 + Math.sin(a) * 2.4]); }
      return { pts, crown: 0, crownA: 0, wave: 0, fat: 1.05 + (f ? 0.06 : 0) };
    }
    default: {
      // resting stretched out on the sand, crown open and gently waving
      const pts: V2[] = [];
      for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push([u * 9, -1.2 - Math.sin(u * Math.PI) * 0.8 - sm((u - 0.7) / 0.3) * 1.5]); }
      return { pts, crown: 1, crownA: -0.4 + Math.sin(t * TAU) * 0.2, wave: t, fat: 1 };
    }
  }
}

function draw(sk: Sk, anim: string, frame: number) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const P = pose(anim, frame, n);
  const M = {
    body: sk.m(rmp('#30268a', { n: 5, dark: 0.6, light: 0.5, cool: 0.4 }), { spec: 0.9, edge: 1 }),
    stripe: sk.m(rmp('#6c7fd2', { n: 4, dark: 0.45, light: 0.4 }), { spec: 0.5, edge: 1 }),
    sucker: sk.m(rmp('#6a4a9a', { n: 4, dark: 0.5 }), { spec: 0.5 }),
  };
  sk.clipY = 0;
  // rear sucker disc
  sk.np();
  const r0 = P.pts[0];
  sk.ell(r0[0] - 0.4, Math.min(r0[1], -1.3), 1.8 * P.fat, 1.3, M.sucker, { z: 0 });
  // segmented body, fattest behind the middle, pale stripes along each side
  sk.np();
  sk.tube(P.pts, t => (1.25 + Math.sin(Math.min(1, t * 1.3) * Math.PI) * 0.75 - t * 0.35) * P.fat, (p) => {
    if (Math.sin(p.t * 22) > 0.72) p.l -= 0.14; // annuli
    if (p.v > 0.35 && p.v < 0.7) return M.stripe;
    return M.body;
  }, { z: 1 });
  // crown: a fan of pale gill-fronds round the head
  const h = P.pts[P.pts.length - 1], h0 = P.pts[P.pts.length - 2];
  const ha = Math.atan2(h[1] - h0[1], h[0] - h0[0]);
  if (P.crown > 0.1) {
    for (let i = 0; i < 5; i++) {
      const a = ha + (i - 2) * 0.55 * P.crown + Math.sin((P.wave + i * 0.2) * TAU) * 0.15 + P.crownA * 0.2;
      const L = (2.2 + (i % 2) * 0.8) * P.crown;
      for (let s = 0.8; s <= L; s += 0.7) sk.over(h[0] + Math.cos(a) * s, h[1] + Math.sin(a) * s, hex(s > L - 0.8 ? '#e8feff' : '#9ee6f2'));
    }
  } else sk.over(h[0] + Math.cos(ha), h[1] + Math.sin(ha), hex('#9aa8e0'));
  // glossy highlight along the back
  const mid = lerp2(P.pts[3], P.pts[4], 0.5);
  sk.over(mid[0], mid[1] - 1, hex('#c8d0ff'));
  return { head: [h[0], h[1] - 3] as V2, eye: h };
}

export const CROWNLEECH: SpeciesDef = {
  name: 'Crown Leech', kind: 'other', len: 9, height: 3,
  anims: ANIMS,
  canvas: () => ({ w: 24, h: 16, ox: 7, oy: 13 }),
  draw: (sk, anim, frame) => draw(sk, anim, frame),
  eyeFor: () => 'open',
};

// Periscope Octopus: a rock-pool octopus in a suit of armour. Its mantle is plated with overlapping
// shell scutes grown from its own skin, crusted with pink coralline and the odd barnacle, so that
// pulled down in its pool it is just another rock. Its eyes sit on long retractable stalks it raises
// out of the water like periscopes while the rest of it stays hidden; it hunts crabs on the rim with a
// long arm and, cornered, flashes rings of electric blue across its skin.
//
// Faces right, anchored on the water surface of its pool: anything below y = 0 is under water (the
// game draws that part tinted). Anims: hide, periscope, peek, reach, flash.

import { Sk, V2, Px, rmp, BeastEye, SpeciesDef, TAU, hh, lerp2, sm } from '../../beasts-core';
import { hex } from '../../color';

const A = (frames: number, fps: number, loop = true) => ({ frames, fps, loop });
const ANIMS = { hide: A(2, 1), periscope: A(4, 3), peek: A(4, 3), reach: A(6, 7), flash: A(4, 8), idle: A(4, 3) };

interface P {
  rise: number;        // mantle top above the water (px)
  stalk: number;       // eyestalk length above the head (px)
  look: number;        // eyestalk swivel -1..1
  drape: number;       // arms draped over the rim 0..1
  reach: number;       // hunting arm extension 0..1
  grab: number;        // arm tip curled 0..1
  rings: number;       // blue ring flash 0..1
  spread: number;      // arms spread wide (threat)
  breathe: number;
  prey: boolean;
}
function pose(anim: string, f: number, n: number): P {
  const t = f / n, s = Math.sin(t * TAU);
  const p: P = { rise: 4, stalk: 2, look: 0, drape: 0.6, reach: 0, grab: 0, rings: 0, spread: 0, breathe: s, prey: false };
  switch (anim) {
    case 'hide': p.rise = 1.5 + f * 0.3; p.stalk = 0; p.drape = 0; break;
    case 'periscope': p.rise = 1.2; p.stalk = 6 + Math.abs(s) * 0.8; p.look = [0, 1, 0, -1][f]; p.drape = 0; break;
    case 'idle':
    case 'peek': p.rise = 5.5 + s * 0.4; p.stalk = 4 + (f === 2 ? 1 : 0); p.look = [0, 0.4, 0, -0.5][f]; p.drape = 1; break;
    case 'reach': {
      const K = [0.2, 0.55, 0.9, 1, 0.7, 0.3][f];
      p.rise = 5; p.stalk = 4.5; p.drape = 0.8; p.reach = K; p.grab = f >= 3 ? 1 : 0; p.look = 0.6; p.prey = f >= 3 && f <= 5;
      break;
    }
    case 'flash': p.rise = 7; p.stalk = 5; p.drape = 0.4; p.spread = 1; p.rings = f % 2 ? 1 : 0.35; p.look = f % 2 ? 0.2 : -0.2; break;
  }
  return p;
}

function draw(sk: Sk, anim: string, frame: number, _eye: BeastEye, juv: boolean) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const P = pose(anim, frame, n);
  const k = juv ? 0.7 : 1;
  const M = {
    plate: sk.m(rmp('#b8a286', { n: 6, dark: 0.6, light: 0.38, cool: 0.2 }), { edge: 1, spec: 0.25 }),
    plateD: sk.m(rmp('#7a6652', { n: 5, dark: 0.55 }), { edge: 0 }),
    coral: sk.m(rmp('#d87a8a', { n: 4, dark: 0.45, cool: 0.1 }), { edge: 0 }),
    barn: sk.m(rmp('#ece6da', { n: 3, dark: 0.35 }), { edge: 1 }),
    skin: sk.m(rmp('#c0502e', { n: 6, dark: 0.6, light: 0.42, cool: 0.15 }), { edge: 1, spec: 0.45 }),
    sucker: sk.m(rmp('#f2c8a8', { n: 3, dark: 0.35 }), { edge: 0 }),
    stalk: sk.m(rmp('#c86a46', { n: 4, dark: 0.5 }), { edge: 1, spec: 0.3 }),
    eye: sk.m(rmp('#e8c040', { n: 4, dark: 0.45 }), { spec: 0.8 }),
    crab: sk.m(rmp('#dcecef', { n: 3, dark: 0.3 }), { edge: 1 }),
  };
  const ringC = hex('#3ad8ff'), ringD = hex('#123a8a');
  const R = 6 * k;
  const cy = -P.rise + R * 0.9; // mantle centre (most of it under water when hiding)
  const cx = -1 * k;
  // ---- arms: draped over the rim to either side, one hunting arm along the rock
  const arm = (x0: number, side: number, len: number, curl: number, z: number, lift = 0) => {
    const pts: V2[] = [];
    let a = side > 0 ? -0.35 - lift : Math.PI + 0.35 + lift, x = x0, y = cy + R * 0.25;
    pts.push([x, y]);
    for (let i = 0; i < 8; i++) {
      a += side * (0.12 + curl * i * 0.06);
      x += Math.cos(a) * len / 8; y += Math.sin(a) * len / 8;
      y = Math.min(y, i > 2 ? -0.6 : y); // lies along the rim above the water
      pts.push([x, y]);
    }
    sk.np();
    sk.tube(pts, t => (1.5 - t * 1.1) * k, (p: Px) => {
      if (p.v > 0.45 && Math.sin(p.t * 26) > 0.2) return M.sucker;
      return M.skin;
    }, { z });
    if (P.rings > 0.3) for (let i = 2; i < 8; i += 2) sk.overPaint(pts[i][0], pts[i][1] - 0.5, i % 4 ? ringC : ringD);
    return pts[pts.length - 1];
  };
  if (P.drape > 0) {
    arm(cx - R * 0.7, -1, (12 + P.spread * 4) * P.drape * k, 0.5 + P.spread * 0.2, -2, P.spread * 0.6);
    arm(cx - R * 0.3, -1, (8 + P.spread * 3) * P.drape * k, 0.9, -3, P.spread * 0.9);
  }
  // ---- mantle: overlapping shell scutes in rows, coralline crust, a barnacle or two
  sk.np();
  sk.ell(cx, cy, R * 1.12, R * (1 + P.breathe * 0.03), (p: Px) => {
    // scutes overlap like roof tiles: a light leading edge, a dark seam under each row
    const row = Math.floor((p.v + 1) * 2), col = (p.u + 1) * 1.9 + (row % 2) * 0.5;
    const fx = col - Math.floor(col), fy = (p.v + 1) * 2 - row;
    if (fy > 0.8 || fx < 0.12) { p.l -= 0.3; return M.plateD; }
    if (fy < 0.2) p.l += 0.14;
    if (hh(Math.floor(col), row, 11) < 0.25 && p.v < 0.2) return M.coral;
    if (P.rings > 0.3 && fy > 0.7 && hh(Math.floor(col), row, 12) < 0.5) return M.skin;
    p.l += (1 - fy) * 0.08;
    return M.plate;
  }, { rz: R * 0.9, z: 2 });
  const mantle = sk.pid;
  // barnacles
  for (const [bx, by] of [[-0.45, -0.6], [0.3, -0.75]] as V2[]) { sk.np(); sk.ell(cx + bx * R, cy + by * R, 1 * k, 0.8 * k, M.barn, { z: 12 }); sk.over(cx + bx * R, cy + by * R - 0.3, hex('#5a5048')); }
  void mantle;
  // ring flash: electric blue rings blink open in the skin between the plates
  if (P.rings > 0.3) for (let i = 0; i < 7; i++) {
    const a = -Math.PI * (0.15 + i * 0.12), r = R * (0.7 + hh(i, 1, 3) * 0.25);
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.9;
    if (y < 0.5) { sk.overPaint(x, y, ringC); sk.overPaint(x + 1, y, ringD); }
  }
  // ---- head under the front of the mantle: siphon, and the eyestalks (periscopes)
  sk.np();
  const hx = cx + R * 0.75, hy = cy - R * 0.35;
  sk.ell(hx, hy, 2.6 * k, 2.2 * k, M.skin, { z: 6 });
  let eyeP: V2 = [hx, hy - 3];
  for (const side of [-1, 1]) {
    const b: V2 = [hx + side * 0.8 * k - 0.5, hy - 1.6 * k];
    const L = (1 + P.stalk) * k;
    const a = -Math.PI / 2 + side * 0.16 + P.look * 0.3;
    const e: V2 = [b[0] + Math.cos(a) * L, b[1] + Math.sin(a) * L];
    sk.np();
    sk.tube([b, lerp2(b, e, 0.5), e], t => (0.75 - t * 0.15) * k, M.stalk, { z: side > 0 ? 9 : 5 });
    sk.np();
    sk.ell(e[0], e[1] - 0.4, 1.3 * k, 1.1 * k, M.eye, { z: side > 0 ? 10 : 6 });
    // horizontal bar pupil
    sk.over(e[0] - 0.5 + P.look * 0.4, e[1] - 0.4, hex('#140e08'));
    sk.over(e[0] + 0.5 + P.look * 0.4, e[1] - 0.4, hex('#140e08'));
    sk.over(e[0] - 0.6, e[1] - 1.3, hex('#fff6d8'));
    if (side > 0) eyeP = e;
  }
  // ---- the hunting arm, snaking out along the rock to the right
  if (P.drape > 0) arm(hx, 1, 7 * k, 0.9, 8);
  if (P.reach > 0.05) {
    const pts: V2[] = [];
    const L = (5 + P.reach * 13) * k;
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      const x = hx + 1 + u * L;
      let y = -1 - Math.sin(u * Math.PI) * 2.2 * k + Math.sin(u * 9 + P.reach * 4) * 0.5;
      if (u > 0.85 && P.grab) y -= (u - 0.85) * 12 * P.grab;
      pts.push([x, Math.min(-0.5, y)]);
    }
    sk.np();
    sk.tube(pts, t => (1.3 - t * 0.9) * k, (p: Px) => (p.v > 0.4 && Math.sin(p.t * 30) > 0.2 ? M.sucker : M.skin), { z: 14 });
    if (P.prey) {
      const e = pts[10];
      sk.np();
      sk.ell(e[0] - 0.5, e[1] - 1.5, 1.8 * k, 1.2 * k, M.crab, { z: 15 });
      sk.over(e[0] - 1.5, e[1] - 2.8, hex('#140e10')); sk.over(e[0] + 0.5, e[1] - 2.8, hex('#140e10'));
    }
  }
  void sm;
  return { head: [eyeP[0], eyeP[1] - 2] as V2, eye: eyeP };
}

export const PERISCOPE: SpeciesDef = {
  name: 'Periscope Octopus', kind: 'mollusc', len: 14, height: 10,
  anims: ANIMS,
  canvas: () => ({ w: 56, h: 36, ox: 22, oy: 20 }),
  draw,
  eyeFor: () => 'open',
};

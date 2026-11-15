// Shieldback (Loricatherium volvens): an armoured forager plated like a pangolin, built on an
// armadillo's frame, that rolls into a bite-proof ball at the first flick of a forked tongue.
//
// Painted on the Relief layer (beasts-relief.ts) from one contour per mass through anatomical landmarks:
//   - the carapace: a high, arched dome of overlapping horn scales in transverse bands fanning over the
//     back like the ribs of a shell; every scale lifts to a pale, worn free edge pointing back over the
//     band behind, with a dark crevice in front of it, so the back's outline is serrated and the skirt
//     ends in a row of points; the four bands over the middle are narrow, with folds of skin between
//     them: the hinge that lets it roll up;
//   - a small conical head under a cap of little scales, the bare snout wrinkled across, a tiny eye
//     under the cap's edge, a small round ear, a long tongue for grubs;
//   - short, stout legs: the forefeet walk on their knuckles with three great curved digging claws
//     tucked under (the middle one biggest), the hind feet are plantigrade with short claws;
//   - a long, broad tail plated all over, its edges serrated by the scale points;
//   - bare pinkish skin underneath with sparse coarse bristles.
// Rolled up ('ball', 'roll') it is one sphere of scales spiralling in toward the middle, the tail
// wrapped across the face with the snout and a claw peeking out, its rim a ring of points.

import { Sk, V2, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, gait, TAU, fr, ik2, hh } from './beasts-core';
import { Frame2 } from './beasts-rig';
import { Relief, Sp, Tx, LM, spline, fringe, along } from './beasts-relief';
import { imbricate, ribbon, localOf, claw, crumb, mound, Curve, clamp01 } from './beasts-mam-kit';
import { hex } from './color';

interface P {
  bx: number; by: number; tilt: number; br: number;
  feet: [V2, V2, V2, V2]; // FL near, FL far, HL near, HL far (offsets from rest)
  head: number; hdx: number; hdy: number; jaw: number; tongue: number; ear: number; sniff: number;
  tail: number; curl: number;
  tuck: number; // 0..1 legs folded under (sleep)
  dirt: number; dirtPhase: number;
}
const base = (): P => ({
  bx: 0, by: 0, tilt: 0, br: 0, feet: [[0, 0], [0, 0], [0, 0], [0, 0]],
  head: 0, hdx: 0, hdy: 0, jaw: 0, tongue: 0, ear: 0, sniff: 0, tail: 0, curl: 0, tuck: 0, dirt: 0, dirtPhase: 0,
});

const ANIMS = {
  idle: { frames: 4, fps: 4, loop: true },
  walk: { frames: 8, fps: 9, loop: true },
  run: { frames: 6, fps: 13, loop: true },
  eat: { frames: 4, fps: 6, loop: true },
  alert: { frames: 2, fps: 3, loop: true },
  sleep: { frames: 2, fps: 1.5, loop: true },
  call: { frames: 2, fps: 4, loop: true },
  groom: { frames: 4, fps: 7, loop: true },
  ball: { frames: 1, fps: 1, loop: true },
  roll: { frames: 4, fps: 12, loop: true },
  dig: { frames: 4, fps: 9, loop: true },
};

function pose(anim: string, f: number, n: number): P {
  const p = base();
  const t = f / n;
  switch (anim) {
    case 'idle': {
      p.br = Math.sin(t * TAU) * 0.5 + 0.5;
      p.sniff = f === 1 ? 1 : f === 2 ? 0.5 : 0;
      p.head = 0.1 + (f === 2 ? 0.08 : 0);
      p.ear = f === 3 ? 1 : 0;
      p.tail = Math.sin(t * TAU) * 0.05;
      break;
    }
    case 'walk': {
      const st = 4.6, lift = 1.6, duty = 0.62;
      p.feet[2] = gait(t, duty, st, lift);
      p.feet[0] = gait(t + 0.25, duty, st, lift);
      p.feet[3] = gait(t + 0.5, duty, st, lift);
      p.feet[1] = gait(t + 0.75, duty, st, lift);
      p.by = Math.cos(t * TAU * 2) * 0.45;
      p.tilt = Math.sin(t * TAU) * 0.02;
      p.head = 0.18 + Math.sin(t * TAU) * 0.06;
      p.sniff = f % 4 === 1 ? 1 : 0;
      p.tail = Math.sin(t * TAU + 1.2) * 0.1;
      break;
    }
    case 'run': {
      const st = 8, lift = 2.6, duty = 0.45;
      p.feet[0] = gait(t, duty, st, lift);
      p.feet[3] = gait(t + 0.06, duty, st, lift);
      p.feet[1] = gait(t + 0.5, duty, st, lift);
      p.feet[2] = gait(t + 0.56, duty, st, lift);
      p.by = -Math.abs(Math.sin(t * TAU)) * 1.2 + 0.4;
      p.tilt = Math.sin(t * TAU) * 0.05;
      p.head = 0.04 + Math.sin(t * TAU + 1) * 0.05;
      p.hdx = 0.6;
      p.tail = -0.12 + Math.sin(t * TAU + 2) * 0.12;
      p.ear = -1;
      break;
    }
    case 'eat': {
      p.tilt = 0.12;
      p.by = 0.6;
      p.head = 0.62 + (f % 2) * 0.08;
      p.hdx = 0.4;
      p.feet[0] = [1.5, 0];
      p.feet[1] = [0.5, 0];
      p.tongue = f === 1 ? 1 : f === 3 ? 0.6 : 0;
      p.sniff = f % 2;
      p.tail = 0.05;
      break;
    }
    case 'alert': {
      p.tilt = -0.2;
      p.by = -0.6;
      p.head = -0.3;
      p.feet[0] = [-1.2, -1.6];
      p.feet[1] = [-0.5, -1.2];
      p.ear = 1;
      p.sniff = f;
      p.tail = 0.1;
      break;
    }
    case 'sleep': {
      p.tuck = 1;
      p.by = 3.2;
      p.br = f;
      p.head = 1.05;
      p.hdx = -2.4;
      p.hdy = 1.6;
      p.curl = 1;
      p.tail = -0.25;
      p.ear = -1;
      break;
    }
    case 'call': {
      p.head = -0.32 - f * 0.05;
      p.jaw = f ? 1 : 0.55;
      p.tilt = -0.06;
      p.br = f;
      p.ear = 0.5;
      p.tail = 0.1 * f;
      break;
    }
    case 'groom': {
      // scratch the flank with the near hind foot
      p.tilt = -0.08;
      p.by = 0.3;
      p.head = 0.5;
      p.hdx = -0.6;
      const s = [0, 1, 0.3, 1][f];
      p.feet[2] = [3.5 + s * 1.2, -5.5 - s * 1.5];
      p.feet[3] = [0.8, 0];
      p.ear = f % 2 ? -0.5 : 0;
      p.tail = 0.1;
      break;
    }
    case 'dig': {
      p.tilt = 0.3;
      p.by = 1.1;
      p.head = 0.5;
      p.hdx = 0.2;
      const a = f / 4;
      p.feet[0] = [2.8 - fr(a) * 5, -Math.max(0, Math.sin(a * TAU)) * 2];
      p.feet[1] = [2.8 - fr(a + 0.5) * 5, -Math.max(0, Math.sin((a + 0.5) * TAU)) * 2];
      p.feet[2] = [-0.5, 0];
      p.feet[3] = [0.5, 0];
      p.dirt = 1;
      p.dirtPhase = a;
      p.tail = 0.22;
      p.ear = -1;
      break;
    }
  }
  return p;
}

const EYE: EyeSpec = { r: 1, iris: hex('#2a1c16'), lash: hex('#3a2a22'), dark: true, shine: hex('#f4e6c8') };

function mats(sk: Sk) {
  return {
    scale: sk.m(rmp('#9c7646', { n: 7, dark: 0.6, light: 0.42, cool: 0.4, warm: 0.4 }), { edge: 1 }),
    scaleD: sk.m(rmp('#6e5032', { n: 6, dark: 0.58, light: 0.34, cool: 0.38 }), { edge: 1 }),
    rim: sk.m(rmp('#dcc08a', { n: 6, dark: 0.5, light: 0.4, at: 3 }), { edge: 1 }),
    gap: sk.m(rmp('#2e2018', { n: 4, dark: 0.45, light: 0.3 }), { edge: 0 }),
    skin: sk.m(rmp('#a07668', { n: 7, dark: 0.6, light: 0.4, warm: 0.35 }), { edge: 1 }),
    skinD: sk.m(rmp('#6e4c44', { n: 6, dark: 0.58, light: 0.35 }), { edge: 1 }),
    belly: sk.m(rmp('#bf9584', { n: 6, dark: 0.55, light: 0.38, at: 3 }), { edge: 1 }),
    hair: sk.m(rmp('#d8c6a6', { n: 5, dark: 0.45, light: 0.35, at: 3 }), { edge: 0 }),
    claw: sk.m(rmp('#efe3c6', { n: 6, dark: 0.5, light: 0.4, at: 3 }), { edge: 1 }),
    clawD: sk.m(rmp('#86705a', { n: 5, dark: 0.5, light: 0.35 }), { edge: 1 }),
    nose: sk.m(rmp('#3e2a2a', { n: 5, dark: 0.5, light: 0.5 }), { edge: 0 }),
    tongue: sk.m(rmp('#dc7c92', { n: 5, dark: 0.45, light: 0.4 }), { edge: 1 }),
    mouth: sk.m(rmp('#3a1c20', { n: 3, dark: 0.4 }), { edge: 0 }),
    soil: sk.m(rmp('#7a5838', { n: 5, dark: 0.55, light: 0.35 }), { edge: 1 }),
    soilD: sk.m(rmp('#4c3424', { n: 4, dark: 0.5, light: 0.3 }), { edge: 1 }),
  };
}
type M = ReturnType<typeof mats>;

const ID = { SHELL: 1, HEAD: 2, CAP: 3, LEG: 4, HAND: 5, CLAW: 6, TAIL: 7, BELLY: 8, EAR: 9, TONGUE: 10, MOUTH: 11, SOIL: 12 };

/**
 * One pixel of the armour: an overlapping scale lifted toward its pale, worn free edge, gently domed
 * across, a dark crevice in front of the next scale's edge; the hinge bands show folds of skin between.
 */
function armour(M: M, o: Tx, X: number, Y: number, bands: number[], sh: number, tip: number, hinge: [number, number], seed: number, amp = 1) {
  const s = imbricate(X, Y, bands, sh, tip, seed);
  const u = clamp01(s.d / s.bw);
  // each band of scales lifts toward its notched free edge
  o.z += 0.6 * (1 - u) * amp;
  o.m = M.scale;
  const hg = s.i >= hinge[0] && s.i <= hinge[1];
  // the dark crevice in front of the next band's edge; over the hinge a fold of pink skin behind it
  if (s.crev < 1) { o.m = M.gap; o.z -= 0.3 * amp; return; }
  if (hg && s.crev < 1.9) { o.m = M.skinD; o.z -= 0.2 * amp; return; }
  // the lit, worn lip along each scale's free edge, brightest over the top
  if (s.d < 0.95 && s.v < 0.18) { o.m = M.rim; return; }
  if (s.crev < 1.9 || (s.v > 0.42 && u < 0.5)) o.m = M.scaleD;
  // a chipped, sun-bleached scale here and there
  else if (s.hash < 0.05) o.m = M.rim;
}

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const k = juv ? 0.62 : 1;
  const M = mats(sk);
  sk.clipY = 0;
  if (anim === 'ball' || anim === 'roll') return drawBall(sk, M, anim === 'roll' ? frame : 0, k);
  const P = pose(anim, frame, n);
  const B = new Frame2([P.bx * k, (-9.6 + P.by) * k], P.tilt, k);
  const inv = localOf(B.o, B.a, k);
  const bp = (x: number, y: number, sh = 0): LM => { const q = B.p(x, y); return [q[0], q[1], sh]; };
  const gk = Math.max(0.8, k);

  // ---------------------------------------------------------------- legs
  const legJ = (which: number) => {
    const front = which < 2, near = which % 2 === 0;
    const root = B.p(front ? 7.6 - (near ? 0 : 1.2) : -7.8 + (near ? 0 : 1.2), front ? 1.4 : 1.8);
    const off = P.feet[which];
    let foot: V2 = [((front ? 9.2 : -7.2) + (near ? 0 : front ? -1.4 : 1.4) + off[0]) * k + P.bx * k, Math.min(0, off[1] * k)];
    let lifted = off[1] < -0.4;
    if (P.tuck) { foot = B.p(front ? 10.5 + (near ? 0 : -1) : -4.5 + (near ? 0 : 1), 8.4); lifted = true; }
    const groom = !front && near && off[1] < -3;
    // the wrist / ankle sits above and behind the ground contact
    const end: V2 = front ? [foot[0] - 0.6 * k, foot[1] - 2 * k] : [foot[0] - 1.6 * k, foot[1] - 1.7 * k];
    const l1 = (front ? 4.4 : 5) * k, l2 = (front ? 4.4 : 4.6) * k;
    const [j, e] = ik2(root, end, l1, l2, front ? 1 : -1);
    return { root, j, e, foot, front, near, lifted, groom };
  };
  type LJ = ReturnType<typeof legJ>;
  const legOutline = (L: LJ): LM[] => {
    const { root, j, e } = L, s = k;
    const up: V2 = [root[0] - (j[0] - root[0]) * 0.5, root[1] - (j[1] - root[1]) * 0.5];
    if (L.front) return [
      along(up, root, 1, 2.8 * s), along(root, j, 0.2, 2.6 * s), along(root, j, 0.8, 2.1 * s),
      along(j, e, 0.1, 2 * s), along(j, e, 0.6, 1.7 * s), along(j, e, 1, 1.5 * s), along(j, e, 1.16, 0.2 * s, 0.3),
      along(j, e, 1.08, -1.4 * s), along(j, e, 0.6, -1.5 * s), along(j, e, 0.08, -1.9 * s),
      along(j, e, -0.16, -1.5 * s, 0.4), // the point of the elbow
      along(root, j, 0.6, -2.5 * s), along(root, j, 0.1, -2.8 * s), along(up, root, 0.5, -2.4 * s),
    ];
    return [
      along(up, root, 1, 3.4 * s), along(root, j, 0.2, 3.4 * s), along(root, j, 0.8, 2.6 * s), along(root, j, 1.06, 1.5 * s, 0.3),
      along(j, e, 0.2, 1.6 * s), along(j, e, 0.7, 1.3 * s), along(j, e, 1, 1.3 * s),
      along(j, e, 1.12, -1 * s, 0.4), // the heel
      along(j, e, 0.7, -1.3 * s), along(j, e, 0.2, -1.8 * s),
      along(root, j, 0.8, -2.4 * s), along(root, j, 0.3, -3.4 * s), along(up, root, 0.5, -3 * s),
    ];
  };
  const legTex = (L: LJ) => (p: Sp, o: Tx) => {
    // the outer forearm / shin is plated with small scales; bare, wrinkled skin round the joints
    const ax = L.j, bx = L.e, dx = bx[0] - ax[0], dy = bx[1] - ax[1], l2 = dx * dx + dy * dy || 1;
    const t = ((p.x - ax[0]) * dx + (p.y - ax[1]) * dy) / l2;
    const c = ((p.x - ax[0]) * dy - (p.y - ax[1]) * dx) / Math.sqrt(l2);
    o.m = M.skin;
    if (t > -0.1 && t < 0.85) armour(M, o, -t * 6 * gk, c, [-6, -4.2, -2.4, -0.6, 1.2], 2.1 * gk, 1, [99, 99], 31, 0.7);
    else if (fr(t * 5) < 0.25) { o.z -= 0.4; o.m = M.skinD; }
  };
  /** the foot: the forefoot a knuckle pad with three great digging claws tucked under, the hind foot plantigrade */
  const foot = (R: Relief, L: LJ, z0: number) => {
    const { e, foot: f } = L, s = k;
    const tilt = L.lifted && !P.tuck ? (L.front ? 0.5 : 0.7) : 0;
    const c = Math.cos(tilt), sn = Math.sin(tilt);
    const q = (x: number, y: number, sh = 0): LM => [e[0] + (x * c - y * sn) * s, e[1] + (x * sn + y * c) * s, sh];
    if (L.front) {
      R.region(spline([q(-1.3, -1.2), q(1.4, -1.4), q(2.6, -0.4), q(2.2, 1.1, 0.2), q(-0.6, 1.5), q(-1.6, 0.4)], 0.4), { z: z0, R: 1, H: 1.4, id: ID.HAND, tex: (p, o) => { o.m = M.skin; if (p.v > 0.7) o.m = M.skinD; } });
      // three digging claws, the middle one the biggest, curled under the knuckles (raking forward when digging)
      const rake = P.dirt ? 0.25 : 0;
      for (let i = 2; i >= 0; i--) {
        const b = q(2 - i * 0.3, -0.4 + i * 0.55);
        const len = [3, 4.2, 2.8][i] * s;
        claw(R, [b[0], b[1]], 0.45 - rake + tilt + i * 0.12, len, 1.5 * s, 1.25 - rake * 2, z0 + 1.2 + (i === 1 ? 0.4 : 0), ID.CLAW, (u) => (u < 0.18 ? M.clawD : M.claw));
      }
    } else {
      R.region(spline([q(-1.4, -0.8), q(1.4, -0.4), q(3.4, 0.6), q(3.6, 1.6, 0.4), q(-0.2, 1.8), q(-1.8, 0.8, 0.3)], 0.4), { z: z0, R: 1, H: 1.3, id: ID.HAND, tex: (p, o) => { o.m = M.skin; if (p.v > 0.6) o.m = M.skinD; } });
      for (let i = 0; i < 3; i++) {
        const b = q(3.1 - i * 0.2, 0.5 + i * 0.4);
        claw(R, [b[0], b[1]], 0.35 + tilt, 1.5 * s, 0.9 * s, 0.7, z0 + 1 + i * 0.1, ID.CLAW, M.claw);
      }
    }
  };

  // far legs, behind everything
  for (const w of [3, 1]) {
    const L = legJ(w);
    const ol = legOutline(L);
    const R = new Relief(sk, Math.min(...ol.map(q => q[0])) - 6, Math.min(...ol.map(q => q[1])) - 4, Math.max(...ol.map(q => q[0])) + 8, 1);
    R.region(spline(ol, 0.6), { z: -12, R: 1.6 * k, H: 2 * k, id: ID.LEG, tex: legTex(L) });
    foot(R, L, -10);
    sk.np();
    R.emit({ bias: -0.18, drop: 1.4, seam: 0.5, seamDark: 0.3, ao: 0.05, aoR: 1 });
  }

  const BR = Relief.full(sk);

  // ---------------------------------------------------------------- the tail: long, broad, plated all over
  {
    const tb = B.p(-11.5, 0.6);
    const pts: V2[] = [tb];
    let a = B.ang(Math.PI - 0.5 + P.tail), x = tb[0], y = tb[1];
    for (let i = 0; i < 9; i++) {
      // a slight droop; asleep it wraps down and forward round the body along the ground
      a += -0.035 - P.curl * (0.22 + i * 0.03);
      x += Math.cos(a) * 2 * k; y += Math.sin(a) * 2 * k;
      pts.push([x, Math.min(y, -0.8 * k)]);
    }
    const crv = new Curve(pts);
    const wd = (t: number) => (3.3 - 2.5 * t) * k;
    const ol = fringe(spline(ribbon(pts, wd, wd, 0.5, 0), 0.6), 2.1 * gk, 11, (x2, y2) => (Math.hypot(x2 - tb[0], y2 - tb[1]) > 3 * k ? [0.9 * k + 0.2, -0.7] : null));
    const L = crv.total;
    BR.region(ol, { z: 0, R: 2 * k, H: 2.6 * k, id: ID.TAIL, tex: (p, o) => {
      const [t, c] = crv.project(p.x, p.y);
      armour(M, o, (1 - t) * L / gk, c / gk + 20, TB, 3.6, 1.2, [99, 99], 23, 0.9);
    } });
  }

  // ---------------------------------------------------------------- the belly: bare skin with coarse bristles
  {
    const bl: LM[] = [bp(-11.5, 1.5), bp(-8, 5.8), bp(-2, 6.8 + P.br * 0.2), bp(4, 6.6), bp(9, 5.2), bp(11.5, 2), bp(6, -1), bp(-6, -1)];
    const poly = fringe(spline(bl, 0.6), 1.7, 5, (_x, _y, _nx, ny) => (ny > 0.5 ? [1.1 * k, 0.3] : null));
    BR.region(poly, { z: -2, R: 2 * k, H: 2 * k, id: ID.BELLY, tex: (p, o) => {
      o.m = M.belly;
      if (hh(Math.floor(p.x * 0.8), Math.floor(p.y), 41) < 0.12) { o.m = M.hair; o.z += 0.3; }
    } });
  }

  // ---------------------------------------------------------------- the near legs, under the skirt
  const near = [legJ(2), legJ(0)];
  for (const L of near) {
    const ax = L.root, ay = L.e, al = Math.hypot(ay[0] - ax[0], ay[1] - ax[1]) || 1;
    const lift = L.groom ? 9 : 0;
    BR.region(spline(legOutline(L), 0.6), {
      R: 1.8 * k, H: 2.2 * k, id: ID.LEG, tex: legTex(L),
      zAt: (x, y) => {
        const t = ((x - ax[0]) * (ay[0] - ax[0]) + (y - ax[1]) * (ay[1] - ax[1])) / (al * al);
        return -1.5 * k + Math.max(0, Math.min(1, t)) * 4.5 * k + lift;
      },
    });
    foot(BR, L, 5 * k + lift);
  }

  // ---------------------------------------------------------------- head and its frame
  const H = B.sub(11.8 + P.hdx, 0.8 + P.hdy, P.head);
  const hp = (x: number, y: number, sh = 0): LM => { const q = H.p(x, y); return [q[0], q[1], sh]; };
  const ja = P.jaw * 0.35;
  const jp = (x: number, y: number, sh = 0): LM => {
    const hx = 1.5, hy = 2.6, dx = x - hx, dy = y - hy, c = Math.cos(ja), s = Math.sin(ja);
    return hp(hx + dx * c - dy * s, hy + dx * s + dy * c, sh);
  };
  const hinv = localOf(H.o, H.a, k);
  const sn = P.sniff * 0.35;
  {
    const head: LM[] = [
      hp(-2, -3.4), hp(1.6, -4.1), hp(4.8, -3.6), hp(8, -2.2), hp(11, -0.5), hp(13.2 + sn, 0.9), hp(14 + sn, 1.9, 0.5),
      hp(13.4 + sn, 2.7), hp(10.6, 2.9), jp(10.2, 3.2), jp(7.4, 3.8), jp(4.4, 4.4), jp(1.6, 4.9), hp(-1, 4.3), hp(-2.6, 1),
    ];
    BR.region(spline(head, 0.5), {
      R: 2.4 * k, H: 3.4 * k, id: ID.HEAD, tex: (p, o) => {
        const [hx, hy] = hinv(p.x, p.y);
        o.m = M.skin;
        if (hx > 12.9 + sn) { o.m = M.nose; o.t += 0.04; return; }
        // the bare snout, wrinkled across; pale under the jaw
        if (hy > 2.2 && hx < 10) o.m = M.belly;
        if (hx > 7 && fr(hx * 0.78) < 0.26 && hy < 2) { o.z -= 0.55; o.m = M.skinD; }
      },
      zAt: (x, y) => { const [hx] = hinv(x, y); return -1.6 * k + clamp01((hx + 1) / 7) * 3.4 * k; },
    });
    // the cap of small scales over the crown, its edge a brow over the eye
    const cap: LM[] = [hp(-2.2, -3.2), hp(1.6, -4.4), hp(5, -3.9), hp(8.4, -2.4, 0.3), hp(7.6, -1.5), hp(5.6, -2), hp(3.6, -1.7), hp(1, -1), hp(-1.8, -0.6)];
    BR.region(fringe(spline(cap, 0.4), 1.6, 3, (_x, _y, _nx, ny) => (ny < -0.4 ? [0.6, -0.6] : null)), {
      R: 1 * k, H: 1.4 * k, id: ID.CAP, tex: (p, o) => {
        const [hx, hy] = hinv(p.x, p.y);
        armour(M, o, hx, hy + 10, [-4, -1.6, 0.8, 3.2, 5.6, 8, 10.4], 3, 1, [99, 99], 17, 0.8);
      },
      zAt: (x, y) => { const [hx] = hinv(x, y); return 1.2 * k + clamp01((hx + 1) / 7) * 2.6 * k; },
    });
    // a fleshy lid round the eye, the jaw line, the nostril groove
    { const c = H.p(5.8, -1); BR.bump(c[0], c[1], 1.6 * k, 1.3 * k, 0.6 * k, 0, ID.HEAD); }
    BR.line([hp(8, 2.4), hp(11, 2.3), hp(13.3, 2.2)].map(q => [q[0], q[1]] as V2), 0.8 * k, -0.6 * k, { only: ID.HEAD });
    { const c = H.p(3, 2); BR.bump(c[0], c[1], 2.4 * k, 1.8 * k, 0.6 * k, H.a, ID.HEAD); }
    if (P.jaw > 0.3) {
      const a = H.p(6, 2.6), b = H.p(12.6, 2.6), c = jp(11.6, 3.4);
      BR.region(spline([[a[0], a[1], 0], [b[0], b[1], 0.4], [c[0], c[1], 0.4]], 0.4), { z: 6 * k, R: 0.5, H: 0.3, id: ID.MOUTH, tex: M.mouth });
    }
    // the small round ear behind the cap
    {
      const eb = H.p(0.4, -2.4);
      const ea = H.ang(-2.35 + P.ear * 0.35);
      const ca = Math.cos(ea), sa = Math.sin(ea), nx = -sa, ny = ca;
      const q = (t: number, w: number, sh = 0): LM => [eb[0] + (ca * t * 3 + nx * w * 1.5) * k, eb[1] + (sa * t * 3 + ny * w * 1.5) * k, sh];
      BR.region(spline([q(-0.2, -0.7), q(0.6, -0.9), q(1.05, 0, 0.2), q(0.6, 0.85), q(-0.2, 0.7)], 0.4), { z: 4.6 * k, R: 0.7, H: 1, id: ID.EAR, tex: (p, o) => {
        o.m = M.skinD;
        const dx = p.x - eb[0], dy = p.y - eb[1], t = (dx * ca + dy * sa) / (3 * k);
        if (t > 0.2 && t < 0.75 && p.s > 0.7) { o.m = M.skin; o.z -= 0.5; }
      } });
    }
    // the tongue: long, thin and sticky, flicked down into the soil
    if (P.tongue > 0) {
      const t0 = H.p(13, 2.6);
      const tp: V2[] = [t0];
      let a2 = H.ang(1.1), x = t0[0], y = t0[1];
      for (let i = 0; i < 5; i++) { a2 += 0.12; x += Math.cos(a2) * 1.2 * k * P.tongue; y += Math.sin(a2) * 1.2 * k * P.tongue; tp.push([x, Math.min(y, -0.5)]); }
      BR.region(spline(ribbon(tp, () => 0.55 * k, () => 0.55 * k, 0.6), 0.4), { z: 8 * k, R: 0.5, H: 0.6, id: ID.TONGUE, tex: M.tongue });
    }
  }

  // ---------------------------------------------------------------- the carapace
  {
    const br = P.br * 0.3;
    const shell: LM[] = [
      bp(-13.2, 2.2, 0.3), bp(-14.4, -1.8), bp(-12.6, -6.2), bp(-8.2, -9.6 - br), bp(-2.4, -10.8 - br), bp(3.4, -10.2 - br),
      bp(8.4, -7.8), bp(11.6, -4.6), bp(13.4, -1.2), bp(13.2, 2.6, 0.3), bp(9.5, 3.8), bp(4, 5), bp(-2, 5.4), bp(-8, 4.9),
    ];
    // scale points serrate the back and the skirt
    const ol = fringe(spline(shell, 0.6), 2.6 * gk, 7, (_x, _y, nx, ny) => {
      if (ny < -0.25) return [1.25 * k + 0.25, -0.75];
      if (ny > 0.5) return [1 * k + 0.2, 0.7];
      if (nx < -0.5) return [1 * k, -0.6];
      return null;
    });
    // the bands fan a little (leaning back over the rump, forward over the shoulders); rows follow the dorsal line
    const topY = (lx: number) => -10.6 + 0.034 * (lx + 2) * (lx + 2);
    BR.region(ol, {
      z: 2.4 * k, R: 6 * k, H: 7.5 * k, id: ID.SHELL, pow: 0.75, tex: (p, o) => {
        const [lx, ly] = inv(p.x, p.y);
        const Y = (ly - topY(lx)) / gk;
        const X = lx + Y * 0.3 * (lx / 13);
        armour(M, o, X / gk, Y, SB, 4.6, 0.9, [2, 5], 7);
        // the flank darkens toward the skirt, away from the light
        o.t -= clamp01((ly + 4) / 9) * 0.26;
        // the scales along the spine, a little paler and worn
        if (Y < 1.4 && o.m === M.scale) o.t += 0.05;
      },
    });
  }

  // ---------------------------------------------------------------- form and shadows
  { const c = B.p(-6, -3), d = B.p(6, -3); BR.bump(c[0], c[1], 6 * k, 5 * k, 1.4 * k, 0, ID.SHELL); BR.bump(d[0], d[1], 5 * k, 5 * k, 1 * k, 0, ID.SHELL); }
  BR.shadow(ID.SHELL, 0.8 * k, 1.6 * k, 0.2, ID.LEG, 2);
  BR.shadow(ID.SHELL, 0.8 * k, 1.6 * k, 0.16, ID.BELLY, 2);
  BR.shadow(ID.SHELL, 1.2 * k, 1.2 * k, 0.16, ID.HEAD, 2);
  BR.shadow(ID.SHELL, 1 * k, 1 * k, 0.12, ID.TAIL, 1);
  BR.shadow(ID.CAP, 0.6, 1, 0.1, ID.HEAD, 1);
  BR.shadow(ID.LEG, 0.8, 0.8, 0.08, ID.BELLY, 1);
  sk.np();
  BR.emit({ drop: 1.6 * k, seam: 0.7 * k, seamDark: 0.3, ao: 0.07, aoR: 2, contrast: 1.15 });

  const ec = H.p(5.9, -1.1);
  const ep = drawEye(sk, ec[0], ec[1], { ...EYE, r: k < 0.8 ? 0.5 : 1 }, eye);
  const ns = H.p(13.6 + sn, 1.7);
  sk.over(ns[0], ns[1], hex('#140c0c'));

  // ---------------------------------------------------------------- dirt from digging
  if (P.dirt) {
    const R = new Relief(sk, 8 * k, -6 * k, 20 * k, 1);
    mound(R, 14.5 * k, 4 * k, 2 * k, 5, 30, ID.SOIL, M.soil, M.soilD);
    sk.np();
    R.emit({ drop: 1.2, seam: 0.5 });
    for (let i = 0; i < 6; i++) {
      const ph = fr(P.dirtPhase + i / 6);
      const x = (-12 - ph * 15) * k, y = (-1.5 - Math.sin(ph * Math.PI) * (6 + (i % 3) * 2.5)) * k;
      crumb(sk, x, y, i, M.soil, M.soilD);
    }
  }
  const head = H.p(4, -1);
  return { head: [head[0], head[1] - 3 * k] as V2, eye: ep };
}

/** the carapace's band boundaries (fan coordinate, toward the head): broad shields, narrow hinge bands */
const SB = [-16.6, -12.6, -8.8, -5.4, -2.2, 1, 4.2, 7.8, 11.6, 15.6];
/** the tail's bands, from the tip toward the root */
const TB = [-2, 0.4, 2.8, 5.3, 7.9, 10.6, 13.4, 16.3, 19.3, 22.4];

/** Rolled-up armoured ball; `rf` turns the ball (rolling frames). */
function drawBall(sk: Sk, M: M, rf: number, k: number) {
  const R0 = 10.8 * k;
  const c: V2 = [0, -R0];
  const rotA = rf * (TAU / 4);
  const gk = Math.max(0.8, k);
  const BR = Relief.full(sk);
  // the rim: a ring of scale points, turning with the ball
  const N = 36, ring: LM[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU + rotA;
    ring.push([c[0] + Math.cos(a) * R0, c[1] + Math.sin(a) * R0, 0]);
  }
  const ol = fringe(spline(ring, 0.6), 3.1 * gk, 13, () => [1.3 * k + 0.2, 0.75]);
  const NB = 16, bw = (TAU * R0) / NB / gk;
  const bands: number[] = [];
  for (let i = -1; i <= NB + 1; i++) bands.push(i * bw);
  BR.region(ol, { z: 0, R: R0 * 0.95, H: R0 * 0.85, id: ID.SHELL, tex: (p, o) => {
    const dx = p.x - c[0], dy = p.y - c[1];
    const r = Math.hypot(dx, dy) / R0;
    let a = Math.atan2(dy, dx) - rotA;
    a = ((a % TAU) + TAU) % TAU;
    // the bands of the coiled body spiral in to a boss of small scales at the middle
    const X = (a + r * 1.1) * R0 / gk;
    const Y = (1 - r) * R0 / gk;
    armour(M, o, X, Y + 1, bands, 4.6 * Math.max(0.45, r), 0.9 * Math.max(0.5, r), [99, 99], 9);
    o.t -= clamp01(0.35 - r) * 0.5;
  } });
  // the tail, lying round the outside of the coil over the face, from the ground up over the front
  {
    const a0 = 1.7 + rotA;
    const pts: V2[] = [];
    for (let i = 0; i <= 9; i++) {
      const a = a0 - i * 0.29, rr = R0 * (0.84 - Math.max(0, i - 6) * 0.06);
      pts.push([c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr]);
    }
    const crv = new Curve(pts);
    const wd = (t: number) => (3.4 - 2.4 * t) * k;
    const tl = fringe(spline(ribbon(pts, wd, wd, 0.5), 0.6), 2.2 * gk, 15, (x, y) => (Math.hypot(x - c[0], y - c[1]) > R0 * 0.86 ? [0.9 * k + 0.2, 0.6] : null));
    const L = crv.total;
    BR.region(tl, { R: 1.8 * k, H: 2.4 * k, id: ID.TAIL, tex: (p, o) => {
      const [t, cc] = crv.project(p.x, p.y);
      armour(M, o, (1 - t) * L / gk, cc / gk + 20, TB, 3.4, 1, [99, 99], 23, 0.9);
    }, zAt: (x, y) => { const r = Math.min(0.98, Math.hypot(x - c[0], y - c[1]) / R0); return R0 * 0.85 * Math.sqrt(1 - r * r) + 1.4; } });
    // the snout tip and a digging claw peeking out from under the root of the tail
    const e = pts[1];
    const ia = a0 - 0.29 + Math.PI; // pointing in toward the centre
    const snout: V2 = [e[0] + Math.cos(ia) * 3.6 * k, e[1] + Math.sin(ia) * 3.6 * k];
    const sa = ia - Math.PI / 2;
    const q = (x: number, y: number, sh = 0): LM => [snout[0] + (x * Math.cos(sa) - y * Math.sin(sa)) * k, snout[1] + (x * Math.sin(sa) + y * Math.cos(sa)) * k, sh];
    BR.region(spline([q(-1.4, -0.6), q(1.6, -0.5, 0.4), q(1.4, 0.8, 0.4), q(-1.2, 0.9)], 0.4),
      { z: R0 * 0.55, R: 0.7, H: 0.8, id: ID.HEAD, tex: (p, o) => { o.m = p.u > 0.6 ? M.nose : M.skin; } });
    const cb = q(-3, 1.6);
    claw(BR, [cb[0], cb[1]], sa + 0.3, 3.2 * k, 1.4 * k, 1.1, R0 * 0.55 + 1, ID.CLAW, (u) => (u < 0.18 ? M.clawD : M.claw));
  }
  BR.shadow(ID.TAIL, 0.9, 1.3, 0.2, ID.SHELL, 2);
  sk.np();
  BR.emit({ drop: 2 * k, seam: 0.7 * k, seamDark: 0.3, ao: 0.08, aoR: 2, contrast: 1.2 });
  const head: V2 = [c[0], c[1] - R0 * 0.2];
  return { head, eye: [c[0] + R0 * 0.5, c[1] + R0 * 0.4] as V2 };
}

export const SHIELDBACK: SpeciesDef = {
  name: 'Shieldback', kind: 'mammal', len: 44, height: 18,
  anims: ANIMS,
  canvas: () => ({ w: 70, h: 40, ox: 34, oy: 32 }),
  draw,
  eyeFor: (anim) => (anim === 'sleep' || anim === 'ball' || anim === 'roll' ? 'closed' : anim === 'alert' ? 'alert' : anim === 'dig' ? 'angry' : 'open'),
};

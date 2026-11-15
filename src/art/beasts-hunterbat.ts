// Hunter Bat (Ambulochiroptera venator): a big-eared bat that folds its wings into forelegs and stalks
// the forest floor on all fours like a vampire bat — elbows raised high over its back, the thumbs'
// hooked claws planted — snatching frogs and wetas in the dark.
//
// Painted on the Relief layer (beasts-relief.ts) from one contour per mass through anatomical landmarks:
// a hunched, chocolate-furred body under a shaggy pale ruff that breaks the outline; a pug face of bare,
// wrinkled skin with a lancet noseleaf on a horseshoe round the nostrils, beady eyes, upper fangs always
// showing; enormous ears with ribbed pink insides and a pointed tragus; the wing-arm as a furred humerus,
// the bare elbow and the long bony forearm with the folded fingers and pleated membrane bundled behind
// it, the wingtip claw over the elbow and the big thumb claw; the membrane draping to the flank; the
// backward-bent hind legs with hooked claws and the tail membrane. In flight the membrane is one
// scalloped sheet between the finger bones, veined and lit through at its trailing edge. Roosting, the
// wings wrap it like a pleated cloak with the forearms as ridges and the thumbs peeking out.

import { Sk, V2, V3, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, TAU, fr, proj, ik2, hh, lumN } from './beasts-core';
import { Relief, Sp, Tx, LM, spline, fringe, along, strands, FS } from './beasts-relief';
import { hex } from './color';

const ANIMS = {
  idle: { frames: 4, fps: 4, loop: true },
  walk: { frames: 6, fps: 8, loop: true },
  run: { frames: 6, fps: 12, loop: true },
  eat: { frames: 3, fps: 6, loop: true },
  alert: { frames: 2, fps: 3, loop: true },
  sleep: { frames: 2, fps: 1.5, loop: true },
  call: { frames: 2, fps: 6, loop: true },
  groom: { frames: 4, fps: 7, loop: true },
  fly: { frames: 6, fps: 10, loop: true },
  hang: { frames: 2, fps: 1.5, loop: true },
  grab: { frames: 3, fps: 9, loop: false },
  screech: { frames: 2, fps: 8, loop: true },
};



const EYE: EyeSpec = { r: 1.2, iris: hex('#1a0c0c'), lash: hex('#2a1814'), dark: true, shine: hex('#ffd9a0') };

function mats(sk: Sk) {
  return {
    fur: sk.m(rmp('#42281f', { n: 7, dark: 0.62, light: 0.4, warm: 0.4, cool: 0.3 }), { edge: 1 }),
    furD: sk.m(rmp('#3a2420', { n: 6, dark: 0.6, light: 0.36, cool: 0.3 }), { edge: 1 }),
    furR: sk.m(rmp('#7e4630', { n: 6, dark: 0.6, light: 0.4, warm: 0.4 }), { edge: 1 }),
    mane: sk.m(rmp('#d2b48c', { n: 7, dark: 0.55, light: 0.4, warm: 0.3 }), { edge: 1 }),
    maneD: sk.m(rmp('#8a6a50', { n: 6, dark: 0.55, light: 0.35 }), { edge: 1 }),
    chest: sk.m(rmp('#8e6a52', { n: 6, dark: 0.55, light: 0.38 }), { edge: 1 }),
    skin: sk.m(rmp('#a87a68', { n: 7, dark: 0.58, light: 0.4, warm: 0.3 }), { edge: 1 }),
    skinD: sk.m(rmp('#4e302e', { n: 6, dark: 0.55, light: 0.35 }), { edge: 1 }),
    inner: sk.m(rmp('#a0645c', { n: 6, dark: 0.5, light: 0.34 }), { edge: 0 }),
    mem: sk.m(rmp('#30201f', { n: 7, dark: 0.55, light: 0.3, warm: 0.2 }), { edge: 1, k: 0.85 }),
    memL: sk.m(rmp('#5e3830', { n: 6, dark: 0.5, light: 0.3, warm: 0.4 }), { edge: 1, k: 0.85 }),
    vein: sk.m(rmp('#2a1a1c', { n: 4, dark: 0.45, light: 0.3 }), { edge: 0 }),
    bone: sk.m(rmp('#8e6c5e', { n: 6, dark: 0.55, light: 0.4 }), { edge: 1 }),
    claw: sk.m(rmp('#e4d8c4', { n: 5, dark: 0.45, light: 0.35, at: 3 }), { edge: 1 }),
    tooth: sk.m(rmp('#f6f2e6', { n: 4, dark: 0.3, at: 2 }), { edge: 0 }),
    mouth: sk.m(rmp('#6a1a24', { n: 4, dark: 0.45 }), { edge: 0 }),
  };
}
type M = ReturnType<typeof mats>;
const ID = { BODY: 1, MANE: 2, HEAD: 3, JAW: 4, LEAF: 5, ARM: 6, BUNDLE: 7, MEM: 8, LEG: 9, FOOT: 10, CLAW: 11, EAR: 12, INNER: 13, TOOTH: 14, MOUTH: 15, TAILM: 16, THUMB: 17, BONE: 18 };

const pt = (a: V2, u: V2, n2: V2, x: number, y: number, sh = 0): LM => [a[0] + u[0] * x + n2[0] * y, a[1] + u[1] * x + n2[1] * y, sh];
/** a frame from a to b: unit u along, n2 its normal (screen: rotated +90 deg, i.e. to the right of travel when y is down) */
const frame = (a: V2, b: V2): [V2, V2, number] => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  return [[dx / l, dy / l], [-dy / l, dx / l], l];
};

/** fur: short strands lying along `ang`, frosted tips here and there */
function furTex(M: M, ang: number, base: number, seed: number, amp = 0.7, len = 2.4) {
  return (p: Sp, o: Tx) => {
    o.z += strands(p.x, p.y, ang, len, 1.15, seed) * amp;
    o.m = base;
    if (FS.tip > 0.82 && hh(FS.row, FS.seg, seed + 1) < 0.12) o.m = base === M.mane ? M.chest : M.furR;
  };
}

interface HeadP { jaw: number; ear: number; eye: BeastEye; k: number; flip?: boolean }
/**
 * The head, in its own relief: pug snout wrinkled across, the lancet noseleaf standing on a horseshoe
 * round the nostrils, fangs, beady eyes; and the huge ribbed ears (each its own relief).
 */
function drawHead(sk: Sk, M: M, o0: V2, ha: number, P: HeadP, z: number) {
  const k = P.k, fy = P.flip ? -1 : 1;
  const c = Math.cos(ha), s = Math.sin(ha);
  const hp = (x: number, y: number, sh = 0): LM => [o0[0] + (x * c - y * fy * s) * k, o0[1] + (x * s + y * fy * c) * k, sh];
  const ja = P.jaw * 0.7;
  const jp = (x: number, y: number, sh = 0): LM => {
    const hx = 0.4, hy = 2.2, dx = x - hx, dy = y - hy, cj = Math.cos(ja), sj = Math.sin(ja);
    return hp(hx + dx * cj - dy * sj, hy + dx * sj + dy * cj, sh);
  };
  const ear = (near: boolean) => {
    const b = hp(near ? -1 : 0.4, near ? -2.6 : -3.1);
    const R = new Relief(sk, b[0] - 16 * k, b[1] - 16 * k, b[0] + 16 * k, b[1] + 16 * k);
    const a = ha + fy * (-1.62 + P.ear * 0.4 - (near ? 0 : 0.36));
    const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
    const L = 9.4 * k, Wd = 2.9 * k;
    const q = (t: number, w: number, sh = 0): LM => [b[0] + ca * t * L + nx * w * Wd * fy, b[1] + sa * t * L + ny * w * Wd * fy, sh];
    // a long ear, broad at the base, the front edge straight, the back edge bellied, the tip rounded
    const ol: LM[] = [q(-0.1, -0.75), q(0.4, -0.85), q(0.8, -0.55), q(1, -0.12, 0.25), q(0.95, 0.35), q(0.7, 0.8), q(0.32, 1.12), q(-0.05, 0.9)];
    const zE = z + (near ? 6 : -5) * k;
    R.region(spline(ol, 0.5), { z: zE, R: 1.1 * k, H: 1.6 * k, id: ID.EAR, tex: (p, o) => {
      const dx = p.x - b[0], dy = p.y - b[1], t = (dx * ca + dy * sa) / L, w = ((dx * nx + dy * ny) / Wd) * fy;
      o.m = M.skinD;
      if (near && t > 0.12 && t < 0.86 && w > -0.25 && w < 0.7 * Math.sin(Math.PI * Math.min(1, t))) {
        o.m = M.skin;
        // the transverse ridges of the inner ear, pinker in the hollows
        if (fr(t * 6.5) < 0.34) { o.z += 0.6; } else { o.z -= 0.4; o.m = M.inner; }
      }
      if (p.s < 0.7) o.t += 0.04;
    } });
    if (near) {
      // the tragus: a small pointed lobe standing in front of the ear opening
      const tg: LM[] = [q(0.02, -0.35), q(0.3, -0.25, 0.6), q(0.08, 0.1)];
      R.region(spline(tg, 0.4), { z: zE + 2.2 * k, R: 0.6, H: 0.8, id: ID.INNER, tex: M.skin });
    }
    sk.np();
    R.emit({ bias: near ? 0 : -0.16, drop: 1.4, seam: 0.4, seamDark: 0.25, contrast: 1.1 });
  };
  ear(false);
  const R = new Relief(sk, o0[0] - 10 * k, o0[1] - 10 * k, o0[0] + 12 * k, o0[1] + 10 * k);
  const faceTex = (p: Sp, o: Tx) => {
    const dx = (p.x - o0[0]) / k, dy = (p.y - o0[1]) / k;
    const hx = dx * c + dy * s, hy = (-dx * s + dy * c) * fy;
    if (hx > 2.9) {
      // the bare, wrinkled snout
      o.m = M.skin;
      if (fr(hx * 1.3 + hy * 0.2) < 0.22) o.z -= 0.6;
      return;
    }
    o.z += strands(p.x, p.y, ha + Math.PI, 1.6, 1, 61) * 0.5;
    o.m = hy > 1.6 ? M.chest : M.fur;
    if (hy < -1.6 && hx > 0.5) o.m = M.furR;
  };
  const head: LM[] = [hp(-3.6, -0.6), hp(-2, -3.6), hp(1, -4), hp(2.8, -3), hp(4.2, -1.6), hp(5.4, -0.8), hp(6, 0.6, 0.35), hp(5.7, 2.1, 0.2), hp(4.4, 2.6), jp(4.4, 3.2), jp(4, 3.9), jp(2, 4.7), jp(-0.2, 4.4), hp(-2.2, 3.8), hp(-3.8, 1.6)];
  R.region(fringe(spline(head, 0.5), 1.1, 3, (x, y, nx, ny) => {
    const hx = ((x - o0[0]) * c + (y - o0[1]) * s) / k;
    return hx < 2.6 && (ny > 0.2 || nx < -0.4) ? [0.9 * k, -0.4] : null;
  }), { z, R: 2.4 * k, H: 3.4 * k, id: ID.HEAD, blend: 0.8, tex: faceTex });
  if (P.jaw > 0.15) {
    const a = hp(2.2, 2.2), b = hp(6.2, 2.2), cc = jp(5, 3.1), d = jp(2.4, 3.4);
    R.region(spline([[a[0], a[1], 0], [b[0], b[1], 0.3], [cc[0], cc[1], 0.3], [d[0], d[1], 0]], 0.4), { z: z + 2.2 * k, R: 0.6, H: 0.4, id: ID.MOUTH, tex: M.mouth });
  }
  // the noseleaf: a lancet on a horseshoe of skin round the nostrils
  {
    const leaf: LM[] = [hp(4.3, -1.2), hp(4.5, -2.8), hp(5, -4.4, 0.7), hp(5.6, -2.8), hp(5.9, -1), hp(5.3, -0.4)];
    R.region(spline(leaf, 0.4), { z: z + 3.2 * k, R: 0.7 * k, H: 1 * k, id: ID.LEAF, tex: (p, o) => {
      const dx = (p.x - o0[0]) / k, dy = (p.y - o0[1]) / k;
      const hx = dx * c + dy * s;
      o.m = Math.abs(hx - 5.05) < 0.35 ? M.inner : M.skin;
    } });
    R.line([hp(4.4, 0.4) as unknown as V2, hp(5, 1.1) as unknown as V2, hp(5.8, 1.2) as unknown as V2].map(q => [q[0], q[1]] as V2), 0.7 * k, -0.6 * k);
  }
  // the brow and cheek
  { const b2 = hp(2.4, -2.2), cb = hp(1, 2); R.bump(b2[0], b2[1], 1.8 * k, 1.2 * k, 0.6 * k); R.bump(cb[0], cb[1], 2 * k, 1.6 * k, 0.6 * k); }
  // fangs: the upper canines always show; the lower ones when the jaw drops
  const fang = (a: LM, dirY: number, len: number) => {
    const t: LM[] = [[a[0] - 0.5 * k, a[1], 0], [a[0] + 0.5 * k, a[1], 0], [a[0] + 0.15 * k - s * len * 0.2, a[1] + dirY * len, 0.8]];
    R.region(spline(t, 0.3), { z: z + 4 * k, R: 0.4, H: 0.6, id: ID.TOOTH, tex: M.tooth });
  };
  fang(hp(4.6, 2.1), fy, 2 * k);
  fang(hp(3.4, 2.4), fy, 1.2 * k);
  if (P.jaw > 0.3) fang(jp(4.6, 3), -fy, 1.6 * k);
  sk.np();
  R.emit({ drop: 1.4, seam: 0.5, seamDark: 0.3, ao: 0.06, aoR: 1 });
  ear(true);
  const ec = hp(2.7, -0.9);
  const ep = drawEye(sk, ec[0], ec[1], { ...EYE, r: k < 0.8 ? 1 : 1.2 }, P.eye);
  const ns = hp(5.4, 0.6);
  sk.over(ns[0], ns[1], hex('#1a0e0e'));
  return { ep, top: hp(0, -6) };
}

interface GP { hip: V2; sh: V2; head: V2; ha: number; jaw: number; ear: number; wn: V2; wf: V2; eN: V2; eF: V2; fN: V2; fF: V2; spread: number }

/** a folded wing-arm planted on the ground: humerus up to the raised elbow, the long forearm down to the wrist and thumb */
function wingArm(R: Relief, M: M, sh: V2, el: V2, wr: V2, k: number, z: number) {
  // the folded hand: digits and membrane bundled along the back of the forearm, the wingtip past the elbow
  {
    const [u, n2] = frame(wr, el);
    const tip = pt(el, u, n2, 3.2 * k, 1.6 * k);
    const ol: LM[] = [pt(wr, u, n2, 0.5 * k, -0.8 * k), pt(wr, u, n2, 4 * k, 2.4 * k), pt(el, u, n2, -2 * k, 2.6 * k), [tip[0], tip[1], 0.7], pt(el, u, n2, 0.4 * k, -0.4 * k), pt(wr, u, n2, 2 * k, -1.2 * k)];
    R.region(spline(ol, 0.5), { z: z - 1.5 * k, R: 1 * k, H: 1.4 * k, id: ID.BUNDLE, tex: (p, o) => {
      // the folded digits as ridges along it, the membrane pleated between them
      const a2 = (p.x - wr[0]) * n2[0] + (p.y - wr[1]) * n2[1];
      const r = fr(a2 / (1.5 * k) + 0.3);
      o.m = r < 0.16 ? M.bone : M.mem;
      if (r < 0.16) o.z += 0.4;
    } });
    // the claw at the wingtip
    const ct: LM[] = [[tip[0], tip[1], 0], [tip[0] + u[0] * 1.6 * k - n2[0] * 0.6 * k, tip[1] + u[1] * 1.6 * k - n2[1] * 0.6 * k, 0.8], [tip[0] - n2[0] * 0.5 * k, tip[1] - n2[1] * 0.5 * k, 0]];
    R.region(spline(ct, 0.3), { z: z - 0.8 * k, R: 0.4, H: 0.5, id: ID.CLAW, tex: M.claw });
  }
  // humerus (furred near the shoulder) and the long, bare forearm
  {
    const ol: LM[] = [
      along(sh, el, 0, 2.8 * k), along(sh, el, 0.6, 1.9 * k), along(sh, el, 0.95, 1.6 * k), along(sh, el, 1.14, 0, 0.5),
      along(el, wr, 0.06, 1.5 * k), along(el, wr, 0.5, 1.1 * k), along(el, wr, 0.92, 1.1 * k), along(el, wr, 1.08, 0.6 * k, 0.3),
      along(el, wr, 1.06, -1.4 * k, 0.3), along(el, wr, 0.9, -1 * k), along(el, wr, 0.5, -0.9 * k), along(el, wr, 0.1, -1.1 * k),
      along(sh, el, 0.9, -1.4 * k), along(sh, el, 0.55, -2.2 * k), along(sh, el, 0.05, -3.2 * k),
    ];
    R.region(spline(ol, 0.5), { z, R: 1.2 * k, H: 2 * k, id: ID.ARM, tex: (p, o) => {
      const t = ((p.x - sh[0]) * (el[0] - sh[0]) + (p.y - sh[1]) * (el[1] - sh[1])) / ((el[0] - sh[0]) ** 2 + (el[1] - sh[1]) ** 2 || 1);
      const dEl = Math.hypot(p.x - el[0], p.y - el[1]);
      if (t < 0.55 && dEl > 4 * k) { o.z += strands(p.x, p.y, Math.atan2(el[1] - sh[1], el[0] - sh[0]) + Math.PI, 1.8, 1, 71) * 0.5; o.m = M.fur; return; }
      o.m = M.skin;
      if (fr(dEl * 0.9) < 0.2 && dEl < 7 * k) { o.z -= 0.4; o.m = M.skinD; } // wrinkled skin round the elbow
    } });
    const eb = along(sh, el, 1.02, 0); R.bump(eb[0], eb[1], 1.4 * k, 1.4 * k, 0.8 * k);
  }
  // the wrist pad and the thumb, its big hooked claw planted on the ground
  {
    const th0: V2 = [wr[0] + 0.4 * k, wr[1] - 0.6 * k];
    const thT: V2 = [wr[0] + 2.4 * k, Math.min(-0.4, wr[1] + 0.2 * k)];
    const ol: LM[] = [[th0[0] - 1 * k, th0[1] - 0.8 * k, 0], [thT[0] - 0.4 * k, thT[1] - 1 * k, 0], [thT[0], thT[1] - 0.4 * k, 0.3], [th0[0] + 0.2 * k, th0[1] + 1 * k, 0]];
    R.region(spline(ol, 0.4), { z: z + 0.8 * k, R: 0.7, H: 1, id: ID.THUMB, tex: M.skin });
    const cl: LM[] = [[thT[0] - 0.4 * k, thT[1] - 1.1 * k, 0], [thT[0] + 1.6 * k, thT[1] - 0.5 * k, 0], [thT[0] + 1.9 * k, Math.min(-0.2, thT[1] + 0.9 * k), 0.85], [thT[0] + 0.1 * k, thT[1] + 0.1 * k, 0]];
    R.region(spline(cl, 0.3), { z: z + 1.4 * k, R: 0.5, H: 0.7, id: ID.CLAW, tex: (p, o) => { o.m = M.claw; if (p.u > 0.6) o.t -= 0.08; } });
  }
}

/** a hind leg: the thigh, the knee bent back, the slender shin, the foot with five hooked claws */
function hindLeg(R: Relief, M: M, hip: V2, foot: V2, k: number, z: number) {
  const fa = -Math.PI / 2 - 0.9;
  const ank: V2 = [foot[0] + Math.cos(fa) * 2.4 * k, foot[1] + Math.sin(fa) * 2.4 * k];
  const [kn] = ik2(hip, ank, 7.5 * k, 8 * k, 1);
  const ol: LM[] = [
    along(hip, kn, 0, -3.2 * k), along(hip, kn, 0.6, -2.2 * k), along(hip, kn, 1.1, -0.4 * k, 0.4),
    along(kn, ank, 0.1, -1.2 * k), along(kn, ank, 0.6, -0.8 * k), along(kn, ank, 0.98, -0.9 * k),
    along(kn, ank, 1.02, 0.9 * k), along(kn, ank, 0.5, 0.8 * k), along(kn, ank, 0.05, 1.2 * k),
    along(hip, kn, 0.85, 1.6 * k), along(hip, kn, 0.4, 2.6 * k), along(hip, kn, -0.1, 3 * k),
  ];
  R.region(spline(ol, 0.5), { z, R: 1.2 * k, H: 1.8 * k, id: ID.LEG, tex: (p, o) => {
    const t = ((p.x - hip[0]) * (kn[0] - hip[0]) + (p.y - hip[1]) * (kn[1] - hip[1])) / ((kn[0] - hip[0]) ** 2 + (kn[1] - hip[1]) ** 2 || 1);
    if (t < 0.8) { o.z += strands(p.x, p.y, 1.9, 1.8, 1, 81) * 0.5; o.m = M.fur; } else o.m = M.skinD;
  } });
  // the foot and its claws
  const fo: LM[] = [[ank[0] - 0.8 * k, ank[1] - 0.4 * k, 0], [foot[0] + 1.4 * k, foot[1] - 1.2 * k, 0], [foot[0] + 1.6 * k, foot[1], 0.3], [ank[0] - 0.6 * k, ank[1] + 1 * k, 0]];
  R.region(spline(fo, 0.4), { z: z + 0.6 * k, R: 0.7, H: 1, id: ID.FOOT, tex: M.skinD });
  for (let i = 0; i < 3; i++) {
    const b: V2 = [foot[0] + (0.6 + i * 0.5) * k, foot[1] - (1.2 - i * 0.4) * k];
    const cl: LM[] = [[b[0], b[1] - 0.4 * k, 0], [b[0] + 1.4 * k, b[1] - 0.1 * k, 0], [b[0] + 1.8 * k, Math.min(-0.2, b[1] + 0.9 * k), 0.85], [b[0] + 0.2 * k, b[1] + 0.4 * k, 0]];
    R.region(spline(cl, 0.3), { z: z + 1 * k + i * 0.2, R: 0.4, H: 0.5, id: ID.CLAW, tex: M.claw });
  }
  return { kn, ank };
}

/** Grounded pose: torso from hip to shoulder, wing-arms planted, hind legs behind. */
function drawGround(sk: Sk, M: M, G: GP, k: number, eye: BeastEye) {
  sk.clipY = 0;
  const S = (v: V2): V2 => [v[0] * k, v[1] * k];
  const hip = S(G.hip), sh = S(G.sh);
  // ---- far side: wing-arm, hind leg (and the half-raised far wing when screeching)
  {
    const R = Relief.full(sk);
    if (G.spread > 0) spreadFolded(R, M, [sh[0] - 0.5 * k, sh[1]], G.spread, k, -1, -8);
    wingArm(R, M, [sh[0] - 1 * k, sh[1] - 0.5 * k], S(G.eF), S(G.wf), k, -6);
    hindLeg(R, M, [hip[0] - 1 * k, hip[1]], S(G.fF), k, -5);
    sk.np();
    R.emit({ bias: -0.16, drop: 1.4, seam: 0.5, seamDark: 0.3 });
  }
  const R = Relief.full(sk);
  if (G.spread > 0) spreadFolded(R, M, [sh[0] + 0.5 * k, sh[1]], G.spread, k, 1, 8);
  // ---- the tail membrane between the legs
  {
    const tt: V2 = [hip[0] - 4 * k, hip[1] + 3.5 * k];
    const fl: V2 = S(G.fN);
    const ol: LM[] = [[hip[0] + 1 * k, hip[1] - 1 * k, 0], [tt[0] - 1.6 * k, tt[1] - 1 * k, 0.6], [(tt[0] + fl[0]) / 2 - 1 * k, (tt[1] + fl[1]) / 2 - 0.5 * k, 0], [fl[0] - 1 * k, fl[1] - 3 * k, 0.3], [hip[0] + 1.6 * k, hip[1] + 4 * k, 0]];
    R.region(spline(ol, 0.5), { z: -1, R: 0.8, H: 0.8, id: ID.TAILM, tex: (p, o) => { o.m = M.mem; if (fr((p.x + p.y) * 0.5) < 0.18) o.z -= 0.3; } });
  }
  // ---- the torso: a hunched, furry body from the rump to the shoulders
  const [u, n2] = frame(hip, sh);
  const T = (x: number, y: number, s2 = 0) => pt(hip, u, n2, x * k, y * k, s2);
  const L0 = Math.hypot(sh[0] - hip[0], sh[1] - hip[1]) / k;
  const torso: LM[] = [T(-3.4, 0.4), T(-2.2, -3.8), T(2, -5.4), T(L0 * 0.6, -5.6), T(L0 + 0.5, -4.6), T(L0 + 2.6, -1.4), T(L0 + 2.2, 2.6), T(L0 - 1, 4.8), T(L0 * 0.45, 5.4), T(0.5, 4.4), T(-2.4, 2.8)];
  const bodyAng = Math.atan2(hip[1] - sh[1], hip[0] - sh[0]);
  const tor = fringe(spline(torso, 0.6), 1.3, 5, (_x, _y, nx, ny) => [1.2 * k + 0.2, nx * u[0] + ny * u[1] > 0 ? -0.5 : 0.5]);
  const bodyFur = furTex(M, bodyAng, M.fur, 51, 0.8, 2.6);
  R.region(tor, { z: 0, R: 4.4 * k, H: 5 * k, id: ID.BODY, tex: (p, o) => {
    bodyFur(p, o);
    const v = (p.x - hip[0]) * n2[0] + (p.y - hip[1]) * n2[1];
    if (v > 2.4 * k) o.m = M.chest;
    else if (v < -3.4 * k) o.m = FS.tip > 0.7 ? M.furR : M.furD;
  } });
  { const sc = T(L0 * 0.75, -2.2), rp = T(-0.5, -1.4); R.bump(sc[0], sc[1], 3 * k, 2.2 * k, 1 * k); R.bump(rp[0], rp[1], 3 * k, 3 * k, 1 * k); }
  // ---- the ruff: a shaggy pale mane round the neck and over the shoulders
  {
    const hd = S(G.head);
    const ru: LM[] = [T(L0 * 0.4, -5.8), T(L0 + 0.5, -6.8), [hd[0] - 2.6 * k, hd[1] - 2.8 * k, 0], [hd[0] - 1.2 * k, hd[1] + 3 * k, 0], T(L0 + 3.2, 3.4), T(L0 + 0.6, 6), T(L0 - 2.6, 4.4), T(L0 * 0.45, 0)];
    const rf = fringe(spline(ru, 0.5), 1.4, 9, (_x, _y, nx, ny) => [1.9 * k + 0.3, nx * u[0] + ny * u[1] > 0 ? -0.6 : 0.6]);
    const mf = furTex(M, bodyAng + 0.3, M.mane, 53, 1, 2.8);
    R.region(rf, { z: 2 * k, R: 2.6 * k, H: 4.4 * k, id: ID.MANE, blend: 1.2, tex: (p, o) => { mf(p, o); if (o.m === M.mane && FS.tip < 0.3) o.m = M.maneD; } });
  }
  // ---- near hind leg and near wing-arm
  hindLeg(R, M, hip, S(G.fN), k, 4);
  wingArm(R, M, sh, S(G.eN), S(G.wn), k, 8);
  // the membrane draping from the arm to the flank, sagging and wrinkled
  {
    const el = S(G.eN), wr = S(G.wn), fl = S(G.fN);
    void fl;
    const [u2, n3] = frame(wr, el);
    const m0 = pt(wr, u2, n3, 5 * k, 3.2 * k), m1 = pt(el, u2, n3, -6 * k, 4.6 * k);
    const ol: LM[] = [pt(wr, u2, n3, 2.5 * k, 0.6 * k), m0, [(m1[0] + hip[0]) / 2 + 2 * k, (m1[1] + hip[1]) / 2 + 1 * k, 0], [sh[0] - 1.5 * k, sh[1] + 2.5 * k, 0], m1, pt(el, u2, n3, -2 * k, 1 * k)];
    R.region(spline(ol, 0.5), { z: 6, R: 1, H: 1, id: ID.MEM, tex: (p, o) => {
      o.m = M.mem;
      // a few long sag folds hanging from the arm
      if (fr((p.x - el[0]) * 0.22 + (p.y - el[1]) * 0.05) < 0.12) o.z -= 0.5;
    } });
  }
  R.shadow(ID.MANE, 0.8 * k, 1.2 * k, 0.1, ID.BODY, 1);
  R.shadow(ID.ARM, 1 * k, 0.8 * k, 0.1, ID.BODY, 1);
  sk.np();
  R.emit({ drop: 1.5, seam: 0.5, seamDark: 0.3, ao: 0.06, aoR: 2 });
  const { ep, top } = drawHead(sk, M, S(G.head), G.ha, { jaw: G.jaw, ear: G.ear, eye, k: k * 1.2 }, 12);
  return { head: [top[0], top[1] - 2 * k] as V2, eye: ep };
}

/** wings half-raised behind the arms (the screech threat display), as fans of membrane on long fingers */
function spreadFolded(R: Relief, M: M, base: V2, up: number, k: number, side: number, z: number) {
  const tips: V2[] = [[-14 * up, -21 * up + side * 2], [-22 * up, -12 * up], [-21 * up, -2 * up], [-15 * up, 6]];
  const T = tips.map(t => [base[0] + t[0] * k, base[1] + t[1] * k] as V2);
  const ol: LM[] = [[base[0], base[1], 0]];
  for (let i = 0; i < T.length; i++) {
    ol.push([T[i][0], T[i][1], 0.8]);
    if (i < T.length - 1) {
      const m: V2 = [(T[i][0] + T[i + 1][0]) / 2, (T[i][1] + T[i + 1][1]) / 2];
      ol.push([m[0] + (base[0] - m[0]) * 0.22, m[1] + (base[1] - m[1]) * 0.22, 0]);
    }
  }
  R.region(spline(ol, 0.6), { z, R: 1, H: 1, id: ID.MEM, tex: (p, o) => {
    o.m = side < 0 ? M.mem : M.memL;
    const a = Math.atan2(p.y - base[1], p.x - base[0]);
    if (fr(a * 9) < 0.08) o.m = M.vein;
  } });
  for (const t of T) R.line([base, [base[0] + (t[0] - base[0]) * 0.96, base[1] + (t[1] - base[1]) * 0.96]], 0.9 * k, 1 * k);
}

/** a tapered bone between two points (a long thin contour with knuckle swellings at both ends) */
function boneSeg(R: Relief, M: M, a: V2, b: V2, r0: number, r1: number, z: number, id = ID.BONE) {
  const [u, n2, l] = frame(a, b);
  if (l < 0.5) return;
  const ol: LM[] = [pt(a, u, n2, -r0 * 0.8, 0), pt(a, u, n2, 0, -r0), pt(a, u, n2, l * 0.5, -(r0 + r1) * 0.38), pt(a, u, n2, l, -r1), pt(a, u, n2, l + r1 * 0.8, 0), pt(a, u, n2, l, r1), pt(a, u, n2, l * 0.5, (r0 + r1) * 0.38), pt(a, u, n2, 0, r0)];
  R.region(spline(ol, 0.4), { z, R: Math.max(0.5, r1), H: Math.max(0.6, r0 * 0.8), id, tex: M.bone });
}

/** Membrane wing in 3D, projected: arm + four fingers from the wrist, the membrane scalloped between them. */
function wing(sk: Sk, M: M, side: 1 | -1, th: number, fold: number, sweep: number, k: number, back: V3, bias: number, oy: number) {
  const shoulder: V3 = [3 * k, 1 * k + oy, side * 3 * k];
  const up = (s: number, c: number, handLag: number): V3 => {
    const e = th + (s > 24 ? handLag : 0);
    const sArm = Math.min(s, 24), sHand = Math.max(0, s - 24) * (1 - fold * 0.55);
    const sa = Math.sin(th), ca = Math.cos(th), se = Math.sin(e), ce = Math.cos(e);
    const x = shoulder[0] + sArm * Math.sin(sweep) + sHand * Math.sin(sweep + fold * 0.7) - c * (1 - fold * 0.3);
    const y = shoulder[1] + sArm * sa + sHand * se;
    const z = shoulder[2] + side * (sArm * ca + sHand * ce);
    return [x, y, z];
  };
  const lag = -0.35 * Math.sin(th * 1.2) - fold * 0.6;
  const K = (s: number, c: number) => up(s * k, c * k, lag);
  const elbow = K(11, -1), wrist = K(24, 1.5);
  const f2 = K(40, -0.5), f3 = K(47, 3), f4 = K(38, 17), f5 = K(27, 19.5);
  const ankle: V3 = [back[0], back[1] + oy, back[2] * side];
  const P2 = (q: V3): V2 => { const r = proj(q); return [r[0], r[1]]; };
  const Z = (q: V3) => proj(q)[2];
  const sh2 = P2(shoulder), el2 = P2(elbow), wr2 = P2(wrist), t2 = P2(f2), t3 = P2(f3), t4 = P2(f4), t5 = P2(f5), an2 = P2(ankle);
  // the membrane plane's facing, for its light
  const v3 = (a: V3, b: V3): V3 => [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const pa = proj(shoulder), pb = proj(wrist), pc = proj(f5);
  const e1 = v3(pa, pb), e2 = v3(pa, pc);
  let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
  const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
  if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
  const lt = (lumN(nx, ny, nz) - 0.6) * 0.8;
  const zW = (Z(wrist) + Z(shoulder)) / 2;
  const R = new Relief(sk, Math.min(sh2[0], el2[0], wr2[0], t2[0], t3[0], t4[0], t5[0], an2[0]) - 3, Math.min(sh2[1], el2[1], wr2[1], t2[1], t3[1], t4[1], t5[1], an2[1]) - 3,
    Math.max(sh2[0], el2[0], wr2[0], t2[0], t3[0], t4[0], t5[0], an2[0]) + 3, Math.max(sh2[1], el2[1], wr2[1], t2[1], t3[1], t4[1], t5[1], an2[1]) + 3);
  const scal = (a: V2, b: V2, d: number): LM => { const m: V2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; return [m[0] + (wr2[0] - m[0]) * d, m[1] + (wr2[1] - m[1]) * d, 0]; };
  const scalB = (a: V2, b: V2, d: number): LM => { const m: V2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; const c2: V2 = [(sh2[0] + wr2[0]) / 2, (sh2[1] + wr2[1]) / 2]; return [m[0] + (c2[0] - m[0]) * d, m[1] + (c2[1] - m[1]) * d, 0]; };
  const ol: LM[] = [[sh2[0], sh2[1], 0], [el2[0], el2[1], 0.3], [wr2[0], wr2[1], 0.4], [t2[0], t2[1], 0.9], scal(t2, t3, 0.18), [t3[0], t3[1], 0.9], scal(t3, t4, 0.26), [t4[0], t4[1], 0.9], scal(t4, t5, 0.24), [t5[0], t5[1], 0.9], scalB(t5, an2, 0.2), [an2[0], an2[1], 0.6]];
  const under = ny < -0.2 ? 0 : 1;
  R.region(spline(ol, 0.7), { z: zW - 1, R: 1.2 * k, H: 1, id: ID.MEM, lt: lt + bias, tex: (p, o) => {
    o.m = under ? M.memL : M.mem;
    // veins branching out from the arm and fingers, and the elastic fibres' fine pleats
    const a = Math.atan2(p.y - wr2[1], p.x - wr2[0]);
    if (fr(a * 5.2 + Math.hypot(p.x - wr2[0], p.y - wr2[1]) * 0.05) < 0.07) o.m = M.vein;
    if (fr((p.x * 0.6 + p.y * 0.35) * 0.5) < 0.15) o.z -= 0.3;
    // thin and lit through near the trailing edge
    if (p.s < 1.6 * k && !under) o.m = M.memL;
  } });
  // the bones over the membrane
  const zb = zW + 1;
  boneSeg(R, M, sh2, el2, 1.7 * k, 1.2 * k, zb);
  boneSeg(R, M, el2, wr2, 1.2 * k, 0.9 * k, zb);
  for (const t of [t2, t3, t4, t5]) boneSeg(R, M, wr2, t, 0.7 * k, 0.4 * k, zb);
  // the thumb claw at the wrist
  const tc: LM[] = [[wr2[0] - 0.4 * k, wr2[1] - 0.4 * k, 0], [wr2[0] + 2.2 * k, wr2[1] - 1.4 * k, 0.8], [wr2[0] + 0.6 * k, wr2[1] + 0.6 * k, 0]];
  R.region(spline(tc, 0.3), { z: zb + 1, R: 0.4, H: 0.6, id: ID.CLAW, tex: M.claw });
  sk.np();
  R.emit({ bias, drop: 1.2, seam: 0.5, seamDark: 0.3 });
}

function drawFly(sk: Sk, M: M, f: number, k: number, eye: BeastEye) {
  const t = f / 6;
  const th = Math.sin(t * TAU) * 0.78 + 0.08;
  const fold = Math.max(0, Math.cos(t * TAU + 0.4)) * 0.7;
  const sweep = -0.1 + Math.sin(t * TAU) * 0.08;
  const bob = -Math.sin(t * TAU) * 1.5 * k;
  wing(sk, M, -1, th, fold, sweep, k, [-8 * k, 0, 2 * k], -0.16, -bob);
  // the body: furry, level, the legs trailing with the tail membrane between them
  const R = new Relief(sk, -30 * k, -20 * k, 20 * k, 20 * k);
  {
    const hipP: V2 = [-6 * k, 1.2 * k + bob];
    const tm: LM[] = [[hipP[0], hipP[1] - 1.5 * k, 0], [-14.5 * k, 2.8 * k + bob, 0.7], [-12 * k, 5.2 * k + bob, 0], [-10.5 * k, 6.4 * k + bob, 0.7], [-6 * k, 4.4 * k + bob, 0]];
    R.region(spline(tm, 0.5), { z: -1, R: 0.8, H: 0.8, id: ID.TAILM, tex: (p, o) => { o.m = M.memL; if (fr(p.x * 0.6) < 0.15) o.m = M.vein; } });
    for (const dz of [-1, 1]) {
      const ft: V2 = [-12.5 * k, (4 + dz * 1.4) * k + bob];
      R.region(spline([[hipP[0], hipP[1] - 0.8 * k, 0], [ft[0], ft[1] - 0.6 * k, 0.3], [ft[0] - 1.2 * k, ft[1] + 0.2 * k, 0.8], [ft[0], ft[1] + 0.8 * k, 0.3], [hipP[0], hipP[1] + 1.4 * k, 0]], 0.4), { z: dz, R: 0.8, H: 1.2, id: ID.LEG, tex: M.skinD });
    }
    const body: LM[] = [[-8.6 * k, 0.6 * k + bob, 0], [-6 * k, -3.2 * k + bob, 0], [0, -4.6 * k + bob, 0], [5 * k, -4 * k + bob, 0], [7.4 * k, -1 * k + bob, 0], [6 * k, 3.4 * k + bob, 0], [0, 4.6 * k + bob, 0], [-6 * k, 4 * k + bob, 0]];
    const bf = furTex(M, Math.PI, M.fur, 57, 0.8, 2.6);
    R.region(fringe(spline(body, 0.5), 1.3, 7, (_x, _y, nx) => [1.2 * k + 0.2, nx > 0 ? 0.3 : -0.3]), { z: 0, R: 3.4 * k, H: 4 * k, id: ID.BODY, tex: (p, o) => { bf(p, o); if (p.y > bob + 1.6 * k) o.m = M.chest; } });
    const ru: LM[] = [[2 * k, -5 * k + bob, 0], [7 * k, -4.6 * k + bob, 0], [8.6 * k, 0, 0], [7 * k, 4 * k + bob, 0], [3 * k, 3.6 * k + bob, 0]];
    const mf = furTex(M, Math.PI - 0.3, M.mane, 59, 1, 2.6);
    R.region(fringe(spline(ru, 0.5), 1.4, 9, () => [1.6 * k + 0.2, 0.5]), { z: 2, R: 2 * k, H: 3.4 * k, id: ID.MANE, blend: 1, tex: mf });
  }
  sk.np();
  R.emit({ drop: 1.4, seam: 0.5, seamDark: 0.3 });
  const { ep, top } = drawHead(sk, M, [8.6 * k, -1.2 * k + bob], 0.12, { jaw: 0.35, ear: -1, eye, k: k * 1.15 }, 6);
  wing(sk, M, 1, th, fold, sweep, k, [-8 * k, 0, 2 * k], 0, -bob);
  return { head: [top[0], top[1] - 2 * k] as V2, eye: ep };
}

/** a cloak of folded wings wrapped round the body: the forearms as bony ridges, pleats, the thumbs peeking out */
function cloak(R: Relief, M: M, top: V2, bot: V2, wid: number, k: number, br: number, thumbsAt: number) {
  const [u, n2, L] = frame(top, bot);
  const C = (t: number, w: number, s2 = 0) => pt(top, u, n2, t * L, w * (wid + br), s2);
  const ol: LM[] = [C(0.02, -0.25), C(0.2, -0.85), C(0.5, -1.02), C(0.8, -0.86), C(1, -0.3, 0.2), C(1.02, 0.25, 0.2), C(0.82, 0.92), C(0.5, 1.04), C(0.2, 0.86), C(0.02, 0.28)];
  R.region(spline(ol, 0.6), { z: 0, R: 2.6 * k, H: 4.6 * k, id: ID.MEM, tex: (p, o) => {
    const a2 = (p.x - top[0]) * n2[0] + (p.y - top[1]) * n2[1];
    const t = ((p.x - top[0]) * u[0] + (p.y - top[1]) * u[1]) / L;
    // pleats of the folded membrane running down the cloak, veins between them
    const r = fr(a2 / (1.7 * k) + t * 0.6);
    o.m = M.mem;
    if (r < 0.2) { o.z -= 0.6; o.m = M.vein; } else if (r < 0.45) o.z += 0.3;
    if (Math.abs(a2) > (wid + br) * 0.75) o.m = M.memL;
  } });
  // the forearms: bony ridges down the front where the wings cross
  for (const s of [-1, 1]) {
    const a = C(0.12, s * 0.42), b = C(thumbsAt, s * 0.32), m = C((0.12 + thumbsAt) / 2, s * 0.55);
    R.line([[a[0], a[1]], [m[0], m[1]], [b[0], b[1]]], 1.2 * k, 1 * k);
    const tb: V2 = [b[0], b[1]];
    const cl: LM[] = [[tb[0] - 0.6 * k, tb[1], 0], [tb[0] + s * 1.6 * k + u[0] * 0.8 * k, tb[1] + u[1] * 2 * k, 0.85], [tb[0] + 0.6 * k, tb[1] + 0.3 * k, 0]];
    R.region(spline(cl, 0.3), { z: 6 * k, R: 0.4, H: 0.6, id: ID.CLAW, tex: M.claw });
  }
}

/** Roosting upside down: feet grip at the top (anchor), wings wrapped round like a cloak, head at the bottom. */
function drawHang(sk: Sk, M: M, f: number, k: number, eye: BeastEye) {
  const br = f * 0.4 * k;
  const R = Relief.full(sk);
  // feet gripping the perch at (0, 0), claws hooked over it
  for (const dx of [-1.6, 1.6]) {
    const ol: LM[] = [[dx * k - 0.9 * k, 0.6 * k, 0], [dx * k + 0.9 * k, 0.6 * k, 0], [dx * k * 0.8 + 0.8 * k, 6 * k, 0], [dx * k * 0.8 - 0.8 * k, 6 * k, 0]];
    R.region(spline(ol, 0.4), { z: dx > 0 ? 2 : -2, R: 0.7, H: 1, id: ID.LEG, tex: M.skinD });
    const cl: LM[] = [[dx * k - 0.6 * k, 1.2 * k, 0], [dx * k + 1.4 * k, -0.6 * k, 0.85], [dx * k + 0.6 * k, 1.4 * k, 0]];
    R.region(spline(cl, 0.3), { z: 3, R: 0.4, H: 0.5, id: ID.CLAW, tex: M.claw });
  }
  cloak(R, M, [0, 4 * k], [0.6 * k, 27 * k], 7.4 * k, k, br, 0.86);
  sk.np();
  R.emit({ drop: 1.6, seam: 0.5, seamDark: 0.3, ao: 0.05, aoR: 2 });
  // the head hangs at the bottom, the face turned out, the ears pointing down
  const { ep } = drawHead(sk, M, [1.4 * k, 28.6 * k], 0.35, { jaw: 0.1, ear: f ? 0.3 : 0, eye, k, flip: true }, 12);
  return { head: [1.4 * k, 24.6 * k] as V2, eye: ep };
}

/** On the ground, wrapped in its wings, head tucked down on the chest. */
function drawSleep(sk: Sk, M: M, f: number, k: number, eye: BeastEye) {
  sk.clipY = 0;
  const R = Relief.full(sk);
  cloak(R, M, [-1 * k, -20 * k], [0.5 * k, -0.5 * k], 8 * k, k, f * 0.35 * k, 0.32);
  sk.np();
  R.emit({ drop: 1.6, seam: 0.5, seamDark: 0.3, ao: 0.05, aoR: 2 });
  const { ep, top } = drawHead(sk, M, [2.6 * k, -17 * k], 0.75, { jaw: 0, ear: -1, eye, k }, 10);
  return { head: [top[0], top[1] - 2 * k] as V2, eye: ep };
}

function groundPose(anim: string, f: number, n: number): GP {
  const t = f / n;
  const G: GP = {
    hip: [-6.5, -12], sh: [2, -20], head: [7, -24.5], ha: 0.12, jaw: 0.12, ear: 0,
    wn: [9, 0], wf: [7, 0], eN: [0.5, -35], eF: [-1.5, -34], fN: [-9.5, 0], fF: [-11, 0], spread: 0,
  };
  const off = (v: V2, d: V2): V2 => [v[0] + d[0], v[1] + d[1]];
  switch (anim) {
    case 'idle': {
      const b = Math.sin(t * TAU);
      G.sh = off(G.sh, [0, b * 0.4]); G.head = off(G.head, [0, b * 0.4]);
      G.ear = f === 2 ? 1 : 0; G.ha = f === 3 ? 0.2 : 0.1;
      break;
    }
    case 'walk': {
      // crutch walk: planted thumbs vault the body forward, hind feet follow
      const a = Math.sin(t * TAU), b = Math.cos(t * TAU);
      G.wn = [9 + a * 3.5, -Math.max(0, b) * 2.2];
      G.wf = [7.5 - a * 3.5, -Math.max(0, -b) * 2.2];
      G.fN = [-9.5 - a * 3, -Math.max(0, -b) * 1.8];
      G.fF = [-11 + a * 3, -Math.max(0, b) * 1.8];
      G.eN = [0.5 + a * 1.6, -35 + b * 1.4]; G.eF = [-1.5 - a * 1.6, -34 - b * 1.4];
      const bob = Math.abs(a) * 0.8;
      G.sh = off(G.sh, [a * 0.5, -bob]); G.hip = off(G.hip, [a * 0.3, -bob * 0.5]); G.head = off(G.head, [a * 0.6, -bob]);
      break;
    }
    case 'run': {
      // vampire-bat bound: thumbs push off together, the body arcs over, feet land
      const ph = t;
      const push = Math.sin(ph * TAU);
      const air = Math.max(0, Math.sin(ph * TAU + 0.9));
      G.wn = [10 - push * 5, -Math.max(0, -push) * 3];
      G.wf = [8.5 - push * 5, -Math.max(0, -push) * 3];
      G.fN = [-9 + push * 5, -Math.max(0, push) * 2.5];
      G.fF = [-10.5 + push * 5, -Math.max(0, push) * 2.5];
      G.sh = off(G.sh, [1.5, -air * 3.5 + 1.5]); G.hip = off(G.hip, [-0.5, -air * 2.5 + 1]); G.head = off(G.head, [2.5, -air * 3.5 + 2.5]);
      G.eN = [-1 - push * 2, -31 + air * 1.5]; G.eF = [-3 - push * 2, -30 + air * 1.5]; G.ear = -1; G.ha = 0.25;
      break;
    }
    case 'eat':
      G.head = [9.5, -19.5 + (f % 2) * 0.6]; G.ha = 0.8 + (f % 2) * 0.1; G.jaw = f === 1 ? 0.8 : 0.25;
      G.sh = off(G.sh, [0.5, 1.5]); G.eN = [1.5, -32]; G.eF = [-0.5, -31];
      break;
    case 'alert':
      G.sh = off(G.sh, [0, -2]); G.head = [7.5, -28 - f * 0.5]; G.ha = -0.12; G.ear = 1; G.eN = [0.5, -37]; G.eF = [-1.5, -36];
      break;
    case 'call':
      G.head = [8.2, -26]; G.ha = -0.25; G.jaw = f ? 1 : 0.5; G.ear = 0.5; G.sh = off(G.sh, [0, -1]);
      break;
    case 'groom':
      // licking the near wing-arm
      G.head = [5.5, -21.5]; G.ha = 1.9 + [0, 0.15, 0.05, 0.2][f]; G.jaw = f % 2 ? 0.4 : 0.1;
      G.wn = [8, 0]; G.eN = [2.5, -33 - (f % 2)];
      break;
    case 'screech':
      G.head = [8.4, -27]; G.ha = -0.45 - f * 0.08; G.jaw = 1; G.ear = -1; G.spread = 0.85 + f * 0.15;
      G.sh = off(G.sh, [-0.5, -1.5]); G.eN = [0, -37]; G.eF = [-2, -36];
      break;
    case 'grab': {
      if (f === 0) { G.sh = off(G.sh, [-2, 2]); G.head = [4.5, -21]; G.ha = 0.3; G.eN = [-3, -31]; G.eF = [-5, -30]; G.jaw = 0.2; G.ear = -1; }
      else if (f === 1) { G.sh = [7, -15]; G.hip = [-4, -11]; G.head = [13, -14]; G.ha = 0.55; G.jaw = 1; G.wn = [19, -2]; G.wf = [17, -3]; G.eN = [8, -27]; G.eF = [6, -26]; G.ear = -1; }
      else { G.sh = [7.5, -13]; G.hip = [-4, -10]; G.head = [13.5, -9]; G.ha = 0.95; G.jaw = 0.25; G.wn = [17, 0]; G.wf = [15.5, 0]; G.eN = [7, -25]; G.eF = [5, -24]; G.ear = -0.5; }
      break;
    }
  }
  // the elbows ride high behind the head, clear of the ears
  G.eN = [G.eN[0] - 4, G.eN[1] + 0.5]; G.eF = [G.eF[0] - 4, G.eF[1] + 0.5];
  return G;
}


function draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const k = juv ? 0.6 : 1;
  const M = mats(sk);
  if (anim === 'fly') return drawFly(sk, M, frame, k, eye);
  if (anim === 'hang') return drawHang(sk, M, frame, k, eye);
  if (anim === 'sleep') return drawSleep(sk, M, frame, k, eye);
  const G = groundPose(anim, frame, n);
  return drawGround(sk, M, G, k, eye);
}

export const HUNTERBAT: SpeciesDef = {
  name: 'Hunter Bat', kind: 'mammal', len: 28, height: 40,
  anims: ANIMS,
  canvas: (anim) => (anim === 'fly' ? { w: 120, h: 110, ox: 60, oy: 55 } : anim === 'hang' ? { w: 50, h: 50, ox: 24, oy: 4 } : { w: 80, h: 64, ox: 34, oy: 56 }),
  draw,
  eyeFor: (anim) => (anim === 'sleep' || anim === 'hang' ? 'closed' : anim === 'alert' ? 'alert' : anim === 'screech' || anim === 'grab' ? 'angry' : 'open'),
  anchor: { fly: 'centre', hang: 'grip' },
};

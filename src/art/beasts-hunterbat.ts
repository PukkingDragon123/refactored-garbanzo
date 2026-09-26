// Hunter Bat: a large bat that stalks the forest floor on its folded wings like a vampire bat —
// elbows raised high, thumbs planted — with huge ears, a wrinkled noseleaf face and fangs.
// Hunts frogs and insects at night; flies on membrane wings; roosts hanging upside down.

import { Sk, V2, V3, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, TAU, fr, poly3, proj, v3add, v3mul, lerp2, along, cbez, ik2 } from './beasts-core';
import { leg, LegSpec, scaleLeg, Frame2 } from './beasts-rig';
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
    fur: sk.m(rmp('#57392c', { n: 6, dark: 0.6 }), { edge: 1 }),
    chest: sk.m(rmp('#86634a', { n: 5, dark: 0.55 }), { edge: 1 }),
    mem: sk.m(rmp('#3c2424', { n: 6, dark: 0.55, light: 0.28 }), { edge: 1, k: 0.7, bias: -0.08 }),
    memL: sk.m(rmp('#553230', { n: 5, dark: 0.5, light: 0.3 }), { edge: 1, k: 0.7, bias: -0.08 }),
    bone: sk.m(rmp('#a07a68', { n: 5, dark: 0.5 })),
    skin: sk.m(rmp('#8c5c52', { n: 5, dark: 0.55 })),
    inner: sk.m(rmp('#a86c66', { n: 5, dark: 0.5 })),
    earS: sk.m(rmp('#6a4438', { n: 5, dark: 0.55 })),
    claw: sk.m(rmp('#e6dccc', { n: 3, dark: 0.4 })),
    tooth: sk.m(rmp('#f6f2e6', { n: 3, dark: 0.3 }), { edge: 0 }),
    mouth: sk.m(rmp('#6a1a24', { n: 3, dark: 0.45 }), { edge: 0 }),
  };
}
type M = ReturnType<typeof mats>;

interface HeadP { jaw: number; ear: number; eye: BeastEye; k: number }
/** Head in a frame whose +x points out of the face. */
function drawHead(sk: Sk, M: M, H: Frame2, P: HeadP, z: number) {
  const k = P.k;
  // far ear
  sk.np();
  const ea = -1.85 + P.ear * 0.4;
  earBig(sk, M, H.p(-0.4, -3), H.ang(ea - 0.3), 10.5 * k, 4.2 * k, z - 4, -0.15, false);
  sk.np();
  const skull = H.p(0.8, 0);
  sk.ell(skull[0], skull[1], 4.4 * k, 4 * k, (p) => (p.v > 0.45 ? M.chest : M.fur), { rot: H.a, rz: 3.8 * k, z });
  sk.tufts(sk.pid, (_x, _y, nx, ny) => (ny > 0 && nx < 0.5 ? [-0.5, 1] as V2 : null), { every: 2, len: 1 });
  // pug snout with wrinkled skin
  const sn = H.p(4.6, 0.9);
  sk.ell(sn[0], sn[1], 2.5 * k, 2.3 * k, (p) => {
    const w = (p.u + 1) * 2.2;
    if (w - Math.floor(w) < 0.25) p.l -= 0.14;
    return M.skin;
  }, { rot: H.a, rz: 2.2 * k, z: z + 2 });
  // noseleaf: a small upright spear on the nose
  const nl0 = H.p(5.6, -0.6), nl1 = H.p(6.2, -3.8);
  sk.blade(nl0[0], nl0[1], nl1[0], nl1[1], s => Math.sin(Math.min(1, s * 1.2) * Math.PI) * 1.2 * k + 0.2, (p) => (Math.abs(p.v) < 0.35 ? M.inner : M.skin), { z0: z + 5, z1: z + 5 });
  // jaw, gape with fangs
  const jA = H.ang(0.35 + P.jaw * 0.7);
  const j0 = H.p(2, 2.4);
  const j1: V2 = [j0[0] + Math.cos(jA) * 4.4 * k, j0[1] + Math.sin(jA) * 4.4 * k];
  if (P.jaw > 0.15) {
    const m0 = H.p(2.4, 2);
    const up = H.p(6.2, 2.2);
    sk.poly([m0[0], m0[1], up[0], up[1], j1[0], j1[1]], M.mouth, { z: z + 2.5 });
  }
  sk.np();
  sk.tube([j0, j1], t => (1.5 - t * 0.6) * k, M.skin, { z: z + 3 });
  // fangs: upper (always peeking) and lower
  const f0 = H.p(5.4, 2.4);
  sk.blade(f0[0], f0[1] - 0.4, f0[0] + 0.3 * k, f0[1] + 1.7 * k, s => (1 - s) * 0.7 * k + 0.25, M.tooth, { z0: z + 6, z1: z + 6 });
  if (P.jaw > 0.3) {
    const f1: V2 = [j1[0] - Math.cos(jA) * 0.8 * k, j1[1] - Math.sin(jA) * 0.8 * k];
    sk.blade(f1[0], f1[1], f1[0] + 0.3 * k, f1[1] - 1.5 * k, s => (1 - s) * 0.6 * k + 0.25, M.tooth, { z0: z + 6, z1: z + 6 });
  }
  // near ear with ridged pink inner
  sk.np();
  earBig(sk, M, H.p(-1.2, -2.4), H.ang(ea), 11.5 * k, 4.8 * k, z + 4, 0, true);
  const ec = H.p(2.6, -0.9);
  const ep = drawEye(sk, ec[0], ec[1], { ...EYE, r: k < 0.8 ? 1 : 1.2 }, P.eye);
  return { ep, top: H.p(0, -6) };
}

function earBig(sk: Sk, M: M, base: V2, a: number, len: number, wid: number, z: number, bias: number, inner: boolean) {
  const tip: V2 = [base[0] + Math.cos(a) * len, base[1] + Math.sin(a) * len];
  sk.blade(base[0], base[1], tip[0], tip[1], s => (s < 0.3 ? 0.6 + s * 2.6 : 1.4 - (s - 0.3) * 1.6) * wid * 0.72 + 0.3, (p) => {
    if (!inner) return M.earS;
    if (Math.abs(p.v) < 0.5 && p.t > 0.14 && p.t < 0.82) {
      const r = p.t * 7;
      if (r - Math.floor(r) < 0.25) p.l -= 0.12; // ridges
      return M.inner;
    }
    return M.earS;
  }, { z0: z, z1: z + 0.5, bias, bend: len * 0.08 });
}

/** A folded wing-arm planted on the ground: shoulder -> raised elbow -> wrist/thumb on the ground. */
function foldedArm(sk: Sk, M: M, sh: V2, elbow: V2, wrist: V2, k: number, z: number, bias: number) {
  // folded digits + membrane tucked behind the forearm, tips reaching back up past the elbow
  sk.np();
  const dir: V2 = [elbow[0] - wrist[0], elbow[1] - wrist[1]];
  const L = Math.hypot(dir[0], dir[1]) || 1;
  const ux = dir[0] / L, uy = dir[1] / L, px = uy, py = -ux; // perpendicular (toward the back when facing right)
  const tip: V2 = [elbow[0] + ux * 2.5 * k - px * 2.2 * k, elbow[1] + uy * 2.5 * k - py * 2.2 * k];
  const midB: V2 = [wrist[0] + dir[0] * 0.55 - px * 2.8 * k, wrist[1] + dir[1] * 0.55 - py * 2.8 * k];
  sk.poly([wrist[0], wrist[1] - 1 * k, tip[0], tip[1], midB[0], midB[1]], M.mem, { z: z - 1.2, bias: bias - 0.06 });
  sk.tube([[wrist[0] - px * 0.8, wrist[1] - 1 * k], midB, tip], 0.6 * k, M.bone, { z: z - 0.8, bias: bias - 0.04 });
  // humerus + forearm
  sk.np();
  sk.tube([sh, elbow], t => (2.7 - t * 1.1) * k, M.fur, { z, bias });
  sk.tube([elbow, wrist], t => (1.5 - t * 0.45) * k, M.skin, { z: z + 0.3, bias });
  sk.ell(elbow[0], elbow[1], 1.6 * k, 1.6 * k, M.skin, { z: z + 0.5, bias });
  // wrist pad + thumb claw
  sk.ell(wrist[0], wrist[1] - 0.8 * k, 1.5 * k, 1.1 * k, M.skin, { z: z + 1, bias });
  sk.blade(wrist[0] + 0.8 * k, wrist[1] - 1.2 * k, wrist[0] + 2.8 * k, Math.min(-0.2, wrist[1] + 0.2 * k), s2 => (1 - s2) * 0.7 * k + 0.2, M.claw, { z0: z + 2, z1: z + 2, bias });
  return elbow;
}

interface GP { hip: V2; sh: V2; head: V2; ha: number; jaw: number; ear: number; wn: V2; wf: V2; eN: V2; eF: V2; fN: V2; fF: V2; spread: number }

/** Grounded pose: torso from hip to shoulder, wing-arms planted, hind legs behind. */
function drawGround(sk: Sk, M: M, G: GP, k: number, eye: BeastEye) {
  sk.clipY = 0;
  const S = (v: V2): V2 => [v[0] * k, v[1] * k];
  const hip = S(G.hip), sh = S(G.sh);
  const HL: LegSpec = scaleLeg({ l1: 7.5, l2: 8, l3: 2.4, r1: 2.2, r2: 1.2, r3: 0.9, bend: 1 }, k);
  // far wing-arm, far leg
  foldedArm(sk, M, [sh[0] - 1 * k, sh[1] - 0.5 * k], S(G.eF), S(G.wf), k, -6, -0.14);
  sk.np();
  let j = leg(sk, [hip[0] - 1 * k, hip[1]], S(G.fF), HL, M.fur, -4, -Math.PI / 2 - 0.9, -0.14);
  sk.blade(j[3][0], j[3][1] - 0.6, j[3][0] + 1.8 * k, Math.min(-0.2, j[3][1] + 0.4), s => (1 - s) * 0.6 * k + 0.2, M.claw, { z0: -3, z1: -3 });
  // half-opened wings for screech: membranes spread up behind the arms
  if (G.spread > 0) {
    sk.np();
    const up = G.spread;
    for (const [side, zz, bb] of [[-1, -7, -0.14], [1, 8, 0]] as [number, number, number][]) {
      const base = [sh[0] + side * 0.5, sh[1]] as V2;
      const tip1: V2 = [base[0] - 16 * k * up, base[1] - 20 * k * up + side * 2];
      const tip2: V2 = [base[0] - 22 * k * up, base[1] - 8 * k * up];
      const tip3: V2 = [base[0] - 16 * k * up, base[1] + 6 * k];
      sk.poly([base[0], base[1], tip1[0], tip1[1], (tip1[0] + tip2[0]) / 2 + 2 * k, (tip1[1] + tip2[1]) / 2 + 1 * k, tip2[0], tip2[1], (tip2[0] + tip3[0]) / 2 + 2 * k, (tip2[1] + tip3[1]) / 2, tip3[0], tip3[1]], M.mem, { z: zz, bias: bb - 0.04 });
      sk.tube([base, tip1], 0.8 * k, M.bone, { z: zz + 0.3, bias: bb });
      sk.tube([base, tip2], 0.7 * k, M.bone, { z: zz + 0.3, bias: bb });
      sk.tube([base, tip3], 0.6 * k, M.bone, { z: zz + 0.3, bias: bb });
    }
  }
  // torso
  sk.np();
  const c = lerp2(hip, sh, 0.5);
  const nrm: V2 = [-(sh[1] - hip[1]), sh[0] - hip[0]];
  const nl = Math.hypot(nrm[0], nrm[1]) || 1;
  const bow: V2 = [c[0] - (nrm[0] / nl) * 1.2 * k, c[1] - (nrm[1] / nl) * 1.2 * k];
  const torso = cbez(hip, bow, bow, sh, 6);
  sk.tube(torso, t => (5.2 - Math.abs(t - 0.45) * 2.4) * k, (p) => (p.v > 0.35 ? M.chest : M.fur), { z: 0 });
  const tp = sk.pid;
  sk.streaks(tp, () => [-0.6, 0.8] as V2, { spacing: 3, len: 2, amp: 0.09 });
  sk.tufts(tp, (_x, _y, nx, ny) => [nx * 0.6, ny * 0.6 + 0.4] as V2, { every: 2, len: 1 });
  // tail membrane stub between the legs
  sk.np();
  const tm = S([G.hip[0] - 3, G.hip[1] + 3]);
  sk.poly([hip[0], hip[1], tm[0] - 3 * k, tm[1], tm[0] + 1 * k, tm[1] + 2 * k], M.mem, { z: -1 });
  // head
  const H = new Frame2(S(G.head), G.ha, k * 1.2);
  const { ep, top } = drawHead(sk, M, H, { jaw: G.jaw, ear: G.ear, eye, k: k * 1.2 }, 4);
  // near leg, near wing-arm
  sk.np();
  j = leg(sk, hip, S(G.fN), HL, M.fur, 4, -Math.PI / 2 - 0.9);
  sk.blade(j[3][0], j[3][1] - 0.6, j[3][0] + 1.8 * k, Math.min(-0.2, j[3][1] + 0.4), s => (1 - s) * 0.6 * k + 0.2, M.claw, { z0: 6, z1: 6 });
  foldedArm(sk, M, sh, S(G.eN), S(G.wn), k, 8, 0);
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
  return G;
}

/** Membrane wing in 3D: arm + four fingers from the wrist, scalloped trailing edge. */
function wing(sk: Sk, M: M, side: 1 | -1, th: number, fold: number, sweep: number, k: number, back: V3, bias: number) {
  // wing-plane coordinates (s spanwise, c chordwise backward) -> body 3D
  const shoulder: V3 = [3 * k, 1 * k, side * 3 * k];
  const up = (s: number, c: number, handLag: number): V3 => {
    const e = th + (s > 24 ? handLag : 0);
    const sArm = Math.min(s, 24), sHand = Math.max(0, s - 24) * (1 - fold * 0.55);
    const ca = Math.cos(th), sa = Math.sin(th), ce = Math.cos(e), se = Math.sin(e);
    const sw = sweep;
    const x = shoulder[0] + sArm * Math.sin(sw) + sHand * Math.sin(sw + fold * 0.7) - c * (1 - fold * 0.3);
    const y = shoulder[1] + sArm * sa + sHand * se;
    const z = shoulder[2] + side * (sArm * ca + sHand * ce);
    return [x, y, z];
  };
  const lag = -0.35 * Math.sin(th * 1.2) - fold * 0.6;
  const P = (s: number, c: number): V3 => v3mul(up(s, c, lag), 1);
  const K = (s: number, c: number) => P(s * k, c * k);
  const elbow = K(11, -1), wrist = K(24, 1.5);
  const f2 = K(40, -0.5), f3 = K(47, 3), f4 = K(38, 17), f5 = K(27, 19.5);
  const s23 = K(44, 1), s34 = K(38.5, 9.5), s45 = K(30.5, 15), s5b = K(13, 13.5);
  const ankle: V3 = [back[0], back[1], back[2] * side];
  // membranes: hand panels + arm panel
  const panels: V3[][] = [
    [wrist, f2, s23, f3],
    [wrist, f3, s34, f4],
    [wrist, f4, s45, f5],
    [shoulder, elbow, wrist, f5, s5b, ankle],
  ];
  void s23;
  sk.np();
  for (const pn of panels) {
    poly3(sk, 0, 0, pn, (p) => {
      // faint veins
      if (((p.u * 7) % 1) < 0.1 && p.v > 0.1) p.l -= 0.08;
      return M.mem;
    }, { bias, back: (p) => { p.l -= 0.02; return M.memL; } });
  }
  // bones on top
  sk.np();
  const S2 = (q: V3): V2 => { const r = proj(q); return [r[0], r[1]]; };
  const zOf = (q: V3) => proj(q)[2];
  const bone = (a: V3, b: V3, r: number) => sk.tube([S2(a), S2(b)], r * k, M.bone, { z: (zOf(a) + zOf(b)) / 2 + 0.6, bias });
  bone(shoulder, elbow, 1.5); bone(elbow, wrist, 1.1);
  bone(wrist, f2, 0.6); bone(wrist, f3, 0.55); bone(wrist, f4, 0.5); bone(wrist, f5, 0.5);
  // thumb claw at the wrist
  const w2 = S2(wrist);
  sk.blade(w2[0], w2[1], w2[0] + 2.2 * k, w2[1] - 1 * k, s => (1 - s) * 0.6 * k + 0.2, M.claw, { z0: zOf(wrist) + 1, z1: zOf(wrist) + 1 });
}

function drawFly(sk: Sk, M: M, f: number, k: number, eye: BeastEye) {
  const t = f / 6;
  const th = Math.sin(t * TAU) * 0.78 + 0.08;
  const fold = Math.max(0, Math.cos(t * TAU + 0.4)) * 0.7;
  const sweep = -0.1 + Math.sin(t * TAU) * 0.08;
  const bob = -Math.sin(t * TAU) * 1.5 * k;
  // far wing behind the body
  wing(sk, M, -1, th, fold, sweep, k, [-8 * k, 0, 2 * k], -0.14);
  // legs trailing with the tail membrane
  sk.np();
  const hip: V2 = [-6 * k, 1 * k + bob];
  sk.poly([hip[0], hip[1] - 1, -14 * k, 3 * k + bob, -11 * k, 6 * k + bob, -6 * k, 4 * k + bob], M.mem, { z: -1 });
  sk.tube([hip, [-12 * k, 4.5 * k + bob]], 1 * k, M.fur, { z: 0.5 });
  // torso horizontal
  sk.np();
  const body: V2[] = [[-7 * k, 1 * k + bob], [-1 * k, 0 + bob], [4.5 * k, -0.5 * k + bob]];
  sk.tube(body, t2 => (4.8 - Math.abs(t2 - 0.5) * 2) * k, (p) => (p.v > 0.35 ? M.chest : M.fur), { z: 0 });
  sk.streaks(sk.pid, () => [-1, 0.2] as V2, { spacing: 3, len: 2, amp: 0.08 });
  const H = new Frame2([8 * k, -1.5 * k + bob], 0.12, k * 1.15);
  const { ep, top } = drawHead(sk, M, H, { jaw: 0.3, ear: -1, eye, k: k * 1.15 }, 5);
  // near wing in front
  wing(sk, M, 1, th, fold, sweep, k, [-8 * k, 0, 2 * k], 0);
  return { head: [top[0], top[1] - 2 * k] as V2, eye: ep };
}

/** Roosting upside down: feet grip at the top (anchor), wings wrapped round like a cloak. */
function drawHang(sk: Sk, M: M, f: number, k: number, eye: BeastEye) {
  const br = f * 0.4 * k;
  // feet gripping the perch at (0,0)
  sk.np();
  for (const dx of [-1.5, 1.5]) {
    sk.tube([[dx * k, 0.5 * k], [dx * k * 0.8, 6 * k]], 1 * k, M.fur, { z: dx > 0 ? 2 : -2 });
    sk.blade(dx * k, 1.2 * k, dx * k + 1.2 * k, -0.6 * k, s => (1 - s) * 0.5 * k + 0.2, M.claw, { z0: 3, z1: 3 });
  }
  // wrapped wing cloak (body inside)
  sk.np();
  sk.ell(0, 16 * k, 7.2 * k + br, 11 * k, (p) => {
    // fold lines of the wrapped membrane
    const w = (p.u + 1) * 3.2 + p.v * 0.6;
    if (w - Math.floor(w) < 0.14) p.l -= 0.14;
    return M.mem;
  }, { rz: 6 * k });
  const cloak = sk.pid;
  sk.paint(0, 5 * k, 0, 0, cloak);
  // wrist claws peeking where the wings cross
  for (const dx of [-3, 3]) sk.blade(dx * k, 8 * k, dx * k * 1.2, 5.8 * k, s => (1 - s) * 0.5 * k + 0.2, M.claw, { z0: 10, z1: 10 });
  // bony finger ridges down the cloak
  sk.np();
  sk.tube([[-4 * k, 7 * k], [-5.5 * k, 16 * k], [-3 * k, 25 * k]], 0.7 * k, M.bone, { z: 7 });
  sk.tube([[4 * k, 7 * k], [5.2 * k, 17 * k], [2.5 * k, 25.5 * k]], 0.7 * k, M.bone, { z: 7 });
  // head hanging at the bottom, face forward-down, ears pointing down
  const H = new Frame2([1.2 * k, 27.5 * k], Math.PI - 0.45, k, 1);
  // mirror the head vertically: use a frame pointing down-right with the ears down
  const H2 = new Frame2(H.o, 0.35, k);
  const Hd = { p: (x: number, y: number) => H2.p(x, -y), ang: (a: number) => H2.ang(-a), a: H2.a, o: H2.o, k } as unknown as Frame2;
  const { ep } = drawHead(sk, M, Hd, { jaw: 0.1, ear: f ? 0.3 : 0, eye, k }, 12);
  return { head: [H.o[0], H.o[1] - 4 * k] as V2, eye: ep };
}

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const k = juv ? 0.6 : 1;
  const M = mats(sk);
  if (anim === 'fly') return drawFly(sk, M, frame, k, eye);
  if (anim === 'hang') return drawHang(sk, M, frame, k, eye);
  if (anim === 'sleep') {
    // on the ground, wrapped in its wings, head tucked
    sk.clipY = 0;
    sk.np();
    const br = frame * 0.35;
    sk.ell(0, -10 * k, 8 * k + br * k, 10 * k, (p) => {
      const w = (p.u + 1) * 3 + p.v * 0.5;
      if (w - Math.floor(w) < 0.14) p.l -= 0.14;
      return M.mem;
    }, { rz: 6 * k });
    sk.np();
    sk.tube([[-3 * k, -17 * k], [-6 * k, -6 * k], [-4 * k, -1 * k]], 0.8 * k, M.bone, { z: 7 });
    sk.tube([[5 * k, -2 * k], [7.5 * k, -14 * k], [3.5 * k, -19 * k]], 1.1 * k, M.skin, { z: 7 });
    const H = new Frame2([3 * k, -17.5 * k], 0.7, k);
    const { ep, top } = drawHead(sk, M, H, { jaw: 0, ear: -1, eye, k }, 8);
    return { head: [top[0], top[1] - 2 * k] as V2, eye: ep };
  }
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
void fr; void v3add; void along;

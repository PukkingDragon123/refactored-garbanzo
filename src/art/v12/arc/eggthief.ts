// V12 Te Ara Matatū, chapter 6: the Kaipāhua, the ash robber crab of Motu Ahi (Cinerocarcinus
// praedator), sculpted with the beast sketch.
//
// A land crab the size of a dinner plate across its shell, as heavy as a cat: a broad, low-domed
// carapace of basalt blue-black, gritty with pale granules and scarred like old lava, the front margin
// toothed, a groove across it like a cracked crust; ember-orange joints and leg tips; long stalked eyes
// it can fold flat; and one enormous crusher claw (the right) with pale ivory fingers, built for
// cracking eggs, beside a small picking claw. It comes up out of the vent cracks at dusk to raid the
// seabird colony.
//
// Anims (anchor: the ground under the body's middle, facing right): idle (eyes up, mouthparts working),
// walk, sneak (low, eyes folded, slow), flee (high and flat out), threat (both claws up and spread,
// eyes up), grab (the big claw reaching down and closing on an egg), carry (walking off with the egg
// held high in the big claw), crack (the egg crushed and eaten), flinch (claws snatched in, it
// hunkers and backs), hide (flat, eyes folded, claws over the face).

import { Sk, V2, rmp, SpeciesDef, TAU, hh, gait } from '../../beasts-core';
import type { Px, BeastEye, AnimDef } from '../../beasts-core';
import { hex } from '../../color';

const A = (frames: number, fps: number, loop = true): AnimDef => ({ frames, fps, loop });
export const THIEF_ANIMS: Record<string, AnimDef> = {
  idle: A(4, 4),
  walk: A(6, 10),
  sneak: A(6, 6),
  flee: A(6, 16),
  threat: A(4, 6),
  grab: A(5, 8, false),
  carry: A(6, 11),
  crack: A(4, 6),
  flinch: A(3, 9, false),
  hide: A(2, 1),
};

interface CP {
  /** body height off the ground, tilt (nose down +), bob */
  h: number; tilt: number;
  /** gait phase and stride (0 = standing) */
  ph: number; stride: number; lift: number;
  /** eye stalks: 1 up, 0 folded */
  eyes: number;
  /** big claw: reach angle (0 forward, -1 up, +1 down), open 0..1; small claw likewise */
  bigA: number; bigOpen: number; bigLen: number;
  smallA: number; smallOpen: number;
  /** an egg in the big claw: 0 none, 1 whole, 2 cracked */
  egg: number;
  /** mouthparts working */
  mouth: number;
  /** squash (hide) */
  flat: number;
}
function cpose(anim: string, f: number, n: number): CP {
  const t = f / n, s = Math.sin(t * TAU);
  const p: CP = { h: 11, tilt: 0, ph: t, stride: 0, lift: 0, eyes: 1, bigA: -0.3, bigOpen: 0.15, bigLen: 1, smallA: 0.35, smallOpen: 0.2, egg: 0, mouth: 0, flat: 0 };
  switch (anim) {
    case 'idle': p.h = 11 + s * 0.3; p.mouth = f % 2; p.smallA = 0.45 + s * 0.15; p.smallOpen = 0.3 + s * 0.2; break;
    case 'walk': p.stride = 7; p.lift = 3; p.h = 11.4; break;
    case 'sneak': p.stride = 5; p.lift = 1.8; p.h = 7.5; p.eyes = 0.35; p.tilt = 0.06; p.bigA = 0.35; break;
    case 'flee': p.stride = 10; p.lift = 4; p.h = 12.5; p.tilt = -0.05; p.bigA = -0.2; p.bigOpen = 0; p.smallA = -0.1; break;
    case 'threat': p.h = 13 + s * 0.4; p.tilt = -0.14; p.bigA = -1.25 + s * 0.08; p.bigOpen = 0.7 + s * 0.25; p.smallA = -1.1 - s * 0.1; p.smallOpen = 0.6; p.bigLen = 1.08; break;
    case 'grab': p.h = [11, 9.5, 8, 8, 10][f]; p.tilt = [0.05, 0.16, 0.24, 0.2, 0.06][f]; p.bigA = [0.3, 0.75, 1.05, 0.95, 0.2][f]; p.bigOpen = [0.4, 0.85, 0.75, 0.05, 0.05][f]; p.egg = f >= 3 ? 1 : 0; break;
    case 'carry': p.stride = 7; p.lift = 3; p.h = 11.4; p.bigA = -0.65; p.bigOpen = 0.05; p.egg = 1; break;
    case 'crack': p.h = 9.5; p.tilt = 0.08; p.bigA = [-0.2, -0.05, 0.1, 0.05][f]; p.bigOpen = [0.05, 0.0, 0.2, 0.3][f]; p.egg = f === 0 ? 1 : 2; p.mouth = f % 2; p.smallA = [0.2, 0.0, 0.25, 0.05][f]; p.smallOpen = 0.4; break;
    case 'flinch': p.h = [9, 6, 6.5][f]; p.tilt = [0.1, 0.2, 0.12][f]; p.eyes = [0.4, 0, 0.1][f]; p.bigA = [0.6, 1.2, 1.1][f]; p.bigOpen = 0; p.smallA = 1.1; p.smallOpen = 0; break;
    case 'hide': p.h = 4.2; p.flat = 1; p.eyes = 0; p.bigA = 1.35; p.bigOpen = 0; p.smallA = 1.3; p.smallOpen = 0; p.tilt = 0.1; break;
  }
  return p;
}

const CW = 13.5, CH = 7.6;
function cdraw(sk: Sk, anim: string, frame: number, _eye: BeastEye, juv: boolean) {
  const n = THIEF_ANIMS[anim]?.frames ?? 1;
  const P = cpose(THIEF_ANIMS[anim] ? anim : 'idle', frame, n);
  const k = juv ? 0.6 : 1;
  const M = {
    shell: sk.m(rmp('#343448', { n: 6, dark: 0.55, light: 0.42, cool: 0.2, warm: 0.15 }), { edge: 1, k: 0.95 }),
    shellD: sk.m(rmp('#22202e', { n: 5, dark: 0.5, light: 0.35, cool: 0.2 }), { edge: 1, k: 0.9 }),
    grain: sk.m(rmp('#8e8a9a', { n: 4, dark: 0.35, light: 0.35, warm: 0.2 }), { edge: 0, k: 0.6 }),
    ember: sk.m(rmp('#c45a26', { n: 5, dark: 0.5, light: 0.4, warm: 0.4, cool: 0.15 }), { edge: 1, k: 0.85 }),
    leg: sk.m(rmp('#3c3446', { n: 5, dark: 0.5, light: 0.38, cool: 0.2, warm: 0.2 }), { edge: 1, k: 0.85 }),
    legF: sk.m(rmp('#262230', { n: 4, dark: 0.45, light: 0.3, cool: 0.2 }), { edge: 1, k: 0.8 }),
    ivory: sk.m(rmp('#e8dcc0', { n: 4, dark: 0.4, light: 0.35, warm: 0.2 }), { edge: 1, k: 0.75 }),
    under: sk.m(rmp('#8c6a5a', { n: 4, dark: 0.4, light: 0.3, warm: 0.2 }), { edge: 1, k: 0.7 }),
    egg: sk.m(rmp('#c8d8cc', { n: 5, dark: 0.4, light: 0.45, cool: 0.15 }), { edge: 1, k: 0.8 }),
    yolk: sk.m(rmp('#e8a832', { n: 4, dark: 0.35, light: 0.35, warm: 0.3 }), { edge: 0, k: 0.6 }),
  };
  const by = -P.h * k;
  const C: V2 = [0, by - CH * 0.5 * k * (1 - P.flat * 0.35)];
  const tilt = P.tilt;
  const rot = (x: number, y: number): V2 => [C[0] + x * Math.cos(tilt) - y * Math.sin(tilt), C[1] + x * Math.sin(tilt) + y * Math.cos(tilt)];

  // ---------------------------------------------------------------- the walking legs: four a side
  // far side first (behind the body, darker), then the near side; hips along the shell's flank
  const leg = (i: number, nearSide: boolean) => {
    const hx = (-7.5 + i * 3.6) * k, hy = 2.4 * k;
    const hip = rot(hx, hy + (nearSide ? 1 : -0.8));
    const spread = (i - 1.5) * (nearSide ? 12 : 9) + (nearSide ? -2 : 3);
    const phase = P.ph + (i % 2) * 0.5 + (nearSide ? 0.25 : 0);
    const g = P.stride ? gait(phase, 0.55, P.stride * k, P.lift * k) : [0, 0];
    const foot: V2 = [hx * 1.5 + spread * k + g[0], g[1] - P.flat * 0.5];
    const L1 = 9 * k, L2 = 10.5 * k;
    void L1; void L2;
    // the knee arches high, up near the shell's rim, then the leg drops steeply to its point
    const out = foot[0] - hip[0];
    const knee: V2 = [hip[0] + out * 0.5, Math.min(hip[1], foot[1]) - (4.2 + Math.abs(out) * 0.12) * k * (1 - P.flat * 0.6)];
    sk.np();
    const mat = nearSide ? M.leg : M.legF, zz = nearSide ? 6 : -6;
    const fill = (base: number) => (p: Px) => { p.l += (hh(p.x, p.y, 31) - 0.5) * 0.08; return base; };
    sk.tube([hip, knee], t => (1.9 - t * 0.4) * k, fill(mat), { z: zz });
    // the knee joint glows ember
    sk.ell(knee[0], knee[1], 1.4 * k, 1.3 * k, nearSide ? M.ember : M.legF, { z: zz + 1.5 });
    sk.np();
    const mid: V2 = [knee[0] + (foot[0] - knee[0]) * 0.58, knee[1] + (foot[1] - knee[1]) * 0.55];
    sk.tube([knee, mid], t => (1.5 - t * 0.3) * k, fill(mat), { z: zz + 0.5 });
    // the dactyl: a pointed ember tip
    sk.blade(mid[0], mid[1], foot[0], foot[1] + 0.4, s => (1.2 - s * 1.05) * k, nearSide ? M.ember : M.legF, { z0: zz + 0.6, z1: zz + 0.6 });
    // spines along the top of the long segment
    if (nearSide) for (let q = 0.3; q < 0.95; q += 0.3) { const sp: V2 = [hip[0] + (knee[0] - hip[0]) * q, hip[1] + (knee[1] - hip[1]) * q - 1.7 * k]; sk.over(sp[0], sp[1], hex('#5a5068')); }
  };
  for (let i = 0; i < 4; i++) leg(i, false);

  // ---------------------------------------------------------------- the small (picking) claw, far side
  const claw = (big: boolean) => {
    const sc = big ? 1 : 0.62;
    const base = rot((big ? 9 : 8) * k, (big ? 2.6 : 1.2) * k);
    const a = big ? P.bigA : P.smallA;
    const z0 = big ? 9 : -3;
    // arm: merus out and forward, carpus, then the palm
    const reach = (big ? 7.5 * P.bigLen : 6) * k;
    const elbow: V2 = [base[0] + Math.cos(0.9 + a * 0.4) * reach * 0.7, base[1] + Math.sin(0.9 + a * 0.4) * reach * 0.7];
    const wrist: V2 = [elbow[0] + Math.cos(a - 0.5) * reach * 0.55, elbow[1] + Math.sin(a - 0.5) * reach * 0.55];
    sk.np();
    sk.tube([base, elbow], t => (2.4 - t * 0.4) * sc * k, (p: Px) => { p.l += (hh(p.x, p.y, 37) - 0.5) * 0.1; return big ? M.leg : M.legF; }, { z: z0 });
    sk.ell(elbow[0], elbow[1], 1.8 * sc * k, 1.7 * sc * k, big ? M.ember : M.legF, { z: z0 + 1 });
    sk.np();
    sk.tube([elbow, wrist], t => (2.2 + t * 0.6) * sc * k, (p: Px) => { p.l += (hh(p.x, p.y, 39) - 0.5) * 0.1; return big ? M.shell : M.legF; }, { z: z0 + 1 });
    // the palm: heavy, swollen, granular; pointing along a
    const ca = a, cs = Math.cos(ca), sn = Math.sin(ca);
    const palmL = 7 * sc * k, palmR = (big ? 4.4 : 3.4) * sc * k;
    const pc: V2 = [wrist[0] + cs * palmL * 0.45, wrist[1] + sn * palmL * 0.45];
    sk.np();
    sk.tube([[wrist[0], wrist[1]], [pc[0], pc[1]], [wrist[0] + cs * palmL, wrist[1] + sn * palmL]], t => (t < 0.6 ? palmR * (0.85 + t * 0.3) : palmR * (1.03 - (t - 0.6) * 0.9)), (p: Px) => {
      const g = hh(p.x, p.y, 41);
      if (big && g > 0.88 && p.nz > 0.4) { p.l += 0.25; return M.grain; }
      if (p.v > 0.55) return M.ember;
      return big ? M.shell : M.legF;
    }, { z: z0 + 2, rz: 1.2 });
    // the fingers: the fixed one below, the dactyl above swinging open; ivory, with blunt crushing teeth
    const tip: V2 = [wrist[0] + cs * palmL, wrist[1] + sn * palmL];
    const fl = 6.2 * sc * k, op = (big ? P.bigOpen : P.smallOpen) * 0.75;
    const lo = ca + 0.12, up = ca - 0.1 - op;
    const fix: V2 = [tip[0] - sn * 1.2 * sc, tip[1] + cs * 1.2 * sc];
    const dac: V2 = [tip[0] + sn * 1.4 * sc, tip[1] - cs * 1.4 * sc];
    sk.np();
    sk.blade(fix[0], fix[1], fix[0] + Math.cos(lo) * fl, fix[1] + Math.sin(lo) * fl, s => (1.7 - s * 1.35) * sc * k, (p: Px) => (p.t > 0.75 ? M.shellD : M.ivory), { z0: z0 + 2.5, z1: z0 + 2.5, bend: -0.5 });
    sk.np();
    sk.blade(dac[0], dac[1], dac[0] + Math.cos(up) * fl * 1.05, dac[1] + Math.sin(up) * fl * 1.05, s => (1.6 - s * 1.3) * sc * k, (p: Px) => (p.t > 0.75 ? M.shellD : M.ivory), { z0: z0 + 2.6, z1: z0 + 2.6, bend: 0.6 });
    // the egg held between the fingers
    if (big && P.egg) {
      const ex = tip[0] + Math.cos(ca - op * 0.5) * fl * 0.55, ey = tip[1] + Math.sin(ca - op * 0.5) * fl * 0.55;
      sk.np();
      if (P.egg === 1) {
        sk.ell(ex, ey, 3.2 * k, 4 * k, (p: Px) => { if (hh(p.x, p.y, 43) > 0.86) p.l -= 0.3; return M.egg; }, { z: z0 + 2.2, rot: ca + Math.PI / 2 });
      } else {
        // crushed: shell shards, a yolk run
        sk.ell(ex, ey + 1, 2.4 * k, 1.4 * k, M.yolk, { z: z0 + 2.2 });
        for (const [dx, dy] of [[-2, -1], [1, -2], [2, 0], [-1, 1]] as const) sk.dot(ex + dx, ey + dy, M.egg, 0.75, z0 + 3);
        for (let i = 0; i < 3; i++) sk.over(ex + i - 1, ey + 2 + i, hex('#e8a832', 220));
      }
    }
  };
  claw(false);

  // ---------------------------------------------------------------- the carapace
  {
    sk.np();
    // the shell's outline: broad at the front, toothed margin, a little narrower behind; low dome
    const w = CW * k, hgt = CH * k * (1 - P.flat * 0.3);
    const pts: number[] = [];
    const N = 28;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      const cx = Math.cos(a), cy = Math.sin(a);
      // flatter underside, a fuller front shoulder, teeth along the front-top margin
      let rx = w * (cx > 0 ? 1.04 : 0.94), ry = hgt * (cy > 0 ? 0.72 : 1.08);
      if (cy < 0 && cx > 0.35) rx += (i % 2 ? 0.9 : -0.2) * k;
      if (cy > 0) ry *= 1 - Math.abs(cx) * 0.25;
      const q = rot(cx * rx, cy * ry + (cy < 0 ? Math.abs(cx) * 0.8 * k : 0));
      pts.push(q[0], q[1]);
    }
    // dome shading from a pseudo-normal
    sk.poly(pts, (p: Px) => {
      const lx = (p.x - C[0]) / w, ly = (p.y - C[1]) / hgt;
      const nz = Math.sqrt(Math.max(0.05, 1 - lx * lx * 0.7 - ly * ly));
      const nx = lx * 0.7, ny = ly;
      p.l = 0.44 + 0.62 * (nx * -0.52 + ny * -0.74 + nz * 0.42) + (hh(p.x / 2, p.y / 2, 51) - 0.5) * 0.12;
      if (ly > 0.35) return M.under;
      // the cracked-crust groove: an H across the shell
      const gx = Math.abs(lx + 0.05);
      if ((Math.abs(ly + 0.05) < 0.09 && gx < 0.38) || (Math.abs(gx - 0.36) < 0.05 && ly < 0.25 && ly > -0.6)) { p.l -= 0.28; return M.shellD; }
      // pale granules and old lava scars
      const g = hh(p.x, p.y, 53);
      if (g > 0.9 && ly < 0.2) { p.l += 0.2; return M.grain; }
      if (hh(p.x / 3, p.y / 2, 55) > 0.82 && ly < 0.1) { p.l -= 0.12; return M.shellD; }
      // the ember front margin
      if (lx > 0.78 && ly < 0.1) return M.ember;
      return M.shell;
    }, { z: 4 });
    // mouthparts: a small working plate under the front
    const mo = rot(w * 0.88, hgt * 0.35);
    sk.np();
    sk.ell(mo[0], mo[1] + (P.mouth ? 0.4 : 0), 1.5 * k, 1.2 * k, M.under, { z: 5 });
    sk.over(mo[0] + 1, mo[1] + 1 + P.mouth, hex('#e8c8a0'));
  }

  // ---------------------------------------------------------------- the eye stalks
  for (const [dx, near] of [[-2.2, false], [1.6, true]] as const) {
    const b = rot(w0() + dx * k, -CH * 0.55 * k);
    const len = (1.2 + P.eyes * 3.8) * k;
    const ang = -Math.PI / 2 + 0.55 - P.eyes * 0.45 + (near ? 0.15 : 0) + (1 - P.eyes) * 0.9;
    const tp: V2 = [b[0] + Math.cos(ang) * len, b[1] + Math.sin(ang) * len];
    sk.np();
    sk.tube([b, tp], 0.8 * k, near ? M.ember : M.legF, { z: near ? 8 : 3 });
    sk.over(tp[0] + 0.5, tp[1] - 0.5, hex(near ? '#0a0608' : '#1a1218'));
    sk.over(tp[0] + 0.5, tp[1] - 1.5, hex(near ? '#0a0608' : '#1a1218'));
    if (near) sk.over(tp[0] - 0.5, tp[1] - 1.5, hex('#e8f0ff'));
  }
  function w0() { return CW * k * 0.62; }

  for (let i = 0; i < 4; i++) leg(i, true);
  claw(true);
  // ash dust kicked up when running
  if (P.stride >= 9) for (let i = 0; i < 5; i++) sk.over(-14 - hh(i, frame, 61) * 8, -hh(i, frame, 63) * 3, hex('#8a8478', 150));
  const E = rot(CW * k * 0.7, -CH * k * 1.4);
  return { head: [E[0], E[1] - 3] as V2, eye: E };
}

export const EGGTHIEF: SpeciesDef = {
  name: 'Kaipāhua', kind: 'crustacean', len: 34, height: 18,
  anims: THIEF_ANIMS,
  canvas: () => ({ w: 90, h: 60, ox: 45, oy: 44 }),
  draw: cdraw,
  eyeFor: () => 'open',
};

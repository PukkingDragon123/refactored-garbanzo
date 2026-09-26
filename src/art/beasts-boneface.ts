// Forest Boneface: a tapir/hippo-like forest browser with a weathered bony facial shield, short
// lower tusks and dark grey-purple skin with pale speckles. Calves (variant 'juvenile', ~55%) are
// brown with cream stripes and spots and only a small shield nub.

import { Sk, V2, Px, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, gait, TAU, hh, fr, qbez } from './beasts-core';
import { Frame2, leg, LegSpec, scaleLeg, ear } from './beasts-rig';
import { hex } from './color';

interface P {
  bx: number; by: number; tilt: number; br: number; jig: number;
  feet: [V2, V2, V2, V2]; // offsets from rest: FLn, FLf, HLn, HLf
  head: number; neck: number; jaw: number; ear: number; earFlick: number;
  tail: number;
  lie: number;        // 0 standing .. 1 lying (sleep / wallow)
  mud: number;        // wallow mud line
  roll: number;       // wallow roll (tilt of the lying body)
  dust: number; dustPhase: number;
  turn: number;       // groom: head turned back to the flank
  air: boolean;
}
const base = (): P => ({
  bx: 0, by: 0, tilt: 0, br: 0, jig: 0, feet: [[0, 0], [0, 0], [0, 0], [0, 0]],
  head: 0, neck: 0, jaw: 0, ear: 0, earFlick: 0, tail: 0, lie: 0, mud: 0, roll: 0, dust: 0, dustPhase: 0, turn: 0, air: false,
});

const ANIMS = {
  idle: { frames: 4, fps: 3, loop: true },
  walk: { frames: 8, fps: 7, loop: true },
  run: { frames: 6, fps: 10, loop: true },
  eat: { frames: 4, fps: 4, loop: true },
  alert: { frames: 2, fps: 2, loop: true },
  sleep: { frames: 2, fps: 1, loop: true },
  call: { frames: 2, fps: 3, loop: true },
  groom: { frames: 4, fps: 5, loop: true },
  browse: { frames: 4, fps: 4, loop: true },
  charge: { frames: 6, fps: 12, loop: true },
  play: { frames: 4, fps: 8, loop: true },
  wallow: { frames: 2, fps: 1.5, loop: true },
};

function pose(anim: string, f: number, n: number): P {
  const p = base();
  const t = f / n;
  switch (anim) {
    case 'idle':
      p.br = Math.sin(t * TAU) * 0.5 + 0.5;
      p.jig = Math.sin(t * TAU - 1) * 0.4;
      p.head = 0.04 + Math.sin(t * TAU) * 0.02;
      p.earFlick = f === 2 ? 1 : 0;
      p.tail = Math.sin(t * TAU) * 0.25;
      break;
    case 'walk': {
      const st = 16, lift = 4, duty = 0.66;
      p.feet[2] = gait(t, duty, st, lift);
      p.feet[0] = gait(t + 0.25, duty, st, lift);
      p.feet[3] = gait(t + 0.5, duty, st, lift);
      p.feet[1] = gait(t + 0.75, duty, st, lift);
      p.by = Math.cos(t * TAU * 2) * 0.8;
      p.jig = Math.cos(t * TAU * 2 - 1.3) * 1.2; // belly lags the body bob
      p.tilt = Math.sin(t * TAU) * 0.015;
      p.head = 0.06 + Math.sin(t * TAU * 2 + 0.6) * 0.04;
      p.tail = Math.sin(t * TAU + 1) * 0.2;
      p.earFlick = f === 5 ? 1 : 0;
      break;
    }
    case 'run': {
      const st = 30, lift = 8, duty = 0.42;
      p.feet[0] = gait(t, duty, st, lift);
      p.feet[1] = gait(t + 0.1, duty, st, lift);
      p.feet[3] = gait(t + 0.5, duty, st, lift);
      p.feet[2] = gait(t + 0.6, duty, st, lift);
      p.by = -Math.max(0, Math.sin(t * TAU + 0.8)) * 4 + 1;
      p.jig = Math.cos(t * TAU - 1.6) * 2.2;
      p.tilt = Math.sin(t * TAU) * 0.05;
      p.head = 0.1 + Math.sin(t * TAU + 1.5) * 0.06;
      p.ear = -1;
      p.tail = -0.5 + Math.sin(t * TAU) * 0.2;
      break;
    }
    case 'eat':
      p.head = 0.62 + (f % 2) * 0.05;
      p.neck = 0.3;
      p.jaw = [0, 0.5, 0.15, 0.6][f];
      p.tilt = 0.03;
      p.feet[0] = [2, 0];
      p.br = f % 2;
      p.tail = Math.sin(t * TAU) * 0.2;
      break;
    case 'alert':
      p.head = -0.28;
      p.neck = -0.25;
      p.ear = 1;
      p.tilt = -0.03;
      p.br = f;
      p.earFlick = f;
      p.tail = 0.1;
      break;
    case 'sleep':
      p.lie = 1; p.br = f; p.head = 0.42; p.neck = 0.25; p.ear = -1; p.tail = 0.3;
      break;
    case 'call':
      p.head = -0.42; p.neck = -0.3; p.jaw = f ? 1 : 0.6; p.ear = -0.4; p.br = f; p.tilt = -0.02;
      p.jig = f * 0.8;
      break;
    case 'groom':
      p.turn = 1; p.head = [0, 0.1, 0.03, 0.12][f]; p.jaw = f % 2 ? 0.4 : 0; p.tail = [0.4, -0.3, 0.5, -0.2][f];
      p.feet[3] = [1, 0];
      break;
    case 'browse':
      // rearing slightly to reach leaves, lips working
      p.tilt = -0.14; p.by = -1.2;
      p.head = -0.72 + (f % 2) * 0.06; p.neck = -0.8;
      p.jaw = [0.1, 0.55, 0.2, 0.7][f];
      p.feet[0] = [-2, -1 - (f % 2) * 1.5]; p.feet[1] = [-1, 0];
      p.ear = 0.5; p.tail = Math.sin(t * TAU) * 0.25;
      break;
    case 'charge': {
      const st = 34, lift = 9, duty = 0.4;
      p.feet[0] = gait(t, duty, st, lift);
      p.feet[1] = gait(t + 0.12, duty, st, lift);
      p.feet[3] = gait(t + 0.5, duty, st, lift);
      p.feet[2] = gait(t + 0.62, duty, st, lift);
      p.by = -Math.max(0, Math.sin(t * TAU + 0.8)) * 4 + 1.5;
      p.jig = Math.cos(t * TAU - 1.6) * 2.4;
      p.tilt = 0.06 + Math.sin(t * TAU) * 0.05;
      p.head = 0.5; p.neck = 0.35; p.ear = -1; p.jaw = 0.3;
      p.tail = -0.7;
      p.dust = 1; p.dustPhase = t;
      break;
    }
    case 'play': {
      // stotting bounce
      const hop = [0, 1, 0.55, 0][f];
      p.by = [2, -9, -5, 1.5][f];
      p.air = f === 1 || f === 2;
      const tuck = f === 1 ? 1 : f === 2 ? 0.5 : 0;
      p.feet = [[2, p.by * 0.9 - tuck * 2], [1, p.by * 0.9 - tuck * 2], [-2, p.by * 0.9 - tuck * 2.5], [-1, p.by * 0.9 - tuck * 2.5]];
      if (!p.air) p.feet = [[0, 0], [0, 0], [0, 0], [0, 0]];
      p.jig = [-1.5, 1.5, 0.5, -2][f];
      p.head = [0.25, -0.25, -0.1, 0.35][f];
      p.tilt = [0.04, -0.08, 0.05, 0.02][f];
      p.ear = hop ? -0.5 : 0.5;
      p.tail = hop * 0.6;
      break;
    }
    case 'wallow':
      p.lie = 1; p.mud = 1; p.roll = f ? 0.06 : 0; p.br = f; p.head = 0.35; p.neck = 0.2; p.ear = f ? 0.4 : -0.3; p.tail = 0.2;
      break;
  }
  return p;
}

const EYE: EyeSpec = { r: 1.5, iris: hex('#3a2418'), lash: hex('#2a2028'), dark: true };

function mats(sk: Sk, juv: boolean) {
  return {
    skin: juv ? sk.m(rmp('#5c3c2e', { n: 6, dark: 0.6, light: 0.35 })) : sk.m(rmp('#554760', { n: 7, dark: 0.6, cool: 0.35, light: 0.4 })),
    belly: juv ? sk.m(rmp('#7a5a48', { n: 6, dark: 0.55 })) : sk.m(rmp('#6d5d72', { n: 6, dark: 0.55 })),
    speck: juv ? sk.m(rmp('#e6d4b0', { n: 4, dark: 0.4, at: 2 })) : sk.m(rmp('#b6adc6', { n: 5, dark: 0.45, at: 3 })),
    fold: sk.m(rmp(juv ? '#4a3228' : '#3a3044', { n: 5, dark: 0.5 }), { edge: 0 }),
    bone: sk.m(rmp('#d8cbab', { n: 6, dark: 0.55, light: 0.45 })),
    boneD: sk.m(rmp('#8e8068', { n: 5, dark: 0.5 }), { edge: 0 }),
    tusk: sk.m(rmp('#f0e6cc', { n: 4, dark: 0.35, at: 2 })),
    hoof: sk.m(rmp('#2e2630', { n: 4, dark: 0.45 })),
    nail: sk.m(rmp('#a19482', { n: 4, dark: 0.45 })),
    inner: sk.m(rmp('#8e6a7a', { n: 4, dark: 0.5 })),
    mouth: sk.m(rmp('#5a2230', { n: 3, dark: 0.45 }), { edge: 0 }),
    lip: sk.m(rmp('#7a5a6a', { n: 4, dark: 0.5 })),
    mud: sk.m(rmp('#4c3826', { n: 5, dark: 0.55 }), { edge: 1 }),
    mudW: sk.m(rmp('#6a5236', { n: 4, dark: 0.5 }), { edge: 0 }),
    dust: sk.m(rmp('#9a8466', { n: 4, dark: 0.45, light: 0.35 }), { edge: 0 }),
  };
}
type M = ReturnType<typeof mats>;

/** Skin pattern in body-local coords: pale speckles over the back (adults) or calf stripes and spots. */
function skinPat(M: M, juv: boolean, lx: number, ly: number, p: Px, upper: number): number {
  if (juv) {
    // tapir-calf "watermelon" pattern: broken cream stripe rows along the body, spots on the haunch
    const sy = (ly + 40) / 4.2 + Math.sin(lx * 0.09) * 0.35;
    const row = Math.floor(sy), st = sy - row;
    const dash = (lx + 60 + row * 2.3) / 6.5;
    const inDash = dash - Math.floor(dash) < 0.72;
    if (upper > -0.8 && upper < 0.55 && st < 0.26 && inDash) return M.speck;
    if (lx < -10 && upper > -0.6) {
      const cx = Math.floor((lx + 60) / 3.5), cy = Math.floor((ly + 40) / 3.5);
      const fx = (lx + 60) / 3.5 - cx, fy = (ly + 40) / 3.5 - cy;
      if (hh(cx, cy, 37) < 0.3 && fx < 0.5 && fy < 0.5) return M.speck;
    }
    return M.skin;
  }
  // speckles: small flecks (2x1 or 1x2) on a jittered 4px grid, denser toward the back
  const gx = Math.floor(lx / 4), gy = Math.floor(ly / 4);
  const dens = 0.12 + Math.max(0, -upper) * 0.32;
  if (hh(gx, gy, 17) < dens) {
    const ox = Math.floor(hh(gx, gy, 18) * 3), oy = Math.floor(hh(gx, gy, 19) * 3);
    const dx = Math.floor(lx) - (gx * 4 + ox), dy = Math.floor(ly) - (gy * 4 + oy);
    const horiz = hh(gx, gy, 20) < 0.6;
    if ((horiz && dy === 0 && (dx === 0 || dx === 1)) || (!horiz && dx === 0 && (dy === 0 || dy === 1))) { p.l += 0.1; return M.speck; }
  }
  return M.skin;
}

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const k = juv ? 0.55 : 1;
  const M = mats(sk, juv);
  sk.clipY = 0;
  const P = pose(anim, frame, n);
  // calves: relatively bigger heads and longer legs
  const hk = juv ? 1.4 : 1.18, lk = juv ? 1.12 : 1;
  const lieDrop = P.lie * (19 * lk - 1);
  const B = new Frame2([P.bx * k, (-37 + P.by + lieDrop) * k], P.tilt + P.roll, k);
  const upperOf = (y: number) => (y - B.o[1]) / (17 * k);

  // ---- legs
  const FL: LegSpec = scaleLeg({ l1: 12.5 * lk, l2: 11.5 * lk, r1: 6.2, r2: 4.4, bend: 1 }, k);
  const HL: LegSpec = scaleLeg({ l1: 13.5 * lk, l2: 11.8 * lk, r1: 7.6, r2: 4.6, bend: -1 }, k);
  const drawLeg = (which: number) => {
    const front = which < 2, near = which % 2 === 0;
    const z = near ? 12 : -12, bias = near ? 0 : -0.12;
    sk.np();
    const hip = B.p(front ? 21 : -25, 4);
    const restX = front ? 22 : -25;
    let foot: V2 = [(restX + P.feet[which][0]) * k, (-2.6 + P.feet[which][1]) * k];
    if (P.lie) {
      // folded under the body
      foot = B.p(front ? 30 : -14, 15);
      if (!near) foot = B.p(front ? 26 : -18, 14);
    }
    const j = leg(sk, hip, foot, front ? FL : HL, (p) => {
      // wrinkles round the knee
      const d = Math.hypot(p.x - (p.x), 0);
      void d;
      return M.skin;
    }, z, 0, bias);
    // knee wrinkle rings
    const kn = j[1];
    sk.paint(kn[0] - 1, kn[1], M.fold);
    sk.paint(kn[0], kn[1] + 1, M.fold);
    // hoof: three toes with pale nails
    const f0 = j[2];
    if (!P.lie) {
      sk.ell(f0[0] + 0.5 * k, f0[1] + 0.2 * k, 4.4 * k, 2.3 * k, M.hoof, { z: z + 2, bias });
      for (let c = 0; c < 3; c++) {
        const nx = f0[0] + (-1.4 + c * 2.2) * k, ny = f0[1] + 1.6 * k;
        sk.ell(nx, Math.min(ny, -0.9 * k), 1.1 * k, 0.9 * k, M.nail, { z: z + 3 + c * 0.1, bias });
      }
    }
  };
  drawLeg(1);
  drawLeg(3);

  // ---- tail: short, thin with a tuft
  sk.np();
  const tb = B.p(-40, -7);
  const tA = B.ang(Math.PI * 0.62 - P.tail * 0.6);
  const tPts = qbez(tb, [tb[0] + Math.cos(tA) * 6 * k - 1.5 * k, tb[1] + Math.sin(tA) * 6 * k], [tb[0] + Math.cos(tA + 0.2) * 12 * k, tb[1] + Math.sin(tA + 0.2) * 12 * k], 6);
  sk.tube(tPts, t => (2.2 - t * 1.3) * k, (p) => (p.t > 0.8 ? M.fold : M.skin), { z: -2 });

  // ---- body: one barrel tube along the spine + a sagging belly that jiggles
  sk.np();
  const bodyFill = (p: Px) => {
    const lx = (p.x - B.o[0]) / k, ly = (p.y - B.o[1]) / k;
    const up = upperOf(p.y);
    if (P.mud && up > 0.35 - P.roll * 2) return up > 0.42 ? M.mud : M.mudW;
    if (up > 0.66) return M.belly;
    if (up < -0.94) p.l -= 0.05;
    return skinPat(M, juv, lx, ly, p, up);
  };
  const spinePts: V2[] = [B.p(-36, -3), B.p(-24, -5.5), B.p(-6, -3.5), B.p(12, -2.5), B.p(23, -0.5)];
  const bodyR = (t: number) => {
    const prof = [12.5, 16.8, 17.4, 16.4, 14.2];
    const u = t * (prof.length - 1), i = Math.min(prof.length - 2, Math.floor(u)), f = u - i;
    const e = f * f * (3 - 2 * f);
    return (prof[i] + (prof[i + 1] - prof[i]) * e + P.br * 0.35) * k;
  };
  sk.tube(spinePts, bodyR, bodyFill, { z: 0, rz: 0.95 });
  const belly = B.p(-2, 8.5 + P.jig * 0.8);
  sk.ell(belly[0], belly[1], 24.5 * k, (9 + P.jig * 0.25) * k, bodyFill, { rot: B.a, rz: 11.5 * k });
  const bodyPart = sk.pid;
  // skin folds: behind the foreleg and at the flank
  for (const [fx, fy, len, a] of [[13, -3, 10, 1.75], [15.5, 5, 6, 1.95], [-15, -5, 9, 1.4]] as [number, number, number, number][]) {
    const a0 = B.p(fx, fy), dir = B.dir(a, len);
    const nn = Math.ceil(len * k);
    for (let i = 0; i <= nn; i++) sk.paint(a0[0] + (dir[0] * i) / nn + Math.sin(i * 0.8) * 0.5, a0[1] + (dir[1] * i) / nn, M.fold, 0, bodyPart);
  }

  // ---- neck + head
  const N0 = B.p(24, -1.5);
  let H: Frame2;
  if (P.turn) {
    // nibbling the near shoulder: head swung down and back in front of the chest
    H = new Frame2(B.p(27, 2), B.a + 1.95 + P.head, k * hk);
  } else {
    const nA = B.a + P.neck;
    const nL = 11 * k * hk;
    H = new Frame2([N0[0] + Math.cos(nA) * nL, N0[1] + Math.sin(nA) * nL - 1 * k], B.a + P.neck * 0.6 + P.head, k * hk);
  }
  const headO = H.o;
  sk.np();
  sk.tube([N0, [(N0[0] + headO[0]) / 2, (N0[1] + headO[1]) / 2 - 1 * k], headO], t => (12 - t * 3.2) * k, bodyFill, { z: P.turn ? 6 : 1 });
  const neckPart = sk.pid;
  for (let i = 0; i < 3; i++) {
    const a0: V2 = [N0[0] + (headO[0] - N0[0]) * (0.3 + i * 0.22), N0[1] + (headO[1] - N0[1]) * (0.3 + i * 0.22)];
    for (let j = -5; j <= 6; j++) sk.paint(a0[0] + Math.sin(j * 0.45) * 0.8, a0[1] + j * k * 0.9, M.fold, 0, neckPart);
  }
  const hz = P.turn ? 14 : 2;
  // far ear
  const earA = -2.2 + P.ear * 0.35 + P.earFlick * 0.3;
  sk.np();
  ear(sk, H.p(-5.5, -6.5), H.ang(earA - 0.25), 6 * k, 3 * k, M.skin, 0, hz - 9, -0.15, 1.1);
  sk.np();
  const skull = H.p(0, -0.5);
  sk.ell(skull[0], skull[1], 9 * k * hk, 8.4 * k * hk, bodyFill, { rot: H.a, rz: 8 * k * hk, z: hz });
  // broad muzzle
  const mz0 = H.p(5.5, 1.8), mz1 = H.p(14.5, 5);
  sk.tube([mz0, mz1], t => (7.2 - t * 1.8) * k * hk, (p) => (p.v > 0.5 ? M.lip : M.skin), { z: hz + 1 });
  // lower jaw
  const jA = H.ang(0.42 + P.jaw * 0.38);
  const j0 = H.p(3.5, 5.2);
  const j1: V2 = [j0[0] + Math.cos(jA) * 10 * k * hk, j0[1] + Math.sin(jA) * 10 * k * hk];
  if (P.jaw > 0.25) {
    const mA = H.p(6, 4.6);
    sk.poly([mA[0], mA[1], mz1[0], mz1[1] + 3.6 * k, j1[0], j1[1] - 1 * k], M.mouth, { z: hz + 1.5 });
  }
  sk.tube([j0, j1], t => (4 - t * 1.3) * k * hk, M.lip, { z: hz + 2 });
  // tusks (adults): short, curving up from the lower jaw
  if (!juv) {
    sk.np();
    for (const [side, zz] of [[-1, hz - 1], [1, hz + 10]] as [number, number][]) {
      const tb2: V2 = [j1[0] - Math.cos(jA) * 2.2 * k, j1[1] - Math.sin(jA) * 2.2 * k - 1 * k];
      const tip: V2 = [tb2[0] + 2.2 * k + side * 0.4, tb2[1] - 5.6 * k];
      sk.blade(tb2[0], tb2[1], tip[0], tip[1], s2 => (1 - s2 * 0.75) * 1.4 * k, (p) => (p.t < 0.2 ? M.boneD : M.tusk), { z0: zz, z1: zz + 1, bend: 0.9 * k, bias: side < 0 ? -0.15 : 0 });
    }
  }
  // bony facial shield: a weathered plate over the forehead and nasal ridge, a boss at the front
  sk.np();
  const boneFill = (p: Px) => {
    const cx = p.x / k, cy = p.y / k;
    if (p.v > 0.72) { p.l -= 0.05; return M.bone; }
    const crack = Math.sin(cx * 0.8 + Math.sin(cy * 1.2) * 1.8) + Math.sin(cy * 1.05 - cx * 0.45) * 0.7;
    const crack2 = Math.sin(cx * 1.7 - cy * 0.6 + Math.sin(cx * 0.5) * 2);
    if ((Math.abs(crack) < 0.12 || Math.abs(crack2) < 0.05) && p.v > -0.7 && p.v < 0.66) return M.boneD;
    if (p.v < -0.66) { p.l += 0.1; return M.bone; }
    if (hh(Math.floor(cx * 1.1), Math.floor(cy * 1.1), 23) < 0.05) p.l -= 0.28;
    if (p.v > 0.3 && hh(Math.floor(cx / 2), Math.floor(cy / 2), 29) < 0.35) p.l -= 0.12;
    return M.bone;
  };
  if (juv) {
    const nb = H.p(4, -5.2);
    sk.ell(nb[0], nb[1], 3.4 * k * hk, 2.2 * k * hk, boneFill, { rot: H.a - 0.3, z: hz + 8 * k * hk, rz: 2 * k });
  } else {
    // one continuous helmet from the brow over the nasal ridge, ending in a blunt boss
    const b0 = H.p(-2.2, -5.6), b1 = H.p(14.4, -0.6);
    const hwf = (s2: number) => (s2 < 0.12 ? 2.6 + s2 * 18 : 4.8 - (s2 - 0.12) * 2.4 + Math.sin(s2 * Math.PI) * 0.6) * k;
    sk.blade(b0[0], b0[1], b1[0], b1[1], hwf, boneFill, { z0: hz + 8.5 * k, z1: hz + 9 * k, bend: -1.4 * k, curl: 0.55 });
    const boss = H.p(13.6, -0.2);
    sk.ell(boss[0], boss[1], 3.2 * k, 3 * k, boneFill, { rot: H.a - 0.4, z: hz + 9.6 * k, rz: 2.2 * k });
    const br = H.p(0.4, -3.6);
    sk.ell(br[0], br[1], 3.8 * k, 2.4 * k, boneFill, { rot: H.a - 0.1, z: hz + 9.4 * k, rz: 1.6 * k });
  }
  // near ear, eye under the brow ridge
  sk.np();
  ear(sk, H.p(-6.2, -5.2), H.ang(earA), 6.4 * k, 3.2 * k, M.skin, M.inner, hz + 9, 0, 1.1);
  const ec = H.p(1.6, -0.9);
  const ep = drawEye(sk, ec[0], ec[1], { ...EYE, r: juv ? 1.2 : 1.5 }, eye);
  const ns = H.p(15.4, 2.4);
  sk.over(ns[0], ns[1], hex('#221a24'));
  sk.over(ns[0] - 1, ns[1], hex('#221a24'));
  const headTop = H.p(0, -9);

  drawLeg(0);
  drawLeg(2);

  // ---- mud and dust
  if (P.mud) {
    sk.np();
    sk.ell(0, -1, 50 * k, 3.5 * k, M.mudW, { z: 40, bias: 0.05 });
    for (let i = 0; i < 5; i++) {
      const x = (-30 + i * 14 + hh(i, 1, 3) * 4) * k;
      sk.ell(x, -3.5 * k, 2.2 * k, 1.2 * k, M.mud, { z: 41 });
    }
  }
  if (P.dust) {
    // soft kicked-up dust (semi-transparent overlay, no outline)
    for (let i = 0; i < 4; i++) {
      const ph = fr(P.dustPhase + i / 4);
      const cx = (-36 - ph * 24) * k, cy = (-3 - ph * 7 - (i % 2) * 2) * k;
      const r = (2.2 + ph * 3.4) * k;
      const a = Math.round(150 * (1 - ph * 0.7));
      for (let yy = Math.floor(cy - r); yy <= cy + r; yy++)
        for (let xx = Math.floor(cx - r); xx <= cx + r; xx++) {
          const d = Math.hypot(xx + 0.5 - cx, (yy + 0.5 - cy) * 1.25) / r;
          if (d > 1) continue;
          const c = d < 0.55 ? hex('#c8b394', a) : hex('#a8957a', Math.round(a * 0.7));
          sk.over(xx, yy, c);
        }
    }
  }
  return { head: [headTop[0], headTop[1] - 2] as V2, eye: ep };
}

export const BONEFACE: SpeciesDef = {
  name: 'Forest Boneface', kind: 'mammal', len: 100, height: 60,
  anims: ANIMS,
  canvas: (_a, juv) => (juv ? { w: 90, h: 64, ox: 42, oy: 54 } : { w: 150, h: 90, ox: 70, oy: 80 }),
  draw,
  eyeFor: (anim) => (anim === 'sleep' ? 'closed' : anim === 'alert' ? 'alert' : anim === 'charge' ? 'angry' : anim === 'wallow' ? 'closed' : 'open'),
};

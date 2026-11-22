// Forest Boneface (Osteoprosopus silvanus): a great, placid forest browser, built like a tapir crossed
// with a pygmy hippo and a chalicothere, with a face of solid bone.
//
// Painted from real large-browser anatomy on the Relief layer (beasts-relief.ts): every mass (the torso,
// the neck and head, each leg, the shield, ears, tusks, toes) is one continuous spline contour through
// hand-placed landmarks (withers, croup, buttock, belly, brisket, poll, boss, lip, chin, the front and back
// edge of every joint), shaded from the distance to its outline, with bone and muscle bumps, folds and
// hide texture as displacement, so every bone, muscle, fold and pebble of hide shades itself:
//   - the body: a deep barrel ribcage under a raised withers hump, the scapula's spine and the point of
//     the shoulder showing, a sagging belly, the hip bones (tuber coxae) standing out over a hollow
//     flank, a rounded rump with the point of the buttock, heavy triceps and thigh masses;
//   - thick hide: pebbled grain over a network of fine cracks, deep folds round the neck, behind the
//     shoulder, in the flank (stifle fold) and across every joint; slate-plum with a darker back, a
//     warmer pale belly and throat, cream dapples over the back and rump, and dried mud caked on the
//     lower legs;
//   - the head: a long, deep skull with a heavy jaw and a bulging masseter, a short prehensile upper lip
//     drooping over the lower one, small round ears rimmed white; and the shield: a fused plate of
//     weathered bone from the brow down the nasal ridge to a rugose boss over the nose, cracked,
//     pitted and lichen-spotted, raised in a bony rim round the deep-set eye; short lower tusks curving
//     up outside the lip;
//   - pillar legs with real joints: the elbow's point behind, the knobbed wrist, the stifle forward in
//     the flank, the hock's point behind; three-toed feet, each toe ending in a hoof-nail, a pad behind;
//   - a short tail with a dark tuft.
// Calves (variant 'juvenile', ~55%) are russet with broken cream stripes and spots, a bigger head, longer
// legs, a nub of a shield and no tusks.

import { Sk, V2, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, gait, TAU, hh, fr, ik2 } from './beasts-core';
import { Frame2 } from './beasts-rig';
import { Relief, Sp, Tx, LM, cell, domeH, W, spline, fringe, along, memoTex } from './beasts-relief';
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
      p.tilt = -0.06; p.by = 0;
      p.head = -0.18 + (f % 2) * 0.06; p.neck = -0.4;
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

const EYE: EyeSpec = { r: 1.5, iris: hex('#4a2c18'), lash: hex('#1c1418'), pupil: hex('#0c0808'), dark: true };

function mats(sk: Sk, juv: boolean) {
  const c = juv
    ? { skin: '#6c4632', skinD: '#4a2e22', belly: '#a07a5c', speck: '#ead6b0', fold: '#3e261c' }
    : { skin: '#5a4b60', skinD: '#3f3448', belly: '#8a767c', speck: '#a99aaa', fold: '#2e2634' };
  return {
    skin: sk.m(rmp(c.skin, { n: 8, dark: 0.66, light: 0.44, cool: 0.36, warm: 0.36, sat: 0.1 }), { edge: 1 }),
    skinD: sk.m(rmp(c.skinD, { n: 7, dark: 0.62, light: 0.42, cool: 0.3, warm: 0.3 }), { edge: 1 }),
    belly: sk.m(rmp(c.belly, { n: 7, dark: 0.6, light: 0.4, warm: 0.4 }), { edge: 1 }),
    speck: sk.m(rmp(c.speck, { n: 7, dark: 0.55, light: 0.4, at: 4 }), { edge: 1 }),
    fold: sk.m(rmp(c.fold, { n: 5, dark: 0.5, light: 0.3 }), { edge: 0 }),
    bone: sk.m(rmp('#dccdaa', { n: 8, dark: 0.62, light: 0.42, warm: 0.3, cool: 0.25, at: 5 }), { edge: 1 }),
    boneD: sk.m(rmp('#7e6c52', { n: 6, dark: 0.6, light: 0.3 }), { edge: 0 }),
    boneW: sk.m(rmp('#a8946e', { n: 7, dark: 0.6, light: 0.38 }), { edge: 1 }),
    scar: sk.m(rmp('#efe6d2', { n: 5, dark: 0.45, light: 0.3, at: 3 }), { edge: 0 }),
    lichen: sk.m(rmp('#9aa26a', { n: 5, dark: 0.5, light: 0.4 }), { edge: 0 }),
    tusk: sk.m(rmp('#efe2c0', { n: 6, dark: 0.5, light: 0.4, at: 3 }), { edge: 1 }),
    tuskB: sk.m(rmp('#a8905e', { n: 5, dark: 0.5 }), { edge: 1 }),
    hoof: sk.m(rmp('#3a3034', { n: 6, dark: 0.55, light: 0.45 }), { edge: 1 }),
    nail: sk.m(rmp('#a29682', { n: 6, dark: 0.55, light: 0.45 }), { edge: 1 }),
    lip: sk.m(rmp(juv ? '#7a5446' : '#6e5864', { n: 7, dark: 0.6, light: 0.4 }), { edge: 1 }),
    nose: sk.m(rmp('#2e2428', { n: 5, dark: 0.5, light: 0.5 }), { edge: 0 }),
    inner: sk.m(rmp('#9a7480', { n: 6, dark: 0.55, light: 0.35 }), { edge: 0 }),
    rim: sk.m(rmp('#e6dece', { n: 5, dark: 0.45, at: 3 }), { edge: 1 }),
    mouth: sk.m(rmp('#4e1e28', { n: 4, dark: 0.45 }), { edge: 0 }),
    tuft: sk.m(rmp('#2a2026', { n: 5, dark: 0.5, light: 0.4 }), { edge: 1 }),
    mud: sk.m(rmp('#4c3826', { n: 6, dark: 0.55, light: 0.35 }), { edge: 1 }),
    mudD: sk.m(rmp('#76644a', { n: 6, dark: 0.55, light: 0.35 }), { edge: 1 }),
    mudW: sk.m(rmp('#6a5236', { n: 4, dark: 0.5 }), { edge: 0 }),
  };
}

// element ids inside a relief (seams are drawn between different ids)
const ID = { BODY: 1, HEAD: 2, JAW: 3, SHIELD: 4, SOCKET: 5, LEG: 6, TAIL: 7, TOE: 8, NAIL: 12, PAD: 16, EAR: 17, INNER: 18, TUSK: 19 };

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const k = juv ? 0.55 : 1;
  const M = mats(sk, juv);
  sk.clipY = 0;
  const P = pose(anim, frame, n);
  const hk = juv ? 1.3 : 1.1, lk = juv ? 1.12 : 1;
  const lie = P.lie;
  const lieDrop = lie * (18.5 * lk - 1);
  const B = new Frame2([P.bx * k, (-39.5 * lk + P.by + lieDrop * 1.08 + (lk - 1) * 3) * k], P.tilt + P.roll, k);
  const inv = (x: number, y: number): V2 => {
    const dx = (x - B.o[0]) / k, dy = (y - B.o[1]) / k, c = Math.cos(-B.a), s = Math.sin(-B.a);
    return [dx * c - dy * s, dx * s + dy * c];
  };
  const bp = (x: number, y: number, sh = 0): LM => { const q = B.p(x, y); return [q[0], q[1], sh]; };
  const gk = Math.max(0.75, k); // texture grain never shrinks below ~2 px

  // ---------------------------------------------------------------- hide
  const vnoise = (x: number, y: number) => hh(Math.floor(x), Math.floor(y), 3) * 0.5 + hh(Math.floor(x * 0.5), Math.floor(y * 0.5), 4) * 0.5;
  /** the hide: pebbled grain, a fine crack network, the coat pattern, mud caked on the lower legs */
  const hide = (lx: number, ly: number, x: number, y: number, o: Tx, wr: number, worldY = -99) => {
    // pebbled grain
    cell(x, y, 3.2 * gk, 2.8 * gk, 11);
    o.z += (domeH(2.2) - 0.55) * 0.22;
    // sagging skin wrinkles running along the lower flank and round the legs, following the form
    if (!juv && ly > -6) {
      const wv = (ly - 6 * Math.cos(lx * 0.06)) / (4.2 * gk) + vnoise2(lx * 0.08, ly * 0.08) * 0.7;
      const f = wv - Math.floor(wv);
      const fade = Math.min(1, (ly + 6) / 8);
      if (f < 0.16 && hh(Math.floor(wv), Math.floor((lx + Math.floor(wv) * 5) / 12), 17) < 0.6) { o.z -= 0.9 * fade; o.t -= 0.03 * fade; }
    }
    // the crack network of thick hide, deepest on the neck, shoulders and legs
    if (wr > 0.45) {
      cell(x + 3, y * 1.15, 9 * gk, 7 * gk, 23, 0.9);
      if (W.f2 - W.f1 < 0.055) { o.z -= 0.9 * wr; o.t -= 0.03 * wr; }
    }
    o.m = M.skin;
    // dried mud caked up the legs to a ragged tide line
    if (!juv && worldY > -7.5 + Math.sin(x * 0.7) * 1.4 + hh(Math.floor(x / 2), 1, 5) * 2.8 - (hh(Math.floor(x / 3), 2, 6) < 0.25 ? 3 : 0)) {
      cell(x, y, 3, 2.5, 61, 0.9);
      const c = W.f2 - W.f1 < 0.12;
      o.m = c ? M.mud : M.mudD; o.z += c ? -0.6 : 0.3;
      return;
    }
    if (juv) {
      // tapir-calf pattern: broken cream stripe rows along the body, spots on the haunch and shoulder
      const sy = (ly + 40) / 7.2 + Math.sin(lx * 0.07) * 0.3 + (vnoise(lx * 0.15, ly * 0.15) - 0.5) * 0.3;
      const row = Math.floor(sy), st = sy - row;
      if (ly > -19 && ly < 9 && st < 0.3 && fr((lx + 60 + row * 4.3) / 13) < 0.8 && lx > -38 && lx < 26) { o.m = M.speck; return; }
      cell(lx + 40, ly + 40, 6.5, 6, 37, 0.7);
      if ((lx < -20 || (lx > 10 && lx < 24)) && ly > -12 && ly < 8 && W.ci < 0.45 && W.f1 < 0.24) { o.m = M.speck; return; }
      if (ly > 10) o.m = M.belly; else if (ly < -14) o.m = M.skinD;
      return;
    }
    const top = -20 + Math.cos((lx + 4) * 0.045) * 2;
    if (ly > 9.5 + Math.sin(lx * 0.2) * 1.5) { o.m = M.belly; o.t += 0.02; }
    else if (ly < top + 4.5 + Math.sin(lx * 0.3) * 0.8) o.m = M.skinD;
    // a thin dark line down the spine
    if (Math.abs(ly - top - 1.2) < 0.7 && lx > -40 && lx < 24) { o.m = M.fold; o.t += 0.1; return; }
    // dusky mottling over the flanks
    const mot = vnoise2(lx * 0.09 + 3, ly * 0.12);
    if (mot > 0.68 && ly > top + 4) { o.t -= 0.07; }
    // pale freckles thick over the rump and back, fading forward and down
    const dens = Math.max(0, Math.min(0.7, (-lx - 6) / 34)) * Math.max(0, Math.min(1, (6 - ly) / 14));
    if (dens > 0.02) {
      cell(lx + 50, ly + 50, 2.6, 2.4, 47, 0.95);
      if (W.ci < dens && W.f1 < 0.26) { o.m = M.speck; o.t += 0.02; }
    }
  };
  const vnoise2 = (x: number, y: number) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const a = hh(ix, iy, 51), b = hh(ix + 1, iy, 51), c = hh(ix, iy + 1, 51), d = hh(ix + 1, iy + 1, 51);
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
  };
  const mudLine = (lx: number) => 4 - P.roll * 30 + Math.sin(lx * 0.4) * 1.5 + hh(Math.floor(lx), 2, 9) * 1.5;
  const bodyTex = memoTex(sk, (p: Sp, o: Tx) => {
    const [lx, ly] = inv(p.x, p.y);
    if (P.mud && ly > mudLine(lx)) { o.m = ly > mudLine(lx) + 2 ? M.mud : M.mudW; o.t -= 0.04; o.z += (hh(Math.floor(p.x / 2), Math.floor(p.y / 2), 3) - 0.5) * 0.6; return; }
    const wr = 0.35 + Math.max(0, Math.min(1, (lx - 4) / 18)) * 0.65 + (lx < -24 ? 0.2 : 0);
    hide(lx, ly, p.x, p.y, o, wr, lie ? -99 : p.y);
  });
  const headTex = memoTex(sk, (p: Sp, o: Tx) => {
    cell(p.x, p.y, 2.2 * gk, 2 * gk, 13);
    o.z += (domeH(2.2) - 0.55) * 0.55;
    cell(p.x * 1.2, p.y, 5 * gk, 4.4 * gk, 29, 0.9);
    if (W.f2 - W.f1 < 0.07) { o.z -= 0.7; o.t -= 0.04; }
    o.m = M.skin;
    if (juv) { const [lx, ly] = inv(p.x, p.y); if (ly < -16 && lx > 20) o.m = M.skinD; }
  });

  // ---------------------------------------------------------------- skeleton (body-local px at k = 1)
  const SH: V2 = [21, -1], HIP: V2 = [-27, -4];
  const legJoints = (fore: boolean, near: boolean) => {
    const which = fore ? (near ? 0 : 1) : (near ? 2 : 3);
    const root = B.p(fore ? SH[0] - (near ? 0 : 2) : HIP[0] + (near ? 0 : 2), fore ? SH[1] : HIP[1]);
    const off = P.feet[which];
    const restX = (fore ? 21.5 : -23) + (near ? 0 : (fore ? -2.5 : 3));
    let foot: V2 = [(restX + off[0]) * k + P.bx * k, Math.min(0, off[1] * k)];
    const lifted = off[1] < -0.5 || P.air;
    const l1 = (fore ? 15 : 17.5) * lk * k, l2 = (fore ? 16.8 : 17.6) * lk * k, l3 = (fore ? 8.4 : 10.4) * lk * k;
    let ma = fore ? -Math.PI / 2 - 0.06 : -Math.PI / 2 - 0.4;
    if (lifted) ma += fore ? -0.9 : 0.35;
    if (lie) {
      if (fore) { foot = B.p(near ? 35 : 31, 17.5); ma = Math.PI + 0.2; }
      else { foot = B.p(near ? -11 : -14, 17.5); ma = Math.PI - 0.08; }
    }
    let mid: V2 = [foot[0] + Math.cos(ma) * l3, foot[1] + Math.sin(ma) * l3];
    if (lie && fore) mid = B.p(near ? 27 : 24, 16.5);
    const [j] = ik2(root, mid, l1, l2, fore ? 1 : -1);
    const fet: V2 = [foot[0] + (fore ? 0.4 : 1) * k * lk, foot[1] - (lie ? 0.8 : 2.6) * k * lk];
    return { root, j, mid, fet, foot, lifted, fore };
  };
  type LJ = ReturnType<typeof legJoints>;
  const kl = k * lk;

  /** the leg's outline: down the front edge, round the foot, up the back edge (landmarks) */
  const legOutline = (L: LJ): LM[] => {
    const { root, j, mid, fet } = L;
    const up: V2 = [root[0] - (j[0] - root[0]) * 0.55, root[1] - (j[1] - root[1]) * 0.55];
    const s = kl;
    if (L.fore) return [
      along(up, root, 1, 6 * s), along(root, j, 0.08, 7.6 * s), along(root, j, 0.6, 6.4 * s),
      along(j, mid, 0.06, 5.2 * s), along(j, mid, 0.45, 4.3 * s), along(j, mid, 0.86, 3.4 * s),
      along(mid, fet, 0.06, 4.1 * s), along(mid, fet, 0.35, 3.2 * s), along(mid, fet, 0.85, 3.2 * s),
      along(mid, fet, 1.12, 3.8 * s, 0.2), along(mid, fet, 1.22, -3.4 * s, 0.3),
      along(mid, fet, 0.8, -3 * s), along(mid, fet, 0.3, -2.9 * s), along(mid, fet, -0.02, -3.9 * s),
      along(j, mid, 0.8, -3.2 * s), along(j, mid, 0.32, -5.6 * s), along(j, mid, 0.04, -5.4 * s),
      along(j, mid, -0.16, -4.6 * s, 0.35), // the point of the elbow
      along(root, j, 0.55, -8.2 * s), along(root, j, 0.1, -9 * s), along(up, root, 0.6, -6 * s),
    ];
    return [
      along(up, root, 1, 8 * s), along(root, j, 0.12, 10 * s), along(root, j, 0.62, 8.2 * s),
      along(root, j, 0.97, 5.6 * s, 0.25), // the stifle (kneecap)
      along(j, mid, 0.14, 4.4 * s), along(j, mid, 0.55, 3.2 * s), along(j, mid, 0.93, 2.9 * s),
      along(mid, fet, 0.2, 3 * s), along(mid, fet, 0.8, 3 * s), along(mid, fet, 1.12, 3.6 * s, 0.2),
      along(mid, fet, 1.24, -3.3 * s, 0.3), along(mid, fet, 0.82, -3 * s), along(mid, fet, 0.3, -2.8 * s),
      along(j, mid, 1.08, -3.8 * s, 0.45), // the point of the hock
      along(j, mid, 0.78, -2.6 * s), along(j, mid, 0.42, -5.2 * s), along(j, mid, 0.12, -6.4 * s),
      along(root, j, 0.9, -7 * s), along(root, j, 0.5, -11 * s), along(root, j, 0.08, -11.5 * s), along(up, root, 0.5, -9 * s),
    ];
  };
  /** creases across a bone at t */
  const crease = (R: Relief, a: V2, b: V2, t: number, half: number, h: number, w = 1.2) => {
    const p0 = along(a, b, t, -half), p1 = along(a, b, t + 0.02, 0), p2 = along(a, b, t, half);
    R.line([[p0[0], p0[1]], [p1[0], p1[1]], [p2[0], p2[1]]], w * k, h * k, { fold: true });
  };
  /** joints, muscles and creases of one leg */
  const legForm = (R: Relief, L: LJ) => {
    const { root, j, mid, fet } = L, s = kl;
    if (L.fore) {
      const el = along(j, mid, -0.08, -3.8 * s); R.bump(el[0], el[1], 3.4 * s, 3 * s, 1.8 * s);           // olecranon
      const fl = along(j, mid, 0.3, -2.6 * s); R.bump(fl[0], fl[1], 3 * s, 5 * s, 1.2 * s, Math.atan2(mid[1] - j[1], mid[0] - j[0]) + 1.57); // flexors
      const ex = along(j, mid, 0.25, 2.2 * s); R.bump(ex[0], ex[1], 2.4 * s, 5 * s, 0.9 * s, Math.atan2(mid[1] - j[1], mid[0] - j[0]) + 1.57); // extensors
      const ca = along(mid, fet, 0.04, 1.6 * s); R.bump(ca[0], ca[1], 3.2 * s, 2.8 * s, 1.4 * s);           // carpus
      const tr = along(root, j, 0.55, -4 * s); R.bump(tr[0], tr[1], 5 * s, 6 * s, 1.6 * s);                  // triceps
      for (const t of [0.78, 0.86]) crease(R, j, mid, t, 3.2 * s, -0.8);
      for (const t of [0.12, 0.22]) crease(R, mid, fet, t, 3.4 * s, -0.8);
    } else {
      const pt = along(root, j, 0.95, 3.6 * s); R.bump(pt[0], pt[1], 2.6 * s, 2.4 * s, 1.4 * s);            // patella
      const gc = along(j, mid, 0.25, -3 * s); R.bump(gc[0], gc[1], 3.6 * s, 5 * s, 1.6 * s, Math.atan2(mid[1] - j[1], mid[0] - j[0]) + 1.57); // calf
      const hk2 = along(j, mid, 1.02, -2.2 * s); R.bump(hk2[0], hk2[1], 2.4 * s, 2.4 * s, 1.5 * s);          // calcaneus
      const qd = along(root, j, 0.5, 4 * s); R.bump(qd[0], qd[1], 5 * s, 7 * s, 1.4 * s);                    // quadriceps
      const hm = along(root, j, 0.45, -6 * s); R.bump(hm[0], hm[1], 6 * s, 8 * s, 1.8 * s);                  // hamstrings
      R.line([[along(root, j, 0.15, -1)[0], along(root, j, 0.15, -1)[1]], [along(root, j, 0.75, -1.5 * s)[0], along(root, j, 0.75, -1.5 * s)[1]]], 1.6 * k, -0.8 * k, { fold: true });
      for (const t of [0.8, 0.9]) crease(R, j, mid, t, 3 * s, -0.7);
      for (const t of [0.15, 0.25]) crease(R, mid, fet, t, 3 * s, -0.8);
    }
  };
  /** the foot: three toes each capped by a hoof-nail, the middle one largest, and the heel pad */
  const foot = (R: Relief, L: LJ, z0: number, near: boolean) => {
    const { fet } = L;
    const lifted = L.lifted;
    const dir = lie && L.fore ? 1 : 1;
    const gy = lie ? fet[1] + 2.4 * kl : (lifted ? fet[1] + 2.6 * kl : -0.2);
    const tilt = lifted ? (L.fore ? 0.9 : 0.4) : 0;
    const rot = (x: number, y: number, sh = 0): LM => {
      const c = Math.cos(tilt), sn = Math.sin(tilt);
      return [fet[0] + (x * c - y * sn) * kl * dir, fet[1] + (x * sn + y * c) * kl, sh];
    };
    const g = (gy - fet[1]) / kl; // ground below the fetlock, in foot units
    // heel pad
    {
      const pts: LM[] = [rot(-3.4, -0.6), rot(-1.2, -0.2), rot(-0.6, g), rot(-3.8, g - 0.3)];
      R.region(spline(pts, 0.7), { z: z0 - 0.5, R: 1.2, H: 1.4, id: ID.PAD, tex: M.hoof, lt: -0.08 });
    }
    // toes: far side first so the nearer overlap
    const toes: [number, number, number, number][] = near ? [[2, 1.6, 3.6, 1.8], [0, -1.6, 3.4, 1.8], [1, 0.1, 4.6, 2.2]] : [[0, -1.6, 3.4, 1.8], [2, 1.6, 3.6, 1.8], [1, 0.1, 4.6, 2.2]];
    for (const [ti, ox, len, r] of toes) {
      const zt = z0 + (ti === 1 ? 1.2 : ti === (near ? 2 : 0) ? 0 : 0.8);
      const x0 = ox * 0.6 - 0.8, tip = x0 + len;
      const pts: LM[] = [rot(x0 - 0.6, -r * 0.9), rot(x0 + len * 0.45, -r * 0.95), rot(tip, g - r * 1.05, 0.2), rot(tip + 0.2, g - 0.2, 0.4), rot(x0 + 0.4, g), rot(x0 - 0.8, g - r * 0.6)];
      R.region(spline(pts, 0.6), { z: zt, R: 1.4, H: 1.8, id: ID.TOE + ti, tex: (p, o) => { hide(0, 0, p.x, p.y, o, 1, lie ? -99 : p.y); } });
      // the hoof-nail: a pale-edged dark cap on the end of the toe
      const nl: LM[] = [rot(tip - r * 0.9, g - r * 1.25), rot(tip + 0.35, g - r * 0.9, 0.3), rot(tip + 0.5, g - 0.1, 0.5), rot(tip - r * 0.8, g + 0.1, 0.3), rot(tip - r * 1.15, g - r * 0.55)];
      R.region(spline(nl, 0.5), { z: zt + 0.6, R: 0.9, H: 1.2, id: ID.NAIL + ti, tex: (p, o) => { o.m = p.v > 0.6 ? M.nail : M.hoof; if (p.u > 0.55) o.t += 0.06; } });
    }
  };

  // ---------------------------------------------------------------- the far legs, behind the body
  for (const fore of [false, true]) {
    const L = legJoints(fore, false);
    const ol = legOutline(L);
    const R = new Relief(sk, Math.min(...ol.map(q => q[0])) - 8 * k, Math.min(...ol.map(q => q[1])) - 4 * k, Math.max(...ol.map(q => q[0])) + 8 * k, 1);
    const z0 = -14;
    R.region(spline(ol, 1), { z: z0, R: 4 * kl, H: 5 * kl, id: ID.LEG, tex: bodyTex });
    legForm(R, L);
    if (!(lie && fore)) foot(R, L, z0 + 4, false);
    sk.np();
    R.emit({ bias: -0.16, drop: 2 * k, seam: 0.8 * k, seamDark: 0.3, ao: 0.08, aoR: 2 });
  }

  // ---------------------------------------------------------------- neck and head frames
  const N0 = B.p(26, -7);
  let H: Frame2;
  if (P.turn) {
    // nibbling the near shoulder: head swung down and back in front of the chest
    H = new Frame2(B.p(31, 2), B.a + 1.95 + P.head, k * hk);
  } else {
    const nA = B.a + P.neck - 0.12;
    const nL = (12 - Math.max(0, -P.neck - 0.3) * 6) * k;
    H = new Frame2([N0[0] + Math.cos(nA) * nL, N0[1] + Math.sin(nA) * nL - 2.5 * k], B.a + P.neck * 0.6 + P.head, k * hk);
  }
  const HK = k * hk;
  const hz = (P.turn ? 18 : 5) * k;
  const hp = (x: number, y: number, sh = 0): LM => { const q = H.p(x, y); return [q[0], q[1], sh]; };
  const jawA = P.jaw * 0.3;
  const hinge: V2 = [0.5, 6];
  const jp = (x: number, y: number, sh = 0): LM => {
    const dx = x - hinge[0], dy = y - hinge[1], c = Math.cos(jawA), s = Math.sin(jawA);
    const q = H.p(hinge[0] + dx * c - dy * s, hinge[1] + dx * s + dy * c);
    return [q[0], q[1], sh];
  };

  // ---------------------------------------------------------------- the body relief
  const BR = Relief.full(sk);
  // the tail: thick at the root, tapering, hanging, a dark bristly tuft
  {
    const tA = B.ang(Math.PI * 0.62 - P.tail * 0.6);
    const tb = B.p(-44, -8);
    const c = Math.cos(tA), s = Math.sin(tA), nx = -s, ny = c;
    const pt = (t: number, w: number): LM => [tb[0] + c * t * 14 * k + nx * w * k + (t * t) * 2 * k, tb[1] + s * t * 14 * k + ny * w * k, 0];
    const tl: LM[] = [pt(-0.15, 3.4), pt(0.3, 2.4), pt(0.62, 1.6), pt(0.8, 2.4), pt(1.02, 1.2), pt(1.12, 0), pt(1.0, -1.4), pt(0.8, -2.2), pt(0.62, -1.5), pt(0.3, -2.2), pt(-0.15, -3.4)];
    const poly = fringe(spline(tl, 0.7), 1.6, 5, (x, y) => { const d = Math.hypot(x - tb[0], y - tb[1]) / (14 * k); return d > 0.66 ? [1.6 * k + 0.6, 0.4] : null; });
    BR.region(poly, { z: 2 * k, R: 2.2 * k, H: 3 * k, id: ID.TAIL, blend: 1.5 * k, tex: (p, o) => {
      bodyTex(p, o);
      const d = Math.hypot(p.x - tb[0], p.y - tb[1]) / (14 * k);
      if (d > 0.64) { o.m = M.tuft; o.z += (hh(Math.floor(p.x * 1.3 + p.y), 1, 3) - 0.5) * 1.2; }
    } });
  }
  // the torso: one contour from the tail root over the croup, back and withers, down the chest, along
  // the belly and up round the thigh and buttock
  const jig = P.jig, brr = P.br;
  const torso: LM[] = [
    bp(-43, -12.5), bp(-37.5, -18.4), bp(-29, -21.6), bp(-21, -21), bp(-12, -19.2), bp(-2, -19.8 - brr * 0.2),
    bp(6, -22.2), bp(12.5, -24.6), bp(18.5, -23.6), bp(25, -17), bp(31, -8),
    bp(33.6, 1.5), bp(32.5, 8.5), bp(28.5, 14.6), bp(21, 16.4),
    bp(10, 16.6 + brr * 0.3), bp(-2, 17.8 + jig * 0.7 + brr * 0.4), bp(-12, 16.4 + jig * 0.5), bp(-18.5, 12.6),
    bp(-25, 14), bp(-35, 12.4), bp(-42.5, 6.5), bp(-46.6, -1), bp(-46.2, -7.2),
  ];
  BR.region(spline(torso, 1), { z: 0, R: 21 * k, H: 17 * k, id: ID.BODY, tex: bodyTex, pow: 0.85 });
  // the near legs, fused into the body at the shoulder and the hip
  const FLn = legJoints(true, true), HLn = legJoints(false, true);
  for (const L of [HLn, FLn]) {
    const zl = 11 * k;
    const ax = L.root, ay = L.fet, al = Math.hypot(ay[0] - ax[0], ay[1] - ax[1]) || 1;
    BR.region(spline(legOutline(L), 1), {
      R: 4.4 * kl, H: 6 * kl, id: ID.LEG, blend: 2.5 * k, tex: bodyTex,
      zAt: (x, y) => {
        const t = ((x - ax[0]) * (ay[0] - ax[0]) + (y - ax[1]) * (ay[1] - ax[1])) / (al * al);
        return zl - Math.max(0, 1 - (t + 0.1) / 0.5) * 11 * k;
      },
    });
    legForm(BR, L);
    if (!(lie && L.fore)) foot(BR, L, zl + 5 * kl, true);
  }

  // the neck and head: one contour from inside the shoulders, up the crest of the neck, over the
  // poll and the shield line to the boss and the lip, back along the jaw and down the throat
  {
    const nTop0: V2 = B.p(17, -21.6), poll = H.p(-3.5, -8.4);
    const crest = (t: number): LM => {
      const c: V2 = [(nTop0[0] + poll[0]) / 2 - 1 * k, (nTop0[1] + poll[1]) / 2 - 3.2 * k];
      const u = 1 - t;
      return [u * u * nTop0[0] + 2 * u * t * c[0] + t * t * poll[0], u * u * nTop0[1] + 2 * u * t * c[1] + t * t * poll[1], 0];
    };
    const thr0 = H.p(-5.5, 10.5), chest0 = B.p(32.5, 2);
    const dew = (t: number): LM => {
      const c: V2 = [(thr0[0] + chest0[0]) / 2 + 1 * k, (thr0[1] + chest0[1]) / 2 + 4.5 * k];
      const u = 1 - t;
      return [u * u * thr0[0] + 2 * u * t * c[0] + t * t * chest0[0], u * u * thr0[1] + 2 * u * t * c[1] + t * t * chest0[1], 0];
    };
    const lipOpen = P.jaw * 1.2;
    const neckHead: LM[] = [
      bp(10, -12), crest(0), crest(0.3), crest(0.62), crest(0.86),
      hp(-6.4, -5.8), hp(-2.6, -9), hp(3.5, -10.4), hp(9.8, -10.6), hp(16, -9.2), hp(22, -8.8), hp(26.5, -7.6),
      hp(29.6, -4.5, 0.3), hp(29.8, -1.4, 0.2), hp(32.6, 0.6), hp(35.2, 3.6 - lipOpen * 0.3, 0.25), hp(34.4, 7 - lipOpen * 0.2), hp(31, 8.4, 0.2),
      jp(29, 9.6), jp(26.6, 12.6), jp(19, 13.8), jp(10, 14.4), jp(3, 13.6), jp(-2, 11, 0.15),
      dew(0), dew(0.3), dew(0.6), dew(0.85), dew(1), bp(24, 2), bp(16, -4),
    ];
    // a bristly mane along the crest of the neck
    const nh = fringe(spline(neckHead, 1), 1.7, 9, (x, y, nx, ny) => {
      const [lx, ly] = inv(x, y);
      if (ny > -0.3 || lx < 14) return null;
      const hx = (x - H.o[0]) * Math.cos(-H.a) - (y - H.o[1]) * Math.sin(-H.a);
      if (hx > -1 * HK) return null;
      return [(1.5 + Math.max(0, -ly - 18) * 0.05) * k + 0.5, 0.75];
    });
    const no = N0, hO = H.o, nl = Math.hypot(hO[0] - no[0], hO[1] - no[1]) || 1;
    BR.region(nh, {
      R: 7 * k, H: 8 * k, id: ID.HEAD, blend: 4 * k, tex: (p, o) => {
        const t = ((p.x - no[0]) * (hO[0] - no[0]) + (p.y - no[1]) * (hO[1] - no[1])) / (nl * nl);
        if (t < 0.85) bodyTex(p, o); else headTex(p, o);
        // the lip: the tip of the muzzle
        const hx = (p.x - H.o[0]) * Math.cos(-H.a) - (p.y - H.o[1]) * Math.sin(-H.a);
        const hy = (p.x - H.o[0]) * Math.sin(-H.a) + (p.y - H.o[1]) * Math.cos(-H.a);
        if (hx / HK > 29.5 && hy / HK > -0.6) { o.m = hx / HK > 33.4 && hy / HK > 1.4 && hy / HK < 6 ? M.nose : M.lip; if (fr(hx / HK * 0.8) < 0.24) o.z -= 0.7; }
      },
      zAt: (x, y) => {
        const t = Math.max(0, Math.min(1, ((x - no[0]) * (hO[0] - no[0]) + (y - no[1]) * (hO[1] - no[1])) / (nl * nl)));
        return 2 * k + (hz - 2 * k) * t;
      },
    });
    // the lower jaw: deep at its angle, hinged under the ear, a step below the upper lip
    if (P.jaw > 0.2) {
      const a = H.p(11, 7), b = H.p(30, 8.2), c = jp(27, 11);
      const mouth: LM[] = [[a[0], a[1], 0], [b[0], b[1], 0], [c[0], c[1], 0], jp(14, 10.5)];
      BR.region(spline(mouth, 0.8), { z: hz - 1, R: 1, H: 1, id: ID.SOCKET, tex: M.mouth, lt: -0.2 });
    }
    const jaw: LM[] = [jp(-2, 11, 0.15), jp(1, 6.5), jp(6, 5.6), jp(13, 7.2), jp(21, 8.4), jp(28.6, 9.1, 0.3), jp(29, 9.6), jp(26.6, 12.6), jp(19, 13.8), jp(10, 14.4), jp(3, 13.6)];
    BR.region(spline(jaw, 0.8), { z: hz - 0.6 * k, R: 3.4 * HK, H: 7.4 * HK, id: ID.JAW, blend: 0.8 * k, tex: (p, o) => { headTex(p, o); if (p.v > 0.62 && p.u > 0.7) o.m = M.lip; } });
  }
  // the shield (adults): a plate of fused, weathered bone over the brow, the nasal ridge and the boss,
  // raised in a rim round the eye and flaring at the poll into a short crown of knobs; a nub on calves
  const eyeH: V2 = [10.6, -1.6];
  const shieldTex = (p: Sp, o: Tx) => {
    o.m = M.bone;
    // fused plates, each gently domed, the sutures between them dark grooves
    cell(p.x * 0.9 + 7, p.y * 1.1, 7 * gk, 5.4 * gk, 73, 0.95);
    const cr = W.f2 - W.f1;
    o.z += (Math.min(1, cr * 2.2) - 0.5) * 1.3;
    if (cr < 0.07) { o.z -= 1.2; o.m = M.boneD; return; }
    // fine grain and a few deep pits
    cell(p.x, p.y, 2.2 * gk, 2 * gk, 71);
    o.z += (domeH(2) - 0.5) * 0.35;
    cell(p.x, p.y, 3.6 * gk, 3.3 * gk, 79);
    if (W.ci < 0.16 && W.f1 < 0.18) { o.z -= 1; o.m = M.boneW; return; }
    // sun-bleached on top, stained down the sides; lichen in the hollows
    if (p.v > 0.6) o.m = M.boneW;
    cell(p.x + 2, p.y + 1, 4.4 * gk, 3.8 * gk, 83);
    if (W.ci < 0.1 && W.f1 < 0.3 && p.v < 0.45) o.m = M.lichen;
  };
  if (juv) {
    const nub: LM[] = [hp(3, -9.6), hp(9, -10.9), hp(14.5, -9.2), hp(12, -6.6), hp(5, -6.8)];
    BR.region(spline(nub, 0.6), { z: hz + 6.5 * HK, R: 1.4 * HK, H: 1.6 * HK, id: ID.SHIELD, tex: shieldTex, pow: 0.7 });
  } else {
    const sh: LM[] = [
      hp(-6.6, -7.6, 0.4), hp(-5.2, -11.4, 0.5), hp(-2.6, -9.8), hp(-0.6, -12.2, 0.5), hp(2.4, -10.9), hp(9.8, -11.3), hp(16, -9.8), hp(22, -9.4), hp(27, -8.2),
      hp(30.4, -4.8, 0.3), hp(30.6, -1, 0.3), hp(28.4, 1.2), hp(23.5, 0.2), hp(18, 0.6),
      hp(eyeH[0] + 4.4, eyeH[1] + 3.6), hp(eyeH[0] + 0.5, eyeH[1] + 5.6), hp(eyeH[0] - 4, eyeH[1] + 5), hp(eyeH[0] - 6.4, eyeH[1] + 2.8),
      hp(1, -2.6), hp(-3, -4.4),
    ];
    BR.region(spline(sh, 0.6), { z: hz + 7.6 * HK, R: 1.8 * HK, H: 1.8 * HK, id: ID.SHIELD, tex: shieldTex, pow: 0.7 });
    // healed scars: two pale fang rakes across the plate
    for (const [x0, y0, x1, y1] of [[13, -9, 19, -4.2], [16, -9.4, 21.6, -5.4]]) {
      const a = H.p(x0, y0), b = H.p(x1, y1);
      BR.line([a, [(a[0] + b[0]) / 2 + 0.4, (a[1] + b[1]) / 2], b], 0.9 * k, -0.9 * k, { only: ID.SHIELD });
      for (let t = 0.15; t < 0.9; t += 0.12) { const q = BR.at(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t); if (q >= 0 && BR.id[q] === ID.SHIELD) BR.m[q] = M.scar; }
    }
    // the boss: rugose knobs
    for (const [x, y, r] of [[26.5, -5.4, 2.4], [28.4, -2.6, 1.8], [23.6, -6.6, 1.7], [-3.6, -10.2, 1.5], [-0.4, -10.6, 1.3]]) { const c = H.p(x, y); BR.bump(c[0], c[1], r * HK, r * HK, 1.3 * HK, 0, ID.SHIELD); }
    // the brow ridge over the orbit
    BR.line([hp(eyeH[0] - 4.8, eyeH[1] - 2.8) as V2, hp(eyeH[0], eyeH[1] - 4) as V2, hp(eyeH[0] + 4.4, eyeH[1] - 2.6) as V2].map(q => [q[0], q[1]] as V2), 2 * HK, 1.2 * HK, { only: ID.SHIELD });
  }
  // the eye socket: a dark hollow ringed by the bone
  {
    const so: LM[] = [hp(eyeH[0] - 3.4, eyeH[1] + 0.4), hp(eyeH[0] - 0.8, eyeH[1] - 2.6), hp(eyeH[0] + 3, eyeH[1] - 1.4), hp(eyeH[0] + 3.2, eyeH[1] + 2), hp(eyeH[0] - 0.4, eyeH[1] + 3.2)];
    BR.region(spline(so, 0.5), { z: hz + (juv ? 7 : 8.2) * HK, R: 1.2, H: 0.6, id: ID.SOCKET, tex: (p, o) => { o.m = M.skinD; o.t = -0.14 + (p.v > 0.6 ? 0.06 : 0); } });
  }
  // ---- form under the hide
  const bb = (x: number, y: number, rx: number, ry: number, h: number, rot = 0, only = 0) => { const c = B.p(x, y); BR.bump(c[0], c[1], rx * k, ry * k, h * k, B.a + rot, only); };
  const bl = (pts: V2[], w: number, h: number, fold = false) => BR.line(pts.map(q => B.p(q[0], q[1])), w * k, h * k, { fold });
  // big masses: ribcage barrel, haunch, shoulder, withers, belly
  bb(4, -4, 22, 15, 5); bb(-30, -6, 15, 14, 4.5); bb(19, -4, 10, 14, 4, -0.45); bb(12, -15, 12, 6, 2.5, -0.3); bb(-6, 9, 18, 8, 2.5);
  bl([[9, -19], [14, -10], [19, -2]], 2.4, 1.2);          // spine of the scapula
  bb(28, 0, 4.5, 4, 1.8);                                 // point of the shoulder
  bb(-21, -15, 4.2, 3.6, 2.6);                            // hip bone (tuber coxae)
  bb(-44, -4, 3.4, 4, 1.8);                               // point of the buttock
  bb(-14, -7, 6, 5, -2);                                  // flank hollow
  for (let i = 0; i < 3; i++) { const x = 3 - i * 5.5; bl([[x, -8 + i * 0.5], [x - 2.4, -1], [x - 3.4, 6]], 2.4, 0.55); } // the last ribs, faint
  // folds: the great fold behind the shoulder, the stifle fold, the elbow, the belly, the throat
  bl([[8, -16], [9.5, -6], [8.5, 3], [10.5, 11]], 2.2, -1.6, true);
  bl([[-13, -6], [-15.5, 2], [-15, 9], [-17, 13]], 2, -1.4, true);
  bl([[-5, 14], [5, 15.5]], 1.6, -0.8, true);
  bl([[-24, 9], [-30, 11]], 1.4, -0.7, true);
  // the neck: deep ring folds
  for (let i = 0; i < 4; i++) {
    const t = 0.2 + i * 0.2;
    const c: V2 = [N0[0] + (H.o[0] - N0[0]) * t, N0[1] + (H.o[1] - N0[1]) * t];
    const a = Math.atan2(H.o[1] - N0[1], H.o[0] - N0[0]) + Math.PI / 2;
    const r = (11 - t * 3) * k;
    BR.line([[c[0] - Math.cos(a) * r * 0.95, c[1] - Math.sin(a) * r * 0.95], [c[0] + Math.sin(a) * 1.4 * k, c[1] - Math.cos(a) * 1.4 * k], [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]], 1.8 * k, -1.3 * k, { fold: true });
  }
  // the head's form: the masseter, the cheek, the muzzle's wrinkles, the chin
  { const c = H.p(4, 5.6); BR.bump(c[0], c[1], 6 * HK, 4.6 * HK, 2.2 * HK, H.a + 0.3); }
  { const c = H.p(25.5, 3); BR.bump(c[0], c[1], 5 * HK, 4 * HK, 1.4 * HK, H.a); }
  { const c = jp(25.5, 11.6); BR.bump(c[0], c[1], 3 * HK, 2.2 * HK, 1.2 * HK); }
  for (const x of [30.5, 32.2]) BR.line([hp(x, 1.4) as unknown as V2, hp(x + 0.6, 4.4) as unknown as V2, hp(x, 7.2) as unknown as V2].map(q => [q[0], q[1]] as V2), 0.9 * k, -0.7 * k);
  BR.line([hp(-3, 0), hp(3, 1.4), hp(7, 2.6)].map(q => [q[0], q[1]] as V2), 1.4 * HK, -0.8 * k, { fold: true });
  // cast shadows: the jaw on the throat, the near legs on the belly and chest
  BR.shadow(ID.JAW, 1.2 * k, 2.4 * k, 0.12, ID.HEAD, 2);
  BR.shadow(ID.SHIELD, 1 * k, 1.6 * k, 0.14, ID.HEAD, 1);
  BR.shadow(ID.SHIELD, 1 * k, 1.6 * k, 0.14, ID.JAW, 1);
  BR.shadow(ID.LEG, 2 * k, 1.2 * k, 0.1, ID.BODY, 2);
  BR.shadow(ID.HEAD, 1.5 * k, 2 * k, 0.08, ID.BODY, 2);
  sk.np();
  BR.emit({ drop: 2.2 * k, seam: 1.1 * k, seamDark: 0.34, ao: 0.07, aoR: 3 });

  // ---------------------------------------------------------------- ears: small, round, mobile, white-rimmed
  const earA = -2.2 + P.ear * 0.35 + P.earFlick * 0.3;
  const ear = (near: boolean) => {
    const b = H.p(near ? -3 : -1.4, near ? -7 : -8);
    const R = new Relief(sk, b[0] - 10 * HK, b[1] - 10 * HK, b[0] + 10 * HK, b[1] + 10 * HK);
    const a = H.ang(earA - (near ? 0 : 0.3));
    const c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
    const L = 7.6 * HK, Wd = 2.9 * HK;
    const pt = (t: number, w: number, sh = 0): LM => [b[0] + c * t * L + nx * w * Wd, b[1] + s * t * L + ny * w * Wd, sh];
    const outline: LM[] = [pt(-0.1, -0.5), pt(0.3, -0.85), pt(0.72, -0.85), pt(0.97, -0.3, 0.15), pt(0.95, 0.3), pt(0.66, 0.8), pt(0.25, 0.68), pt(-0.1, 0.45)];
    const zE = hz + (near ? 15 : -6) * k;
    const poly = fringe(spline(outline, 0.6), 1.2, near ? 3 : 4, (x, y) => (Math.hypot(x - b[0], y - b[1]) > L * 0.55 ? [0.9, 0.3] : null));
    R.region(poly, { z: zE, R: 1.4 * HK, H: 2 * HK, id: ID.EAR, tex: (p, o) => {
      const dx = p.x - b[0], dy = p.y - b[1], t = (dx * c + dy * s) / L, w = (dx * nx + dy * ny) / Wd;
      const outer = t > 0.55;
      if (p.s < 0.9 && outer) { o.m = M.rim; o.z += 0.3; return; }
      o.m = M.skinD;
      // the inner ear: a pinkish hollow with a ridge or two, seen on the near ear
      if (near && t > 0.14 && t < 0.86 && Math.abs(w - 0.05) < 0.55 * Math.sin(Math.PI * Math.min(1, (t - 0.1) / 0.8))) {
        o.m = M.inner; o.z -= 0.9; if (fr(t * 3.2) < 0.22) o.z += 0.6;
      }
    } });
    sk.np();
    R.emit({ bias: near ? 0 : -0.14, drop: 1.6 * k, seam: 0.5, seamDark: 0.25 });
  };
  ear(false);
  ear(true);
  // ---------------------------------------------------------------- tusks (adults): yellowed lower canines curving up outside the lip
  if (!juv) {
    for (const near of [false, true]) {
      const b = jp(near ? 22 : 23.4, 8.2);
      const R = new Relief(sk, b[0] - 12 * HK, b[1] - 14 * HK, b[0] + 12 * HK, b[1] + 4 * HK);
      const tipv = jp(near ? 25.6 : 26.8, -1.6 - P.jaw * 2);
      const mid: V2 = [(b[0] + tipv[0]) / 2 + 1.6 * HK, (b[1] + tipv[1]) / 2 + 0.2 * HK];
      const dirx = tipv[0] - b[0], diry = tipv[1] - b[1], dl = Math.hypot(dirx, diry) || 1, nx = diry / dl, ny = -dirx / dl;
      const w0 = 1.5 * HK, w1 = 1.1 * HK;
      const outline: LM[] = [
        [b[0] - nx * w0, b[1] - ny * w0, 0], [mid[0] - nx * w1, mid[1] - ny * w1, 0], [tipv[0], tipv[1], 0.6],
        [mid[0] + nx * w1 * 0.8, mid[1] + ny * w1 * 0.8, 0], [b[0] + nx * w0, b[1] + ny * w0, 0],
      ];
      R.region(spline(outline, 0.5), { z: hz + (near ? 11 : -3) * k, R: 1 * HK, H: 1.4 * HK, id: ID.TUSK, tex: (p, o) => {
        const t = Math.hypot(p.x - b[0], p.y - b[1]) / dl;
        o.m = t < 0.25 ? M.tuskB : M.tusk;
        if (fr(t * 5) < 0.12 && t > 0.3) o.z -= 0.4; // growth rings
        if (t > 0.82) o.t += 0.05; // worn polished tip
      } });
      sk.np();
      R.emit({ bias: near ? 0 : -0.14, drop: 1.4, seam: 0.5 });
    }
  }
  // the eye, deep in its bony socket; the nostril
  const ec = H.p(eyeH[0] + 0.1, eyeH[1] + 0.2);
  const ep = drawEye(sk, ec[0], ec[1], { ...EYE, r: juv ? 1.2 : 1.5 }, eye);
  const ns = H.p(33.6, 2.6);
  sk.over(ns[0], ns[1], hex('#1a1216'));
  sk.over(ns[0] - 1, ns[1] + 1, hex('#1a1216'));
  const headTop = H.p(0, -12);

  // ---------------------------------------------------------------- mud and dust
  if (P.mud) {
    sk.np();
    sk.ell(0, -1, 52 * k, 3.5 * k, M.mudW, { z: 40, bias: 0.05 });
    for (let i = 0; i < 6; i++) {
      const x = (-34 + i * 13 + hh(i, 1, 3) * 4) * k;
      sk.ell(x, -3.2 * k, 2.4 * k, 1.2 * k, M.mud, { z: 41 });
    }
  }
  if (P.dust) {
    for (let i = 0; i < 4; i++) {
      const ph = fr(P.dustPhase + i / 4);
      const cx = (-36 - ph * 24) * k, cy = (-3 - ph * 7 - (i % 2) * 2) * k;
      const r = (2.2 + ph * 3.4) * k;
      const a = Math.round(150 * (1 - ph * 0.7));
      for (let yy = Math.floor(cy - r); yy <= cy + r; yy++)
        for (let xx = Math.floor(cx - r); xx <= cx + r; xx++) {
          const d = Math.hypot(xx + 0.5 - cx, (yy + 0.5 - cy) * 1.25) / r;
          if (d > 1 || (hh(xx, yy, i) < 0.3 && d > 0.6)) continue;
          sk.over(xx, yy, d < 0.55 ? hex('#c8b394', a) : hex('#a8957a', Math.round(a * 0.7)));
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

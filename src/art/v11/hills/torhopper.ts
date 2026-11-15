// Torhopper: the Rocky Hills' rock-hopping grazer. A compact, goat-sized mammal standing high on slender
// legs with rubbery cup-hooves (it walks on the tips of them, like a klipspringer); a dense, grizzled
// tawny-grey wool that matches granite and dry tussock; a cream belly; a black-and-white face mask;
// a pair of ridged keratin brow-shields swept back over the skull (rams butt with them); and, against
// the serpents that strike from the rocks, a keel of small overlapping bony scutes along the spine.
// Painted on the Relief layer (beasts-relief.ts): one continuous contour per body mass from hand-placed
// landmarks (the withers, the rump, the brisket, every joint's front and back edge), shaded from the
// distance to it plus the shoulder, haunch and ribs, the wool lying in locks with grizzled tips, wool
// tufts breaking the outline, knobbly knees, the hock's point, dew-claws and the cup hooves.
// Anims: idle, walk, run, eat (grazing), alert (sentinel on a rock), leap (the rock hop: gathered on
// frames 0-1, stretched out on 2-3), call (the whistle), sleep (folded up), play (the butting clash).

import { Sk, V2, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, gait, TAU, hh, fr, ik2 } from '../../beasts-core';
import { Frame2 } from '../../beasts-rig';
import { Relief, Sp, Tx, LM, spline, fringe, along, strands, FS, memoTex } from '../../beasts-relief';
import { hex } from '../../color';

interface P {
  bx: number; by: number; tilt: number; br: number;
  feet: [V2, V2, V2, V2];
  neck: number; head: number; jaw: number; ear: number; tail: number;
  fold: number;      // 0 standing .. 1 folded down (sleep)
  leap: number;      // 0 none, 1 gathered, 2 stretched
  rear: number;      // play: up on the hind legs
}
const base = (): P => ({ bx: 0, by: 0, tilt: 0, br: 0, feet: [[0, 0], [0, 0], [0, 0], [0, 0]], neck: -0.9, head: 0.15, jaw: 0, ear: 0, tail: 0, fold: 0, leap: 0, rear: 0 });

const ANIMS = {
  idle: { frames: 4, fps: 3, loop: true },
  walk: { frames: 8, fps: 9, loop: true },
  run: { frames: 6, fps: 13, loop: true },
  eat: { frames: 4, fps: 4, loop: true },
  alert: { frames: 2, fps: 2, loop: true },
  leap: { frames: 4, fps: 7, loop: false },
  call: { frames: 2, fps: 4, loop: true },
  sleep: { frames: 2, fps: 1, loop: true },
  play: { frames: 4, fps: 6, loop: true },
};

function pose(anim: string, f: number, n: number): P {
  const p = base();
  const t = f / n;
  switch (anim) {
    case 'idle':
      p.br = Math.sin(t * TAU) * 0.5 + 0.5;
      p.neck = -0.95 + Math.sin(t * TAU) * 0.03;
      p.ear = f === 2 ? 1 : 0;
      p.tail = Math.sin(t * TAU) * 0.3;
      break;
    case 'walk': {
      const st = 9, lift = 3, duty = 0.62;
      p.feet[2] = gait(t, duty, st, lift);
      p.feet[0] = gait(t + 0.25, duty, st, lift);
      p.feet[3] = gait(t + 0.5, duty, st, lift);
      p.feet[1] = gait(t + 0.75, duty, st, lift);
      p.by = Math.cos(t * TAU * 2) * 0.6;
      p.neck = -0.8 + Math.sin(t * TAU * 2) * 0.05;
      p.head = 0.25;
      p.tail = Math.sin(t * TAU) * 0.2;
      break;
    }
    case 'run': {
      // a bounding gallop: all four feet off the ground mid-stride
      const st = 18, lift = 6, duty = 0.36;
      p.feet[0] = gait(t, duty, st, lift);
      p.feet[1] = gait(t + 0.08, duty, st, lift);
      p.feet[2] = gait(t + 0.5, duty, st, lift);
      p.feet[3] = gait(t + 0.58, duty, st, lift);
      p.by = -Math.max(0, Math.sin(t * TAU + 0.6)) * 5 + 1;
      p.tilt = Math.sin(t * TAU) * 0.12;
      p.neck = -0.55;
      p.head = 0.35;
      p.ear = -1;
      p.tail = 0.9;
      break;
    }
    case 'eat':
      p.neck = 0.55 + (f % 2) * 0.06;
      p.head = 0.9;
      p.jaw = [0.1, 0.6, 0.2, 0.7][f];
      p.tilt = 0.05;
      p.feet[0] = [2, 0];
      p.tail = Math.sin(t * TAU) * 0.3;
      break;
    case 'alert':
      p.neck = -1.25;
      p.head = 0.05;
      p.ear = 1;
      p.by = -1;
      p.tilt = -0.06;
      p.feet[0] = [1, 0];
      p.feet[2] = [-1.5, 0];
      p.tail = 0.7 + f * 0.1;
      break;
    case 'leap':
      p.leap = f < 2 ? 1 : 2;
      if (f < 2) {
        // gathered: all four hooves bunched under the body, back rounded
        p.by = -6 - f * 2;
        p.feet = [[-5, -7], [-4, -8], [6, -7], [7, -6]];
        p.tilt = -0.18;
        p.neck = -0.9;
        p.head = 0.3;
        p.tail = 0.9;
      } else {
        // stretched: forelegs reaching, hind legs trailing
        p.by = -7;
        p.feet = [[8, -6], [10, -8], [-10, -5], [-8, -7]];
        p.tilt = f === 2 ? -0.1 : 0.12;
        p.neck = -0.7;
        p.head = 0.25;
        p.ear = -1;
        p.tail = 0.8;
      }
      break;
    case 'call':
      p.neck = -1.4;
      p.head = -0.25;
      p.jaw = f ? 0.9 : 0.35;
      p.ear = 1;
      p.by = -0.5;
      p.tail = 0.6;
      break;
    case 'sleep':
      p.fold = 1;
      p.br = f;
      p.neck = -0.2;
      p.head = 0.9;
      break;
    case 'play':
      // the butting clash: rear up, then drop and swing the brow-shields forward
      if (f === 0 || f === 1) { p.rear = f === 0 ? 0.6 : 1; p.neck = -1.2; p.head = 0.2; p.ear = -1; }
      else { p.rear = 0; p.neck = -0.25; p.head = 0.85; p.by = 1; p.tilt = 0.14; p.feet[2] = [-3, 0]; p.feet[3] = [-2, 0]; p.ear = -1; }
      p.tail = 0.8;
      break;
  }
  return p;
}

const EYE: EyeSpec = { r: 1.5, iris: hex('#c08a2a'), pupil: hex('#140c06'), slit: 'h', lash: hex('#141010'), ring: hex('#141010') };

function mats(sk: Sk, juv: boolean) {
  return {
    wool: sk.m(rmp(juv ? '#a08868' : '#8e7c62', { n: 8, dark: 0.64, light: 0.42, warm: 0.42, cool: 0.3 }), { edge: 1 }),
    woolD: sk.m(rmp('#54463a', { n: 7, dark: 0.6, light: 0.38, cool: 0.3 }), { edge: 1 }),
    grizzle: sk.m(rmp('#d6c8aa', { n: 6, dark: 0.5, light: 0.4, at: 3 }), { edge: 1 }),
    belly: sk.m(rmp('#ded2b8', { n: 6, dark: 0.45, light: 0.4, at: 3 }), { edge: 1 }),
    black: sk.m(rmp('#26201c', { n: 6, dark: 0.55, light: 0.32 }), { edge: 1 }),
    white: sk.m(rmp('#efe9dc', { n: 6, dark: 0.42, light: 0.3, at: 3 }), { edge: 1 }),
    horn: sk.m(rmp('#38322c', { n: 7, dark: 0.6, light: 0.55, cool: 0.35, warm: 0.3 }), { edge: 1 }),
    hornL: sk.m(rmp('#968a72', { n: 6, dark: 0.55, light: 0.5 }), { edge: 1 }),
    scute: sk.m(rmp('#77736c', { n: 7, dark: 0.62, light: 0.5, cool: 0.45, warm: 0.25 }), { edge: 1 }),
    scuteL: sk.m(rmp('#c4bca8', { n: 6, dark: 0.5, light: 0.45 }), { edge: 1 }),
    hoof: sk.m(rmp('#2c2420', { n: 5, dark: 0.5, light: 0.45 }), { edge: 1 }),
    rim: sk.m(rmp('#b4a486', { n: 5, dark: 0.5, light: 0.4 }), { edge: 1 }),
    nose: sk.m(rmp('#2a2422', { n: 5, dark: 0.45, light: 0.55 }), { edge: 0 }),
    inner: sk.m(rmp('#c49a88', { n: 5, dark: 0.45, light: 0.35 }), { edge: 0 }),
    mouth: sk.m(rmp('#4a1c20', { n: 4, dark: 0.4 }), { edge: 0 }),
    tuft: sk.m(rmp('#c8a868', { n: 5, dark: 0.45 }), { edge: 1 }),
  };
}

const EYEP: V2 = [3.6, -0.9];
const ID = { BODY: 1, HEAD: 2, LEG: 3, HOOF: 4, RIM: 5, TAIL: 6, SCUTE: 10, EAR: 30, INNER: 31, SHIELD: 32, JAW: 33, MOUTH: 34 };

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const k = juv ? 0.62 : 1;
  const M = mats(sk, juv);
  sk.clipY = 0;
  const P = pose(anim, frame, n);
  const legK = juv ? 1.15 : 1;
  const fold = P.fold;
  const bodyY = -28.5 * legK + P.by + fold * 19 * legK;
  const B = new Frame2([P.bx * k, bodyY * k], P.tilt - P.rear * 0.55, k);
  const inv = (x: number, y: number): V2 => {
    const dx = (x - B.o[0]) / k, dy = (y - B.o[1]) / k, c = Math.cos(-B.a), s = Math.sin(-B.a);
    return [dx * c - dy * s, dx * s + dy * c];
  };
  const bp = (x: number, y: number, sh = 0): LM => { const q = B.p(x, y); return [q[0], q[1], sh]; };
  const kl = k * legK;

  // ---------------------------------------------------------------- the coat
  /**
   * Dense two-layer wool: short locks lying back and down the body (each strand lit on its top and
   * shadowed under), grizzled salt-and-pepper (pale tips, dark roots), a darker saddle, the cream belly.
   */
  const wool = memoTex(sk, (p: Sp, o: Tx) => {
    const [lx, ly] = inv(p.x, p.y);
    const ang = B.a + (ly > 3 ? 1.75 : lx > 9 ? 1.45 : 2.75) + Math.sin(lx * 0.3 + ly * 0.2) * 0.25;
    const h = strands(p.x, p.y, ang, 4, 1.6, 31);
    o.z += h * 0.7;
    o.m = M.wool;
    const tip = FS.tip, g = hh(FS.row, FS.seg, 33);
    const bl = 4.6 + Math.sin(lx * 0.5) * 0.6 - Math.max(0, lx - 8) * 0.25;
    if (ly > bl) { o.m = M.belly; return; }
    // a dark stripe along the lower flank, between the grizzled coat and the cream belly
    if (ly > bl - 1.5 && lx > -12 && lx < 12) { o.m = M.black; o.t += 0.06; return; }
    if (ly < -5.6 + Math.sin(lx * 0.4) * 0.7 && lx > -14 && lx < 11) { o.m = M.woolD; if (tip > 0.8 && g < 0.3) o.m = M.grizzle; return; }
    if (tip > 0.82 && g < 0.24) o.m = M.grizzle;
    else if (tip < 0.2 && g > 0.75) o.m = M.woolD;
  });
  /** a leg's coat: grizzled above, dark stockings from the knee / hock down, a white band above the hoof */
  const legTex = (L: { knee: V2; fet: V2; foot: V2 }) => (p: Sp, o: Tx) => {
    const h = strands(p.x, p.y, B.a + 1.6, 2.4, 1.3, 37);
    o.z += h * 0.6;
    o.m = M.wool;
    if (FS.tip > 0.78 && hh(FS.row, FS.seg, 39) < 0.3) o.m = M.grizzle;
    const ax = L.knee, bx = L.foot, dx = bx[0] - ax[0], dy = bx[1] - ax[1], l2 = dx * dx + dy * dy || 1;
    const t = ((p.x - ax[0]) * dx + (p.y - ax[1]) * dy) / l2;
    const tf = ((L.fet[0] - ax[0]) * dx + (L.fet[1] - ax[1]) * dy) / l2;
    const dfo = Math.hypot(p.x - L.foot[0], p.y - L.foot[1]);
    if (dfo < 3.4 * kl && t > tf - 0.1) { o.m = M.white; o.z *= 0.5; }
    else if (t > -0.08) { o.m = M.woolD; o.t -= 0.03; }
  };

  // ---------------------------------------------------------------- legs
  const legJoints = (front: boolean, near: boolean) => {
    const which = front ? (near ? 0 : 1) : (near ? 2 : 3);
    const root = B.p(front ? 9.5 - (near ? 0 : 1) : -10.5 + (near ? 0 : 1.2), front ? 0.5 : -0.5);
    const off = P.feet[which];
    let foot: V2 = [((front ? 11.5 : -10.5) + (near ? 0 : (front ? -1.6 : 1.8)) + off[0]) * k, (-0.2 + off[1]) * k];
    let lifted = off[1] < -0.5;
    if (fold) { foot = B.p(front ? 13 + (near ? 2 : 0) : -4 + (near ? 2 : 0), 9.4); lifted = true; }
    if (P.rear && !front) foot = [(-9 + off[0]) * k, -0.2 * k];
    if (P.rear && front) { foot = B.p(16, 11 - P.rear * 4); lifted = true; }
    if (P.leap) { foot = [B.o[0] + (front ? 10 : -10) * k + off[0] * k, B.o[1] + (20 + off[1]) * k]; lifted = true; }
    // pastern + cannon from the hoof up to the knee (carpus) / hock
    const l1 = (front ? 8.4 : 10) * kl, l2 = (front ? 9.6 : 10.4) * kl, l3 = (front ? 7.6 : 8.6) * kl, lp = 2.6 * kl;
    let pa = -Math.PI / 2 + (front ? -0.32 : -0.34), ca = front ? -Math.PI / 2 - 0.02 : -Math.PI / 2 - 0.3;
    if (lifted) {
      if (front) { pa = fold ? Math.PI - 0.2 : -Math.PI / 2 - 1.2; ca = fold ? Math.PI - 0.15 : -Math.PI / 2 - 1.4; }
      else { pa = fold ? 0.1 : -Math.PI / 2 + 0.5; ca = fold ? -0.1 : -Math.PI / 2 + 0.25; }
      if (P.leap === 2) { if (front) { pa = -Math.PI / 2 - 0.9; ca = -Math.PI / 2 - 0.6; } else { pa = -Math.PI / 2 + 1.2; ca = -Math.PI / 2 + 0.9; } }
    }
    const fet: V2 = [foot[0] + Math.cos(pa) * lp, foot[1] + Math.sin(pa) * lp];
    const knee: V2 = [fet[0] + Math.cos(ca) * l3, fet[1] + Math.sin(ca) * l3];
    const [j] = ik2(root, knee, l1, l2, front ? 1 : -1);
    return { root, j, knee, fet, foot, front, lifted };
  };
  type LJ = ReturnType<typeof legJoints>;
  const legOutline = (L: LJ): LM[] => {
    const { root, j, knee, fet, foot } = L, s = kl;
    const up: V2 = [root[0] - (j[0] - root[0]) * 0.6, root[1] - (j[1] - root[1]) * 0.6];
    if (L.front) return [
      along(up, root, 1, 4 * s), along(root, j, 0.1, 4.2 * s), along(root, j, 0.7, 3.4 * s),
      along(j, knee, 0.1, 2.9 * s), along(j, knee, 0.55, 2.1 * s), along(j, knee, 0.92, 1.6 * s),
      along(knee, fet, 0.04, 1.9 * s), along(knee, fet, 0.3, 1.25 * s), along(knee, fet, 0.85, 1.2 * s),
      along(fet, foot, 0.05, 1.6 * s), along(fet, foot, 0.7, 1.15 * s),
      along(fet, foot, 0.9, -1.2 * s), along(fet, foot, 0.1, -1.7 * s, 0.2),
      along(knee, fet, 0.8, -1.1 * s), along(knee, fet, 0.2, -1.2 * s), along(knee, fet, -0.02, -1.8 * s),
      along(j, knee, 0.75, -1.7 * s), along(j, knee, 0.3, -2.6 * s), along(j, knee, 0.02, -2.6 * s),
      along(j, knee, -0.14, -2.4 * s, 0.4), // the elbow
      along(root, j, 0.6, -4.4 * s), along(root, j, 0.1, -5 * s), along(up, root, 0.5, -3.5 * s),
    ];
    return [
      along(up, root, 1, 5 * s), along(root, j, 0.15, 5.6 * s), along(root, j, 0.65, 4.6 * s),
      along(root, j, 0.98, 2.8 * s, 0.25), // the stifle
      along(j, knee, 0.15, 2.5 * s), along(j, knee, 0.55, 1.8 * s), along(j, knee, 0.92, 1.4 * s),
      along(knee, fet, 0.1, 1.3 * s), along(knee, fet, 0.85, 1.2 * s),
      along(fet, foot, 0.05, 1.6 * s), along(fet, foot, 0.7, 1.15 * s),
      along(fet, foot, 0.9, -1.2 * s), along(fet, foot, 0.1, -1.7 * s, 0.2),
      along(knee, fet, 0.75, -1.1 * s), along(knee, fet, 0.12, -1.3 * s),
      along(j, knee, 1.08, -2.2 * s, 0.5), // the point of the hock
      along(j, knee, 0.75, -1.4 * s), along(j, knee, 0.35, -2.7 * s), along(j, knee, 0.08, -3.3 * s),
      along(root, j, 0.88, -3.6 * s), along(root, j, 0.45, -6.6 * s), along(root, j, 0.05, -6.6 * s), along(up, root, 0.4, -5 * s),
    ];
  };
  /** knobbly knees, the tendons, the dew-claws and the cup hoof with its pale rim */
  const legDetail = (R: Relief, L: LJ, z0: number) => {
    const { root, j, knee, fet, foot } = L, s = kl;
    const kn = along(knee, fet, 0.02, 0.5 * s); R.bump(kn[0], kn[1], 2 * s, 1.8 * s, 0.9 * s);
    if (L.front) { const fa = along(j, knee, 0.25, 0.5 * s); R.bump(fa[0], fa[1], 2.2 * s, 3.6 * s, 0.8 * s, Math.atan2(knee[1] - j[1], knee[0] - j[0]) + 1.57); }
    else {
      const gs = along(j, knee, 0.25, -1 * s); R.bump(gs[0], gs[1], 2.4 * s, 3.6 * s, 0.9 * s, Math.atan2(knee[1] - j[1], knee[0] - j[0]) + 1.57);
      const th = along(root, j, 0.45, -2 * s); R.bump(th[0], th[1], 4 * s, 5 * s, 1.2 * s);
    }
    // the tendon groove down the back of the cannon
    const t0 = along(knee, fet, 0.1, -0.5 * s), t1 = along(knee, fet, 0.85, -0.4 * s);
    R.line([[t0[0], t0[1]], [t1[0], t1[1]]], 0.9 * k, -0.5 * k);
    // dew-claw
    const dc = along(fet, foot, -0.1, -1.9 * s);
    R.region(spline([[dc[0] - 0.8 * s, dc[1] - 0.5 * s, 0], [dc[0] + 0.4 * s, dc[1] - 0.4 * s, 0], [dc[0] - 0.2 * s, dc[1] + 0.9 * s, 0.5]], 0.4), { z: z0 + 1, R: 0.6, H: 0.8, id: ID.HOOF, tex: M.hoof });
    // the cup hoof: a hard dark rim round a rubbery pad, standing on its tip
    const fa = Math.atan2(foot[1] - fet[1], foot[0] - fet[0]);
    const c = Math.cos(fa), sn = Math.sin(fa), nx = -sn, ny = c;
    const hp2 = (a: number, b: number, sh = 0): LM => [foot[0] + (c * a + nx * b) * s, foot[1] + (sn * a + ny * b) * s, sh];
    const cup: LM[] = [hp2(-1.4, -1.5), hp2(-1.6, 1.5), hp2(0.6, 1.9, 0.4), hp2(1.2, 0.2, 0.5), hp2(0.7, -1.8, 0.4)];
    R.region(spline(cup, 0.4), { z: z0 + 1.2, R: 0.9, H: 1.2, id: ID.HOOF, tex: (p, o) => { o.m = M.hoof; if (p.u < 0.35 && p.v < 0.55) o.t += 0.08; } });
    const rim: LM[] = [hp2(-1.9, -1.6), hp2(-2.1, 1.6), hp2(-1.1, 1.7), hp2(-1, -1.7)];
    R.region(spline(rim, 0.4), { z: z0 + 1.6, R: 0.6, H: 0.8, id: ID.RIM, tex: M.rim });
  };

  // far legs
  for (const front of [false, true]) {
    const L = legJoints(front, false);
    const ol = legOutline(L);
    const R = new Relief(sk, Math.min(...ol.map(q => q[0])) - 5, Math.min(...ol.map(q => q[1])) - 4, Math.max(...ol.map(q => q[0])) + 5, Math.max(...ol.map(q => q[1])) + 4);
    R.region(spline(ol, 0.8), { z: -9, R: 2 * kl, H: 2.6 * kl, id: ID.LEG, tex: legTex(L) });
    legDetail(R, L, -8);
    sk.np();
    R.emit({ bias: -0.16, drop: 1.6, seam: 0.6, seamDark: 0.28, ao: 0.06, aoR: 2 });
  }

  // ---------------------------------------------------------------- neck / head frames
  const N0 = B.p(11.5, -4);
  const nA = B.ang(P.neck);
  const nL = 11.5 * k;
  const N1: V2 = [N0[0] + Math.cos(nA) * nL, N0[1] + Math.sin(nA) * nL];
  const H = new Frame2(N1, B.a + P.neck * 0.25 + P.head, k);
  const hz = 7 * k;
  const hpt = (x: number, y: number, sh = 0): LM => { const q = H.p(x, y); return [q[0], q[1], sh]; };
  const jawA = P.jaw * 0.4;
  const jp = (x: number, y: number, sh = 0): LM => {
    const hx = 0, hy = 2.6, dx = x - hx, dy = y - hy, c = Math.cos(jawA), s = Math.sin(jawA);
    const q = H.p(hx + dx * c - dy * s, hy + dx * s + dy * c);
    return [q[0], q[1], sh];
  };

  // ---------------------------------------------------------------- the body relief
  const BR = Relief.full(sk);
  // the tail: a short upturned brush, a white flag under it
  {
    const tb = B.p(-15, -4.5);
    const tA = B.ang(Math.PI + 0.35 - P.tail * 0.9);
    const c = Math.cos(tA), s = Math.sin(tA), nx = -s, ny = c;
    const pt = (t: number, w: number, sh = 0): LM => [tb[0] + (c * t * 5.6 + nx * w) * k, tb[1] + (s * t * 5.6 + ny * w) * k - t * t * 1.2 * k, sh];
    const tl: LM[] = [pt(-0.2, -2), pt(0.4, -1.9), pt(0.85, -1.2), pt(1.08, 0, 0.3), pt(0.85, 1.3), pt(0.4, 2), pt(-0.2, 2.2)];
    const poly = fringe(spline(tl, 0.5), 1.2, 7, (x, y) => (Math.hypot(x - tb[0], y - tb[1]) > 2.5 * k ? [1.1 * k + 0.3, 0.3] : null));
    BR.region(poly, { z: 1, R: 1.6 * k, H: 2.4 * k, id: ID.TAIL, blend: 1, tex: (p, o) => {
      // which side is the flag (underside)?
      const side = (p.x - tb[0]) * nx + (p.y - tb[1]) * ny;
      const up = ny < 0 ? side < 0.6 : side > -0.6;
      o.m = up ? M.woolD : M.white;
      o.z += strands(p.x, p.y, tA, 2, 1.2, 41) * 0.6;
    } });
  }
  // the torso
  const brr = P.br * 0.3;
  const torso: LM[] = [
    bp(-16, -5.6), bp(-13.5, -8.6), bp(-8, -9.8 - brr), bp(-1, -9.2 - brr), bp(6, -9.6 - brr), bp(10.5, -9.8), bp(14, -6.5),
    bp(15.8, -1.5), bp(15, 3), bp(11.5, 6.8), bp(6, 7.4 + brr), bp(-2, 7.6 + brr), bp(-7.5, 6.6), bp(-10.4, 4.4),
    bp(-13.5, 5), bp(-16.8, 2), bp(-17.4, -2.2),
  ];
  // wool tufts break the outline: along the belly and the back of the thighs, a few on the back
  const tor = fringe(spline(torso, 0.8), 1.5, 3, (x, y, nx, ny) => {
    if (ny > 0.35) return [1.6 * k + 0.4, -0.35];
    if (nx < -0.6) return [1.2 * k + 0.3, 0.4];
    if (ny < -0.6) return [0.7 * k, 0.6];
    return null;
  });
  BR.region(tor, { z: 0, R: 7.5 * k, H: 7 * k, id: ID.BODY, tex: wool, pow: 0.9 });
  // near legs, fused in at the shoulder and the hip
  for (const front of [false, true]) {
    const L = legJoints(front, true);
    const ax = L.root, ay = L.fet, al = Math.hypot(ay[0] - ax[0], ay[1] - ax[1]) || 1;
    const lt = legTex(L);
    const ol = fringe(spline(legOutline(L), 0.8), 1.4, front ? 11 : 13, (x, y, nx) => {
      // longer wool on the back of the thigh / forearm, near the body
      const t = ((x - ax[0]) * (ay[0] - ax[0]) + (y - ax[1]) * (ay[1] - ax[1])) / (al * al);
      return t < 0.42 && nx < -0.3 ? [1.2 * k + 0.3, 0.5] : null;
    });
    BR.region(ol, {
      R: 2.2 * kl, H: 3 * kl, id: ID.LEG, blend: 1.6 * k, tex: (p, o) => {
        const t = ((p.x - ax[0]) * (ay[0] - ax[0]) + (p.y - ax[1]) * (ay[1] - ax[1])) / (al * al);
        if (t < 0.3) wool(p, o); else lt(p, o);
      },
      zAt: (x, y) => {
        const t = ((x - ax[0]) * (ay[0] - ax[0]) + (y - ax[1]) * (ay[1] - ax[1])) / (al * al);
        return 6 * k - Math.max(0, 1 - (t + 0.05) / 0.45) * 7 * k;
      },
    });
    legDetail(BR, L, 9 * k);
  }
  // the neck: from inside the shoulders, a shaggy throat ruff under it
  {
    const top0 = B.p(9, -9.6), poll = H.p(-3, -3.4), thr = H.p(-2.6, 3.8), ch = B.p(15.5, -1.4);
    const ctl = (a: V2, b: V2, off: number): LM => {
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      return [mx + (dy / l) * off * k, my - (dx / l) * off * k, 0];
    };
    const neck: LM[] = [bp(4, -5), [top0[0], top0[1], 0], ctl(top0, poll, 1), [poll[0], poll[1], 0], hpt(0, 0), [thr[0], thr[1], 0], ctl(thr, ch, -1.2), [ch[0], ch[1], 0], bp(9, 1)];
    const np2 = fringe(spline(neck, 0.8), 1.3, 17, (x, y, nx, ny) => {
      const [lx] = inv(x, y);
      if (lx < 9) return null;
      if (ny > 0.1 || nx > 0.5) return [2 * k + 0.4, -0.5];
      if (ny < -0.4) return [0.9 * k, 0.6];
      return null;
    });
    const no = N0, hO = H.o, nl = Math.hypot(hO[0] - no[0], hO[1] - no[1]) || 1;
    BR.region(np2, {
      R: 4 * k, H: 4.4 * k, id: ID.HEAD, blend: 2.5 * k, tex: (p, o) => {
        const h = strands(p.x, p.y, nA + Math.PI * 0.55, 2.8, 1.4, 43);
        o.z += h * 0.8;
        const [lx, ly] = inv(p.x, p.y);
        const front = (p.x - no[0]) * Math.sin(nA) * -1 + (p.y - no[1]) * Math.cos(nA);
        o.m = front > 1.2 * k ? M.belly : M.wool;
        if (FS.tip > 0.72 && hh(FS.row, FS.seg, 45) < 0.4) o.m = o.m === M.belly ? M.white : M.grizzle;
        void lx; void ly;
      },
      zAt: (x, y) => {
        const t = Math.max(0, Math.min(1, ((x - no[0]) * (hO[0] - no[0]) + (y - no[1]) * (hO[1] - no[1])) / (nl * nl)));
        return 1.5 * k + (hz - 1.5 * k) * t;
      },
    });
  }
  // the head: short and deep, the muzzle tapering; the black-and-white mask
  const faceTex = (p: Sp, o: Tx) => {
    const dx = (p.x - H.o[0]) / k, dy = (p.y - H.o[1]) / k, c = Math.cos(-H.a), s = Math.sin(-H.a);
    const hx = dx * c - dy * s, hy = dx * s + dy * c;
    o.z += strands(p.x, p.y, H.a + Math.PI, 1.8, 1, 47) * 0.35;
    // the mask: a black band from behind the eye to the nose (with the black teardrop of the gland in
    // front of the eye), a white brow stripe over it, the white muzzle and chin, a pale eye-ring
    const ed = Math.hypot(hx - EYEP[0], (hy - EYEP[1]) * 1.1);
    if (ed < 2.3 && ed > 1.4 && hy < EYEP[1] + 0.4) { o.m = M.white; return; }
    const band = -0.7 + hx * 0.17;
    if (hy > 1.6 + hx * 0.03 && hx > 2.5) { o.m = M.white; return; }
    if (Math.abs(hy - band) < 1.4 - Math.max(0, hx - 6) * 0.1 && hx > 0.5) { o.m = M.black; return; }
    if (Math.hypot(hx - 6, hy - 0.6) < 1.4) { o.m = M.black; return; }
    if (hy < band - 1.4 && hy > band - 2.6 && hx > 1) { o.m = M.white; return; }
    o.m = M.wool;
    if (hx < 1 && hy < -1) o.m = M.woolD;
  };
  {
    const head: LM[] = [hpt(-3.2, -3.8), hpt(1, -5), hpt(4.8, -4.3), hpt(7.6, -2.5), hpt(9.4, -0.6), hpt(10.2, 1, 0.35), hpt(9.9, 2.6, 0.2), hpt(8.6, 3.1), jp(8.8, 3.7), jp(8, 5), jp(4.8, 5.8), jp(0.6, 5.6), hpt(-2.2, 4.4), hpt(-3.9, 0.6)];
    BR.region(spline(head, 0.6), { z: hz, R: 3.4 * k, H: 4.4 * k, id: ID.HEAD, blend: 1.2 * k, tex: faceTex });
    if (P.jaw > 0.3) {
      const a = H.p(4.5, 2.8), b = H.p(9.6, 2.8), c = jp(8.6, 4);
      BR.region(spline([[a[0], a[1], 0], [b[0], b[1], 0], [c[0], c[1], 0]], 0.4), { z: hz + 2.5 * k, R: 0.6, H: 0.4, id: ID.MOUTH, tex: M.mouth });
    }
    // the jaw line, the cheek, the muzzle
    BR.line([hpt(2.5, 2.6), hpt(6, 3.1), hpt(8.8, 3.2)].map(q => [q[0], q[1]] as V2), 0.9 * k, -0.6 * k);
    { const c = H.p(1.5, 2.2), d = H.p(8.6, 0.8); BR.bump(c[0], c[1], 3 * k, 2.4 * k, 1 * k); BR.bump(d[0], d[1], 2 * k, 1.8 * k, 0.6 * k); }
  }
  // the keel: overlapping bony scutes along the spine, each keeled and pointing back, every one lying
  // over the base of the one behind it like a roof tile, so the back's outline is serrated
  {
    const N = 7;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const lx = -12.5 + t * 22;
      const topY = -9.6 - Math.sin(t * Math.PI) * 0.4 + (t < 0.1 ? (0.1 - t) * 26 : 0) - brr;
      const sz = (1 - Math.abs(t - 0.6) * 0.55) * k;
      const lean = B.a - 0.15;
      const c = Math.cos(lean), sn = Math.sin(lean);
      const pt = (x: number, y: number, sh = 0): LM => {
        const xx = x * sz, yy = y * sz, q = B.p(lx, topY);
        return [q[0] + xx * c - yy * sn, q[1] + xx * sn + yy * c, sh];
      };
      // a keeled plate standing up and back out of the wool: base, front edge, the tip, the trailing edge
      const sc: LM[] = [pt(2.3, 1.6), pt(1.6, -0.6), pt(-0.6, -2.6), pt(-2.7, -3.6, 0.85), pt(-2.5, -1.4), pt(-2.2, 1.6)];
      const q0 = B.p(lx, topY);
      BR.region(spline(sc, 0.35), { z: 6 * k + i * 1.6 * k, R: 1 * k, H: 1.6 * k, id: ID.SCUTE + i, tex: (p, o) => {
        // the keel: a ridge from the base to the tip, lit; growth rings across; a dark root in the wool
        const dx = (p.x - q0[0]) / sz, dy = (p.y - q0[1]) / sz;
        const ux = dx * c + dy * sn, uy = -dx * sn + dy * c;
        const kd = uy - ux * 1.1 + 0.4;
        o.m = M.scute;
        if (Math.abs(kd) < 0.75) { o.z += 0.7; o.m = M.scuteL; }
        if (fr((ux - uy) * 0.55) < 0.18) o.z -= 0.3;
        if (uy > 0.9) { o.m = M.woolD; o.t -= 0.06; }
      } });
    }
  }
  // form under the wool: shoulder, haunch, ribs
  { const c = B.p(9, -2), d = B.p(-11, -2), e = B.p(-1, 0); BR.bump(c[0], c[1], 5 * k, 7 * k, 1.6 * k, B.a - 0.4); BR.bump(d[0], d[1], 6 * k, 6 * k, 1.8 * k); BR.bump(e[0], e[1], 8 * k, 5 * k, 1 * k); }
  BR.line([B.p(6, -7), B.p(8, -3), B.p(9.5, 1)], 1.4 * k, 0.7 * k);           // scapula
  BR.line([B.p(-6.5, -4), B.p(-8, 1), B.p(-10, 4.4)], 1.4 * k, -0.9 * k, { fold: true }); // the flank
  BR.shadow(ID.HEAD, 1 * k, 1.4 * k, 0.1, ID.BODY, 1);
  BR.shadow(ID.LEG, 1.2 * k, 0.8 * k, 0.08, ID.BODY, 1);
  for (let i = 0; i < 7; i++) BR.shadow(ID.SCUTE + i, 0.6, 1.2, 0.12, ID.BODY, 1);
  sk.np();
  BR.emit({ drop: 1.8 * k, seam: 0.7 * k, seamDark: 0.3, ao: 0.06, aoR: 2 });

  // ---------------------------------------------------------------- ears and brow-shields
  const earA = -2.7 + P.ear * 0.45;
  const ear = (near: boolean) => {
    const b = H.p(near ? -2.2 : -2, near ? -1.6 : -2.4);
    const R = new Relief(sk, b[0] - 9, b[1] - 9, b[0] + 9, b[1] + 9);
    const a = H.ang(earA - (near ? 0 : 0.22));
    const c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
    const L = 6.8 * k, Wd = 2.7 * k;
    const pt = (t: number, w: number, sh = 0): LM => [b[0] + (c * t * L + nx * w * Wd), b[1] + (s * t * L + ny * w * Wd), sh];
    const ol = fringe(spline([pt(-0.1, -0.7), pt(0.4, -1), pt(0.85, -0.5), pt(1.06, 0, 0.5), pt(0.8, 0.7), pt(0.35, 0.95), pt(-0.1, 0.6)], 0.5), 1, near ? 3 : 5, () => [0.6, 0.3]);
    const zE = hz + (near ? 6 : -4) * k;
    R.region(ol, { z: zE, R: 1 * k, H: 1.4 * k, id: ID.EAR, tex: (p, o) => {
      const dx = p.x - b[0], dy = p.y - b[1], t = (dx * c + dy * s) / L, w = (dx * nx + dy * ny) / Wd;
      o.m = t > 0.8 || p.s < 0.6 ? M.black : M.wool;
      if (near && t > 0.12 && t < 0.8 && Math.abs(w) < 0.6 * Math.sin(Math.PI * Math.min(1, t / 0.85))) { o.m = w > 0.25 ? M.white : M.inner; o.z -= 0.6; }
    } });
    sk.np();
    R.emit({ bias: near ? 0 : -0.15, drop: 1.4, seam: 0.4 });
  };
  const shield = (near: boolean) => {
    if (juv) {
      if (!near) return;
      const c = H.p(1.6, -4);
      const R = new Relief(sk, c[0] - 5, c[1] - 5, c[0] + 5, c[1] + 5);
      R.region(spline([[c[0] - 1.6 * k, c[1] + 0.6 * k, 0], [c[0] - 0.8 * k, c[1] - 1.2 * k, 0], [c[0] + 1.4 * k, c[1] - 0.8 * k, 0], [c[0] + 1.2 * k, c[1] + 0.8 * k, 0]], 0.4), { z: hz + 8, R: 0.8, H: 1, id: ID.SHIELD, tex: M.horn });
      sk.np(); R.emit({ drop: 1.2 });
      return;
    }
    // ridged keratin plates swept back over the skull from the brow, curving down at their tips
    const base = H.p(near ? 3.6 : 3, near ? -3.2 : -4);
    const R = new Relief(sk, base[0] - 16, base[1] - 14, base[0] + 8, base[1] + 8);
    const back = H.dir(Math.PI + 0.38, 1), upv = H.dir(-Math.PI / 2 + 0.38, 1);
    const L = (near ? 13.6 : 12.4) * k;
    const pt = (t: number, w: number, sh = 0): LM => {
      const dropT = t * t * 3.4 * k; // the tip curls down
      return [base[0] + back[0] * t * L + upv[0] * (w - dropT), base[1] + back[1] * t * L + upv[1] * (w - dropT), sh];
    };
    const wd = (t: number) => (2.9 - t * 1.6) * k;
    const ol: LM[] = [pt(-0.08, -wd(0) * 0.6), pt(0.3, -wd(0.3) * 0.75), pt(0.7, -wd(0.7) * 0.7), pt(1, -0.1 * k, 0.4), pt(0.85, wd(0.85) * 0.75), pt(0.45, wd(0.45)), pt(0.05, wd(0) * 0.9, 0.3)];
    R.region(spline(ol, 0.4), { z: hz + (near ? 9 : -2) * k, R: 1.2 * k, H: 1.8 * k, id: ID.SHIELD, tex: (p, o) => {
      const dx = p.x - base[0], dy = p.y - base[1];
      const t = (dx * back[0] + dy * back[1]) / L;
      // transverse ridges, raised and lit on their leading edge; paler worn ridge-tops
      const r = fr(t * 7.5);
      o.m = M.horn;
      if (r < 0.32) { o.z += 0.7; if (p.s > 0.6) o.m = M.hornL; } else if (r > 0.82) o.z -= 0.5;
      if (t > 0.86) o.m = M.hornL;
    } });
    sk.np();
    R.emit({ bias: near ? 0 : -0.15, drop: 1.4, seam: 0.5, seamDark: 0.3, contrast: 1.15 });
  };
  shield(false);
  ear(false);
  ear(true);
  shield(true);
  // the eye in its black band; the nose
  const ec = H.p(EYEP[0], EYEP[1]);
  const ep = drawEye(sk, ec[0], ec[1], { ...EYE, r: juv ? 1.2 : 1.5 }, eye);
  const ns = H.p(9.6, 0.6);
  sk.over(ns[0], ns[1], hex('#120e0c'));
  // a mouthful of tussock while grazing
  if (anim === 'eat') {
    sk.np(true);
    const mp = H.p(8.6, 3.4);
    for (let i = 0; i < 5; i++) sk.blade(mp[0], mp[1], mp[0] + (i - 2) * 1.1 * k, mp[1] + (3 + (i % 2) * 1.2) * k, s => (1 - s) * 0.55 + 0.2, M.tuft, { z0: hz + 12, z1: hz + 12 });
  }
  const headTop = H.p(0, -7);
  return { head: [headTop[0], headTop[1] - 1] as V2, eye: ep };
}

export const TORHOPPER: SpeciesDef = {
  name: 'Torhopper', kind: 'mammal', len: 44, height: 40,
  anims: ANIMS,
  canvas: (_a, juv) => (juv ? { w: 60, h: 58, ox: 28, oy: 50 } : { w: 84, h: 76, ox: 40, oy: 66 }),
  draw,
  eyeFor: (anim) => (anim === 'sleep' ? 'closed' : anim === 'alert' || anim === 'leap' ? 'alert' : anim === 'play' ? 'angry' : 'open'),
};

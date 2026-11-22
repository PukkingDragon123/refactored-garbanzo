// Sail Possum (Velopetaurus nectarius): a big-eyed glider with a furred sail of skin from wrist to ankle,
// drifting from blossom to blossom at dusk.
//
// Painted on the Relief layer (beasts-relief.ts): on the ground the body is one contour hung on a
// flexible spine (low forager, bound, upright feeder, vertical climber), silver-grey with a dark stripe
// from the nose down the spine and a cream belly; the folded patagium hangs as a soft furred fold along
// the flank between the wrist and the ankle, its pale margin showing; the head is short and round with
// enormous dark night eyes ringed in black, tall thin rounded ears pink inside, a pointed pink nose and
// long whiskers; little hands with pink pads; a long bushy tail darkening to a black tip.
// Gliding, seen from above, the sail is spread taut as one scalloped sheet between the outstretched
// wrists and ankles: furred above with the fur radiating from the flanks, a dark band inside its pale
// margin, the limbs showing as ridges through it, the hands and feet spread at its corners, the head up
// with both eyes showing, the tail streaming behind as a rudder.

import { Sk, V2, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, gait, TAU, cbez, ik2, hh, fr } from './beasts-core';
import { Frame2, whiskers } from './beasts-rig';
import { Relief, Sp, Tx, LM, spline, fringe, along, strands, FS } from './beasts-relief';
import { Curve, ribbon, localOf, claw } from './beasts-mam-kit';
import { hex } from './color';

interface P {
  hip: V2; spine: number; bend: number; head: number; jaw: number; ear: number; br: number;
  feet: [V2, V2, V2, V2]; // absolute foot targets (adult px) FLn, FLf, HLn, HLf
  tail: number; tailCurl: number;
  upright: number; paws: number; tongue: number;
  glide: number;          // glide frame (1 = on)
  billow: number;
  curl: number;           // sleep
  climb: boolean;
}
const base = (): P => ({
  hip: [-6, -6.2], spine: -0.05, bend: 0.8, head: 0.02, jaw: 0, ear: 0, br: 0,
  feet: [[5.5, 0], [5.5, 0], [-6, 0], [-6, 0]], tail: 0, tailCurl: 0, upright: 0, paws: 0, tongue: 0,
  glide: 0, billow: 0, curl: 0, climb: false,
});

const ANIMS = {
  idle: { frames: 4, fps: 4, loop: true },
  walk: { frames: 6, fps: 9, loop: true },
  run: { frames: 6, fps: 13, loop: true },
  eat: { frames: 3, fps: 6, loop: true },
  alert: { frames: 2, fps: 3, loop: true },
  sleep: { frames: 2, fps: 1.5, loop: true },
  call: { frames: 2, fps: 5, loop: true },
  groom: { frames: 4, fps: 8, loop: true },
  glide: { frames: 2, fps: 4, loop: true },
  climb: { frames: 4, fps: 8, loop: true },
  feed: { frames: 4, fps: 7, loop: true },
};

function pose(anim: string, f: number, n: number): P {
  const p = base();
  const t = f / n;
  const ft = (i: number, off: V2) => { p.feet[i] = [p.feet[i][0] + off[0], p.feet[i][1] + off[1]]; };
  switch (anim) {
    case 'idle':
      p.br = Math.sin(t * TAU) * 0.5 + 0.5;
      p.head = f === 2 ? -0.1 : 0.02;
      p.ear = f === 3 ? 1 : 0;
      p.tail = Math.sin(t * TAU) * 0.08;
      break;
    case 'walk': {
      const st = 4.4, lift = 1.8, duty = 0.6;
      ft(2, gait(t, duty, st, lift)); ft(0, gait(t + 0.25, duty, st, lift));
      ft(3, gait(t + 0.5, duty, st, lift)); ft(1, gait(t + 0.75, duty, st, lift));
      p.hip = [-6, -6.2 + Math.cos(t * TAU * 2) * 0.4];
      p.head = Math.sin(t * TAU * 2) * 0.05;
      p.tail = Math.sin(t * TAU + 1.3) * 0.15;
      break;
    }
    case 'run': {
      const st = 7.5, lift = 2.8, duty = 0.4;
      ft(0, gait(t, duty, st, lift)); ft(1, gait(t + 0.1, duty, st, lift));
      ft(2, gait(t + 0.5, duty, st, lift)); ft(3, gait(t + 0.6, duty, st, lift));
      const c = Math.cos(t * TAU);
      p.bend = 0.8 + c * 1.3;
      p.hip = [-6 + c * 0.8, -6.4 - Math.max(0, Math.sin(t * TAU)) * 1.8];
      p.spine = Math.sin(t * TAU) * 0.1;
      p.ear = -1;
      p.tail = -0.2 + c * 0.2;
      break;
    }
    case 'eat':
      // sitting up nibbling a blossom held in the forepaws
      p.upright = 0.85; p.spine = -1.15; p.hip = [-3, -5];
      p.head = 0.9 + (f % 2) * 0.12; p.paws = 0.75; p.jaw = f === 1 ? 1 : 0.3;
      p.tail = 0.4; p.tailCurl = 0.3;
      break;
    case 'alert':
      p.spine = -0.35; p.hip = [-5.4, -6.4]; p.head = 0.15; p.ear = 1;
      ft(0, [-1.5, -2.4]); ft(1, [-1, -1.8]);
      p.tail = 0.2;
      break;
    case 'sleep':
      p.curl = 1; p.br = f;
      break;
    case 'call':
      p.upright = 0.6; p.spine = -0.9; p.hip = [-4, -5];
      p.head = 0.35 - f * 0.25; p.jaw = f ? 1 : 0.5; p.ear = 0.6;
      p.tail = 0.25;
      break;
    case 'groom':
      p.upright = 0.85; p.spine = -1.2; p.hip = [-3, -5];
      p.head = 1.1 + [0, 0.2, 0.05, 0.25][f]; p.paws = [0.7, 1, 0.75, 1][f];
      p.tail = 0.4; p.tailCurl = 0.4;
      break;
    case 'feed':
      // reaching up to a blossom, long tongue lapping nectar
      p.upright = 0.75; p.spine = -1.0; p.hip = [-4, -5];
      p.head = 0.35; p.paws = 1.25; p.jaw = 0.6;
      p.tongue = [0.35, 1, 0.65, 1][f]; p.ear = 0.4;
      p.tail = 0.35; p.tailCurl = 0.25;
      break;
    case 'glide':
      p.glide = 1; p.billow = f; p.tail = f ? 0.06 : -0.04;
      break;
    case 'climb': {
      // vertical, head up, belly against a trunk on the right (trunk surface at x = 0)
      p.climb = true;
      const s = f / 4;
      const c = Math.sin(s * TAU);
      p.hip = [-5.2, 7 + c * 0.6];
      p.spine = -Math.PI / 2 - 0.06;
      p.bend = 0.9;
      p.head = 0.25;
      p.feet = [
        [-0.8, -7 + gait(s, 0.55, 5, 0)[0]], [-0.8, -7 + gait(s + 0.5, 0.55, 5, 0)[0]],
        [-0.8, 7 + gait(s + 0.5, 0.55, 5, 0)[0]], [-0.8, 7 + gait(s, 0.55, 5, 0)[0]],
      ];
      p.tail = 0;
      break;
    }
  }
  return p;
}

const EYE: EyeSpec = { r: 2.2, iris: hex('#1a1216'), lash: hex('#2a2430'), dark: true, shine: hex('#ffffff') };

function mats(sk: Sk) {
  return {
    fur: sk.m(rmp('#9c96a8', { n: 7, dark: 0.62, light: 0.4, cool: 0.3, warm: 0.3 }), { edge: 1 }),
    furD: sk.m(rmp('#6e687c', { n: 6, dark: 0.58, light: 0.36 }), { edge: 1 }),
    stripe: sk.m(rmp('#2e2836', { n: 6, dark: 0.5, light: 0.38 }), { edge: 1 }),
    belly: sk.m(rmp('#efe6d8', { n: 6, dark: 0.42, light: 0.35, at: 3 }), { edge: 1 }),
    sail: sk.m(rmp('#867f96', { n: 7, dark: 0.6, light: 0.38 }), { edge: 1 }),
    sailD: sk.m(rmp('#4c4658', { n: 6, dark: 0.55, light: 0.32 }), { edge: 1 }),
    edge: sk.m(rmp('#ede4d4', { n: 5, dark: 0.38, light: 0.3, at: 3 }), { edge: 1 }),
    nose: sk.m(rmp('#ec98a2', { n: 5, dark: 0.45, light: 0.4 }), { edge: 0, spec: 1 }),
    inner: sk.m(rmp('#e0a4a8', { n: 5, dark: 0.45, light: 0.38 }), { edge: 0 }),
    ear: sk.m(rmp('#8a8496', { n: 6, dark: 0.55, light: 0.4 }), { edge: 1 }),
    tip: sk.m(rmp('#24202a', { n: 5, dark: 0.45, light: 0.36 }), { edge: 1 }),
    pad: sk.m(rmp('#dca8a4', { n: 5, dark: 0.45, light: 0.38 }), { edge: 1 }),
    tongue: sk.m(rmp('#ee8aa0', { n: 5, dark: 0.45, light: 0.4 }), { edge: 1 }),
    mouth: sk.m(rmp('#4a1c24', { n: 3, dark: 0.4 }), { edge: 0 }),
    claw: sk.m(rmp('#e8ddd0', { n: 4, dark: 0.4, at: 2 }), { edge: 1 }),
    ring: sk.m(rmp('#1c1820', { n: 4, dark: 0.4, light: 0.3 }), { edge: 1 }),
    petal: sk.m(rmp('#d8283a', { n: 6, dark: 0.55, light: 0.4 }), { edge: 1 }),
    anther: sk.m(rmp('#f2c84a', { n: 4, dark: 0.4, at: 2 }), { edge: 0 }),
  };
}
type M = ReturnType<typeof mats>;

const ID = { SAIL: 1, BODY: 2, HEAD: 3, LEG: 4, PAW: 5, CLAW: 6, TAIL: 7, EAR: 8, EAR2: 9, MOUTH: 10, TONGUE: 11, FOLD: 12, FLOWER: 13 };

/** the bushy tail along a chain from root (heading a0, turning by turn(i)) */
function tailInto(R: Relief, M: M, root: V2, a0: number, turn: (i: number) => number, k: number, z: number, fat = 1, segs = 10, floor = Infinity) {
  const pts: V2[] = [root];
  let a = a0, x = root[0], y = root[1];
  for (let i = 0; i < segs; i++) { a += turn(i); x += Math.cos(a) * 1.9 * k; y += Math.sin(a) * 1.9 * k; pts.push([x, Math.min(y, floor)]); }
  const crv = new Curve(pts);
  const wd = (t: number) => (1.5 + Math.sin(Math.min(1, t * 1.5) * Math.PI * 0.5) * 1.5 - t * 0.6) * k * fat;
  const ol = fringe(spline(ribbon(pts, wd, wd, 0.5), 0.5), 1.3 * Math.max(0.8, k), 41, (xx, yy) => { const [t] = crv.project(xx, yy); return t > 0.1 ? [1 * k + 0.3, -0.6] : null; });
  R.region(ol, { z, R: 1.7 * k, H: 2.2 * k, id: ID.TAIL, tex: (p, o) => {
    const [t, off] = crv.project(p.x, p.y);
    const at = crv.at(Math.max(0, Math.min(1, t)));
    o.z += strands(p.x, p.y, Math.atan2(at.u[1], at.u[0]) + 0.3, 2.4, 1.1, 43) * 0.7;
    o.m = t > 0.76 + (FS.tip > 0.6 ? -0.05 : 0) ? M.tip : off > 0.8 * k ? M.furD : M.fur;
    if (o.m === M.fur && FS.tip > 0.85 && hh(FS.row, FS.seg, 45) < 0.3) o.t += 0.08;
  } });
  return pts;
}

interface HeadO { ear: number; jaw: number; tongue: number; eye: BeastEye; k: number; z: number; top?: boolean }
/**
 * The head: short and round, the huge dark eyes ringed in black under a dark stripe running down the
 * nose, tall thin rounded ears pink inside, a pointed pink nose; `top` turns it to show both eyes (the
 * glide, seen from above).
 */
function headInto(sk: Sk, R: Relief, M: M, H: Frame2, o: HeadO) {
  const k = o.k, z = o.z;
  const hp = (x: number, y: number, s2 = 0): LM => { const q = H.p(x, y); return [q[0], q[1], s2]; };
  const hinv = localOf(H.o, H.a, k);
  const ear = (near: boolean) => {
    const eb = o.top ? H.p(-0.6, near ? 2.6 : -2.6) : H.p(near ? -0.2 : 0.6, near ? -2.8 : -3.2);
    const ea = o.top ? H.ang((near ? 1 : -1) * (2.1 + o.ear * 0.3)) : H.ang(-1.95 + o.ear * 0.35 - (near ? 0 : 0.28));
    const ca = Math.cos(ea), sa = Math.sin(ea), nx = -sa, ny = ca;
    const L = 4 * k, Wd = 2 * k;
    const q = (t: number, w: number, s2 = 0): LM => [eb[0] + ca * t * L + nx * w * Wd, eb[1] + sa * t * L + ny * w * Wd, s2];
    const ol = fringe(spline([q(-0.1, -0.7), q(0.4, -0.95), q(0.85, -0.6), q(1.04, 0, 0.2), q(0.85, 0.65), q(0.4, 1), q(-0.1, 0.75)], 0.4), 1.1, near ? 3 : 5, (x, y) => (Math.hypot(x - eb[0], y - eb[1]) > L * 0.5 ? [0.5, 0.3] : null));
    R.region(ol, { z: z + (near ? 3.5 : -2.5) * k, R: 0.9 * k, H: 1.2 * k, id: near ? ID.EAR : ID.EAR2, tex: (p, oo) => {
      const dx = p.x - eb[0], dy = p.y - eb[1], t = (dx * ca + dy * sa) / L, w = (dx * nx + dy * ny) / Wd;
      oo.m = M.ear;
      if ((near || o.top) && t > 0.12 && t < 0.86 && Math.abs(w) < 0.6 * Math.sin(Math.PI * Math.min(1, t / 0.9))) { oo.m = M.inner; oo.z -= 0.5; if (fr(t * 3) < 0.25) oo.z += 0.3; }
    } });
  };
  ear(false);
  const ja = o.jaw * 0.35;
  const jp = (x: number, y: number, s2 = 0): LM => {
    const dx = x - 0.5, dy = y - 1.8, c = Math.cos(ja), s = Math.sin(ja);
    return hp(0.5 + dx * c - dy * s, 1.8 + dx * s + dy * c, s2);
  };
  const head: LM[] = o.top
    ? [hp(-2.6, -2.4), hp(0.4, -3.6), hp(3.4, -3.2), hp(5.8, -1.6), hp(7.4, 0, 0.4), hp(5.8, 1.6), hp(3.4, 3.2), hp(0.4, 3.6), hp(-2.6, 2.4), hp(-3.4, 0)]
    : [hp(-2.6, -2.8), hp(0.6, -4), hp(3.6, -3.6), hp(5.6, -2.2), hp(7, -0.6), hp(7.8, 0.6, 0.4), hp(7.2, 1.6), hp(5.8, 2.2), jp(4.8, 2.8), jp(2.2, 3.6), jp(-0.2, 3.6), hp(-2.2, 2.8), hp(-3.2, 0.2)];
  R.region(fringe(spline(head, 0.5), 1.1, 7, (x, y, _nx, ny) => { const [hx] = hinv(x, y); return hx < 2 && (o.top || ny > 0.3) ? [0.8 * k, -0.5] : null; }), {
    z, R: 2.6 * k, H: 3 * k, id: ID.HEAD, blend: 1.2, tex: (p, oo) => {
      const [hx, hy] = hinv(p.x, p.y);
      oo.z += strands(p.x, p.y, H.ang(Math.PI), 1.5, 0.9, 47) * 0.3;
      oo.m = M.fur;
      if (o.top) {
        // the dark stripe down the middle, pale spectacles round both eyes
        if (Math.abs(hy) < 0.7 + Math.max(0, 2 - hx) * 0.2 && hx < 6.4) oo.m = M.stripe;
        for (const sy of [-2.3, 2.3]) { const d = Math.hypot(hx - 3.2, hy - sy); if (d > 1.6 && d < 2.5 && hx > 2.4) oo.m = M.belly; }
        if (hx > 6.6) oo.m = M.nose;
        return;
      }
      if (hy > 1.2 && hx > 0) oo.m = M.belly;
      // the dark stripe from the crown down the nose ridge; pale spectacles round the huge eye; a dark streak back to the ear
      const ed = Math.hypot(hx - 3.4, hy + 0.6);
      if (hy < -2.5 + Math.max(0, hx - 3.6) * 0.55 && hy > -4 && hx > -0.6 && hx < 6.6) oo.m = M.stripe;
      else if (hx < 2.6 && Math.abs(hy + 0.9 + (2.6 - hx) * 0.35) < 0.65) oo.m = M.stripe;
      if (ed > 2.1 && ed < 3 && !(hx < 2.6 && hy < 0)) oo.m = M.belly;
      if (hx > 6.8) oo.m = M.nose;
    },
  });
  if (!o.top && o.jaw > 0.4) {
    const a = H.p(4.4, 2.2), b = H.p(7, 2), c = jp(6, 2.8);
    R.region(spline([[a[0], a[1], 0], [b[0], b[1], 0.4], [c[0], c[1], 0.4]], 0.4), { z: z + 2.4 * k, R: 0.4, H: 0.3, id: ID.MOUTH, tex: M.mouth });
  }
  if (o.tongue > 0) {
    const t0 = H.p(7.2, 1.6);
    const a = H.ang(-0.35), L = (2 + o.tongue * 5) * k;
    const tp: V2[] = [t0, [t0[0] + Math.cos(a) * L * 0.5, t0[1] + Math.sin(a) * L * 0.5 + 0.3], [t0[0] + Math.cos(a) * L, t0[1] + Math.sin(a) * L]];
    R.region(spline(ribbon(tp, t => (0.75 - t * 0.2) * k, t => (0.75 - t * 0.2) * k, 0.3), 0.4), { z: z + 5 * k, R: 0.5, H: 0.6, id: ID.TONGUE, tex: (p, oo) => { oo.m = M.tongue; if (Math.hypot(p.x - tp[2][0], p.y - tp[2][1]) < 1.2 * k) oo.z += 0.4; } });
  }
  { const c = H.p(1.6, 1.4); R.bump(c[0], c[1], 2 * k, 1.6 * k, 0.5 * k, 0, ID.HEAD); }
  ear(true);
}

function drawHeadEyes(sk: Sk, H: Frame2, k: number, eye: BeastEye, top = false) {
  if (top) {
    const e2 = H.p(3.2, -2.3);
    drawEye(sk, e2[0], e2[1], { ...EYE, r: k < 0.8 ? 1 : 1.6 }, eye);
    const e1 = H.p(3.2, 2.3);
    return drawEye(sk, e1[0], e1[1], { ...EYE, r: k < 0.8 ? 1.2 : 1.9 }, eye);
  }
  const ec = H.p(3.4, -0.6);
  const ep = drawEye(sk, ec[0], ec[1], { ...EYE, r: k < 0.8 ? 1.2 : 2.2 }, eye);
  whiskers(sk, H.p(6.6, 1.3), Math.cos(H.a) >= 0 ? 1 : -1, 5.5 * k, hex('#d8d0dc'), 3, 0.3, 0.12);
  return ep;
}

/** a red rata blossom: a brush of stamens with gold anthers on a short stalk */
function blossom(R: Relief, M: M, c: V2, k: number, z: number) {
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.32;
    const L = (2.2 + hh(i, 3, 5) * 1) * k;
    R.cap(c, [c[0] + Math.cos(a) * L, c[1] + Math.sin(a) * L], 0.5 * k, 0.45 * k, { z: z + i * 0.05, rz: 0.5, id: ID.FLOWER, tex: (p, o) => { o.m = p.t > 0.78 ? M.anther : M.petal; } });
  }
}

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const k = juv ? 0.65 : 1;
  const M = mats(sk);
  const P = pose(anim, frame, n);
  if (P.glide) return drawGlide(sk, M, P, k, eye);
  if (P.curl) return drawCurled(sk, M, P, k, eye);
  if (!P.climb) sk.clipY = 0;
  const gk = Math.max(0.8, k);
  const S = (v: V2): V2 => [v[0] * k, v[1] * k];
  const hip = S(P.hip);
  const spL = 10.5 * k, sa = P.spine;
  const sh: V2 = [hip[0] + Math.cos(sa) * spL, hip[1] + Math.sin(sa) * spL];
  const nx = Math.sin(sa), ny = -Math.cos(sa);
  const c1: V2 = [hip[0] + Math.cos(sa) * spL * 0.33 + nx * P.bend * k, hip[1] + Math.sin(sa) * spL * 0.33 + ny * P.bend * k];
  const c2: V2 = [hip[0] + Math.cos(sa) * spL * 0.7 + nx * P.bend * k, hip[1] + Math.sin(sa) * spL * 0.7 + ny * P.bend * k];
  const rump: V2 = [hip[0] - Math.cos(sa) * 2.4 * k, hip[1] - Math.sin(sa) * 2.4 * k];
  const SP = new Curve([rump, ...cbez(hip, c1, c2, sh, 10)]);
  const up = P.upright;
  const br = P.br * 0.25;

  const coat = (p: Sp, o: Tx) => {
    const [t, off] = SP.project(p.x, p.y);
    const at = SP.at(Math.max(0, Math.min(1, t)));
    o.z += strands(p.x, p.y, Math.atan2(-at.u[1], -at.u[0]) + 0.2, 2 * gk, 1 * gk, 51) * 0.55;
    const o2 = off / k;
    o.m = o2 < -1.6 ? M.belly : M.fur;
    if (Math.abs(o2 - 2.4) < 0.85 + (FS.tip > 0.7 ? 0.3 : 0) && t > -0.05 && t < 1.05) o.m = M.stripe;
    else if (o2 > 2.4 && o.m === M.fur) o.m = M.furD;
    if (o.m === M.fur && FS.tip > 0.85 && hh(FS.row, FS.seg, 53) < 0.3) o.t += 0.08;
  };

  // ---------------------------------------------------------------- legs
  const legJ = (which: number) => {
    const front = which < 2, near = which % 2 === 0;
    const root = front ? SP.V(0.84 - (near ? 0 : 0.04), -1.4 * k) : SP.V(0.14 + (near ? 0 : 0.04), -1.2 * k);
    let foot = S(P.feet[which]);
    if (!P.climb && !near) foot = [foot[0] + (front ? -0.8 : 0.8) * k, foot[1]];
    let lifted = !P.climb && foot[1] < -0.4;
    let e: V2;
    if (front) {
      if (up > 0.5) {
        const ch = SP.V(0.78, -2.8 * k);
        e = [ch[0] + (2.4 + (near ? 0.4 : -0.3) + P.paws * 1.2) * k, ch[1] + (1.6 - P.paws * 3.2) * k];
        lifted = true;
      } else e = P.climb ? [foot[0] - 1 * k, foot[1] + 1 * k] : [foot[0] - 0.4 * k, foot[1] - 1.3 * k];
    } else {
      if (up > 0.5) foot = [hip[0] + (2.4 + (near ? 0.5 : -0.6)) * k, 0];
      e = P.climb ? [foot[0] - 1.4 * k, foot[1] + 1.2 * k] : [foot[0] - 1.8 * k, foot[1] - 1.2 * k];
    }
    const l1 = (front ? 3.3 : 3.8) * k, l2 = (front ? 3.1 : 3.5) * k;
    const [j, ee] = ik2(root, e, l1, l2, (front ? 1 : -1) * (P.climb ? -1 : 1));
    return { root, j, e: ee, foot, front, lifted };
  };
  type LJ = ReturnType<typeof legJ>;
  const legOutline = (L: LJ): LM[] => {
    const { root, j, e } = L, s = k;
    const upv: V2 = [root[0] - (j[0] - root[0]) * 0.6, root[1] - (j[1] - root[1]) * 0.6];
    return [
      along(upv, root, 1, (L.front ? 2 : 2.6) * s), along(root, j, 0.3, (L.front ? 1.8 : 2.5) * s), along(root, j, 0.95, (L.front ? 1.3 : 1.4) * s),
      along(j, e, 0.4, 1 * s), along(j, e, 1, 0.85 * s), along(j, e, 1.14, 0, 0.3), along(j, e, 0.9, -0.85 * s), along(j, e, 0.4, -1.1 * s),
      along(j, e, -0.1, -1.2 * s, 0.35), along(root, j, 0.5, -(L.front ? 1.8 : 2.4) * s), along(upv, root, 0.5, -(L.front ? 1.8 : 2.4) * s),
    ];
  };
  /** the little hand / foot: a pink-padded grip with fine claws */
  const paw = (R: Relief, L: LJ, z0: number) => {
    const { e } = L, s = k;
    const ta = P.climb ? (L.front ? -0.9 : -0.4) : L.lifted ? 0.8 : 0;
    const c = Math.cos(ta), sn = Math.sin(ta);
    const len = L.front ? 1.8 : 2.6;
    const q = (x: number, y: number, s2 = 0): LM => [e[0] + (x * c - y * sn) * s, e[1] + (x * sn + y * c) * s, s2];
    R.region(spline([q(-0.8, -0.8), q(len * 0.6, -0.8), q(len, 0.1), q(len * 0.7, 1, 0.3), q(-0.8, 0.9)], 0.4), { z: z0, R: 0.6, H: 0.8, id: ID.PAW, tex: (p, o) => { o.m = p.v > 0.55 ? M.pad : M.fur; } });
    for (let i = 0; i < 2; i++) { const b = q(len - 0.2 - i * 0.2, 0.1 + i * 0.5); claw(R, [b[0], b[1]], 0.5 + ta, 0.9 * s, 0.6 * s, 0.6, z0 + 0.5, ID.CLAW, M.claw); }
  };
  const legTex = (p: Sp, o: Tx) => { coat(p, o); if (o.m === M.stripe || o.m === M.belly) o.m = M.fur; };
  for (const w of [3, 1]) {
    const L = legJ(w);
    const ol = legOutline(L);
    const R = new Relief(sk, Math.min(...ol.map(q => q[0])) - 5, Math.min(...ol.map(q => q[1])) - 5, Math.max(...ol.map(q => q[0])) + 5, Math.max(...ol.map(q => q[1])) + 5);
    R.region(spline(ol, 0.5), { z: -12, R: 1 * k, H: 1.4 * k, id: ID.LEG, tex: legTex });
    paw(R, L, -10);
    sk.np();
    R.emit({ bias: -0.18, drop: 1.3, seam: 0.5, seamDark: 0.3 });
  }

  const BR = Relief.full(sk);
  // ---------------------------------------------------------------- tail
  {
    const tailA = Math.PI + sa - 0.2 + P.tail + (up ? 1.1 * up : 0) + (P.climb ? 0.55 : 0);
    tailInto(BR, M, rump, tailA, i => (P.climb ? -0.05 : 0.1 + (up > 0.5 ? 0.12 : 0)) + P.tailCurl * 0.1 * (i > 5 ? 1 : 0) - (P.climb ? 0 : i * 0.008), k, -2, 1, 10, P.climb ? Infinity : -0.8 * k);
  }
  // ---------------------------------------------------------------- body
  {
    const T = (t: number, off: number, s2 = 0) => SP.P(t, off * k, s2);
    const body: LM[] = [
      T(-0.16, -0.4), T(-0.1, 2), T(0.06, 3.3 + br), T(0.3, 3.8 + br), T(0.55, 3.8 + br), T(0.8, 3.4), T(0.98, 2.9), T(1.1, 2.4),
      T(1.1, -2.2), T(0.96, -3), T(0.78, -3.5 - br), T(0.52, -3.8 - br), T(0.3, -3.8), T(0.12, -3.6), T(-0.02, -3.1), T(-0.12, -2.1),
    ];
    const ol = fringe(spline(body, 0.5), 1.4 * gk, 5, (x, y) => { const [t, off] = SP.project(x, y); return off < -2.6 * k && t > 0.1 && t < 0.95 ? [0.8 * k + 0.2, 0.5] : off > 2.6 * k && t < 0.25 ? [0.6 * k, -0.5] : null; });
    BR.region(ol, { z: 0, R: 3.6 * k, H: 4.2 * k, id: ID.BODY, tex: coat, pow: 0.9 });
    // the folded sail: a soft furred fold hanging along the flank from the wrist to the ankle, its pale margin showing
    if (!P.climb || true) {
      const sag = (up > 0.5 ? 1.6 : 2.4) + Math.sin(P.br * Math.PI) * 0.2;
      const fold: LM[] = [T(0.86, -1.2), T(0.66, -2.6), T(0.46, -2.8), T(0.24, -2.6), T(0.1, -1.4), T(0.12, -3.2 - sag * 0.6), T(0.3, -3.8 - sag), T(0.52, -4 - sag), T(0.72, -3.7 - sag), T(0.86, -2.8 - sag * 0.5)];
      const ff = fringe(spline(fold, 0.5), 1.3, 9, (x, y) => { const [, off] = SP.project(x, y); return off < -3.4 * k ? [0.7 * k, 0.4] : null; });
      BR.region(ff, { z: 4.6 * k, R: 1.2 * k, H: 1.4 * k, id: ID.FOLD, tex: (p, o) => {
        const [t, off] = SP.project(p.x, p.y);
        o.z += strands(p.x, p.y, Math.PI / 2 + 0.3, 1.6, 1, 55) * 0.5;
        const lo = -(3.7 + sag) * k;
        // a dark line where the sail joins the flank, the furred fold, a pale margin
        o.m = off < lo + 1.1 * k ? M.edge : off < lo + 2 * k ? M.sail : off > -2.1 * k ? M.sailD : M.sail;
        // the skin hangs in soft vertical folds between the limbs
        if (fr(t * 7) < 0.2) o.z -= 0.5;
      } });
    }
    const hc = SP.V(0.14, 0.3 * k), sc = SP.V(0.8, 0.2 * k);
    BR.bump(hc[0], hc[1], 3 * k, 3 * k, 0.9 * k, 0, ID.BODY);
    BR.bump(sc[0], sc[1], 2.4 * k, 2.8 * k, 0.6 * k, 0, ID.BODY);
  }
  for (const w of [2, 0]) {
    const L = legJ(w);
    const ax = L.root, ay = L.e, al = Math.hypot(ay[0] - ax[0], ay[1] - ax[1]) || 1;
    const lift = L.front && up > 0.5 ? 3 : 0;
    BR.region(spline(legOutline(L), 0.5), {
      R: 1.1 * k, H: 1.4 * k, id: ID.LEG, blend: 0.8, tex: legTex,
      zAt: (x, y) => { const t = ((x - ax[0]) * (ay[0] - ax[0]) + (y - ax[1]) * (ay[1] - ax[1])) / (al * al); return 4 * k - Math.max(0, 1 - (t + 0.05) / 0.5) * 4 * k + lift; },
    });
    paw(BR, L, 5 * k + lift);
  }
  // ---------------------------------------------------------------- head
  const H = new Frame2(SP.at(1).p, sa + P.head, k);
  headInto(sk, BR, M, H, { ear: P.ear, jaw: P.jaw, tongue: P.tongue, eye, k, z: 3.6 * k });
  if (anim === 'eat') {
    const hand = legJ(0).e;
    blossom(BR, M, [hand[0] + 1 * k, hand[1] - 0.5 * k], k, 9 * k);
  }
  BR.shadow(ID.HEAD, 0.8, 1.2, 0.1, ID.BODY, 1);
  BR.shadow(ID.LEG, 0.8, 0.8, 0.1, ID.BODY, 1);
  BR.shadow(ID.LEG, 0.8, 0.8, 0.1, ID.FOLD, 1);
  BR.shadow(ID.BODY, 0.6, 1, 0.12, ID.FOLD, 1);
  sk.np();
  BR.emit({ drop: 1.3 * k, seam: 0.55, seamDark: 0.3, ao: 0.06, aoR: 2 });
  const ep = drawHeadEyes(sk, H, k, eye);
  const hc = H.p(2.4, -2.5);
  return { head: [hc[0], hc[1] - 2 * k] as V2, eye: ep };
}

/** Gliding, seen from above: the sail one scalloped sheet between the outstretched limbs; anchor = body centre. */
function drawGlide(sk: Sk, M: M, P: P, k: number, eye: BeastEye) {
  const b = P.billow;
  const q = (x: number, y: number, s2 = 0): LM => [x * k, y * k, s2];
  const v = (x: number, y: number): V2 => [x * k, y * k];
  // the limbs, spread: the near side (toward the viewer) lower on screen
  const shN = v(4.5, 2.4), shF = v(4.5, -2.4), hpN = v(-5.5, 2.4), hpF = v(-5.5, -2.4);
  const wrN = v(11, 13 + b * 0.4), wrF = v(11, -11 - b * 0.4), anN = v(-10.5, 12.4 + b * 0.3), anF = v(-10.5, -10.4 - b * 0.3);
  const sag = 3.2 + b * 0.9;
  const R = Relief.full(sk);
  // the sail: one contour from the far wrist round the far edge, the tail root, the near edge and back over the neck
  const sail: LM[] = [
    [wrF[0], wrF[1], 0.6], q(7, -8.4 - b * 0.3), q(3, -7.6 + sag * 0.3), q(-1.5, -7.2 + sag * 0.4), q(-6, -8 + sag * 0.3), [anF[0], anF[1], 0.6],
    q(-11.4, -6.8), q(-9.6, -2.6), q(-9.6, 2.6), q(-11.4, 8.4), [anN[0], anN[1], 0.6],
    q(-6, 10 - sag * 0.3), q(-1.5, 9.2 - sag * 0.4), q(3, 9.6 - sag * 0.3), q(7, 10.6 + b * 0.3), [wrN[0], wrN[1], 0.6],
    q(10.4, 7.6), q(7.6, 3.6), q(7.6, -3.6), q(10.4, -6),
  ];
  const so = fringe(spline(sail, 0.6), 1.5, 61, (x, y) => (Math.abs(y) > 5.5 * k && Math.abs(x) < 9 * k ? [0.7 * k, -0.5] : null));
  R.region(so, { z: 0, R: 1.6 * k, H: 1.6 * k, id: ID.SAIL, tex: (p, o) => {
    const near = p.y > 0;
    // fur radiating from the flanks out to the margin; a dark band inside the pale margin
    const ang = Math.atan2(p.y, p.x * 0.6) + (near ? 0 : 0);
    o.z += strands(p.x, p.y, ang, 2.2, 1, 63) * 0.5;
    o.m = M.sail;
    if (p.s < 1.2 * k) { o.m = M.edge; return; }
    if (p.s < 2.4 * k) { o.m = M.sailD; return; }
    if (!near) o.t -= 0.06;
    if (FS.tip > 0.85 && hh(FS.row, FS.seg, 65) < 0.3) o.t += 0.06;
  } });
  // the limbs as ridges through the sail, the hands and feet spread at its corners
  for (const [a, c] of [[shN, wrN], [shF, wrF], [hpN, anN], [hpF, anF]] as [V2, V2][]) {
    R.line([a, [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2], c], 1.6 * k, 1.1 * k, { only: ID.SAIL, taper: false });
  }
  for (const [c, dirA, front] of [[wrN, 0.5, true], [wrF, -0.5, true], [anN, 2.4, false], [anF, -2.4, false]] as [V2, number, boolean][]) {
    const ca = Math.cos(dirA), sa = Math.sin(dirA);
    const L = front ? 2 : 2.4;
    const pp = (x: number, y: number, s2 = 0): LM => [c[0] + (x * ca - y * sa) * k, c[1] + (x * sa + y * ca) * k, s2];
    R.region(spline([pp(-1, -0.9), pp(L * 0.7, -1), pp(L, 0, 0.3), pp(L * 0.7, 1), pp(-1, 0.9)], 0.4), { z: 2 * k, R: 0.6, H: 0.9, id: ID.PAW, tex: (p, o) => { o.m = p.u > 0.55 ? M.pad : M.fur; } });
    for (let i = -1; i <= 1; i += 2) { const bb = pp(L - 0.2, i * 0.5); claw(R, [bb[0], bb[1]], dirA + i * 0.35, 0.9 * k, 0.6 * k, 0.4 * i, 2.6 * k, ID.CLAW, M.claw); }
  }
  // the tail streaming behind
  tailInto(R, M, v(-8.6, 0), Math.PI + 0.04 + P.tail, i => (i < 5 ? -0.02 : 0.03) + P.tail * 0.02, k, 0.5 * k, 1.05, 11);
  // the body seen from above, arched over the sail: the dark stripe down the spine
  const body: LM[] = [q(-9.6, 0, 0.2), q(-8, -3), q(-3, -4), q(3, -3.8), q(7.4, -2.6), q(8.6, 0), q(7.4, 2.6), q(3, 3.8), q(-3, 4), q(-8, 3)];
  R.region(fringe(spline(body, 0.5), 1.4, 67, () => [0.6 * k, -0.5]), { z: 2 * k, R: 3 * k, H: 3 * k, id: ID.BODY, tex: (p, o) => {
    o.z += strands(p.x, p.y, Math.PI + p.y * 0.05, 2, 1, 69) * 0.55;
    o.m = Math.abs(p.y) < (0.9 + (FS.tip > 0.7 ? 0.3 : 0)) * k ? M.stripe : Math.abs(p.y) < 2.2 * k ? M.furD : M.fur;
  } });
  const H = new Frame2(v(8, 0), -0.04 * (b ? 1 : -1), k);
  headInto(sk, R, M, H, { ear: -0.6, jaw: 0, tongue: 0, eye, k, z: 5 * k, top: true });
  R.shadow(ID.BODY, 0.8, 1.4, 0.14, ID.SAIL, 2);
  R.shadow(ID.HEAD, 0.8, 1.4, 0.12, ID.SAIL, 2);
  R.shadow(ID.TAIL, 0.6, 1.2, 0.1, ID.SAIL, 1);
  sk.np();
  R.emit({ drop: 1.2 * k, seam: 0.55, seamDark: 0.3, ao: 0.06, aoR: 2 });
  const ep = drawHeadEyes(sk, H, k, eye, true);
  const hc = H.p(1, -3);
  return { head: [hc[0], hc[1] - 2 * k] as V2, eye: ep };
}

/** Asleep: curled round, the big ears folded, the bushy tail wrapped over the back and round the front like a blanket. */
function drawCurled(sk: Sk, M: M, P: P, k: number, eye: BeastEye) {
  sk.clipY = 0;
  const R = Relief.full(sk);
  const br = P.br * 0.35;
  const q = (x: number, y: number, s2 = 0): LM => [x * k, y * k, s2];
  const ctr: V2 = [-0.6 * k, -2 * k];
  const body: LM[] = [q(-7.8, -0.2, 0.3), q(-8.4, -3.6), q(-6.2, -7.4 - br), q(-1.8, -9 - br), q(2.6, -8.4 - br), q(5.6, -6), q(6.6, -3), q(6, -0.2, 0.3)];
  R.region(fringe(spline(body, 0.5), 1.4, 5, (_x, _y, _nx, ny) => (ny < -0.3 ? [0.6 * k, -0.5] : null)), { z: 0, R: 4 * k, H: 4.4 * k, id: ID.BODY, pow: 0.85, tex: (p, o) => {
    const a = Math.atan2(p.y - ctr[1], p.x - ctr[0]);
    o.z += strands(p.x, p.y, a - 1.5, 2, 1, 51) * 0.5;
    const r = Math.hypot(p.x - ctr[0], p.y - ctr[1]) / k;
    o.m = r > 5.6 && a < -1 && a > -2.4 ? M.stripe : r > 4.6 && a < -0.6 ? M.furD : M.fur;
  } });
  // head tucked low at the front, nose down toward the tail
  const H = new Frame2([3.2 * k, -5.4 * k], 0.5, k);
  headInto(sk, R, M, H, { ear: -0.8, jaw: 0, tongue: 0, eye, k, z: 6 * k });
  // the bushy tail over the back and round the front like a blanket
  tailInto(R, M, [-7.6 * k, -2 * k], -0.25, i => (i < 4 ? 0.02 : i < 7 ? 0.18 : 0.1), k, 11 * k, 0.95, 9, -0.8 * k);
  R.shadow(ID.TAIL, 0.6, 1, 0.12, ID.BODY, 1);
  R.shadow(ID.HEAD, 0.6, 1, 0.1, ID.BODY, 1);
  sk.np();
  R.emit({ drop: 1.3 * k, seam: 0.55, seamDark: 0.3, ao: 0.06, aoR: 2 });
  const ep = drawHeadEyes(sk, H, k, eye);
  return { head: [0, -9 * k * 2 - 3] as V2, eye: ep };
}

export const SAILGLIDER: SpeciesDef = {
  name: 'Sail Possum', kind: 'mammal', len: 28, height: 14,
  anims: ANIMS,
  canvas: (anim) => (anim === 'glide' ? { w: 96, h: 64, ox: 46, oy: 30 } : anim === 'climb' ? { w: 70, h: 70, ox: 44, oy: 34 } : { w: 80, h: 56, ox: 40, oy: 44 }),
  draw,
  eyeFor: (anim) => (anim === 'sleep' ? 'closed' : anim === 'alert' ? 'alert' : 'open'),
  anchor: { glide: 'centre', climb: 'grip' },
};

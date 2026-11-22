// Duskwaddler: a little flightless seabird that comes ashore at dusk. Its feathers have lost their
// vanes and become a dense, hair-like slate-blue pelt (shaggy as a kiwi's), shed water like fur and
// keep the night cold out of its burrow. Its feet are broad webbed shovels with spade claws for
// digging into the dunes; a pale spectacle round each big dusk-adapted eye; a hooked bill with tube
// nostrils; stubby flipper-wings it holds out for balance as it rocks along.
//
// Painted on the Relief layer through the seabird contour kit: the body and head are ONE contour
// through anatomical landmarks (the round rump, the hunched back, the nape, the domed crown, the
// steep forehead, the chin, the full chest and belly), its edge broken all round by hair tips; the
// pelt is lit as overlapping strands lying down and back, parted where the cream front begins; the
// flippers, the hooked bill and its tube nostril are their own contours; the shovel feet and spade
// claws are placed pixel by pixel.
//
// Faces right, anchored on the ground between the feet. Anims: idle, waddle, shake, preen, dig,
// call, alert, swim (half submerged in the wash, anchor = water line), burrow (sinks in).

import { Sk, V2, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, TAU, hh } from '../../beasts-core';
import { Frame2 } from '../../beasts-rig';
import { hex } from '../../color';
import { strands, FS } from '../../beasts-relief';
import { Relief, LM, Sp, Tx, spline, fringe, clamp } from '../sea/seabird-kit';

const A = (frames: number, fps: number, loop = true) => ({ frames, fps, loop });
const ANIMS = { idle: A(4, 3), waddle: A(6, 9), shake: A(4, 12), preen: A(4, 5), dig: A(6, 10), call: A(4, 6), alert: A(2, 3), swim: A(4, 5), burrow: A(5, 6, false) };

interface P {
  rock: number;        // side-to-side waddle lean (rad)
  bob: number;         // body bob (px)
  lean: number;        // forward lean (rad)
  feet: [V2, V2];      // near / far foot offsets (x, lift)
  flip: number;        // flippers held out 0..1
  head: number;        // head pitch
  hx: number;          // head forward
  open: number;        // bill gape
  fluff: number;       // pelt fluffed / shaking
  shakePh: number;
  sink: number;        // sunk into the burrow / the water (px)
  sand: number; sandPh: number;
  water: boolean;
  preen: number;       // bill buried in the chest fur 0..1
  eye?: BeastEye;
}
const base = (): P => ({ rock: 0, bob: 0, lean: 0.05, feet: [[1.6, 0], [-1.4, 0]], flip: 0.15, head: 0, hx: 0, open: 0, fluff: 0, shakePh: 0, sink: 0, sand: 0, sandPh: 0, water: false, preen: 0 });

function pose(anim: string, f: number, n: number): P {
  const p = base();
  const t = f / n, s = Math.sin(t * TAU);
  switch (anim) {
    case 'idle': p.head = [0, 0.1, -0.12, 0.05][f]; p.flip = f === 2 ? 0.35 : 0.15; p.bob = f === 1 ? 0.3 : 0; break;
    case 'waddle': {
      // rocking from foot to foot, flippers out for balance
      p.rock = s * 0.2; p.bob = -Math.abs(s) * 0.8; p.lean = 0.15; p.flip = 0.55 + Math.abs(s) * 0.2;
      const st = Math.cos(t * TAU);
      p.feet = [[1.6 + st * 1.6, Math.max(0, s) * 1.6], [-1.4 - st * 1.6, Math.max(0, -s) * 1.6]];
      p.head = 0.08 - s * 0.05;
      break;
    }
    case 'shake': p.fluff = 1; p.shakePh = t; p.rock = Math.sin(t * TAU * 2) * 0.25; p.flip = 0.8; p.head = Math.sin(t * TAU * 2) * 0.3; p.eye = 'closed'; break;
    case 'preen': p.preen = [0.6, 1, 0.8, 0.3][f]; p.head = 1.1; p.hx = -1; p.flip = 0.2; p.fluff = 0.3; break;
    case 'dig': {
      // head down in the dune face, the shovel feet kicking sand out behind
      p.lean = 0.95; p.bob = 2; p.head = 0.6; p.flip = 0.6;
      const k = f % 2;
      p.feet = [[k ? -3.5 : 1.2, k ? 2.2 : 0], [k ? 1 : -3.2, k ? 0 : 2]];
      p.sand = 1; p.sandPh = t;
      break;
    }
    case 'call': p.head = -0.85 - (f % 2) * 0.15; p.open = f % 2 ? 1 : 0.4; p.flip = 0.8; p.rock = (f % 2) * 0.08; p.lean = -0.1; break;
    case 'alert': p.lean = -0.12; p.head = f ? -0.15 : 0.1; p.flip = 0.05; p.bob = -0.5; p.eye = 'alert'; break;
    case 'swim': p.water = true; p.sink = 5.5 + s * 0.4; p.lean = 0.9; p.head = -0.7; p.flip = 0.4 + s * 0.3; break;
    case 'burrow': p.lean = 1 + f * 0.05; p.sink = f * 3.2; p.sand = f < 4 ? 1 : 0; p.sandPh = t; p.head = 0.6; p.flip = 0.5; break;
  }
  return p;
}

const EYE: EyeSpec = { r: 1, iris: hex('#2a1c14'), lash: hex('#141418'), dark: true, ring: hex('#e8e6dc') };
const ID = { BODY: 1, FLIP: 2, FLIPF: 3, BILL: 4, JAW: 5, TUBE: 6 };

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const P = pose(anim, frame, n);
  const k = juv ? 0.75 : 1;
  const M = {
    pelt: sk.m(rmp('#3c5c8e', { n: 7, dark: 0.62, light: 0.4, cool: 0.2, warm: 0.05 }), { edge: 1 }),
    peltD: sk.m(rmp('#2c3e60', { n: 6, dark: 0.55, light: 0.3, cool: 0.2 }), { edge: 1 }),
    tipL: sk.m(rmp('#6a88b4', { n: 5, dark: 0.5, light: 0.35, cool: 0.2 }), { edge: 1 }),
    belly: sk.m(rmp('#f4eedf', { n: 6, dark: 0.32, at: 4, cool: 0.3 }), { edge: 1, bias: 0.22 }),
    bellyD: sk.m(rmp('#c8c0b4', { n: 5, dark: 0.4, cool: 0.3 }), { edge: 1 }),
    spect: sk.m(rmp('#d8e0e8', { n: 4, dark: 0.3, at: 3, cool: 0.4 }), { edge: 0, bias: 0.06 }),
    bill: sk.m(rmp('#4a4648', { n: 5, dark: 0.5, light: 0.4 }), { spec: 0.4 }),
    tipM: sk.m(rmp('#d8cfc0', { n: 4, dark: 0.45 }), { spec: 0.3 }),
    tube: sk.m(rmp('#6a6468', { n: 4, dark: 0.45, light: 0.35 }), { spec: 0.3 }),
    foot: sk.m(rmp('#ea9a7a', { n: 5, dark: 0.42, cool: 0.06 }), { edge: 1 }),
    web: sk.m(rmp('#e48a6c', { n: 5, dark: 0.4, light: 0.35, cool: 0.06 }), { edge: 1 }),
    claw: sk.m(rmp('#3a3030', { n: 3, dark: 0.4, light: 0.3 })),
    mouth: sk.m(rmp('#6a2a30', { n: 3, dark: 0.4 }), { edge: 0 }),
  };
  sk.clipY = 0;
  const by = -(7.4 + P.bob) * k + P.sink;
  const B = new Frame2([0, by], P.lean + P.rock * 0.4, k);
  const RX = 4.4 * (1 + P.fluff * 0.12), RY = 6 * (1 + P.fluff * 0.08);
  const bp = (x: number, y: number, sh = 0): LM => { const q = B.p(x, y); return [q[0], q[1], sh]; };
  const H = B.sub(1.2 + P.hx, -RY * 0.95, P.head - P.lean * 0.6);
  const hR = 3 * (1 + P.fluff * 0.08);
  const hp = (x: number, y: number, sh = 0): LM => { const q = H.p(x * hR, y * hR); return [q[0], q[1], sh]; };
  const hl = (x: number, y: number): V2 => { const dx = (x - H.o[0]) / k, dy = (y - H.o[1]) / k, c = Math.cos(-H.a), s = Math.sin(-H.a); return [(dx * c - dy * s) / hR, (dx * s + dy * c) / hR]; };
  const bl = (x: number, y: number): V2 => { const dx = (x - B.o[0]) / k, dy = (y - B.o[1]) / k, c = Math.cos(-B.a), s = Math.sin(-B.a); return [(dx * c - dy * s) / RX, (dx * s + dy * c) / RY]; };

  // ---- feet: broad webbed shovels with spade claws, placed pixel by pixel (drawn under the body)
  const foot = (near: boolean) => {
    if (P.water) return;
    const o = near ? P.feet[0] : P.feet[1];
    const z = near ? 6 : -6, lt = near ? 0 : -0.16;
    const x0 = Math.round((o[0] - 1.6) * k), lift = Math.round(o[1] * k);
    const gy = -0.5 - lift + P.sink;
    const L = Math.max(4, Math.round(5 * k));
    // the stubby leg into the fur
    const ax = x0 + Math.round(1.6 * k) + 0.5;
    sk.line(ax, gy - 1, ax, Math.min(gy - 1, by + RY * 0.75 * k), M.foot, 0.5 + lt, z - 0.5);
    for (let i = 0; i < L; i++) {
      const x = x0 + i + 0.5;
      // the sole (pink) and the broad web on top of it, toe ridges every other pixel
      sk.dot(x, gy, i === 0 ? M.foot : M.web, (i & 1 ? 0.62 : 0.5) + lt, z);
      if (i > 0 && i < L - 1) sk.dot(x, gy - 1, i & 1 ? M.foot : M.web, (i & 1 ? 0.72 : 0.6) + lt, z);
    }
    // three spade claws fanned along the front edge
    sk.dot(x0 + L + 0.5, gy, M.claw, 0.55 + lt, z + 0.1);
    sk.dot(x0 + L - 0.5, gy - 1, M.claw, 0.45 + lt, z + 0.1);
    if (L > 4) sk.dot(x0 + L + 0.5, gy - 1, M.claw, 0.6 + lt, z + 0.1);
  };
  foot(false);

  // ---- flippers: stubby, fur-covered blades held out for balance
  const flipper = (R: Relief, near: boolean) => {
    const sh = B.p(near ? 1 : -0.6, -RY * 0.35);
    const a = B.ang(Math.PI * 0.62 - P.flip * 0.9 + (near ? 0 : 0.15));
    const L = 5.2 * k;
    const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
    const F = (t: number, w: number, s = 0): LM => [sh[0] - (near ? 0 : 1) * t + ca * t * L + nx * w * k, sh[1] + sa * t * L + ny * w * k, s];
    const lm: LM[] = [F(-0.1, -1.6), F(0.45, -1.35), F(0.85, -0.8), F(1.02, -0.1, 0.3), F(0.92, 0.6), F(0.5, 1.1), F(0.0, 1.7)];
    R.region(fringe(spline(lm, 0.4), 1.6, near ? 61 : 63, (_x, _y, _nx, ny2) => (ny2 > 0.2 ? [0.6 * k, 0.6] : null)), {
      z: near ? 14 : -4, R: 1.1 * k, H: 1.4 * k, id: near ? ID.FLIP : ID.FLIPF, tex: (p, o) => {
        o.z += strands(p.x, p.y, a + 0.2, 1.6, 0.9, near ? 5 : 7) * 0.5;
        o.m = FS.tip > 0.85 ? M.tipL : M.pelt;
        // the trailing edge darker
        const v = (p.x - sh[0]) * nx + (p.y - sh[1]) * ny;
        if (v > 0.6 * k) o.m = M.peltD;
      },
    });
  };
  {
    const R = Relief.full(sk);
    flipper(R, false);
    sk.np();
    R.emit({ drop: 1.2, seam: 0.5, seamDark: 0.2, bias: -0.12 });
  }

  // ---- body and head: one shaggy contour
  const R = Relief.full(sk);
  const shake = P.fluff ? Math.sin(P.shakePh * TAU * 2) : 0;
  const outline: LM[] = [
    bp(0, RY * 1.0), bp(-RX * 0.58, RY * 0.9), bp(-RX * 0.98, RY * 0.38), bp(-RX * 1.02, -RY * 0.2), bp(-RX * 0.8, -RY * 0.66),
    hp(-0.95, 0.15), hp(-0.82, -0.6), hp(-0.3, -0.98), hp(0.4, -0.9), hp(0.85, -0.42, 0.2), hp(0.85, 0.38, 0.2), hp(0.5, 0.82), hp(-0.05, 1.0),
    bp(RX * 0.82, -RY * 0.42), bp(RX * 1.0, 0), bp(RX * 0.9, RY * 0.45), bp(RX * 0.5, RY * 0.9),
  ];
  const poly = fringe(spline(outline, 0.45), 1.5, 71, (x, y, nx, ny) => {
    const [hx, hy] = hl(x, y);
    // the face round the bill stays smooth; elsewhere hair breaks the edge, longer when shaking
    if (hx > 0.55 && Math.abs(hy) < 0.7) return null;
    if (ny > 0.75 && !P.water) return [0.5 * k, 0];
    return [(0.9 + P.fluff * 1.1) * k, (nx > 0 ? -0.55 : 0.55) + shake * 0.5];
  });
  R.region(poly, {
    z: 0, R: 3 * k, H: 4 * k, id: ID.BODY, tex: (p: Sp, o: Tx) => {
      const [u, v] = bl(p.x, p.y);
      const [hx, hy] = hl(p.x, p.y);
      const head = hx * hx + hy * hy < 1.25 && v < -0.55;
      // the pelt: strands lying down and back (on the head, back from the face)
      const ang = head ? H.a + Math.PI * 0.9 : B.a + Math.PI * 0.6 + shake * 0.4;
      const sh = strands(p.x, p.y, ang, 2.2 * k, 1.05 * k, 13);
      o.z += sh * (0.55 + P.fluff * 0.4);
      // the cream front, its edge ragged with strands
      const front = u > -0.22 - v * 0.22 + (sh * 0.18) && v > -0.74 && v < 0.98;
      o.m = front ? (sh < -0.38 ? M.bellyD : M.belly) : v > 0.55 ? M.peltD : M.pelt;
      if (front) o.t += 0.06;
      if (!front && FS.tip > 0.86 && sh > 0) o.m = M.tipL;
      if (head) {
        // the cream lower face and the pale spectacle round the big eye
        if (hy > 0.32 && hx > -0.15) o.m = sh < -0.3 ? M.bellyD : M.belly;
        const ed = Math.hypot(hx - 0.27, hy + 0.17);
        if (ed > 0.33 && ed < 0.5 + (hR * k > 4 ? 0.06 : 0) && hx > -0.3) o.m = M.spect;
      }
    },
  });
  // brow over the eye and the full chest
  { const q = H.p(0.25 * hR, -0.55 * hR); R.bump(q[0], q[1], 1.6 * k, 0.9 * k, 0.6, H.a, ID.BODY); }
  { const q = B.p(RX * 0.55, -RY * 0.1); R.bump(q[0], q[1], 2.6 * k, 3 * k, 0.9, B.a, ID.BODY); }

  // ---- hooked bill with a tube nostril
  const bx = 0.78 * hR;
  const tipx = 5.4 - P.preen * 1, tipy = 1.2 + P.preen * 1.5;
  const bz = 7;
  const hs = (x: number, y: number, sh = 0): LM => { const q = H.p(x, y); return [q[0], q[1], sh]; };
  const oa = P.open * 0.5, co = Math.cos(oa), so = Math.sin(oa);
  const J = (x: number, y: number, sh = 0): LM => { const dx = x - bx, dy = y - 0.5; return hs(bx + dx * co - dy * so, 0.5 + dx * so + dy * co, sh); };
  R.region(spline([J(bx - 0.2, 0.45), J(tipx - 0.9, tipy * 0.55 + 0.3), J(tipx - 0.5, tipy * 0.6 + 0.75, 0.5), J(bx + 1, 1.5), J(bx - 0.2, 1.4)], 0.3), { z: bz, R: 0.5, H: 0.5, id: ID.JAW, tex: P.open > 0.25 ? M.bill : M.bill });
  if (P.open > 0.25) R.region(spline([hs(bx, 0.35), hs(tipx - 0.8, tipy * 0.5), J(tipx - 1, tipy * 0.55 + 0.3), J(bx, 0.6)], 0.3), { z: bz - 0.2, R: 0.3, H: 0.2, id: ID.JAW, tex: M.mouth });
  R.region(spline([hs(bx - 0.3, -1.15), hs(bx + 1.3, -1.05), hs(tipx - 0.6, -0.45 + tipy * 0.2), hs(tipx, tipy * 0.55, 0.3), hs(tipx - 0.15, tipy + 0.2, 0.9), hs(tipx - 0.7, tipy * 0.62), hs(bx + 1, 0.42), hs(bx - 0.3, 0.45)], 0.3), {
    z: bz + 0.4, R: 0.6, H: 0.7, id: ID.BILL, tex: (p, o) => {
      const [hx] = hl(p.x, p.y);
      o.m = hx * hR > tipx - 1.1 ? M.tipM : M.bill;
    },
  });
  // the tube nostril on the culmen, its opening a dark pixel
  R.tube([H.p(bx + 0.1, -1.05), H.p(bx + 1.7, -0.95)], t => 0.62 - t * 0.12, { z: bz + 1.2, id: ID.TUBE, tex: (p, o) => { o.m = p.t > 0.8 ? M.claw : M.tube; } });
  flipper(R, true);
  R.shadow(ID.FLIP, 0.6, 1.2, 0.12, ID.BODY, 1);
  R.shadow(ID.BILL, 0.4, 0.8, 0.1, ID.BODY, 1);
  sk.np();
  R.emit({ drop: 1.4, seam: 0.6, seamDark: 0.24, ao: 0.06, aoR: 2 });

  // ---- the big dusk eye
  const ep = H.p(0.27 * hR, -0.17 * hR);
  const e = drawEye(sk, ep[0], ep[1], { ...EYE, r: juv ? 0.75 : 1 }, P.eye ?? eye);
  // ---- near foot
  foot(true);
  // ---- kicked sand / water ripple
  sk.clipY = Infinity;
  if (P.sand) for (let i = 0; i < 8; i++) {
    const ph = (P.sandPh + i / 8) % 1;
    sk.over((-3 - ph * 9) * k, -1 - Math.sin(ph * Math.PI) * (5 + (i % 3) * 2), hex(i % 2 ? '#d4bc8c' : '#b89e70'));
  }
  if (P.water) for (let x = -7; x < 8; x++) if (hh(x, 1, 4) > 0.3) sk.over(x, 0, hex('#dff4f8'));
  if (P.sink > 0 && !P.water) for (let x = -6; x <= 6; x++) if (hh(x, 2, 7) > 0.4) sk.over(x, -0.5, hex('#c8ae80'));
  const top = H.p(0, -hR);
  return { head: [top[0], top[1] - 1] as V2, eye: e };
}
void clamp;

export const DUSKWADDLER: SpeciesDef = {
  name: 'Duskwaddler', kind: 'bird', len: 10, height: 15,
  anims: ANIMS,
  canvas: () => ({ w: 34, h: 30, ox: 15, oy: 25 }),
  draw,
  eyeFor: (anim) => (anim === 'alert' ? 'alert' : anim === 'shake' ? 'closed' : 'open'),
};

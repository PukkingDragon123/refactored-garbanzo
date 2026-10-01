// Duskwaddler: a little flightless seabird that comes ashore at dusk. Its feathers have lost their
// vanes and become a dense, hair-like slate-blue pelt (shaggy as a kiwi's), shed water like fur and
// keep the night cold out of its burrow. Its feet are broad webbed shovels with spade claws for
// digging into the dunes; a pale spectacle round each big dusk-adapted eye; a hooked bill with tube
// nostrils; stubby flipper-wings it holds out for balance as it rocks along.
//
// Faces right, anchored on the ground between the feet. Anims: idle, waddle, shake, preen, dig,
// call, alert, swim (half submerged in the wash, anchor = water line), burrow (sinks in).

import { Sk, V2, Px, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, TAU, hh, sm } from '../../beasts-core';
import { Frame2 } from '../../beasts-rig';
import { hex } from '../../color';

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

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const P = pose(anim, frame, n);
  const k = juv ? 0.75 : 1;
  const M = {
    pelt: sk.m(rmp('#3c5c8e', { n: 6, dark: 0.6, light: 0.38, cool: 0.2, warm: 0.05 }), { edge: 1 }),
    peltD: sk.m(rmp('#2c3e60', { n: 5, dark: 0.55, cool: 0.2 }), { edge: 1 }),
    belly: sk.m(rmp('#f2ecdf', { n: 5, dark: 0.34, at: 3, cool: 0.08 }), { edge: 1, bias: 0.2 }),
    bill: sk.m(rmp('#4a4648', { n: 4, dark: 0.5, light: 0.4 }), { spec: 0.4 }),
    tipM: sk.m(rmp('#d8cfc0', { n: 4, dark: 0.45 }), { spec: 0.3 }),
    foot: sk.m(rmp('#ea9a7a', { n: 5, dark: 0.42, cool: 0.06 }), { edge: 1 }),
    web: sk.m(rmp('#e48a6c', { n: 4, dark: 0.4, cool: 0.06 }), { edge: 1 }),
    claw: sk.m(rmp('#3a3030', { n: 3, dark: 0.4 })),
    mouth: sk.m(rmp('#6a2a30', { n: 3, dark: 0.4 }), { edge: 0 }),
    sand: sk.m(rmp('#d4bc8c', { n: 3, dark: 0.35 }), { edge: 0, noRim: true }),
  };
  sk.clipY = P.water ? 0 : 0;
  const by = -(7.4 + P.bob) * k + P.sink;
  const B = new Frame2([0, by], P.lean + P.rock * 0.4, k);
  const RX = 4.4 * (1 + P.fluff * 0.12), RY = 6 * (1 + P.fluff * 0.08);
  // ---- feet: broad webbed shovels with spade claws (drawn under the body)
  const foot = (near: boolean) => {
    if (P.water) return;
    const o = near ? P.feet[0] : P.feet[1];
    const z = near ? 6 : -6, bias = near ? 0 : -0.15;
    const hx = (near ? 0.9 : -0.9) + o[0] * 0.3;
    const ank: V2 = [hx * k, (-1.6 - o[1] * 0.6) * k + P.sink];
    const toe: V2 = [(o[0] + 3.2) * k, (-0.6 - o[1]) * k + P.sink];
    const heel: V2 = [(o[0] - 1.6) * k, (-0.5 - o[1]) * k + P.sink];
    sk.np();
    sk.tube([[hx * k, by + RY * 0.7 * k], ank], 1.1 * k, M.foot, { z, bias });
    sk.poly([ank[0], ank[1], toe[0], toe[1] - 1, toe[0] + 0.6, toe[1] + 0.4, heel[0], heel[1] + 0.4], M.web, { z: z + 0.5, bias });
    for (let c = 0; c < 3; c++) sk.line(toe[0] - c * 1.4, toe[1] - 0.2 + c * 0.1, toe[0] - c * 1.4 + 1, toe[1] + 0.4, M.claw, 0.3, z + 1);
  };
  foot(false);
  // ---- far flipper
  const flipper = (near: boolean) => {
    const sh = B.p(near ? 1 : -0.6, -RY * 0.35);
    const a = B.ang(Math.PI * 0.62 - P.flip * 0.9 + (near ? 0 : 0.15));
    const L = 5.2 * k;
    const tip: V2 = [sh[0] + Math.cos(a) * L - (near ? 0 : 1), sh[1] + Math.sin(a) * L];
    sk.np();
    sk.blade(sh[0], sh[1], tip[0], tip[1], s => Math.max(0.4, (1.7 - s * 1.1) * k), (p) => (p.v > 0.5 ? M.peltD : M.pelt), { z0: near ? 14 : -4, z1: near ? 14 : -4, bias: near ? 0 : -0.15 });
  };
  flipper(false);
  // ---- body: an upright egg of hair-like slate fur, cream front
  sk.np();
  const bc = B.p(0, 0);
  sk.ell(bc[0], bc[1], RX * k, RY * k, (p: Px) => {
    p.l += (hh(Math.floor(p.x * 1.5), Math.floor(p.y * 1.2), 7) - 0.5) * 0.14;
    if (p.u > -0.05 - p.v * 0.25 && p.v > -0.7) return M.belly;
    return p.v > 0.6 ? M.peltD : M.pelt;
  }, { rot: B.a, rz: 4 * k });
  const body = sk.pid;
  sk.streaks(body, () => [-0.15, 1], { spacing: 2, len: 3, amp: 0.12, seed: 3 });
  // shaggy: hair tufts all round the outline (longer when fluffed / shaking)
  sk.tufts(body, (_x, _y, nx, ny) => (ny < 0.5 ? [nx * 0.6 + (P.fluff ? Math.sin(P.shakePh * TAU * 2) * 0.5 : -0.3), ny * 0.4 + 0.7] as V2 : null), { every: 2, len: P.fluff ? 2 : 1, seed: 5 });
  // ---- head
  const H = B.sub(1.2 + P.hx, -RY * 0.95, P.head - P.lean * 0.6);
  sk.np();
  const hc = H.p(0, 0);
  sk.ell(hc[0], hc[1], 3 * k, 2.7 * k, (p) => (p.v > 0.35 && p.u > -0.1 ? M.belly : M.pelt), { rot: H.a, rz: 2.6 * k, z: 4 });
  sk.tufts(sk.pid, (_x, _y, _nx, ny) => (ny < 0 ? [-0.4, -1] as V2 : null), { every: 2, len: 1, seed: 9 });
  // hooked bill with a tube nostril
  const b0 = H.p(2.4, 0.2), b1 = H.p(5.4 + P.preen * -1, 1.2 + P.preen * 1.5);
  sk.np();
  sk.blade(b0[0], b0[1] - 0.3, b1[0], b1[1], s => Math.max(0.4, (1.1 - s * 0.6) * k), (p) => (p.t > 0.78 ? M.tipM : M.bill), { z0: 6, z1: 6, bend: -0.4 });
  if (P.open > 0.2) { const lt = H.p(5, 2.2 + P.open * 1.4); sk.line(b0[0], b0[1] + 0.8, lt[0], lt[1], M.bill, 0.3, 5.8); sk.line(b0[0] + 0.5, b0[1] + 0.5, lt[0] - 0.6, lt[1] - 0.7, M.mouth, 0.2, 5.9); }
  const ns = H.p(3, -0.4); sk.over(ns[0], ns[1], hex('#2a2a2e'));
  const ep = H.p(0.8, -0.5);
  const e = drawEye(sk, ep[0], ep[1], { ...EYE, r: juv ? 0.75 : 1 }, P.eye ?? eye);
  // ---- near flipper and foot
  flipper(true);
  foot(true);
  // ---- kicked sand / water ripple
  if (P.sand) for (let i = 0; i < 8; i++) {
    const ph = (P.sandPh + i / 8) % 1;
    sk.over((-3 - ph * 9) * k, -1 - Math.sin(ph * Math.PI) * (5 + (i % 3) * 2), hex(i % 2 ? '#d4bc8c' : '#b89e70'));
  }
  sk.clipY = Infinity;
  if (P.water) for (let x = -7; x < 8; x++) if (hh(x, 1, 4) > 0.3) sk.over(x, 0, hex('#dff4f8'));
  if (P.sink > 0 && !P.water) for (let x = -6; x <= 6; x++) if (hh(x, 2, 7) > 0.4) sk.over(x, -0.5, hex('#c8ae80'));
  void sm;
  return { head: [hc[0], hc[1] - 4] as V2, eye: e };
}

export const DUSKWADDLER: SpeciesDef = {
  name: 'Duskwaddler', kind: 'bird', len: 10, height: 15,
  anims: ANIMS,
  canvas: () => ({ w: 34, h: 30, ox: 15, oy: 25 }),
  draw,
  eyeFor: (anim) => (anim === 'alert' ? 'alert' : anim === 'shake' ? 'closed' : 'open'),
};

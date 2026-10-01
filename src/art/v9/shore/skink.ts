// Kelp Skink: a copper-striped skink of the wrack line with ruffled flaps of skin down its flanks and
// tail that look exactly like torn kelp fronds. Basking, it spreads the flaps flat to soak up the sun
// (they are full of blood vessels); hiding, it presses into the drift and becomes another strand of
// rotting kelp. Males flash an orange throat at rivals with a burst of head-bobs.
//
// Faces right, anchored on the ground under the body. Anims: idle (bask), walk, dash, pounce, eat,
// display, hide.

import { Sk, V2, Px, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, TAU, hh, ik2 } from '../../beasts-core';
import { hex } from '../../color';

const A = (frames: number, fps: number, loop = true) => ({ frames, fps, loop });
const ANIMS = { idle: A(4, 2), walk: A(6, 10), dash: A(4, 18), pounce: A(4, 12, false), eat: A(4, 8), display: A(4, 8), hide: A(2, 1) };

interface P {
  wave: number; waveA: number;  // lateral S-wave (in side view: small vertical ripple + leg phase)
  lift: number;                 // body raised on the legs
  head: number;                 // head raise (rad)
  hx: number;                   // head thrust forward
  open: number;                 // jaws
  throat: number;               // throat fan 0..1
  flaps: number;                // flaps spread 0 (pressed flat) .. 1 (fanned out basking)
  legPh: number; moving: boolean;
  tail: number;                 // tail curl up
  prey: boolean;
  flat: number;                 // pressed flat (hiding)
}
function pose(anim: string, f: number, n: number): P {
  const t = f / n;
  const p: P = { wave: 0, waveA: 0, lift: 0.5, head: 0.08, hx: 0, open: 0, throat: 0, flaps: 0.6, legPh: 0, moving: false, tail: 0, prey: false, flat: 0 };
  switch (anim) {
    case 'idle': p.flaps = 1; p.lift = 0.15; p.throat = f === 2 ? 0.25 : 0; p.head = 0.12 + (f === 1 ? -0.06 : 0); break;
    case 'walk': p.moving = true; p.legPh = t; p.wave = t; p.waveA = 0.6; p.flaps = 0.5; break;
    case 'dash': p.moving = true; p.legPh = t; p.wave = t; p.waveA = 1; p.lift = 0.9; p.flaps = 0.2; p.head = 0; p.tail = -0.15; break;
    case 'pounce': p.lift = [0.2, 1.2, 0.8, 0.3][f]; p.hx = [-1, 3, 4, 2][f]; p.head = [0.3, -0.05, 0.15, 0.2][f]; p.open = [0, 1, 0.6, 0][f]; p.flaps = 0.2; p.prey = f >= 2; break;
    case 'eat': p.head = -0.1 + (f % 2) * 0.12; p.open = f % 2 ? 0.7 : 0.2; p.prey = f < 3; p.flaps = 0.5; break;
    case 'display': p.lift = 1; p.head = [-0.3, 0.1, -0.3, 0.05][f]; p.throat = [1, 0.6, 1, 0.7][f]; p.flaps = 0.9; p.tail = 0.3; break;
    case 'hide': p.flat = 1; p.flaps = 0; p.lift = 0; p.head = 0.15; p.tail = -0.05 + f * 0.04; break;
  }
  return p;
}

const EYE: EyeSpec = { r: 0.8, iris: hex('#e0b030'), lash: hex('#1a1408'), pupil: hex('#140c08') };

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const P = pose(anim, frame, n);
  const k = juv ? 0.7 : 1;
  const M = {
    skin: sk.m(rmp('#93653a', { n: 6, dark: 0.6, light: 0.42, cool: 0.12 }), { edge: 1, spec: 0.3 }),
    stripe: sk.m(rmp('#e8b45a', { n: 5, dark: 0.45, cool: 0.08 }), { edge: 1, spec: 0.3 }),
    belly: sk.m(rmp('#d8c890', { n: 4, dark: 0.4, cool: 0.08 }), { edge: 1 }),
    flap: sk.m(rmp('#4a5a22', { n: 5, dark: 0.55, light: 0.42, cool: 0.1 }), { edge: 1 }),
    flapE: sk.m(rmp('#a6a43a', { n: 4, dark: 0.45, cool: 0.05 }), { edge: 1 }),
    throat: sk.m(rmp('#f08a2a', { n: 4, dark: 0.45, cool: 0.08 }), { spec: 0.3 }),
    claw: sk.m(rmp('#3a3020', { n: 3, dark: 0.4 })),
    mouth: sk.m(rmp('#7a2a2a', { n: 3, dark: 0.4 }), { edge: 0 }),
    bug: sk.m(rmp('#b09060', { n: 3, dark: 0.4 }), { edge: 0 }),
  };
  sk.clipY = 0;
  const L = 27 * k, by = -(1.6 + P.lift * 1.4 - P.flat * 0.6) * k;
  // spine: tail tip (x=-12) -> snout (x=+10)
  const N = 12;
  const pts: V2[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const x = -16 * k + u * L + (u > 0.8 ? P.hx * (u - 0.8) * 5 : 0);
    let y = by - Math.sin((P.wave + u * 1.3) * TAU) * 0.35 * P.waveA * k;
    if (u < 0.35) y -= P.tail * (0.35 - u) * 10 * k; // tail curl
    if (u > 0.82) y -= Math.sin(P.head) * (u - 0.82) * 20 * k;
    pts.push([x, y]);
  }
  const rad = (t: number) => (t < 0.5 ? 0.3 + Math.pow(t / 0.5, 1.4) * 1.6 : t < 0.8 ? 1.9 - (t - 0.5) * 0.8 : t < 0.86 ? 1.55 : 1.9 - (t - 0.86) * 8) * k * (1 - P.flat * 0.2);
  // kelp flaps: ruffled fronds along the upper flank and the tail; spread for basking
  const flaps = (zz: number, under: boolean) => {
    for (let i = 0; i < 8; i++) {
      const u = 0.18 + i * 0.07;
      const a = pts[Math.floor(u * N)], b = pts[Math.floor(u * N) + 1];
      const nx = -(b[1] - a[1]), ny = b[0] - a[0], l = Math.hypot(nx, ny) || 1;
      const side = under ? 1 : -1;
      const root: V2 = [a[0], a[1] + side * rad(u) * 0.6];
      const len = (1.8 + hh(i, under ? 2 : 1, 5) * 1.6 + P.flaps * 2) * k * (under ? 0.6 : 1);
      const ang = Math.atan2(side * ny / l, side * nx / l) + (hh(i, 3, 5) - 0.5) * 0.7 - (1 - P.flaps) * 0.9 * -side * 0.5 - 0.5;
      const tip: V2 = [root[0] + Math.cos(ang) * len, Math.min(-0.3, root[1] + Math.sin(ang) * len)];
      sk.np(true);
      sk.blade(root[0], root[1], tip[0], tip[1], s => (0.9 + Math.sin(s * 9 + i) * 0.35) * k * (1 - s * 0.4), (p) => (p.t > 0.7 ? M.flapE : M.flap), { z0: zz, z1: zz });
    }
  };
  if (!P.flat) flaps(-2, true);
  // legs: short, splayed, claws on the sand
  const leg = (front: boolean, near: boolean) => {
    const u = front ? 0.76 : 0.5;
    const hip = pts[Math.round(u * N)];
    const ph = P.legPh * TAU + (front ? 0 : Math.PI) + (near ? 0 : Math.PI);
    const step = P.moving ? Math.sin(ph) * 2.2 * k : 0;
    const lift = P.moving ? Math.max(0, Math.cos(ph)) * 1.2 * k : 0;
    const foot: V2 = [hip[0] + (front ? 2.2 : -1.4) * k + step, -lift - 0.3];
    const [knee] = ik2(hip, foot, 2.4 * k, 2.4 * k, front ? 1 : -1);
    sk.np();
    const z = near ? 4 : -4, bias = near ? 0 : -0.15;
    sk.tube([hip, knee, foot], t => (0.8 - t * 0.25) * k, M.skin, { z, bias });
    sk.line(foot[0], foot[1], foot[0] + 1.2, Math.min(-0.2, foot[1] + 0.3), M.claw, 0.3, z + 1);
  };
  leg(true, false); leg(false, false);
  // body: banded olive with copper stripes, pale belly
  sk.np();
  sk.tube(pts, rad, (p: Px) => {
    if (p.v > 0.45) return M.belly;
    const band = Math.sin(p.t * 34);
    if (p.v > -0.55 && p.v < -0.15 && p.t > 0.2 && p.t < 0.85) return M.stripe;
    if (band > 0.8 && p.v < 0.3) p.l -= 0.12;
    return M.skin;
  }, { z: 0 });
  const body = sk.pid;
  void body;
  if (!P.flat) flaps(6, false);
  else {
    // hiding: flaps pressed down over the back like a strand of rotting kelp
    for (let i = 0; i < 10; i++) {
      const a = pts[1 + i];
      sk.np(true);
      sk.blade(a[0], a[1] - 1.2 * k, a[0] - 2.2 * k, a[1] - 0.2 + hh(i, 1, 2) * 0.6, s => (1 - s * 0.5) * 0.9 * k, (p) => (p.t > 0.6 ? M.flapE : M.flap), { z0: 7, z1: 7 });
    }
  }
  // head: a broad wedge skull with a pointed snout, throat fan, eye, mouth
  const hd = pts[N], hn = pts[N - 1];
  const ha = Math.atan2(hd[1] - hn[1], hd[0] - hn[0]);
  sk.np();
  const hcx = hd[0] - Math.cos(ha) * 2 * k, hcy = hd[1] - Math.sin(ha) * 2 * k;
  sk.ell(hcx, hcy, 3 * k, 1.9 * k * (1 - P.flat * 0.2), (p) => (p.v > 0.45 ? M.belly : p.v < -0.2 && p.u < 0.3 ? M.stripe : M.skin), { rot: ha, rz: 1.8 * k, z: 2 });
  sk.blade(hcx + Math.cos(ha) * 1.5 * k, hcy, hd[0] + Math.cos(ha) * 1.6 * k, hd[1] + Math.sin(ha) * 1.6 * k + 0.4, s => (1.3 - s * 0.9) * k, M.skin, { z0: 2.5, z1: 2.5 });
  if (P.throat > 0.1) {
    sk.np();
    const tc = pts[N - 2];
    sk.ell(tc[0], tc[1] + 1.4 * k, (1.2 + P.throat * 1.2) * k, (0.8 + P.throat * 1.4) * k, M.throat, { z: 3 });
  }
  if (P.open > 0.2) {
    const m0 = pts[N - 1];
    sk.line(m0[0], m0[1] + 0.6, hd[0] + Math.cos(ha + 0.6) * 1.5, hd[1] + Math.sin(ha + 0.6) * 1.5 + P.open, M.mouth, 0.2, 9, true);
  }
  const ep: V2 = [hd[0] - Math.cos(ha) * 2.2 * k, hd[1] - 0.7 * k];
  const e = drawEye(sk, ep[0], ep[1], { ...EYE, r: juv ? 0.6 : 0.8 }, eye);
  if (P.prey) { sk.np(); sk.ell(hd[0] + 0.8, hd[1] + 0.4, 1.1 * k, 0.7 * k, M.bug, { z: 10 }); }
  leg(true, true); leg(false, true);
  return { head: [hd[0], hd[1] - 3] as V2, eye: e };
}

export const KELPSKINK: SpeciesDef = {
  name: 'Kelp Skink', kind: 'reptile', len: 22, height: 4,
  anims: ANIMS,
  canvas: () => ({ w: 40, h: 20, ox: 18, oy: 15 }),
  draw,
  eyeFor: () => 'open',
};

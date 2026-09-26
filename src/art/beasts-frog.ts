// Moss Frog: a squat tree frog covered in ragged moss-like skin flaps, gold-flecked eyes and a
// pale vocal sac that balloons when it calls. Hides flat on logs; hunts with a lightning tongue.

import { Sk, V2, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, TAU, hh, ik2 } from './beasts-core';
import { hex } from './color';

const ANIMS = {
  idle: { frames: 4, fps: 2, loop: true },
  walk: { frames: 4, fps: 8, loop: true },
  hop: { frames: 4, fps: 8, loop: true },
  alert: { frames: 2, fps: 3, loop: true },
  call: { frames: 4, fps: 6, loop: true },
  eat: { frames: 4, fps: 12, loop: true },
  tongue: { frames: 4, fps: 12, loop: false },
  hide: { frames: 2, fps: 1, loop: true },
  sleep: { frames: 2, fps: 1, loop: true },
  swim: { frames: 4, fps: 6, loop: true },
};

const EYE: EyeSpec = { r: 1.4, iris: hex('#c8a030'), lash: hex('#2a3018'), pupil: hex('#101408'), slit: 'h' };

interface P { lift: number; crouch: number; stretch: number; sac: number; tongue: number; flat: number; legs: number; swim: number; head: number }

function pose(anim: string, f: number, n: number): P {
  const p: P = { lift: 0, crouch: 0, stretch: 0, sac: 0, tongue: 0, flat: 0, legs: 0, swim: -1, head: 0 };
  const t = f / n;
  switch (anim) {
    case 'idle': p.sac = f === 1 ? 0.15 : 0; p.crouch = f === 2 ? 0.1 : 0; break;
    case 'walk':
    case 'hop': p.lift = [0, 3.5, 4.5, 1.5][f]; p.stretch = [0, 1, 0.8, 0.2][f]; p.crouch = f === 0 ? 0.5 : 0; p.legs = p.stretch; break;
    case 'alert': p.head = -0.15; p.crouch = -0.3; break;
    case 'call': p.sac = [0.2, 0.8, 1, 0.5][f]; p.head = -0.1; break;
    case 'eat': case 'tongue': p.tongue = [0.3, 1, 0.6, 0][f]; p.head = -0.05; break;
    case 'hide': p.flat = 1; p.crouch = 0.6; break;
    case 'sleep': p.flat = 0.6; p.crouch = 0.5; break;
    case 'swim': p.swim = t; p.legs = 0.5 + Math.sin(t * TAU) * 0.5; break;
  }
  return p;
}

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const P = pose(anim, frame, n);
  const k = juv ? 0.6 : 1;
  const M = {
    skin: sk.m(rmp('#48662a', { n: 6, dark: 0.62, light: 0.35 }), { edge: 1 }),
    moss: sk.m(rmp('#6f8c30', { n: 5, dark: 0.55, light: 0.35 }), { edge: 1 }),
    dark: sk.m(rmp('#3e4a24', { n: 4, dark: 0.5 }), { edge: 1 }),
    belly: sk.m(rmp('#d8d0a0', { n: 4, dark: 0.45 }), { edge: 1 }),
    sac: sk.m(rmp('#f0e8c0', { n: 4, dark: 0.35, light: 0.6 }), { spec: 0.6 }),
    tongue: sk.m(rmp('#e87080', { n: 4, dark: 0.5 }), { spec: 0.4 }),
    toe: sk.m(rmp('#c8b070', { n: 4, dark: 0.5 })),
    water: sk.m(rmp('#bfe6f0', { n: 3, dark: 0.3 }), { noRim: true, edge: 0 }),
  };
  const swim = P.swim >= 0;
  const up = swim ? 0 : P.lift * k;
  const bh = (4.2 - P.crouch * 1 - P.flat * 1.4) * k;
  const bx = P.stretch * 1.2 * k, by = -bh - up + (swim ? bh * 0.9 : 0);
  const rot = swim ? 0.05 : -0.22 + P.stretch * 0.35 + P.head;
  if (swim) sk.clipY = -0.5;
  const mossy = (x: number, y: number) => hh(x * 1.3, y * 1.3, 7);
  const skinFill = (p: { x: number; y: number; v: number; l: number }) => {
    if (p.v > 0.5 && !P.flat) return M.belly;
    const m = mossy(p.x, p.y);
    if (m < 0.18) { p.l -= 0.12; return M.dark; }
    if (m > 0.7) { p.l += 0.05; return M.moss; }
    return M.skin;
  };
  // far hind leg
  const hind = (near: boolean) => {
    sk.np();
    const z = near ? 3 : -3, bias = near ? 0 : -0.15;
    const hip: V2 = [bx - 3.2 * k, by + 1.5 * k];
    const ext = swim ? P.legs : P.legs;
    const foot: V2 = swim ? [bx - (4 + ext * 5) * k, by + 1 * k] : [bx - (2.2 + ext * 5.5) * k + (near ? 0.5 : -0.8) * k, ext > 0.3 ? by + (2 + ext * 1.5) * k : 0];
    const [knee] = ik2(hip, foot, 3.6 * k, 3.4 * k, near ? 1 : 1);
    sk.tube([hip, knee], t => (1.9 - t * 0.6) * k, skinFill, { z, bias });
    sk.tube([knee, foot], t => (1.3 - t * 0.6) * k, skinFill, { z: z + 0.3, bias });
    for (let i = 0; i < 3; i++) sk.tube([foot, [foot[0] + (1.3 - i * 0.2) * k, foot[1] - 0.2 + i * 0.35]], 0.45 * k, M.toe, { z: z + 0.5, bias });
  };
  hind(false);
  // body: a squat pear with ragged moss flaps along the back
  sk.np();
  sk.ell(bx, by, 5 * k, bh * 0.85 + 0.6 * k, skinFill, { rot, rz: 3.6 * k });
  const bodyPart = sk.pid;
  sk.tufts(bodyPart, (_x, _y, nx, ny) => (ny < -0.2 ? [nx * 0.3, -1] as V2 : nx < -0.5 ? [-1, 0] as V2 : null), { every: 2, len: 1, seed: 3 });
  // skin flaps (ragged frills)
  for (let i = 0; i < 6; i++) {
    const a = -2.7 + i * 0.42 + rot;
    const x0 = bx + Math.cos(a) * 4.4 * k, y0 = by + Math.sin(a) * (bh * 0.8) * 0.95;
    const L = (1.4 + hh(i, 2, 5) * 1.2) * k * (1 + P.flat * 0.4);
    sk.np();
    sk.blade(x0, y0, x0 + Math.cos(a - 0.2) * L, y0 + Math.sin(a - 0.2) * L, s => (1 - s) * 0.8 * k + 0.25, i % 2 ? M.moss : M.dark, { z0: 2, z1: 2 });
  }
  // head
  sk.np();
  const hx = bx + 3.6 * k, hy = by - 0.6 * k;
  sk.ell(hx, hy, 3.4 * k, 2.6 * k * (1 - P.flat * 0.2), skinFill, { rot: rot * 0.6, rz: 2.4 * k, z: 2 });
  // vocal sac
  if (P.sac > 0.05) {
    sk.np();
    const r = (1 + P.sac * 2.4) * k;
    sk.ell(hx + 1.4 * k, hy + 2 * k + r * 0.3, r * 1.05, r, M.sac, { z: 6 });
  }
  // tongue
  if (P.tongue > 0.05) {
    sk.np();
    const L = P.tongue * 12 * k;
    const m0: V2 = [hx + 2.8 * k, hy + 0.8 * k];
    sk.tube([m0, [m0[0] + L * 0.6, m0[1] - L * 0.12], [m0[0] + L, m0[1] - L * 0.18]], t => (0.5 + (t > 0.85 ? 0.5 : 0)) * k, M.tongue, { z: 8 });
  }
  // front leg
  sk.np();
  const sh: V2 = [bx + 2.4 * k, by + 1.4 * k];
  const ff: V2 = swim ? [bx + 4 * k, by + 1.5 * k] : [bx + (3.4 + P.stretch * 2) * k, P.lift > 1 ? by + 3 * k : 0];
  sk.tube([sh, ff], t => (1.1 - t * 0.4) * k, skinFill, { z: 5 });
  for (let i = 0; i < 3; i++) sk.ell(ff[0] + (i - 1) * 0.8 * k + 0.4, ff[1] - 0.3, 0.55 * k, 0.45 * k, M.toe, { z: 6 });
  hind(true);
  // bulging eye on top of the head
  sk.np();
  const ex = hx + 0.6 * k, ey = hy - 2 * k * (1 - P.flat * 0.25);
  sk.ell(ex, ey, 1.9 * k, 1.7 * k, skinFill, { z: 4 });
  const e = drawEye(sk, ex + 0.2, ey - 0.1, { ...EYE, r: juv ? 0.75 : 1.2 }, eye);
  if (swim) {
    sk.clipY = Infinity;
    for (let x = -6; x < 9; x++) if (hh(x, 1, 2) > 0.35) sk.over(bx + x * k, 0, hex('#d8f2f8'));
  }
  return { head: [hx, hy - 4 * k] as V2, eye: e };
}

export const MOSSFROG: SpeciesDef = {
  name: 'Moss Frog', kind: 'amphibian', len: 12, height: 8,
  anims: ANIMS,
  canvas: (anim) => (anim === 'eat' || anim === 'tongue' ? { w: 44, h: 22, ox: 12, oy: 18 } : { w: 28, h: 24, ox: 12, oy: 20 }),
  draw,
  eyeFor: (anim) => (anim === 'sleep' ? 'closed' : anim === 'alert' ? 'alert' : 'open'),
};

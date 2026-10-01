// V9 jewel hornets: fruit-eating hornets banded in iridescent teal, violet and gold, drawn with the
// beast sketch core. World frames are tiny (about 10 x 7 px): two wingbeat frames with a blur ghost,
// perched with the wings folded (chewing a berry, mandibles working), and the dead hornet the
// zombie-cap fungus leaves clamped to a twig with its stalk bursting out of the thorax. A big
// version paints the field-guide portrait. All face right; anchor = body centre.

import { Sk, rmp, SpeciesDef, BeastEye, V2 } from '../../beasts-core';
import { hex } from '../../color';
import type { PixelBuffer } from '../../pixel';

export interface HornetFrame { buf: PixelBuffer; ax: number; ay: number }

type HPose = 'up' | 'down' | 'perch' | 'chew' | 'dead';

function mats(sk: Sk) {
  return {
    head: sk.m(rmp('#4a2e86', { n: 4, dark: 0.6, light: 0.6, cool: 0.2 }), { edge: 1 }),
    eye: sk.m(rmp('#e8b830', { n: 3, dark: 0.45, light: 0.5 }), { edge: 0, noRim: true }),
    thorax: sk.m(rmp('#149a86', { n: 4, dark: 0.6, light: 0.55, warm: 0.2 }), { edge: 1 }),
    gold: sk.m(rmp('#f2b622', { n: 4, dark: 0.5, light: 0.5 }), { edge: 1 }),
    violet: sk.m(rmp('#7a36c8', { n: 4, dark: 0.55, light: 0.5 }), { edge: 1 }),
    teal: sk.m(rmp('#1cc0a8', { n: 4, dark: 0.55, light: 0.5 }), { edge: 1 }),
    tip: sk.m(rmp('#20183a', { n: 3, dark: 0.4, light: 0.4 }), { edge: 1 }),
    leg: sk.m(rmp('#c07a2a', { n: 3, dark: 0.5, light: 0.4 }), { edge: 0 }),
    wing: sk.m(rmp('#c8d8f0', { n: 3, dark: 0.18, light: 0.5 }), { edge: 0, noRim: true, k: 0.4 }),
    fungus: sk.m(rmp('#efe6d2', { n: 4, dark: 0.4, light: 0.4 }), { edge: 1 }),
    knob: sk.m(rmp('#e86a3a', { n: 4, dark: 0.5, light: 0.45 }), { edge: 1 }),
    twig: sk.m(rmp('#6a4a2e', { n: 3, dark: 0.5, light: 0.4 }), { edge: 1 }),
  };
}

/** draw one hornet at scale k (1 = world) */
function drawHornet(sk: Sk, pose: HPose, k: number) {
  const M = mats(sk);
  const dead = pose === 'dead';
  const perched = pose === 'perch' || pose === 'chew' || dead;
  // wings behind (far) first
  const wing = (a: number, L: number, w: number, z: number) => {
    sk.np(true);
    sk.blade(0.2 * k, -1.1 * k, 0.2 * k + Math.cos(a) * L * k, -1.1 * k + Math.sin(a) * L * k, s => Math.sin(Math.min(1, s * 1.08) * Math.PI) * w * k + 0.25, M.wing, { z0: z, z1: z });
  };
  const wa = pose === 'up' ? -2.1 : pose === 'down' ? -0.55 : dead ? -2.6 : 2.85;
  if (!perched) wing(wa - 0.35, 4.4, 1.1, -2);
  // abdomen: gold, violet, teal bands and a dark stinger tip (curled under when dead)
  sk.np();
  const ax = -2.6 * k, ay = (dead ? 0.8 : 0.35) * k;
  sk.ell(ax, ay, 2.9 * k, 1.75 * k, (p) => {
    const u = (p.u + 1) / 2; // 0 tail .. 1 waist
    if (u < 0.14) return M.tip;
    const b = Math.floor(u * 4.2);
    return [M.gold, M.violet, M.gold, M.teal, M.teal][b] ?? M.teal;
  }, { rot: dead ? 0.5 : 0.18, z: 0, rz: 1.6 * k });
  sk.np();
  sk.line(ax - 2.9 * k, ay + 0.6 * k, ax - 3.6 * k, ay + 1.2 * k, M.tip, 0.3, 1, true);
  // thorax and head
  sk.np();
  sk.ell(0.5 * k, -0.35 * k, 1.55 * k, 1.35 * k, (p) => (p.v < -0.5 && Math.abs(p.u) < 0.4 ? M.gold : M.thorax), { z: 1.5, rz: 1.3 * k });
  sk.np();
  const hx = 2.4 * k, hy = (pose === 'chew' ? 0.35 : -0.25) * k;
  sk.ell(hx, hy, 1.2 * k, 1.15 * k, M.head, { z: 2, rz: 1 * k });
  // big gold compound eye
  sk.np(true);
  sk.ell(hx + 0.1 * k, hy - 0.2 * k, 0.65 * k, 0.8 * k, M.eye, { z: 3, rz: 0.6 * k });
  // legs: dangling in flight, gripping when perched
  for (let i = 0; i < 3; i++) {
    const lx = (0.9 - i * 0.8) * k;
    if (perched) sk.line(lx, 0.6 * k, lx + (i - 1) * 0.6 * k, (dead ? 1.4 : 1.7) * k, M.leg, 0.35, 3, true);
    else sk.line(lx, 0.7 * k, lx - 0.9 * k, 2.4 * k, M.leg, 0.35, 3, true);
  }
  // antennae
  sk.line(hx + 0.6 * k, hy - 0.9 * k, hx + 1.6 * k, hy - 2.1 * k, M.head, 0.3, 3, true);
  if (pose === 'chew') { sk.over(Math.floor(hx + 1.2 * k), Math.floor(hy + 0.8 * k), hex('#c01830')); }
  // near wing on top
  if (!perched) wing(wa, 4.8, 1.25, 4);
  else if (!dead) { sk.np(true); sk.blade(0.4 * k, -1.2 * k, -3.8 * k, -0.4 * k, s => Math.sin(Math.min(1, s * 1.05) * Math.PI) * 0.8 * k + 0.25, M.wing, { z0: 4, z1: 4 }); }
  // zombie-cap: clamped to a twig, a pale stalk with an orange fruiting knob out of the thorax
  if (dead) {
    sk.np();
    sk.tube([[-6 * k, 1.9 * k], [5 * k, 1.9 * k]], 0.55 * k, M.twig, { z: -1 });
    sk.np();
    sk.tube([[0.6 * k, -1 * k], [0.9 * k, -3.2 * k], [0.3 * k, -5.2 * k]], t => (0.55 - t * 0.2) * k, M.fungus, { z: 5 });
    sk.np();
    sk.ell(0.3 * k, -5.6 * k, 0.95 * k, 0.8 * k, M.knob, { z: 6, rz: 0.8 * k });
  }
}

const cache = new Map<string, HornetFrame>();
/** a world (k=1) or bigger frame; the in-flight blur ghost is added by the game */
export function hornetFrame(pose: HPose, k = 1): HornetFrame {
  const key = pose + k;
  const hit = cache.get(key);
  if (hit) return hit;
  const W = Math.ceil(18 * k), H = Math.ceil(16 * k);
  const sk = new Sk(W, H, Math.round(W / 2), Math.round(H * 0.58));
  drawHornet(sk, pose, k);
  const full = sk.resolve({ rim: 0.14, bounce: 0.06 });
  const t = full.trim(1);
  const out = { buf: t.buf, ax: sk.ox - t.ox, ay: sk.oy - t.oy };
  cache.set(key, out);
  return out;
}

const ANIMS = { idle: { frames: 2, fps: 20, loop: true }, perch: { frames: 2, fps: 4, loop: true } };
export const JEWELHORNET_DEF: SpeciesDef = {
  name: 'Jewel Hornet', kind: 'insect', len: 10, height: 7,
  anims: ANIMS,
  canvas: () => ({ w: 60, h: 50, ox: 30, oy: 29 }),
  draw(sk: Sk, anim: string, frame: number, eye: BeastEye) {
    void eye;
    drawHornet(sk, anim === 'perch' ? (frame ? 'chew' : 'perch') : frame ? 'down' : 'up', 3.2);
    return { head: [8, -2] as V2, eye: [8, -2] as V2 };
  },
};
export const ZOMBIECAP_DEF: SpeciesDef = {
  name: 'Zombie-cap', kind: 'other', len: 10, height: 12,
  anims: { idle: { frames: 1, fps: 1, loop: true } },
  canvas: () => ({ w: 60, h: 60, ox: 30, oy: 36 }),
  draw(sk: Sk) { drawHornet(sk, 'dead', 3.2); return { head: [0, -16] as V2, eye: [0, -16] as V2 }; },
};

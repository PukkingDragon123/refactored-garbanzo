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
    thorax: sk.m(rmp('#0e8a74', { n: 4, dark: 0.6, light: 0.35, warm: 0.2 }), { edge: 1 }),
    gold: sk.m(rmp('#f0a818', { n: 4, dark: 0.5, light: 0.28 }), { edge: 1 }),
    violet: sk.m(rmp('#6a28c0', { n: 4, dark: 0.55, light: 0.3 }), { edge: 1 }),
    teal: sk.m(rmp('#12b49c', { n: 4, dark: 0.55, light: 0.3 }), { edge: 1 }),
    tip: sk.m(rmp('#20183a', { n: 3, dark: 0.4, light: 0.4 }), { edge: 1 }),
    leg: sk.m(rmp('#c07a2a', { n: 3, dark: 0.5, light: 0.4 }), { edge: 0 }),
    wing: sk.m(rmp('#c8d8f0', { n: 3, dark: 0.18, light: 0.5 }), { edge: 0, noRim: true, k: 0.4 }),
    fungus: sk.m(rmp('#efe6d2', { n: 4, dark: 0.4, light: 0.4 }), { edge: 1 }),
    knob: sk.m(rmp('#e86a3a', { n: 4, dark: 0.5, light: 0.45 }), { edge: 1 }),
    twig: sk.m(rmp('#6a4a2e', { n: 3, dark: 0.5, light: 0.4 }), { edge: 1 }),
  };
}

/** translucent wing as overlay pixels (drawn after the outline, so the body shows through) */
function wingOver(sk: Sk, bx: number, by: number, a: number, L: number, w: number, blur: boolean) {
  const ca = Math.cos(a), sa = Math.sin(a);
  const ext = L + w + 1;
  for (let y = Math.floor(by - ext); y <= by + ext; y++) for (let x = Math.floor(bx - ext); x <= bx + ext; x++) {
    const dx = x + 0.5 - bx, dy = y + 0.5 - by;
    const u = (dx * ca + dy * sa) / L, v = (-dx * sa + dy * ca) / w;
    if (u < 0 || u > 1) continue;
    const half = Math.sin(Math.min(1, u * 1.1) * Math.PI) * 0.9 + 0.12;
    if (Math.abs(v) > half) continue;
    const edge = Math.abs(v) > half - 0.32 / w * 1.5 || u > 0.93;
    sk.over(x, y, edge ? hex('#3a2e5a', blur ? 90 : 170) : hex(u > 0.6 ? '#d8c8ff' : '#e8f4ff', blur ? 60 : 120));
  }
}

/** draw one hornet at scale k (1 = world) */
function drawHornet(sk: Sk, pose: HPose, k: number) {
  const M = mats(sk);
  const dead = pose === 'dead';
  const perched = pose === 'perch' || pose === 'chew' || dead;
  // abdomen: a tapering wasp gaster from the waist back to the stinger, banded gold / violet / teal
  sk.np();
  const droop = dead ? 1.4 : 0.6;
  const gaster: V2[] = [[-0.6 * k, 0.2 * k], [-2.6 * k, 0.55 * k], [-4.6 * k, (0.7 + droop * 0.4) * k], [-6 * k, (0.6 + droop) * k]];
  const bands = [M.teal, M.gold, M.violet, M.gold, M.teal, M.violet];
  sk.tube(gaster, t => (t < 0.08 ? 0.55 + t * 8 : 1.75 - (t - 0.08) * 1.55) * k, (p) => {
    if (p.t > 0.9) return M.tip;
    const q = p.t * 6.2;
    if (k > 2 && q % 1 < 0.14) { p.l -= 0.25; }
    return bands[Math.min(5, Math.floor(q))];
  }, { z: 0, rz: 1 });
  sk.np();
  sk.line(-6 * k, (0.6 + droop) * k, -6.9 * k, (1 + droop) * k, M.tip, 0.3, 1, true);
  // thorax: emerald with a gold collar
  sk.np();
  sk.ell(0.5 * k, -0.4 * k, 1.6 * k, 1.4 * k, (p) => (p.u > 0.45 ? M.gold : M.thorax), { z: 1.5, rz: 1.3 * k });
  // head and its big gold compound eye
  sk.np();
  const hx = 2.5 * k, hy = (pose === 'chew' ? 0.35 : -0.25) * k;
  sk.ell(hx, hy, 1.15 * k, 1.2 * k, (p) => (p.u > -0.15 && p.v < 0.35 && p.u < 0.75 ? M.eye : M.head), { z: 2, rz: 1 * k });
  // mandibles
  sk.line(hx + 0.9 * k, hy + 0.7 * k, hx + 1.4 * k, hy + 1.2 * k, M.tip, 0.4, 3, true);
  // legs: dangling in flight, gripping when perched
  for (let i = 0; i < 3; i++) {
    const lx = (1.1 - i * 0.75) * k;
    if (perched) sk.line(lx, 0.6 * k, lx + (i - 1) * 0.7 * k, (dead ? 1.4 : 1.8) * k, M.leg, 0.4, 3, true);
    else sk.line(lx, 0.7 * k, lx - 0.9 * k - i * 0.3 * k, 2.6 * k, M.leg, 0.4, 3, true);
  }
  // antennae
  sk.line(hx + 0.5 * k, hy - 1 * k, hx + 1.5 * k, hy - 2.3 * k, M.head, 0.3, 3, true);
  if (pose === 'chew') sk.over(Math.floor(hx + 1.3 * k), Math.floor(hy + 1.1 * k), hex('#d01c34'));
  // zombie-cap: clamped to a twig, a pale stalk with an orange fruiting knob out of the thorax
  if (dead) {
    sk.np();
    sk.tube([[-7 * k, 2 * k], [5 * k, 2 * k]], 0.55 * k, M.twig, { z: -1 });
    sk.np();
    sk.tube([[0.6 * k, -1 * k], [0.9 * k, -3.2 * k], [0.3 * k, -5.2 * k]], t => (0.55 - t * 0.2) * k, M.fungus, { z: 5 });
    sk.np();
    sk.ell(0.3 * k, -5.6 * k, 0.95 * k, 0.8 * k, M.knob, { z: 6, rz: 0.8 * k });
  }
  return { perched, dead };
}
function wings(sk: Sk, pose: HPose, k: number) {
  if (pose === 'dead') { wingOver(sk, 0.3 * k, -1.2 * k, -2.5, 4 * k, 0.9 * k, false); return; }
  if (pose === 'perch' || pose === 'chew') { wingOver(sk, 0.4 * k, -1.3 * k, Math.PI - 0.12, 5 * k, 0.8 * k, false); return; }
  const a = pose === 'up' ? -2.0 : -0.75;
  wingOver(sk, 0.2 * k, -1.2 * k, a - 0.4, 4.2 * k, 1.1 * k, false);
  wingOver(sk, 0.4 * k, -1.2 * k, a, 4.8 * k, 1.3 * k, false);
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
  wings(sk, pose, k);
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
    const pose: HPose = anim === 'perch' ? (frame ? 'chew' : 'perch') : frame ? 'down' : 'up';
    drawHornet(sk, pose, 3.2);
    wings(sk, pose, 3.2);
    return { head: [8, -2] as V2, eye: [8, -2] as V2 };
  },
};
export const ZOMBIECAP_DEF: SpeciesDef = {
  name: 'Zombie-cap', kind: 'other', len: 10, height: 12,
  anims: { idle: { frames: 1, fps: 1, loop: true } },
  canvas: () => ({ w: 60, h: 60, ox: 30, oy: 36 }),
  draw(sk: Sk) { drawHornet(sk, 'dead', 3.2); wings(sk, 'dead', 3.2); return { head: [0, -16] as V2, eye: [0, -16] as V2 }; },
};

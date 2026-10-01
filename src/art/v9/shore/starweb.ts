// Starweb Weaver: the glowing fisher-grub of the sea cave. A finger-length, glassy green larva that
// lies in a silk hammock slung under the roof, a blue-green lantern in its tail. Round the hammock it
// lets down a star of sticky fishing lines beaded with droplets that catch its light; midges and
// moths fly to the glow and stick. The colony pulses in slow waves, every grub dims at once when
// something loud comes through the cave, and a grub with a bite reels its line up hand over hand.
//
// Anchored on the hammock's upper attachment point. Anims: idle (glow pulse), haul (reeling a line),
// eat, dim. glow() returns the lantern pixels as an additive emissive layer.

import { Sk, V2, Px, rmp, SpeciesDef, TAU, hh, qbez } from '../../beasts-core';
import { PixelBuffer } from '../../pixel';
import { hex, A as alphaOf } from '../../color';

const A = (frames: number, fps: number, loop = true) => ({ frames, fps, loop });
const ANIMS = { idle: A(4, 3), haul: A(4, 6), eat: A(4, 6), dim: A(2, 1) };

interface P { glow: number; arch: number; head: V2; mouth: number; line: number; prey: boolean }
function pose(anim: string, f: number, n: number): P {
  const t = f / n, s = Math.sin(t * TAU);
  switch (anim) {
    case 'haul': return { glow: 0.8, arch: 1.5 + (f % 2), head: [5, 2 + (f % 2) * 1.5], mouth: f % 2, line: 6 - f * 1.2, prey: true };
    case 'eat': return { glow: 0.9, arch: 1, head: [5.5, 1.5 + (f % 2) * 0.6], mouth: f % 2, line: 0, prey: f < 3 };
    case 'dim': return { glow: 0.08 + f * 0.04, arch: 0.6, head: [5.5, 0.8], mouth: 0, line: 0, prey: false };
    default: return { glow: 0.65 + 0.35 * s, arch: 0.8 + s * 0.4, head: [5.6 + s * 0.3, 0.6], mouth: 0, line: 0, prey: false };
  }
}

const LANTERN = rmp('#8ffff0', { n: 4, dark: 0.35, light: 0.6, cool: 0.1 });
const LANTERN_DIM = rmp('#2a5a58', { n: 3, dark: 0.3 });
const lanternSet = new Set(LANTERN);

function draw(sk: Sk, anim: string, frame: number) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const P = pose(anim, frame, n);
  const M = {
    silk: sk.m(rmp('#d8e4e0', { n: 3, dark: 0.3 }), { edge: 0, noRim: true }),
    grub: sk.m(rmp('#9ad0a0', { n: 5, dark: 0.5, light: 0.45, cool: 0.2 }), { spec: 0.6, edge: 1 }),
    gut: sk.m(rmp('#4a6a40', { n: 3, dark: 0.35 }), { edge: 0, noRim: true }),
    head: sk.m(rmp('#4a3a2a', { n: 3, dark: 0.4 }), { spec: 0.4 }),
    lantern: sk.m(P.glow > 0.3 ? LANTERN : LANTERN_DIM, { edge: 0, noRim: true }),
    midge: sk.m(rmp('#3a3230', { n: 2, dark: 0.3 }), { edge: 0 }),
  };
  // silk hammock: a sagging tube hung from two guy lines under the roof
  const L0: V2 = [-6, 0], R0: V2 = [7, -1];
  const ham = qbez([-5, 3], [1, 6.5], [6, 3], 10);
  sk.np(true);
  sk.line(L0[0], L0[1], -5, 3, M.silk, 0.6, -2, true);
  sk.line(R0[0], R0[1], 6, 3, M.silk, 0.6, -2, true);
  sk.tube(ham, 0.9, M.silk, { z: -1 });
  // the grub lying in it: segmented glassy body, darker gut showing through, lantern tail
  const body: V2[] = [];
  for (let i = 0; i <= 8; i++) { const u = i / 8; body.push([-4 + u * 9.5 + (u > 0.8 ? (P.head[0] - 5.5) * (u - 0.8) * 4 : 0), 4.4 - Math.sin(u * Math.PI) * P.arch + (u > 0.8 ? (P.head[1] - 0.6) * (u - 0.8) * 5 : 0)]); }
  sk.np();
  sk.tube(body, t => (t < 0.18 ? 1.25 : 1.15 - (t - 0.18) * 0.35), (p: Px) => {
    if (p.t < 0.17) return M.lantern;
    if (Math.abs(p.v) < 0.25 && p.t > 0.25 && p.t < 0.85) return M.gut;
    if (Math.sin(p.t * 30) > 0.75) p.l -= 0.12; // segments
    return M.grub;
  }, { z: 2 });
  const hd = body[8];
  sk.np();
  sk.ell(hd[0] + 0.5, hd[1], 0.9, 0.8, M.head, { z: 4 });
  if (P.mouth) sk.over(hd[0] + 1.4, hd[1] + 0.4, hex('#e8d8c8'));
  // the line it is reeling in, with the struggling midge
  if (P.line > 0.5) {
    for (let y = 1; y < P.line + 2; y++) sk.over(hd[0] + 1, hd[1] + y, hex('#e4f0ec', 190));
    if (P.prey) { sk.over(hd[0] + 1, hd[1] + P.line + 2, hex('#2a2422')); sk.over(hd[0] + (frame % 2 ? 2 : 0), hd[1] + P.line + 1.5, hex('#8a8480', 200)); }
  } else if (P.prey) { sk.np(); sk.ell(hd[0] + 1.6, hd[1] + 0.8, 0.8, 0.7, M.midge, { z: 6 }); }
  void hh;
  return { head: [hd[0], hd[1] - 2] as V2, eye: hd };
}

/** the lantern pixels as an additive glow layer */
function glow(buf: PixelBuffer): PixelBuffer | null {
  const g = new PixelBuffer(buf.w, buf.h);
  let any = false;
  for (let i = 0; i < buf.data.length; i++) {
    const c = buf.data[i];
    if (alphaOf(c) && lanternSet.has(c)) { g.data[i] = c; any = true; }
  }
  return any ? g : null;
}

export const STARWEB: SpeciesDef & { glow: typeof glow } = {
  name: 'Starweb Weaver', kind: 'insect', len: 10, height: 6,
  anims: ANIMS,
  anchor: { idle: 'grip', haul: 'grip', eat: 'grip', dim: 'grip' },
  canvas: () => ({ w: 24, h: 22, ox: 9, oy: 4 }),
  draw: (sk, anim, frame) => draw(sk, anim, frame),
  eyeFor: () => 'open',
  glow,
};

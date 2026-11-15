// Starweb Weaver: the glowing fisher-grub of the sea cave. A finger-length, glassy green larva that
// lies in a silk hammock slung under the roof, a blue-green lantern in its tail. Round the hammock it
// lets down a star of sticky fishing lines beaded with droplets that catch its light; midges and
// moths fly to the glow and stick. The colony pulses in slow waves, every grub dims at once when
// something loud comes through the cave, and a grub with a bite reels its line up hand over hand.
//
// The larva is one contour (v9/wild/contour strip + Field): a glassy, ringed body that swells toward
// the tail, the dark gut showing through it, the swollen lantern segments at the tail end and the
// dark head capsule with its mandibles; it lies in a sagging mucus-and-silk hammock (a contour of its
// own, its loose threads trailing) hung from the roof on guy lines. From the hammock hang the fishing
// lines in a ragged star, each a fine silk thread beaded every couple of pixels with sticky droplets
// that glow with the lantern's light (bigger beads toward the tip), swaying a little.
//
// Anchored on the hammock's upper attachment point. Anims: idle (glow pulse), haul (reeling a line),
// eat, dim. glow() returns the lantern and the lit droplets as an additive emissive layer.

import { Sk, V2, rmp, SpeciesDef, TAU, hh, qbez } from '../../beasts-core';
import { PixelBuffer } from '../../pixel';
import { hex, A as alphaOf } from '../../color';
import { Field, strip } from '../wild/contour';
import { arcs, onPath, frac } from './shore-kit';

const A = (frames: number, fps: number, loop = true) => ({ frames, fps, loop });
const ANIMS = { idle: A(4, 3), haul: A(4, 6), eat: A(4, 6), dim: A(2, 1) };

interface P { glow: number; arch: number; head: V2; mouth: number; line: number; prey: boolean; sway: number }
function pose(anim: string, f: number, n: number): P {
  const t = f / n, s = Math.sin(t * TAU);
  switch (anim) {
    case 'haul': return { glow: 0.8, arch: 1.5 + (f % 2), head: [5, 2 + (f % 2) * 1.5], mouth: f % 2, line: 7 - f * 1.4, prey: true, sway: s * 0.5 };
    case 'eat': return { glow: 0.9, arch: 1, head: [5.5, 1.5 + (f % 2) * 0.6], mouth: f % 2, line: 0, prey: f < 3, sway: 0 };
    case 'dim': return { glow: 0.08 + f * 0.04, arch: 0.6, head: [5.5, 0.8], mouth: 0, line: 0, prey: false, sway: 0 };
    default: return { glow: 0.65 + 0.35 * s, arch: 0.8 + s * 0.4, head: [5.6 + s * 0.3, 0.6], mouth: 0, line: 0, prey: false, sway: s };
  }
}

const LANTERN = rmp('#8ffff0', { n: 4, dark: 0.35, light: 0.6, cool: 0.1 });
const LANTERN_DIM = rmp('#2a5a58', { n: 3, dark: 0.3 });
// the sticky droplets: lit (part of the glow) and dark
const BEAD = hex('#a8fff2'), BEAD2 = hex('#5ee8e0'), BEADT = hex('#e6fffa');
const BEAD_D = hex('#4a6a68'), BEAD_D2 = hex('#384e4e');
const glowSet = new Set([...LANTERN, BEAD, BEAD2, BEADT]);
const SILK = hex('#dce8e4', 120), SILK2 = hex('#c8d8d4', 90);
const HAM = hex('#c4d8d2', 70), HAM_L = hex('#d8e6e2', 170), HAM_L2 = hex('#b4c8c4', 150);
const PAL = { head: hex('#2a1e14'), mand: hex('#8a6a48'), midge: hex('#2a2422'), wing: hex('#9a9490', 190), eye: hex('#0a0806') };

// the fishing lines: [x along the hammock, length, sway phase]
const LINES: [number, number, number][] = [[-5, 8, 0.1], [-2.4, 12, 0.5], [0.6, 9, 0.9], [3.4, 13, 0.3], [6.2, 7.5, 0.7]];

function draw(sk: Sk, anim: string, frame: number) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const P = pose(anim, frame, n);
  const lit = P.glow > 0.3;
  const M = {
    silk: sk.m(rmp('#c8d6d2', { n: 4, dark: 0.35, light: 0.4 }), { edge: 0, noRim: true }),
    grub: sk.m(rmp('#7cc890', { n: 6, dark: 0.5, light: 0.5, cool: 0.25 }), { edge: 1 }),
    gut: sk.m(rmp('#46683e', { n: 4, dark: 0.4, light: 0.3 }), { edge: 0, noRim: true }),
    lantern: sk.m(lit ? LANTERN : LANTERN_DIM, { edge: 0, noRim: true }),
    head: sk.m(rmp('#4a3624', { n: 4, dark: 0.45, light: 0.45 }), { edge: 1 }),
  };
  // ---------------------------------------------------------------- the hammock and its guy lines
  const L0: V2 = [-6, 0], R0: V2 = [7.5, -1];
  for (const [a, b] of [[L0, [-5.6, 3]], [R0, [6.6, 3]], [[0.6, -1], [0.6, 4.5]]] as [V2, V2][]) {
    const m = Math.max(1, Math.round(Math.abs(b[1] - a[1])));
    for (let i = 0; i <= m; i++) sk.over(a[0] + (b[0] - a[0]) * (i / m), a[1] + (b[1] - a[1]) * (i / m), i % 2 ? SILK2 : SILK);
  }
  // ---------------------------------------------------------------- the fishing lines (behind the grub)
  const beads: { x: number; y: number; big: boolean }[] = [];
  LINES.forEach(([x0, len, ph], i) => {
    const hauled = P.line > 0.5 && i === 3;
    const L = hauled ? P.line : len;
    if (L < 1) return;
    const top: V2 = [x0, 3 + Math.sin((x0 + 5.6) / 12.2 * Math.PI) * 3.6];
    // the lines fan out from the hammock in a ragged star, swaying a little
    const fan = hauled ? 0 : (x0 - 0.6) * 0.06;
    const sw = Math.sin((P.sway * 0.3 + ph) * TAU) * 0.6;
    const bot = Math.min(15, top[1] + L);
    for (let y = Math.ceil(top[1] + 1); y <= bot; y++) {
      const u = (y - top[1]) / Math.max(1, bot - top[1]);
      const x = x0 + fan * (y - top[1]) + sw * u * u;
      // a sticky droplet every third pixel, bigger near the tip; fine silk between
      const isBead = (y + i) % 3 === 0 || y === bot;
      if (isBead) beads.push({ x, y, big: u > 0.8 });
      else sk.over(x, y, y % 2 ? SILK : SILK2);
    }
  });
  for (const b of beads) {
    sk.over(b.x, b.y, lit ? (b.big ? BEADT : hh(b.x, b.y, 3) < 0.5 ? BEAD : BEAD2) : (b.big ? BEAD_D : BEAD_D2));
    if (b.big && lit) sk.over(b.x + 1, b.y, BEAD2);
  }

  // ---------------------------------------------------------------- the grub
  const body: V2[] = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    body.push([-4.6 + u * 10 + (u > 0.8 ? (P.head[0] - 5.5) * (u - 0.8) * 4 : 0), 4.6 - Math.sin(u * Math.PI) * P.arch + (u > 0.8 ? (P.head[1] - 0.6) * (u - 0.8) * 5 : 0)]);
  }
  const cum = arcs(body);
  // thick at the lantern, the body tapering to the narrow neck behind the head capsule
  const rad = (t: number) => (t < 0.2 ? 1.25 + Math.sin(t / 0.2 * Math.PI * 0.5) * 0.2 : 1.45 - (t - 0.2) * 0.75);
  const GF = new Field(sk, [strip(body, rad, rad, { capA: 1, capB: 0.6 })], { round: 1.2, dome: 0.5 });
  sk.np();
  GF.emit(p => {
    const q = onPath(body, cum, p.x, p.y);
    if (q.t < 0.2) { p.l += 0.1; return M.lantern; }
    // the ring grooves between the segments, the dark gut down the middle
    if (frac(q.s / 1.4) < 0.28) p.l -= 0.12;
    if (Math.abs(q.c) < 0.45 && q.t > 0.26 && q.t < 0.86) return M.gut;
    return M.grub;
  }, { z: 2, spec: 0.7, specPow: 7 });
  // the head capsule and its mandibles
  const hd = body[10];
  sk.over(hd[0] + 0.5, hd[1], PAL.head); sk.over(hd[0] + 1.3, hd[1], PAL.head); sk.over(hd[0] + 0.5, hd[1] - 1, PAL.head);
  sk.over(hd[0] + 2.1, hd[1] + (P.mouth ? 0.8 : 0.3), PAL.mand);
  sk.over(hd[0] + 1, hd[1] - 0.6, PAL.eye);
  // the line being reeled in, and the struggling midge
  if (P.prey) {
    if (P.line > 0.5) {
      const L = LINES[3], y = Math.min(15, 3 + Math.sin((L[0] + 5.6) / 12.2 * Math.PI) * 3.6 + P.line + 1);
      sk.over(L[0], y, PAL.midge); sk.over(L[0] + (frame % 2 ? 1 : -1), y - 0.5, PAL.wing);
    } else {
      sk.over(hd[0] + 2.2, hd[1] + 1, PAL.midge); sk.over(hd[0] + 3, hd[1] + 0.5, PAL.wing);
    }
  }
  // the hammock: a sagging sheath of mucus and silk the grub lies in, translucent, its lower edge
  // thickened with silk, loose threads trailing from it
  const ham = qbez([-5.6, 3], [0.6, 7.6], [6.6, 3], 12);
  const hc = arcs(ham);
  for (let y = 1; y <= 8; y++) for (let x = -7; x <= 8; x++) {
    const q = onPath(ham, hc, x + 0.5, y + 0.5);
    const w = 0.9 + Math.sin(q.t * Math.PI) * 0.6;
    if (Math.abs(q.c) > w) continue;
    const low = q.c < -w * 0.35;
    const c = low ? (hh(x, y, 9) < 0.5 ? HAM_L : HAM_L2) : HAM;
    sk.over(x, y, c);
  }
  for (const [x, y] of [[-3, 7], [2, 8], [5, 7]] as V2[]) sk.over(x, y, SILK2);
  return { head: [hd[0], hd[1] - 2] as V2, eye: hd };
}

/** the lantern and the lit droplets as an additive glow layer */
function glow(buf: PixelBuffer): PixelBuffer | null {
  const g = new PixelBuffer(buf.w, buf.h);
  let any = false;
  for (let i = 0; i < buf.data.length; i++) {
    const c = buf.data[i];
    if (alphaOf(c) && glowSet.has(c)) { g.data[i] = c; any = true; }
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

// V12 Te Repo Raupō, the toads.
//
// The Giant Bellowtoad: a toad bigger than Mori, squat as a boulder. Olive-umber skin heaped with warts
// (each one lit on its top-left, shadowed under, the big ones tipped rust-orange), dark blotches edged
// paler, a cream granular belly; a heavy bony crest over each great gold eye (a horizontal pupil) and
// the long kidney of a parotoid gland behind it, pocked with pores; a wide lipped mouth. Its throat
// balloons into a vocal sac bigger than its own head when it booms. Anims: idle (breathing, the throat
// fluttering, a slow blink), walk (a heavy crawl), hop (gathered, launched, tucked, landed), call (the
// sac swelling and shrinking), threat (the tell: up on its arms, puffed, glaring), tongue (the mouth
// thrown open: the tongue itself is drawn by its body, out to where it strikes), hide (sunk low in the
// water, eyes and back above), sleep.
//
// The Ember Toad: a thumb-sized toad the colour of a coal: fiery orange back spotted black, every wart
// tipped yellow, sooty flanks, and under it all a scarlet belly marbled black and freckled blue that it
// flashes when threatened, swelling up stiff-legged and tipping back to show it. Anims: idle, hop,
// walk, eat (a tongue flick), puff (the warning display), call (a thin trill), sleep.

import { Sk, V2, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, TAU, hh, ik2 } from '../../beasts-core';
import type { Px } from '../../beasts-core';
import { hex } from '../../color';
import { noise2 } from '../../../core/math';

// ================================================================== the Giant Bellowtoad
const GANIMS = {
  idle: { frames: 6, fps: 1.4, loop: true },
  walk: { frames: 4, fps: 4, loop: true },
  hop: { frames: 4, fps: 5, loop: false },
  call: { frames: 6, fps: 4.5, loop: true },
  threat: { frames: 4, fps: 6, loop: true },
  tongue: { frames: 3, fps: 9, loop: false },
  hide: { frames: 2, fps: 1, loop: true },
  sleep: { frames: 2, fps: 0.7, loop: true },
};
const GEYE: EyeSpec = { r: 3.6, iris: hex('#d8a021'), lash: hex('#2a2010'), pupil: hex('#0b0905'), slit: 'h', ring: hex('#6a4a12'), brow: hex('#3a3018') };

interface GP { crouch: number; lift: number; stretch: number; sac: number; rear: number; puff: number; mouth: number; flat: number; air: number; breathe: number; step: number }
function gpose(anim: string, f: number, n: number): GP {
  const p: GP = { crouch: 0, lift: 0, stretch: 0, sac: 0, rear: 0, puff: 0, mouth: 0, flat: 0, air: 0, breathe: 0, step: 0 };
  const t = f / n;
  switch (anim) {
    case 'idle': p.breathe = [0, 0.35, 0.7, 0.35, 0, 0][f]; p.sac = [0.04, 0.1, 0.04, 0, 0.06, 0.1][f]; break;
    case 'walk': p.step = Math.sin(t * TAU); p.crouch = 0.2; p.lift = Math.abs(Math.sin(t * TAU)) * 1.5; break;
    case 'hop': p.crouch = [1, 0, 0, 0.7][f]; p.stretch = [0, 1, 0.3, 0][f]; p.air = [0, 0.4, 1, 0][f]; p.flat = f === 3 ? 0.25 : 0; break;
    case 'call': p.sac = [0.2, 0.5, 0.85, 1, 0.82, 0.45][f]; p.rear = 0.18; p.breathe = p.sac * 0.6; break;
    case 'threat': p.rear = [0.5, 0.85, 1, 0.9][f]; p.puff = [0.6, 0.9, 1, 0.95][f]; break;
    case 'tongue': p.mouth = [0.7, 1, 0.5][f]; p.stretch = [0.4, 0.6, 0.2][f]; p.rear = 0.3; break;
    case 'hide': p.flat = 1; p.crouch = 0.8; p.breathe = f * 0.3; break;
    case 'sleep': p.flat = 0.5; p.crouch = 0.6; break;
  }
  return p;
}

/** the skin: blotches, warts heaped on the back and flanks, the granular belly */
function wartField(x: number, y: number, s: number): number {
  // jittered grid of warts, bigger toward the back; returns the wart's lit offset or NaN
  const gx = Math.floor(x / 3.4), gy = Math.floor(y / 3.2);
  let best = 9, lx = 0, ly = 0, big = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = gx + i, cy = gy + j;
    const h = hh(cx, cy, s);
    if (h > 0.62) continue;
    const px = (cx + 0.25 + hh(cx, cy, s + 1) * 0.5) * 3.4, py = (cy + 0.25 + hh(cx, cy, s + 2) * 0.5) * 3.2;
    const r = 0.9 + hh(cx, cy, s + 3) * 1.3 + (h < 0.08 ? 0.8 : 0);
    const dx = (x - px) / r, dy = (y - py) / r, d = dx * dx + dy * dy;
    if (d < 1 && d < best) { best = d; lx = dx; ly = dy; big = h < 0.08 ? 1 : 0; }
  }
  if (best > 1) return NaN;
  return (-lx * 0.55 - ly * 0.75) * 0.32 + (big ? 2 : 0);
}

function gdraw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const n = GANIMS[anim as keyof typeof GANIMS]?.frames ?? 1;
  const P = gpose(anim, frame, n);
  const k = juv ? 0.6 : 1;
  const M = {
    skin: sk.m(rmp('#5c5a2c', { n: 8, dark: 0.66, light: 0.42, cool: 0.4, warm: 0.4 }), { edge: 1 }),
    blot: sk.m(rmp('#3a3a1e', { n: 7, dark: 0.6, light: 0.36, cool: 0.4 }), { edge: 1 }),
    pale: sk.m(rmp('#86803e', { n: 7, dark: 0.55, light: 0.42, warm: 0.5 }), { edge: 1 }),
    wart: sk.m(rmp('#7a6a34', { n: 7, dark: 0.55, light: 0.5, warm: 0.6 }), { edge: 1 }),
    rust: sk.m(rmp('#b0602a', { n: 6, dark: 0.5, light: 0.45, warm: 0.6 }), { edge: 1 }),
    belly: sk.m(rmp('#d8c890', { n: 6, dark: 0.45, light: 0.45 }), { edge: 1 }),
    gland: sk.m(rmp('#6e6232', { n: 7, dark: 0.6, light: 0.45, warm: 0.5 }), { edge: 1, spec: 0.2 }),
    crest: sk.m(rmp('#4a4424', { n: 6, dark: 0.6, light: 0.4 }), { edge: 1 }),
    sac: sk.m(rmp('#e6d6a4', { n: 6, dark: 0.4, light: 0.62, warm: 0.3 }), { spec: 0.65, edge: 1 }),
    mouth: sk.m(rmp('#6a2a24', { n: 5, dark: 0.5 }), { edge: 0 }),
    tongue: sk.m(rmp('#d86a72', { n: 5, dark: 0.5, light: 0.4 }), { spec: 0.5 }),
    toe: sk.m(rmp('#8a7a46', { n: 6, dark: 0.55, light: 0.45 }), { edge: 1 }),
  };
  const air = P.air, rear = P.rear, puff = P.puff;
  // the body: a heavy boulder of a toad, lifted at the front when it rears or calls
  const bx = (-6 + P.stretch * 4) * k;
  const by = (-21 - P.lift + P.crouch * 4 + P.flat * 6 - air * 2 - rear * 3) * k;
  const brx = 31 * (1 + puff * 0.12 + P.stretch * 0.05) * k, bry = 18 * (1 + puff * 0.16 + P.breathe * 0.04) * (1 - P.flat * 0.28) * k;
  const brot = -0.1 - rear * 0.22 + P.stretch * 0.12 - air * 0.08;
  const hx = bx + (27 + P.stretch * 3) * k, hy = by + (-3 - rear * 5 + P.flat * 3) * k;
  const skinFill = (p: Px) => {
    if (p.v > 0.42 && p.nz > 0.1) return M.belly;
    const w = wartField(p.x + 60, p.y + 60, 7);
    const bl = noise2((p.x + 60) / 9, (p.y + 60) / 6, 11);
    if (!Number.isNaN(w)) { p.l += w > 1 ? (w - 2) + 0.12 : w + 0.08; return w > 1 && p.v < 0.1 ? M.rust : M.wart; }
    if (bl > 0.66) { p.l -= 0.04; return M.blot; }
    if (bl > 0.6) return M.pale;
    if (p.v < -0.55 && hh(p.x, p.y, 5) < 0.4) return M.pale;
    return M.skin;
  };
  // far legs
  const hind = (near: boolean) => {
    sk.np();
    const z = near ? 10 : -10, bias = near ? 0 : -0.14;
    const hip: V2 = [bx - 15 * k, by + 6 * k];
    const ext = P.stretch, tuck = air;
    const foot: V2 = ext > 0.5 ? [bx - 46 * k, -3 * k] : tuck > 0.5 ? [bx - 16 * k, by + 14 * k] : [bx + (-4 + (near ? 2 : -3) + P.step * 2) * k, 0];
    const [knee] = ik2(hip, foot, 15 * k, 15 * k, ext > 0.5 ? -1 : 1);
    // the great thigh folded along the flank
    sk.ell(hip[0] + 2 * k, hip[1] + 2 * k, 14 * k, 9.5 * k, skinFill, { rot: -0.35 + ext * 0.4, z: z - 2, bias, rz: 7 * k });
    sk.tube([knee, foot], t => (5 - t * 2) * k, skinFill, { z: z + 1, bias });
    // the webbed foot: long toes splayed forward, webbing between
    const dir = ext > 0.5 ? -1 : 1;
    for (let i = 0; i < 4; i++) {
      const tip: V2 = [foot[0] + dir * (7 + i * 1.6) * k, foot[1] - (i - 1.4) * 0.6 * k];
      sk.tube([foot, tip], t => (1.6 - t * 0.7) * k, M.toe, { z: z + 2, bias });
      sk.ell(tip[0], tip[1] - 0.3, 1.1 * k, 0.9 * k, M.toe, { z: z + 3, bias });
    }
  };
  const arm = (near: boolean) => {
    sk.np();
    const z = near ? 12 : -9, bias = near ? 0 : -0.15;
    const sh: V2 = [hx - 9 * k, hy + 9 * k];
    const hand: V2 = air > 0.5 ? [hx - 2 * k, hy + 18 * k] : [hx + (4 + rear * 5 + (near ? 0 : -4) - P.step * 2) * k, -P.lift * k * (near ? 1 : 0)];
    const [el] = ik2(sh, hand, 11 * k, 11 * k, 1);
    sk.tube([sh, el], t => (5.2 - t * 1) * k, skinFill, { z, bias });
    sk.tube([el, hand], t => (4.2 - t * 1.4) * k, skinFill, { z: z + 1, bias });
    for (let i = 0; i < 4; i++) {
      const tip: V2 = [hand[0] + (-2 + i * 2.2) * k, hand[1] - (i === 0 || i === 3 ? 0.4 : 0)];
      sk.tube([hand, tip], 1.3 * k, M.toe, { z: z + 2, bias });
    }
  };
  hind(false);
  arm(false);
  // body
  sk.np();
  sk.ell(bx, by, brx, bry, skinFill, { rot: brot, rz: 15 * k });
  // the head, broad and flat, with the snout
  sk.np();
  sk.ell(hx, hy, 17 * k, 12.5 * k * (1 - P.flat * 0.12), skinFill, { rot: -0.08 - rear * 0.25, rz: 10 * k, z: 4 });
  sk.ell(hx + 12 * k, hy + 2 * k, 8 * k, 7 * k, skinFill, { rot: -0.2, rz: 6 * k, z: 6 });
  // the parotoid gland behind the eye: a long raised kidney, pocked with pores
  sk.np();
  sk.ell(hx - 9 * k, hy - 8 * k, 9.5 * k, 4.6 * k, M.gland, { rot: 0.22 - rear * 0.2, rz: 4 * k, z: 9 });
  const gpart = sk.pid;
  for (let i = 0; i < 9; i++) {
    const px = hx + (-15 + hh(i, 1, 41) * 12) * k, py = hy + (-10 + hh(i, 2, 41) * 4) * k;
    sk.paint(px, py, M.crest, -0.25, gpart);
  }
  // the vocal sac: from a wrinkled pale throat to a balloon bigger than the head
  if (P.sac > 0.02) {
    sk.np();
    const r = (3 + P.sac * 14) * k;
    const sx = hx + (6 + P.sac * 7) * k, sy = hy + (9 + P.sac * 2) * k + r * 0.35;
    sk.ell(sx, sy, r * 1.08, r, M.sac, { z: 14, rz: r * 0.9 });
    const spart = sk.pid;
    // stretch lines curving round it
    for (let a = 0.6; a < 2.6; a += 0.5) for (let t = -0.8; t <= 0.8; t += 0.08) {
      const rr = r * (0.55 + Math.abs(t) * 0.4);
      sk.paint(sx + Math.cos(a + t * 0.5) * rr * 0.9, sy + Math.sin(t) * rr * 0.8, 0, -0.08, spart);
    }
  }
  // the mouth: a long lipped line from the snout back under the eye; thrown open for the tongue
  const mx0 = hx + 19 * k, my0 = hy + 4 * k, mx1 = hx - 4 * k, my1 = hy + 3.5 * k;
  if (P.mouth > 0.05) {
    sk.np();
    const gape = P.mouth * 5 * k;
    sk.poly([mx1, my1, mx0 + 1, my0 - gape * 0.6, mx0 + 1, my0 + gape * 0.5], M.mouth, { z: 15 });
    sk.ell(mx0 - 2 * k, my0 + gape * 0.2, 3 * k, gape * 0.35 + 0.6, M.tongue, { z: 16 });
  }
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const x = mx1 + (mx0 - mx1) * t, y = my1 + (my0 - my1) * t + Math.sin(t * Math.PI) * 1.2 * k;
    sk.over(x, y, hex('#1a140a'));
    if (t > 0.1 && t < 0.92) sk.over(x, y - 1, hex('#8e8648'));
  }
  // the eye bulge, its bony crest, and the great gold eye
  sk.np();
  const ex = hx + 2 * k, ey = hy - (8.5 - P.flat * 1.5) * k;
  sk.ell(ex, ey, 6.6 * k, 5.4 * k, skinFill, { z: 10 });
  sk.np();
  sk.tube([[ex - 7 * k, ey - 3 * k], [ex - 1 * k, ey - 6 * k], [ex + 6 * k, ey - 4.5 * k]], t => (1.8 - t * 0.6) * k, M.crest, { z: 12 });
  const e = drawEye(sk, ex + 1, ey, { ...GEYE, r: juv ? 2.4 : 3.6 }, eye);
  // the nostril
  sk.over(hx + 17 * k, hy - 1 * k, hex('#141008'));
  arm(true);
  hind(true);
  return { head: [hx, hy - 16 * k] as V2, eye: e };
}

export const BELLOWTOAD: SpeciesDef = {
  name: 'Giant Bellowtoad', kind: 'amphibian', len: 86, height: 50,
  anims: GANIMS,
  canvas: (anim) => (anim === 'hop' ? { w: 170, h: 100, ox: 92, oy: 88 } : { w: 150, h: 96, ox: 70, oy: 86 }),
  draw: gdraw,
  eyeFor: (anim, f) => (anim === 'sleep' ? 'closed' : anim === 'idle' && f === 4 ? 'closed' : anim === 'call' && (f === 2 || f === 3) ? 'closed' : anim === 'threat' || anim === 'tongue' ? 'angry' : anim === 'hop' ? 'alert' : 'open'),
};

// ================================================================== the Ember Toad
const EANIMS = {
  idle: { frames: 4, fps: 2, loop: true },
  walk: { frames: 4, fps: 8, loop: true },
  hop: { frames: 4, fps: 8, loop: true },
  eat: { frames: 4, fps: 12, loop: true },
  tongue: { frames: 4, fps: 12, loop: false },
  puff: { frames: 4, fps: 5, loop: true },
  alert: { frames: 2, fps: 3, loop: true },
  call: { frames: 4, fps: 7, loop: true },
  sleep: { frames: 2, fps: 1, loop: true },
};
const EEYE: EyeSpec = { r: 1.2, iris: hex('#e8c040'), lash: hex('#1a0c08'), pupil: hex('#080404'), slit: 'h' };
interface EP { lift: number; crouch: number; stretch: number; puff: number; tip: number; sac: number; tongue: number; flat: number }
function epose(anim: string, f: number): EP {
  const p: EP = { lift: 0, crouch: 0, stretch: 0, puff: 0, tip: 0, sac: 0, tongue: 0, flat: 0 };
  switch (anim) {
    case 'idle': p.crouch = f === 2 ? 0.15 : 0; p.sac = f === 1 ? 0.15 : 0; break;
    case 'walk': case 'hop': p.lift = [0, 3, 4, 1.2][f]; p.stretch = [0, 1, 0.7, 0.2][f]; p.crouch = f === 0 ? 0.5 : 0; break;
    case 'eat': case 'tongue': p.tongue = [0.3, 1, 0.6, 0][f]; break;
    case 'puff': p.puff = [0.6, 1, 1, 0.85][f]; p.tip = [0.5, 0.9, 1, 0.9][f]; break;
    case 'alert': p.crouch = -0.3; break;
    case 'call': p.sac = [0.3, 0.8, 1, 0.5][f]; break;
    case 'sleep': p.flat = 0.7; p.crouch = 0.5; break;
  }
  return p;
}
function edraw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const P = epose(anim, frame);
  const k = juv ? 0.7 : 1;
  const M = {
    back: sk.m(rmp('#e2601a', { n: 7, dark: 0.55, light: 0.45, warm: 0.6 }), { edge: 1, spec: 0.35 }),
    spot: sk.m(rmp('#2a1210', { n: 5, dark: 0.5, light: 0.3 }), { edge: 1, spec: 0.3 }),
    tipY: sk.m(rmp('#f2c63a', { n: 5, dark: 0.4, light: 0.5 }), { edge: 1 }),
    flank: sk.m(rmp('#2c1a1e', { n: 5, dark: 0.5, light: 0.35, cool: 0.4 }), { edge: 1, spec: 0.3 }),
    belly: sk.m(rmp('#d8202a', { n: 6, dark: 0.5, light: 0.45 }), { edge: 1, spec: 0.3 }),
    blue: sk.m(rmp('#3a8cf0', { n: 4, dark: 0.4, light: 0.5 }), { edge: 0 }),
    sac: sk.m(rmp('#f0b048', { n: 4, dark: 0.35, light: 0.55 }), { spec: 0.6 }),
    tongue: sk.m(rmp('#f07888', { n: 4, dark: 0.5 }), { spec: 0.4 }),
    toe: sk.m(rmp('#e87a2a', { n: 4, dark: 0.5, light: 0.4 })),
  };
  const tip = P.tip, puff = P.puff;
  const bh = (3.8 - P.crouch * 0.8 - P.flat * 1.2 + puff * 1.2) * k;
  const bx = (P.stretch * 1.2) * k, by = -bh - P.lift * k - tip * 2.2 * k;
  const rot = -0.2 + P.stretch * 0.32 - tip * 0.55;
  const skinFill = (p: Px) => {
    // tipped back in the display, the belly shows: scarlet, marbled black, freckled blue
    if (p.v > 0.38 - tip * 0.5) {
      const m = noise2((p.x + 20) / 1.6, (p.y + 20) / 1.6, 3);
      if (hh(p.x, p.y, 9) < 0.08) return M.blue;
      return m > 0.64 ? M.spot : M.belly;
    }
    if (p.v > 0.12) return M.flank;
    const sp = hh(Math.floor((p.x + 20) / 1.8), Math.floor((p.y + 20) / 1.8), 4);
    if (sp < 0.16) return M.spot;
    if (sp > 0.93) { p.l += 0.1; return M.tipY; }
    return M.back;
  };
  const hind = (near: boolean) => {
    sk.np();
    const z = near ? 3 : -3, bias = near ? 0 : -0.15;
    const hip: V2 = [bx - 3.4 * k, by + 1.6 * k];
    const foot: V2 = tip > 0.3 ? [bx - 2.2 * k, 0] : [bx - (2.2 + P.stretch * 5.2) * k + (near ? 0.5 : -0.8) * k, P.stretch > 0.3 ? by + (2 + P.stretch * 1.4) * k : 0];
    const [knee] = ik2(hip, foot, 3.4 * k, 3.4 * k, 1);
    sk.tube([hip, knee], t => (1.8 - t * 0.5) * k, M.back, { z, bias });
    sk.tube([knee, foot], t => (1.2 - t * 0.5) * k, M.toe, { z: z + 0.3, bias });
    for (let i = 0; i < 3; i++) sk.tube([foot, [foot[0] + (1.4 - i * 0.2) * k, foot[1] - 0.2 + i * 0.35]], 0.45 * k, M.toe, { z: z + 0.5, bias });
  };
  hind(false);
  sk.np();
  sk.ell(bx, by, (4.8 + puff * 1.4) * k, bh * 0.85 + (0.6 + puff * 0.6) * k, skinFill, { rot, rz: 3.6 * k });
  sk.np();
  const hx = bx + (3.6 - tip * 0.6) * k, hy = by - (0.6 + tip * 1.2) * k;
  sk.ell(hx, hy, 3.2 * k, 2.5 * k, skinFill, { rot: rot * 0.6, rz: 2.4 * k, z: 2 });
  if (P.sac > 0.05) { sk.np(); const r = (0.8 + P.sac * 1.8) * k; sk.ell(hx + 1.4 * k, hy + 2 * k + r * 0.3, r * 1.05, r, M.sac, { z: 6 }); }
  if (P.tongue > 0.05) {
    sk.np();
    const L = P.tongue * 9 * k, m0: V2 = [hx + 2.6 * k, hy + 0.8 * k];
    sk.tube([m0, [m0[0] + L * 0.6, m0[1] - L * 0.1], [m0[0] + L, m0[1] - L * 0.16]], t => (0.5 + (t > 0.85 ? 0.5 : 0)) * k, M.tongue, { z: 8 });
  }
  // front legs: stiff and straight in the display, lifting it high
  sk.np();
  const sh: V2 = [bx + 2.4 * k, by + 1.4 * k];
  const ff: V2 = [bx + (3.2 + P.stretch * 2 - tip * 0.8) * k, P.lift > 1 ? by + 3 * k : 0];
  sk.tube([sh, ff], t => (1 - t * 0.35) * k, M.back, { z: 5 });
  for (let i = 0; i < 3; i++) sk.ell(ff[0] + (i - 1) * 0.8 * k + 0.4, ff[1] - 0.3, 0.5 * k, 0.4 * k, M.toe, { z: 6 });
  hind(true);
  sk.np();
  const ex = hx + 0.5 * k, ey = hy - 1.8 * k;
  sk.ell(ex, ey, 1.7 * k, 1.5 * k, M.back, { z: 4 });
  const e = drawEye(sk, ex + 0.2, ey - 0.1, { ...EEYE, r: juv ? 0.75 : 1.2 }, eye);
  return { head: [hx, hy - 4 * k] as V2, eye: e };
}

export const EMBERTOAD: SpeciesDef = {
  name: 'Ember Toad', kind: 'amphibian', len: 11, height: 8,
  anims: EANIMS,
  canvas: (anim) => (anim === 'eat' || anim === 'tongue' ? { w: 40, h: 24, ox: 12, oy: 19 } : { w: 30, h: 26, ox: 13, oy: 21 }),
  draw: edraw,
  eyeFor: (anim) => (anim === 'sleep' ? 'closed' : anim === 'puff' ? 'angry' : anim === 'alert' ? 'alert' : 'open'),
};

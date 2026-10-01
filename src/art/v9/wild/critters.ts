// V9 small island life, drawn with the beast sketch core (all face right; anchors noted per kind):
//  - amber snail, healthy or carrying the puppeteer fluke (one eye stalk swollen into a fat banded,
//    throbbing tube that birds mistake for a caterpillar); anchor = foot on the surface
//  - tin-can hermit: a hermit crab living in Kittiwake rubbish (a dog-food tin, a bottle cap, a jar
//    lid), walking or withdrawn; anchor = ground
//  - periscope sand eel: a slender eel standing out of its hole in the wet sand; anchor = the hole
//  - wrack pile (kelp, sea lettuce, a feather) and the tiny sand hoppers that live under it
//  - leaf-veil mantis: a mantis whose thorax and legs are flattened into leaves; anchor = its twig
//  - lantern moth: pale moth with two glow spots; anchor = body centre
//  - mudskip goby: a perching goby with a blue-and-orange sail fin; anchor = ground
//  - jewel beetle: metallic green-gold; anchor = body centre

import { PixelBuffer } from '../../pixel';
import { Sk, rmp, hh, SpeciesDef, V2 } from '../../beasts-core';
import { hex } from '../../color';
import type { Sprite } from './rocks';

const cut = (sk: Sk, rim = 0.12, outline = true): Sprite => {
  const b = sk.resolve({ rim, bounce: 0.06, outline });
  const t = b.trim(1);
  return { buf: t.buf, ax: sk.ox - t.ox, ay: sk.oy - t.oy };
};

// ------------------------------------------------------------------ amber snail (+ puppeteer fluke)
/** f: crawl phase 0..3; pulse: fluke throb 0..3; withdrawn: tucked in the shell */
export function drawSnail(sk: Sk, f: number, infected: boolean, pulse: number, withdrawn: boolean, k = 1) {
  const shell = sk.m(rmp('#c8822a', { n: 5, dark: 0.6, light: 0.45, warm: 0.3 }), { edge: 1 });
  const band = sk.m(rmp('#5a2a14', { n: 3, dark: 0.5, light: 0.3 }), { edge: 1 });
  const body = sk.m(rmp('#9a8e7e', { n: 4, dark: 0.55, light: 0.4 }), { edge: 1 });
  const g1 = sk.m(rmp('#7ac83a', { n: 4, dark: 0.5, light: 0.45 }), { edge: 1 });
  const g2 = sk.m(rmp('#f0e84a', { n: 3, dark: 0.45, light: 0.4 }), { edge: 1 });
  const g3 = sk.m(rmp('#2a5a1a', { n: 3, dark: 0.45, light: 0.3 }), { edge: 1 });
  const stretch = withdrawn ? 0 : [0, 0.6, 1, 0.5][f % 4];
  if (!withdrawn) {
    // the foot: a long low slug of a body, head forward
    sk.np();
    sk.tube([[-4.5 * k, -1 * k], [0, -1.1 * k], [(4 + stretch) * k, -1.3 * k], [(5.6 + stretch) * k, -2.4 * k]], t => (1.1 + Math.sin(t * Math.PI) * 0.3) * k, body, { z: 0 });
    // eye stalks: the near one carries the fluke when infected
    const hx = (5.6 + stretch) * k, hy = -2.6 * k;
    sk.np();
    sk.tube([[hx - 0.6 * k, hy], [hx + 0.2 * k, hy - 3.2 * k]], 0.4 * k, body, { z: 1 });
    if (infected) {
      sk.np();
      const sw = 1 + [0, 0.18, 0.32, 0.15][pulse % 4];
      sk.tube([[hx, hy], [hx + 1.4 * k, hy - 2.4 * k], [hx + 1.8 * k, hy - 4.6 * k]], t => (0.55 + Math.sin(t * Math.PI) * 0.8 * sw) * k, (p) => {
        const q = (p.t * 4 - pulse * 0.25) % 1;
        return q < 0.3 ? g3 : q < 0.6 ? g1 : g2;
      }, { z: 4 });
      sk.over(Math.floor(hx + 2 * k), Math.floor(hy - 4.8 * k), hex('#101010'));
    } else {
      sk.np();
      sk.tube([[hx, hy], [hx + 1.2 * k, hy - 3.6 * k]], 0.42 * k, body, { z: 3 });
      sk.over(Math.floor(hx + 1.3 * k), Math.floor(hy - 3.9 * k), hex('#101010'));
    }
  }
  // the shell: a glossy amber spiral with dark bands
  sk.np();
  const sx = -0.6 * k, sy = -4.1 * k, R = 3.6 * k;
  sk.ell(sx, sy, R, R * 0.92, (p) => {
    const a = Math.atan2(p.v, p.u), r = Math.hypot(p.u, p.v);
    const sp = (r * 3 + a / (Math.PI * 2) + 10) % 1;
    if (sp < 0.16) return band;
    return shell;
  }, { z: 2, rz: R * 0.8 });
  sk.over(Math.floor(sx - R * 0.4), Math.floor(sy - R * 0.5), hex('#fff2c8'));
}

// ------------------------------------------------------------------ tin-can hermit
export type HermitHome = 'can' | 'cap' | 'jar';
export function drawHermit(sk: Sk, home: HermitHome, f: number, withdrawn: boolean) {
  const tin = sk.m(rmp('#a8b0b4', { n: 5, dark: 0.55, light: 0.55 }), { edge: 1 });
  const label = sk.m(rmp('#c8301e', { n: 4, dark: 0.55, light: 0.35 }), { edge: 1 });
  const labelY = sk.m(rmp('#f0c030', { n: 3, dark: 0.45, light: 0.35 }), { edge: 1 });
  const rust = sk.m(rmp('#8a4a22', { n: 3, dark: 0.5, light: 0.3 }), { edge: 1 });
  const cap = sk.m(rmp('#2a7ac8', { n: 4, dark: 0.55, light: 0.45 }), { edge: 1 });
  const glass = sk.m(rmp('#bfe0d0', { n: 3, dark: 0.3, light: 0.5 }), { edge: 1, k: 0.6 });
  const crab = sk.m(rmp('#e07a4a', { n: 4, dark: 0.55, light: 0.4 }), { edge: 1 });
  const dark = sk.m(rmp('#141014', { n: 2 }), { edge: 0, noRim: true });
  const big = home === 'can';
  // the "shell": the can lies on its side with the open end facing forward (right)
  sk.np();
  if (home === 'can') {
    sk.ell(-2.5, -4.2, 5.4, 3.9, (p) => (p.u > 0.8 ? tin : Math.abs(p.v) < 0.45 ? (p.u > -0.1 && p.u < 0.35 ? labelY : label) : p.u < -0.85 ? rust : tin), { z: 0, rz: 3, flat: 0.6 });
    sk.np();
    sk.ell(2.6, -4.2, 1.3, 3.6, (p) => (Math.hypot(p.u, p.v) < 0.62 ? dark : tin), { z: 2, rz: 0.8 });
  } else if (home === 'cap') {
    sk.ell(-0.6, -2.4, 3.2, 2.3, (p) => (Math.abs(((p.u + 1) * 5) % 1 - 0.5) > 0.38 ? tin : cap), { z: 0, rz: 2 });
  } else {
    sk.ell(-1.6, -3.4, 4.2, 3.2, (p) => (p.v < -0.6 ? tin : glass), { z: 0, rz: 2.6 });
    sk.np();
    sk.ell(1.2, -2, 2, 1.4, crab, { z: 1 });
  }
  if (withdrawn) {
    // a claw plugging the doorway, an eye stalk peeking
    sk.np();
    sk.ell(big ? 2.8 : 1.6, big ? -3.2 : -1.6, 1.2, 1.4, crab, { z: 4 });
    sk.over(big ? 3 : 2, big ? -5 : -3, hex('#101010'));
    return;
  }
  const ox = big ? 3 : 1.6, oy = big ? -2.6 : -1.4;
  // legs walking out of the doorway, big right claw, eye stalks
  for (let i = 0; i < 3; i++) {
    const ph = (f + i * 1.3) % 4;
    const lx = ox + 0.5 + i * 1.6 + (ph < 2 ? ph * 0.5 : (4 - ph) * 0.5), ly = 0;
    sk.np();
    sk.tube([[ox + i * 0.6, oy + 0.6], [lx - 0.6, oy - 1.4 + (ph < 2 ? -0.6 : 0)], [lx, ly]], 0.45, crab, { z: 3 + i * 0.1 });
  }
  sk.np();
  sk.ell(ox + 2.8, oy - 1.2, 1.6, 1.15, crab, { z: 5, rot: -0.3 });
  sk.np();
  sk.tube([[ox + 0.8, oy - 1.6], [ox + 1.3, oy - 4]], 0.32, crab, { z: 5 });
  sk.over(Math.floor(ox + 1.3), Math.floor(oy - 4.4), hex('#101010'));
  sk.np();
  sk.tube([[ox + 1.5, oy - 1.4], [ox + 2.6, oy - 3.6]], 0.3, crab, { z: 5 });
  sk.over(Math.floor(ox + 2.7), Math.floor(oy - 4), hex('#101010'));
}

// ------------------------------------------------------------------ periscope sand eel
/** h: 0..1 how far out of the hole; sway: -1..1; mouth: 0/1 (snapping plankton) */
export function drawEel(sk: Sk, h: number, sway: number, mouth: number) {
  const skin = sk.m(rmp('#d8d0b0', { n: 4, dark: 0.55, light: 0.45 }), { edge: 1 });
  const spot = sk.m(rmp('#3a3a2a', { n: 3, dark: 0.5 }), { edge: 1 });
  const L = 2 + h * 11;
  const pts: V2[] = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([Math.sin(t * 2.2) * sway * 2.2 * t, -t * L]); }
  sk.np();
  sk.tube(pts, t => 0.85 - t * 0.12, (p) => (((p.t * L) % 2.6) < 0.8 ? spot : skin), { z: 0 });
  const tip = pts[pts.length - 1];
  sk.np();
  sk.ell(tip[0] + 0.6, tip[1] - 0.2, 1.1, 0.9, skin, { z: 1 });
  sk.over(Math.floor(tip[0] + 0.6), Math.floor(tip[1] - 0.8), hex('#101010'));
  if (mouth) sk.over(Math.floor(tip[0] + 1.8), Math.floor(tip[1]), hex('#401818'));
}

// ------------------------------------------------------------------ wrack pile and hoppers
export function wrackPile(seed: number): Sprite {
  const sk = new Sk(46, 14, 23, 11);
  const kelp = sk.m(rmp('#4a4a1e', { n: 4, dark: 0.55, light: 0.4 }), { edge: 1 });
  const kelp2 = sk.m(rmp('#6a5a24', { n: 4, dark: 0.55, light: 0.4 }), { edge: 1 });
  const lettuce = sk.m(rmp('#5a9a3a', { n: 4, dark: 0.5, light: 0.4 }), { edge: 1 });
  const feather = sk.m(rmp('#e8e4dc', { n: 3, dark: 0.3, light: 0.3 }), { edge: 1 });
  const shellM = sk.m(rmp('#d8b8a0', { n: 3, dark: 0.4, light: 0.3 }), { edge: 1 });
  for (let i = 0; i < 9; i++) {
    const x0 = (hh(i, seed, 1) - 0.5) * 34, len = 8 + hh(i, seed, 2) * 10, y = -1 - hh(i, seed, 3) * 4;
    sk.np();
    sk.tube([[x0, y], [x0 + len * 0.5, y - 1.5 + hh(i, seed, 4) * 2], [x0 + len, y + 0.5]], t => 1.1 - t * 0.4, i % 3 === 1 ? kelp2 : kelp, { z: i * 0.2 });
  }
  for (let i = 0; i < 3; i++) { sk.np(); sk.ell((hh(i, seed, 6) - 0.5) * 26, -2.5, 3, 1.6, lettuce, { z: 3, rz: 1 }); }
  sk.np();
  sk.blade(4, -3, 14, -5, s => Math.sin(s * Math.PI) * 1.2 + 0.2, feather, { z0: 4, z1: 4 });
  sk.np();
  sk.ell(-12, -1.6, 1.6, 1.2, shellM, { z: 4 });
  return cut(sk, 0.08);
}
export function hopper(f: number): Sprite {
  const sk = new Sk(8, 6, 4, 4);
  const m = sk.m(rmp('#c8b490', { n: 3, dark: 0.45, light: 0.4 }), { edge: 1 });
  sk.np();
  sk.ell(0, -1, 1.5, 0.9, m, { rot: f ? -0.5 : 0.2 });
  sk.line(-1, 0, f ? -2.5 : -1.8, f ? -1.6 : 0.8, m, 0.4, 1, true);
  return cut(sk, 0.1);
}

// ------------------------------------------------------------------ leaf-veil mantis
export function drawMantis(sk: Sk, f: number, strike: boolean) {
  const leaf = sk.m(rmp('#6aa83a', { n: 5, dark: 0.6, light: 0.4 }), { edge: 1 });
  const vein = sk.m(rmp('#3e6a22', { n: 3, dark: 0.5 }), { edge: 1 });
  const dry = sk.m(rmp('#a8843a', { n: 3, dark: 0.5, light: 0.3 }), { edge: 1 });
  const twig = sk.m(rmp('#5a3e26', { n: 3, dark: 0.5, light: 0.3 }), { edge: 1 });
  const eye = sk.m(rmp('#d8e870', { n: 3, dark: 0.4 }), { edge: 0 });
  sk.np();
  sk.tube([[-10, 1], [10, 1.5]], 0.7, twig, { z: -2 });
  const sway = [0, 0.5, 0, -0.5][f % 4];
  // the abdomen: a broad leaf with a midrib and a browned, ragged edge
  sk.np();
  sk.blade(-1 + sway * 0.4, -1.5, -9 + sway, -4.5, s => Math.sin(Math.min(1, s * 1.05) * Math.PI) * 2.6 + 0.3, (p) => (Math.abs(p.v) < 0.16 ? vein : p.t > 0.86 || (Math.abs(p.v) > 0.82 && hh(p.x, p.y, 3) < 0.4) ? dry : leaf), { z0: 0, z1: 0, curl: 0.5 });
  // walking legs gripping the twig
  for (const x of [-2, 0.5]) sk.line(x, -1.2, x + 1, 1, leaf, 0.35, 1, true);
  // the thorax, flared into a second little leaf, rising to the head
  sk.np();
  sk.blade(0, -1.6, 3 + sway * 0.3, -7, s => Math.sin(s * Math.PI) * 1.4 + 0.4, (p) => (Math.abs(p.v) < 0.2 ? vein : leaf), { z0: 1, z1: 1 });
  sk.np();
  sk.ell(3.4 + sway * 0.3, -7.8, 1.2, 1, leaf, { z: 2 });
  sk.np();
  sk.ell(4.1 + sway * 0.3, -8.2, 0.55, 0.55, eye, { z: 3 });
  // raptorial forelegs: folded in prayer, or shot out to grab a fly
  sk.np();
  if (strike) sk.tube([[3, -5.5], [6.5, -6.5], [9.5, -5.8]], 0.5, leaf, { z: 4 });
  else sk.tube([[3, -5.5], [5, -3.8], [4.2, -5.6]], 0.55, leaf, { z: 4 });
}

// ------------------------------------------------------------------ lantern moth
export function drawMoth(sk: Sk, f: number) {
  const w1 = sk.m(rmp('#a8987a', { n: 4, dark: 0.5, light: 0.35 }), { edge: 1 });
  const w2 = sk.m(rmp('#5e4c3a', { n: 3, dark: 0.45 }), { edge: 1 });
  const spot = sk.m(rmp('#f8f0a0', { n: 3, dark: 0.15, light: 0.6 }), { edge: 0, noRim: true });
  const body = sk.m(rmp('#c8b890', { n: 3, dark: 0.5 }), { edge: 1 });
  const a = [-2.5, -1.6, -0.6, -1.6][f % 4];
  const wf = (p: { t: number; v: number; x: number; y: number }) => (Math.abs(p.t - 0.58) < 0.14 && Math.abs(p.v) < 0.4 ? spot : p.t > 0.82 || hh(p.x, p.y, 9) < 0.18 ? w2 : w1);
  sk.np(); sk.blade(0, -0.5, Math.cos(a - 0.3) * 6, Math.sin(a - 0.3) * 6, s => Math.sin(Math.min(1, s * 1.05) * Math.PI) * 2.7 + 0.3, wf, { z0: -2, z1: -2 });
  sk.np(); sk.ell(0, 0, 3, 1.25, body, { z: 0 });
  sk.np(); sk.blade(0, -0.5, Math.cos(a) * 6.6, Math.sin(a) * 6.6 + 1, s => Math.sin(Math.min(1, s * 1.05) * Math.PI) * 2.9 + 0.3, wf, { z0: 3, z1: 3 });
  sk.over(3, -1, hex('#e8dcc0')); sk.over(4, -2, hex('#e8dcc0'));
}

// ------------------------------------------------------------------ mudskip goby
/** pose: 0 resting, 1 sail fin up (display), 2 mid-skip */
export function drawGoby(sk: Sk, pose: number, f: number) {
  const skin = sk.m(rmp('#8a8a5a', { n: 4, dark: 0.55, light: 0.4 }), { edge: 1 });
  const belly = sk.m(rmp('#d8d0a8', { n: 3, dark: 0.4 }), { edge: 1 });
  const fin = sk.m(rmp('#3a7ae0', { n: 4, dark: 0.5, light: 0.45 }), { edge: 1 });
  const finE = sk.m(rmp('#f08a2a', { n: 3, dark: 0.5, light: 0.4 }), { edge: 1 });
  const spot = sk.m(rmp('#2a5ac8', { n: 3, dark: 0.4 }), { edge: 1, noRim: true });
  const curl = pose === 2 ? 0.9 : 0;
  sk.np();
  sk.tube([[-5, -1.2 - curl * 2], [-2, -1.6 - curl], [1.5, -1.8], [4, -2]], t => 0.7 + Math.sin(t * Math.PI * 0.9) * 1, (p) => (p.v > 0.5 ? belly : hh(p.x * 2, p.y * 2, 4) < 0.12 ? spot : skin), { z: 0 });
  // pectoral "crutch" fins it walks on
  sk.np();
  sk.blade(1.5, -0.8, 2.6 + (f % 2) * 0.6, 0, s => (1 - s) * 0.8 + 0.3, skin, { z0: 2, z1: 2 });
  // the sail: up in display, folded otherwise
  sk.np();
  const fh = pose === 1 ? 4.5 : 1.3;
  sk.blade(-2.6, -2.6, 0.8, -2.8 - fh, s => (1 - s * 0.6) * 1.6 + 0.2, (p) => (p.t > 0.7 || Math.abs(p.v) > 0.82 ? finE : fin), { z0: -1, z1: -1, bend: 1 });
  // bulging eyes on top of the head
  sk.np();
  sk.ell(3.2, -3.4, 0.9, 0.9, skin, { z: 3 });
  sk.over(3, -4, hex('#101010')); sk.over(4, -4, hex('#e8e0b0'));
}

// ------------------------------------------------------------------ jewel beetle
export function drawBeetle(sk: Sk, f: number, flying: boolean) {
  const sh = sk.m(rmp('#2aa848', { n: 5, dark: 0.6, light: 0.5, warm: 0.5 }), { edge: 1 });
  const gold = sk.m(rmp('#e8c03a', { n: 4, dark: 0.5, light: 0.4 }), { edge: 1 });
  const leg = sk.m(rmp('#1a2a1a', { n: 2 }), { edge: 0 });
  if (flying) { const a = f ? -2.2 : -1.2; sk.np(); sk.blade(-0.5, -1.2, -0.5 + Math.cos(a) * 3.6, -1.2 + Math.sin(a) * 3.6, s => Math.sin(s * Math.PI) * 1 + 0.2, sk.m(rmp('#d8e0e8', { n: 2 }), { edge: 0, k: 0.3 }), { z0: -1, z1: -1 }); }
  sk.np();
  sk.ell(-0.4, -1, 2.3, 1.5, (p) => (p.u < -0.6 || (p.v < -0.3 && Math.abs(p.u) < 0.3) ? gold : sh), { z: 0, rz: 1.4 });
  sk.np();
  sk.ell(2, -1, 0.9, 0.85, sh, { z: 1 });
  if (!flying) for (let i = 0; i < 3; i++) sk.line(-1.2 + i * 1.1, 0, -1.6 + i * 1.1 + (f + i) % 2 * 0.6, 1, leg, 0.3, 2, true);
  sk.over(-1, -2, hex('#f8ffd0'));
}

// ------------------------------------------------------------------ frame bakes
type Painter = (sk: Sk) => void;
const cache = new Map<string, Sprite>();
export function bake(key: string, w: number, h: number, ox: number, oy: number, fn: Painter, rim = 0.12, outline = true): Sprite {
  const hit = cache.get(key);
  if (hit) return hit;
  const sk = new Sk(w, h, ox, oy);
  fn(sk);
  const s = cut(sk, rim, outline);
  cache.set(key, s);
  return s;
}

export const CRIT = {
  snail: (f: number, infected: boolean, pulse: number, withdrawn: boolean) => bake(`snail${f}${infected ? 1 : 0}${pulse}${withdrawn ? 1 : 0}`, 22, 18, 9, 14, sk => drawSnail(sk, f, infected, pulse, withdrawn)),
  hermit: (home: HermitHome, f: number, withdrawn: boolean) => bake(`hermit${home}${f}${withdrawn ? 1 : 0}`, 26, 16, 11, 13, sk => drawHermit(sk, home, f, withdrawn)),
  eel: (h: number, sway: number, mouth: number) => bake(`eel${h}${sway}${mouth}`, 14, 20, 6, 17, sk => drawEel(sk, h / 3, sway - 1, mouth)),
  mantis: (f: number, strike: boolean) => bake(`mantis${f}${strike ? 1 : 0}`, 26, 16, 13, 12, sk => drawMantis(sk, f, strike)),
  moth: (f: number) => bake(`moth${f}`, 20, 18, 10, 10, sk => drawMoth(sk, f)),
  goby: (pose: number, f: number) => bake(`goby${pose}${f}`, 18, 14, 9, 11, sk => drawGoby(sk, pose, f)),
  beetle: (f: number, flying: boolean) => bake(`beetle${f}${flying ? 1 : 0}`, 12, 10, 6, 6, sk => drawBeetle(sk, f, flying)),
};

// ------------------------------------------------------------------ field-guide portraits (registered beasts)
const one = (name: string, kind: SpeciesDef['kind'], len: number, height: number, w: number, h: number, ox: number, oy: number, fn: (sk: Sk, f: number) => void, frames = 1): SpeciesDef => ({
  name, kind, len, height, anims: { idle: { frames, fps: 3, loop: true } },
  canvas: () => ({ w, h, ox, oy }),
  draw(sk: Sk, _a: string, f: number) { fn(sk, f); return { head: [0, -4] as V2, eye: [0, -4] as V2 }; },
});
export const CRITTER_DEFS: Record<string, SpeciesDef> = {
  ambersnail: one('Amber Snail', 'mollusc', 12, 9, 50, 40, 22, 32, sk => drawSnail(sk, 2, false, 0, false, 2.2)),
  puppetfluke: one('Puppeteer Fluke', 'other', 12, 12, 50, 44, 22, 34, sk => drawSnail(sk, 2, true, 2, false, 2.2)),
  canhermit: one('Tin-can Hermit', 'crustacean', 14, 9, 30, 20, 13, 16, sk => drawHermit(sk, 'can', 1, false)),
  periscopeeel: one('Periscope Sand Eel', 'fish', 3, 14, 18, 22, 7, 19, sk => drawEel(sk, 1, 0.3, 1)),
  wrackhopper: one('Wrack Hopper', 'crustacean', 3, 2, 10, 8, 5, 5, sk => { const m = sk.m(rmp('#c8b490', { n: 3, dark: 0.45, light: 0.4 }), { edge: 1 }); sk.ell(0, -1, 2.2, 1.3, m, { rot: -0.3 }); sk.line(-1.5, 0, -3, -2, m, 0.4, 1, true); sk.line(1.5, -1.8, 3, -3, m, 0.4, 1, true); }),
  leafmantis: one('Leaf-veil Mantis', 'insect', 18, 10, 30, 18, 15, 13, sk => drawMantis(sk, 0, false)),
  lanternmoth: one('Lantern Moth', 'insect', 12, 10, 22, 20, 11, 11, sk => drawMoth(sk, 1)),
  skipgoby: one('Mudskip Goby', 'fish', 10, 7, 20, 16, 10, 12, sk => drawGoby(sk, 1, 0)),
  jewelbeetle: one('Jewel Beetle', 'insect', 5, 3, 14, 12, 7, 7, sk => drawBeetle(sk, 0, false)),
};

export type { PixelBuffer };

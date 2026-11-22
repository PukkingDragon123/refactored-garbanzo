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
import { drawAnuran, restPose } from '../../small-anura';
import type { AnuraPose, AnuraSpec, LimbPart } from '../../small-anura';
import type { LP } from '../../small-kit';
import type { Px } from '../../beasts-core';
import { hex } from '../../color';
import { noise2 } from '../../../core/math';
import { HField, ribbon, arcs, lineDist, spline } from '../../beasts-hfield';

const lineY = (L: V2[], x: number) => {
  if (x >= L[0][0]) return L[0][1];
  for (let i = 1; i < L.length; i++) if (x >= L[i][0]) { const t = (x - L[i][0]) / (L[i - 1][0] - L[i][0]); return L[i][1] + (L[i - 1][1] - L[i][1]) * t; }
  return L[L.length - 1][1];
};

// ================================================================== the Giant Bellowtoad
const GANIMS = {
  idle: { frames: 6, fps: 1.4, loop: true },
  walk: { frames: 4, fps: 4, loop: true },
  hop: { frames: 4, fps: 5, loop: false },
  call: { frames: 8, fps: 5, loop: true },
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
    case 'idle': p.breathe = [0, 0.35, 0.7, 0.35, 0, 0][f]; break;
    case 'walk': p.step = Math.sin(t * TAU); p.crouch = 0.2; p.lift = Math.abs(Math.sin(t * TAU)) * 1.5; break;
    case 'hop': p.crouch = [1, 0, 0, 0.7][f]; p.stretch = [0, 1, 0.3, 0][f]; p.air = [0, 0.4, 1, 0][f]; p.flat = f === 3 ? 0.25 : 0; break;
    case 'call': p.sac = [0.2, 0.5, 0.85, 1, 1, 0.95, 0.82, 0.45][f]; p.rear = 0.18; p.breathe = p.sac * 0.6; break;
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
    const r = 0.9 + hh(cx, cy, s + 3) * 1.3 + (h < 0.06 ? 0.8 : 0);
    const dx = (x - px) / r, dy = (y - py) / r, d = dx * dx + dy * dy;
    if (d < 1 && d < best) { best = d; lx = dx; ly = dy; big = h < 0.06 && hh(cx, cy, s + 4) < 0.45 ? 1 : 0; }
  }
  if (best > 1) return NaN;
  return (-lx * 0.55 - ly * 0.75) * 0.32 + (big ? 2 : 0);
}

/** a wart field for the height map: the dome height (0..1) of the wart under (x, y), and whether it is a big rust-tipped one */
const WART = { h: 0, big: 0, lx: 0, ly: 0 };
function wartAt(x: number, y: number, s: number, sc: number) {
  const cw = 3.4 * sc, ch = 3.2 * sc;
  const gx = Math.floor(x / cw), gy = Math.floor(y / ch);
  let best = 9;
  WART.h = 0; WART.big = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = gx + i, cy = gy + j;
    const h = hh(cx, cy, s);
    if (h > 0.5) continue;
    const px = (cx + 0.25 + hh(cx, cy, s + 1) * 0.5) * cw, py = (cy + 0.25 + hh(cx, cy, s + 2) * 0.5) * ch;
    const r = (0.8 + hh(cx, cy, s + 3) * 1.25 + (h < 0.07 ? 0.9 : 0)) * sc;
    const dx = (x - px) / r, dy = (y - py) / r, d = dx * dx + dy * dy;
    if (d < 1 && d < best) { best = d; WART.lx = dx; WART.ly = dy; WART.big = h < 0.07 && hh(cx, cy, s + 4) < 0.5 ? 1 : 0; }
  }
  if (best < 1) WART.h = Math.sqrt(1 - best);
  return WART;
}

/**
 * The bellowtoad's outline (toad units, facing right, sitting): the blunt snout and its nostril bump,
 * the canthus up to the bony crest over the eye, the parotoid gland's loaf, the boulder of the back
 * with warts standing proud of it, the sacral hump, the rump and vent; under it the belly, the chest,
 * the throat and chin. The lower jaw hinges at the mouth's corner when it gapes.
 */
const GBODY: V2[] = [
  [41.6, -21.2], [41.4, -24.2], [39.6, -26.6], [37.4, -27.9], [33.4, -30.0],
  [30.2, -33.6], [27.6, -37.0], [23.6, -38.9], [19.4, -38.0], [17.4, -36.4],
  [15.0, -37.6], [11.0, -38.6], [6.6, -38.4], [3.4, -37.0],
  [0.6, -38.3], [-2.6, -39.0], [-5.0, -39.9], [-7.6, -39.6], [-11.0, -40.0], [-14.6, -39.4], [-17.4, -39.8], [-20.4, -38.6],
  [-24.6, -36.6], [-28.6, -33.4], [-32.0, -29.6], [-34.6, -24.6], [-36.2, -18.8], [-36.0, -12.8], [-33.0, -7.6],
  [-26.0, -4.2], [-14.0, -2.8], [-2.0, -3.0], [8.0, -4.6],
  // under the jaw: the chest, the throat, the chin (these swing down with the gape)
  [15.0, -7.4], [21.0, -10.6], [27.0, -13.4], [33.0, -16.2], [37.6, -18.4], [40.4, -19.8],
];
const GJAW0 = 33; // index of the first lower-jaw point
const GCORNER: V2 = [16.6, -20.8];

function gdraw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const n = GANIMS[anim as keyof typeof GANIMS]?.frames ?? 1;
  const P = gpose(anim, frame, n);
  // (bigger than Mori: he's 62 px tall, it sits 66 px high and stretches 120 px long)
  const k = juv ? 0.8 : 1.36;
  const H = (a: string[]) => a.map(c => hex(c));
  const M = {
    skin: sk.m(H(['#1a160c', '#282212', '#38301a', '#4a4022', '#5c502a', '#6e6234', '#847640', '#9c8c52']), { edge: 1 }),
    blot: sk.m(H(['#100e08', '#1a160c', '#241f10', '#2e2814', '#3a3218', '#463c1e']), { edge: 1 }),
    pale: sk.m(H(['#2e2a16', '#443e20', '#5c542c', '#766c3a', '#8e844a', '#a89c5e', '#c0b474']), { edge: 1 }),
    wart: sk.m(H(['#241e10', '#342c16', '#463c1e', '#5a4e28', '#706232', '#88783e', '#a2904e', '#bca864']), { edge: 1 }),
    rust: sk.m(H(['#3a1c0c', '#5a2c12', '#7a3e1a', '#9a5424', '#b86c30', '#d28a44', '#e8aa62']), { edge: 1 }),
    belly: sk.m(H(['#5a5036', '#7a6e4c', '#9a8e66', '#b8ac82', '#d2c69c', '#e6dcb6', '#f4ecd0']), { edge: 1 }),
    gland: sk.m(H(['#2e2610', '#463a18', '#605022', '#7a682e', '#94803c', '#ae9a50', '#c8b468']), { edge: 1 }),
    crest: sk.m(H(['#1a160a', '#2a2410', '#3c3418', '#4e4620', '#62582a', '#786c36']), { edge: 1 }),
    tymp: sk.m(H(['#2a1e10', '#3e2e18', '#564022', '#6e542e', '#886a3c']), { edge: 1 }),
    sac: sk.m(H(['#6a5a3a', '#8e7c56', '#b2a074', '#d0c094', '#e6d8b0', '#f6ecd0', '#fff8ea']), { edge: 1 }),
    vein: sk.m(H(['#7a4a40', '#9a6456', '#b88070', '#d0a090']), { edge: 0 }),
    mouth: sk.m(H(['#1e0806', '#3a120e', '#5a1e18', '#7a2a22']), { edge: 0, noRim: true }),
    tongue: sk.m(H(['#7a2a32', '#a84050', '#d06474', '#ec90a0', '#f8bcc6']), { edge: 1 }),
    toe: sk.m(H(['#2e2a14', '#46401e', '#625a2a', '#7e7438', '#9a8e4a', '#b4a862']), { edge: 1 }),
    web: sk.m(H(['#3a3420', '#544c2e', '#706640', '#8c8254']), { edge: 0 }),
  };
  const air = P.air, rear = P.rear, puff = P.puff;
  // ---- the pose: the body squats, puffs and breathes about its middle, tips about the hip, the head lifts
  const sx = 1 + puff * 0.1 + P.stretch * 0.05, sy = (1 + puff * 0.14 + P.breathe * 0.035) * (1 - P.flat * 0.26);
  const rot = -rear * 0.2 + P.stretch * 0.12 - air * 0.08;
  const dx = P.stretch * 4, dy = -P.lift + P.crouch * 2.2 + P.flat * 2.6 - air * 2 - rear * 3;
  const hp = -rear * 0.18 + P.flat * 0.04;
  const piv: V2 = [-2, -21], hipB: V2 = [-21, -16], neck: V2 = [12, -24];
  const c = Math.cos(rot), s = Math.sin(rot);
  const U = (x: number, y: number, hw = 1): V2 => {
    const w = Math.max(0, Math.min(1, (x - neck[0] + 6) / 12)) * hw;
    if (w > 0 && hp) { const a = hp * w, ca = Math.cos(a), sa = Math.sin(a), ex = x - neck[0], ey = y - neck[1]; x = neck[0] + ex * ca - ey * sa; y = neck[1] + ex * sa + ey * ca; }
    x = piv[0] + (x - piv[0]) * sx; y = piv[1] + (y - piv[1]) * sy;
    const ex = x - hipB[0], ey = y - hipB[1];
    return [hipB[0] + ex * c - ey * s + dx, hipB[1] + ex * s + ey * c + dy];
  };
  const T = (x: number, y: number, hw = 1): V2 => { const u = U(x, y, hw); return [u[0] * k, u[1] * k]; };
  const inv = (X: number, Y: number): V2 => {
    const x0 = X / k - dx - hipB[0], y0 = Y / k - dy - hipB[1];
    const x = hipB[0] + x0 * c + y0 * s, y = hipB[1] - x0 * s + y0 * c;
    return [piv[0] + (x - piv[0]) / sx, piv[1] + (y - piv[1]) / sy];
  };
  const K = (q: V2): V2 => [q[0] * k, q[1] * k];
  // the field covers the toad, its reach and its sac, not the whole canvas
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const q of GBODY) { const u = T(q[0], q[1]); bx0 = Math.min(bx0, u[0]); bx1 = Math.max(bx1, u[0]); by0 = Math.min(by0, u[1]); by1 = Math.max(by1, u[1]); }
  const F = new HField(sk, Math.min(bx0, (P.stretch > 0.8 ? -84 : -50) * k), by0 - 4 * k, bx1 + (P.sac > 0.12 ? 34 : 6) * k, sk.h - sk.oy);
  const zB = 18 * k; // the flank's depth: the near limbs stand off it
  // ---- the skin, sampled in body space so it rides with every pose
  const skinTex = (bx: number, by: number, o: { z: number; m: number; t: number }, wk: number) => {
    // warts heaped on the back and flanks, sparse and low over the snout and crown
    const w = bx > 26 && hh(Math.floor(bx * 0.5), Math.floor(by * 0.5), 3) < 0.6 ? (WART.h = 0, WART) : wartAt(bx + 80, by + 80, 7, 1);
    const bl = wk >= 1 ? noise2((bx + 80) / 6.5, (by + 80) / 4.6, 11) + (noise2((bx + 80) / 2.2, (by + 80) / 2.2, 12) - 0.5) * 0.18 : 0;
    o.m = M.skin;
    // dark blotches, each edged paler
    if (bl > 0.63) { o.m = M.blot; o.t -= 0.03; } else if (bl > 0.575) o.m = M.pale;
    // fine granules everywhere, so no patch of skin is ever smooth
    const g = noise2((bx + 80) * 1.6, (by + 80) * 1.6, 5);
    o.z += (g - 0.5) * 0.5 * k * wk;
    if (w.h > 0) {
      o.z += w.h * (w.big ? 2.0 : 1.2) * k * wk;
      o.m = w.big && w.h > 0.35 && by < -16 ? M.rust : o.m === M.blot ? M.blot : M.wart;
      // each wart lit on its top-left, a dark crease round its foot
      if (w.h < 0.25) o.t -= 0.08;
    }
  };

  // ---------------------------------------------------------------- the limbs
  const hip = U(hipB[0], hipB[1], 0), sho = U(12, -15, 0);
  const limb = (pts: V2[], wL: (t: number) => number, wR: (t: number) => number, r: number, z0: number, id: number, cap0: number, cap1: number,
    tex: (bx: number, by: number, t: number, o: { z: number; m: number; t: number }) => void, bias: number) => {
    const sp = pts.map(K), pc = arcs(sp);
    const cont = ribbon(sp, (t) => wL(t) * k, (t) => wR(t) * k, Math.max(8, Math.ceil(pc[pc.length - 1] * 0.6)), cap0, cap1);
    F.inflate(cont, r * k, z0, id, 0, (x, y, _d, _s, o) => {
      const t = lineDist(sp, x, y, pc)[1];
      const [bx, by] = inv(x, y);
      tex(bx, by, t, o);
      o.t += bias;
    });
  };
  const hind = (far: boolean) => {
    const off: V2 = far ? [-6, -3.5] : [0, 0];
    const z0 = far ? -8 * k : zB, bias = far ? -0.16 : 0, id = far ? 20 : 10;
    const Hh: V2 = [hip[0] + off[0], hip[1] + off[1]];
    const LT = 24, LS = 22;
    let ank: V2, footDir = 0, ground = true;
    if (P.stretch > 0.8) { ank = [Hh[0] - 36, -4]; footDir = Math.PI - 0.12; ground = false; }
    else if (air > 0.5) { ank = [Hh[0] + 1, Hh[1] + 13]; footDir = 0.5; ground = false; }
    else ank = [Hh[0] - 3 + (far ? 3 : 0) + P.step * (far ? -2 : 2), -4 - P.lift * (far ? 0 : 0.6)];
    let [knee, ankle] = ik2(Hh, ank, LT, LS, P.stretch > 0.8 ? 1 : -1);
    if (P.stretch <= 0.8 && air <= 0.5) {
      // sitting: the thigh folded forward and down along the flank to a knee kept off the ground, the
      // shin folded straight back under it to the heel
      const ky = -4.5 - P.lift * (far ? 0 : 0.6), sn = Math.max(-0.2, Math.min(0.95, (ky - Hh[1]) / LT)), th = Math.asin(sn);
      knee = [Hh[0] + LT * Math.cos(th), Hh[1] + LT * Math.sin(th)];
      const ay = ank[1], dyk = ay - knee[1];
      ankle = [knee[0] - Math.sqrt(Math.max(0, LS * LS - dyk * dyk)) + P.step * (far ? -1.5 : 1.5), ay];
    }
    // the great thigh folded along the flank: deep at the hip, a fold where it meets the shin
    limb([Hh, [Hh[0] + (knee[0] - Hh[0]) * 0.5, Hh[1] + (knee[1] - Hh[1]) * 0.5 - 1.5], knee], (t) => 9.5 * (1 - t * 0.55) + 1.5, (t) => 8 * (1 - t * 0.5) + 1.2, 7, z0 + 4 * k, id, 0.9, 1,
      (bx, by, t, o) => { skinTex(bx * 1.3 + 40, by * 1.3, o, 0.8); if (Math.abs(t - 0.3) < 0.07 || Math.abs(t - 0.68) < 0.08) o.m = M.blot; }, bias);
    // the shin, the calf swelling
    limb([knee, ankle], (t) => 5.2 + Math.sin(t * Math.PI) * 1.6 - t * 1.4, (t) => 4.4 + Math.sin(t * Math.PI) * 1.2 - t * 1.2, 4.5, z0 + 1.5 * k, id + 1, 1, 0.8,
      (bx, by, t, o) => { skinTex(bx * 1.4 - 30, by * 1.4 + 20, o, 0.6); if (Math.abs(t - 0.5) < 0.08) o.m = M.blot; }, bias);
    // the foot: the long sole to the toes, five toes fanned with the webbing between, a tubercle at each tip
    const FL = 15;
    const toeBase: V2 = ground ? [ankle[0] + FL, -2.2 - P.lift * (far ? 0 : 0.6)] : [ankle[0] + Math.cos(footDir) * FL, ankle[1] + Math.sin(footDir) * FL];
    limb([ankle, toeBase], (t) => 2.8 - t * 0.6, (t) => 2.4 - t * 0.4, 2.2, z0 + 2.2 * k, id + 2, 1, 0.6, (bx, by, _t, o) => { skinTex(bx * 1.6, by * 1.6 - 30, o, 0.4); o.m = o.m === M.rust ? M.wart : M.toe; }, bias);
    const fd = Math.atan2(toeBase[1] - ankle[1], toeBase[0] - ankle[0]);
    const tips: V2[] = [];
    const NT = far ? 3 : 5;
    for (let i = 0; i < NT; i++) {
      const a = fd + (i - (NT - 1) / 2) * 0.24 - (ground ? 0.05 : 0);
      const len = [6.5, 8.5, 10.5, 8.0, 5.5][far ? i + 1 : i];
      const tt: V2 = [toeBase[0] + Math.cos(a) * len, toeBase[1] + Math.sin(a) * len];
      if (ground) tt[1] = Math.min(tt[1], -1.0);
      tips.push(tt);
    }
    if (!far) {
      // the webbing: a thin skin between the toes, scalloped back between the tips
      const wpts: V2[] = [K(toeBase)];
      for (let i = 0; i < tips.length; i++) {
        wpts.push(K([toeBase[0] + (tips[i][0] - toeBase[0]) * 0.8, toeBase[1] + (tips[i][1] - toeBase[1]) * 0.8]));
        if (i < tips.length - 1) { const m: V2 = [(tips[i][0] + tips[i + 1][0]) / 2, (tips[i][1] + tips[i + 1][1]) / 2]; wpts.push(K([toeBase[0] + (m[0] - toeBase[0]) * 0.5, toeBase[1] + (m[1] - toeBase[1]) * 0.5])); }
      }
      F.inflate(wpts, 0.8 * k, z0 + 1.8 * k, id + 3, 0, (_x, _y, _d, _s, o) => { o.m = M.web; o.t += bias; });
    }
    tips.forEach((tt, i) => limb([toeBase, tt], (t) => 1.5 - t * 0.4 + (t > 0.85 ? 0.3 : 0), (t) => 1.3 - t * 0.35 + (t > 0.85 ? 0.3 : 0), 1.3, z0 + (2.4 + i * 0.05) * k, id + 4 + i, 0.5, 1,
      (_bx, _by, t, o) => { o.m = t > 0.82 ? M.wart : M.toe; if (Math.abs(t - 0.5) < 0.08) o.z -= 0.3 * k; }, bias));
  };
  const arm = (far: boolean) => {
    const off: V2 = far ? [-5, -3] : [0, 0];
    const z0 = far ? -6 * k : zB + 2 * k, bias = far ? -0.16 : 0, id = far ? 40 : 30;
    const S0: V2 = [sho[0] + off[0], sho[1] + off[1]];
    let wr: V2, ground = true;
    if (air > 0.5) { wr = [S0[0] + 7, S0[1] + 14]; ground = false; }
    else wr = [S0[0] + 10 + rear * 6 + (far ? -3 : 0) - P.step * 2, -2.4 - P.lift * (far ? 0 : 1)];
    const [el, wrist] = ik2(S0, wr, 13, 13.5, 1);
    limb([S0, el], (t) => 5.4 - t * 1.0, (t) => 5.0 - t * 1.0, 4.5, z0, id, 1, 1, (bx, by, _t, o) => skinTex(bx * 1.3 - 50, by * 1.3, o, 0.7), bias);
    limb([el, wrist], (t) => 4.6 - t * 1.6, (t) => 4.0 - t * 1.4, 3.8, z0 + 1 * k, id + 1, 1, 0.7, (bx, by, t, o) => { skinTex(bx * 1.4 + 60, by * 1.4, o, 0.6); if (Math.abs(t - 0.6) < 0.08) o.m = M.blot; }, bias);
    // four fingers spread forward and turned in, a tubercle at each tip
    for (let i = 0; i < (far ? 3 : 4); i++) {
      const a = (ground ? -0.05 : 1.0) + (i - 1.5) * 0.36;
      const len = [5.5, 7.5, 6.5, 5][i];
      const tt: V2 = [wrist[0] + Math.cos(a) * len, wrist[1] + Math.sin(a) * len * (ground ? 0.25 : 1)];
      if (ground) tt[1] = Math.min(tt[1], -1.0);
      limb([wrist, tt], (t) => 1.6 - t * 0.4 + (t > 0.8 ? 0.3 : 0), (t) => 1.4 - t * 0.35 + (t > 0.8 ? 0.3 : 0), 1.3, z0 + 1.6 * k, id + 2 + i, 0.5, 1,
        (_bx, _by, t, o) => { o.m = t > 0.8 ? M.wart : M.toe; }, bias);
    }
  };
  hind(true);
  arm(true);

  // ---------------------------------------------------------------- the head and trunk: one contour
  const gape = P.mouth * 0.32;
  const body: V2[] = GBODY.map((q, i) => {
    let [x, y] = q;
    if (i >= GJAW0 && gape) {
      // the lower jaw swings down about the mouth's corner
      const ex = x - GCORNER[0], ey = y - GCORNER[1], ca = Math.cos(gape), sa = Math.sin(gape);
      x = GCORNER[0] + ex * ca - ey * sa; y = GCORNER[1] + ex * sa + ey * ca;
    }
    return T(x, y);
  });
  const cont = spline(body, 3, true);
  F.inflate(cont, 9.5 * k, 0, 1, 0, (x, y, _d, _s, o) => {
    const [bx, by] = inv(x, y);
    // the cream granular belly and throat, low on the underside
    const bellyY = -9.5 - Math.max(0, bx - 6) * 0.36;
    if (by > bellyY && !(P.flat > 0.6)) {
      o.m = M.belly;
      const g = wartAt(bx * 2.4 + 200, by * 2.4 + 200, 9, 0.7);
      o.z += g.h * 0.5 * k;
      if (g.h > 0 && g.h < 0.3) o.t -= 0.06;
      return;
    }
    skinTex(bx, by, o, 1);
    // the head: smoother over the snout and the crown
    if (bx > 30) o.z -= Math.min(1, (bx - 30) / 6) * 0.4 * k;
  }, 0.62);
  // ---- anatomy sculpted in: the eye's bulge, the bony crest over it, the parotoid's loaf (pocked with
  // pores), the tympanum, the lip ridge, the groin and armpit folds, the snout's nostril
  const bmp = (x: number, y: number, rx: number, ry: number, h: number, m = 0, t = 0) => { const q = T(x, y); F.bump(q[0], q[1], rx * k, h * k, m, t, ry * k, 1); };
  bmp(24.6, -31.8, 6.6, 5.6, 3.2);
  F.groove([T(16.2, -34.4), T(19.6, -37.0), T(24.0, -38.0), T(28.4, -36.6), T(30.6, -34.2)], 1.8 * k, -1.6 * k, M.crest, 0.06, 1);
  bmp(9.0, -33.6, 9.4, 4.4, 3.4, M.gland, 0.07);
  // the gland's rim: a crease round its foot
  F.groove(spline([T(0.2, -33.2), T(3.0, -30.4), T(9.0, -29.4), T(15.6, -30.8), T(18.0, -33.4)], 4), 1.1 * k, 0.8 * k, 0, -0.06, 1);
  for (let i = 0; i < 11; i++) {
    const q = T(2.0 + hh(i, 1, 41) * 13.5, -35.6 + hh(i, 2, 41) * 4.4);
    F.bump(q[0], q[1], 0.75 * k, -0.9 * k, M.crest, -0.12, 0.75 * k, 1);
  }
  bmp(14.4, -26.6, 3.4, 3.4, -1.0, M.tymp, 0.02);
  { const q = T(14.4, -26.6); F.bump(q[0], q[1], 1.6 * k, 0.4 * k, M.tymp, 0.1, 1.6 * k, 1); }
  const lip = [T(40.8, -22.6), T(33, -23.1), T(25, -22.8), T(18.4, -22.0)];
  F.groove(lip, 1.4 * k, -0.7 * k, M.pale, 0.08, 1);
  F.groove([T(-20.5, -27), T(-17, -22), T(-16, -16)], 1.0 * k, 0.8 * k, 0, -0.1, 1);
  F.groove([T(9.5, -21.5), T(7.5, -17.5), T(8.5, -13.5)], 0.9 * k, 0.7 * k, 0, -0.1, 1);
  bmp(38.2, -26.6, 1.8, 1.4, 0.8);

  // ---------------------------------------------------------------- the vocal sac
  if (P.sac > 0.12) {
    const r = 3 + P.sac * 14;
    // hung under the chin, swelling forward; at full boom it rests its weight on the ground
    const at0u = U(27 + P.sac * 9, -10 + P.sac * 2 + r * 0.35, 0);
    const at0: V2 = [at0u[0], Math.min(at0u[1], 1.5 - r)];
    const ring: V2[] = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      // hung from the throat: flatter where it joins, fullest low and forward
      const rr = r * (Math.sin(a) < 0 ? 0.9 : 1) * (1 + 0.06 * Math.cos(a - 0.5));
      ring.push(K([at0[0] + Math.cos(a) * rr * 1.08, at0[1] + Math.sin(a) * rr]));
    }
    const root = T(22, -14);
    F.inflate(spline(ring, 3, true), r * 0.8 * k, zB + 3 * k, 60, 0, (x, y, _d, _s, o) => {
      // the stretched skin: fine creases round it from the throat, veins showing through, the throat's speckles pulled apart
      o.m = M.sac;
      // creases fanning from the throat, deep while it fills, stretched to hairlines at full boom
      const ang = Math.atan2(y - root[1], x - root[0]), dr = Math.hypot(x - root[0], y - root[1]);
      if (Math.abs(Math.sin(ang * 7 + dr * 0.04)) < 0.2 * (1.3 - P.sac) && dr > 4 * k) { o.z -= 0.5 * k; o.t -= 0.16; }
      const vn = noise2((x + 60) / 3.2, (y + 60) / 3.2, 19);
      if (vn > 0.47 && vn < 0.5) o.m = M.vein;
      if (hh(x * 0.5, y * 0.5, 23) < 0.025) o.t -= 0.12;
    });
  }
  arm(false);
  hind(false);
  F.emit({ seam: 1.2, seamDark: 0.32, ao: 0.07, aoR: 3, shadow: 0.18, shadowR: 7, contrast: 0.95,
    spec: (m) => (m === M.sac ? 0.85 : m === M.belly ? 0.2 : m === M.tongue ? 0.6 : m === M.web ? 0.1 : 0.32), specPow: 16,
    post: (_x, _y, _m, l, nx) => l + Math.max(0, nx) * 0.12 });

  // ---------------------------------------------------------------- the mouth, the nostril, the eye
  if (P.mouth > 0.05) {
    // thrown open: the dark gape between the jaws, the tongue's mass rising off its floor
    sk.np();
    const up = [T(41.2, -22.2), T(33, -22.6), T(25, -22.3), T(GCORNER[0], GCORNER[1])];
    const lo = [36.6, 30, 24].map(x => {
      const y = -22.0 + (x - GCORNER[0]) * 0.01, ex = x - GCORNER[0], ey = y - GCORNER[1], ca = Math.cos(gape), sa = Math.sin(gape);
      return T(GCORNER[0] + ex * ca - ey * sa, GCORNER[1] + ex * sa + ey * ca);
    });
    const poly = [...up, ...lo.reverse()];
    sk.poly(poly.flat(), M.mouth, { z: zB + 6 * k, noZ: true });
    const tq = T(31, -21.5 + gape * 12);
    sk.ell(tq[0], tq[1], 6 * k, (1.2 + P.mouth * 1.8) * k, M.tongue, { z: zB + 7 * k, noZ: true });
  }
  // the mouth line: dark between the lips, from the snout back past the eye to the corner
  const ml = spline([T(41.4, -21.6), T(36, -21.9), T(29, -21.7), T(22, -21.3), T(GCORNER[0], GCORNER[1])], 6);
  for (const q of ml) sk.over(q[0], q[1], hex('#16120a'));
  const ns = T(38.4, -26.2);
  sk.over(ns[0], ns[1], hex('#100c06')); sk.over(ns[0] + 1, ns[1], hex('#100c06')); sk.over(ns[0], ns[1] - 1, hex('#3a3418'));
  const ep = T(24.8, -31.4);
  const e = drawEye(sk, ep[0], ep[1], { ...GEYE, r: juv ? 2.8 : 4 }, eye);
  const hd = T(21, -40);
  return { head: [hd[0], hd[1]] as V2, eye: e };
}

export const BELLOWTOAD: SpeciesDef = {
  name: 'Giant Bellowtoad', kind: 'amphibian', len: 118, height: 68,
  anims: GANIMS,
  canvas: (anim) => (anim === 'hop' ? { w: 230, h: 136, ox: 124, oy: 120 } : { w: 204, h: 130, ox: 96, oy: 118 }),
  draw: gdraw,
  eyeFor: (anim, f) => (anim === 'sleep' ? 'closed' : anim === 'idle' && f === 4 ? 'closed' : anim === 'call' && f >= 3 && f <= 5 ? 'closed' : anim === 'threat' || anim === 'tongue' ? 'angry' : anim === 'hop' ? 'alert' : 'open'),
};

// ================================================================== the Ember Toad
// Painted on the small anuran rig (../../small-anura.ts): one contour through a true toad's landmarks
// (the blunt snout and nostril, the low eye bulge, the parotoid gland swelling behind it like a loaf,
// the warty back with its warts standing proud of the outline, the rump and vent, the low belly), the
// short stiff limbs jointed from the hip and shoulder. The skin is a live coal: fiery orange on the
// back with hand-placed black spots, every wart sculpted in and tipped yellow, the parotoid paler and
// pocked with pores; sooty flanks flecked orange; the scarlet belly marbled black and freckled blue,
// the scarlet showing on the undersides of the limbs too, so the warning flashes when it tips back
// stiff-legged in the display (the unken reflex). Gold eyes with a horizontal pupil.
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
/** how far it is tipped back to show the belly (0..1) */
let ETIP = 0;
function epose(anim: string, f: number): AnuraPose {
  const p = restPose();
  ETIP = 0;
  switch (anim) {
    case 'idle': p.sac = f === 1 ? 0.2 : 0; p.sy = f === 2 ? 0.94 : 1; p.head = f === 3 ? -0.05 : 0; break;
    case 'walk':
      // a toad's creep: short low hops
      p.sy = [0.92, 1.02, 1, 0.95][f]; p.lift = [0, 1.2, 1.6, 0.5][f]; p.rot = [0.04, -0.22, -0.06, 0.16][f]; p.dx = [0, 2.9, 2.6, 1.8][f];
      p.hind = (['sit', 'push', 'tuck', 'sit'] as const)[f]; p.front = (['sit', 'reach', 'land', 'land'] as const)[f];
      break;
    case 'hop':
      p.sy = [0.86, 1.04, 1, 0.92][f]; p.sx = [1.02, 1.05, 1.02, 1][f];
      p.lift = [0, 2.4, 3.6, 1.0][f]; p.rot = [0.06, -0.4, -0.1, 0.3][f]; p.dx = [0, 2.8, 3.4, 2.4][f];
      p.hind = (['sit', 'push', 'trail', 'tuck'] as const)[f]; p.front = (['sit', 'reach', 'reach', 'land'] as const)[f];
      ETIP = [0, 0.2, 0.3, 0][f];
      break;
    case 'eat': case 'tongue': p.tongue = [0.3, 1, 0.6, 0][f]; p.gape = [0.5, 1, 0.7, 0.1][f]; p.head = -0.05; break;
    case 'puff': {
      // swollen stiff, up on straight legs and tipped back: the scarlet belly flashed at you
      const pf = [0.6, 1, 1, 0.85][f], tp = [0.5, 0.9, 1, 0.9][f];
      ETIP = tp;
      p.sx = 1 + pf * 0.16; p.sy = 1 + pf * 0.34; p.rot = -tp * 0.66; p.head = -tp * 0.16; p.lift = tp * 1.4;
      p.hind = 'stiff'; p.front = 'stiff';
      break;
    }
    case 'alert': p.rot = -0.18; p.head = -0.1; p.sy = 1.05; p.front = 'up'; break;
    case 'call': p.sac = [0.3, 0.8, 1, 0.5][f]; p.head = -0.1; p.sy = 1 - p.sac * 0.06; break;
    case 'sleep': p.sy = 0.78 + f * 0.02; p.sx = 1.04; p.head = 0.12; p.rot = 0.05; p.front = 'tuck'; p.hind = 'sit'; break;
  }
  return p;
}
/** the toad's outline: blunt snout, low eye bulge, the parotoid's loaf, warts proud of the back, the rump */
function ebody(): LP[] {
  return [
    [6.05, -3.25], [5.85, -3.95], [5.15, -4.45], [4.35, -4.8],
    // the eye's bulge
    [3.75, -5.6], [2.95, -5.95], [2.2, -5.55],
    // the parotoid gland swelling behind the eye
    [1.6, -5.7], [0.7, -5.9], [-0.15, -5.65],
    // warts standing proud of the back
    [-0.6, -5.75], [-0.95, -6.1], [-1.35, -5.85], [-2.0, -5.95], [-2.45, -6.25], [-2.9, -5.95],
    [-3.6, -5.45], [-3.95, -5.6], [-4.3, -5.05], [-4.55, -3.9],
    [-4.5, -2.6], [-3.8, -1.55], [-1.0, -1.25], [1.6, -1.45],
    [3.0, -1.95], [4.4, -2.45], [5.4, -2.85],
  ];
}
/** the dorsolateral line: orange above, the sooty flank below */
const EDL: V2[] = [[6.0, -2.6], [3.4, -2.9], [1.4, -2.55], [-1.0, -2.45], [-3.0, -2.6], [-4.6, -2.3]];
/** the black spots on the back (body space ellipses) */
const ESPOT: [number, number, number, number][] = [
  [-0.95, -5.0, 0.5, 0.38], [-3.0, -4.9, 0.45, 0.4], [1.0, -3.7, 0.45, 0.35], [-2.0, -3.5, 0.45, 0.35], [-3.9, -3.4, 0.35, 0.35],
];
/** the warts, every one tipped yellow: [x, y, r] */
const EWART: [number, number, number][] = [
  [3.55, -4.65, 0.5], [2.1, -4.8, 0.5], [-0.3, -5.35, 0.55], [-1.6, -5.45, 0.6], [-2.2, -4.85, 0.5], [-3.5, -5.0, 0.5],
  [0.5, -4.35, 0.45], [-1.2, -4.6, 0.45], [-3.2, -4.1, 0.45], [4.5, -4.35, 0.4],
];
/** the parotoid gland: centre, half-length, half-height; and its pores */
const EPAR: [number, number, number, number] = [0.75, -5.2, 1.15, 0.55];
const EPORE: V2[] = [[0.2, -5.25], [1.1, -5.0]];
/** blue freckles on the scarlet belly */
const EBLUE: V2[] = [[1.0, -1.9], [-1.4, -1.8], [3.0, -2.5], [-2.8, -2.3]];

function edraw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const P = epose(anim, frame);
  const k = juv ? 0.85 : 1.26;
  const M = {
    back: sk.m(['#4a160a', '#7e280c', '#b23e10', '#d85c16', '#ef7e20', '#f9a43a', '#ffc95c'].map(c => hex(c)), { edge: 1 }),
    soot: sk.m(['#120806', '#22100a', '#341a10', '#4a2614', '#65381c'].map(c => hex(c)), { edge: 1 }),
    tipY: sk.m(['#b0701a', '#e8a828', '#ffd84a', '#fff08a'].map(c => hex(c)), { edge: 1 }),
    gland: sk.m(['#6a2a0c', '#a84a14', '#dc7420', '#f49a34', '#ffbc52'].map(c => hex(c)), { edge: 1 }),
    belly: sk.m(['#3a060c', '#6e0e16', '#a8181e', '#d42a28', '#ee5440', '#fa8466'].map(c => hex(c)), { edge: 1 }),
    blue: sk.m(['#1a3a8a', '#3a78e0', '#7ab4ff'].map(c => hex(c)), { edge: 0 }),
    sac: sk.m(['#8a4a14', '#c8782a', '#eea848', '#fcce74', '#fff0b8'].map(c => hex(c)), { edge: 1 }),
    tongue: sk.m(['#7a2a36', '#b44a5a', '#e47888', '#f6a8b2'].map(c => hex(c)), { edge: 1 }),
    mouth: sk.m(['#1e0806', '#3a120e'].map(c => hex(c)), { edge: 0, noRim: true }),
  };
  const inE = (L: [number, number, number, number][], bx: number, by: number) => {
    for (const [cx, cy, rx, ry] of L) { const u = (bx - cx) / rx, v = (by - cy) / ry; if (u * u + v * v < 1) return true; }
    return false;
  };
  const bellyLine = (bx: number) => -2.15 - Math.max(0, bx - 3.0) * 0.12 - ETIP * 1.7;
  const spec: AnuraSpec = {
    body: ebody, neck: [2.0, -4.2], pivot: [0.4, -2.2], hip: [-2.6, -3.4], shoulder: [2.7, -2.6],
    thigh: 3.5, shin: 3.3, foot: 2.3, upper: 1.5, fore: 1.6,
    thighW: 1.3, shinW: 0.82, footW: 0.46, armW: 0.56,
    toe: 1.1, pad: 0, web: 0.3,
    eye: [2.95, -5.0], eyeSize: juv ? 2 : 3,
    eyePal: { iris: hex('#f2c63e'), irisD: hex('#a8701a'), fleck: hex('#ffe27a'), pupil: hex('#0a0402'), rim: hex('#2a0e06'), glint: hex('#fffbe8'), lid: hex('#2a0e06') },
    sac: { at: [4.3, -2.2], r: 1.9 }, mouth: { tip: [5.95, -3.3], corner: [2.4, -3.45] }, tongueLen: 9,
    zBody: 3, round: 1.3, dome: 1.0, spec: 0.45, fill: 0.24,
    paint: {
      body(p, bx, by) {
        if (by > bellyLine(bx)) {
          // scarlet marbled black: big soft cells of black in the red
          const m = noise2((bx + 20) / 1.5, (by + 20) / 1.1, 3);
          if (m > 0.66) { p.l -= 0.05; return M.soot; }
          return M.belly;
        }
        // the face kept bright (it is what you look at)
        if (bx > 2.2) p.l += 0.1;
        if (inE(ESPOT, bx, by)) return M.soot;
        if (by > lineY(EDL, bx)) return M.soot;
        const [gx, gy, grx, gry] = EPAR, gu = (bx - gx) / grx, gv = (by - gy) / gry;
        if (gu * gu + gv * gv < 1) return M.gland;
        return M.back;
      },
      limb(p, part: LimbPart, far, t, c) {
        // orange above, the scarlet warning colour underneath, sooty bands
        if (part === 'web') return M.belly;
        if (part === 'toe' || part === 'hand') return t > 0.6 && ETIP > 0.15 ? M.belly : M.back;
        if (part === 'foot') return c < 0 && ETIP > 0.15 ? M.belly : M.back;
        if (part === 'thigh' && Math.abs(t * 3.5 - 1.9) < 0.4) return M.soot;
        if (part === 'shin' && Math.abs(t * 3.3 - 1.6) < 0.38) return M.soot;
        // the scarlet undersides only show when it flashes them (tipped back, or kicking off)
        const under = part === 'upper' || part === 'fore' ? c < -0.15 : part === 'shin' ? c > 0.2 : c < -0.45;
        if (under && !far && ETIP > 0.15) return M.belly;
        void p;
        return M.back;
      },
      sac(p, inf) {
        if (inf < 0.6 && Math.sin(p.x * 2.1 - p.y * 1.2) > 0.8) p.l -= 0.12;
        return M.sac;
      },
      tongue: (_p, t) => (t > 0.85 ? M.tipY : M.tongue),
      mouth: M.mouth,
    },
    sculpt(F, T) {
      // every wart raised, the parotoid's loaf, the eye's bulge
      for (const [x, y, r] of EWART) { const q = T(x, y); F.bump(q[0], q[1], r * k, r * k, 0.55 * k); }
      const g = T(EPAR[0], EPAR[1]); F.bump(g[0], g[1], EPAR[2] * k, EPAR[3] * k * 1.4, 0.55 * k);
      const e = T(2.95, -5.0); F.bump(e[0], e[1], 1.4 * k, 1.2 * k, 0.4 * k);
    },
    after(sk2, T, _P, kk) {
      // the jaw line
      for (let x = 3.2; x <= 5.8; x += 0.45) { const q = T(x, -3.45 + (x - 2.5) * 0.05); sk2.paint(q[0], q[1], M.back, -0.45); }
      // the yellow tip of every wart (its lit top), the gland's pores, the blue freckles, the nostril
      for (const [x, y, r] of EWART) { const q = T(x - r * 0.3, y - r * 0.45); sk2.paint(q[0], q[1], M.tipY, 0.15); }
      if (!juv) for (const [x, y] of EPORE) { const q = T(x, y); sk2.paint(q[0], q[1], M.soot, 0.1); }
      if (ETIP > 0.3) for (const [x, y] of EBLUE) { const q = T(x, y - ETIP * 0.8); if (sk2.matAt(q[0], q[1]) === M.belly) sk2.paint(q[0], q[1], M.blue, 0.2); }
      const ns = T(5.35, -4.2); sk2.paint(ns[0], ns[1], M.back, -0.5);
      void kk;
    },
  };
  const o = drawAnuran(sk, spec, P, k, eye);
  return { head: o.head as V2, eye: o.eye };
}

export const EMBERTOAD: SpeciesDef = {
  name: 'Ember Toad', kind: 'amphibian', len: 11, height: 8,
  anims: EANIMS,
  canvas: (anim) => (anim === 'eat' || anim === 'tongue' ? { w: 40, h: 24, ox: 12, oy: 19 } : { w: 30, h: 26, ox: 13, oy: 21 }),
  draw: edraw,
  eyeFor: (anim) => (anim === 'sleep' ? 'closed' : anim === 'puff' ? 'angry' : anim === 'alert' ? 'alert' : 'open'),
};

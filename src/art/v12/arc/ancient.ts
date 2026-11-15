// V12 Te Ara Matatū, the finale: Te Ngārara Nui, the Old One of Te Korokoro (Sphenodon kaitiaki), a
// tuatara the length of a waka, sculpted with the beast sketch.
//
// The last of a line older than the dinosaurs, grown huge and slow in the warm throat of the island.
// It is a tuatara, not a dragon: the heavy wedge of a head with its beaked upper jaw and the long
// closed smile of its mouth, the row of big pale scales along both lips, a dark eye under a heavy brow,
// and on the crown the parietal eye, the "third eye", a pale scale that catches the light. Down its
// neck and back runs the crest of soft white spines it can raise like a mane (a gap over the hips,
// smaller spines again down the tail). Its skin is granular olive-grey, freckled pale, banded darker,
// folded deep at the neck and throat; it is old enough that lichen grows on its back in green and
// rust, and a pale scar runs across its flank. Four sprawling legs, five clawed toes each.
//
// Anims (anchor: the ground under the middle of the body, facing right): idle (breathing, the crest
// stirring, a blink), walk (the slow sprawling walk, the tail sweeping), tell (the warning: it rises on
// straight legs, the head lifts, the crest stands up and pales, the throat swells and the third eye
// gleams), strike (a lunge: the head drives forward and down and the jaws snap), retreat (head low,
// body low, walking off into the steam), bask (belly down on warm stone, eyes half shut), call (head up,
// the mouth open in a deep croak).

import { Sk, V2, rmp, SpeciesDef, TAU, sm, hh, ik2, gait, qbez } from '../../beasts-core';
import type { Px, BeastEye, AnimDef } from '../../beasts-core';
import { hex } from '../../color';

const A = (frames: number, fps: number, loop = true): AnimDef => ({ frames, fps, loop });
export const ANCIENT_ANIMS: Record<string, AnimDef> = {
  idle: A(6, 2.5),
  walk: A(8, 5),
  tell: A(6, 5),
  strike: A(6, 9, false),
  retreat: A(8, 5),
  bask: A(2, 0.6),
  call: A(4, 3),
};

interface TP {
  /** belly height off the ground and the back's lift */
  body: number;
  /** forward shift of the front half (lunge) */
  lunge: number;
  /** neck lift (px up) and head pitch (rad, negative = up) */
  neck: number; pitch: number;
  jaw: number;
  /** crest raise 0..1.6 and paleness */
  crest: number; crestPale: number;
  throat: number;
  third: number;
  /** gait */
  ph: number; stride: number; lift: number;
  tail: number;
  eye: number;
  breathe: number;
}
function tpose(anim: string, f: number, n: number): TP {
  const t = f / n, s = Math.sin(t * TAU);
  const p: TP = { body: 9, lunge: 0, neck: 0, pitch: 0.06, jaw: 0, crest: 1, crestPale: 0, throat: 0, third: 0, ph: t, stride: 0, lift: 0, tail: s * 0.3, eye: 1, breathe: s };
  switch (anim) {
    case 'idle': p.eye = f === 4 ? 0 : 1; p.crest = 1 + s * 0.06; break;
    case 'walk': p.stride = 22; p.lift = 5; p.body = 11; p.tail = Math.sin(t * TAU) * 1.2; p.neck = 1 + Math.sin(t * TAU * 2) * 0.6; break;
    case 'retreat': p.stride = 18; p.lift = 4; p.body = 6; p.neck = -7; p.pitch = 0.32; p.crest = 0.55; p.tail = Math.sin(t * TAU) * 1.4; break;
    case 'tell': p.body = 15 + s * 0.4; p.neck = 12 + s * 0.6; p.pitch = -0.32; p.jaw = 0.12 + Math.max(0, s) * 0.1; p.crest = 1.65 + s * 0.08; p.crestPale = 1; p.throat = 0.7 + s * 0.3; p.third = 0.6 + Math.max(0, s) * 0.4; break;
    case 'strike': {
      p.body = [14, 12, 9, 8, 9, 11][f];
      p.lunge = [-4, -7, 14, 22, 18, 8][f];
      p.neck = [12, 14, -2, -6, -4, 2][f];
      p.pitch = [-0.32, -0.42, 0.12, 0.22, 0.18, 0.08][f];
      p.jaw = [0.15, 0.55, 0.9, 0.05, 0.0, 0.0][f];
      p.crest = [1.6, 1.7, 1.5, 1.3, 1.2, 1.1][f]; p.crestPale = 1;
      p.tail = [0.2, -0.6, 1.2, 1.6, 1, 0.4][f];
      p.third = 0.4;
      break;
    }
    case 'bask': p.body = 1.5; p.neck = -6; p.pitch = 0.1; p.eye = 0.4; p.crest = 0.7; p.tail = 0.1; break;
    case 'call': p.body = 12; p.neck = 10; p.pitch = -0.55; p.jaw = [0.3, 0.7, 0.75, 0.4][f]; p.throat = [0.5, 1, 1, 0.6][f]; p.crest = 1.4; p.crestPale = 0.6; break;
  }
  return p;
}

function adraw(sk: Sk, anim: string, frame: number, _eye: BeastEye, juv: boolean) {
  const n = ANCIENT_ANIMS[anim]?.frames ?? 1;
  const P = tpose(ANCIENT_ANIMS[anim] ? anim : 'idle', frame, n);
  const k = juv ? 0.55 : 1.45;
  const M = {
    skin: sk.m(rmp('#5c6450', { n: 7, dark: 0.6, light: 0.42, cool: 0.22, warm: 0.3 }), { edge: 1, k: 0.95 }),
    band: sk.m(rmp('#3c4234', { n: 5, dark: 0.5, light: 0.32, cool: 0.2, warm: 0.2 }), { edge: 1, k: 0.9 }),
    belly: sk.m(rmp('#a49a74', { n: 5, dark: 0.45, light: 0.35, cool: 0.12, warm: 0.25 }), { edge: 1, k: 0.85 }),
    fleck: sk.m(rmp('#cdbf84', { n: 4, dark: 0.35, light: 0.35, warm: 0.3 }), { edge: 0, k: 0.6 }),
    lichen: sk.m(rmp('#7f9a5a', { n: 4, dark: 0.4, light: 0.35, warm: 0.3 }), { edge: 0, k: 0.7 }),
    rust: sk.m(rmp('#b8743a', { n: 4, dark: 0.4, light: 0.35, warm: 0.3 }), { edge: 0, k: 0.7 }),
    crest: sk.m(rmp(P.crestPale ? '#f2ead0' : '#ded2a6', { n: 5, dark: 0.45, light: 0.4, warm: 0.3, cool: 0.1 }), { edge: 0, k: 0.8 }),
    lip: sk.m(rmp('#c8bc96', { n: 4, dark: 0.4, light: 0.35, warm: 0.2 }), { edge: 0, k: 0.7 }),
    mouth: sk.m(rmp('#9a5a52', { n: 4, dark: 0.5, light: 0.3 }), { edge: 0, noRim: true }),
    claw: sk.m(rmp('#2c2620', { n: 3, dark: 0.4, light: 0.4 }), { edge: 0, k: 0.6 }),
    scar: sk.m(rmp('#a8a48c', { n: 3, dark: 0.3, light: 0.3 }), { edge: 0, k: 0.5 }),
  };
  const B = P.body * k;
  /** the skin: granular scales, pale freckles, dark bands, lichen on the old back, a scar */
  const skin = (p: Px, u: number, far: boolean) => {
    const g = hh(p.x, p.y, 101), g2 = hh(p.x / 2, p.y / 2, 103);
    p.l += (g - 0.5) * 0.05 + (g2 - 0.5) * 0.06 + (hh(p.x / 6, p.y / 5, 105) - 0.5) * 0.1;
    if (far) p.l -= 0.2;
    if (p.ny > 0.42) return M.belly;
    // lichen on the top of the back (the old one has not moved much in a long time)
    if (!far && p.ny < -0.55 && u > 0.25 && u < 0.85) {
      const lc = hh(p.x / 5, p.y / 4, 107) * 0.6 + hh(p.x / 2, p.y / 2, 109) * 0.4;
      if (lc > 0.74) return M.lichen;
      if (lc > 0.7 && lc <= 0.74) return M.rust;
    }
    // dark bands across the body
    if (Math.sin(u * 34 + p.y * 0.09 / Math.max(0.4, k) + hh(Math.floor(p.x / 4), Math.floor(p.y / 4), 113) * 1.1) > 0.8 && p.ny < 0.25) { p.l -= 0.04; return M.band; }
    if (g > 0.975 && p.ny < 0.3) { p.l += 0.12; return M.fleck; }
    return M.skin;
  };

  // ---------------------------------------------------------------- the spine
  const hip: V2 = [-24 * k, -B - 13 * k];
  const sh: V2 = [(23 + P.lunge * 0.45) * k, -B - 14 * k - P.breathe * 0.3];
  const mid: V2 = [(hip[0] + sh[0]) / 2, -B - 16.5 * k - P.breathe * 0.4];
  const nk: V2 = [(40 + P.lunge * 0.85) * k, -B - 19 * k - P.neck * k];
  const ts = P.tail * 6 * k;
  const tail = qbez([-118 * k + ts * 0.4, -1.5 * k], [-78 * k, -2 * k - ts], hip, 18).reverse();
  // tail on the ground: its far end rests on the ground and sweeps
  const tailR = (t: number) => (11 - t * 10.1) * k;

  // far legs first (behind the body)
  const legs = (near: boolean) => {
    const zz = near ? 14 : -14;
    const sideK = near ? 1 : 0.9;
    for (const front of [true, false]) {
      const root: V2 = front ? [sh[0] - 2 * k, sh[1] + 9 * k] : [hip[0] + 3 * k, hip[1] + 8 * k];
      const phase = P.ph + (front === near ? 0 : 0.5);
      const g = P.stride ? gait(phase, 0.6, P.stride * k, P.lift * k) : [0, 0];
      const foot: V2 = [root[0] + (front ? 7 : -6) * k + (near ? 2 : -2) * k + g[0], g[1]];
      const [j] = ik2(root, foot, 11 * k * sideK, 12 * k * sideK, front ? 1 : -1);
      sk.np();
      const fill = (p: Px) => skin(p, 0.5, !near);
      sk.tube([root, j], t => (6 - t * 1.6) * k, fill, { z: zz });
      sk.tube([j, foot], t => (4.2 - t * 1.4) * k, fill, { z: zz + 1 });
      // the foot and five clawed toes splayed on the ground
      sk.np();
      for (let i = 0; i < 5; i++) {
        const a = (front ? -0.25 : -0.55) + i * (front ? 0.33 : 0.3);
        const tl = (i === 2 || i === 3 ? 6.5 : 5) * k;
        const tx = foot[0] + Math.cos(a) * tl * (front ? 1 : -1) * 0.9, ty = Math.min(0, foot[1] + Math.sin(a) * 1.4 - 0.5);
        sk.blade(foot[0], foot[1] - 1.2 * k, tx, ty, s => (1.8 - s * 1.2) * k, (p: Px) => skin(p, 0.5, !near), { z0: zz + 2, z1: zz + 2 });
        sk.over(tx + (front ? 1 : -1), ty, hex(near ? '#1e1a16' : '#2e2a24'));
      }
    }
  };
  legs(false);

  // ---------------------------------------------------------------- body, tail, neck (one part: no lines between)
  sk.np();
  const N = tail.length;
  sk.tube(tail, tailR, (p: Px) => skin(p, p.t * 0.3, false), { z: 2 });
  const torso = qbez(hip, [mid[0], mid[1] - 2 * k], sh, 10);
  sk.tube(torso, t => (13.2 + Math.sin(t * Math.PI) * 2.8 + P.breathe * 0.3) * k, (p: Px) => {
    // the old scar across the flank
    const sc = Math.abs((p.x - 2 * k) * 0.35 + (p.y - (-B - 10 * k))) < 0.6 && p.x > -12 * k && p.x < 10 * k;
    if (sc && p.ny < 0.3) { p.l += 0.15; return M.scar; }
    return skin(p, 0.3 + p.t * 0.5, false);
  }, { z: 4 });
  const neckPts = qbez(sh, [sh[0] + 10 * k, sh[1] - 2 * k - P.neck * 0.4 * k], nk, 8);
  sk.tube(neckPts, t => (12.5 - t * 2.6 + P.throat * Math.sin(t * Math.PI) * 2.2) * k, (p: Px) => {
    // the deep folds of the neck and the throat
    const fold = Math.sin(p.x * 0.9 + p.y * 0.25);
    if (fold > 0.82 && p.ny > -0.4) p.l -= 0.14;
    return skin(p, 0.85 + p.t * 0.15, false);
  }, { z: 5 });
  void N;

  // ---------------------------------------------------------------- the crest
  {
    sk.np(true);
    const top = (pts: V2[], R: (t: number) => number, t: number): [V2, number] => {
      // a point on the top of a tube at t, and the local up direction's angle
      const m = (pts.length - 1) * t, i = Math.min(pts.length - 2, Math.floor(m)), f = m - i;
      const a = pts[i], b = pts[i + 1];
      const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f;
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      if (ny > 0) { nx = -nx; ny = -ny; }
      const l = Math.hypot(nx, ny) || 1;
      const r = R(t);
      return [[x + nx / l * (r - 0.8), y + ny / l * (r - 0.8)], Math.atan2(ny, nx)];
    };
    const spine = (pts: V2[], R: (t: number) => number, t0: number, t1: number, step: number, h: (t: number) => number, z: number) => {
      const len = pts.reduce((s, q, i) => (i ? s + Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) : 0), 0);
      for (let d = t0 * len; d <= t1 * len; d += step * k) {
        const t = d / len;
        const ht = h(t) * P.crest * k;
        if (ht < 0.8) continue;
        const [b, ang] = top(pts, R, t);
        const lean = ang - 0.42 / Math.max(0.6, P.crest);
        const i = Math.round(d / step);
        const hj = ht * (0.82 + hh(i, 7, 121) * 0.3);
        sk.blade(b[0], b[1] + 1.2, b[0] + Math.cos(lean) * hj, b[1] + Math.sin(lean) * hj, s => (1.25 - s * 1.15) * k, (p: Px) => { p.l += 0.08 - (1 - p.t) * 0.22; return M.crest; }, { z0: z, z1: z, bend: -0.3 });
      }
    };
    spine(neckPts, t => (12.5 - t * 2.6) * k, 0.05, 0.98, 3.6, t => 7 + t * 4, 3);
    spine(torso, t => (13.2 + Math.sin(t * Math.PI) * 2.8) * k, 0.3, 0.92, 3.8, t => sm((t - 0.3) / 0.25) * (5 + t * 3), 3);
    spine(tail, tailR, 0.0, 0.62, 3.2, t => 4.5 * (1 - t * 1.4) * sm((0.97 - t) / 0.2), 1);
  }

  // ---------------------------------------------------------------- the head
  const hpitch = P.pitch;
  const hc = Math.cos(hpitch), hs = Math.sin(hpitch);
  const H0: V2 = [nk[0] - 3 * k, nk[1] + 1 * k];
  const HK = 1.15 * k;
  const hp = (x: number, y: number): V2 => [H0[0] + (x * hc - y * hs) * HK, H0[1] + (x * hs + y * hc) * HK];
  const hinge: [number, number] = [7, 2.2];
  const jawA = P.jaw * 0.62;
  const jp = (x: number, y: number): V2 => {
    const dx = x - hinge[0], dy = y - hinge[1];
    const c = Math.cos(jawA), s = Math.sin(jawA);
    return hp(hinge[0] + dx * c - dy * s, hinge[1] + dx * s + dy * c);
  };
  // head profile (local, facing +x): skull top, the blunt beaked snout, the upper lip line
  const upper: [number, number][] = [[-3, -2], [-1, -8], [4, -10.6], [11, -11.4], [17, -10.4], [22, -8.6], [26.5, -6.2], [29.6, -3.6], [31, -0.8], [30.6, 1.6], [29.2, 2.2], [20, 1.9], [12, 2.3], [7, 2.2]];
  const lower: [number, number][] = [[7, 2.2], [12, 2.6], [20, 2.4], [28.6, 2.4], [29.2, 4], [26, 5.8], [18, 7.2], [10, 8.6], [3, 9.6], [-3, 8]];
  const shade = (lx: number, ly: number, hw: number, hh2: number) => {
    const nz = Math.sqrt(Math.max(0.05, 1 - lx * lx * 0.55 - ly * ly * 0.85));
    return 0.44 + 0.62 * (lx * 0.5 * -0.52 + ly * 0.8 * -0.74 + nz * 0.42);
    void hw; void hh2;
  };
  const headFill = (cx: number, cy: number, w: number, h: number, jaw: boolean) => (p: Px) => {
    // back to head-local for the shading
    const dx = (p.x - H0[0]) / HK, dy = (p.y - H0[1]) / HK;
    let lx = dx * hc + dy * hs, ly = -dx * hs + dy * hc;
    if (jaw) { const ddx = lx - hinge[0], ddy = ly - hinge[1], c = Math.cos(-jawA), s = Math.sin(-jawA); lx = hinge[0] + ddx * c - ddy * s; ly = hinge[1] + ddx * s + ddy * c; }
    p.l = shade((lx - cx) / w, (ly - cy) / h, w, h) + (hh(p.x, p.y, 131) - 0.5) * 0.05;
    // the labial scales: a row of big pale scales along each lip
    const lipU = !jaw && ly > 0.2 && ly < 1.8 && lx > 9;
    const lipL = jaw && ly > 2.5 && ly < 4.2 && lx > 9 && lx < 28.5;
    if ((lipU || lipL) && Math.floor(lx / 2.6) % 2 === 0) { p.l += 0.03; return lipL ? M.lip : M.skin; }
    if (lipU) p.l += 0.06;
    if (jaw && ly > 5) { p.ny = 0.6; return M.belly; }
    // a pale freckle here and there, larger scales on the cheek
    if (hh(p.x, p.y, 133) > 0.975) { p.l += 0.12; return M.fleck; }
    if (lx < 6 && Math.sin(lx * 1.2 + ly * 0.6) > 0.85) p.l -= 0.12;
    return M.skin;
  };
  // the open mouth: dark gums behind the jaws
  if (P.jaw > 0.05) {
    sk.np();
    const pts: number[] = [];
    for (const [x, y] of [[7, 2.2], [29.2, 2.2], [30, 3.4]] as const) { const q = hp(x, y); pts.push(q[0], q[1]); }
    for (const [x, y] of [[29.2, 4], [20, 2.6], [8, 2.4]] as const) { const q = jp(x, y); pts.push(q[0], q[1]); }
    sk.poly(pts, (p: Px) => { p.l = 0.3 + (hh(p.x, p.y, 137) - 0.5) * 0.1; return M.mouth; }, { z: 17 });
  }
  sk.np();
  {
    const pts: number[] = [];
    for (const [x, y] of lower) { const q = jp(x, y); pts.push(q[0], q[1]); }
    // and back along the throat to close it
    for (const [x, y] of [[-3, 6], [-2, 3]] as const) { const q = hp(x, y); pts.push(q[0], q[1]); }
    sk.poly(pts, headFill(14, 4, 18, 6, true), { z: 18 });
  }
  sk.np();
  {
    const pts: number[] = [];
    for (const [x, y] of upper) { const q = hp(x, y); pts.push(q[0], q[1]); }
    sk.poly(pts, headFill(12, -4, 20, 9, false), { z: 19 });
  }
  // the mouth line (closed): the long tuatara smile, turning up at the back
  const ink = hex('#1c1a14'), ink2 = hex('#2e2a1e');
  if (P.jaw <= 0.05) {
    for (let x = 6; x <= 29.4; x += 0.5) {
      const y = 2.3 - (x < 10 ? (10 - x) * 0.22 : 0) - (x > 27 ? (x - 27) * 0.2 : 0);
      const q = hp(x, y);
      sk.over(q[0], q[1], x < 9 ? ink2 : ink);
    }
  }
  // the beak tip: the upper jaw's overbite, darker horn
  { const q = hp(30.2, 1.6); sk.over(q[0], q[1], hex('#3a3428')); const q2 = hp(30.8, 0.6); sk.over(q2[0], q2[1], hex('#4a4232')); }
  // nostril
  { const q = hp(28.4, -3.4); sk.over(q[0], q[1], ink); }
  // the eye: big and dark under a heavy brow, a gold ring, a vertical pupil
  {
    const e = hp(13.5, -5.2);
    const ex = Math.round(e[0]), ey = Math.round(e[1]);
    const brow = hex('#3a4030'), lidC = hex('#4a5240');
    if (P.eye < 0.2) {
      for (let dx = -2; dx <= 2; dx++) sk.over(ex + dx, ey, ink2);
      for (let dx = -2; dx <= 2; dx++) sk.over(ex + dx, ey - 1, lidC);
    } else {
      const gold = hex('#8a6a2a'), gold2 = hex('#c49a42'), dark = hex('#120c08'), wet = hex('#f6f0dc');
      for (const [dx, dy] of [[-3, 0], [3, 0], [-1, -3], [0, -3], [1, -3], [-1, 3], [0, 3], [1, 3], [-2, -2], [2, -2], [-2, 2], [2, 2], [-3, -1], [3, -1], [-3, 1], [3, 1]] as const) sk.over(ex + dx, ey + dy, ink2);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sk.over(ex + dx, ey + dy, dy < 0 ? gold : gold2);
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]] as const) sk.over(ex + dx, ey + dy, dy < 0 ? gold : gold2);
      sk.over(ex, ey - 1, dark); sk.over(ex, ey, dark); sk.over(ex, ey + 1, dark);
      sk.over(ex - 1, ey - 1, wet);
      if (P.eye < 0.6) for (let dx = -1; dx <= 1; dx++) sk.over(ex + dx, ey - 1, lidC);
    }
    // the heavy brow ridge
    for (let dx = -4; dx <= 4; dx++) sk.over(ex + dx, ey - 4 - (Math.abs(dx) > 3 ? -1 : 0), brow);
  }
  // the parietal eye on the crown: a pale scale; in the tell it gleams
  {
    const q = hp(8.5, -10.6);
    const c = P.third > 0.3 ? hex('#e8fff2') : hex('#9aa488');
    sk.over(q[0], q[1], c);
    if (P.third > 0.5) { sk.over(q[0] - 1, q[1], hex('#a8e8d0', 200)); sk.over(q[0] + 1, q[1], hex('#a8e8d0', 200)); sk.over(q[0], q[1] - 1, hex('#c8f8e8', 160 + Math.round(P.third * 90))); }
  }
  // the teeth (only when gaping): the fused saw edge of the jaws
  if (P.jaw > 0.25) for (let x = 12; x < 28; x += 2.5) { const q = hp(x, 2.9); sk.over(q[0], q[1], hex('#e8e2c8')); const r = jp(x, 2); sk.over(r[0], r[1], hex('#d8d2b8')); }

  legs(true);
  const E = hp(13.5, -5.2);
  return { head: hp(14, -14), eye: E };
}

export const ANCIENT: SpeciesDef = {
  name: 'Te Ngārara Nui', kind: 'reptile', len: 245, height: 70,
  anims: ANCIENT_ANIMS,
  canvas: (_a: string, juv: boolean) => (juv ? { w: 160, h: 80, ox: 82, oy: 70 } : { w: 380, h: 170, ox: 200, oy: 150 }),
  draw: adraw,
  eyeFor: () => 'open',
};

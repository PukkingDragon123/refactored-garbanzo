// Kelp Skink: a copper-striped skink of the wrack line with ruffled flaps of skin down its flanks and
// tail that look exactly like torn kelp fronds. Basking, it spreads the flaps flat to soak up the sun
// (they are full of blood vessels); hiding, it presses into the drift and becomes another strand of
// rotting kelp. Males flash an orange throat at rivals with a burst of head-bobs.
//
// Painted from skink anatomy on the Relief layer (beasts-relief): ONE contour through landmarks
// along the spine and the skull (the tail tip, the tail base, the sacrum, the back, the neck, the
// occiput, the brow over the eye, the snout, the lip line, the hinged lower jaw, the throat, the
// belly and the vent), so the long cylindrical trunk runs into the wedge head with no neck and on into
// a tail as long as the body. Inside: smooth glossy cycloid scales in staggered rows (each lit along
// its front edge), the pattern of a New Zealand skink (an olive-brown back with paired dark flecks, a
// bright copper dorsolateral stripe running from the eye to the tail, a dark lateral band with pale
// speckles, a cream belly), barred lip scales, the ear opening, the nostril, the gold eye, the jaw
// muscle and the shoulder and hip; short sprawling limbs, each a contour, with five clawed toes
// (the hind foot's long fourth toe); and the kelp flaps: ragged lobed frills along the flank and tail,
// olive-brown with veins running out to torn yellow-green edges, spread wide when basking (the far one
// showing as a ruffled crest over the back), pressed flat over the back when it hides.
//
// Faces right, anchored on the ground under the body. Anims: idle (bask), walk, dash, pounce, eat,
// display, hide.

import { Sk, V2, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, TAU, hh, ik2 } from '../../beasts-core';
import { Frame2 } from '../../beasts-rig';
import { Relief, Sp, Tx, LM, spline } from '../../beasts-relief';
import { hex } from '../../color';
import { strip } from '../wild/contour';
import { arcs, onPath, atPath, frac } from './shore-kit';

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

const EYE: EyeSpec = { r: 1.1, iris: hex('#3a2410'), lash: hex('#1a1408'), pupil: hex('#0c0806'), dark: true };
const ID = { FAR: 1, FFLAP: 2, BODY: 3, HEAD: 4, NFLAP: 5, LEG: 6, MOUTH: 7 };
const C = { ear: hex('#1a120a'), nos: hex('#20160c'), claw: hex('#e8dcc0'), lipBar: hex('#4a3420') };

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const P = pose(anim, frame, n);
  const k = juv ? 0.78 : 1.12;
  const M = {
    skin: sk.m(rmp('#5c4426', { n: 7, dark: 0.6, light: 0.26, cool: 0.12, warm: 0.3, sat: 0.4 }), { edge: 1 }),
    dark: sk.m(rmp('#3e2a18', { n: 6, dark: 0.55, light: 0.4, cool: 0.15 }), { edge: 1 }),
    copper: sk.m(rmp('#e0a04a', { n: 6, dark: 0.5, light: 0.45, warm: 0.2 }), { edge: 1 }),
    belly: sk.m(rmp('#dccc98', { n: 5, dark: 0.42, light: 0.35, cool: 0.08 }), { edge: 1 }),
    speck: sk.m(rmp('#c8b488', { n: 4, dark: 0.4 }), { edge: 1 }),
    flap: sk.m(rmp('#6e7c32', { n: 6, dark: 0.55, light: 0.45, cool: 0.12 }), { edge: 1 }),
    flapV: sk.m(rmp('#4c5622', { n: 5, dark: 0.5, light: 0.4 }), { edge: 1 }),
    flapE: sk.m(rmp('#b4b044', { n: 5, dark: 0.45, light: 0.4 }), { edge: 1 }),
    limb: sk.m(rmp('#a27a4c', { n: 6, dark: 0.55, light: 0.4, warm: 0.2 }), { edge: 1 }),
    throat: sk.m(rmp('#f0842a', { n: 5, dark: 0.45, light: 0.35, warm: 0.2 }), { edge: 1 }),
    mouth: sk.m(rmp('#b04850', { n: 4, dark: 0.5, light: 0.3 }), { edge: 0 }),
    claw: sk.m(rmp('#6a4c2c', { n: 4, dark: 0.45, light: 0.4 }), { edge: 1 }),
    bug: sk.m(rmp('#b8906a', { n: 4, dark: 0.45, light: 0.4 }), { edge: 1 }),
  };
  sk.clipY = 0;
  const by = -(3.1 + P.lift * 1.1 - P.flat * 1.6) * k;
  // ---- the spine: tail tip (u = 0) to the neck (u = 1), a slight S-wave, the tail curl
  const N = 14;
  const spine: V2[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const x = -16.4 + u * 22.2 * k + (u > 0.82 ? P.hx * (u - 0.82) * 3.6 : 0);
    let y = by - Math.sin((P.wave + u * 1.3) * TAU) * 0.35 * P.waveA * k;
    if (u < 0.4) y -= P.tail * (0.4 - u) * 10 * k;
    if (u < 0.4) y += (0.4 - u) * (0.4 - u) * 6 * k * (1 - P.flat) * (P.tail > 0 ? 0 : 1); // the tail droops to the sand
    if (u > 0.85) y -= Math.sin(P.head) * (u - 0.85) * 10 * k;
    spine.push([x, Math.min(y, -0.6)]);
  }
  const neck = spine[N], nb = spine[N - 1];
  const ha = Math.atan2(neck[1] - nb[1], neck[0] - nb[0]) - P.head * 0.9;
  const H = new Frame2(neck, ha, k);
  // the radius: thin tail tip, a fat tail base, the round trunk, the neck no narrower than the head
  const fl = 1 - P.flat * 0.22;
  const wUp = (u: number) => (u < 0.46 ? 0.28 + Math.pow(u / 0.46, 1.25) * 1.3 : u < 0.56 ? 1.58 + (u - 0.46) * 1.8 : u < 0.86 ? 1.76 : 1.76 - (u - 0.86) * 1.2) * k * fl;
  const wDn = (u: number) => wUp(u) * (u > 0.55 && u < 0.85 ? 1.06 : 0.95);
  const cumS = arcs(spine);
  const sp = (u: number, c: number, sharp = 0): LM => { const q = atPath(spine, cumS, u, c); return [q[0], q[1], sharp]; };
  const hp = (x: number, y: number, sharp = 0): LM => { const q = H.p(x, y); return [q[0], q[1], sharp]; };
  // the lower jaw hinges at the back of the mouth
  const jo = P.open * 0.45;
  const jp = (x: number, y: number, sharp = 0): LM => {
    const hx = 0.6, hy = 0.7, dx = x - hx, dy = y - hy, c = Math.cos(jo), s = Math.sin(jo);
    const q = H.p(hx + dx * c - dy * s, hy + dx * s + dy * c);
    return [q[0], q[1], sharp];
  };
  // ---- the body contour: tail tip, along the back, over the skull to the snout, the jaw, the belly
  const dorsal: LM[] = [0.05, 0.14, 0.24, 0.35, 0.46, 0.56, 0.66, 0.76, 0.86, 0.95].map(u => sp(u, wUp(u) + (u > 0.5 && u < 0.6 ? 0.15 * k : 0)));
  const head: LM[] = [hp(0.8, -1.75), hp(2.6, -1.8), hp(4.2, -1.35), hp(5.5, -0.7), hp(6.15, 0.05, 0.45)];
  const lip: LM[] = P.open > 0.15 ? [hp(5.6, 0.55), hp(3.4, 0.75), hp(0.9, 0.75, 0.6), jp(4.6, 0.75), jp(5.6, 0.85, 0.5)] : [];
  const jaw: LM[] = [jp(5.2, 1.3), jp(3.4, 1.85), jp(1.2, 2.05)];
  const ventral: LM[] = [0.95, 0.86, 0.76, 0.66, 0.56, 0.46, 0.35, 0.24, 0.14, 0.05].map(u => sp(u, -wDn(u)));
  const outline: LM[] = [sp(0, 0, 0.5), ...dorsal, ...head, ...lip, ...jaw, ...ventral];
  const axis: V2[] = [...spine, H.p(2, 0), H.p(6.2, 0.1)];
  const cumA = arcs(axis), Ltot = cumA[cumA.length - 1];
  const tNeck = cumS[cumS.length - 1] / Ltot;

  // ---- textures
  const uOf = (t: number) => Math.min(1, t / tNeck);
  /** the scales and the colour pattern of the trunk, tail and head */
  const skinTex = (p: Sp, o: Tx) => {
    const q = onPath(axis, cumA, p.x, p.y);
    const t = q.t, inHead = t > tNeck, u = uOf(t);
    const w = inHead ? 1.8 * k : (q.c >= 0 ? wUp(u) : wDn(u));
    const v = q.c / Math.max(0.6, w); // +1 the spine .. -1 the belly midline
    // cycloid scales in staggered rows, lit along their front edge
    const rowH = 1.05 * k, row = Math.floor((q.c + 20) / rowH);
    const sl = (inHead ? 1.4 : 1.8) * k, col = (q.s + (row & 1) * sl * 0.5) / sl, fu = frac(col);
    o.z += (fu < 0.22 ? -0.16 : 0.06) * (1 - Math.abs(v) * 0.3);
    if (fu > 0.7 && row & 1) o.t += 0.03;
    o.m = M.skin;
    if (inHead) {
      const hx = (t - tNeck) * Ltot / k; // px from the neck along the head
      if (v < -0.2) {
        // the barred lip scales and the throat (orange in display)
        o.m = P.throat > 0.3 && hx < 3.5 ? M.throat : M.belly;
        if (v > -0.62 && frac(hx / 1.3) < 0.35 && hx > 1.6) o.m = M.dark;
      } else if (v < 0.3 && hx < 3) o.m = M.copper;   // the stripe runs on through the eye
      else if (v > 0.55 && frac(hx * 0.6) < 0.2) o.m = M.dark;
      return;
    }
    if (v < -0.45) {
      o.m = u > 0.5 && u < 0.92 && P.throat > 0.3 && u > 0.84 ? M.throat : M.belly;
      return;
    }
    if (v < 0.15) {
      // the darker lateral band (under the kelp frill), with pale speckles
      o.m = M.skin; o.t -= 0.1;
      if (Math.floor(col) % 3 === (row & 1) && fu > 0.4) o.m = M.speck;
      return;
    }
    if (v < 0.5 && u > 0.12) { o.m = M.copper; if (fu < 0.2) o.t -= 0.05; return; }
    // the back: paired dark flecks along the spine
    if (v > 0.62 && frac(q.s / (2.6 * k)) < 0.3 && u > 0.1) o.m = M.dark;
  };
  /** a limb's scales and its tone */
  const limbTex = (p: Sp, o: Tx) => {
    o.m = M.limb;
    if (frac((p.x + p.y) * 0.7) < 0.3) o.z -= 0.15;
  };

  // ---- kelp flaps: a ragged lobed frill along the flank and the tail
  const flap = (R: Relief, near: boolean, z: number, id: number) => {
    const u0 = 0.16, u1 = 0.84, nS = 26;
    const top: V2[] = [], bot: V2[] = [];
    for (let i = 0; i <= nS; i++) {
      const u = u0 + (u1 - u0) * (i / nS);
      // lobes: irregular, torn
      const lobe = Math.pow(Math.abs(Math.sin((u - u0) * 13 + hh(Math.floor((u - u0) * 4.2), near ? 1 : 2, 51) * 2)), 0.55);
      const tear = hh(Math.floor(u * 40), near ? 3 : 4, 53) < 0.15 ? 0.45 : 1;
      const ext = (0.7 + P.flaps * 1.8 + hh(Math.floor(u * 9), near ? 5 : 6, 55) * 0.9) * lobe * tear * (u < 0.3 ? 0.6 + (u - u0) * 2.8 : 1) * k;
      if (P.flat) {
        // pressed up over the back like a strand of rotting kelp
        top.push(atPath(spine, cumS, u, wUp(u) + 0.4 * k + ext * 0.35));
        bot.push(atPath(spine, cumS, u, -0.3 * k));
      } else if (near) {
        top.push(atPath(spine, cumS, u, -wDn(u) * 0.4));
        bot.push(atPath(spine, cumS, u, -wDn(u) * 0.95 - ext * (0.1 + P.flaps * 0.5)));
      } else {
        top.push(atPath(spine, cumS, u, wUp(u) - 0.8 * k + ext * (0.15 + P.flaps * 0.6)));
        bot.push(atPath(spine, cumS, u, 0));
      }
    }
    const poly: V2[] = [...top, ...bot.reverse()];
    const fa = near ? 1 : -1;
    R.region(poly, {
      z, R: 1.1 * k, H: 1 * k, id, blend: 0, tex: (p, o) => {
        const q = onPath(spine, cumS, p.x, p.y);
        // veins running out to the lobes, the torn pale edge, the odd hole
        o.m = M.flap;
        if (frac(q.s / (2.6 * k)) < 0.16) { o.m = M.flapV; o.z -= 0.2; }
        if (p.s < 0.9 && (fa * q.c < -wDn(q.t) * 0.8 || !near)) o.m = M.flapE;
        o.z += Math.sin(q.s * 1.7) * 0.25;
      },
    });
  };

  // ---- limbs
  const limb = (front: boolean, near: boolean) => {
    // sprawled: the upper arm runs back and out to an elbow at the belly line, the forearm forward
    // to the hand; the thigh runs forward and out to the knee, the shank back to the foot
    const u = front ? 0.85 : 0.52;
    const hip = atPath(spine, cumS, u, -wDn(u) * 0.35);
    const ph = P.legPh * TAU + (front ? 0 : Math.PI) + (near ? 0 : Math.PI);
    const step = P.moving ? Math.sin(ph) * 2.4 * k : 0;
    const lift = P.moving ? Math.max(0, Math.cos(ph)) * 1.3 * k : 0;
    const off = near ? 0 : (front ? -1.2 : 1.2) * k;
    const foot: V2 = [hip[0] + (front ? 1.4 : -1.1) * k + step + off, -0.5 - lift];
    const j: V2 = front
      ? [hip[0] - 1.4 * k + step * 0.4 + off, Math.min(foot[1] - 1, hip[1] + 1.8 * k)]
      : [hip[0] + 1.9 * k + step * 0.4 + off, Math.min(foot[1] - 1, hip[1] + 1.4 * k)];
    const w = (t: number) => (front ? 0.95 - t * 0.3 : (t < 0.5 ? 1.25 - t * 0.5 : 1 - (t - 0.5) * 0.6)) * k;
    const poly = strip([hip, j, foot], w, w, { capA: 1, capB: 0.5 });
    return { hip, j, foot, poly, front };
  };
  const toes = (L: ReturnType<typeof limb>, z: number, near: boolean) => {
    // five clawed toes splayed from the foot, the hind foot's fourth toe the longest
    const f = L.foot, fwd = L.front ? 1 : -1;
    const list: [number, number][] = L.front ? [[-0.25, 1.6], [0.1, 2.2], [0.45, 2], [0.85, 1.5]] : [[-0.1, 2], [0.2, 3.4], [0.55, 2.4], [0.95, 1.6]];
    for (const [a0, len] of list) {
      const a = L.front ? -a0 * 0.6 : Math.PI + a0 * 0.6;
      const ln = len * k;
      for (let s = 1; s <= Math.round(ln); s++) {
        const x = f[0] + Math.cos(a) * s * (L.front ? 1 : 1), y = Math.min(-0.3, f[1] + Math.sin(a) * s * 0.4 + 0.3);
        sk.dot(x, y, M.claw, near ? 0.55 : 0.3, z);
      }
      if (near) sk.over(f[0] + Math.cos(a) * (ln + 0.6), Math.min(-0.3, f[1] + 0.4), C.claw);
      void fwd;
    }
  };

  // ---------------------------------------------------------------- far side (behind the body)
  {
    const R = Relief.full(sk);
    for (const front of [false, true]) { const L = limb(front, false); R.region(L.poly, { z: -6, R: 0.8, H: 1, id: ID.FAR, tex: limbTex }); }
    if (!P.flat && P.flaps > 0.85) flap(R, false, -3, ID.FFLAP);
    sk.np();
    R.emit({ bias: -0.14, drop: 1.2, seam: 0.5, seamDark: 0.3 });
    for (const front of [false, true]) toes(limb(front, false), -5, false);
  }
  // ---------------------------------------------------------------- the mouth, the body, the head
  const BR = Relief.full(sk);
  if (P.open > 0.15) {
    const g: LM[] = [hp(5.6, 0.5), hp(1, 0.8), jp(5.4, 0.9)];
    BR.region(spline(g, 0.4), { z: 1 * k, R: 0.6, H: 0.5, id: ID.MOUTH, tex: M.mouth });
  }
  const body = spline(outline, 0.6);
  BR.region(body, { z: 0, R: 1.7 * k, H: 2.6 * k, id: ID.BODY, tex: skinTex, pow: 0.9 });
  // anatomy under the skin: the shoulder and the hip, the jaw muscle, the brow over the eye
  { const s = atPath(spine, cumS, 0.84, 0), h = atPath(spine, cumS, 0.52, 0); BR.bump(s[0], s[1], 2.2 * k, 1.6 * k, 0.6 * k); BR.bump(h[0], h[1], 2.4 * k, 1.6 * k, 0.6 * k); }
  { const c = H.p(1.4, 0.6), b = H.p(3.3, -1.1); BR.bump(c[0], c[1], 1.6 * k, 1.2 * k, 0.6 * k); BR.bump(b[0], b[1], 1.2 * k, 0.7 * k, 0.5 * k); }
  // the mouth line (closed), the gular fold under the throat
  if (P.open <= 0.15) BR.line([H.p(1, 0.7), H.p(3.6, 0.75), H.p(5.6, 0.45)], 0.6 * k, -0.6 * k);
  BR.line([atPath(spine, cumS, 0.97, -1.2 * k), atPath(spine, cumS, 0.97, -2 * k)], 0.6, -0.4 * k);
  sk.np();
  BR.emit({ drop: 1.4 * k, seam: 0.5, seamDark: 0.28, ao: 0.05, aoR: 2, bias: -0.04 });
  // ---------------------------------------------------------------- the near kelp flap
  {
    const R = Relief.full(sk);
    flap(R, true, (P.flat ? 4 : 3) * k, ID.NFLAP);
    sk.np();
    R.emit({ drop: 1.1, seam: 0.5, seamDark: 0.25, bias: -0.02 });
  }
  // ---------------------------------------------------------------- the near limbs, over the flank
  const nearL = [limb(false, true), limb(true, true)];
  {
    const R = Relief.full(sk);
    for (const L of nearL) R.region(L.poly, { z: 5 * k, R: 0.9, H: 1.4 * k, id: ID.LEG, tex: limbTex });
    for (const L of nearL) { R.bump(L.j[0], L.j[1], 1 * k, 1 * k, 0.5); }
    sk.np();
    R.emit({ drop: 1.2, seam: 0.5, seamDark: 0.25 });
  }
  for (const L of nearL) toes(L, 8, true);

  // ---- the face: the ear opening, the nostril, the barred lip, the eye
  const ear = H.p(0.4, 0.15), nos = H.p(5.4, -0.35);
  sk.overPaint(ear[0], ear[1], C.ear);
  sk.overPaint(nos[0], nos[1], C.nos);
  const ep = H.p(3.2, -0.55);
  const e = drawEye(sk, ep[0], ep[1], { ...EYE, r: juv ? 0.6 : 1.1 }, P.flat ? 'closed' : eye);
  // the prey: a sand-hopper (a curled amphipod) in the jaws
  if (P.prey) {
    const m = H.p(6.6, 1.1);
    const R = new Relief(sk, m[0] - 4, m[1] - 4, m[0] + 4, m[1] + 4);
    const bug: LM[] = [[m[0] - 1.3 * k, m[1] - 0.3, 0], [m[0] - 0.2, m[1] - 1.1 * k, 0], [m[0] + 1.3 * k, m[1] - 0.6, 0], [m[0] + 1.5 * k, m[1] + 0.6, 0.5], [m[0] + 0.2, m[1] + 0.8 * k, 0], [m[0] - 1.1 * k, m[1] + 0.5, 0]];
    R.region(spline(bug, 0.4), { z: 12, R: 0.7, H: 1, id: 1, tex: (p, o) => { o.m = M.bug; if (frac(p.x * 0.8) < 0.3) o.z -= 0.3; } });
    sk.np();
    R.emit({ drop: 1 });
  }
  return { head: [H.o[0] + 3, H.o[1] - 4] as V2, eye: e };
}

export const KELPSKINK: SpeciesDef = {
  name: 'Kelp Skink', kind: 'reptile', len: 22, height: 4,
  anims: ANIMS,
  canvas: () => ({ w: 40, h: 20, ox: 18, oy: 15 }),
  draw,
  eyeFor: () => 'open',
};

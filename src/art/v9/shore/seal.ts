// Corvex Seal: a three-and-a-half metre shaggy black pinniped of the island's seal rocks. Its face is
// bare crimson skin, its muzzle is sheathed in a hooked, ivory keratin beak-plate (the "corvex":
// raven-beak) for cracking shellfish, and a mane of long guard hair runs from the crown to the
// shoulders. The fore-flippers are long clawed arms it gallops on; a crimson throat sac balloons out
// under the beak when it roars. White "star" spots run down each flank. Crown leeches cluster in the
// bare skin folds where the mane parts on the neck (their crowns open while the seal sleeps).
//
// Faces right, anchored on the ground under the middle of the body (lying pose). Anims: sleep, idle,
// scratch, flick, yawn, wake, roar, gallop, lunge, pin, tired.

import { Sk, V2, Px, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, TAU, hh, ik2, lerp2, sm } from '../../beasts-core';
import { Frame2 } from '../../beasts-rig';
import { hex } from '../../color';
import { clamp } from '../../../core/math';

type Eye = 'open' | 'half' | 'closed' | 'angry' | 'alert';

interface P {
  br: number;            // breath 0..1 (belly and flanks swell)
  lift: number;          // chest raised off the ground (0 lying .. 1 reared up)
  hump: number;          // mid-back arch (px)
  waveA: number;         // gallop ripple amplitude (px)
  wave: number;          // gallop ripple phase 0..1
  stretch: number;       // body length multiplier
  flat: number;          // squashed onto the sand (tired, pinning)
  neck: number;          // neck angle (rad, 0 = level forward, - = up)
  nl: number;            // neck length multiplier
  head: number;          // extra head pitch (+ nose down)
  gape: number;          // beak open 0..1
  sac: number;           // throat sac inflation 0..1
  tongue: number;        // tongue lolling out 0..1
  mane: number;          // bristle 0..1
  shake: number;         // mane swing -1..1
  foreN: V2;             // near fore-flipper hand target
  foreF: V2;             // far fore-flipper hand target
  hind: number;          // hind flippers 0 splayed back .. 1 swung forward under the hips
  sand: number;          // flicked sand in the air 0..1
  sandPh: number;
  eye: Eye;
  crowns: number;        // leech crowns open 0..1
  crownPh: number;
}
const base = (): P => ({
  br: 0.5, lift: 0, hump: 0, waveA: 0, wave: 0, stretch: 1, flat: 0, neck: -0.3, nl: 1, head: 0.1,
  gape: 0, sac: 0, tongue: 0, mane: 0, shake: 0, foreN: [52, 0], foreF: [46, 0], hind: 0, sand: 0, sandPh: 0,
  eye: 'open', crowns: 0.3, crownPh: 0,
});

const A = (frames: number, fps: number, loop = true) => ({ frames, fps, loop });
export const SEAL_ANIMS = {
  sleep: A(6, 1.6), idle: A(4, 2), scratch: A(8, 9), flick: A(6, 8), yawn: A(6, 5, false),
  wake: A(6, 7, false), roar: A(6, 8), gallop: A(8, 11.5), lunge: A(4, 12), pin: A(4, 2), tired: A(6, 6),
};

function pose(anim: string, f: number, n: number): P {
  const p = base();
  const t = f / n;
  const s1 = Math.sin(t * TAU);
  switch (anim) {
    case 'sleep': {
      // slow breathing, chin on the sand; the throat wattle puffs on each snore; leech crowns open
      p.br = 0.5 + 0.5 * s1;
      p.neck = 0.12; p.head = 0.22; p.eye = 'closed';
      const snore = Math.max(0, -s1);
      p.sac = snore * 0.2; p.gape = snore * 0.05;
      p.crowns = 1; p.crownPh = t;
      break;
    }
    case 'idle': {
      p.br = 0.5 + 0.5 * s1;
      p.neck = -0.34 + (f === 2 ? -0.07 : 0); p.head = [0.08, 0.04, -0.04, 0.12][f];
      p.eye = f === 3 ? 'half' : 'open';
      p.crowns = 0.5; p.crownPh = t;
      break;
    }
    case 'scratch': {
      // lifts the near fore-flipper and rakes its claws through the neck folds (the leeches clamp down)
      const k = [0.3, 0.8, 1, 1, 1, 1, 0.8, 0.3][f];
      const rake = [0, 0, 0, 1, 0, 1, 0, 0][f];
      p.neck = -0.38 - k * 0.12; p.head = 0.14 + k * 0.14;
      p.eye = k > 0.7 ? 'half' : 'open';
      p.foreN = lerp2([52, 0], [36 + rake * 5, -34 - rake * 5], sm(k));
      p.crowns = 0; p.br = 0.5 + 0.3 * s1;
      p.mane = rake * 0.2;
      break;
    }
    case 'flick': {
      // scoops wet sand with a fore-flipper and flings it over its back to keep cool
      const H: V2[] = [[54, 0], [46, -4], [30, -26], [10, -40], [28, -18], [50, -2]];
      p.foreN = H[f];
      p.neck = -0.34; p.head = 0.1 - (f > 1 && f < 5 ? 0.14 : 0);
      p.sand = f >= 2 && f <= 4 ? 1 : 0; p.sandPh = (f - 2) / 3;
      p.eye = f === 3 ? 'half' : 'open';
      break;
    }
    case 'yawn': {
      const g = [0, 0.45, 1, 1, 0.6, 0.1][f];
      p.neck = -0.32 - g * 0.32; p.head = 0.06 - g * 0.34;
      p.gape = g; p.sac = g * 0.3; p.eye = g > 0.3 ? 'closed' : 'half';
      p.crowns = 0.6; p.crownPh = t;
      break;
    }
    case 'wake': {
      // jolts awake, heaves up onto its fore-flippers and shakes out the mane
      const K = [
        [0, 0.12, 0.22, 0, 0],
        [0.06, -0.42, 0.04, 0.2, 0],
        [0.3, -0.52, -0.02, 0.45, 0],
        [0.36, -0.44, 0.06, 0.65, 1],
        [0.38, -0.5, 0.02, 0.75, -1],
        [0.44, -0.66, -0.1, 0.95, 0],
      ][f];
      p.lift = K[0]; p.neck = K[1]; p.head = K[2]; p.mane = K[3]; p.shake = K[4];
      p.eye = f === 0 ? 'half' : f < 3 ? 'alert' : 'angry';
      p.gape = f === 5 ? 0.3 : 0;
      p.foreN = [52 + p.lift * 6, 0]; p.foreF = [45 + p.lift * 5, 0];
      p.crowns = f === 0 ? 1 : 0;
      p.hind = p.lift * 0.4;
      break;
    }
    case 'roar': {
      // reared right up on the fore-flippers, beak wide, the throat sac ballooned under it
      p.lift = 1; p.neck = -1.05 + Math.sin(t * TAU) * 0.05; p.nl = 1.06; p.head = -0.34;
      p.gape = [0.85, 1, 1, 0.9, 1, 0.95][f]; p.sac = [0.82, 0.95, 1, 0.9, 1, 0.86][f];
      p.mane = 1; p.shake = Math.sin(t * TAU * 2) * 0.25;
      p.foreN = [52, 0]; p.foreF = [42, 0];
      p.hind = 0.3; p.eye = 'angry'; p.br = 1;
      break;
    }
    case 'gallop': {
      // a heaving bound: fore-flippers reach and plant, the back humps as the hind flippers swing
      // forward, then the whole body stretches out on the push (a ripple running tail to head)
      p.lift = 0.32 + 0.26 * s1;
      p.hump = 5 + 10 * Math.max(0, Math.sin((t - 0.18) * TAU));
      p.waveA = 3.5; p.wave = t;
      p.stretch = 1 + 0.07 * Math.sin((t - 0.25) * TAU);
      p.neck = -0.5 - 0.14 * s1; p.head = 0.06 + 0.08 * Math.sin(t * TAU + 1);
      p.gape = 0.45 + 0.25 * Math.sin(t * TAU + 2);
      const ph = t * TAU + 0.6;
      p.foreN = [56 + Math.sin(ph) * 15, -Math.max(0, Math.cos(ph)) * 10];
      p.foreF = [50 + Math.sin(ph + 0.5) * 14, -Math.max(0, Math.cos(ph + 0.5)) * 9];
      p.hind = 0.5 + 0.5 * Math.sin((t + 0.45) * TAU);
      p.mane = 0.55; p.shake = -0.5 + Math.sin(t * TAU) * 0.35;
      p.eye = 'angry'; p.br = 0.8; p.crowns = 0;
      break;
    }
    case 'lunge': {
      p.stretch = 1.12; p.lift = 0.14 + (f % 2) * 0.05; p.neck = 0; p.nl = 1.2; p.head = -0.12;
      p.gape = f % 2 ? 1 : 0.85; p.mane = 0.9; p.shake = -0.8;
      p.foreN = [80 - (f % 2) * 4, 0]; p.foreF = [72, 0];
      p.hind = 1; p.eye = 'angry'; p.hump = 3; p.crowns = 0;
      break;
    }
    case 'pin': {
      // flopped flat on whatever it caught, eyes shut, smug
      p.flat = 0.6; p.br = 0.5 + 0.5 * s1; p.neck = -0.16; p.head = -0.08 + s1 * 0.03;
      p.eye = 'closed'; p.crowns = 0.5; p.crownPh = t;
      p.foreN = [60, 0]; p.foreF = [54, 0];
      break;
    }
    case 'tired': {
      // collapsed, flanks heaving, beak open, tongue lolling out, panting
      p.flat = 0.45; p.br = f % 2 ? 1 : 0.1;
      p.neck = 0.14; p.head = 0.16 + (f % 2) * 0.04;
      p.gape = f % 2 ? 0.5 : 0.3; p.tongue = 1; p.sac = f % 2 ? 0.2 : 0.1;
      p.eye = 'half';
      p.foreN = [62, 0]; p.foreF = [56, 0];
      p.crowns = 0.8; p.crownPh = t;
      break;
    }
  }
  return p;
}

const EYE: EyeSpec = { r: 1.6, iris: hex('#f2b43a'), lash: hex('#140c10'), pupil: hex('#140a0c'), ring: hex('#5a0e14') };

function mats(sk: Sk) {
  return {
    fur: sk.m(rmp('#221e2a', { n: 7, dark: 0.62, light: 0.36, cool: 0.5, warm: 0.1 }), { edge: 1 }),
    furB: sk.m(rmp('#191620', { n: 6, dark: 0.55, light: 0.3, cool: 0.4 }), { edge: 1 }),
    lock: sk.m(rmp('#221e2a', { n: 7, dark: 0.62, light: 0.36, cool: 0.5, warm: 0.1 }), { edge: 1 }),
    lockT: sk.m(rmp('#3e3848', { n: 6, dark: 0.6, light: 0.34, cool: 0.4 }), { edge: 1 }),
    skin: sk.m(rmp('#86505c', { n: 5, dark: 0.55, light: 0.3 }), { edge: 1 }),
    crease: sk.m(rmp('#3a1c26', { n: 3, dark: 0.4 }), { edge: 0 }),
    face: sk.m(rmp('#b41e28', { n: 6, dark: 0.58, light: 0.42, warm: 0.12, cool: 0.35 }), { edge: 1, spec: 0.2 }),
    faceD: sk.m(rmp('#6e1018', { n: 4, dark: 0.5 }), { edge: 0 }),
    beak: sk.m(rmp('#e6d6b2', { n: 6, dark: 0.58, light: 0.5, warm: 0.25 }), { spec: 0.35 }),
    beakB: sk.m(rmp('#7a1a22', { n: 5, dark: 0.55 }), { spec: 0.25 }),
    white: sk.m(rmp('#f0ece4', { n: 4, dark: 0.32, at: 2 }), { edge: 1 }),
    sac: sk.m(rmp('#d83c52', { n: 6, dark: 0.55, light: 0.5 }), { spec: 0.55, edge: 1 }),
    vein: sk.m(rmp('#8e1a30', { n: 4, dark: 0.45 }), { edge: 0, spec: 0.3 }),
    mouth: sk.m(rmp('#4e121e', { n: 3, dark: 0.45 }), { edge: 0 }),
    tongue: sk.m(rmp('#ec8294', { n: 4, dark: 0.45 }), { spec: 0.4 }),
    flip: sk.m(rmp('#211a1e', { n: 6, dark: 0.55, light: 0.3 }), { spec: 0.25 }),
    flipD: sk.m(rmp('#140f12', { n: 4, dark: 0.5 }), { edge: 0 }),
    claw: sk.m(rmp('#d6c8ae', { n: 5, dark: 0.55, light: 0.4 }), { spec: 0.3 }),
    horn: sk.m(rmp('#4a3a34', { n: 4, dark: 0.5 }), { spec: 0.3 }),
    leech: sk.m(rmp('#3a2f96', { n: 5, dark: 0.6, light: 0.45, cool: 0.4 }), { spec: 0.85, edge: 1 }),
    sand: sk.m(rmp('#d9c08c', { n: 4, dark: 0.45 }), { edge: 0, noRim: true }),
  };
}
type M = ReturnType<typeof mats>;

// ------------------------------------------------------------------ spine
// rest x / radius of the spine controls, tail -> shoulders: slim hips, heavy chest and shoulders
const SX = [-70, -55, -36, -14, 8, 27];
const SR = [6, 12.5, 17.5, 21.5, 24.5, 25];

/** Catmull-Rom through the controls: n + 1 samples and the radius at each. */
function spline(ctrl: V2[], rad: number[], n: number): { pts: V2[]; r: number[] } {
  const pts: V2[] = [], r: number[] = [];
  const m = ctrl.length - 1;
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * m, k = Math.min(m - 1, Math.floor(u)), f = u - k;
    const p0 = ctrl[Math.max(0, k - 1)], p1 = ctrl[k], p2 = ctrl[k + 1], p3 = ctrl[Math.min(m, k + 2)];
    const f2 = f * f, f3 = f2 * f;
    const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f2 + (-a + 3 * b - 3 * c + d) * f3);
    pts.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]);
    r.push(rad[k] + (rad[k + 1] - rad[k]) * (f * f * (3 - 2 * f)));
  }
  return { pts, r };
}

interface Rig {
  P: P; M: M;
  at(u: number): { p: V2; r: number; a: number };
  tail: V2; sh: V2; shR: number;
  n0: V2; hc: V2; neckA: number; H: Frame2;
  /** part id of the body + neck mass */
  body: number;
}

function draw(sk: Sk, anim: string, frame: number, eyeIn: BeastEye): { head: V2; eye: V2 } {
  const n = SEAL_ANIMS[anim as keyof typeof SEAL_ANIMS]?.frames ?? 1;
  const P = pose(anim, frame, n);
  const M = mats(sk);
  sk.clipY = 0;
  const eyeSt: Eye = eyeIn === 'open' ? P.eye : eyeIn === 'scared' ? 'alert' : eyeIn;

  // ---- spine: lying on the sand, the chest lifted (rear stays down), humped, rippling
  const ctrl: V2[] = [], rad: number[] = [];
  for (let i = 0; i < SX.length; i++) {
    const u = i / (SX.length - 1);
    const r = SR[i] * (1 + P.br * 0.04 * Math.sin(Math.PI * Math.min(1, u * 1.2))) * (1 - P.flat * 0.1);
    const x = SX[i] * P.stretch + (P.stretch - 1) * 12;
    let y = -r * (0.88 - P.flat * 0.2);
    y -= P.lift * 62 * sm((u - 0.5) / 0.42);
    y -= P.hump * Math.sin(Math.PI * clamp((u - 0.05) / 0.85));
    y -= P.waveA * Math.sin(TAU * (P.wave - u * 0.8)) * Math.sin(Math.PI * u);
    ctrl.push([x, y]); rad.push(r);
  }
  const sp = spline(ctrl, rad, 16);
  const at = (u: number) => {
    const k = clamp(u) * (sp.pts.length - 1), i = Math.min(sp.pts.length - 2, Math.floor(k)), f = k - i;
    const a = Math.atan2(sp.pts[i + 1][1] - sp.pts[i][1], sp.pts[i + 1][0] - sp.pts[i][0]);
    return { p: lerp2(sp.pts[i], sp.pts[i + 1], f), r: sp.r[i] + (sp.r[i + 1] - sp.r[i]) * f, a };
  };
  const sh = ctrl[ctrl.length - 1], shR = rad[rad.length - 1];
  const bodyA = at(0.93).a;
  // ---- neck and head placement
  const neckA = P.neck + bodyA * 0.7;
  const nl = 20 * P.nl;
  const n0: V2 = [sh[0] + 7, sh[1] - 2];
  const hc: V2 = [n0[0] + Math.cos(neckA) * nl, n0[1] + Math.sin(neckA) * nl];
  const H = new Frame2(hc, neckA * 0.4 + P.head, 1);
  const R: Rig = { P, M, at, tail: ctrl[0], sh, shR, n0, hc, neckA, H, body: 0 };

  // ---- far limbs (behind the body)
  hindFlipper(sk, R, false);
  foreFlipper(sk, R, false);

  // ---- body + neck (one part so they merge without a seam)
  sk.np();
  // an irregular constellation of white "star" spots down the upper flank
  const STARS: [number, number, number][] = [[0.8, 0.38, 3.2], [0.72, 0.5, 2.4], [0.66, 0.3, 1.6], [0.57, 0.44, 2.8], [0.49, 0.34, 1.9], [0.44, 0.52, 1.3], [0.36, 0.4, 2.2], [0.28, 0.46, 1.5], [0.22, 0.34, 1.1]];
  const spots = STARS.map(([u, v, s]) => { const q = at(u); return { c: [q.p[0], q.p[1] - q.r * v] as V2, rx: s * 1.15, ry: s * 0.8 }; });
  const bodyFill = (p: Px) => {
    for (const s of spots) {
      const q = ((p.x - s.c[0]) / s.rx) ** 2 + ((p.y - s.c[1]) / s.ry) ** 2;
      if (q < 1) { p.l += q < 0.4 ? 0.12 : 0; return M.white; }
    }
    if (p.v > 0.64) return M.furB;
    return M.fur;
  };
  sk.tube(sp.pts, t => {
    const k = t * (sp.r.length - 1), i = Math.min(sp.r.length - 2, Math.floor(k));
    return sp.r[i] + (sp.r[i + 1] - sp.r[i]) * (k - i);
  }, bodyFill, { z: 0, rz: 0.9 });
  // thick neck with a broad white bib on the throat and chest
  const neckPts: V2[] = [[sh[0] - 6, sh[1] + 1], n0, lerp2(n0, hc, 0.55), hc];
  const bib = lerp2(n0, hc, 0.3);
  const bibC: V2 = [bib[0] + Math.sin(neckA) * -shR * 0.62, bib[1] + Math.cos(neckA) * shR * 0.62];
  sk.tube(neckPts, t => shR * (1 - t * 0.44) + P.sac * 1.2, (p) => {
    const q = ((p.x - bibC[0]) / 8.5) ** 2 + ((p.y - bibC[1]) / 11) ** 2;
    const q2 = ((p.x - bibC[0] - Math.cos(neckA) * 6.5) / 6.5) ** 2 + ((p.y - bibC[1] - Math.sin(neckA) * 6.5 + 3) / 8.5) ** 2;
    if (q < 1 && q2 > 1 && p.v > 0.1) { p.l += q < 0.55 ? 0.06 : 0; return M.white; }
    return p.v > 0.64 ? M.furB : M.fur;
  }, { z: 3, rz: 0.9 });
  const bodyPart = sk.pid;
  R.body = bodyPart;
  // long hair strands lying back along the body, down over the chest
  sk.streaks(bodyPart, (x) => (x > sh[0] - 4 ? [-0.55, 0.84] : [-0.96, 0.28]), { spacing: 2, len: 6, amp: 0.13, seed: 5, light: 0.07 });
  sk.tufts(bodyPart, (_x, _y, nx, ny) => (ny < 0 ? [-0.75, -0.66] as V2 : nx < 0 && ny >= 0 ? [-1, 0.25] as V2 : null), { every: 2, len: 2, seed: 7 });

  // ---- shag: overlapping locks of guard hair down the back and flank
  shag(sk, R);
  // ---- neck folds with the crown leeches (where the mane parts, behind the head)
  neckFolds(sk, R);
  // ---- head (throat sac, bare crimson face, beak-plate)
  drawHead(sk, R);
  // ---- mane: long locks from the crown down over the nape and shoulders
  drawMane(sk, R);
  // ---- near limbs
  hindFlipper(sk, R, true);
  foreFlipper(sk, R, true);

  // ---- eye last (overlay) under a white brow stripe
  const eyeP = H.p(2, -3.4);
  for (let i = 0; i < 8; i++) {
    const q = H.p(4.5 - i * 1.1, -6.6 + i * 0.28 - (i > 4 ? (i - 4) * 0.35 : 0) + (eyeSt === 'angry' ? Math.max(0, 3 - i) * 0.6 : 0));
    sk.overPaint(q[0], q[1], i < 6 ? hex('#f6f2ea') : hex('#cfcac2'));
    if (i > 0 && i < 5) sk.overPaint(q[0], q[1] + 1, hex('#e2dcd2'));
  }
  const ep = sealEye(sk, eyeP, eyeSt);

  // ---- flicked sand arcing over the back
  if (P.sand) {
    for (let i = 0; i < 16; i++) {
      const ph = clamp(P.sandPh + (hh(i, 3, 4) - 0.5) * 0.35);
      const x = 22 + (-70 - 22) * ph + (hh(i, 1, 5) - 0.5) * 16;
      const y = -62 * Math.sin(Math.PI * clamp(ph * 0.85 + 0.12)) + (hh(i, 2, 6) - 0.5) * 10 - 10;
      const r = hh(i, 4, 7) < 0.3 ? 1.1 : 0.7;
      sk.np(true);
      sk.ell(x, y, r, r, M.sand, { z: 80 });
    }
  }
  const top = H.p(-2, -16);
  return { head: [top[0], top[1] - 4], eye: ep };
}

/**
 * Guard hair: long soft locks along the top of the back that break the silhouette into a shaggy
 * outline. Same ramp as the body so they read as one coat; each lock is shaded darker toward its
 * edges so the strands still separate.
 */
function shag(sk: Sk, R: Rig) {
  const { P, M, at } = R;
  const cnt = 17;
  for (let i = 0; i < cnt; i++) {
    const u = 0.1 + 0.8 * ((i + hh(i, 1, 30) * 0.4) / cnt);
    const q = at(u);
    const v = 0.9 - hh(i, 0, 31) * 0.12;
    const root: V2 = [q.p[0] + Math.sin(q.a) * q.r * v, q.p[1] - Math.cos(q.a) * q.r * v];
    const L = (7 + hh(i, 0, 32) * 5) * (0.55 + 0.45 * sm(u * 2.2));
    const a = q.a + Math.PI - 0.42 + (hh(i, 0, 33) - 0.5) * 0.35 - P.mane * 0.3 * sm((u - 0.55) / 0.3) + P.waveA * 0.02;
    const tip: V2 = [root[0] + Math.cos(a) * L, root[1] + Math.sin(a) * L];
    sk.np(true);
    const light = hh(i, 0, 34) < 0.4;
    sk.blade(root[0], root[1], tip[0], tip[1], s => (s < 0.3 ? 2.3 : 2.3 * (1 - (s - 0.3) / 0.7 * 0.85)) + 0.2, (p) => {
      p.l -= Math.abs(p.v) * 0.12;
      return light && p.t > 0.7 ? M.lockT : M.lock;
    }, { z0: 30, z1: 30.5, bend: (hh(i, 0, 35) - 0.5) * 2.4, curl: 0.2 });
  }
}

/** Crimson face, hooked ivory beak-plate, throat sac, whiskers. */
function drawHead(sk: Sk, R: Rig) {
  const { P, M, H } = R;
  const z0 = 18;
  // throat sac: a wrinkled wattle at rest, a glossy veined balloon when roaring
  if (P.sac > 0.03) {
    sk.np();
    const s = P.sac;
    const c = H.p(5 + s * 3, 9 + s * 7);
    const rx = 5 + s * 12, ry = 3.4 + s * 10;
    sk.ell(c[0], c[1], rx, ry, (p) => {
      if (s > 0.5) {
        const vv = Math.sin(p.u * 6 + Math.sin(p.v * 4) * 1.4) + Math.sin(p.v * 8 - p.u * 2.5) * 0.45;
        if (Math.abs(vv) < 0.1 && p.v > -0.5 && p.u < 0.6) return M.vein;
      } else if (Math.sin(p.u * 10) > 0.55) p.l -= 0.16;
      return M.sac;
    }, { rot: H.a + 0.25, rz: Math.min(rx, ry), z: z0 + 3 });
  }
  // skull: fur behind, bare crimson skin forward of the ear line
  sk.np();
  const sc = H.p(0, 0);
  sk.ell(sc[0], sc[1], 14, 12, (p) => {
    if (p.u + p.v * 0.3 > -0.3) {
      if (Math.sin(p.u * 12 + p.v * 3) > 0.84 && p.v > 0) p.l -= 0.1;
      return p.v > 0.6 ? M.faceD : M.face;
    }
    return p.v > 0.5 ? M.furB : M.fur;
  }, { rot: H.a, rz: 11, z: z0 });
  // heavy crimson cheek below the eye
  const ck = H.p(6, 3.5);
  sk.ell(ck[0], ck[1], 7, 5, (p) => (p.v > 0.5 ? M.faceD : M.face), { rot: H.a + 0.2, rz: 4, z: z0 + 7 });
  // lower beak-plate (opens with the gape)
  const g = P.gape;
  const la = H.ang(0.2 + g * 0.72);
  const l0 = H.p(9.5, 4.8);
  const l1: V2 = [l0[0] + Math.cos(la) * 19, l0[1] + Math.sin(la) * 19];
  if (g > 0.08) {
    const u0 = H.p(10, 1.6), ut = H.p(28, 4.8);
    sk.np();
    sk.poly([u0[0], u0[1], ut[0], ut[1], l1[0], l1[1], l0[0], l0[1] + 1], M.mouth, { z: z0 + 9 });
    if (P.tongue < 0.5) sk.tube([H.p(11, 5), lerp2(l0, l1, 0.55)], 2.4 * g + 0.4, M.tongue, { z: z0 + 9.5 });
  }
  sk.np();
  sk.blade(l0[0], l0[1], l1[0], l1[1], s => (s < 0.18 ? 3.8 : 3.8 * (1 - (s - 0.18) / 0.82) + 0.5), (p) => (p.t < 0.18 ? M.beakB : M.beak), { z0: z0 + 10, z1: z0 + 10.5, bend: 0.7, curl: 0.6 });
  // lolling tongue (panting): hangs out of the side of the gape
  if (P.tongue > 0.5) {
    sk.np();
    const tb = H.p(14, 6);
    sk.tube([tb, [tb[0] + 4, tb[1] + 3], [tb[0] + 6, tb[1] + 7.5]], t => 2 - t * 0.6, M.tongue, { z: z0 + 20 });
  }
  // upper beak-plate: arched, keeled and hooked like a raven's, crimson at the base
  sk.np();
  const u0 = H.p(8, -1.6), u1 = H.p(31, 4);
  sk.blade(u0[0], u0[1], u1[0], u1[1], s => (s < 0.12 ? 5.4 : 5.4 * (1 - Math.pow((s - 0.12) / 0.88, 1.2)) + 0.6), (p) => {
    if (p.t < 0.13) return M.beakB;
    if (Math.sin(p.t * 20) > 0.86 && p.v < 0.3) p.l -= 0.1;
    if (p.v > 0.6) p.l -= 0.14;
    return M.beak;
  }, { z0: z0 + 11, z1: z0 + 11.5, bend: -2.4, curl: 0.55 });
  const hk0 = H.p(28.8, 3.4), hk1 = H.p(30.6, 8.6);
  sk.blade(hk0[0], hk0[1], hk1[0], hk1[1], s => (1 - s) * 1.9 + 0.35, M.beak, { z0: z0 + 11.6, z1: z0 + 11.6, bend: 0.9 });
  // keel ridge over the base of the beak
  const kr = H.p(13, -4.2);
  sk.ell(kr[0], kr[1], 6, 2.2, M.beak, { rot: H.a + 0.12, rz: 2, z: z0 + 12.5, bias: 0.06 });
  // nostril slit and the whisker pits
  const ns = H.p(14, -2.4);
  sk.over(ns[0], ns[1], hex('#2a0e10')); sk.over(ns[0] + 1, ns[1] + 0.4, hex('#2a0e10'));
  for (const [dx, dy] of [[7, 3], [8.6, 4], [6.4, 4.8]] as V2[]) { const q = H.p(dx, dy); sk.overPaint(q[0], q[1], hex('#e8a8a0')); }
  // whiskers: pale strands fanning back and down from the cheek
  for (let i = 0; i < 3; i++) {
    const a = H.ang(0.12 + i * 0.22);
    const o = H.p(8.5 + i * 0.4, 3 + i * 0.9);
    for (let s = 2; s < 10 + i * 1.5; s++) {
      if (hh(i, s, 3) < 0.12) continue;
      sk.over(o[0] + Math.cos(a) * s, o[1] + Math.sin(a) * s + s * s * 0.03, hex(s < 6 ? '#f0e8dc' : '#c8bfb2'));
    }
  }
}

/** The seal's eye: the core eye plus a heavy half-closed lid. */
function sealEye(sk: Sk, c: V2, st: Eye): V2 {
  if (st === 'half') {
    const x = Math.floor(c[0]), y = Math.floor(c[1]);
    for (let dx = -2; dx <= 2; dx++) sk.over(x + dx, y, hex('#140c10'));
    sk.over(x - 1, y + 1, hex('#c49030')); sk.over(x, y + 1, hex('#e0a838')); sk.over(x + 1, y + 1, hex('#140a0c'));
    return c;
  }
  return drawEye(sk, c[0], c[1], EYE, st === 'alert' ? 'alert' : st === 'angry' ? 'angry' : st === 'closed' ? 'closed' : 'open');
}

/**
 * The neck crease behind the skull: a deep fold of bare pink skin running round the neck, where the
 * crown leeches sit in a ring (hence the name), each lifting a fan of pale gill-fronds.
 */
function neckFolds(sk: Sk, R: Rig) {
  const { P, M, n0, hc, neckA } = R;
  const c = lerp2(hc, n0, 0.36);
  const ax = Math.cos(neckA), ay = Math.sin(neckA);     // along the neck (toward the head)
  const bx = -Math.sin(neckA), by = Math.cos(neckA);    // across the neck (down toward the throat)
  const rN = 13;
  const at = (o: number, s: number): V2 => [c[0] + ax * o + bx * s, c[1] + ay * o + by * s];
  // the crease: pink skin lips either side of a dark groove, bowed like a collar
  const part = R.body;
  for (let s = -rN + 3; s <= rN - 2; s += 0.5) {
    const bow = (s / rN) ** 2 * 3;
    for (let o = -2; o <= 2; o++) {
      const q = at(o - bow, s);
      sk.paint(q[0], q[1], Math.abs(o) < 1 ? M.crease : M.skin, o > 0 ? 0.08 : -0.02, part);
    }
  }
  // the leeches: glossy indigo slugs lying in the groove, crowns of pale gill-fronds at the free end
  const S = [-8.5, -4.5, -0.5, 3.5, 7.5];
  S.forEach((s, i) => {
    const bow = (s / rN) ** 2 * 3;
    const b = at(-bow + (i % 2 ? 0.8 : -0.8), s);
    const la = neckA + Math.PI * (i % 2 ? 0.5 : -0.5) + (i % 2 ? -0.35 : 0.35) + Math.sin((P.crownPh + i * 0.21) * TAU) * 0.35 * P.crowns;
    const len = 3.6 + P.crowns * 1.3;
    const tip: V2 = [b[0] + Math.cos(la) * len, b[1] + Math.sin(la) * len];
    sk.np();
    sk.tube([b, lerp2(b, tip, 0.5), tip], t => 2 - t * 0.8 + Math.sin(t * Math.PI) * 0.3, (p) => {
      if (Math.sin(p.t * 14) > 0.7) p.l -= 0.12; // ringed body segments
      return M.leech;
    }, { z: 58 + i * 0.1 });
    const cx = tip[0] + Math.cos(la) * 1.2, cy = tip[1] + Math.sin(la) * 1.2;
    if (P.crowns > 0.3) {
      sk.over(cx, cy, hex('#e4fdff'));
      for (const d of [1.25, -1.25]) sk.over(cx + Math.cos(la + d) * 1.4, cy + Math.sin(la + d) * 1.4, hex('#9ee8f4'));
      sk.over(cx + Math.cos(la) * 1.2, cy + Math.sin(la) * 1.2, hex('#bff4fa'));
    } else sk.over(cx - Math.cos(la) * 0.6, cy - Math.sin(la) * 0.6, hex('#98a8e8'));
  });
}

/** The mane: locks rooted along the crown, nape and shoulders, falling back; bristles when it roars. */
function drawMane(sk: Sk, R: Rig) {
  const { P, M, H, n0, hc, neckA, at } = R;
  const roots: { p: V2; up: number; L: number; w: number; k: number }[] = [];
  // crown of the head
  for (let i = 0; i < 4; i++) roots.push({ p: H.p(-2 - i * 2.8, -10 + i * 0.8), up: H.a - Math.PI / 2 - 0.2, L: 9 + i * 2, w: 2.1, k: i / 16 });
  // nape (the mane parts over the fold patch, so the roots stay on the top line)
  for (let i = 0; i <= 7; i++) {
    const t = i / 7;
    const c = lerp2(hc, n0, t);
    const r = 11 + t * 8;
    const up = neckA - Math.PI / 2;
    roots.push({ p: [c[0] + Math.cos(up) * (r - 3), c[1] + Math.sin(up) * (r - 3)], up, L: 13 + t * 7, w: 2.5, k: 0.25 + t * 0.4 });
  }
  // shoulders
  for (let i = 0; i < 6; i++) {
    const s = at(0.99 - i * 0.05);
    const up = s.a - Math.PI / 2;
    roots.push({ p: [s.p[0] + Math.cos(up) * (s.r - 3), s.p[1] + Math.sin(up) * (s.r - 3)], up, L: 17 - i * 1.4, w: 2.6, k: 0.65 + i * 0.06 });
  }
  // rear locks first so the front ones lie over them
  for (let j = roots.length - 1; j >= 0; j--) {
    const Rt = roots[j];
    for (let layer = 1; layer >= 0; layer--) {
      const jit = (hh(j, layer, 21) - 0.5) * 0.3;
      const swing = P.shake * 0.5 * (1 - Rt.k * 0.4);
      // resting locks fall back and down over the shoulders; bristled ones stand up and back
      const fall = 1.7 + Rt.k * 0.25 - P.mane * 0.6;
      const a = Rt.up - fall + jit + swing;
      const L = Rt.L * (0.85 + hh(j, layer, 22) * 0.3) * (1 + P.mane * 0.15) * (layer ? 0.75 : 1);
      const off = layer ? 2.2 : 0;
      const b: V2 = [Rt.p[0] - Math.cos(Rt.up) * off, Rt.p[1] - Math.sin(Rt.up) * off];
      const tip: V2 = [b[0] + Math.cos(a) * L, b[1] + Math.sin(a) * L];
      sk.np(layer === 1);
      const light = hh(j, layer, 24) < 0.4;
      sk.blade(b[0], b[1], tip[0], tip[1], s => Rt.w * (s < 0.3 ? 1 : 1 - (s - 0.3) / 0.7 * 0.8) + 0.2, (p) => {
        p.l -= Math.abs(p.v) * 0.14;
        return light && p.t > 0.7 ? M.lockT : M.lock;
      }, { z0: 44 + (1 - layer), z1: 45 + (1 - layer), bend: (hh(j, layer, 23) - 0.5) * 3.4 + 0.8 - P.mane * 0.4, curl: 0.2 });
    }
  }
}

/** Fore-flipper: a long furred arm with a leathery paddle hand and three hooked claws. */
function foreFlipper(sk: Sk, R: Rig, near: boolean) {
  const { P, M, at } = R;
  const s = at(0.8);
  const z = near ? 60 : -30, bias = near ? 0 : -0.2;
  const shoulder: V2 = [s.p[0] + (near ? 3 : -2), s.p[1] + s.r * 0.3];
  const target = near ? P.foreN : P.foreF;
  const wrist: V2 = [target[0] - 10, Math.min(-3, target[1] - 3)];
  const [elbow, w] = ik2(shoulder, wrist, 17, 17, 1);
  sk.np();
  sk.tube([shoulder, elbow], t => 9 - t * 2.6, (p) => (p.v > 0.3 ? M.furB : M.fur), { z, bias });
  sk.tube([elbow, w], t => 6.4 - t * 2, (p) => (p.v > 0.3 ? M.furB : M.fur), { z: z + 0.5, bias });
  const armPart = sk.pid;
  sk.streaks(armPart, () => [-0.3, 0.95], { spacing: 2, len: 4, amp: 0.12, seed: near ? 53 : 54 });
  sk.tufts(armPart, (_x, _y, nx, ny) => (nx < 0 || ny > 0 ? [-0.8, 0.6] as V2 : null), { every: 2, len: 2, seed: near ? 51 : 52 });
  // paddle hand toward the target, digit ridges, three hooked claws on the leading edge
  const ha = Math.atan2(target[1] - w[1], target[0] - w[0]);
  const hand: V2 = [w[0] + Math.cos(ha) * 14, w[1] + Math.sin(ha) * 14];
  sk.np();
  sk.blade(w[0], w[1], hand[0], hand[1], s2 => 3.4 + Math.sin(s2 * Math.PI) * 2.4 - s2 * 1.4, (p) => {
    if (Math.abs(p.v) < 0.12 || Math.abs(Math.abs(p.v) - 0.55) < 0.1) p.l -= 0.12;
    return p.v > 0.6 ? M.flipD : M.flip;
  }, { z0: z + 1, z1: z + 1.5, bias, curl: 0.35 });
  for (let c = 0; c < 3; c++) {
    const b = lerp2(w, hand, 0.8 + c * 0.07);
    const off = (c - 1) * 2.4 - 0.5;
    const bx = b[0] - Math.sin(ha) * off, by = b[1] + Math.cos(ha) * off;
    const ca = ha + 0.35 + c * 0.12;
    const L = 6.2 - Math.abs(c - 1) * 1.2;
    sk.np();
    sk.blade(bx, by, bx + Math.cos(ca) * L, Math.min(-0.2, by + Math.sin(ca) * L), s2 => (1 - s2) * 1.2 + 0.25, (p) => (p.t > 0.5 ? M.claw : M.horn), { z0: z + 2, z1: z + 2.3, bend: 1, bias });
  }
}

/** Hind flippers: big webbed fans held back off the sand, or swung forward under the hips to push. */
function hindFlipper(sk: Sk, R: Rig, near: boolean) {
  const { P, M, at, tail } = R;
  const hip = at(0.2);
  const root = lerp2([tail[0] + 5, tail[1] + 1], [hip.p[0], hip.p[1] + hip.r * 0.55], P.hind);
  const a0 = near ? Math.PI + 0.3 : Math.PI + 0.62;
  const a1 = near ? 0.45 : 0.7;
  const a = a0 + (a1 - a0) * P.hind;
  const L = 23;
  const tip: V2 = [root[0] + Math.cos(a) * L, root[1] + Math.sin(a) * L];
  const z = near ? 50 : -24, bias = near ? 0 : -0.2;
  sk.np();
  sk.blade(root[0], root[1], tip[0], tip[1], s => 2.8 + s * 6.4 - (s > 0.86 ? (s - 0.86) * 22 : 0), (p) => {
    // five digit ridges fanning to a scalloped trailing edge
    const d = (p.v + 1) * 2.5, ridge = Math.abs(d - Math.floor(d) - 0.5);
    if (ridge < 0.13 && p.t > 0.22) p.l += 0.1;
    if (p.t > 0.88 && d - Math.floor(d) > 0.55) return M.flipD;
    return M.flip;
  }, { z0: z, z1: z + 1, bias, curl: 0.45, bend: near ? -1.5 : -1 });
}

export const CORVEXSEAL: SpeciesDef = {
  name: 'Corvex Seal', kind: 'mammal', len: 170, height: 50,
  anims: SEAL_ANIMS,
  canvas: () => ({ w: 250, h: 160, ox: 112, oy: 148 }),
  draw: (sk, anim, frame, eye) => draw(sk, anim, frame, eye),
  eyeFor: (anim, f) => (anim === 'roar' || anim === 'gallop' || anim === 'lunge' ? 'angry' : anim === 'sleep' || anim === 'pin' ? 'closed' : anim === 'wake' && f > 0 && f < 3 ? 'alert' : 'open'),
};
